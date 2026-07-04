import type { Solver } from '../solver/index.ts'
import {
  FACE_COLORS,
  FACES,
  parseMoves,
  invertMoves,
  moveToString,
  type Face,
  type Move,
} from '../core/cube.ts'
import { Cube3D } from '../render/cube3d.ts'
import { startCamera, stopStream, sampleFace, classify, type RGB } from './camera.ts'

// The Scan view: a manual cube "net" editor plus camera scanning. The net is the
// single source of truth; the camera fills it and the user corrects by tapping.

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
const NET_AREA: Record<Face, string> = { U: 'U', L: 'L', F: 'F', R: 'R', B: 'B', D: 'D' }
const FACE_NAME: Record<Face, string> = {
  U: 'white',
  D: 'yellow',
  F: 'green',
  B: 'blue',
  R: 'red',
  L: 'orange',
}

export type ScanApi = { onHide: () => void }

export function mountScan(el: HTMLElement, solver: Solver): ScanApi {
  const faces: Record<Face, Face[]> = {} as Record<Face, Face[]>
  for (const f of FACES) faces[f] = Array(9).fill(f)
  let active: Face = 'U'

  el.innerHTML = `
    <div class="scan-layout">
      <div class="net" id="net"></div>
      <div class="panel scan-panel">
        <button id="scan-camera" class="camera-btn">📷 Scan with camera</button>
        <div class="field">
          <label>Paint colour</label>
          <div class="palette" id="palette"></div>
        </div>
        <div class="btn-row">
          <button id="scan-reset">Reset</button>
          <button id="scan-solve" class="primary">Solve</button>
        </div>
        <div id="scan-status" class="status"></div>
        <div id="scan-solution" class="solution"></div>
        <p class="hint">Tap a colour then tap stickers to edit, or scan with the
          camera. Centres are fixed. Check the colours before solving.</p>
      </div>
    </div>
    <div class="cam-overlay" id="cam-overlay" style="display:none">
      <video id="cam-video" playsinline muted></video>
      <div class="cam-guide"><div></div><div></div><div></div><div></div>
        <div></div><div></div><div></div><div></div><div></div></div>
      <div class="cam-prompt" id="cam-prompt"></div>
      <div class="cam-controls">
        <button id="cam-cancel">Cancel</button>
        <button id="cam-capture" class="primary">Capture</button>
      </div>
    </div>
    <div class="player-overlay" id="player-overlay" style="display:none">
      <div class="canvas-host" id="player-canvas"></div>
      <div class="player-bar">
        <div class="player-strip" id="player-strip"></div>
        <div class="player-controls">
          <button id="player-back">‹ Back</button>
          <button id="player-prev" class="step">◀</button>
          <span id="player-count" class="player-count"></span>
          <button id="player-next" class="step">▶</button>
        </div>
      </div>
    </div>`

  const netEl = el.querySelector('#net') as HTMLElement
  const paletteEl = el.querySelector('#palette') as HTMLElement
  const statusEl = el.querySelector('#scan-status') as HTMLElement
  const solutionEl = el.querySelector('#scan-solution') as HTMLElement

  // --- palette --------------------------------------------------------------
  for (const f of FACES) {
    const sw = document.createElement('button')
    sw.className = 'swatch'
    sw.style.background = hex(FACE_COLORS[f])
    sw.dataset.face = f
    sw.title = FACE_NAME[f]
    paletteEl.appendChild(sw)
  }
  const refreshPalette = () => {
    for (const sw of paletteEl.querySelectorAll<HTMLElement>('.swatch'))
      sw.classList.toggle('active', sw.dataset.face === active)
  }
  paletteEl.addEventListener('click', (e) => {
    const sw = (e.target as HTMLElement).closest('.swatch') as HTMLElement | null
    if (!sw) return
    active = sw.dataset.face as Face
    refreshPalette()
  })

  // --- net ------------------------------------------------------------------
  function buildNet() {
    netEl.innerHTML = ''
    for (const f of FACES) {
      const face = document.createElement('div')
      face.className = 'face'
      face.style.gridArea = NET_AREA[f]
      for (let i = 0; i < 9; i++) {
        const st = document.createElement('div')
        st.className = 'sticker' + (i === 4 ? ' center' : '')
        st.style.background = hex(FACE_COLORS[faces[f][i]])
        st.dataset.face = f
        st.dataset.i = String(i)
        face.appendChild(st)
      }
      netEl.appendChild(face)
    }
  }
  netEl.addEventListener('click', (e) => {
    const st = (e.target as HTMLElement).closest('.sticker') as HTMLElement | null
    if (!st || st.classList.contains('center')) return
    const f = st.dataset.face as Face
    faces[f][Number(st.dataset.i)] = active
    st.style.background = hex(FACE_COLORS[active])
    solutionEl.textContent = ''
    statusEl.textContent = ''
  })

  // --- solve ----------------------------------------------------------------
  const facelets = () => FACES.map((f) => faces[f].join('')).join('')
  el.querySelector('#scan-solve')!.addEventListener('click', async () => {
    statusEl.textContent = 'Solving…'
    solutionEl.textContent = ''
    try {
      const solution = await solver.solveFacelets(facelets())
      if (solution.trim() === '') {
        statusEl.textContent = 'This cube is already solved.'
      } else {
        const moves = parseMoves(solution)
        statusEl.textContent = `Solution — ${moves.length} moves`
        solutionEl.textContent = solution
        openPlayer(moves)
      }
    } catch (e) {
      statusEl.textContent = 'Not solvable: ' + (e as Error).message
    }
  })
  el.querySelector('#scan-reset')!.addEventListener('click', () => {
    for (const f of FACES) faces[f] = Array(9).fill(f)
    buildNet()
    statusEl.textContent = ''
    solutionEl.textContent = ''
  })

  // --- camera ---------------------------------------------------------------
  const overlay = el.querySelector('#cam-overlay') as HTMLElement
  const video = el.querySelector('#cam-video') as HTMLVideoElement
  const promptEl = el.querySelector('#cam-prompt') as HTMLElement
  let stream: MediaStream | null = null
  let step = 0
  const facesRGB = {} as Record<Face, RGB[]>

  function updatePrompt() {
    const f = FACES[step]
    promptEl.innerHTML = `Face ${step + 1} of 6 — centre the <b>${FACE_NAME[f]}</b> face in the grid`
  }
  function closeCamera() {
    stopStream(stream)
    stream = null
    overlay.style.display = 'none'
  }
  async function openCamera() {
    step = 0
    overlay.style.display = 'flex'
    updatePrompt()
    try {
      stream = await startCamera(video)
    } catch (e) {
      overlay.style.display = 'none'
      statusEl.textContent = 'Camera unavailable: ' + (e as Error).message
    }
  }
  function capture() {
    if (!stream) return
    facesRGB[FACES[step]] = sampleFace(video)
    step++
    if (step >= FACES.length) {
      const classified = classify(facesRGB)
      for (const f of FACES) faces[f] = classified[f].slice()
      buildNet()
      closeCamera()
      statusEl.textContent = 'Scanned — check the colours, fix any, then Solve.'
      solutionEl.textContent = ''
    } else {
      updatePrompt()
    }
  }
  el.querySelector('#scan-camera')!.addEventListener('click', openCamera)
  el.querySelector('#cam-capture')!.addEventListener('click', capture)
  el.querySelector('#cam-cancel')!.addEventListener('click', closeCamera)
  // Stop the camera if the page is hidden (privacy/battery; iOS lifecycle).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && stream) closeCamera()
  })

  // --- step-by-step solution player ----------------------------------------
  const playerOverlay = el.querySelector('#player-overlay') as HTMLElement
  const playerCanvas = el.querySelector('#player-canvas') as HTMLElement
  const stripEl = el.querySelector('#player-strip') as HTMLElement
  const countEl = el.querySelector('#player-count') as HTMLElement
  let playerCube: Cube3D | null = null
  let playerMoves: Move[] = []
  let playerIndex = 0

  function renderStrip() {
    stripEl.innerHTML = playerMoves
      .map((m, i) => {
        const cls = i < playerIndex ? 'done' : i === playerIndex ? 'cur' : ''
        return `<span class="mv ${cls}">${moveToString(m)}</span>`
      })
      .join('')
    countEl.textContent = `${playerIndex} / ${playerMoves.length}`
    ;(stripEl.querySelector('.cur') as HTMLElement | null)?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
    })
  }
  function openPlayer(moves: Move[]) {
    playerMoves = moves
    playerIndex = 0
    playerOverlay.style.display = 'flex'
    if (!playerCube) playerCube = new Cube3D(playerCanvas)
    playerCube.resume()
    playerCube.reset()
    playerCube.applyInstant(invertMoves(moves)) // solved → the scanned state
    playerCube.onShown()
    renderStrip()
  }
  function closePlayer() {
    playerOverlay.style.display = 'none'
    playerCube?.pause()
  }
  function stepNext() {
    if (!playerCube || playerCube.isBusy() || playerIndex >= playerMoves.length) return
    playerCube.queueMoves([playerMoves[playerIndex]])
    playerIndex++
    renderStrip()
  }
  function stepPrev() {
    if (!playerCube || playerCube.isBusy() || playerIndex <= 0) return
    playerIndex--
    playerCube.queueMoves(invertMoves([playerMoves[playerIndex]]))
    renderStrip()
  }
  el.querySelector('#player-next')!.addEventListener('click', stepNext)
  el.querySelector('#player-prev')!.addEventListener('click', stepPrev)
  el.querySelector('#player-back')!.addEventListener('click', closePlayer)

  refreshPalette()
  buildNet()

  return {
    onHide: () => {
      closeCamera()
      closePlayer()
    },
  }
}

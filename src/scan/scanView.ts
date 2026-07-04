import type { Solver } from '../solver/index.ts'
import { FACE_COLORS, FACES, type Face } from '../core/cube.ts'

// The Scan view. For now it's a manual cube "net" editor: tap a colour, then tap
// stickers to match your physical cube, and Solve. This same net is the
// correction grid the camera scanner will fill in later (M4b).

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

// Placement of each face in the unfolded cross net.
const NET_AREA: Record<Face, string> = { U: 'U', L: 'L', F: 'F', R: 'R', B: 'B', D: 'D' }

export function mountScan(el: HTMLElement, solver: Solver) {
  // Per-face sticker colours (Face letters), in facelet reading order; index 4
  // is the fixed centre. Start from a solved cube.
  const faces: Record<Face, Face[]> = {} as Record<Face, Face[]>
  for (const f of FACES) faces[f] = Array(9).fill(f)

  let active: Face = 'U'

  el.innerHTML = `
    <div class="scan-layout">
      <div class="net" id="net"></div>
      <div class="panel scan-panel">
        <div class="field">
          <label>Paint colour</label>
          <div class="palette" id="palette"></div>
        </div>
        <div class="btn-row">
          <button id="scan-reset">Reset</button>
        </div>
        <button id="scan-solve" class="primary">Solve</button>
        <div id="scan-status" class="status"></div>
        <div id="scan-solution" class="solution"></div>
        <p class="hint">Tap a colour, then tap stickers to match your cube. Centres are fixed.
          Camera scanning comes next.</p>
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
    sw.title = f
    paletteEl.appendChild(sw)
  }
  function refreshPalette() {
    for (const sw of paletteEl.querySelectorAll<HTMLElement>('.swatch')) {
      sw.classList.toggle('active', sw.dataset.face === active)
    }
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
    const i = Number(st.dataset.i)
    faces[f][i] = active
    st.style.background = hex(FACE_COLORS[active])
    solutionEl.textContent = ''
    statusEl.textContent = ''
  })

  // --- solve ----------------------------------------------------------------
  function facelets(): string {
    return FACES.map((f) => faces[f].join('')).join('')
  }
  el.querySelector('#scan-solve')!.addEventListener('click', async () => {
    statusEl.textContent = 'Solving…'
    solutionEl.textContent = ''
    try {
      const solution = await solver.solveFacelets(facelets())
      if (solution.trim() === '') {
        statusEl.textContent = 'This cube is already solved.'
      } else {
        statusEl.textContent = `Solution — ${solution.trim().split(/\s+/).length} moves`
        solutionEl.textContent = solution
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

  refreshPalette()
  buildNet()
}

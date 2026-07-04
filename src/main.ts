import './style.css'
import { Cube3D } from './render/cube3d.ts'
import { randomScramble, parseMoves } from './core/cube.ts'
import { Solver } from './solver/index.ts'
import { mountTimer } from './timer/timerView.ts'

type ViewName = 'cube' | 'solve' | 'scan' | 'timer'

const viewRoot = document.getElementById('view') as HTMLElement
const tabbar = document.getElementById('tabbar') as HTMLElement

// Start the solver worker at boot so its ~1–2 s table init is done by the time
// the user opens Solve.
const solver = new Solver()

const views: Record<ViewName, HTMLElement> = {
  cube: makeView('cube'),
  solve: makeView('solve'),
  scan: makeView('scan'),
  timer: makeView('timer'),
}

function makeView(name: ViewName): HTMLElement {
  const el = document.createElement('section')
  el.className = 'view'
  el.dataset.view = name
  viewRoot.appendChild(el)
  return el
}

// --- Cube view: free-play virtual cube ---------------------------------------
let cubeMain: Cube3D | null = null

function initCubeView() {
  const el = views.cube
  const host = document.createElement('div')
  host.className = 'canvas-host'
  el.appendChild(host)

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'
  toolbar.innerHTML = `<button id="btn-scramble">Scramble</button><button id="btn-reset">Reset</button>`
  el.appendChild(toolbar)

  cubeMain = new Cube3D(host)
  toolbar.querySelector('#btn-scramble')!.addEventListener('click', () => {
    if (cubeMain && !cubeMain.isBusy()) cubeMain.queueMoves(randomScramble(25))
  })
  toolbar.querySelector('#btn-reset')!.addEventListener('click', () => cubeMain?.reset())
}

// --- Solve view: scramble → animated solution --------------------------------
let cubeSolve: Cube3D | null = null
let solveInited = false

function initSolveView() {
  const el = views.solve
  el.innerHTML = `
    <div class="solve-layout">
      <div class="canvas-host solve-canvas"></div>
      <div class="panel">
        <div class="field">
          <label for="scramble-input">Scramble</label>
          <textarea id="scramble-input" rows="3" spellcheck="false"
            placeholder="e.g. R U R' U' or generate one"></textarea>
        </div>
        <div class="btn-row">
          <button id="new-scramble">New scramble</button>
          <button id="apply-scramble">Apply</button>
        </div>
        <button id="solve-btn" class="primary">Solve</button>
        <div id="solve-status" class="status"></div>
        <div id="solution-out" class="solution"></div>
      </div>
    </div>`

  const host = el.querySelector('.solve-canvas') as HTMLElement
  cubeSolve = new Cube3D(host)

  const input = el.querySelector('#scramble-input') as HTMLTextAreaElement
  const status = el.querySelector('#solve-status') as HTMLElement
  const out = el.querySelector('#solution-out') as HTMLElement
  let applied = ''
  const setStatus = (t: string) => (status.textContent = t)

  function applyScramble(animate: boolean) {
    const moves = parseMoves(input.value)
    cubeSolve!.reset()
    if (animate) cubeSolve!.queueMoves(moves)
    else cubeSolve!.applyInstant(moves)
    applied = input.value.trim()
    out.textContent = ''
  }

  async function newScramble() {
    setStatus('Generating…')
    try {
      input.value = await solver.scramble()
      applyScramble(true)
      setStatus('Scrambled — press Solve.')
    } catch (e) {
      setStatus('Scramble failed: ' + e)
    }
  }

  async function solve() {
    const scr = input.value.trim()
    if (!scr) {
      setStatus('Enter or generate a scramble first.')
      return
    }
    if (scr !== applied) applyScramble(false) // jump cube to the scrambled state
    setStatus('Solving…')
    try {
      const solution = await solver.solve(scr)
      const moves = parseMoves(solution)
      setStatus(`Solution — ${moves.length} moves`)
      out.textContent = solution
      cubeSolve!.queueMoves(moves)
    } catch (e) {
      setStatus('Solve failed: ' + e)
    }
  }

  el.querySelector('#new-scramble')!.addEventListener('click', newScramble)
  el.querySelector('#apply-scramble')!.addEventListener('click', () => {
    applyScramble(true)
    setStatus('Applied.')
  })
  el.querySelector('#solve-btn')!.addEventListener('click', solve)

  setStatus('Initializing solver…')
  solver.ready().then(() => setStatus('Ready — generate a scramble.'))
}

function ensureSolve() {
  if (!solveInited) {
    initSolveView()
    solveInited = true
  }
}

// --- Timer view --------------------------------------------------------------
let timerInited = false
function ensureTimer() {
  if (!timerInited) {
    mountTimer(views.timer, solver)
    timerInited = true
  }
}

// --- Placeholder views -------------------------------------------------------
function placeholder(name: ViewName, title: string, note: string) {
  views[name].innerHTML = `<div class="placeholder"><h2>${title}</h2><p>${note}</p></div>`
}
placeholder('scan', 'Scan', 'Point your camera at each face to read the colours. (Coming later.)')

// --- Tab routing -------------------------------------------------------------
function show(name: ViewName) {
  for (const v of Object.values(views)) v.classList.remove('active')
  views[name].classList.add('active')
  for (const btn of tabbar.querySelectorAll('button')) {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.view === name)
  }
  if (name === 'solve') ensureSolve()
  if (name === 'timer') ensureTimer()
  // Only run the render loop for the visible cube.
  if (name === 'cube') {
    cubeSolve?.pause()
    cubeMain?.resume()
  } else if (name === 'solve') {
    cubeMain?.pause()
    cubeSolve?.resume()
  } else {
    cubeMain?.pause()
    cubeSolve?.pause()
  }
}

tabbar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn?.dataset.view) show(btn.dataset.view as ViewName)
})

initCubeView()
show('cube')

import './style.css'
import { Cube3D } from './render/cube3d.ts'
import { randomScramble } from './core/cube.ts'

type ViewName = 'cube' | 'solve' | 'scan' | 'timer'

const viewRoot = document.getElementById('view') as HTMLElement
const tabbar = document.getElementById('tabbar') as HTMLElement

// Build a container per view; only one is `.active` (visible) at a time.
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

// --- Cube view: the 3D virtual cube with a scramble/reset toolbar ------------
let cube3d: Cube3D | null = null

function initCubeView() {
  const el = views.cube
  const canvasHost = document.createElement('div')
  canvasHost.style.position = 'absolute'
  canvasHost.style.inset = '0'
  el.appendChild(canvasHost)

  const toolbar = document.createElement('div')
  toolbar.className = 'toolbar'
  toolbar.innerHTML = `
    <button id="btn-scramble">Scramble</button>
    <button id="btn-reset">Reset</button>
  `
  el.appendChild(toolbar)

  cube3d = new Cube3D(canvasHost)

  toolbar.querySelector('#btn-scramble')!.addEventListener('click', () => {
    if (cube3d && !cube3d.isBusy()) cube3d.queueMoves(randomScramble(25))
  })
  toolbar.querySelector('#btn-reset')!.addEventListener('click', () => {
    cube3d?.reset()
  })
}

// --- Placeholder views (filled in later milestones) --------------------------
function placeholder(name: ViewName, title: string, note: string) {
  views[name].innerHTML = `
    <div class="placeholder">
      <h2>${title}</h2>
      <p>${note}</p>
    </div>`
}
placeholder('solve', 'Solve', 'Enter a scramble and get a step-by-step solution. (Coming next.)')
placeholder('scan', 'Scan', 'Point your camera at each face to read the colours. (Coming later.)')
placeholder('timer', 'Timer', 'Speedcubing timer with scrambles and stats. (Coming later.)')

// --- Tab routing -------------------------------------------------------------
function show(name: ViewName) {
  for (const v of Object.values(views)) v.classList.remove('active')
  views[name].classList.add('active')
  for (const btn of tabbar.querySelectorAll('button')) {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.view === name)
  }
  if (name === 'cube') cube3d?.onShown()
}

tabbar.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn?.dataset.view) show(btn.dataset.view as ViewName)
})

// Boot: the cube view is active by default.
initCubeView()
show('cube')

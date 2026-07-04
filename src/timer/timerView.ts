import type { Solver } from '../solver/index.ts'
import {
  type Solve,
  type Penalty,
  average,
  best,
  sessionMean,
  formatMs,
  effectiveMs,
} from './stats.ts'

const STORE_KEY = 'cube3x3.timer.solves'
const READY_MS = 350 // hold this long before a solve is armed
const INSPECTION_S = 15

type State = 'idle' | 'inspecting' | 'holding' | 'running'

/** Mount the speedcubing timer into `el`. Uses the solver to generate WCA
 *  scrambles. Solves persist to localStorage. */
export function mountTimer(el: HTMLElement, solver: Solver) {
  el.innerHTML = `
    <div class="timer-layout">
      <div class="scramble-bar"><span id="t-scramble">…</span>
        <button id="t-newscramble" title="New scramble">↻</button></div>
      <div class="timer-main" id="t-pad">
        <div class="time" id="t-time">0.00</div>
        <div class="t-hint" id="t-hint">hold Space or touch &amp; hold to start</div>
      </div>
      <div class="timer-side">
        <label class="insp"><input type="checkbox" id="t-insp"> 15s inspection</label>
        <div class="stat-grid" id="t-stats"></div>
        <div class="solve-list" id="t-list"></div>
      </div>
    </div>`

  const scrambleEl = el.querySelector('#t-scramble') as HTMLElement
  const timeEl = el.querySelector('#t-time') as HTMLElement
  const hintEl = el.querySelector('#t-hint') as HTMLElement
  const padEl = el.querySelector('#t-pad') as HTMLElement
  const statsEl = el.querySelector('#t-stats') as HTMLElement
  const listEl = el.querySelector('#t-list') as HTMLElement
  const inspToggle = el.querySelector('#t-insp') as HTMLInputElement

  let solves: Solve[] = load()
  let scramble = ''
  let state: State = 'idle'
  let startTime = 0
  let raf = 0
  let readyTimer = 0
  let armed = false
  let inspStart = 0

  // --- scramble -------------------------------------------------------------
  function newScramble() {
    scrambleEl.textContent = '…'
    solver.scramble().then((s) => {
      scramble = s
      scrambleEl.textContent = s
    })
  }

  // --- timer state machine --------------------------------------------------
  function setTime(ms: number) {
    timeEl.textContent = formatMs(ms)
  }

  function startInspection() {
    state = 'inspecting'
    inspStart = performance.now()
    padEl.classList.add('inspecting')
    const tick = () => {
      if (state !== 'inspecting') return
      const left = INSPECTION_S - (performance.now() - inspStart) / 1000
      timeEl.textContent = left > 0 ? Math.ceil(left).toString() : '+2'
      raf = requestAnimationFrame(tick)
    }
    tick()
    hintEl.textContent = 'hold to get ready, release to start'
  }

  function startHold() {
    cancelAnimationFrame(raf)
    padEl.classList.remove('inspecting')
    state = 'holding'
    armed = false
    padEl.classList.add('holding')
    hintEl.textContent = 'keep holding…'
    readyTimer = window.setTimeout(() => {
      armed = true
      padEl.classList.remove('holding')
      padEl.classList.add('ready')
      hintEl.textContent = 'release!'
    }, READY_MS)
  }

  function cancelHold() {
    clearTimeout(readyTimer)
    padEl.classList.remove('holding', 'ready')
    state = 'idle'
    hintEl.textContent = 'hold Space or touch & hold to start'
  }

  function startSolve() {
    clearTimeout(readyTimer)
    padEl.classList.remove('holding', 'ready')
    state = 'running'
    startTime = performance.now()
    hintEl.textContent = 'solve! press to stop'
    const tick = () => {
      if (state !== 'running') return
      setTime(performance.now() - startTime)
      raf = requestAnimationFrame(tick)
    }
    tick()
  }

  function stopSolve() {
    cancelAnimationFrame(raf)
    state = 'idle'
    const ms = performance.now() - startTime
    setTime(ms)
    solves.push({ ms, scramble, date: Date.now(), penalty: 'none' })
    save()
    render()
    hintEl.textContent = 'hold Space or touch & hold to start'
    newScramble()
  }

  function onDown() {
    if (state === 'running') {
      stopSolve()
      return
    }
    if (state === 'idle') {
      if (inspToggle.checked) startInspection()
      else startHold()
    } else if (state === 'inspecting') {
      startHold()
    }
  }

  function onUp() {
    if (state === 'holding') {
      if (armed) startSolve()
      else cancelHold()
    }
  }

  // --- stats + solve list ---------------------------------------------------
  function render() {
    const cells: [string, number | null][] = [
      ['best', best(solves)],
      ['ao5', average(solves, 5)],
      ['ao12', average(solves, 12)],
      ['mean', sessionMean(solves)],
      ['solves', solves.length],
    ]
    statsEl.innerHTML = cells
      .map(([k, v]) =>
        k === 'solves'
          ? `<div class="stat"><span>${v}</span><label>${k}</label></div>`
          : `<div class="stat"><span>${v === null ? '—' : formatMs(v)}</span><label>${k}</label></div>`,
      )
      .join('')

    listEl.innerHTML = solves
      .map((s, i) => {
        const t = formatMs(effectiveMs(s))
        return `<div class="solve-row" data-i="${i}">
          <span class="n">${i + 1}.</span>
          <span class="t ${s.penalty === 'dnf' ? 'dnf' : ''}">${t}</span>
          <span class="actions">
            <button data-act="plus2" class="${s.penalty === 'plus2' ? 'on' : ''}">+2</button>
            <button data-act="dnf" class="${s.penalty === 'dnf' ? 'on' : ''}">DNF</button>
            <button data-act="del">✕</button>
          </span>
        </div>`
      })
      .reverse()
      .join('')
  }

  listEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button')
    const row = (e.target as HTMLElement).closest('.solve-row') as HTMLElement | null
    if (!btn || !row) return
    const i = Number(row.dataset.i)
    const act = btn.dataset.act
    if (act === 'del') solves.splice(i, 1)
    else if (act === 'plus2')
      solves[i].penalty = solves[i].penalty === 'plus2' ? 'none' : ('plus2' as Penalty)
    else if (act === 'dnf')
      solves[i].penalty = solves[i].penalty === 'dnf' ? 'none' : ('dnf' as Penalty)
    save()
    render()
  })

  // --- input wiring ---------------------------------------------------------
  // Keyboard (only while this view is active).
  const isActive = () => el.classList.contains('active')
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !isActive() || e.repeat) return
    e.preventDefault()
    onDown()
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !isActive()) return
    e.preventDefault()
    onUp()
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // Touch / pointer on the pad.
  padEl.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    onDown()
  })
  padEl.addEventListener('pointerup', (e) => {
    e.preventDefault()
    onUp()
  })

  el.querySelector('#t-newscramble')!.addEventListener('click', () => {
    if (state === 'idle') newScramble()
  })

  // --- persistence ----------------------------------------------------------
  function load(): Solve[] {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      return raw ? (JSON.parse(raw) as Solve[]) : []
    } catch {
      return []
    }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(solves))
    } catch {
      /* storage may be unavailable in private mode */
    }
  }

  render()
  newScramble()
}

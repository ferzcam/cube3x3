// Runs the solvers off the main thread.
//  - cube-solver: WCA scramble generation + solving from a move sequence.
//  - cubejs: solving from a facelet string (the scanned-cube path).
// cube-solver's tables init eagerly at startup; cubejs inits lazily on first
// facelet solve (scanning happens well after boot). A facelet string is ALWAYS
// validated first — an unsolvable cube makes the two-phase solver loop forever.
import cubeSolver from 'cube-solver'
import Cube from 'cubejs'
import { validateFacelets } from '../core/validate.ts'
import { SOLVED_FACELETS } from '../core/cube.ts'

const post = (m: unknown) =>
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(m)

let ready = false
function ensureReady() {
  if (!ready) {
    cubeSolver.initialize('kociemba')
    ready = true
  }
}
let cubejsReady = false
function ensureCubejs() {
  if (!cubejsReady) {
    Cube.initSolver()
    cubejsReady = true
  }
}

ensureReady()
post({ type: 'ready' })

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'solve'; id: number; scramble: string }
    | { type: 'scramble'; id: number }
    | { type: 'solveFacelets'; id: number; facelets: string }
  try {
    if (msg.type === 'solve') {
      ensureReady()
      const solution = cubeSolver.solve(msg.scramble, 'kociemba')
      post({ type: 'result', id: msg.id, ok: true, solution })
    } else if (msg.type === 'scramble') {
      ensureReady()
      const scramble = cubeSolver.scramble('3x3')
      post({ type: 'result', id: msg.id, ok: true, scramble })
    } else if (msg.type === 'solveFacelets') {
      const v = validateFacelets(msg.facelets)
      if (!v.ok) {
        post({ type: 'result', id: msg.id, ok: false, error: v.error })
        return
      }
      if (msg.facelets === SOLVED_FACELETS) {
        post({ type: 'result', id: msg.id, ok: true, solution: '' })
        return
      }
      ensureCubejs()
      const solution = Cube.fromString(msg.facelets).solve()
      post({ type: 'result', id: msg.id, ok: true, solution })
    }
  } catch (err) {
    post({ type: 'result', id: msg.id, ok: false, error: String(err) })
  }
}

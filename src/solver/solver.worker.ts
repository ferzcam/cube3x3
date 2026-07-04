// Runs the Kociemba solver off the main thread. Table initialization (~1–2 s)
// happens eagerly at worker startup so the UI never blocks on it.
import cubeSolver from 'cube-solver'

const post = (m: unknown) =>
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(m)

let ready = false
function ensureReady() {
  if (!ready) {
    cubeSolver.initialize('kociemba')
    ready = true
  }
}

ensureReady()
post({ type: 'ready' })

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'solve'; id: number; scramble: string }
    | { type: 'scramble'; id: number }
  try {
    ensureReady()
    if (msg.type === 'solve') {
      const solution = cubeSolver.solve(msg.scramble, 'kociemba')
      post({ type: 'result', id: msg.id, ok: true, solution })
    } else if (msg.type === 'scramble') {
      const scramble = cubeSolver.scramble('3x3')
      post({ type: 'result', id: msg.id, ok: true, scramble })
    }
  } catch (err) {
    post({ type: 'result', id: msg.id, ok: false, error: String(err) })
  }
}

// Main-thread client for the solver Web Worker. Promise-based request/response
// keyed by an incrementing id, plus a ready() promise for the one-time table
// init so the UI can show an "initializing" state.

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void }

export class Solver {
  private worker: Worker
  private pending = new Map<number, Pending>()
  private seq = 0
  private readyPromise: Promise<void>

  constructor() {
    this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
      type: 'module',
    })
    let markReady!: () => void
    this.readyPromise = new Promise((r) => (markReady = r))

    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'ready') {
        markReady()
        return
      }
      if (m.type === 'result') {
        const p = this.pending.get(m.id)
        if (!p) return
        this.pending.delete(m.id)
        if (m.ok) p.resolve(m)
        else p.reject(new Error(m.error))
      }
    }
  }

  /** Resolves once the solver's tables are initialized. */
  ready() {
    return this.readyPromise
  }

  private request(payload: Record<string, unknown>): Promise<any> {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ ...payload, id })
    })
  }

  /** Solve the cube state reached by applying `scramble` to a solved cube. */
  async solve(scramble: string): Promise<string> {
    const r = await this.request({ type: 'solve', scramble })
    return r.solution as string
  }

  /** A WCA random-state 3×3 scramble. */
  async scramble(): Promise<string> {
    const r = await this.request({ type: 'scramble' })
    return r.scramble as string
  }

  /** Solve from a 54-char URFDLB facelet string (the scanned-cube path).
   *  Rejects (with a reason) if the facelets aren't a solvable cube. */
  async solveFacelets(facelets: string): Promise<string> {
    const r = await this.request({ type: 'solveFacelets', facelets })
    return r.solution as string
  }
}

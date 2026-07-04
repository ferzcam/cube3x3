// Drive the actual solver worker module with a minimal worker-global shim to
// confirm cube-solver is wired correctly through the postMessage protocol.
const outbox: any[] = []
let handler: ((e: any) => void) | null = null
;(globalThis as any).self = {
  set onmessage(fn: any) {
    handler = fn
  },
  get onmessage() {
    return handler
  },
  postMessage(m: any) {
    outbox.push(m)
  },
}

await import('../src/solver/solver.worker.ts')

if (!outbox.some((m) => m.type === 'ready')) {
  console.error('✗ worker never signalled ready')
  process.exit(1)
}
handler!({ data: { type: 'solve', id: 1, scramble: "R U R' U'" } })
const res = outbox.find((m) => m.type === 'result' && m.id === 1)
if (!res?.ok || !res.solution) {
  console.error('✗ worker solve failed:', res)
  process.exit(1)
}
console.log('✓ worker smoke passed — solution:', res.solution)
process.exit(0)

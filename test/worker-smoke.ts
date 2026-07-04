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
const { default: Cube } = await import('cubejs')

let failures = 0
const grab = (id: number) => outbox.find((m) => m.type === 'result' && m.id === id)
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  ✗', msg)
  }
}

if (!outbox.some((m) => m.type === 'ready')) {
  console.error('✗ worker never signalled ready')
  process.exit(1)
}

// solve from a move sequence
handler!({ data: { type: 'solve', id: 1, scramble: "R U R' U'" } })
check(grab(1)?.ok && !!grab(1)?.solution, `solve(moves) → ${grab(1)?.solution}`)

// solve a solved cube via facelets → empty solution (short-circuit)
handler!({
  data: {
    type: 'solveFacelets',
    id: 2,
    facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
  },
})
check(grab(2)?.ok && grab(2)?.solution === '', 'solveFacelets(solved) → empty')

// solve a scrambled cube via facelets and verify the solution actually solves it
const scrambled = Cube.random().asString()
handler!({ data: { type: 'solveFacelets', id: 3, facelets: scrambled } })
const r3 = grab(3)
let solves = false
if (r3?.ok) {
  const c = Cube.fromString(scrambled)
  c.move(r3.solution)
  solves = c.asString() === 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
}
check(!!r3?.ok && solves, `solveFacelets(scrambled) actually solves (${r3?.solution?.split(' ').length} moves)`)

// invalid facelets → rejected with an error (not a hang)
handler!({
  data: {
    type: 'solveFacelets',
    id: 4,
    facelets: 'UUUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBB',
  },
})
check(grab(4)?.ok === false && !!grab(4)?.error, `invalid facelets rejected: ${grab(4)?.error}`)

if (failures === 0) {
  console.log('✓ worker smoke passed (move-solve + facelet-solve + validation)')
  process.exit(0)
} else {
  console.error(`✗ ${failures} worker check(s) failed`)
  process.exit(1)
}

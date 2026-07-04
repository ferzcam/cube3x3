// Verify the solvability validator: it must accept every solvable cube and
// reject unsolvable ones — especially the parity cases that make the solver
// loop forever. We cross-check against cubejs (the ground truth for solvable).
import Cube from 'cubejs'
import { validateFacelets } from '../src/core/validate.ts'
import { SOLVED_FACELETS } from '../src/core/cube.ts'

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  ✗', msg)
  }
}

// Solved cube is valid.
check(validateFacelets(SOLVED_FACELETS).ok, 'solved cube is valid')

// No false negatives: 1000 random (always-solvable) states must all validate.
let falseNeg = 0
for (let i = 0; i < 1000; i++) {
  const f = Cube.random().asString()
  if (!validateFacelets(f).ok) {
    falseNeg++
    if (falseNeg <= 2) console.error('  ✗ rejected a valid state:', f, validateFacelets(f).error)
  }
}
check(falseNeg === 0, `no false negatives over 1000 random states (had ${falseNeg})`)

// Reject wrong colour counts.
check(!validateFacelets(SOLVED_FACELETS.replace(/B$/, 'U')).ok, 'rejects wrong counts')

// Reject two swapped edge pieces (breaks permutation parity — the hang case).
// UR edge = facelets [5,10] (U,R); UF edge = [7,19] (U,F). The U-stickers are
// identical, so swapping the pieces reduces to swapping the R↔F stickers.
{
  const a = SOLVED_FACELETS.split('')
  ;[a[10], a[19]] = [a[19], a[10]]
  const r = validateFacelets(a.join(''))
  check(!r.ok, `rejects two swapped edges (${r.error ?? 'but accepted it!'})`)
}

// Reject a flipped edge (orientation parity).
{
  const a = SOLVED_FACELETS.split('')
  // UF edge facelets are indices 7 (U) and 19 (F); flip them.
  ;[a[7], a[19]] = [a[19], a[7]]
  const r = validateFacelets(a.join(''))
  check(!r.ok, `rejects a flipped edge (${r.error ?? 'but accepted it!'})`)
}

// Reject bad centres.
{
  const a = SOLVED_FACELETS.split('')
  a[4] = 'R'
  a[13] = 'U'
  check(!validateFacelets(a.join('')).ok, 'rejects bad centres')
}

if (failures === 0) {
  console.log('✓ validator tests passed (1000/1000 valid states accepted, bad states rejected)')
  process.exit(0)
} else {
  console.error(`✗ ${failures} validator check(s) failed`)
  process.exit(1)
}

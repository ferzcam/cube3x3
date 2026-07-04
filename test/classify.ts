// Test the center-anchored colour classifier with synthetic (noise-free) input.
// Real-world colour accuracy depends on the camera/lighting and is tuned on a
// device; this only proves the anchor/nearest-neighbour logic is correct.
import { classify, type RGB } from '../src/scan/camera.ts'
import { FACE_COLORS, FACES, type Face } from '../src/core/cube.ts'

const rgbOf = (f: Face): RGB => {
  const n = FACE_COLORS[f]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  ✗', msg)
  }
}

// 1. Solved: every sticker is exactly its face colour → classifies to itself.
{
  const facesRGB = {} as Record<Face, RGB[]>
  for (const f of FACES) facesRGB[f] = Array(9).fill(rgbOf(f))
  const out = classify(facesRGB)
  let ok = true
  for (const f of FACES) if (out[f].join('') !== f.repeat(9)) ok = false
  check(ok, 'solved cube classifies every sticker to its own face')
}

// 2. A mixed face: exact colours of assorted faces classify to the right letters.
{
  const facesRGB = {} as Record<Face, RGB[]>
  for (const f of FACES) facesRGB[f] = Array(9).fill(rgbOf(f))
  const p: Face[] = ['R', 'F', 'B', 'L', 'U', 'D', 'F', 'R', 'B']
  facesRGB.U = p.map((f, i) => (i === 4 ? rgbOf('U') : rgbOf(f)))
  const out = classify(facesRGB)
  const expect = p.map((f, i) => (i === 4 ? 'U' : f)).join('')
  check(out.U.join('') === expect, `mixed face classifies exact colours (got ${out.U.join('')}, want ${expect})`)
}

if (failures === 0) {
  console.log('✓ classifier tests passed (synthetic exact colours)')
  process.exit(0)
} else {
  console.error(`✗ ${failures} classifier check(s) failed`)
  process.exit(1)
}

import type { Face } from './cube.ts'

// Validate that a 54-char URFDLB facelet string is a physically solvable cube.
// This MUST run before handing a state to the solver: an unsolvable cube makes
// the two-phase solver loop forever. Uses the standard Kociemba facelet indices.

// Facelet indices of the three stickers of each corner, in clockwise order
// starting from the U/D sticker; and the solved colours of those corners.
const CORNER_FACELET = [
  [8, 9, 20],
  [6, 18, 38],
  [0, 36, 47],
  [2, 45, 11],
  [29, 26, 15],
  [27, 44, 24],
  [33, 53, 42],
  [35, 17, 51],
]
const CORNER_COLOR: Face[][] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
]
// Facelet indices and solved colours of each edge (first is the U/D or F/B ref).
const EDGE_FACELET = [
  [5, 10],
  [7, 19],
  [3, 37],
  [1, 46],
  [32, 16],
  [28, 25],
  [30, 43],
  [34, 52],
  [23, 12],
  [21, 41],
  [50, 39],
  [48, 14],
]
const EDGE_COLOR: Face[][] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R'],
]

export type Validation = { ok: boolean; error?: string }

function permutationParity(p: number[]): number {
  let inversions = 0
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inversions++
  return inversions % 2
}

export function validateFacelets(f: string): Validation {
  if (f.length !== 54) return { ok: false, error: `expected 54 stickers, got ${f.length}` }

  // Exactly 9 of each face colour.
  const counts: Record<string, number> = {}
  for (const ch of f) counts[ch] = (counts[ch] || 0) + 1
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
    if (counts[face] !== 9)
      return { ok: false, error: `need exactly 9 ${face} stickers (found ${counts[face] || 0})` }
  }

  // Centres are fixed and define the faces.
  const centers = [4, 13, 22, 31, 40, 49].map((i) => f[i]).join('')
  if (centers !== 'URFDLB') return { ok: false, error: 'centre stickers must read U R F D L B' }

  // Decode corners: permutation + orientation.
  const cornerPerm: number[] = []
  const cornerOri: number[] = []
  for (let i = 0; i < 8; i++) {
    const facs = CORNER_FACELET[i].map((idx) => f[idx])
    const oriIdx = facs.findIndex((c) => c === 'U' || c === 'D')
    if (oriIdx < 0) return { ok: false, error: `corner ${i + 1} has no U/D sticker` }
    const cols = [facs[oriIdx], facs[(oriIdx + 1) % 3], facs[(oriIdx + 2) % 3]]
    const piece = CORNER_COLOR.findIndex(
      (cc) => cc[0] === cols[0] && cc[1] === cols[1] && cc[2] === cols[2],
    )
    if (piece < 0) return { ok: false, error: `corner ${i + 1} is not a valid piece` }
    cornerPerm.push(piece)
    cornerOri.push(oriIdx)
  }

  // Decode edges: permutation + orientation.
  const edgePerm: number[] = []
  const edgeOri: number[] = []
  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELET[i].map((idx) => f[idx])
    let piece = EDGE_COLOR.findIndex((ec) => ec[0] === a && ec[1] === b)
    let ori = 0
    if (piece < 0) {
      piece = EDGE_COLOR.findIndex((ec) => ec[1] === a && ec[0] === b)
      ori = 1
    }
    if (piece < 0) return { ok: false, error: `edge ${i + 1} is not a valid piece` }
    edgePerm.push(piece)
    edgeOri.push(ori)
  }

  // Each piece used exactly once.
  if (new Set(cornerPerm).size !== 8) return { ok: false, error: 'a corner piece is duplicated' }
  if (new Set(edgePerm).size !== 12) return { ok: false, error: 'an edge piece is duplicated' }

  // Orientation and permutation parity constraints.
  if (cornerOri.reduce((a, b) => a + b, 0) % 3 !== 0)
    return { ok: false, error: 'a corner is twisted (orientation parity)' }
  if (edgeOri.reduce((a, b) => a + b, 0) % 2 !== 0)
    return { ok: false, error: 'an edge is flipped (orientation parity)' }
  if (permutationParity(cornerPerm) !== permutationParity(edgePerm))
    return { ok: false, error: 'two pieces are swapped (permutation parity)' }

  return { ok: true }
}

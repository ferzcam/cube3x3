// UI-free cube constants and move parsing shared by the renderer, solver, and
// scanner. Faces are named in Kociemba/URFDLB order; the solver (added later)
// consumes a 54-char facelet string in that same order.

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

export const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

// Standard Western scheme: white up, yellow down, green front, blue back,
// red right, orange left. These hex values are the single source of sticker
// colours for the 3D cube (and later the scanner's reference palette).
export const FACE_COLORS: Record<Face, number> = {
  U: 0xf5f5f5, // white
  D: 0xffd500, // yellow
  F: 0x00a651, // green
  B: 0x0055d4, // blue
  R: 0xd50000, // red
  L: 0xff6d00, // orange
}

// A solved cube as a facelet string in URFDLB order (9 stickers per face).
export const SOLVED_FACELETS =
  'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB'

// A single quarter/half turn. dir: 1 = clockwise, -1 = counter-clockwise,
// 2 = double (180°), all as seen looking at that face from outside the cube.
export type Move = { face: Face; dir: 1 | -1 | 2 }

const MOVE_RE = /([URFDLB])(['2]?)/g

/** Parse a move sequence like "R U R' U2" into structured moves. */
export function parseMoves(seq: string): Move[] {
  const moves: Move[] = []
  for (const m of seq.matchAll(MOVE_RE)) {
    const face = m[1] as Face
    const suffix = m[2]
    const dir: Move['dir'] = suffix === '2' ? 2 : suffix === "'" ? -1 : 1
    moves.push({ face, dir })
  }
  return moves
}

/** Serialise moves back to standard notation, e.g. "R U R' U2". */
export function stringifyMoves(moves: Move[]): string {
  return moves
    .map((m) => m.face + (m.dir === 2 ? '2' : m.dir === -1 ? "'" : ''))
    .join(' ')
}

export const ALL_FACES: readonly Face[] = ['U', 'D', 'L', 'R', 'F', 'B']

/** A random scramble of quarter/half turns (visual scramble for the 3D cube). */
export function randomScramble(length = 25): Move[] {
  // Avoid consecutive turns of the same face; use a small deterministic-ish
  // spread. (WCA random-state scrambles arrive with the timer milestone.)
  const moves: Move[] = []
  let prev: Face | null = null
  const dirs: Move['dir'][] = [1, -1, 2]
  for (let i = 0; i < length; i++) {
    let face: Face
    do {
      face = ALL_FACES[Math.floor(Math.random() * ALL_FACES.length)]
    } while (face === prev)
    prev = face
    moves.push({ face, dir: dirs[Math.floor(Math.random() * dirs.length)] })
  }
  return moves
}

import * as THREE from 'three'
import type { Face, Move } from '../core/cube.ts'

// Pure cube geometry/turn logic, decoupled from the WebGL renderer so it can be
// unit-tested headlessly (three.js Object3D math needs no GL context). The
// animated Cube3D renderer and the round-trip test both drive this same logic.

// Each face → the world axis its layer rotates about, the coordinate selecting
// that layer, and the sign of a clockwise (dir=1) turn seen from outside.
export const FACE_AXIS: Record<Face, { axis: 'x' | 'y' | 'z'; layer: number; sign: number }> = {
  U: { axis: 'y', layer: 1, sign: -1 },
  D: { axis: 'y', layer: -1, sign: 1 },
  R: { axis: 'x', layer: 1, sign: -1 },
  L: { axis: 'x', layer: -1, sign: 1 },
  F: { axis: 'z', layer: 1, sign: -1 },
  B: { axis: 'z', layer: -1, sign: 1 },
}

/** The 26 visible cubie home coordinates (the hidden core is skipped). */
export const CUBIE_COORDS: [number, number, number][] = (() => {
  const list: [number, number, number][] = []
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue
        list.push([x, y, z])
      }
  return list
})()

/** Which face colour each BoxGeometry material slot shows for a home cubie.
 *  Material order: +x, −x, +y, −y, +z, −z. Interior slots are null (black). */
export function faceByMat(x: number, y: number, z: number): (Face | null)[] {
  return [
    x === 1 ? 'R' : null,
    x === -1 ? 'L' : null,
    y === 1 ? 'U' : null,
    y === -1 ? 'D' : null,
    z === 1 ? 'F' : null,
    z === -1 ? 'B' : null,
  ]
}

export function angleForMove(move: Move): { axis: 'x' | 'y' | 'z'; layer: number; angle: number } {
  const { axis, layer, sign } = FACE_AXIS[move.face]
  const quarter = (Math.PI / 2) * sign
  const angle = move.dir === 2 ? quarter * 2 : quarter * move.dir
  return { axis, layer, angle }
}

/** Rotate a layer instantly: reparent the layer's cubies under a pivot, rotate,
 *  reparent back (preserving world transform), and snap to the integer lattice. */
export function rotateLayerInstant(
  group: THREE.Object3D,
  cubies: THREE.Object3D[],
  axis: 'x' | 'y' | 'z',
  layer: number,
  angle: number,
) {
  const pivot = new THREE.Group()
  group.add(pivot)
  const sel = cubies.filter((c) => Math.round(c.position[axis]) === layer)
  for (const c of sel) pivot.attach(c)
  pivot.rotation[axis] = angle
  pivot.updateMatrixWorld(true)
  for (const c of sel) {
    group.attach(c)
    c.position.x = Math.round(c.position.x)
    c.position.y = Math.round(c.position.y)
    c.position.z = Math.round(c.position.z)
  }
  group.remove(pivot)
}

export function applyMovesInstant(group: THREE.Object3D, cubies: THREE.Object3D[], moves: Move[]) {
  for (const m of moves) {
    const { axis, layer, angle } = angleForMove(m)
    rotateLayerInstant(group, cubies, axis, layer, angle)
  }
}

// --- Facelet reading (state → URFDLB string) ---------------------------------
// Sample points for all 54 facelets, in URFDLB reading order (left→right,
// top→bottom of each face in the canonical Kociemba orientation).
type FaceSpec = {
  face: Face
  origin: [number, number, number]
  right: [number, number, number]
  down: [number, number, number]
  normal: [number, number, number]
}
const FACE_SPECS: FaceSpec[] = [
  { face: 'U', origin: [-1, 1, -1], right: [1, 0, 0], down: [0, 0, 1], normal: [0, 1, 0] },
  { face: 'R', origin: [1, 1, 1], right: [0, 0, -1], down: [0, -1, 0], normal: [1, 0, 0] },
  { face: 'F', origin: [-1, 1, 1], right: [1, 0, 0], down: [0, -1, 0], normal: [0, 0, 1] },
  { face: 'D', origin: [-1, -1, 1], right: [1, 0, 0], down: [0, 0, -1], normal: [0, -1, 0] },
  { face: 'L', origin: [-1, 1, -1], right: [0, 0, 1], down: [0, -1, 0], normal: [-1, 0, 0] },
  { face: 'B', origin: [1, 1, -1], right: [-1, 0, 0], down: [0, -1, 0], normal: [0, 0, -1] },
]
const FACELET_SAMPLES: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = (() => {
  const out: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = []
  for (const f of FACE_SPECS) {
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        out.push({
          pos: new THREE.Vector3(
            f.origin[0] + c * f.right[0] + r * f.down[0],
            f.origin[1] + c * f.right[1] + r * f.down[1],
            f.origin[2] + c * f.right[2] + r * f.down[2],
          ),
          normal: new THREE.Vector3(f.normal[0], f.normal[1], f.normal[2]),
        })
      }
  }
  return out
})()

function axisToMat(v: THREE.Vector3): number {
  const ax = Math.abs(v.x)
  const ay = Math.abs(v.y)
  const az = Math.abs(v.z)
  if (ax >= ay && ax >= az) return v.x > 0 ? 0 : 1
  if (ay >= ax && ay >= az) return v.y > 0 ? 2 : 3
  return v.z > 0 ? 4 : 5
}

/** Read the current cube state as a 54-char facelet string in URFDLB order.
 *  Each cubie must carry userData.faceByMat (see faceByMat). */
export function readFacelets(cubies: THREE.Object3D[]): string {
  const at = new Map<string, THREE.Object3D>()
  for (const c of cubies) {
    const key = `${Math.round(c.position.x)},${Math.round(c.position.y)},${Math.round(c.position.z)}`
    at.set(key, c)
  }
  const invq = new THREE.Quaternion()
  const local = new THREE.Vector3()
  let s = ''
  for (const samp of FACELET_SAMPLES) {
    const c = at.get(`${samp.pos.x},${samp.pos.y},${samp.pos.z}`)
    if (!c) {
      s += '?'
      continue
    }
    invq.copy(c.quaternion).invert()
    local.copy(samp.normal).applyQuaternion(invq)
    const fbm = c.userData.faceByMat as (Face | null)[]
    s += fbm[axisToMat(local)] ?? '?'
  }
  return s
}

/** True when every face shows a single uniform colour (visually solved). */
export function isSolvedVisually(cubies: THREE.Object3D[]): boolean {
  const f = readFacelets(cubies)
  for (let i = 0; i < 6; i++) {
    const face = f.slice(i * 9, i * 9 + 9)
    if (!/^(.)\1{8}$/.test(face)) return false
  }
  return true
}

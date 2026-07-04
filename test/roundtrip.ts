// Headless correctness test: verify our 3D turn convention matches cube-solver's
// move notation. If it does, applying a scramble then cube-solver's solution
// must leave the cube visually solved. Run: npm test
import * as THREE from 'three'
import cubeSolver from 'cube-solver'
import {
  CUBIE_COORDS,
  faceByMat,
  applyMovesInstant,
  isSolvedVisually,
  readFacelets,
} from '../src/render/cubeLogic.ts'
import { parseMoves, SOLVED_FACELETS } from '../src/core/cube.ts'

function buildCubies() {
  const group = new THREE.Group()
  const cubies: THREE.Object3D[] = []
  for (const [x, y, z] of CUBIE_COORDS) {
    const o = new THREE.Object3D()
    o.position.set(x, y, z)
    o.userData.home = new THREE.Vector3(x, y, z)
    o.userData.faceByMat = faceByMat(x, y, z)
    group.add(o)
    cubies.push(o)
  }
  return { group, cubies }
}

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  ✗', msg)
  }
}

// 1. A fresh cube reads as the canonical solved facelet string.
{
  const { cubies } = buildCubies()
  check(readFacelets(cubies) === SOLVED_FACELETS, `fresh cube facelets == SOLVED (got ${readFacelets(cubies)})`)
  check(isSolvedVisually(cubies), 'fresh cube isSolvedVisually')
}

// 2. Basic move sanity: X X X X == identity; X then X' == identity.
for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
  const q = buildCubies()
  applyMovesInstant(q.group, q.cubies, parseMoves(`${face} ${face} ${face} ${face}`))
  check(isSolvedVisually(q.cubies), `${face}4 returns to solved`)

  const p = buildCubies()
  applyMovesInstant(p.group, p.cubies, parseMoves(`${face} ${face}'`))
  check(isSolvedVisually(p.cubies), `${face} ${face}' returns to solved`)

  const one = buildCubies()
  applyMovesInstant(one.group, one.cubies, parseMoves(face))
  check(!isSolvedVisually(one.cubies), `single ${face} is NOT solved`)
}

// 3. Sexy move (R U R' U') x6 == identity.
{
  const q = buildCubies()
  applyMovesInstant(q.group, q.cubies, parseMoves("R U R' U' ".repeat(6)))
  check(isSolvedVisually(q.cubies), "(R U R' U')x6 returns to solved")
}

// 4. The real test: scramble + cube-solver's solution == solved, many times.
cubeSolver.initialize('kociemba')
const N = 100
let solved = 0
for (let i = 0; i < N; i++) {
  const scramble = cubeSolver.scramble('3x3')
  const solution = cubeSolver.solve(scramble, 'kociemba')
  const { group, cubies } = buildCubies()
  applyMovesInstant(group, cubies, parseMoves(scramble))
  applyMovesInstant(group, cubies, parseMoves(solution))
  if (isSolvedVisually(cubies)) {
    solved++
  } else if (solved + (i - solved) - solved < 3) {
    console.error('  ✗ round-trip FAILED')
    console.error('    scramble:', scramble)
    console.error('    solution:', solution)
    console.error('    facelets:', readFacelets(cubies))
  }
}
check(solved === N, `round-trip scramble+solve solved ${solved}/${N}`)

if (failures === 0) {
  console.log(`✓ all checks passed (round-trip ${solved}/${N})`)
  process.exit(0)
} else {
  console.error(`✗ ${failures} check(s) failed`)
  process.exit(1)
}

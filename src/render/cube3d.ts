import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FACE_COLORS, type Face, type Move } from '../core/cube.ts'
import {
  CUBIE_COORDS,
  faceByMat,
  angleForMove,
  applyMovesInstant,
  readFacelets,
} from './cubeLogic.ts'

const BLACK = 0x101014
const CUBIE_SIZE = 0.94
const TURN_MS = 180

type Anim = {
  pivot: THREE.Group
  axis: 'x' | 'y' | 'z'
  from: number
  to: number
  start: number
  cubies: THREE.Object3D[]
}

/** Renders and animates an interactive 3×3 cube inside a container element.
 *  Turn/facelet logic lives in cubeLogic.ts so it stays GPU-free and testable. */
export class Cube3D {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private group: THREE.Group
  private cubies: THREE.Mesh[] = []
  private queue: Move[] = []
  private anim: Anim | null = null
  private resizeObserver: ResizeObserver
  private running = true

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(4, 4, 5.5)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enablePan = false
    this.controls.minDistance = 5
    this.controls.maxDistance = 14
    this.controls.rotateSpeed = 0.9

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(5, 8, 6)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.4)
    fill.position.set(-6, -3, -4)
    this.scene.add(fill)

    this.group = new THREE.Group()
    this.scene.add(this.group)
    this.buildCubies()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    requestAnimationFrame(this.loop)
  }

  private buildCubies() {
    const geometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE)
    for (const [x, y, z] of CUBIE_COORDS) {
      const fbm = faceByMat(x, y, z)
      const materials = fbm.map(
        (f: Face | null) =>
          new THREE.MeshStandardMaterial({
            color: f ? FACE_COLORS[f] : BLACK,
            roughness: 0.45,
            metalness: 0.0,
          }),
      )
      const cubie = new THREE.Mesh(geometry, materials)
      cubie.position.set(x, y, z)
      cubie.userData.home = new THREE.Vector3(x, y, z)
      cubie.userData.faceByMat = fbm
      this.group.add(cubie)
      this.cubies.push(cubie)
    }
  }

  /** Queue a scramble/solution sequence for animated playback. */
  queueMoves(moves: Move[]) {
    this.queue.push(...moves)
  }

  /** Apply moves instantly (no animation) — used to set up a scrambled state. */
  applyInstant(moves: Move[]) {
    this.queue = []
    this.anim = null
    applyMovesInstant(this.group, this.cubies, moves)
  }

  /** Current cube state as a 54-char URFDLB facelet string. */
  getFacelets(): string {
    return readFacelets(this.cubies)
  }

  /** Instantly reset to a solved cube, cancelling any animation. */
  reset() {
    this.queue = []
    this.anim = null
    for (const child of [...this.group.children]) this.group.remove(child)
    this.cubies = []
    this.buildCubies()
  }

  isBusy() {
    return this.anim !== null || this.queue.length > 0
  }

  private beginNext() {
    const move = this.queue.shift()
    if (!move) return
    const { axis, layer, angle } = angleForMove(move)
    const pivot = new THREE.Group()
    this.group.add(pivot)
    const cubies = this.cubies.filter((c) => Math.round(c.position[axis]) === layer)
    for (const c of cubies) pivot.attach(c)
    this.anim = { pivot, axis, from: 0, to: angle, start: performance.now(), cubies }
  }

  private finishAnim() {
    if (!this.anim) return
    const { pivot, axis, to, cubies } = this.anim
    pivot.rotation[axis] = to
    pivot.updateMatrixWorld(true)
    for (const c of cubies) {
      this.group.attach(c)
      c.position.x = Math.round(c.position.x)
      c.position.y = Math.round(c.position.y)
      c.position.z = Math.round(c.position.z)
    }
    this.group.remove(pivot)
    this.anim = null
  }

  private loop = () => {
    if (!this.running) return
    this.controls.update()

    if (!this.anim && this.queue.length) this.beginNext()
    if (this.anim) {
      const t = Math.min(1, (performance.now() - this.anim.start) / TURN_MS)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      this.anim.pivot.rotation[this.anim.axis] =
        this.anim.from + (this.anim.to - this.anim.from) * eased
      if (t >= 1) this.finishAnim()
    }

    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.loop)
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Call when the view becomes visible again to force a correct resize. */
  onShown() {
    this.resize()
  }

  pause() {
    this.running = false
  }

  resume() {
    if (!this.running) {
      this.running = true
      this.resize()
      requestAnimationFrame(this.loop)
    }
  }

  dispose() {
    this.running = false
    this.resizeObserver.disconnect()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

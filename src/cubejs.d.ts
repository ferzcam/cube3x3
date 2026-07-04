// Minimal type declarations for the `cubejs` package (no bundled types).
declare module 'cubejs' {
  class Cube {
    constructor()
    static initSolver(): void
    static fromString(facelets: string): Cube
    static random(): Cube
    move(alg: string): Cube
    solve(maxDepth?: number): string
    asString(): string
    isSolved(): boolean
  }
  export default Cube
}

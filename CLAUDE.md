# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`cube3x3` is a personal, ad-free **3×3 cube PWA** — solver, speedcubing timer,
interactive 3D virtual cube, and camera color-scanner — running entirely
client-side (no backend) and deployed to GitHub Pages. It exists as an ad-free
replacement for mobile cube apps. Open source under **GPLv3**.

Target devices: desktop, Android, and **iPad Safari**, in **both portrait and
landscape** (responsive, not orientation-locked). Must be installable to the home
screen and work offline.

## Commands

```bash
npm run dev        # Vite dev server (localhost = secure context, so camera works)
npm run build      # tsc typecheck + vite build → dist/
npm run preview    # serve the built dist/ locally
npm run typecheck  # tsc --noEmit only
npm test           # tsx test/*.ts — see below
```

Tests are plain `tsx` scripts under `test/` (no framework), each `process.exit`s
non-zero on failure. They encode the correctness oracles that must never
regress: `roundtrip` (100 random scrambles → our 3D turn convention matches
cube-solver, so scramble+solution == solved; plus X⁴/X X′/sexy-move identities),
`worker-smoke` (the solver worker actually solves both a move sequence and a
facelet string, and rejects invalid facelets), `validate` (1000 solvable cubes
accepted, unsolvable ones rejected), `stats` (WCA averaging + DNF rules), and
`classify` (center-anchored colour classifier on synthetic colours). Add a test
here for any new cube-logic invariant.

## Architecture

The cube state is a **UI-free core model** that the renderer, solver, and scanner
all share, so they never diverge. Facelets are a 54-char string in **URFDLB
order** (9 per face) — the format the Kociemba solver expects.

- `src/core/cube.ts` — faces, the standard color scheme (`FACE_COLORS`), the
  solved facelet string, `Move` type, and `parseMoves`/`stringifyMoves`. The
  shared vocabulary; no DOM, no three.js.
- `src/render/cube3d.ts` — the three.js virtual cube. 27 cubies on an integer
  lattice; a face turn **reparents** the 9 selected cubies under a temporary
  pivot group, tweens the rotation, then reparents back and **snaps positions to
  the nearest integer** (positions are the source of truth for the next
  selection — no manual index bookkeeping). `FACE_AXIS` maps each face to its
  rotation axis, layer coordinate, and clockwise sign. Uses a `ResizeObserver`
  on the container (not `window.resize`) so it resizes correctly on iOS rotation.
- `src/main.ts` — the app shell: four views (Cube / Solve / Scan / Timer) toggled
  by a bottom tab bar (portrait) or side rail (landscape). Only the active view
  is shown; the cube is told `onShown()` so it re-resizes when revealed.

Layout is **CSS-only responsive** (`@media (orientation: …)` in `src/style.css`),
no JS breakpoint logic.

### Milestones (all shipped)

M1 virtual cube · M2 solver · M3 timer · M4 scan — all done.

### Solving (two engines, both in the worker)

The worker (`src/solver/solver.worker.ts`) hosts two solvers because they take
different inputs:
- **cube-solver** (MIT) — solves from a *move sequence* and generates WCA
  scrambles. Used by the Solve tab and Timer. Tables init eagerly at boot.
- **cubejs** (MIT) — solves from a *54-char facelet string*. Used by the Scan
  tab. Inits lazily on first facelet solve.

**Critical:** a facelet string is ALWAYS run through `validateFacelets`
(`src/core/validate.ts`) before cubejs — an unsolvable cube makes the two-phase
search loop *forever*, which would wedge the worker. `min2phase` was considered
but cube-solver+cubejs cover both input shapes with no cubing.js dependency.

### Scan (`src/scan/`)

`scanView.ts` is a cube-net editor (tap-to-paint) that is the single source of
truth and the camera's correction grid. `camera.ts` does `getUserMedia`, samples
9 trimmed-mean patches per face from the guide square, and classifies colours by
nearest **center anchor** in HSV (self-calibrating to lighting). Real-world
colour accuracy is device/lighting dependent — tune `colorDist`/sampling against
captures from an actual device; the correction grid is the safety net.

### Key constraints

- **Camera needs HTTPS.** `getUserMedia` only works in a secure context —
  `localhost` in dev, and the deployed GitHub Pages URL on-device. Plain-HTTP LAN
  access will not get camera permission on iPad.
- **iOS camera lifecycle**: request the stream lazily only when Scan opens, stop
  all tracks on leaving, and avoid hash-route changes (iOS may re-prompt).
- Run the solver in a **Web Worker** (table init costs ~1–2 s); ensure
  `vite-plugin-pwa` precaches the worker chunk or offline solves break.
- Cap `renderer.setPixelRatio` at 2 for iPad Retina fill-rate/battery.

## Deploy

Push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub
Pages. One-time: repo Settings → Pages → Source = **GitHub Actions**. `vite.config.ts`
uses `base: './'` (relative) so it works under the `/cube3x3/` project subpath.

## Compute (where experiments run)

This project is a browser app developed and previewed locally on the laptop; it
has no training/experiment jobs. For the workspace's general convention:
Fernando codes on his laptop but runs experiments on a remote — **workstation** =
`zhapacfp@10.74.250.168`, **ibex** = `glogin.ibex.kaust.edu.sa` (KAUST Slurm login
node), **unimatrix** = `unimatrix@10.72.186.139` (Slurm cluster; login user
`unimatrix`, workdir `/storage/zhapacfp/`; submit via sbatch/srun). When he names
one, target that host; don't run heavy jobs on the laptop.

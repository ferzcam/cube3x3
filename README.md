# 3×3 Cube

An ad-free, open-source **3×3 cube app** that runs entirely in the browser — a
solver, speedcubing timer, interactive 3D cube, and camera-based color scanner.
No accounts, no ads, no tracking. Installable to any phone, iPad, or desktop as a
[PWA](https://developer.mozilla.org/docs/Web/Progressive_web_apps).

Built for personal use as an alternative to ad-laden mobile cube apps.

## Features

- **Virtual cube** — an interactive 3D cube (rotate freely, animated face turns). ✅
- **Solver** — enter a scrambled state, get a near-optimal step-by-step solution
  with animated playback. *(in progress)*
- **Timer + stats** — WCA scrambles, inspection, ao5/ao12, PB tracking, saved
  locally. *(planned)*
- **Camera scan** — point the camera at each face to read sticker colors and
  build the cube state. *(planned)*

## Tech

Vite · TypeScript · three.js · vite-plugin-pwa. Everything runs client-side —
the app is fully static, so it deploys to GitHub Pages and works offline once
installed. Camera access requires HTTPS, which GitHub Pages provides.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173  (localhost is a secure context → camera works)
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit
```

`npm run dev` also binds to the LAN, so you can open the printed network URL on a
phone/iPad on the same Wi-Fi (note: the camera needs HTTPS, so use the deployed
GitHub Pages URL for camera testing on-device).

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. Enable Pages → Source: **GitHub Actions** once.

## License

[GPLv3](./LICENSE). Uses (or will use) a GPL-licensed Kociemba two-phase solver.

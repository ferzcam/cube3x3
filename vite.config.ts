import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the built app works both at a domain root and under a
// GitHub Pages project subpath (username.github.io/cube3x3/).
export default defineConfig({
  base: './',
  server: {
    host: true, // expose on the LAN so a phone/iPad can reach the dev server
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '3×3 Cube',
        short_name: '3×3 Cube',
        description: 'Solver, timer, and virtual 3×3 cube.',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        // orientation intentionally left unset — the layout is responsive for
        // both portrait and landscape. Set to 'landscape'/'portrait' to lock.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

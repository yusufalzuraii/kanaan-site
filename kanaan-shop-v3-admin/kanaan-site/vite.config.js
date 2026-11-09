import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/* An address the shop doesn't have (an old link, a typo) answers "not
   found" (404) — still with the shop itself on the page, so the shopper can
   carry on — instead of a copy of the homepage that search engines would
   file as one more page of the site. Cloudflare Pages serves 404.html for
   any address nothing else answers; it's the app's own page. */
const notFoundPage = () => ({
  name: 'kanaan-404',
  apply: 'build',
  closeBundle() {
    const dist = resolve(process.cwd(), 'dist')
    if (existsSync(resolve(dist, 'index.html'))) copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
  },
})

/* The engine that draws the shop (since 9 Nov 2026, the owner's choice): Preact, which reads the same React code
   through preact/compat — the same site, about 50 KB less for every phone to download and start (166 → 115 KB).
   Back to React = 'react' here (nothing else changes). The dev server keeps React (its instant reload needs it). */
const ENGINE = 'preact'
const preact = [
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
  { find: /^react$/, replacement: 'preact/compat' },
]

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), notFoundPage()],
  resolve: { alias: command === 'build' && ENGINE === 'preact' ? preact : [] },
}))

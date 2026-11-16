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

/* The built name of the 3D shop's file (assets/StoreStage-<hash>.js), written into the code where it says
   __KANAAN_STAGE_FILE__ (src/home/HomeLab.jsx): when that file fails to arrive, the browser remembers the failure
   under its address, so the second try asks for it under a new one (?try=…). */
const stageFile = () => ({
  name: 'kanaan-stage-file',
  apply: 'build',
  generateBundle(_, bundle) {
    const stage = Object.values(bundle).find((c) => c.type === 'chunk' && c.facadeModuleId && /StoreStage\.jsx$/.test(c.facadeModuleId))
    if (!stage) return
    for (const c of Object.values(bundle)) {
      if (c.type === 'chunk' && c.code.includes('__KANAAN_STAGE_FILE__')) c.code = c.code.split('__KANAAN_STAGE_FILE__').join(stage.fileName)
    }
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
  plugins: [react(), notFoundPage(), stageFile()],
  resolve: { alias: command === 'build' && ENGINE === 'preact' ? preact : [] },
}))

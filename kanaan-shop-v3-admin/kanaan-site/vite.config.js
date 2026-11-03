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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), notFoundPage()],
})

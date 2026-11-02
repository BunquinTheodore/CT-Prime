import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const readConfig = () => JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'))

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Replaces {{dotted.path}} in index.html with values from site.config.json (HTML escaped). */
function configTokens() {
  return {
    name: 'ctprime-config-tokens',
    transformIndexHtml(html) {
      const cfg = readConfig()
      return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
        const v = get(cfg, path)
        if (v == null || v === '') {
          console.warn(`[config] empty value for {{${path}}}`)
          return ''
        }
        return escapeHtml(v)
      })
    },
  }
}

export default defineConfig({
  plugins: [configTokens()],
  build: { target: 'es2019', cssCodeSplit: true, assetsInlineLimit: 0 },
  server: { port: 5180 },
})

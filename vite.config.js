import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const readConfig = () => JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'))

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Pre splits text into word spans at build time, matching effects/text.js splitWords output
 * (sr-only copy + aria-hidden .split > .w[--i]). The first paint already has the final DOM,
 * so the hero paragraph (the mobile LCP element) is not re-rendered by JS.
 */
const prerenderSplit = (words) =>
  `<span class="sr-only">${escapeHtml(words.join(' '))}</span><span class="split" aria-hidden="true">` +
  words.map((w, i) => `<span class="w" style="--i:${i}">${escapeHtml(w)}</span>`).join(' ') +
  '</span>'

/** Replaces {{dotted.path}} in index.html with values from site.config.json (HTML escaped). */
function configTokens() {
  return {
    name: 'ctprime-config-tokens',
    transformIndexHtml(html) {
      const cfg = readConfig()
      html = html.replace(/\{\{\s*(split|count):([\w.]+)\s*\}\}/g, (_, mode, path) => {
        const words = String(get(cfg, path) ?? '').trim().split(/\s+/).filter(Boolean)
        if (mode === 'count') return String(words.length)
        return prerenderSplit(words)
      })
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

/**
 * Build only: inlines the CSS bundle (~10 kB gzip) into index.html so no stylesheet request
 * blocks first paint on slow mobile connections. Fonts and images keep absolute /paths.
 */
function inlineCss() {
  return {
    name: 'ctprime-inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        for (const [file, chunk] of Object.entries(ctx.bundle)) {
          if (!file.endsWith('.css') || chunk.type !== 'asset') continue
          const tag = html.match(/<link[^>]*rel="stylesheet"[^>]*>/g)?.find((t) => t.includes(`href="/${file}"`))
          if (!tag) continue
          html = html.replace(tag, () => `<style>${chunk.source}</style>`)
          delete ctx.bundle[file]
        }
        return html
      },
    },
  }
}

export default defineConfig({
  plugins: [configTokens(), inlineCss()],
  build: { target: 'es2019', cssCodeSplit: true, assetsInlineLimit: 0 },
  server: { port: 5180 },
})

# CONTRACT: file ownership, DOM, modules

CLAUDE.md is the binding spec. This file says who owns what so parallel agents never edit the same file.
`docs/reference-study.json` holds the patterns extracted from the author's reference sites (Mazal, Tech Run, Theoraux, Portfolio). Port techniques from there; do not copy their palettes (CT Prime has its own, see tokens.css).

## Ownership (edit ONLY your files)

| Owner | Files |
|---|---|
| Lead (done) | CLAUDE.md, CONTRACT.md, package.json, vite.config.js, site.config.json, index.html, src/main.js, src/styles/tokens.css, src/styles/base.css, public/img/ct-mark.svg, public/img/mascot.png, public/fonts/* |
| Shell agent | `src/styles/layout.css`, `src/features/header.js`, `src/features/join.js`, `src/features/sticky.js` |
| Content agent | `src/styles/sections.css`, `src/features/content.js`, `src/features/channels.js`, `src/features/ticker.js`, `src/lib/market.js`, `src/lib/dom.js` |
| Planner agent | `src/styles/planner.css`, `src/features/planner.js` |
| Effects agent | `src/effects/{splash,reveal,mascot,sfx,background3d}.js`, `src/styles/motion.css`, `src/styles/bg.css`, `src/styles/cursor.css` |
| Assets agent | `public/favicon.svg`, `public/favicon-32.png`, `public/apple-touch-icon.png`, `public/og.jpg`, `public/cursor/*`, `public/robots.txt`, `vercel.json`, `scripts/*` |

Need a change in a file you do not own? Do NOT edit it. Put the request in your final summary; the lead integrates.
`npm install` is done (vite, three, lenis). Do not change package.json. Python 3.12 with Pillow is available for asset scripts (`python`, not `python -I`).

## Config
`site.config.json` is importable in JS: `import cfg from '../../site.config.json'`. index.html already has build time tokens `{{path}}` for hero copy, section titles, footer. Never hardcode copy. Never invent facts.

## DOM (index.html, do not rename)
Global: `#splash`, `.skip-link`, `#bg-fallback.bg-fallback`, `#bg3d.bg3d` (canvas), `#toast.toast` (base.css styles it; add `.is-on` for 2s to show).
Header: `#site-header.site-header > .header__inner.wrap`, `.brand > svg.brand__mark + .brand__word > .brand__prime + .brand__community`, `#site-nav.site-nav` (desktop links), `.header__actions > #mute-toggle.icon-btn + #header-join.btn (.join-long / .join-short spans) + #menu-toggle.icon-btn.menu-toggle (3 spans = burger bars)`, `#mobile-menu.mobile-menu[hidden]` (nav + big join button).
Hero: `#top.hero > .hero__inner.wrap > h1#hero-title.hero__title[data-lines] (.mask > span.hero__l1 / .hero__l2)`, `ul.hero__chips > li.chip x3`, `p.hero__sub`, `.hero__actions > a#hero-join.btn--shine + span.hero__note`. Then `#ticker.ticker[hidden] > .ticker__track` (full bleed strip at the hero bottom), then `.mascot.mascot--hero > span.mascot__bubble.pixel + img.mascot-img`.
Inside: `#inside.section.inside > .wrap > .section-head (h2[data-lines] + p.section-head__sub) + #channels.channels`.
Planner: `#planner.section.planner > .wrap > .section-head (p.channel + h2 + p.section-head__sub) + #planner-app.planner-app`.
Steps: `#join.section.steps > .wrap > .section-head + ol#steps-list.steps__list`.
FAQ: `#faq.section.faq > .wrap.faq__wrap > .section-head + #faq-list.faq__list`.
Final CTA: `#cta.final-cta > .wrap.final-cta__inner (svg.final-cta__mark, h2[data-lines], p.final-cta__sub, a#final-join.invite-pill)` + `.mascot.mascot--cta > img`.
Footer: `#site-footer.site-footer > .wrap.footer__inner (.footer__brand, ul#social-links.socials, p#disclaimer.footer__note, p.footer__copy > #year)`.
Sticky: `#sticky-bar.sticky-bar[hidden] > a.btn`.
Hooks: every Discord link has `.js-join`. Headings with masked line reveal carry `[data-lines]` and contain `.mask > span` per line.

## Who styles what
- base.css (lead): reset, type scale, `.wrap .section .sr-only .skip-link :focus-visible .mask .btn .btn--primary|--ghost|--sm|--lg .icon-btn .channel .pixel .mascot-img .toast`. Extend, do not redefine, in your own file.
- layout.css (shell): `.site-header` (sticky, glass after scroll via `.is-scrolled`), `.brand*`, `.site-nav`, `.header__actions`, `.menu-toggle`, `.mobile-menu`, `.join-long/.join-short` swap, `.hero*` incl. `.chip`, `.hero__note`, `.ticker` CONTAINER box (position, height, edge fade masks) , `.mascot`, `.mascot--hero`, `.mascot--cta`, `.mascot__bubble` (positioning + static look only), `.final-cta*`, `.invite-pill`, `.site-footer`, `.footer__*`, `.socials`, `.sticky-bar`.
- sections.css (content): `.section-head*`, `.channels` and everything inside it, `.ticker__track` and ticker items INSIDE the track, `.steps*`, `.faq*`.
- planner.css (planner): everything inside `#planner-app`.
- motion.css (effects): the hero load sequence, `[data-lines]` reveal states, `.btn--shine` sweep, mascot peek animation states (`.mascot.is-peeking` etc.), reduced motion overrides. bg.css: `.bg-fallback`, `.bg3d`. cursor.css: native CSS cursor.

## Shared JS interfaces
- `src/lib/dom.js` (content agent; others may import): `export const $ = (sel, root=document) => root.querySelector(sel)`, `export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)]`, `export function el(tag, attrs={}, children=[])` (sets textContent for strings, never innerHTML with config data), `export function toast(msg)`.
- `src/lib/market.js` (content agent): live data from Binance public REST, CORS enabled. Base URLs tried in order: `https://data-api.binance.vision`, `https://api.binance.com`. Exports:
  - `async getTickers(symbols /* ['BTC',...] */) -> [{ symbol, price:number, changePct:number }]` via `/api/v3/ticker/24hr?symbols=[...]` with `XXXUSDT` pairs. Throws on failure. 5s timeout via AbortController.
  - `async getKlines(symbol='BTC', interval='1h', limit=48) -> [{ t, o, h, l, c }]`.
  - `async getPrice(symbol='BTC') -> number` (uses a 30s in memory cache shared with getTickers).
  - `formatPrice(n) -> string` (>= 1000: 0 decimals with thousands separators; >= 1: 2 decimals; else 4 significant).
- Each `init*()` must tolerate missing DOM nodes and network failure, never throw into main.js, and be idempotent. Network failure = hide the live element quietly (ticker stays `hidden`; chart shows a static illustrative candle pattern labelled "Live data unavailable").
- Effects: `initSplash()` only removes `#splash` after its CSS animation ends (or after 1.6s fallback). `initReveal()` handles `[data-lines]` (sets pending state via a class on <html> so content is visible without JS) and the hero load sequence. `initMascot()` adds `.is-peeking` to `.mascot--hero` after the hero sequence and to `.mascot--cta` when it scrolls into view; on hover/focus of `#hero-join` the hero mascot rises a bit more (`.is-excited`). `initSfx()` binds `#mute-toggle` (draw its speaker icon via innerHTML of a static SVG string, aria-pressed = muted). `initBackground3D()` (dynamic import from main.js on idle) renders the aurora shader on `#bg3d`, adds `html.has-bg3d` when running so bg.css can fade the canvas in over `#bg-fallback`.

## Final summary each agent returns
Under 15 lines: files created/changed, anything NOT done, any change requested from the lead, measured sizes. No file dumps.

## REVISION 2 changes (see CLAUDE.md REVISION 2)
- Removed from index.html: `#site-nav`, `#header-join`, `#menu-toggle`, `#mobile-menu`, `.hero__note`, `#final-join` (invite pill), `#sticky-bar`, `#social-links`. `src/features/sticky.js` is deleted and no longer imported. The only `.js-join` element is `#hero-join` ("Join CT Prime").
- Header now: `.brand` + `.header__actions > #mute-toggle` only. header.js keeps only the `.is-scrolled` glass toggle.
- `site.config.json`: `discord` is just `{ url }` (no label), `hero.cta` = "Join CT Prime", `hero.ctaNote` removed, `cta` = `{ title, sub }` only, `socials` = {}, `ui` = `{ muteLabel, tickerError }`.
- Assets agent additionally owns `public/img/mascot.gif`. og.jpg must NOT show the Discord URL: base it on `brand-src/718995550_1001753109067644_4642192667722521449_n.jpg` (logo only banner) instead.
- Splash: inline in index.html (`.sp__*` classes), fades via `sp-out` keyframes at 1.85s. Hero load sequence starts at ~1.9s.
- `.mascot img` elements now load `/img/mascot.gif`; under reduced motion mascot.js swaps their src to `/img/mascot.png`. The JS lens glint is dropped (the GIF has it).
- New glass + text animation ownership: glass styling of a component belongs to whoever styles that component (layout.css: header, chips, final card; sections.css: channels, steps, faq; planner.css: planner). The shared liquid sheen keyframes and `.glass-sheen` utility live in motion.css (effects); apply it by adding the `glass-sheen` class in markup you render (content/planner) or ask the lead for index.html. All text animation (split chars/words, typing, shimmer, count roll for the planner readout via an exported helper `rollNumber(el, value, format)` in `src/effects/text.js`) belongs to effects. Effects agent may create `src/effects/text.js` and must import/init it from reveal.js (main.js is lead owned and unchanged).

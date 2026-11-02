import cfg from '../../site.config.json'
import { $, el, svg, prefersReducedMotion } from '../lib/dom.js'
import { getKlines, formatPrice } from '../lib/market.js'

/** UI strings: read from cfg.ui when the lead adds them, otherwise these defaults. */
const ui = (key, fallback) => (cfg.ui && cfg.ui[key]) || fallback
const TEXT = {
  category: ui('channelsCategory', 'Text channels'),
  chartPair: ui('chartPair', 'BTC/USDT'),
  chartLive: ui('chartCaption', 'BTC/USDT, 1 hour candles, live from Binance'),
  chartLoading: ui('chartLoading', 'Loading live BTC candles'),
  chartFallback: ui('chartFallback', 'Live data unavailable'),
  chartAlt: ui('chartAlt', 'Candlestick chart of the last 48 hours of BTC'),
  candleAlt: ui('candleAlt', 'Anatomy of a bullish and a bearish candle: open, close, high and low'),
  planAlt: ui('planAlt', 'A trade plan: target zone above, entry in the middle, stop loss zone below'),
}
/** Plan labels: cfg.inside.planLabels when the lead adds it; an empty string hides that label. */
const PLAN_LABELS = { target: 'Target', entry: 'Entry', stop: 'Stop loss', ...((cfg.inside && cfg.inside.planLabels) || {}) }
const WIDE_MQ = '(min-width: 720px)'
const CT_MARK = [
  'M22 0H47L37 11H19.5C14 11.4 11 16.5 11 25S14.5 38.5 22 38.5H52.5L42 50H21.5C8 50 0 40 0 25S8.5 0 22 0Z',
  'M53 0H79L69 11H64V28.5L54 38.5V11H43Z',
  'M64 35.5V50H49.5Z',
]
const MASCOT = { animated: '/img/mascot.gif', still: '/img/mascot.png' }
const CHART = { w: 480, h: 200, pad: 12, candles: 48 }
const KEY_STEP = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

let started = false

const safeId = (ch, i) => String(ch.id || `channel-${i}`).replace(/[^\w-]/g, '')
const r2 = (n) => Math.round(n * 100) / 100

/* Sidebar ---------------------------------------------------------------- */

function serverHeader() {
  return el('div', { class: 'channels__server' }, [
    svg('svg', { class: 'channels__mark', viewBox: '0 0 79 50', fill: 'currentColor', 'aria-hidden': 'true' },
      CT_MARK.map((d) => svg('path', { d }))),
    el('span', { class: 'channels__servername' }, (cfg.footer && cfg.footer.copyright) || 'CT Prime Community'),
  ])
}

function hashName(name, cls) {
  return el('span', { class: cls }, [el('span', { class: 'channels__hash', 'aria-hidden': 'true' }, '#'), name])
}

function tabNode(ch, id) {
  return el('button', {
    class: 'channels__tab', type: 'button', role: 'tab', id: `ch-tab-${id}`,
    'aria-controls': `ch-panel-${id}`, 'aria-selected': 'false', tabindex: '-1',
  }, [hashName(ch.name, 'channels__tabname')])
}

/* Visuals ---------------------------------------------------------------- */

function svgText(x, y, text, cls, anchor = 'start') {
  return svg('text', { x, y, class: cls, 'text-anchor': anchor, 'dominant-baseline': 'middle' }, text)
}

/** One candle with its four labels on one side. */
function anatomyCandle({ x, top, bottom, high, low, up, side }) {
  const tx = side === 'left' ? x - 32 : x + 32
  const anchor = side === 'left' ? 'end' : 'start'
  const gx = side === 'left' ? x - 28 : x + 28
  const labels = up
    ? [[high, 'high'], [top, 'close'], [bottom, 'open'], [low, 'low']]
    : [[high, 'high'], [top, 'open'], [bottom, 'close'], [low, 'low']]
  return svg('g', { class: up ? 'is-up' : 'is-down' }, [
    svg('line', { class: 'anat__wick', x1: x, x2: x, y1: high, y2: low }),
    svg('rect', { class: 'anat__body', x: x - 18, y: top, width: 36, height: bottom - top, rx: 2 }),
    ...labels.map(([y]) => svg('line', { class: 'anat__guide', x1: gx, x2: side === 'left' ? x - 20 : x + 20, y1: y, y2: y })),
    ...labels.map(([y, word]) => svgText(tx, y, word, 'anat__label', anchor)),
  ])
}

function candleVisual() {
  return svg('svg', { class: 'channels__svg anat', viewBox: '0 0 280 196', role: 'img', 'aria-label': TEXT.candleAlt }, [
    anatomyCandle({ x: 92, high: 14, top: 50, bottom: 128, low: 176, up: true, side: 'left' }),
    anatomyCandle({ x: 190, high: 24, top: 62, bottom: 142, low: 184, up: false, side: 'right' }),
  ])
}

/** Deterministic illustrative candles used before live data arrives or when it fails. */
function samplePattern(n = CHART.candles) {
  return Array.from({ length: n }).reduce((acc, _, i) => {
    const o = acc.length ? acc[acc.length - 1].c : 100
    const c = o + Math.sin(i * 0.55) * 2.2 + Math.cos(i * 1.7) * 1.4 + 0.3
    const h = Math.max(o, c) + 0.8 + Math.abs(Math.sin(i * 2.3)) * 1.6
    const l = Math.min(o, c) - 0.8 - Math.abs(Math.cos(i * 1.9)) * 1.6
    return [...acc, { t: i, o, h, l, c }]
  }, [])
}

function candleShapes(candles) {
  const { w, h, pad } = CHART
  const hi = Math.max(...candles.map((k) => k.h))
  const lo = Math.min(...candles.map((k) => k.l))
  const span = hi - lo || 1
  const y = (v) => r2(pad + ((hi - v) / span) * (h - pad * 2))
  const step = w / candles.length
  const bw = r2(Math.max(2, step * 0.62))
  const shapes = candles.map((k, i) => {
    const x = r2(i * step + step / 2)
    const top = y(Math.max(k.o, k.c))
    const height = Math.max(1, r2(Math.abs(y(k.o) - y(k.c))))
    return svg('g', { class: k.c >= k.o ? 'is-up' : 'is-down' }, [
      svg('line', { x1: x, x2: x, y1: y(k.h), y2: y(k.l) }),
      svg('rect', { x: r2(x - bw / 2), y: top, width: bw, height }),
    ])
  })
  const lastY = y(candles[candles.length - 1].c)
  return [svg('line', { class: 'chart__last', x1: 0, x2: w, y1: lastY, y2: lastY }), ...shapes]
}

function drawChart(parts, candles, live) {
  parts.plot.replaceChildren(...candleShapes(candles))
  parts.figure.classList.remove('is-loading')
  parts.figure.classList.toggle('is-live', live)
  parts.figure.classList.toggle('is-static', !live)
  parts.price.textContent = live ? formatPrice(candles[candles.length - 1].c) : ''
  parts.caption.textContent = live ? TEXT.chartLive : TEXT.chartFallback
}

async function loadChart(parts) {
  try {
    drawChart(parts, await getKlines('BTC', '1h', CHART.candles), true)
  } catch {
    drawChart(parts, samplePattern(), false)
  }
}

function chartVisual() {
  const plot = svg('svg', {
    class: 'channels__svg chart__plot', viewBox: `0 0 ${CHART.w} ${CHART.h}`,
    preserveAspectRatio: 'none', role: 'img', 'aria-label': TEXT.chartAlt,
  }, candleShapes(samplePattern()))
  const price = el('span', { class: 'chart__price' })
  const caption = el('figcaption', { class: 'chart__caption' }, TEXT.chartLoading)
  const figure = el('figure', { class: 'chart is-loading' }, [
    el('div', { class: 'chart__head' }, [el('span', { class: 'chart__pair' }, TEXT.chartPair), price]),
    plot,
    caption,
  ])
  return { node: figure, parts: { figure, plot, price, caption } }
}

function planVisual() {
  const art = svg('svg', { class: 'channels__svg plan', viewBox: '0 0 280 170', role: 'img', 'aria-label': TEXT.planAlt }, [
    svg('rect', { class: 'plan__target', x: 0, y: 12, width: 280, height: 38, rx: 6 }),
    svg('line', { class: 'plan__entry', x1: 0, x2: 280, y1: 100, y2: 100 }),
    svg('rect', { class: 'plan__stop', x: 0, y: 124, width: 280, height: 34, rx: 6 }),
    svg('polyline', { class: 'plan__path', points: '128,112 146,104 160,108 176,96 192,100 208,82 224,88 240,64 256,52 272,34' }),
    svg('circle', { class: 'plan__dot', cx: 128, cy: 112, r: 4 }),
    PLAN_LABELS.target ? svgText(12, 31, PLAN_LABELS.target, 'plan__label plan__label--target') : null,
    PLAN_LABELS.entry ? svgText(12, 86, PLAN_LABELS.entry, 'plan__label plan__label--entry') : null,
    PLAN_LABELS.stop ? svgText(12, 141, PLAN_LABELS.stop, 'plan__label plan__label--stop') : null,
  ])
  return el('div', { class: 'channels__plan' }, [art])
}

/** GIF by default, PNG under reduced motion; the <source> media query follows live setting changes. */
function mascotPicture() {
  return el('picture', {}, [
    el('source', { srcset: MASCOT.still, media: '(prefers-reduced-motion: reduce)' }),
    el('img', { class: 'mascot-img', src: MASCOT.animated, width: 331, height: 265, alt: '', decoding: 'async' }),
  ])
}

function chatVisual(ch) {
  const bubble = cfg.hero && cfg.hero.bubble
  return el('div', { class: 'channels__chat' }, [
    el('ul', { class: 'channels__tags' }, (ch.points || []).map((p) => el('li', { class: 'channels__tagitem' }, p))),
    el('div', { class: 'channels__mascot', 'aria-hidden': 'true' }, [
      bubble ? el('span', { class: 'channels__bubble' }, bubble) : null,
      mascotPicture(),
    ]),
  ])
}

/** Returns { node, chart? } for a channel's visual. */
function visualFor(ch) {
  if (ch.visual === 'candle') return { node: candleVisual() }
  if (ch.visual === 'chart') {
    const chart = chartVisual()
    return { node: chart.node, chart: chart.parts }
  }
  if (ch.visual === 'plan') return { node: planVisual() }
  if (ch.visual === 'chat') return { node: chatVisual(ch) }
  return { node: null }
}

/* Panels ----------------------------------------------------------------- */

function panelNode(ch, id) {
  const visual = visualFor(ch)
  const points = ch.visual === 'chat' || !(ch.points || []).length
    ? null
    : el('ul', { class: 'channels__points' }, ch.points.map((p) => el('li', {}, p)))
  const node = el('div', {
    class: 'channels__panel', role: 'tabpanel', id: `ch-panel-${id}`, 'aria-labelledby': `ch-tab-${id}`, tabindex: '0',
  }, [
    el('div', { class: 'channels__bar' }, [
      hashName(ch.name, 'channels__barname'),
      el('h3', { class: 'channels__title' }, ch.title),
    ]),
    el('div', { class: `channels__body channels__body--${ch.visual || 'none'}` }, [
      el('div', { class: 'channels__copy' }, [ch.body ? el('p', { class: 'channels__text' }, ch.body) : null, points]),
      visual.node ? el('div', { class: 'channels__visual' }, visual.node) : null,
    ]),
  ])
  return { node, chart: visual.chart }
}

/* Behaviour -------------------------------------------------------------- */

function revealTab(list, tab) {
  if (list.scrollWidth <= list.clientWidth) return
  const left = tab.offsetLeft
  const right = left + tab.offsetWidth
  if (left >= list.scrollLeft && right <= list.scrollLeft + list.clientWidth) return
  list.scrollTo({ left: Math.max(0, left - 16), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

function createSwitcher(list, tabs, panels) {
  const select = (index) => {
    tabs.forEach((tab, i) => {
      const on = i === index
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
      tab.classList.toggle('is-active', on)
    })
    panels.forEach((panel, i) => panel.classList.toggle('is-active', i === index))
  }
  const move = (index) => {
    select(index)
    tabs[index].focus()
    revealTab(list, tabs[index])
  }
  list.addEventListener('click', (e) => {
    const index = tabs.indexOf(e.target.closest('[role="tab"]'))
    if (index >= 0) move(index)
  })
  list.addEventListener('keydown', (e) => {
    const current = tabs.indexOf(document.activeElement)
    if (current < 0) return
    const n = tabs.length
    let next = -1
    if (e.key in KEY_STEP) next = (current + KEY_STEP[e.key] + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    if (next < 0) return
    e.preventDefault()
    move(next)
  })
  return select
}

function whenNear(node, fn) {
  if (!('IntersectionObserver' in window)) return fn()
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return
    io.disconnect()
    fn()
  }, { rootMargin: '300px 0px' })
  io.observe(node)
}

/** Vertical sidebar on wide screens, horizontal scroller below 720px. */
function syncOrientation(list) {
  if (typeof matchMedia !== 'function') return list.setAttribute('aria-orientation', 'vertical')
  const mq = matchMedia(WIDE_MQ)
  const apply = () => list.setAttribute('aria-orientation', mq.matches ? 'vertical' : 'horizontal')
  apply()
  if (mq.addEventListener) mq.addEventListener('change', apply)
}

/** Discord style channel switcher inside #channels. */
export function initChannels() {
  if (started) return
  const root = $('#channels')
  const channels = ((cfg.inside && cfg.inside.channels) || []).filter((ch) => ch && ch.name)
  if (!root || !channels.length) return
  started = true

  const ids = channels.map(safeId)
  const tabs = channels.map((ch, i) => tabNode(ch, ids[i]))
  const built = channels.map((ch, i) => panelNode(ch, ids[i]))
  const list = el('div', {
    class: 'channels__list', role: 'tablist', 'aria-labelledby': 'channels-cat',
  }, tabs)
  syncOrientation(list)

  root.replaceChildren(
    el('div', { class: 'channels__side' }, [
      serverHeader(),
      el('p', { class: 'channels__cat', id: 'channels-cat' }, TEXT.category),
      list,
    ]),
    el('div', { class: 'channels__stage' }, built.map((b) => b.node)),
  )
  root.classList.add('is-ready', 'glass-sheen')

  const select = createSwitcher(list, tabs, built.map((b) => b.node))
  select(0)

  const charts = built.map((b) => b.chart).filter(Boolean)
  if (charts.length) whenNear(root, () => charts.forEach(loadChart))
}

import cfg from '../../site.config.json'
import { $, el, svg } from '../lib/dom.js'
import { getTickers, formatPrice } from '../lib/market.js'

const REFRESH_MS = 30000
const STALE_MS = REFRESH_MS - 1000
// Pixel triangles on a 7x4 grid (crisp edges), never red or green.
const TRI_UP = 'M3 0h1v1H3zM2 1h3v1H2zM1 2h5v1H1zM0 3h7v1H0z'
const TRI_DOWN = 'M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z'

let started = false

function changeNode({ changePct }) {
  const up = changePct >= 0
  const pct = `${Math.abs(changePct).toFixed(2)}%`
  return el('span', { class: `ticker__chg ${up ? 'is-up' : 'is-down'}` }, [
    svg('svg', { class: 'ticker__tri', viewBox: '0 0 7 4', 'aria-hidden': 'true', 'shape-rendering': 'crispEdges' }, [
      svg('path', { d: up ? TRI_UP : TRI_DOWN, fill: 'currentColor' }),
    ]),
    el('span', { class: 'sr-only' }, up ? 'up ' : 'down '),
    pct,
  ])
}

function itemNode(t) {
  return el('li', { class: 'ticker__item' }, [
    el('span', { class: 'ticker__sym' }, t.symbol),
    el('span', { class: 'ticker__price pixel' }, formatPrice(t.price)),
    changeNode(t),
  ])
}

const keyOf = (tickers) => tickers.map((t) => t.symbol).join(',')

/** Rewrites price and change in an existing item so the loop length barely moves. */
function updateItem(item, t) {
  const price = $('.ticker__price', item)
  const chg = $('.ticker__chg', item)
  if (price) price.textContent = formatPrice(t.price)
  if (chg) chg.replaceWith(changeNode(t))
}

/** Two identical lists side by side so translateX(-50%) loops seamlessly.
    Rebuilds only when the set of symbols changes; otherwise updates text in place. */
function render(track, tickers) {
  const key = keyOf(tickers)
  const sets = [...track.querySelectorAll('.ticker__set')]
  if (track.dataset.symbols === key && sets.length === 2) {
    sets.forEach((set) => [...set.children].forEach((item, i) => tickers[i] && updateItem(item, tickers[i])))
    return
  }
  const main = el('ul', { class: 'ticker__set' }, tickers.map(itemNode))
  const copy = el('ul', { class: 'ticker__set ticker__set--copy', 'aria-hidden': 'true' }, tickers.map(itemNode))
  track.replaceChildren(main, copy)
  track.dataset.symbols = key
}

function watchVisibility(root, onVisible) {
  let inView = false
  const isVisible = () => inView && !document.hidden
  const sync = () => {
    root.classList.toggle('is-paused', !isVisible())
    if (isVisible()) onVisible()
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting)
      sync()
    }).observe(root)
  } else {
    inView = true
  }
  document.addEventListener('visibilitychange', sync)
  return isVisible
}

/** Live price strip under the hero. Stays hidden if the market API is unreachable. */
export function initTicker() {
  if (started) return
  const root = $('#ticker')
  const track = root && $('.ticker__track', root)
  const symbols = (cfg.ticker && cfg.ticker.symbols) || []
  if (!track || !symbols.length) return
  started = true
  root.setAttribute('role', 'region')
  track.setAttribute('tabindex', '0')

  let lastFetch = 0
  let busy = false
  const refresh = async () => {
    if (busy) return
    busy = true
    lastFetch = Date.now()
    try {
      render(track, await getTickers(symbols))
      root.hidden = false
    } catch {
      // Network failure: keep the last good prices, or stay hidden if none yet.
    } finally {
      busy = false
    }
  }

  const refreshIfStale = () => {
    if (Date.now() - lastFetch >= STALE_MS) refresh()
  }
  const isVisible = watchVisibility(root, refreshIfStale)
  refresh()
  setInterval(() => {
    if (isVisible()) refreshIfStale()
  }, REFRESH_MS)
}

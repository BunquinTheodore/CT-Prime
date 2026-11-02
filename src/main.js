import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sections.css'
import './styles/planner.css'
import './styles/motion.css'
import './styles/bg.css'
import './styles/cursor.css'

import { initSplash } from './effects/splash.js'
import { initHeader } from './features/header.js'
import { initContent } from './features/content.js'
import { initChannels } from './features/channels.js'
import { initTicker } from './features/ticker.js'
import { initPlanner } from './features/planner.js'
import { initReveal, HERO_DONE_EVENT } from './effects/reveal.js'
import { initMascot } from './effects/mascot.js'
import { initSfx } from './effects/sfx.js'
import { tightenPunctuation } from './effects/text.js'

/** Runs an init without ever letting it break the others. */
function safe(name, fn) {
  try {
    const r = fn()
    if (r && typeof r.catch === 'function') r.catch((e) => console.error(`[${name}]`, e))
  } catch (e) {
    console.error(`[${name}]`, e)
  }
}

safe('splash', initSplash)
safe('header', initHeader)
safe('content', initContent)
safe('channels', initChannels)
safe('ticker', initTicker) // before planner: its BTC price reuses the ticker's in-flight batch
safe('planner', initPlanner)
safe('reveal', initReveal)
safe('punctuation', () => tightenPunctuation())
safe('mascot', initMascot)
safe('sfx', initSfx)

const startBackground = () =>
  safe('bg3d', () => import('./effects/background3d.js').then((m) => m.initBackground3D()))

const onIdle = (cb) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 1200))
const HERO_DONE_FALLBACK_MS = 5000

/* The WebGL background compiles a shader (a long main thread task), so it waits until the
   hero sequence is done and the page is idle, keeping it out of LCP and blocking time. */
function whenHeroDone(cb) {
  if (document.documentElement.classList.contains('hero-done')) return cb()
  let done = false
  const run = () => { if (!done) { done = true; cb() } }
  document.addEventListener(HERO_DONE_EVENT, run, { once: true })
  setTimeout(run, HERO_DONE_FALLBACK_MS)
}

const afterLoad = (cb) => (document.readyState === 'complete' ? cb() : addEventListener('load', cb, { once: true }))
afterLoad(() => whenHeroDone(() => onIdle(startBackground)))

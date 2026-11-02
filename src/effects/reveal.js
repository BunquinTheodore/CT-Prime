import { prepareSectionText, prepareText, startHeroText } from './text.js'

/**
 * Reveals.
 * 1. Hero load sequence: the one orchestrated moment. It starts when the splash
 *    begins its sp-out fade (about 1.85s), with a safety timer at 1.9s. CSS
 *    (motion.css) holds the timings; JS flips html.hero-in, runs the typed and
 *    shimmer parts from text.js, then sets html.hero-done (+ 'ctprime:hero-done').
 * 2. Other [data-lines] headings rise word by word once 30% is in view.
 * Text is split at module load, while the splash still covers the page, so the
 * split never shifts layout on screen. Hidden states exist only under html.js-motion,
 * added only when motion is allowed: no JS or reduced motion means plain text.
 * If the bundle runs after the splash is gone (slow network), the visible hero is
 * left untouched: only html.js-motion-sections is set, for headings and the CTA bull.
 * 3. .glass-sheen panels get .is-sheen-on only while on screen, so the sheen never
 *    recomposites an off screen backdrop-filter.
 */
const HERO_START_MS = 1900
const HERO_MIN_DELAY_MS = 60
const HERO_DONE_AFTER_MS = 1500
const LATE_GRACE_MS = 400
const LINES_THRESHOLD = 0.3
const SPLASH_OUT = 'sp-out'
export const HERO_DONE_EVENT = 'ctprime:hero-done'

const root = document.documentElement
let started = false

export function motionAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function markHeroDone() {
  root.classList.add('hero-done')
  document.dispatchEvent(new CustomEvent(HERO_DONE_EVENT))
}

/** Starts the hero sequence once: on the splash fade, or by the safety timer. */
function scheduleHero() {
  let fired = false
  let safety = 0
  const go = () => {
    if (fired) return
    fired = true
    clearTimeout(safety)
    root.classList.add('hero-in')
    startHeroText()
    setTimeout(markHeroDone, HERO_DONE_AFTER_MS)
  }

  const splash = document.getElementById('splash')
  if (splash) {
    splash.addEventListener('animationstart', (e) => {
      if (e.target === splash && e.animationName === SPLASH_OUT) go()
    })
  }
  const remaining = splash && splash.isConnected ? HERO_START_MS - performance.now() : 0
  safety = setTimeout(go, Math.max(HERO_MIN_DELAY_MS, remaining))
}

function revealOnView(headings) {
  if (!headings.length) return
  if (!('IntersectionObserver' in window)) {
    headings.forEach((h) => h.classList.add('is-revealed'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const passed = entry.boundingClientRect.bottom < 0
        if (!entry.isIntersecting && !passed) return
        entry.target.classList.add('is-revealed')
        io.unobserve(entry.target)
      })
    },
    { threshold: LINES_THRESHOLD }
  )
  headings.forEach((h) => io.observe(h))
}

function sheenOnView() {
  const panels = () => document.querySelectorAll('.glass-sheen')
  if (!('IntersectionObserver' in window)) {
    const all = () => panels().forEach((p) => p.classList.add('is-sheen-on'))
    all()
    document.addEventListener(HERO_DONE_EVENT, all, { once: true })
    return
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('is-sheen-on', e.isIntersecting)),
    { rootMargin: '0px' }
  )
  const watch = () => panels().forEach((p) => io.observe(p))
  watch()
  document.addEventListener(HERO_DONE_EVENT, watch, { once: true })
  addEventListener('load', watch, { once: true })
}

/* Late = the splash already started fading (sp-out at 1850ms in index.html), so the hero is visible. */
const SPLASH_FADE_MS = 1850
const startedLate = () => !document.getElementById('splash') || performance.now() > SPLASH_FADE_MS

export function initReveal() {
  if (started) return
  started = true

  if (!motionAllowed()) {
    markHeroDone()
    return
  }
  sheenOnView()
  if (startedLate()) {
    prepareSectionText()
    root.classList.add('js-motion-sections')
    markHeroDone()
  } else {
    prepareText()
    root.classList.add('js-motion')
    scheduleHero()
  }

  const headings = [...document.querySelectorAll('[data-lines]')].filter((h) => !h.classList.contains('hero__title'))
  revealOnView(headings)
}

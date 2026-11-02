import { HERO_DONE_EVENT, motionAllowed } from './reveal.js'
import { typeIn } from './text.js'

/**
 * Mascot peeks. Classes only; every visual state lives in motion.css.
 * .is-peeking  raises the bull from the bottom edge
 * .is-bubbling shows the speech bubble, which types its text with a block caret
 * .is-excited  lifts the hero bull a little more while the hero CTA is hovered or focused
 * The bull images load the animated /img/mascot.gif (head bob, blink, glint).
 * Under reduced motion a <picture> <source> in index.html serves the static /img/mascot.png instead.
 */
const BUBBLE_DELAY_MS = 680
const BUBBLE_HOLD_MS = 5000
const CTA_THRESHOLD = 0.4

let started = false

function peek(mascot) {
  if (!mascot || mascot.classList.contains('is-peeking')) return
  mascot.classList.add('is-peeking')
  const bubble = mascot.querySelector('.mascot__bubble')
  if (!bubble) return
  setTimeout(() => {
    mascot.classList.add('is-bubbling')
    if (motionAllowed()) typeIn(bubble, { keepCaret: true })
    setTimeout(() => {
      mascot.classList.remove('is-bubbling')
      bubble.querySelector('.caret')?.remove()
    }, BUBBLE_HOLD_MS)
  }, BUBBLE_DELAY_MS)
}

function bindHero(mascot) {
  if (!mascot) return
  const done = () => peek(mascot)
  if (document.documentElement.classList.contains('hero-done')) done()
  else document.addEventListener(HERO_DONE_EVENT, done, { once: true })

  const cta = document.getElementById('hero-join')
  if (!cta) return
  const on = () => mascot.classList.add('is-excited')
  const off = () => mascot.classList.remove('is-excited')
  cta.addEventListener('pointerenter', on)
  cta.addEventListener('pointerleave', off)
  cta.addEventListener('focus', on)
  cta.addEventListener('blur', off)
}

function bindCta(mascot) {
  const section = document.getElementById('cta')
  if (!mascot || !section) return
  if (!('IntersectionObserver' in window)) {
    peek(mascot)
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      peek(mascot)
      io.disconnect()
    },
    { threshold: CTA_THRESHOLD }
  )
  io.observe(section)
}

export function initMascot() {
  if (started) return
  started = true

  bindHero(document.querySelector('.mascot--hero'))
  bindCta(document.querySelector('.mascot--cta'))
}

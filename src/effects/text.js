/**
 * Text animation helpers. Owner: effects agent.
 * Splitting keeps accessibility: the original text stays in a visually hidden
 * span for screen readers, and the split copy is aria-hidden. Every hidden state
 * lives in motion.css behind html.js-motion, so text is visible without JS and
 * nothing is split under reduced motion.
 */
const ROLL_MS = 500
const TYPE_LEAD_MS = 360
const TYPE_STEP_MS = 32
const CARET_TAIL_MS = 700

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const span = (cls, text) => {
  const s = document.createElement('span')
  if (cls) s.className = cls
  if (text != null) s.textContent = text
  return s
}

/** Replaces el's children with an sr-only copy plus an aria-hidden container. */
function prepare(el) {
  if (el.dataset.split) return null
  const text = el.textContent.replace(/\s+/g, ' ').trim()
  if (!text) return null
  el.dataset.split = '1'
  const holder = span('split')
  holder.setAttribute('aria-hidden', 'true')
  el.replaceChildren(span('sr-only', text), holder)
  return { text, holder }
}

/** Per character split. Words stay unbreakable, chars get --i for staggers. */
export function splitChars(el) {
  const p = el && prepare(el)
  if (!p) return []
  const chars = []
  p.text.split(' ').forEach((word, wi) => {
    if (wi) p.holder.append(' ')
    const w = span('wd')
    ;[...word].forEach((c) => {
      const ch = span('ch', c)
      ch.style.setProperty('--i', String(chars.length))
      chars.push(ch)
      w.append(ch)
    })
    p.holder.append(w)
  })
  return chars
}

/** Per word split. With mask: true each word sits in its own clip (.wm > .w). */
export function splitWords(el, { mask = false } = {}) {
  const p = el && prepare(el)
  if (!p) return []
  const words = []
  p.text.split(' ').forEach((word, i) => {
    if (i) p.holder.append(' ')
    const w = span('w', word)
    w.style.setProperty('--i', String(i))
    words.push(w)
    if (!mask) {
      p.holder.append(w)
      return
    }
    const m = span('wm')
    m.append(w)
    p.holder.append(m)
  })
  return words
}

/* ---------- Typing (chips, mascot bubble) ---------- */

/** Splits el for typing: chars start invisible but keep their width (no layout shift). */
export function prepareTyping(el) {
  const chars = splitChars(el)
  if (chars.length) el.classList.add('is-typable')
  return chars
}

/**
 * Types the prepared chars of el in after `delay` ms. A zero width pixel caret
 * blinks first, then walks behind each char. keepCaret leaves it blinking.
 */
export function typeIn(el, { delay = 0, step = TYPE_STEP_MS, keepCaret = false } = {}) {
  if (!el) return
  const chars = [...el.querySelectorAll('.ch')]
  if (!chars.length || el.dataset.typed) return
  el.dataset.typed = '1'
  const holder = el.querySelector('.split')
  const caret = span('caret')
  let i = 0
  const tick = () => {
    if (i >= chars.length) {
      el.classList.add('is-typed')
      if (!keepCaret) setTimeout(() => caret.remove(), CARET_TAIL_MS)
      return
    }
    const ch = chars[i]
    ch.classList.add('is-on')
    ch.after(caret)
    i += 1
    setTimeout(tick, step)
  }
  setTimeout(() => {
    el.classList.add('is-typing')
    holder.prepend(caret)
    setTimeout(tick, TYPE_LEAD_MS)
  }, delay)
}

/* ---------- Hero line 2 shimmer ---------- */

/**
 * Measures each char's offset in the line so one continuous Prime to Sky
 * gradient (background-clip: text) can sweep through all chars at once.
 * Removes the gradient afterwards so a later resize cannot misalign it.
 */
export function shimmerOnce(line, delay = 0) {
  const chars = line ? [...line.querySelectorAll('.ch')] : []
  if (!chars.length) return
  setTimeout(() => {
    const base = line.getBoundingClientRect()
    if (!base.width) return
    line.style.setProperty('--lw', `${Math.round(base.width)}px`)
    chars.forEach((ch) => ch.style.setProperty('--x', `${Math.round(ch.getBoundingClientRect().left - base.left)}px`))
    line.classList.add('is-shimmering')
    const last = chars[chars.length - 1]
    const done = () => line.classList.replace('is-shimmering', 'is-shimmered')
    last.addEventListener('animationend', (e) => e.animationName === 'l2-shimmer' && done())
  }, delay)
}

/* ---------- Number roll ---------- */

const current = new WeakMap()
const frames = new WeakMap()
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

function readNumber(el) {
  const n = parseFloat(String(el.textContent).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function write(el, n, format) {
  const text = format(n)
  if (el.textContent !== text) el.textContent = text
}

/**
 * Rolls el's displayed number to `value` over ~500ms (easeOut, tabular nums).
 * Starts from the value currently on screen, so retargeting mid tween is smooth.
 * Reduced motion (or a non finite value) sets the text directly.
 */
export function rollNumber(el, value, format = (n) => String(n)) {
  if (!el) return
  const fmt = typeof format === 'function' ? format : (n) => String(n)
  el.classList.add('roll-num')
  const prev = frames.get(el)
  if (prev) cancelAnimationFrame(prev)
  frames.delete(el)

  const from = current.has(el) ? current.get(el) : readNumber(el)
  if (reducedMotion() || !Number.isFinite(value) || !Number.isFinite(from) || from === value) {
    current.set(el, value)
    el.removeAttribute('aria-busy')
    write(el, value, fmt)
    return
  }

  const start = performance.now()
  el.setAttribute('aria-busy', 'true')
  const frame = (now) => {
    const t = Math.min(1, (now - start) / ROLL_MS)
    const n = t >= 1 ? value : from + (value - from) * easeOut(t)
    current.set(el, n)
    write(el, n, fmt)
    if (t < 1) {
      frames.set(el, requestAnimationFrame(frame))
      return
    }
    frames.delete(el)
    el.removeAttribute('aria-busy')
  }
  frames.set(el, requestAnimationFrame(frame))
}

/* ---------- Page wiring (called from reveal.js) ---------- */

const CHIP_DELAY_MS = 300
const CHIP_STAGGER_MS = 180
const SHIMMER_DELAY_MS = 1000

function prepareHeadings() {
  document.querySelectorAll('[data-lines]:not(.hero__title) .mask > span').forEach((line) => {
    if (splitWords(line, { mask: true }).length) line.closest('[data-lines]').classList.add('is-split')
  })
}

/** Late start (splash already gone): split only below the fold parts, never the visible hero. */
export function prepareSectionText() {
  prepareHeadings()
  document.querySelectorAll('.mascot--cta .mascot__bubble').forEach(prepareTyping)
}

/** Splits the hero and section headings before the splash lifts. */
export function prepareText() {
  const l2 = document.querySelector('.hero__l2')
  splitChars(l2)
  const sub = document.querySelector('.hero__sub')
  const subWords = splitWords(sub)
  if (sub && subWords.length) sub.style.setProperty('--words', String(subWords.length))
  document.querySelectorAll('.hero__chips .chip').forEach(prepareTyping)
  prepareHeadings()
  document.querySelectorAll('.mascot__bubble').forEach(prepareTyping)
}

/** Kicks the JS timed parts of the hero sequence (CSS handles the rest). */
export function startHeroText() {
  document.querySelectorAll('.hero__chips .chip').forEach((chip, i) => {
    typeIn(chip, { delay: CHIP_DELAY_MS + i * CHIP_STAGGER_MS })
  })
  shimmerOnce(document.querySelector('.hero__l2'), SHIMMER_DELAY_MS)
}

/* ---------- Punctuation kerning ---------- */

const PUNCT = /([A-Za-z])([.,!?])/g

/**
 * Plus Jakarta's period and comma carry a wide left sidebearing that reads as a gap
 * at display sizes ("guessing ."). Wraps punctuation that follows a letter in
 * span.pn (pulled left in motion.css). Runs after splitting; idempotent.
 */
export function tightenPunctuation(selector = 'h1, h2') {
  document.querySelectorAll(selector).forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    nodes.forEach((node) => {
      if (node.parentElement?.closest('.sr-only, .pn')) return
      const text = node.nodeValue
      const lone = /^[.,!?]$/.test(text) && node.parentElement?.classList.contains('ch')
      if (lone) {
        node.parentElement.classList.add('pn')
        return
      }
      if (!PUNCT.test(text)) return
      PUNCT.lastIndex = 0
      const frag = document.createDocumentFragment()
      let last = 0
      text.replace(PUNCT, (m, letter, mark, idx) => {
        frag.append(text.slice(last, idx + 1), span('pn', mark))
        last = idx + 2
        return m
      })
      frag.append(text.slice(last))
      node.replaceWith(frag)
    })
  })
}

/**
 * Synthesized UI tick: a two note square wave blip, like an 8 bit coin, to match
 * the pixel mascot. No audio files. The AudioContext is only created inside a user
 * gesture, sounds never block or delay navigation, and the rate is capped.
 */
const STORAGE_KEY = 'ctprime:muted'
const TARGET_SELECTOR = 'a, button, summary, label, [role="tab"]'
const GAIN = 0.045
const NOTE_A_HZ = 988 // B5
const NOTE_B_HZ = 1319 // E6
const NOTE_A_S = 0.026
const TOTAL_S = 0.062
const ATTACK_S = 0.003
const MIN_GAP_MS = 1000 / 12
const POINTER_CLICK_WINDOW_MS = 800

/* Pixel speaker drawn on a 12x12 grid so it matches the mascot's pixel art. */
const SPEAKER = 'M1 4h2v4H1zM3 3h1v6H3zM4 2h1v8H4zM5 1h1v10H5z'
const WAVES = 'M7 4h1v1H7zM8 5h1v2H8zM7 7h1v1H7zM9 2h1v2H9zM10 4h1v4h-1zM9 8h1v2H9z'
const CROSS = 'M7 4h1v1H7zM8 5h1v1H8zM9 6h1v1H9zM10 7h1v1h-1zM10 4h1v1h-1zM9 5h1v1H9zM8 6h1v1H8zM7 7h1v1H7z'
const svg = (d) =>
  `<svg viewBox="0 0 12 12" width="20" height="20" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`
const ICON_ON = svg(SPEAKER + WAVES)
const ICON_OFF = svg(SPEAKER + CROSS)

let ctx = null
let muted = false
let lastTick = 0
let lastPointer = 0
let started = false

function readMuted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeMuted(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
}

/** Lazily created, only from inside a gesture handler. */
function getContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function blip(ac) {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(NOTE_A_HZ, t)
  osc.frequency.setValueAtTime(NOTE_B_HZ, t + NOTE_A_S)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(GAIN, t + ATTACK_S)
  gain.gain.setValueAtTime(GAIN, t + NOTE_A_S)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + TOTAL_S)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t)
  osc.stop(t + TOTAL_S + 0.01)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

function tick() {
  if (muted) return
  const now = performance.now()
  if (now - lastTick < MIN_GAP_MS) return
  lastTick = now
  try {
    const ac = getContext()
    if (ac) blip(ac)
  } catch {
    /* audio is optional, never surface errors */
  }
}

function paintToggle(button) {
  button.setAttribute('aria-pressed', String(muted))
  button.innerHTML = muted ? ICON_OFF : ICON_ON
}

function matchTarget(event, toggle) {
  const el = event.target instanceof Element ? event.target.closest(TARGET_SELECTOR) : null
  if (!el || (toggle && toggle.contains(el))) return null
  if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return null
  return el
}

function bindToggle(toggle) {
  if (!toggle) return
  paintToggle(toggle)
  toggle.addEventListener('click', () => {
    muted = !muted
    writeMuted(muted)
    paintToggle(toggle)
    if (!muted) tick()
  })
}

export function initSfx() {
  if (started) return
  started = true
  muted = readMuted()
  const toggle = document.getElementById('mute-toggle')
  bindToggle(toggle)

  const opts = { capture: true, passive: true }
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button > 0 || !matchTarget(e, toggle)) return
      lastPointer = performance.now()
      tick()
    },
    opts
  )
  /* Keyboard activation (Enter, Space) arrives as a click with no pointer before it. */
  document.addEventListener(
    'click',
    (e) => {
      if (!matchTarget(e, toggle)) return
      const fromPointer = e.detail !== 0 && performance.now() - lastPointer < POINTER_CLICK_WINDOW_MS
      if (!fromPointer) tick()
    },
    opts
  )
}

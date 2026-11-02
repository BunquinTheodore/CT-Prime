const SCROLL_THRESHOLD = 24

let bound = false

/** Toggles the glass header state after a small scroll. Passive listener, one rAF per frame. Safe to call twice. */
export function initHeader() {
  if (bound) return
  const header = document.getElementById('site-header')
  if (!header) return
  bound = true

  let ticking = false
  const update = () => {
    ticking = false
    header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD)
  }
  window.addEventListener('scroll', () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }, { passive: true })
  update()
}

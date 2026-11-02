const FALLBACK_MS = 3000
const SPLASH_OUT = 'sp-out'

/**
 * The splash markup and its keyframes live inline in index.html so they paint
 * with the first byte. JS only removes the node once the sp-out fade has ended,
 * or after a 3s fallback (background tabs may never fire animation events).
 */
export function initSplash() {
  const splash = document.getElementById('splash')
  if (!splash || splash.dataset.bound) return
  splash.dataset.bound = '1'

  let timer = 0
  const remove = () => {
    clearTimeout(timer)
    splash.remove()
  }
  splash.addEventListener('animationend', (e) => {
    if (e.target === splash && e.animationName === SPLASH_OUT) remove()
  })
  timer = setTimeout(remove, Math.max(0, FALLBACK_MS - performance.now()))
}

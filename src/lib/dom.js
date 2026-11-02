/** Tiny DOM helpers shared across features. Never uses innerHTML with config data. */

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

const SVG_NS = 'http://www.w3.org/2000/svg'

function applyAttrs(node, attrs) {
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null || value === false) return
    if (key === 'class') node.setAttribute('class', value)
    else if (key === 'text') node.textContent = value
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value)
    else node.setAttribute(key, value === true ? '' : String(value))
  })
}

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children]
  list.forEach((child) => {
    if (child == null || child === false) return
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child)
  })
}

/** Creates an HTML element. Strings in children become text nodes. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  applyAttrs(node, attrs)
  appendChildren(node, children)
  return node
}

/** Creates an SVG element (same signature as el). */
export function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag)
  applyAttrs(node, attrs)
  appendChildren(node, children)
  return node
}

const TOAST_MS = 2000
let toastTimer = 0

/** Shows #toast with a message for about 2 seconds. */
export function toast(msg) {
  const node = $('#toast')
  if (!node || !msg) return
  node.textContent = msg
  node.classList.add('is-on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('is-on'), TOAST_MS)
}

/** True when the visitor asked for reduced motion. */
export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

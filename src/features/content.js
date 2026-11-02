import cfg from '../../site.config.json'
import { $, $$, el } from '../lib/dom.js'

const FAQ_MAX = 5
const FAQ_GROUP = 'faq'
const HASH_WORD = /(#[\w-]+)/g
const IS_HASH_WORD = /^#[\w-]+$/

let started = false

/** Splits text so Discord channel words like #beginner-lessons get their own span. */
function withHashWords(text) {
  return String(text)
    .split(HASH_WORD)
    .filter(Boolean)
    .map((part) => (IS_HASH_WORD.test(part) ? el('span', { class: 'hashword' }, part) : part))
}

function renderSteps() {
  const list = $('#steps-list')
  const items = ((cfg.steps && cfg.steps.items) || []).filter((s) => s && s.title)
  if (!list) return
  if (!items.length) {
    const section = list.closest('section')
    if (section) section.hidden = true
    return
  }
  list.replaceChildren(...items.map((step, i) =>
    el('li', { class: 'step' }, [
      el('span', { class: 'step__num', 'aria-hidden': 'true' }, String(i + 1)),
      el('span', { class: 'step__link', 'aria-hidden': 'true' }),
      el('h3', { class: 'step__title' }, withHashWords(step.title)),
      step.body ? el('p', { class: 'step__body' }, withHashWords(step.body)) : null,
    ])))
}

function faqItem(item) {
  return el('details', { class: 'faq__item', name: FAQ_GROUP }, [
    el('summary', { class: 'faq__q' }, [
      el('span', { class: 'faq__qtext' }, item.q),
      el('span', { class: 'faq__icon', 'aria-hidden': 'true' }),
    ]),
    el('div', { class: 'faq__a' }, el('p', {}, withHashWords(item.a))),
  ])
}

/** Exclusive accordion fallback for browsers without details[name]. */
function closeOthersOnOpen(list) {
  list.addEventListener('toggle', (e) => {
    const opened = e.target
    if (!(opened instanceof HTMLDetailsElement) || !opened.open) return
    $$('details[open]', list).forEach((d) => {
      if (d !== opened) d.open = false
    })
  }, true)
}

function renderFaq() {
  const list = $('#faq-list')
  if (!list) return
  const items = ((cfg.faq && cfg.faq.items) || [])
    .filter((it) => it && String(it.q || '').trim() && String(it.a || '').trim())
    .slice(0, FAQ_MAX)
  if (!items.length) {
    const section = list.closest('section')
    if (section) section.hidden = true
    return
  }
  list.replaceChildren(...items.map(faqItem))
  closeOthersOnOpen(list)
}

function renderYear() {
  const year = $('#year')
  if (year) year.textContent = String(new Date().getFullYear())
}

/** Steps, FAQ and footer year. Social links were removed in revision 2. */
export function initContent() {
  if (started) return
  started = true
  renderSteps()
  renderFaq()
  renderYear()
}

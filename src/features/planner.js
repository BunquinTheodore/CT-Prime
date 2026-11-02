/**
 * "Plan a trade in ten seconds": educational position size and reward to risk planner.
 * Renders into #planner-app with DOM nodes only (no innerHTML). UI copy comes from cfg.planner.ui.
 */
import cfg from '../../site.config.json'
import { el } from '../lib/dom.js'
import { getPrice, formatPrice } from '../lib/market.js'
import { rollNumber } from '../effects/text.js'

const FALLBACK_ENTRY = 100000
const RISK_PRESETS = [0.5, 1, 2]
const HIGH_RISK_PCT = 5
const LADDER_PAD = 0.14
const TAG_PX = 26
const TAG_MIN = 0.08
const TAG_MAX = 0.92

const P = cfg.planner || {}
const T = { ...(P.ui || {}) }
const D = { balance: 10000, riskPct: 1, entry: 0, stopPct: 2, targetPct: 4, ...(P.defaults || {}) }
const CUR = P.currency || 'USDT'

const nf = (opts) => new Intl.NumberFormat('en-US', opts)
const FMT = {
  usd: nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: nf({ maximumFractionDigits: 2 }),
  one: nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  whole: nf({ maximumFractionDigits: 0 }),
  four: nf({ maximumFractionDigits: 4 }),
  sig: nf({ maximumSignificantDigits: 4 }),
}

const finite = (n) => (Number.isFinite(n) ? n : 0)
const fill = (tpl, v) => String(tpl ?? '').replace('{v}', v).replace('{cur}', CUR)

const fmtRr = (n) => `${FMT.one.format(finite(n))}R`

function fmtQty(n) {
  const v = finite(n)
  const abs = Math.abs(v)
  if (abs >= 1000) return FMT.whole.format(v)
  if (abs >= 1) return FMT.four.format(v)
  return FMT.sig.format(v)
}

const fmtPrice = (n) => formatPrice(finite(n)) || '0'

function parseNum(raw) {
  const n = parseFloat(String(raw).replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function roundPrice(p) {
  if (p >= 1000) return Math.round(p)
  if (p >= 1) return Math.round(p * 100) / 100
  return Number(p.toPrecision(5))
}

/* ---------- markup (el() only, config text lands as textContent) ---------- */

const NUM_INPUT = { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'next' }
/* <output> is an implicit polite live region; only #pl-msg should announce. */
const out = (key) => el('output', { id: `pl-${key}`, for: 'pl-form', 'aria-live': 'off' }, ['0'])

function field(id, label, unit, unitSr = unit, extra = null) {
  return el('div', { class: `pl-field pl-field--${id}` }, [
    el('div', { class: 'pl-field__top' }, [
      el('label', { class: 'pl-label', for: `pl-${id}` }, [label, el('span', { class: 'sr-only', text: ` ${fill(T.inUnit, unitSr)}` })]),
      extra,
    ]),
    el('div', { class: 'pl-input' }, [
      el('input', { id: `pl-${id}`, name: id, ...NUM_INPUT }),
      el('span', { class: 'pl-input__unit', 'aria-hidden': 'true', text: unit }),
    ]),
  ])
}

function dirMarkup() {
  const btn = (dir, label, on) =>
    el('button', { type: 'button', class: 'pl-seg__btn', 'data-dir': dir, 'aria-pressed': String(on), text: label })
  return el('div', { class: 'pl-field pl-field--dir' }, [
    el('div', { class: 'pl-field__top' }, [el('span', { class: 'pl-label', id: 'pl-dir-label', text: T.direction })]),
    el('div', { class: 'pl-seg', role: 'group', 'aria-labelledby': 'pl-dir-label', 'aria-describedby': 'pl-dir-hint', 'data-dir': 'long' }, [
      el('span', { class: 'pl-seg__thumb', 'aria-hidden': 'true' }),
      btn('long', T.long, true),
      btn('short', T.short, false),
    ]),
    el('p', { class: 'pl-hint', id: 'pl-dir-hint', text: T.dirHint }),
  ])
}

function formMarkup() {
  const chips = RISK_PRESETS.map((r) =>
    el('button', { type: 'button', class: 'pl-chip', 'data-risk': r, 'aria-pressed': 'false', text: `${r}%` }),
  )
  const live = el('span', { class: 'pl-live', id: 'pl-live', hidden: true, text: T.live })
  return el('form', { class: 'pl__form', id: 'pl-form', 'aria-label': T.formLabel, novalidate: true }, [
    field('balance', T.balance, CUR),
    field('risk', T.risk, '%', T.percent),
    el('div', { class: 'pl-chips', role: 'group', 'aria-label': T.riskPresets }, chips),
    dirMarkup(),
    field('entry', T.entry, CUR, CUR, live),
    field('stop', T.stop, CUR),
    field('target', T.target, CUR),
  ])
}

function stat(key, label, mod = '') {
  return el('div', { class: `pl-stat ${mod}`.trim() }, [el('dt', { text: label }), el('dd', {}, [out(key)])])
}

function ladderMarkup() {
  const zone = (k) => el('span', { class: `pl-lad__zone pl-lad__zone--${k}`, 'data-zone': k })
  const mark = (k) => el('span', { class: `pl-lad__mark pl-lad__mark--${k}`, 'data-mark': k })
  const tag = (k, name) =>
    el('span', { class: 'pl-lad__tagw', 'data-tag': k }, [
      el('span', { class: `pl-lad__tag pl-lad__tag--${k}` }, [el('span', { text: name }), el('span', { 'data-price': '' })]),
    ])
  return el('div', { class: 'pl-lad', 'aria-hidden': 'true' }, [
    zone('target'), zone('stop'), mark('target'), mark('stop'), mark('entry'),
    tag('target', T.tagTarget), tag('entry', T.tagEntry), tag('stop', T.tagStop),
  ])
}

function outMarkup() {
  return el('div', { class: 'pl__out', id: 'pl-out' }, [
    el('div', { class: 'pl-read' }, [
      el('p', { class: 'pl-read__label', text: T.size }),
      el('p', { class: 'pl-read__value' }, [out('qty'), ' ', el('span', { class: 'pl-read__unit', id: 'pl-unit' })]),
      el('p', { class: 'pl-read__sub', id: 'pl-worth' }),
      el('p', { class: 'pl-read__lev', id: 'pl-lev', hidden: true }),
    ]),
    el('p', { class: 'pl-msg', id: 'pl-msg', role: 'status', 'aria-live': 'polite' }),
    el('div', { class: 'pl__grid' }, [
      el('dl', { class: 'pl-stats' }, [
        stat('riskamt', T.riskAmt, 'pl-stat--risk'),
        stat('stopdist', T.stopDist),
        stat('rr', T.rr, 'pl-stat--reward'),
        stat('profit', T.profit, 'pl-stat--reward pl-stat--profit'),
      ]),
      ladderMarkup(),
    ]),
  ])
}

/* ---------- math + validation ---------- */

function compute(v) {
  const sign = v.dir === 'long' ? 1 : -1
  const riskAmt = (v.balance * v.risk) / 100
  const stopDist = (v.entry - v.stop) * sign
  const rewardDist = (v.target - v.entry) * sign
  const qty = riskAmt / stopDist
  return {
    riskAmt,
    qty,
    notional: qty * v.entry,
    stopPct: (stopDist / v.entry) * 100,
    rr: rewardDist / stopDist,
    profit: qty * rewardDist,
    stopOk: stopDist > 0,
    targetOk: rewardDist > 0,
  }
}

const err = (field, msg, scope = 'all') => ({ level: 'error', field, msg, scope })

function check(v, r) {
  const long = v.dir === 'long'
  const at = fmtPrice(v.entry)
  if (!(v.balance > 0)) return err('balance', T.errBalance)
  if (!(v.risk > 0)) return err('risk', T.errRisk)
  if (v.risk > 100) return err('risk', T.errRiskMax)
  if (!(v.entry > 0)) return err('entry', T.errEntry)
  if (!(v.stop > 0)) return err('stop', T.errStop)
  if (!r.stopOk) return err('stop', fill(long ? T.errStopLong : T.errStopShort, at))
  if (!(v.target > 0)) return err('target', T.errTarget, 'reward')
  if (!r.targetOk) return err('target', fill(long ? T.errTargetLong : T.errTargetShort, at), 'reward')
  if (v.risk > HIGH_RISK_PCT) return { level: 'warn', field: 'risk', msg: fill(T.warnRisk, HIGH_RISK_PCT) }
  if (r.rr < 1) return { level: 'warn', field: 'target', msg: T.warnRr }
  return null
}

/* ---------- ladder ---------- */

function spreadTags(ys, gap) {
  const order = ys.map((y, i) => ({ i, y: Math.min(TAG_MAX, Math.max(TAG_MIN, y)) })).sort((a, b) => a.y - b.y)
  const down = order.reduce((acc, o, k) => [...acc, { ...o, y: k ? Math.max(o.y, acc[k - 1].y + gap) : o.y }], [])
  const up = down.reduceRight((acc, o, k) => {
    const next = acc[0]
    const y = k === down.length - 1 ? Math.min(o.y, TAG_MAX) : Math.min(o.y, next.y - gap)
    return [{ ...o, y }, ...acc]
  }, [])
  return up.reduce((out, o) => Object.assign(out, { [o.i]: o.y }), [])
}

function renderLadder(ui, v, showTarget) {
  const pts = showTarget ? [v.entry, v.stop, v.target] : [v.entry, v.stop]
  const hi = Math.max(...pts)
  const lo = Math.min(...pts)
  const pad = (hi - lo) * LADDER_PAD || 1
  const top = hi + pad
  const span = hi - lo + pad * 2
  const y = (p) => (top - p) / span

  const zone = (node, a, b) => {
    const [t, bt] = [Math.min(a, b), Math.max(a, b)]
    node.style.transform = `translateY(${t * 100}%) scaleY(${bt - t})`
  }
  zone(ui.zones.target, y(v.entry), y(v.target))
  zone(ui.zones.stop, y(v.entry), y(v.stop))
  ;['entry', 'stop', 'target'].forEach((k) => {
    ui.marks[k].style.transform = `translateY(${y(v[k]) * 100}%)`
  })

  const gap = TAG_PX / (ui.ladder.clientHeight || 200)
  const keys = showTarget ? ['target', 'entry', 'stop'] : ['entry', 'stop']
  const ys = spreadTags(keys.map((k) => y(v[k])), gap)
  keys.forEach((k, i) => {
    ui.tags[k].style.transform = `translateY(${ys[i] * 100}%)`
    ui.tags[k].querySelector('[data-price]').textContent = fmtPrice(v[k])
  })
  ui.ladder.classList.toggle('no-target', !showTarget)
}

/* ---------- render ---------- */

function setMessage(ui, result) {
  const { msg } = ui
  msg.textContent = result ? result.msg : ''
  msg.className = `pl-msg${result ? ` is-${result.level}` : ''}`
  Object.entries(ui.inputs).forEach(([k, input]) => {
    const bad = Boolean(result && result.level === 'error' && result.field === k)
    input.setAttribute('aria-invalid', String(bad))
    if (bad) input.setAttribute('aria-describedby', 'pl-msg')
    else input.removeAttribute('aria-describedby')
  })
}

function renderReadout(ui, v, r, state) {
  rollNumber(ui.out.qty, finite(r.qty), fmtQty)
  ui.unit.textContent = state.live ? T.liveUnit : T.unit
  ui.worth.textContent = fill(T.worth, FMT.usd.format(finite(r.notional)))
  ui.out.stopdist.value = `${FMT.pct.format(finite(r.stopPct))}%`
  const lev = r.notional / v.balance
  ui.lev.hidden = !(lev > 1.0001)
  if (!ui.lev.hidden) ui.lev.textContent = fill(T.lev, FMT.one.format(finite(lev)))
}

function render(ui, state) {
  const v = { ...readInputs(ui), dir: state.dir }
  const r = compute(v)
  const result = check(v, r)
  const blockAll = result && result.level === 'error' && result.scope === 'all'
  const blockReward = result && result.level === 'error'

  setMessage(ui, result)
  ui.root.classList.toggle('is-off', Boolean(blockAll))
  ui.root.classList.toggle('is-off-reward', Boolean(blockReward))
  syncControls(ui, v)

  if (Number.isFinite(r.riskAmt) && r.riskAmt >= 0) ui.out.riskamt.value = `${FMT.usd.format(r.riskAmt)} ${CUR}`
  if (blockAll) return
  renderReadout(ui, v, r, state)
  if (!blockReward) {
    rollNumber(ui.out.rr, finite(r.rr), fmtRr)
    ui.out.profit.value = `${FMT.usd.format(finite(r.profit))} ${CUR}`
  }
  renderLadder(ui, v, !blockReward)
}

function syncControls(ui, v) {
  ui.chips.forEach((c) => c.setAttribute('aria-pressed', String(Math.abs(Number(c.dataset.risk) - v.risk) < 1e-9)))
}

function readInputs(ui) {
  const n = (k) => parseNum(ui.inputs[k].value)
  return { balance: n('balance'), risk: n('risk'), entry: n('entry'), stop: n('stop'), target: n('target') }
}

/* ---------- state changes ---------- */

function applyEntry(ui, state, entry, live) {
  const sign = state.dir === 'long' ? 1 : -1
  ui.inputs.entry.value = String(roundPrice(entry))
  ui.inputs.stop.value = String(roundPrice(entry * (1 - (sign * D.stopPct) / 100)))
  ui.inputs.target.value = String(roundPrice(entry * (1 + (sign * D.targetPct) / 100)))
  state.live = live
  ui.live.hidden = !live
  render(ui, state)
}

function setDirection(ui, state, dir) {
  if (dir === state.dir) return
  const v = readInputs(ui)
  const before = compute({ ...v, dir: state.dir })
  state.dir = dir
  ui.dirs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dir === dir)))
  ui.seg.dataset.dir = dir
  if (v.entry > 0 && before.stopOk) ui.inputs.stop.value = String(roundPrice(Math.max(2 * v.entry - v.stop, 0)))
  if (v.entry > 0 && before.targetOk) ui.inputs.target.value = String(roundPrice(Math.max(2 * v.entry - v.target, 0)))
  render(ui, state)
}

function bind(ui, state) {
  ui.form.addEventListener('submit', (e) => e.preventDefault())
  ui.form.addEventListener('input', (e) => {
    if (['entry', 'stop', 'target'].includes(e.target.name)) {
      state.touched = true
      if (e.target.name === 'entry' && state.live) {
        state.live = false
        ui.live.hidden = true
      }
    }
    render(ui, state)
  })
  ui.chips.forEach((c) =>
    c.addEventListener('click', () => {
      ui.inputs.risk.value = c.dataset.risk
      render(ui, state)
    }),
  )
  ui.dirs.forEach((b) => b.addEventListener('click', () => setDirection(ui, state, b.dataset.dir)))
}

function collect(root) {
  const q = (s) => root.querySelector(s)
  const qa = (s) => [...root.querySelectorAll(s)]
  const byData = (attr) => Object.fromEntries(qa(`[data-${attr}]`).map((n) => [n.dataset[attr], n]))
  return {
    root,
    form: q('#pl-form'),
    msg: q('#pl-msg'),
    unit: q('#pl-unit'),
    worth: q('#pl-worth'),
    lev: q('#pl-lev'),
    live: q('#pl-live'),
    ladder: q('.pl-lad'),
    chips: qa('.pl-chip'),
    dirs: qa('.pl-seg__btn'),
    seg: q('.pl-seg'),
    zones: byData('zone'),
    marks: byData('mark'),
    tags: byData('tag'),
    inputs: Object.fromEntries(['balance', 'risk', 'entry', 'stop', 'target'].map((k) => [k, q(`#pl-${k}`)])),
    out: Object.fromEntries(['qty', 'riskamt', 'stopdist', 'rr', 'profit'].map((k) => [k, q(`#pl-${k}`)])),
  }
}

/* Live price is optional: on any failure the fallback entry stays. */
function loadLivePrice(ui, state) {
  try {
    getPrice('BTC')
      .then((price) => !state.touched && price > 0 && applyEntry(ui, state, price, true))
      .catch(() => {})
  } catch {
    /* keep the fallback entry */
  }
}

export function initPlanner() {
  const host = document.getElementById('planner-app')
  if (!host || host.dataset.ready) return
  host.dataset.ready = '1'

  const panel = el('div', { class: 'pl glass-sheen' }, [el('span', { class: 'pl__slash', 'aria-hidden': 'true' }), formMarkup(), outMarkup()])
  const note = el('p', { class: 'pl-note', text: P.note || '', hidden: !P.note })
  /* Outer shadow sits on a sibling layer: clip-path on .pl clips its own box-shadow,
     and a filter on an ancestor would break the panel's backdrop blur. */
  host.replaceChildren(el('div', { class: 'pl-wrap' }, [el('span', { class: 'pl-shadow', 'aria-hidden': 'true' }), panel]), note)

  const ui = collect(panel)
  const state = { dir: 'long', live: false, touched: false }
  ui.inputs.balance.value = String(D.balance)
  ui.inputs.risk.value = String(D.riskPct)
  bind(ui, state)
  applyEntry(ui, state, D.entry > 0 ? D.entry : FALLBACK_ENTRY, false)
  loadLivePrice(ui, state)
}

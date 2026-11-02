/** Live market data from Binance public REST (CORS enabled, no key). */

const BASES = ['https://data-api.binance.vision', 'https://api.binance.com']
const TIMEOUT_MS = 5000
const CACHE_MS = 30000
const QUOTE = 'USDT'
const INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d'])

/** symbol -> { symbol, price, changePct, at } */
let cache = new Map()

const pairOf = (symbol) => `${String(symbol).toUpperCase()}${QUOTE}`

async function fetchFrom(base, path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(base + path, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Tries each base URL in order, throws the last error if all fail. */
async function fetchJson(path) {
  let lastError = new Error('No market endpoint reachable')
  for (const base of BASES) {
    try {
      return await fetchFrom(base, path)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

function fromCache(symbols) {
  const now = Date.now()
  const hits = symbols.map((s) => cache.get(String(s).toUpperCase()))
  const fresh = hits.every((h) => h && now - h.at < CACHE_MS)
  return fresh ? hits.map(({ symbol, price, changePct }) => ({ symbol, price, changePct })) : null
}

function toTicker(symbol, row) {
  if (!row) return null
  const price = Number(row.lastPrice)
  const changePct = Number(row.priceChangePercent)
  return Number.isFinite(price) && Number.isFinite(changePct) ? { symbol, price, changePct } : null
}

const inflight = new Map()

async function fetchTickerRows(list) {
  const query = encodeURIComponent(JSON.stringify(list.map(pairOf)))
  try {
    const data = await fetchJson(`/api/v3/ticker/24hr?symbols=${query}`)
    if (Array.isArray(data)) return data
  } catch (e) {
    if (list.length === 1) throw e
  }
  /* One unknown or delisted symbol fails the whole batch: fall back to one request per symbol. */
  const rows = await Promise.all(
    list.map((s) => fetchJson(`/api/v3/ticker/24hr?symbol=${pairOf(s)}`).catch(() => null)),
  )
  return rows.filter(Boolean)
}

async function loadTickers(list) {
  const data = await fetchTickerRows(list)
  const bySymbol = new Map(data.map((row) => [row.symbol, row]))
  const tickers = list.map((s) => toTicker(s, bySymbol.get(pairOf(s)))).filter(Boolean)
  if (!tickers.length) throw new Error('Empty ticker response')
  const at = Date.now()
  cache = new Map([...cache, ...tickers.map((t) => [t.symbol, { ...t, at }])])
  return tickers
}

/** [{ symbol, price, changePct }] for ['BTC', ...]. Throws on failure. Concurrent calls share requests. */
export async function getTickers(symbols) {
  const list = (symbols || []).map((s) => String(s).toUpperCase()).filter(Boolean)
  if (!list.length) throw new Error('No symbols')
  const cached = fromCache(list)
  if (cached) return cached

  /* Reuse an in-flight request that covers every requested symbol (e.g. planner BTC inside the ticker batch). */
  for (const [keys, promise] of inflight) {
    if (list.every((s) => keys.includes(s))) {
      const all = await promise
      const subset = all.filter((t) => list.includes(t.symbol))
      if (subset.length) return subset
    }
  }
  const key = list.join(',')
  const promise = loadTickers(list).finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

/** [{ t, o, h, l, c }] candles, oldest first. Throws on failure. */
export async function getKlines(symbol = 'BTC', interval = '1h', limit = 48) {
  const safeInterval = INTERVALS.has(interval) ? interval : '1h'
  const safeLimit = Math.min(Math.max(Math.round(Number(limit)) || 48, 1), 500)
  const path = `/api/v3/klines?symbol=${pairOf(symbol)}&interval=${safeInterval}&limit=${safeLimit}`
  const data = await fetchJson(path)
  if (!Array.isArray(data)) throw new Error('Unexpected klines response')
  const candles = data
    .map((r) => ({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]) }))
    .filter((k) => [k.o, k.h, k.l, k.c].every(Number.isFinite))
  if (!candles.length) throw new Error('Empty klines response')
  return candles
}

/** Last price, shares the 30s cache with getTickers. */
export async function getPrice(symbol = 'BTC') {
  const [ticker] = await getTickers([symbol])
  return ticker.price
}

/** >= 1000: no decimals with separators; >= 1: 2 decimals; else 4 significant digits. */
export function formatPrice(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return ''
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (abs >= 1) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

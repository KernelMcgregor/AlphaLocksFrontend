// Past Model Results filters. They live in the URL (?basis=open&min_ev=0.05...) so any view
// is a link someone can share; resultsQuery() turns them into the API's query string.
export const MARKETS = [
  { key: 'winner', label: 'Moneyline' },
  { key: 'method', label: 'Method' },
  { key: 'distance', label: 'Goes the distance' },
  { key: 'itd', label: 'Inside the distance' },
  { key: 'rounds', label: 'Rounds' },
]
// Market identity colour: the validated family slots, in this fixed order (filtering markets
// never repaints the ones left).
export const MARKET_COLOR = Object.fromEntries(MARKETS.map((m, i) => [m.key, `var(--color-fam-${i + 1})`]))
export const MIN_EVS = [
  { key: '0', label: 'Every +EV pick' },
  { key: '0.03', label: '3%+ EV' },
  { key: '0.05', label: '5%+ EV' },
  { key: '0.08', label: '8%+ EV' },
  { key: '0.12', label: '12%+ EV' },
  { key: '0.2', label: '20%+ EV' },
]
export const DEFAULTS = { from: '', to: '', basis: 'close', price: 'typical', minEv: '0', markets: [], props: true, top: false }

export function readFilters(params) {
  const markets = (params.get('markets') || '').split(',').filter((m) => MARKETS.some((x) => x.key === m))
  return {
    from: params.get('from') || '',
    to: params.get('to') || '',
    basis: params.get('basis') === 'open' ? 'open' : 'close',
    price: params.get('price') === 'best' ? 'best' : 'typical',
    minEv: MIN_EVS.some((m) => m.key === params.get('min_ev')) ? params.get('min_ev') : '0',
    markets,                                  // [] = every market
    props: params.get('props') !== '0',
    top: params.get('top') === '1',
  }
}

/** URL params for a filter patch: defaults are removed so a plain link stays plain. */
export function filterParams(f) {
  return {
    from: f.from || null, to: f.to || null,
    basis: f.basis === 'close' ? null : f.basis,
    price: f.price === 'typical' ? null : f.price,
    min_ev: f.minEv === '0' ? null : f.minEv,
    markets: f.markets.length ? f.markets.join(',') : null,
    props: f.props ? null : '0',
    top: f.top ? '1' : null,
  }
}

export function resultsQuery(f, { dates = true } = {}) {
  const q = new URLSearchParams({ basis: f.basis, price: f.price, min_ev: f.minEv })
  if (dates && f.from) q.set('start', f.from)
  if (dates && f.to) q.set('end', f.to)
  if (f.markets.length) q.set('markets', f.markets.join(','))
  if (!f.props) q.set('props_at_open', 'false')
  if (f.top) q.set('top_only', 'true')
  return q.toString()
}

// ---- number formatting shared by both tabs ----
export const fmtUnits = (u) => (u == null ? '—' : `${u > 0 ? '+' : u < 0 ? '−' : ''}${Math.abs(u).toFixed(1)}u`)
export const fmtPct = (x, d = 1) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(d)}%`)
export const fmtRate = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
export const fmtOdds = (a) => (a == null ? '—' : a > 0 ? `+${a}` : `${a}`)
export const signCls = (x) => (x == null || Math.abs(x) < 1e-9 ? 'text-muted-foreground' : x > 0 ? 'text-emerald-600' : 'text-red-500')

// Where a fight's predictions came from (backend model_results.SOURCE_LABELS).
export const SOURCE_BADGE = {
  live: { label: 'Live', title: 'Served on the site before the fight', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  forward: { label: 'Pre-trained', title: 'Predicted by a model trained before this card (out-of-sample, not the walk-forward backtest)', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
}

// Small formatting helpers for the article pages: names, records, weight classes, odds.
export const lastName = (f) => f?.last_name || 'TBA'
export const record = (f) => (f ? `${f.wins ?? 0}-${f.losses ?? 0}${f.draws ? `-${f.draws}` : ''}` : '')
export const isTitle = (wc = '') => /title/i.test(wc)
export const weightLabel = (wc = '') => wc.replace(/^UFC\s+/i, '').replace(/\s*(Title\s*)?Bout$/i, '').replace(/\s*Title$/i, '').trim()
export const eventShort = (name = '') => {
  const k = name.split(':')[0].trim()
  return /^UFC\s+\d+/i.test(k) ? k : 'Fight Night'
}
export const age = (dob) => (dob ? Math.floor((Date.now() - Date.parse(dob)) / 3.15576e10) : null)
export const val = (v) => (v && v !== '--' ? v : '–')
// Best price per corner across books (highest payout).
export function bestOdds(odds = []) {
  const best = (k) => odds.map((o) => o[k]).filter((x) => x != null).reduce((a, b) => (a == null || b > a ? b : a), null)
  return { red: best('red_odds'), blue: best('blue_odds') }
}
export const topMethod = (mp) => {
  if (!mp) return null
  const [label, p] = [['KO/TKO', mp.ko_prob], ['Submission', mp.sub_prob], ['Decision', mp.dec_prob]].sort((a, b) => b[1] - a[1])[0]
  return `${label} ${Math.round(p * 100)}%`
}

// The article layout: the newsroom's choice (fight.preview.layout), else by card position:
// top two and title fights get the feature, the rest of the main card the standard page,
// prelims the brief.
const LAYOUT_KEYS = ['feature', 'standard', 'rivalry', 'magazine', 'data', 'brief']
export function layoutKey(fight) {
  const chosen = fight.preview?.layout
  if (LAYOUT_KEYS.includes(chosen)) return chosen
  if ((fight.card_position != null && fight.card_position <= 1) || isTitle(fight.weight_class)) return 'feature'
  if (fight.card_position != null && fight.card_position >= 5) return 'brief'
  return 'standard'
}

// Red's no-vig market probability: the exchange consensus, else the mean no-vig price
// across the sportsbooks (the same fallback the newsroom's fact sheet uses).
export function marketRedProb(fight) {
  const c = fight.market_consensus?.red_prob
  return c != null ? c : booksRedProb(fight)
}

// Red's mean no-vig probability across the sportsbooks.
export function booksRedProb(fight) {
  const imp = (a) => (a > 0 ? 100 / (a + 100) : -a / (-a + 100))
  const probs = (fight.odds || []).filter((o) => o.red_odds != null && o.blue_odds != null)
    .map((o) => { const r = imp(o.red_odds); const b = imp(o.blue_odds); return r / (r + b) })
  return probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null
}

const noVig = (a, b) => {
  const imp = (x) => (x > 0 ? 100 / (x + 100) : -x / (-x + 100))
  if (a == null || b == null) return [null, null]
  const pa = imp(a); const pb = imp(b)
  return [pa / (pa + pb), pb / (pa + pb)]
}

// P(the fight is still going at `minute`) from the round model's survival curve.
function survival(curve, minute) {
  if (!curve?.length) return null
  const pt = curve.reduce((best, p) => (Math.abs(p.t - minute) < Math.abs(best.t - minute) ? p : best), curve[0])
  return Math.abs(pt.t - minute) <= 0.7 ? pt.s : null
}

// Every market we can price, sportsbook style: [{ key, title, options: [{ key, label, side,
// price, market, model }] }]. `price` is American odds (the best on offer), `market` the
// no-vig probability, `model` ours. Moneyline prices are the best across the books, the
// same numbers OddsTable highlights and the header shows.
export function marketsFor(fight) {
  const red = lastName(fight.red_fighter)
  const blue = lastName(fight.blue_fighter)
  const props = fight.prop_markets || {}
  const mp = fight.method_prediction || {}
  const p = fight.prediction?.red_prob
  const best = bestOdds(fight.odds)
  const [mr, mb] = noVig(best.red, best.blue)
  const book = booksRedProb(fight)
  const out = [{
    key: 'ml', title: 'Moneyline',
    options: [
      { key: 'ml_red', label: red, side: 'red', price: best.red, market: book ?? mr, model: p },
      { key: 'ml_blue', label: blue, side: 'blue', price: best.blue, market: book == null ? mb : 1 - book, model: p == null ? null : 1 - p },
    ],
  }]
  const prop = (k) => props[k] || {}
  const methods = ['red', 'blue'].flatMap((side) => [['ko', 'KO/TKO'], ['sub', 'Submission'], ['dec', 'Decision']].map(([m, label]) => ({
    key: `${side}_${m}`, label: `${side === 'red' ? red : blue} ${label}`, side,
    price: prop(`${side}_${m}`).best_american, market: prop(`${side}_${m}`).prob, model: mp[`${side}_${m}_prob`],
  })))
  if (methods.some((o) => o.price != null || o.model != null)) out.push({ key: 'method', title: 'Method of victory', options: methods })
  const curve = fight.round_prediction?.curve
  const lines = [2, 3, 4, 5].filter((n) => props[`sr_${n}`]?.prob != null)
  if (lines.length) {
    out.push({
      key: 'rounds', title: 'Total rounds',
      options: lines.flatMap((n) => {
        const over = survival(curve, (n - 1) * 5)
        return [
          { key: `o${n}`, label: `Over ${n - 1}.5`, price: prop(`sr_${n}`).best_american, market: prop(`sr_${n}`).prob, model: over },
          { key: `u${n}`, label: `Under ${n - 1}.5`, price: prop(`sr_${n}_no`).best_american, market: prop(`sr_${n}_no`).prob, model: over == null ? null : 1 - over },
        ]
      }),
    })
  }
  if (props.dec_yes?.prob != null) {
    const dec = mp.dec_prob
    out.push({
      key: 'distance', title: 'Goes the distance',
      options: [
        { key: 'dist_yes', label: 'Yes', price: props.dec_yes.best_american, market: props.dec_yes.prob, model: dec },
        { key: 'dist_no', label: 'No', price: props.dec_no?.best_american, market: props.dec_no?.prob, model: dec == null ? null : 1 - dec },
      ],
    })
  }
  return out
}

// The best value on the bout: every priced option the model rates at least `min` points
// above the market's no-vig probability, biggest edge first.
export function bestEdges(fight, n = 3, min = 2) {
  return marketsFor(fight)
    .flatMap((m) => m.options.map((o) => ({ ...o, market_title: m.title })))
    .filter((o) => o.price != null && o.model != null && o.market != null)
    .map((o) => ({ ...o, edge: (o.model - o.market) * 100 }))
    .filter((o) => o.edge >= min)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, n)
}

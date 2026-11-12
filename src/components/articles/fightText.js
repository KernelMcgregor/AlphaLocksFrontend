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
  if (c != null) return c
  const imp = (a) => (a > 0 ? 100 / (a + 100) : -a / (-a + 100))
  const probs = (fight.odds || []).filter((o) => o.red_odds != null && o.blue_odds != null)
    .map((o) => { const r = imp(o.red_odds); const b = imp(o.blue_odds); return r / (r + b) })
  return probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null
}

// Helpers for the Picks page (/ufc/picks/v2).
//
// A grade is the realised ROI of the pick's EV band *in that market's* walk-forward
// backtest (backend: app/services/ufc/grading.py). So the same 10% edge can be an A−
// on the moneyline and an F on "by KO" — the letter comes from the market's history,
// not from the size of the edge. Nothing here recomputes a grade; it only reads them.

export const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'NR', '—']

/** Lower is better. Unknown letters sort last. */
export const gradeRank = (g) => {
  const i = GRADE_ORDER.indexOf(g)
  return i === -1 ? GRADE_ORDER.length : i
}

/** Display form: the API writes minus as '-', the page uses a real minus sign. */
export const gradeText = (g) => (g ? g.replace('-', '−') : '—')

/** Colour family for a grade. Always paired with the letter itself — never colour alone. */
export function gradeTone(g) {
  if (!g || g === '—' || g === 'NR') return 'none'
  return { A: 'a', B: 'b', C: 'c', D: 'd', F: 'd' }[g[0]] || 'none'
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export const MARKET_GROUPS = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'method', label: 'Method' },
  { key: 'decision', label: 'Decision' },
  { key: 'itd', label: 'Inside distance' },
  { key: 'rounds', label: 'Rounds' },
]

export function marketGroup(family = '') {
  if (family.startsWith('winner')) return 'moneyline'
  if (family.startsWith('sixway')) return 'method'
  if (family.startsWith('decision')) return 'decision'
  if (family.startsWith('itd')) return 'itd'
  return 'rounds'
}

const FAMILY_NOUN = {
  winner_open: 'moneyline (opening line)',
  winner_close: 'moneyline',
  sixway_ko: 'KO/TKO',
  sixway_sub: 'submission',
  sixway_dec: 'winner-by-decision',
  sixway_ko_fav: 'favourite-by-KO/TKO',
  sixway_ko_dog: 'underdog-by-KO/TKO',
  sixway_sub_fav: 'favourite-by-submission',
  sixway_sub_dog: 'underdog-by-submission',
  sixway_dec_fav: 'favourite-by-decision',
  sixway_dec_dog: 'underdog-by-decision',
  decision_yes: 'goes-to-decision',
  decision_no: 'doesn’t-go-to-decision',
  itd_yes: 'inside-the-distance',
  itd_no: 'not-inside-the-distance',
}

export function familyNoun(family = '') {
  if (FAMILY_NOUN[family]) return FAMILY_NOUN[family]
  const ou = /^ou_(\d)_(\d)_(over|under)$/.exec(family)
  if (ou) return `${ou[3]} ${ou[1]}.${ou[2]} rounds`
  const er = /^ends_r(\d)$/.exec(family)
  if (er) return `ends-in-round-${er[1]}`
  const sr = /^starts_r(\d)_(yes|no)$/.exec(family)
  if (sr) return `${sr[2] === 'no' ? 'doesn’t start' : 'starts'} round ${sr[1]}`
  return family.replace(/_/g, ' ')
}

/** The corner a market is about, if it is about one fighter. */
export function marketCorner(m) {
  if (m.market_key === 'moneyline') return m.pick ?? null
  const k = /^(red|blue)_(ko|sub|dec)$/.exec(m.market_key)
  if (k) return k[1]
  const itd = /^itd_(red|blue)$/.exec(m.market_key)
  return itd ? itd[1] : null
}

/** Does the pick back this corner's fighter to win? (Drives whether model drivers apply.) */
export function backsCorner(m) {
  const c = marketCorner(m)
  if (!c) return false
  return m.market_key === 'moneyline' || m.pick === 'yes'
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

export const decimalOdds = (a) => (a == null ? null : a > 0 ? 1 + a / 100 : 1 + 100 / -a)
export const fmtPct = (p, d = 1) => (p == null ? '—' : `${(p * 100).toFixed(d)}%`)
export const fmtSigned = (x, d = 1, unit = '') => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}${unit}`)

/** "−9.9%" from a fraction. */
export const fmtRoi = (r, d = 1) => (r == null ? '—' : fmtSigned(r * 100, d, '%'))

export function bandLabel(band) {
  if (!band) return ''
  const [lo, hi] = band
  return hi == null ? `${Math.round(lo * 100)}%+ edge` : `${Math.round(lo * 100)}–${Math.round(hi * 100)}% edge`
}

export function ago(iso) {
  if (!iso) return null
  // API timestamps are naive UTC.
  const t = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Model drivers (winner-model SHAP values)
// ---------------------------------------------------------------------------

// The features that carry most of the model's weight, in words. `scale` turns the stored
// red-minus-blue difference into the unit shown; anything not listed falls back to a
// cleaned-up version of its name.
const FEATURES = {
  fights_since_ko_loss: { label: 'Fights since last KO loss', d: 1 },
  pro_opp_elo: { label: 'Strength of past opponents (Elo)', d: 0 },
  pro_elo: { label: 'Career Elo rating', d: 0 },
  elo: { label: 'UFC Elo rating', d: 0 },
  elo_expected: { label: 'Elo win expectancy', scale: 100, unit: ' pts', d: 0 },
  age: { label: 'Age', unit: ' yrs', d: 1 },
  // transforms of age; listing them beside Age would count the same reason twice
  age_sq: { label: 'Age (curve)', redundant: true },
  age_x_log_layoff: { label: 'Age × layoff', redundant: true },
  years_past_peak: { label: 'Years past athletic peak', unit: ' yrs', d: 1 },
  years_to_peak: { label: 'Years to athletic peak', unit: ' yrs', d: 1 },
  pro_win_pct: { label: 'Pro win rate', scale: 100, unit: ' pts', d: 0 },
  career_win_pct: { label: 'UFC win rate', scale: 100, unit: ' pts', d: 0 },
  weight_lbs: { label: 'Weight', unit: ' lbs', d: 0 },
  reach_inches: { label: 'Reach', unit: '″', d: 1 },
  height_inches: { label: 'Height', unit: '″', d: 1 },
  avg_ground_landed_per5: { label: 'Ground strikes landed / 5 min', d: 1 },
  xs_sig_diff: { label: 'Expected sig. strike differential', d: 1 },
  xs_sig_for: { label: 'Expected sig. strikes landed', d: 1 },
  xs_sig_against: { label: 'Expected sig. strikes absorbed', d: 1 },
  xs_sub_for: { label: 'Expected submission attempts', d: 2 },
  xs_ctrl_for: { label: 'Expected control time', d: 1 },
  last3_defense_composite: { label: 'Defense, last 3 fights', d: 2 },
  last3_pressure_composite: { label: 'Pressure, last 3 fights', d: 2 },
  recent_sig_str_def: { label: 'Recent striking defense', scale: 100, unit: ' pts', d: 0 },
  glicko_meta_sigma: { label: 'Rating uncertainty', d: 2 },
  glicko_kod: { label: 'Knockdown power (rated)', d: 2 },
  glicko_str_def: { label: 'Striking defense (rated)', d: 2 },
  glicko_durability: { label: 'Durability (rated)', d: 2 },
  glicko_str_acc: { label: 'Striking accuracy (rated)', d: 2 },
  glicko_tdd: { label: 'Takedown defense (rated)', d: 2 },
  glicko_td: { label: 'Wrestling offense (rated)', d: 2 },
  style_matchup_adv: { label: 'Style matchup advantage', d: 2 },
  pro_fights: { label: 'Pro fights', d: 0 },
  days_since_last: { label: 'Days since last fight', d: 0 },
  streak: { label: 'Current streak', d: 0 },
  finish_rate: { label: 'Finish rate', scale: 100, unit: ' pts', d: 0 },
}

function prettify(name) {
  return name
    .replace(/_per5$/, ' / 5 min')
    .replace(/^xs_/, 'expected ')
    .replace(/^glicko_/, 'rated ')
    .replace(/_pct$/, ' %')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * One driver, told from the picked corner's side.
 *  for:    true when it pushes the model toward the picked fighter
 *  detail: the fighter's edge on that stat, e.g. "+82 vs opp", when it reads cleanly
 */
export function describeDriver(d, corner) {
  const m = /^(diff|red|blue)_(.+)$/.exec(d.feature_name)
  const kind = m?.[1] ?? 'diff'
  const base = m?.[2] ?? d.feature_name
  const meta = FEATURES[base] || {}
  const forRed = d.shap_value > 0
  const favours = corner === 'red' ? forRed : !forRed
  let detail = null
  if (kind === 'diff' && d.feature_value != null) {
    const v = (corner === 'blue' ? -d.feature_value : d.feature_value) * (meta.scale || 1)
    detail = `${fmtSigned(v, meta.d ?? 2, meta.unit || '')} vs opp`
  }
  const own = kind === 'diff' ? '' : kind === corner ? ' (own)' : ' (opponent)'
  return {
    label: (meta.label || prettify(base)) + own, favours, weight: Math.abs(d.shap_value), detail,
    redundant: !!meta.redundant,
  }
}

// ---------------------------------------------------------------------------
// Flatten / filter / sort
// ---------------------------------------------------------------------------

/** Every market on one or more cards as one row, with its fight and event attached. */
export function flattenPicks(payloads) {
  const rows = []
  for (const data of payloads || []) {
    for (const fight of data?.fights || []) {
      for (const m of fight.markets) {
        rows.push({ ...m, fight, event: data.event, group: marketGroup(m.family), id: `${fight.fight_id}:${m.market_key}` })
      }
    }
  }
  return rows
}

/** Price, EV and book on the chosen basis. Picks and grades are on the typical (median)
 *  book's price; "best" is shown for line shopping. */
export function priced(row, basis) {
  if (basis === 'median') {
    return { american: row.median_american, ev: row.ev_median, book: row.median_american != null ? 'typical book' : null }
  }
  return { american: row.best_american, ev: row.ev_best, book: row.best_book }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const MIN_GRADES = [
  { key: 'A-', label: 'A− or better' },
  { key: 'B-', label: 'B− or better' },
  { key: 'C-', label: 'C− or better' },
  { key: 'picks', label: 'Every pick' },
  { key: 'all', label: 'Any grade' },
]

export const DEFAULT_FILTERS = {
  scope: 'primary',    // primary = one best pick per fight | all = every market
  groups: [],          // empty = every market
  book: 'all',
  minGrade: 'all',
  basis: 'median',     // the price grades are measured at
  side: 'all',         // all | fav | dog
  sort: 'grade',
  q: '',
}

export const SORTS = [
  { key: 'grade', label: 'Grade' },
  { key: 'ev', label: 'EV' },
  { key: 'edge', label: 'Edge (pts)' },
  { key: 'long', label: 'Longest odds' },
  { key: 'short', label: 'Shortest odds' },
  { key: 'card', label: 'Card order' },
]

export function sortPicks(rows, sort, basis) {
  const ev = (r) => priced(r, basis).ev ?? -Infinity
  const dec = (r) => decimalOdds(priced(r, basis).american)
  const byGrade = (a, b) => gradeRank(a.grade) - gradeRank(b.grade) || ev(b) - ev(a)
  const cmp = {
    grade: byGrade,
    ev: (a, b) => ev(b) - ev(a),
    edge: (a, b) => (b.edge_pts ?? -Infinity) - (a.edge_pts ?? -Infinity),
    // rows without a price sink to the bottom either way
    long: (a, b) => (dec(b) ?? -Infinity) - (dec(a) ?? -Infinity),
    short: (a, b) => (dec(a) ?? Infinity) - (dec(b) ?? Infinity),
    card: (a, b) =>
      (a.event?.date || '').localeCompare(b.event?.date || '') ||
      (a.fight.card_position ?? 99) - (b.fight.card_position ?? 99) || byGrade(a, b),
  }[sort] || byGrade
  return [...rows].sort(cmp)
}

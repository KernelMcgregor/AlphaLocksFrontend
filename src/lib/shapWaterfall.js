// src/lib/shapWaterfall.js
//
// The winner model's prediction as a walk from a coin flip to the number on the card,
// for ProbabilityWaterfall. Shared by the upcoming and completed fight pages.
//
// The stored SHAP values are per-feature and named for the model's own columns.
// Twelve rows of `diff_age_x_log_layoff` is not an explanation, so features are
// folded into families a reader can argue with. Order is fixed rather than sorted
// by size: the same fight read twice, and two fights read side by side, should put
// the same family in the same place.
export const SHAP_FAMILIES = [
  { key: 'market', label: 'Market signal', test: (n) => n.includes('odds') },
  { key: 'skills', label: 'Rated skills', test: (n) => n.includes('glicko') },
  { key: 'rating', label: 'Rating & résumé', test: (n) => /elo|resume|career|streak|win_pct/.test(n) },
  { key: 'age', label: 'Age & prime', test: (n) => /age|peak|years/.test(n) },
  { key: 'activity', label: 'Layoff & activity', test: (n) => /layoff|days_since|fights_seen|rounds_seen/.test(n) },
  { key: 'physical', label: 'Physical', test: (n) => /height|reach|weight|stance/.test(n) },
  { key: 'output', label: 'Fight output', test: (n) => /sig_str|str_|td_|ctrl|kd|sub_att|ground|clinch|dist|pace|output/.test(n) },
  { key: 'finishing', label: 'Finishing', test: (n) => /ko_|sub_rate|dec_rate|finish/.test(n) },
  { key: 'other', label: 'Everything else', test: () => true },
]

const shapFamily = (name) => SHAP_FAMILIES.find((f) => f.test(name)).key

const logit = (p) => Math.log(p / (1 - p))
const sigmoid = (x) => 1 / (1 + Math.exp(-x))

// SHAP values are log-odds contributions from the raw model, while `red_prob` is
// the calibrated probability, and only this fight's top 20 features are stored.
// So the walk is anchored at the END — `logit(red_prob)` minus the stored
// attributions is the starting point — and the difference between that and a coin
// flip is shown as its own first step, "prior & unlisted". Every other step is
// then exact, and the walk lands precisely on the displayed probability.
export function buildShapWaterfall(prediction, shapValues) {
  if (!prediction?.red_prob || !shapValues?.length) return null
  const pFinal = Math.min(0.999, Math.max(0.001, prediction.red_prob))
  const stored = shapValues.reduce((a, v) => a + (v.shap_value || 0), 0)
  const baseLogit = logit(pFinal) - stored

  const sums = new Map()
  for (const v of shapValues) {
    const key = shapFamily(v.feature_name)
    sums.set(key, (sums.get(key) || 0) + (v.shap_value || 0))
  }

  // The market family is folded into the opening step rather than drawn: the
  // chart is a read of the fight, and a row saying the price is an input invites
  // the reader to discount everything under it. The walk still lands on the same
  // probability — nothing is dropped, only unlabelled.
  const opening = baseLogit + (sums.get('market') || 0)
  let cum = opening
  const steps = [{
    key: 'prior',
    label: 'Base rate',
    from: 0.5,
    to: sigmoid(opening),
    points: (sigmoid(opening) - 0.5) * 100,
  }]
  for (const fam of SHAP_FAMILIES) {
    if (fam.key === 'market') continue
    const v = sums.get(fam.key)
    if (v == null || Math.abs(v) < 1e-9) continue
    const from = sigmoid(cum)
    cum += v
    const to = sigmoid(cum)
    steps.push({ key: fam.key, label: fam.label, from, to, points: (to - from) * 100 })
  }

  const calibration = prediction.va_prob_low != null && prediction.va_prob_high != null
    ? { low: prediction.va_prob_low, high: prediction.va_prob_high }
    : null
  // Told from the favourite's side: the walk ends on the bigger number, and the
  // headline reads "why Talbott is 84%" rather than "why Figueiredo is only 16%".
  // Every probability is mirrored, so steps keep their size and flip direction.
  const side = pFinal >= 0.5 ? 'red' : 'blue'
  if (side === 'red') return { side, steps, final: sigmoid(cum), calibration }
  const f = (p) => 1 - p
  return {
    side,
    steps: steps.map((st) => ({ ...st, from: f(st.from), to: f(st.to), points: -st.points })),
    final: f(sigmoid(cum)),
    calibration: calibration && { low: f(calibration.high), high: f(calibration.low) },
  }
}

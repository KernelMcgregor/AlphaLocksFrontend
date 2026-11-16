// A fighter's own style in words, from their style profile (percentiles 0-99, see
// routers/ufc._style_row): what they do far more and far less than other fighters, and
// where their fights go well or badly for them.

// Habit -> [phrase when far above the field, phrase when far below]. Verb phrases, read
// after the fighter's surname.
const HABIT_PHRASES = {
  str_att_pm: ['pushes a high pace', 'fights at a low output'],
  head_att_share: ['hunts the head', 'rarely headhunts'],
  body_att_share: ['invests heavily in the body', 'seldom goes to the body'],
  leg_att_share: ['chops at the legs', 'barely kicks the legs'],
  dist_att_share: ['does most of the work at range', 'rarely stays at range'],
  clinch_att_share: ['lives in the clinch', 'stays out of the clinch'],
  ground_att_share: ['does a lot of damage on the ground', 'rarely strikes on the ground'],
  td_att15s: ['shoots for takedowns constantly', 'almost never shoots'],
  sub_att15: ['hunts submissions', 'rarely looks for submissions'],
  nonsig_share: ['grinds with short, smothering strikes', 'keeps every strike clean and committed'],
  ctrl_share: ['spends long stretches in top control', 'spends little time in control'],
  gnp_per_ctrl: ['lets the hands go once on top', 'holds position rather than strike from top'],
}

// How it goes -> [strength label, weakness label, invert]. `invert`: a high percentile is
// bad (strikes absorbed, time spent controlled).
const OUTCOMES = {
  sig_acc: ['Accurate striker', 'Inaccurate striker'],
  sig_def: ['Hard to hit', 'Easy to hit'],
  sapm: ['Absorbs little', 'Absorbs a lot', true],
  td_acc: ['Lands takedowns', 'Takedowns rarely land'],
  td_def: ['Hard to take down', 'Gets taken down'],
  ctrld_share: ['Rarely held down', 'Gets held down', true],
  kd15s: ['Knockdown power', 'Rarely drops opponents'],
  finish_rate: ['Finisher', 'Rarely finishes'],
  glicko_kod: ['Iron chin', 'Chin concerns'],
  glicko_durability: ['Durable', 'Breaks down late'],
  glicko_subd: ['Hard to submit', 'Submission risk'],
}

const HIGH = 80
const LOW = 20
// Habits stand out at a looser cut: few fighters sit past 80 on more than one.
const HABIT_HIGH = 75
const HABIT_LOW = 25

const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// One sentence: what they do far more than the field, but what they rarely do. Null when
// nothing stands out.
export function styleSummary(name, profile) {
  if (!profile) return null
  const ranked = Object.keys(HABIT_PHRASES).filter((k) => profile[k] != null)
  // Past the cut first; a fighter near the middle on everything still gets their two most
  // distinctive habits each way, down to a softer floor.
  const byHigh = [...ranked].sort((a, b) => profile[b] - profile[a])
  const byLow = [...ranked].sort((a, b) => profile[a] - profile[b])
  const pick = (sorted, strong, soft, n, test) =>
    sorted.filter((k) => test(profile[k], strong)).length >= 2
      ? sorted.filter((k) => test(profile[k], strong)).slice(0, n)
      : sorted.filter((k) => test(profile[k], soft)).slice(0, 2)
  const high = pick(byHigh, HABIT_HIGH, 65, 3, (v, cut) => v >= cut)
  const low = pick(byLow, HABIT_LOW, 35, 2, (v, cut) => v <= cut)
  const does = list(high.map((k) => HABIT_PHRASES[k][0]))
  const doesnt = list(low.map((k) => HABIT_PHRASES[k][1]))
  if (!does && !doesnt) return null
  return `${name} ${[does, doesnt].filter(Boolean).join(', but ')}.`
}

// [[label, percentile], ...] strongest first; for inverted traits the flipped percentile,
// so a lower number is always worse.
export function strengthsWeaknesses(profile, n = 4) {
  const rows = Object.entries(OUTCOMES)
    .filter(([k]) => profile?.[k] != null)
    .map(([k, [good, bad, invert]]) => ({ good, bad, p: invert ? 100 - profile[k] : profile[k] }))
  return {
    strengths: rows.filter((r) => r.p >= HIGH).sort((a, b) => b.p - a.p).slice(0, n).map((r) => [r.good, r.p]),
    weaknesses: rows.filter((r) => r.p <= LOW + 10).sort((a, b) => a.p - b.p).slice(0, n).map((r) => [r.bad, r.p]),
  }
}

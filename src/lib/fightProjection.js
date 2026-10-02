// src/lib/fightProjection.js
//
// Pure derivations over the expected-stats payload (fight.expected_stats, written by
// expected_stats_serving.py) for the upcoming-fight page: the Fight Flow section and
// the keys to victory.
//
// Why keys come from expected stats and not the Glicko skills alone: the expected-stats
// model is literally "A's offence against B's defence" (log rate = mu + off_A - def_B),
// fitted on counts with exposure and evaluated out of sample. A Glicko pair says A rates
// well and B rates badly in two separate skills; the projection says what that adds up
// to in THIS bout, in strikes and takedowns. The skills and career rates stay on the card
// as the explanation — the strength and the hole — not as the ranking.
//
// Not the winner model either: SHAP says which inputs moved a probability, which is a
// different question from what either fighter should do in the cage.
import { ordinal } from './fighterAnalytics'

// Payload units: sig/td/kd/sub are counts, ctrl is seconds; `rate` is per minute
// (control: seconds per minute). Career stats mix per-minute and per-15 columns, so
// each stat says how to put its career numbers on the same per-minute scale.
export const FLOW_STATS = [
  { key: 'sig', label: 'Sig. strikes', short: 'strikes', fmt: 'int',
    career: 'slpm', concede: 'sapm', per: 1, careerUnit: '/min',
    attackDim: 'str_vol', attackLabel: 'volume', defendDim: 'str_def', defendLabel: 'strike defence' },
  { key: 'td', label: 'Takedowns', short: 'takedowns', fmt: 'dec1',
    career: 'td15', concede: 'td_abs15', per: 15, careerUnit: '/15',
    attackDim: 'td', attackLabel: 'takedowns', defendDim: 'tdd', defendLabel: 'takedown defence' },
  { key: 'ctrl', label: 'Control time', short: 'control', fmt: 'clock',
    career: 'ctrl15', concede: 'ctrl_abs15', per: 15, careerUnit: '/15', careerFmt: 'clock',
    attackDim: 'ctrl', attackLabel: 'control', defendDim: 'tdd', defendLabel: 'takedown defence' },
  { key: 'kd', label: 'Knockdowns', short: 'knockdowns', fmt: 'dec2',
    career: 'kd15', concede: 'kd_abs15', per: 15, careerUnit: '/15',
    attackDim: 'ko', attackLabel: 'KO power', defendDim: 'kod', defendLabel: 'chin' },
  { key: 'sub', label: 'Sub attempts', short: 'sub attempts', fmt: 'dec1',
    career: 'sub_att15', concede: 'sub_abs15', per: 15, careerUnit: '/15',
    attackDim: 'sub', attackLabel: 'submissions', defendDim: 'subd', defendLabel: 'sub defence' },
]

export const clock = (sec) => {
  if (sec == null) return '—'
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// p10/p90 come off an integer support, so ranges print as whole counts ("1–6", not
// "1.0–6.0"); control stays a clock.
export const rangeFmt = (fmt) => (fmt === 'clock' ? 'clock' : 'int')

export function fmtStat(v, fmt) {
  if (v == null || !Number.isFinite(v)) return '—'
  if (fmt === 'clock') return clock(v)
  if (fmt === 'int') return String(Math.round(v))
  if (fmt === 'dec2') return v.toFixed(2)
  return v.toFixed(1)
}

const pct = (p) => `${Math.round(p * 100)}%`
const other = (side) => (side === 'red' ? 'blue' : 'red')

// ---------------------------------------------------------------------------
// Fight Flow
// ---------------------------------------------------------------------------
// Everything the section draws, from the payload plus the fight-length curve. Null when
// either corner is missing — a one-sided projection has nothing to compare.
export function deriveFightFlow(xs, roundPrediction, scheduledRounds) {
  if (!xs?.red || !xs?.blue) return null
  const scheduledMin = (scheduledRounds || 3) * 5
  const expectedMin = roundPrediction?.expected_minutes ?? null

  const rows = FLOW_STATS.map((s) => ({
    ...s,
    red: xs.red[s.key] || {},
    blue: xs.blue[s.key] || {},
    // P(out-lands) is only modelled for strikes and takedowns
    pMore: s.key === 'sig' || s.key === 'td'
      ? { red: xs.red[`${s.key}_p_more`], blue: xs.blue[`${s.key}_p_more`] }
      : null,
  })).filter((r) => r.red.expected != null || r.blue.expected != null)

  // Time split: each corner's control share, and the rest is standing or neutral
  // (scrambles count here too — "neither fighter in control" is what the model knows).
  const redCtrl = xs.red.ctrl_share ?? 0
  const blueCtrl = xs.blue.ctrl_share ?? 0
  const position = { red: redCtrl, blue: blueCtrl, neutral: Math.max(0, 1 - redCtrl - blueCtrl) }

  const sigRed = xs.red.sig?.expected
  const sigBlue = xs.blue.sig?.expected
  const pace = expectedMin && sigRed != null && sigBlue != null ? (sigRed + sigBlue) / expectedMin : null

  return {
    rows,
    position,
    expectedMin,
    scheduledMin,
    pDecision: roundPrediction?.p_decision ?? null,
    pace,
    story: flowStory(xs),
  }
}

// Which corner each phase of the fight belongs to, or null if neither clearly.
function phaseOwners(xs) {
  const striker = ['red', 'blue'].find((s) => (xs[s].sig_p_more ?? 0) >= 0.6) || null
  const grappler = ['red', 'blue'].find((s) => {
    const share = xs[s].ctrl_share ?? 0
    const td = xs[s].td?.expected ?? 0
    return (share >= 0.2 && share - (xs[other(s)].ctrl_share ?? 0) >= 0.1)
      || (td >= 1.5 && (xs[s].td_p_more ?? 0) >= 0.65)
  }) || null
  return { striker, grappler }
}

// One or two sentences on the shape of the fight. Rule-based on the same thresholds the
// keys use, so the headline never contradicts the cards under it. Names are filled in
// by the caller: {red} / {blue} placeholders.
function flowStory(xs) {
  const { striker, grappler } = phaseOwners(xs)
  const ground = (xs.red.ctrl_share ?? 0) + (xs.blue.ctrl_share ?? 0)
  const sig = (s) => Math.round(xs[s].sig?.expected ?? 0)
  const td = (s) => (xs[s].td?.expected ?? 0).toFixed(1)
  const strikeLine = (s) => `{${s}} out-lands {${other(s)}} ${pct(xs[s].sig_p_more)} of the time (${sig(s)} to ${sig(other(s))} sig. strikes)`
  const grappleLine = (s) => `${td(s)} takedowns and ${pct(xs[s].ctrl_share)} of the fight on top`

  if (striker && grappler && striker !== grappler) {
    return {
      kind: 'Striker vs grappler',
      text: `${strikeLine(striker)}, so the stand-up belongs to {${striker}}. {${grappler}}'s way in is the takedown: ${grappleLine(grappler)}.`,
    }
  }
  if (striker && grappler === striker) {
    return {
      kind: `{${striker}} everywhere`,
      text: `Projected ahead on the feet and on the mat: ${strikeLine(striker)}, plus ${grappleLine(striker)}.`,
    }
  }
  if (grappler) {
    return {
      kind: 'Grappling fight',
      text: `{${grappler}} is projected to dictate where it happens: ${grappleLine(grappler)}. On the feet it is close (${sig('red')} to ${sig('blue')} sig. strikes).`,
    }
  }
  if (striker) {
    return {
      kind: 'Stand-up fight',
      text: `${strikeLine(striker)}. Expected on the feet for ${pct(Math.max(0, 1 - ground))} of the fight.`,
    }
  }
  return {
    kind: 'Even on paper',
    text: `No phase clearly belongs to either corner: ${sig('red')} to ${sig('blue')} sig. strikes, ${td('red')} to ${td('blue')} takedowns, ${pct(ground)} of the fight with someone in control.`,
  }
}

// ---------------------------------------------------------------------------
// Keys to victory
// ---------------------------------------------------------------------------
// A key is a phase of THIS fight one corner is projected to win, with the reason: what
// they do well (career rate, rated skill) and what the opponent lets happen (career
// rate conceded, rated defence).
//
// `edge` puts five differently-scaled stats on one 0-1 ranking. The two with a modelled
// head-to-head use it directly (2p - 1: a 75% chance to out-land is 0.5). The rest are
// scaled to match — a 20-point control-share gap ranks with that 75%, and the count
// stats use 1 - e^-diff, the Poisson chance of at least one more. Sub attempts are
// discounted: an attempt is far less often decisive than a knockdown.
const KEY_RULES = {
  sig: (me) => {
    const p = me.sig_p_more
    return p != null && p >= 0.6 ? 2 * p - 1 : null
  },
  td: (me) => {
    const p = me.td_p_more
    return p != null && p >= 0.6 && (me.td?.expected ?? 0) >= 1 ? 2 * p - 1 : null
  },
  ctrl: (me, them) => {
    const a = me.ctrl_share ?? 0
    const b = them.ctrl_share ?? 0
    return a >= 0.2 && a >= 1.5 * b ? Math.min(1, (a - b) * 2.5) : null
  },
  kd: (me, them) => {
    const a = me.kd?.expected ?? 0
    const b = them.kd?.expected ?? 0
    return a >= 0.3 && a >= 2 * b ? 1 - Math.exp(-(a - b)) : null
  },
  sub: (me, them) => {
    const a = me.sub?.expected ?? 0
    const b = them.sub?.expected ?? 0
    return a >= 0.6 && a >= 2 * b ? 0.7 * (1 - Math.exp(-(a - b))) : null
  },
}

const KEY_TITLES = {
  sig: 'Win the striking',
  td: 'Take it down',
  ctrl: 'Control from the top',
  kd: 'Land the big shot',
  sub: 'Hunt the submission',
}

function projectionLine(stat, me, them) {
  const m = me[stat.key] || {}
  const t = them[stat.key] || {}
  const rf = rangeFmt(stat.fmt)
  const range = m.p10 != null && m.p90 != null ? ` (${fmtStat(m.p10, rf)}–${fmtStat(m.p90, rf)})` : ''
  switch (stat.key) {
    case 'sig':
      return `Out-lands {opp} ${pct(me.sig_p_more)} of the time: ${fmtStat(m.expected, 'int')} sig. strikes${range} to ${fmtStat(t.expected, 'int')}.`
    case 'td':
      return `${fmtStat(m.expected, 'dec1')} takedowns projected${range}; lands more than {opp} ${pct(me.td_p_more)} of the time.`
    case 'ctrl':
      return `On top for ${pct(me.ctrl_share)} of the fight (${clock(m.expected)}), against ${pct(them.ctrl_share ?? 0)} for {opp}.`
    case 'kd':
      return `${fmtStat(m.expected, 'dec2')} knockdowns projected, against ${fmtStat(t.expected, 'dec2')} for {opp}.`
    default:
      return `${fmtStat(m.expected, 'dec1')} submission attempts projected, against ${fmtStat(t.expected, 'dec1')} for {opp}.`
  }
}

// Career rate on the stat's own display scale ("5.1/min", "2.4/15", "3:10/15").
function careerText(cs, col, stat) {
  const v = cs?.[col]
  if (v == null) return null
  return `${stat.careerFmt === 'clock' ? clock(v) : v.toFixed(1)}${stat.careerUnit}`
}

// How far the projection sits above the attacker's own career rate, per minute. This is
// the "takes advantage of the hole" number: the opponent's defence moving the forecast.
function liftOverNorm(stat, rate, cs) {
  const career = cs?.[stat.career]
  if (rate == null || career == null || career <= 0) return null
  const careerPerMin = career / stat.per
  return rate / careerPerMin - 1
}

/**
 * @param xs       fight.expected_stats
 * @param ctx      matchup context (Glicko dimensions per corner)
 * @param career   { red: careerStats, blue: careerStats }
 * @returns keys, widest edge first, at most three per corner — capping per corner keeps
 *          the underdog's routes on the board.
 */
export function buildProjectedKeys(xs, ctx, career) {
  if (!xs?.red || !xs?.blue) return []
  const out = []
  for (const side of ['red', 'blue']) {
    const me = xs[side]
    const them = xs[other(side)]
    const myDims = ctx?.[side]?.glicko?.dimensions
    const theirDims = ctx?.[other(side)]?.glicko?.dimensions
    for (const stat of FLOW_STATS) {
      const edge = KEY_RULES[stat.key](me, them)
      if (edge == null || edge < 0.2) continue
      out.push({
        id: `${side}-${stat.key}`,
        side,
        stat: stat.key,
        title: KEY_TITLES[stat.key],
        edge,
        projection: projectionLine(stat, me, them),
        strength: {
          label: stat.attackLabel,
          career: careerText(career?.[side], stat.career, stat),
          pct: myDims?.[stat.attackDim]?.percentile ?? null,
        },
        weakness: {
          label: stat.defendLabel,
          career: careerText(career?.[other(side)], stat.concede, stat),
          pct: theirDims?.[stat.defendDim]?.percentile ?? null,
        },
        lift: liftOverNorm(stat, me[stat.key]?.rate, career?.[side]),
      })
    }
  }
  // Control and takedowns are usually the same route told twice; keep the stronger.
  for (const side of ['red', 'blue']) {
    const td = out.find((k) => k.side === side && k.stat === 'td')
    const ctrl = out.find((k) => k.side === side && k.stat === 'ctrl')
    if (td && ctrl) out.splice(out.indexOf(td.edge >= ctrl.edge ? ctrl : td), 1)
  }
  const perSide = { red: [], blue: [] }
  for (const k of out.sort((a, b) => b.edge - a.edge)) {
    if (perSide[k.side].length < 3) perSide[k.side].push(k)
  }
  return [...perSide.red, ...perSide.blue].sort((a, b) => b.edge - a.edge)
}

export const pctLabel = (p) => (p == null ? null : `${ordinal(p)} pct`)

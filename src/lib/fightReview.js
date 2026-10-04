// src/lib/fightReview.js
//
// Pure derivations for the completed-fight page: the fight's own stat rows split into
// totals and rounds, advanced per-fighter numbers, expected-vs-actual against the
// walk-forward expected-stats projection, the pre-fight keys graded, and the prop
// markets settled. The page only draws what comes out of here.
import { roundDurations } from './fighterAnalytics'
import { FLOW_STATS } from './fightProjection'

const other = (side) => (side === 'red' ? 'blue' : 'red')

// "KO/TKO" | "Submission" | "Decision - Split" ... -> the method model's three classes.
export function methodClass(method) {
  const m = (method || '').toLowerCase()
  if (m.includes('decision')) return 'dec'
  if (m.includes('sub')) return 'sub'
  if (m.includes('ko') || m.includes('doctor')) return 'ko'
  return null
}

export const METHOD_LABEL = { ko: 'KO/TKO', sub: 'Submission', dec: 'Decision' }

export function winnerSide(fight) {
  const w = String(fight.winner?.id ?? fight.winner_id ?? '')
  if (!w) return null
  if (w === String(fight.red_fighter?.id)) return 'red'
  if (w === String(fight.blue_fighter?.id)) return 'blue'
  return null
}

// ---------------------------------------------------------------------------
// Stat rows
// ---------------------------------------------------------------------------
// round_number 0 is the bout total. Rows past finish_round are UFCStats padding (some
// bouts carry all-zero rows out to round 23) and are dropped.
export function splitStats(fight) {
  const rows = fight.stats || []
  const pick = (corner, rnd) => rows.find((s) => s.corner === corner && Number(s.round_number) === rnd) || null
  const red = pick('red', 0)
  const blue = pick('blue', 0)
  const lastRound = fight.finish_round
    || Math.max(0, ...rows.map((s) => Number(s.round_number)))
  const { secs } = roundDurations(fight, lastRound)
  const rounds = []
  for (let r = 1; r <= lastRound; r++) {
    const rr = pick('red', r)
    const rb = pick('blue', r)
    if (rr && rb) rounds.push({ round: r, red: rr, blue: rb, seconds: secs[r - 1] ?? null })
  }
  return { total: red && blue ? { red, blue } : null, rounds }
}

const div = (a, b) => (b ? a / b : null)

// Per side, from the two totals rows: everything that needs the opponent's row too
// (defence, differential, share of the fight) is computed here rather than read from
// the derived columns, which are only populated on some rows.
export function advancedStats(total, fightSeconds) {
  if (!total) return null
  const minutes = fightSeconds ? fightSeconds / 60 : null
  const out = {}
  for (const side of ['red', 'blue']) {
    const me = total[side]
    const them = total[other(side)]
    out[side] = {
      sigPerMin: minutes ? me.sig_str_landed / minutes : null,
      sigDiffPerMin: minutes ? (me.sig_str_landed - them.sig_str_landed) / minutes : null,
      sigAcc: div(me.sig_str_landed, me.sig_str_attempted),
      // Defence: share of the opponent's significant attempts that missed.
      sigDef: them.sig_str_attempted ? 1 - them.sig_str_landed / them.sig_str_attempted : null,
      tdAcc: div(me.td_landed, me.td_attempted),
      tdDef: them.td_attempted ? 1 - them.td_landed / them.td_attempted : null,
      ctrlShare: fightSeconds ? me.ctrl_seconds / fightSeconds : null,
      // Landed per absorbed — above 1 means they gave more than they took.
      damageRatio: them.sig_str_landed ? me.sig_str_landed / them.sig_str_landed : null,
      headShare: div(me.head_landed, me.sig_str_landed),
      sigShare: div(me.sig_str_landed, me.sig_str_landed + them.sig_str_landed),
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Record going in
// ---------------------------------------------------------------------------
// The fighter row holds today's record. Taking off every UFC result from this bout on
// gives the record as it stood that night (exact unless they have fought outside the
// UFC since — those results are in the total but not in the log).
export function recordGoingIn(fighter, fights, fight) {
  if (!fighter || !fights?.length || !fight?.date) return null
  let { wins = 0, losses = 0, draws = 0 } = fighter
  const id = String(fighter.id)
  for (const f of fights) {
    if (!f.date || f.date < fight.date) continue
    if (String(f.red_fighter_id) !== id && String(f.blue_fighter_id) !== id) continue
    if (f.winner_id == null) {
      if (!/No Contest|Overturned|Could Not Continue/i.test(f.method || '') && f.method) draws -= 1
    } else if (String(f.winner_id) === id) wins -= 1
    else losses -= 1
  }
  if (wins < 0 || losses < 0 || draws < 0) return null
  return `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`
}

// ---------------------------------------------------------------------------
// Expected vs actual
// ---------------------------------------------------------------------------
const ACTUAL_COL = { sig: 'sig_str_landed', td: 'td_landed', kd: 'kd', sub: 'sub_att', ctrl: 'ctrl_seconds' }

// Per side, per stat: the projection (walk-forward, so out of sample), its 10-90 range,
// and what happened. `z` places the result inside the range (-1 = at p10, +1 = at p90),
// which is what the "over / under expectations" read is built on.
export function expectationRows(xs, total) {
  if (!xs?.red || !xs?.blue || !total) return null
  const out = {}
  for (const side of ['red', 'blue']) {
    out[side] = FLOW_STATS.map((s) => {
      const p = xs[side][s.key] || {}
      const actual = total[side][ACTUAL_COL[s.key]]
      if (p.expected == null || actual == null) return null
      const lo = p.p10 ?? null
      const hi = p.p90 ?? null
      let z = null
      if (lo != null && hi != null && hi > lo) {
        const mid = p.expected
        z = actual >= mid ? (actual - mid) / Math.max(hi - mid, 1e-9) : -(mid - actual) / Math.max(mid - lo, 1e-9)
      }
      return {
        key: s.key, label: s.label, fmt: s.fmt,
        expected: p.expected, p10: lo, p90: hi, ifDistance: p.if_distance ?? null,
        actual, delta: actual - p.expected, z,
        verdict: z == null ? null : z > 1 ? 'well above' : z > 0.35 ? 'above' : z < -1 ? 'well below' : z < -0.35 ? 'below' : 'as expected',
      }
    }).filter(Boolean)
  }
  return out
}

// ---------------------------------------------------------------------------
// Keys to victory, graded
// ---------------------------------------------------------------------------
// Each projected key is a phase one corner was expected to win; graded on whether they
// actually won it. Same phases as lib/fightProjection KEY_RULES.
export function gradeKeys(keys, total) {
  if (!total) return []
  return keys.map((k) => {
    const me = total[k.side]
    const them = total[other(k.side)]
    let hit
    let line
    switch (k.stat) {
      case 'sig':
        hit = me.sig_str_landed > them.sig_str_landed
        line = `Landed ${me.sig_str_landed} sig. strikes to ${them.sig_str_landed}.`
        break
      case 'td':
        hit = me.td_landed >= 1 && me.td_landed > them.td_landed
        line = `${me.td_landed} of ${me.td_attempted} takedowns, against ${them.td_landed}.`
        break
      case 'ctrl':
        hit = me.ctrl_seconds > them.ctrl_seconds && me.ctrl_seconds >= 60
        line = `${Math.floor(me.ctrl_seconds / 60)}:${String(me.ctrl_seconds % 60).padStart(2, '0')} of control, against ${Math.floor(them.ctrl_seconds / 60)}:${String(them.ctrl_seconds % 60).padStart(2, '0')}.`
        break
      case 'kd':
        hit = me.kd >= 1 && me.kd > them.kd
        line = `${me.kd} knockdown${me.kd === 1 ? '' : 's'}, against ${them.kd}.`
        break
      default:
        hit = me.sub_att >= 1 && me.sub_att > them.sub_att
        line = `${me.sub_att} submission attempt${me.sub_att === 1 ? '' : 's'}, against ${them.sub_att}.`
    }
    return { ...k, hit, line }
  })
}

// ---------------------------------------------------------------------------
// Props, settled
// ---------------------------------------------------------------------------
// The prop markets that resolved YES, with the market's last de-vigged price on them:
// "what the books thought of what actually happened". Keys per prop_serving.py.
export function settledProps(propMarkets, fight, side) {
  if (!propMarkets) return []
  const cls = methodClass(fight.method)
  const secs = Number(fight.fight_time_seconds) || null
  const finished = cls === 'ko' || cls === 'sub'
  const out = []
  const add = (key, label) => {
    const m = propMarkets[key]
    if (m?.prob != null) out.push({ key, label, prob: m.prob, opening: m.opening_prob ?? null, american: m.median_american ?? m.best_american ?? null })
  }
  if (side && cls) add(`${side}_${cls}`, `${side === 'red' ? fight.red_fighter.last_name : fight.blue_fighter.last_name} by ${METHOD_LABEL[cls]}`)
  if (cls) add(cls === 'dec' ? 'dec_yes' : 'dec_no', cls === 'dec' ? 'Goes the distance' : 'Does not go the distance')
  if (side) add(`itd_${side}_${finished ? 'yes' : 'no'}`, `${side === 'red' ? fight.red_fighter.last_name : fight.blue_fighter.last_name} ${finished ? 'wins inside the distance' : 'does not win inside the distance'}`)
  if (secs != null) {
    for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
      const over = secs > line * 300
      add(`ou_${line}_${over ? 'over' : 'under'}`, `${over ? 'Over' : 'Under'} ${line} rounds`)
    }
  }
  if (finished && fight.finish_round) add(`er_${fight.finish_round}`, `Ends in round ${fight.finish_round}`)
  return out
}

// ---------------------------------------------------------------------------
// Judges
// ---------------------------------------------------------------------------
// Which side a judge's card (or round) went to. Deductions are added back for the
// round verdict: a 9-9 with a point off red was a 10-9 red round on the judge's card.
export function cardSide(cell, { verdict = false } = {}) {
  if (!cell || cell.red == null || cell.blue == null) return null
  const r = cell.red + (verdict ? cell.red_ded || 0 : 0)
  const b = cell.blue + (verdict ? cell.blue_ded || 0 : 0)
  return r > b ? 'red' : r < b ? 'blue' : 'even'
}

// The panel's verdict and who, if anyone, broke from it.
export function panelSummary(scorecards) {
  const judges = scorecards?.judges || []
  const sides = judges.map((j) => cardSide(j.total))
  const red = sides.filter((s) => s === 'red').length
  const blue = sides.filter((s) => s === 'blue').length
  const majority = red > blue ? 'red' : blue > red ? 'blue' : 'even'
  return {
    majority,
    split: { red, blue, even: sides.filter((s) => s === 'even').length },
    dissenters: judges.filter((j, i) => sides[i] && sides[i] !== majority).map((j) => j.seq),
  }
}

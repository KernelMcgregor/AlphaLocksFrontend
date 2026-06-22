// src/lib/fighterAnalytics.js
// Shared analytics for the Fighter Decompositions, Fighter Stats, and Fighter Profile pages.
// Pure functions over the real API shapes:
//   - rankings fighter:  { id, first_name, last_name, nickname, wins, losses, draws,
//                          country_code, image_url, rank, score, dimensions: {<13 keys>} }
//   - fight stats row:   UFCFightStatsResponse (per fight/round: sig_str_landed, td_landed, ctrl_seconds, ...)
//   - fight:             UFCFightResponse (winner_id, method, fight_time_seconds, finish_round, ...)

// ---------------------------------------------------------------------------
// The 13 model dimensions (order + keys match ranking_service.DIMENSIONS)
// ---------------------------------------------------------------------------
export const DIMS = [
  { key: 'str_vol', label: 'Striking Volume',   short: 'Volume',    group: 'striking' },
  { key: 'str_acc', label: 'Striking Accuracy', short: 'Accuracy',  group: 'striking' },
  { key: 'str_def', label: 'Strike Defense',    short: 'Defense',   group: 'striking' },
  { key: 'ko',      label: 'KO Power',           short: 'KO Power',  group: 'striking' },
  { key: 'kod',     label: 'Chin',               short: 'Chin',      group: 'striking' },
  { key: 'durability', label: 'Durability',      short: 'Durability', group: 'striking' },
  { key: 'dist',    label: 'Distance Striking',  short: 'Distance',  group: 'striking' },
  { key: 'pts',     label: 'Pace / Output',      short: 'Pace',      group: 'striking' },
  { key: 'td',      label: 'Takedowns',          short: 'Takedowns', group: 'grappling' },
  { key: 'tdd',     label: 'Takedown Defense',   short: 'TD Def',    group: 'grappling' },
  { key: 'ctrl',    label: 'Control',             short: 'Control',   group: 'grappling' },
  { key: 'sub',     label: 'Submission Offense', short: 'Sub',       group: 'grappling' },
  { key: 'subd',    label: 'Submission Defense', short: 'Sub Def',   group: 'grappling' },
  { key: 'clinch',  label: 'Clinch Fighting',    short: 'Clinch',    group: 'grappling' },
  { key: 'gnd',     label: 'Ground Striking',    short: 'Ground',    group: 'grappling' },
]

// 8-axis readable subset used by the radial charts.
export const AXES = [
  { key: 'str_vol', label: 'Volume',     group: 'striking' },
  { key: 'str_acc', label: 'Accuracy',   group: 'striking' },
  { key: 'str_def', label: 'Defense',    group: 'striking' },
  { key: 'ko',      label: 'KO Power',   group: 'striking' },
  { key: 'kod',     label: 'Chin',       group: 'striking' },
  { key: 'td',      label: 'Takedowns',  group: 'grappling' },
  { key: 'tdd',     label: 'TD Defense', group: 'grappling' },
  { key: 'ctrl',    label: 'Control',    group: 'grappling' },
  { key: 'sub',     label: 'Submission', group: 'grappling' },
]

export const STRIKING_DIMS = ['str_vol', 'str_acc', 'str_def', 'ko', 'kod', 'durability', 'dist', 'pts']
export const GRAPPLING_DIMS = ['td', 'tdd', 'ctrl', 'sub', 'subd', 'clinch', 'gnd']

export function ordinal(n) {
  const v = Math.round(n)
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return v + (s[(m - 20) % 10] || s[m] || s[0])
}

export function initialsOf(fighter) {
  return ((fighter.first_name?.[0] || '') + (fighter.last_name?.[0] || '')).toUpperCase()
}

// Build a percentile lookup across every ranked fighter in a division.
export function buildPercentile(fighters) {
  const cols = {}
  DIMS.forEach((d) => {
    cols[d.key] = fighters.map((f) => f.dimensions?.[d.key] ?? 0).sort((a, b) => a - b)
  })
  return (dim, val) => {
    const arr = cols[dim]
    if (!arr || arr.length < 2) return 50
    let c = 0
    for (const v of arr) if (v <= val) c++
    return Math.round((c / arr.length) * 100)
  }
}

// Full skill profile: 13-dim list (with percentile + raw), 8-axis subset,
// group scores, strengths/weaknesses, top skills.
export function deriveProfile(fighter, pct) {
  const raw = fighter.dimensions || {}
  const dims = DIMS.map((d) => ({ ...d, value: pct(d.key, raw[d.key] ?? 0), raw: raw[d.key] ?? 0 }))
  const axes = AXES.map((a) => ({ ...a, value: pct(a.key, raw[a.key] ?? 0) }))
  const sorted = [...dims].sort((a, b) => b.value - a.value)
  const avg = (keys) => Math.round(keys.reduce((s, k) => s + pct(k, raw[k] ?? 0), 0) / keys.length)
  const striking = avg(STRIKING_DIMS)
  const grappling = avg(GRAPPLING_DIMS)
  const overall = Math.round((striking + grappling) / 2)
  return {
    dims,
    axes,
    striking: dims.filter((d) => d.group === 'striking'),
    grappling: dims.filter((d) => d.group === 'grappling'),
    strengths: sorted.slice(0, 4),
    weaknesses: sorted.slice(-4).reverse(),
    topSkills: sorted.slice(0, 2),
    groups: [
      { label: 'Striking',  value: striking,  cls: 'text-amber-500',  stroke: 'stroke-amber-500' },
      { label: 'Grappling', value: grappling, cls: 'text-indigo-500', stroke: 'stroke-indigo-500' },
      { label: 'Overall',   value: overall,   cls: 'text-blue-600',   stroke: 'stroke-blue-600' },
    ],
    overall,
    strikingScore: striking,
    grapplingScore: grappling,
  }
}

// ---------------------------------------------------------------------------
// Career fight-stat aggregation from real /fighters/:id/stats + /fights rows.
// Returns per-minute / per-15-min rates, target & position splits, and
// method outcomes. Strike DEFENSE / absorbed are intentionally omitted —
// they require opponent rows the single-fighter endpoint does not return.
// ---------------------------------------------------------------------------
function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

export function aggregateCareer(statRows, fights, fighterId) {
  const rows = statRows || []
  // Prefer per-fight totals rows (round_number === 0); else sum round rows.
  const totals = rows.filter((r) => Number(r.round_number) === 0)
  const agg = totals.length ? totals : rows
  const sum = (k) => agg.reduce((s, r) => s + (Number(r[k]) || 0), 0)

  const sig = sum('sig_str_landed'), sigAtt = sum('sig_str_attempted')
  const tot = sum('total_str_landed')
  const td = sum('td_landed'), tdAtt = sum('td_attempted')
  const subAtt = sum('sub_att'), rev = sum('rev'), ctrl = sum('ctrl_seconds'), kd = sum('kd')
  const head = sum('head_landed'), body = sum('body_landed'), leg = sum('leg_landed')
  const dist = sum('distance_landed'), clinch = sum('clinch_landed'), ground = sum('ground_landed')

  // total fought time across the fights that have stat rows
  const statFightIds = new Set(agg.map((r) => String(r.fight_id)))
  const fightArr = fights || []
  const timed = fightArr.filter((f) => statFightIds.has(String(f.id)) && f.fight_time_seconds)
  const secs = timed.reduce((s, f) => s + (f.fight_time_seconds || 0), 0)
  const mins = secs / 60

  const per15 = (x) => (secs ? (x / secs) * 900 : 0)
  const perMin = (x) => (mins ? x / mins : 0)
  const pctOf = (x, t) => (t ? Math.round((x / t) * 100) : 0)

  // outcomes from the fight log
  let ko = 0, sub = 0, dec = 0, wins = 0, losses = 0
  fightArr.forEach((f) => {
    const isThis = String(f.red_fighter_id) === String(fighterId) || String(f.blue_fighter_id) === String(fighterId)
    if (!isThis) return
    if (String(f.winner_id) === String(fighterId)) {
      wins++
      const m = (f.method || '').toLowerCase()
      if (m.includes('ko') || m.includes('tko')) ko++
      else if (m.includes('sub')) sub++
      else dec++
    } else if (f.winner_id) {
      losses++
    }
  })
  const winsByMethod = ko + sub + dec
  const finishRate = winsByMethod ? Math.round(((ko + sub) / winsByMethod) * 100) : 0

  const targetTot = head + body + leg
  const posTot = dist + clinch + ground

  return {
    fightCount: timed.length || statFightIds.size,
    hasStats: agg.length > 0 && secs > 0,
    // striking
    slpm: perMin(sig), tslpm: perMin(tot), sigAcc: pctOf(sig, sigAtt), kd15: per15(kd),
    // target split (% of sig strikes)
    head: pctOf(head, targetTot), body: pctOf(body, targetTot), leg: pctOf(leg, targetTot),
    // position split (% of sig strikes)
    distance: pctOf(dist, posTot), clinch: pctOf(clinch, posTot), ground: pctOf(ground, posTot),
    // grappling
    td15: per15(td), tdAcc: pctOf(td, tdAtt), subAtt15: per15(subAtt), rev15: per15(rev),
    ctrl15: per15(ctrl), ctrl15Str: fmtClock(per15(ctrl)),
    // outcomes
    ko, sub, dec, finishRate, wins, losses,
    winPct: wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0,
    // raw career totals (handy for tooltips / detail)
    totals: { sig, sigAtt, tot, td, tdAtt, subAtt, rev, ctrlSeconds: ctrl, kd },
  }
}

// Classify a fight's method string into a short label for the recent-fights list.
export function methodLabel(method) {
  const m = (method || '').toLowerCase()
  if (m.includes('ko') || m.includes('tko')) return 'KO/TKO'
  if (m.includes('sub')) return 'Submission'
  if (m.includes('decision') || m.includes('dec')) return 'Decision'
  return method || '—'
}

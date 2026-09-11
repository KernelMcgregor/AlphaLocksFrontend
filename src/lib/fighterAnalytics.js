// src/lib/fighterAnalytics.js
// Shared analytics for the Fighter Decompositions, Fighter Stats, and Fighter Profile pages.
// Pure functions over the real API shapes:
//   - rankings fighter:  { id, first_name, last_name, nickname, wins, losses, draws,
//                          country_code, image_url, rank, score, dimensions: {<15 keys>} }
//   - fight stats row:   UFCFightStatsResponse (per fight/round: sig_str_landed, td_landed, ctrl_seconds, ...)
//   - fight:             UFCFightResponse (winner_id, method, fight_time_seconds, finish_round, ...)

// ---------------------------------------------------------------------------
// The 15 model dimensions (order + keys match ranking_service.DIMENSIONS)
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
  // axes carry the DIMS long label too — the radar shows the short one but its
  // tooltip wants the full name ("Volume" vs "Striking Volume").
  const axes = AXES.map((a) => ({
    ...a,
    value: pct(a.key, raw[a.key] ?? 0),
    full: DIMS.find((d) => d.key === a.key)?.label ?? a.label,
  }))
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
// method outcomes. Strike DEFENSE / absorbed are absent here because this works
// from the fighter's own stat rows only. They are NOT unavailable: the server
// computes them from opponent rows — see deriveTwoWay + /fighters/:id/career-stats.
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

// ---------------------------------------------------------------------------
// Form / trend data derived purely from the fight log — streaks, octagon time,
// method splits for both wins AND losses, and activity per year.
// ---------------------------------------------------------------------------
export function deriveForm(fights, fighterId) {
  const done = (fights || [])
    .filter((f) => String(f.red_fighter_id) === String(fighterId) || String(f.blue_fighter_id) === String(fighterId))
    .filter((f) => f.winner_id != null || f.method)
    .slice()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  if (!done.length) return null

  const results = done.map((f) => ({
    id: f.id,
    win: String(f.winner_id) === String(fighterId),
    draw: f.winner_id == null,
    method: methodLabel(f.method),
    round: f.finish_round,
    date: f.date,
    seconds: f.fight_time_seconds || 0,
    // opponent id so the form strip can name who each result was against
    oppId: String(f.red_fighter_id) === String(fighterId) ? f.blue_fighter_id : f.red_fighter_id,
    eventId: f.event_id,
  }))

  // current streak (most recent run of the same outcome, draws break it)
  let streak = 0
  let streakWin = results[0].win
  for (const r of results) {
    if (r.draw || r.win !== streakWin) break
    streak++
  }

  // longest win streak across the whole log
  let longestWin = 0
  let run = 0
  for (const r of [...results].reverse()) {
    if (r.win && !r.draw) { run++; longestWin = Math.max(longestWin, run) } else run = 0
  }

  const wins = results.filter((r) => r.win && !r.draw)
  const losses = results.filter((r) => !r.win && !r.draw)
  const count = (arr, label) => arr.filter((r) => r.method === label).length

  const timed = results.filter((r) => r.seconds > 0)
  const octagonSeconds = timed.reduce((s, r) => s + r.seconds, 0)
  const avgSeconds = timed.length ? octagonSeconds / timed.length : 0

  const r1Finishes = wins.filter((r) => r.round === 1 && r.method !== 'Decision').length
  const decisions = count(wins, 'Decision') + count(losses, 'Decision')

  // fights per calendar year, with the W/L split (most recent 6 active years)
  const byYear = {}
  for (const r of results) {
    if (!r.date) continue
    const y = String(r.date).slice(0, 4)
    if (!byYear[y]) byYear[y] = { count: 0, wins: 0, losses: 0, opponents: [] }
    byYear[y].count++
    byYear[y].opponents.push({ oppId: r.oppId, win: r.win, draw: r.draw })
    if (r.draw) continue
    if (r.win) byYear[y].wins++
    else byYear[y].losses++
  }
  // Every active year, oldest first. The UI windows this itself so the user can
  // slide back through a long career rather than only seeing the recent end.
  const activity = Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, v]) => ({ year, ...v }))

  const lastDate = results[0].date

  return {
    results,
    recentForm: results.slice(0, 10),
    streak,
    streakWin,
    longestWin,
    // Fixed categorical slots — same hue means the same method everywhere.
    winMethods: [
      { label: 'KO/TKO', value: count(wins, 'KO/TKO'), cls: 'bg-viz-1' },
      { label: 'Submission', value: count(wins, 'Submission'), cls: 'bg-viz-2' },
      { label: 'Decision', value: count(wins, 'Decision'), cls: 'bg-viz-3' },
    ],
    lossMethods: [
      { label: 'KO/TKO', value: count(losses, 'KO/TKO'), cls: 'bg-viz-1' },
      { label: 'Submission', value: count(losses, 'Submission'), cls: 'bg-viz-2' },
      { label: 'Decision', value: count(losses, 'Decision'), cls: 'bg-viz-3' },
    ],
    totalWins: wins.length,
    totalLosses: losses.length,
    octagonSeconds,
    octagonTime: fmtClock(octagonSeconds),
    avgFightTime: fmtClock(avgSeconds),
    r1Finishes,
    distanceRate: results.length ? Math.round((decisions / results.length) * 100) : 0,
    activity,
    lastDate,
    daysSinceLast: lastDate ? Math.max(0, Math.round((Date.now() - new Date(lastDate + 'T00:00:00')) / 86400000)) : null,
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

// ---------------------------------------------------------------------------
// Opponent-relative career stats, from GET /ufc/fighters/:id/career-stats.
//
// This is the half `aggregateCareer` cannot see. That function works from the
// fighter's own stat rows, so it can only ever describe what they did; the server
// walks each opponent's totals row as well, which is what makes "absorbed" and
// "defense" possible. Everything here comes back render-ready: fractions are
// already x100, nulls are preserved as null (the server emits null, not 0, on a
// zero denominator, and the difference matters).
// ---------------------------------------------------------------------------
export function deriveTwoWay(cs) {
  if (!cs) return null

  const pct = (v) => (v == null ? null : v * 100)
  // `*_def` is 1 - opponent accuracy, i.e. a fighter-POSITIVE stat. Pairing it
  // against the fighter's own accuracy would put two "higher is better" numbers on
  // a row whose whole encoding is "mine vs theirs", inverting the meaning on that
  // row alone. Invert it back into opponent accuracy so every row reads the same.
  const oppAcc = (def) => (def == null ? null : (1 - def) * 100)
  const fmtPct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

  // Reversals and ground strikes are mat events, so normalise them by mat time
  // rather than fight time. The server ships no such column, so rebuild the counts
  // from the per-15 / per-minute rates and divide by the right denominator.
  //
  // A reversal happens while the OPPONENT has you controlled, so the fighter's
  // reversal rate is per minute of opponent control, and reversals conceded are
  // per minute of the fighter's own control. Both therefore read as "reversals per
  // minute spent on the bottom", which keeps the two sides comparable.
  //
  // Floored at 3 minutes. These denominators are the same kind that makes the
  // server's gnp15g reach 9900 — one reversal inside 20 seconds of control is not
  // a rate. Coverage at the floor: 2,307 fighters for opponent control, 2,044 for
  // own control, 2,700 for ground time.
  const totalMin = cs.total_fight_min ?? 0
  const groundMin = cs.est_ground_min ?? 0
  const MIN_MAT = 3
  // ctrl15 / ctrl_abs15 are SECONDS of control per 15 minutes
  const ownCtrlMin = totalMin && cs.ctrl15 != null ? (cs.ctrl15 * totalMin / 15) / 60 : 0
  const oppCtrlMin = totalMin && cs.ctrl_abs15 != null ? (cs.ctrl_abs15 * totalMin / 15) / 60 : 0

  const perMat = (per15, denomMin) => (
    per15 == null || !totalMin || denomMin < MIN_MAT ? null : (per15 * totalMin / 15) / denomMin
  )
  const perGround = (perMin) => (
    perMin == null || !totalMin || groundMin < MIN_MAT ? null : (perMin * totalMin) / groundMin
  )

  const rows = [
    { key: 'slpm', label: 'Sig. Str / Min', self: cs.slpm, opp: cs.sapm, fmt: 'num2' },
    { key: 'acc', label: 'Sig. Accuracy', self: pct(cs.sig_acc), opp: oppAcc(cs.sig_def), fmt: 'pct1',
      note: `Strike defense ${fmtPct(cs.sig_def)}` },
    { key: 'td15', label: 'Takedowns / 15', self: cs.td15, opp: cs.td_abs15, fmt: 'num2' },
    { key: 'tdacc', label: 'Takedown %', self: pct(cs.td_acc), opp: oppAcc(cs.td_def), fmt: 'pct1',
      note: `Takedown defense ${fmtPct(cs.td_def)}` },
    { key: 'ctrl', label: 'Control / 15', self: cs.ctrl15, opp: cs.ctrl_abs15, fmt: 'clock' },
    { key: 'kd', label: 'Knockdowns / 15', self: cs.kd15, opp: cs.kd_abs15, fmt: 'num2' },
    { key: 'sub', label: 'Sub Att / 15', self: cs.sub_att15, opp: cs.sub_abs15, fmt: 'num2' },
    // ground-and-pound rate. gnp15g would be the natural choice but its
    // denominator (est_ground_min) collapses toward zero for strikers and yields
    // values up to 9900; ground_pm is per real minute and well behaved.
    {
      key: 'gnd',
      label: 'Ground Str / Grd Min',
      self: perGround(cs.ground_pm),
      opp: perGround(cs.ground_abs_pm),
      fmt: 'num2',
      note: groundMin < MIN_MAT
        ? 'Needs at least 3 minutes of ground time'
        : `Per minute grounded · ${groundMin.toFixed(1)} min on the mat`,
    },
    {
      key: 'rev',
      label: 'Rev / Ctrl Min',
      // each side per minute IT spent controlled, not per minute of the fight
      self: perMat(cs.rev15, oppCtrlMin),
      opp: perMat(cs.rev_abs15, ownCtrlMin),
      fmt: 'num2',
      note: `Reversals per minute controlled · ${oppCtrlMin.toFixed(1)} min on the bottom, ${ownCtrlMin.toFixed(1)} min on top`,
    },
  ].filter((r) => r.self != null || r.opp != null)

  // Share of strikes AND the per-minute rate behind it. Shares alone mislead: a
  // fighter landing 5/min at 55% head while absorbing 1.2/min at 70% head looks
  // like they eat more head strikes than they throw.
  const split = (pairs) => pairs
    .map(([label, k]) => ({
      label,
      self: pct(cs[`${k}_pct`]),
      opp: pct(cs[`${k}_abs_pct`]),
      selfPm: cs[`${k}_pm`],
      oppPm: cs[`${k}_abs_pm`],
    }))
    .filter((r) => r.self != null || r.opp != null)

  return {
    rows,
    // sl_diff is exactly slpm - sapm (verified across every row in the table), so
    // it is the headline summary of the rows above, not an independent metric.
    net: cs.sl_diff ?? null,
    target: split([['Head', 'head'], ['Body', 'body'], ['Leg', 'leg']]),
    // How well each side lands on a given zone, rather than how often they aim
    // there. `*_def` is 1 - opponent accuracy to that zone, so invert it back.
    targetAcc: [['Head', 'head'], ['Body', 'body'], ['Leg', 'leg']]
      .map(([label, k]) => ({ label, self: pct(cs[`${k}_acc`]), opp: oppAcc(cs[`${k}_def`]) }))
      .filter((r) => r.self != null || r.opp != null),
    position: split([['Distance', 'dist'], ['Clinch', 'clinch'], ['Ground', 'ground']]),
    fightCount: cs.fight_count ?? 0,
    totalMin: cs.total_fight_min ?? null,
    hasTwoWay: rows.some((r) => r.opp != null),
  }
}

// ---------------------------------------------------------------------------
// Round-by-round pacing. Per-round rows carry only the 22 raw counts — every
// derived rate column is NULL by design — so rates must be computed here, which
// means knowing how long each round actually lasted.
// ---------------------------------------------------------------------------

// Per-round minutes from `time_format`. Mirrors model.py:_round_lengths: the value
// is a ROUND-LENGTH string, so '5-5-5' is three five-minute rounds and '10-5-5' is
// a ten then two fives. Legacy values ('No Time Limit', null) yield [].
export function roundLengths(timeFormat) {
  if (typeof timeFormat !== 'string') return []
  const parts = timeFormat.split('-').map((p) => p.trim())
  if (!parts.length || !parts.every((p) => /^\d+$/.test(p))) return []
  return parts.map(Number)
}

// Seconds actually fought in each round of one bout (index 0 = round 1).
// Rounds before the finish run their full scheduled length; the finish round is
// whatever is left of fight_time_seconds. `estimated` flags bouts where a round
// length had to be assumed or where the fight row and the format disagree.
export function roundDurations(fight, observedRounds = 0) {
  const lens = roundLengths(fight?.time_format)
  // finish_round is authoritative for how many rounds were actually contested.
  // Some bouts carry padding stat rows well past the finish (one Topuria fight
  // ends in round 4 but has rows out to round 23, all zeros — 446 fighter-fights
  // do this). Trusting the row count would treat those as real minutes fought
  // with zero output and halve the fighter's pace.
  const n = fight?.finish_round || observedRounds
  if (!n) return { secs: [], estimated: true }

  let estimated = false
  const scheduled = Array.from({ length: n }, (_, i) => {
    if (lens[i] != null) return lens[i] * 60
    estimated = true // round 6 of a 5-round format, or no parseable time_format
    return 300
  })

  const secs = scheduled.slice()
  const finish = fight?.finish_round || n
  const total = Number(fight?.fight_time_seconds) || 0
  const before = scheduled.slice(0, finish - 1).reduce((s, x) => s + x, 0)
  const last = total - before

  // A non-positive or over-long remainder means the fight row and the format
  // disagree. Keep the scheduled length rather than emit a 12-second round, which
  // would produce a 40-strikes-per-minute outlier that dominates the pooled rate.
  if (total > 0 && finish >= 1 && finish <= n && last > 0 && last <= scheduled[finish - 1] + 1) {
    secs[finish - 1] = last
  } else {
    estimated = true
  }
  return { secs, estimated }
}

// Pooled per-round rates across a career: sum(counts) / sum(minutes), never the
// mean of per-round rates — a 20-second finish round with a knockdown in it would
// otherwise be the loudest point in the panel.
//
// Offense only. /fighters/:id/stats returns this fighter's rows, so there is no
// opponent side to compute defense from without one request per fight.
export function deriveRoundPacing(statsByFight, fights, maxRound = 5) {
  const byId = {}
  for (const f of fights || []) byId[String(f.id)] = f

  const acc = Array.from({ length: maxRound }, () => ({
    n: 0, secs: 0, sig: 0, sigAtt: 0, td: 0, ctrl: 0, kd: 0, estimated: 0,
  }))

  for (const [fid, data] of Object.entries(statsByFight || {})) {
    const rounds = data?.rounds || []
    if (!rounds.length) continue
    const fight = byId[fid]
    const observed = Math.max(...rounds.map((r) => Number(r.round_number) || 0))
    const { secs, estimated } = roundDurations(fight, observed)
    if (!secs.length) continue

    for (const r of rounds) {
      const idx = (Number(r.round_number) || 0) - 1
      if (idx < 0 || idx >= maxRound) continue // round 6+ exists but is not shown
      if (idx >= secs.length) continue // padding row past the finish — never fought
      const dur = secs[idx]
      if (!dur || dur <= 0) continue
      const a = acc[idx]
      a.n += 1
      a.secs += dur
      a.sig += Number(r.sig_str_landed) || 0
      a.sigAtt += Number(r.sig_str_attempted) || 0
      a.td += Number(r.td_landed) || 0
      a.ctrl += Number(r.ctrl_seconds) || 0
      a.kd += Number(r.kd) || 0
      if (estimated) a.estimated += 1
    }
  }

  return acc
    .map((a, i) => {
      const min = a.secs / 60
      return {
        round: i + 1,
        n: a.n,
        minutes: min,
        estimated: a.estimated,
        slpm: min ? a.sig / min : null,
        sigAcc: a.sigAtt ? (a.sig / a.sigAtt) * 100 : null,
        td15: min ? (a.td / min) * 15 : null,
        // control can exceed a partial round's computed length in the source data
        ctrlPct: a.secs ? Math.min(100, (a.ctrl / a.secs) * 100) : null,
        kd15: min ? (a.kd / min) * 15 : null,
        totals: { sig: a.sig, sigAtt: a.sigAtt, td: a.td, ctrl: a.ctrl, kd: a.kd },
      }
    })
    .filter((r) => r.n > 0)
}

// How often a fighter gets out of each round alive.
//
// "Entered round R" is finish_round >= R — a decision's finish_round is the last
// scheduled round, so this covers both finishes and bouts that went the distance.
// "Stopped in R" counts only bouts the fighter LOST by finish in that round; a
// finish they scored is not a failure to survive.
//
// Also reports the scheduled-length mix, because round 4 and 5 opportunities only
// exist in five-round bouts and a bare "n=2" hides that.
export function deriveRoundSurvival(fights, fighterId, maxRound = 5) {
  const rounds = Array.from({ length: maxRound }, () => ({ entered: 0, stopped: 0, continued: 0 }))
  let three = 0
  let five = 0

  for (const f of fights || []) {
    const isThis = String(f.red_fighter_id) === String(fighterId) || String(f.blue_fighter_id) === String(fighterId)
    if (!isThis) continue
    if (f.winner_id == null && !f.method) continue // scheduled, not fought

    const scheduled = roundLengths(f.time_format).length
    if (scheduled >= 5) five += 1
    else if (scheduled) three += 1

    const finish = Number(f.finish_round) || 0
    if (!finish) continue

    const lost = f.winner_id != null && String(f.winner_id) !== String(fighterId)
    const m = (f.method || '').toLowerCase()
    const byFinish = m.includes('ko') || m.includes('tko') || m.includes('sub')

    for (let r = 1; r <= Math.min(finish, maxRound); r += 1) {
      rounds[r - 1].entered += 1
      // "the fighter got out" — they were not stopped here
      if (r === finish && lost && byFinish) rounds[r - 1].stopped += 1
      // "the fight got out" — the bout itself carried on past this round, however
      // it ended. A round the fighter won by KO is one the FIGHT did not survive.
      if (finish > r) rounds[r - 1].continued += 1
    }
  }

  return {
    rounds: rounds
      .map((r, i) => ({
        round: i + 1,
        entered: r.entered,
        stopped: r.stopped,
        continued: r.continued,
        survivedPct: r.entered ? ((r.entered - r.stopped) / r.entered) * 100 : null,
        continuedPct: r.entered ? (r.continued / r.entered) * 100 : null,
      }))
      .filter((r) => r.entered > 0),
    threeRound: three,
    fiveRound: five,
  }
}

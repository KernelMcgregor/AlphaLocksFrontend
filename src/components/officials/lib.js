// Non-component helpers for the officials pages: loading, formatting, the judge-lean
// arithmetic, URL sort state and the diverging fill.
import { useEffect, useState } from 'react'
import { fetchJudges } from '../../lib/officialsApi'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Loads `fetcher(key)` whenever `key` changes. Keyed state rather than a reset in the
// effect, so a stale response for the previous key is never shown under the new one.
export function useLoad(fetcher, key) {
  const [state, setState] = useState({ key: undefined, data: null, error: null })
  useEffect(() => {
    if (key == null) return undefined
    let live = true
    fetcher(key)
      .then((data) => live && setState({ key, data, error: null }))
      .catch((e) => live && setState({ key, data: null, error: e.message }))
    return () => { live = false }
  }, [fetcher, key])
  return state.key === key ? state : { data: null, error: null }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const MINUS = '−'
export const signed = (v, d = 1) => {
  if (v == null) return '—'
  // Anything that rounds to zero prints unsigned, not as −0.0.
  if (Number(Math.abs(v).toFixed(d)) === 0) return (0).toFixed(d)
  return `${v >= 0 ? '+' : MINUS}${Math.abs(v).toFixed(d)}`
}
// A rate difference (0.016) as points (+1.6).
export const pts = (v, d = 1) => (v == null ? '—' : signed(v * 100, d))
export const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`)
export const ordinal = (n) => {
  if (n == null) return '—'
  const v = Math.round(n)
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return v + (s[(m - 20) % 10] || s[m] || s[0])
}
export const year = (iso) => (iso ? iso.slice(0, 4) : '')
export const span = (a, b) => (!a ? '—' : year(a) === year(b) ? year(a) : `${year(a)}–${year(b)}`)
export const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
export const lastName = (name) => (name || '').split(' ').slice(-1)[0]

export const KINDS = { ud: 'Unanimous', sd: 'Split', md: 'Majority', draw: 'Draw' }

// ---------------------------------------------------------------------------
// Judge leans
// ---------------------------------------------------------------------------
// The four situational leans: for these the pool (the average judge) has its own
// effect, and a judge's total lean is pool + their deviation from it.
// (The red-corner lean is fitted but not shown: old UFCStats data lists the winner in
// red, which inflates it.)
export const LEANS = [
  { key: 'carry', label: 'Last round’s winner', short: 'Last rd', pos: 'Previous round’s winner', tip: 'Leans toward whoever won their previous round' },
  { key: 'fav', label: 'Betting favorite', short: 'Favorite', pos: 'Betting favorite', tip: 'Leans toward the betting favorite' },
  { key: 'home', label: 'Home fighter', short: 'Home', pos: 'Fighter from the host country', tip: 'Leans toward the fighter from the host country' },
]

// What a judge weighs more (or less) than the average judge, on the same rounds.
export const REWARDS = [
  { key: 'sig', label: 'Sig. strikes', group: 'striking' },
  { key: 'kd', label: 'Knockdowns', group: 'striking' },
  { key: 'ctrl', label: 'Control time', group: 'grappling' },
  { key: 'td', label: 'Takedowns', group: 'grappling' },
]

// Log-odds -> extra rounds out of 10 coin-flip rounds (slope of the logistic at 0.5).
export const per10 = (effect) => (effect == null ? null : effect * 2.5)
export const isReal = (effect, se) => effect != null && se != null && Math.abs(effect) > 2 * se

export function totalLean(pool, judge, key) {
  const p = pool?.leans?.[key]
  const j = judge?.leans?.[key]
  if (!j || j.effect == null) return null
  const effect = (p?.effect || 0) + j.effect
  const se = Math.sqrt((p?.se || 0) ** 2 + (j.se || 0) ** 2)
  return { effect, se, dev: j.effect, devSe: j.se, pct: j.pct, pool: p?.effect ?? 0 }
}

// The judge's most distinctive situational lean (vs the average judge), if any is
// clearly real.
export function topLean(judge) {
  let best = null
  for (const l of LEANS) {
    const e = judge?.leans?.[l.key]
    if (!e || !isReal(e.effect, e.se)) continue
    const z = Math.abs(e.effect) / e.se
    if (!best || z > best.z) best = { ...l, effect: e.effect, z }
  }
  return best
}

// A reward weight in words, relative to other judges.
export const rewardPhrase = (l) => (!l || !isReal(l.effect, l.se) ? 'About the same as most judges'
  : l.effect > 0 ? 'Counts it more than most judges' : 'Counts it less than most judges')

export const leanPhrase = (l) => `Leans to the ${l.label.toLowerCase()} ${l.effect > 0 ? 'more' : 'less'} than most judges`

// Sort state in the URL as ?sort=key or ?sort=-key (descending).
export function useUrlSort(params, setParams, fallback) {
  const raw = params.get('sort') || fallback
  const sort = { key: raw.replace(/^-/, ''), dir: raw.startsWith('-') ? 'desc' : 'asc' }
  const onSort = (k) => {
    const next = new URLSearchParams(params)
    // a new column starts descending (biggest first); a second click flips it
    const dir = sort.key === k ? (sort.dir === 'desc' ? 'asc' : 'desc') : 'desc'
    next.set('sort', dir === 'desc' ? `-${k}` : k)
    setParams(next, { replace: true })
  }
  return [sort, onSort]
}

export function sortRows(rows, sort, get) {
  const f = sort.dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = get(a, sort.key)
    const y = get(b, sort.key)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * f
  })
}

// Diverging fill for a signed value: viz-neg below zero, viz-1 above, a neutral gray
// at zero. `max` is where the scale saturates.
export function divColor(v, max) {
  if (v == null) return 'var(--color-muted-foreground)'
  const t = Math.round(Math.min(1, Math.abs(v) / max) * 100)
  return `color-mix(in oklab, var(${v >= 0 ? '--color-viz-1' : '--color-viz-neg'}) ${t}%, color-mix(in oklab, var(--color-muted-foreground) 55%, var(--color-border)))`
}

// judge_id -> profile from /ufc/judges, for tooltips on pages that only carry ids.
// Loaded once per session (the request is cached) and only when `enabled`.
export function useJudgeIndex(enabled = true) {
  const [index, setIndex] = useState(null)
  useEffect(() => {
    if (!enabled || index) return undefined
    let live = true
    fetchJudges()
      .then((d) => live && setIndex(new Map(d.judges.map((j) => [j.judge_id, j]))))
      .catch(() => {})
    return () => { live = false }
  }, [enabled, index])
  return index
}

// ---------------------------------------------------------------------------
// Referees
// ---------------------------------------------------------------------------
// How fights end, in display order, with the site's method colors.
export const METHODS = [
  { key: 'ko', label: 'KO/TKO', cls: 'bg-method-ko' },
  { key: 'sub', label: 'Sub', cls: 'bg-method-sub' },
  { key: 'decision', label: 'Decision', cls: 'bg-method-dec' },
  { key: 'doctor', label: 'Doctor', cls: 'bg-gold' },
  { key: 'dq', label: 'DQ', cls: 'bg-viz-neg' },
  { key: 'other', label: 'Other', cls: 'bg-muted-foreground/40' },
]

// Strikes before the stop vs a similar stoppage (time in round, round, weight class,
// era, knockdowns, pre-fight chin and power). The index is a log ratio: as a % and in words.
export const stoppagePct = (v) => (v == null ? null : (Math.exp(v) - 1) * 100)
export const stoppageFmt = (v) => {
  const p = stoppagePct(v)
  if (p == null) return '—'
  if (Math.abs(p) < 0.05) return '0%'
  return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`
}
// In words. The index is already shrunk toward zero for small samples, and referees
// differ by only a few % once the context is accounted for, so the cut is 2%.
export const stoppageWord = (v) => {
  const p = stoppagePct(v)
  return p == null ? '—' : p >= 2 ? 'Lets it go' : p <= -2 ? 'Stops early' : 'Average'
}

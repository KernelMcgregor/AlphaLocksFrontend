import { ChevronDown, Crown, Loader2, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '../components/ui/card'
import CountryFlag from '../components/CountryFlag'
import { ScrollArea } from '../components/ui/scroll-area'
import { fetchRankings } from '../lib/api'
import { cn, formatRecord } from '../lib/utils'

// ---------------------------------------------------------------------------
// Dimension model
// ---------------------------------------------------------------------------
const DIMS = ['pts', 'ko', 'kod', 'sub', 'subd', 'td', 'tdd', 'ctrl', 'ctrld', 'str_vol', 'str_acc', 'dist', 'gnd']

// The 8 axes shown on the radial graphs (a readable subset of the 13 dims).
const AXES = [
  { key: 'str_vol', label: 'Volume', group: 'striking' },
  { key: 'str_acc', label: 'Accuracy', group: 'striking' },
  { key: 'ko', label: 'KO Power', group: 'striking' },
  { key: 'kod', label: 'Chin', group: 'striking' },
  { key: 'td', label: 'Takedowns', group: 'grappling' },
  { key: 'tdd', label: 'TD Defense', group: 'grappling' },
  { key: 'ctrl', label: 'Control', group: 'grappling' },
  { key: 'sub', label: 'Submission', group: 'grappling' },
]

const STRIKING_DIMS = ['str_vol', 'str_acc', 'ko', 'kod', 'dist']
const GRAPPLING_DIMS = ['td', 'tdd', 'ctrl', 'ctrld', 'sub', 'subd', 'gnd']

const GRAPH_STYLES = [
  { key: 'radar', label: 'Radar' },
  { key: 'columns', label: 'Radial bars' },
  { key: 'rings', label: 'Rings' },
]

function ordinal(n) {
  const v = Math.round(n)
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return v + (s[(m - 20) % 10] || s[m] || s[0])
}

function initialsOf(fighter) {
  return ((fighter.first_name?.[0] || '') + (fighter.last_name?.[0] || '')).toUpperCase()
}

// Build a percentile lookup across every ranked fighter in a division.
function buildPercentile(fighters) {
  const cols = {}
  DIMS.forEach((d) => {
    cols[d] = fighters.map((f) => f.dimensions?.[d] ?? 0).sort((a, b) => a - b)
  })
  return (dim, val) => {
    const arr = cols[dim]
    if (!arr || arr.length < 2) return 50
    let c = 0
    for (const v of arr) if (v <= val) c++
    return Math.round((c / arr.length) * 100)
  }
}

function deriveProfile(fighter, pct) {
  const dims = fighter.dimensions || {}
  const axes = AXES.map((a) => ({ ...a, value: pct(a.key, dims[a.key] ?? 0) }))
  const sorted = [...axes].sort((a, b) => b.value - a.value)
  const avg = (keys) => Math.round(keys.reduce((s, k) => s + pct(k, dims[k] ?? 0), 0) / keys.length)
  const striking = avg(STRIKING_DIMS)
  const grappling = avg(GRAPPLING_DIMS)
  const overall = Math.round((striking + grappling) / 2)
  return {
    axes,
    strengths: sorted.slice(0, 3),
    weaknesses: sorted.slice(-3).reverse(),
    topSkills: sorted.slice(0, 2),
    groups: [
      { label: 'Striking', value: striking, cls: 'text-amber-500', stroke: 'stroke-amber-500', fill: 'fill-amber-500' },
      { label: 'Grappling', value: grappling, cls: 'text-indigo-500', stroke: 'stroke-indigo-500', fill: 'fill-indigo-500' },
      { label: 'Overall', value: overall, cls: 'text-blue-600', stroke: 'stroke-blue-600', fill: 'fill-blue-600' },
    ],
    overall,
  }
}

// ---------------------------------------------------------------------------
// Radial charts (dependency-free inline SVG)
// ---------------------------------------------------------------------------
function polar(cx, cy, r, i, n) {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function RadarChart({ axes }) {
  const cx = 120, cy = 120, R = 92, n = axes.length
  const rings = [0.25, 0.5, 0.75, 1]
  const [scale, setScale] = useState(0)

  useEffect(() => {
    let start = null
    let raf
    const duration = 600
    const ease = (t) => {
      // cubic-bezier overshoot approximation
      const c4 = (2 * Math.PI) / 4.5
      return t < 0.5
        ? 8 * t * t * t * t
        : 1 - Math.pow(-2 * t + 2, 4) / 2 + Math.sin(t * c4) * 0.08
    }
    const step = (ts) => {
      if (!start) start = ts
      const elapsed = ts - start
      const t = Math.min(elapsed / duration, 1)
      setScale(ease(t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const s = scale
  return (
    <svg viewBox="-30 -14 300 268" width={248} height={248} className="max-w-full">
      {rings.map((fr, gi) => (
        <polygon
          key={gi}
          points={axes.map((_, i) => polar(cx, cy, R * fr, i, n).join(',')).join(' ')}
          fill="none"
          className="stroke-border"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = polar(cx, cy, R, i, n)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" strokeWidth={1} />
      })}
      <polygon
        points={axes.map((a, i) => polar(cx, cy, (R * a.value * s) / 100, i, n).join(',')).join(' ')}
        className="fill-blue-500/20 stroke-blue-600"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {axes.map((a, i) => {
        const [x, y] = polar(cx, cy, (R * a.value * s) / 100, i, n)
        return (
          <circle
            key={i} cx={x} cy={y} r={2.6}
            className="fill-background stroke-blue-600"
            strokeWidth={1.6}
          />
        )
      })}
      {axes.map((a, i) => {
        const [x, y] = polar(cx, cy, R + 16, i, n)
        const dx = x - cx
        const anchor = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end'
        return (
          <text
            key={i} x={x} y={y + 3} fontSize={9} fontWeight={600} textAnchor={anchor}
            className="fill-muted-foreground"
            style={{ opacity: s, transition: `opacity 400ms ease ${200 + i * 30}ms` }}
          >
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}

function RadialBars({ axes, overall }) {
  const cx = 120, cy = 120, r0 = 40, Rmax = 104, n = axes.length
  return (
    <svg viewBox="0 0 240 240" width={240} height={240} className="max-w-full">
      {axes.map((_, i) => {
        const [x1, y1] = polar(cx, cy, r0, i, n)
        const [x2, y2] = polar(cx, cy, Rmax, i, n)
        return <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-muted" strokeWidth={9} strokeLinecap="round" />
      })}
      {axes.map((a, i) => {
        const [x1, y1] = polar(cx, cy, r0, i, n)
        const [x2, y2] = polar(cx, cy, r0 + ((Rmax - r0) * a.value) / 100, i, n)
        return (
          <line
            key={`b${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            className={a.group === 'striking' ? 'stroke-amber-500' : 'stroke-indigo-500'}
            strokeWidth={9}
            strokeLinecap="round"
          />
        )
      })}
      <circle cx={cx} cy={cy} r={31} className="fill-background stroke-border" strokeWidth={1} />
      <text x={cx} y={cy - 1} fontSize={20} fontWeight={800} textAnchor="middle" className="fill-foreground">{overall}</text>
      <text x={cx} y={cy + 13} fontSize={7.5} fontWeight={700} textAnchor="middle" letterSpacing="0.1em" className="fill-muted-foreground">OVR</text>
    </svg>
  )
}

function ActivityRings({ groups, overall }) {
  const cx = 120, cy = 120, sw = 16
  const radii = [94, 70, 46]
  return (
    <svg viewBox="0 0 240 240" width={240} height={240} className="max-w-full">
      {radii.map((r, idx) => {
        const g = groups[idx]
        const C = 2 * Math.PI * r
        return (
          <g key={idx}>
            <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted" strokeWidth={sw} />
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              className={g.stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${(C * g.value) / 100} ${C * 2}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </g>
        )
      })}
      <text x={cx} y={cy - 1} fontSize={27} fontWeight={800} textAnchor="middle" className="fill-foreground">{overall}</text>
      <text x={cx} y={cy + 15} fontSize={8} fontWeight={700} textAnchor="middle" letterSpacing="0.12em" className="fill-muted-foreground">OVERALL</text>
    </svg>
  )
}

const GRAPH_NOTE = {
  radar: 'Spider chart · 8 skill axes, radius = percentile',
  columns: 'Radial bars · length = percentile · amber striking, indigo grappling',
  rings: 'Concentric rings · Striking, Grappling, Overall',
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
function RankBadge({ rank }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-amber-500/15">
        <Crown className="h-4 w-4 text-amber-500" />
      </div>
    )
  }
  if (rank <= 5) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-blue-500/10">
        <span className="text-sm font-extrabold tabular-nums text-blue-600">{rank}</span>
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center">
      <span className="text-sm font-semibold tabular-nums text-muted-foreground">{rank}</span>
    </div>
  )
}

function FighterAvatar({ fighter, size = 'sm' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  if (fighter.image_url) {
    return (
      <div className={cn(dim, 'overflow-hidden rounded-full bg-muted ring-1 ring-border')}>
        <img src={fighter.image_url} alt="" className="h-full w-full scale-110 object-cover object-top" />
      </div>
    )
  }
  const tier =
    fighter.rank === 1 ? 'bg-amber-500/15 text-amber-600' :
    fighter.rank <= 5 ? 'bg-blue-500/10 text-blue-600' :
    'bg-muted text-muted-foreground'
  return (
    <div className={cn(dim, 'flex items-center justify-center rounded-full text-[13px] font-extrabold tracking-tight ring-1 ring-border', tier)}>
      {initialsOf(fighter)}
    </div>
  )
}

function PercentileBar({ label, value, tone }) {
  const fill = tone === 'good' ? 'bg-emerald-500' : 'bg-rose-500'
  const text = tone === 'good' ? 'text-emerald-600' : 'text-rose-600'
  return (
    <div className="flex items-center gap-3">
      <span className="w-[88px] shrink-0 text-xs font-medium text-foreground/80">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('w-11 shrink-0 text-right text-[13px] font-extrabold tabular-nums', text)}>{ordinal(value)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail panel (shown when a row is expanded)
// ---------------------------------------------------------------------------
function DetailPanel({ fighter, profile, division }) {
  const [graph, setGraph] = useState('radar')
  return (
    <div className="border-t bg-muted/30">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Skill Profile</span>
          <span className="text-xs text-muted-foreground">percentile vs {division} division</span>
        </div>
        <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
          {GRAPH_STYLES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGraph(g.key)}
              className={cn(
                'rounded-[7px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                graph === g.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="grid grid-cols-1 gap-5 px-5 pb-6 pt-3 lg:grid-cols-[230px_270px_1fr]">
        {/* identity + photo */}
        <div>
          <div className="relative flex h-[280px] items-end justify-center overflow-hidden rounded-2xl border bg-gradient-to-b from-blue-500/10 to-transparent">
            {fighter.image_url ? (
              <img
                src={fighter.image_url}
                alt={`${fighter.first_name} ${fighter.last_name}`}
                className="h-[270px] object-contain object-bottom"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-extrabold text-muted-foreground/40">
                {initialsOf(fighter)}
              </div>
            )}
          </div>
          <div className="mt-3.5">
            <div className="flex items-center gap-2">
              <CountryFlag countryCode={fighter.country_code} />
              <span className="text-xl font-extrabold leading-tight tracking-tight">
                {fighter.first_name} {fighter.last_name}
              </span>
            </div>
            {fighter.nickname && <div className="mt-0.5 text-sm text-muted-foreground">"{fighter.nickname}"</div>}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-bold tabular-nums text-foreground/80">
                {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
              </span>
              <span className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-bold text-foreground/80">
                Power Score {fighter.score.toFixed(0)}
              </span>
            </div>
            {fighter.rank === 1 && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                <Crown className="h-3 w-3" /> {division} Champion
              </div>
            )}
          </div>
        </div>

        {/* radial chart */}
        <div className="flex flex-col items-center rounded-2xl border bg-card p-4">
          <div className="flex min-h-[248px] w-full items-center justify-center">
            {graph === 'radar' && <RadarChart axes={profile.axes} />}
            {graph === 'columns' && <RadialBars axes={profile.axes} overall={profile.overall} />}
            {graph === 'rings' && <ActivityRings groups={profile.groups} overall={profile.overall} />}
          </div>
          <p className="mt-1 text-center text-[11px] leading-snug text-muted-foreground">{GRAPH_NOTE[graph]}</p>
          <div className="mt-3.5 flex w-full gap-2 border-t pt-3.5">
            {profile.groups.map((g) => (
              <div key={g.label} className="flex-1 text-center">
                <div className={cn('text-lg font-extrabold leading-none tabular-nums', g.cls)}>{g.value}</div>
                <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* strengths / weaknesses */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wide">Strengths</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {profile.strengths.map((s) => (
                <PercentileBar key={s.key} label={s.label} value={s.value} tone="good" />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2.5 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
              <span className="text-xs font-bold uppercase tracking-wide">Weaknesses</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {profile.weaknesses.map((s) => (
                <PercentileBar key={s.key} label={s.label} value={s.value} tone="bad" />
              ))}
            </div>
          </div>
          <p className="rounded-xl border bg-card px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Percentiles rank {fighter.last_name} against all ranked {division}s.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fighter row
// ---------------------------------------------------------------------------
const ROW_GRID = 'grid grid-cols-[36px_36px_1fr_auto_20px] md:grid-cols-[44px_44px_minmax(140px,1fr)_84px_140px_190px_24px] items-center gap-2 md:gap-3.5'

function FighterRow({ fighter, profile, division, expanded, onToggle, scorePct }) {
  return (
    <div className="border-b last:border-b-0">
      <div
        onClick={onToggle}
        className={cn(ROW_GRID, 'cursor-pointer px-3 py-2.5 transition-colors hover:bg-muted/40 md:px-4', expanded && 'bg-muted/40')}
      >
        <div className="flex justify-center"><RankBadge rank={fighter.rank} /></div>
        <FighterAvatar fighter={fighter} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CountryFlag countryCode={fighter.country_code} />
            <span className="truncate text-[14px] font-bold tracking-tight md:text-[15px]">
              {fighter.first_name} {fighter.last_name}
            </span>
          </div>
          {fighter.nickname && <div className="hidden truncate text-[11.5px] text-muted-foreground md:block">"{fighter.nickname}"</div>}
          {/* Mobile: show record + score inline under name */}
          <div className="flex items-center gap-2 mt-0.5 md:hidden">
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
            </span>
            <span className="text-[11px] font-extrabold tabular-nums">{fighter.score.toFixed(0)}</span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', fighter.rank === 1 ? 'bg-amber-500' : fighter.rank <= 5 ? 'bg-blue-600' : 'bg-muted-foreground/50')}
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>
        </div>
        {/* Mobile: top skill badge */}
        <div className="flex gap-1 md:hidden">
          {profile.topSkills.slice(0, 1).map((s) => (
            <span key={s.key} className="inline-flex items-center whitespace-nowrap rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-sky-700">
              {s.label}
            </span>
          ))}
        </div>
        {/* Desktop columns */}
        <span className="hidden text-[13px] font-semibold tabular-nums text-muted-foreground md:block">
          {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
        </span>
        <div className="hidden items-center gap-2.5 md:flex">
          <span className="w-10 text-sm font-extrabold tabular-nums">{fighter.score.toFixed(0)}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', fighter.rank === 1 ? 'bg-amber-500' : fighter.rank <= 5 ? 'bg-blue-600' : 'bg-muted-foreground/50')}
              style={{ width: `${scorePct}%` }}
            />
          </div>
        </div>
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {profile.topSkills.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-700 dark:text-sky-300">
              {s.label}<b className="tabular-nums">{ordinal(s.value)}</b>
            </span>
          ))}
        </div>
        <ChevronDown className={cn('h-4 w-4 justify-self-center text-muted-foreground/50 transition-transform', expanded && 'rotate-180')} />
      </div>
      {expanded && <DetailPanel fighter={fighter} profile={profile} division={division} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Division table
// ---------------------------------------------------------------------------
function DivisionTable({ fighters, label }) {
  const [expandedId, setExpandedId] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const { pct, scores } = useMemo(() => {
    const pct = buildPercentile(fighters)
    const vals = fighters.map((f) => f.score)
    const min = Math.min(...vals, 0)
    const max = Math.max(...vals, 1)
    const scores = {}
    fighters.forEach((f) => {
      scores[f.id] = Math.max(8, Math.round(((f.score - min) / Math.max(max - min, 1)) * 92) + 8)
    })
    return { pct, scores }
  }, [fighters])

  const visible = showAll ? fighters : fighters.slice(0, 15)

  return (
    <div>
      {visible.map((fighter) => (
        <FighterRow
          key={fighter.id}
          fighter={fighter}
          profile={deriveProfile(fighter, pct)}
          division={label}
          expanded={expandedId === fighter.id}
          onToggle={() => setExpandedId((id) => (id === fighter.id ? null : fighter.id))}
          scorePct={scores[fighter.id]}
        />
      ))}
      {fighters.length > 15 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {showAll ? 'Show Top 15' : `Show all ${fighters.length} fighters`}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RankingsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeWc, setActiveWc] = useState(null)
  const [wcOpen, setWcOpen] = useState(false)

  useEffect(() => {
    fetchRankings()
      .then((d) => {
        setData(d)
        if (d?.weight_classes?.length) setActiveWc(d.weight_classes[0].key)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <Card><CardContent className="p-6"><p className="text-destructive">Failed to load rankings: {error}</p></CardContent></Card>
    )
  }
  if (!data?.weight_classes?.length) {
    return (
      <Card><CardContent className="p-6"><p className="text-muted-foreground">No ranking data available. Run: python -m app.services.ranking_service</p></CardContent></Card>
    )
  }

  const activeDiv = data.weight_classes.find((wc) => wc.key === activeWc)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </span>
              Fighter Rankings
              <span className="text-sm font-medium text-muted-foreground">— click any fighter to expand</span>
            </h1>
          </div>
        </div>

        {(() => {
          const mens = data.weight_classes.filter((wc) => !wc.key.startsWith('w_') && wc.key !== 'p4p_women')
          const womens = data.weight_classes.filter((wc) => wc.key.startsWith('w_') || wc.key === 'p4p_women')
          const isPfp = (key) => key.startsWith('p4p')
          const activeLabel = activeDiv?.label || ''
          const WcButton = ({ wc }) => {
            const active = activeWc === wc.key
            const gold = isPfp(wc.key)
            return (
              <button
                key={wc.key}
                onClick={() => { setActiveWc(wc.key); setWcOpen(false) }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                  active && gold && 'border-amber-500 bg-amber-500 text-white shadow-sm',
                  active && !gold && 'border-blue-500 bg-blue-600 text-white shadow-sm',
                  !active && 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:text-foreground',
                )}
              >
                {wc.label}
                <span className={cn('ml-1', active ? (gold ? 'text-amber-200' : 'text-blue-200') : 'text-muted-foreground/60')}>
                  {wc.fighters.length}
                </span>
              </button>
            )
          }
          return (
            <>
              {/* Mobile: collapsible division picker */}
              <div className="md:hidden">
                <button
                  onClick={() => setWcOpen(!wcOpen)}
                  className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2"
                >
                  <span className="text-sm font-semibold">{activeLabel}</span>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', wcOpen && 'rotate-180')} />
                </button>
                {wcOpen && (
                  <div className="mt-2 space-y-2 rounded-lg border bg-card p-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Men</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {mens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Women</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {womens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: always visible */}
              <div className="hidden md:block space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10 shrink-0">Men</span>
                  <div className="flex flex-wrap gap-1.5">
                    {mens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10 shrink-0">Women</span>
                  <div className="flex flex-wrap gap-1.5">
                    {womens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>

      {/* Column header (fixed) */}
      <div className={cn(ROW_GRID, 'shrink-0 border-y bg-muted/40 px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:px-4')}>
        <span className="text-center">Rank</span>
        <span />
        <span>Fighter</span>
        <span className="md:hidden" />
        <span className="hidden md:block">Record</span>
        <span className="hidden md:block">Power score</span>
        <span className="hidden md:block">Top skills</span>
        <span />
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div>
          <Card className="overflow-hidden rounded-t-none border-t-0 p-0">
            <CardContent className="p-0">
              {activeDiv && (
                <DivisionTable fighters={activeDiv.fighters} label={activeDiv.label} />
              )}
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </div>
  )
}

// Explorer: one fighter, their comps, and why they match.
//
//   Constellation  — comps around the fighter; nearer the centre = more similar, grouped
//                    around the ring by family. Click a comp to compare.
//   Head to head   — the fighter and one comp: skill radar, the tendencies they share
//                    most, and where they differ most.
//   Style profile  — the fighter's own tendencies and skill ratings, as the profile
//                    page's amber/indigo bars.
//   Style DNA      — every trait as a cell, fighter and comps stacked, so shared traits
//                    line up as columns of the same colour.
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import RadarChart from '../viz/RadarChart'
import { Tip } from '../ui/tip'
import { cn } from '../../lib/utils'
import { ordinal } from '../../lib/fighterAnalytics'
import { useStyleDetail } from '../../hooks/useStyleDetail'
import {
  HABIT_TRAITS, SKILL_GROUPS, TENDENCY_GROUPS, TRAIT_GROUPS, divisionLabel, famColor, mostAlike, mostDifferent, radarAxes,
  traitLabel, traitTitle,
} from '../../lib/styleTraits'
import { BlendBar, FamilyAvatar, FighterPicker, Panel, SectionLabel, TraitBar } from './shared'

const N_CONSTELLATION = 12
const N_DNA = 6
// Comparisons and the does-most / does-least chips are about habits: what a fighter tries.
const TENDENCY_KEYS = HABIT_TRAITS

// ---------------------------------------------------------------------------
// Constellation
// ---------------------------------------------------------------------------
// Drawn 1:1 in the box it is given (measured), so it fills the panel at any shape and its
// 11px names stay 11px. Comps sit on an ellipse; distance from the centre is scaled to
// the shown comps' own similarity range: the closest near the middle, the farthest at the
// edge. (Comps' scores sit close together, ~0.8-0.95, so a fixed 0.5-1 scale bunched them
// in the middle of an empty circle.)
const INNER = 0.34          // closest comp's distance, as a share of the ellipse radius
const NODE_GAP = 54         // min px along the ring between neighbouring comps (36px photos + room)
const LABEL_CHAR = 6.6      // px per character of an 11.5px bold name
const N_RINGS = 3

function useBoxSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

function driversText(drivers) {
  return (drivers || []).map((d) => `${d.z >= 0 ? 'high' : 'low'} ${traitLabel(d.feature)}`).join(' · ')
}

// `tips` off: no hover card (the profile page, where a click opens the comparison).
export function Constellation({ fighter, comps, families, compareId, onCompare, tips = true }) {
  const [hover, setHover] = useState(null)
  const [ref, { w, h }] = useBoxSize()
  const sims = comps.map((c) => c.similarity)
  const hi = Math.max(...sims, 0)
  const lo = Math.min(...sims, hi - 0.01)
  // Neighbours sit 360/n degrees apart, so the innermost ring must be wide enough that two
  // comps on it never touch: the closest comp's distance rises with the comp count.
  const inner = Math.min(0.8, Math.max(INNER, (NODE_GAP * comps.length) / (2 * Math.PI * Math.max(50, h / 2 - 36))))
  const frac = (sim) => inner + (1 - inner) * (hi - sim) / ((hi - lo) || 1)
  // Same-family comps sit together around the ring; within a family, most similar first.
  const placed = useMemo(() => {
    const sorted = [...comps].sort((a, b) => (a.family - b.family) || (b.similarity - a.similarity))
    return sorted.map((c, i) => ({ ...c, a: (i / sorted.length) * Math.PI * 2 - Math.PI / 2 }))
  }, [comps])
  // Stretch the ellipse, and slide its centre, until the outermost names and photos meet the
  // box edges on every side, so the chart fills its panel instead of keeping fixed margins.
  const fit = useMemo(() => {
    const PAD = 6
    const items = placed.map((n) => {
      const f = inner + (1 - inner) * (hi - n.similarity) / ((hi - lo) || 1)
      const cos = Math.cos(n.a)
      const sin = Math.sin(n.a)
      const lw = n.name.length * LABEL_CHAR
      const vertical = Math.abs(cos) < 0.4
      // How far the photo and its name reach past the node centre on each side.
      const reach = vertical
        ? { l: Math.max(18, lw / 2), r: Math.max(18, lw / 2), t: sin < 0 ? 37 : 18, b: sin < 0 ? 18 : 37 }
        : { l: cos < 0 ? 23 + lw : 18, r: cos < 0 ? 18 : 23 + lw, t: 18, b: 18 }
      return { dx: f * cos, dy: f * sin, ...reach }
    })
    // Largest radius whose extents fit the span; returns [radius, offset of the centre].
    const solve = (span, d, lo2, hi2) => {
      const extent = (R) => {
        const min = Math.min(...items.map((it) => it[d] * R - it[lo2]))
        const max = Math.max(...items.map((it) => it[d] * R + it[hi2]))
        return [min, max]
      }
      let a = 0
      let b = span
      for (let k = 0; k < 30; k++) {
        const m = (a + b) / 2
        const [min, max] = extent(m)
        if (max - min <= span - 2 * PAD) a = m
        else b = m
      }
      const [min] = extent(a)
      return [a, PAD - min]
    }
    if (!items.length || !w || !h) return { RX: 60, RY: 50, cx: w / 2, cy: h / 2 }
    const [RX, cx] = solve(w, 'dx', 'l', 'r')
    const [RY, cy] = solve(h, 'dy', 't', 'b')
    return { RX: Math.max(60, RX), RY: Math.max(50, RY), cx, cy }
  }, [placed, inner, hi, lo, w, h])
  const { RX, RY } = fit
  const C = { x: fit.cx, y: fit.cy }
  const nodes = useMemo(() => placed.map((c) => {
    const f = inner + (1 - inner) * (hi - c.similarity) / ((hi - lo) || 1)
    return { ...c, cx: C.x + RX * f * Math.cos(c.a), cy: C.y + RY * f * Math.sin(c.a) }
  }), [placed, C.x, C.y, RX, RY, hi, lo, inner])
  const rings = Array.from({ length: N_RINGS }, (_, i) => hi - ((i + 1) / N_RINGS) * (hi - lo))
  const hovered = nodes.find((x) => x.id === hover)

  return (
    <div ref={ref} className="relative h-full min-h-[240px] w-full">
      {w > 0 && (
      <svg width={w} height={h} className="block" role="img" aria-label={`${fighter.name}'s closest stylistic comps`}>
        {rings.map((sv) => (
          <ellipse key={sv} cx={C.x} cy={C.y} rx={RX * frac(sv)} ry={RY * frac(sv)} fill="none" className="stroke-border" strokeDasharray="2 4" />
        ))}
        {nodes.map((n) => {
          const lit = hover === n.id || compareId === n.id
          return <line key={`l${n.id}`} x1={C.x} y1={C.y} x2={n.cx} y2={n.cy}
            className={lit ? 'stroke-foreground' : 'stroke-border'} strokeWidth={lit ? 1.8 : 1} />
        })}
        {nodes.map((n) => {
          // Near the top or bottom a side label would run into the neighbouring node's,
          // so those sit above or below their node instead.
          const cos = Math.cos(n.a)
          const vertical = Math.abs(cos) < 0.4
          const below = Math.sin(n.a) > 0
          const lx = vertical ? n.cx : n.cx + (cos >= 0 ? 23 : -23)
          const ly = vertical ? (below ? n.cy + 33 : n.cy - 25) : n.cy + 4
          const anchor = vertical ? 'middle' : cos >= 0 ? 'start' : 'end'
          const lit = hover === n.id || compareId === n.id
          return (
            <g key={n.id} className="cursor-pointer" onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              onClick={() => onCompare(n.id)}>
              <circle cx={n.cx} cy={n.cy} r={18} fill={famColor(n.family)} />
              <foreignObject x={n.cx - 16} y={n.cy - 16} width={32} height={32}>
                <FighterImage fighter={n} className="h-8 w-8 rounded-full bg-muted" />
              </foreignObject>
              {lit && <circle cx={n.cx} cy={n.cy} r={21.5} fill="none" className="stroke-foreground" strokeWidth={2} />}
              <text x={lx} y={ly} fontSize={11.5} fontWeight={lit ? 800 : 700} textAnchor={anchor} className="fill-foreground"
                paintOrder="stroke" stroke="var(--color-card)" strokeWidth={3}>
                {n.name}
              </text>
            </g>
          )
        })}
        <circle cx={C.x} cy={C.y} r={30} fill={famColor(fighter.family)} />
        <foreignObject x={C.x - 27} y={C.y - 27} width={54} height={54}>
          <FighterImage fighter={fighter} className="h-[54px] w-[54px] rounded-full bg-muted" />
        </foreignObject>
      </svg>
      )}
      {tips && hovered && (
        <div className="pointer-events-none absolute left-0 top-0 max-w-[260px] rounded-md bg-foreground px-2.5 py-1.5 text-[11.5px] leading-snug text-background shadow">
          <div className="font-bold">{hovered.name} · {hovered.similarity.toFixed(2)}</div>
          <div className="opacity-80">{families[hovered.family].name} · {divisionLabel(hovered.division)}</div>
          {hovered.top_drivers?.length > 0 && <div className="mt-0.5 opacity-80">Shared: {driversText(hovered.top_drivers)}</div>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------
// `colors`: the two sides' fills (CSS colours); the explorer's series colours by default.
export function MirrorRow({ t, colors = ['var(--color-viz-1)', 'var(--color-viz-2)'] }) {
  return (
    <div className="grid grid-cols-[34px_1fr_120px_1fr_34px] items-center gap-1.5">
      <span className="text-right text-[11px] font-extrabold tabular-nums">{ordinal(t.a)}</span>
      <div className="flex justify-end"><div className="h-[14px] rounded-l-[4px]" style={{ width: `${t.a}%`, background: colors[0] }} /></div>
      <span className="truncate text-center text-[11px] font-medium text-foreground/80">{traitTitle(t.k)}</span>
      <div><div className="h-[14px] rounded-r-[4px]" style={{ width: `${t.b}%`, background: colors[1] }} /></div>
      <span className="text-[11px] font-extrabold tabular-nums">{ordinal(t.b)}</span>
    </div>
  )
}

function SkillRadar({ fighter, other }) {
  return (
    <div className="h-full min-h-[210px]">
      <RadarChart fit series={[
        { key: 'a', label: fighter.name, color: 'var(--color-viz-1)', axes: radarAxes(fighter.profile) },
        { key: 'b', label: other.name, color: 'var(--color-viz-2)', axes: radarAxes(other.profile) },
      ]} />
    </div>
  )
}

// The two fighters face to face, each in their series colour, with the match between.
function Matchup({ fighter, other }) {
  const side = (f, color, right) => (
    <span className={cn('flex min-w-0 flex-1 items-center gap-2', right && 'flex-row-reverse text-right')}>
      <span className="shrink-0 rounded-full p-[2px]" style={{ background: color }}>
        <FighterImage fighter={f} className="h-9 w-9 rounded-full bg-muted" />
      </span>
      <span className="min-w-0 text-[13px] font-extrabold leading-tight">{f.name}</span>
    </span>
  )
  return (
    <div className="flex items-center gap-3 border-b pb-2.5">
      {side(fighter, 'var(--color-viz-1)')}
      <span className="shrink-0 text-center">
        <span className="block font-display text-[26px] font-extrabold italic leading-none tabular-nums">{Math.round(other.similarity * 100)}%</span>
        <span className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">match</span>
      </span>
      {side(other, 'var(--color-viz-2)', true)}
    </div>
  )
}

export function HeadToHead({ fighter, other }) {
  const alike = mostAlike(fighter.profile, other.profile)
  // A trait shared in direction can still be far apart in size; it belongs to one list only.
  const shared = new Set(alike.map((t) => t.k))
  const diff = mostDifferent(fighter.profile, other.profile, 8).filter((t) => !shared.has(t.k)).slice(0, 4)
  return (
    <div className="flex h-full flex-col gap-3">
      <Matchup fighter={fighter} other={other} />
      <div className="grid min-h-0 flex-1 items-center gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex h-full flex-col">
          <SectionLabel className="mb-1">Skills</SectionLabel>
          <div className="min-h-0 flex-1"><SkillRadar fighter={fighter} other={other} /></div>
        </div>
        <div className="space-y-3">
          {alike.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5 text-emerald-600">Habits in common</SectionLabel>
              <div className="space-y-1">{alike.map((t) => <MirrorRow key={t.k} t={t} />)}</div>
            </div>
          )}
          <div>
            <SectionLabel className="mb-1.5 text-rose-600">Biggest differences</SectionLabel>
            <div className="space-y-1">{diff.map((t) => <MirrorRow key={t.k} t={t} />)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Style profile (right column)
// ---------------------------------------------------------------------------
function Chips({ label, cls, items }) {
  return (
    <div>
      <div className={cn('mb-1 text-[9px] font-bold uppercase tracking-wide', cls)}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map(([k, v]) => (
          <span key={k} className="inline-flex items-baseline gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10.5px]">
            <span className="font-medium text-foreground/80">{traitTitle(k)}</span>
            <span className="font-extrabold tabular-nums">{ordinal(v)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Three short tabs rather than one long column, so the profile fits beside the rest
// without the page scrolling: what they try, how it goes, and the skill ratings.
const PROFILE_TABS = [
  ['tendencies', 'Habits', TENDENCY_GROUPS.filter((g) => g.key !== 'outcome')],
  ['results', 'Results', TENDENCY_GROUPS.filter((g) => g.key === 'outcome')],
  ['skills', 'Skills', SKILL_GROUPS],
]

export function StyleProfile({ fighter, className }) {
  const [view, setView] = useState('tendencies')
  const [, , groups] = PROFILE_TABS.find(([k]) => k === view)
  const tendencies = TENDENCY_KEYS.map((k) => [k, fighter.profile[k]]).filter(([, v]) => v != null)
  const high = [...tendencies].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const low = [...tendencies].sort((a, b) => a[1] - b[1]).slice(0, 3)

  return (
    <Panel title="Style profile" className={className}
      bodyClassName="overflow-y-auto"
      action={
        <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
          {PROFILE_TABS.map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              className={cn('rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
                view === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
      }>
      {view === 'tendencies' && (
        <div className="space-y-2 border-b pb-2.5">
          <Chips label="Does most" cls="text-emerald-600" items={high} />
          <Chips label="Does least" cls="text-rose-600" items={low} />
        </div>
      )}
      <div className="mt-2.5 space-y-3">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-1.5 border-b pb-1">
              <span className={cn('text-[11px] font-bold uppercase tracking-wide', g.cls)}>{g.label}</span>
            </div>
            <div className="space-y-1.5">
              {g.traits.filter((t) => fighter.profile[t] != null).map((t) => (
                <TraitBar key={t} trait={t} value={fighter.profile[t]} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Style DNA strip
// ---------------------------------------------------------------------------
// Diverging around the 50th percentile: red above, indigo below, neutral grey at the
// middle. Hue carries direction; the cell's tooltip carries the value.
function dnaColor(v) {
  const d = (v - 50) / 50
  const pct = Math.round(Math.min(1, Math.abs(d)) * 88)
  const pole = d >= 0 ? 'var(--color-viz-1)' : 'var(--color-viz-neg)'
  return `color-mix(in oklab, ${pole} ${pct}%, var(--color-muted))`
}

function DnaStrip({ rows, compareId, onCompare }) {
  return (
    <div className="h-full overflow-auto">
      <table className="border-separate border-spacing-0 text-[11.5px]">
        <thead>
          <tr>
            <th />
            {TRAIT_GROUPS.map((g) => (
              <th key={g.key} colSpan={g.traits.length}
                className="border-l-[6px] border-card px-1 pb-1 text-left text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.id}>
              <th className="sticky left-0 z-[1] bg-card pr-3 text-left">
                {ri === 0 ? (
                  <span className="whitespace-nowrap text-[12px] font-extrabold">{r.name}</span>
                ) : (
                  <button onClick={() => onCompare(r.id)}
                    className={cn('whitespace-nowrap text-left text-[12px] font-semibold hover:underline', compareId === r.id && 'text-primary')}>
                    {r.name}
                  </button>
                )}
              </th>
              {TRAIT_GROUPS.map((g) => g.traits.map((t, ti) => {
                const v = r.profile?.[t]
                return (
                  <td key={t} className={cn('p-[1.5px]', ti === 0 && 'border-l-[6px] border-card', ri === 1 && 'pt-[6px]')}>
                    <Tip className="block" content={`${r.name}: ${traitLabel(t)}, ${v == null ? 'n/a' : `${ordinal(v)} percentile`}`}>
                      <div className={cn('w-[19px] rounded-[3px]', ri === 0 ? 'h-7' : 'h-6')}
                        style={{ background: v == null ? 'var(--color-muted)' : dnaColor(v) }} />
                    </Tip>
                  </td>
                )
              }))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-[3px]" style={{ background: dnaColor(95) }} /> well above average</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-[3px]" style={{ background: dnaColor(50) }} /> average</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-[3px]" style={{ background: dnaColor(5) }} /> well below average</span>
        <span>Hover a cell for the trait and percentile.</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
function Hero({ fighter, families, allFighters, onSelect }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2">
      <FamilyAvatar fighter={fighter} size={42} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <CountryFlag countryCode={fighter.country_code} />
          <Link to={`/ufc/fighters/${fighter.id}`} className="inline-flex items-center gap-1 truncate text-[17px] font-extrabold leading-tight tracking-tight hover:underline">
            {fighter.name}
          </Link>
          <span className="rounded-md border px-1.5 py-px text-[11px] font-bold tabular-nums">{fighter.record}</span>
          <span className="rounded-md border border-primary/30 bg-primary/[0.06] px-1.5 py-px text-[11px] font-bold text-primary">{divisionLabel(fighter.division)}</span>
        </div>
        <BlendBar fighter={fighter} families={families} className="mt-1 w-[300px] max-w-full" />
      </div>
      <div className="flex gap-1.5">
        {[
          [ordinal(fighter.quality), 'Overall skill'],
          [`${Math.round(fighter.prime_year)}`, 'Prime'],
          [fighter.active ? 'Active' : `${fighter.first_year}–${String(fighter.last_year).slice(2)}`, `Since ${fighter.first_year}`],
        ].map(([v, l]) => (
          <div key={l} className="rounded-md border bg-muted/40 px-2 py-1">
            <div className="text-[13px] font-extrabold leading-none tabular-nums">{v}</div>
            <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <FighterPicker fighters={allFighters} onPick={onSelect} placeholder="Explore another fighter…" className="ml-auto w-[260px]" />
    </div>
  )
}

export default function ExplorerView({ data, byId, fighterId, onSelect }) {
  const { detail, error } = useStyleDetail(fighterId)
  const [compare, setCompare] = useState({ for: null, id: null })
  const [lower, setLower] = useState('h2h')
  // Keep the last fighter on screen while the next one loads, so the panels never
  // collapse to a spinner and back between clicks.
  const [shown, setShown] = useState(null)
  if (detail && detail !== shown) setShown(detail)
  const current = detail || shown
  const base = byId.get(fighterId)

  if (error) return <p className="text-sm text-destructive">Couldn't load this fighter's style: {error}</p>

  const fighter = current?.fighter
  const comps = current?.comps || []
  const compareId = compare.for === fighterId && comps.some((c) => c.id === compare.id) ? compare.id : comps[0]?.id
  const other = comps.find((c) => c.id === compareId)
  const pickCompare = (id) => setCompare({ for: fighterId, id })
  const stale = !detail

  return (
    // One screen on desktop: the hero, then two columns that share the remaining height.
    // Below lg it stacks and scrolls like any page.
    <div className="flex flex-col gap-3 lg:h-full lg:min-h-0">
      {base && <Hero fighter={base} families={data.families} allFighters={data.fighters} onSelect={(id) => onSelect(id)} />}

      {!fighter ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className={cn('grid gap-3 transition-opacity lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]', stale && 'opacity-60')}>
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
            <Panel title="Closest comps" className="lg:min-h-0 lg:flex-1" bodyClassName="min-h-0">
              {comps.length ? (
                <Constellation fighter={fighter} comps={comps.slice(0, N_CONSTELLATION)} families={data.families}
                  compareId={compareId} onCompare={pickCompare} />
              ) : <p className="py-10 text-center text-sm text-muted-foreground">No comps stored for this fighter yet.</p>}
            </Panel>
            <Panel title={lower === 'h2h' ? 'Head to head' : 'Style DNA'}
              className="lg:min-h-0 lg:flex-1" bodyClassName="min-h-0"
              action={
                <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
                  {[['h2h', 'Head to head'], ['dna', 'Style DNA']].map(([k, label]) => (
                    <button key={k} onClick={() => setLower(k)}
                      className={cn('rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
                        lower === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              }>
              {lower === 'dna'
                ? <DnaStrip rows={[fighter, ...comps.slice(0, N_DNA)]} compareId={compareId} onCompare={pickCompare} />
                : other ? <HeadToHead fighter={fighter} other={other} />
                  : <p className="text-sm text-muted-foreground">Pick a comp to compare.</p>}
            </Panel>
          </div>
          <StyleProfile fighter={fighter} className="lg:min-h-0" />
        </div>
      )}
    </div>
  )
}

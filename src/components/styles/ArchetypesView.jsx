// Archetypes: the four style families — how the roster splits, what defines each,
// who leads it, and what each division is made of. Four because that is where the data
// stops being clustered (style_page_service); finer detail is each fighter's blend.
import { useMemo, useState } from 'react'
import FighterMini from '../sports/FighterMini'
import { Tip } from '../ui/tip'
import { useDivisionRanks } from '../../hooks/useDivisionRanks'
import { cn } from '../../lib/utils'
import { DIVISION_ORDER, HABIT_TRAITS, divisionLabel, famColor, leanOf, traitTitle } from '../../lib/styleTraits'
import { FighterRow, Panel, SectionLabel, TraitBar } from './shared'

const N_TRAITS = 6
const N_LEADERS = 5

// The habits where a family sits furthest from the middle of the pack, in either
// direction: "rarely takes anyone down" defines a family as much as "takes everyone
// down". Habits only — families are clustered on what fighters try, so that is what
// tells them apart; skill and efficacy would describe how good the members are.
function definingTraits(profile) {
  return Object.entries(profile || {})
    .filter(([key]) => HABIT_TRAITS.includes(key))
    .sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))
    .slice(0, N_TRAITS)
}

function ScopeToggle({ scope, setScope }) {
  return (
    <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
      {[['active', 'Active now'], ['all', 'All-time']].map(([k, label]) => (
        <button key={k} onClick={() => setScope(k)}
          className={cn('rounded-[7px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
            scope === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {label}
        </button>
      ))}
    </div>
  )
}

function RosterBar({ families, pool }) {
  const counts = families.map((f) => pool.filter((x) => x.family === f.id).length)
  const total = counts.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-md">
        {families.map((f, i) => {
          const share = counts[i] / total
          return (
            <div key={f.id} className="flex h-full items-center justify-center text-[11px] font-bold tabular-nums text-white"
              style={{ width: `${share * 100}%`, background: famColor(f.id) }}>
              {share >= 0.04 ? `${Math.round(share * 100)}%` : ''}
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-4">
        {families.map((f, i) => (
          <div key={f.id} className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: famColor(f.id) }} />
            <span className="truncate font-semibold">{f.name}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">{counts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Where a family's members lean: the share of them with a second family at 25%+, and the
// most common one. Style is a continuum, so the edges between families are where hybrids live.
function leanSummary(family, families, pool) {
  const members = pool.filter((f) => f.family === family.id)
  const counts = new Map()
  for (const f of members) {
    const l = leanOf(f)
    if (l != null) counts.set(l, (counts.get(l) || 0) + 1)
  }
  const leaning = [...counts.values()].reduce((a, b) => a + b, 0)
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || []
  return { share: members.length ? leaning / members.length : 0, top: top != null ? families[top] : null,
    topShare: members.length && n ? n / members.length : 0 }
}

function FamilyCard({ family, leaders, onSelect, cells, overall, max, ranks, lean }) {
  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: famColor(family.id) }} />
        <h3 className="truncate text-[14px] font-extrabold tracking-tight">{family.name}</h3>
        <span className="ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums">
          {family.n_fighters}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{family.blurb}</p>
      {lean?.top && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{Math.round(lean.share * 100)}% lean another way</span>
          · most often
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: famColor(lean.top.id) }} />
          <span className="font-semibold text-foreground">{lean.top.name}</span>
          <span className="tabular-nums">({Math.round(lean.topShare * 100)}%)</span>
        </p>
      )}

      <SectionLabel className="mb-1.5 mt-2.5 text-blue-600">Signature habits · family average</SectionLabel>
      <div className="space-y-1.5">
        {definingTraits(family.profile).map(([key, v]) => <TraitBar key={key} trait={key} value={v} compact label={traitTitle(key)} />)}
      </div>

      <div className="mb-1 mt-2.5 flex items-baseline gap-2">
        <SectionLabel className="text-blue-600">Fighters by division</SectionLabel>
        <span className="ml-auto text-[10px] text-muted-foreground">solid = above its {Math.round(overall * 100)}% roster share</span>
      </div>
      {/* The chart takes whatever height the card has spare, so the grid can fill the
          page exactly on a tall screen without the other sections changing size. */}
      <DivisionColumns family={family} cells={cells} overall={overall} max={max} ranks={ranks} />

      <SectionLabel className="mb-0.5 mt-2.5">Leading active fighters</SectionLabel>
      <div className="-mx-1">
        {leaders.map((f) => (
          <FighterRow key={f.id} fighter={f} dense onClick={() => onSelect(f.id, 'explorer')}
            right={<span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground">{f.record}</span>} />
        ))}
      </div>
    </section>
  )
}

// Short division codes for the per-family column chart.
const DIV_SHORT = {
  flyweight: 'FLY', bantamweight: 'BW', featherweight: 'FW', lightweight: 'LW', welterweight: 'WW',
  middleweight: 'MW', light_heavyweight: 'LHW', heavyweight: 'HW',
  w_strawweight: 'W·SW', w_flyweight: 'W·FLY', w_bantamweight: 'W·BW', w_featherweight: 'W·FW',
}

const N_BAR_TOP = 3

// Per family and division: the count, the division's total, the share, and the top
// fighters (by overall quality) for the bar's hover card.
function divisionMix(families, pool) {
  const cell = new Map() // `${fam}|${div}` -> fighters
  const divTotals = new Map()
  for (const f of pool) {
    const key = `${f.family}|${f.division}`
    if (!cell.has(key)) cell.set(key, [])
    cell.get(key).push(f)
    divTotals.set(f.division, (divTotals.get(f.division) || 0) + 1)
  }
  const divisions = DIVISION_ORDER.filter((d) => divTotals.has(d))
  const rows = families.map((fam) => divisions.map((d) => {
    const members = cell.get(`${fam.id}|${d}`) || []
    const n = divTotals.get(d)
    return {
      division: d, count: members.length, n, share: n ? members.length / n : 0,
      top: [...members].sort((a, b) => b.quality - a.quality).slice(0, N_BAR_TOP),
    }
  }))
  const overall = families.map((fam) => pool.filter((f) => f.family === fam.id).length / (pool.length || 1))
  const max = Math.max(1, ...rows.flat().map((c) => c.count))
  return { rows, overall, max }
}

// Hover card for one bar: the family's top fighters in that division, as the site's
// fighter cards.
function BarCard({ family, cell, ranks }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {divisionLabel(cell.division)} · {family.name} · {cell.count} of {cell.n}
      </div>
      {cell.top.length
        ? cell.top.map((f) => <FighterMini key={f.id} f={{ ...f, ...(ranks[f.id] || {}) }} />)
        : <div className="text-[11px] text-muted-foreground">No fighters</div>}
    </div>
  )
}

// One family's fighter count in every division, as columns on a scale shared by all
// four cards. Columns where the family's share of the division beats its share of the
// whole roster are solid, the rest faded, so over-represented divisions stand out.
function DivisionColumns({ family, cells, overall, max, ranks }) {
  return (
    <div className="flex min-h-[72px] flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-[3px]">
        {cells.map((c) => (
          <Tip key={c.division} className="flex h-full flex-1 flex-col items-center justify-end"
            content={<BarCard family={family} cell={c} ranks={ranks} />}>
            <span className="mb-0.5 text-[9px] font-bold leading-none tabular-nums text-foreground/80">{c.count}</span>
            <div className="w-full min-h-[2px] rounded-t-[3px]"
              style={{ height: `${(c.count / max) * 85}%`, background: famColor(family.id), opacity: c.share >= overall ? 1 : 0.4 }} />
          </Tip>
        ))}
      </div>
      <div className="mt-1 flex shrink-0 gap-[3px]">
        {cells.map((c) => (
          <span key={c.division} className="flex-1 truncate text-center text-[8.5px] font-bold text-muted-foreground">{DIV_SHORT[c.division] || c.division}</span>
        ))}
      </div>
    </div>
  )
}

export default function ArchetypesView({ data, onSelect }) {
  const [scope, setScope] = useState('active')
  const pool = useMemo(() => (scope === 'active' ? data.fighters.filter((f) => f.active) : data.fighters), [data, scope])
  const mix = useMemo(() => divisionMix(data.families, pool), [data, pool])
  const ranks = useDivisionRanks()
  const leans = useMemo(() => data.families.map((fam) => leanSummary(fam, data.families, pool)), [data, pool])
  const leaders = useMemo(() => {
    const out = data.families.map(() => [])
    for (const f of [...data.fighters].filter((x) => x.active).sort((a, b) => b.quality - a.quality)) {
      if (out[f.family].length < N_LEADERS) out[f.family].push(f)
    }
    return out
  }, [data])

  return (
    // At least the page body's height, with the card grid taking what the roster bar
    // leaves: on a tall screen the cards end level with the sidebar; on a short one the
    // page scrolls rather than squashing them.
    <div className="flex min-h-full flex-col gap-3">
      <Panel className="shrink-0" title="Roster by style" note={`${pool.length.toLocaleString()} ${scope === 'active' ? 'active' : 'all-time'} fighters`}
        action={<ScopeToggle scope={scope} setScope={setScope} />}>
        <RosterBar families={data.families} pool={pool} />
      </Panel>

      {/* Four families: the most the data supports (style_page_service). Everything finer
          is a fighter's blend, summarised per card as where its members lean. */}
      <div className="grid flex-1 gap-3 md:grid-cols-2">
        {data.families.map((fam) => (
          <FamilyCard key={fam.id} family={fam} leaders={leaders[fam.id]} onSelect={onSelect}
            cells={mix.rows[fam.id]} overall={mix.overall[fam.id]} max={mix.max} ranks={ranks} lean={leans[fam.id]} />
        ))}
      </div>
    </div>
  )
}

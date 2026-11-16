// A fighter's style on their profile page, from /ufc/styles/fighters/{id}: how they fight
// (family, blend, their habits in words, strengths and weaknesses) beside the comps
// constellation (click one for a head-to-head), then the lineage tree (who they descend
// from, who descends from them).
import { GitBranch, Orbit, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useElementWidth } from '../../hooks/useElementWidth'
import { ancestorsOf, buildTree } from '../../lib/lineage'
import { blendOf, famColor, familyName, HABIT_TRAITS } from '../../lib/styleTraits'
import { strengthsWeaknesses, styleSummary } from '../../lib/styleWriteup'
import { cn } from '../../lib/utils'
import { Constellation, HeadToHead } from './ExplorerView'
import { SimBar } from './LineageView'
import { BlendBar, FamilyAvatar, FighterRow, HabitChips, Panel, SectionLabel } from './shared'

const N_COMPS = 10

function PageLink({ to, icon: Icon, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold hover:bg-muted">
      <Icon className="h-3.5 w-3.5" />{children}
    </Link>
  )
}

function Traits({ label, cls, dot, items }) {
  if (!items.length) return null
  return (
    <div>
      <SectionLabel className={cn('mb-1', cls)}>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {items.map(([t]) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-semibold">
            <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />{t}
          </span>
        ))}
      </div>
    </div>
  )
}

// The fighter's family and blend, their own style in words, where their fights go well or
// badly for them (lib/styleWriteup), and the habits behind it as percentiles.
function Family({ fighter, families, className }) {
  const fam = families[blendOf(fighter)[0].family]
  if (!fam) return null
  const last = fighter.name.split(' ').slice(-1)[0]
  const summary = styleSummary(last, fighter.profile)
  const { strengths, weaknesses } = strengthsWeaknesses(fighter.profile)
  const habits = HABIT_TRAITS.map((k) => [k, fighter.profile?.[k]]).filter(([, v]) => v != null)
  const high = [...habits].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const low = [...habits].sort((a, b) => a[1] - b[1]).slice(0, 3)
  return (
    <Panel title={`How ${last} fights`} className={className}
      action={<PageLink to={`/ufc/fighters/styles?tab=map&fighter=${fighter.id}`} icon={Orbit}>Style map</PageLink>}>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: famColor(fam.id) }} />
        <span className="font-display text-[24px] font-extrabold italic uppercase leading-none tracking-tight">{familyName(fam.name)}</span>
      </div>
      <BlendBar fighter={fighter} families={families} singular className="mt-3" />
      {summary && <p className="mt-3 text-[13.5px] leading-relaxed text-foreground/85">{summary}</p>}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
          <Traits label="Strengths" cls="text-emerald-600" dot="bg-emerald-500" items={strengths} />
          <Traits label="Weaknesses" cls="text-rose-600" dot="bg-rose-500" items={weaknesses} />
        </div>
      )}
      {habits.length > 0 && (
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
          <HabitChips label="Does most" cls="text-foreground/70" items={high} />
          <HabitChips label="Does least" cls="text-foreground/70" items={low} />
        </div>
      )}
    </Panel>
  )
}

function FightsLike({ fighter, comps, families, className }) {
  const [compareId, setCompareId] = useState(null)
  const other = comps.find((c) => c.id === compareId)
  return (
    <Panel
      title={other ? 'Head to head' : 'Similar fighters'}
      className={className}
      action={other && (
        <span className="flex items-center gap-1">
          <Link to={`/ufc/fighters/${other.id}`} className="rounded-md border px-2 py-0.5 text-[11px] font-semibold hover:bg-muted">Profile</Link>
          <button onClick={() => setCompareId(null)} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    >
      {other
        ? <HeadToHead fighter={fighter} other={other} />
        : <Constellation fighter={fighter} comps={comps.slice(0, N_COMPS)} families={families} compareId={compareId} tips={false}
            onCompare={(id) => setCompareId((cur) => (cur === id ? null : id))} />}
    </Panel>
  )
}

function Toggle({ legends, setLegends }) {
  return (
    <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
      {[[true, 'Legends only'], [false, 'Anyone']].map(([k, label]) => (
        <button key={label} onClick={() => setLegends(k)}
          className={cn('rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
            legends === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {label}
        </button>
      ))}
    </div>
  )
}

function RowList({ title, rows, families, onOpen }) {
  return (
    <div>
      <SectionLabel className="mb-1 px-1">{title}</SectionLabel>
      {rows.length ? (
        <div className="-mx-1 space-y-0.5">
          {rows.map(({ f, sim }) => (
            <FighterRow key={f.id} fighter={f} families={families} dense onClick={() => onOpen(f.id)} right={<SimBar sim={sim} />} />
          ))}
        </div>
      ) : <p className="px-1 text-[12px] text-muted-foreground">None</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lineage tree: columns left to right — their influences, who they descend from, the
// fighter, their heirs — as cards joined by lines, thicker for a closer match. Cards sit
// on a fixed row grid, so nothing can overlap however crowded a column gets.
// ---------------------------------------------------------------------------
const ROW = 50
const CARD_H = 42
const COL_PAD = 14
const CARD_MAX = 240
//: Cards per column: the closest influences and heirs; the full tree is on the Styles page.
const MAX_PER_COL = 4
const MIN_SIM = 0.3

function TreeCard({ f, sim, root, style, onOpen }) {
  return (
    <button onClick={root ? undefined : () => onOpen(f.id)} style={style}
      className={cn('absolute flex items-center gap-2 rounded-lg border bg-card px-2 text-left transition-colors',
        root ? 'cursor-default border-2 border-foreground' : 'hover:bg-muted')}>
      <FamilyAvatar fighter={f} size={root ? 32 : 28} />
      <span className="min-w-0 flex-1">
        <span className={cn('line-clamp-2 leading-tight', root ? 'font-display text-[16px] font-extrabold italic uppercase' : 'text-[12px] font-bold')}>{f.name}</span>
        {sim != null && <span className="block text-[10.5px] tabular-nums text-muted-foreground">match {sim.toFixed(2)}</span>}
      </span>
    </button>
  )
}

function LineageTree({ fighter, tree, heirs, onOpen }) {
  const [ref, width] = useElementWidth()
  // Weak links (a stored ancestor can match at 0.2, or below zero) are left off.
  const closest = (items) => items.filter((n) => n.sim >= MIN_SIM).sort((a, b) => b.sim - a.sim).slice(0, MAX_PER_COL)
  const cols = [
    { key: 'g2', label: 'Their influences', items: closest(tree.nodes.filter((n) => n.gen === 2)) },
    { key: 'g1', label: 'Descends from', items: closest(tree.nodes.filter((n) => n.gen === 1)) },
    { key: 'root', label: '', items: [{ f: fighter, sim: null, root: true }] },
    { key: 'heirs', label: 'Heirs', items: closest(heirs) },
  ].filter((c) => c.items.length)
  const rows = Math.max(...cols.map((c) => c.items.length))
  const H = rows * ROW
  const colW = width / cols.length

  // Card boxes by column, keyed by fighter id within the column.
  const boxes = cols.map((c, ci) => {
    const top = (H - c.items.length * ROW) / 2 + (ROW - CARD_H) / 2
    const w = Math.min(CARD_MAX, colW - 2 * COL_PAD)
    const x0 = ci * colW + (colW - w) / 2
    return new Map(c.items.map((it, i) => [it.f.id, {
      x0, x1: x0 + w, y: top + i * ROW + CARD_H / 2, top: top + i * ROW,
    }]))
  })
  const colIndex = Object.fromEntries(cols.map((c, i) => [c.key, i]))
  const links = []
  const link = (fromCol, fromId, toCol, toId, sim) => {
    const a = boxes[colIndex[fromCol]]?.get(fromId)
    const b = boxes[colIndex[toCol]]?.get(toId)
    if (a && b) links.push({ key: `${fromCol}${fromId}-${toId}`, a, b, sim })
  }
  for (const e of tree.edges) {
    if (e.to === fighter.id) link('g1', e.from, 'root', e.to, e.sim)
    else link('g2', e.from, 'g1', e.to, e.sim)
  }
  for (const h of heirs) link('root', fighter.id, 'heirs', h.f.id, h.sim)

  return (
    <div ref={ref} className="w-full">
      {width > 0 && <>
        <div className="mb-1.5 grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((c) => <SectionLabel key={c.key} className="text-center">{c.label}</SectionLabel>)}
        </div>
        <div className="relative" style={{ height: H }}>
          <svg width={width} height={H} className="absolute inset-0" aria-hidden>
            {links.map(({ key, a, b, sim }) => {
              const mx = (a.x1 + b.x0) / 2
              return <path key={key} d={`M${a.x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x0},${b.y}`} fill="none"
                className="stroke-slate-300" strokeWidth={1 + 4 * Math.max(0, (sim - 0.35) / 0.5)} strokeLinecap="round" />
            })}
          </svg>
          {cols.map((c, ci) => c.items.map((it) => {
            const box = boxes[ci].get(it.f.id)
            return <TreeCard key={`${c.key}${it.f.id}`} f={it.f} sim={it.sim} root={it.root} onOpen={onOpen}
              style={{ left: box.x0, top: box.top, width: box.x1 - box.x0, height: CARD_H }} />
          }))}
        </div>
      </>}
    </div>
  )
}

// `timeline` off (phones): the ancestors and heirs as two lists instead of the tree.
function Lineage({ detail, onOpen, timeline = true }) {
  const [legends, setLegends] = useState(true)
  const { fighter, families, lineage } = detail
  const byId = useMemo(
    () => new Map([[fighter.id, fighter], ...(lineage?.nodes || []).map((n) => [n.id, n])]),
    [fighter, lineage],
  )
  const tree = useMemo(() => buildTree(fighter, byId, legends), [fighter, byId, legends])
  if (!lineage) return null
  const resolve = (list) => list.map((a) => ({ f: byId.get(a.id), sim: a.sim })).filter((x) => x.f)
  const direct = resolve(ancestorsOf(fighter, legends))
  // Only a notable fighter can be a legend-only ancestor; for anyone else fall back to
  // the heirs drawn from everyone.
  const heirs = resolve(legends && lineage.notable_heirs.length ? lineage.notable_heirs : lineage.heirs).slice(0, MAX_PER_COL)
  const empty = !direct.length && !heirs.length

  return (
    <Panel title="Lineage" action={
      <span className="flex items-center gap-2">
        <Toggle legends={legends} setLegends={setLegends} />
        <PageLink to={`/ufc/fighters/styles?tab=tree&fighter=${fighter.id}`} icon={GitBranch}>Style tree</PageLink>
      </span>
    }>
      {empty ? (
        <p className="py-6 text-center text-[12.5px] text-muted-foreground">No {legends ? 'legend' : 'fighter'} debuted 4+ years earlier with a close match.</p>
      ) : timeline ? (
        <LineageTree fighter={fighter} tree={tree} heirs={heirs} onOpen={onOpen} />
      ) : (
        <div className="space-y-3">
          <RowList title="Descends from" rows={direct} families={families} onOpen={onOpen} />
          <RowList title="Heirs" rows={heirs} families={families} onOpen={onOpen} />
        </div>
      )}
    </Panel>
  )
}

// Desktop: how they fight beside the constellation, the lineage tree under both.
export function StyleSection({ detail, onOpen }) {
  const { fighter, comps, families } = detail
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <Family fighter={fighter} families={families} />
        {comps.length > 0 && <FightsLike fighter={fighter} comps={comps} families={families} className="min-h-[320px]" />}
      </div>
      <Lineage detail={detail} onOpen={onOpen} />
    </div>
  )
}

// Phones: how they fight, then the lineage as lists.
export function StyleStack({ detail, onOpen }) {
  return (
    <div className="flex flex-col gap-3">
      <Family fighter={detail.fighter} families={detail.families} />
      <Lineage detail={detail} onOpen={onOpen} timeline={false} />
    </div>
  )
}

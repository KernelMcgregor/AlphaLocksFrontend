// Lineage: who a fighter's style descends from.
//
// Ancestors are the closest fighters whose prime came at least six years earlier, matched
// in the era-adjusted space so a 2008 strike rate is compared fairly with a 2024 one.
// "Prime" is the midpoint of a fighter's UFC career. Two generations are drawn: the
// fighter's ancestors, and theirs.
//
// "Legends only" restricts ancestors to the top quarter of fighters by overall quality,
// which is what most readers mean by "the next X". Off, it shows the closest match from
// anyone, which is more faithful and usually less famous.
//
// The timeline is drawn at 1:1 pixel scale (viewBox = measured width), so labels stay
// 11-12px on any screen instead of scaling with the container.
import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { divisionLabel, famColor } from '../../lib/styleTraits'
import { useElementWidth } from '../../hooks/useElementWidth'
import { FamilyAvatar, FamilyChip, FighterList, FighterRow, Panel, SectionLabel } from './shared'

const LEFT = 176 // lane labels
const RIGHT = 20
const TOP = 46
const LANE_H = 84
const SLOT = 24 // vertical step between crowded nodes in one lane
const GAP_YEARS = 6
const N_LEGENDS = 10

const ancestorsOf = (f, legends) => (legends ? f.notable_ancestors : f.ancestors) || []

// Two generations back from `root`. A legend reached twice is drawn once, with both lines.
function buildTree(root, byId, legends) {
  const nodes = new Map([[root.id, { f: root, gen: 0, sim: 1 }]])
  const edges = []
  let frontier = [root]
  for (let gen = 1; gen <= 2; gen++) {
    const next = []
    for (const child of frontier) {
      for (const a of ancestorsOf(child, legends)) {
        const f = byId.get(a.id)
        if (!f) continue
        edges.push({ from: a.id, to: child.id, sim: a.sim })
        if (!nodes.has(a.id)) { nodes.set(a.id, { f, gen, sim: a.sim }); next.push(f) }
      }
    }
    frontier = next
  }
  return { nodes: [...nodes.values()], edges }
}

// Greedy label placement: each node takes the first slot in its lane (centre, above,
// below) where its dot and name do not collide with anything placed before it. Root
// first, then ancestors by generation, so the important names claim the clean spots.
function layout(tree, families, width) {
  const lanes = families.filter((f) => tree.nodes.some((n) => n.f.family === f.id))
  const laneOf = new Map(lanes.map((f, i) => [f.id, i]))
  const primes = tree.nodes.map((n) => n.f.prime_year)
  const y0 = Math.floor((Math.min(...primes) - 3) / 5) * 5
  const y1 = Math.max(2027, Math.ceil(Math.max(...primes)) + 1)
  const xOf = (y) => LEFT + ((y - y0) / (y1 - y0)) * (width - LEFT - RIGHT)
  const boxes = []
  const pos = new Map()
  const order = [...tree.nodes].sort((a, b) => a.gen - b.gen || b.sim - a.sim)
  for (const n of order) {
    const x = xOf(n.f.prime_year)
    const laneMid = TOP + laneOf.get(n.f.family) * LANE_H + LANE_H / 2
    const lw = n.f.name.length * (n.gen === 0 ? 7.6 : 6.6) + 6
    const leftSide = x + 14 + lw > width - RIGHT
    let best = null
    for (const dy of [0, -SLOT, SLOT]) {
      const y = laneMid + dy
      const box = leftSide ? { x0: x - 14 - lw, x1: x + 10, y0: y - 10, y1: y + 10 } : { x0: x - 10, x1: x + 14 + lw, y0: y - 10, y1: y + 10 }
      const hits = boxes.filter((b) => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1)).length
      if (!best || hits < best.hits) best = { y, box, hits }
      if (hits === 0) break
    }
    boxes.push(best.box)
    pos.set(n.f.id, { x, y: best.y, leftSide })
  }
  return { lanes, pos, xOf, y0, y1, height: TOP + lanes.length * LANE_H + 10 }
}

function Timeline({ tree, families, root, focusId, onFocus }) {
  const [ref, width] = useElementWidth()
  const [hover, setHover] = useState(null)
  const L = useMemo(() => (width ? layout(tree, families, width) : null), [tree, families, width])
  const nodeById = useMemo(() => new Map(tree.nodes.map((n) => [n.f.id, n])), [tree])
  const lit = hover || focusId

  return (
    <div ref={ref} className="relative w-full">
      {L && (
        <svg width={width} height={L.height} viewBox={`0 0 ${width} ${L.height}`} role="img" aria-label={`${root.name}'s style lineage`}>
          {/* Too recent to be an ancestor: the six years before the fighter's prime. */}
          <rect x={L.xOf(root.prime_year - GAP_YEARS)} y={TOP - 8} width={width - RIGHT - L.xOf(root.prime_year - GAP_YEARS)}
            height={L.height - TOP + 2} className="fill-muted/60" />
          <text x={L.xOf(root.prime_year - GAP_YEARS) + 6} y={TOP + 4} fontSize={10} fontWeight={600} className="fill-muted-foreground">
            too recent to be an ancestor
          </text>

          {L.lanes.map((f, i) => (
            <g key={f.id}>
              <line x1={LEFT} x2={width - RIGHT} y1={TOP + (i + 1) * LANE_H} y2={TOP + (i + 1) * LANE_H} className="stroke-border" />
              <circle cx={10} cy={TOP + i * LANE_H + LANE_H / 2} r={5} fill={famColor(f.id)} />
              <text x={22} y={TOP + i * LANE_H + LANE_H / 2 + 4} fontSize={12} fontWeight={700} className="fill-foreground">{f.name}</text>
            </g>
          ))}
          {Array.from({ length: Math.floor((L.y1 - L.y0) / 5) + 1 }, (_, i) => L.y0 + i * 5).filter((y) => y <= L.y1).map((y) => (
            <g key={y}>
              <line x1={L.xOf(y)} x2={L.xOf(y)} y1={TOP - 8} y2={L.height - 8} className="stroke-border" strokeDasharray="2 4" />
              <text x={L.xOf(y)} y={TOP - 16} fontSize={11} fontWeight={600} textAnchor="middle" className="fill-muted-foreground">{y}</text>
            </g>
          ))}

          {tree.edges.map((e) => {
            const a = L.pos.get(e.from)
            const b = L.pos.get(e.to)
            if (!a || !b) return null
            const mx = (a.x + b.x) / 2
            const on = lit && (e.from === lit || e.to === lit)
            return (
              <path key={`${e.from}-${e.to}`} d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`} fill="none"
                className={on ? 'stroke-blue-600' : 'stroke-slate-300'}
                strokeWidth={1 + 4 * Math.max(0, (e.sim - 0.35) / 0.5)} strokeLinecap="round" />
            )
          })}

          {tree.nodes.map(({ f, gen }) => {
            const p = L.pos.get(f.id)
            const isRoot = f.id === root.id
            const on = f.id === lit
            const r = isRoot ? 10 : gen === 1 ? 7.5 : 5.5
            return (
              <g key={f.id} className="cursor-pointer" onClick={() => onFocus(f.id)}
                onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)}>
                <circle cx={p.x} cy={p.y} r={r + 8} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={r} fill={famColor(f.family)} stroke={isRoot || on ? 'var(--color-foreground)' : 'var(--color-card)'}
                  strokeWidth={isRoot || on ? 2.5 : 2} />
                <text x={p.leftSide ? p.x - r - 6 : p.x + r + 6} y={p.y + 4} fontSize={isRoot ? 13 : 11.5}
                  fontWeight={isRoot || on ? 800 : gen === 1 ? 700 : 600} textAnchor={p.leftSide ? 'end' : 'start'}
                  className={gen === 2 && !on ? 'fill-foreground/70' : 'fill-foreground'}
                  paintOrder="stroke" stroke="var(--color-card)" strokeWidth={3.5}>
                  {f.name}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {hover && L && (() => {
        const n = nodeById.get(hover)
        const p = L.pos.get(hover)
        return (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md bg-foreground px-2.5 py-1.5 text-[11.5px] leading-snug text-background shadow"
            style={{ left: p.x, top: p.y }}>
            <div className="font-bold">{n.f.name}</div>
            <div className="opacity-80">{families[n.f.family].name} · {divisionLabel(n.f.division)}</div>
            <div className="opacity-80">UFC {n.f.first_year}–{n.f.active ? 'now' : n.f.last_year}{n.gen > 0 ? ` · match ${n.sim.toFixed(2)}` : ''}</div>
          </div>
        )
      })()}
    </div>
  )
}

function ReadingKey() {
  return (
    <div className="mb-2 grid gap-x-5 gap-y-1.5 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground sm:grid-cols-2 2xl:grid-cols-4">
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-500" />Each dot is a fighter, placed at the middle of their UFC career</span>
      <span className="flex items-center gap-2"><span className="h-[3px] w-5 shrink-0 rounded-full bg-slate-400" />A line joins a fighter to a style match from 6+ years earlier. Thicker = closer</span>
      <span className="flex items-center gap-2"><span className="h-3 w-5 shrink-0 rounded-sm bg-muted" />Shaded years are too recent to count as an ancestor</span>
      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-foreground" />Rows are style families. Click a dot to see who else descends from them</span>
    </div>
  )
}

function SimBar({ sim }) {
  return (
    <span className="flex w-[74px] shrink-0 items-center gap-1.5">
      <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-viz-1" style={{ width: `${Math.max(4, sim * 100)}%` }} />
      </span>
      <span className="w-7 text-right text-[10.5px] font-bold tabular-nums">{sim.toFixed(2)}</span>
    </span>
  )
}

export default function LineageView({ data, byId, fighterId, onSelect }) {
  const [legends, setLegends] = useState(true)
  const [focus, setFocus] = useState({ root: null, id: null })
  const root = byId.get(fighterId)
  const focusId = focus.root === fighterId ? focus.id : null

  const tree = useMemo(() => (root ? buildTree(root, byId, legends) : { nodes: [], edges: [] }), [root, byId, legends])

  // For each fighter, the active fighters whose CLOSEST predecessor they are. Only the
  // first ancestor counts — over all three, a handful of hub fighters near the middle of
  // the space were "ancestors" of 150 people.
  const heirs = useMemo(() => {
    const m = new Map()
    for (const f of data.fighters) {
      if (!f.active) continue
      const a = ancestorsOf(f, legends)[0]
      if (!a) continue
      if (!m.has(a.id)) m.set(a.id, [])
      m.get(a.id).push({ f, sim: a.sim })
    }
    for (const list of m.values()) list.sort((a, b) => b.sim - a.sim)
    return m
  }, [data, legends])

  const topAncestors = useMemo(() => [...heirs.entries()]
    .map(([id, list]) => ({ f: byId.get(id), n: list.length }))
    .filter((x) => x.f)
    .sort((a, b) => b.n - a.n)
    .slice(0, N_LEGENDS), [heirs, byId])

  const focused = byId.get(focusId)
  const focusedHeirs = heirs.get(focused?.id) || []
  const direct = root ? ancestorsOf(root, legends).map((a) => ({ f: byId.get(a.id), sim: a.sim })).filter((x) => x.f) : []
  const toggle = (
    <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
      {[['legends', 'Legends only'], ['anyone', 'Closest from anyone']].map(([k, label]) => (
        <button key={k} onClick={() => setLegends(k === 'legends')}
          className={cn('rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
            (legends ? 'legends' : 'anyone') === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="grid gap-3 pb-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        {root && (
          <Panel
            title={<span className="flex items-center gap-2"><FamilyAvatar fighter={root} size={26} />{root.name}'s style lineage</span>}
            note={<FamilyChip family={data.families[root.family]} />}
            action={toggle}
          >
            <ReadingKey />
            {tree.nodes.length > 1 ? (
              <Timeline tree={tree} families={data.families} root={root} focusId={focusId}
                onFocus={(id) => setFocus({ root: fighterId, id })} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No {legends ? 'legend' : 'fighter'} in the data peaked 6+ years before {root.name}.
                {legends && ' Try "Closest from anyone".'}
              </p>
            )}
          </Panel>
        )}

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <Panel title="Closest predecessors" note={legends ? 'legends only' : 'anyone'}>
            {direct.length ? (
              <div className="-mx-1 space-y-0.5">
                {direct.map(({ f, sim }) => (
                  <FighterRow key={f.id} fighter={f} families={data.families} selected={f.id === focusId}
                    onClick={() => setFocus({ root: fighterId, id: f.id })} right={<SimBar sim={sim} />} />
                ))}
              </div>
            ) : <p className="text-[12px] text-muted-foreground">None 6+ years earlier.</p>}
          </Panel>

          <Panel title={focused ? `Who else descends from ${focused.name}` : 'Descendants'}>
            {focused ? (
              <>
                <p className="mb-2 text-[11.5px] text-muted-foreground">
                  Closest predecessor of {focusedHeirs.length} active fighter{focusedHeirs.length === 1 ? '' : 's'}.
                </p>
                <div className="flex flex-wrap gap-1">
                  {focusedHeirs.slice(0, 16).map(({ f }) => (
                    <button key={f.id} onClick={() => onSelect(f.id)}
                      className={cn('rounded-md border px-1.5 py-0.5 text-[11px] font-semibold hover:bg-muted', f.id === root?.id && 'border-blue-300 bg-blue-50 text-blue-700')}>
                      {f.name}
                    </button>
                  ))}
                </div>
                <button onClick={() => onSelect(focused.id)} className="mt-3 text-[12px] font-semibold text-blue-600 hover:underline">
                  Trace {focused.name}'s own lineage
                </button>
              </>
            ) : <p className="text-[12px] text-muted-foreground">Click anyone in the timeline to see which active fighters carry their style.</p>}
          </Panel>

          <Panel title="Most common style ancestors" note="active fighters per closest predecessor">
            <ol className="space-y-0.5">
              {topAncestors.map(({ f, n }, i) => (
                <li key={f.id}>
                  <button onClick={() => setFocus({ root: fighterId, id: f.id })}
                    className={cn('grid w-full grid-cols-[16px_10px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 py-1 text-left text-[12px] hover:bg-muted',
                      f.id === focusId && 'bg-blue-50')}>
                    <span className="text-[10.5px] tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: famColor(f.family) }} />
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="text-[11px] font-bold tabular-nums">{n}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <SectionLabel className="px-1 normal-case tracking-normal">
          Ancestors are matched on style with era trends removed, so strike rates from 2008 and 2024 compare fairly. A
          fighter's prime is the midpoint of their UFC career.
        </SectionLabel>
      </div>

      <FighterList fighters={data.fighters} families={data.families} selectedId={fighterId} onSelect={(id) => onSelect(id)}
        className="h-[560px] xl:sticky xl:top-0 xl:h-[calc(100vh-150px)]" />
    </div>
  )
}

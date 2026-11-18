// The Map tab: judges placed by what they reward, against other judges on the same
// rounds — across, striking (sig. strikes and knockdowns); up, grappling (control time
// and takedowns). Sized by rounds judged, colored by how often they score with the stats.
// The selected judge (the side panel's) keeps their agreement lines drawn; hovering
// another judge previews theirs. The column on the right sorts every judge into the
// four corners of the map.
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { ScrollArea } from '../ui/scroll-area'
import { useElementSize } from '../viz/hooks'
import Scatter from './Scatter'
import { divColor, pts } from './lib'

const ACC_MAX = 0.04
// Key rows: a group's header and its '+N more' line, and one judge.
const KEY_HEAD = 62
const KEY_ROW = 21

// Striking amber and grappling indigo, as everywhere on the site; both and neither get
// their own. The same color tints the quadrant, names its corner and heads its key card.
const STYLES = [
  { key: 'tl', label: 'Rewards grappling', color: '#6366f1', test: (x, y) => x < 0 && y >= 0 },
  { key: 'tr', label: 'Rewards both', color: '#10b981', test: (x, y) => x >= 0 && y >= 0 },
  { key: 'bl', label: 'Rewards neither', color: '#64748b', test: (x, y) => x < 0 && y < 0 },
  { key: 'br', label: 'Rewards striking', color: '#f59e0b', test: (x, y) => x >= 0 && y < 0 },
]

// A 2x2 glyph with the group's quadrant filled.
function QuadGlyph({ at, color }) {
  return (
    <span className="grid h-3.5 w-3.5 shrink-0 grid-cols-2 gap-px">
      {['tl', 'tr', 'bl', 'br'].map((k) => (
        <span key={k} className="rounded-[1px]" style={{ background: k === at ? color : 'var(--color-border)' }} />
      ))}
    </span>
  )
}

const mean = (...vs) => {
  const ok = vs.filter((v) => v != null)
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : 0
}

function Legend() {
  const swatch = (v) => <span className="h-2.5 w-2.5 rounded-full" style={{ background: divColor(v, ACC_MAX) }} />
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10.5px] text-muted-foreground">
      <span className="flex items-center gap-1.5">{swatch(-ACC_MAX)}{swatch(0)}{swatch(ACC_MAX)}<span className="ml-0.5">Scores with stats: less → more</span></span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" /><span className="h-3 w-3 rounded-full bg-muted-foreground/60" />Rounds judged
      </span>
      <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-viz-1" />Agree more than expected</span>
      <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-viz-neg" />Agree less than expected</span>
    </div>
  )
}

export default function JudgeMap({ data, judges, showAll, selectedId, onSelect }) {
  const [hover, setHover] = useState(null)
  const [box, { h }] = useElementSize()
  const [keyBox, { h: keyH }] = useElementSize()
  // The key group opened to its full list (it moves to the top; the others fold to headers).
  const [open, setOpen] = useState(null)
  // As many judges per group as the key's height allows, so it fills its column.
  const perGroup = Math.max(1, Math.floor((keyH - STYLES.length * KEY_HEAD) / STYLES.length / KEY_ROW))
  const focus = hover ?? selectedId

  const nodes = useMemo(() => {
    const byId = new Map((judges || []).map((j) => [j.judge_id, j]))
    // An older payload has no eligibility flag: treat that as eligible rather than hide everyone.
    return (data?.nodes || []).filter((n) => showAll || n.eligible !== false).map((n) => {
      const j = byId.get(n.judge_id)
      const l = j?.leans || {}
      return {
        ...n,
        sx: mean(l.sig?.effect, l.kd?.effect),
        sy: mean(l.ctrl?.effect, l.td?.effect),
      }
    })
  }, [data, judges, showAll])

  const { points, xDomain, yDomain } = useMemo(() => {
    const maxR = Math.max(1, ...nodes.map((n) => n.n_rounds))
    // Each axis fitted to its own spread (centred on zero, so the quadrant lines stay in
    // the middle), so the dots use the whole plot.
    const ex = Math.max(0.03, ...nodes.map((n) => Math.abs(n.sx))) * 1.08
    const ey = Math.max(0.03, ...nodes.map((n) => Math.abs(n.sy))) * 1.08
    return {
      points: nodes.map((n) => ({
        id: n.judge_id, x: n.sx, y: n.sy, label: n.name,
        r: 4 + Math.sqrt(n.n_rounds / maxR) * 10,
        fill: divColor(n.acc_above_exp, ACC_MAX),
        node: n,
      })),
      xDomain: [-ex, ex],
      yDomain: [-ey, ey],
    }
  }, [nodes])

  const edges = useMemo(() => {
    if (focus == null) return []
    const maxN = Math.max(1, ...(data?.edges || []).map((e) => e.n_rounds))
    const ids = new Set(nodes.map((n) => n.judge_id))
    return (data?.edges || []).filter((e) => (e.a === focus || e.b === focus) && ids.has(e.a) && ids.has(e.b)).map((e) => ({
      ...e,
      stroke: e.excess >= 0 ? 'var(--color-viz-1)' : 'var(--color-viz-neg)',
      width: 1 + Math.sqrt(e.n_rounds / maxN) * 4,
      opacity: 0.3 + Math.min(1, Math.abs(e.excess) / 0.08) * 0.6,
    }))
  }, [data, nodes, focus])

  const linked = new Set(edges.flatMap((e) => [e.a, e.b]))
  const shown = points.map((p) => ({ ...p, dim: focus != null && !linked.has(p.id) && p.id !== focus }))
  // The focused judge and their three strongest partners get names on the map.
  const labelIds = focus == null ? [] : [focus, ...[...edges]
    .sort((x, y) => Math.abs(y.excess) - Math.abs(x.excess)).slice(0, 3).map((e) => (e.a === focus ? e.b : e.a))]

  const groups = useMemo(() => STYLES.map((g) => ({
    ...g,
    judges: nodes.filter((n) => g.test(n.sx, n.sy)).sort((a, b) => b.n_rounds - a.n_rounds),
  })), [nodes])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div ref={box} className="min-h-[300px] min-w-0">
          {h > 0 && (
            <Scatter
              points={shown}
              edges={edges}
              xDomain={xDomain}
              yDomain={yDomain}
              height={h}
              showYTicks={false}
              showXTicks={false}
              zeroX
              zeroY
              pad={{ l: 10, r: 10, t: 10, b: 6 }}
              corners={Object.fromEntries(STYLES.map((g) => [g.key, g.label]))}
              quadrants={Object.fromEntries(STYLES.map((g) => [g.key, g.color]))}
              labelIds={labelIds}
              activeId={focus}
              onHover={setHover}
              onClick={(p) => onSelect?.(p.id)}
              renderTip={(p) => (
                <div className="text-[11px]">
                  <div className="font-bold">{p.node.name}</div>
                  <div className="tabular-nums text-muted-foreground">{pts(p.node.acc_above_exp)} with stats vs most · {p.node.n_rounds.toLocaleString()} rounds</div>
                </div>
              )}
            />
          )}
        </div>

        <div ref={keyBox} className="hidden min-h-0 flex-col gap-2 overflow-hidden xl:flex">
          {(open ? [...groups.filter((g) => g.key === open), ...groups.filter((g) => g.key !== open)] : groups).map((g) => {
            const isOpen = open === g.key
            const folded = open != null && !isOpen
            const row = (n) => (
              <button
                key={n.judge_id}
                type="button"
                onClick={() => onSelect?.(n.judge_id)}
                onMouseEnter={() => setHover(n.judge_id)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  'flex h-[21px] w-full items-center gap-1.5 rounded px-1 text-left text-[11.5px] transition-colors hover:bg-background/70',
                  n.judge_id === selectedId && 'bg-background font-bold text-primary shadow-sm',
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: divColor(n.acc_above_exp, ACC_MAX) }} />
                <span className="min-w-0 flex-1 truncate">{n.name}</span>
                <span className="shrink-0 text-[10px] font-normal tabular-nums text-muted-foreground">{n.n_rounds.toLocaleString()}</span>
              </button>
            )
            return (
              <motion.div
                key={g.key}
                layout
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                className={cn(
                  'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 px-2 py-1.5',
                  isOpen ? 'flex-[1_1_0]' : folded ? 'flex-none' : 'flex-1',
                )}
                style={{ background: `color-mix(in oklab, ${g.color} 7%, var(--color-card))` }}
              >
                <motion.button
                  layout="position"
                  type="button"
                  onClick={() => setOpen(isOpen ? null : g.key)}
                  className="flex w-full shrink-0 items-center gap-1.5 text-left"
                >
                  <QuadGlyph at={g.key} color={g.color} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: g.color }}>{g.label}</span>
                  <span className="ml-auto rounded-full px-1.5 text-[10px] font-bold tabular-nums text-white" style={{ background: g.color }}>
                    {g.judges.length}
                  </span>
                </motion.button>
                {isOpen ? (
                  <>
                    <ScrollArea className="mt-1 min-h-0 flex-1" viewportClassName="!pr-2">
                      {g.judges.map(row)}
                    </ScrollArea>
                    <button type="button" onClick={() => setOpen(null)} className="mt-1 shrink-0 px-1 text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                      Show less
                    </button>
                  </>
                ) : !folded && (
                  <div className="mt-1">
                    {g.judges.slice(0, perGroup).map(row)}
                    {g.judges.length > perGroup && (
                      <button type="button" onClick={() => setOpen(g.key)} className="px-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                        +{g.judges.length - perGroup} more
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
      <Legend />
    </div>
  )
}

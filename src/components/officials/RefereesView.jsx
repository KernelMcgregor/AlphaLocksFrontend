// Officials page, Referees view (every referee, always) — how often their fights end inside the distance, how
// long they let a beaten fighter take punishment before a strike stoppage, and how often
// they take points. The selected referee (?r=) fills the side panel, as on the Judges view.
//
// Backed by /ufc/referees (+ /ufc/referees/:id for the panel). Tab, filter, sort and
// selection live in the URL.
import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../PageLoader'
import Scatter from './Scatter'
import RefereePanel from './RefereePanel'
import { ErrorCard, SortHead } from './shared'
import { pct, sortRows, stoppageFmt, stoppagePct, stoppageWord, useLoad, useUrlSort } from './lib'
import { SlideTabs } from '../ui/slide-tabs'
import { ScrollArea } from '../ui/scroll-area'
import { useElementSize } from '../viz/hooks'
import { cn } from '../../lib/utils'
import { fetchReferees } from '../../lib/officialsApi'

const TABS = [
  { key: 'board', label: 'Leaderboard' },
  { key: 'map', label: 'Map' },
]
// Percentiles use referees with enough fights to say anything.
const ESTABLISHED = 50

const GRID = 'grid grid-cols-[24px_minmax(130px,1fr)_56px_80px_170px_64px_52px] items-center gap-2'

// The view's controls, rendered in the page header row (state lives in the URL).
export function RefereeControls() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'board'
  const set = (k, v) => {
    const p = new URLSearchParams(params)
    if (v == null) p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }
  return <SlideTabs size="sm" tabs={TABS} value={tab} onChange={(t) => set('tab', t === 'board' ? null : t)} />
}

const loadReferees = () => fetchReferees()

const GET = (r, k) => ({
  name: r.name, fights: r.n_fights, finish: r.finish_rate, stoppage: r.stoppage_index,
  deductions: r.deductions_per_100, dq: r.dq_rate,
}[k])

// Percentile of v among `ref` (0-100, ties split).
const pctOf = (ref, v) => (v == null || !ref.length ? null
  : ((ref.filter((x) => x < v).length + 0.5 * ref.filter((x) => x === v).length) / ref.length) * 100)

function StoppageCell({ v }) {
  if (v == null) return <span className="text-[11px] text-muted-foreground">—</span>
  const word = stoppageWord(v)
  return (
    <span className="flex items-center gap-2">
      <span className={cn('w-12 text-right text-[12px] font-bold tabular-nums', word === 'Average' ? 'text-muted-foreground' : v > 0 ? 'text-viz-1' : 'text-viz-neg')}>
        {stoppageFmt(v)}
      </span>
      <span className="truncate text-[11px] text-muted-foreground">{word}</span>
    </span>
  )
}

function RefereeTable({ rows, sort, onSort, selectedId, onSelect }) {
  const head = (k, label, title, center) => (
    <span className={center ? 'flex justify-center' : undefined}>
      <SortHead k={k} sort={sort} onSort={onSort} title={title}>{label}</SortHead>
    </span>
  )
  return (
    // The header sits outside the scroll, so the scrollbar starts under it.
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className={cn(GRID, 'min-w-[620px] shrink-0 border-b border-border bg-muted px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground')}>
          <span />
          {head('name', 'Referee')}
          {head('fights', 'Fights')}
          {head('finish', 'Finish rate', 'Share of fights that end inside the distance')}
          {head('stoppage', 'Strikes before stop', 'Strikes the beaten fighter took before a strike stoppage, vs a similar stoppage')}
          {head('deductions', 'Ded./100', 'Point deductions per 100 decisions', true)}
          {head('dq', 'DQ', 'Share of fights ending in a disqualification', true)}
        </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="!pr-0">
      <div className="min-w-[620px]">
        {rows.map((r, i) => (
          <button
            key={r.referee_id}
            type="button"
            onClick={() => onSelect(r.referee_id)}
            className={cn(
              GRID,
              'h-11 w-full border-b border-border/70 px-3 text-left transition-colors last:border-b-0',
              r.referee_id === selectedId ? 'bg-primary/[0.05] shadow-[inset_3px_0_0_var(--color-primary)]' : 'hover:bg-muted/50',
            )}
          >
            <span className="text-center font-display text-[18px] font-extrabold italic leading-none tabular-nums text-muted-foreground/70">{i + 1}</span>
            <span className="truncate text-[13.5px] font-bold tracking-tight">{r.name}</span>
            <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{r.n_fights.toLocaleString()}</span>
            <span className="text-[12.5px] font-extrabold tabular-nums">{pct(r.finish_rate, 0)}</span>
            <StoppageCell v={r.stoppage_index} />
            <span className="text-center text-[12px] font-semibold tabular-nums">{r.deductions_per_100 == null ? <span className="text-muted-foreground">—</span> : r.deductions_per_100.toFixed(1)}</span>
            <span className={cn('text-center text-[12px] tabular-nums', r.dq_rate ? 'font-semibold' : 'text-muted-foreground')}>{r.dq_rate ? pct(r.dq_rate, 1) : '—'}</span>
          </button>
        ))}
        {!rows.length && <p className="py-10 text-center text-[12px] text-muted-foreground">No referees match.</p>}
      </div>
      </ScrollArea>
    </div>
  )
}

// Strikes before the stop (vs expected) across, finish rate (vs the average referee) up,
// sized by fights. The x scale is fixed at ±10%: referees differ by only a few %, and an
// auto-fitted axis would stretch that into something it isn't.
function RefereeMap({ refs, selectedId, onSelect }) {
  const [hover, setHover] = useState(null)
  const [box, { h }] = useElementSize()
  const focus = hover ?? selectedId
  const pts = useMemo(() => {
    const maxN = Math.max(1, ...refs.map((r) => r.n_fights))
    // Every referee: one with too few strike stoppages for an index sits at 0 (no evidence
    // either way, which is also where the shrinkage would put them).
    return refs.filter((r) => r.finish_rate != null).map((r) => ({
      id: r.referee_id, x: stoppagePct(r.stoppage_index) ?? 0, y: r.finish_rate, label: r.name, ref: r,
      r: 3.5 + Math.sqrt(r.n_fights / maxN) * 10,
      fill: 'color-mix(in oklab, var(--color-primary) 75%, transparent)',
    }))
  }, [refs])
  if (!pts.length) return <p className="py-10 text-center text-[12px] text-muted-foreground">No referees match.</p>
  const xMax = Math.max(10, ...pts.map((p) => Math.abs(p.x)) ) * 1.05
  const avgY = pts.reduce((a, p) => a + p.y, 0) / pts.length
  const yExt = Math.max(0.05, ...pts.map((p) => Math.abs(p.y - avgY))) * 1.1
  const labelIds = [focus, ...[...pts].sort((a, b) => b.ref.n_fights - a.ref.n_fights).slice(0, 6).map((p) => p.id)].filter((x) => x != null)
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div ref={box} className="min-h-[300px] flex-1">
        {h > 0 && (
          <Scatter
            points={pts.map((p) => ({ ...p, y: p.y - avgY }))}
            xDomain={[-xMax, xMax]}
            yDomain={[-yExt, yExt]}
            height={h}
            showXTicks={false}
            showYTicks={false}
            zeroX
            zeroY
            pad={{ l: 10, r: 10, t: 10, b: 6 }}
            corners={{ tl: 'Stops early · more finishes', tr: 'Lets it go · more finishes', bl: 'Stops early · fewer finishes', br: 'Lets it go · fewer finishes' }}
            labelIds={labelIds}
            activeId={focus}
            onHover={setHover}
            onClick={(p) => onSelect(p.id)}
            renderTip={(p) => (
              <div className="text-[11px]">
                <div className="font-bold">{p.ref.name}</div>
                <div className="tabular-nums text-muted-foreground">{pct(p.ref.finish_rate, 0)} finishes · {stoppageFmt(p.ref.stoppage_index)} strikes before stop · {p.ref.n_fights} fights</div>
              </div>
            )}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10.5px] text-muted-foreground">
        <span>← Stops early · Lets it go →</span>
        <span>↑ More finishes than most</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/70" /><span className="h-3 w-3 rounded-full bg-primary/70" />Fights refereed
        </span>
      </div>
    </div>
  )
}

export default function RefereesView() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'board'
  const [sort, onSort] = useUrlSort(params, setParams, '-fights')
  const { data, error } = useLoad(loadReferees, 'referees')
  const panelRef = useRef(null)

  // Percentiles among established referees, and the league's finish rate.
  const all = useMemo(() => {
    const list = data || []
    const est = list.filter((r) => r.n_fights >= ESTABLISHED)
    const fin = est.map((r) => r.finish_rate).filter((v) => v != null)
    const stop = est.map((r) => r.stoppage_index).filter((v) => v != null)
    return list.map((r) => ({
      ...r,
      pct_finish: r.n_fights >= ESTABLISHED ? pctOf(fin, r.finish_rate) : null,
      pct_stoppage: r.n_fights >= ESTABLISHED ? pctOf(stop, r.stoppage_index) : null,
    }))
  }, [data])
  const rows = useMemo(() => sortRows(all, sort, GET), [all, sort])

  if (error) return <ErrorCard>Couldn't load referees: {error}</ErrorCard>
  if (!data) return <PageLoader />

  const picked = Number(params.get('r'))
  const selected = all.find((r) => r.referee_id === picked) || rows[0]
  const select = (id) => {
    const p = new URLSearchParams(params)
    p.set('r', String(id))
    setParams(p, { replace: true })
    if (!window.matchMedia('(min-width: 1024px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 lg:overflow-hidden">
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[316px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <RefereePanel referee={selected} panelRef={panelRef} />
        {tab === 'map'
          ? <div className="min-h-0"><RefereeMap refs={rows} selectedId={selected?.referee_id} onSelect={select} /></div>
          : <RefereeTable rows={rows} sort={sort} onSort={onSort} selectedId={selected?.referee_id} onSelect={select} />}
      </div>
    </div>
  )
}

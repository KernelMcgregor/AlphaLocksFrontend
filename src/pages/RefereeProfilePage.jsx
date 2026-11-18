// One referee, laid out like the judge profile: the slim ink bar with section tabs, the
// headline numbers, how their fights end and how late they stop them against every other
// referee, then every fight they worked (rows open to the finish and a link to the fight).
//
// Backed by /ufc/referees/:id (+ /ufc/referees for the comparison). The fights filter
// lives in the URL (?f=stoppages).
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { BackButton } from '../components/articles/header'
import { CORNERS } from '../components/fight/corners'
import { HeroChip, HeroTabs } from '../components/hero/parts'
import { MethodBar } from '../components/officials/RefereePanel'
import { ErrorCard, Panel, WinMark, YearBars } from '../components/officials/shared'
import { ordinal, pct, shortDate, span, stoppageFmt, stoppagePct, stoppageWord, useLoad } from '../components/officials/lib'
import { ScrollArea } from '../components/ui/scroll-area'
import { SlideTabs } from '../components/ui/slide-tabs'
import Section from '../components/viz/Section'
import { useScrollSpy } from '../components/viz/hooks'
import { clock, cn } from '../lib/utils'
import { fetchReferee, fetchReferees, fetchRoundStats } from '../lib/officialsApi'

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'fights', label: 'Fights' },
]
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'stoppages', label: 'Strike stoppages' },
  { key: 'deductions', label: 'Deductions' },
]
const PAGE = 40
const COMPARE_MIN = 50

const loadReferee = (id) => fetchReferee(id)
const loadReferees = () => fetchReferees()

const isStrikeStop = (f) => f.absorbed != null
const splitName = (name) => {
  const [first, ...rest] = (name || '').split(' ')
  return rest.length ? [first, rest.join(' ')] : ['', first]
}
// One stoppage: strikes taken vs what a similar stoppage would expect.

function RefereeBar({ r, active, onTab }) {
  const [first, last] = splitName(r.name)
  return (
    <div className="sticky top-0 z-30 flex h-[52px] items-center gap-3 rounded-xl bg-ink px-3 text-white shadow-lg">
      <BackButton dark fallback="/ufc/officials?view=referees" className="h-7 w-7" />
      <div className="flex min-w-0 shrink-0 items-baseline gap-1.5">
        {first && <span className="text-[13px] font-semibold text-white/75">{first}</span>}
        <span className="pr-1 font-display text-[24px] font-extrabold italic uppercase leading-none tracking-tight">{last}</span>
      </div>
      <div className="hidden min-w-0 items-center gap-1.5 overflow-hidden xl:flex">
        <HeroChip>{span(r.first_date, r.last_date)}</HeroChip>
        <HeroChip>{r.n_fights.toLocaleString()} UFC fights</HeroChip>
        {r.n_regional > 0 && <HeroChip>{r.n_regional.toLocaleString()} regional</HeroChip>}
      </div>
      <div className="ml-auto flex min-w-0 shrink overflow-x-auto [scrollbar-width:none]">
        <HeroTabs className="shrink-0" tabs={SECTIONS} value={active} onChange={onTab} />
      </div>
    </div>
  )
}

function StatStrip({ r, finishPct, stops }) {
  const stats = [
    ['Finish rate', pct(r.finish_rate, 0), finishPct != null ? `${ordinal(finishPct)} percentile` : null],
    ['Stoppages', stoppageWord(r.stoppage_index), r.stoppage_index != null ? `${stoppageFmt(r.stoppage_index)} vs expected` : null],
    ['Strike stoppages', stops],
    ['Avg finish', r.mean_finish_seconds != null ? clock(r.mean_finish_seconds) : '—'],
    ['Deductions / 100', r.deductions_per_100 == null ? '—' : r.deductions_per_100.toFixed(1)],
    ['DQ rate', r.dq_rate ? pct(r.dq_rate, 1) : '—'],
  ]
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 lg:grid-cols-6">
      {stats.map(([label, value, sub, cls]) => (
        <div key={label} className="min-w-0">
          <div className={cn('font-display text-[26px] font-extrabold italic leading-none tracking-tight tabular-nums', cls)}>{value}</div>
          <div className="mt-1 line-clamp-2 text-[10px] font-bold uppercase leading-snug tracking-wider text-foreground/70">
            {label}{sub && <span className="font-semibold normal-case tracking-normal text-muted-foreground"> · {sub}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// Where this referee sits among every established referee on strikes before the stop
// (vs expected): the others as faint ticks, this one as a dot, on a fixed ±10% scale so
// a few % doesn't look like a gulf.
function StoppageScale({ referee, others }) {
  const v = stoppagePct(referee.stoppage_index)
  if (v == null) return null
  const max = Math.max(10, Math.abs(v), ...others.map((o) => Math.abs(stoppagePct(o.stoppage_index)))) * 1.05
  const x = (t) => 50 + (Math.max(-max, Math.min(max, t)) / max) * 50
  return (
    <Panel title="Strikes before the stop vs other referees" className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <div className="relative h-16">
          <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[13px] font-extrabold tabular-nums" style={{ left: `${x(v)}%` }}>
            {stoppageFmt(referee.stoppage_index)}
          </span>
          <div className="absolute inset-x-0 top-[42px] h-px bg-border" />
          <div className="absolute bottom-1 left-1/2 top-6 w-px bg-foreground/30" />
          {others.map((o) => (
            <span key={o.referee_id} className="absolute top-[42px] h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/35" style={{ left: `${x(stoppagePct(o.stoppage_index))}%` }} />
          ))}
          <div className="absolute top-[42px] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: `${x(v)}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>← Stops early</span><span>Lets it go →</span>
        </div>
      </div>
    </Panel>
  )
}

const GRID = 'grid grid-cols-[96px_minmax(200px,1fr)_110px_76px_150px_44px] items-center gap-3'

const loadRoundStats = (id) => fetchRoundStats(id)

// The opened row: round-by-round numbers for both corners (the finishing round
// highlighted), what happened at the stop, and the way to the fight page. Drawn as a
// tinted band of the table, its columns starting under Bout.
function FightDetail({ f }) {
  const { data } = useLoad(loadRoundStats, f.fight_id)
  const [winner, loser] = f.winner > 0 ? [f.red_name, f.blue_name] : f.winner < 0 ? [f.blue_name, f.red_name] : [null, null]
  const cols = 'grid grid-cols-[52px_repeat(4,minmax(84px,1fr))] items-center gap-3'
  const pair = (r, b, fmt = (v) => v) => (
    <span className="tabular-nums">
      <span className="font-bold text-corner-red">{fmt(r)}</span>
      <span className="text-muted-foreground"> – </span>
      <span className="font-bold text-corner-blue">{fmt(b)}</span>
    </span>
  )
  return (
    <div className="flex flex-wrap items-start gap-6 bg-muted/35 py-3 pl-[111px] pr-3">
      <div className="min-w-[420px] flex-1 text-[12px]">
        <div className={cn(cols, 'pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground')}>
          <span>Round</span><span>Sig. strikes</span><span>Knockdowns</span><span>Takedowns</span><span>Control</span>
        </div>
        {!data ? <div className="py-2 text-[11px] text-muted-foreground">Loading…</div> : data.rounds.map((r) => (
          <div key={r.round} className={cn(cols, 'border-t border-border/60 py-1', r.round === data.finish_round && f.method !== 'Decision' && 'font-semibold')}>
            <span className="text-[11px] font-extrabold">R{r.round}{r.round === f.finish_round && !String(f.method).startsWith('Decision') && <span className="ml-1 text-primary">●</span>}</span>
            {pair(r.red?.sig ?? 0, r.blue?.sig ?? 0)}
            {pair(r.red?.kd ?? 0, r.blue?.kd ?? 0)}
            {pair(r.red?.td ?? 0, r.blue?.td ?? 0)}
            {pair(r.red?.ctrl ?? 0, r.blue?.ctrl ?? 0, clock)}
          </div>
        ))}
      </div>
      <div className="flex w-[300px] flex-col gap-2 text-[12px]">
        <div>{winner ? <><b>{winner}</b> def. {loser}</> : 'No winner'} · {f.method}{f.finish_round ? `, R${f.finish_round} ${f.finish_time || ''}` : ''}</div>
        {f.absorbed != null && (
          <div className="text-muted-foreground">
            {loser} took <b className="text-foreground">{f.absorbed}</b> significant strikes in the round
            {f.absorbed_expected != null && <> · about <b className="text-foreground">{Math.round(f.absorbed_expected)}</b> for a similar stoppage</>}
          </div>
        )}
        {f.deductions > 0 && <div className="text-muted-foreground">{f.deductions} point{f.deductions > 1 ? 's' : ''} deducted</div>}
        <Link to={`/ufc/fights/${f.fight_id}`} className="mt-1 inline-flex items-center gap-1.5 self-start rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-primary/90">
          Full fight <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function FightRow({ f, open, onToggle }) {
  return (
    <div className="border-b border-border/50">
      <button type="button" onClick={onToggle} className={cn(GRID, 'w-full py-1.5 text-left hover:bg-muted/40', open && 'bg-muted/40')}>
        <span className="flex items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />{shortDate(f.date)}
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CORNERS[0].css }} />
            <span className={cn('truncate', f.winner === 1 ? 'font-bold' : 'text-muted-foreground')}>{f.red_name}</span>
            {f.winner === 1 && <WinMark />}
            <span className="text-muted-foreground/60">vs</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CORNERS[1].css }} />
            <span className={cn('truncate', f.winner === -1 ? 'font-bold' : 'text-muted-foreground')}>{f.blue_name}</span>
            {f.winner === -1 && <WinMark />}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">{f.event_name}</span>
        </span>
        <span className="truncate text-[11px]">{f.method}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{f.finish_round ? `R${f.finish_round} ${f.finish_time || ''}` : ''}</span>
        <span className="truncate text-[11px]">
          {f.absorbed != null ? <><b className="tabular-nums">{f.absorbed}</b> <span className="text-muted-foreground">taken{f.absorbed_expected != null && ` · ${Math.round(f.absorbed_expected)} expected`}</span></> : <span className="text-muted-foreground">—</span>}
        </span>
        <span className={cn('text-center text-[11.5px] tabular-nums', f.deductions ? 'font-bold' : 'text-muted-foreground')}>{f.deductions || '—'}</span>
      </button>
      {open && <FightDetail f={f} />}
    </div>
  )
}

function Fights({ fights }) {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(null)
  const filter = FILTERS.some((f) => f.key === params.get('f')) ? params.get('f') : 'all'
  const [n, setN] = useState(PAGE)
  const test = { all: () => true, stoppages: isStrikeStop, deductions: (f) => f.deductions > 0 }
  const rows = fights.filter(test[filter])
  const setFilter = (k) => {
    const p = new URLSearchParams(params)
    if (k === 'all') p.delete('f')
    else p.set('f', k)
    setParams(p, { replace: true })
    setN(PAGE)
  }
  return (
    <Panel right={<SlideTabs size="sm" value={filter} onChange={setFilter} tabs={FILTERS.map((f) => ({ ...f, badge: fights.filter(test[f.key]).length }))} />}>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className={cn(GRID, 'border-b pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground')}>
            <span className="pl-[18px]">Date</span><span>Bout</span><span>Method</span><span>Ended</span><span>Before the stop</span><span className="text-center">Ded.</span>
          </div>
          {rows.slice(0, n).map((f) => (
            <FightRow key={f.fight_id} f={f} open={open === f.fight_id} onToggle={() => setOpen(open === f.fight_id ? null : f.fight_id)} />
          ))}
          {!rows.length && <p className="py-6 text-center text-[11.5px] text-muted-foreground">No fights.</p>}
        </div>
      </div>
      {rows.length > n && (
        <button type="button" onClick={() => setN(n + PAGE * 2)} className="mt-2 w-full rounded-md border border-border py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted">
          Show more ({rows.length - n})
        </button>
      )}
    </Panel>
  )
}

export default function RefereeProfilePage() {
  const { id } = useParams()
  const { data, error } = useLoad(loadReferee, id)
  const all = useLoad(loadReferees, 'referees')
  const { scrollRef, register, active, scrollTo } = useScrollSpy(SECTIONS, 64)

  if (error) return <ErrorCard>Couldn't load this referee: {error}</ErrorCard>
  if (!data) return <PageLoader />
  const { referee: r, fights } = data
  const others = (all.data || []).filter((o) => o.referee_id !== r.referee_id && o.n_fights >= COMPARE_MIN && o.stoppage_index != null)
  // Percentile among referees with enough fights, as on the Officials page.
  const est = (all.data || []).filter((o) => o.n_fights >= COMPARE_MIN && o.finish_rate != null).map((o) => o.finish_rate)
  const finishPct = r.n_fights >= COMPARE_MIN && est.length && r.finish_rate != null
    ? ((est.filter((x) => x < r.finish_rate).length + 0.5 * est.filter((x) => x === r.finish_rate).length) / est.length) * 100
    : null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea viewportRef={scrollRef} className="min-h-0 flex-1" viewportClassName="relative">
        <RefereeBar r={r} active={active} onTab={scrollTo} />
        <div className="mt-2"><StatStrip r={r} finishPct={finishPct} stops={fights.filter(isStrikeStop).length} /></div>

        <div className="mt-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-col gap-4 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-4">
            <Section id="overview" title="Overview" register={register}>
              <div className="grid gap-3 lg:grid-cols-3">
                <Panel title="How their fights end" className="flex flex-col">
                  <div className="flex flex-1 flex-col justify-center"><MethodBar methods={r.methods} large /></div>
                </Panel>
                <StoppageScale referee={r} others={others} />
                <YearBars byYear={r.fights_by_year} />
              </div>
            </Section>
            <Section id="fights" title="Fights" register={register}>
              <Fights fights={fights} />
            </Section>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

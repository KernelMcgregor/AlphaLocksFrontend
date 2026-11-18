// One judge: how accurate they are against what an average judge would score on the
// same rounds, how they lean, what they reward, and every decision they scored.
//
// Backed by /ufc/judges/:id and /ufc/judges/:id/rounds (worst misses). The decisions
// filter lives in the URL (?f=pivotal).
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { CORNERS } from '../components/fight/corners'
import { BackButton } from '../components/articles/header'
import { HeroChip, HeroTabs } from '../components/hero/parts'
import { AxisEnds, CardScore, DivergingRow, ErrorCard, KindBadge, Meter, Panel, WinMark, YearBars } from '../components/officials/shared'
import { isReal, LEANS, ordinal, pct, per10, pts, REWARDS, shortDate, signed, span, totalLean, useLoad } from '../components/officials/lib'
import { SlideTabs } from '../components/ui/slide-tabs'
import { Tip } from '../components/ui/tip'
import { DumbbellRow, TwoWayLegend } from '../components/viz/Dumbbell'
import Section from '../components/viz/Section'
import { useScrollSpy } from '../components/viz/hooks'
import { ScrollArea } from '../components/ui/scroll-area'
import { cn } from '../lib/utils'
import { fetchDecisionRounds, fetchJudge, fetchJudgeMisses } from '../lib/officialsApi'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pivotal', label: 'Split majority' },
  { key: 'dissent', label: 'Dissents' },
  { key: 'robbery', label: 'Robbery' },
  { key: 'against', label: 'Against model' },
]
const PAGE = 40
const MISSES = 8

const loadJudge = (id) => fetchJudge(id)
const loadMisses = (id) => fetchJudgeMisses(id, 25)

function Leans({ judge, pool }) {
  return (
    <Panel>
      <AxisEnds label="Leans" left="Against" right="Toward" />
      {LEANS.map((m) => {
        const t = totalLean(pool, judge, m.key)
        return (
          <DivergingRow
            key={m.key}
            label={m.label}
            value={per10(t?.effect)}
            se={t ? t.se * 2.5 : null}
            max={2.5}
            fmt={(v) => signed(v, 1)}
            dense
          />
        )
      })}
    </Panel>
  )
}

function Rewards({ judge }) {
  return (
    <Panel>
      <AxisEnds label="Stat weight" left="Less" right="More" />
      {REWARDS.map((m) => {
        const l = judge.leans?.[m.key]
        return (
          <DivergingRow
            key={m.key}
            label={m.label}
            value={l?.effect}
            se={l?.se}
            max={0.4}
            fmt={(v) => (!isReal(v, l?.se) ? 'Avg' : v > 0 ? 'More' : 'Less')}
            dense
          />
        )
      })}
    </Panel>
  )
}

function TenEight({ judge }) {
  const rows = [
    ['Before 2017', judge.ten8_pre2017, judge.ten8_pre2017_exp, judge.ten8_pre2017_n],
    ['2017 on', judge.ten8_post2017, judge.ten8_post2017_exp, judge.ten8_post2017_n],
  ].filter(([, o, , n]) => o != null && n)
  if (!rows.length) return null
  return (
    <Panel title="10-8 rate" right={<TwoWayLegend selfLabel="Judge" oppLabel="Expected" />}>
      {rows.map(([label, o, e, n]) => (
        <Tip key={label} content={<span className="text-[11px]"><b className="tabular-nums">{pct(o)}</b> of {n.toLocaleString()} rounds · expected {pct(e)}</span>}>
          <DumbbellRow label={label} self={o * 100} opp={e * 100} fmt="pct1" />
        </Tip>
      ))}
    </Panel>
  )
}

function Misses({ id }) {
  const { data } = useLoad(loadMisses, id)
  return (
    <Panel title="Biggest misses" right={<span className="text-[10px] font-semibold text-muted-foreground">Stats gave them</span>}>
      {!data ? <p className="py-4 text-center text-[11px] text-muted-foreground">Loading…</p> : !data.length ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">None.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {data.slice(0, MISSES).map((m) => {
            const gaveRed = m.verdict > 0
            const pGiven = gaveRed ? m.p_red : 1 - m.p_red
            const [given, over] = gaveRed ? [m.red_name, m.blue_name] : [m.blue_name, m.red_name]
            return (
              <Link key={`${m.fight_id}-${m.round}`} to={`/ufc/fights/${m.fight_id}`} className="flex items-center gap-2.5 py-1.5 hover:bg-muted/40">
                <span className="w-6 shrink-0 text-[11px] font-extrabold text-muted-foreground">R{m.round}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px]">
                    <span className="text-muted-foreground">Gave </span>
                    <b className="font-bold">{given}</b>
                    <span className="text-muted-foreground"> the round over </span>{over}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">{shortDate(m.date)} · {m.event_name}</div>
                </div>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{m.score}</span>
                <span className="w-11 shrink-0 text-right text-[12px] font-extrabold tabular-nums text-rose-600">{pct(pGiven, 0)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

// Who they sit with most, and how often the two agree vs what the round model expects.
function Partners({ partners }) {
  if (!partners?.length) return null
  const grid = 'grid grid-cols-[minmax(0,1fr)_64px_64px_88px] items-center gap-2'
  return (
    <Panel title="Panel partners">
      <div className={cn(grid, 'border-b border-border pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground')}>
        <span>Judge</span><span className="text-right">Rounds</span><span className="text-right">Agree</span><span className="text-right">vs expected</span>
      </div>
      {partners.map((p) => {
        const clear = Math.abs(p.excess) >= 0.02
        return (
          <Link key={p.judge_id} to={`/ufc/judges/${p.judge_id}`} className={cn(grid, 'border-b border-border/50 py-[5px] last:border-b-0 hover:bg-muted/40')}>
            <span className="truncate text-[12px] font-semibold">{p.name}</span>
            <span className="text-right text-[12px] tabular-nums text-muted-foreground">{p.n_rounds}</span>
            <span className="text-right text-[12px] font-bold tabular-nums">{pct(p.agree, 0)}</span>
            <span className={cn('text-right text-[12px] font-bold tabular-nums', !clear ? 'text-muted-foreground' : p.excess > 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {pts(p.excess)}
            </span>
          </Link>
        )
      })}
    </Panel>
  )
}

// Their card went against the official result: the lone dissent of a split, or the
// draw card of a majority decision.
const isDissent = (f) => f.result !== 0 && f.card.side !== f.result

function Flags({ f }) {
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {f.pivotal && <span className="rounded bg-foreground px-1.5 py-px text-[8.5px] font-black uppercase tracking-wide text-background">Split majority</span>}
      {isDissent(f) && <span className="rounded border border-foreground/60 px-1.5 py-px text-[8.5px] font-black uppercase tracking-wide">Dissent</span>}
      {f.robbery_card && <span className="rounded bg-primary px-1.5 py-px text-[8.5px] font-black uppercase tracking-wide text-white">Robbery</span>}
      {f.against_model && !f.robbery_card && <span className="rounded border border-border px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">Vs model</span>}
    </span>
  )
}

const DGRID = 'grid grid-cols-[96px_minmax(180px,1fr)_76px_72px_minmax(150px,190px)_130px] items-center gap-3'

const lastName = (name) => (name || '').split(' ').slice(-1)[0]

// The stats' pick for a decision: the fighter the deserve-to-win meter favors, and by how much.
function StatsFavored({ f }) {
  const red = (f.p_red ?? 0) >= (f.p_blue ?? 0)
  const name = red ? f.red.name : f.blue.name
  const p = red ? f.p_red : f.p_blue
  return (
    <span className="flex items-center gap-2">
      <Meter pRed={f.p_red} pBlue={f.p_blue} className="w-20 shrink-0" />
      <span className="min-w-0 truncate text-[11px]">
        <span className="font-semibold" style={{ color: (red ? CORNERS[0] : CORNERS[1]).css }}>{lastName(name)}</span>
        <span className="ml-1 font-bold tabular-nums">{pct(p, 0)}</span>
      </span>
    </span>
  )
}

const loadRounds = (id) => fetchDecisionRounds(id)

// The panel's round-by-round cards for one decision, beside the stats' read of each round.
function DecisionDetail({ f, judgeId }) {
  const { data, error } = useLoad(loadRounds, f.fight_id)
  if (error) return <p className="px-2 py-3 text-[11px] text-destructive">{error}</p>
  if (!data) return <p className="px-2 py-3 text-[11px] text-muted-foreground">Loading…</p>
  // Columns depend on the panel size, so they're an inline template (Tailwind can't see a
  // class built at runtime).
  const cols = 'grid items-center gap-3'
  const tpl = { gridTemplateColumns: `44px minmax(150px, 220px) repeat(${data.judges.length}, minmax(90px, 1fr))` }
  const scoreCls = (sc) => (!sc ? 'text-muted-foreground' : sc.verdict > 0 ? 'text-corner-red' : sc.verdict < 0 ? 'text-corner-blue' : '')
  return (
    <div className="bg-muted/35 py-3 pl-[111px] pr-3">
      <div className={cn(cols, 'pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground')} style={tpl}>
        <span>Round</span>
        <span>Stats</span>
        {data.judges.map((j) => (
          <span key={j.judge_id} className={cn('truncate text-center', j.judge_id === judgeId && 'text-foreground')}>{j.name}</span>
        ))}
      </div>
      {data.rounds.map((r) => (
        <div key={r.round} className={cn(cols, 'border-t border-border/60 py-1')} style={tpl}>
          <span className="text-[11px] font-extrabold">R{r.round}</span>
          <span className="flex items-center gap-2">
            <Meter pRed={r.p_red} pBlue={1 - r.p_red} className="w-24 shrink-0" />
            <span className="text-[10.5px] tabular-nums text-muted-foreground">
              {r.p_red >= 0.5 ? lastName(f.red.name) : lastName(f.blue.name)} {pct(Math.max(r.p_red, 1 - r.p_red), 0)}
            </span>
          </span>
          {r.scores.map((sc, k) => (
            <span key={k} className={cn('text-center text-[12px] font-bold tabular-nums', scoreCls(sc),
              data.judges[k]?.judge_id === judgeId && 'rounded bg-background py-0.5')}>
              {sc ? sc.score : '—'}
            </span>
          ))}
        </div>
      ))}
      <div className={cn(cols, 'border-t-2 border-foreground/70 pt-1.5')} style={tpl}>
        <span className="text-[10px] font-extrabold uppercase">Total</span>
        <span />
        {data.judges.map((j) => (
          <span key={j.judge_id} className={cn('text-center text-[12.5px] font-extrabold tabular-nums',
            j.side > 0 ? 'text-corner-red' : j.side < 0 ? 'text-corner-blue' : '')}>
            {j.red}-{j.blue}
          </span>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Link to={`/ufc/fights/${f.fight_id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-primary/90">
          Full fight <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function DecisionRow({ f, judgeId, open, onToggle }) {
  return (
    <div className="border-b border-border/50">
      <button type="button" onClick={onToggle} className={cn(DGRID, 'w-full py-1.5 text-left hover:bg-muted/40', open && 'bg-muted/40')}>
        <span className="flex items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />{shortDate(f.date)}
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CORNERS[0].css }} />
            <span className={cn('truncate', f.result === 1 ? 'font-bold' : 'text-muted-foreground')}>{f.red.name}</span>
            {f.result === 1 && <WinMark />}
            <span className="text-muted-foreground/60">vs</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CORNERS[1].css }} />
            <span className={cn('truncate', f.result === -1 ? 'font-bold' : 'text-muted-foreground')}>{f.blue.name}</span>
            {f.result === -1 && <WinMark />}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">{f.event_name}</span>
        </span>
        <span><KindBadge kind={f.kind} /></span>
        <span className="flex justify-center"><CardScore card={f.card} /></span>
        <StatsFavored f={f} />
        <Flags f={f} />
      </button>
      {open && <DecisionDetail f={f} judgeId={judgeId} />}
    </div>
  )
}

function Decisions({ fights, judgeId }) {
  const [open, setOpen] = useState(null)
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.some((f) => f.key === params.get('f')) ? params.get('f') : 'all'
  const [n, setN] = useState(PAGE)
  const rows = fights.filter((f) => filter === 'all' || (filter === 'pivotal' && f.pivotal)
    || (filter === 'dissent' && isDissent(f))
    || (filter === 'robbery' && f.robbery_card) || (filter === 'against' && f.against_model))
  const counts = {
    all: fights.length,
    pivotal: fights.filter((f) => f.pivotal).length,
    dissent: fights.filter(isDissent).length,
    robbery: fights.filter((f) => f.robbery_card).length,
    against: fights.filter((f) => f.against_model).length,
  }
  const setFilter = (k) => {
    const p = new URLSearchParams(params)
    if (k === 'all') p.delete('f')
    else p.set('f', k)
    setParams(p, { replace: true })
    setN(PAGE)
  }
  return (
    <Panel
      right={<SlideTabs size="sm" value={filter} onChange={setFilter} tabs={FILTERS.map((f) => ({ ...f, badge: counts[f.key] }))} />}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={cn(DGRID, 'border-b pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground')}>
            <span className="pl-[18px]">Date</span><span>Bout</span><span>Result</span><span className="text-center">Their card</span><span>Stats favored</span><span />
          </div>
          {rows.slice(0, n).map((f) => (
            <DecisionRow
              key={f.fight_id}
              f={f}
              judgeId={judgeId}
              open={open === f.fight_id}
              onToggle={() => setOpen(open === f.fight_id ? null : f.fight_id)}
            />
          ))}
          {!rows.length && <p className="py-6 text-center text-[11.5px] text-muted-foreground">No decisions.</p>}
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

const SECTIONS = [
  { key: 'tendencies', label: 'Tendencies' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'decisions', label: 'Decisions' },
]

// First name small, the rest big in the display font, as on the fighter page.
const splitName = (name) => {
  const [first, ...rest] = (name || '').split(' ')
  return rest.length ? [first, rest.join(' ')] : ['', first]
}

// The headline numbers, in the display type the fighter cover uses, on a light card.
function StatStrip({ j }) {
  const accClear = j.eligible && j.acc_above_exp != null && Math.abs(j.acc_above_exp) >= 0.01
  const stats = [
    ['Agrees with stats', pts(j.acc_above_exp), j.pct_acc_above_exp != null ? ordinal(j.pct_acc_above_exp) : null,
      accClear ? (j.acc_above_exp > 0 ? 'text-emerald-600' : 'text-rose-600') : ''],
    ['Scored with stats', pct(j.accuracy), `most ${pct(j.expected_accuracy)}`],
    ['Agrees with panel', pts(j.agree_above_exp), j.pct_agree_above_exp != null ? ordinal(j.pct_agree_above_exp) : null],
    ['In majority', j.deciding_cards],
    ['Dissented', j.dissents ?? '—'],
    ['Robbery cards', j.robbery_cards],
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

// The page's header: the fighter page's slim ink bar, pinned for the whole scroll.
function JudgeBar({ j, active, onTab }) {
  const [first, last] = splitName(j.name)
  return (
    <div className="sticky top-0 z-30 flex h-[52px] items-center gap-3 rounded-xl bg-ink px-3 text-white shadow-lg">
      <BackButton dark fallback="/ufc/officials" className="h-7 w-7" />
      <div className="flex min-w-0 shrink-0 items-baseline gap-1.5">
        {first && <span className="text-[13px] font-semibold text-white/75">{first}</span>}
        <span className="pr-1 font-display text-[24px] font-extrabold italic uppercase leading-none tracking-tight">{last}</span>
      </div>
      <div className="hidden min-w-0 items-center gap-1.5 overflow-hidden xl:flex">
        <HeroChip>{span(j.first_date, j.last_date)}</HeroChip>
        <HeroChip>{j.n_fights.toLocaleString()} fights</HeroChip>
        <HeroChip>{j.n_rounds.toLocaleString()} rounds</HeroChip>
      </div>
      <div className="ml-auto flex min-w-0 shrink overflow-x-auto [scrollbar-width:none]">
        <HeroTabs className="shrink-0" tabs={SECTIONS} value={active} onChange={onTab} />
      </div>
    </div>
  )
}

export default function JudgeProfilePage() {
  const { id } = useParams()
  const { data, error } = useLoad(loadJudge, id)
  const { scrollRef, register, active, scrollTo } = useScrollSpy(SECTIONS, 64)

  if (error) return <ErrorCard>Couldn't load this judge: {error}</ErrorCard>
  if (!data) return <PageLoader />
  const { judge: j, pool, fights } = data

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea viewportRef={scrollRef} className="min-h-0 flex-1" viewportClassName="relative">
        <JudgeBar j={j} active={active} onTab={scrollTo} />
        <div className="mt-2"><StatStrip j={j} /></div>

        <div className="mt-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-col gap-4 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-4">
            <Section id="tendencies" title="Tendencies" register={register}>
              <div className="grid gap-3 lg:grid-cols-3">
                <Leans judge={j} pool={pool} />
                <Rewards judge={j} />
                <TenEight judge={j} />
              </div>
            </Section>
            <Section id="scoring" title="Scoring" register={register}>
              <div className="grid gap-3 lg:grid-cols-2">
                <Misses id={id} />
                <div className="space-y-3">
                  <Partners partners={data.partners} />
                  <YearBars byYear={j.fights_by_year} />
                </div>
              </div>
            </Section>
            <Section id="decisions" title="Decisions" register={register}>
              <Decisions fights={fights} judgeId={j.judge_id} />
            </Section>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

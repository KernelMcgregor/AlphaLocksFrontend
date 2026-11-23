// Bonuses: each card's Fight of the Night and Performances (the likeliest bout, and the
// likeliest winners, as many as UFC gave), newest first; the picked card (?event=) in the
// panel, with a gold mark on what UFC actually gave.
import { ArrowRight, Award, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageLoader from '../PageLoader'
import { ErrorCard } from '../officials/shared'
import { shortDate, useLoad } from '../officials/lib'
import { fetchExcitingCards } from '../../lib/highlightsApi'
import { bonusCall, pctText, resultText, surname, whyExciting, winnerOf } from './fight'
import FitRow from './FitRow'
import { Chip, Face } from './marks'
import FightStage from './FightStage'
import { RankTable, Split } from './layout'
import { useSelect } from './useSelect'
import { useWindow } from './window'

const GRID = 'grid grid-cols-[minmax(190px,1.2fr)_minmax(180px,1fr)_minmax(260px,1.5fr)] items-center gap-4'
const load = (w) => fetchExcitingCards(w, 'full', 1000).then((cards) => [...cards].sort((a, b) => b.date.localeCompare(a.date)))


function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}


// The card's Fight of the Night: both fighters rising out of a dark stage (whole figure,
// never cropped), how it ended, and in a few words why it was a fight.
function FotnCard({ f }) {
  if (!f) return null
  const why = whyExciting(f)
  return (
    <Link to={`/ufc/fights/${f.fight_id}`} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border hover:border-primary/50">
      <FightStage red={f.red} blue={f.blue} winner={f.winner} className="rounded-none" />
      <div className="space-y-1.5 bg-card px-2.5 py-2">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            {resultText(f)}
            {f.fotn && <Award className="h-3.5 w-3.5 text-gold-foreground" />}
          </span>
          <span className="text-right leading-none">
            <span className="block text-[14px] font-extrabold tabular-nums">{pctText(f.p_fotn)}</span>
            <span className="text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">FOTN odds</span>
          </span>
        </div>
        {why.length > 0 && (
          <div className="flex max-h-[52px] flex-wrap gap-1 overflow-hidden">
            {why.map((w) => <Chip key={w} text={w} />)}
          </div>
        )}
      </div>
    </Link>
  )
}

function PerfRow({ f }) {
  const w = winnerOf(f)
  return (
    <Link to={`/ufc/fights/${f.fight_id}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-muted/50">
      <Face fighter={w} className="h-9 w-9" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-extrabold leading-tight">
          <span className="truncate">{w?.name}</span>
          {f.perf && <Zap className="h-3.5 w-3.5 shrink-0 text-gold-foreground" />}
        </span>
        <span className="block text-[10.5px] text-muted-foreground">{resultText(f)}</span>
      </span>
      <span className="text-[12.5px] font-extrabold tabular-nums">{pctText(f.p_perf)}</span>
    </Link>
  )
}

function BonusPanel({ c, panelRef }) {
  const call = bonusCall(c)
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5">
      <div>
        <div className="font-display text-[21px] font-extrabold uppercase italic leading-[1.05] tracking-tight">{c.event_name}</div>
        <div className="mt-1 text-[11.5px] font-semibold tabular-nums text-muted-foreground">{shortDate(c.date)}</div>
      </div>
      <div className="flex min-h-[180px] flex-1 flex-col">
        <Label>Fight of the Night</Label>
        <div className="mt-1.5 flex min-h-0 flex-1 flex-col">
          <FotnCard f={call.fotnPick} />
        </div>
      </div>
      <div className="shrink-0">
        <div className="flex items-baseline justify-between pr-1.5">
          <Label>Performances</Label>
          <span className="text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">Bonus odds</span>
        </div>
        <div className="mt-1">
          {call.perfPicks.map((f) => <PerfRow key={f.fight_id} f={f} />)}
        </div>
      </div>
      <Link
        to={`/ufc/events?event=${c.event_id}`}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Whole card <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default function BonusesView() {
  const w = useWindow()
  const [picked, select, panelRef] = useSelect('event')
  const { data, error } = useLoad(load, w)
  if (error) return <ErrorCard>Couldn't load bonuses: {error}</ErrorCard>
  if (!data) return <PageLoader />
  const selected = data.find((c) => c.event_id === picked) || data[0]
  return (
    <Split panel={selected && <BonusPanel key={selected.event_id} c={selected} panelRef={panelRef} />}>
      <RankTable
        grid={GRID}
        head={(
          <>
            <span>Event</span>
            <span>Fight of the Night</span>
            <span>Performances</span>
          </>
        )}
        rows={data}
        rowKey={(c) => c.event_id}
        selected={selected?.event_id}
        onSelect={select}
        empty="No cards in this window."
        renderRow={(c) => {
          const call = bonusCall(c)
          const f = call.fotnPick
          return (
            <>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold" title={c.event_name}>{c.event_name}</span>
                <span className="block text-[10.5px] font-semibold tabular-nums text-muted-foreground">{shortDate(c.date)}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {f && (
                  <span className="flex shrink-0 gap-0.5">
                    <Face fighter={f.red} className="h-7 w-7" />
                    <Face fighter={f.blue} className="h-7 w-7" />
                  </span>
                )}
                <span className="truncate text-[12.5px] font-semibold">{f ? `${surname(f.red.name, 7)} vs ${surname(f.blue.name, 7)}` : '—'}</span>
              </span>
              <FitRow
                items={call.perfPicks}
                render={(x) => (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-background pl-px pr-2">
                    <Face fighter={winnerOf(x)} className="h-[22px] w-[22px] ring-0" />
                    <span className="whitespace-nowrap text-[12px] font-semibold">{surname(winnerOf(x)?.name || '', 7)}</span>
                  </span>
                )}
              />
            </>
          )
        }}
      />
    </Split>
  )
}

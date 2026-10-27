// Past Events tab: what betting every model pick would have returned, card by card.
//
// Range totals and a cumulative-units line on top, then every event (newest first). Opening
// an event lists each fight with the bets the model made on it and how they settled; "every
// market" also shows the markets where no side cleared the edge bar.
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPastResultsEvent, pastResultsPath, peekCached } from '../../lib/api'
import { cn } from '../../lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { CumulativeChart, KpiRow } from './charts'
import { MARKETS, MARKET_COLOR, SOURCE_BADGE, fmtOdds, fmtPct, fmtRate, fmtUnits, resultsQuery, signCls } from './filters'

const PAGE = 25

function SourceBadges({ sources }) {
  return (sources || []).filter((s) => SOURCE_BADGE[s]).map((s) => (
    <span key={s} title={SOURCE_BADGE[s].title}
      className={cn('ml-1.5 inline-block rounded border px-1 py-px align-middle text-[9.5px] font-bold uppercase tracking-wide', SOURCE_BADGE[s].cls)}>
      {SOURCE_BADGE[s].label}
    </span>
  ))
}

function GroupTable({ byGroup }) {
  const rows = MARKETS.filter((m) => byGroup?.[m.key])
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-[12.5px] tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Market</th><th className="px-2 py-2 text-right">Bets</th>
            <th className="px-2 py-2 text-right">Hit</th><th className="px-2 py-2 text-right">Profit</th>
            <th className="px-3 py-2 text-right">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const t = byGroup[m.key]
            return (
              <tr key={m.key} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-1.5 font-semibold">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: MARKET_COLOR[m.key] }} />
                  {m.label}
                </td>
                <td className="px-2 py-1.5 text-right">{t.n.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right">{fmtRate(t.hit)}</td>
                <td className={cn('px-2 py-1.5 text-right font-semibold', signCls(t.profit))}>{fmtUnits(t.profit)}</td>
                <td className={cn('px-3 py-1.5 text-right font-semibold', signCls(t.roi))}>{fmtPct(t.roi)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SideChip({ s }) {
  const settled = s.bet
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]',
      !settled ? 'border-dashed border-border text-muted-foreground'
        : s.won ? 'border-emerald-200 bg-emerald-50/70' : 'border-red-200 bg-red-50/60')}>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-semibold', settled && 'text-foreground')}>{s.label}</div>
        <div className="text-[10.5px] text-muted-foreground tabular-nums">
          {fmtOdds(s.price)}{s.close_only && ' (close)'} · model {fmtRate(s.p)}{s.q != null && ` · mkt ${fmtRate(s.q)}`}
          {' · '}EV {fmtPct(s.ev)}
          {s.clv != null && settled && ` · CLV ${fmtPct(s.clv)}`}
        </div>
      </div>
      {settled ? (
        <div className="text-right">
          <div className={cn('text-[12.5px] font-bold tabular-nums', signCls(s.profit))}>{fmtUnits(s.profit)}</div>
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">{s.won ? 'Won' : 'Lost'}</div>
        </div>
      ) : <span className="text-[10px] font-semibold uppercase">No bet</span>}
    </div>
  )
}

function FightCard({ f, showAll }) {
  const markets = f.markets
    .map((m) => ({ ...m, sides: showAll ? m.sides : m.sides.filter((s) => s.bet) }))
    .filter((m) => m.sides.length)
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="min-w-0">
          <Link to={`/ufc/fights/${f.fight_id}`} className="text-[13.5px] font-extrabold tracking-tight hover:underline">
            <span className={f.winner_side === 'red' ? '' : 'text-muted-foreground'}>{f.red}</span>
            <span className="mx-1.5 font-normal text-muted-foreground">vs</span>
            <span className={f.winner_side === 'blue' ? '' : 'text-muted-foreground'}>{f.blue}</span>
          </Link>
          <div className="text-[11px] text-muted-foreground">
            {f.section} · {f.weight_class?.replace(/ Bout$/, '')} · {f.result}<SourceBadges sources={f.sources} />
          </div>
        </div>
        <div className="text-right text-[12px] tabular-nums">
          {f.n ? (
            <><b className={signCls(f.profit)}>{fmtUnits(f.profit)}</b><span className="text-muted-foreground"> on {f.n} bet{f.n > 1 ? 's' : ''}</span></>
          ) : <span className="text-muted-foreground">No bets</span>}
        </div>
      </div>
      {markets.length ? (
        <div className="space-y-2">
          {markets.map((m) => (
            <div key={m.market}>
              <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: MARKET_COLOR[m.group] }} />{m.market}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {m.sides.map((s) => <SideChip key={s.market_key} s={s} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">No side cleared the edge bar in any priced market.</p>
      )}
    </div>
  )
}

function EventDetail({ eventId, filters }) {
  const q = resultsQuery(filters, { dates: false })
  const path = pastResultsPath.event(eventId, q)
  // answers keyed by path, so a filter change never shows another view's numbers
  const [got, setGot] = useState({})
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    let live = true
    fetchPastResultsEvent(eventId, q)
      .then((d) => live && setGot((g) => ({ ...g, [path]: { data: d } })))
      .catch((e) => live && setGot((g) => ({ ...g, [path]: { error: e.message } })))
    return () => { live = false }
  }, [eventId, q, path])
  const data = got[path]?.data || peekCached(path)
  if (got[path]?.error) return <p className="p-3 text-[12.5px] text-destructive">{got[path].error}</p>
  if (!data) return <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
  return (
    <div className="space-y-2.5 bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] tabular-nums">
          {MARKETS.filter((m) => data.by_group[m.key]?.n).map((m) => (
            <span key={m.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: MARKET_COLOR[m.key] }} />
              {m.label}: <b className={signCls(data.by_group[m.key].profit)}>{fmtUnits(data.by_group[m.key].profit)}</b>
              <span className="text-muted-foreground">({data.by_group[m.key].n})</span>
            </span>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <Checkbox className="size-4 rounded-[4px] border-border" checked={showAll} onCheckedChange={(c) => setShowAll(!!c)} />
          Show every market
        </label>
      </div>
      {data.props_close_only && (
        <p className="text-[11px] text-muted-foreground">Props are priced at the close: no opening prop prices exist for past cards.</p>
      )}
      {data.watch_prices && (
        <p className="text-[11px] text-muted-foreground">
          Prices for this card come from our line watcher (BestFightOdds every two hours): the opener is the first price it saw, the close the last before the bout started.
        </p>
      )}
      <div className="space-y-2">
        {data.fights.map((f) => <FightCard key={f.fight_id} f={f} showAll={showAll} />)}
      </div>
    </div>
  )
}

export default function PastEventsTab({ data, filters, eventId, onEvent }) {
  const [shown, setShown] = useState(PAGE)
  const events = data.events
  // keep the opened event visible even when it sits past the first page
  const openIdx = events.findIndex((e) => e.event_id === eventId)
  const limit = Math.max(shown, openIdx + 1)
  return (
    <div className="space-y-4">
      <KpiRow totals={data.totals} extra={[]} />
      {data.props_close_only && (
        <p className="-mt-2 text-[11.5px] text-muted-foreground">
          Moneyline bets use the <b>opening</b> line. Props are settled at the <b>closing</b> price: there are no opening prop prices for past cards.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,380px)]">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-1 text-[13px] font-extrabold tracking-tight">Cumulative profit</div>
          <div className="mb-2 text-[11px] text-muted-foreground">Units won or lost, card by card. Click a point to open that event.</div>
          <CumulativeChart data={data.cumulative} series={[{ key: 'cumulative', label: 'All picks', color: 'var(--color-viz-1)' }]}
            onPoint={(p) => onEvent(p.event_id)} />
        </div>
        <GroupTable byGroup={data.by_group} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="w-6 py-2 pl-3" /><th className="px-2 py-2">Event</th>
              <th className="hidden px-2 py-2 text-right sm:table-cell">Fights</th>
              <th className="px-2 py-2 text-right">Bets</th><th className="hidden px-2 py-2 text-right sm:table-cell">Hit</th>
              <th className="px-2 py-2 text-right">Profit</th><th className="px-3 py-2 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, limit).map((e) => {
              const open = e.event_id === eventId
              return [
                <tr key={e.event_id} onClick={() => onEvent(open ? null : e.event_id)}
                  className={cn('cursor-pointer border-b border-border/60 hover:bg-muted/40', open && 'bg-muted/40')}>
                  <td className="py-2 pl-3 text-muted-foreground">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold">{e.name}<SourceBadges sources={e.sources} /></div>
                    <div className="text-[11px] text-muted-foreground">{e.date}</div>
                  </td>
                  <td className="hidden px-2 py-2 text-right sm:table-cell">{e.fights}</td>
                  <td className="px-2 py-2 text-right">{e.n}</td>
                  <td className="hidden px-2 py-2 text-right sm:table-cell">{fmtRate(e.hit)}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold', signCls(e.profit))}>{fmtUnits(e.profit)}</td>
                  <td className={cn('px-3 py-2 text-right font-semibold', signCls(e.roi))}>{fmtPct(e.roi)}</td>
                </tr>,
                open && (
                  <tr key={`${e.event_id}-detail`} className="border-b border-border/60">
                    <td colSpan={7} className="p-0"><EventDetail eventId={e.event_id} filters={filters} /></td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
        {limit < events.length && (
          <button type="button" onClick={() => setShown((n) => n + PAGE)}
            className="w-full border-t border-border py-2 text-[12px] font-semibold text-primary hover:bg-muted/40">
            Show more events ({events.length - limit} left)
          </button>
        )}
        {!events.length && <p className="p-4 text-[12.5px] text-muted-foreground">No backtested events in this range.</p>}
      </div>
    </div>
  )
}

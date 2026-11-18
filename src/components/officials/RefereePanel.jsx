// Side panel on the Officials page's Referees view: the selected referee in plain terms,
// with the way into the full profile. The referee-side twin of JudgePanel.
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clock, cn } from '../../lib/utils'
import { fetchReferee } from '../../lib/officialsApi'
import { METHODS, ordinal, pct, shortDate, span, stoppageFmt, stoppageWord, useLoad } from './lib'

function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}

function Rate({ label, value, sub, cls }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
      <span className={cn('text-[18px] font-extrabold leading-none tabular-nums', cls)}>{value}</span>
      <span className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{sub}</span>
    </div>
  )
}

function Count({ label, value }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg border border-border py-1">
      <span className="text-[15px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

// `large`: the profile page's version, sized to fill its box.
export function MethodBar({ methods, large }) {
  const segs = METHODS.filter((m) => methods?.[m.key])
  const total = segs.reduce((a, m) => a + methods[m.key], 0) || 1
  return (
    <div>
      <div className={cn('flex overflow-hidden rounded-full bg-muted', large ? 'h-5' : 'h-2.5')}>
        {segs.map((m) => <div key={m.key} className={m.cls} style={{ width: `${(methods[m.key] / total) * 100}%` }} />)}
      </div>
      <div className={cn('flex flex-wrap', large ? 'mt-3 gap-x-4 gap-y-1.5 text-[13px]' : 'mt-1.5 gap-x-3 gap-y-0.5 text-[10.5px]')}>
        {segs.map((m) => (
          <span key={m.key} className="flex items-center gap-1">
            <span className={cn('rounded-full', large ? 'h-2.5 w-2.5' : 'h-2 w-2', m.cls)} />
            <span className="text-muted-foreground">{m.label}</span>
            <b className="tabular-nums">{pct(methods[m.key] / total, 0)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

const ROW_H = 32
const loadReferee = (id) => fetchReferee(id)

// Their most recent strike stoppages, as many as fit the space left (measured, so the
// panel never scrolls), stretched to share what remains.
function Stoppages({ fights }) {
  const box = useRef(null)
  const [space, setSpace] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setSpace(e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const stops = (fights || []).filter((f) => f.absorbed != null)
  const rows = stops.slice(0, Math.floor(space / ROW_H))
  const rowH = rows.length ? Math.min(ROW_H + 12, space / rows.length) : ROW_H
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Label>Latest strike stoppages</Label>
      <div ref={box} className="mt-0.5 min-h-0 flex-1 overflow-hidden">
        {rows.map((f) => {
          const [winner, loser] = f.winner > 0 ? [f.red_name, f.blue_name] : [f.blue_name, f.red_name]
          return (
            <Link key={f.fight_id} to={`/ufc/fights/${f.fight_id}`} style={{ height: rowH }}
              className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 hover:bg-muted/50">
              <span className="text-[10.5px] font-bold tabular-nums text-muted-foreground">R{f.finish_round} {f.finish_time}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px]"><b className="font-bold">{winner}</b><span className="text-muted-foreground"> over {loser}</span></span>
                <span className="block truncate text-[10px] text-muted-foreground">{shortDate(f.date)}</span>
              </span>
              <span className="text-right text-[11px] font-bold tabular-nums">{f.absorbed}{f.absorbed_expected != null && <span className="font-normal text-muted-foreground"> / {Math.round(f.absorbed_expected)} exp.</span>}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function RefereePanel({ referee: r, panelRef }) {
  const { data } = useLoad(loadReferee, r?.referee_id)
  if (!r) return null
  const d = data?.referee
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3.5">
      <div>
        <div className="truncate text-lg font-extrabold leading-tight tracking-tight">{r.name}</div>
        <div className="mt-0.5 truncate whitespace-nowrap text-[12px] font-semibold tabular-nums text-muted-foreground">
          {span(r.first_date, r.last_date)}
          <span className="mx-1.5 text-muted-foreground/50">·</span>{r.n_fights.toLocaleString()} UFC fights
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Rate label="Finish rate" value={pct(r.finish_rate, 0)} sub={r.pct_finish != null ? `${ordinal(r.pct_finish)} percentile` : '—'} />
        <Rate
          label="Stoppages"
          value={stoppageFmt(r.stoppage_index)}
          sub={stoppageWord(r.stoppage_index)}
          cls={stoppageWord(r.stoppage_index) === 'Average' ? '' : r.stoppage_index > 0 ? 'text-viz-1' : 'text-viz-neg'}
        />
      </div>

      <div>
        <Label>How their fights end</Label>
        <div className="mt-1.5">{d ? <MethodBar methods={d.methods} /> : <div className="h-8" />}</div>
      </div>

      <div>
        <Label>Discipline &amp; pace</Label>
        <div className="mt-1 flex gap-2">
          <Count label="Ded. / 100" value={r.deductions_per_100 == null ? '—' : r.deductions_per_100.toFixed(1)} />
          <Count label="DQ rate" value={r.dq_rate ? pct(r.dq_rate, 1) : '—'} />
          <Count label="Avg finish" value={d?.mean_finish_seconds != null ? clock(d.mean_finish_seconds) : '—'} />
        </div>
      </div>

      <Stoppages fights={data?.fights} />

      <Link
        to={`/ufc/referees/${r.referee_id}`}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Full profile <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// Closing line value of the model's moneyline view (Past Model Results, "Line value" tab).
//
// Per fight the model's own probability picks a side against the de-vigged opening line; CLV is
// how far the close moved toward that side. Backed by /ufc/model/clv
// (alocks-backend/app/services/ufc/markets_clv.py).
//
// Colour jobs: gains emerald, losses the page's muted rose (toneCls), the running average in
// text ink. One unit (probability points) on every axis.
import { useEffect, useState } from 'react'
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { peekCached } from '../../lib/api'
import { cn } from '../../lib/utils'
import { fetchModelClv, modelClvPath } from '../../lib/marketsApi'
import PageLoader from '../PageLoader'
import { toneCls } from '../results/charts'
import { fmtPct, fmtRate } from '../results/filters'
import { SlideTabs } from '../ui/slide-tabs'

const CARD = 'rounded-2xl border border-border bg-card shadow-sm'
const TH = 'pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'
const UP = 'var(--color-emerald-500, #10b981)'
const DOWN = '#c48b97'
const SOURCES = [
  { key: 'all', label: 'All fights' },
  { key: 'live', label: 'Served live' },
]
const axis = { fontSize: 10.5, fill: 'var(--color-muted-foreground)' }
const pts = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })

function Panel({ title, right, children, className }) {
  return (
    <section className={cn(CARD, 'px-4 py-3.5', className)}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-extrabold tracking-tight">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Tile({ value, label, tone }) {
  return (
    <div className={cn(CARD, 'rounded-[14px] px-4 py-3')}>
      <div className={cn('text-[24px] font-extrabold tabular-nums', tone === undefined ? '' : toneCls(tone))}>{value}</div>
      <div className="text-[11.5px] font-semibold text-muted-foreground">{label}</div>
    </div>
  )
}

function TipBox({ children }) {
  return <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11.5px] shadow-md">{children}</div>
}

/** Monthly average CLV as bars either side of zero, with the running average through it. */
function MonthlyChart({ rows }) {
  const data = rows.map((r) => ({ ...r, bar: r.avg_clv * 100, cum: r.cum_avg_clv * 100 }))
  const lim = Math.max(2, ...data.map((r) => Math.abs(r.bar)))
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }} barCategoryGap={2}>
        <CartesianGrid strokeDasharray="2 4" className="stroke-border" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickFormatter={monthLabel} minTickGap={28} stroke="currentColor"
          className="text-muted-foreground" />
        <YAxis domain={[-Math.ceil(lim), Math.ceil(lim)]} tick={axis} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
          stroke="currentColor" className="text-muted-foreground" />
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.35} />
        <Tooltip cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }} content={({ active, payload }) => {
          const r = active && payload?.[0]?.payload
          if (!r) return null
          return (
            <TipBox>
              <div className="font-bold">{monthLabel(r.month)} · {r.n} fights</div>
              <div className={toneCls(r.avg_clv)}>Avg. CLV {fmtPct(r.avg_clv)}</div>
              <div>Moved toward the model {fmtRate(r.toward)}</div>
              <div className="text-muted-foreground">Running avg. {fmtPct(r.cum_avg_clv)}</div>
            </TipBox>
          )
        }} />
        <Bar dataKey="bar" radius={[2, 2, 2, 2]} isAnimationActive={false}>
          {data.map((r) => <Cell key={r.month} fill={r.bar >= 0 ? UP : DOWN} fillOpacity={0.75} />)}
        </Bar>
        <Line dataKey="cum" type="monotone" stroke="var(--color-foreground)" strokeWidth={2} dot={false}
          isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Average CLV per opening-edge band: does a bigger disagreement with the open earn more movement? */
function EdgeBands({ rows }) {
  const lim = Math.max(0.01, ...rows.map((r) => Math.abs(r.avg_clv ?? 0)))
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-[64px_1fr_52px_52px_44px] gap-2">
        <span className={TH}>Edge</span><span className={TH}>Avg. CLV</span>
        <span className={cn(TH, 'text-right')}>Toward</span><span className={cn(TH, 'text-right')}>Won</span>
        <span className={cn(TH, 'text-right')}>N</span>
      </div>
      {rows.map((r) => (
        <div key={r.band} className={cn('grid grid-cols-[64px_1fr_52px_52px_44px] items-center gap-2 text-[12px]', !r.n && 'opacity-40')}>
          <span className="font-bold tabular-nums">{r.band}</span>
          <span className="flex items-center gap-2">
            <span className="relative h-2.5 flex-1">
              <span className="absolute inset-y-0 left-0 rounded-r-[4px]"
                style={{ width: `${(Math.abs(r.avg_clv ?? 0) / lim) * 100}%`, background: (r.avg_clv ?? 0) >= 0 ? UP : DOWN, opacity: 0.75 }} />
            </span>
            <span className={cn('w-12 text-right tabular-nums', toneCls(r.avg_clv))}>{fmtPct(r.avg_clv)}</span>
          </span>
          <span className="text-right tabular-nums">{fmtRate(r.toward)}</span>
          <span className="text-right tabular-nums text-muted-foreground">{fmtRate(r.win_rate)}</span>
          <span className="text-right tabular-nums text-muted-foreground">{r.n?.toLocaleString() ?? 0}</span>
        </div>
      ))}
    </div>
  )
}

function RecentTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[12px]">
        <thead>
          <tr className="text-left">
            <th className={TH}>Date</th><th className={TH}>Model side</th>
            <th className={cn(TH, 'text-right')}>Model</th><th className={cn(TH, 'text-right')}>Open</th>
            <th className={cn(TH, 'text-right')}>Close</th><th className={cn(TH, 'text-right')}>CLV</th>
            <th className={cn(TH, 'text-right')}>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fight_id} className="border-t border-border/60">
              <td className="py-1 tabular-nums text-muted-foreground">{r.date}</td>
              <td className="py-1">
                <span className="font-semibold">{r.pick_name}</span>
                <span className="text-muted-foreground"> vs {r.side === 'red' ? r.blue_name : r.red_name}</span>
              </td>
              <td className="py-1 text-right tabular-nums">{pts(r.p)}</td>
              <td className="py-1 text-right tabular-nums text-muted-foreground">{pts(r.q_open)}</td>
              <td className="py-1 text-right tabular-nums">{pts(r.q_close)}</td>
              <td className={cn('py-1 text-right font-bold tabular-nums', toneCls(r.clv))}>{fmtPct(r.clv)}</td>
              <td className={cn('py-1 text-right font-semibold', r.won ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                {r.won ? 'Won' : 'Lost'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ClvPanel({ filters }) {
  const [source, setSource] = useState('all')
  const params = { source, start: filters?.from, end: filters?.to }
  const path = modelClvPath(params)
  const [got, setGot] = useState({})

  useEffect(() => {
    let live = true
    fetchModelClv({ source, start: filters?.from, end: filters?.to })
      .then((d) => live && setGot((g) => ({ ...g, [path]: { data: d }, last: d })))
      .catch((e) => live && setGot((g) => ({ ...g, [path]: { error: e.message } })))
    return () => { live = false }
  }, [path, source, filters?.from, filters?.to])

  const fresh = got[path]?.data || peekCached(path)
  const data = fresh || got.last
  if (got[path]?.error) return <p className="text-destructive">Couldn't load line value: {got[path].error}</p>
  if (!data) return <PageLoader />
  const s = data.summary || {}

  return (
    <div className={cn('flex flex-col gap-3', !fresh && 'pointer-events-none opacity-60')}>
      <div className="flex justify-end">
        <SlideTabs tabs={SOURCES} value={source} onChange={setSource} size="sm" />
      </div>
      {!s.n ? (
        <Panel title="Closing line value"><p className="py-6 text-center text-[12px] text-muted-foreground">No priced fights in this range.</p></Panel>
      ) : (
        <>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <Tile value={s.n.toLocaleString()} label="Fights with a model side" />
            <Tile value={fmtPct(s.avg_edge)} label="Avg. edge vs the open" />
            <Tile value={fmtPct(s.avg_clv)} label="Avg. move toward the model" tone={s.avg_clv} />
            <Tile value={fmtRate(s.toward)} label="Closed toward the model" tone={s.toward - s.against} />
          </div>

          {data.timeline.length > 1 && (
            <Panel title="Closing line value by month"
              right={(
                <div className="flex gap-3 text-[11px] font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: UP }} />Month</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-foreground" />Running avg.</span>
                </div>
              )}>
              <MonthlyChart rows={data.timeline} />
            </Panel>
          )}

          <div className="flex flex-wrap gap-3">
            <Panel className="flex-[1_1_340px]" title="By edge at the open">
              <EdgeBands rows={data.by_edge} />
            </Panel>
            <Panel className="flex-[2_1_520px]" title={source === 'live' ? 'Served predictions' : 'Latest fights'}>
              <RecentTable rows={data.recent.slice(0, 25)} />
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

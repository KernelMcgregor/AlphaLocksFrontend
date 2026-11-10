// Charts for Past Model Results.
//
// Colour jobs:
//   - market identity (Moneyline, Method, ...) = the validated family slots --color-fam-1..5,
//     assigned by market in a FIXED order, so filtering markets never repaints the survivors;
//   - gains = emerald; losses = a muted rose (toneCls) so a red card reads as a normal part of
//     variance, not an alarm. Values are always printed in text ink beside the mark.
import { useId, useMemo, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { cn } from '../../lib/utils'
import { fmtPct, fmtRate, fmtUnits } from './filters'

/** Text colour for a signed number: emerald up, muted rose down. */
export const toneCls = (x) => (x == null || Math.abs(x) < 1e-9
  ? 'text-muted-foreground'
  : x > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#9f4a5c] dark:text-rose-300')

const axis = { fontSize: 10.5, fill: 'var(--color-muted-foreground)' }

function TipBox({ children }) {
  return <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11.5px] shadow-md">{children}</div>
}

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
const longDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** Hero bankroll chart: cumulative units as a filled area, all-time-high marker, hover scrubber.
 *  rows: [{ event_id, date, name, profit, [valueKey]: running units }], oldest first. */
export function GrowthChart({ data, valueKey = 'cumulative', height = 262, onPoint, short = false }) {
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState(null)
  const g = useMemo(() => {
    if (!data?.length) return null
    // the series may be an all-time running total; rebase so the range starts at 0
    const base = (data[0][valueKey] ?? 0) - (data[0].profit ?? 0)
    const vals = [0, ...data.map((r) => (r[valueKey] ?? base) - base)]
    const n = vals.length - 1
    const lo0 = Math.min(0, ...vals), hi0 = Math.max(1, ...vals), pad = (hi0 - lo0) * 0.1
    const lo = lo0 - pad * 0.4, hi = hi0 + pad * 1.6
    const Y = (v) => 6 + ((hi - v) / (hi - lo)) * 238
    const X = (i) => (n ? (i / n) * 1000 : 0)
    const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')
    const area = `${line}L1000,${Y(0).toFixed(1)}L0,${Y(0).toFixed(1)}Z`
    const raw = (hi0 - lo0) / 4, mag = 10 ** Math.floor(Math.log10(raw || 1))
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw) || 10 * mag
    const yTicks = []
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v)
    let ath = 0, athI = 0
    vals.forEach((v, i) => { if (v >= ath) { ath = v; athI = i } })
    const xTicks = []; let lastL = -99
    data.forEach((r, i) => {
      const k = short ? r.date.slice(0, 7) : r.date.slice(0, 4)
      const prev = data[i - 1]
      if (prev && (short ? prev.date.slice(0, 7) : prev.date.slice(0, 4)) === k) return
      const left = ((i + 1) / Math.max(1, n)) * 100
      if (left - lastL < 7 || left > 97) return
      lastL = left
      xTicks.push({ left, label: short ? new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' }) : k })
    })
    return { vals, n, Y, X, line, area, yTicks, ath, athI, xTicks }
  }, [data, valueKey, short])
  if (!g) return null
  const pct = (y) => `${(y / 250) * 100}%`
  const athLeft = g.X(g.athI) / 10
  const idx = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.min(g.n, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * g.n)))
  }
  const h = hover != null ? { i: hover, row: data[hover - 1], left: (hover / g.n) * 100 } : null
  const tickLabel = (v) => (Math.abs(v) < 1e-9 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(+v.toFixed(1))}u`)

  return (
    <div>
      <div className="relative ml-[46px]" style={{ height }}>
        {g.yTicks.map((v) => (
          <div key={v}>
            <div className={cn('absolute inset-x-0 border-t', Math.abs(v) < 1e-9 ? 'border-muted-foreground/30' : 'border-border/60')} style={{ top: pct(g.Y(v)) }} />
            <span className="absolute -left-[46px] w-10 -translate-y-1/2 text-right text-[10.5px] tabular-nums text-muted-foreground" style={{ top: pct(g.Y(v)) }}>{tickLabel(v)}</span>
          </div>
        ))}
        <svg viewBox="0 0 1000 250" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="1" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={g.area} fill={`url(#${gid})`} />
          <path d={g.line} fill="none" stroke="#059669" strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute -ml-[4.5px] -mt-[4.5px] h-[9px] w-[9px] rounded-full border-2 border-emerald-600 bg-card"
          style={{ left: `${athLeft}%`, top: pct(g.Y(g.ath)) }} />
        <div className="absolute -mt-[26px] whitespace-nowrap rounded-[5px] border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-extrabold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          style={{ left: `${athLeft}%`, top: pct(g.Y(g.ath)), transform: athLeft > 85 ? 'translateX(-100%)' : athLeft < 10 ? 'none' : 'translateX(-50%)' }}>
          ATH {fmtUnits(g.ath)}
        </div>
        {h && (
          <>
            <div className="absolute inset-y-0 w-px bg-muted-foreground/50" style={{ left: `${h.left}%` }} />
            <div className="absolute -ml-[5.5px] -mt-[5.5px] h-[11px] w-[11px] rounded-full border-2 border-card bg-emerald-600 ring-1 ring-emerald-600"
              style={{ left: `${h.left}%`, top: pct(g.Y(g.vals[h.i])) }} />
            <div className="pointer-events-none absolute top-1.5 z-[3] min-w-[170px] rounded-[9px] bg-slate-900 px-2.5 py-2 text-white shadow-xl"
              style={{ left: `${h.left}%`, transform: h.left < 15 ? 'translateX(8px)' : h.left > 80 ? 'translateX(calc(-100% - 8px))' : 'translateX(-50%)' }}>
              <div className="text-[11px] font-semibold text-slate-400">{h.row ? longDate(h.row.date) : 'Start of range'}</div>
              <div className="mt-px whitespace-nowrap text-[12.5px] font-bold">{h.row?.name || '—'}</div>
              <div className="mt-1.5 flex justify-between gap-3 text-[12px] tabular-nums text-slate-300">
                <span>This card <b className={h.row?.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}>{h.row ? fmtUnits(h.row.profit) : '—'}</b></span>
                <span>Total <b className="text-emerald-300">{fmtUnits(g.vals[h.i])}</b></span>
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0 z-[2] cursor-crosshair"
          onMouseMove={(e) => { const i = idx(e); if (i !== hover) setHover(i) }}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => { const r = data[idx(e) - 1]; if (r && onPoint) onPoint(r) }} />
      </div>
      <div className="relative ml-[46px] mt-1 h-[18px]">
        {g.xTicks.map((t) => (
          <span key={t.left} className="absolute -translate-x-1/2 text-[10.5px] font-semibold text-muted-foreground" style={{ left: `${t.left}%` }}>{t.label}</span>
        ))}
      </div>
    </div>
  )
}

/** Tiny trend line for a market card. */
export function Sparkline({ values, color, className }) {
  if (!values?.length) return <div className={cn('h-8 w-20', className)} />
  const vs = [0, ...values]
  const mn = Math.min(0, ...vs), mx = Math.max(0.5, ...vs)
  const d = vs.map((v, i) => `${i ? 'L' : 'M'}${((i / (vs.length - 1)) * 100).toFixed(1)},${(30 - ((v - mn) / (mx - mn)) * 28).toFixed(1)}`).join('')
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn('h-8 w-20 shrink-0 overflow-visible', className)}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** Cumulative units, one point per event. series: [{ key, label, color }] over rows of
 *  { date, name?, [key]: cumulative units }. */
export function CumulativeChart({ data, series, height = 220, onPoint }) {
  if (!data?.length) return null
  const many = series.length > 1
  return (
    <div>
      {many && (
        <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 4 }}
          onClick={(e) => onPoint && e?.activePayload?.[0] && onPoint(e.activePayload[0].payload)}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={shortDate} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}u`} />
          <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ stroke: 'var(--color-muted-foreground)', strokeOpacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const r = payload[0].payload
              return (
                <TipBox>
                  <div className="font-semibold">{r.name || r.date}</div>
                  <div className="mb-1 text-muted-foreground">{r.date}</div>
                  {r.profit != null && <div>This card: <b className="tabular-nums">{fmtUnits(r.profit)}</b></div>}
                  {series.map((s) => r[s.key] != null && (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span className="h-0.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.label}: <b className="tabular-nums">{fmtUnits(r[s.key])}</b>
                    </div>
                  ))}
                </TipBox>
              )
            }}
          />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} type="linear" stroke={s.color} strokeWidth={2}
              dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** ROI as a bar diverging from zero, with its bootstrap 95% CI as a whisker. The axis is
 *  shared by every row of a table (`domain`), so bars compare across rows. `expected` (optional)
 *  draws the model's claimed edge as a grey bar above, for promised-vs-delivered rows. */
export function RoiBar({ roi, ci, domain = 0.4, muted, expected }) {
  const clamp = (x) => Math.max(-domain, Math.min(domain, x))
  const pos = (x) => 50 + (clamp(x) / domain) * 50
  const r = roi ?? 0
  const left = Math.min(pos(0), pos(r)), width = Math.abs(pos(r) - pos(0))
  const tall = expected != null
  return (
    <div className={cn('relative w-full min-w-[120px]', tall ? 'h-[34px]' : 'h-4', muted && 'opacity-45')} aria-hidden>
      <div className="absolute inset-y-1 left-1/2 w-px bg-muted-foreground/40" />
      {tall && (
        <div className="absolute top-2 h-[7px] rounded-r-[3px] bg-slate-300 dark:bg-slate-600"
          style={{ left: `${pos(Math.min(0, expected))}%`, width: `${Math.abs(pos(expected) - 50)}%` }} />
      )}
      {ci && (
        <div className={cn('absolute h-px bg-foreground/45', tall ? 'top-[22px]' : 'top-1/2')}
          style={{ left: `${pos(ci[0])}%`, width: `${pos(ci[1]) - pos(ci[0])}%` }}>
          <span className="absolute -top-[3px] left-0 h-[7px] w-px bg-foreground/45" />
          <span className="absolute -top-[3px] right-0 h-[7px] w-px bg-foreground/45" />
        </div>
      )}
      <div className={cn('absolute rounded-[3px]', tall ? 'top-[18px] h-[9px]' : 'top-1/2 h-2 -translate-y-1/2',
        r >= 0 ? 'bg-emerald-500' : 'bg-rose-300 dark:bg-rose-800')}
        style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }} />
    </div>
  )
}

/** Predicted probability vs how often it happened, model and market, with the diagonal. */
export function CalibrationChart({ bins, height = 300 }) {
  const pts = (k) => bins.filter((b) => b[k].n >= 30 && b[k].pred != null)
    .map((b) => ({ x: b[k].pred * 100, y: b[k].actual * 100, n: b[k].n }))
  const model = pts('model'), market = pts('market')
  if (!model.length) return null
  const series = [
    { key: 'market', label: 'Market (de-vigged)', color: 'var(--color-muted-foreground)', data: market, opacity: 0.45 },
    { key: 'model', label: 'Model', color: 'var(--color-fam-1)', data: model, opacity: 1 },
  ]
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-x-3 text-[11px] font-semibold text-muted-foreground">
        {[...series].reverse().map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color, opacity: s.opacity }} />{s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-px w-3.5 border-t border-dashed border-muted-foreground" />Perfect</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 6, right: 12, bottom: 14, left: -8 }}>
          <CartesianGrid stroke="var(--color-border)" />
          <XAxis type="number" dataKey="x" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={axis}
            tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`}
            label={{ value: 'Predicted', position: 'insideBottom', offset: -8, ...axis }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={axis}
            tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
          <ZAxis range={[64, 64]} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--color-muted-foreground)"
            strokeDasharray="4 4" strokeOpacity={0.6} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return (
                <TipBox>
                  <div className="font-semibold">{payload[0].name}</div>
                  Predicted {p.x.toFixed(1)}% · happened {p.y.toFixed(1)}%
                  <div className="text-muted-foreground">{p.n.toLocaleString()} outcomes</div>
                </TipBox>
              )
            }}
          />
          {series.map((s) => (
            <Scatter key={s.key} name={s.label} data={s.data} fill={s.color} fillOpacity={s.opacity}
              line={{ stroke: s.color, strokeWidth: 2, strokeOpacity: s.opacity }}
              stroke="var(--color-card)" strokeWidth={2} isAnimationActive={false} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Big-number tile row (kept for other pages that import it). */
export function KpiRow({ totals, extra }) {
  const t = totals || {}
  const tiles = [
    { label: 'Bets (1u each)', value: (t.n ?? 0).toLocaleString() },
    { label: 'Profit', value: fmtUnits(t.profit), tone: t.profit },
    { label: 'ROI', value: fmtPct(t.roi), tone: t.roi, sub: t.ci ? `95% CI ${fmtPct(t.ci[0], 0)} to ${fmtPct(t.ci[1], 0)}` : null },
    { label: 'Hit rate', value: fmtRate(t.hit), sub: t.avg_price != null ? `median price ${t.avg_price > 0 ? '+' : ''}${t.avg_price}` : null },
    { label: 'Avg. expected edge', value: fmtPct(t.avg_ev) },
    ...(extra || []),
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {tiles.map((x) => (
        <div key={x.label} className="rounded-xl border border-border bg-card px-3 py-2.5">
          <div className={cn('text-xl font-extrabold tabular-nums leading-tight', x.tone == null ? 'text-foreground' : toneCls(x.tone))}>
            {x.value}
          </div>
          <div className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{x.label}</div>
          {x.sub && <div className="text-[10px] text-muted-foreground">{x.sub}</div>}
        </div>
      ))}
    </div>
  )
}

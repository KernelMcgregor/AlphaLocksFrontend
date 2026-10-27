// Charts for Past Model Results.
//
// Colour jobs:
//   - market identity (Moneyline, Method, ...) = the validated family slots --color-fam-1..5,
//     assigned by market in a FIXED order, so filtering markets never repaints the survivors;
//   - ROI polarity = the diverging pair --color-viz-1 (gain) / --color-viz-neg (loss) about a
//     gray zero line. Values are always printed in text ink beside the mark.
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { cn } from '../../lib/utils'
import { fmtPct, fmtRate, fmtUnits } from './filters'

const axis = { fontSize: 10.5, fill: 'var(--color-muted-foreground)' }

function TipBox({ children }) {
  return <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11.5px] shadow-md">{children}</div>
}

const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })

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
 *  shared by every row of a table (`domain`), so bars compare across rows. */
export function RoiBar({ roi, ci, domain = 0.4, muted }) {
  const clamp = (x) => Math.max(-domain, Math.min(domain, x))
  const pos = (x) => 50 + (clamp(x) / domain) * 50
  const r = roi ?? 0
  const left = Math.min(pos(0), pos(r)), width = Math.abs(pos(r) - pos(0))
  return (
    <div className={cn('relative h-4 w-full min-w-[120px]', muted && 'opacity-45')} aria-hidden>
      <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/40" />
      {ci && (
        <div className="absolute top-1/2 h-px bg-foreground/45"
          style={{ left: `${pos(ci[0])}%`, width: `${pos(ci[1]) - pos(ci[0])}%` }}>
          <span className="absolute -top-[3px] left-0 h-[7px] w-px bg-foreground/45" />
          <span className="absolute -top-[3px] right-0 h-[7px] w-px bg-foreground/45" />
        </div>
      )}
      <div className="absolute top-1/2 h-2 -translate-y-1/2"
        style={{
          left: `${left}%`, width: `${Math.max(width, 0.6)}%`,
          background: r >= 0 ? 'var(--color-viz-1)' : 'var(--color-viz-neg)',
          borderRadius: r >= 0 ? '0 4px 4px 0' : '4px 0 0 4px',
        }} />
    </div>
  )
}

/** Predicted probability vs how often it happened, model and market, with the diagonal. */
export function CalibrationChart({ bins, height = 260 }) {
  const pts = (k) => bins.filter((b) => b[k].n >= 30 && b[k].pred != null)
    .map((b) => ({ x: b[k].pred * 100, y: b[k].actual * 100, n: b[k].n }))
  const model = pts('model'), market = pts('market')
  if (!model.length) return null
  const series = [
    { key: 'model', label: 'Model alone', color: 'var(--color-fam-1)', data: model },
    { key: 'market', label: 'Market (de-vigged)', color: 'var(--color-fam-2)', data: market },
  ]
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
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
            <Scatter key={s.key} name={s.label} data={s.data} fill={s.color} line={{ stroke: s.color, strokeWidth: 2 }}
              stroke="var(--color-card)" strokeWidth={2} isAnimationActive={false} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Big-number tile row used at the top of both tabs. */
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
          <div className={cn('text-xl font-extrabold tabular-nums leading-tight',
            x.tone == null ? 'text-foreground' : x.tone > 0 ? 'text-emerald-600' : x.tone < 0 ? 'text-red-500' : 'text-foreground')}>
            {x.value}
          </div>
          <div className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{x.label}</div>
          {x.sub && <div className="text-[10px] text-muted-foreground">{x.sub}</div>}
        </div>
      ))}
    </div>
  )
}

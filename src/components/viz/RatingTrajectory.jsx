import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useElementSize } from './hooks'

// Round tick values (1, 2, 5 x 10^n steps) spanning [lo, hi].
function niceTicks(lo, hi, count = 4) {
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const out = []
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.5; v += step) out.push(Number(v.toFixed(6)))
  return out
}

// A rating through a career, one slot per bout: the line is the rating going INTO each
// bout (dot filled by that bout's result), and the panel underneath is what the bout did
// to it. Two panels with their own scales, stacked on one x — never two scales on one plot.
//
// points: [{ id, label, rating, delta, result, title, sub, rows: [[k, v], ...] }]
export default function RatingTrajectory({ points, formatValue = (v) => String(Math.round(v)), height = 250 }) {
  const [wrapRef, { w }] = useElementSize()
  const [hover, setHover] = useState(null)

  const M = { t: 10, r: 10, b: 20, l: 38 }
  const gapY = 20
  const ih = height - M.t - M.b - gapY
  const topH = Math.round(ih * 0.68)
  const botH = ih - topH
  const iw = Math.max(10, w - M.l - M.r)
  const n = points.length
  const slot = iw / Math.max(1, n)
  const x = (i) => M.l + slot * (i + 0.5)

  const vals = points.map((p) => p.rating).filter((v) => v != null)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (!vals.length) { lo = 0; hi = 1 }
  if (lo === hi) { lo -= 1; hi += 1 }
  const ticks = niceTicks(lo, hi)
  lo = Math.min(lo, ticks[0])
  hi = Math.max(hi, ticks[ticks.length - 1])
  const y = (v) => M.t + (1 - (v - lo) / (hi - lo)) * topH

  const deltas = points.map((p) => p.delta).filter((v) => v != null)
  const dMax = Math.max(1, ...deltas.map(Math.abs))
  const botTop = M.t + topH + gapY
  const zero = botTop + botH / 2
  const dy = (v) => (v / dMax) * (botH / 2)
  const barW = Math.max(2, Math.min(16, slot * 0.55))

  const line = points
    .map((p, i) => (p.rating == null ? null : `${x(i)},${y(p.rating)}`))
    .filter(Boolean)
    .join(' L')
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 46))))
  const active = hover != null ? points[hover] : null
  const dotCls = (r) => (r === 'W' ? 'fill-emerald-500' : r === 'L' ? 'fill-rose-500' : 'fill-slate-400')

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={M.l - 6} y={y(t) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground tabular-nums">{formatValue(t)}</text>
            </g>
          ))}
          <line x1={M.l} x2={w - M.r} y1={zero} y2={zero} className="stroke-border" strokeWidth={1} />
          <text x={M.l - 6} y={botTop + 7} fontSize={9} textAnchor="end" className="fill-muted-foreground tabular-nums">+{Math.round(dMax)}</text>
          <text x={M.l - 6} y={botTop + botH} fontSize={9} textAnchor="end" className="fill-muted-foreground tabular-nums">−{Math.round(dMax)}</text>

          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={botTop + botH} className="stroke-foreground/25" strokeWidth={1} />}

          <path d={line ? `M${line}` : ''} fill="none" stroke="var(--color-viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((p, i) => (
            <g key={p.id}>
              {p.rating != null && (
                <circle cx={x(i)} cy={y(p.rating)} r={hover === i ? 6 : 4.5} strokeWidth={2}
                  className={cn('stroke-card transition-[r] duration-150', dotCls(p.result))} />
              )}
              {p.delta != null && (
                <rect
                  x={x(i) - barW / 2}
                  width={barW}
                  y={p.delta >= 0 ? zero - dy(p.delta) : zero}
                  height={Math.max(1, Math.abs(dy(p.delta)))}
                  rx={2}
                  fill={p.delta >= 0 ? 'var(--color-viz-1)' : 'var(--color-viz-neg)'}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {i % step === 0 && (
                <text x={x(i)} y={height - 5} fontSize={9} textAnchor="middle" className="fill-muted-foreground">{p.label}</text>
              )}
              <rect x={x(i) - slot / 2} y={M.t} width={slot} height={botTop + botH - M.t} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          ))}
        </svg>
      )}

      {active && (
        <div
          className="pointer-events-none absolute z-40 w-max max-w-[220px] rounded-lg border border-border bg-background px-2.5 py-2 shadow-lg"
          style={{ left: Math.min(Math.max(x(hover), 100), Math.max(100, w - 100)), top: 0, transform: 'translate(-50%, -100%)' }}
        >
          <div className="text-[11.5px] font-bold leading-tight">{active.title}</div>
          {active.sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{active.sub}</div>}
          <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
            {active.rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 text-[10.5px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-extrabold tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

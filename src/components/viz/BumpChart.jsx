import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useElementSize } from './hooks'

// Bump-chart segment: flat at each node, S-curve between them. Control points sit
// halfway along x at the neighbouring y, which gives the plateau look rather than
// the overshoot a Catmull-Rom spline would produce.
function bumpPath(pts) {
  if (!pts.length) return ''
  return pts.reduce((d, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`
    const prev = pts[i - 1]
    const mx = (prev.x + p.x) / 2
    return `${d} C${mx},${prev.y} ${mx},${p.y} ${p.x},${p.y}`
  }, '')
}

// Background tint per weight-class period. The current spell is left unpainted (the
// card surface); earlier spells take validated categorical slots. Not red/green —
// that pair is the worst case for colourblind readers.
const BAND_FILLS = ['var(--color-viz-2)', 'var(--color-viz-3)', 'var(--color-viz-1)']

// Collapse points into contiguous runs of the same division.
function divisionRuns(points) {
  const runs = []
  points.forEach((p, i) => {
    const last = runs[runs.length - 1]
    if (last && last.division === p.division) last.to = i
    else runs.push({ division: p.division ?? null, label: p.divisionLabel, from: i, to: i })
  })
  return runs
}

// Smooth multi-series bump chart with axes and per-point tooltips.
//
// The whole series is drawn at a fixed spacing and the plot group is translated to
// bring the requested window into view, clipped to the plot area. That is what makes
// paging a real slide — every point travels to its new position — rather than a cut
// to the next frame followed by a block animation. The y-scale spans the entire
// series for the same reason: a per-window scale would make points jump vertically
// mid-slide.
export default function BumpChart({ series, points, formatValue, yLabel, invertY = false, start = 0, size = 12, domain, ticks: tickOverride }) {
  const [wrapRef, { w, h }] = useElementSize()
  const [hover, setHover] = useState(null) // { si, pi } — pi indexes the full series

  const M = { t: 14, r: 14, b: 24, l: 40 }
  const iw = Math.max(10, w - M.l - M.r)
  const ih = Math.max(10, h - M.t - M.b)
  const n = points.length
  const win = Math.min(size, n) || 1

  const all = series.flatMap((s) => s.values.filter((v) => v != null))
  let lo, hi
  if (domain) {
    [lo, hi] = domain
  } else {
    lo = all.length ? Math.min(...all) : 0
    hi = all.length ? Math.max(...all) : 1
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.12
    lo -= pad; hi += pad
  }

  // Spacing is set by the window size, so visible density never changes. Points sit
  // on the centre of their slot (hence the gap/2 inset) so the first and last dots
  // are fully inside the clip instead of being sliced in half by it.
  const gap = iw / win
  const x = (i) => M.l + gap / 2 + i * gap
  const shift = -start * gap
  const y = (v) => {
    const t = (v - lo) / (hi - lo)
    return M.t + (invertY ? t : 1 - t) * ih
  }

  const ticks = tickOverride || Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3)
  const active = hover ? points[hover.pi] : null
  const step = Math.max(1, Math.ceil(win / Math.max(2, Math.floor(iw / 54))))
  const clipId = `plot-clip-${(yLabel || 'v').replace(/\W/g, '')}`
  const runs = divisionRuns(points)
  const glide = { transform: `translateX(${shift}px)`, transition: 'transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)' }

  // Result colour fills the dot; the ring is foreground ink rather than the series
  // colour, so the fill reads at this size without the ring competing with it.
  const resultDot = (i) => {
    const r = points[i]?.win
    if (r === true) return 'fill-emerald-500 stroke-foreground'
    if (r === false) return 'fill-rose-500 stroke-foreground'
    return null
  }

  return (
    <div ref={wrapRef} className="relative min-h-0 w-full flex-1">
      {w > 0 && h > 0 && (
        <svg width={w} height={h}>
          <defs>
            <clipPath id={clipId}>
              <rect x={M.l} y={0} width={iw} height={h} />
            </clipPath>
          </defs>

          {/* fixed axis furniture — does not travel with the plot */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={M.l} y1={y(t)} x2={w - M.r} y2={y(t)} className="stroke-border" strokeWidth={1} strokeDasharray="2 4" />
              <text x={M.l - 6} y={y(t) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground tabular-nums">
                {formatValue ? formatValue(t, true) : t.toFixed(1)}
              </text>
            </g>
          ))}
          {yLabel && <text x={2} y={M.t - 4} fontSize={8} fontWeight={700} className="fill-muted-foreground/70">{yLabel}</text>}

          <g clipPath={`url(#${clipId})`}>
            <g style={glide}>
              {runs.length > 1 && runs.map((r, ri) => {
                // The current division is the unpainted one — a fighter who never
                // moved shows no banding, and earlier spells read as "not here now".
                const isCurrent = ri === runs.length - 1
                const x0 = x(r.from) - gap / 2
                const x1 = x(r.to) + gap / 2
                return (
                  <g key={`band-${r.division}-${r.from}`}>
                    {!isCurrent && <rect x={x0} y={M.t} width={Math.max(0, x1 - x0)} height={ih} fill={BAND_FILLS[ri % BAND_FILLS.length]} fillOpacity={0.1} />}
                    {ri > 0 && <line x1={x0} y1={M.t} x2={x0} y2={M.t + ih} className="stroke-border" strokeWidth={1} strokeDasharray="3 3" />}
                  </g>
                )
              })}

              {points.map((p, i) => {
                if ((i - start) % step !== 0) return null
                return (
                  <text key={p.id} x={x(i)} y={h - 6} fontSize={9} textAnchor="middle" className="fill-muted-foreground">{p.label}</text>
                )
              })}

              {series.map((s, si) => {
                const pts = s.values.map((v, i) => (v == null ? null : { x: x(i), y: y(v) })).filter(Boolean)
                const dim = hover && hover.si !== si && series.length > 1
                return (
                  <path
                    key={s.key}
                    d={bumpPath(pts)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hover?.si === si ? 4 : 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={dim ? 0.18 : 1}
                  />
                )
              })}

              {series.map((s, si) =>
                s.values.map((v, i) => {
                  if (v == null) return null
                  const on = hover?.pi === i && (series.length === 1 || hover?.si === si)
                  const dim = hover && hover.si !== si && series.length > 1
                  const rd = resultDot(i)
                  return (
                    <circle
                      key={`${s.key}-${i}`}
                      cx={x(i)}
                      cy={y(v)}
                      r={on ? 7 : 4.5}
                      fill={rd ? undefined : 'var(--color-background)'}
                      stroke={rd ? undefined : s.color}
                      strokeWidth={rd ? 1.75 : 3}
                      opacity={dim ? 0.18 : 1}
                      className={cn('transition-[r] duration-150', rd)}
                    />
                  )
                })
              )}

              {/* hit targets are the dots themselves — a touch larger than the mark,
                  but deliberately not full-height columns: the tooltip should only
                  appear when the cursor is actually on a point. */}
              {series.map((s, si) =>
                s.values.map((v, i) => (v == null ? null : (
                  <circle
                    key={`hit-${s.key}-${i}`}
                    cx={x(i)}
                    cy={y(v)}
                    r={10}
                    fill="transparent"
                    onMouseEnter={() => setHover({ si, pi: i })}
                    onMouseLeave={() => setHover(null)}
                  />
                )))
              )}
            </g>
          </g>
        </svg>
      )}

      {active && (
        <div
          className="pointer-events-none absolute z-40 w-max max-w-[210px] rounded-lg border border-border bg-background px-2.5 py-2 shadow-lg"
          style={{
            left: Math.min(Math.max(x(hover.pi) + shift, 92), Math.max(92, w - 92)),
            top: M.t,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-[11.5px] font-bold leading-tight">{active.title}</div>
          {active.sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{active.sub}</div>}
          {active.context && <div className="mt-0.5 text-[10px] font-semibold text-viz-2">{active.context}</div>}
          <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-[10.5px] text-muted-foreground">{s.label}</span>
                <span className="ml-auto text-[10.5px] font-extrabold tabular-nums">
                  {s.values[hover.pi] == null ? '—' : formatValue ? formatValue(s.values[hover.pi]) : s.values[hover.pi].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

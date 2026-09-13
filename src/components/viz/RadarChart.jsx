import { useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { ordinal } from '../../lib/fighterAnalytics'

// ---------------------------------------------------------------------------
// Percentile radar (dependency-free inline SVG).
//
// Two modes, one mark:
//   <RadarChart axes={axes} />                    one fighter vs their division
//   <RadarChart series={[{key,label,color,axes}]} /> two fighters overlaid
//
// The single-`axes` path is the original profile-page chart, unchanged. `series`
// adds the matchup reading: the axis ring, labels and hover targets are shared, and
// each series contributes one polygon. The tooltip lists every series on the hovered
// axis, which is the whole point — the comparison is per-axis, not per-shape.
// ---------------------------------------------------------------------------
function polar(cx, cy, r, i, n) {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

// viewBox is cropped tight to the drawn content (labels sit at R+16, so the ink
// spans roughly y 8..227, x -33..273) — a looser box padded ~30px of dead space
// above and below the chart, which showed up as whitespace in the card.
const VB = { x: -36, y: 2, w: 312, h: 236 }

// Pie slice centred on axis i — an invisible, generous hover target so you don't
// have to land on the 2.6px data dot.
function sectorPath(cx, cy, r, i, n) {
  const half = Math.PI / n
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 - half
  const a1 = a0 + 2 * half
  const [x0, y0] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)]
  const [x1, y1] = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)]
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`
}

// `fit` swaps the default width-driven sizing (grow to the column, cap at 300px)
// for height-driven: the svg fills its parent and scales down to whatever box it
// is given. Needed wherever the chart lives in a flex row with a definite height
// — width-driven sizing there overflows the container in both directions, since
// a centred child larger than its parent spills past both edges.
export default function RadarChart({ axes, series, fit = false }) {
  // One code path for both modes: a bare `axes` prop is a single colourless series,
  // which keeps the original class-based blue styling rather than an inline colour.
  const list = series?.length ? series : [{ key: '__solo__', axes, color: null }]
  const spine = list[0].axes
  const cx = 120, cy = 120, R = 92, n = spine.length
  const multi = list.length > 1
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null) // { i, x, y, w } — x/y in wrapper pixels

  // Track the cursor in wrapper-relative pixels so the tooltip lands correctly
  // regardless of how the SVG is scaled or letterboxed. Width is captured here
  // too — reading the ref during render isn't allowed.
  const track = (i) => (e) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width })
  }

  const active = hover ? spine[hover.i] : null

  return (
    <div ref={wrapRef} className={cn('relative flex w-full justify-center py-1', fit && 'h-full min-h-0 items-center')}>
      <svg
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        className={fit ? 'h-full max-h-full w-full' : 'h-auto w-full max-w-[300px]'}
      >
        {[0.25, 0.5, 0.75, 1].map((fr, gi) => (
          <polygon key={gi} points={spine.map((_, i) => polar(cx, cy, R * fr, i, n).join(',')).join(' ')} fill="none" className="stroke-border" strokeWidth={1} />
        ))}
        {spine.map((a, i) => {
          const [x, y] = polar(cx, cy, R, i, n)
          return <line key={a.key} x1={cx} y1={cy} x2={x} y2={y} strokeWidth={hover?.i === i ? 1.8 : 1} className={hover?.i === i ? 'stroke-blue-500/70' : 'stroke-border'} />
        })}

        {/* plotted shapes — grow out of the centre on mount */}
        <g className="radar-grow" style={{ '--radar-ox': `${cx - VB.x}px`, '--radar-oy': `${cy - VB.y}px` }}>
          {list.map((s) => (
            <polygon
              key={s.key}
              points={s.axes.map((a, i) => polar(cx, cy, (R * a.value) / 100, i, n).join(',')).join(' ')}
              className={s.color ? undefined : 'fill-blue-500/20 stroke-blue-600'}
              fill={s.color || undefined}
              // Two filled shapes must both stay readable where they overlap, so the
              // fill is lighter than the single-series case and the stroke carries
              // the outline.
              fillOpacity={s.color ? 0.16 : undefined}
              stroke={s.color || undefined}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {list.map((s) => s.axes.map((a, i) => {
            const [x, y] = polar(cx, cy, (R * a.value) / 100, i, n)
            const on = hover?.i === i
            return (
              <circle
                key={`${s.key}-${a.key}`}
                cx={x}
                cy={y}
                r={on ? 4.6 : 2.6}
                className={cn('fill-background transition-all duration-150', s.color ? undefined : 'stroke-blue-600')}
                stroke={s.color || undefined}
                strokeWidth={on ? 2.4 : 1.6}
              />
            )
          }))}
        </g>

        <g className="radar-fade">
          {spine.map((a, i) => {
            const [x, y] = polar(cx, cy, R + 16, i, n)
            const dx = x - cx
            const anchor = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end'
            return (
              <text key={a.key} x={x} y={y + 3} fontSize={9} fontWeight={hover?.i === i ? 800 : 600} textAnchor={anchor} className={hover?.i === i ? 'fill-foreground' : 'fill-muted-foreground'}>
                {a.label}
              </text>
            )
          })}
        </g>

        {/* hover targets last so they sit above everything */}
        {spine.map((a, i) => (
          <path
            key={a.key}
            d={sectorPath(cx, cy, R + 20, i, n)}
            fill="transparent"
            onMouseMove={track(i)}
            onMouseEnter={track(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {active && (
        <div
          className={cn(
            'pointer-events-none absolute z-30 rounded-lg border border-border bg-background p-2.5 shadow-lg',
            multi ? 'w-[184px]' : 'w-[152px]',
          )}
          style={{
            // half the tooltip width plus a margin, so it never hangs off either edge
            left: (() => { const pad = multi ? 104 : 88; return Math.min(Math.max(hover.x, pad), Math.max(pad, hover.w - pad)) })(),
            top: hover.y,
            transform: 'translate(-50%, calc(-100% - 12px))',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', active.group === 'striking' ? 'bg-amber-500' : 'bg-indigo-500')} />
            <span className="text-[11.5px] font-bold leading-tight">{active.full}</span>
          </div>
          {multi ? (
            <div className="mt-1.5 space-y-1 border-t pt-1.5">
              {list.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-[10.5px] text-muted-foreground">{s.label}</span>
                  <span className="ml-auto text-[11.5px] font-extrabold tabular-nums">
                    {s.axes[hover.i]?.value == null ? '—' : ordinal(s.axes[hover.i].value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-xl font-extrabold leading-none tabular-nums text-blue-600">{ordinal(active.value)}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">percentile</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

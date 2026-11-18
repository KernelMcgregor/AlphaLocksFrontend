import { useState } from 'react'
import { useElementSize } from './hooks'

// Win rate by age: the division's curve as a recessive gray line, the fighter's own
// record at each age as red dots sized by bouts fought, joined thinly. A marker shows
// where the fighter is now.
//
// curve: [{ age, smoothed, fights }]   ages: [{ age, win_rate, wins, losses, draws, fights }]
export default function AgeCurve({ curve, ages, currentAge, divisionLabel, fighterLabel, height = 230 }) {
  const [wrapRef, { w }] = useElementSize()
  const [hover, setHover] = useState(null)

  const M = { t: 10, r: 12, b: 22, l: 34 }
  const iw = Math.max(10, w - M.l - M.r)
  const ih = height - M.t - M.b
  const allAges = [...curve.map((c) => c.age), ...ages.map((a) => a.age), ...(currentAge ? [Math.floor(currentAge)] : [])]
  const a0 = Math.min(...allAges) - 0.5
  const a1 = Math.max(...allAges) + 0.5
  const x = (a) => M.l + ((a - a0) / (a1 - a0)) * iw
  const y = (v) => M.t + (1 - v) * ih
  const curveBy = Object.fromEntries(curve.map((c) => [c.age, c]))
  const mineBy = Object.fromEntries(ages.map((a) => [a.age, a]))
  const maxN = Math.max(1, ...ages.map((a) => a.fights))
  const r = (n) => 4 + 3 * Math.sqrt(n / maxN)

  const curvePath = curve.filter((c) => c.smoothed != null).map((c, i) => `${i ? 'L' : 'M'}${x(c.age)},${y(c.smoothed)}`).join(' ')
  const minePath = ages.map((a, i) => `${i ? 'L' : 'M'}${x(a.age)},${y(a.win_rate)}`).join(' ')
  const span = Math.round(a1 - a0)
  const ageTicks = []
  const tickStep = span > 16 ? 4 : 2
  for (let a = Math.ceil(a0); a <= a1; a++) if (a % tickStep === 0) ageTicks.push(a)
  const hoverAge = hover
  const hc = hoverAge != null ? curveBy[hoverAge] : null
  const hm = hoverAge != null ? mineBy[hoverAge] : null
  const colAges = []
  for (let a = Math.ceil(a0); a < a1; a++) colAges.push(a)
  const colW = iw / (a1 - a0)

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-viz-1" />{fighterLabel}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="h-[2px] w-3 rounded-full bg-muted-foreground" />{divisionLabel}
        </span>
      </div>
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {w > 0 && (
          <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} className={t === 0.5 ? 'stroke-foreground/25' : 'stroke-border'} strokeWidth={1} />
                <text x={M.l - 6} y={y(t) + 3} fontSize={9} textAnchor="end" className="fill-muted-foreground tabular-nums">{Math.round(t * 100)}%</text>
              </g>
            ))}
            {ageTicks.map((a) => (
              <text key={a} x={x(a)} y={height - 6} fontSize={9} textAnchor="middle" className="fill-muted-foreground tabular-nums">{a}</text>
            ))}
            {currentAge != null && (
              <g>
                <line x1={x(currentAge)} x2={x(currentAge)} y1={M.t} y2={M.t + ih} className="stroke-foreground/40" strokeWidth={1} />
                <text x={x(currentAge) + 4} y={M.t + 8} fontSize={8.5} fontWeight={700} className="fill-muted-foreground">NOW</text>
              </g>
            )}
            {hoverAge != null && <rect x={x(hoverAge - 0.5)} width={colW} y={M.t} height={ih} className="fill-foreground/5" />}

            <path d={curvePath} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d={minePath} fill="none" stroke="var(--color-viz-1)" strokeOpacity={0.45} strokeWidth={1.25} />
            {ages.map((a) => (
              <circle key={a.age} cx={x(a.age)} cy={y(a.win_rate)} r={r(a.fights)} fill="var(--color-viz-1)" strokeWidth={2} className="stroke-card" />
            ))}

            {colAges.map((a) => (
              <rect key={a} x={x(a - 0.5)} width={colW} y={M.t} height={ih} fill="transparent" onMouseEnter={() => setHover(a)} />
            ))}
          </svg>
        )}
        {hoverAge != null && (hc || hm) && (
          <div
            className="pointer-events-none absolute z-40 w-max rounded-lg border border-border bg-background px-2.5 py-2 shadow-lg"
            style={{ left: Math.min(Math.max(x(hoverAge), 90), Math.max(90, w - 90)), top: 0, transform: 'translate(-50%, -100%)' }}
          >
            <div className="text-[11.5px] font-bold leading-tight">Age {hoverAge}</div>
            <div className="mt-1.5 space-y-0.5 border-t pt-1.5 text-[10.5px]">
              {hm && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{fighterLabel}</span>
                  <span className="font-extrabold tabular-nums">{hm.wins}-{hm.losses}{hm.draws ? `-${hm.draws}` : ''}</span>
                </div>
              )}
              {hc && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{divisionLabel}</span>
                  <span className="font-extrabold tabular-nums">{Math.round((hc.smoothed ?? 0) * 100)}%</span>
                </div>
              )}
              {hc?.rating_delta != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Avg rating change</span>
                  <span className="font-bold tabular-nums">{hc.rating_delta > 0 ? '+' : ''}{hc.rating_delta.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// The fight as a running score: red's significant strikes minus blue's, accumulated
// over fight time. UFCStats only splits stats by round, so the trace holds each
// round's closing differential across that round and steps at the bells; a finish
// ends the axis at the finish time.
//
// Above zero is red ahead, below is blue, each washed in its corner colour. Under
// the plot, one lane per corner draws its control time on the same clock, starting
// at the round's bell (when in the round is not recorded). Knockdowns sit on the
// trace as dots in the corner colour of whoever scored them.
import { useId, useMemo, useState } from 'react'
import { clock } from '../../lib/fightProjection'
import { CORNERS } from '../fight/corners'
import { useElementSize } from './hooks'

const M = { top: 10, right: 44, bottom: 20, left: 34 }
const PLOT_H = 170
const LANE_H = 7
const LANE_GAP = 4

const signed = (v) => (v > 0 ? `+${v}` : `${v}`)

function niceStep(span) {
  const raw = span / 3
  return [2, 5, 10, 20, 25, 50, 100].find((s) => s >= raw) || 100
}

/**
 * rounds: lib/fightReview splitStats(...).rounds — [{ round, red, blue, seconds }]
 * names:  { red, blue } last names
 */
export default function FightTrace({ rounds, names }) {
  const uid = useId().replace(/:/g, '')
  const [ref, { w }] = useElementSize()
  const [hover, setHover] = useState(null)

  const data = useMemo(() => {
    const out = []
    for (const r of rounds) {
      const prev = out.at(-1)
      const t0 = prev ? prev.t1 : 0
      const secs = r.seconds || 300
      const diff = (r.red.sig_str_landed || 0) - (r.blue.sig_str_landed || 0)
      out.push({ ...r, t0, t1: t0 + secs, secs, diff, cum: (prev ? prev.cum : 0) + diff })
    }
    return out
  }, [rounds])

  if (!data.length) return null

  const total = data.at(-1).t1
  const extent = Math.max(5, ...data.map((d) => Math.abs(d.cum)))
  const step = niceStep(extent)
  const lim = Math.ceil((extent * 1.1) / step) * step
  const ticks = []
  for (let v = -lim; v <= lim; v += step) ticks.push(v)

  const innerW = Math.max(0, w - M.left - M.right)
  const x = (s) => M.left + (s / total) * innerW
  const y = (v) => M.top + ((lim - v) / (2 * lim)) * PLOT_H
  const laneTop = M.top + PLOT_H + M.bottom
  const height = laneTop + 2 * LANE_H + LANE_GAP + 2

  // Step path: 0 at the opening bell, each round held at its closing differential.
  let line = `M${x(0)},${y(0)}`
  for (const d of data) line += ` L${x(d.t0)},${y(d.cum)} L${x(d.t1)},${y(d.cum)}`
  const area = `${line} L${x(total)},${y(0)} Z`

  const last = data.at(-1)
  const red = CORNERS[0].css
  const blue = CORNERS[1].css
  const summary = `Significant strike differential by round: ${data.map((d) => `R${d.round} ${signed(d.cum)}`).join(', ')} (positive = ${names.red} ahead).`
  const hd = hover == null ? null : data[hover]

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={summary} className="block overflow-visible">
          <defs>
            <clipPath id={`${uid}-up`}><rect x={0} y={0} width={w} height={y(0)} /></clipPath>
            <clipPath id={`${uid}-dn`}><rect x={0} y={y(0)} width={w} height={PLOT_H} /></clipPath>
          </defs>

          {hd && <rect x={x(hd.t0)} y={M.top} width={x(hd.t1) - x(hd.t0)} height={PLOT_H} className="fill-muted" opacity={0.6} />}

          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + innerW} y1={y(v)} y2={y(v)}
                className={v === 0 ? 'stroke-foreground/40' : 'stroke-border'} strokeWidth={1} />
              <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={9.5}
                className="fill-muted-foreground tabular-nums">{signed(v)}</text>
            </g>
          ))}
          <text x={M.left + 6} y={M.top + 10} fontSize={9.5} fontWeight={700} className="fill-muted-foreground">{names.red} ahead</text>
          <text x={M.left + 6} y={M.top + PLOT_H - 5} fontSize={9.5} fontWeight={700} className="fill-muted-foreground">{names.blue} ahead</text>

          {/* bells */}
          {data.slice(1).map((d) => (
            <line key={d.round} x1={x(d.t0)} x2={x(d.t0)} y1={M.top} y2={M.top + PLOT_H} className="stroke-border" strokeWidth={1} />
          ))}
          {data.map((d) => (
            <text key={d.round} x={(x(d.t0) + x(d.t1)) / 2} y={M.top + PLOT_H + 13} textAnchor="middle" fontSize={10}
              fontWeight={700} className="fill-muted-foreground">R{d.round}</text>
          ))}

          <path d={area} fill={red} fillOpacity={0.12} clipPath={`url(#${uid}-up)`} />
          <path d={area} fill={blue} fillOpacity={0.12} clipPath={`url(#${uid}-dn)`} />
          <path d={line} fill="none" stroke="currentColor" className="text-foreground" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />

          {/* knockdowns, on the trace mid-round */}
          {data.flatMap((d) => [['red', d.red.kd], ['blue', d.blue.kd]]
            .filter(([, n]) => n > 0)
            .map(([side, n], i, arr) => {
              const cx = (x(d.t0) + x(d.t1)) / 2 + (arr.length > 1 ? (i ? 9 : -9) : 0)
              const cy = y(d.cum)
              return (
                <g key={`${d.round}-${side}`}>
                  <circle cx={cx} cy={cy} r={5.5} fill={side === 'red' ? red : blue} className="stroke-card" strokeWidth={2} />
                  <text x={cx} y={cy - 9} textAnchor="middle" fontSize={9} fontWeight={800} className="fill-foreground">
                    KD{n > 1 ? `×${n}` : ''}
                  </text>
                </g>
              )
            }))}

          <circle cx={x(total)} cy={y(last.cum)} r={4} className="fill-foreground stroke-card" strokeWidth={2} />
          <text x={x(total) + 7} y={y(last.cum)} dy="0.32em" fontSize={11} fontWeight={800} className="fill-foreground tabular-nums">
            {signed(last.cum)}
          </text>

          {/* control lanes */}
          {[['red', red, 0], ['blue', blue, 1]].map(([side, css, k]) => {
            const top = laneTop + k * (LANE_H + LANE_GAP)
            return (
              <g key={side}>
                <circle cx={M.left - 6} cy={top + LANE_H / 2} r={3} fill={css} />
                <text x={M.left - 12} y={top + LANE_H / 2} dy="0.32em" textAnchor="end" fontSize={9} fontWeight={700}
                  className="fill-muted-foreground">Ctrl</text>
                <rect x={M.left} y={top} width={innerW} height={LANE_H} rx={2} className="fill-muted/60" />
                {data.map((d) => {
                  const s = Math.min(d.secs, d[side].ctrl_seconds || 0)
                  return s > 0 ? (
                    <rect key={d.round} x={x(d.t0)} y={top} width={Math.max(1, x(d.t0 + s) - x(d.t0))} height={LANE_H}
                      rx={2} fill={css} fillOpacity={0.7} />
                  ) : null
                })}
              </g>
            )
          })}

          {/* hover targets: a whole round column, plot and lanes */}
          {data.map((d, i) => (
            <rect key={d.round} x={x(d.t0)} y={M.top} width={Math.max(0, x(d.t1) - x(d.t0))} height={height - M.top}
              fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      )}

      {hd && (
        <div
          className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] shadow-lg"
          style={{ left: Math.min(Math.max((x(hd.t0) + x(hd.t1)) / 2, 90), w - 90), top: M.top + 4 }}
        >
          <div className="mb-1 font-extrabold">Round {hd.round}{hd.secs < 300 ? ` · ${clock(hd.secs)}` : ''}</div>
          <div className="grid grid-cols-[auto_auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
            <span />
            <span className="flex items-center gap-1 font-bold"><span className="h-1.5 w-1.5 rounded-full" style={{ background: red }} />{names.red}</span>
            <span className="flex items-center gap-1 font-bold"><span className="h-1.5 w-1.5 rounded-full" style={{ background: blue }} />{names.blue}</span>
            <span className="text-muted-foreground">Sig. str</span><span>{hd.red.sig_str_landed}</span><span>{hd.blue.sig_str_landed}</span>
            <span className="text-muted-foreground">Control</span><span>{clock(hd.red.ctrl_seconds || 0)}</span><span>{clock(hd.blue.ctrl_seconds || 0)}</span>
            {(hd.red.kd > 0 || hd.blue.kd > 0) && (
              <><span className="text-muted-foreground">KD</span><span>{hd.red.kd}</span><span>{hd.blue.kd}</span></>
            )}
          </div>
          <div className="mt-1 border-t pt-1 text-muted-foreground">
            Round {signed(hd.diff)} · after it <span className="font-bold text-foreground">{signed(hd.cum)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// src/pages/FighterProfilePage.jsx
import { ArrowLeft, ChevronLeft, ChevronRight, Crown, Flame, Loader2, Swords, Timer, TrendingUp } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import HeaderActions from '../components/layout/HeaderActions'
import SimilarFighters from '../components/sports/SimilarFighters'
import { Card, CardContent } from '../components/ui/card'
import { ScrollArea } from '../components/ui/scroll-area'
import { SlideTabs } from '../components/ui/slide-tabs'
// NOTE: add `export const fetchFighterStats = (id) => cachedRequest(`/ufc/fighters/${id}/stats`)`
// to src/lib/api.js — the endpoint already exists in routers/ufc.py.
import { fetchEvents, fetchFighter, fetchFighterFights, fetchFighterRankHistory, fetchFighterStats, fetchRankings } from '../lib/api'
import { cn, formatDate, formatRecord } from '../lib/utils'
import { aggregateCareer, buildPercentile, deriveForm, deriveProfile, initialsOf, methodLabel, ordinal } from '../lib/fighterAnalytics'

// ---------------------------------------------------------------------------
// Radial charts (dependency-free inline SVG — same family as RankingsPage)
// ---------------------------------------------------------------------------
function polar(cx, cy, r, i, n) {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

// viewBox is cropped tight to the drawn content (labels sit at R+16, so the ink
// spans roughly y 8..227, x -33..273) — a looser box padded ~30px of dead space
// above and below the chart, which showed up as whitespace in the card.
const VB = { x: -36, y: 2, w: 312, h: 236 }

// Captured once at module load — age only changes yearly, and reading the clock
// during render is impure.
const NOW = Date.now()

// Backend division keys are snake_case ("light_heavyweight", "p4p_men").
function divisionName(key) {
  if (!key) return null
  if (key.startsWith('p4p')) return 'Pound-for-pound'
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

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

function RadarChart({ axes }) {
  const cx = 120, cy = 120, R = 92, n = axes.length
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

  const active = hover ? axes[hover.i] : null

  return (
    <div ref={wrapRef} className="relative flex min-h-0 flex-1 justify-center">
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="h-auto max-h-full w-full max-w-[268px]">
        {[0.25, 0.5, 0.75, 1].map((fr, gi) => (
          <polygon key={gi} points={axes.map((_, i) => polar(cx, cy, R * fr, i, n).join(',')).join(' ')} fill="none" className="stroke-border" strokeWidth={1} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = polar(cx, cy, R, i, n)
          return <line key={a.key} x1={cx} y1={cy} x2={x} y2={y} strokeWidth={hover?.i === i ? 1.8 : 1} className={hover?.i === i ? 'stroke-blue-500/70' : 'stroke-border'} />
        })}

        {/* plotted shape — grows out of the centre on mount */}
        <g className="radar-grow" style={{ '--radar-ox': `${cx - VB.x}px`, '--radar-oy': `${cy - VB.y}px` }}>
          <polygon points={axes.map((a, i) => polar(cx, cy, (R * a.value) / 100, i, n).join(',')).join(' ')} className="fill-blue-500/20 stroke-blue-600" strokeWidth={2} strokeLinejoin="round" />
          {axes.map((a, i) => {
            const [x, y] = polar(cx, cy, (R * a.value) / 100, i, n)
            const on = hover?.i === i
            return <circle key={a.key} cx={x} cy={y} r={on ? 4.6 : 2.6} className="fill-background stroke-blue-600 transition-all duration-150" strokeWidth={on ? 2.4 : 1.6} />
          })}
        </g>

        <g className="radar-fade">
          {axes.map((a, i) => {
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
        {axes.map((a, i) => (
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
          className="pointer-events-none absolute z-30 w-[152px] rounded-lg border border-border bg-background p-2.5 shadow-lg"
          style={{
            left: Math.min(Math.max(hover.x, 88), Math.max(88, hover.w - 88)),
            top: hover.y,
            transform: 'translate(-50%, calc(-100% - 12px))',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', active.group === 'striking' ? 'bg-amber-500' : 'bg-indigo-500')} />
            <span className="text-[11.5px] font-bold leading-tight">{active.full}</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold leading-none tabular-nums text-blue-600">{ordinal(active.value)}</span>
            <span className="text-[10px] font-semibold text-muted-foreground">percentile</span>
          </div>
        </div>
      )}
    </div>
  )
}


function WavingFlag({ countryCode }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!countryCode) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = new URL(`/node_modules/flag-icons/flags/4x3/${countryCode.toLowerCase()}.svg`, import.meta.url).href
    imgRef.current = img

    let frame
    let t = 0
    let sized = false

    const draw = () => {
      // Match canvas pixels to display size
      if (!sized || canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        sized = true
      }
      const W = canvas.width
      const H = canvas.height
      if (!img.complete || !img.naturalWidth) { frame = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, W, H)
      t += 0.02

      // Oversized flag so waves don't reveal edges
      const scale = 1.35
      const flagW = W * scale
      const flagH = H * scale
      const ox = (W - flagW) / 2
      const oy = (H - flagH) / 2

      for (let i = 0; i < Math.ceil(flagW); i++) {
        const nx = i / flagW

        // Primary billow wave — large, slow
        const amp1 = 4 + 12 * nx * nx
        const wave1 = Math.sin(nx * 3.5 + t * 2.0) * amp1

        // Secondary ripple — faster, smaller
        const amp2 = 2 + 5 * nx
        const wave2 = Math.sin(nx * 8 - t * 3.2) * amp2 * 0.4

        // Wrinkle — high frequency, subtle, varies over time
        const wrinkle = Math.sin(nx * 22 + t * 4.5) * (1.5 + 3 * nx) * 0.35
        const wrinkle2 = Math.sin(nx * 35 - t * 2.8) * (1 + 2 * nx) * 0.2

        const dy = wave1 + wave2 + wrinkle + wrinkle2

        // Vertical stretch from wave compression
        const stretch = 1 + 0.04 * Math.cos(nx * 5 + t * 2) + 0.015 * Math.sin(nx * 18 + t * 3.5)

        // Lighting from primary wave slope + wrinkle detail
        const slope = Math.cos(nx * 3.5 + t * 2.0)
        const detail = Math.cos(nx * 22 + t * 4.5) * 0.4

        const sx = nx * img.naturalWidth
        const sw = Math.max(1, img.naturalWidth / flagW)

        const dx = ox + i
        const drawY = oy + dy
        const drawH = flagH * stretch

        ctx.drawImage(img, sx, 0, sw, img.naturalHeight, dx, drawY, 1.5, drawH)

        // Lighting — broad shading + wrinkle highlights
        const light = slope * 0.08 + detail * 0.05
        if (light > 0) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(light, 0.15)})`
        } else {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(-light, 0.18)})`
        }
        ctx.fillRect(dx, drawY, 1.5, drawH)
      }

      frame = requestAnimationFrame(draw)
    }

    img.onload = () => { frame = requestAnimationFrame(draw) }
    if (img.complete) frame = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(frame)
  }, [countryCode])

  if (!countryCode) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
    />
  )
}

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col justify-center rounded-md border bg-muted/40 px-2 py-1.5">
      <div className="text-sm font-extrabold leading-none tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-[9px] font-semibold text-muted-foreground">{label}</div>
    </div>
  )
}

// Outcome chip for the left column. Stacked and centred: the grid stretches these
// vertically, so putting the label under the number uses that height instead of
// squeezing both onto one line and truncating the label.
function OutcomeChip({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border bg-muted/40 px-1 py-1.5">
      <span className="text-[18px] font-extrabold leading-none tabular-nums text-foreground">{value}</span>
      <span className="mt-1 text-[9.5px] font-semibold leading-none text-muted-foreground">{label}</span>
    </div>
  )
}

function clock(seconds) {
  const t = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

const STAT_KEYS = [
  'kd', 'sig_str_landed', 'sig_str_attempted', 'total_str_landed', 'total_str_attempted',
  'td_landed', 'td_attempted', 'sub_att', 'rev', 'ctrl_seconds',
  'head_landed', 'body_landed', 'leg_landed', 'distance_landed', 'clinch_landed', 'ground_landed',
]

// Per-fight totals: prefer the totals row (round_number 0), else sum the rounds.
function fightTotals(data) {
  if (!data) return null
  if (data.total) return data.total
  if (!data.rounds.length) return null
  const out = {}
  for (const k of STAT_KEYS) out[k] = data.rounds.reduce((sum, r) => sum + (Number(r[k]) || 0), 0)
  return out
}

// Expanded fight row — the fighter's own stat line for that bout.
function FightDetail({ detail, data }) {
  const t = fightTotals(data)
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
  const target = (t?.head_landed || 0) + (t?.body_landed || 0) + (t?.leg_landed || 0)
  const position = (t?.distance_landed || 0) + (t?.clinch_landed || 0) + (t?.ground_landed || 0)

  return (
    <div className="space-y-3 border-l-2 border-l-blue-500/40 bg-muted/25 px-3 py-2.5">
      {detail && <p className="text-[11.5px] leading-snug text-foreground/80">{detail}</p>}

      {!t ? (
        <p className="text-[11px] text-muted-foreground">No statistics recorded for this fight.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-6">
            <StatTile label="Sig. strikes" value={`${t.sig_str_landed}/${t.sig_str_attempted}`} />
            <StatTile label="Sig. accuracy" value={`${pct(t.sig_str_landed, t.sig_str_attempted)}%`} />
            <StatTile label="Total strikes" value={t.total_str_landed} />
            <StatTile label="Knockdowns" value={t.kd} />
            <StatTile label="Takedowns" value={`${t.td_landed}/${t.td_attempted}`} />
            <StatTile label="Control" value={clock(t.ctrl_seconds)} />
          </div>

          {(target > 0 || position > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {target > 0 && (
                <SplitBar
                  title="Target"
                  segments={[
                    { label: 'Head', value: pct(t.head_landed, target), cls: 'bg-viz-1' },
                    { label: 'Body', value: pct(t.body_landed, target), cls: 'bg-viz-2' },
                    { label: 'Leg', value: pct(t.leg_landed, target), cls: 'bg-viz-3' },
                  ]}
                />
              )}
              {position > 0 && (
                <SplitBar
                  title="Position"
                  segments={[
                    { label: 'Distance', value: pct(t.distance_landed, position), cls: 'bg-viz-1' },
                    { label: 'Clinch', value: pct(t.clinch_landed, position), cls: 'bg-viz-2' },
                    { label: 'Ground', value: pct(t.ground_landed, position), cls: 'bg-viz-3' },
                  ]}
                />
              )}
            </div>
          )}

          {data.rounds.length > 0 && (
            <div>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">By round</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-[11px]">
                  <thead>
                    <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="py-1 pr-3 font-bold">Rd</th>
                      <th className="py-1 pr-3 font-bold">Sig. str</th>
                      <th className="py-1 pr-3 font-bold">Total str</th>
                      <th className="py-1 pr-3 font-bold">TD</th>
                      <th className="py-1 pr-3 font-bold">Sub att</th>
                      <th className="py-1 pr-3 font-bold">KD</th>
                      <th className="py-1 font-bold">Control</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.rounds.map((r) => (
                      <tr key={r.round_number} className="border-t border-border/60">
                        <td className="py-1 pr-3 font-bold">R{r.round_number}</td>
                        <td className="py-1 pr-3">{r.sig_str_landed}/{r.sig_str_attempted}</td>
                        <td className="py-1 pr-3">{r.total_str_landed}/{r.total_str_attempted}</td>
                        <td className="py-1 pr-3">{r.td_landed}/{r.td_attempted}</td>
                        <td className="py-1 pr-3">{r.sub_att}</td>
                        <td className="py-1 pr-3">{r.kd}</td>
                        <td className="py-1">{clock(r.ctrl_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// CSS-only hover tooltip. No state, no positioning maths — the bubble is a
// sibling revealed by group-hover, anchored above the trigger.
function Tip({ children, content, className, style, align = 'center' }) {
  // Triggers near a panel edge must anchor to that edge — a centred bubble gets
  // clipped by the ScrollArea's overflow.
  const pos = {
    start: 'left-0 translate-x-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0 translate-x-0',
  }[align]
  return (
    <div className={cn('group/tip relative', className)} style={style}>
      {children}
      <div className={cn('pointer-events-none absolute bottom-full z-40 mb-2 hidden group-hover/tip:block', pos)}>
        <div className="w-max max-w-[220px] rounded-lg border border-border bg-background px-2.5 py-2 text-left shadow-lg">
          {content}
        </div>
      </div>
    </div>
  )
}

// A window that slides by `step` items rather than jumping a whole page, so the
// series reads as one continuous spectrum. `offset` counts items back from the
// newest; the charts render the whole series and translate to these bounds, so the
// motion is a real slide rather than a cut followed by an animation.
function useSlidingWindow(total, size, step) {
  const [state, setState] = useState({ offset: 0 })
  const max = Math.max(0, total - size)
  const offset = Math.min(state.offset, max)

  const slide = (delta) => setState((s) => ({
    offset: Math.min(max, Math.max(0, Math.min(s.offset, max) + delta)),
  }))

  const end = total - offset
  return {
    start: Math.max(0, end - size),
    end,
    older: () => slide(step),
    newer: () => slide(-step),
    canOlder: offset < max,
    canNewer: offset > 0,
  }
}

// Back/forward pair shared by the windowed charts.
function SlideControls({ label, win }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] tabular-nums text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={win.older}
        disabled={!win.canOlder}
        aria-label="Earlier"
        className="rounded-md border border-border p-0.5 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={win.newer}
        disabled={!win.canNewer}
        aria-label="Later"
        className="rounded-md border border-border p-0.5 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}

// Measures its element so the chart can be drawn in real pixels — avoids the
// letterboxing a fixed viewBox gives you when the container height is fluid.
function useElementSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

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

// Background tint per weight-class period. The first spell is left unpainted (the
// card surface) so a fighter who never moved shows no banding at all; later spells
// take validated categorical slots. Not red/green — that pair is the worst case for
// colourblind readers, and every band is labelled so colour is never the only cue.
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
function BumpChart({ series, points, formatValue, yLabel, invertY = false, start = 0, size = 12, domain, ticks: tickOverride }) {
  const [wrapRef, { w, h }] = useElementSize()
  const [hover, setHover] = useState(null) // { si, pi } — pi indexes the full series

  const M = { t: 14, r: 14, b: 24, l: 40 }
  const iw = Math.max(10, w - M.l - M.r)
  const ih = Math.max(10, h - M.t - M.b)
  const n = points.length
  const win = Math.min(size, n)

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
  // Fill carries the result — win green, loss red, draw/NC left on the surface
  // colour. The ring stays the series colour so the line and its points still read
  // as one series.
  // Result colour fills the dot; the ring is foreground ink rather than the series
  // colour, so the fill reads at this size without the ring competing with it.
  // Thinner than the unresolved-dot ring for the same reason.
  const resultDot = (i) => {
    const r = points[i]?.win
    if (r === true) return 'fill-emerald-500 stroke-foreground'
    if (r === false) return 'fill-rose-500 stroke-foreground'
    return null
  }
  const glide = { transform: `translateX(${shift}px)`, transition: 'transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)' }

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

// Larger headline tile used by the Overview tab.
function HeroTile({ icon: Icon, label, value, sub, accent = 'text-foreground' }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border bg-gradient-to-b from-muted/60 to-muted/20 px-1.5 py-2.5 text-center">
      <div className={cn('text-xl font-extrabold leading-none tabular-nums', accent)}>{value}</div>
      <div className="mt-1.5 flex items-center justify-center gap-1 text-muted-foreground">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      {sub && <div className="mt-1 text-[9.5px] leading-tight text-muted-foreground">{sub}</div>}
    </div>
  )
}

// Stacked proportional bar with a legend — used for target/position/method splits.
function SplitBar({ title, segments, unit = '%' }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div>
      {title && <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70">{title}</div>}
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
        {total > 0 && segments.map((s) => (
          <div key={s.label} className={cn('h-full transition-all duration-500', s.cls)} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', s.cls)} />
            <span className="text-[10.5px] text-muted-foreground">{s.label}</span>
            <span className="text-[10.5px] font-extrabold tabular-nums text-foreground">{s.value}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Last-10 W/L chips, most recent first. Hover names the opponent.
function FormStrip({ results, oppData, eventMap }) {
  return (
    <div className="flex flex-wrap gap-1">
      {results.map((r, i) => {
        const opp = oppData?.[String(r.oppId)]
        const eventName = eventMap?.[String(r.eventId)]
        return (
          <Tip
            key={r.id}
            align={i < 2 ? 'start' : i > results.length - 3 ? 'end' : 'center'}
            content={
              <>
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', r.draw ? 'bg-slate-400' : r.win ? 'bg-emerald-500' : 'bg-rose-500')} />
                  <span className="text-[11.5px] font-bold leading-tight">
                    {r.draw ? 'Draw' : r.win ? 'Win' : 'Loss'} vs {opp?.name || 'Unknown'}
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-muted-foreground">
                  {r.method}{r.round ? ` · R${r.round}` : ''}{r.date ? ` · ${formatDate(r.date)}` : ''}
                </div>
                {eventName && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{eventName}</div>}
              </>
            }
          >
            <div
              className={cn(
                'flex h-7 w-7 cursor-default items-center justify-center rounded-md text-[11px] font-extrabold text-white transition-transform hover:scale-110',
                r.draw ? 'bg-slate-400' : r.win ? 'bg-emerald-500' : 'bg-rose-500'
              )}
            >
              {r.draw ? 'D' : r.win ? 'W' : 'L'}
            </div>
          </Tip>
        )
      })}
    </div>
  )
}

// Fights-per-year column chart. Hover gives the year's W/L split, and the window
// slides by translating the full row rather than swapping its contents, so each bar
// visibly travels to its new slot.
function ActivityBars({ activity, oppData, start = 0, size = 6 }) {
  const max = Math.max(1, ...activity.map((a) => a.count))
  const n = activity.length
  const win = Math.min(size, n) || 1
  return (
    <div className="overflow-hidden">
      <div
        className="flex h-[86px] items-end"
        style={{
          width: `${(n / win) * 100}%`,
          transform: `translateX(-${(start / n) * 100}%)`,
          transition: 'transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)',
        }}
      >
        {activity.map((a, i) => (
          <Tip
            key={a.year}
            align={i === start ? 'start' : i === start + win - 1 ? 'end' : 'center'}
            className="flex shrink-0 flex-col items-center gap-1 px-1"
            style={{ width: `${100 / n}%` }}
            content={
              <>
                <div className="text-[11.5px] font-bold leading-tight">{a.year} · {a.count} {a.count === 1 ? 'fight' : 'fights'}</div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                  <span className="font-bold text-emerald-600">{a.wins}W</span>
                  <span className="font-bold text-rose-600">{a.losses}L</span>
                </div>
                <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
                  {a.opponents.map((o, oi) => (
                    <div key={`${o.oppId}-${oi}`} className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', o.draw ? 'bg-slate-400' : o.win ? 'bg-emerald-500' : 'bg-rose-500')} />
                      <span className="text-[10.5px] leading-tight">{oppData?.[String(o.oppId)]?.name || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              </>
            }
          >
            <span className="text-[10px] font-extrabold tabular-nums text-foreground">{a.count}</span>
            <div className="w-full cursor-default rounded-t-sm bg-blue-600 transition-colors duration-200 hover:bg-blue-500" style={{ height: `${Math.max(4, (a.count / max) * 46)}px` }} />
            <span className="text-[9px] font-semibold text-muted-foreground">{a.year}</span>
          </Tip>
        ))}
      </div>
    </div>
  )
}

// that deriveProfile already computes.
function SkillCallout({ label, dims, cls }) {
  return (
    <div>
      <div className={cn('mb-1 text-[9px] font-bold uppercase tracking-wide', cls)}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {dims.map((d) => (
          <span key={d.key} className="inline-flex items-baseline gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10.5px]">
            <span className="font-medium text-foreground/80">{d.short}</span>
            <span className="font-extrabold tabular-nums text-foreground">{ordinal(d.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function DimBar({ dim }) {
  return (
    <div className="flex min-h-0 items-center gap-2.5">
      <span className="w-[136px] shrink-0 truncate text-[11.5px] font-medium leading-tight text-foreground/80">{dim.label}</span>
      {/* min-w guards the track from collapsing to a dot in narrow columns */}
      <div className="h-[7px] min-w-[60px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all duration-500', dim.group === 'striking' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-500')} style={{ width: `${dim.value}%` }} />
      </div>
      {/* w-10 fits a 3-digit ordinal ("100th"); w-8 clipped it */}
      <span className="w-10 shrink-0 text-right text-xs font-extrabold tabular-nums text-foreground">{ordinal(dim.value)}</span>
    </div>
  )
}

export default function FighterProfilePage() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: null, fighter: null, fights: [], career: null, ranked: null, divisionLabel: null, divisionFighters: null })
  const [tab, setTab] = useState('skills')
  const [openFight, setOpenFight] = useState(null) // one expanded row at a time
  const [oppData, setOppData] = useState({}) // { [fighterId]: { name, image_url } }

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.all([
      fetchFighter(id),
      fetchFighterFights(id).catch(() => []),
      fetchFighterStats(id).catch(() => []),
      fetchRankings().catch(() => ({ weight_classes: [] })),
      // Must pass a limit — /ufc/events defaults to 50, which only names fights
      // from the 50 most recent events. 500 is the endpoint's cap and matches
      // what UFCPage/ModelPage request, so this shares their cache entry.
      fetchEvents({ limit: 500 }).catch(() => []),
      // Empty until the rank-history backfill has been run; the chart falls back
      // to output-per-fight in that case.
      fetchFighterRankHistory(id).catch(() => []),
    ])
      .then(([fighter, fights, stats, rankings, events, rankHistory]) => {
        if (cancelled) return
        let ranked = null, divisionLabel = null, divisionFighters = null
        for (const wc of rankings.weight_classes || []) {
          const hit = wc.fighters.find((f) => String(f.id) === String(id))
          if (hit && !wc.key.startsWith('p4p')) { ranked = hit; divisionLabel = wc.label; divisionFighters = wc.fighters; break }
          if (hit && !ranked) { ranked = hit; divisionLabel = wc.label; divisionFighters = wc.fighters }
        }
        const career = aggregateCareer(stats, fights, id)
        const eventMap = {}
        for (const e of events || []) eventMap[String(e.id)] = e.name
        setState({ loading: false, error: null, fighter, fights, stats, rankHistory, career, ranked, divisionLabel, divisionFighters, rankings, eventMap })
      })
      .catch((e) => !cancelled && setState((s) => ({ ...s, loading: false, error: e.message })))
    return () => { cancelled = true }
  }, [id])

  const { loading, error, fighter, fights, career, ranked, divisionLabel, divisionFighters } = state

  // Resolve opponent data (name + image) for the recent-fights list.
  useEffect(() => {
    if (!fighter || !fights?.length) return
    const oppIds = [...new Set(fights.map((f) => (String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id)).filter(Boolean).map(String))]

    // Build lookup from ALL divisions in rankings data
    const fromRankings = {}
    for (const wc of state.rankings?.weight_classes || []) {
      for (const f of wc.fighters) {
        fromRankings[String(f.id)] = { name: `${f.first_name} ${f.last_name}`, image_url: f.image_url }
      }
    }

    // Apply known data immediately
    const resolved = {}
    const still = []
    for (const oid of oppIds) {
      if (oid in oppData) continue
      if (oid in fromRankings) resolved[oid] = fromRankings[oid]
      else still.push(oid)
    }
    if (Object.keys(resolved).length) {
      setOppData((prev) => ({ ...prev, ...resolved }))
    }

    if (!still.length) return
    let cancelled = false
    Promise.all(still.map((oid) => fetchFighter(oid).then((o) => [oid, { name: `${o.first_name} ${o.last_name}`, image_url: o.image_url }]).catch(() => [oid, { name: 'Unknown', image_url: null }])))
      .then((pairs) => { if (!cancelled) setOppData((prev) => ({ ...prev, ...Object.fromEntries(pairs) })) })
    return () => { cancelled = true }
  }, [fighter, fights, state.rankings]) // eslint-disable-line react-hooks/exhaustive-deps

  const profile = useMemo(() => {
    if (!ranked || !divisionFighters) return null
    return deriveProfile(ranked, buildPercentile(divisionFighters))
  }, [ranked, divisionFighters])

  const upcoming = useMemo(() => {
    if (!fighter || !fights?.length) return null
    const f = fights.find((f) => f.winner_id == null && !f.method && f.date && new Date(f.date) >= new Date())
    if (!f) return null
    const oppId = String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id
    return { id: f.id, oppId, date: f.date }
  }, [fights, fighter])

  const recent = useMemo(() => {
    if (!fighter) return []
    return (fights || [])
      .filter((f) => f.winner_id != null || f.method)
      .slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map((f) => {
        const win = String(f.winner_id) === String(fighter.id)
        const oppId = String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id
        const eventName = state.eventMap?.[String(f.event_id)] || null
        return { id: f.id, win, oppId, method: methodLabel(f.method), detail: f.details || '', round: f.finish_round, time: f.finish_time, date: f.date, eventName }
      })
  }, [fights, fighter, state.eventMap])

  const form = useMemo(() => (fighter ? deriveForm(fights, fighter.id) : null), [fights, fighter])

  // Per-fight stat rows keyed by fight, split into the totals row and the rounds.
  const statsByFight = useMemo(() => {
    const map = {}
    for (const r of state.stats || []) {
      const k = String(r.fight_id)
      if (!map[k]) map[k] = { total: null, rounds: [] }
      if (Number(r.round_number) === 0) map[k].total = r
      else map[k].rounds.push(r)
    }
    for (const k of Object.keys(map)) map[k].rounds.sort((a, b) => a.round_number - b.round_number)
    return map
  }, [state.stats])

  // Significant strikes landed per minute, per fight, oldest first.
  const outputTrend = useMemo(() => {
    const fightById = {}
    for (const f of fights || []) fightById[String(f.id)] = f
    return recent
      .slice()
      .reverse()
      .map((r) => {
        const t = fightTotals(statsByFight[String(r.id)])
        const secs = fightById[String(r.id)]?.fight_time_seconds
        if (!t || !secs) return null
        // winner_id null means draw or no contest — null, not false, so the dot
        // stays neutral instead of being coloured as a loss.
        const decided = fightById[String(r.id)]?.winner_id != null
        return {
          id: r.id,
          date: r.date,
          win: decided ? r.win : null,
          oppId: r.oppId,
          spm: t.sig_str_landed / (secs / 60),
        }
      })
      .filter(Boolean)
  }, [recent, statsByFight, fights])

  // Rank after each bout when the backfill has been run, else the output series.
  // Both are per-fight and oldest-first, so the chart consumes them identically.
  const rankTrend = useMemo(() => (state.rankHistory || []).map((r) => ({
    id: r.fight_id || r.as_of,
    date: r.as_of,
    win: r.won,
    oppId: r.opponent_id,
    rank: r.rank,
    totalRanked: r.total_ranked,
    division: r.weight_class,
  })), [state.rankHistory])

  const usingRank = rankTrend.length > 1
  const trendData = usingRank ? rankTrend : outputTrend

  // Long careers get windowed so the charts stay readable. Both slide by a few
  // items per click rather than paging, so the series reads as one spectrum.
  const TREND_WIN = 12
  const YEAR_WIN = 6

  // Rank axis: always anchored at #1, extending only as far as the worst rank this
  // fighter actually held, so the scale is sized to their career rather than the
  // division. Ticks step 1, 5, 10, 15…
  const rankAxis = useMemo(() => {
    if (!usingRank) return null
    const worst = Math.max(...rankTrend.map((p) => p.rank), 1)
    const ticks = [1]
    for (let v = 5; v <= worst; v += 5) ticks.push(v)
    return { domain: [1, Math.max(worst + 0.4, 2)], ticks }
  }, [usingRank, rankTrend])
  const trendWin = useSlidingWindow(trendData.length, TREND_WIN, 5)
  const yearWin = useSlidingWindow(form?.activity?.length || 0, YEAR_WIN, 3)

  const toggleFight = (id) => setOpenFight((prev) => (prev === id ? null : id))

  // Extra bio rows derived from what the fighter/fight records already carry.
  const bio = useMemo(() => {
    if (!fighter) return {}
    const dated = (fights || [])
      .filter((f) => f.date && (f.winner_id != null || f.method))
      .map((f) => f.date)
      .sort()
    return {
      age: fighter.dob ? Math.floor((NOW - new Date(`${fighter.dob}T00:00:00`)) / 31557600000) : null,
      debut: dated.length ? new Date(`${dated[0]}T00:00:00`).getFullYear() : null,
      last: dated.length ? formatDate(dated[dated.length - 1]) : null,
    }
  }, [fighter, fights])

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (error) return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load fighter: {error}</p></CardContent></Card>
  if (!fighter) return null

  const isChamp = ranked?.rank === 1
  const record = formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden lg:flex-row">
      {/* Actions live in the Layout breadcrumb row — see HeaderActions. */}
      <HeaderActions>
        {/* next fight — always rendered as a box, empty state included */}
        {(() => {
          const opp = upcoming ? oppData[String(upcoming.oppId)] : null
          const shell = 'flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-2 pr-2.5'
          if (!upcoming) {
            return (
              <div className={cn(shell, 'text-muted-foreground')}>
                <span className="text-[9px] font-bold uppercase tracking-wide">Next</span>
                <span className="text-[12px] leading-none">No fight scheduled</span>
              </div>
            )
          }
          return (
            <Link to={`/ufc/fighters/${upcoming.oppId}`} className={cn(shell, 'transition-colors hover:bg-muted')}>
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Next</span>
              {opp?.image_url ? (
                <img src={opp.image_url} alt="" className="h-5 w-5 rounded-full object-cover object-top" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                  {opp?.name ? opp.name.split(' ').map((n) => n[0]).join('') : '?'}
                </div>
              )}
              <span className="text-[12.5px] font-bold leading-none">vs {opp?.name || 'TBA'}</span>
              <span className="text-[10.5px] leading-none text-muted-foreground">{formatDate(upcoming.date)}</span>
            </Link>
          )
        })()}
        <SlideTabs
          size="sm"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'skills', label: 'Skills' },
            { key: 'overview', label: 'Career Overview' },
            { key: 'career', label: 'Career Stats' },
            { key: 'fights', label: 'Fight History', badge: recent.length || null },
          ]}
        />
        <Link to="/ufc/fighters/stats" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to fighters
        </Link>
      </HeaderActions>

      {/* ---------------- LEFT: identity + scores ---------------- */}
      <div className="flex shrink-0 flex-col gap-3 overflow-y-auto lg:w-[280px]">
          {/* identity */}
          <div className="rounded-lg border border-border p-2.5">
            <div className="relative flex h-[168px] items-end justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-blue-500/10 to-transparent">
              <WavingFlag countryCode={fighter.country_code} />
              {fighter.image_url ? (
                <img src={fighter.image_url} alt={`${fighter.first_name} ${fighter.last_name}`} className="relative z-10 h-[160px] object-contain object-bottom" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-extrabold text-muted-foreground/30">{initialsOf(fighter)}</div>
              )}
              {isChamp && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-amber-600 backdrop-blur">
                  <Crown className="h-3 w-3" /> CHAMPION
                </div>
              )}
            </div>

            <div className="mt-2">
              <div className="flex items-center gap-2">
                <CountryFlag countryCode={fighter.country_code} />
                <h1 className="text-lg font-extrabold leading-none tracking-tight">{fighter.first_name} {fighter.last_name}</h1>
              </div>
              {fighter.nickname && <div className="mt-0.5 text-xs text-muted-foreground">"{fighter.nickname}"</div>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums">{record}</span>
                {ranked && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">Power {ranked.score.toFixed(0)}</span>}
                {ranked && divisionLabel && (
                  <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600">#{ranked.rank} {divisionLabel}</span>
                )}
              </div>
            </div>

            {/* bio */}
            <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t pt-2.5 text-sm">
              {[
                ['Height', fighter.height], ['Weight', fighter.weight],
                ['Reach', fighter.reach], ['Stance', fighter.stance],
                ['Age', bio.age ? `${bio.age} yrs` : null], ['Division', divisionLabel],
                ['UFC debut', bio.debut], ['Last fight', bio.last],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div><div className="text-[13px] font-semibold">{v}</div></div>
              ))}
            </div>
          </div>

          {/* outcomes — flex-1 so this card absorbs the slack and the column's
              bottom edge lines up with the card in the right-hand column */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border p-2.5">
            {career?.hasStats && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-1 shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Outcomes</div>
                <div className="grid flex-1 auto-rows-fr grid-cols-3 gap-1.5">
                  <OutcomeChip label="Win%" value={`${career.winPct}%`} />
                  <OutcomeChip label="Finish %" value={`${career.finishRate}%`} />
                  <OutcomeChip label="KO/TKO" value={career.ko} />
                  <OutcomeChip label="Submission" value={career.sub} />
                  <OutcomeChip label="Decision" value={career.dec} />
                  <OutcomeChip label="UFC fights" value={career.fightCount} />
                </div>
              </div>
            )}
          </div>

        </div>

      {/* ------ RIGHT: one card, four tabs (skills / overview / stats / fights) ------ */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* Skills never scrolls — it compresses to whatever height is available.
            Everything else keeps the ScrollArea, with short panels stretched to fill. */}
        {tab === 'skills' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            {profile ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[290px_1fr]">
                {/* radar + best/worst axes */}
                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border p-3">
                  <div className="mb-1 flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Skill Radar</span>
                    <span className="text-[11px] text-muted-foreground">vs {divisionLabel}</span>
                  </div>
                  {/* radar takes the slack and scales down when the window is short;
                      max-h-full keeps it inside the card instead of forcing a scroll */}
                  <RadarChart axes={profile.axes} />
                  <p className="mt-1 shrink-0 text-center text-[10px] text-muted-foreground">
                    Hover an axis for detail · radius = percentile
                  </p>
                  <div className="mt-2.5 shrink-0 space-y-2 border-t pt-2.5">
                    <SkillCallout label="Strengths" dims={profile.strengths.slice(0, 3)} cls="text-emerald-600" />
                    <SkillCallout label="Weaknesses" dims={profile.weaknesses.slice(0, 3)} cls="text-rose-600" />
                  </div>

                  <div className="mb-1 mt-2.5 shrink-0 text-[9px] font-bold uppercase tracking-wide text-blue-600">Group Averages</div>
                  <div className="grid shrink-0 grid-cols-3 gap-1.5">
                    {profile.groups.map((g) => (
                      <div key={g.label} className="rounded-xl border bg-muted/40 py-2 text-center">
                        <div className={cn('text-lg font-extrabold leading-none tabular-nums', g.cls)}>{g.value}</div>
                        <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* skill decomposition */}
                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border p-3">
                  <div className="mb-2 flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Skill Decomposition</span>
                    <span className="text-[11px] text-muted-foreground">vs {divisionLabel}</span>
                  </div>
                  {/* Striking above, grappling below — one full-width column each,
                      so the bar track gets the whole card width instead of ~20px. */}
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Striking</span>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 overflow-hidden">{profile.striking.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Grappling</span>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 overflow-hidden">{profile.grappling.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No ranked skill decomposition for this fighter (unranked or insufficient rounds).</p>
            )}
          </div>
        ) : (
        <ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!flex [&>div]:!min-h-full [&>div]:!flex-col">
          <div className="flex flex-1 flex-col p-3">
            {/* ---------------- OVERVIEW ---------------- */}
            {tab === 'overview' && (form ? (
              <div className="grid flex-1 gap-3 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <HeroTile
                      icon={Flame}
                      label="Current streak"
                      value={`${form.streak}${form.streakWin ? 'W' : 'L'}`}
                      sub={`Longest win run: ${form.longestWin}`}
                      accent={form.streakWin ? 'text-emerald-500' : 'text-rose-500'}
                    />
                    <HeroTile icon={Timer} label="Octagon" value={form.octagonTime} sub={`Avg ${form.avgFightTime}`} />
                    <HeroTile icon={Swords} label="R1 finishes" value={form.r1Finishes} sub={`${form.distanceRate}% decisions`} />
                    <HeroTile
                      icon={TrendingUp}
                      label="Last fight"
                      value={form.daysSinceLast != null ? `${form.daysSinceLast}d` : '—'}
                      sub={form.lastDate ? formatDate(form.lastDate) : 'Date unknown'}
                    />
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Recent form</span>
                      <span className="text-[10px] text-muted-foreground">most recent first</span>
                    </div>
                    <FormStrip results={form.recentForm} oppData={oppData} eventMap={state.eventMap} />
                  </div>

                  {form.activity.length > 1 && (
                    <div className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Fights per year</span>
                        {form.activity.length > 6 && (
                          <SlideControls
                            win={yearWin}
                            label={`${form.activity[yearWin.start]?.year ?? ''}–${form.activity[yearWin.end - 1]?.year ?? ''}`}
                          />
                        )}
                      </div>
                      <ActivityBars
                        activity={form.activity}
                        oppData={oppData}
                        start={yearWin.start}
                        size={YEAR_WIN}
                      />
                    </div>
                  )}

                  {trendData.length > 1 && (
                    <div className="flex min-h-[190px] flex-1 flex-col rounded-lg border border-border p-3">
                      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">
                          {usingRank ? 'Rank after each fight' : 'Output per fight'}
                        </span>
                        <SlideControls
                          win={trendWin}
                          label={`${trendWin.start + 1}–${trendWin.end} of ${trendData.length}`}
                        />
                      </div>
                      <BumpChart
                        start={trendWin.start}
                        size={TREND_WIN}
                        domain={rankAxis?.domain}
                        ticks={rankAxis?.ticks}
                        yLabel={usingRank ? 'RANK' : 'SIG. STR/MIN'}
                        invertY={usingRank}
                        formatValue={usingRank ? (v) => `#${Math.round(v)}` : (v) => v.toFixed(2)}
                        points={trendData.map((p) => {
                          const div = p.division ? divisionName(p.division) : null
                          return {
                            id: p.id,
                            win: p.win,
                            label: p.date ? String(p.date).slice(0, 4) : '—',
                            title: `${p.win == null ? '' : p.win ? 'W' : 'L'} vs ${oppData?.[String(p.oppId)]?.name || 'Unknown'}`.trim(),
                            sub: p.date ? formatDate(p.date) : null,
                            context: usingRank && div ? `${div}${p.totalRanked ? ` · of ${p.totalRanked}` : ''}` : null,
                            division: usingRank ? p.division : null,
                            divisionLabel: usingRank ? div : null,
                          }
                        })}
                        series={[{
                          key: usingRank ? 'rank' : 'spm',
                          label: usingRank ? 'Divisional rank' : 'Sig. str/min',
                          color: 'var(--color-viz-1)',
                          values: trendData.map((p) => (usingRank ? p.rank : p.spm)),
                        }]}
                      />
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col gap-3">
                  <div className="space-y-3.5 rounded-lg border border-border p-3">
                    <SplitBar title={`How they win · ${form.totalWins}`} segments={form.winMethods} unit="" />
                    <SplitBar title={`How they lose · ${form.totalLosses}`} segments={form.lossMethods} unit="" />
                  </div>

                  {career?.hasStats && (
                    <div className="rounded-lg border border-border p-3">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Career rates</div>
                      {/* Win%/Finish% live in the left panel — these are per-time rates instead. */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <StatTile label="Sig. str/min" value={career.slpm.toFixed(2)} />
                        <StatTile label="Str. acc" value={`${career.sigAcc}%`} />
                        <StatTile label="KD / 15" value={career.kd15.toFixed(2)} />
                        <StatTile label="TD / 15" value={career.td15.toFixed(2)} />
                        <StatTile label="TD acc" value={`${career.tdAcc}%`} />
                        <StatTile label="Ctrl / 15" value={career.ctrl15Str} />
                      </div>
                    </div>
                  )}

                  <SimilarFighters fighterId={fighter.id} className="flex min-h-0 flex-1 flex-col" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed fight history available.</p>
            ))}

            {/* ---------------- CAREER STATS ---------------- */}
            {tab === 'career' && (career?.hasStats ? (
              <div className="grid flex-1 gap-3 xl:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">Striking</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="Sig. str/min" value={career.slpm.toFixed(2)} />
                    <StatTile label="Total str/min" value={career.tslpm.toFixed(2)} />
                    <StatTile label="Sig. str. accuracy" value={`${career.sigAcc}%`} />
                    <StatTile label="Knockdowns / 15" value={career.kd15.toFixed(2)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                    <StatTile label="Sig. strikes landed" value={career.totals.sig.toLocaleString()} />
                    <StatTile label="Sig. strikes thrown" value={career.totals.sigAtt.toLocaleString()} />
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Grappling</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="TD / 15" value={career.td15.toFixed(2)} />
                    <StatTile label="TD accuracy" value={`${career.tdAcc}%`} />
                    <StatTile label="Control / 15" value={career.ctrl15Str} />
                    <StatTile label="Sub att / 15" value={career.subAtt15.toFixed(1)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                    <StatTile label="Takedowns landed" value={career.totals.td} />
                    <StatTile label="Total control" value={`${Math.round(career.totals.ctrlSeconds / 60)}m`} />
                  </div>
                </div>

                <div className="space-y-3.5 rounded-lg border border-border p-3">
                  <SplitBar
                    title="Where they strike"
                    segments={[
                      { label: 'Head', value: career.head, cls: 'bg-amber-500' },
                      { label: 'Body', value: career.body, cls: 'bg-amber-400' },
                      { label: 'Leg', value: career.leg, cls: 'bg-amber-300' },
                    ]}
                  />
                  <SplitBar
                    title="Where they fight"
                    segments={[
                      { label: 'Distance', value: career.distance, cls: 'bg-blue-500' },
                      { label: 'Clinch', value: career.clinch, cls: 'bg-violet-500' },
                      { label: 'Ground', value: career.ground, cls: 'bg-indigo-500' },
                    ]}
                  />
                  <SplitBar
                    title={`Win methods · ${career.ko + career.sub + career.dec}`}
                    unit=""
                    segments={[
                      { label: 'KO/TKO', value: career.ko, cls: 'bg-rose-500' },
                      { label: 'Submission', value: career.sub, cls: 'bg-indigo-500' },
                      { label: 'Decision', value: career.dec, cls: 'bg-slate-400' },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No per-fight statistics recorded for this fighter.</p>
            ))}

            {/* ---------------- FIGHT HISTORY ---------------- */}
            {tab === 'fights' && (recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fight history available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="w-6 py-1.5" />
                      <th className="w-8 py-1.5 font-bold">W/L</th>
                      <th className="py-1.5 pr-2 font-bold">Opponent</th>
                      <th className="py-1.5 pr-2 font-bold">Method</th>
                      <th className="w-10 py-1.5 pr-2 font-bold">Rd</th>
                      <th className="w-14 py-1.5 pr-2 font-bold">Time</th>
                      <th className="w-24 py-1.5 pr-2 font-bold">Date</th>
                      <th className="py-1.5 font-bold">Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => {
                      const opp = oppData[String(r.oppId)]
                      const open = openFight === r.id
                      const data = statsByFight[String(r.id)]
                      return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={() => toggleFight(r.id)}
                            className={cn('cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40', open && 'bg-muted/40')}
                          >
                            <td className="py-1.5 pl-1 text-muted-foreground">
                              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
                            </td>
                            <td className="py-1.5">
                              <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold text-white', r.win ? 'bg-emerald-500' : 'bg-rose-500')}>
                                {r.win ? 'W' : 'L'}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2">
                              <div className="flex items-center gap-2">
                                {opp?.image_url ? (
                                  <img src={opp.image_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover object-top" />
                                ) : (
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                                    {opp?.name ? opp.name.split(' ').map((n) => n[0]).join('') : '?'}
                                  </div>
                                )}
                                <Link
                                  to={`/ufc/fighters/${r.oppId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate text-[12.5px] font-bold hover:text-blue-600"
                                >
                                  {opp?.name || 'Unknown'}
                                </Link>
                              </div>
                            </td>
                            <td className="py-1.5 pr-2 text-[11.5px] font-semibold text-foreground/70">{r.method}</td>
                            <td className="py-1.5 pr-2 text-[11.5px] tabular-nums text-muted-foreground">{r.round ? `R${r.round}` : '—'}</td>
                            <td className="py-1.5 pr-2 text-[11.5px] tabular-nums text-muted-foreground">{r.time || '—'}</td>
                            <td className="py-1.5 pr-2 text-[11px] text-muted-foreground">{r.date ? formatDate(r.date) : '—'}</td>
                            <td className="max-w-[180px] truncate py-1.5 text-[11px] text-muted-foreground/80">{r.eventName || '—'}</td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={8} className="p-0 pb-1.5">
                                <FightDetail detail={r.detail} data={data} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </ScrollArea>
        )}
      </div>
    </div>
  )
}

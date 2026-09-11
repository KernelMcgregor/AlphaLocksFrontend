// src/pages/FighterProfilePage.jsx
import { ArrowLeft, ChevronLeft, ChevronRight, Crown, Flame, Loader2, Swords, Timer, TrendingUp } from 'lucide-react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import HeaderActions from '../components/layout/HeaderActions'
import SimilarFighters from '../components/sports/SimilarFighters'
import { Card, CardContent } from '../components/ui/card'
import { SlideTabs } from '../components/ui/slide-tabs'
import { Tip } from '../components/ui/tip'
import FighterMini from '../components/sports/FighterMini'
// NOTE: add `export const fetchFighterStats = (id) => cachedRequest(`/ufc/fighters/${id}/stats`)`
// to src/lib/api.js — the endpoint already exists in routers/ufc.py.
import { fetchEvents, fetchFighter, fetchFighterCareerStats, fetchFighterFights, fetchFighterRankHistory, fetchFighterStats, fetchRankings } from '../lib/api'
import { cn, formatDate, formatRecord } from '../lib/utils'
import { aggregateCareer, buildPercentile, deriveForm, deriveProfile, deriveRoundPacing, deriveRoundSurvival, deriveTwoWay, initialsOf, methodLabel, ordinal } from '../lib/fighterAnalytics'

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

// Order here is the order they appear in the scrolling column.
const SECTIONS = [
  { key: 'skills', label: 'Skills' },
  { key: 'overview', label: 'Career Overview' },
  { key: 'career', label: 'Career Stats' },
  { key: 'fights', label: 'Fight History' },
]

// UFC.com writes "--" for a missing measurement rather than leaving it blank, and a
// truthy string sails through a plain falsy check. Reach alone has ~1,983 of them.
function val(v) {
  const t = typeof v === 'string' ? v.trim() : v
  return !t || t === '--' ? null : t
}

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
    <div ref={wrapRef} className="relative flex w-full justify-center py-1">
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="h-auto w-full max-w-[300px]">
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

      // Cover-fit the flag at its own aspect ratio, then oversize so the waves
      // never reveal an edge. Scaling W and H independently (the previous
      // behaviour) stretched the flag whenever the container's aspect changed —
      // which it now does constantly, since the portrait flexes with the column.
      const scale = 1.35
      const imgAspect = img.naturalWidth / img.naturalHeight
      const boxAspect = W / H
      const baseW = boxAspect > imgAspect ? W : H * imgAspect
      const baseH = boxAspect > imgAspect ? W / imgAspect : H
      const flagW = baseW * scale
      const flagH = baseH * scale
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
// A row is padding if nothing at all was recorded in it.
const EMPTY_ROUND = (r) => !(
  Number(r.sig_str_attempted) || Number(r.total_str_attempted) || Number(r.td_attempted)
  || Number(r.sub_att) || Number(r.kd) || Number(r.ctrl_seconds) || Number(r.rev)
)

function FightDetail({ detail, data, finishRound }) {
  const t = fightTotals(data)

  // 286 fighter-fights carry zero-filled stat rows past the round the bout
  // actually ended in — one runs to R23 — so the table has to be capped rather
  // than rendering whatever rows exist. finish_round is authoritative; when it is
  // missing (no-contests) fall back to trimming the trailing empty rows.
  const rounds = useMemo(() => {
    const all = data?.rounds || []
    if (finishRound) return all.filter((r) => Number(r.round_number) <= finishRound)
    const out = all.slice()
    while (out.length && EMPTY_ROUND(out[out.length - 1])) out.pop()
    return out
  }, [data, finishRound])
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
            <StatTile label="Sig. Strikes" value={`${t.sig_str_landed}/${t.sig_str_attempted}`} />
            <StatTile label="Sig. Accuracy" value={`${pct(t.sig_str_landed, t.sig_str_attempted)}%`} />
            <StatTile label="Total Strikes" value={t.total_str_landed} />
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

          {rounds.length > 0 && (
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
                    {rounds.map((r) => (
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
function BumpChart({ series, points, formatValue, yLabel, invertY = false, start = 0, size = 12, domain, ticks: tickOverride }) {
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

// The right column is one scroll container holding every section. The tab bar is a
// scrollspy over it: clicking scrolls, scrolling re-highlights. `lockUntil` swallows
// the spy for the duration of a click-driven smooth scroll, otherwise the highlight
// flickers through every section it passes on the way.
function useScrollSpy(sections) {
  const scrollRef = useRef(null)
  const nodes = useRef({})
  const lockUntil = useRef(0)
  const [active, setActive] = useState(sections[0].key)

  const register = useCallback((id, el) => {
    if (el) nodes.current[id] = el
    else delete nodes.current[id]
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return undefined
    const onScroll = () => {
      if (Date.now() < lockUntil.current) return
      // bottom of the scroll can never reach the last section's top, so pin it
      const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 8
      let current = sections[0].key
      if (atBottom) {
        current = sections[sections.length - 1].key
      } else {
        const line = root.scrollTop + 28
        for (const sec of sections) {
          const el = nodes.current[sec.key]
          if (el && el.offsetTop <= line) current = sec.key
        }
      }
      setActive((a) => (a === current ? a : current))
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [sections])

  const scrollTo = (id) => {
    const root = scrollRef.current
    const el = nodes.current[id]
    if (!root || !el) return
    lockUntil.current = Date.now() + 800
    setActive(id)
    root.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: 'smooth' })
  }

  return { scrollRef, register, active, scrollTo }
}

// One titled sub-box in the scrolling column.
function Section({ id, title, note, children, className, register }) {
  return (
    <section
      ref={(el) => register(id, el)}
      className={cn('flex shrink-0 flex-col rounded-xl border border-border p-3', className)}
    >
      <div className="mb-2 flex shrink-0 items-baseline gap-2">
        <h2 className="text-[13px] font-extrabold tracking-tight">{title}</h2>
        {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Offense vs defense. Encoding across every mark below: viz-1 (blue) is this
// fighter, viz-2 (orange) is their opponents. Two shades of one hue were tried
// first and did not separate at dot size; "fighter" and "opponents" are two
// entities, so a validated categorical pair is the honest encoding anyway.
// ---------------------------------------------------------------------------
const fmtTwoWay = (v, fmt) => {
  if (v == null) return '—'
  if (fmt === 'pct1') return `${v.toFixed(1)}%`
  if (fmt === 'clock') return clock(v)
  return v.toFixed(2)
}

function TwoWayLegend() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-viz-1" />
        <span className="text-[10px] font-semibold text-muted-foreground">Fighter</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-viz-2" />
        <span className="text-[10px] font-semibold text-muted-foreground">Opponents</span>
      </span>
    </div>
  )
}

// One metric: what they do vs what is done to them, as two dots on a shared track.
// Each row carries its OWN scale — the units differ per row and both ends are
// directly labelled, so this reads as a two-number comparison, not a shared axis.
function DumbbellRow({ label, self, opp, fmt }) {
  const domain = Math.max(self ?? 0, opp ?? 0) * 1.12 || 1
  const pos = (v) => (v == null ? null : Math.max(3, Math.min(97, (v / domain) * 100)))
  const xs = pos(self)
  const xo = pos(opp)
  const delta = self != null && opp != null ? self - opp : null

  // When the two dots sit close together, centred labels would overlap. Rather
  // than merging them into one string — which made that row look unlike every
  // other row — anchor each label to the far side of its own dot so the pair
  // grows apart instead of into each other.
  const tight = xs != null && xo != null && Math.abs(xs - xo) < 18
  const anchor = (mine, other) => {
    if (!tight) return '-translate-x-1/2'
    return mine <= other ? '-translate-x-full' : 'translate-x-0'
  }

  return (
      <div className="flex items-center gap-2.5 py-[3px]">
        <span className="w-[100px] shrink-0 whitespace-nowrap text-[11px] font-medium leading-tight text-foreground/80">{label}</span>

        {/* 34px: labels own the top band, the track sits at 24px */}
        <div className="relative h-[34px] min-w-[90px] flex-1">
          <div className="absolute inset-x-0 top-[24px] h-px bg-border" />
          {xs != null && xo != null && (
            <div
              className="absolute top-[24px] h-[3px] -translate-y-1/2 rounded-full bg-foreground/15"
              style={{ left: `${Math.min(xs, xo)}%`, width: `${Math.abs(xs - xo)}%` }}
            />
          )}
          {xo != null && (
            <>
              <span className="absolute top-[24px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-viz-2 ring-2 ring-card" style={{ left: `${xo}%` }} />
              <span
                className={cn('absolute top-0 whitespace-nowrap text-[9.5px] font-semibold tabular-nums text-viz-2', anchor(xo, xs))}
                style={{ left: `${xo}%` }}
              >
                {fmtTwoWay(opp, fmt)}
              </span>
            </>
          )}
          {xs != null && (
            <>
              <span className="absolute top-[24px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-viz-1 ring-2 ring-card" style={{ left: `${xs}%` }} />
              <span
                className={cn('absolute top-0 whitespace-nowrap text-[9.5px] font-bold tabular-nums text-foreground', anchor(xs, xo))}
                style={{ left: `${xs}%` }}
              >
                {fmtTwoWay(self, fmt)}
              </span>
            </>
          )}
        </div>

        {/* Signed, so colour reinforces rather than carries the meaning. */}
        <span className={cn(
          'w-[54px] shrink-0 text-right text-[10.5px] font-bold tabular-nums',
          delta == null ? 'text-muted-foreground' : delta >= 0 ? 'text-emerald-600' : 'text-rose-600',
        )}>
          {delta == null ? '—' : `${delta >= 0 ? '+' : '−'}${fmtTwoWay(Math.abs(delta), fmt)}`}
        </span>
      </div>
  )
}

// Where they strike vs where they are struck. Shared domain across both halves —
// that comparability is the entire point of a mirror.
function MirrorBars({ title, rows, mode }) {
  const pm = mode === 'pm'
  const vals = rows.flatMap((r) => [pm ? r.selfPm : r.self, pm ? r.oppPm : r.opp]).filter((v) => v != null)
  const domain = Math.max(...vals, 0.01) * 1.05
  const fmt = (v) => (v == null ? '—' : pm ? v.toFixed(2) : `${Math.round(v)}%`)

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_78px_1fr] items-baseline gap-1.5">
        <span className="text-right text-[9px] font-bold uppercase tracking-wide text-muted-foreground">They strike</span>
        <span className="text-center text-[10px] font-bold uppercase tracking-wide text-foreground/70">{title}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">They&apos;re hit</span>
      </div>
      <div className="flex flex-col gap-[6px]">
        {rows.map((r) => {
          const a = pm ? r.selfPm : r.self
          const b = pm ? r.oppPm : r.opp
          return (
              <div key={r.label} className="grid grid-cols-[1fr_78px_1fr] items-center gap-1.5">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[9.5px] tabular-nums text-muted-foreground">{fmt(a)}</span>
                  <div className="h-[18px] rounded-l-[4px] bg-viz-1" style={{ width: `${((a ?? 0) / domain) * 100}%` }} />
                </div>
                <span className="text-center text-[10.5px] text-foreground/80">{r.label}</span>
                <div className="flex items-center gap-1">
                  <div className="h-[18px] rounded-r-[4px] bg-viz-2" style={{ width: `${((b ?? 0) / domain) * 100}%` }} />
                  <span className="text-[9.5px] tabular-nums text-muted-foreground">{fmt(b)}</span>
                </div>
              </div>
          )
        })}
      </div>
    </div>
  )
}

// Where strikes land, drawn on a body rather than as bars. Two figures facing each
// other: the fighter on the left with what they throw, opponents on the right with
// what they land back. Zone opacity is scaled within each figure — against a fixed
// 0-100% scale the legs (typically ~10%) would be invisible next to the head.
// Front-facing figure split into the three scored target zones. The paths tile —
// head ends where the torso begins, torso where the legs do — so the zones read as
// one body rather than three stacked shapes. Arms are drawn separately and never
// filled: they are not a scored target, and shading them would imply otherwise.
// Pacing across rounds, as small multiples. One series each, so no legend box —
// each panel title names its own measure.
const PACE_PANELS = [
  { key: 'slpm', label: 'Sig. Str / Min', fmt: (v) => v.toFixed(1) },
  { key: 'sigAcc', label: 'Sig. Accuracy', fmt: (v) => `${Math.round(v)}%` },
  { key: 'td15', label: 'Takedowns / 15', fmt: (v) => v.toFixed(2) },
]

function PaceColumns({ rounds, panel }) {
  const vals = rounds.map((r) => r[panel.key]).filter((v) => v != null)
  const max = Math.max(...vals, 0.01) * 1.12
  const peak = Math.max(...vals, 0)
  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="mb-2 shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground/70">{panel.label}</div>
      {/* bars fill the box rather than sitting in a narrow centred track */}
      <div className="flex h-[152px] flex-1 items-end gap-[4px]">
        {rounds.map((r) => {
          const v = r[panel.key]
          const isPeak = v != null && v === peak
          return (
            <div key={r.round} className="flex flex-1 flex-col items-center justify-end">
              <span className={cn('mb-1 text-[10px] font-bold tabular-nums', isPeak ? 'text-foreground' : 'text-muted-foreground')}>
                {v == null ? '\u2014' : panel.fmt(v)}
              </span>
              <div
                className={cn('w-full rounded-t-[4px] bg-viz-1', r.n < 3 && 'opacity-45')}
                style={{ height: `${Math.max(3, ((v ?? 0) / max) * 128)}px` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex shrink-0 gap-[4px]">
        {rounds.map((r) => (
          <div key={r.round} className="flex-1 text-center text-[10px] font-semibold text-muted-foreground">R{r.round}</div>
        ))}
      </div>
    </div>
  )
}


// Two different questions about the same rounds, so a toggle rather than two
// panels: "fighter" asks whether THEY were stopped there; "fight" asks whether the
// BOUT carried on past it. A round they won by knockout is one the fight did not
// survive but they did — the two series genuinely disagree.
function SurvivalTable({ survival }) {
  const [mode, setMode] = useState('fighter')
  const rows = survival?.rounds || []
  const fighterMode = mode === 'fighter'

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Got out of round</span>
        <SlideTabs
          size="sm"
          value={mode}
          onChange={setMode}
          tabs={[{ key: 'fighter', label: 'Fighter' }, { key: 'fight', label: 'Fight' }]}
        />
      </div>
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            <th className="pb-1 text-left font-bold">Rd</th>
            <th className="pb-1 text-right font-bold">Entered</th>
            <th className="pb-1 text-right font-bold">Out</th>
            <th className="pb-1 text-right font-bold">%</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => {
            const out = fighterMode ? r.entered - r.stopped : r.continued
            const pctv = fighterMode ? r.survivedPct : r.continuedPct
            return (
              <tr key={r.round} className="border-t border-border/60">
                <td className="py-[3px] font-bold">R{r.round}</td>
                <td className="py-[3px] text-right text-muted-foreground">{r.entered}</td>
                <td className="py-[3px] text-right text-muted-foreground">{out}</td>
                <td className={cn('py-[3px] text-right font-bold', r.entered < 3 && 'opacity-50')}>
                  {pctv == null ? '—' : `${Math.round(pctv)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground/80">
        {fighterMode
          ? 'Share of bouts reaching the round that they were not stopped in.'
          : 'Share of bouts reaching the round where the fight carried on past it.'}
      </p>
    </div>
  )
}

function RoundPacing({ rounds, survival }) {
  return (
    <div className="grid items-stretch gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {PACE_PANELS.map((panel) => <PaceColumns key={panel.key} rounds={rounds} panel={panel} />)}
      {survival?.rounds?.length ? <SurvivalTable survival={survival} /> : null}
    </div>
  )
}

// Larger headline tile used by the Overview tab.
function HeroTile({ icon: Icon, label, value, sub, accent = 'text-foreground' }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border bg-gradient-to-b from-muted/60 to-muted/20 px-1.5 py-2 text-center">
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
      {results.map((r) => {
        const opp = oppData?.[String(r.oppId)]
        const eventName = eventMap?.[String(r.eventId)]
        return (
          <Tip
            key={r.id}
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
                'flex h-6 w-6 cursor-default items-center justify-center rounded-md text-[10.5px] font-extrabold text-white transition-transform hover:scale-110',
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
        className="flex h-[76px] items-end"
        style={{
          width: `${(n / win) * 100}%`,
          transform: `translateX(-${(start / n) * 100}%)`,
          transition: 'transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)',
        }}
      >
        {activity.map((a) => (
          <Tip
            key={a.year}
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
            <div className="w-full cursor-default rounded-t-sm bg-blue-600 transition-colors duration-200 hover:bg-blue-500" style={{ height: `${Math.max(4, (a.count / max) * 40)}px` }} />
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
  const { scrollRef, register, active, scrollTo } = useScrollSpy(SECTIONS)
  const [openFight, setOpenFight] = useState(null) // one expanded row at a time
  const [strikeMode, setStrikeMode] = useState('pct') // strike map: share vs per-minute
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
      // The opponent-relative half of the career line. 404s for anyone with no
      // computed row (a debut fighter), which is normal — null, not an error.
      fetchFighterCareerStats(id).catch(() => null),
    ])
      .then(([fighter, fights, stats, rankings, events, rankHistory, cstats]) => {
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
        setState({ loading: false, error: null, fighter, fights, stats, rankHistory, cstats, career, ranked, divisionLabel, divisionFighters, rankings, eventMap })
      })
      .catch((e) => !cancelled && setState((s) => ({ ...s, loading: false, error: e.message })))
    return () => { cancelled = true }
  }, [id])

  const { loading, error, fighter, fights, career, ranked, divisionLabel, divisionFighters } = state

  // Resolve opponent data (name + image) for the recent-fights list.
  useEffect(() => {
    if (!fighter || !fights?.length) return
    const oppIds = [...new Set(fights.map((f) => (String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id)).filter(Boolean).map(String))]

    // Build lookup from ALL divisions in rankings data. Carries enough for the
    // hover card (record, rank, nickname), not just name + image.
    const fromRankings = {}
    for (const wc of state.rankings?.weight_classes || []) {
      const isP4P = wc.key?.startsWith('p4p')
      for (const f of wc.fighters) {
        const key = String(f.id)
        // A fighter appears in their division and in p4p; the divisional rank is
        // the meaningful one, so never let p4p overwrite it.
        if (fromRankings[key] && isP4P) continue
        fromRankings[key] = {
          name: `${f.first_name} ${f.last_name}`,
          image_url: f.image_url,
          nickname: f.nickname,
          country_code: f.country_code,
          record: formatRecord(f.wins, f.losses, f.draws || undefined),
          rank: isP4P ? null : f.rank,
          division: isP4P ? null : wc.label,
        }
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
    Promise.all(still.map((oid) => fetchFighter(oid)
      .then((o) => [oid, {
        name: `${o.first_name} ${o.last_name}`,
        image_url: o.image_url,
        nickname: o.nickname,
        country_code: o.country_code,
        record: formatRecord(o.wins, o.losses, o.draws || undefined),
      }])
      .catch(() => [oid, { name: 'Unknown', image_url: null }])))
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

  // Offense-vs-defense pairs and the strike map, from the server's career row.
  const twoWay = useMemo(() => deriveTwoWay(state.cstats), [state.cstats])

  // Tiles that also appear as a dumbbell endpoint must agree with it. aggregateCareer
  // counts only fights present in the stats payload AND carrying fight_time_seconds;
  // the server counts every fight with a totals row. Same metric, different fight
  // set, values differing in the second decimal — inches apart on screen. Prefer the
  // server row wherever it exists and fall back to the client aggregate.
  const tiles = useMemo(() => {
    const cs = state.cstats
    if (!cs || !career) return career
    const pick = (server, client, scale = 1) => (server == null ? client : server * scale)
    return {
      ...career,
      slpm: pick(cs.slpm, career.slpm),
      tslpm: pick(cs.tslpm, career.tslpm),
      sigAcc: Math.round(pick(cs.sig_acc, career.sigAcc / 100, 1) * 100),
      kd15: pick(cs.kd15, career.kd15),
      td15: pick(cs.td15, career.td15),
      tdAcc: Math.round(pick(cs.td_acc, career.tdAcc / 100, 1) * 100),
      ctrl15Str: cs.ctrl15 == null ? career.ctrl15Str : clock(cs.ctrl15),
      subAtt15: pick(cs.sub_att15, career.subAtt15),
    }
  }, [state.cstats, career])

  // Per-round pacing, pooled across every bout. Reuses the statsByFight index.
  const pacing = useMemo(
    () => deriveRoundPacing(statsByFight, fights),
    [statsByFight, fights],
  )

  const survival = useMemo(
    () => (fighter ? deriveRoundSurvival(fights, fighter.id) : null),
    [fights, fighter],
  )

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
      // Prefer the scraped octagon_debut; fall back to the earliest dated bout.
      debut: fighter.octagon_debut
        ? new Date(`${fighter.octagon_debut}T00:00:00`).getFullYear()
        : (dated.length ? new Date(`${dated[0]}T00:00:00`).getFullYear() : null),
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
        <SlideTabs
          size="sm"
          value={active}
          onChange={scrollTo}
          tabs={SECTIONS.map((sec) => (
            sec.key === 'fights' ? { ...sec, badge: recent.length || null } : sec
          ))}
        />
        <Link to="/ufc/fighters/stats" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to fighters
        </Link>
      </HeaderActions>

      {/* ---------------- LEFT: identity + scores ---------------- */}
      <div className="flex shrink-0 flex-col gap-3 overflow-y-auto lg:w-[280px]">
          {/* identity */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border p-2.5">
            {/* flex-1 so the portrait takes any leftover column height — otherwise the
                slack collects as dead space between this card and the one below. */}
            <div className="relative flex min-h-[132px] flex-1 items-end justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-blue-500/10 to-transparent">
              <WavingFlag countryCode={fighter.country_code} />
              {fighter.image_url ? (
                <img src={fighter.image_url} alt={`${fighter.first_name} ${fighter.last_name}`} className="relative z-10 h-full w-full object-contain object-bottom" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-extrabold text-muted-foreground/30">{initialsOf(fighter)}</div>
              )}
              {isChamp && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-amber-600 backdrop-blur">
                  <Crown className="h-3 w-3" /> CHAMPION
                </div>
              )}
            </div>

            <div className="mt-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <CountryFlag countryCode={fighter.country_code} />
                <h1 className="text-lg font-extrabold leading-none tracking-tight">{fighter.first_name} {fighter.last_name}</h1>
              </div>
              {fighter.nickname && <div className="mt-0.5 text-[11px] text-muted-foreground">"{fighter.nickname}"</div>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums">{record}</span>
                {ranked && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">Power {ranked.score.toFixed(0)}</span>}
                {ranked && divisionLabel && (
                  <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600">#{ranked.rank} {divisionLabel}</span>
                )}
              </div>
            </div>

            {/* bio — fixed row groups. Each row lays its surviving fields out evenly,
                and a row with nothing in it disappears, so sparse fields (style ~23%,
                gym ~24%, leg reach ~35%) collapse cleanly instead of leaving holes. */}
            <div className="mt-2 flex shrink-0 flex-col gap-1.5 border-t pt-2">
              {[
                [['Age', bio.age ? `${bio.age} yrs` : null], ['Height', val(fighter.height)], ['Weight', val(fighter.weight)]],
                [['Reach', val(fighter.reach)], ['Leg reach', val(fighter.leg_reach) ? `${fighter.leg_reach}"` : null]],
                [['Stance', val(fighter.stance)], ['Style', val(fighter.fighting_style)]],
                [
                  ['UFC debut', bio.debut],
                  // completed bouts in the fight log; career.fightCount only counts
                  // the ones that also have stat rows, so it undercounts
                  ['UFC fights', form?.results?.length || career?.fightCount || null],
                  ['Last activity', form?.daysSinceLast != null ? `${form.daysSinceLast} days` : null],
                ],
                [['From', val(fighter.birthplace)]],
                [['Gym', val(fighter.trains_at)]],
              ].map((row) => row.filter(([, v]) => v)).filter((row) => row.length).map((row) => (
                <div key={row.map(([k]) => k).join('-')} className="flex gap-2">
                  {row.map(([k, v]) => (
                    <div key={k} className="min-w-0 flex-1">
                      <div className="truncate whitespace-nowrap text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{k}</div>
                      <div className="truncate text-[13.5px] font-semibold leading-snug" title={String(v)}>{v}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* last / next fight, side by side under the bio */}
          <div className="grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-border p-2.5">
            {(() => {
              const last = form?.results?.[0]
              const opp = last ? oppData[String(last.oppId)] : null
              return (
                <div className="min-w-0">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Last fight</div>
                  {last ? (
                    <Tip content={<FighterMini f={opp} />}>
                    <Link to={`/ufc/fighters/${last.oppId}`} className="flex items-center gap-2 rounded-md transition-colors hover:bg-muted/50">
                      <div className="relative shrink-0">
                        {opp?.image_url ? (
                          <img src={opp.image_url} alt="" className="h-8 w-8 rounded-full object-cover object-top" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                            {opp?.name ? opp.name.split(' ').map((n) => n[0]).join('') : '?'}
                          </div>
                        )}
                        <span className={cn(
                          'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-extrabold text-white ring-2 ring-card',
                          last.draw ? 'bg-slate-400' : last.win ? 'bg-emerald-500' : 'bg-rose-500',
                        )}>{last.draw ? 'D' : last.win ? 'W' : 'L'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold leading-tight">{opp?.name || 'Unknown'}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{last.date ? formatDate(last.date) : '—'}</div>
                      </div>
                    </Link>
                    </Tip>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No recorded fights</p>
                  )}
                </div>
              )
            })()}

            {(() => {
              const opp = upcoming ? oppData[String(upcoming.oppId)] : null
              return (
                <div className="min-w-0 border-l border-border pl-2.5">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Next fight</div>
                  {upcoming ? (
                    <Tip content={<FighterMini f={opp} />}>
                    <Link to={`/ufc/fighters/${upcoming.oppId}`} className="flex items-center gap-2 rounded-md transition-colors hover:bg-muted/50">
                      {opp?.image_url ? (
                        <img src={opp.image_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover object-top" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                          {opp?.name ? opp.name.split(' ').map((n) => n[0]).join('') : '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold leading-tight">{opp?.name || 'TBA'}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{formatDate(upcoming.date)}</div>
                      </div>
                    </Link>
                    </Tip>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Not scheduled</p>
                  )}
                </div>
              )
            })()}
          </div>

        </div>

      {/* ------ RIGHT: one card, four tabs (skills / overview / stats / fights) ------ */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* one scroll container, one section per tab. `relative` matters: the spy
            reads section.offsetTop, which is measured against the offset parent. */}
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-3">

          <Section
            id="skills"
            title="Skills"
            note={profile ? `vs ${divisionLabel}` : null}
            register={register}
          >
            {profile ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,320px)_1fr]">
                {/* radar + best/worst axes */}
                <div className="flex flex-col rounded-lg border border-border p-3">
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
                <div className="flex flex-col rounded-lg border border-border p-3">
                  <div className="mb-2 flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Skill Decomposition</span>
                    <span className="text-[11px] text-muted-foreground">vs {divisionLabel}</span>
                  </div>
                  {/* Striking above, grappling below — one full-width column each,
                      so the bar track gets the whole card width instead of ~20px. */}
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex flex-1 flex-col">
                      <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Striking</span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-1.5">{profile.striking.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Grappling</span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-1.5">{profile.grappling.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No ranked skill decomposition for this fighter (unranked or insufficient rounds).</p>
            )}
          </Section>

          <Section id="overview" title="Career Overview" register={register}>
            {form ? (
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
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
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
                    <div className="flex h-[230px] flex-col rounded-lg border border-border p-2.5">
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
                  <div className="space-y-3 rounded-lg border border-border p-2.5">
                    {/* third person singular once the name is in: "wins" / "loses" */}
                    <SplitBar title={`How ${fighter.last_name} wins · ${form.totalWins}`} segments={form.winMethods} unit="" />
                    <SplitBar title={`How ${fighter.last_name} loses · ${form.totalLosses}`} segments={form.lossMethods} unit="" />
                  </div>

                  {career?.hasStats && (
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Career rates</div>
                      {/* Win%/Finish% live in the left panel — these are per-time rates instead. */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <StatTile label="Sig. Str / Min" value={tiles.slpm.toFixed(2)} />
                        <StatTile label="Str. Acc" value={`${career.sigAcc}%`} />
                        <StatTile label="KD / 15" value={career.kd15.toFixed(2)} />
                        <StatTile label="TD / 15" value={tiles.td15.toFixed(2)} />
                        <StatTile label="TD Acc" value={`${career.tdAcc}%`} />
                        <StatTile label="Ctrl / 15" value={career.ctrl15Str} />
                      </div>
                    </div>
                  )}

                  <SimilarFighters fighterId={fighter.id} className="flex flex-1 flex-col" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed fight history available.</p>
            )}
          </Section>

          <Section
            id="career"
            title="Career Stats"
            note={twoWay ? `${twoWay.fightCount} fights · ${Math.round(twoWay.totalMin ?? 0)} min logged` : null}
            register={register}
          >
            {career?.hasStats ? (
              <div className="flex flex-col gap-3">
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Outcomes</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="Win %" value={`${career.winPct}%`} />
                    <StatTile label="Finish %" value={`${career.finishRate}%`} />
                    <StatTile
                      label="Avg Fight Time"
                      value={state.cstats?.avg_fight_sec != null ? clock(state.cstats.avg_fight_sec) : (form?.avgFightTime ?? '—')}
                    />
                    <StatTile label="Reversals / 15" value={career.rev15.toFixed(1)} />
                  </div>
                  <div className="mt-3 border-t pt-2.5">
                    <SplitBar
                      title={`Win Methods · ${career.ko + career.sub + career.dec}`}
                      unit=""
                      segments={[
                        { label: 'KO/TKO', value: career.ko, cls: 'bg-viz-1' },
                        { label: 'Submission', value: career.sub, cls: 'bg-viz-2' },
                        { label: 'Decision', value: career.dec, cls: 'bg-viz-3' },
                      ]}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">Striking</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="Sig. Str / Min" value={career.slpm.toFixed(2)} />
                    <StatTile label="Total Str / Min" value={tiles.tslpm.toFixed(2)} />
                    <StatTile label="Sig. Str. Accuracy" value={`${tiles.sigAcc}%`} />
                    <StatTile label="Knockdowns / 15" value={tiles.kd15.toFixed(2)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                    <StatTile label="Sig. Strikes Landed" value={career.totals.sig.toLocaleString()} />
                    <StatTile label="Sig. Strikes Thrown" value={career.totals.sigAtt.toLocaleString()} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Grappling</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="TD / 15" value={career.td15.toFixed(2)} />
                    <StatTile label="TD Accuracy" value={`${tiles.tdAcc}%`} />
                    <StatTile label="Control / 15" value={tiles.ctrl15Str} />
                    <StatTile label="Sub Att / 15" value={tiles.subAtt15.toFixed(1)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                    <StatTile label="Takedowns Landed" value={career.totals.td} />
                    <StatTile label="Total Control" value={`${Math.round(career.totals.ctrlSeconds / 60)}m`} />
                  </div>
                </div>

                {/* Target and position splits used to live here, but the strike map
                    below shows the same shares AND the absorbed side — this card is
                    outcomes instead, which nothing else in the section covers. */}
              </div>

              {/* Offense vs defense + the strike map. Absent (rather than empty) when
                  the server has no career row for this fighter — the cards above and
                  the pacing row below are computed from different sources and still
                  render. */}
              {twoWay?.hasTwoWay && (
                <div className="grid gap-3 xl:grid-cols-[1.05fr_1fr]">
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Offense vs defense</span>
                      {/* one legend serves both cards in this row — same encoding */}
                      <TwoWayLegend />
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {twoWay.rows.map((r) => <DumbbellRow key={r.key} {...r} />)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Strike profile</span>
                      <SlideTabs
                        size="sm"
                        value={strikeMode}
                        onChange={setStrikeMode}
                        tabs={[{ key: 'pct', label: 'Share' }, { key: 'pm', label: 'Per min' }]}
                      />
                    </div>
                    <div className="space-y-4">
                      <MirrorBars title="Target" rows={twoWay.target} mode={strikeMode} />
                      <div className="border-t pt-4">
                        <MirrorBars title="Position" rows={twoWay.position} mode={strikeMode} />
                      </div>
                      {twoWay.targetAcc.length > 0 && (
                        <div className="border-t pt-4">
                          {/* how well each side LANDS on a zone, as opposed to how
                              often they aim there — always a percentage, so this
                              block ignores the share/per-min toggle */}
                          <MirrorBars title="Accuracy By Target" rows={twoWay.targetAcc} mode="pct" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {pacing.length > 1 && (
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Pacing by round</div>
                  <RoundPacing rounds={pacing} survival={survival} />
                </div>
              )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No per-fight statistics recorded for this fighter.</p>
            )}
          </Section>

          <Section id="fights" title="Fight History" note={`${recent.length} fights`} register={register}>
            {recent.length === 0 ? (
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
                              <Tip className="flex items-center gap-2" content={<FighterMini f={opp} />}>
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
                              </Tip>
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
                                <FightDetail detail={r.detail} data={data} finishRound={r.round} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          </div>
        </div>
      </div>
    </div>
  )
}

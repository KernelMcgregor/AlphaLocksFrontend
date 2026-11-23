// The Rankings page's time-lapse view (?view=history). The division is picked in the page
// header (?division=); here: step (?step=), the date (?on=, the standings after the last
// card on or before it), play/scrub. The standings re-sort in place as the date moves,
// and the bump chart traces how the current top ten got there.
//
// Fits the viewport on desktop: rows are sized to the space the standings card has.
// While playing, every move is a linear transition the length of one tick, so the
// rows and the chart travel continuously instead of stepping and settling.
import { ArrowRight, CalendarDays, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CountryFlag from '../CountryFlag'
import PageLoader from '../PageLoader'
import { Card, CardContent } from '../ui/card'
import { SlideTabs } from '../ui/slide-tabs'
import BumpChart from '../viz/BumpChart'
import { useElementSize } from '../viz/hooks'
import { fetchRankingsTimelapse } from '../../lib/fighterExtrasApi'
import { cn, formatDate } from '../../lib/utils'

const STEPS = [
  { key: 'event', label: 'Card' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
]
// ms per frame while playing.
const TICK = { event: 240, month: 320, quarter: 560, year: 900 }
const SETTLE = 'transform 450ms cubic-bezier(0.4,0,0.2,1)'
const WINDOW = 12
const TRACED = 10

function periodLabel(asOf, step) {
  const d = new Date(`${asOf}T00:00:00`)
  if (step === 'year') return String(d.getFullYear())
  if (step === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`
  if (step === 'event') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Index of the last frame on or before `date` (frames ascend by as_of).
function frameOn(frames, date) {
  let k = 0
  for (let j = 0; j < frames.length; j++) if (frames[j].as_of <= date) k = j
  return k
}

function Movement({ prev, rank }) {
  if (prev == null) return <span className="text-[9.5px] font-extrabold text-viz-2">NEW</span>
  const d = prev - rank
  if (!d) return <span className="text-[10px] text-muted-foreground">–</span>
  return (
    <span className={cn('text-[10px] font-extrabold tabular-nums', d > 0 ? 'text-emerald-600' : 'text-rose-600')}>
      {d > 0 ? '▲' : '▼'}{Math.abs(d)}
    </span>
  )
}

// The standings at one date. Rows are absolutely positioned by rank, so a re-sort is a
// slide rather than a re-render in a new order; their height is whatever fits.
function Standings({ frame, prevFrame, fighters, selected, onSelect, top, transition }) {
  const [ref, { h }] = useElementSize()
  const rowH = h ? Math.max(18, Math.min(34, Math.floor(h / top))) : 28
  const prev = useMemo(() => Object.fromEntries((prevFrame?.ranks || []).map((r) => [r.id, r.rank])), [prevFrame])
  const max = Math.max(1, ...frame.ranks.map((r) => r.score))
  return (
    <div ref={ref} className="relative h-[450px] min-h-0 lg:h-auto lg:flex-1">
      {frame.ranks.map((r) => {
        const f = fighters[r.id] || {}
        const on = selected === r.id
        return (
          <div
            key={r.id}
            className="absolute inset-x-0"
            style={{ transform: `translateY(${(r.rank - 1) * rowH}px)`, height: rowH, transition }}
          >
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className={cn('grid h-full w-full grid-cols-[22px_minmax(0,1fr)_64px_28px] items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-muted/60', on && 'bg-primary/[0.06]')}
            >
              <span className={cn('text-[12px] font-extrabold tabular-nums', r.rank === 1 ? 'text-gold-foreground' : 'text-muted-foreground')}>{r.rank}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <CountryFlag countryCode={f.country_code} />
                <span className={cn('truncate text-[12.5px] font-bold', on && 'text-primary')}>{f.name || 'Unknown'}</span>
              </span>
              <span className="h-[6px] overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-viz-1/70 transition-[width] duration-300" style={{ width: `${(r.score / max) * 100}%` }} />
              </span>
              <span className="text-right"><Movement prev={prev[r.id]} rank={r.rank} /></span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Label({ children, aside }) {
  return (
    <div className="mb-1.5 flex shrink-0 items-baseline justify-between gap-2 px-1">
      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</span>
      {aside && <span className="text-[10.5px] tabular-nums text-muted-foreground">{aside}</span>}
    </div>
  )
}

export default function RankingsTimelapse() {
  const [params, setParams] = useSearchParams()
  const division = params.get('division') || 'lightweight'
  const step = STEPS.some((s) => s.key === params.get('step')) ? params.get('step') : 'quarter'
  const on = params.get('on')
  const key = `${division}:${step}`
  const [got, setGot] = useState({ key: null, data: null, error: null })
  const [pos, setPos] = useState({ key: null, i: 0, on: null })
  const [playing, setPlaying] = useState(false)
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    let live = true
    fetchRankingsTimelapse({ division, step })
      .then((d) => live && setGot({ key, data: d, error: null }))
      .catch((e) => live && setGot({ key, data: null, error: e.message }))
    return () => { live = false }
  }, [division, step, key])

  const data = got.key === key ? got.data : null
  const frames = useMemo(() => data?.frames || [], [data])
  const last = frames.length - 1
  // Scrubbing or playing owns the position; otherwise ?on= picks the frame, else the
  // latest. A position belongs to one division + step + date.
  const i = pos.key === key && pos.on === on ? Math.min(pos.i, last) : on ? frameOn(frames, on) : last
  const setI = (v) => setPos({ key, on, i: Math.max(0, Math.min(last, v)) })

  // Playback stops by itself at the latest table.
  const isPlaying = playing && i < last
  const tick = TICK[step]
  useEffect(() => {
    if (!isPlaying) return undefined
    const t = setInterval(() => {
      setPos((p) => ({ key, on, i: Math.min(last, (p.key === key && p.on === on ? p.i : i) + 1) }))
    }, tick)
    return () => clearInterval(t)
  }, [isPlaying, key, on, last, tick, i])
  const transition = isPlaying ? `transform ${tick}ms linear` : SETTLE

  const set = (next) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v == null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p, { replace: true })
    setPlaying(false)
  }
  // A date shows the standings after the last card on or before it, so it needs every
  // card: picking one switches to the Card step.
  const pickDate = (d) => d && set({ on: d, step: 'event' })

  const frame = frames[i]
  const traced = useMemo(() => (frame?.ranks || []).slice(0, TRACED).map((r) => r.id), [frame])
  const selected = picked && traced.includes(picked) ? picked : traced[0]

  const chart = useMemo(() => {
    const index = frames.map((fr) => Object.fromEntries(fr.ranks.map((r) => [r.id, r.rank])))
    return {
      points: frames.map((fr) => ({
        id: fr.as_of,
        label: periodLabel(fr.as_of, step),
        title: formatDate(fr.as_of),
        sub: fr.total_ranked ? `${fr.total_ranked} ranked` : null,
        // One division throughout, so the chart paints no weight-class bands.
        division,
      })),
      // The selected fighter is drawn last, so it sits on top of the gray paths.
      series: [...traced.filter((id) => id !== selected), selected].filter(Boolean).map((id) => ({
        key: id,
        label: data?.fighters[id]?.last_name || data?.fighters[id]?.name || '—',
        color: id === selected ? 'var(--color-viz-1)' : 'color-mix(in oklab, var(--color-muted-foreground) 55%, transparent)',
        values: index.map((m) => m[id] ?? null),
      })),
    }
  }, [frames, traced, selected, step, data, division])

  const top = data?.top || 15

  if (got.error && got.key === key) {
    return <Card><CardContent className="p-6"><p className="text-destructive">Couldn't load rankings: {got.error}</p></CardContent></Card>
  }
  if (!data) return <PageLoader />
  if (!frames.length) {
    return <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">No ranking history for this division.</p></CardContent></Card>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
        <button
          type="button"
          onClick={() => {
            if (isPlaying) return setPlaying(false)
            if (i >= last) setI(0)
            setPlaying(true)
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <span className="w-[112px] shrink-0 font-display text-[20px] font-extrabold italic uppercase leading-none tabular-nums">
          {periodLabel(frame.as_of, step)}
        </span>
        <input
          type="range"
          min={0}
          max={last}
          value={i}
          onChange={(e) => { setPlaying(false); setI(Number(e.target.value)) }}
          aria-label="Date"
          className="h-1.5 min-w-[160px] flex-1 cursor-pointer accent-[var(--color-primary)]"
        />
        <label className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12px] focus-within:ring-2 focus-within:ring-ring">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="date"
            min={frames[0].as_of}
            max={frames[last].as_of}
            value={frame.as_of}
            onChange={(e) => pickDate(e.target.value)}
            aria-label="Rankings on a date"
            className="bg-transparent tabular-nums outline-none"
          />
        </label>
        <SlideTabs size="sm" tabs={STEPS} value={step} onChange={(s) => set({ step: s, on: null })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[316px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-3">
          <Label aside={formatDate(frame.as_of)}>{data.division_label} · Top {top}</Label>
          <Standings
            frame={frame}
            prevFrame={frames[i - 1]}
            fighters={data.fighters}
            selected={selected}
            onSelect={setPicked}
            top={top}
            transition={transition}
          />
          {selected && (
            <Link
              to={`/ufc/fighters/${selected}`}
              className="mt-2 inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              {data.fighters[selected]?.name} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="flex h-[380px] min-h-0 flex-col rounded-xl border border-border bg-card p-3 lg:h-auto">
          <Label>Path to the top {TRACED}</Label>
          <BumpChart
            start={Math.max(0, i - WINDOW + 1)}
            size={WINDOW}
            domain={[0.5, top + 0.5]}
            ticks={[1, 5, 10, 15].filter((t) => t <= top)}
            invertY
            yLabel="RANK"
            formatValue={(v) => `#${Math.round(v)}`}
            points={chart.points}
            series={chart.series}
            glide={transition}
          />
        </div>
      </div>
    </div>
  )
}

// The Rankings page's time-lapse view (?view=history).
// Divisional rankings through time: pick a division, scrub (or play) through the
// published tables. The standings re-sort in place as the date moves, and the bump
// chart traces how the current top ten got there.
import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CountryFlag from '../CountryFlag'
import PageLoader from '../PageLoader'
import DivisionPicker from '../sports/DivisionPicker'
import { Card, CardContent } from '../ui/card'
import { SlideTabs } from '../ui/slide-tabs'
import BumpChart from '../viz/BumpChart'
import { fetchRankingsTimelapse } from '../../lib/fighterExtrasApi'
import { cn, formatDate } from '../../lib/utils'
import { ScrollArea } from '../ui/scroll-area'

const STEPS = [
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
]
const WINDOW = 12
const TRACED = 10
const ROW_H = 30
const PLAY_MS = 700

function periodLabel(asOf, step) {
  const d = new Date(`${asOf}T00:00:00`)
  if (step === 'year') return String(d.getFullYear())
  if (step === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
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
// slide rather than a re-render in a new order.
function Standings({ frame, prevFrame, fighters, selected, onSelect }) {
  const prev = useMemo(() => Object.fromEntries((prevFrame?.ranks || []).map((r) => [r.id, r.rank])), [prevFrame])
  const max = Math.max(1, ...frame.ranks.map((r) => r.score))
  return (
    <div className="relative" style={{ height: frame.ranks.length * ROW_H }}>
      {frame.ranks.map((r) => {
        const f = fighters[r.id] || {}
        const on = selected === r.id
        return (
          <div
            key={r.id}
            className="absolute inset-x-0 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ transform: `translateY(${(r.rank - 1) * ROW_H}px)`, height: ROW_H }}
          >
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className={cn('grid h-full w-full grid-cols-[22px_minmax(0,1fr)_64px_28px] items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-muted/60', on && 'bg-muted')}
            >
              <span className={cn('text-[12px] font-extrabold tabular-nums', r.rank === 1 ? 'text-gold-foreground' : 'text-muted-foreground')}>{r.rank}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <CountryFlag countryCode={f.country_code} />
                <span className={cn('truncate text-[12.5px] font-bold', on && 'text-primary')}>{f.name || 'Unknown'}</span>
              </span>
              <span className="h-[6px] overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-viz-1/70 transition-[width] duration-500" style={{ width: `${(r.score / max) * 100}%` }} />
              </span>
              <span className="text-right"><Movement prev={prev[r.id]} rank={r.rank} /></span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function RankingsTimelapse() {
  const [params, setParams] = useSearchParams()
  const division = params.get('division') || 'lightweight'
  const step = params.get('step') || 'quarter'
  const key = `${division}:${step}`
  const [got, setGot] = useState({ key: null, data: null, error: null })
  const [pos, setPos] = useState({ key: null, i: 0 })
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
  // The scrub position belongs to one division + step; a new one starts at the latest table.
  const i = pos.key === key ? Math.min(pos.i, last) : last
  const setI = (v) => setPos({ key, i: Math.max(0, Math.min(last, v)) })

  // Playback stops by itself at the latest table.
  const isPlaying = playing && i < last
  useEffect(() => {
    if (!isPlaying) return undefined
    const t = setInterval(() => {
      setPos((p) => ({ key, i: Math.min(last, (p.key === key ? p.i : last) + 1) }))
    }, PLAY_MS)
    return () => clearInterval(t)
  }, [isPlaying, key, last])

  const frame = frames[i]
  const traced = useMemo(() => (frame?.ranks || []).slice(0, TRACED).map((r) => r.id), [frame])
  const selected = picked && traced.includes(picked) ? picked : traced[0]

  const go = (next) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) p.set(k, v)
    setParams(p, { replace: true })
    setPlaying(false)
  }

  const chart = useMemo(() => {
    const index = frames.map((fr) => Object.fromEntries(fr.ranks.map((r) => [r.id, r.rank])))
    return {
      points: frames.map((fr) => ({
        id: fr.as_of,
        label: periodLabel(fr.as_of, step),
        title: formatDate(fr.as_of),
        sub: fr.total_ranked ? `${fr.total_ranked} ranked` : null,
        // One division throughout, so the chart paints no weight-class bands.
        division: division,
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

  const pickerClasses = (data?.divisions || []).map((d) => ({ key: d.key, label: d.label.replace("Women's ", '') }))
  const top = data?.top || 15

  return (
    <ScrollArea className="h-full" viewportClassName="[&>div]:!flex [&>div]:!flex-col [&>div]:gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        {pickerClasses.length > 0 && (
          <DivisionPicker weightClasses={pickerClasses} active={division} onSelect={(d) => go({ division: d })} />
        )}
        <SlideTabs size="sm" tabs={STEPS} value={step} onChange={(s) => go({ step: s })} />
      </div>

      {got.error && got.key === key ? (
        <Card><CardContent className="p-6"><p className="text-destructive">Couldn't load rankings: {got.error}</p></CardContent></Card>
      ) : !data ? (
        <PageLoader />
      ) : !frames.length ? (
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">No ranking history for this division.</p></CardContent></Card>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
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
            <span className="w-[92px] shrink-0 font-display text-[20px] font-extrabold italic uppercase leading-none tabular-nums">{periodLabel(frame.as_of, step)}</span>
            <input
              type="range"
              min={0}
              max={last}
              value={i}
              onChange={(e) => { setPlaying(false); setI(Number(e.target.value)) }}
              aria-label="Date"
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--color-primary)]"
            />
            <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:inline">
              {formatDate(frames[0].as_of)} – {formatDate(frames[last].as_of)}
            </span>
          </div>

          <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <div className="rounded-xl border border-border bg-card p-2.5">
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">{data.division_label} · Top {top}</span>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">{formatDate(frame.as_of)}</span>
              </div>
              <Standings
                frame={frame}
                prevFrame={frames[i - 1]}
                fighters={data.fighters}
                selected={selected}
                onSelect={setPicked}
              />
              {selected && (
                <Link to={`/ufc/fighters/${selected}`} className="mt-2 block px-1.5 text-[11.5px] font-semibold text-primary hover:underline">
                  {data.fighters[selected]?.name} profile →
                </Link>
              )}
            </div>

            <div className="flex min-h-[380px] flex-col rounded-xl border border-border bg-card p-2.5">
              <span className="mb-1 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Path to the top {TRACED}</span>
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
              />
            </div>
          </div>
        </>
      )}
    </ScrollArea>
  )
}

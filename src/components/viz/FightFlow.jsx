// src/components/viz/FightFlow.jsx
//
// "How the fight plays out": the expected-stats projection for one upcoming bout, drawn
// as a story line, four headline tiles, where the fight's time goes, and a tug-of-war
// row per stat. Every number is from deriveFightFlow (lib/fightProjection) — this file
// only draws.
//
// Ranges are the model's 10th-90th percentile of the bout total, and they are wide on
// purpose: a third of the uncertainty in a strike count is not knowing how long the
// fight lasts. The point estimate is drawn as the bar and the range as a faint band
// behind it, so the reader sees both without a second chart.
import { Activity, Hourglass, Layers, Timer } from 'lucide-react'
import { useState } from 'react'
import { clock, fmtStat, rangeFmt } from '../../lib/fightProjection'
import { cn } from '../../lib/utils'
import { SlideTabs } from '../ui/slide-tabs'
import { Tip } from '../ui/tip'
import HeroTile from './HeroTile'

// Story text carries {red} / {blue} placeholders; swap in the names as bold runs.
function fillNames(text, names) {
  return text.split(/(\{red\}|\{blue\})/).map((part, i) => {
    const side = part === '{red}' ? 'red' : part === '{blue}' ? 'blue' : null
    return side ? <strong key={i} className="font-extrabold text-foreground">{names[side]}</strong> : part
  })
}

function Dot({ css }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: css }} />
}

// ---------------------------------------------------------------------------
// Where the time goes: red on top | neither | blue on top, one 100% bar.
// ---------------------------------------------------------------------------
function PositionBar({ position, names, css, minutes }) {
  const segs = [
    { key: 'red', share: position.red, label: `${names.red} in control`, bg: css.red },
    { key: 'neutral', share: position.neutral, label: 'Standing / neutral', bg: null },
    { key: 'blue', share: position.blue, label: `${names.blue} in control`, bg: css.blue },
  ]
  return (
    <div>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded">
        {segs.map((s) => s.share > 0.005 && (
          <Tip
            key={s.key}
            className="h-full"
            style={{ width: `${s.share * 100}%` }}
            content={(
              <span className="text-[11px]">
                <strong>{s.label}</strong>: {Math.round(s.share * 100)}% of the fight
                {minutes ? ` (≈${clock(s.share * minutes * 60)} of ${clock(minutes * 60)} expected)` : ''}
              </span>
            )}
          >
            <span
              className={cn('block h-full w-full', !s.bg && 'bg-muted-foreground/20')}
              style={s.bg ? { background: s.bg } : undefined}
            />
          </Tip>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
        {segs.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            {s.bg ? <Dot css={s.bg} /> : <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" />}
            <span>{s.label}</span>
            <span className="font-bold tabular-nums text-foreground">{Math.round(s.share * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One stat, both corners, bars growing out from the centre line.
// ---------------------------------------------------------------------------
function TugRow({ row, mode, names, css }) {
  const field = mode === 'distance' ? 'if_distance' : 'expected'
  const showRange = mode !== 'distance'
  const r = row.red
  const b = row.blue
  // Shared scale per row: the widest thing drawn on either side.
  const max = Math.max(
    r[field] ?? 0, b[field] ?? 0,
    showRange ? r.p90 ?? 0 : 0, showRange ? b.p90 ?? 0 : 0,
  ) || 1
  const w = (v) => `${Math.min(100, ((v ?? 0) / max) * 100)}%`

  const half = (side, d, align) => {
    const tip = (
      <span className="text-[11px]">
        <strong>{names[side]}</strong> · {row.label}
        <br />
        {mode === 'distance' ? 'If it goes the distance' : 'Projected'}: <strong>{fmtStat(d[field], row.fmt)}</strong>
        {showRange && d.p10 != null && <><br />Likely range: {fmtStat(d.p10, rangeFmt(row.fmt))}–{fmtStat(d.p90, rangeFmt(row.fmt))} (10th–90th pct)</>}
        {d.rate != null && <><br />{row.key === 'ctrl' ? `${Math.round(d.rate)}s` : d.rate.toFixed(2)} per minute vs this opponent</>}
      </span>
    )
    return (
      <Tip content={tip} className={cn('relative flex h-4 items-center', align === 'right' ? 'justify-end' : 'justify-start')}>
        {/* likely range, behind */}
        {showRange && d.p10 != null && d.p90 != null && (
          <span
            className={cn('absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-25', align === 'right' ? 'right-0' : 'left-0')}
            style={{ width: w(d.p90), background: css[side] }}
          />
        )}
        <span
          className={cn('relative h-2.5', align === 'right' ? 'rounded-l' : 'rounded-r')}
          style={{ width: w(d[field]), background: css[side] }}
        />
      </Tip>
    )
  }

  const winner = row.pMore
    ? (['red', 'blue'].find((s) => (row.pMore[s] ?? 0) >= 0.5) || null)
    : null

  return (
    <div className="py-1.5">
      <div className="grid grid-cols-[64px_1fr_64px] items-baseline gap-2">
        <span className="text-right text-[13px] font-extrabold tabular-nums">{fmtStat(r[field], row.fmt)}</span>
        <span className="text-center text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{row.label}</span>
        <span className="text-[13px] font-extrabold tabular-nums">{fmtStat(b[field], row.fmt)}</span>
      </div>
      <div className="mt-0.5 grid grid-cols-2 gap-[2px]">
        {half('red', r, 'right')}
        {half('blue', b, 'left')}
      </div>
      <div className="mt-0.5 grid grid-cols-[1fr_auto_1fr] gap-2 text-[9.5px] tabular-nums text-muted-foreground">
        <span className="text-right">{showRange && r.p10 != null ? `${fmtStat(r.p10, rangeFmt(row.fmt))}–${fmtStat(r.p90, rangeFmt(row.fmt))}` : ''}</span>
        <span className="text-center">
          {winner && row.pMore[winner] != null
            ? `${names[winner]} lands more ${Math.round(row.pMore[winner] * 100)}%`
            : ''}
        </span>
        <span>{showRange && b.p10 != null ? `${fmtStat(b.p10, rangeFmt(row.fmt))}–${fmtStat(b.p90, rangeFmt(row.fmt))}` : ''}</span>
      </div>
    </div>
  )
}

export default function FightFlow({ flow, names, css }) {
  const [mode, setMode] = useState('expected')
  const { story, position, expectedMin, scheduledMin, pDecision, pace, rows } = flow
  const ground = position.red + position.blue

  return (
    <div className="flex flex-col gap-3">
      {/* The read in one line, from the same thresholds as the keys to victory. */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {fillNames(story.kind, names)}
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-foreground/80">{fillNames(story.text, names)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <HeroTile
          icon={Timer}
          label="Expected length"
          value={expectedMin != null ? clock(expectedMin * 60) : '—'}
          sub={`of ${clock(scheduledMin * 60)} scheduled`}
        />
        <HeroTile
          icon={Hourglass}
          label="Goes the distance"
          value={pDecision != null ? `${Math.round(pDecision * 100)}%` : '—'}
        />
        <HeroTile
          icon={Activity}
          label="Combined pace"
          value={pace != null ? pace.toFixed(1) : '—'}
          sub="sig. strikes / min, both"
        />
        <HeroTile
          icon={Layers}
          label="Someone in control"
          value={`${Math.round(ground * 100)}%`}
          sub="of fight time"
        />
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 text-[13px] font-extrabold tracking-tight">Where the fight happens</div>
        <PositionBar position={position} names={names} css={css} minutes={expectedMin} />
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-extrabold tracking-tight">Projected output</span>
            <span className="text-[10.5px] text-muted-foreground">
              {mode === 'distance' ? 'if all rounds are fought' : 'bar = projection, band = likely range'}
            </span>
          </div>
          <SlideTabs
            size="sm"
            value={mode}
            onChange={setMode}
            tabs={[{ key: 'expected', label: 'Projected' }, { key: 'distance', label: 'Full distance' }]}
          />
        </div>
        <div className="mb-1 grid grid-cols-2 gap-2 border-b pb-1 text-[10.5px] font-bold">
          <span className="flex items-center justify-end gap-1.5">{names.red}<Dot css={css.red} /></span>
          <span className="flex items-center gap-1.5"><Dot css={css.blue} />{names.blue}</span>
        </div>
        <div className="divide-y divide-border/60">
          {rows.map((row) => <TugRow key={row.key} row={row} mode={mode} names={names} css={css} />)}
        </div>
      </div>
    </div>
  )
}

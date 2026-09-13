import { cn, clock } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Two values on a shared track. Default encoding: viz-1 (blue) is the subject,
// viz-2 (orange) is the comparison. Two shades of one hue were tried first and did
// not separate at dot size; the two sides are two entities, so a validated
// categorical pair is the honest encoding anyway.
//
// The profile page reads this as fighter-vs-opponents; the fight page reads it as
// red-corner-vs-blue-corner. Same mark, so `selfLabel`/`oppLabel` name the sides
// rather than the component assuming one reading.
// ---------------------------------------------------------------------------
const fmtTwoWay = (v, fmt) => {
  if (v == null) return '—'
  if (fmt === 'pct1') return `${v.toFixed(1)}%`
  if (fmt === 'clock') return clock(v)
  return v.toFixed(2)
}

export function TwoWayLegend({ selfLabel = 'Fighter', oppLabel = 'Opponents', selfClass = 'bg-viz-1', oppClass = 'bg-viz-2' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5">
        <span className={cn('h-2.5 w-2.5 rounded-full', selfClass)} />
        <span className="text-[10px] font-semibold text-muted-foreground">{selfLabel}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn('h-2.5 w-2.5 rounded-full', oppClass)} />
        <span className="text-[10px] font-semibold text-muted-foreground">{oppLabel}</span>
      </span>
    </div>
  )
}

// One metric: what they do vs what is done to them, as two dots on a shared track.
// Each row carries its OWN scale — the units differ per row and both ends are
// directly labelled, so this reads as a two-number comparison, not a shared axis.
//
// `higherIsBetter: false` flips the delta colouring for metrics where the smaller
// number wins (strikes absorbed, takedowns conceded). The sign shown is unchanged —
// colour reinforces the reading, it does not carry it.
export function DumbbellRow({ label, self, opp, fmt, higherIsBetter = true, selfClass = 'bg-viz-1', oppClass = 'bg-viz-2',
  selfTextClass = 'text-foreground', oppTextClass = 'text-viz-2' }) {
  const domain = Math.max(self ?? 0, opp ?? 0) * 1.12 || 1
  const pos = (v) => (v == null ? null : Math.max(3, Math.min(97, (v / domain) * 100)))
  const xs = pos(self)
  const xo = pos(opp)
  const delta = self != null && opp != null ? self - opp : null
  const good = delta == null ? null : higherIsBetter ? delta >= 0 : delta <= 0

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
              <span className={cn('absolute top-[24px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card', oppClass)} style={{ left: `${xo}%` }} />
              <span
                className={cn('absolute top-0 whitespace-nowrap text-[9.5px] font-semibold tabular-nums', oppTextClass, anchor(xo, xs))}
                style={{ left: `${xo}%` }}
              >
                {fmtTwoWay(opp, fmt)}
              </span>
            </>
          )}
          {xs != null && (
            <>
              <span className={cn('absolute top-[24px] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card', selfClass)} style={{ left: `${xs}%` }} />
              <span
                className={cn('absolute top-0 whitespace-nowrap text-[9.5px] font-bold tabular-nums', selfTextClass, anchor(xs, xo))}
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
          good == null ? 'text-muted-foreground' : good ? 'text-emerald-600' : 'text-rose-600',
        )}>
          {delta == null ? '—' : `${delta >= 0 ? '+' : '−'}${fmtTwoWay(Math.abs(delta), fmt)}`}
        </span>
      </div>
  )
}

import { cn } from '../../lib/utils'

// The prediction as a walk, not a pile of coefficients.
//
// Each step is one family of features, and its bar spans the probability the model
// held before that family from the probability it held after — so the reader can
// follow a coin flip to the number on the card and see which group of inputs moved
// it, in which direction, and by how much. Steps are in probability POINTS, the
// only unit a reader can price; the model works in log-odds, and a bar labelled
// "-666.24" tells nobody anything.
//
// The axis is zoomed to the range the walk actually covers. On a 0–100% scale the
// individual family steps — often a point or two each — were invisible next to the
// prior, which defeated the purpose.
//
// Everything is stated toward the red corner: right-growing bars favour red, left
// favour blue, matching every other mark on the fight page.
export default function ProbabilityWaterfall({
  base, steps, final, market, calibration, redName, blueName,
}) {
  const points = [
    base, final,
    ...steps.flatMap((s) => [s.from, s.to]),
    ...(market != null ? [market] : []),
    ...(calibration ? [calibration.low, calibration.high] : []),
  ].filter((p) => Number.isFinite(p))

  const min = Math.min(...points)
  const max = Math.max(...points)
  const pad = Math.max(0.04, (max - min) * 0.18)
  const lo = Math.max(0, min - pad)
  const hi = Math.min(1, max + pad)
  const span = hi - lo || 1

  const x = (p) => `${Math.max(0, Math.min(100, ((p - lo) / span) * 100))}%`
  const pct = (p) => `${(p * 100).toFixed(0)}%`

  // Ticks on 5-point multiples inside the zoomed domain, thinned so a narrow
  // domain does not produce a solid wall of gridlines.
  const ticks = []
  const stepPct = (hi - lo) > 0.3 ? 10 : 5
  for (let t = Math.ceil(lo * 100 / stepPct) * stepPct; t <= hi * 100; t += stepPct) ticks.push(t)

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        <span className="w-[116px] shrink-0" />
        <div className="relative h-3 flex-1">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: x(t / 100) }}>{t}</span>
          ))}
        </div>
        <span className="w-[52px] shrink-0 text-right normal-case">Points</span>
      </div>

      <Row label="Coin flip" caption="" ticks={ticks} x={x} className="border-t">
        <Marker at={0.5} x={x} tone="neutral" label="50%" />
      </Row>

      {steps.map((s) => {
        const favorsRed = s.to > s.from
        const left = Math.min(s.from, s.to)
        const width = Math.abs(s.to - s.from)
        return (
          <Row
            key={s.key}
            label={s.label}
            caption={`${s.points > 0 ? '+' : ''}${s.points.toFixed(1)}`}
            captionClass={favorsRed ? 'text-corner-red' : 'text-corner-blue'}
            ticks={ticks}
            x={x}
          >
            <div
              className={cn('absolute top-1/2 h-[13px] -translate-y-1/2 rounded-[3px]',
                favorsRed ? 'bg-corner-red/80' : 'bg-corner-blue/80')}
              style={{ left: x(left), width: `calc(${x(Math.max(left + width, left))} - ${x(left)} + 1px)` }}
              title={`${s.label}: ${pct(s.from)} → ${pct(s.to)} (${favorsRed ? redName : blueName})`}
            />
            <span
              className="absolute top-1/2 h-[13px] w-px -translate-y-1/2 bg-foreground/30"
              style={{ left: x(s.from) }}
            />
          </Row>
        )
      })}

      <Row label="Model" caption={pct(final)} captionClass="text-foreground" ticks={ticks} x={x} className="border-t">
        {calibration && (
          <div
            className="absolute top-1/2 h-[7px] -translate-y-1/2 rounded-full bg-foreground/15"
            style={{ left: x(calibration.low), width: `calc(${x(calibration.high)} - ${x(calibration.low)})` }}
            title={`Calibrated range ${pct(calibration.low)}–${pct(calibration.high)}`}
          />
        )}
        <Marker at={final} x={x} tone="model" label={pct(final)} />
      </Row>

      {market != null && (
        <Row label="Market" caption={pct(market)} captionClass="text-sky-600" ticks={ticks} x={x}>
          <Marker at={market} x={x} tone="market" label={pct(market)} />
        </Row>
      )}

      <p className="mt-1.5 text-[9.5px] leading-snug text-muted-foreground/80">
        Read as {redName}&apos;s win probability, axis zoomed to the range walked. Each step is a
        family of model inputs, converted from log-odds to points; the base rate carries the
        division-wide starting point and every input not itemised here. Market is the best
        available price with vig included, so it flatters the favourite slightly. Red bars
        favour {redName}, blue {blueName}.
      </p>
    </div>
  )
}

function Row({ label, caption, captionClass, className, ticks, x, children }) {
  return (
    <div className={cn('flex items-center gap-2 py-[3px]', className)}>
      <span className="w-[116px] shrink-0 truncate text-right text-[11px] font-medium text-foreground/80" title={label}>
        {label}
      </span>
      <div className="relative h-[19px] flex-1">
        {ticks.map((t) => (
          <span key={t} className="absolute inset-y-0 w-px bg-border/60" style={{ left: x(t / 100) }} />
        ))}
        {children}
      </div>
      <span className={cn('w-[52px] shrink-0 text-right text-[10.5px] font-bold tabular-nums text-muted-foreground', captionClass)}>
        {caption}
      </span>
    </div>
  )
}

// A single probability, for the rows that are a position rather than a move.
function Marker({ at, x, tone, label }) {
  return (
    <>
      <span
        className={cn('absolute top-1/2 h-[15px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full',
          tone === 'model' ? 'bg-foreground' : tone === 'market' ? 'bg-sky-500' : 'bg-muted-foreground/60')}
        style={{ left: x(at) }}
        title={label}
      />
    </>
  )
}

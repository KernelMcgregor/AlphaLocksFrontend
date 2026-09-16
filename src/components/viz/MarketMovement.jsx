// Prediction-market price movement for a single fight.
//
// One line per venue. The vertical axis is the matchup itself: the top half is the red corner
// winning, the bottom half the blue corner, so a line drifting upward means money moving onto the
// red fighter. That is why only one series per venue is drawn — blue is 1 − red by construction,
// so a second line would be the first one mirrored, saying nothing while halving the vertical
// resolution of the part that matters.
//
// The axis is mirrored about 50%: the labels always read as *the nearer fighter's* win
// probability, so they rise going up from the midline and rise again going down from it. A raw
// scale would print 45% in the blue half, which reads as "blue is at 45%" when it means the
// opposite — blue is at 55%. Nothing below 50% is ever shown.
//
// The x axis runs in days-to-fight and counts down, so the bout sits at the right edge where the
// closing price is. Calendar time would put cards of different lengths on incomparable scales.

import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'

// Distinct hues, not the corner colours: these identify a venue, and reusing red or blue would
// read as a corner and collide with the corner shading behind them.
const VENUES = {
  kalshi: { label: 'Kalshi', color: '#16a34a' },
  polymarket: { label: 'Polymarket', color: '#9333ea' },
}

export default function MarketMovement({ series, modelProb, redName, blueName, redCss, blueCss, className }) {
  const venues = Object.keys(series || {}).filter((v) => series[v]?.length)
  if (!venues.length) return null

  // Merge onto one time axis. The venues sample independently and almost never share a
  // timestamp, so most rows carry a value for only one of them — `connectNulls` below is what
  // stops that from shredding each line into isolated dots.
  const byTime = new Map()
  for (const venue of venues) {
    for (const point of series[venue]) {
      const key = point.days_to_fight ?? point.t
      if (!byTime.has(key)) byTime.set(key, { d: point.days_to_fight, t: point.t })
      byTime.get(key)[venue] = point.red_prob * 100
    }
  }
  const data = [...byTime.values()].sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
  if (data.length < 2) return null

  const fmtDay = (d) => (d >= 1 ? `${Math.round(d)}d` : d > 0 ? '<1d' : 'fight')

  // Zoom the axis to what actually happened, instead of always drawing 0-100%.
  //
  // Prediction markets on a close fight live in a narrow band — this matchup never left 51-55% —
  // and a full-range axis renders that as a flat line, hiding every bit of movement the panel
  // exists to show. The window is widened to always contain the 50% line and the model's number,
  // so the corner shading stays meaningful and the model reference never falls off the top.
  const values = data.flatMap((row) => venues.map((v) => row[v]).filter((n) => n != null))
  const modelPct = modelProb == null ? null : modelProb * 100
  const must = [50, ...(modelPct == null ? [] : [modelPct])]
  let lo = Math.min(...values, ...must)
  let hi = Math.max(...values, ...must)
  const pad = Math.max(4, (hi - lo) * 0.18)
  lo = Math.max(0, Math.floor((lo - pad) / 5) * 5)
  hi = Math.min(100, Math.ceil((hi + pad) / 5) * 5)
  const ticks = []
  for (let t = lo; t <= hi; t += (hi - lo) > 40 ? 10 : 5) ticks.push(t)
  // Mirror about the midline: a plotted 45 belongs to the blue corner and is *their* 55%.
  const fmtPct = (v) => `${v >= 50 ? Math.round(v) : Math.round(100 - v)}%`

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-tight">Market movement</span>
        <span className="flex items-center gap-2.5 text-[10.5px] text-muted-foreground">
          {venues.map((v) => (
            <span key={v} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: VENUES[v]?.color }} />
              {VENUES[v]?.label || v}
            </span>
          ))}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 2, left: -20 }}>
          {/* Corner territory. Faint on purpose — it has to orient the eye without competing
              with the price lines drawn on top of it. */}
          <ReferenceArea y1={50} y2={hi} fill={redCss} fillOpacity={0.07} strokeOpacity={0}
            label={{ value: redName, position: 'insideTopLeft', fontSize: 10, fontWeight: 700, fill: redCss, offset: 8 }} />
          <ReferenceArea y1={lo} y2={50} fill={blueCss} fillOpacity={0.07} strokeOpacity={0}
            label={{ value: blueName, position: 'insideBottomLeft', fontSize: 10, fontWeight: 700, fill: blueCss, offset: 8 }} />

          <CartesianGrid strokeDasharray="2 4" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="d"
            type="number"
            // Reversed so the fight is at the right edge: a price curve reads as movement
            // *towards* an event, not away from one.
            domain={['dataMax', 'dataMin']}
            reversed
            tick={{ fontSize: 9 }}
            tickFormatter={fmtDay}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            domain={[lo, hi]}
            ticks={ticks}
            tick={{ fontSize: 9 }}
            tickFormatter={fmtPct}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          {/* The line the price crosses when the favourite changes. */}
          <ReferenceLine y={50} className="stroke-border" strokeWidth={1} />
          {modelProb != null && (
            <ReferenceLine
              y={modelProb * 100}
              stroke="currentColor"
              strokeDasharray="5 3"
              strokeOpacity={0.55}
              label={{ value: 'model', position: 'insideTopRight', fontSize: 9, opacity: 0.65 }}
            />
          )}
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, padding: '6px 8px' }}
            labelFormatter={(d) => (d >= 1 ? `${Math.round(d)} days out` : 'fight time')}
            formatter={(value, key) => [
              value >= 50
                ? `${redName} ${value.toFixed(1)}%`
                : `${blueName} ${(100 - value).toFixed(1)}%`,
              VENUES[key]?.label || key,
            ]}
          />
          {venues.map((v) => (
            <Line
              key={v}
              type="monotone"
              dataKey={v}
              stroke={VENUES[v]?.color}
              strokeWidth={1.8}
              dot={false}
              // Bridge rows belonging to the other venue. Both series are continuous in their own
              // right — leaving this off rendered them as scattered dots and made a complete
              // curve look like missing data.
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

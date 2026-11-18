// Price movement for a single fight: prediction-market venues by default, or any set of
// red-corner probability series (sportsbooks, a sharp/soft split) via `lines`, with optional
// dated markers (weigh-ins, opponent changes, ...) dropped on the same countdown axis.
//
// One line per series. The vertical axis is the matchup itself: the top half is the red corner
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
// A series with no entry in `lines` is context, not a subject: thin and grey.
const MUTED = { color: 'var(--color-muted-foreground)', width: 1, opacity: 0.45, legend: false }

// One glyph per marker kind; the legend spells them out and the glyph's hover gives the detail.
const MARKER_GLYPH = { weigh_in: 'W', opponent_change: 'O', news: 'N', model: 'M' }
const MARKER_NAME = { weigh_in: 'Weigh-ins', opponent_change: 'Opponent change', news: 'News spike', model: 'Model published' }

function MarkerFlag({ viewBox, marker, row = 0 }) {
  if (!viewBox) return null
  const { x } = viewBox
  const y = viewBox.y + row * 16
  const glyph = MARKER_GLYPH[marker.kind] || '•'
  const hot = marker.kind === 'opponent_change'
  return (
    <g transform={`translate(${x},${y + 7})`} style={{ cursor: 'help' }}>
      <title>{[marker.label, marker.detail].filter(Boolean).join(' — ')}</title>
      <circle r={7} className={hot ? 'fill-primary' : 'fill-foreground'} opacity={marker.upcoming ? 0.35 : 0.85} />
      <text textAnchor="middle" dy="0.35em" fontSize={8.5} fontWeight={800} className="fill-background">{glyph}</text>
    </g>
  )
}

/**
 * series   {key: [{days_to_fight, t, red_prob}]}
 * lines    {key: {label, color, width, opacity, dash, legend}} — omit for the venue defaults
 * markers  [{kind, days_to_fight, label, detail, upcoming}]
 * xDomain  [far, near] in days, to line this chart up with a companion chart
 */
export default function MarketMovement({
  series, modelProb, redName, blueName, redCss, blueCss, className,
  lines, markers, title = 'Market movement', right, height = 210, xDomain,
}) {
  const keys = Object.keys(series || {}).filter((v) => series[v]?.length)
  if (!keys.length) return null
  const style = (k) => (lines ? lines[k] || { ...MUTED, label: k } : VENUES[k] || { label: k, color: MUTED.color })
  // Recharts reads a dotted dataKey as a path ("BetOnline.ag"), so plot under positional keys.
  const id = Object.fromEntries(keys.map((k, i) => [k, `s${i}`]))
  const name = Object.fromEntries(keys.map((k) => [id[k], style(k).label || k]))

  // Merge onto one time axis. The series sample independently and almost never share a
  // timestamp, so most rows carry a value for only one of them — `connectNulls` below is what
  // stops that from shredding each line into isolated dots.
  const byTime = new Map()
  for (const k of keys) {
    for (const point of series[k]) {
      const key = point.days_to_fight ?? point.t
      if (!byTime.has(key)) byTime.set(key, { d: point.days_to_fight, t: point.t })
      byTime.get(key)[id[k]] = point.red_prob * 100
    }
  }
  const data = [...byTime.values()].sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
  if (data.length < 2) return null
  const flags = (markers || []).filter((m) => m.days_to_fight != null)
  const ds = [...data.map((r) => r.d), ...flags.map((m) => m.days_to_fight)].filter((d) => d != null)
  const domain = xDomain || [Math.max(...ds), Math.min(...ds)]
  // Markers closer than ~2.5% of the axis would draw over each other: stack them downward.
  const near = Math.abs(domain[0] - domain[1]) * 0.025
  const rows = []
  ;[...flags].sort((a, b) => b.days_to_fight - a.days_to_fight).forEach((m, i, arr) => {
    const prev = arr[i - 1]
    rows.push([m, prev && prev.days_to_fight - m.days_to_fight < near ? rows[i - 1][1] + 1 : 0])
  })

  const fmtDay = (d) => (d >= 1 ? `${Math.round(d)}d` : d > 0 ? '<1d' : 'fight')

  // Zoom the axis to what actually happened, instead of always drawing 0-100%.
  //
  // Prediction markets on a close fight live in a narrow band — this matchup never left 51-55% —
  // and a full-range axis renders that as a flat line, hiding every bit of movement the panel
  // exists to show. The window is widened to always contain the 50% line and the model's number,
  // so the corner shading stays meaningful and the model reference never falls off the top.
  const values = data.flatMap((row) => keys.map((k) => row[id[k]]).filter((n) => n != null))
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

  // Highlighted series first in the legend, then one entry standing for every muted line.
  const legend = keys.filter((k) => style(k).legend !== false)
  const muted = keys.length - legend.length
  // Draw muted lines first so the highlighted ones sit on top.
  const order = [...keys].sort((a, b) => (style(a).legend === false ? 0 : 1) - (style(b).legend === false ? 0 : 1))
  const kinds = [...new Set(flags.map((m) => m.kind))]

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-tight">{title}</span>
        <span className="flex flex-wrap items-center gap-2.5 text-[10.5px] text-muted-foreground">
          {legend.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: style(k).color }} />
              {style(k).label || k}
            </span>
          ))}
          {muted > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-px w-3" style={{ background: MUTED.color }} />
              {legend.length ? `${muted} other book${muted > 1 ? 's' : ''}` : `${muted} book${muted > 1 ? 's' : ''}`}
            </span>
          )}
          {right}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: flags.length ? 16 : 6, right: 12, bottom: 2, left: -20 }}>
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
            domain={domain[0] === domain[1] ? ['dataMax', 'dataMin'] : [domain[1], domain[0]]}
            reversed
            allowDataOverflow
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
          {/* The line the price crosses when the favorite changes. */}
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
          {rows.map(([m, row], i) => (
            <ReferenceLine key={`${m.kind}-${i}`} x={m.days_to_fight} stroke="currentColor" strokeOpacity={0.3}
              strokeDasharray={m.upcoming ? '2 3' : undefined} label={<MarkerFlag marker={m} row={row} />} />
          ))}
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, padding: '6px 8px' }}
            labelFormatter={(d) => (d >= 1 ? `${Math.round(d)} days out` : d > 0 ? `${Math.round(d * 24)}h out` : 'fight time')}
            itemSorter={(item) => -(item.value ?? 0)}
            formatter={(value, key) => [
              value >= 50
                ? `${redName} ${value.toFixed(1)}%`
                : `${blueName} ${(100 - value).toFixed(1)}%`,
              name[key] || key,
            ]}
          />
          {order.map((k) => {
            const st = style(k)
            return (
              <Line
                key={k}
                type={lines ? 'stepAfter' : 'monotone'}
                dataKey={id[k]}
                name={name[id[k]]}
                stroke={st.color}
                strokeWidth={st.width ?? 1.8}
                strokeOpacity={st.opacity ?? 1}
                strokeDasharray={st.dash}
                dot={false}
                // Bridge rows belonging to the other series. Each is continuous in its own
                // right — leaving this off rendered them as scattered dots and made a complete
                // curve look like missing data.
                connectNulls
                isAnimationActive={false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
      {kinds.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {kinds.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-background ${k === 'opponent_change' ? 'bg-primary' : 'bg-foreground/85'}`}>
                {MARKER_GLYPH[k] || '•'}
              </span>
              {MARKER_NAME[k] || k}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

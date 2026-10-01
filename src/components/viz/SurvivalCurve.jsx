// "How long will it last?" — the rounds model as a survival curve.
//
// The black line is P(the fight is still going), from 100% at the opening bell down to
// P(goes the distance) at the final one. The space above it is the chance it has
// already ended, split by corner and cause: KO solid, submission hatched, in the
// corner colours, so no new hues enter the page.
//
// Every colour is named where it is drawn: each band carries a direct label at the
// right edge ("Talbott KO/TKO 43%"), the white space under the line is labelled
// "Still going", and a one-line caption says what line, shading and dots mean.
// A legend you have to decode was the problem; labels on the marks are the fix.
//
// The model's resolution is 1¼ minutes (four slices a round). Each point is drawn as
// a small dot so it is visible where the model's numbers are and where the line is
// only joining them.
//
// The corner split of each cause is the six-way grid's ratio held constant over time
// (the rounds model predicts KO vs Sub timing, not who lands it). The tooltip says so.
//
// Market prices sit on the curve where a betting line exists — O/U x.5 rounds is the
// curve at x.5 × 5 minutes, "goes the distance" its end — with a whisker to the model,
// and the same lines are listed in words under the chart.
import { Info } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { SlideTabs } from '../ui/slide-tabs'
import { Tip } from '../ui/tip'
import HeroTile from './HeroTile'

const MARKET = '#0ea5e9'   // sky-500: the waterfall's market marker, same meaning here

const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`

// Minutes into the round → "2:30".
function mmss(m) {
  const whole = Math.floor(m + 1e-9)
  return `${whole}:${String(Math.round((m - whole) * 60)).padStart(2, '0')}`
}

// Fight time → "R2 1:15". A moment at exactly 5:00 belongs to R1, so a boundary
// resolves to the round it ends rather than the one it starts.
function fightClock(t, rounds) {
  if (t == null || !Number.isFinite(t)) return '—'
  const r = Math.min(rounds, Math.max(1, Math.ceil(t / 5 - 1e-9)))
  return `R${r} ${mmss(Math.max(0, t - (r - 1) * 5))}`
}

// Linear interpolation on the curve, for lines that fall between points.
function sAt(curve, t) {
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].t >= t - 1e-9) {
      const a = curve[i - 1]
      const b = curve[i]
      const w = (t - a.t) / ((b.t - a.t) || 1)
      return a.s + (b.s - a.s) * w
    }
  }
  return curve[curve.length - 1]?.s ?? null
}

function Hatch({ id, css }) {
  return (
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill={css} fillOpacity="0.14" />
      <line x1="0" y1="0" x2="0" y2="5" stroke={css} strokeWidth="2" strokeOpacity="0.75" />
    </pattern>
  )
}

// Bottom to top above the line: the order of the stacked bands.
const CAUSES = ['red_ko', 'red_sub', 'blue_sub', 'blue_ko']

/**
 * prediction: fight.round_prediction — { curve: [{t, s, red_ko, blue_ko, red_sub, blue_sub}],
 *             p_end, p_decision, expected_minutes, median_finish_minute, peak_bin_start }
 * markets:    [{ t, prob, label, source }]  market P(still going at t)
 * decSplit:   { red, blue } share of decisions per corner (from the six-way grid)
 * highlight:  'red_ko' | 'red_sub' | 'blue_ko' | 'blue_sub' | 'dec' | null
 */
export default function SurvivalCurve({ prediction, markets = [], names, css, decSplit, highlight }) {
  const uid = useId().replace(/:/g, '')
  const [view, setView] = useState('curve')

  const curve = useMemo(() => prediction?.curve || [], [prediction])
  const end = curve.length ? curve[curve.length - 1].t : 15
  const rounds = Math.round(end / 5)

  const data = useMemo(() => curve.map((p) => ({
    t: p.t,
    s: p.s * 100,
    ...Object.fromEntries(CAUSES.map((c) => [c, p[c] * 100])),
  })), [curve])

  // Per-round finish chance by cause, from the cumulative curve at each bell.
  const byRound = useMemo(() => {
    if (!curve.length) return []
    const at = (t) => curve.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), curve[0])
    const rows = []
    for (let r = 1; r <= rounds; r++) {
      const a = at((r - 1) * 5)
      const b = at(r * 5)
      rows.push({ key: `R${r}`, ...Object.fromEntries(CAUSES.map((c) => [c, (b[c] - a[c]) * 100])) })
    }
    const dec = (prediction?.p_decision ?? curve.at(-1).s) * 100
    rows.push({ key: 'Decision', red_dec: dec * (decSplit?.red ?? 0.5), blue_dec: dec * (decSplit?.blue ?? 0.5) })
    return rows
  }, [curve, rounds, prediction, decSplit])

  if (!curve.length) return null

  const animate = !reducedMotion()
  const last = curve.at(-1)
  const dots = markets
    .filter((m) => m.prob != null && m.t > 0 && m.t <= end + 1e-9)
    .map((m) => {
      const model = sAt(curve, m.t)
      return {
        ...m,
        model,
        gap: (model - m.prob) * 100,
        plain: Math.abs(m.t - end) < 1e-6 ? 'Goes the distance' : `Still going at ${fightClock(m.t, rounds)}`,
      }
    })

  // Highlight from the Method grid: the hovered cause at full strength, the rest faded.
  const op = (key, base) => (highlight == null ? base : highlight === key ? Math.min(1, base + 0.35) : 0.12)

  const bands = {
    red_ko: { fill: css.red, opacity: 0.4, name: `${names.red} KO/TKO`, swatch: { background: css.red, opacity: 0.55 } },
    red_sub: { fill: `url(#${uid}-hr)`, opacity: 1, name: `${names.red} submission`, swatch: { background: `repeating-linear-gradient(45deg, ${css.red} 0 2px, transparent 2px 4px)` } },
    blue_sub: { fill: `url(#${uid}-hb)`, opacity: 1, name: `${names.blue} submission`, swatch: { background: `repeating-linear-gradient(45deg, ${css.blue} 0 2px, transparent 2px 4px)` } },
    blue_ko: { fill: css.blue, opacity: 0.4, name: `${names.blue} KO/TKO`, swatch: { background: css.blue, opacity: 0.55 } },
  }

  // Direct labels at the right edge, centred in each band. A band too thin to hold
  // text is still named in the key below the chart.
  const edgeLabels = []
  let floor = last.s * 100
  for (const c of CAUSES) {
    const h = last[c] * 100
    if (h >= 9) edgeLabels.push({ key: c, y: floor + h / 2, text: `${bands[c].name} ${h.toFixed(0)}%` })
    floor += h
  }

  const roundCentres = Array.from({ length: rounds }, (_, i) => i * 5 + 2.5)
  const summary = [
    `Chance the fight is still going: ${pct(curve.find((p) => Math.abs(p.t - 5) < 1e-6)?.s ?? 0)} after round 1, ${pct(last.s)} at the final bell`,
    ...dots.map((d) => `${d.plain}: model ${pct(d.model)}, market ${pct(d.prob)}`),
  ].join('. ')

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-[13px] font-extrabold tracking-tight">How long will it last?</span>
        <Tip content={(
          <span className="block max-w-[280px] space-y-1 text-[11px]">
            <span className="block">
              The <b>black line</b> is the chance the fight is still going at that moment. The{' '}
              <b>coloured space above it</b> is the chance it&apos;s already over, split by how it
              ended: solid for KO/TKO, striped for submission.{dots.length > 0 && <> <b style={{ color: MARKET }}>Blue dots</b> are the betting market at each over/under line.</>}
            </span>
            <span className="block text-muted-foreground">
              The model works in 1¼-minute slices (the dots on the line). Who lands the finish uses
              the Method grid&apos;s split, held constant through the fight.
            </span>
          </span>
        )}>
          <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
        </Tip>
        <SlideTabs
          size="sm"
          className="ml-auto"
          value={view}
          onChange={setView}
          tabs={[{ key: 'curve', label: 'Survival curve' }, { key: 'round', label: 'By round' }]}
        />
      </div>
      {view === 'round' && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Each bar is the chance the fight ends in that round; the last is the chance it goes to the judges.
        </p>
      )}

      {/* Recharts makes the chart focusable for keyboard use; a click would otherwise leave
          the browser's focus ring drawn around the whole plot. */}
      <div role="img" aria-label={summary} className="[&_*:focus]:outline-none">
        {view === 'curve' ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <Hatch id={`${uid}-hr`} css={css.red} />
                <Hatch id={`${uid}-hb`} css={css.blue} />
              </defs>
              {roundCentres.map((c, i) => (i % 2 === 1 ? (
                <ReferenceArea key={c} x1={c - 2.5} x2={c + 2.5} fill="currentColor" fillOpacity={0.035} strokeOpacity={0} />
              ) : null))}
              <CartesianGrid strokeDasharray="2 4" className="stroke-border" vertical={false} />
              {roundCentres.slice(1).map((c) => (
                <ReferenceLine key={c} x={c - 2.5} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
              ))}
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, end]}
                ticks={roundCentres}
                tickFormatter={(t) => `Round ${Math.round((t + 2.5) / 5)}`}
                tick={{ fontSize: 9.5 }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 9.5 }}
                width={50}
                stroke="currentColor"
                className="text-muted-foreground"
                label={{ value: 'Chance fight is still going', angle: -90, position: 'insideLeft', offset: 4, dy: 70, fontSize: 9.5, fill: 'currentColor' }}
              />
              <Tooltip
                cursor={{ stroke: 'currentColor', strokeOpacity: 0.35 }}
                content={({ active, label }) => {
                  if (!active || label == null) return null
                  const p = curve.find((q) => Math.abs(q.t - label) < 1e-6)
                  if (!p) return null
                  const dot = dots.find((d) => Math.abs(d.t - label) < 0.01)
                  const atEnd = Math.abs(label - end) < 1e-6
                  const over = 1 - p.s
                  const ways = [...CAUSES].reverse().sort((x, y) => p[y] - p[x])
                  return (
                    <div className="w-[250px] rounded-lg border bg-card px-3 py-2 text-[11px] text-card-foreground shadow-md">
                      <div className="font-bold">
                        {label === 0 ? 'Opening bell' : atEnd ? 'Final bell' : `${fightClock(label, rounds)} into the fight`}
                      </div>

                      <div className="mt-1.5 flex items-baseline justify-between gap-3">
                        <span>{atEnd ? 'Goes the distance' : 'Fight still going'}</span>
                        <b className="text-[13px] tabular-nums">{pct(p.s)}</b>
                      </div>

                      {over > 0.005 && (
                        <div className="mt-1.5 border-t pt-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span>Fight has ended</span>
                            <b className="text-[13px] tabular-nums">{pct(over)}</b>
                          </div>
                          <div className="mb-0.5 mt-1 grid grid-cols-[1fr_auto_auto] gap-x-3 text-[9.5px] text-muted-foreground">
                            <span>How it ended</span><span className="text-right">chance</span><span className="text-right">if ended</span>
                          </div>
                          {ways.map((c) => (
                            <div key={c} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 tabular-nums">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="h-2 w-3 shrink-0 rounded-sm" style={bands[c].swatch} />
                                <span className="truncate">{bands[c].name}</span>
                              </span>
                              <span className="text-right">{pct(p[c])}</span>
                              <span className="text-right text-muted-foreground">{pct(p[c] / over)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {dot && (
                        <div className="mt-1.5 border-t pt-1.5">
                          <div className="font-semibold">
                            {dot.label === 'Distance' ? 'Goes the distance' : `Over ${dot.label.replace('O/U ', '')} rounds`} bet
                          </div>
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-muted-foreground">Model</span><span>{pct(dot.model)}</span>
                          </div>
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-muted-foreground">Market</span><span>{pct(dot.prob)}</span>
                          </div>
                          <div className="flex justify-between gap-3 tabular-nums">
                            <span className="text-muted-foreground">Edge</span>
                            <span className={dot.gap >= 0.05 ? 'font-bold text-emerald-600' : 'text-muted-foreground'}>
                              {dot.gap >= 0 ? '+' : '−'}{Math.abs(dot.gap).toFixed(1)} pts
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }}
              />
              {/* Base of the stack is the survival line itself, drawn invisible, so the four
                  cause bands fill exactly the space between the curve and 100%. */}
              <Area dataKey="s" stackId="ended" type="linear" stroke="none" fill="none" isAnimationActive={false} activeDot={false} />
              {CAUSES.map((c) => (
                <Area
                  key={c}
                  dataKey={c}
                  stackId="ended"
                  type="linear"
                  stroke="none"
                  fill={bands[c].fill}
                  fillOpacity={op(c, bands[c].opacity)}
                  activeDot={false}
                  isAnimationActive={animate}
                  animationDuration={600}
                />
              ))}
              <Line
                dataKey="s"
                type="linear"
                stroke="currentColor"
                strokeWidth={2.25}
                dot={{ r: 2, fill: 'currentColor', strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={animate}
                animationDuration={600}
                className="text-foreground"
              />
              {/* "Still going" named inside the white space under the line. */}
              <ReferenceDot
                x={end * 0.5}
                y={sAt(curve, end * 0.5) * 50}
                r={0}
                label={{ value: 'Still going', fontSize: 11, fontWeight: 700, fill: 'currentColor', className: 'text-muted-foreground' }}
              />
              {edgeLabels.map((l) => (
                <ReferenceDot
                  key={l.key}
                  x={end}
                  y={l.y}
                  r={0}
                  label={{ value: l.text, position: 'left', offset: 8, fontSize: 10, fontWeight: 700, fill: 'currentColor' }}
                />
              ))}
              {dots.map((d) => (
                <ReferenceLine
                  key={`w-${d.label}`}
                  segment={[{ x: d.t, y: d.prob * 100 }, { x: d.t, y: d.model * 100 }]}
                  stroke={d.gap >= 0.05 ? '#059669' : 'currentColor'}
                  strokeOpacity={d.gap >= 0.05 ? 0.9 : 0.4}
                  strokeWidth={2}
                />
              ))}
              {dots.map((d) => (
                <ReferenceDot key={`d-${d.label}`} x={d.t} y={d.prob * 100} r={4.5} fill={MARKET} stroke="var(--color-card, #fff)" strokeWidth={1.5} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byRound} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
              <defs>
                <Hatch id={`${uid}-hr2`} css={css.red} />
                <Hatch id={`${uid}-hb2`} css={css.blue} />
              </defs>
              <CartesianGrid strokeDasharray="2 4" className="stroke-border" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 9.5 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9.5 }} width={50} stroke="currentColor" className="text-muted-foreground"
                label={{ value: 'Chance it ends here', angle: -90, position: 'insideLeft', offset: 4, dy: 55, fontSize: 9.5, fill: 'currentColor' }} />
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const total = payload.reduce((a, p) => a + (p.value || 0), 0)
                  return (
                    <div className="rounded-lg border bg-card px-2.5 py-1.5 text-[11px] text-card-foreground shadow-md">
                      <div className="mb-0.5 font-bold">
                        {label === 'Decision' ? 'Goes the distance' : `Ends in round ${label.slice(1)}`} · {total.toFixed(0)}%
                      </div>
                      {payload.filter((p) => p.value > 0.05).map((p) => (
                        <div key={p.dataKey} className="flex justify-between gap-3 tabular-nums">
                          <span>{p.name}</span><span>{p.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Bar dataKey="red_ko" name={bands.red_ko.name} stackId="r" fill={css.red} fillOpacity={op('red_ko', 0.7)} isAnimationActive={animate} />
              <Bar dataKey="red_sub" name={bands.red_sub.name} stackId="r" fill={`url(#${uid}-hr2)`} fillOpacity={op('red_sub', 1)} isAnimationActive={animate} />
              <Bar dataKey="red_dec" name={`${names.red} decision`} stackId="r" fill={css.red} fillOpacity={op('dec', 0.3)} isAnimationActive={animate} />
              <Bar dataKey="blue_sub" name={bands.blue_sub.name} stackId="r" fill={`url(#${uid}-hb2)`} fillOpacity={op('blue_sub', 1)} isAnimationActive={animate} />
              <Bar dataKey="blue_ko" name={bands.blue_ko.name} stackId="r" fill={css.blue} fillOpacity={op('blue_ko', 0.7)} isAnimationActive={animate} />
              <Bar dataKey="blue_dec" name={`${names.blue} decision`} stackId="r" fill={css.blue} fillOpacity={op('dec', 0.3)} radius={[3, 3, 0, 0]} isAnimationActive={animate} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* The key, in words: one entry per colour, nothing to decode. */}
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:flex sm:flex-wrap">
        {view === 'curve' && (
          <span className="flex items-center gap-1.5">
            <span className="h-[2.5px] w-4 rounded-full bg-foreground" />Still going
          </span>
        )}
        {[...CAUSES].reverse().map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={bands[c].swatch} />{view === 'curve' ? `Ends: ${bands[c].name}` : bands[c].name}
          </span>
        ))}
        {view === 'curve' && dots.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARKET }} />Market price
          </span>
        )}
      </div>

      {/* Each tile is a sentence: the number, what it is, and what it means for this fight.
          Nothing the grid already shows (decision %, win %) is repeated here. */}
      {(() => {
        const pk = prediction.peak_bin_start
        const r = pk == null ? null : Math.floor(pk / 5) + 1
        const a = pk == null ? null : curve.find((q) => Math.abs(q.t - pk) < 1e-6)
        const b = pk == null ? null : curve.find((q) => Math.abs(q.t - (pk + 1.25)) < 1e-6)
        const peakChance = a && b ? a.s - b.s : null
        // Who ends it, among the fights that are stopped.
        const finished = 1 - last.s
        const redFin = last.red_ko + last.red_sub
        const blueFin = last.blue_ko + last.blue_sub
        const finisher = redFin >= blueFin ? { name: names.red, share: redFin / finished } : { name: names.blue, share: blueFin / finished }
        const avg = prediction.expected_minutes
        return (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeroTile
              label="Likely finisher"
              value={finished > 0.005 ? finisher.name : '—'}
              sub={finished > 0.005 ? `lands ${pct(finisher.share)} of stoppages` : null}
            />
            <HeroTile
              label="Average fight length"
              value={avg != null ? mmss(avg) : '—'}
              sub={avg != null ? `min:sec · about ${fightClock(avg, rounds)}` : null}
            />
            <HeroTile
              label="Median finish time"
              value={fightClock(prediction.median_finish_minute, rounds)}
              sub="if stopped, half end before this"
            />
            <HeroTile
              label="Most likely to end"
              value={r ? `R${r} ${mmss(pk - (r - 1) * 5)}–${mmss(pk + 1.25 - (r - 1) * 5)}` : '—'}
              sub={peakChance != null ? `${pct(peakChance, 1)} chance in these 75 seconds` : null}
            />
          </div>
        )
      })()}
    </div>
  )
}

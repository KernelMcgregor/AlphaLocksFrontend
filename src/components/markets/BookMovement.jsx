// Sportsbook moneyline movement for one fight, every book on one countdown axis, with what
// happened around the line (weigh-ins, opponent changes, news spikes, the model's publish).
//
// Two views of the same lines:
//   Books          every book, Pinnacle picked out; the rest are grey context.
//   Sharp vs soft  Pinnacle against the median of FanDuel / BetRivers / Bovada, with Pinnacle's
//                  max stake underneath. A sharp book raises its limit as it trusts its price,
//                  so the stake line is how much the sharp number is worth at each point.
// The stake gets its own chart (same x axis) rather than a second y scale on the price chart.
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { peekCached } from '../../lib/api'
import { bookHistoryPath, fetchBookHistory } from '../../lib/marketsApi'
import { SlideTabs } from '../ui/slide-tabs'
import MarketMovement from '../viz/MarketMovement'
import { CORNERS } from '../fight/corners'

const SHARP = { label: 'Pinnacle', color: 'var(--color-fam-8)', width: 2 }
const SOFT = { label: 'Soft-book median', color: 'var(--color-fam-4)', width: 2 }
const VIEWS = [
  { key: 'books', label: 'Books' },
  { key: 'sharp', label: 'Sharp vs soft' },
]

const fmtStake = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${Math.round(v)}`)

function StakeChart({ steps, xDomain, nowDays }) {
  // Carry the last limit to now (the cutoff, once started): it holds until Pinnacle changes it.
  const data = steps.map((s) => ({ d: s.days_to_fight, v: s.max_stake }))
  const end = nowDays ?? xDomain[1]
  if (data.length && end < data[data.length - 1].d) data.push({ d: end, v: data[data.length - 1].v })
  const hi = Math.max(...data.map((r) => r.v))
  return (
    <div className="mt-2">
      <div className="mb-1 text-[11px] font-bold text-muted-foreground">Pinnacle max stake</div>
      <ResponsiveContainer width="100%" height={72}>
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
          <XAxis dataKey="d" type="number" domain={[xDomain[1], xDomain[0]]} reversed allowDataOverflow
            tick={false} axisLine={false} height={2} />
          <YAxis domain={[0, hi]} ticks={[0, hi]} tickFormatter={fmtStake} tick={{ fontSize: 9 }}
            stroke="currentColor" className="text-muted-foreground" />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, padding: '6px 8px' }}
            labelFormatter={(d) => (d >= 1 ? `${Math.round(d)} days out` : `${Math.round(d * 24)}h out`)}
            formatter={(v) => [fmtStake(v), 'Max stake']}
          />
          <Area type="stepAfter" dataKey="v" stroke={SHARP.color} strokeWidth={1.5} fill={SHARP.color}
            fillOpacity={0.14} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function BookMovement({ fight, modelProb, className }) {
  // a hypothetical matchup has no book lines at all
  const real = !fight.hypothetical
  const [hist, setHist] = useState(() => (real ? peekCached(bookHistoryPath(fight.id)) : null))
  const [view, setView] = useState('books')

  useEffect(() => {
    if (!real) return undefined
    let live = true
    fetchBookHistory(fight.id).then((d) => live && setHist(d)).catch(() => live && setHist(null))
    return () => { live = false }
  }, [fight.id, real])

  const split = hist?.sharp_soft
  const shown = view === 'sharp' && split ? 'sharp' : 'books'

  const { series, lines, xDomain } = useMemo(() => {
    const books = hist?.books || []
    if (!books.length) return {}
    const out = shown === 'sharp'
      ? { series: { Pinnacle: split.sharp, soft: split.soft_median }, lines: { Pinnacle: SHARP, soft: SOFT } }
      : {
          series: Object.fromEntries(books.map((b) => [b.book, b.points])),
          // only Pinnacle is named; every other book is grey context
          lines: books.some((b) => b.sharp) ? { Pinnacle: SHARP } : {},
        }
    // Each store writes on change, so a last price holds until now (or the cutoff, once started).
    const hold = (pts) => (pts?.length && hist.now_days != null && pts[pts.length - 1].days_to_fight > hist.now_days
      ? [...pts, { ...pts[pts.length - 1], days_to_fight: hist.now_days, t: null }] : pts)
    out.series = Object.fromEntries(Object.entries(out.series).map(([k, pts]) => [k, hold(pts)]))
    const ds = [
      ...Object.values(out.series).flat().map((p) => p.days_to_fight),
      ...(hist.markers || []).map((m) => m.days_to_fight),
    ]
    return { ...out, xDomain: [Math.max(...ds), Math.min(...ds)] }
  }, [split, shown, hist])

  if (!series) return null
  const names = { red: fight.red_fighter.last_name, blue: fight.blue_fighter.last_name }

  return (
    <div className={className}>
      <MarketMovement
        title="Sportsbook lines"
        series={series}
        lines={lines}
        markers={hist.markers}
        modelProb={modelProb}
        redName={names.red}
        blueName={names.blue}
        redCss={CORNERS[0].css}
        blueCss={CORNERS[1].css}
        xDomain={xDomain}
        height={230}
        right={split ? <SlideTabs tabs={VIEWS} value={shown} onChange={setView} size="sm" /> : null}
      />
      {shown === 'sharp' && split.max_stake?.length > 0 && <StakeChart steps={split.max_stake} xDomain={xDomain} nowDays={hist.now_days} />}
    </div>
  )
}

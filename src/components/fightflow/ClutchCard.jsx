// Clutch rating for the fighter profile (services/ufc/fightflow_clutch): how a fighter
// does in late rounds (3+) and in the round right after losing one, against their own
// other rounds in the same bouts, on the round model's scale and shrunk toward zero.
//
// Shown as points of round-win probability at an even round (logit -> sigmoid - 0.5),
// which reads more plainly than logits. Renders nothing for a fighter without a rating
// or too few bouts for a percentile.
import { useEffect, useState } from 'react'
import { getFighterClutch } from '../../lib/fightflowApi'
import { ordinal } from '../../lib/fighterAnalytics'
import { Tip } from '../ui/tip'
import { Box } from '../fight/layout'

// Points of round-win probability at an even round.
const pts = (logit) => (1 / (1 + Math.exp(-logit)) - 0.5) * 100
const fmt = (logit) => {
  const v = Math.round(pts(logit))
  return `${v > 0 ? '+' : ''}${v}`
}
// The bar's half-width, in points: clutch effects are a few points either way.
const SPAN = 15

// A centred bar from 0 to the estimate, with a ±1 SE whisker when given.
function Diverging({ v, se, strong }) {
  const pos = (p) => `${50 + (Math.max(-SPAN, Math.min(SPAN, p)) / SPAN) * 50}%`
  const p = pts(v)
  return (
    <div className="relative h-3 w-full rounded-full bg-muted/60">
      <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
      {se != null && (
        <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-foreground/30"
          style={{ left: pos(pts(v - se)), right: `calc(100% - ${pos(pts(v + se))})` }} />
      )}
      <span
        className={strong ? 'absolute inset-y-0 rounded-full bg-primary' : 'absolute inset-y-[2px] rounded-full bg-foreground/60'}
        style={p >= 0 ? { left: '50%', width: `calc(${pos(p)} - 50%)` } : { left: pos(p), width: `calc(50% - ${pos(p)})` }}
      />
    </div>
  )
}

function Row({ label, v, n, tip }) {
  if (v == null) return null
  return (
    <Tip content={<span className="text-[11px]">{tip} · {n} rounds</span>}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_36px] items-center gap-2">
        <span className="truncate text-[11px] font-semibold text-muted-foreground">{label}</span>
        <Diverging v={v} />
        <span className="text-right text-[11px] font-bold tabular-nums">{fmt(v)}</span>
      </div>
    </Tip>
  )
}

export default function ClutchCard({ fighterId, className }) {
  const [loaded, setLoaded] = useState(null)

  useEffect(() => {
    let live = true
    if (fighterId) getFighterClutch(fighterId).then((d) => { if (live) setLoaded({ id: fighterId, data: d }) })
    return () => { live = false }
  }, [fighterId])

  const c = loaded?.id === fighterId ? loaded.data : null
  if (!c || c.percentile == null) return null

  return (
    <Box
      className={className}
      title="Clutch"
      tip={`Late rounds and the round after a lost one, against the same fighter's other rounds in those bouts, from the round model. Points of round-win chance; shrunk toward zero for small samples. ${c.n_fights} bouts, ${c.n_rounds} rounds.`}
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[30px] font-black leading-none">{ordinal(c.percentile)}</span>
        <span className="text-[11px] font-bold text-muted-foreground">pct</span>
        <Tip className="ml-auto" content={<span className="text-[11px]">±{Math.round(pts(c.se))} pts (1 SE)</span>}>
          <span className="cursor-help text-[15px] font-extrabold tabular-nums">{fmt(c.clutch)} pts</span>
        </Tip>
      </div>
      <Diverging v={c.clutch} se={c.se} strong />
      <div className="mt-3 grid gap-1.5">
        <Row label="Late rounds" v={c.late} n={c.late_rounds} tip="Rounds 3+ vs rounds 1–2 of the same bout" />
        <Row label="After a lost round" v={c.bounce} n={c.bounce_rounds} tip="The round after one the model gave the opponent" />
      </div>
    </Box>
  )
}

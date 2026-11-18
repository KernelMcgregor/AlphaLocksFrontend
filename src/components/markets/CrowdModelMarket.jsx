// Crowd, model and market on one decided fight: who the fans scored it for (mmadecisions
// scorecards, cast after the fight), beside what the model and the closing line expected.
// Each is a red-vs-blue split bar, the same reading as every split bar on the fight pages.
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { peekCached } from '../../lib/api'
import { fetchFightCrowd } from '../../lib/marketsApi'
import { Box, CornerLegend } from '../fight/layout'
import { CORNERS } from '../fight/corners'
import { Tip } from '../ui/tip'

const pct = (p) => `${Math.round(p * 100)}%`

function SplitRow({ label, tip, red, blue, draw = 0, winner }) {
  const segs = [
    { key: 'red', p: red, css: CORNERS[0].css },
    { key: 'draw', p: draw, css: 'var(--color-muted-foreground)' },
    { key: 'blue', p: blue, css: CORNERS[1].css },
  ].filter((s) => s.p > 0)
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2">
      <Tip content={<span className="text-[11px]">{tip}</span>}>
        <span className="cursor-help text-[11px] font-bold">{label}</span>
      </Tip>
      <div className="flex h-5 gap-[2px] overflow-hidden rounded-[4px]">
        {segs.map((s) => (
          <div key={s.key} className="flex min-w-0 items-center px-1.5 text-[10.5px] font-bold tabular-nums text-white"
            style={{ width: `${s.p * 100}%`, background: s.css, opacity: s.key === 'draw' ? 0.5 : 0.9,
              justifyContent: s.key === 'blue' ? 'flex-end' : 'flex-start' }}>
            {s.p >= 0.12 && (
              <span className="flex items-center gap-0.5">
                {winner === s.key && s.key === 'red' && <Check className="h-3 w-3" strokeWidth={3} />}
                {pct(s.p)}
                {winner === s.key && s.key === 'blue' && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CrowdModelMarket({ fight, className }) {
  const path = `/ufc/fights/${fight.id}/crowd`
  const [d, setD] = useState(() => peekCached(path))
  useEffect(() => {
    let live = true
    fetchFightCrowd(fight.id).then((x) => live && setD(x)).catch(() => live && setD(null))
    return () => { live = false }
  }, [fight.id])

  if (!d?.fans) return null
  const { fans, model, market, winner } = d
  return (
    <Box title="Crowd, model, market" className={className}
      right={<CornerLegend red={fight.red_fighter} blue={fight.blue_fighter} />}>
      <div className="grid gap-2">
        <SplitRow label="Fans" tip={`${fans.n.toLocaleString()} fan scorecards on mmadecisions.com${fans.draw ? `, ${pct(fans.draw)} a draw` : ''}`}
          red={fans.red} blue={fans.blue} draw={fans.draw} winner={winner} />
        {model?.red_prob != null && (
          <SplitRow label="Model" tip="Published win probability before the fight"
            red={model.red_prob} blue={1 - model.red_prob} winner={winner} />
        )}
        {market && (
          <SplitRow label="Close" tip={market.source === 'consensus' ? 'BestFightOdds consensus close, vig removed' : 'Median sportsbook close, vig removed'}
            red={market.red_close_prob} blue={1 - market.red_close_prob} winner={winner} />
        )}
      </div>
    </Box>
  )
}

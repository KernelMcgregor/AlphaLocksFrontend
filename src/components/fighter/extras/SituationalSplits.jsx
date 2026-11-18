// Record and striking split by situation: short notice, layoff, odds, rounds, altitude.
import MirrorBars from '../../viz/MirrorBars'
import { fetchFighterSplits } from '../../../lib/fighterExtrasApi'
import { cn } from '../../../lib/utils'
import { useExtra } from './useExtra'

const record = (s) => `${s.wins}-${s.losses}${s.draws ? `-${s.draws}` : ''}`

function SplitCard({ split }) {
  const { a, b } = split
  const rows = [
    { label: 'Win %', self: a.win_pct, opp: b.win_pct },
    { label: 'Finish %', self: a.finish_pct, opp: b.finish_pct },
    { label: 'Sig. acc', self: a.sig_acc, opp: b.sig_acc },
    { label: 'Sig. def', self: a.sig_def, opp: b.sig_def },
  ]
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2.5 grid grid-cols-[1fr_auto_1fr] items-baseline gap-2">
        <span className="text-right text-[15px] font-extrabold tabular-nums" title={`${a.fights} fights`}>{record(a)}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">{split.label}</span>
        <span className="text-[15px] font-extrabold tabular-nums" title={`${b.fights} fights`}>{record(b)}</span>
      </div>
      <MirrorBars title="" rows={rows} mode="pct" leftLabel={a.label} rightLabel={b.label} />
    </div>
  )
}

export default function SituationalSplits({ fighterId, className }) {
  const { data, loaded } = useExtra(fetchFighterSplits, fighterId)
  if (!loaded) return <div className={cn('min-h-[200px]', className)} />
  const splits = (data?.splits || []).filter((s) => s.a.fights > 0 && s.b.fights > 0)
  if (!splits.length) return <p className={cn('text-sm text-muted-foreground', className)}>No situational splits yet.</p>
  return (
    <div className={cn('grid gap-3 lg:grid-cols-2 2xl:grid-cols-3', className)}>
      {splits.map((s) => <SplitCard key={s.key} split={s} />)}
    </div>
  )
}

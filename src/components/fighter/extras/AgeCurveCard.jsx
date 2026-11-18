// The division's win rate by age, with this fighter's record at each age on top.
import AgeCurve from '../../viz/AgeCurve'
import { fetchFighterAgeCurve } from '../../../lib/fighterExtrasApi'
import { cn } from '../../../lib/utils'
import { useExtra } from './useExtra'

export default function AgeCurveCard({ fighterId, fighterLabel, className }) {
  const { data, loaded } = useExtra(fetchFighterAgeCurve, fighterId)
  const curve = data?.curve?.length ? data.curve : data?.all_curve || []
  const divisionLabel = data?.curve?.length ? data.division_label : 'All divisions'
  return (
    <div className={cn('flex flex-col rounded-xl border border-border p-2.5', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Win rate by age</span>
        {data?.current_age != null && <span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground">Age {Math.floor(data.current_age)}</span>}
      </div>
      {loaded && (!data || !curve.length || !data.ages.length) ? (
        <p className="flex flex-1 items-center justify-center py-8 text-[12px] text-muted-foreground">No age data</p>
      ) : data ? (
        <AgeCurve curve={curve} ages={data.ages} currentAge={data.current_age} divisionLabel={divisionLabel} fighterLabel={fighterLabel} />
      ) : <div className="min-h-[250px]" />}
    </div>
  )
}

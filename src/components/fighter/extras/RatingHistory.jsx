// Glicko trajectory: the rating going into each bout and what each bout did to it.
import { useMemo, useState } from 'react'
import RatingTrajectory from '../../viz/RatingTrajectory'
import { fetchFighterRatingHistory } from '../../../lib/fighterExtrasApi'
import { cn, formatDate } from '../../../lib/utils'
import { useExtra } from './useExtra'

const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`)

export default function RatingHistory({ fighterId, className }) {
  const { data, loaded } = useExtra(fetchFighterRatingHistory, fighterId)
  const [dim, setDim] = useState('pts')
  const fights = useMemo(() => data?.fights || [], [data])
  const label = data?.dims.find((d) => d.key === dim)?.label || 'Rating'

  const points = useMemo(() => fights.map((f) => ({
    id: f.fight_id,
    label: f.date.slice(0, 4),
    rating: f.pre[dim],
    delta: f.delta ? f.delta[dim] : null,
    result: f.result,
    title: `${f.result} vs ${f.opponent_name || 'Unknown'}`,
    sub: [formatDate(f.date), f.event].filter(Boolean).join(' · '),
    rows: [
      ['Going in', f.pre[dim] == null ? '—' : f.pre[dim].toFixed(1)],
      ['Change', f.delta ? signed(f.delta[dim]) : 'Next fight'],
      ['Opponent going in', f.opp_pre?.[dim] == null ? '—' : f.opp_pre[dim].toFixed(1)],
    ],
  })), [fights, dim])

  const last = fights[fights.length - 1]
  const best = fights.reduce((b, f) => (f.pre[dim] != null && (b == null || f.pre[dim] > b) ? f.pre[dim] : b), null)

  return (
    <div className={cn('flex flex-col rounded-xl border border-border p-2.5', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Rating history</span>
        {data && (
          <select
            value={dim}
            onChange={(e) => setDim(e.target.value)}
            aria-label="Rating dimension"
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-foreground"
          >
            {data.dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        )}
      </div>
      {loaded && points.length < 2 && (
        <p className="flex flex-1 items-center justify-center py-8 text-[12px] text-muted-foreground">Not enough rated fights yet</p>
      )}
      {points.length >= 2 && (
        <>
          <div className="mb-2 flex gap-4">
            <div>
              <div className="text-lg font-extrabold leading-none">{last?.pre[dim]?.toFixed(1) ?? '—'}</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label} · last fight</div>
            </div>
            <div>
              <div className="text-lg font-extrabold leading-none">{best?.toFixed(1) ?? '—'}</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Peak</div>
            </div>
          </div>
          <RatingTrajectory points={points} />
        </>
      )}
    </div>
  )
}

// Both fighters on a dark stage, full figure, with the event top-left (if given), `corner` top-right
// and the names (a WINNER tab over the winner's) along the bottom. Shared by the best-of
// panels; it takes whatever height the panel leaves it.
import { cn } from '../../lib/utils'
import FighterImage from '../sports/FighterImage'
import { shortDate } from '../officials/lib'
import { splitEvent } from './fight'

export default function FightStage({ red, blue, winner, eventName, date, corner, className }) {
  const [series, matchup] = splitEvent(eventName)
  const fighter = (x, key) => (
    <div className="relative min-w-0 flex-1">
      <FighterImage fighter={x} fit="contain" pose={key === 'blue' ? 'right' : undefined}
        className="absolute inset-0 flex items-end justify-center" imgClassName="h-full w-full object-contain object-bottom" />
    </div>
  )
  const name = (x, key) => (
    <span className={cn('flex min-w-0 flex-col gap-1', key === 'blue' ? 'items-end text-right' : 'items-start')}>
      {winner === key && (
        <span className="rounded bg-emerald-600 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-white">Winner</span>
      )}
      <span className={cn('font-display text-[16px] font-extrabold uppercase italic leading-[1.05] tracking-tight',
        winner && winner !== key && 'text-white/55')}>{x.name}</span>
    </span>
  )
  return (
    <div className={cn('relative min-h-[150px] flex-1 overflow-hidden rounded-lg bg-ink text-white', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_115%,rgba(210,10,10,0.4),transparent_65%)]" />
      <div className={cn('absolute inset-x-2 bottom-0 flex gap-1', eventName ? 'top-14' : 'top-3')}>
        {fighter(red, 'red')}
        {fighter(blue, 'blue')}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink via-ink/80 to-transparent" />
      <div className="absolute inset-x-3 top-2.5 flex items-start justify-between gap-2">
        <div className={cn('min-w-0', !eventName && 'invisible')}>
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/60">{series}</div>
          {matchup && <div className="text-[12.5px] font-extrabold leading-tight text-white">{matchup}</div>}
          {date && <div className="mt-0.5 text-[10.5px] font-semibold tabular-nums text-white/55">{shortDate(date)}</div>}
        </div>
        {corner && <div className="shrink-0 text-right">{corner}</div>}
      </div>
      <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
        {name(red, 'red')}
        {name(blue, 'blue')}
      </div>
    </div>
  )
}

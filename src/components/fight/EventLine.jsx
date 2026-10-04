// What the bout is and where it is, in the breadcrumb row next to the section tabs
// rather than in the left rail: it identifies the page, and on a short viewport the
// rail's vertical space is better spent on the fight itself.
import { formatDate } from '../../lib/utils'
import WeightClassBadge from '../WeightClassBadge'

export default function EventLine({ event, weightClass, scheduledRounds }) {
  if (!event && !weightClass) return null
  return (
    <div className="mr-1 hidden min-w-0 items-center gap-2 border-r border-border pr-3 lg:flex">
      <WeightClassBadge weightClass={weightClass} />
      {scheduledRounds && (
        <span className="shrink-0 rounded-md border bg-background px-1.5 py-px text-[10.5px] font-bold">
          {scheduledRounds} rounds
        </span>
      )}
      {event && (
        <>
          <span className="truncate text-[12.5px] font-extrabold tracking-tight">{event.name}</span>
          <span className="shrink-0 whitespace-nowrap text-[10.5px] text-muted-foreground">
            {formatDate(event.date)}
            {event.location ? ` · ${event.location}` : ''}
          </span>
        </>
      )}
    </div>
  )
}

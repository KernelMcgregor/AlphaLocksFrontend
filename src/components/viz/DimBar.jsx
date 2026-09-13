import { cn } from '../../lib/utils'
import { ordinal } from '../../lib/fighterAnalytics'

// One skill dimension as a percentile track. Striking is amber, grappling indigo —
// the two groups are read as groups, so they get one hue each rather than a
// per-dimension palette.
export default function DimBar({ dim }) {
  return (
    <div className="flex min-h-0 items-center gap-2.5">
      <span className="w-[136px] shrink-0 truncate text-[11.5px] font-medium leading-tight text-foreground/80">{dim.label}</span>
      {/* min-w guards the track from collapsing to a dot in narrow columns */}
      <div className="h-[7px] min-w-[60px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all duration-500', dim.group === 'striking' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-500')} style={{ width: `${dim.value}%` }} />
      </div>
      {/* w-10 fits a 3-digit ordinal ("100th"); w-8 clipped it */}
      <span className="w-10 shrink-0 text-right text-xs font-extrabold tabular-nums text-foreground">{ordinal(dim.value)}</span>
    </div>
  )
}

import { cn } from '../../lib/utils'
import { ordinal } from '../../lib/fighterAnalytics'

// Chip row for the best/worst dimensions that deriveProfile already computes.
export default function SkillCallout({ label, dims, cls }) {
  return (
    <div>
      <div className={cn('mb-1 text-[9px] font-bold uppercase tracking-wide', cls)}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {dims.map((d) => (
          <span key={d.key} className="inline-flex items-baseline gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10.5px]">
            <span className="font-medium text-foreground/80">{d.short}</span>
            <span className="font-extrabold tabular-nums text-foreground">{ordinal(d.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

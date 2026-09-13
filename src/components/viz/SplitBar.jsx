import { cn } from '../../lib/utils'

// Stacked proportional bar with a legend — used for target/position/method splits.
export default function SplitBar({ title, segments, unit = '%' }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div>
      {title && <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70">{title}</div>}
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
        {total > 0 && segments.map((s) => (
          <div key={s.label} className={cn('h-full transition-all duration-500', s.cls)} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', s.cls)} />
            <span className="text-[10.5px] text-muted-foreground">{s.label}</span>
            <span className="text-[10.5px] font-extrabold tabular-nums text-foreground">{s.value}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

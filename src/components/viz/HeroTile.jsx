import { cn } from '../../lib/utils'

// Larger headline tile — one KPI, centred, with an optional icon and sub-line.
export default function HeroTile({ icon: Icon, label, value, sub, accent = 'text-foreground' }) {
  return (
    // Three fixed bands — value, label, sub — rather than a centred stack. A
    // tile with no sub-line still reserves its row, so a row of tiles has its
    // numbers and labels on the same baselines instead of each tile centring
    // its own content and drifting against its neighbours.
    <div className="flex h-full min-w-0 flex-col items-center overflow-hidden rounded-xl border bg-gradient-to-b from-muted/60 to-muted/20 px-1.5 py-2 text-center">
      <div className={cn(
        'flex flex-1 items-center justify-center text-xl font-extrabold leading-none tabular-nums',
        accent,
      )}>
        <span className="w-full truncate">{value}</span>
      </div>
      <div className="mt-1.5 flex h-[11px] w-full min-w-0 items-center justify-center gap-1 text-muted-foreground">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        <span className="truncate text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      {/* Reserved whether or not this tile has a sub-line. */}
      <div className="mt-1 h-[12px] w-full truncate text-[9.5px] leading-[12px] text-muted-foreground">{sub}</div>
    </div>
  )
}

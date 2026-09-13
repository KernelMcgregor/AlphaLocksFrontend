import { Tip } from '../ui/tip'
import { cn } from '../../lib/utils'

// Fights-per-year column chart. Hover gives the year's W/L split, and the window
// slides by translating the full row rather than swapping its contents, so each bar
// visibly travels to its new slot.
export default function ActivityBars({ activity, oppData, start = 0, size = 6 }) {
  const max = Math.max(1, ...activity.map((a) => a.count))
  const n = activity.length
  const win = Math.min(size, n) || 1
  return (
    <div className="overflow-hidden">
      <div
        className="flex h-[76px] items-end"
        style={{
          width: `${(n / win) * 100}%`,
          transform: `translateX(-${(start / n) * 100}%)`,
          transition: 'transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)',
        }}
      >
        {activity.map((a) => (
          <Tip
            key={a.year}
              className="flex shrink-0 flex-col items-center gap-1 px-1"
            style={{ width: `${100 / n}%` }}
            content={
              <>
                <div className="text-[11.5px] font-bold leading-tight">{a.year} · {a.count} {a.count === 1 ? 'fight' : 'fights'}</div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                  <span className="font-bold text-emerald-600">{a.wins}W</span>
                  <span className="font-bold text-rose-600">{a.losses}L</span>
                </div>
                <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
                  {a.opponents.map((o, oi) => (
                    <div key={`${o.oppId}-${oi}`} className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', o.draw ? 'bg-slate-400' : o.win ? 'bg-emerald-500' : 'bg-rose-500')} />
                      <span className="text-[10.5px] leading-tight">{oppData?.[String(o.oppId)]?.name || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              </>
            }
          >
            <span className="text-[10px] font-extrabold tabular-nums text-foreground">{a.count}</span>
            <div className="w-full cursor-default rounded-t-sm bg-blue-600 transition-colors duration-200 hover:bg-blue-500" style={{ height: `${Math.max(4, (a.count / max) * 40)}px` }} />
            <span className="text-[9px] font-semibold text-muted-foreground">{a.year}</span>
          </Tip>
        ))}
      </div>
    </div>
  )
}

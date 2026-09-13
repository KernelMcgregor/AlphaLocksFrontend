import { Tip } from '../ui/tip'
import { cn, formatDate } from '../../lib/utils'

// Last-N W/L chips, most recent first. Hover names the opponent.
export default function FormStrip({ results, oppData, eventMap }) {
  return (
    // Centred: with ten chips in a half-width column the row very nearly fills,
    // and anything shorter left a conspicuous gap on the right.
    <div className="flex flex-wrap justify-center gap-1">
      {results.map((r) => {
        const opp = oppData?.[String(r.oppId)]
        const eventName = eventMap?.[String(r.eventId)]
        return (
          <Tip
            key={r.id}
            content={
              <>
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', r.draw ? 'bg-slate-400' : r.win ? 'bg-emerald-500' : 'bg-rose-500')} />
                  <span className="text-[11.5px] font-bold leading-tight">
                    {r.draw ? 'Draw' : r.win ? 'Win' : 'Loss'} vs {opp?.name || 'Unknown'}
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-muted-foreground">
                  {r.method}{r.round ? ` · R${r.round}` : ''}{r.date ? ` · ${formatDate(r.date)}` : ''}
                </div>
                {eventName && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{eventName}</div>}
              </>
            }
          >
            <div
              className={cn(
                'flex h-6 w-6 cursor-default items-center justify-center rounded-md text-[10.5px] font-extrabold text-white transition-transform hover:scale-110',
                r.draw ? 'bg-slate-400' : r.win ? 'bg-emerald-500' : 'bg-rose-500'
              )}
            >
              {r.draw ? 'D' : r.win ? 'W' : 'L'}
            </div>
          </Tip>
        )
      })}
    </div>
  )
}

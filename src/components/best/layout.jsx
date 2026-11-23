// The best-of tabs' shared shape: a side panel for the picked row beside a ranked table,
// stacked below lg with the panel on top (as on the Officials page).
import { cn } from '../../lib/utils'
import { ScrollArea } from '../ui/scroll-area'

export function Split({ panel, children }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 lg:overflow-hidden">
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[316px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        {panel || <div />}
        {children}
      </div>
    </div>
  )
}

// A ranked, clickable table. `grid` is the row's grid class (header and rows share it).
export function RankTable({ grid, minW, head, rows, rowKey, selected, onSelect, renderRow, empty, footer }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn(grid, minW, 'shrink-0 border-b border-border bg-muted px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground')}>
        {head}
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="!pr-0">
        <div className={minW}>
          {rows.length
            ? rows.map((r, i) => (
              <button
                key={rowKey(r)}
                type="button"
                onClick={() => onSelect(rowKey(r))}
                className={cn(
                  grid,
                  'h-12 w-full border-b border-border/70 px-3 text-left transition-colors last:border-b-0',
                  rowKey(r) === selected ? 'bg-primary/[0.05] shadow-[inset_3px_0_0_var(--color-primary)]' : 'hover:bg-muted/50',
                )}
              >
                {renderRow(r, i)}
              </button>
            ))
            : <p className="py-10 text-center text-[12px] text-muted-foreground">{empty}</p>}
          {footer}
        </div>
      </ScrollArea>
    </div>
  )
}

export const Rank = ({ n }) => (
  <span className="text-center font-display text-[18px] font-extrabold italic leading-none tabular-nums text-muted-foreground/70">{n}</span>
)

// Small layout pieces shared by the fight pages.
import { Info } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tip } from '../ui/tip'
import { CORNERS, fullName } from './corners'

// A two-column block where the same mark is repeated per corner, so the reader
// compares across rather than reading two unrelated panels.
export function CornerColumns({ red, blue, children, className, aside }) {
  return (
    <div className={cn('grid gap-3 lg:grid-cols-2', className)}>
      {[[CORNERS[0], red], [CORNERS[1], blue]].map(([corner, fighter]) => (
        <div key={corner.key} className="flex min-w-0 flex-col rounded-lg border border-border p-3">
          <div className="mb-2 flex shrink-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corner.css }} />
            <span className="truncate text-[12px] font-extrabold">{fullName(fighter)}</span>
            {aside && <span className="ml-auto shrink-0">{aside(corner.key)}</span>}
          </div>
          {children(corner.key)}
        </div>
      ))}
    </div>
  )
}

export function Empty({ children }) {
  return <p className="py-6 text-center text-[11.5px] text-muted-foreground">{children}</p>
}

// Column header for a corner: a colour dot plus the name, so the column reads as
// that fighter without the numbers under it having to be painted red or blue.
export function CornerHead({ css, name }) {
  return (
    <span className="flex min-w-0 items-center justify-center gap-1 normal-case">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: css }} />
      <span className="truncate">{name}</span>
    </span>
  )
}

// The bordered sub-box every section is built from: a bold title, an optional
// explainer behind an info icon, a muted note, and anything right-aligned.
export function Box({ title, tip, note, right, children, className }) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-border p-3', className)}>
      {(title || right) && (
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          {title && <span className="text-[13px] font-extrabold tracking-tight">{title}</span>}
          {tip && (
            <Tip content={<span className="text-[11px]">{tip}</span>}>
              <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
            </Tip>
          )}
          {note && <span className="text-[10.5px] text-muted-foreground">{note}</span>}
          {right && <span className="ml-auto">{right}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

// The two corners' names with their colour dots, for a box header's right side.
export function CornerLegend({ red, blue }) {
  return (
    <span className="flex items-center gap-3 text-[9.5px] font-semibold text-muted-foreground">
      {[[CORNERS[0], red], [CORNERS[1], blue]].map(([c, f]) => (
        <span key={c.key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: c.css }} />{f.last_name}
        </span>
      ))}
    </span>
  )
}

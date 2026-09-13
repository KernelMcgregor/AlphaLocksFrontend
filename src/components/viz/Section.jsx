import { cn } from '../../lib/utils'

// One titled sub-box in the scrolling column.
export default function Section({ id, title, note, children, className, register }) {
  return (
    // No card of its own — sections are separated by a rule (applied by the
    // parent to every section after the first) rather than boxed individually.
    <section
      ref={(el) => register(id, el)}
      className={cn('flex shrink-0 flex-col', className)}
    >
      <div className="mb-3 flex shrink-0 items-baseline gap-2.5">
        <h2 className="text-[17px] font-extrabold tracking-tight">{title}</h2>
        {note && <span className="text-[11.5px] text-muted-foreground">{note}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

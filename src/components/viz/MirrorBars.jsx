import { cn } from '../../lib/utils'

// Two halves of one measure, back to back. Shared domain across both halves —
// that comparability is the entire point of a mirror.
//
// The profile page reads the halves as "they strike" / "they're hit"; the fight
// page reads them as the two corners. `leftLabel`/`rightLabel` name the halves so
// the mark does not assume one reading.
export default function MirrorBars({
  title, rows, mode,
  leftLabel = 'They strike', rightLabel = "They're hit",
  // Callers that already encode the two sides by colour (the fight page's red and
  // blue corners) pass their own; the default is the viz pair.
  leftClass = 'bg-viz-1', rightClass = 'bg-viz-2',
}) {
  const pm = mode === 'pm'
  const vals = rows.flatMap((r) => [pm ? r.selfPm : r.self, pm ? r.oppPm : r.opp]).filter((v) => v != null)
  const domain = Math.max(...vals, 0.01) * 1.05
  const fmt = (v) => (v == null ? '—' : pm ? v.toFixed(2) : `${Math.round(v)}%`)

  return (
    <div>
      <div className="mb-2 grid grid-cols-[1fr_78px_1fr] items-baseline gap-1.5">
        <span className="text-right text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{leftLabel}</span>
        <span className="text-center text-[10px] font-bold uppercase tracking-wide text-foreground/70">{title}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{rightLabel}</span>
      </div>
      <div className="flex flex-col gap-[6px]">
        {rows.map((r) => {
          const a = pm ? r.selfPm : r.self
          const b = pm ? r.oppPm : r.opp
          return (
              <div key={r.label} className="grid grid-cols-[1fr_78px_1fr] items-center gap-1.5">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[9.5px] tabular-nums text-muted-foreground">{fmt(a)}</span>
                  <div className={cn('h-[18px] rounded-l-[4px]', leftClass)} style={{ width: `${((a ?? 0) / domain) * 100}%` }} />
                </div>
                <span className="text-center text-[10.5px] text-foreground/80">{r.label}</span>
                <div className="flex items-center gap-1">
                  <div className={cn('h-[18px] rounded-r-[4px]', rightClass)} style={{ width: `${((b ?? 0) / domain) * 100}%` }} />
                  <span className="text-[9.5px] tabular-nums text-muted-foreground">{fmt(b)}</span>
                </div>
              </div>
          )
        })}
      </div>
    </div>
  )
}

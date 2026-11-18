// Career stats as percentiles within the fighter's division (Baseball Savant style).
import PercentileBars from '../../viz/PercentileBars'
import { clock, cn } from '../../../lib/utils'

const GROUP_CLS = { striking: 'text-amber-600', grappling: 'text-indigo-600', outcomes: 'text-foreground/70' }

function formatStat(r) {
  const v = r.value
  if (v == null) return '—'
  if (r.format === 'pct') return `${Math.round(v * 100)}%`
  if (r.format === 'clock') return clock(v)
  if (r.format === 'signed') return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
  return v.toFixed(2)
}

// `data`/`loaded` come from the page (it also puts the division in the section note).
export default function FighterPercentiles({ data, loaded, className }) {
  if (!loaded) return <div className={cn('min-h-[200px]', className)} />
  if (!data) return <p className={cn('text-sm text-muted-foreground', className)}>No career statistics for this fighter.</p>
  return (
    <div className={cn('grid gap-3 xl:grid-cols-3', className)}>
      {data.groups.map((g) => (
        <div key={g.key} className="rounded-xl border border-border p-3">
          <div className="mb-2 border-b pb-1">
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', GROUP_CLS[g.key])}>{g.label}</span>
          </div>
          <PercentileBars rows={g.stats} formatValue={formatStat} />
        </div>
      ))}
    </div>
  )
}

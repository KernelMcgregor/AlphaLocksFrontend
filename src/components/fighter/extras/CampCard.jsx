// The fighter's camp and the teammates training there.
import { Link } from 'react-router-dom'
import CountryFlag from '../../CountryFlag'
import FighterImage from '../../sports/FighterImage'
import { cn, formatRecord } from '../../../lib/utils'

export function TeammateRow({ f }) {
  return (
    <Link to={`/ufc/fighters/${f.id}`} className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/50">
      <FighterImage fighter={{ id: f.id, has_image: f.has_image }} loading="lazy" className="h-8 w-8 shrink-0 rounded-full bg-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <CountryFlag countryCode={f.country_code} />
          <span className={cn('truncate text-[12.5px] font-bold leading-tight', !f.active && 'text-muted-foreground')}>{f.name}</span>
        </div>
        <div className="truncate text-[10.5px] text-muted-foreground">
          <span className="tabular-nums">{formatRecord(f.wins, f.losses, f.draws || undefined)}</span>
          {f.division_label ? ` · ${f.division_label}` : ''}
        </div>
      </div>
      {f.rank != null && f.rank <= 15 && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-foreground">#{f.rank}</span>
      )}
    </Link>
  )
}

export default function CampCard({ data, className }) {
  if (!data?.camp) return null
  const { camp, teammates, teammate_count: total, other_camps: others } = data
  return (
    <div className={cn('rounded-xl border border-border p-3', className)}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-[19px] font-extrabold uppercase italic leading-none tracking-tight">
          {camp.name}
        </span>
        {total > teammates.length && (
          <span className="text-[11px] font-semibold text-muted-foreground">{total + 1} fighters</span>
        )}
      </div>
      {others?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {others.map((c) => (
            <span key={c.id} className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{c.name}</span>
          ))}
        </div>
      )}
      {teammates.length ? (
        <div className="grid gap-0.5 sm:grid-cols-2 xl:grid-cols-3">
          {teammates.map((f) => <TeammateRow key={f.id} f={f} />)}
        </div>
      ) : <p className="text-[12px] text-muted-foreground">No other UFC fighters on record</p>}
    </div>
  )
}

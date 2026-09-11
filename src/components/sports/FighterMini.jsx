// Compact fighter card for hover tooltips: headshot, flag + name, nickname,
// record and divisional rank. Every field is optional — callers assemble it from
// whatever lookup they have (rankings payload, fighter fetch, similarity rows).
import CountryFlag from '../CountryFlag'

export default function FighterMini({ f }) {
  if (!f) return <span className="text-[11px] text-muted-foreground">Unknown fighter</span>
  const initials = f.name ? f.name.split(' ').map((n) => n[0]).join('') : '?'
  return (
    <div className="flex items-center gap-2.5">
      {f.image_url ? (
        <img src={f.image_url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover object-top" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CountryFlag countryCode={f.country_code} />
          <span className="truncate text-[12.5px] font-bold leading-tight">{f.name}</span>
        </div>
        {f.nickname && (
          <div className="truncate text-[10px] italic leading-tight text-muted-foreground">"{f.nickname}"</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {f.record && (
            <span className="rounded border bg-muted/50 px-1 py-px text-[10px] font-bold tabular-nums">{f.record}</span>
          )}
          {f.rank != null && (
            <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1 py-px text-[10px] font-bold text-blue-600">
              #{f.rank}{f.division ? ` ${f.division}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

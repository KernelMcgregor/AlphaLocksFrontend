// One bout in the Upcoming dashboard's right rail.
//
// The two corners face each other: headshots at the outer edges, each name turned
// in beside its own portrait, and the model's split in the middle where "vs" would
// be. There is no frame or backdrop on the portrait: UFC's images are transparent
// PNGs, so the fighter is cropped by the card's own bottom edge and appears to rise
// out of it. The card therefore has no bottom padding — that edge is the crop line.
//
// Clicking selects the fight into the featured preview; it does not navigate.
import FighterImage from './FighterImage'
import { cn, formatOdds } from '../../lib/utils'
import { formatEdge, fullName, summarizeFight, weightLabel } from '../../lib/upcomingSummary'

function Headshot({ fighter }) {
  return (
    <div className="relative h-[62px] w-[40px] self-end">
      <FighterImage
        fighter={fighter}
        alt={fullName(fighter)}
        className="absolute inset-x-[-6px] bottom-0 top-0"
        // Cover + top keeps the head and shoulders; the card clips the rest.
        imgClassName="object-cover object-top"
      />
    </div>
  )
}

function Name({ fighter, odds, isPick, align }) {
  return (
    <div className={cn('min-w-0 pb-2.5', align === 'right' && 'text-right')}>
      <div className="truncate text-[9px] leading-none text-muted-foreground">{fighter?.first_name}</div>
      <div
        className={cn(
          'mt-0.5 truncate text-[13px] font-extrabold tracking-tight',
          isPick ? 'text-foreground' : 'text-muted-foreground',
        )}
        title={fullName(fighter)}
      >
        {fighter?.last_name || 'TBA'}
      </div>
      <div className="mt-px text-[10px] tabular-nums text-muted-foreground">
        {odds != null ? formatOdds(odds) : '—'}
      </div>
    </div>
  )
}

export default function FightRailCard({ fight, selected, onSelect }) {
  const r = fight.red_fighter
  const b = fight.blue_fighter
  const s = summarizeFight(fight)
  const redPct = s.redProb != null ? Math.round(s.redProb * 100) : null
  const bluePct = redPct != null ? 100 - redPct : null

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative block w-full overflow-hidden border-b border-border px-3 pt-2 text-left transition-colors',
        selected ? 'bg-primary/5 shadow-[inset_3px_0_0_var(--color-primary)]' : 'hover:bg-accent/60',
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {weightLabel(fight.weight_class)}
        </span>
        {s.title && (
          <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1 text-[8.5px] font-extrabold uppercase tracking-wide text-amber-600">
            Title
          </span>
        )}
        {s.arbRoi != null && (
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 text-[8.5px] font-extrabold uppercase tracking-wide text-emerald-600">
            Arb
          </span>
        )}
        {s.edge != null && (
          <span
            className={cn(
              'ml-auto text-[9.5px] font-bold tabular-nums',
              s.edge >= 3 ? 'text-emerald-600' : s.edge <= -3 ? 'text-rose-600' : 'text-muted-foreground',
            )}
            title="Model probability minus exchange consensus, in points"
          >
            {formatEdge(s.edge)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[40px_minmax(0,1fr)_46px_minmax(0,1fr)_40px] items-end gap-1.5">
        <Headshot fighter={r} />
        <Name fighter={r} odds={s.picked?.red_odds} isPick={s.pickedRed !== false} />

        <div className="pb-2.5 text-center">
          <div className="text-[7.5px] font-extrabold uppercase tracking-widest text-muted-foreground/60">Model</div>
          {redPct != null ? (
            <>
              <div className="mt-0.5 flex items-baseline justify-center gap-0.5 tabular-nums">
                <span className="text-[13px] font-extrabold text-corner-red">{redPct}</span>
                <span className="text-[9px] text-muted-foreground/50">/</span>
                <span className="text-[13px] font-extrabold text-corner-blue">{bluePct}</span>
              </div>
              <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-muted">
                <span className="block bg-corner-red" style={{ width: `${redPct}%` }} />
                <span className="block flex-1 bg-corner-blue" />
              </div>
            </>
          ) : (
            <div className="mt-1 text-[9px] leading-tight text-muted-foreground">No pick</div>
          )}
        </div>

        <Name fighter={b} odds={s.picked?.blue_odds} isPick={s.pickedRed !== true} align="right" />
        <Headshot fighter={b} />
      </div>
    </button>
  )
}

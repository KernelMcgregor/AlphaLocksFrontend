// Both corners in one box: portraits side by side over a shared tale of the tape.
// Used by the upcoming-fight page as the matchup and by the completed-fight page as
// the result (`result` set: the winner is marked, the loser knocked back, records
// shown as they stood going in).
import { Link } from 'react-router-dom'
import { cn, formatDate } from '../../lib/utils'
import { divisionAbbr } from '../../lib/upcomingSummary'
import FighterImage from '../sports/FighterImage'
import WavingFlag from '../sports/WavingFlag'
import { CORNERS, fullName, val } from './corners'

// Heights are stored as `6' 2"`, reach as `74.0"`. Parsed to inches only so the
// tale of the tape can mark which side holds the physical edge.
function heightInches(v) {
  const m = /(\d+)\s*'\s*(\d+)?/.exec(val(v) || '')
  return m ? Number(m[1]) * 12 + Number(m[2] || 0) : null
}

function reachInches(v) {
  const n = parseFloat(val(v) || '')
  return Number.isFinite(n) ? n : null
}

const recordText = (f) => `${f.wins}-${f.losses}${f.draws > 0 ? `-${f.draws}` : ''}`

// One half of the matchup box: the portrait over its waving flag, then the name
// and record beneath.
//
// The portrait sits flush with the card's top and outer edge — no padding, no
// frame — so the image gets every pixel of a narrow rail. Corner identity is the
// 2px rule under the image instead of a box around it, which is the only edge
// that was doing any work once the two halves met in the middle.
//
// The scale-up is the zoom: UFC's portraits are full-body, which at 150px wide
// left the head the size of a pea. Scaling from the top crops the shins and feet
// — the standard crop for a fight card — and never touches the face, which is
// the one part of the portrait that has to survive.
function CornerHalf({ fighter, corner, ctx, rounded, weightClass, outcome, record, rank }) {
  const glicko = ctx?.glicko
  // A ranking-history key ('w_flyweight', 'light_heavyweight') read as a weight class.
  const division = rank
    ? divisionAbbr(rank.weight_class.replace(/^w_/, "women's ").replace('_', ' '))
    : divisionAbbr(weightClass)
  // The context's rank is TODAY's published standing. A result card passes the rank
  // the fighter held going in instead (`rank`, null when unranked) and never falls back.
  const shownRank = rank !== undefined ? rank?.rank ?? null : glicko?.division_rank ?? null
  const lost = outcome === 'loss'
  return (
    <Link
      to={`/ufc/fighters/${fighter.id}`}
      className="group flex min-w-0 flex-1 flex-col"
    >
      <div
        className={cn(
          'relative h-[156px] overflow-hidden border-b-[3px]',
          corner.border, corner.tint, rounded,
        )}
      >
        <WavingFlag countryCode={fighter.country_code} />
        <FighterImage
          fighter={fighter}
          fit="contain"
          alt={fullName(fighter)}
          className={cn('relative z-10 h-full w-full', lost && 'opacity-55 grayscale')}
          imgClassName="origin-top scale-[1.2]"
        />
        {outcome === 'win' && (
          <span className="absolute left-1.5 top-1.5 z-20 rounded-md bg-emerald-600 px-1.5 py-px text-[9.5px] font-black uppercase tracking-wider text-white shadow-sm">
            Win
          </span>
        )}
      </div>

      {/* Names wrap rather than truncate — "Christian Leroy Duncan" cut off
          mid-word in a column this narrow, and a second line costs less than a
          lost name. The flag is on the portrait now, so it is not repeated here. */}
      <div className={cn(
        'mt-1.5 px-1.5 text-center text-[12.5px] font-extrabold leading-tight group-hover:underline',
        lost && 'text-foreground/60',
      )}>
        {fullName(fighter)}
      </div>
      {fighter.nickname && (
        <div className="truncate px-1.5 text-center text-[10px] italic leading-tight text-muted-foreground">
          &quot;{fighter.nickname}&quot;
        </div>
      )}

      <div className="mt-1 flex flex-wrap justify-center gap-1 px-1.5">
        <span
          className="rounded-md border bg-background px-1.5 py-px text-[10.5px] font-bold tabular-nums"
          title={record ? 'Record going into this fight' : undefined}
        >
          {record || recordText(fighter)}
        </span>
        {shownRank != null && (
          <span
            className="rounded-md px-1.5 py-px text-[10.5px] font-bold text-white"
            style={{ background: corner.css }}
            title={rank ? `Rank going into this fight, of ${rank.total_ranked}` : weightClass || undefined}
          >
            #{shownRank}{division ? ` ${division}` : ''}
          </span>
        )}
      </div>
    </Link>
  )
}

// Rows past the core five only appear when the viewport is tall enough to hold
// them without squeezing the odds boards — height-based media queries rather than
// width, because what runs out on a laptop is vertical space. Spelled out as
// literal class strings: Tailwind scans source text, so a variant assembled at
// runtime would never make it into the stylesheet.
const TIER_CLASS = {
  0: 'flex',
  1: 'hidden [@media(min-height:820px)]:flex',
  2: 'hidden [@media(min-height:900px)]:flex',
  3: 'hidden [@media(min-height:1000px)]:flex',
}

// "35.00" — the UFC.com bio figure, which unlike reach carries no inch mark.
const legReach = (v) => {
  const n = parseFloat(val(v) || '')
  return Number.isFinite(n) ? `${n.toFixed(1)}"` : null
}

// Share of wins that came by stoppage — the one number that says whether a
// fighter's record was built by finishing people.
const finishPct = (f) => {
  const wins = f?.total_wins
  if (!wins) return null
  const rate = (f.ko_rate || 0) + (f.sub_rate || 0)
  return `${Math.round(rate * 100)}%`
}

/**
 * @param result  completed fights only: { winnerSide: 'red'|'blue'|null, records: { red, blue },
 *                ranks: { red, blue } } — ranks are the ranking-history rows going in.
 *                Age, layoff and finish rate are today's values, so a result card drops them.
 */
export default function MatchupCard({ red, blue, ctx, weightClass, result }) {
  const past = Boolean(result)
  const rows = [
    !past && { label: 'Age', r: ctx?.red?.age, b: ctx?.blue?.age, fmt: (v) => `${v} yrs` },
    { label: 'Height', r: val(red.height), b: val(blue.height), cmp: heightInches },
    // reach already carries its own inch mark ('74.0"')
    { label: 'Reach', r: val(red.reach), b: val(blue.reach), cmp: reachInches },
    { label: 'Leg', r: legReach(red.leg_reach), b: legReach(blue.leg_reach), cmp: reachInches, tier: 1 },
    { label: 'Stance', r: val(red.stance), b: val(blue.stance) },
    { label: 'Style', r: val(red.fighting_style), b: val(blue.fighting_style), tier: 1 },
    { label: 'Team', r: val(red.trains_at), b: val(blue.trains_at), tier: 2 },
    !past && {
      label: 'Layoff',
      r: ctx?.red?.days_since_last_fight,
      b: ctx?.blue?.days_since_last_fight,
      fmt: (v) => `${v} days`,
      tier: 2,
    },
    { label: 'From', r: val(red.birthplace), b: val(blue.birthplace) },
    !past && {
      label: 'Finish',
      r: finishPct(ctx?.red?.finish_rates),
      b: finishPct(ctx?.blue?.finish_rates),
      tier: 3,
    },
    {
      label: 'Debut',
      r: red.octagon_debut ? formatDate(red.octagon_debut) : null,
      b: blue.octagon_debut ? formatDate(blue.octagon_debut) : null,
      tier: 3,
    },
    // A row where neither side has a value drops out rather than showing dashes.
  ].filter((row) => row && (row.r != null || row.b != null))

  const outcome = (side) => {
    if (!result?.winnerSide) return null
    return result.winnerSide === side ? 'win' : 'loss'
  }

  return (
    // No padding at the top: the portraits are the card's top edge, corner to
    // corner. `overflow-hidden` lets them square off against the card's radius.
    <div className="shrink-0 overflow-hidden rounded-lg border border-border pb-2.5">
      {/* The two portraits meet in the middle with no gap, so the red and blue
          rules butt against each other and read as one matchup rather than two
          cards. VS sits on the seam rather than between them. */}
      <div className="relative flex items-stretch">
        <CornerHalf fighter={red} corner={CORNERS[0]} ctx={ctx?.red} rounded="rounded-tl-md" weightClass={weightClass}
          outcome={outcome('red')} record={result?.records?.red} rank={result ? result.ranks?.red ?? null : undefined} />
        <CornerHalf fighter={blue} corner={CORNERS[1]} ctx={ctx?.blue} rounded="rounded-tr-md" weightClass={weightClass}
          outcome={outcome('blue')} record={result?.records?.blue} rank={result ? result.ranks?.blue ?? null : undefined} />
        <span className="pointer-events-none absolute left-1/2 top-[78px] z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-muted-foreground shadow-sm">
          vs
        </span>
      </div>

      {rows.length > 0 && (
        <div className="mx-2.5 mt-2 border-t pt-1.5">
          {rows.map((row) => {
            // Only height and reach get an advantage mark: they have an
            // unambiguous direction. Younger is not strictly better and stance
            // has no ordering, so those rows stay neutral.
            const a = row.cmp ? row.cmp(row.r) : null
            const b = row.cmp ? row.cmp(row.b) : null
            const edge = a != null && b != null && a !== b ? (a > b ? 'r' : 'b') : null
            const side = (v, which) => {
              const text = v == null ? '—' : (row.fmt ? row.fmt(v) : v)
              return (
                <span
                  // Hometowns and gyms run long; truncate with the full value on hover
                  // rather than wrapping, which would make row heights uneven.
                  title={typeof text === 'string' && text !== '—' ? text : undefined}
                  className={cn(
                    'min-w-0 flex-1 truncate text-[11px] font-semibold tabular-nums',
                    which === 'r' ? 'text-right' : 'text-left',
                    edge === which ? 'font-extrabold' : 'text-foreground/75',
                  )}
                  style={edge === which ? { color: which === 'r' ? CORNERS[0].css : CORNERS[1].css } : undefined}
                >
                  {text}
                </span>
              )
            }
            return (
              <div key={row.label} className={cn('items-center gap-1.5 py-[1px]', TIER_CLASS[row.tier || 0])}>
                {side(row.r, 'r')}
                <span className="w-[46px] shrink-0 text-center text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </span>
                {side(row.b, 'b')}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

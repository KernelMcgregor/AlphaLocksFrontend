// One upcoming bout as a card: a square portrait per fighter with that fighter's own
// numbers stacked directly beneath it, and only the head-to-head figures in the middle.
//
// Every number here belongs to exactly one fighter — record, price, model probability —
// so each one sits under the face it describes rather than in a shared column the reader
// has to re-associate. That removes the need for the split bars this card used to carry:
// a bar was only ever encoding "86 vs 14", which two numbers state outright and in less
// vertical space.
//
// Sized to fit three across a wide monitor, which is what drives the rest: square
// portraits (a tall flank wasted width once three cards shared a row), a narrow centre
// rail, and last names on the pick line.
import { Link } from 'react-router-dom'
import FighterImage from './FighterImage'
import WavingFlag from './WavingFlag'
import { cn, formatOdds } from '../../lib/utils'

const fullName = (f) => (f ? `${f.first_name} ${f.last_name}`.trim() : 'TBA')

const METHODS = [
  { key: 'ko_prob', label: 'KO', match: 'KO/TKO', text: 'text-red-500' },
  { key: 'sub_prob', label: 'Sub', match: 'Submission', text: 'text-purple-500' },
  { key: 'dec_prob', label: 'Dec', match: 'Decision', text: 'text-slate-500' },
]

/**
 * One fighter: square portrait over a waving flag, then their name, record, price and
 * model number.
 *
 * The portrait is sized by height (`h-full w-auto`) rather than fitted inside the box.
 * UFC's images are transparent-background PNGs at roughly 2:3, so height-filling makes the
 * fighter reach the full square while the flag shows through on either side of the body —
 * fitting them instead would letterbox the figure and leave dead space above the head.
 */
function FighterSide({ fighter, side, odds, modelProb, isPick }) {
  const isRed = side === 'red'
  return (
    <Link
      to={`/ufc/fighters/${fighter.id}`}
      onClick={(e) => e.stopPropagation()}
      className="group flex min-w-0 flex-col items-center"
    >
      {/* The black frame is the requested box; the corner is carried by the 3px rule
          along the bottom, so red/blue still reads without tinting the portrait. */}
      <div
        className={cn(
          'relative aspect-square w-full max-w-[124px] overflow-hidden rounded-md',
          'border-2 border-b-[3px] border-neutral-900',
          isRed ? 'border-b-corner-red bg-corner-red/10' : 'border-b-corner-blue bg-corner-blue/10',
        )}
      >
        <WavingFlag countryCode={fighter.country_code} />
        <FighterImage
          fighter={fighter}
          alt={fullName(fighter)}
          className="absolute inset-0 z-10 flex items-end justify-center"
          imgClassName="h-full w-auto max-w-none object-bottom"
        />
      </div>

      <div className="mt-1.5 flex w-full items-center justify-center gap-1.5">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            isRed ? 'bg-corner-red' : 'bg-corner-blue',
          )}
        />
        <span
          className="min-w-0 truncate text-[13.5px] font-extrabold leading-tight group-hover:underline"
          title={fullName(fighter)}
        >
          {fullName(fighter)}
        </span>
      </div>

      <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px] leading-none">
        <span className="tabular-nums text-muted-foreground">
          {fighter.wins}-{fighter.losses}{fighter.draws > 0 ? `-${fighter.draws}` : ''}
        </span>
        {odds != null && (
          <span className={cn('font-bold tabular-nums', odds < 0 ? 'text-emerald-600' : 'text-foreground')}>
            {formatOdds(odds)}
          </span>
        )}
      </div>

      {modelProb != null && (
        <div
          className={cn(
            'mt-1 text-[19px] font-extrabold leading-none tabular-nums',
            // Only the side the model picked is coloured. Two coloured numbers read as a
            // pair of equal claims; one says which way it leans before you read either.
            isPick ? (isRed ? 'text-corner-red' : 'text-corner-blue') : 'text-muted-foreground/60',
          )}
        >
          {Math.round(modelProb * 100)}%
        </div>
      )}
    </Link>
  )
}

export default function UpcomingFightCard({ fight, onOpen }) {
  const r = fight.red_fighter
  const b = fight.blue_fighter
  const pred = fight.prediction
  const exch = fight.exchange
  const method = fight.method_prediction

  // Bookmaker preference order — DraftKings is the page's stated default, the rest are
  // labelled so a price is never silently attributed to the wrong book.
  const oddsArr = fight.odds || []
  const bookAbbr = { FanDuel: 'FD', Caesars: 'Cae', BetRivers: 'BR' }
  const pickedBook = ['DraftKings', 'FanDuel', 'Caesars', 'BetRivers'].find((bk) =>
    oddsArr.some((o) => o.bookmaker === bk),
  )
  const picked = pickedBook ? oddsArr.find((o) => o.bookmaker === pickedBook) : null
  const abbrTag = pickedBook && pickedBook !== 'DraftKings' ? bookAbbr[pickedBook] || pickedBook : null

  const pickedRed = pred?.predicted_winner === 'red'
  const prob = pred ? (pickedRed ? pred.red_prob : 1 - pred.red_prob) : null
  // Exchange consensus, oriented to the side the model picked so it sits directly beside
  // the model's own number. With no prediction there is no pick to orient to, so it falls
  // back to the red corner — the same corner the left-hand column shows.
  const exchProb = exch ? (pred && !pickedRed ? 1 - exch.red_prob : exch.red_prob) : null
  // Model minus market. Meaningful without a de-vig step, unlike the American prices,
  // because exchange quotes carry no vig. Null whenever either side is missing — the
  // badge below must not assume a market quote implies a prediction.
  const edge = exchProb != null && prob != null ? (prob - exchProb) * 100 : null

  return (
    <div
      onClick={onOpen}
      data-card
      className="flex cursor-pointer flex-col rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {fight.weight_class?.replace(/\s*Bout$/i, '') || 'Catchweight'}
        </span>
        {abbrTag && <span className="shrink-0 text-[9px] text-muted-foreground">{abbrTag}</span>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
        <FighterSide
          fighter={r}
          side="red"
          odds={picked?.red_odds}
          modelProb={pred ? pred.red_prob : null}
          isPick={pickedRed}
        />

        {/* Centre rail: only the figures that belong to the matchup rather than to one
            fighter — the market's price on the model's pick, and the gap between them. */}
        <div className="flex w-[74px] flex-col items-center pt-8">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">vs</span>
          {exchProb != null ? (
            <div className="mt-2 flex flex-col items-center leading-none">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Market
              </span>
              <span className="mt-1 text-[13px] font-bold tabular-nums">
                {Math.round(exchProb * 100)}%
              </span>
              {edge != null && (
                <span
                  className={cn(
                    'mt-1 rounded px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
                    edge > 2 ? 'bg-emerald-500/15 text-emerald-600' : 'text-muted-foreground',
                  )}
                  title="Model probability minus the no-vig exchange consensus, in points"
                >
                  {edge > 0 ? '+' : ''}{edge.toFixed(0)}
                </span>
              )}
            </div>
          ) : (
            <span className="mt-2 text-center text-[9px] leading-tight text-muted-foreground">
              No market
            </span>
          )}
        </div>

        <FighterSide
          fighter={b}
          side="blue"
          odds={picked?.blue_odds}
          modelProb={pred ? 1 - pred.red_prob : null}
          isPick={pred ? !pickedRed : false}
        />
      </div>

      <div className="mt-auto pt-2.5">
        {method ? (
          <div className="flex items-center justify-center gap-3 border-t border-border pt-2 text-[10.5px] leading-none">
            {METHODS.map((m) => {
              const isPredicted = m.match === method.predicted_method
              return (
                <span
                  key={m.key}
                  className={cn(
                    'tabular-nums',
                    isPredicted ? cn(m.text, 'font-bold') : 'text-muted-foreground',
                  )}
                >
                  {m.label} {Math.round((method[m.key] || 0) * 100)}%
                </span>
              )
            })}
          </div>
        ) : (
          <div className="border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
            {pred ? 'No method prediction' : 'No prediction yet'}
          </div>
        )}
      </div>
    </div>
  )
}

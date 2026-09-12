// One fight rendered as a face of the 3D ring: the two fighters split left and right —
// headshot, corner bar, name, odds — with the model's pick on a rail underneath. Only
// the front-facing card is interactive; the angled neighbours are decorative depth, so
// they drop the hover affordance and the click target.
import { Trophy } from 'lucide-react'
import CountryFlag from '../CountryFlag'
import WeightClassBadge from '../WeightClassBadge'
import FighterImage from './FighterImage'
import { cn, formatOdds } from '../../lib/utils'

function FighterSide({ fighter, corner, odds, outcome }) {
  return (
    <div
      className={cn(
        'flex h-full min-w-0 flex-1 flex-col items-center text-center',
        // A decided fight dims the loser so the card reads as a result at a glance.
        outcome === 'loss' && 'opacity-45',
      )}
    >
      {/* No plate behind the headshot: the source images are cut-outs, so a fill shows
          up as a grey box around the fighter. The portrait is the flexible element —
          the ring sizes cards off the panel, and everything below is intrinsic height,
          so this is what absorbs the difference. */}
      <FighterImage fighter={fighter} className="min-h-0 w-full flex-1 rounded-md" />

      {/* Corner bar */}
      <div className={cn('h-1 w-full shrink-0 rounded-b-sm', corner === 'red' ? 'bg-red-500' : 'bg-blue-500')} />

      <div className="mt-1.5 flex w-full shrink-0 items-center justify-center gap-1.5">
        {outcome === 'win' ? (
          <Trophy className="h-3 w-3 shrink-0 text-emerald-500" />
        ) : (
          <CountryFlag countryCode={fighter?.country_code} />
        )}
        <span className="truncate text-[13px] font-semibold leading-tight">
          {fighter?.last_name}
        </span>
      </div>
      <p className="w-full shrink-0 truncate text-[11px] leading-tight text-muted-foreground">
        {fighter?.first_name}
      </p>
      <p className="mt-1 shrink-0 font-mono text-[13px] tabular-nums">{formatOdds(odds)}</p>
    </div>
  )
}

// The API returns every bookmaker's line; the median is the closest thing to a
// consensus and shrugs off a single stale book.
function consensusOdds(oddsRows, side) {
  const values = (oddsRows || []).map((o) => o[side]).filter((v) => v != null)
  if (!values.length) return null
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2)
}

export default function FightRingCard({ fight, isActive, onClick }) {
  const { red_fighter, blue_fighter, prediction } = fight
  const redOdds = consensusOdds(fight.odds, 'red_odds')
  const blueOdds = consensusOdds(fight.odds, 'blue_odds')

  const pick = prediction?.predicted_winner || null
  const pickFighter = pick === 'red' ? red_fighter : pick === 'blue' ? blue_fighter : null
  const pickProb = prediction
    ? Math.round((prediction.red_prob > 0.5 ? prediction.red_prob : 1 - prediction.red_prob) * 100)
    : null

  // A decided fight swaps the prediction rail for the result, and grades the pick.
  const decided = !!fight.winner
  const redWon = decided && String(fight.winner.id) === String(red_fighter?.id || '')
  const pickCorrect = decided && pick ? pick === (redWon ? 'red' : 'blue') : null

  return (
    <div
      onClick={isActive ? onClick : undefined}
      role={isActive ? 'button' : undefined}
      tabIndex={isActive ? 0 : -1}
      onKeyDown={(e) => {
        if (isActive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() }
      }}
      className={cn(
        'flex h-full w-full flex-col rounded-xl border p-3 transition-shadow',
        // Receding cards stay translucent so the cards behind them read through, which
        // is where the ring gets its depth.
        isActive
          ? 'cursor-pointer border-border bg-card shadow-lg hover:shadow-xl'
          : 'border-border/50 bg-card/70',
      )}
    >
      {fight.weight_class && (
        <div className="flex shrink-0 justify-center pb-2">
          <WeightClassBadge weightClass={fight.weight_class} />
        </div>
      )}

      {/* Fighters, split left / right */}
      <div className="flex min-h-0 flex-1 items-stretch gap-3">
        <FighterSide
          fighter={red_fighter}
          corner="red"
          odds={redOdds}
          outcome={decided ? (redWon ? 'win' : 'loss') : null}
        />
        <span className="self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          vs
        </span>
        <FighterSide
          fighter={blue_fighter}
          corner="blue"
          odds={blueOdds}
          outcome={decided ? (redWon ? 'loss' : 'win') : null}
        />
      </div>

      {/* Result for a decided fight, model pick for an upcoming one */}
      <div className="mt-2 shrink-0 border-t border-border pt-2">
        {decided ? (
          <div className="flex items-baseline justify-center gap-1.5 text-xs">
            <span className="truncate font-medium uppercase tracking-wider text-muted-foreground">
              {fight.method || 'Decision'}
            </span>
            {pickCorrect !== null && (
              <span
                className={cn(
                  'shrink-0 font-semibold',
                  pickCorrect ? 'text-emerald-500' : 'text-red-500',
                )}
              >
                {pickCorrect ? 'pick hit' : 'pick miss'}
              </span>
            )}
          </div>
        ) : prediction ? (
          <div className="flex items-baseline justify-center gap-1.5 text-xs">
            <span className="uppercase tracking-widest text-muted-foreground">Pick</span>
            <span
              className={cn(
                'truncate font-semibold',
                pick === 'red' ? 'text-red-500' : 'text-blue-500',
              )}
            >
              {pickFighter?.last_name}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{pickProb}%</span>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">No prediction</p>
        )}
      </div>
    </div>
  )
}

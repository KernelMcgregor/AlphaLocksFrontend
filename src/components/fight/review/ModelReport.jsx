// The pre-fight call, graded. Judged the way the model is judged — log loss against
// the closing de-vigged market — with the hit/miss shown but not leaned on: a 55%
// pick that loses was not a bad forecast, and a 90% pick that wins says little.
import { Brain, Check, X } from 'lucide-react'
import { METHOD_LABEL } from '../../../lib/fightReview'
import { cn } from '../../../lib/utils'
import { cornerOf, CORNERS } from '../corners'
import { Box, Empty } from '../layout'

const pct = (p, d = 0) => (p == null ? '—' : `${(p * 100).toFixed(d)}%`)

function HitMark({ hit, className }) {
  const Icon = hit ? Check : X
  return (
    <span className={cn(
      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white',
      hit ? 'bg-emerald-600' : 'bg-rose-600', className,
    )}>
      <Icon className="h-3 w-3" strokeWidth={3} />
    </span>
  )
}

// Pinned in the rail under the result: the pick, whether it landed, and the one
// number that says if it beat the market.
export function RailReport({ prediction, grade, red, blue }) {
  if (!prediction) {
    return (
      <div className="shrink-0 rounded-lg border border-border p-2.5">
        <div className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">Model</div>
        <p className="mt-1 text-[11px] text-muted-foreground">No pre-fight prediction for this bout.</p>
      </div>
    )
  }
  const redProb = prediction.red_prob
  const redPct = Math.round(redProb * 100)
  const pickRed = prediction.predicted_winner === 'red'
  const pick = pickRed ? red : blue
  const edge = grade?.market_log_loss != null && grade?.log_loss != null
    ? grade.market_log_loss - grade.log_loss : null

  return (
    <div className="shrink-0 rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Picked</span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pickRed ? CORNERS[0].css : CORNERS[1].css }} />
        <span className="truncate text-[13px] font-extrabold">{pick.last_name}</span>
        {grade && <HitMark hit={grade.correct} />}
        <span className="ml-auto shrink-0 text-[17px] font-black leading-none tabular-nums">
          {pct(pickRed ? redProb : 1 - redProb)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-0.5">
        <div className="h-2 rounded-l-full" style={{ width: `${redProb * 100}%`, background: CORNERS[0].css }} />
        <div className="h-2 rounded-r-full" style={{ width: `${(1 - redProb) * 100}%`, background: CORNERS[1].css }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[9.5px] tabular-nums text-muted-foreground">
        <span>{red.last_name} {redPct}%</span>
        <span>{100 - redPct}% {blue.last_name}</span>
      </div>
      {edge != null && (
        <div className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-[10px]">
          <span className="text-muted-foreground">
            Closing market {pct(grade.market_red_prob)} {red.last_name}
          </span>
          <span className={cn('font-bold tabular-nums', edge >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {edge >= 0 ? 'Beat' : 'Trailed'} market {edge >= 0 ? '+' : ''}{edge.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  )
}

// One forecaster's column on the report card.
function ForecastColumn({ label, sub, pWinner, loss, best }) {
  return (
    <div className={cn('flex min-w-0 flex-col rounded-md border p-2', best ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/70')}>
      <span className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">{label}</span>
      <span className="text-[9.5px] text-muted-foreground">{sub}</span>
      <span className="mt-1.5 text-[22px] font-black leading-none tabular-nums">{pct(pWinner)}</span>
      <span className="text-[9.5px] text-muted-foreground">on the winner</span>
      <span className="mt-1.5 text-[11px] font-bold tabular-nums">
        {loss == null ? '—' : loss.toFixed(3)} <span className="font-normal text-muted-foreground">log loss</span>
      </span>
    </div>
  )
}

export function ModelGrade({ grade, red, blue }) {
  if (!grade) return <Box title="Report card"><Empty>No pre-fight prediction to grade, or no winner to grade it on.</Empty></Box>
  const w = grade.winner_side
  const onWinner = (pRed) => (pRed == null ? null : w === 'red' ? pRed : 1 - pRed)
  const winner = w === 'red' ? red : blue
  const hasMarket = grade.market_red_prob != null
  const showPure = grade.model_prob != null && Math.abs(grade.model_prob - grade.red_prob) > 0.005
  const losses = [grade.log_loss, showPure ? grade.model_log_loss : null, grade.market_log_loss].filter((l) => l != null)
  const best = losses.length > 1 ? Math.min(...losses) : null
  const edge = grade.market_log_loss != null ? grade.market_log_loss - grade.log_loss : null
  const m = grade.method

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Box
        title="Report card"
        tip="Log loss is −ln(probability given to what happened): 0.69 is a coin flip, lower is better. It rewards confidence when right and punishes it when wrong, which is what the model is tuned on. The market is the closing consensus across sportsbooks with the vig removed."
        note={<>
          <span className="font-semibold text-foreground">{winner.last_name}</span> won ·{' '}
          {grade.correct ? 'the model had them' : 'the model had the other side'}
        </>}
      >
        <div className={cn('grid gap-2', [true, showPure, hasMarket].filter(Boolean).length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          <ForecastColumn label="Model" sub="as published" pWinner={onWinner(grade.red_prob)} loss={grade.log_loss}
            best={best != null && grade.log_loss === best} />
          {showPure && (
            <ForecastColumn label="Model only" sub="no odds in inputs" pWinner={onWinner(grade.model_prob)} loss={grade.model_log_loss}
              best={best != null && grade.model_log_loss === best} />
          )}
          {hasMarket && (
            <ForecastColumn label="Market" sub="closing, no vig" pWinner={onWinner(grade.market_red_prob)} loss={grade.market_log_loss}
              best={best != null && grade.market_log_loss === best} />
          )}
        </div>
        {edge != null && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {edge >= 0
              ? <>The model put more weight on the winner than the market did: <span className="font-bold text-emerald-600">{edge.toFixed(3)}</span> better on log loss.</>
              : <>The market was closer: the model trailed it by <span className="font-bold text-rose-600">{(-edge).toFixed(3)}</span> on log loss.</>}
          </p>
        )}
      </Box>

      <Box title="Method" tip="The method model's three-way read before the fight, and how much it gave to the way it actually ended. The winner-and-method cell is the six-way grid (e.g. red by KO).">
        {m ? (
          <>
            <div className="flex items-center gap-2">
              <HitMark hit={m.rank === 1} />
              <span className="text-[12.5px] font-extrabold">Ended by {METHOD_LABEL[m.actual]}</span>
              <span className="text-[11px] text-muted-foreground">
                — model&apos;s {m.rank === 1 ? 'likeliest' : m.rank === 2 ? 'second choice' : 'least likely'} outcome
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border/70 p-2">
                <div className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">{METHOD_LABEL[m.actual]}</div>
                <div className="mt-1 text-[22px] font-black leading-none tabular-nums">{pct(m.prob)}</div>
                <div className="text-[9.5px] text-muted-foreground">model, either fighter</div>
              </div>
              <div className="rounded-md border border-border/70 p-2">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: cornerOf(w).css }} />
                  {winner.last_name} by {METHOD_LABEL[m.actual]}
                </div>
                <div className="mt-1 text-[22px] font-black leading-none tabular-nums">{pct(m.joint_prob)}</div>
                <div className="text-[9.5px] text-muted-foreground">model, exact outcome</div>
              </div>
            </div>
            {m.predicted && m.predicted !== m.actual && (
              <p className="mt-2 text-[11px] text-muted-foreground">Predicted {METHOD_LABEL[m.predicted]}.</p>
            )}
          </>
        ) : (
          <Empty>No method prediction for this bout.</Empty>
        )}
      </Box>
    </div>
  )
}

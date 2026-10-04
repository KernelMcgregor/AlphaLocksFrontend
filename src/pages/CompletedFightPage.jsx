// src/pages/CompletedFightPage.jsx
//
// The review of a fight that has happened. Same shell as the upcoming-fight page — a
// static rail on the left (the result, the model's call, the preview we wrote), one
// scrolling column of sections on the right, scrollspy tabs in the breadcrumb row — so
// a fight reads as the same product before and after. The sections re-frame it as
// what was expected, what happened, and why:
//
//   Deserve to win   the fight replayed 10,000 times from its own round stats
//   Model            the pre-fight call graded on log loss against the closing market
//   Rounds & judges  each round's cards, the round model and the round's numbers
//   Expectations     output against the walk-forward expected-stats projection, and
//                    the preview's keys to victory marked won or lost
//   Stats            the full board, per round, plus advanced per-fighter numbers
//   Market           line movement, exchange curves, the props that cashed
//
// The post-fight blocks come from fight.review (app/services/ufc/fight_review.py);
// everything else is the same fight payload the upcoming page reads. `review` here is
// lib/matchup.loadReview: the pre-fight context, both fight logs, the market curves.
// Upcoming fights are NOT handled here — see UpcomingFightPage.
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import EventLine from '../components/fight/EventLine'
import MatchupCard from '../components/fight/MatchupCard'
import PreviewBox from '../components/fight/PreviewBox'
import { CORNERS } from '../components/fight/corners'
import { Box, CornerLegend } from '../components/fight/layout'
import DeserveToWin from '../components/fight/review/DeserveToWin'
import { Expectations, KeysRevisited } from '../components/fight/review/Expectations'
import MarketRecap from '../components/fight/review/MarketRecap'
import { ModelGrade, RailReport } from '../components/fight/review/ModelReport'
import RankMovement from '../components/fight/review/RankMovement'
import RoundsAndJudges from '../components/fight/review/RoundsAndJudges'
import StatsBoard from '../components/fight/review/StatsBoard'
import HeaderActions from '../components/layout/HeaderActions'
import { SlideTabs } from '../components/ui/slide-tabs'
import ProbabilityWaterfall from '../components/viz/ProbabilityWaterfall'
import Section from '../components/viz/Section'
import { useScrollSpy } from '../components/viz/hooks'
import { buildProjectedKeys } from '../lib/fightProjection'
import {
  expectationRows, gradeKeys, methodClass, METHOD_LABEL, recordGoingIn, settledProps,
  splitStats, winnerSide,
} from '../lib/fightReview'
import { buildShapWaterfall } from '../lib/shapWaterfall'

// The result itself, under the portraits: how and when it ended, and who refereed.
function ResultBox({ fight, side }) {
  const cls = methodClass(fight.method)
  const winner = side === 'red' ? fight.red_fighter : side === 'blue' ? fight.blue_fighter : null
  const method = (fight.method || '').trim()
  // A decision's `details` is the judges' totals, which the Rounds section shows in
  // full; a finish's is the finishing sequence, which belongs here.
  const details = cls !== 'dec' ? fight.details?.trim() : null
  return (
    <div className="shrink-0 rounded-lg border border-border p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">Result</span>
        {fight.finish_round && (
          <span className="text-[10.5px] font-bold tabular-nums text-muted-foreground">
            R{fight.finish_round}{fight.finish_time ? ` · ${fight.finish_time}` : ''}
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        {winner && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: side === 'red' ? CORNERS[0].css : CORNERS[1].css }} />}
        <span className="truncate text-[14px] font-black">
          {winner ? `${winner.last_name} by ${cls ? METHOD_LABEL[cls] : method}` : method || 'No result'}
        </span>
      </div>
      {(cls === 'dec' || (method && cls && !method.startsWith(METHOD_LABEL[cls]))) && (
        <div className="text-[10.5px] text-muted-foreground">{method}</div>
      )}
      {details && <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{details}</div>}
      {fight.referee && <div className="mt-1 text-[10px] text-muted-foreground">Referee: {fight.referee.trim()}</div>}
    </div>
  )
}

export default function CompletedFightPage({ fight, review }) {
  const navigate = useNavigate()
  const { red_fighter: red, blue_fighter: blue, prediction, shap_values, preview, event } = fight
  const post = fight.review || {}
  const ctx = review?.ctx || null
  const side = winnerSide(fight)
  const cls = methodClass(fight.method)

  const { total, rounds } = useMemo(() => splitStats(fight), [fight])
  const records = useMemo(() => ({
    red: recordGoingIn(red, review?.fights?.red, fight),
    blue: recordGoingIn(blue, review?.fights?.blue, fight),
  }), [red, blue, review, fight])

  const xsRows = useMemo(() => expectationRows(fight.expected_stats, total), [fight.expected_stats, total])
  // The preview page's keys, rebuilt from the same projection and the pre-fight Glicko
  // snapshot. Career rates are left out: today's numbers include this fight.
  const keys = useMemo(
    () => gradeKeys(buildProjectedKeys(fight.expected_stats, ctx, null), total),
    [fight.expected_stats, ctx, total],
  )
  const waterfall = useMemo(() => buildShapWaterfall(prediction, shap_values), [prediction, shap_values])
  const props = useMemo(() => settledProps(fight.prop_markets, fight, side), [fight, side])

  const dtw = post.deserve_to_win
  const sections = useMemo(() => [
    dtw && { key: 'deserve', label: 'Deserve to Win' },
    prediction && { key: 'model', label: 'Model' },
    { key: 'rounds', label: post.scorecards ? 'Rounds & Judges' : 'Rounds' },
    (xsRows || keys.length > 0) && { key: 'expected', label: 'Expectations' },
    { key: 'stats', label: 'Stats' },
    { key: 'market', label: 'Market' },
  ].filter(Boolean), [dtw, prediction, post.scorecards, xsRows, keys])

  const { scrollRef, register, active, scrollTo } = useScrollSpy(sections)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden lg:flex-row">
      <HeaderActions>
        <EventLine event={event} weightClass={fight.weight_class} scheduledRounds={ctx?.scheduled_rounds} />
        <SlideTabs size="sm" value={active} onChange={scrollTo} tabs={sections} />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </HeaderActions>

      {/* ---------------- LEFT: the result ---------------- */}
      <div className="flex min-h-0 shrink-0 flex-col gap-3 overflow-y-auto lg:w-[320px] lg:overflow-hidden">
        <MatchupCard red={red} blue={blue} ctx={ctx} weightClass={fight.weight_class}
          result={{
            winnerSide: side,
            records,
            ranks: { red: post.rankings?.red?.before ?? null, blue: post.rankings?.blue?.before ?? null },
          }} />
        <ResultBox fight={fight} side={side} />
        <RankMovement rankings={post.rankings} red={red} blue={blue} />
        <RailReport prediction={prediction} grade={post.grade} red={red} blue={blue} />
        {preview?.content && <PreviewBox preview={preview} fightId={fight.id} title="Our preview" className="lg:flex-1" />}
      </div>

      {/* ---------------- RIGHT: one scroll, many sections ---------------- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-5">

            {dtw && (
              <Section
                id="deserve"
                title="Deserve to Win"
                note={cls === 'dec' || !cls ? 'Who the performance favoured, whatever the cards said' : 'Who was winning when it ended'}
                register={register}
              >
                <DeserveToWin dtw={dtw} fight={fight} side={side} finished={cls === 'ko' || cls === 'sub'} />
              </Section>
            )}

            {prediction && (
              <Section id="model" title="Model" note="The pre-fight call, graded against the closing market" register={register}>
                <ModelGrade grade={post.grade} red={red} blue={blue} />
                {waterfall && (() => {
                  const fav = waterfall.side === 'red' ? red : blue
                  const close = post.line?.red_close_prob
                  const favMarket = close == null ? null : waterfall.side === 'red' ? close : 1 - close
                  return (
                    <Box
                      className="mt-3"
                      title="Why the model saw it that way"
                      note={`${fav.last_name} win probability, before the fight`}
                      tip="Each row is one family of model inputs and how many points it moved the favourite's win probability. Base rate carries the division-wide starting point and every input not listed. The market mark is the closing consensus with the vig removed."
                      right={<CornerLegend red={red} blue={blue} />}
                    >
                      <ProbabilityWaterfall
                        base={0.5}
                        steps={waterfall.steps}
                        final={waterfall.final}
                        market={favMarket}
                        calibration={waterfall.calibration}
                        redName={red.last_name}
                        blueName={blue.last_name}
                        side={waterfall.side}
                      />
                    </Box>
                  )
                })()}
              </Section>
            )}

            <Section
              id="rounds"
              title={post.scorecards ? 'Rounds & Judges' : 'Rounds'}
              note={post.scorecards ? 'Every round as the judges, the model and the numbers saw it' : 'Every round as the model and the numbers saw it'}
              register={register}
            >
              <RoundsAndJudges fight={fight} rounds={rounds} total={total} scorecards={post.scorecards} dtw={dtw} />
            </Section>

            {(xsRows || keys.length > 0) && (
              <Section id="expected" title="Against Expectations" note="Output against the pre-fight projection" register={register}>
                <Expectations rows={xsRows} red={red} blue={blue} />
                {keys.length > 0 && <div className="mt-3"><KeysRevisited keys={keys} red={red} blue={blue} /></div>}
              </Section>
            )}

            <Section id="stats" title="Stats" note="The whole fight or any round" register={register}>
              <StatsBoard fight={fight} total={total} rounds={rounds} />
            </Section>

            <Section id="market" title="Market" note="Where the money went, and what cashed" register={register}>
              <MarketRecap fight={fight} line={post.line} side={side} props={props} marketHistory={review?.marketHistory} />
            </Section>

          </div>
        </div>
      </div>
    </div>
  )
}

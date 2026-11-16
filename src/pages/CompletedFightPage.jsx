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
import { useMemo } from 'react'
import FightCover, { FightBar, ModelCall, PreviewTeaser } from '../components/hero/FightHero'
import { ScrollArea } from '../components/ui/scroll-area'
import { usePastCover } from '../hooks/usePastCover'
import { familyName, familyOf } from '../lib/styleTraits'
import StyleMatchup from '../components/fight/StyleMatchup'
import MatchupCard from '../components/fight/MatchupCard'
import { Box, CornerLegend } from '../components/fight/layout'
import DeserveToWin from '../components/fight/review/DeserveToWin'
import { Expectations, KeysRevisited } from '../components/fight/review/Expectations'
import MarketRecap from '../components/fight/review/MarketRecap'
import { ModelGrade } from '../components/fight/review/ModelReport'
import RankMovement from '../components/fight/review/RankMovement'
import RoundsAndJudges from '../components/fight/review/RoundsAndJudges'
import StatsBoard from '../components/fight/review/StatsBoard'
import ProbabilityWaterfall from '../components/viz/ProbabilityWaterfall'
import Section from '../components/viz/Section'
import { useScrollSpy } from '../components/viz/hooks'
import { buildProjectedKeys } from '../lib/fightProjection'
import {
  expectationRows, gradeKeys, methodClass, recordGoingIn, settledProps,
  splitStats, winnerSide,
} from '../lib/fightReview'
import { buildShapWaterfall } from '../lib/shapWaterfall'
import { useStyleDetail } from '../hooks/useStyleDetail'

export default function CompletedFightPage({ fight, review }) {
  const { red_fighter: red, blue_fighter: blue, prediction, shap_values, preview } = fight
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
  const redStyle = useStyleDetail(red?.id)
  const blueStyle = useStyleDetail(blue?.id)
  const styles = { red: redStyle.detail, blue: blueStyle.detail }
  const hasStyles = Boolean(styles.red || styles.blue)
  const sections = useMemo(() => [
    dtw && { key: 'deserve', label: 'Deserve to Win' },
    prediction && { key: 'model', label: 'Model' },
    { key: 'rounds', label: post.scorecards ? 'Rounds & Judges' : 'Rounds' },
    (xsRows || keys.length > 0) && { key: 'expected', label: 'Expectations' },
    hasStyles && { key: 'styles', label: 'Styles' },
    { key: 'stats', label: 'Stats' },
    { key: 'market', label: 'Market' },
  ].filter(Boolean), [dtw, prediction, post.scorecards, xsRows, keys, hasStyles])

  // 64: the slim bar pinned over the top of the scroll once the cover has gone.
  const { scrollRef, register, active, scrollTo } = useScrollSpy(sections, 64)
  const [coverRef, pastCover] = usePastCover(scrollRef)

  const goingIn = {
    side,
    records,
    ranks: { red: post.rankings?.red?.before ?? null, blue: post.rankings?.blue?.before ?? null },
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea viewportRef={scrollRef} className="min-h-0 flex-1" viewportClassName="relative">
        <FightBar show={pastCover} fight={fight} tabs={sections} active={active} onTab={scrollTo} />
        <FightCover coverRef={coverRef} fight={fight} ctx={ctx} styles={styles} result={goingIn} rounds={ctx?.scheduled_rounds}
          cols="lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]"
          tape={<MatchupCard red={red} blue={blue} ctx={ctx} weightClass={fight.weight_class} tapeOnly bare
              families={{ red: familyOf(styles.red) || familyName(fight.styles?.red), blue: familyOf(styles.blue) || familyName(fight.styles?.blue) }}
            result={{ winnerSide: side, records, ranks: goingIn.ranks }} />}>
          <ModelCall prediction={prediction} methodPrediction={fight.method_prediction} red={red} blue={blue}
            hit={post.grade ? post.grade.correct : null} />
          <RankMovement rankings={post.rankings} red={red} blue={blue} />
          {preview?.content && <PreviewTeaser fight={fight} />}
        </FightCover>
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-5 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-5">

            {dtw && (
              <Section
                id="deserve"
                title="Deserve to Win"
                register={register}
              >
                <DeserveToWin dtw={dtw} fight={fight} side={side} finished={cls === 'ko' || cls === 'sub'} />
              </Section>
            )}

            {prediction && (
              <Section id="model" title="Model" register={register}>
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
              register={register}
            >
              <RoundsAndJudges fight={fight} rounds={rounds} total={total} scorecards={post.scorecards} dtw={dtw} />
            </Section>

            {(xsRows || keys.length > 0) && (
              <Section id="expected" title="Against Expectations" register={register}>
                <Expectations rows={xsRows} red={red} blue={blue} />
                {keys.length > 0 && <div className="mt-3"><KeysRevisited keys={keys} red={red} blue={blue} /></div>}
              </Section>
            )}

            {hasStyles && (
              <Section id="styles" title="Styles" register={register}>
                <StyleMatchup red={red} blue={blue} styles={styles} />
              </Section>
            )}

            <Section id="stats" title="Stats" register={register}>
              <StatsBoard fight={fight} total={total} rounds={rounds} />
            </Section>

            <Section id="market" title="Market" register={register}>
              <MarketRecap fight={fight} line={post.line} side={side} props={props} marketHistory={review?.marketHistory} />
            </Section>

          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

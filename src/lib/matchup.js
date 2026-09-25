import {
  fetchEvents,
  fetchFightContext,
  fetchFighterCareerStats,
  fetchFighterFights,
  fetchFighterStats,
  fetchMarketHistory,
} from './api'

/**
 * Everything the page shows beyond the fight payload itself, fetched in parallel:
 * the matchup context, both fighters' logs, event names for the form strip, and the
 * prediction-market curves. FightDetailPage awaits this before mounting
 * UpcomingFightPage, so the page opens complete rather than section by section.
 * Each call degrades to an empty value rather than failing — a debuting fighter
 * legitimately has no career-stats row, and most fights have no exchange coverage.
 */
export function loadMatchup(fight) {
  const redId = fight.red_fighter?.id
  const blueId = fight.blue_fighter?.id
  const forFighter = (id) => (id
    ? Promise.all([
      fetchFighterFights(id).catch(() => []),
      fetchFighterStats(id).catch(() => []),
      fetchFighterCareerStats(id).catch(() => null),
    ]).then(([fights, stats, careerStats]) => ({ fights, stats, careerStats }))
    : Promise.resolve(null))

  return Promise.all([
    fetchFightContext(fight.id).catch(() => null),
    forFighter(redId),
    forFighter(blueId),
    // 500 is the endpoint cap and matches what UFCPage/FighterProfilePage ask
    // for, so this shares their cache entry rather than adding a request.
    fetchEvents({ limit: 500 }).catch(() => []),
    fetchMarketHistory(fight.id).then((r) => r?.series || {}).catch(() => ({})),
  ]).then(([ctx, redData, blueData, events, marketHistory]) => ({
    ctx,
    perFighter: { [redId]: redData, [blueId]: blueData },
    eventMap: Object.fromEntries((events || []).map((e) => [String(e.id), e.name])),
    marketHistory,
  }))
}

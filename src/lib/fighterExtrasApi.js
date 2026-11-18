// Fighter-page extras (routers/ufc_fighter_extras.py): divisional percentiles, Glicko
// rating history, age curve, situational splits, camps and the rankings time-lapse.
// All ids come back as strings — fighter ids run past 2**53.
import { cachedRequest } from './api'

const LONG = 30 * 60 * 1000

export const fetchFighterPercentiles = (id) => cachedRequest(`/ufc/fighters/${id}/percentiles`, LONG)
export const fetchFighterRatingHistory = (id) => cachedRequest(`/ufc/fighters/${id}/rating-history`, LONG)
export const fetchFighterAgeCurve = (id) => cachedRequest(`/ufc/fighters/${id}/age-curve`, LONG)
export const fetchFighterSplits = (id) => cachedRequest(`/ufc/fighters/${id}/splits`, LONG)
export const fetchFighterCamp = (id) => cachedRequest(`/ufc/fighters/${id}/camp`, LONG)
export const fetchRankingsTimelapse = ({ division = 'lightweight', step = 'quarter', top = 15 } = {}) =>
  cachedRequest(`/ufc/rankings/timelapse?division=${division}&step=${step}&top=${top}`, LONG)

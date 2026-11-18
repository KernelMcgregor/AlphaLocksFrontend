// Markets track endpoints: sportsbook line history, crowd vs model vs market, model CLV.
import { cachedRequest } from './api'

// Per-book moneyline curves up to the bout's cutoff, the Pinnacle / soft-book split with
// Pinnacle's max stake, and dated markers. Line snapshots land every couple of hours.
export const bookHistoryPath = (id) => `/ufc/fights/${id}/book-history`
export const fetchBookHistory = (id) => cachedRequest(bookHistoryPath(id), 20 * 60 * 1000)
// Fan scorecards (mmadecisions), the model and the vig-free close for one fight.
export const fetchFightCrowd = (id) => cachedRequest(`/ufc/fights/${id}/crowd`, 30 * 60 * 1000)

export const modelClvPath = ({ source = 'all', start, end, minEdge } = {}) => {
  const q = new URLSearchParams({ source })
  if (start) q.set('start', start)
  if (end) q.set('end', end)
  if (minEdge) q.set('min_edge', String(minEdge))
  return `/ufc/model/clv?${q}`
}
// Built from the backtest ledger, which only changes after an event.
export const fetchModelClv = (params) => cachedRequest(modelClvPath(params), 30 * 60 * 1000)

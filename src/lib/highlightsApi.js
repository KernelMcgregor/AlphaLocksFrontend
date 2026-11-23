// The best-of lists: most exciting fights and cards, bonuses and robberies. Rebuilt
// after events, so a long cache is safe.
import { cachedRequest } from './api'

const TTL = 30 * 60 * 1000

export const fetchRobberies = (window = 'all', limit = 1000) =>
  cachedRequest(`/ufc/robberies?window=${encodeURIComponent(window)}&limit=${limit}`, TTL)
export const fetchExcitingFights = (window = 'all', limit = 100, q = '') =>
  cachedRequest(`/ufc/exciting/fights?window=${encodeURIComponent(window)}&limit=${limit}&q=${encodeURIComponent(q)}`, TTL)
export const fetchExcitingCards = (window = 'all', scope = 'main', limit = 100) =>
  cachedRequest(`/ufc/exciting/cards?window=${encodeURIComponent(window)}&scope=${scope}&limit=${limit}`, TTL)
export const fetchEventBonuses = (eventId) => cachedRequest(`/ufc/events/${eventId}/bonuses`, TTL)

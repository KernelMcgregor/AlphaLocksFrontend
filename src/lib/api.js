const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Simple in-memory cache with TTL
const cache = new Map()
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) { cache.delete(key); return null }
  return entry.data
}

function setCache(key, data, ttl = DEFAULT_TTL) {
  cache.set(key, { data, expiry: Date.now() + ttl })
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || 'Request failed')
  }
  return res.json()
}

async function cachedRequest(path, ttl = DEFAULT_TTL) {
  const cached = getCached(path)
  if (cached) return cached
  const data = await request(path)
  setCache(path, data, ttl)
  return data
}

// Headshot URL for an <img src>. Points at our own endpoint, which serves the cached
// copy when scripts/cache_fighter_images.py has stored one and redirects to UFC.com
// otherwise — so it is correct whether or not the cache has been filled, and it keeps
// working when a UFC `?itok=` signature expires. Returns null when the fighter has no
// portrait at all, so callers can render their initials fallback.
export const fighterImageUrl = (fighter) => {
  if (!fighter?.id) return fighter?.image_url || null
  if (!fighter.image_url && !fighter.has_image) return null
  return `${BASE_URL}/ufc/fighters/${fighter.id}/image`
}

// UFC
export const fetchFighters = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return cachedRequest(`/ufc/fighters${qs ? `?${qs}` : ''}`)
}
export const fetchFighter = (id) => cachedRequest(`/ufc/fighters/${id}`)
export const fetchFighterFights = (id) => cachedRequest(`/ufc/fighters/${id}/fights`)
export const fetchFighterStats = (id) => cachedRequest(`/ufc/fighters/${id}/stats`)
export const fetchFighterCareerStats = (id) => cachedRequest(`/ufc/fighters/${id}/career-stats`)
// Divisional rank after each bout. Served from the precomputed ufc_ranking_history
// table; returns [] until `python -m app.services.ufc.rank_history_backfill` has run.
export const fetchFighterRankHistory = (id) =>
  cachedRequest(`/ufc/fighters/${id}/rank-history`, 30 * 60 * 1000)
// Stylistic comparables. Recomputed only after an event, so a long TTL is safe.
export const fetchSimilarFighters = (id, { limit = 10, sameDivisionOnly = false } = {}) =>
  cachedRequest(
    `/ufc/fighters/${id}/similar?limit=${limit}&same_division_only=${sameDivisionOnly}`,
    30 * 60 * 1000,
  )
export const fetchAllCareerStats = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return cachedRequest(`/ufc/career-stats${qs ? `?${qs}` : ''}`, 30 * 60 * 1000)
}


export const fetchEvents = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return cachedRequest(`/ufc/events${qs ? `?${qs}` : ''}`)
}
export const fetchEventDetail = (id) => cachedRequest(`/ufc/events/${id}/detail`)

export const fetchFights = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return cachedRequest(`/ufc/fights${qs ? `?${qs}` : ''}`)
}
export const fetchFight = (id) => cachedRequest(`/ufc/fights/${id}`)

// Predictions & Model
export const fetchEventPredictions = (eventId) => cachedRequest(`/ufc/events/${eventId}/predictions`)
export const fetchEventMethodPredictions = (eventId) => cachedRequest(`/ufc/events/${eventId}/method-predictions`)
export const fetchModelMetrics = () => cachedRequest('/ufc/model/metrics')
export const fetchMethodModelMetrics = () => cachedRequest('/ufc/method/metrics')
export const fetchUpcomingEvents = () => cachedRequest('/ufc/upcoming', 10 * 60 * 1000) // 10 min

export const fetchRankings = () => cachedRequest('/ufc/rankings', 30 * 60 * 1000) // 30 min
export const fetchArbitrage = () => cachedRequest('/ufc/arbitrage')
export const fetchPicks = () => cachedRequest('/ufc/picks')

// Admin
export const fetchAdminStats = () => request('/admin/stats')

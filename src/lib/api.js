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

// UFC
export const fetchFighters = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return cachedRequest(`/ufc/fighters${qs ? `?${qs}` : ''}`)
}
export const fetchFighter = (id) => cachedRequest(`/ufc/fighters/${id}`)
export const fetchFighterFights = (id) => cachedRequest(`/ufc/fighters/${id}/fights`)

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

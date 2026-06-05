const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

// UFC
export const fetchFighters = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/ufc/fighters${qs ? `?${qs}` : ''}`)
}
export const fetchFighter = (id) => request(`/ufc/fighters/${id}`)
export const fetchFighterFights = (id) => request(`/ufc/fighters/${id}/fights`)

export const fetchEvents = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/ufc/events${qs ? `?${qs}` : ''}`)
}
export const fetchEventDetail = (id) => request(`/ufc/events/${id}/detail`)

export const fetchFights = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/ufc/fights${qs ? `?${qs}` : ''}`)
}
export const fetchFight = (id) => request(`/ufc/fights/${id}`)

// Predictions & Model
export const fetchEventPredictions = (eventId) => request(`/ufc/events/${eventId}/predictions`)
export const fetchEventMethodPredictions = (eventId) => request(`/ufc/events/${eventId}/method-predictions`)
export const fetchModelMetrics = () => request('/ufc/model/metrics')
export const fetchMethodModelMetrics = () => request('/ufc/method/metrics')
export const fetchUpcomingEvents = () => request('/ufc/upcoming')

export const fetchArbitrage = () => request('/ufc/arbitrage')

// Admin
export const fetchAdminStats = () => request('/admin/stats')

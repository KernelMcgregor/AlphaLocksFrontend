// Officials (judges & referees). Everything here is rebuilt after events, so a long
// cache is safe; the assigned-officials lookup for an upcoming fight changes when an
// admin enters a panel, so it gets a short one.
import { cachedRequest } from './api'

const TTL = 30 * 60 * 1000

export const fetchJudges = () => cachedRequest('/ufc/judges', TTL)
export const fetchJudgeAgreement = () => cachedRequest('/ufc/judges/agreement', TTL)
export const fetchJudge = (id) => cachedRequest(`/ufc/judges/${id}`, TTL)
export const fetchJudgeMisses = (id, limit = 25) => cachedRequest(`/ufc/judges/${id}/rounds?limit=${limit}`, TTL)
export const fetchDecisionRounds = (fightId) => cachedRequest(`/ufc/decisions/${fightId}/rounds`, TTL)
export const fetchRoundStats = (fightId) => cachedRequest(`/ufc/fights/${fightId}/round-stats`, TTL)
export const fetchReferees = () => cachedRequest('/ufc/referees', TTL)
export const fetchReferee = (id) => cachedRequest(`/ufc/referees/${id}`, TTL)
export const fetchRefereeByName = (name) => cachedRequest(`/ufc/referees/by-name?name=${encodeURIComponent(name)}`, TTL)
export const fetchFightOfficials = (fightId) => cachedRequest(`/ufc/fights/${fightId}/officials`, 5 * 60 * 1000)

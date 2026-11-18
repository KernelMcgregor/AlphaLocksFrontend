// Fight-flow track endpoints (app/routers/ufc_fightflow.py). Both resolve to null when
// the server has nothing for the id (404), so a caller can just not render.
import { cachedRequest } from './api'

const orNull = (p) => p.catch(() => null)

// Both corners' sig. strikes per minute by round, this bout and career through it,
// against the division's per-round norm.
export const getFightPace = (fightId) => orNull(cachedRequest(`/ufc/fights/${fightId}/pace`))

// Clutch rating: late rounds and rounds after a lost one, against the fighter's own
// other rounds in the same bouts.
export const getFighterClutch = (fighterId) => orNull(cachedRequest(`/ufc/fighters/${fighterId}/clutch`))

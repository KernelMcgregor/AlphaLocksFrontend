// Glicko percentiles for both fighters, shaped for the article radar (RadarPanel).
import { useEffect, useMemo, useState } from 'react'
import { CORNERS } from '../fight/corners'
import { fetchFightContext } from '../../lib/api'
import { AXES } from '../../lib/fighterAnalytics'
import { lastName } from './fightText'

export function useRadar(fightId, red, blue) {
  const [ctx, setCtx] = useState(null)
  useEffect(() => { fetchFightContext(fightId).then(setCtx).catch(() => setCtx({})) }, [fightId])
  return useMemo(() => {
    if (!ctx) return null
    return CORNERS.map((c, i) => {
      const dims = ctx[c.key]?.glicko?.dimensions
      if (!dims || !AXES.some((a) => dims[a.key]?.percentile != null)) return null
      return { key: c.key, label: lastName(i ? blue : red), color: c.css, axes: AXES.map((a) => ({ ...a, value: dims[a.key]?.percentile ?? 0 })) }
    }).filter(Boolean)
  }, [ctx, red, blue])
}

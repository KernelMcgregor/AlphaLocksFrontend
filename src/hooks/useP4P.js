import { useEffect, useState } from 'react'
import { fetchAltRankings } from '../lib/api'

// {fighterId: {rank, pool, order}} from the site's own P4P ranking (/ufc/alt-rankings/p4p,
// default weights), which covers every active fighter — the official UFC list stops at 15.
// `order` sorts men's P4P first, then women's, so one list can be ordered by it.
// fetchAltRankings is cached in memory, so every caller after the first resolves at once.
export function useP4P() {
  const [p4p, setP4P] = useState({})
  useEffect(() => {
    let live = true
    fetchAltRankings('p4p')
      .then((data) => {
        if (!live) return
        const map = {}
        ;['men', 'women'].forEach((pool, pi) => {
          for (const f of data?.pools?.[pool] || []) {
            if (f.default_rank == null) continue
            map[String(f.id)] = { rank: f.default_rank, pool, order: pi * 100000 + f.default_rank }
          }
        })
        setP4P(map)
      })
      .catch(() => {})
    return () => { live = false }
  }, [])
  return p4p
}

// Sort key: P4P order, then unranked fighters after by overall quality.
export const p4pOrder = (p4p, f) => p4p[f.id]?.order ?? Infinity
export const byP4P = (p4p) => (a, b) =>
  (p4pOrder(p4p, a) - p4pOrder(p4p, b)) || (b.quality - a.quality)

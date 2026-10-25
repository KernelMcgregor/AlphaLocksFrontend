import { useEffect, useState } from 'react'
import { fetchRankings } from '../lib/api'

// {fighterId: {rank, division, score, is_champion, display_rank}} from the rankings payload,
// for FighterMini's rank badge and the Style Map's bio card (Power, #rank).
// fetchRankings is cached in memory, so every caller after the first resolves at once.
export function useDivisionRanks() {
  const [ranks, setRanks] = useState({})
  useEffect(() => {
    let live = true
    fetchRankings()
      .then((data) => {
        if (!live) return
        const map = {}
        for (const wc of data?.weight_classes || []) {
          if (wc.key?.startsWith('p4p')) continue // divisional rank is the meaningful one
          for (const f of wc.fighters) {
            map[String(f.id)] = { rank: f.rank, division: wc.label, score: f.score, is_champion: f.is_champion, display_rank: f.display_rank }
          }
        }
        setRanks(map)
      })
      .catch(() => {})
    return () => { live = false }
  }, [])
  return ranks
}

// Corner identity shared by the fight pages (upcoming and completed).
//
// The red corner is red and the blue corner is blue. Classes are spelled out rather
// than built from a token — Tailwind scans source text, so a class assembled at runtime
// is not guaranteed to be in the stylesheet.
import { divisionAbbr } from '../../lib/upcomingSummary'

export const CORNERS = [
  { key: 'red', css: 'var(--color-corner-red)', bar: 'bg-corner-red', border: 'border-corner-red', tint: 'bg-corner-red/10' },
  { key: 'blue', css: 'var(--color-corner-blue)', bar: 'bg-corner-blue', border: 'border-corner-blue', tint: 'bg-corner-blue/10' },
]

export const cornerOf = (side) => (side === 'red' ? CORNERS[0] : CORNERS[1])

export const fullName = (f) => (f ? `${f.first_name} ${f.last_name}`.trim() : 'TBA')

// UFC.com writes "--" for a missing measurement rather than leaving it blank.
export function val(v) {
  const t = typeof v === 'string' ? v.trim() : v
  return !t || t === '--' ? null : t
}

export const impliedFromOdds = (american) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100)

// A corner's rank chip: today's published rank from the matchup context, or for a result
// card the rank held going in (`rank`, a ranking-history row; null when unranked), with the
// division it was held in.
export function cornerRank({ ctx, rank, weightClass }) {
  const rankKey = rank?.weight_class ?? ctx?.glicko_division
  const division = rankKey
    ? divisionAbbr(rankKey.replace(/^w_/, "women's ").replace('_', ' '))
    : divisionAbbr(weightClass)
  const shown = rank !== undefined ? rank?.rank ?? null : ctx?.glicko?.division_rank ?? null
  return { rank: shown, division }
}

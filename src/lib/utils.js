import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatOdds(odds) {
  if (odds == null) return '-'
  return odds > 0 ? `+${odds}` : `${odds}`
}

// Seconds as m:ss — control time, octagon time, fight length.
export function clock(seconds) {
  const t = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export function formatRecord(wins, losses, extra) {
  const base = `${wins}-${losses}`
  return extra != null ? `${base}-${extra}` : base
}

// Rank display for a rankings-board fighter: the champion wears the belt and the
// first contender is #1. Falls back to the plain rank (and #1 as champion) when the
// payload predates is_champion/display_rank, e.g. a cached copy or an older backend.
export const isChampion = (f) => f?.is_champion ?? f?.rank === 1
export const displayRank = (f) => (f?.display_rank !== undefined ? f.display_rank : f?.rank)

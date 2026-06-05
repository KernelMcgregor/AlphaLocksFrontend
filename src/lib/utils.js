import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatOdds(odds) {
  if (odds == null) return '-'
  return odds > 0 ? `+${odds}` : `${odds}`
}

export function formatRecord(wins, losses, extra) {
  const base = `${wins}-${losses}`
  return extra != null ? `${base}-${extra}` : base
}

// The best-of date window (?w=): all | last:Nm | year:YYYY.
import { useSearchParams } from 'react-router-dom'

export const ROLLING = [
  { key: 'all', label: 'All time' },
  { key: 'last:12m', label: '12 months' },
  { key: 'last:6m', label: '6 months' },
]
const FIRST_YEAR = 1993
export const YEARS = Array.from({ length: new Date().getFullYear() - FIRST_YEAR + 1 }, (_, i) => String(new Date().getFullYear() - i))

export function useWindow() {
  const [params] = useSearchParams()
  const w = params.get('w') || 'all'
  return ROLLING.some((r) => r.key === w) || /^year:\d{4}$/.test(w) ? w : 'all'
}

// Small marks shared by the best-of tabs.
import { Award, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import FighterImage from '../sports/FighterImage'

// The bonuses a bout actually got.
export function BonusMarks({ f }) {
  if (!f.fotn && !f.perf) return null
  const cls = 'inline-flex items-center gap-0.5 rounded bg-gold/15 px-1 py-px text-[9.5px] font-black uppercase tracking-wide text-gold-foreground'
  return (
    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      {f.fotn && <span className={cls}><Award className="h-3 w-3" />FOTN</span>}
      {f.perf && <span className={cls}><Zap className="h-3 w-3" />Perf</span>}
    </span>
  )
}

// A fighter's round headshot.
export const Face = ({ fighter, className }) => (
  <FighterImage fighter={fighter} loading="lazy" className={cn('shrink-0 rounded-full bg-muted ring-2 ring-card', className)} />
)

// A highlight chip, one line, in rows of FitRow.
export const Chip = ({ text }) => (
  <span className="inline-flex h-6 items-center whitespace-nowrap rounded-md bg-muted px-1.5 text-[10.5px] font-semibold">{text}</span>
)

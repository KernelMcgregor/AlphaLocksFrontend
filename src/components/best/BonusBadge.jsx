// Fight of the Night / Performance marks for the Events page. One mark per bonus: solid
// gold when UFC gave it (with a check when it's also our pick), a dashed gold "Deserved"
// when it's only our pick.
import { Award, Check, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'

const KINDS = { fotn: { icon: Award, label: 'FOTN' }, perf: { icon: Zap, label: 'Perf' } }

// state: 'both' (UFC gave it and it's our pick) | 'earned' | 'deserved'
export default function BonusBadge({ kind, state, className }) {
  if (!state) return null
  const { icon: Icon, label } = KINDS[kind]
  const solid = state !== 'deserved'
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded px-1 py-px text-[9px] font-black uppercase leading-none tracking-wide',
      solid ? 'border border-gold bg-gold text-white' : 'border border-dashed border-gold text-gold-foreground',
      className,
    )}>
      <Icon className="h-2.5 w-2.5" />{state === 'deserved' ? `Deserved ${label}` : label}
      {state === 'both' && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
    </span>
  )
}

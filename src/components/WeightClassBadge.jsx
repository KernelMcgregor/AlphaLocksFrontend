import { Badge } from './ui/badge'
import BeltIcon from './ui/belt-icon'
import { cn } from '../lib/utils'

export default function WeightClassBadge({ weightClass }) {
  if (!weightClass) return null

  const isTitle = weightClass.toLowerCase().includes('title')
  const label = weightClass.replace('UFC ', '').replace(' Bout', '')

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium',
        isTitle && 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      )}
    >
      {isTitle && <BeltIcon className="h-3 w-3 mr-1 shrink-0" strokeWidth={2.25} />}
      {label}
    </Badge>
  )
}

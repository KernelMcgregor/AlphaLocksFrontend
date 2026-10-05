// src/components/sports/DivisionPicker.jsx
// Men / Women rows of division pills with fighter counts. P4P pills are gold.
// Shared by Fighter Stats and Rankings so both pages pick a division the same way.
import { cn } from '../../lib/utils'

const isWomens = (key) => key.startsWith('w_') || key === 'p4p_women'
const isPfp = (key) => key.startsWith('p4p')

function DivisionButton({ wc, active, onSelect }) {
  const gold = isPfp(wc.key)
  return (
    <button
      onClick={() => onSelect(wc.key)}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        active && gold && 'border-amber-500 bg-amber-500 text-white shadow-sm',
        active && !gold && 'border-blue-500 bg-blue-600 text-white shadow-sm',
        !active && 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:text-foreground',
      )}
    >
      {wc.label}
      <span className={cn('ml-1', active ? (gold ? 'text-amber-200' : 'text-blue-200') : 'text-muted-foreground/60')}>{wc.fighters.length}</span>
    </button>
  )
}

export default function DivisionPicker({ weightClasses, active, onSelect }) {
  const rows = [
    ['Men', weightClasses.filter((wc) => !isWomens(wc.key))],
    ['Women', weightClasses.filter((wc) => isWomens(wc.key))],
  ]
  return (
    <div className="space-y-2">
      {rows.map(([label, wcs]) => wcs.length > 0 && (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10 shrink-0">{label}</span>
          <div className="flex flex-wrap gap-1.5">
            {wcs.map((wc) => <DivisionButton key={wc.key} wc={wc} active={active === wc.key} onSelect={onSelect} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

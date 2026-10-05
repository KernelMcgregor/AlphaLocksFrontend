// src/components/sports/DivisionPicker.jsx
// Men / Women rows of division pills with fighter counts. P4P pills are gold, BMF pills
// red. Shared by Fighter Stats and Rankings so both pages pick a division the same way.
// A pill without a `fighters` array (the cross-division boards) shows no count.
import { cn } from '../../lib/utils'

const isWomens = (key) => key.startsWith('w_') || key.endsWith('_women')
const TONES = {
  p4p: { on: 'border-amber-500 bg-amber-500 text-white shadow-sm', count: 'text-amber-200',
    off: 'border-amber-500/40 text-amber-700 hover:border-amber-500' },
  bmf: { on: 'border-rose-500 bg-rose-600 text-white shadow-sm', count: 'text-rose-200',
    off: 'border-rose-500/40 text-rose-700 hover:border-rose-500' },
}
const toneOf = (key) => TONES[key.split('_')[0]]

function DivisionButton({ wc, active, onSelect }) {
  const tone = toneOf(wc.key)
  return (
    <button
      onClick={() => onSelect(wc.key)}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        active && tone && tone.on,
        active && !tone && 'border-blue-500 bg-blue-600 text-white shadow-sm',
        !active && 'bg-card',
        !active && tone && tone.off,
        !active && !tone && 'border-border text-muted-foreground hover:border-blue-300 hover:text-foreground',
      )}
    >
      {wc.label}
      {wc.fighters && (
        <span className={cn('ml-1', active ? (tone ? tone.count : 'text-blue-200') : 'text-muted-foreground/60')}>{wc.fighters.length}</span>
      )}
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

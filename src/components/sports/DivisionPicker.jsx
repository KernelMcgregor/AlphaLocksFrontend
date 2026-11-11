// src/components/sports/DivisionPicker.jsx
// Men / Women rows of division pills with fighter counts. P4P pills are UFC gold, BMF
// pills UFC red, and a selected weight class is slate. Shared by Fighter Stats and Rankings so both pages pick a division the same way.
// A pill without a `fighters` array (the cross-division boards) shows no count.
import { cn } from '../../lib/utils'

const isWomens = (key) => key.startsWith('w_') || key.endsWith('_women')
const TONES = {
  p4p: { on: 'border-gold bg-gold text-white shadow-sm', count: 'text-white/75',
    off: 'border-gold/50 text-gold-foreground hover:border-gold' },
  bmf: { on: 'border-primary bg-primary text-white shadow-sm', count: 'text-white/75',
    off: 'border-primary/40 text-primary hover:border-primary' },
}
const toneOf = (key) => TONES[key.split('_')[0]]

function DivisionButton({ wc, active, onSelect }) {
  const tone = toneOf(wc.key)
  return (
    <button
      onClick={() => onSelect(wc.key)}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-all 2xl:px-3 2xl:py-1.5 2xl:text-xs',
        active && tone && tone.on,
        active && !tone && 'border-slate-700 bg-slate-700 text-white shadow-sm',
        !active && 'bg-card',
        !active && tone && tone.off,
        !active && !tone && 'border-border text-muted-foreground hover:border-slate-400 hover:text-foreground',
      )}
    >
      {wc.label}
      {wc.fighters && (
        // Counts only on wide screens: they are what pushed a laptop's men's row onto two lines.
        <span className={cn('ml-1 hidden 2xl:inline', active ? (tone ? tone.count : 'text-white/70') : 'text-muted-foreground/60')}>{wc.fighters.length}</span>
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
          {/* One line; on anything narrower than a laptop it scrolls sideways rather than wrapping. */}
          <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {wcs.map((wc) => <DivisionButton key={wc.key} wc={wc} active={active === wc.key} onSelect={onSelect} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

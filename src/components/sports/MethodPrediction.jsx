import { cn } from '../../lib/utils'

const METHOD_COLORS = {
  'KO/TKO':     { bg: 'bg-red-500',    text: 'text-red-500',    light: 'bg-red-500/15' },
  'Submission':  { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-500/15' },
  'Decision':    { bg: 'bg-slate-400',  text: 'text-slate-400',  light: 'bg-slate-400/15' },
}

export default function MethodPrediction({ methodPrediction }) {
  if (!methodPrediction) return null

  const { predicted_method, ko_prob, sub_prob, dec_prob } = methodPrediction

  const methods = [
    { name: 'KO/TKO', prob: ko_prob },
    { name: 'Submission', prob: sub_prob },
    { name: 'Decision', prob: dec_prob },
  ]

  return (
    <div className="mt-2 space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Method prediction
      </div>

      {/* Stacked bar */}
      <div className="flex h-5 w-full rounded-md overflow-hidden">
        {methods.map(({ name, prob }) => {
          const pct = (prob * 100)
          if (pct < 2) return null
          const colors = METHOD_COLORS[name]
          const isPredicted = name === predicted_method
          return (
            <div
              key={name}
              className={cn(
                'flex items-center justify-center text-[10px] font-bold transition-all',
                colors.bg,
                isPredicted ? 'opacity-100' : 'opacity-60',
              )}
              style={{ width: `${pct}%` }}
              title={`${name}: ${pct.toFixed(1)}%`}
            >
              {pct >= 12 && (
                <span className="text-white drop-shadow-sm">
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px]">
        {methods.map(({ name, prob }) => {
          const colors = METHOD_COLORS[name]
          const isPredicted = name === predicted_method
          return (
            <div key={name} className={cn(
              'flex items-center gap-1',
              isPredicted ? colors.text : 'text-muted-foreground',
              isPredicted && 'font-semibold',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', colors.bg)} />
              <span>{name === 'Submission' ? 'Sub' : name}</span>
              <span className="tabular-nums">{(prob * 100).toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

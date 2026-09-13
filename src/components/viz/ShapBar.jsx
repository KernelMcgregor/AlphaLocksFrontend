import { cn } from '../../lib/utils'

// One model feature as a diverging bar: length is how much it moved the prediction,
// side is which corner it moved it toward. A positive SHAP value favours red.
//
// `tokens` switches from the raw red-500/blue-500 Tailwind ramp to the corner
// tokens. The completed-fight page keeps the literal pair it has always used; the
// upcoming dashboard uses the tokens so it matches the rest of its marks.
export default function ShapBar({ feature, maxAbs, tokens = false }) {
  const width = maxAbs > 0 ? (Math.abs(feature.shap_value) / maxAbs) * 100 : 0
  const favorsRed = feature.shap_value > 0
  const label = feature.feature_name.replace(/_/g, ' ')

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-40 truncate text-right text-xs text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="flex flex-1 items-center">
        <div className="flex w-1/2 justify-end">
          {favorsRed && (
            <div className={cn('h-5 rounded-l-sm', tokens ? 'bg-corner-red/70' : 'bg-red-500/70')} style={{ width: `${width}%` }} />
          )}
        </div>
        <div className="h-6 w-px shrink-0 bg-border" />
        <div className="w-1/2">
          {!favorsRed && (
            <div className={cn('h-5 rounded-r-sm', tokens ? 'bg-corner-blue/70' : 'bg-blue-500/70')} style={{ width: `${width}%` }} />
          )}
        </div>
      </div>
      <div className="w-14 text-center text-[11px] tabular-nums text-muted-foreground">
        {feature.feature_value != null ? feature.feature_value.toFixed(2) : ''}
      </div>
    </div>
  )
}

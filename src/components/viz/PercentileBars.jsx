import { Tip } from '../ui/tip'
import { ordinal } from '../../lib/fighterAnalytics'

// Percentile on the site's diverging scale: indigo below the division's middle, red
// above, neutral gray at the 50th. The midpoint carries no hue, so "average" reads as
// nothing rather than as a weak version of either pole.
function percentileColor(p) {
  if (p == null) return 'var(--color-muted)'
  const t = Math.round(Math.min(1, Math.abs(p - 50) / 50) * 100)
  const pole = p >= 50 ? 'var(--color-viz-1)' : 'var(--color-viz-neg)'
  return `color-mix(in oklab, ${pole} ${t}%, var(--color-muted-foreground))`
}

// Baseball-Savant-style percentile rows: a track from worst to best in the division,
// filled to the fighter's percentile and capped by a bubble holding the number. Every
// stat is oriented so further right is better (absorbed strikes are flipped upstream).
export default function PercentileBars({ rows, formatValue }) {
  return (
    <div className="flex flex-col gap-[7px]">
      {rows.map((r) => {
        const p = r.percentile
        return (
          <Tip
            key={r.key}
            className="grid cursor-default grid-cols-[minmax(0,150px)_minmax(80px,1fr)_52px] items-center gap-2.5"
            content={
              <>
                <div className="text-[11.5px] font-bold leading-tight">{r.label}</div>
                <div className="mt-1 space-y-0.5 text-[10.5px]">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Fighter</span><span className="font-extrabold tabular-nums">{formatValue(r)}</span></div>
                  {r.median != null && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Division median</span><span className="font-bold tabular-nums">{formatValue({ ...r, value: r.median })}</span></div>}
                  {p != null && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Percentile</span><span className="font-bold tabular-nums">{ordinal(p)}</span></div>}
                </div>
              </>
            }
          >
            <span className="truncate text-[11.5px] font-medium leading-tight text-foreground/80">{r.label}</span>
            <div className="relative h-[18px]">
              <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-muted" />
              {p != null && (
                <>
                  <div
                    className="absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full transition-[width] duration-500"
                    style={{ width: `${p}%`, background: percentileColor(p) }}
                  />
                  {/* bubble centre sits on the percentile; clamped so 0 and 100 stay inside */}
                  <div
                    className="absolute top-1/2 flex h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9.5px] font-extrabold text-white ring-2 ring-card transition-[left] duration-500"
                    style={{ left: `clamp(10px, ${p}%, calc(100% - 10px))`, background: percentileColor(p) }}
                  >
                    {p}
                  </div>
                </>
              )}
            </div>
            <span className="text-right text-[11.5px] font-bold tabular-nums text-foreground">{formatValue(r)}</span>
          </Tip>
        )
      })}
    </div>
  )
}

import { useState } from 'react'
import { SlideTabs } from '../ui/slide-tabs'
import { cn } from '../../lib/utils'

// Pacing across rounds, as small multiples. One series each, so no legend box —
// each panel title names its own measure.
const PACE_PANELS = [
  { key: 'slpm', label: 'Sig. Str / Min', fmt: (v) => v.toFixed(1) },
  { key: 'sigAcc', label: 'Sig. Accuracy', fmt: (v) => `${Math.round(v)}%` },
  { key: 'td15', label: 'Takedowns / 15', fmt: (v) => v.toFixed(2) },
]

// `accent` lets a caller that already encodes an entity by colour (the fight page's
// two corners) keep the bars on that entity's hue. Single-subject callers leave it.
export function PaceColumns({ rounds, panel, accent = 'bg-viz-1' }) {
  const vals = rounds.map((r) => r[panel.key]).filter((v) => v != null)
  const max = Math.max(...vals, 0.01) * 1.12
  const peak = Math.max(...vals, 0)
  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="mb-2 shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground/70">{panel.label}</div>
      {/* bars fill the box rather than sitting in a narrow centred track */}
      <div className="flex h-[152px] flex-1 items-end gap-[4px]">
        {rounds.map((r) => {
          const v = r[panel.key]
          const isPeak = v != null && v === peak
          return (
            <div key={r.round} className="flex flex-1 flex-col items-center justify-end">
              <span className={cn('mb-1 text-[10px] font-bold tabular-nums', isPeak ? 'text-foreground' : 'text-muted-foreground')}>
                {v == null ? '—' : panel.fmt(v)}
              </span>
              <div
                className={cn('w-full rounded-t-[4px]', accent, r.n < 3 && 'opacity-45')}
                style={{ height: `${Math.max(3, ((v ?? 0) / max) * 128)}px` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex shrink-0 gap-[4px]">
        {rounds.map((r) => (
          <div key={r.round} className="flex-1 text-center text-[10px] font-semibold text-muted-foreground">R{r.round}</div>
        ))}
      </div>
    </div>
  )
}

// Two different questions about the same rounds, so a toggle rather than two
// panels: "fighter" asks whether THEY were stopped there; "fight" asks whether the
// BOUT carried on past it. A round they won by knockout is one the fight did not
// survive but they did — the two series genuinely disagree.
export function SurvivalTable({ survival }) {
  const [mode, setMode] = useState('fighter')
  const rows = survival?.rounds || []
  const fighterMode = mode === 'fighter'

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Got out of round</span>
        <SlideTabs
          size="sm"
          value={mode}
          onChange={setMode}
          tabs={[{ key: 'fighter', label: 'Fighter' }, { key: 'fight', label: 'Fight' }]}
        />
      </div>
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            <th className="pb-1 text-left font-bold">Rd</th>
            <th className="pb-1 text-right font-bold">Entered</th>
            <th className="pb-1 text-right font-bold">Out</th>
            <th className="pb-1 text-right font-bold">%</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => {
            const out = fighterMode ? r.entered - r.stopped : r.continued
            const pctv = fighterMode ? r.survivedPct : r.continuedPct
            return (
              <tr key={r.round} className="border-t border-border/60">
                <td className="py-[3px] font-bold">R{r.round}</td>
                <td className="py-[3px] text-right text-muted-foreground">{r.entered}</td>
                <td className="py-[3px] text-right text-muted-foreground">{out}</td>
                <td className={cn('py-[3px] text-right font-bold', r.entered < 3 && 'opacity-50')}>
                  {pctv == null ? '—' : `${Math.round(pctv)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[9px] leading-snug text-muted-foreground/80">
        {fighterMode
          ? 'Share of bouts reaching the round that they were not stopped in.'
          : 'Share of bouts reaching the round where the fight carried on past it.'}
      </p>
    </div>
  )
}

export default function RoundPacing({ rounds, survival, accent }) {
  return (
    <div className="grid items-stretch gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {PACE_PANELS.map((panel) => <PaceColumns key={panel.key} rounds={rounds} panel={panel} accent={accent} />)}
      {survival?.rounds?.length ? <SurvivalTable survival={survival} /> : null}
    </div>
  )
}

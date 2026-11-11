// "Why trust it" tab (was Model Transparency): the evidence that the edge is real.
//
// Every number is from the walk-forward backtest (each fight predicted by a model trained only
// on earlier fights). ROI comes with a bootstrap 95% interval; rows with fewer than 50 bets
// are faded, because at that size a +40% ROI is mostly luck.
import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { Dropdown } from '../picks/PicksFilterBar'
import { CalibrationChart, RoiBar, toneCls } from './charts'
import { MARKET_COLOR, fmtOdds, fmtPct, fmtRate, fmtUnits } from './filters'

const CARD = 'rounded-2xl border border-border bg-card shadow-sm'
const SPLIT_ORDER = ['source', 'market', 'family', 'price', 'disagreement', 'section', 'title', 'rounds', 'division', 'gender', 'year']
const TH = 'pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'

function Panel({ title, note, right, children, className }) {
  return (
    <section className={cn(CARD, 'px-4 py-3.5', className)}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-extrabold tracking-tight">{title}</h2>
          {note && <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function useDomain(rows) {
  return useMemo(() => {
    const m = Math.max(0.15, ...rows.filter((r) => !r.small_sample)
      .flatMap((r) => (r.ci ? r.ci.map(Math.abs) : [Math.abs(r.roi || 0)])))
    return Math.min(0.6, Math.ceil(m * 10) / 10)
  }, [rows])
}

/** Promised (claimed edge) vs delivered (actual ROI + CI), one row per edge band. */
function EdgeLadder({ rows, minEv }) {
  const domain = useDomain(rows)
  const threshold = minEv === 'pick' ? null : +minEv
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-[120px_60px_minmax(200px,1fr)_70px_64px] items-center gap-x-3.5 tabular-nums">
        <span className={TH}>Edge band</span>
        <span className={cn(TH, 'text-right')}>Bets</span>
        <span className="flex justify-between pb-1.5 text-[10px] text-muted-foreground"><span>{fmtPct(-domain, 0)}</span><span>0</span><span>{fmtPct(domain, 0)}</span></span>
        <span className={cn(TH, 'text-right')}>ROI</span>
        <span className={cn(TH, 'text-right')}>Units</span>
        {rows.map((r) => {
          const lo = parseFloat(String(r.key).replace(/[^\d.]+/, '')) / 100
          const betting = threshold != null && !Number.isNaN(lo) && lo >= threshold - 1e-9
          const cell = cn('border-t border-border/50 py-2', r.small_sample && 'text-muted-foreground')
          return (
            <div key={r.key} className="contents" title={r.ci ? `95% CI ${fmtPct(r.ci[0])} to ${fmtPct(r.ci[1])}` : undefined}>
              <span className={cn(cell, 'flex items-center gap-1.5 text-[12.5px] font-bold')}>
                {r.key}
                {threshold != null && (
                  <span className={cn('rounded px-1.5 py-px text-[9.5px] font-extrabold',
                    betting ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-red-300' : 'bg-muted text-muted-foreground')}>
                    {betting ? 'BETTING' : 'PASS'}
                  </span>
                )}
              </span>
              <span className={cn(cell, 'text-right text-[12.5px] text-muted-foreground')}>{r.n.toLocaleString()}</span>
              <div className="border-t border-border/50">
                <RoiBar roi={r.roi} ci={r.ci} domain={domain} muted={r.small_sample} expected={r.avg_ev ?? 0} />
              </div>
              <span className={cn(cell, 'text-right text-[13px] font-extrabold', !r.small_sample && toneCls(r.roi))}>{fmtPct(r.roi)}</span>
              <span className={cn(cell, 'text-right text-[12.5px]', !r.small_sample && toneCls(r.profit))}>{fmtUnits(r.profit)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SplitTable({ rows, keyLabel }) {
  const domain = useDomain(rows)
  if (!rows.length) return <p className="text-[12px] text-muted-foreground">No bets match these filters.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[12.5px] tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5 pr-2">{keyLabel}</th>
            <th className="px-2 py-1.5 text-right">Bets</th>
            <th className="px-2 py-1.5 text-right">Hit</th>
            <th className="px-2 py-1.5 text-right">Med. price</th>
            <th className="px-2 py-1.5 text-right" title="The average EV the model claimed when it made these bets">Expected</th>
            <th className="px-2 py-1.5 text-right">Actual ROI</th>
            <th className="w-[30%] px-2 py-1.5">
              <div className="flex justify-between font-normal normal-case tracking-normal"><span>{fmtPct(-domain, 0)}</span><span>0</span><span>{fmtPct(domain, 0)}</span></div>
            </th>
            <th className="py-1.5 pl-2 text-right">Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={cn('border-b border-border/50 last:border-0', r.small_sample && 'text-muted-foreground')}
              title={r.ci ? `95% CI ${fmtPct(r.ci[0])} to ${fmtPct(r.ci[1])}` : undefined}>
              <td className="py-1.5 pr-2 font-semibold">{r.key}{r.small_sample && <span className="ml-1.5 text-[10px] font-normal">small sample</span>}</td>
              <td className="px-2 py-1.5 text-right">{r.n.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right">{fmtRate(r.hit)}</td>
              <td className="px-2 py-1.5 text-right">{fmtOdds(r.avg_price)}</td>
              <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtPct(r.avg_ev)}</td>
              <td className={cn('px-2 py-1.5 text-right font-bold', !r.small_sample && toneCls(r.roi))}>{fmtPct(r.roi)}</td>
              <td className="px-2 py-1.5"><RoiBar roi={r.roi} ci={r.ci} domain={domain} muted={r.small_sample} /></td>
              <td className={cn('py-1.5 pl-2 text-right', !r.small_sample && toneCls(r.profit))}>{fmtUnits(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Brier-score improvement over the de-vigged market, per market. */
function SharperBars({ rows }) {
  const items = rows.filter((r) => r.brier_market).map((r) => ({ ...r, imp: (r.brier_market - r.brier_model) / r.brier_market }))
  const max = Math.max(0.001, ...items.map((r) => Math.abs(r.imp)))
  return (
    <div className="space-y-0.5">
      {items.map((r) => (
        <div key={r.group} className="grid grid-cols-[140px_minmax(0,1fr)_60px] items-center gap-2.5 py-1 text-[12px] tabular-nums"
          title={`Brier: model ${r.brier_model?.toFixed(4)} · market ${r.brier_market?.toFixed(4)} · ${r.n.toLocaleString()} outcomes`}>
          <span className="flex items-center gap-1.5 truncate font-bold">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: MARKET_COLOR[r.group] }} />{r.label}
          </span>
          <span className="relative h-2 rounded-full bg-muted">
            <span className={cn('absolute inset-y-0 left-0 rounded-full', r.imp <= 0 && 'bg-rose-300 dark:bg-rose-800')}
              style={{ width: `${Math.max(4, (Math.abs(r.imp) / max) * 100)}%`, ...(r.imp > 0 ? { background: MARKET_COLOR[r.group] } : {}) }} />
          </span>
          <span className={cn('text-right font-extrabold', toneCls(r.imp))}>{fmtPct(r.imp)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TransparencyTab({ data, filters }) {
  const [split, setSplit] = useState('market')
  const s = data.splits
  const clv = data.clv
  const t = data.totals || {}
  const proofs = [
    t.roi != null && {
      value: fmtPct(t.roi), title: t.ci?.[0] > 0 ? 'Edge holds up' : 'Profitable so far',
      note: t.ci ? `95% CI ${fmtPct(t.ci[0], 0)} to ${fmtPct(t.ci[1], 0)} on ${(t.n ?? 0).toLocaleString()} bets` : `${(t.n ?? 0).toLocaleString()} bets`,
    },
    clv && { value: fmtRate(clv.beat_close), title: 'Beats the close', note: `Of ${clv.n.toLocaleString()} opening-line moneyline bets saw the market move our way` },
    clv && { value: fmtPct(clv.avg_clv), title: 'Avg. line move', note: 'The market moved toward our side by fight night, on average' },
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {proofs.map((p) => (
          <div key={p.title} className={cn(CARD, 'flex items-center gap-3.5 rounded-[14px] px-4 py-3.5')}>
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">{p.value}</span>
                <span className="text-[12.5px] font-extrabold">{p.title}</span>
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{p.note}</div>
            </div>
          </div>
        ))}
      </div>

      <Panel title="Promised vs delivered, by edge"
        note="Grey = the edge the model claimed at bet time. Green = the ROI it actually returned, with its 95% bootstrap interval."
        right={(
          <div className="flex gap-3 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-slate-300 dark:bg-slate-600" />Expected</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-emerald-500" />Actual ROI</span>
          </div>
        )}>
        <EdgeLadder rows={s.ev_band.rows} minEv={filters.minEv} />
      </Panel>

      <Panel title="Splits" note="The same bets, cut another way. Faded rows have fewer than 50 bets."
        right={(
          <Dropdown label="Split" value={split} onChange={setSplit} className="w-[220px]"
            options={SPLIT_ORDER.filter((k) => s[k]).map((k) => ({ key: k, label: s[k].label }))} />
        )}>
        {split === 'disagreement' && (
          <p className="mb-2 text-[11.5px] text-muted-foreground">How far the model's probability was from the de-vigged market price on the side bet, in percentage points.</p>
        )}
        <SplitTable rows={s[split].rows} keyLabel={s[split].label} />
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Panel className="flex-[1_1_360px]" title="Calibration"
          note="When the model says 40%, it should happen 40% of the time. Closer to the dashed line wins.">
          <CalibrationChart bins={data.calibration} />
        </Panel>
        <div className="flex flex-[1_1_360px] flex-col gap-3">
          {clv && (
            <Panel title="Closing line value" note="Did the market move toward our side by fight night? The most luck-proof sign of a real edge.">
              <div className="flex h-7 overflow-hidden rounded-lg text-[11.5px] font-extrabold">
                <div className="flex items-center gap-1 whitespace-nowrap bg-emerald-500 pl-2.5 text-white" style={{ width: `${Math.round(clv.beat_close * 100)}%` }}>
                  <span>{fmtRate(clv.beat_close)}</span><span>beat the close</span>
                </div>
                <div className="flex flex-1 items-center justify-end bg-muted pr-2.5 text-muted-foreground">{fmtRate(1 - clv.beat_close)}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5 tabular-nums">
                {[
                  { value: fmtPct(clv.avg_clv), label: 'avg. line move our way', tone: clv.avg_clv },
                  { value: fmtPct(clv.roi_beat), label: `ROI when we beat it (${clv.n_beat})`, tone: clv.roi_beat },
                  { value: fmtPct(clv.roi_not), label: `ROI when we didn't (${clv.n_not})`, tone: clv.roi_not },
                ].map((x) => (
                  <div key={x.label}>
                    <div className={cn('text-[18px] font-extrabold', toneCls(x.tone))}>{x.value}</div>
                    <div className="text-[10.5px] font-semibold text-muted-foreground">{x.label}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <Panel className="flex-1" title="Sharper than the market" note="Brier score improvement over the de-vigged market on the same outcomes. Hover a row for raw scores.">
            <SharperBars rows={data.accuracy || []} />
          </Panel>
        </div>
      </div>
    </div>
  )
}

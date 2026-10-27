// Model Transparency tab: how far to trust the model, edge by edge.
//
// Every number is from the walk-forward backtest (each fight predicted by a model trained only
// on earlier fights). ROI comes with a bootstrap 95% interval; rows with fewer than 50 bets
// are faded, because at that size a +40% ROI is mostly luck.
import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { Dropdown } from '../picks/PicksFilterBar'
import { CalibrationChart, CumulativeChart, KpiRow, RoiBar } from './charts'
import { MARKETS, MARKET_COLOR, fmtOdds, fmtPct, fmtRate, fmtUnits, signCls } from './filters'

const SPLIT_ORDER = ['source', 'market', 'family', 'price', 'disagreement', 'section', 'title', 'rounds', 'division', 'gender', 'year']

function Panel({ title, note, children, className }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-3', className)}>
      <h2 className="text-[14px] font-extrabold tracking-tight">{title}</h2>
      {note && <p className="mb-2.5 mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{note}</p>}
      {children}
    </section>
  )
}

function SplitTable({ rows, keyLabel }) {
  const domain = useMemo(() => {
    const m = Math.max(0.15, ...rows.filter((r) => !r.small_sample)
      .flatMap((r) => (r.ci ? r.ci.map(Math.abs) : [Math.abs(r.roi || 0)])))
    return Math.min(0.6, Math.ceil(m * 10) / 10)
  }, [rows])
  if (!rows.length) return <p className="text-[12px] text-muted-foreground">No bets match these filters.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[12.5px] tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-2">{keyLabel}</th>
            <th className="px-2 py-2 text-right">Bets</th>
            <th className="px-2 py-2 text-right">Hit</th>
            <th className="px-2 py-2 text-right">Med. price</th>
            <th className="px-2 py-2 text-right" title="The average EV the model claimed when it made these bets">Expected</th>
            <th className="px-2 py-2 text-right">Actual ROI</th>
            <th className="w-[34%] px-2 py-2">
              <div className="flex justify-between font-normal normal-case tracking-normal">
                <span>{fmtPct(-domain, 0)}</span><span>0</span><span>{fmtPct(domain, 0)}</span>
              </div>
            </th>
            <th className="py-2 pl-2 text-right">Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={cn('border-b border-border/60 last:border-0', r.small_sample && 'text-muted-foreground')}
              title={r.ci ? `95% CI ${fmtPct(r.ci[0])} to ${fmtPct(r.ci[1])}` : undefined}>
              <td className="py-1.5 pr-2 font-semibold">{r.key}{r.small_sample && <span className="ml-1.5 text-[10px] font-normal">small sample</span>}</td>
              <td className="px-2 py-1.5 text-right">{r.n.toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right">{fmtRate(r.hit)}</td>
              <td className="px-2 py-1.5 text-right">{fmtOdds(r.avg_price)}</td>
              <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtPct(r.avg_ev)}</td>
              <td className={cn('px-2 py-1.5 text-right font-semibold', !r.small_sample && signCls(r.roi))}>{fmtPct(r.roi)}</td>
              <td className="px-2 py-1.5"><RoiBar roi={r.roi} ci={r.ci} domain={domain} muted={r.small_sample} /></td>
              <td className={cn('py-1.5 pl-2 text-right', !r.small_sample && signCls(r.profit))}>{fmtUnits(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccuracyTable({ rows }) {
  return (
    <table className="w-full text-[12.5px] tabular-nums">
      <thead>
        <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          <th className="py-2 pr-2">Market</th><th className="px-2 py-2 text-right">Outcomes</th>
          <th className="px-2 py-2 text-right">Model alone</th><th className="px-2 py-2 text-right">Model + market</th>
          <th className="px-2 py-2 text-right">Market</th>
          <th className="py-2 pl-2 text-right">Better</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.group} className="border-b border-border/60 last:border-0">
            <td className="py-1.5 pr-2 font-semibold">
              <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: MARKET_COLOR[r.group] }} />{r.label}
            </td>
            <td className="px-2 py-1.5 text-right">{r.n.toLocaleString()}</td>
            <td className="px-2 py-1.5 text-right text-muted-foreground">{r.brier_model_only?.toFixed(4)}</td>
            <td className="px-2 py-1.5 text-right">{r.brier_model?.toFixed(4)}</td>
            <td className="px-2 py-1.5 text-right">{r.brier_market?.toFixed(4)}</td>
            <td className={cn('py-1.5 pl-2 text-right font-semibold', r.diff < 0 ? 'text-emerald-600' : 'text-red-500')}>
              {r.diff < 0 ? 'Blend' : 'Market'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function TransparencyTab({ data, filters }) {
  const [split, setSplit] = useState('market')
  const s = data.splits
  const clv = data.clv
  const cumSeries = MARKETS.filter((m) => !filters.markets.length || filters.markets.includes(m.key))
    .filter((m) => data.cumulative.some((r) => r[m.key] != null))
    .map((m) => ({ key: m.key, label: m.label, color: MARKET_COLOR[m.key] }))
  const extra = clv ? [{ label: 'Beat the closing line', value: fmtRate(clv.beat_close), sub: `avg. CLV ${fmtPct(clv.avg_clv)} on ${clv.n} opening ML bets` }] : []

  return (
    <div className="space-y-4">
      <KpiRow totals={data.totals} extra={extra} />

      <Panel title="How much to trust each edge"
        note="Bets grouped by the edge (expected value) the model claimed at bet time. 'Expected' is what the model promised; 'Actual ROI' is what happened. The whisker is a 95% bootstrap interval: if it crosses zero, that band hasn't shown an edge distinguishable from luck.">
        <SplitTable rows={s.ev_band.rows} keyLabel="Edge band" />
      </Panel>

      <Panel title="Splits" note="The same bets, cut another way. Faded rows have fewer than 50 bets.">
        <div className="mb-2">
          <Dropdown label="Split" value={split} onChange={setSplit} className="w-[220px]"
            options={SPLIT_ORDER.filter((k) => s[k]).map((k) => ({ key: k, label: s[k].label }))} />
        </div>
        {split === 'disagreement' && (
          <p className="mb-2 text-[11.5px] text-muted-foreground">How far the model on its own (before blending with the market) was from the de-vigged market price on the side bet, in percentage points.</p>
        )}
        <SplitTable rows={s[split].rows} keyLabel={s[split].label} />
      </Panel>

      <Panel title="Profit over time by market" note="Cumulative units for each market, card by card.">
        <CumulativeChart data={data.cumulative} series={cumSeries} height={260} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Calibration"
          note="Every priced outcome, bet or not, grouped by predicted probability, for the model on its own (before blending with the market) and for the de-vigged market. Points on the dashed line mean '30%' really happened 30% of the time.">
          <CalibrationChart bins={data.calibration} />
        </Panel>
        <Panel title="Accuracy vs the market"
          note="Brier score (lower is better) on the same outcomes. The bets use the model + market blend; the model alone shows what it knows that the price doesn't.">
          <AccuracyTable rows={data.accuracy} />
        </Panel>
      </div>

      {clv && (
        <Panel title="Closing line value"
          note="For moneyline bets at the opening line: did the market move toward the model's side by the close? Beating the close is the most reliable sign of a real edge, because it doesn't depend on who won.">
          <div className="grid grid-cols-2 gap-3 text-[12.5px] tabular-nums sm:grid-cols-4">
            <div><div className="text-lg font-extrabold">{fmtRate(clv.beat_close)}</div><div className="text-[11px] text-muted-foreground">of bets beat the close</div></div>
            <div><div className={cn('text-lg font-extrabold', signCls(clv.avg_clv))}>{fmtPct(clv.avg_clv)}</div><div className="text-[11px] text-muted-foreground">average line move our way</div></div>
            <div><div className={cn('text-lg font-extrabold', signCls(clv.roi_beat))}>{fmtPct(clv.roi_beat)}</div><div className="text-[11px] text-muted-foreground">ROI when we beat the close ({clv.n_beat})</div></div>
            <div><div className={cn('text-lg font-extrabold', signCls(clv.roi_not))}>{fmtPct(clv.roi_not)}</div><div className="text-[11px] text-muted-foreground">ROI when we didn't ({clv.n_not})</div></div>
          </div>
        </Panel>
      )}

      <Panel title="How these numbers are made">
        <ul className="list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-muted-foreground">
          <li><b className="text-foreground">Walk-forward:</b> each fight was predicted by a model trained only on fights before it, so no result leaks into its own prediction.</li>
          <li><b className="text-foreground">Every +EV pick:</b> any side whose expected value is positive at the typical book's price is a 1-unit bet. Several bets on one fight are correlated, so treat totals as less certain than their size suggests.</li>
          <li><b className="text-foreground">Prices:</b> &lsquo;Typical book&rsquo; is the median sportsbook price, the one most readers can get. &lsquo;Best book&rsquo; assumes line shopping.</li>
          <li><b className="text-foreground">Probabilities:</b> moneyline uses the model blended with the market line it is bet against; props blend the model 50/50 with the de-vigged closing market, exactly as the Picks page does.</li>
          <li><b className="text-foreground">Opening vs closing:</b> only the moneyline has historical opening prices. Prop bets are always settled at the closing price.</li>
          <li><b className="text-foreground">Where predictions come from:</b> the walk-forward backtest; then, for cards after the last retrain, a model trained before the card (&lsquo;Pre-trained&rsquo;) or the prediction the site served before the fight, frozen when the bout started (&lsquo;Live&rsquo;). Recorded predictions are never rewritten. Recent cards are priced from our line watcher&rsquo;s BestFightOdds snapshots.</li>
          <li><b className="text-foreground">Coverage:</b> {data.coverage.events} events, {data.coverage.fights.toLocaleString()} fights, {data.coverage.from} to {data.coverage.to}.</li>
        </ul>
      </Panel>
    </div>
  )
}

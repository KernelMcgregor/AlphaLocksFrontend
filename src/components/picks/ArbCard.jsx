// One arbitrage opportunity: every outcome of a market backed at its best bettable price,
// staked so each outcome pays the same. Backend: find_arb in app/services/ufc/picks_v2.py.
//
// Stakes scale with the bankroll typed at the top of the page; the API returns them for a
// $100 total, so scaling is just proportional.
import { AlertTriangle } from 'lucide-react'
import { ago } from '../../lib/picks'
import { cn, formatOdds } from '../../lib/utils'

// Exchanges quote contracts in cents, so show the price as a %, with the fee-adjusted
// American equivalent beside it.
const pct = (p) => `${+(p * 100).toFixed(1)}%`
const money = (x) => `$${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ArbCard({ arb, fight, event, total = 100, showEvent }) {
  const k = total / (arb.total_stake || 100)
  const payout = arb.payout * k
  const big = arb.warnings?.some((w) => w.startsWith('unusually large'))
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {showEvent && event?.name ? `${event.name} · ` : ''}{fight.red?.name} vs {fight.blue?.name}
          </div>
          <div className="truncate text-[15px] font-extrabold">{arb.label}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn('text-[20px] font-extrabold tabular-nums', big ? 'text-amber-600' : 'text-emerald-600')}>
            +{(arb.margin * 100).toFixed(2)}%
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">locked in</div>
        </div>
      </div>

      <table className="w-full text-[12.5px] tabular-nums">
        <thead>
          <tr className="text-left text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="pb-1 font-bold">Outcome</th>
            <th className="pb-1 font-bold">Book</th>
            <th className="pb-1 text-right font-bold">Price</th>
            <th className="pb-1 text-right font-bold">Stake</th>
          </tr>
        </thead>
        <tbody>
          {arb.legs.map((l) => (
            <tr key={l.outcome} className="border-t border-border/60">
              <td className="max-w-0 truncate py-1.5 pr-2 font-semibold">{l.outcome}</td>
              <td className="py-1.5 pr-2">{l.book}</td>
              <td className="py-1.5 text-right" title={l.exchange_price != null ? 'Contract price (American odds after the exchange fee)' : undefined}>
                {l.exchange_price != null
                  ? <>{pct(l.exchange_price)} <span className="text-muted-foreground">({formatOdds(l.american)})</span></>
                  : formatOdds(l.american)}
              </td>
              <td className="py-1.5 text-right font-bold">{money(l.stake * k)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-[12.5px]">
        <span className="text-muted-foreground">Stake {money(total)} → any result pays</span>
        <span className="font-extrabold tabular-nums">
          {money(payout)} <span className="text-emerald-600">(+{money(payout - total)})</span>
        </span>
      </div>

      {arb.warnings?.length > 0 && (
        <ul className="flex flex-col gap-1 text-[11.5px] text-amber-700">
          {arb.warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
      <div className="text-[11px] text-muted-foreground">
        Prices from {arb.captured_at ? ago(arb.captured_at) : 'unknown time'}.
      </div>
    </div>
  )
}

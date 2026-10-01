import { Info } from 'lucide-react'
import { cn, formatOdds } from '../../lib/utils'
import { Tip } from '../ui/tip'

// "Method": who wins and how — the six winner x method outcomes as a 2 x 3 heatmap.
//
// Each cell is P(this fighter wins AND by this method), so the six cells sum to
// 100%, a row sums to that fighter's win probability (the moneyline) and a column
// sums to the method probability. Totals are summed from the cells rather than
// read from other fields, so the grid can never disagree with itself.
//
// The method totals sit ON TOP, as the column headers: "how" is read before "who".
// The win totals sit on the right and carry the moneyline market, so this one grid
// replaces the separate model-vs-market and method panels.
//
// Shading is the corner colour at an intensity proportional to the cell's
// probability, scaled against the largest cell so the likeliest outcome is always
// the darkest. Under the model's number, in words: the market price and the edge.

const COLS = [
  { key: 'ko', label: 'KO/TKO' },
  { key: 'sub', label: 'Submission' },
  { key: 'dec', label: 'Decision' },
]

const pct = (p) => `${Math.round(p * 100)}%`

// Sportsbook prices are the default and go unlabelled; anything else says where it's from.
const TAG = { polymarket: 'Polymarket', exchange: 'exchanges' }
function SourceTag({ source }) {
  return TAG[source] ? <span className="text-[9.5px] italic text-muted-foreground">{TAG[source]}</span> : null
}

function Edge({ market, model }) {
  if (market == null || model == null) return null
  const pts = (model - market) * 100
  return (
    <span className={cn('tabular-nums', pts >= 0.05 ? 'font-bold text-emerald-600' : 'text-muted-foreground')}>
      {pts >= 0 ? '+' : '−'}{Math.abs(pts).toFixed(1)} pts
    </span>
  )
}

// "mkt 26% · +285 · +2.1 pts" — whichever parts exist.
function MarketLine({ market, model, className }) {
  if (market?.prob == null) return <span className={cn('min-h-[12px]', className)} />
  return (
    <span className={cn('flex flex-col items-center whitespace-nowrap text-[9.5px] leading-tight', className)}>
      <span className="tabular-nums text-muted-foreground">mkt {pct(market.prob)}</span>
      {market.american != null && <span className="tabular-nums text-muted-foreground">{formatOdds(market.american)}</span>}
      <SourceTag source={market.source} />
      <Edge market={market.prob} model={model} />
    </span>
  )
}

/**
 * rows:         [{ side, name, css, cells: { ko, sub, dec } }]   model probabilities
 * market:       { red: { ko: {prob, american}, ... }, blue: {...} } per-cell market, or null
 * methodMarket: { ko: {prob, american}, sub, dec }                 column-total market
 * winMarket:    { red: {prob, american}, blue: {...} }             moneyline market (no vig)
 * source:       short label naming where the market numbers come from
 * onHighlight:  (key | null) => void — 'red_ko' … 'blue_sub', or 'dec' for a decision cell
 */
export default function OutcomeGrid({ rows, market, methodMarket, winMarket, source, onHighlight }) {
  const all = rows.flatMap((r) => COLS.map((c) => r.cells[c.key] ?? 0))
  const maxCell = Math.max(...all, 0.01)
  const colTotals = Object.fromEntries(COLS.map((c) => [c.key, rows.reduce((a, r) => a + (r.cells[c.key] ?? 0), 0)]))

  const gridCols = 'grid-cols-[minmax(76px,1fr)_repeat(3,minmax(0,1fr))_minmax(52px,0.7fr)]'
  const hi = (key) => onHighlight && {
    onMouseEnter: () => onHighlight(key),
    onMouseLeave: () => onHighlight(null),
    onFocus: () => onHighlight(key),
    onBlur: () => onHighlight(null),
    tabIndex: 0,
  }

  return (
    <div
      role="table"
      className="flex flex-1 flex-col"
      aria-label={rows.map((r) => `${r.name}: ${COLS.map((c) => `${c.label} ${pct(r.cells[c.key] ?? 0)}`).join(', ')}`).join('. ')}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[13px] font-extrabold tracking-tight">Method</span>
        <Tip content={(
          <span className="text-[11px]">
            Each cell is the chance that fighter wins by that method. The six cells add up to 100%:
            columns add up to the method (top) and rows to each fighter&apos;s win probability
            (right). The Decision total is the chance it goes the distance. Edges are the model
            minus the market, in percentage points. Hover a cell to see when that outcome tends to
            happen in the chart below.
          </span>
        )}>
          <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
        </Tip>
        {source && <span className="ml-auto text-[9.5px] text-muted-foreground">market: {source}</span>}
      </div>

      {/* Method totals as the column headers. */}
      <div className={cn('grid items-end gap-1 border-b pb-1.5', gridCols)} role="row">
        <span />
        {COLS.map((c) => (
          <span key={c.key} className="flex min-w-0 flex-col items-center leading-tight" role="columnheader">
            <span className="truncate text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</span>
            <span className="text-[13px] font-extrabold tabular-nums">{pct(colTotals[c.key])}</span>
            <MarketLine market={methodMarket?.[c.key]} model={colTotals[c.key]} />
          </span>
        ))}
        <span className="text-right text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground" role="columnheader">Win</span>
      </div>

      {/* The rows share whatever height the card has, so next to a taller neighbour
          the cells grow instead of leaving a blank band under the grid. */}
      <div className="mt-1 grid flex-1 auto-rows-fr">
        {rows.map((r) => {
          const total = COLS.reduce((a, c) => a + (r.cells[c.key] ?? 0), 0)
          return (
            <div key={r.side} className={cn('grid items-stretch gap-1 py-0.5', gridCols)} role="row">
              <span className="flex min-w-0 items-center border-l-[3px] pl-1.5" style={{ borderColor: r.css }} role="rowheader">
                <span className="truncate text-[11px] font-bold">{r.name}</span>
              </span>
              {COLS.map((c) => {
                const p = r.cells[c.key] ?? 0
                const mkt = market?.[r.side]?.[c.key] ?? null
                // 6% floor so a near-zero cell still reads as belonging to its corner.
                const alpha = Math.round(6 + (p / maxCell) * 44)
                return (
                  <div
                    key={c.key}
                    role="cell"
                    {...hi(c.key === 'dec' ? 'dec' : `${r.side}_${c.key}`)}
                    className="flex min-w-0 cursor-default flex-col items-center justify-center rounded-md px-1.5 py-1.5 outline-none ring-foreground/40 transition-shadow hover:ring-2 focus-visible:ring-2"
                    style={{ background: `color-mix(in oklab, ${r.css} ${alpha}%, transparent)` }}
                  >
                    <span className="text-[16px] font-extrabold leading-none tabular-nums">{pct(p)}</span>
                    {mkt?.prob != null ? (
                      <span className="mt-1.5 flex flex-col items-center gap-0.5 whitespace-nowrap text-[11px] leading-tight">
                        <span className="tabular-nums text-foreground/70">mkt {pct(mkt.prob)}</span>
                        {mkt.american != null && <span className="text-[9.5px] tabular-nums text-foreground/55">{formatOdds(mkt.american)}</span>}
                        <SourceTag source={mkt.source} />
                        <Edge market={mkt.prob} model={p} />
                      </span>
                    ) : (
                      <span className="mt-1.5 text-[11px] text-foreground/45">no market</span>
                    )}
                  </div>
                )
              })}
              <span className="flex flex-col items-end justify-center leading-tight" role="cell">
                <span className="text-[16px] font-extrabold tabular-nums">{pct(total)}</span>
                {winMarket?.[r.side]?.prob != null && (
                  <span className="flex flex-col items-end whitespace-nowrap text-[9.5px]">
                    <span className="tabular-nums text-muted-foreground">mkt {pct(winMarket[r.side].prob)}</span>
                    <SourceTag source={winMarket[r.side].source} />
                    <Edge market={winMarket[r.side].prob} model={total} />
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

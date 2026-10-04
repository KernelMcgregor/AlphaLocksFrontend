// The market around the fight: where the moneyline opened and closed (BestFightOdds
// consensus), the exchange curves, and every prop that cashed with the price it closed
// at — what the books thought of what actually happened.
import { ArrowRight } from 'lucide-react'
import { formatOdds } from '../../../lib/utils'
import MarketMovement from '../../viz/MarketMovement'
import { Tip } from '../../ui/tip'
import { CORNERS } from '../corners'
import { Box, Empty } from '../layout'

const pct = (p, d = 0) => (p == null ? '—' : `${(p * 100).toFixed(d)}%`)

// A red-vs-blue track with the opening, closing and model marks on it. Left is red
// winning, right is blue — the same reading as every split bar on the page.
function LineTrack({ open, close, model, names }) {
  const at = (p) => `${(1 - p) * 100}%`
  const marks = [
    open != null && { key: 'open', p: open, label: 'Open', cls: 'bg-muted-foreground', size: 'h-3 w-3' },
    model != null && { key: 'model', p: model, label: 'Model', cls: 'bg-primary', size: 'h-3 w-3 rotate-45 rounded-[2px]' },
    close != null && { key: 'close', p: close, label: 'Close', cls: 'bg-foreground', size: 'h-3.5 w-3.5' },
  ].filter(Boolean)
  return (
    <div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 overflow-hidden rounded-full">
          <div className="h-full flex-1" style={{ background: CORNERS[0].css, opacity: 0.35 }} />
          <div className="h-full flex-1" style={{ background: CORNERS[1].css, opacity: 0.35 }} />
        </div>
        <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
        {marks.map((m) => (
          <Tip key={m.key} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: at(m.p) }}
            content={<span className="text-[11px]">{m.label}: {names.red} {pct(m.p, 1)}</span>}>
            <span className={`block rounded-full border-2 border-background shadow-sm ${m.cls} ${m.size}`} />
          </Tip>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] text-muted-foreground">
        <span>{names.red} favoured</span>
        <span className="flex gap-3">
          {marks.map((m) => (
            <span key={m.key} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${m.cls} ${m.key === 'model' ? 'rotate-45 rounded-[1px]' : ''}`} />{m.label}
            </span>
          ))}
        </span>
        <span>{names.blue} favoured</span>
      </div>
    </div>
  )
}

export default function MarketRecap({ fight, line, side, props, marketHistory }) {
  const red = fight.red_fighter
  const blue = fight.blue_fighter
  const names = { red: red.last_name, blue: blue.last_name }
  const model = fight.prediction?.red_prob ?? null
  const hasLine = line && (line.red_close_prob != null || line.red_open_prob != null)
  const moved = hasLine && line.red_open_prob != null && line.red_close_prob != null
    ? line.red_close_prob - line.red_open_prob : null
  const steamTo = moved == null || Math.abs(moved) < 0.01 ? null : moved > 0 ? 'red' : 'blue'
  const hasCurves = marketHistory && Object.keys(marketHistory).length > 0
  const winnerClose = side && line?.red_close_prob != null
    ? (side === 'red' ? line.red_close_prob : 1 - line.red_close_prob) : null

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Box
          title="Line movement"
          tip="BestFightOdds consensus moneyline: the opening line and the median sportsbook close, with the vig removed. The diamond is the model's published probability."
          note={steamTo ? `money moved toward ${names[steamTo]}${side ? (steamTo === side ? ' — and they won' : ' — and they lost') : ''}` : null}
        >
          {hasLine ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {['red', 'blue'].map((s) => {
                  const o = line[`${s}_open`]
                  const c = line[`${s}_close`]
                  const po = line.red_open_prob == null ? null : s === 'red' ? line.red_open_prob : 1 - line.red_open_prob
                  const pc = line.red_close_prob == null ? null : s === 'red' ? line.red_close_prob : 1 - line.red_close_prob
                  return (
                    <div key={s} className="rounded-md border border-border/70 p-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
                        <span className="h-2 w-2 rounded-full" style={{ background: s === 'red' ? CORNERS[0].css : CORNERS[1].css }} />
                        {names[s]}
                        {side === s && <span className="rounded bg-emerald-600 px-1 text-[9px] font-black uppercase text-white">Won</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[13px] font-black tabular-nums">
                        <span className="text-muted-foreground">{o != null ? formatOdds(o) : '—'}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span>{c != null ? formatOdds(c) : '—'}</span>
                      </div>
                      <div className="text-[10px] tabular-nums text-muted-foreground">{pct(po)} → {pct(pc)}</div>
                    </div>
                  )
                })}
              </div>
              <LineTrack open={line.red_open_prob} close={line.red_close_prob} model={model} names={names} />
              {winnerClose != null && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  The winner closed at <span className="font-bold text-foreground">{pct(winnerClose)}</span>
                  {winnerClose < 0.5 ? ' — an upset by the closing price.' : '.'}
                </p>
              )}
            </>
          ) : (
            <Empty>No opening or closing line on record for this bout.</Empty>
          )}
        </Box>

        <Box
          title="What happened, priced"
          tip="Each prop market that cashed, at its last de-vigged price before the fight (BestFightOdds consensus across books). A low number is an outcome the market did not see coming."
        >
          {props.length ? (
            <div className="grid gap-1">
              <div className="grid grid-cols-[1fr_56px_56px_56px] gap-2 border-b pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>Outcome</span>
                <span className="text-right">Opened</span>
                <span className="text-right">Closed</span>
                <span className="text-right">Price</span>
              </div>
              {props.map((p) => (
                <div key={p.key} className="grid grid-cols-[1fr_56px_56px_56px] items-center gap-2 py-0.5 text-[11px]">
                  <span className="truncate font-semibold">{p.label}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{pct(p.opening)}</span>
                  <span className={`text-right font-bold tabular-nums ${p.prob < 0.25 ? 'text-amber-600' : ''}`}>{pct(p.prob)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">{p.american != null ? formatOdds(p.american) : '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No prop markets were tracked for this bout.</Empty>
          )}
        </Box>
      </div>

      {hasCurves && (
        <div className="rounded-lg border border-border p-3">
          <MarketMovement
            series={marketHistory}
            modelProb={model}
            redName={red.last_name}
            blueName={blue.last_name}
            redCss={CORNERS[0].css}
            blueCss={CORNERS[1].css}
          />
        </div>
      )}
    </div>
  )
}

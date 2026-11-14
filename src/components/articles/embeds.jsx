// The numbers beside an article: matchup card, model bar, odds, methods, radar, tale of the
// tape, line movement. Used by the article layouts' sidebars and by the body blocks that
// embed them (```chin-odds```, ```chin-movement``` ...), so a figure in the text and the
// same figure in the sidebar always come from one place: the fight payload.
import { useEffect, useState } from 'react'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import BeltIcon from '../ui/belt-icon'
import MarketMovement from '../viz/MarketMovement'
import RadarChart from '../viz/RadarChart'
import { CORNERS } from '../fight/corners'
import { fetchMarketHistory } from '../../lib/api'
import { cn, formatDate, formatOdds } from '../../lib/utils'
import { age, bestOdds, booksRedProb, eventShort, isTitle, lastName, marketsFor, record, topMethod, val, weightLabel } from './fightText'

export function Panel({ title, right, children, className }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      {title && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="font-display text-[16px] font-extrabold italic uppercase tracking-tight">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function Byline({ written, minutes }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white">KM</span>
      <div className="leading-tight">
        <div className="font-bold text-foreground">KernelMcGregor</div>
        <div>{written} · {minutes} min read</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar pieces
// ---------------------------------------------------------------------------
export function ModelBar({ fight, size = 'md', names = true, odds: showOdds = true }) {
  const p = fight.prediction?.red_prob
  if (p == null) return null
  const r = Math.round(p * 100)
  const odds = bestOdds(fight.odds)
  return (
    <div>
      {names && (
        <div className="flex justify-between text-[10.5px] font-extrabold uppercase tracking-wider">
          <span className="text-corner-red">{lastName(fight.red_fighter)}</span>
          <span className="text-muted-foreground">Model</span>
          <span className="text-corner-blue">{lastName(fight.blue_fighter)}</span>
        </div>
      )}
      <div className={cn('flex items-baseline justify-between font-display font-extrabold italic tabular-nums', size === 'lg' ? 'text-[44px] leading-none' : 'text-[22px]')}>
        <span className={r >= 50 ? 'text-corner-red' : 'text-muted-foreground'}>{r}%</span>
        <span className={100 - r > 50 ? 'text-corner-blue' : 'text-muted-foreground'}>{100 - r}%</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-corner-red" style={{ width: `${r}%` }} />
        <div className="h-full flex-1 bg-corner-blue" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{showOdds && odds.red != null ? formatOdds(odds.red) : ''}</span>
        <span>{topMethod(fight.method_prediction) ? `Likeliest: ${topMethod(fight.method_prediction)}` : ''}</span>
        <span>{showOdds && odds.blue != null ? formatOdds(odds.blue) : ''}</span>
      </div>
    </div>
  )
}

export function MatchupCard({ fight }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 bg-ink px-3 py-2 text-[11px] text-white/80">
        <b className="font-display italic text-primary">{eventShort(event?.name)}</b>
        <span>{weightLabel(fight.weight_class)}</span>
        {isTitle(fight.weight_class) && <span className="inline-flex items-center gap-0.5 font-bold text-gold"><BeltIcon className="h-3 w-3" /> Title</span>}
        {event?.date && <span className="ml-auto">{formatDate(event.date)}</span>}
      </div>
      <div className="grid h-[150px] grid-cols-2">
        {[red, blue].map((f, k) => (
          <div key={k} className="relative overflow-hidden bg-muted/40">
            <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[115%] w-auto max-w-none object-top" />
          </div>
        ))}
      </div>
      <div className="h-[3px] bg-ink" />
      <div className="p-3">
        <div className="mb-1 flex items-end justify-between gap-2">
          {[red, blue].map((f, k) => (
            <div key={k} className={cn('min-w-0', k && 'text-right')}>
              <div className={cn('flex items-center gap-1 text-[10.5px] text-muted-foreground', k && 'justify-end')}>
                {!k && <CountryFlag countryCode={f?.country_code} />}{record(f)}{k ? <CountryFlag countryCode={f?.country_code} /> : null}
              </div>
              <div className="font-display text-[22px] font-extrabold italic uppercase leading-none tracking-tight">{lastName(f)}</div>
            </div>
          ))}
        </div>
        <ModelBar fight={fight} />
      </div>
    </div>
  )
}

export function RadarPanel({ series, note }) {
  if (!series?.length) return null
  return (
    <div>
      <RadarChart series={series} />
      <div className="mt-1 flex justify-center gap-4 text-[11px] font-semibold text-muted-foreground">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
      </div>
      {note && <div className="mt-0.5 text-center text-[10px] text-muted-foreground/80">{note}</div>}
    </div>
  )
}

export function OddsTable({ fight }) {
  const rows = (fight.odds || []).filter((o) => o.red_odds != null && o.blue_odds != null)
  if (!rows.length) return <p className="text-[12px] text-muted-foreground">No odds posted yet.</p>
  const best = bestOdds(rows)
  return (
    <table className="w-full text-[12.5px] tabular-nums">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
          <th className="pb-1 text-left font-semibold">Book</th>
          <th className="pb-1 text-right font-semibold">{lastName(fight.red_fighter)}</th>
          <th className="pb-1 text-right font-semibold">{lastName(fight.blue_fighter)}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {rows.map((o) => (
          <tr key={o.bookmaker}>
            <td className="py-1">{o.bookmaker}</td>
            <td className={cn('py-1 text-right', o.red_odds === best.red && 'font-extrabold text-emerald-600')}>{formatOdds(o.red_odds)}</td>
            <td className={cn('py-1 text-right', o.blue_odds === best.blue && 'font-extrabold text-emerald-600')}>{formatOdds(o.blue_odds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MethodsPanel({ fight }) {
  const mp = fight.method_prediction
  if (!mp) return <p className="text-[12px] text-muted-foreground">No method prediction yet.</p>
  const rows = [
    [`${lastName(fight.red_fighter)} by KO/TKO`, mp.red_ko_prob, 'bg-corner-red'],
    [`${lastName(fight.red_fighter)} by submission`, mp.red_sub_prob, 'bg-corner-red'],
    [`${lastName(fight.red_fighter)} by decision`, mp.red_dec_prob, 'bg-corner-red'],
    [`${lastName(fight.blue_fighter)} by KO/TKO`, mp.blue_ko_prob, 'bg-corner-blue'],
    [`${lastName(fight.blue_fighter)} by submission`, mp.blue_sub_prob, 'bg-corner-blue'],
    [`${lastName(fight.blue_fighter)} by decision`, mp.blue_dec_prob, 'bg-corner-blue'],
  ].filter((r) => r[1] != null)
  return (
    <div className="space-y-2">
      {rows.map(([label, p, bar]) => (
        <div key={label}>
          <div className="flex justify-between text-[12px]"><span>{label}</span><b className="tabular-nums">{Math.round(p * 100)}%</b></div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', bar)} style={{ width: `${p * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

// The tape and, when the ratings exist, the skill radar, as one box with a toggle.
export function MatchupBox({ fight, radar }) {
  const tabs = [{ label: 'Bio', node: <TapeRows fight={fight} /> }]
  if (radar?.length) {
    tabs.push({
      label: 'Skills',
      node: <RadarPanel series={radar} note="Percentile in division" />,
    })
  }
  return <SlideTabs title="Tale of the tape" tabs={tabs} />
}

// Both fighters over the box's two columns: surname in corner colour.
function TapeNames({ red, blue }) {
  return (
    <div className="mb-1 grid grid-cols-[1fr_70px_1fr] items-end border-b border-border pb-2">
      {[red, blue].map((f, k) => (
        <div key={k} className={cn('min-w-0 leading-tight', k ? 'order-3' : 'order-1 text-right')}>
          <div className={cn('truncate font-display text-[18px] font-extrabold italic uppercase', k ? 'text-corner-blue' : 'text-corner-red')}>{lastName(f)}</div>
        </div>
      ))}
      <span className="order-2" />
    </div>
  )
}

export function TaleOfTape({ fight }) {
  return <Panel title="Tale of the tape"><TapeRows fight={fight} /></Panel>
}

function TapeRows({ fight }) {
  const { red_fighter: r, blue_fighter: b } = fight
  const rows = [
    ['Record', record(r), record(b)],
    ['Age', age(r?.dob) ?? '–', age(b?.dob) ?? '–'],
    ['Height', val(r?.height), val(b?.height)],
    ['Reach', val(r?.reach), val(b?.reach)],
    // The fighting style listed on UFC.com, when both have one; else stance.
    r?.fighting_style && b?.fighting_style
      ? ['Style', r.fighting_style, b.fighting_style]
      : ['Stance', val(r?.stance), val(b?.stance)],
  ]
  return (
    <div>
      <TapeNames red={r} blue={b} />
      <div className="divide-y divide-border/60 text-[13px]">
        {rows.map(([label, a, c]) => (
          <div key={label} className="grid grid-cols-[1fr_70px_1fr] items-center py-1.5">
            <span className="text-right font-semibold tabular-nums">{a}</span>
            <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{c}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineMovement({ fight }) {
  const [hist, setHist] = useState(null)
  useEffect(() => { fetchMarketHistory(fight.id).then((r) => setHist(r?.series || null)).catch(() => setHist(null)) }, [fight.id])
  if (!hist || !Object.values(hist).some((v) => Array.isArray(v) && v.length)) return null
  return (
    <Panel title="Line movement">
      <MarketMovement series={hist} redName={lastName(fight.red_fighter)}
        blueName={lastName(fight.blue_fighter)} redCss={CORNERS[0].css} blueCss={CORNERS[1].css} />
    </Panel>
  )
}

export function Tabs({ tabs }) {
  const [i, setI] = useState(0)
  return (
    <Panel title="Matchup data">
      <div className="mb-3 flex gap-1 rounded-lg bg-muted p-0.5">
        {tabs.map((t, k) => (
          <button key={t.label} onClick={() => setI(k)}
            className={cn('flex-1 rounded-md py-1 text-[11.5px] font-semibold', k === i ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs[i].node}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Markets: the model against every price we hold. Who wins (Kalshi, Polymarket, the
// sportsbooks without the vig) and how it ends (the six method props, with how far each
// has moved since it opened).
// ---------------------------------------------------------------------------
const money = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`)
const pc = (p) => (p == null ? '–' : `${Math.round(p * 100)}%`)

function WinRow({ label, p, sub, strong }) {
  if (p == null) return null
  return (
    <div className="grid grid-cols-[84px_34px_1fr_34px] items-center gap-2 py-1">
      <div className="leading-tight">
        <div className={cn('text-[12px]', strong ? 'font-extrabold' : 'font-semibold')}>{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
      <span className="text-right text-[12px] font-bold tabular-nums text-corner-red">{pc(p)}</span>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full bg-corner-red', !strong && 'opacity-60')} style={{ width: `${p * 100}%` }} />
        <div className={cn('h-full flex-1 bg-corner-blue', !strong && 'opacity-60')} />
      </div>
      <span className="text-[12px] font-bold tabular-nums text-corner-blue">{pc(1 - p)}</span>
    </div>
  )
}

// A small round badge: a gold belt for the champion, else the model's division rank
// (just the number; "NR" when there is none).
export function Standing({ champion, rank, className, beltOnly }) {
  const base = 'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none tabular-nums shadow ring-2 ring-ink'
  if (champion) {
    return <span className={cn(base, 'bg-gold text-ink', className)} title="Champion"><BeltIcon className="h-3 w-3" /></span>
  }
  if (beltOnly) return null
  return <span className={cn(base, 'bg-white text-ink', className)} title="Division rank">{rank > 0 ? rank : 'NR'}</span>
}

// One market as a row of sportsbook buttons: the option and its best price.
function OddsTile({ o }) {
  const tone = o.side === 'red' ? 'text-corner-red' : o.side === 'blue' ? 'text-corner-blue' : 'text-foreground'
  return (
    <div className="flex min-w-0 flex-col items-center rounded-lg border border-border bg-background px-1.5 py-1.5 text-center">
      <span className={cn('w-full truncate text-[10.5px] font-semibold', tone)}>{o.label}</span>
      <span className="font-display text-[19px] font-extrabold italic leading-tight tabular-nums">{formatOdds(o.price)}</span>
    </div>
  )
}

// Winner x method: the three methods across the top, each fighter's row labelled by their
// name running up the left edge.
function MethodGrid({ market }) {
  const rows = ['red', 'blue'].map((side) => market.options.filter((o) => o.side === side))
  const methods = ['KO/TKO', 'Sub', 'Decision']
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{market.title}</div>
      <div className="grid grid-cols-[22px_repeat(3,minmax(0,1fr))] gap-1.5">
        <span />
        {methods.map((m) => <span key={m} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m}</span>)}
        {rows.map((opts, k) => [
          <span key={`n${k}`} className={cn('flex items-center justify-center rounded-md py-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white', k ? 'bg-corner-blue' : 'bg-corner-red')}>
            <span className="rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">{opts[0]?.label.split(' ')[0]}</span>
          </span>,
          ...opts.map((o) => (
            <div key={o.key} className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-background font-display text-[18px] font-extrabold italic tabular-nums">
              {o.price != null ? formatOdds(o.price) : '–'}
            </div>
          )),
        ])}
      </div>
    </div>
  )
}

export function MarketTiles({ market }) {
  if (market.key === 'method') return <MethodGrid market={market} />
  const cols = 'grid-cols-2'
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{market.title}</div>
      <div className={cn('grid gap-1.5', cols)}>
        {market.options.filter((o) => o.price != null).map((o) => <OddsTile key={o.key} o={o} />)}
      </div>
    </div>
  )
}

// Every price on the bout in one compact panel: sportsbook odds, exchange (trading)
// prices, props and the market's movement. Odds only; the model lives in the header.
export function MarketsPanel({ fight }) {
  const pm = fight.prediction_markets || {}
  const k = pm.kalshi?.moneyline
  const poly = pm.polymarket?.moneyline
  const books = booksRedProb(fight)
  const priced = marketsFor(fight).filter((m) => m.options.some((o) => o.price != null))
  const ml = priced.find((m) => m.key === 'ml')
  const props = priced.filter((m) => m.key !== 'ml')
  const hasBooks = (fight.odds || []).some((o) => o.red_odds != null && o.blue_odds != null)
  const tabs = [
    (ml || hasBooks) && {
      label: 'Odds',
      node: (
        <div className="space-y-3">
          {ml && <MarketTiles market={ml} />}
          {hasBooks && <OddsTable fight={fight} />}
        </div>
      ),
    },
    (k?.red_prob != null || poly?.red_prob != null) && {
      label: 'Trading',
      node: (
        <div>
          <div className="mb-1 flex justify-between text-[10.5px] font-extrabold uppercase tracking-wider">
            <span className="text-corner-red">{lastName(fight.red_fighter)}</span>
            <span className="text-corner-blue">{lastName(fight.blue_fighter)}</span>
          </div>
          <div className="divide-y divide-border/60">
            <WinRow label="Kalshi" p={k?.red_prob} sub={k?.volume ? `${money(k.volume)} traded` : null} strong />
            <WinRow label="Polymarket" p={poly?.red_prob} sub={poly?.volume ? `${money(poly.volume)} traded` : null} strong />
            <WinRow label="Sportsbooks" p={books} sub="No vig" />
          </div>
        </div>
      ),
    },
    props.length > 0 && { label: 'Props', node: <div className="space-y-3">{props.map((m) => <MarketTiles key={m.key} market={m} />)}</div> },
    { label: 'Movement', node: <Movement fight={fight} /> },
  ].filter(Boolean)
  return <SlideTabs title="Markets" tabs={tabs} />
}

// A segmented toggle whose highlight slides to the chosen tab, and the chosen tab's
// content. Used by the Markets panel and the tape/skills box.
export function SlideTabs({ title, tabs }) {
  const [i, setI] = useState(0)
  const at = Math.min(i, tabs.length - 1)
  return (
    <Panel title={title}>
      {tabs.length > 1 && (
        <div className="relative mb-3 flex rounded-lg bg-muted p-0.5">
          <span aria-hidden className="absolute inset-y-0.5 left-0.5 rounded-md bg-background shadow-sm transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ width: `calc((100% - 4px) / ${tabs.length})`, transform: `translateX(${at * 100}%)` }} />
          {tabs.map((t, k) => (
            <button key={t.label} onClick={() => setI(k)}
              className={cn('relative z-10 flex-1 rounded-md py-1 text-[11.5px] font-semibold transition-colors', k === at ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div key={tabs[at].label} className="animate-[fadeIn_.25s_ease-out]">{tabs[at].node}</div>
    </Panel>
  )
}

// The exchange price curves, or a line saying there are none yet.
function Movement({ fight }) {
  const [hist, setHist] = useState(undefined)
  useEffect(() => { fetchMarketHistory(fight.id).then((r) => setHist(r?.series || null)).catch(() => setHist(null)) }, [fight.id])
  if (hist === undefined) return null
  if (!hist || !Object.values(hist).some((v) => Array.isArray(v) && v.length)) {
    return <p className="text-[12px] text-muted-foreground">No exchange prices recorded yet.</p>
  }
  return (
    <MarketMovement series={hist} redName={lastName(fight.red_fighter)}
      blueName={lastName(fight.blue_fighter)} redCss={CORNERS[0].css} blueCss={CORNERS[1].css} />
  )
}

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
import { age, bestOdds, eventShort, isTitle, lastName, record, topMethod, val, weightLabel } from './fightText'

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
export function ModelBar({ fight, size = 'md' }) {
  const p = fight.prediction?.red_prob
  if (p == null) return null
  const r = Math.round(p * 100)
  const odds = bestOdds(fight.odds)
  return (
    <div>
      <div className={cn('flex items-baseline justify-between font-display font-extrabold italic tabular-nums', size === 'lg' ? 'text-[44px] leading-none' : 'text-[22px]')}>
        <span className={r >= 50 ? 'text-corner-red' : 'text-muted-foreground'}>{r}%</span>
        <span className={100 - r > 50 ? 'text-corner-blue' : 'text-muted-foreground'}>{100 - r}%</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-corner-red" style={{ width: `${r}%` }} />
        <div className="h-full flex-1 bg-corner-blue" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{odds.red != null ? formatOdds(odds.red) : ''}</span>
        <span>{topMethod(fight.method_prediction) ? `Likeliest: ${topMethod(fight.method_prediction)}` : ''}</span>
        <span>{odds.blue != null ? formatOdds(odds.blue) : ''}</span>
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

export function RadarPanel({ series }) {
  if (!series?.length) return null
  return (
    <div>
      <RadarChart series={series} />
      <div className="mt-1 flex justify-center gap-4 text-[11px] font-semibold text-muted-foreground">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
      </div>
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

export function TaleOfTape({ fight }) {
  const { red_fighter: r, blue_fighter: b } = fight
  const rows = [
    ['Record', record(r), record(b)],
    ['Age', age(r?.dob) ?? '–', age(b?.dob) ?? '–'],
    ['Height', val(r?.height), val(b?.height)],
    ['Reach', val(r?.reach), val(b?.reach)],
    ['Stance', val(r?.stance), val(b?.stance)],
  ]
  return (
    <Panel title="Tale of the tape">
      <div className="divide-y divide-border/60 text-[13px]">
        {rows.map(([label, a, c]) => (
          <div key={label} className="grid grid-cols-[1fr_70px_1fr] items-center py-1.5">
            <span className="text-right font-semibold tabular-nums">{a}</span>
            <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{c}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function LineMovement({ fight }) {
  const [hist, setHist] = useState(null)
  useEffect(() => { fetchMarketHistory(fight.id).then(setHist).catch(() => setHist(null)) }, [fight.id])
  if (!hist || !Object.values(hist).some((v) => Array.isArray(v) && v.length)) return null
  return (
    <Panel title="Line movement">
      <MarketMovement series={hist} modelProb={fight.prediction?.red_prob} redName={lastName(fight.red_fighter)}
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

// Performance tab: what betting every model pick would have returned, card by card.
//
// Hero (headline units + bankroll chart with range buttons), market cards that double as the
// market filter, a one-square-per-event heatmap, then the events list beside the selected
// event's detail. Selecting an event swaps the detail panel in place; the page never navigates.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchPastResultsEvent, pastResultsPath, peekCached } from '../../lib/api'
import { cn } from '../../lib/utils'
import { GrowthChart, Sparkline, toneCls } from './charts'
import { MARKETS, MARKET_COLOR, SOURCE_BADGE, fmtOdds, fmtPct, fmtRate, fmtUnits, resultsQuery } from './filters'

const CARD = 'rounded-2xl border border-border bg-card shadow-sm'
/** The events list and the selected event: fixed height, fixed headers, contents scroll inside. */
const PANEL_H = 'h-[min(680px,calc(100vh-120px))]'
const RANGES = [['3M', 3], ['6M', 6], ['1Y', 12], ['2Y', 24], ['All', 0]]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const minusMonths = (iso, m) => { const d = new Date(`${iso}T00:00:00`); d.setMonth(d.getMonth() - m); return localIso(d) }
const longDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
const NAME_SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv)$/i
const NAME_PARTICLES = new Set(['da', 'de', 'do', 'dos', 'das', 'di', 'du', 'del', 'della', 'la', 'le', 'van', 'von', 'der', 'den', 'st', 'st.', 'saint', 'bin', 'al', 'el'])
/** Surname as fans say it: 'Michael Aswell Jr.' -> 'Aswell Jr.', 'Jack Della Maddalena' ->
 *  'Della Maddalena', 'Dricus Du Plessis' -> 'Du Plessis'; one-word names stay whole. */
// two-word surnames with no particle to give them away
const SURNAME_OVERRIDES = { 'Ian Machado Garry': 'Machado Garry' }
function lastName(n) {
  if (SURNAME_OVERRIDES[n]) return SURNAME_OVERRIDES[n]
  const t = (n || '').trim().split(/\s+/).filter(Boolean)
  if (t.length <= 1) return t[0] || ''
  const suffix = t.length > 2 && NAME_SUFFIX.test(t[t.length - 1]) ? t.pop() : null
  let i = t.length - 1
  while (i > 1 && NAME_PARTICLES.has(t[i - 1].toLowerCase())) i--
  return [...t.slice(i), ...(suffix ? [suffix] : [])].join(' ')
}
/** 'UFC Fight Night: Buckley vs. Malott' -> { title: 'Buckley vs. Malott', series: 'Fight Night' } */
function shortEvent(name) {
  const m = /^(.*?):\s*(.+)$/.exec(name || '')
  if (!m) return { title: name, series: null }
  return { title: m[2], series: m[1].replace(/^UFC Fight Night$/, 'Fight Night') }
}
/** Full fighter names -> last names, so picks fit a narrow column ('Oki by decision'). */
const shorten = (text, f) => (lastName(f.red) === lastName(f.blue) ? (text || '')   // 'Silva vs Silva': keep full names
  : (text || '').split(f.red).join(lastName(f.red)).split(f.blue).join(lastName(f.blue)))
/** Bettor shorthand for a pick label ('Oki by decision' -> 'Oki DEC'); the full label is the tooltip. */
const BET_SHORT = [[/ by decision$/, ' DEC'], [/ by KO\/TKO$/, ' KO'], [/ by submission$/, ' SUB'],
  [/ wins inside distance/, ' ITD'], [/^Goes to decision$/, 'Goes to DEC'], [/^Doesn't go to decision$/, "Doesn't go to DEC"]]
const shortPick = (label) => BET_SHORT.reduce((t, [re, to]) => t.replace(re, to), label)

function heatCls(e) {
  if (!e.n) return 'bg-slate-200 dark:bg-slate-700'
  const p = e.profit
  if (p > 0) return p < 1.5 ? 'bg-emerald-100 dark:bg-emerald-950' : p < 3.5 ? 'bg-emerald-300 dark:bg-emerald-800' : p < 6 ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-emerald-600 dark:bg-emerald-400'
  return p > -1.5 ? 'bg-rose-100 dark:bg-rose-950' : p > -3.5 ? 'bg-rose-200 dark:bg-rose-900' : 'bg-rose-300 dark:bg-rose-800'
}
const LEGEND = ['bg-rose-300 dark:bg-rose-800', 'bg-rose-200 dark:bg-rose-900', 'bg-rose-100 dark:bg-rose-950', 'bg-slate-200 dark:bg-slate-700',
  'bg-emerald-100 dark:bg-emerald-950', 'bg-emerald-300 dark:bg-emerald-800', 'bg-emerald-400 dark:bg-emerald-600', 'bg-emerald-600 dark:bg-emerald-400']

function SourceBadges({ sources }) {
  return (sources || []).filter((s) => SOURCE_BADGE[s]).map((s) => (
    <span key={s} title={SOURCE_BADGE[s].title}
      className={cn('ml-1.5 inline-block rounded border px-1 py-px align-middle text-[9.5px] font-bold uppercase tracking-wide', SOURCE_BADGE[s].cls)}>
      {SOURCE_BADGE[s].label}
    </span>
  ))
}

// ---------------------------------------------------------------- hero

function Hero({ data, filters, onFilters, onEvent }) {
  const t = data.totals || {}
  const cum = data.cumulative || []
  const cov = data.coverage || {}
  const start = cum[0]?.date || filters.from || cov.from
  const startLabel = start ? new Date(`${start}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''
  const ciClear = t.ci && t.ci[0] > 0
  const { ath, atHigh } = useMemo(() => {
    if (!cum.length) return { ath: 0, atHigh: true }
    const base = (cum[0].cumulative ?? 0) - (cum[0].profit ?? 0)
    const vals = [0, ...cum.map((r) => (r.cumulative ?? base) - base)]
    const hi = Math.max(...vals)
    return { ath: hi, atHigh: vals[vals.length - 1] >= hi - 1e-9, last: vals[vals.length - 1] }
  }, [cum])
  const last = cum.length ? (cum[cum.length - 1].cumulative ?? 0) - ((cum[0].cumulative ?? 0) - (cum[0].profit ?? 0)) : 0
  const best = (data.events || []).reduce((a, e) => (e.n && (!a || e.profit > a.profit) ? e : a), null)
  const activeRange = (() => {
    if (!filters.from || !cov.to) return 'All'
    const hit = RANGES.find(([, m]) => m && minusMonths(cov.to, m) === filters.from)
    return hit ? hit[0] : null
  })()
  const setRange = (m) => onFilters({ ...filters, from: m && cov.to ? minusMonths(cov.to, m) : '', to: '' })
  const stats = [
    { label: 'Hit rate', value: fmtRate(t.hit) },
    { label: 'Median price', value: t.avg_price != null ? fmtOdds(t.avg_price) : '—' },
    { label: 'Best card', value: best ? fmtUnits(best.profit) : '—', tone: best?.profit },
    { label: 'Avg. edge taken', value: fmtPct(t.avg_ev) },
  ]

  return (
    <div className={cn(CARD, 'flex flex-wrap overflow-hidden')}>
      <div className="flex max-w-[360px] flex-[1_1_270px] flex-col gap-3 border-r border-border/60 bg-gradient-to-b from-emerald-50 to-card to-70% px-5 py-[18px] dark:from-emerald-950/40">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-emerald-700 dark:text-emerald-400">Profit since {startLabel}</div>
          <div className={cn('mt-1.5 text-[46px] font-extrabold leading-none tracking-tight tabular-nums', toneCls(t.profit))}>{fmtUnits(t.profit)}</div>
          <div className="mt-1.5 text-[13px] tabular-nums text-muted-foreground">
            <b className="text-foreground">{fmtPct(t.roi)}</b> ROI on <b className="text-foreground">{(t.n ?? 0).toLocaleString()}</b> bets
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {t.ci && (
            <span title="95% confidence interval for ROI" className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold',
              ciClear ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {ciClear ? 'Edge confirmed' : 'Trending up'} · CI {fmtPct(t.ci[0], 0)} to {fmtPct(t.ci[1], 0)}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-primary/[0.06] px-2.5 py-1 text-[11.5px] font-bold text-primary dark:bg-primary/15 dark:text-red-300">
            {atHigh ? 'At an all-time high' : `${fmtUnits(ath - last).replace('+', '')} off the high`}
          </span>
        </div>
        <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border">
          {stats.map((s) => (
            <div key={s.label} className="bg-card px-3 py-2">
              <div className={cn('text-[17px] font-extrabold tabular-nums', s.tone != null ? toneCls(s.tone) : 'text-foreground')}>{s.value}</div>
              <div className="mt-px text-[10.5px] font-semibold text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-[999_1_460px] flex-col px-4 pb-2.5 pt-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-extrabold">Bankroll growth</span>
            <span className="text-[11.5px] text-muted-foreground">Hover to scrub · click a point to open that card</span>
          </div>
          <div className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
            {RANGES.map(([label, m]) => (
              <button key={label} type="button" onClick={() => setRange(m)}
                className={cn('rounded-md px-2.5 py-1 text-[11.5px] font-bold transition',
                  activeRange === label ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <GrowthChart data={cum} short={['3M', '6M', '1Y'].includes(activeRange)} onPoint={(p) => onEvent(p.event_id)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- market cards

function MarketCards({ data, filters, onFilters }) {
  const all = MARKETS.map((m) => m.key)
  const isOn = (k) => !filters.markets.length || filters.markets.includes(k)
  const toggle = (k) => {
    const cur = filters.markets.length ? filters.markets : all
    const next = isOn(k) ? cur.filter((x) => x !== k) : [...new Set([...cur, k])]
    if (!next.length) return
    onFilters({ ...filters, markets: next.length === all.length ? [] : all.filter((x) => next.includes(x)) })
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-6">
      {MARKETS.map((m) => {
        const t = data.by_group?.[m.key]
        const on = isOn(m.key)
        const spark = (data.cumulative || []).some((r) => r[m.key] != null) ? data.cumulative.map((r) => r[m.key] ?? 0) : null
        return (
          <button key={m.key} type="button" onClick={() => toggle(m.key)} aria-pressed={on}
            className={cn(CARD, 'rounded-xl px-3 pb-2 pt-2.5 text-left transition hover:shadow-md', !on && 'opacity-45')}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-foreground/80">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: MARKET_COLOR[m.key] }} />{m.label}
              </span>
              <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border-[1.5px] text-[10px] font-black text-white"
                style={on ? { background: MARKET_COLOR[m.key], borderColor: MARKET_COLOR[m.key] } : { borderColor: 'var(--color-border)' }}>
                {on ? '✓' : ''}
              </span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div>
                <div className={cn('text-[20px] font-extrabold leading-tight tabular-nums', t ? toneCls(t.profit) : 'text-muted-foreground')}>{t ? fmtUnits(t.profit) : '—'}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold tabular-nums text-muted-foreground">
                  {t ? `${fmtPct(t.roi)} ROI · ${t.n.toLocaleString()} bets` : 'Not selected'}
                </div>
              </div>
              {spark && <Sparkline values={spark} color={MARKET_COLOR[m.key]} />}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- heatmap

function Heatmap({ events, selId, onEvent }) {
  const years = useMemo(() => {
    const byYear = new Map()
    for (const e of events) {
      const y = e.date.slice(0, 4)
      if (!byYear.has(y)) byYear.set(y, { year: y, cells: Array(53).fill(null), total: 0 })
      const row = byYear.get(y)
      const d = new Date(`${e.date}T00:00:00`)
      const w = Math.min(52, Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 864e5 / 7))
      row.cells[w] = e
      row.total += e.profit || 0
    }
    return [...byYear.values()].sort((a, b) => b.year.localeCompare(a.year))
  }, [events])
  const monthCol = (i) => Math.floor((new Date(2025, i, 1) - new Date(2025, 0, 1)) / 864e5 / 7) + 1
  const grid = 'grid grid-cols-[repeat(53,minmax(0,1fr))] gap-[3px]'

  return (
    <div className={cn(CARD, 'px-4 py-3.5')}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-extrabold">Every card</span>
          <span className="text-[11.5px] text-muted-foreground">One square per event · click to open</span>
        </div>
      </div>
      <div className="grid grid-cols-[36px_minmax(0,1fr)_62px] items-center gap-x-2.5 gap-y-1">
        <span />
        <div className={grid}>
          {MONTHS.map((l, i) => (
            <span key={l} className="row-start-1 whitespace-nowrap text-[10px] font-semibold text-muted-foreground" style={{ gridColumn: `${monthCol(i)} / span 4` }}>{l}</span>
          ))}
        </div>
        <span className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Year</span>
        {years.map((y) => (
          <div key={y.year} className="contents">
            <span className="text-[11.5px] font-bold tabular-nums text-muted-foreground">{y.year}</span>
            <div className={grid}>
              {y.cells.map((e, i) => e ? (
                <button key={i} type="button" onClick={() => onEvent(e.event_id)}
                  title={`${e.name} · ${longDate(e.date)} · ${e.n ? `${fmtUnits(e.profit)} on ${e.n} bets` : 'no bets'}`}
                  className={cn('h-[15px] rounded-[3px] transition-transform hover:scale-125', heatCls(e),
                    e.event_id === selId && 'ring-2 ring-foreground ring-offset-1 ring-offset-card')} />
              ) : <span key={i} className="h-[15px] rounded-[3px] bg-muted/50" />)}
            </div>
            <span className={cn('text-right text-[12px] font-extrabold tabular-nums', toneCls(y.total))}>{fmtUnits(y.total)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10.5px] font-semibold text-muted-foreground">
        <span className="mr-1">Down</span>
        {LEGEND.map((c) => <span key={c} className={cn('h-3 w-3 rounded-[3px]', c)} />)}
        <span className="ml-1">Up</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- events list

function EventList({ events, selId, onEvent, jump }) {
  const rail = useRef(null)
  // a jump from the heatmap / chart (not a click in this list) centres that event in the rail,
  // as the upcoming-fights page does with its event rail
  useEffect(() => {
    const el = jump && rail.current?.querySelector(`[data-event="${jump.id}"]`)
    if (el) rail.current.scrollTo({ top: Math.max(0, el.offsetTop - rail.current.clientHeight / 2 + el.offsetHeight / 2), behavior: 'smooth' })
  }, [jump])
  const maxAbs = Math.max(1, ...events.map((e) => Math.abs(e.profit || 0)))
  const months = useMemo(() => {
    const out = []
    for (const e of events) {                       // newest first
      const k = e.date.slice(0, 7)
      let g = out[out.length - 1]
      if (!g || g.key !== k) { g = { key: k, profit: 0, events: [] }; out.push(g) }
      g.profit += e.profit || 0
      g.events.push(e)
    }
    return out
  }, [events])
  return (
    <div className={cn(CARD, PANEL_H, 'flex max-w-[460px] flex-[1_1_340px] flex-col overflow-hidden')}>
      <div className="flex shrink-0 items-baseline justify-between border-b border-border/60 px-3.5 pb-2.5 pt-3">
        <span className="text-[14px] font-extrabold">Events</span>
        <span className="text-[11.5px] text-muted-foreground">{events.length} events · newest first</span>
      </div>
      <div ref={rail} className="relative min-h-0 flex-1 overflow-y-auto">
        {months.map((m) => (
          <div key={m.key}>
            <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-border/60 bg-muted/60 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-muted-foreground backdrop-blur">
              <span className="uppercase">{monthLabel(m.key)}</span>
              <span className={cn('tabular-nums', toneCls(m.profit))}>{fmtUnits(m.profit)}</span>
            </div>
            {m.events.map((e) => {
              const sel = e.event_id === selId
              return (
                <button key={e.event_id} type="button" data-event={e.event_id} onClick={() => onEvent(e.event_id)}
                  className={cn('grid w-full grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-2 2xl:grid-cols-[44px_minmax(0,1fr)_52px_56px] border-b border-border/40 px-3.5 py-[7px] text-left transition hover:bg-muted/40',
                    sel && 'bg-primary/[0.06] shadow-[inset_3px_0_0_var(--color-primary)] dark:bg-primary/15')}>
                  <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{dayLabel(e.date)}</span>
                  <span className="min-w-0" title={e.name}>
                    <span className="block truncate text-[12.5px] font-bold">{shortEvent(e.name).title}<SourceBadges sources={e.sources} /></span>
                    <span className="block truncate text-[10.5px] tabular-nums text-muted-foreground">
                      {[shortEvent(e.name).series, e.n ? `${e.n} bets · ${fmtRate(e.hit)} hit` : 'No qualifying bets'].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="relative hidden h-1.5 overflow-hidden rounded-full bg-muted 2xl:block">
                    <span className={cn('absolute inset-y-0 left-0 rounded-full', e.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-300 dark:bg-rose-800')}
                      style={{ width: `${(Math.abs(e.profit || 0) / maxAbs) * 100}%` }} />
                  </span>
                  <span className={cn('text-right text-[12.5px] font-extrabold tabular-nums', toneCls(e.profit))}>{e.n ? fmtUnits(e.profit) : '—'}</span>
                </button>
              )
            })}
          </div>
        ))}
        {!events.length && <p className="p-4 text-[12.5px] text-muted-foreground">No backtested events in this range.</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- selected event

function FightCard({ f, showAll }) {
  const rows = f.markets.flatMap((m) => m.sides.filter((s) => showAll || s.bet).map((s) => ({ s, group: m.group })))
  const name = (side, n) => (
    <span className={f.winner_side === side ? 'font-extrabold text-foreground' : 'font-medium text-muted-foreground'}>{n}</span>
  )
  return (
    <div className="bg-card px-3.5 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <Link to={`/ufc/fights/${f.fight_id}`} className="min-w-0 truncate text-[12.5px] hover:underline">
          {name('red', f.red)} <span className="text-muted-foreground">vs</span> {name('blue', f.blue)}
        </Link>
        {f.n ? <b className={cn('shrink-0 text-[12.5px] tabular-nums', toneCls(f.profit))}>{fmtUnits(f.profit)}</b> : null}
      </div>
      <div className="mb-1.5 mt-px truncate text-[10.5px] text-muted-foreground">
        {shorten(f.result, f)}{f.weight_class ? ` · ${f.weight_class.replace(/^UFC /, '').replace(/ Bout$/, '')}` : ''}<SourceBadges sources={f.sources} />
      </div>
      {rows.map(({ s, group }) => (
        <div key={s.market_key}
          title={[`Model ${fmtRate(s.p)} vs market ${fmtRate(s.q)}`, s.close_only && 'Prop priced at the close', s.clv != null && s.bet && `CLV ${fmtPct(s.clv)}`].filter(Boolean).join(' · ')}
          className={cn('grid grid-cols-[6px_minmax(0,1fr)_40px_38px_54px] items-center gap-2 py-[3px] text-[11.5px] tabular-nums', !s.bet && 'opacity-55')}>
          <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: MARKET_COLOR[group] }} />
          <span className="truncate font-semibold" title={group === 'winner' ? `${s.label} ML` : s.label}>{shortPick(shorten(group === 'winner' ? `${s.label} ML` : s.label, f))}</span>
          <span className="text-right text-muted-foreground">{fmtOdds(s.price)}</span>
          <span className={cn('text-right font-bold', s.ev > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{fmtPct(s.ev, 0)}</span>
          <span className={cn('rounded-[5px] py-0.5 text-center text-[11px] font-extrabold',
            !s.bet ? 'text-muted-foreground' : s.profit > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
            {s.bet ? fmtUnits(s.profit) : 'pass'}
          </span>
        </div>
      ))}
    </div>
  )
}

function EventDetail({ eventId, filters }) {
  const q = resultsQuery(filters, { dates: false })
  const path = pastResultsPath.event(eventId, q)
  const [got, setGot] = useState({})
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    if (!eventId) return
    let live = true
    fetchPastResultsEvent(eventId, q)
      .then((d) => live && setGot((g) => ({ ...g, [path]: { data: d } })))
      .catch((e) => live && setGot((g) => ({ ...g, [path]: { error: e.message } })))
    return () => { live = false }
  }, [eventId, q, path])
  const data = got[path]?.data || peekCached(path)
  const shell = cn(CARD, PANEL_H, 'flex min-w-0 flex-[999_1_480px] flex-col overflow-hidden')
  if (!eventId) return <div className={cn(shell, 'p-4 text-[12.5px] text-muted-foreground')}>Pick an event to see its bets.</div>
  if (got[path]?.error) return <div className={cn(shell, 'p-4 text-[12.5px] text-destructive')}>{got[path].error}</div>
  if (!data) return <div className={shell}><div className="m-4 h-40 animate-pulse rounded-xl bg-muted/60" /></div>

  const t = data.totals
  const fights = data.fights.filter((f) => showAll || f.n)   // card order from the API: main event first
  const passed = data.fights.filter((f) => !f.n)
  const groups = MARKETS.filter((m) => data.by_group?.[m.key]?.n)
  return (
    <div className={shell}>
      <div className={cn('flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5',
        t.profit > 0 && 'bg-gradient-to-r from-emerald-50 to-card to-60% dark:from-emerald-950/40')}>
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold text-muted-foreground">{longDate(data.date)}</div>
          <h2 className="mt-0.5 text-[19px] font-extrabold tracking-tight">{data.name}<SourceBadges sources={data.sources} /></h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {groups.map((m) => (
              <span key={m.key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-bold tabular-nums">
                <span className="h-[7px] w-[7px] rounded-[2px]" style={{ background: MARKET_COLOR[m.key] }} />
                {m.label} <span className={toneCls(data.by_group[m.key].profit)}>{fmtUnits(data.by_group[m.key].profit)}</span>
              </span>
            ))}
            <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Checkbox className="size-3.5 rounded-[3px] border-border" checked={showAll} onCheckedChange={(c) => setShowAll(!!c)} />
              Show passed markets
            </label>
          </div>
        </div>
        <div className="flex gap-[18px] text-right tabular-nums">
          {[
            { label: 'Profit', value: fmtUnits(t.profit), tone: t.profit },
            { label: 'ROI', value: fmtPct(t.roi, 0), tone: t.roi },
            { label: 'Bets', value: t.n },
            { label: 'Hit rate', value: fmtRate(t.hit) },
          ].map((s) => (
            <div key={s.label}>
              <div className={cn('text-[22px] font-extrabold leading-none', s.tone != null ? toneCls(s.tone) : 'text-foreground')}>{s.value}</div>
              <div className="mt-1 text-[10.5px] font-semibold text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div key={eventId} className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-px bg-border/60 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {fights.map((f) => <FightCard key={f.fight_id} f={f} showAll={showAll} />)}
      </div>
      {(!showAll && passed.length > 0) && (
        <div className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          No qualifying edge: {passed.map((f) => `${lastName(f.red)} vs ${lastName(f.blue)}`).join(' · ')}
        </div>
      )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- tab

export default function PastEventsTab({ data, filters, onFilters, eventId, onEvent }) {
  const events = data.events || []                 // newest first
  const selId = eventId || events.find((e) => e.n)?.event_id || events[0]?.event_id
  const panels = useRef(null)
  const [jump, setJump] = useState(null)
  // from the heatmap or the chart: select it, centre it in the list, and if the card results
  // aren't on screen, scroll the page down to them (only the page's own scroller: scrollIntoView
  // would also scroll the layout's clipped ancestors)
  const jumpTo = (id) => {
    onEvent(id)
    setJump({ id, at: Date.now() })
    const el = panels.current
    const page = el?.parentElement?.closest('.overflow-y-auto')
    if (!el || !page) return
    const r = el.getBoundingClientRect(), v = page.getBoundingClientRect()
    const fullyShown = r.top >= v.top - 1 && r.bottom <= v.bottom + 4   // panels are capped below the window height
    if (!fullyShown) {
      page.scrollTo({ top: page.scrollTop + (r.top - v.top) - 12, behavior: 'smooth' })
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <Hero data={data} filters={filters} onFilters={onFilters} onEvent={jumpTo} />
      <MarketCards data={data} filters={filters} onFilters={onFilters} />
      <Heatmap events={events} selId={selId} onEvent={jumpTo} />
      <div ref={panels} className="flex flex-wrap items-stretch gap-3">
        <EventList events={events} selId={selId} onEvent={onEvent} jump={jump} />
        <EventDetail eventId={selId} filters={filters} />
      </div>
    </div>
  )
}

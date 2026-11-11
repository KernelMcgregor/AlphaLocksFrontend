import { Calendar, Check, ChevronDown, Info, Loader2, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import { Card } from '../components/ui/card'
import BeltIcon from '../components/ui/belt-icon'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Tip } from '../components/ui/tip'
import PageLoader from '../components/PageLoader'
import FighterImage from '../components/sports/FighterImage'
import WavingFlag from '../components/sports/WavingFlag'
import { fetchEventDetail, fetchEvents, peekCached, searchFights } from '../lib/api'
import { cn, formatDate, formatOdds } from '../lib/utils'

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

// "UFC 332: Silva vs. Wang" -> kicker "UFC 332", title the matchup. A numbered card's
// kicker is what people know it by, so it leads the line in red.
function parseEventName(name = '') {
  const i = name.indexOf(':')
  const kicker = i < 0 ? null : name.slice(0, i).trim()
  return {
    kicker,
    title: i < 0 ? name : name.slice(i + 1).trim(),
    numbered: /^UFC\s+\d+/i.test(kicker || ''),
  }
}

function EventName({ name, className, kickerClass }) {
  const { kicker, title, numbered } = parseEventName(name)
  return (
    <span className={className}>
      {kicker && (
        <span className={cn('mr-1.5', numbered ? 'font-extrabold text-primary' : 'font-bold text-muted-foreground', kickerClass)}>
          {numbered ? kicker : kicker.replace(/^UFC\s+/i, '')}
        </span>
      )}
      {title}
    </span>
  )
}

// "UFC Lightweight Title Bout" -> { label: 'Lightweight', title: true }
function weightOf(wc = '') {
  const title = /title/i.test(wc)
  const label = wc.replace(/^UFC\s+/i, '').replace(/\s*(Title\s*)?Bout$/i, '').replace(/\s*Title$/i, '').trim()
  return { label: label || 'Catchweight', title }
}

// Finish method, shortened, with the token key that colours it everywhere on the site.
function methodOf(method) {
  if (!method) return null
  if (/^KO|TKO/i.test(method)) return { key: 'ko', label: 'KO/TKO' }
  if (/^Sub/i.test(method)) return { key: 'sub', label: 'Submission' }
  const dec = method.match(/^Decision\s*-\s*(\w)/i)
  if (dec) return { key: 'dec', label: `Decision (${dec[1].toUpperCase()})` }
  if (/^Decision/i.test(method)) return { key: 'dec', label: 'Decision' }
  return { key: null, label: method }
}

const lastName = (f) => f?.last_name || f?.first_name || 'TBA'
const fullName = (f) => (f ? `${f.first_name || ''} ${f.last_name || ''}`.trim() : 'TBA')
const record = (f) => (f ? `${f.wins ?? 0}-${f.losses ?? 0}${f.draws ? `-${f.draws}` : ''}` : '')
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean)

// Everything a row or the hero needs about one bout, derived once.
function describe(fight, index) {
  const red = fight.red_fighter
  const blue = fight.blue_fighter
  const winnerId = fight.winner_id ? String(fight.winner_id) : null
  const winner = winnerId === String(red?.id) ? 'red' : winnerId === String(blue?.id) ? 'blue' : null
  const done = !!fight.method || !!winnerId
  const tot = { red: null, blue: null }
  for (const s of fight.stats || []) if (s.round_number === 0 && (s.corner === 'red' || s.corner === 'blue')) tot[s.corner] = s
  const weight = weightOf(fight.weight_class)
  return {
    fight, red, blue, winner, done, weight,
    rounds: weight.title || index === 0 ? 5 : 3,
    method: methodOf(fight.method),
    outcome: done && !winner ? (/no contest|overturned/i.test(fight.method || '') ? 'No contest' : 'Draw') : null,
    // Upcoming bouts ship zero-filled placeholder rows, so stats count only once fought.
    stats: done && tot.red && tot.blue ? tot : null,
    dtw: fight.deserve_to_win || null,
  }
}

// ---------------------------------------------------------------------------
// Event filter: numbered events only, and a date range; applied to the list and both
// search sections
// ---------------------------------------------------------------------------
const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: '1y', label: 'Last year', years: 1 },
  { key: '5y', label: 'Last 5 years', years: 5 },
  { key: '10y', label: 'Last 10 years', years: 10 },
]
const NO_FILTER = { numberedOnly: false, preset: 'all', from: '', to: '' }

function passesFilter(f, name, date) {
  if (f.numberedOnly && !parseEventName(name).numbered) return false
  const d = date?.slice(0, 10)
  if (f.from && d < f.from) return false
  if (f.to && d > f.to) return false
  return true
}

function EventFilter({ filter, onChange }) {
  const active = (filter.numberedOnly ? 1 : 0) + (filter.preset !== 'all' ? 1 : 0)
  const setPreset = (p) => {
    if (!p.years) return onChange({ ...filter, preset: 'all', from: '', to: '' })
    const d = new Date()
    d.setFullYear(d.getFullYear() - p.years)
    onChange({ ...filter, preset: p.key, from: d.toISOString().slice(0, 10), to: '' })
  }
  const chip = (on) => cn(
    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
    on ? 'border-slate-700 bg-slate-700 text-white' : 'border-border text-foreground/80 hover:border-slate-400',
  )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
          active ? 'border-primary/50 bg-primary/[0.06] text-primary' : 'border-border text-foreground/80 hover:bg-muted',
        )}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
          {active > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-white">{active}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[290px] space-y-3.5 p-3.5">
        <button onClick={() => onChange({ ...filter, numberedOnly: !filter.numberedOnly })}
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted">
          <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', filter.numberedOnly ? 'border-primary bg-primary text-white' : 'border-border')}>
            {filter.numberedOnly && <Check className="h-3 w-3" />}
          </span>
          <span className="text-[12.5px] font-semibold">Numbered events only</span>
        </button>
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Date range</div>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => (
              <button key={p.key} onClick={() => setPreset(p)} className={chip(filter.preset === p.key)}>{p.label}</button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[['from', 'From'], ['to', 'To']].map(([k, label]) => (
              <label key={k} className="block">
                <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
                <input type="date" value={filter[k]}
                  onChange={(e) => onChange({ ...filter, preset: 'custom', [k]: e.target.value })}
                  className="mt-0.5 h-8 w-full rounded-md border border-border bg-background px-1.5 text-[12px] outline-none focus:border-primary/50" />
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="text-[11px] text-muted-foreground">{active ? `${active} filter${active > 1 ? 's' : ''} on` : 'Showing all events'}</span>
          <button onClick={() => onChange(NO_FILTER)} disabled={!active}
            className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-primary hover:bg-primary/[0.06] disabled:text-muted-foreground disabled:hover:bg-transparent">
            Reset to all
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Left panel: every event, and a search over events and fights
// ---------------------------------------------------------------------------
function EventListItem({ event, isSelected, onClick, onPrefetch }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={cn(
        'relative w-full rounded-lg px-2.5 py-1.5 text-left transition-colors',
        isSelected
          ? 'bg-primary/[0.06] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary'
          : 'hover:bg-muted/60',
      )}
    >
      <EventName name={event.name} className="block text-[13px] font-bold leading-snug" />
      {/* One line: the location truncates (full text on hover, and in the event header). */}
      <div className="mt-0.5 flex items-center gap-x-2.5 text-[11px] text-muted-foreground">
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap"><Calendar className="h-3 w-3" />{formatDate(event.date?.slice(0, 10))}</span>
        {event.location && (
          <span title={event.location} className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{event.location}</span>
          </span>
        )}
      </div>
    </button>
  )
}

// One meeting of two fighters. The row opens the fight page; "Event page" opens its
// card here with this bout highlighted. Event and date, plus "2nd of 3 meetings" for a
// rematch, keep McGregor-Poirier 1, 2 and 3 apart.
function FightHit({ hit, onEvent }) {
  const navigate = useNavigate()
  // Two lines, never wrapped: "W. Cortes Acosta vs J. Walker", then the card's label
  // (UFC 257 / Fight Night) rather than its full matchup, and the date. A rematch
  // carries its number after the names.
  const short = (f) => (f ? `${f.first_name ? `${f.first_name[0]}. ` : ''}${f.last_name || ''}`.trim() : 'TBA')
  const name = (side) => (
    <span className={hit.winner && hit.winner !== side ? 'font-semibold text-muted-foreground' : ''}>{short(hit[side])}</span>
  )
  const card = parseEventName(hit.event_name)
  const go = () => navigate(`/ufc/fights/${hit.id}`)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter') go() }}
      title={`${fullName(hit.red)} vs ${fullName(hit.blue)} · ${hit.event_name}`}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/60"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold leading-snug">
          {name('red')} <span className="text-[11px] font-semibold text-muted-foreground">vs</span> {name('blue')}
          {/* Rematch number, the way cards are billed ("McGregor vs Holloway 2"). */}
          {hit.meeting > 1 && ` ${hit.meeting}`}
        </div>
        <div className="truncate text-[11px] leading-snug text-muted-foreground">
          <span className={card.numbered ? 'font-extrabold text-primary' : 'font-bold'}>
            {card.kicker ? (card.numbered ? card.kicker : card.kicker.replace(/^UFC\s+/i, '')) : card.title}
          </span>
          {' · '}{formatDate(hit.date)}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEvent(hit) }}
        className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground/80 hover:border-primary hover:text-primary"
      >
        Event
      </button>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>
}

// ---------------------------------------------------------------------------
// Pieces shared by the hero and the rows
// ---------------------------------------------------------------------------
function WeightTag({ weight, rounds, className }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/80">{weight.label}</span>
      {rounds && <span className="text-[10px] text-muted-foreground">· {rounds} rds</span>}
      {weight.title && (
        <span className="inline-flex items-center gap-0.5 rounded border border-gold/60 bg-gold/15 px-1 text-[9px] font-extrabold uppercase tracking-wide text-gold-foreground">
          <BeltIcon className="h-2.5 w-2.5" /> Title
        </span>
      )}
    </div>
  )
}

function ResultChip({ d, size = 'sm' }) {
  if (!d.done) return null
  const text = d.outcome || d.method?.label
  // A decision always goes the distance, so its round and time say nothing.
  const when = d.method?.key !== 'dec' && d.fight.finish_round ? `R${d.fight.finish_round}${d.fight.finish_time ? ` ${d.fight.finish_time}` : ''}` : null
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-foreground/80', size === 'sm' ? 'text-[11px]' : 'text-[12.5px]')}>
      {text}{when && <span className="font-normal text-muted-foreground">· {when}</span>}
    </span>
  )
}

// Red value | red bar ← label → blue bar | blue value. The leader's bar is solid and its
// number in its corner colour; the trailer is faded, so the edge reads before the
// numbers do. `rl`/`bl` override the printed value (e.g. "51/77" for a landed count).
function Duel({ label, r, b, fmt = (v) => v, rl, bl, compact, wideNums }) {
  const max = Math.max(r, b, 1)
  const lead = r === b ? null : r > b ? 'red' : 'blue'
  const num = compact ? 'text-[10.5px]' : 'text-[12px]'
  return (
    // `wideNums`: room for "52/103" or "12:06" at compact size (the hero on a laptop).
    <div className={cn('grid items-center', compact
      ? (wideNums ? 'grid-cols-[44px_1fr_54px_1fr_44px] gap-1.5' : 'grid-cols-[28px_1fr_58px_1fr_28px] gap-2')
      : 'grid-cols-[46px_1fr_84px_1fr_46px] gap-2')}>
      <span className={cn('text-right tabular-nums', num, lead === 'red' ? 'font-extrabold text-corner-red' : 'font-semibold text-muted-foreground')}>{rl ?? fmt(r)}</span>
      <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full bg-corner-red transition-[width,opacity] duration-[650ms] ease-out', lead !== 'red' && 'opacity-40')} style={{ width: `${(r / max) * 100}%` }} />
      </div>
      <span className={cn('text-center font-semibold uppercase tracking-wide text-muted-foreground', compact ? 'text-[8.5px]' : 'text-[9.5px]')}>{label}</span>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full bg-corner-blue transition-[width,opacity] duration-[650ms] ease-out', lead !== 'blue' && 'opacity-40')} style={{ width: `${(b / max) * 100}%` }} />
      </div>
      <span className={cn('tabular-nums', num, lead === 'blue' ? 'font-extrabold text-corner-blue' : 'font-semibold text-muted-foreground')}>{bl ?? fmt(b)}</span>
    </div>
  )
}

// Deserve to Win as a gauge: the fight replayed 10,000 times to the full distance and
// scored by three simulated judges (ufc_deserve_to_win). Shown as each fighter's share
// of the replays that had a winner: ~1.5% of replays end level on the cards (split or
// majority draws), and the user wants one or the other, so those are left out and the
// two shares sum to 100.
const DTW_EXPLAINER = 'The fight replayed 10,000 times to the final bell and scored by three judges. '
  + 'The gauge shows who wins more of them. For finishes, the rounds never fought are projected.'

// Eases a number toward `target` (from wherever it currently is), so arc and needle
// sweep together when a different fight is picked. Instant under reduced motion.
function useTweened(target, ms = 650) {
  const [cur, setCur] = useState(target)
  const curRef = useRef(target)
  useEffect(() => {
    const from = curRef.current
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms
    let raf, t0
    const step = (t) => {
      t0 ??= t
      const k = dur ? Math.min(1, (t - t0) / dur) : 1
      const e = 1 - (1 - k) ** 3
      curRef.current = from + (target - from) * e
      setCur(curRef.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return cur
}

// Point on the gauge's semicircle, `t` of the way from the left end (0) to the right (1).
const arcPoint = (t) => [100 - 84 * Math.cos(Math.PI * t), 100 - 84 * Math.sin(Math.PI * t)]

function DeserveGauge({ d }) {
  const dtw = d.dtw
  const decisive = dtw ? dtw.p_red + dtw.p_blue : 0
  const r = dtw && decisive > 0 ? Math.round((dtw.p_red / decisive) * 100) : 50
  const b = 100 - r
  // Red fills its share of the arc from the left, blue the rest; the needle sits on
  // the boundary, so it leans toward blue's end when red deserved it.
  const shown = useTweened(r / 100)
  const [x, y] = arcPoint(shown)
  const deg = shown * 180 - 90
  const header = (
    <div className="flex items-center justify-center gap-1">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/80">Deserve to Win</span>
      <Tip content={<span className="block max-w-[240px] text-[11.5px] leading-snug">{DTW_EXPLAINER}</span>}>
        <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground hover:text-foreground" />
      </Tip>
    </div>
  )
  if (!dtw) {
    return (
      <div>
        {header}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Not scored for this fight yet.</p>
      </div>
    )
  }
  const lead = r >= b ? 'red' : 'blue'
  return (
    <div>
      {header}
      <div className="mt-1 flex items-end justify-center gap-2">
        <span className={cn('w-11 pb-0.5 text-right text-[17px] font-extrabold leading-none tabular-nums', lead === 'red' ? 'text-corner-red' : 'text-muted-foreground/70')}>{r}%</span>
        <svg viewBox="0 0 200 106" className="w-[132px]">
          {shown > 0.001 && <path d={`M 16 100 A 84 84 0 0 1 ${x} ${y}`} fill="none" strokeWidth="14" className="stroke-corner-red" />}
          {shown < 0.999 && <path d={`M ${x} ${y} A 84 84 0 0 1 184 100`} fill="none" strokeWidth="14" className="stroke-corner-blue" />}
          <line x1="100" y1="100" x2="100" y2="34" strokeWidth="4" strokeLinecap="round" className="stroke-foreground"
            transform={`rotate(${deg} 100 100)`} />
          <circle cx="100" cy="100" r="8" className="fill-foreground" />
          <circle cx="100" cy="100" r="3" className="fill-background" />
        </svg>
        <span className={cn('w-11 pb-0.5 text-left text-[17px] font-extrabold leading-none tabular-nums', lead === 'blue' ? 'text-corner-blue' : 'text-muted-foreground/70')}>{b}%</span>
      </div>
    </div>
  )
}

function FightLink({ id, primary }) {
  return (
    <Link
      to={`/ufc/fights/${id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold shadow-sm transition-colors',
        primary
          ? 'bg-primary px-3 py-1.5 text-[12px] text-white hover:bg-primary/85'
          : 'border border-border bg-background px-2 py-px text-[10.5px] text-foreground/80 hover:border-primary hover:text-primary',
      )}
    >
      Fight page
    </Link>
  )
}

// The winner mark, identical on every photo (hero and rows, either corner): a strip
// across the bottom of the portrait.
function WinStrip({ big }) {
  return (
    <span className={cn(
      'absolute inset-x-0 bottom-0 z-20 bg-emerald-600 text-center font-extrabold uppercase tracking-wider text-white',
      big ? 'py-1 text-[11px]' : 'py-px text-[9px]',
    )}>
      {big ? 'Winner' : 'Win'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Hero: the selected fight (the main event by default)
// ---------------------------------------------------------------------------
function HeroPortrait({ fighter, won }) {
  return (
    <div className="relative hidden w-[110px] shrink-0 overflow-hidden bg-muted @min-[600px]/hero:block @min-[760px]/hero:w-[130px] @min-[1150px]/hero:w-[170px]">
      <WavingFlag key={fighter?.country_code} countryCode={fighter?.country_code} />
      <div className="absolute inset-x-0 bottom-0 z-[5] h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
      <FighterImage
        fighter={fighter}
        fit="contain"
        alt={fighter ? fullName(fighter) : ''}
        className="absolute inset-0 z-10 flex items-end justify-center"
        imgClassName="h-[94%] w-auto max-w-none object-bottom"
      />
      {won && <WinStrip big />}
    </div>
  )
}

function HeroName({ fighter, side, d, narrow }) {
  const lost = d.winner && d.winner !== side
  return (
    <div className={cn('min-w-0', side === 'red' && 'text-right')}>
      <div className="truncate text-[11px] text-muted-foreground">{fighter?.first_name}</div>
      {/* Two lines reserved when narrow, so a name that wraps doesn't grow the panel. */}
      <div className={cn(
        'flex font-display font-extrabold italic uppercase leading-none tracking-tight',
        side === 'red' ? 'justify-end' : 'justify-start',
        narrow ? 'h-[42px] items-center text-[21px]' : 'h-[28px] items-center text-[28px]',
        lost ? 'text-muted-foreground/60' : side === 'red' ? 'text-corner-red' : 'text-corner-blue',
      )}>
        <span className={narrow ? 'line-clamp-2' : 'truncate'}>{lastName(fighter)}</span>
      </div>
      <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">{record(fighter)}</div>
    </div>
  )
}

const pct = (l, a) => (a ? Math.round((l / a) * 100) : 0)

// Width of an element, kept current. The hero's middle column changes size with the
// window, the events list and whether the portraits fit, so its layout is picked from
// what it actually measures.
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function StatBlock({ title, children }) {
  return (
    <div className="space-y-1">
      <div className="text-center text-[9.5px] font-extrabold uppercase tracking-wider text-foreground/70">{title}</div>
      {children}
    </div>
  )
}

function FightHero({ d }) {
  const { fight } = d
  const r = d.stats?.red
  const b = d.stats?.blue
  const v = (s, k) => s?.[k] ?? 0
  const [centerRef, cw] = useWidth()
  const narrow = cw > 0 && cw < 600     // laptop: names wrap, compact stat bars
  const stacked = cw > 0 && cw < 400    // phone: gauge under the names, stats in one column
  return (
    // Sized by its own width (container queries), not the window's: the events list and
    // the app sidebar take a different share of a laptop and a desktop. Narrower, the
    // portraits slim down (gone only on phones), the result drops under the weight
    // class, the gauge sits under the names and the stats stack.
    <div className="@container/hero flex overflow-hidden rounded-xl border border-border bg-card">
      <HeroPortrait fighter={d.red} won={d.winner === 'red'} />

      <div ref={centerRef} className="mx-auto flex w-full min-w-0 max-w-[920px] flex-1 flex-col gap-2 px-4 py-3">
        {/* weight · result · button, one line. Decisions' `details` are the judges'
            cards: left to the fight page. A finish's details ("Punch to Head") stay. */}
        <div className="flex h-7 items-center gap-3">
          <WeightTag weight={d.weight} rounds={d.rounds} className="shrink-0" />
          {d.done && (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="whitespace-nowrap text-[12.5px] font-bold">
                {d.winner ? `${lastName(d.winner === 'red' ? d.red : d.blue)} wins` : d.outcome}
              </span>
              <ResultChip d={d} size="md" />
              {fight.details && d.method?.key !== 'dec' && !narrow && (
                <span className="truncate text-[11px] text-muted-foreground">{fight.details}</span>
              )}
            </div>
          )}
          <span className="ml-auto shrink-0"><FightLink id={fight.id} primary /></span>
        </div>

        {/* names, with the model's split between them */}
        <div className={cn(
          'grid items-center gap-x-3 gap-y-2 border-y border-border py-2',
          stacked ? 'grid-cols-2' : narrow ? 'grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(200px,270px)_minmax(0,1fr)] gap-x-4',
        )}>
          <HeroName fighter={d.red} side="red" d={d} narrow={narrow} />
          <div className={stacked ? 'col-span-2 row-start-2' : ''}>
            <DeserveGauge d={d} />
          </div>
          <HeroName fighter={d.blue} side="blue" d={d} narrow={narrow} />
        </div>

        {/* the fight, in numbers */}
        {d.stats ? (
          <div className={cn('grid gap-y-2', stacked ? 'grid-cols-1' : 'grid-cols-2', narrow ? 'gap-x-4' : 'gap-x-6')}>
            <StatBlock title="Striking">
              <Duel compact={narrow} wideNums label={narrow ? 'Sig str' : 'Sig. strikes'} r={v(r, 'sig_str_landed')} b={v(b, 'sig_str_landed')}
                rl={`${v(r, 'sig_str_landed')}/${v(r, 'sig_str_attempted')}`} bl={`${v(b, 'sig_str_landed')}/${v(b, 'sig_str_attempted')}`} />
              <Duel compact={narrow} wideNums label="Accuracy" r={pct(v(r, 'sig_str_landed'), v(r, 'sig_str_attempted'))} b={pct(v(b, 'sig_str_landed'), v(b, 'sig_str_attempted'))} fmt={(x) => `${x}%`} />
              <Duel compact={narrow} wideNums label={narrow ? 'KD' : 'Knockdowns'} r={v(r, 'kd')} b={v(b, 'kd')} />
              <Duel compact={narrow} wideNums label="Head" r={v(r, 'head_landed')} b={v(b, 'head_landed')} />
              <Duel compact={narrow} wideNums label={narrow ? 'Body·leg' : 'Body · Leg'} r={v(r, 'body_landed') + v(r, 'leg_landed')} b={v(b, 'body_landed') + v(b, 'leg_landed')}
                rl={`${v(r, 'body_landed')}·${v(r, 'leg_landed')}`} bl={`${v(b, 'body_landed')}·${v(b, 'leg_landed')}`} />
            </StatBlock>
            <StatBlock title="Grappling">
              <Duel compact={narrow} wideNums label={narrow ? 'TD' : 'Takedowns'} r={v(r, 'td_landed')} b={v(b, 'td_landed')}
                rl={`${v(r, 'td_landed')}/${v(r, 'td_attempted')}`} bl={`${v(b, 'td_landed')}/${v(b, 'td_attempted')}`} />
              <Duel compact={narrow} wideNums label="Control" r={v(r, 'ctrl_seconds')} b={v(b, 'ctrl_seconds')} fmt={mmss} />
              <Duel compact={narrow} wideNums label={narrow ? 'Sub att' : 'Sub attempts'} r={v(r, 'sub_att')} b={v(b, 'sub_att')} />
              <Duel compact={narrow} wideNums label={narrow ? 'Rev' : 'Reversals'} r={v(r, 'rev')} b={v(b, 'rev')} />
              <Duel compact={narrow} wideNums label={narrow ? 'Ground' : 'Ground str'} r={v(r, 'ground_landed')} b={v(b, 'ground_landed')} />
            </StatBlock>
          </div>
        ) : (
          <p className="flex h-[118px] items-center justify-center text-[11px] text-muted-foreground">No fight stats recorded for this bout.</p>
        )}
      </div>

      <HeroPortrait fighter={d.blue} won={d.winner === 'blue'} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card rows
// ---------------------------------------------------------------------------
function RowTile({ fighter, won }) {
  return (
    <div className="relative hidden w-14 shrink-0 self-stretch overflow-hidden bg-card sm:block">
      <FighterImage fighter={fighter} className="absolute inset-0" imgClassName="object-top" />
      {won && <WinStrip />}
    </div>
  )
}

// Name and record on the outside; odds get their own column on the inside.
function RowName({ fighter, side, d }) {
  const lost = d.winner && d.winner !== side
  const name = lastName(fighter)
  // Wrap only at spaces ("Cortes Acosta" takes two lines); a long single word shrinks to
  // the column instead of breaking mid-word. 0.78em: a bold uppercase glyph plus margin.
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length), 1)
  const fontSize = `min(13.5px, calc(100cqw / ${(longest * 0.78).toFixed(2)}))`
  return (
    <div className={cn('@container min-w-0', side === 'blue' && 'text-right')}>
      <div className={cn('flex items-center gap-1 text-[10.5px] text-muted-foreground', side === 'blue' && 'justify-end')}>
        {side === 'red' && <CountryFlag countryCode={fighter?.country_code} />}
        <span className="truncate">{fighter?.first_name}</span>
        {side === 'blue' && <CountryFlag countryCode={fighter?.country_code} />}
      </div>
      <div style={{ fontSize }} className={cn('line-clamp-2 font-extrabold uppercase leading-[1.1] tracking-tight', lost ? 'text-muted-foreground/60' : 'text-foreground')}>
        {name}
      </div>
      <div className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">{record(fighter)}</div>
    </div>
  )
}

function OddsCell({ odds }) {
  if (odds == null) return <span className="text-center text-[11px] text-muted-foreground/50">–</span>
  return (
    <span className={cn('text-center text-[11.5px] tabular-nums', odds < 0 ? 'font-extrabold text-foreground' : 'font-semibold text-muted-foreground')}>
      {formatOdds(odds)}
    </span>
  )
}

function FightRow({ d, selected, onSelect }) {
  const { fight, stats } = d
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={cn(
        'flex h-[94px] cursor-pointer overflow-hidden rounded-lg border bg-card transition-colors',
        selected ? 'border-foreground/70 ring-1 ring-foreground/70' : 'border-border hover:bg-muted/40',
      )}
    >
      <RowTile fighter={d.red} won={d.winner === 'red'} />
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_36px_minmax(146px,210px)_36px_minmax(0,1fr)] items-center gap-2 px-2.5">
        <RowName fighter={d.red} side="red" d={d} />
        <OddsCell odds={fight.red_odds} />

        <div className="flex min-w-0 flex-col gap-[3px] py-2">
          <WeightTag weight={d.weight} className="justify-center" />
          {stats ? (
            <>
              <Duel compact label="Sig str" r={stats.red.sig_str_landed ?? 0} b={stats.blue.sig_str_landed ?? 0} />
              <Duel compact label="TD" r={stats.red.td_landed ?? 0} b={stats.blue.td_landed ?? 0} />
            </>
          ) : (
            <span className="py-1.5 text-center text-[10.5px] text-muted-foreground">No fight stats recorded</span>
          )}
          <div className="mt-0.5 flex items-center justify-center gap-2.5">
            {d.done ? <ResultChip d={d} /> : <span className="text-[10.5px] text-muted-foreground">{d.rounds} rounds</span>}
            <FightLink id={fight.id} />
          </div>
        </div>

        <OddsCell odds={fight.blue_odds} />
        <RowName fighter={d.blue} side="blue" d={d} />
      </div>
      <RowTile fighter={d.blue} won={d.winner === 'blue'} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// The whole UFC history (~1,300 cards) in one request; the list and its search are
// client-side. The path must match what fetchEvents({ limit: 2000 }) requests.
const EVENTS_PATH = '/ufc/events?limit=2000'
// Newest first, completed cards only (upcoming ones live on the Upcoming page). A
// sorted copy: the array is the api cache's own, shared with every other reader.
function completed(events) {
  const today = new Date().toISOString().slice(0, 10)
  return events.filter((e) => e.date?.slice(0, 10) <= today).sort((a, b) => new Date(b.date) - new Date(a.date))
}

export default function UFCPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Seeded from the client cache, so a return visit renders on the first frame.
  const [events, setEvents] = useState(() => completed(peekCached(EVENTS_PATH) || []))
  const [loading, setLoading] = useState(() => !peekCached(EVENTS_PATH))
  const selectedEventId = searchParams.get('event') || null
  const selectedFightId = searchParams.get('fight') || null
  // Event and fight both live in the URL, so a highlighted bout is linkable.
  const select = (eventId, fightId) => {
    const next = {}
    if (eventId) next.event = String(eventId)
    if (fightId) next.fight = String(fightId)
    setSearchParams(next, { replace: true })
  }
  // The last event that finished loading; while it differs from the selection, the
  // previous card stays on screen (dimmed) instead of flashing to a spinner.
  const [loaded, setLoaded] = useState({ id: null, detail: null })
  const [eventsExpanded, setEventsExpanded] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(NO_FILTER)
  const [fightHits, setFightHits] = useState({ q: '', rows: [] })
  const latestQuery = useRef('')
  const heroRef = useRef(null)

  useEffect(() => {
    fetchEvents({ limit: 2000 })
      .then((all) => setEvents(completed(all)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Newest first, so the default is the most recent card.
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) select(events[0].id)
  }, [events]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedEventId) return
    let live = true
    fetchEventDetail(selectedEventId)
      .then((detail) => live && setLoaded({ id: selectedEventId, detail }))
      .catch(() => live && setLoaded({ id: selectedEventId, detail: null }))
    return () => { live = false }
  }, [selectedEventId])

  // Fight search: debounced, and only the latest query's answer is kept.
  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) return
    const t = setTimeout(() => {
      latestQuery.current = q
      searchFights(q)
        .then((rows) => latestQuery.current === q && setFightHits({ q, rows }))
        .catch(() => latestQuery.current === q && setFightHits({ q, rows: [] }))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  if (loading) return <PageLoader />

  const eventDetail = loaded.detail
  const eventLoading = loaded.id !== selectedEventId
  const fights = eventDetail?.fights || []
  const rows = fights.map((f, i) => describe(f, i))
  // The main event (first on the card) unless a row has been picked.
  const hero = rows.find((r) => String(r.fight.id) === selectedFightId) || rows[0]
  const pickFight = (id) => {
    select(selectedEventId, id)
    // Wherever the highlighted fight has scrolled to (phones, short laptops), bring it back.
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  const selectedEvent = events.find((e) => String(e.id) === String(selectedEventId))
  const prefetch = (id) => { fetchEventDetail(id).catch(() => {}) }

  const searching = q.length >= 2
  const qWords = words(q)
  const shownEvents = events.filter((e) => passesFilter(filter, e.name, e.date))
  const shownFightHits = fightHits.rows.filter((h) => passesFilter(filter, h.event_name, h.date))
  const eventHits = searching
    ? shownEvents.filter((e) => {
      const hay = `${e.name} ${e.location || ''}`.toLowerCase()
      return qWords.every((w) => hay.includes(w))
    }).slice(0, 30)
    : []
  const fightsLoading = searching && fightHits.q !== q
  // Year headers break up the full list (newest first).
  const byYear = []
  if (!searching) {
    for (const e of shownEvents) {
      const y = e.date?.slice(0, 4)
      if (!byYear.length || byYear[byYear.length - 1].year !== y) byYear.push({ year: y, events: [] })
      byYear[byYear.length - 1].events.push(e)
    }
  }
  const openEvent = (eventId, fightId) => {
    select(eventId, fightId)
    setQuery('')
    setEventsExpanded(false)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto md:overflow-hidden">
      <h1 className="page-title flex shrink-0 items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Calendar className="h-5 w-5 text-white" />
        </span>
        Events & Fights
      </h1>
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:overflow-hidden">
        {/* Events list + search */}
        <Card className="flex min-h-0 shrink-0 flex-col overflow-hidden p-0 md:w-[300px] 2xl:w-[330px]">
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">
                Events
              </span>
              <EventFilter filter={filter} onChange={setFilter} />
              <button
                onClick={() => setEventsExpanded(!eventsExpanded)}
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', !eventsExpanded && '-rotate-90')} />
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setEventsExpanded(true) }}
                placeholder="Search events or fights"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {!eventsExpanded && selectedEvent && (
              <p className="truncate text-xs text-muted-foreground md:hidden">Selected: {selectedEvent.name}</p>
            )}
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-2 pb-2', !eventsExpanded && 'hidden md:block')}>
            {searching ? (
              <>
                <SectionLabel>Fights</SectionLabel>
                {fightsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching fights…</div>
                ) : shownFightHits.length === 0 ? (
                  <p className="px-3 py-1 text-[12px] text-muted-foreground">No fights match.</p>
                ) : (
                  shownFightHits.map((hit) => (
                    <FightHit key={hit.id} hit={hit} onEvent={(h) => openEvent(h.event_id, h.id)} />
                  ))
                )}
                <SectionLabel>Events</SectionLabel>
                {eventHits.length === 0 ? (
                  <p className="px-3 py-1 text-[12px] text-muted-foreground">No events match.</p>
                ) : (
                  eventHits.map((event) => (
                    <EventListItem
                      key={event.id}
                      event={event}
                      isSelected={String(selectedEventId) === String(event.id)}
                      onPrefetch={() => prefetch(event.id)}
                      onClick={() => openEvent(event.id)}
                    />
                  ))
                )}
              </>
            ) : shownEvents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No events match these filters.
                <button onClick={() => setFilter(NO_FILTER)} className="mt-1 block w-full text-[12px] font-semibold text-primary">Reset to all</button>
              </div>
            ) : (
              byYear.map(({ year, events: list }) => (
                <div key={year}>
                  <div className="sticky top-0 z-10 bg-card/95 px-3 pb-1 pt-2.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground backdrop-blur">
                    {year}
                  </div>
                  {list.map((event) => (
                    <EventListItem
                      key={event.id}
                      event={event}
                      isSelected={String(selectedEventId) === String(event.id)}
                      // Hovering starts the load (both calls are client-cached), so the
                      // card is usually ready by the time it is clicked.
                      onPrefetch={() => prefetch(event.id)}
                      onClick={() => openEvent(event.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Event: header, highlighted fight, then the card */}
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {selectedEventId && eventLoading && !eventDetail && (
            <div className="flex flex-1 items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {eventDetail && (
            <>
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-3.5">
                <h2 className="min-w-0 text-lg font-extrabold leading-tight tracking-tight">
                  <EventName name={eventDetail.name} />
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(eventDetail.date?.slice(0, 10))}</span>
                  {eventDetail.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{eventDetail.location}</span>}
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-semibold text-foreground/80">{fights.length} fights</span>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No fights for this event.</p>
              ) : (
                // Tall screens: the highlighted fight stays put and the card scrolls under it.
                // Short ones (laptops): the whole side scrolls, or the card is left a sliver.
                <div className={cn('min-h-0 flex-1 overflow-y-auto transition-opacity [@media(min-height:820px)]:flex [@media(min-height:820px)]:flex-col [@media(min-height:820px)]:overflow-hidden', eventLoading && 'opacity-60')}>
                  <div ref={heroRef} className="shrink-0 scroll-mt-3 px-4">
                    <FightHero d={hero} />
                  </div>
                  <div className="mt-3 shrink-0 px-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/80">Fight card</div>
                  <div className="grid auto-rows-min grid-cols-1 gap-1.5 px-4 pb-4 2xl:grid-cols-2 [@media(min-height:820px)]:min-h-0 [@media(min-height:820px)]:flex-1 [@media(min-height:820px)]:overflow-y-auto">
                    {rows.map((d) => (
                      <FightRow key={d.fight.id} d={d} selected={d === hero} onSelect={() => pickFight(d.fight.id)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

// The home dashboard (/), where the Chinlytics logo leads. Scrolls, top to bottom:
//   the next card as a dark header (key numbers, countdown to the main card),
//   every fight on it in a horizontal strip,
//   the model's favorite bets, last weekend's results, the newest articles,
//   rankings (P4P and every division, rotating),
//   and stat leaders (per 15 minutes) beside the upcoming-events calendar.
// Everything but the upcoming cards comes from one precomputed payload (/ufc/home).
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Countdown from '../components/arc/countdown/countdown'
import CountryFlag from '../components/CountryFlag'
import FighterImage from '../components/sports/FighterImage'
import BeltIcon from '../components/ui/belt-icon'
import { Card } from '../components/ui/card'
import PageLoader from '../components/PageLoader'
import { articleImageUrl, fetchHome, fetchUpcomingEvents, peekCached } from '../lib/api'
import { cn, formatDate, formatOdds } from '../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function splitName(name = '') {
  const i = name.indexOf(':')
  const kicker = i < 0 ? null : name.slice(0, i).trim()
  return { kicker, title: i < 0 ? name : name.slice(i + 1).trim(), numbered: /^UFC\s+\d+/i.test(kicker || '') }
}

function EventTitle({ name, className, kickerClass }) {
  const { kicker, title, numbered } = splitName(name)
  return (
    <span className={className}>
      {kicker && (
        <span className={cn('mr-2', numbered ? 'text-primary' : 'text-muted-foreground', kickerClass)}>
          {numbered ? kicker : kicker.replace(/^UFC\s+/i, '')}
        </span>
      )}
      {title}
    </span>
  )
}

// "Women's Bantamweight" -> "W. Bantamweight", so a label and its TITLE tag fit one line.
const weightLabel = (wc = '') => (wc.replace(/^UFC\s+/i, '').replace(/\s*(Title\s*)?Bout$/i, '').replace(/\s*Title$/i, '').trim() || 'Catchweight')
  .replace(/^Women's\s+/i, 'W. ')
const isTitle = (wc = '') => /title/i.test(wc)
const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : null
}
// Consensus price per corner: the median across the books listed.
const consensus = (fight) => ({
  red: median((fight.odds || []).map((o) => o.red_odds)),
  blue: median((fight.odds || []).map((o) => o.blue_odds)),
})
// Largest size at which a surname's longest word fits its column (cqw), capped; wraps
// only between words. 0.74em ~ one condensed italic capital, with slant room.
const fitName = (name, cap = 20) => {
  const longest = Math.max(1, ...(name || 'TBA').split(/\s+/).map((w) => w.length))
  return `min(${cap}px, calc(100cqw / ${(longest * 0.74).toFixed(2)}))`
}
// The model's likeliest method for the bout.
function topMethod(mp) {
  if (!mp) return null
  const opts = [['KO/TKO', mp.ko_prob], ['Submission', mp.sub_prob], ['Decision', mp.dec_prob]].filter(([, p]) => p != null)
  if (!opts.length) return null
  const [label, p] = opts.sort((a, b) => b[1] - a[1])[0]
  return `${label} ${Math.round(p * 100)}%`
}

function SectionHead({ title, sub, children }) {
  return (
    <div className="mb-2.5 flex items-center gap-3">
      <h2 className="font-display text-[19px] font-extrabold italic uppercase leading-none tracking-tight">{title}</h2>
      {sub && <span className="truncate text-[11.5px] text-muted-foreground">{sub}</span>}
      {children}
    </div>
  )
}

function HeadButton({ to, children }) {
  return (
    <Link to={to} className="ml-auto shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground/80 shadow-sm hover:border-primary/40 hover:text-primary">
      {children}
    </Link>
  )
}

function Avatar({ fighter, size = 30, className }) {
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border', className)} style={{ width: size, height: size }}>
      <FighterImage fighter={fighter} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header: the next card, its numbers, and the countdown to the main card
// ---------------------------------------------------------------------------
const startFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })

function HeadStat({ value, label, tone }) {
  return (
    <div className="flex min-w-[64px] flex-col items-center rounded-lg bg-white/[0.07] px-3 py-1.5">
      <span className={cn('font-display text-[22px] font-extrabold italic leading-none tabular-nums', tone)}>{value}</span>
      <span className="mt-1 whitespace-nowrap text-[9.5px] font-semibold text-white/60">{label}</span>
    </div>
  )
}

function Header({ event, home }) {
  if (!event) return null
  const titles = (event.fights || []).filter((f) => isTitle(f.weight_class)).length
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-ink px-5 py-4 text-white">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <EventTitle name={event.name} className="truncate font-display text-[30px] font-extrabold italic uppercase leading-none tracking-tight" />
          <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink">Next event</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/70">
          {event.main_card_at
            ? <span><b className="font-semibold text-white">Main card</b> {startFmt.format(new Date(event.main_card_at))}</span>
            : <span>{formatDate(event.date)}</span>}
          {event.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <HeadStat value={event.fights?.length || 0} label="fights" />
        <HeadStat value={titles} label="title fights" tone="text-gold" />
        <HeadStat value={home.strong_edges} label="A/B+ edges" tone="text-emerald-400" />
      </div>
      <Link to="/model/upcoming" className="shrink-0 rounded-md border border-white/25 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10">View full card</Link>
      {event.main_card_at && (
        <div className="w-[230px] shrink-0 [--color-foreground:#fff] [--color-muted-foreground:rgba(255,255,255,.6)]">
          <Countdown target={event.main_card_at} label="Main card starts in" completeLabel="Live now" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The card: every bout in a horizontal strip
// ---------------------------------------------------------------------------
function StripCard({ fight }) {
  const odds = consensus(fight)
  const p = fight.prediction?.red_prob
  const r = p == null ? null : Math.round(p * 100)
  const portrait = (f) => (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-full w-auto max-w-none object-bottom" />
    </div>
  )
  const name = (f, right) => (
    <div className={cn('@container min-w-0 flex-1', right && 'text-right')}>
      <div className="truncate text-[10px] text-muted-foreground">{f?.first_name}</div>
      <div className="font-display font-extrabold italic uppercase leading-none tracking-tight" style={{ fontSize: fitName(f?.last_name, 19) }}>
        <span className="line-clamp-2 pr-[0.12em]">{f?.last_name || 'TBA'}</span>
      </div>
    </div>
  )
  return (
    <Link to={`/ufc/fights/${fight.id}`}
      className="flex h-[300px] w-[236px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-foreground/30 hover:shadow-lg">
      <div className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b border-border py-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/80">{weightLabel(fight.weight_class)}</span>
        {isTitle(fight.weight_class) && (
          <span className="inline-flex items-center gap-0.5 rounded border border-gold/60 bg-gold/15 px-1 text-[9px] font-extrabold uppercase text-gold-foreground">
            <BeltIcon className="h-2.5 w-2.5" /> Title
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 gap-1 px-2 pt-2">
        {portrait(fight.red_fighter)}
        {portrait(fight.blue_fighter)}
      </div>
      <div className="h-[3px] shrink-0 bg-ink" />
      <div className="shrink-0 space-y-1.5 px-3 py-2">
        <div className="flex items-end gap-2">
          {name(fight.red_fighter)}
          {name(fight.blue_fighter, true)}
        </div>
        {r != null && (
          <div className="flex items-center gap-2 text-[11px] font-extrabold tabular-nums">
            <span className={r >= 50 ? 'text-corner-red' : 'text-muted-foreground'}>{r}%</span>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-corner-red" style={{ width: `${r}%` }} />
              <div className="h-full flex-1 bg-corner-blue" />
            </div>
            <span className={r < 50 ? 'text-corner-blue' : 'text-muted-foreground'}>{100 - r}%</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] tabular-nums">
          <span className="font-bold">{odds.red != null ? formatOdds(odds.red) : '–'}</span>
          <span className="truncate px-1 text-[10.5px] text-muted-foreground">{topMethod(fight.method_prediction) || ''}</span>
          <span className="font-bold">{odds.blue != null ? formatOdds(odds.blue) : '–'}</span>
        </div>
      </div>
    </Link>
  )
}

function CardStrip({ event }) {
  const ref = useRef(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth - 120), behavior: 'smooth' })
  // Which ends the strip is at: the back arrow shows only once scrolled, the forward
  // arrow only while there is more card to the right.
  const measure = () => {
    const el = ref.current
    if (!el) return
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
  }
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [event])
  if (!event) return null
  const arrow = (dir) => (
    <button onClick={() => scroll(dir)} aria-label={dir < 0 ? 'Previous fights' : 'Next fights'}
      className={cn('absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-border bg-background/95 p-2 text-foreground/70 shadow-md backdrop-blur hover:text-foreground',
        dir < 0 ? 'left-1' : 'right-1')}>
      {dir < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  )
  return (
    // -my-1.5 cancels the scroller's vertical padding (room for a hovered card to grow),
    // so the gap above and below the strip matches every other section's.
    <section className="relative -my-1.5">
      <div ref={ref} onScroll={measure} className="flex snap-x scroll-px-1.5 gap-3 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none]">
        {(event.fights || []).map((f) => <StripCard key={f.id} fight={f} />)}
      </div>
      {!edge.start && arrow(-1)}
      {!edge.end && arrow(1)}
    </section>
  )
}

// ---------------------------------------------------------------------------
// The three middle cards share one height; each fills it on its own terms.
// ---------------------------------------------------------------------------
const MID_H = 'lg:h-[396px]'

// Model's favorite bets: each fight's primary pick, best grades first
const GRADE_TONE = (g) => (g.startsWith('A') ? 'bg-emerald-600' : g.startsWith('B') ? 'bg-sky-600' : 'bg-slate-500')

function FavoriteBets({ edges }) {
  const rows = edges.slice(0, 5)
  return (
    <Card className={cn('flex min-h-0 flex-col p-4', MID_H)}>
      <SectionHead title="Model's favorite bets"><HeadButton to="/picks">All picks</HeadButton></SectionHead>
      {!rows.length ? <p className="text-[12px] text-muted-foreground">No graded edges on the upcoming cards.</p> : (
        <div className="grid min-h-0 flex-1 divide-y divide-border/70" style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}>
          {rows.map((e, k) => (
            <Link key={`${e.fight_id}-${e.family}`} to={`/ufc/fights/${e.fight_id}`} className="grid min-h-0 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 hover:bg-muted/40">
              <span className="font-display text-[22px] font-extrabold italic leading-none text-muted-foreground/50">{k + 1}</span>
              <div className="min-w-0">
                <div className="text-[13px] font-bold leading-tight">{e.pick_label}</div>
                <div className="truncate text-[10.5px] text-muted-foreground">{e.red.split(' ').slice(-1)} vs {e.blue.split(' ').slice(-1)}</div>
              </div>
              <div className="text-right leading-tight">
                <div className="font-display text-[19px] font-extrabold italic tabular-nums">{e.price != null ? formatOdds(e.price) : '–'}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-semibold tabular-nums text-emerald-600">
                  <span className={cn('rounded px-1 text-[10px] font-extrabold text-white', GRADE_TONE(e.grade))}>{e.grade}</span>
                  +{(e.edge_pts ?? 0).toFixed(1)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// Last weekend: every winner and how
const shortMethod = (f) => {
  const m = f.method || ''
  if (/^KO|TKO/i.test(m)) return `KO/TKO · R${f.finish_round}`
  if (/^Sub/i.test(m)) return `Sub · R${f.finish_round}`
  const d = m.match(/^Decision\s*-\s*(\w)/i)
  return d ? `Dec (${d[1].toUpperCase()})` : m
}

function LastWeekend({ event }) {
  if (!event) return <Card className={cn('p-4 text-sm text-muted-foreground', MID_H)}>No completed card yet.</Card>
  return (
    <Card className={cn('flex min-h-0 flex-col p-4', MID_H)}>
      <SectionHead title="Last weekend"><HeadButton to={`/ufc/events?event=${event.id}`}>Full card</HeadButton></SectionHead>
      <EventTitle name={event.name} className="mb-1 block shrink-0 truncate text-[12px] font-bold" kickerClass="mr-1" />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {event.fights.map((f) => (
          <Link key={f.id} to={`/ufc/fights/${f.id}`}
            className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 px-0.5 py-1.5 last:border-b-0 hover:bg-muted/50">
            <Avatar fighter={f.winner} size={30} />
            <span className="truncate text-[12.5px]">
              <b className="font-bold">{f.winner?.first_name?.[0]}. {f.winner?.last_name}</b>
              <span className="text-muted-foreground"> def. {f.loser?.last_name}</span>
            </span>
            <span className="shrink-0 text-[10.5px] font-semibold text-muted-foreground">{shortMethod(f)}</span>
          </Link>
        ))}
      </div>
    </Card>
  )
}

// Latest articles: the next card's previews, each with its fighters as the artwork
function ArticleThumb({ a }) {
  // Picked artwork (Google Images, stored server-side), cropped around the fighters'
  // faces; the two portraits stand in until one has been picked.
  if (a.image) {
    return (
      <div className="relative h-[64px] w-[96px] shrink-0 overflow-hidden rounded-md bg-muted">
        <img src={articleImageUrl(a.fight_id, a.image.v)} alt="" loading="lazy" className="h-full w-full object-cover"
          style={{ objectPosition: `${a.image.focal_x * 100}% ${a.image.focal_y * 100}%` }} />
      </div>
    )
  }
  return (
    <div className="relative flex h-[64px] w-[96px] shrink-0 items-end overflow-hidden rounded-md bg-gradient-to-b from-muted to-muted/40">
      {[a.red, a.blue].map((f, k) => (
        <div key={k} className="relative h-full w-1/2">
          <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[120%] w-auto max-w-none object-top" />
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-ink" />
    </div>
  )
}

function LatestArticles({ articles }) {
  const rows = articles.slice(0, 4)
  return (
    <Card className={cn('flex min-h-0 flex-col p-4', MID_H)}>
      <SectionHead title="Latest articles"><HeadButton to="/ufc/articles">All articles</HeadButton></SectionHead>
      {!rows.length ? <p className="text-[12px] text-muted-foreground">No articles yet.</p> : (
        <div className="grid min-h-0 flex-1 divide-y divide-border/70" style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}>
          {rows.map((a) => {
            const [matchup, ...rest] = (a.headline || '').split('|')
            const title = rest.join('|').replace(/^\s*UFC[^:]*:\s*/i, '').trim() || matchup
            return (
              <Link key={a.fight_id} to={`/ufc/fights/${a.fight_id}/preview`} className="flex min-h-0 items-center gap-3 hover:bg-muted/40">
                <ArticleThumb a={a} />
                <div className="min-w-0">
                  <div className="line-clamp-2 text-[12.5px] font-bold leading-snug">{title}</div>
                  <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">Preview · {matchup.trim()}</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Rotating sections: pills, with a ring tracing the active pill as its time runs out
// ---------------------------------------------------------------------------
// Rotates through `n` panels every `ms`. Clicking a pill picks it and stops the rotation
// for the rest of the visit (it starts again on the next page load).
// `firstMs` lengthens only the very first slide, to put two rotators out of phase so
// they never switch at the same moment. `dur` is the current slide's duration, which
// the ring animates over: every pill gets the same time on screen, whatever its width.
function useRotation(n, ms, firstMs = ms) {
  const [i, setI] = useState(0)
  const [step, setStep] = useState(0)
  const [manual, setManual] = useState(false)
  const dur = step === 0 ? firstMs : ms
  useEffect(() => {
    if (manual || n < 2) return undefined
    const t = setTimeout(() => { setI((x) => (x + 1) % n); setStep((x) => x + 1) }, dur)
    return () => clearTimeout(t)
  }, [step, manual, n, dur])
  return { i, step, dur, manual, pick: (k) => { setManual(true); setI(k) } }
}

// The timer ring: an element exactly over the pill's border box, with the pill's own
// border-radius, showing a conic sweep through a 2px border-shaped mask (.pill-ring in
// index.css). Its shape IS the pill's, so nothing is measured and nothing can drift.
function PillRing({ ms }) {
  return <span className="pill-ring" style={{ '--ring-ms': `${ms}ms` }} />
}

function Pill({ active, timed, ms, tone = 'slate', onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      className={cn('relative shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
        active ? (tone === 'gold' ? 'border-gold bg-gold text-white' : 'border-slate-700 bg-slate-700 text-white')
          : 'border-border text-foreground/75 hover:border-slate-400')}>
      {children}
      {/* The timer: a red ring drawn around the pill over `ms`. pathLength=100 makes the
          dash maths independent of the pill's size. */}
      {active && timed && <PillRing ms={ms} />}
    </button>
  )
}

function Pills({ items, rot, toneOf, className }) {
  return (
    // Vertical padding so the ring around the active pill isn't clipped by the scroller.
    <div className={cn('flex min-w-0 shrink-0 gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]', className)}>
      {items.map((it, k) => (
        <Pill key={`${it.key}-${k === rot.i ? rot.step : ''}`} active={k === rot.i} timed={!rot.manual} ms={rot.dur} tone={toneOf?.(it)} title={it.title} onClick={() => rot.pick(k)}>
          {it.label}
        </Pill>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rankings: P4P, BMF and every division's top ten, rotating
// ---------------------------------------------------------------------------
const RANK_MS = 7000

function RankingsStrip({ boards }) {
  const rot = useRotation(boards.length, RANK_MS)
  const board = boards[rot.i]
  if (!board) return null
  const cross = board.key === 'p4p' || board.key === 'bmf'
  const fullTo = board.key === 'p4p' ? '/ufc/rankings?div=p4p_men' : board.key === 'bmf' ? '/ufc/rankings?div=bmf_men' : `/ufc/rankings?div=${board.key}`
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-[19px] font-extrabold italic uppercase leading-none tracking-tight">Rankings</h2>
        <Pills className="flex-1" items={boards.map((b) => ({ key: b.key, label: b.short, title: b.label }))} rot={rot}
          toneOf={(it) => (it.key === 'p4p' || it.key === 'bmf' ? 'gold' : 'slate')} />
        <HeadButton to={fullTo}>Full rankings</HeadButton>
      </div>
      <div key={board.key} className="mt-2 grid animate-in fade-in grid-cols-5 gap-3 duration-500 lg:grid-cols-10">
        {board.rows.map((f) => (
          <Link key={f.id} to={`/ufc/fighters/${f.id}`} className="group flex flex-col items-center text-center">
            <div className="relative">
              <Avatar fighter={f} size={64} className="transition-transform group-hover:scale-105" />
              <span className={cn('absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded px-1 font-display text-[12px] font-extrabold italic text-white',
                f.is_champion && !cross ? 'bg-gold' : (f.rank ?? 99) <= 3 ? 'bg-primary' : 'bg-ink')}>
                {f.is_champion && !cross ? 'C' : f.rank}
              </span>
              {f.is_champion && <BeltIcon className="absolute -bottom-0.5 -right-1 h-4 w-4 rounded-full bg-background p-0.5 text-gold" />}
            </div>
            <div className="mt-1.5 flex max-w-full items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <CountryFlag countryCode={f.country_code} />
              <span className="truncate">{f.first_name}</span>
            </div>
            <div className="@container w-full font-display font-extrabold italic uppercase leading-none tracking-tight" style={{ fontSize: fitName(f.last_name, 17) }}>
              <span className="line-clamp-2 pr-[0.12em]">{f.last_name}</span>
            </div>
            <div className="mt-0.5 w-full truncate text-[10px] text-muted-foreground">
              {cross ? f.division_label : `${f.wins ?? 0}-${f.losses ?? 0}${f.draws ? `-${f.draws}` : ''}`}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stat leaders: ranked fighters, per 15 minutes; full portraits, rotating.
// Sits beside the calendar and takes the calendar's height (the row stretches).
// ---------------------------------------------------------------------------
const FMT = {
  int: (v) => v.toFixed(0),
  signed: (v) => `+${v.toFixed(0)}`,
  dec1: (v) => v.toFixed(1),
  dec2: (v) => v.toFixed(2),
  pct: (v) => `${v.toFixed(0)}%`,
  clock: (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`,
}
const STAT_MS = 7000
const STAT_SHORT = { slpm: 'Sig. strikes', sl_diff: 'Strike diff.', kd15: 'Knockdowns', td15: 'Takedowns', sub_att15: 'Sub attempts', ctrl15: 'Control', sig_def: 'Strike def.' }

function StatLeaders({ boards }) {
  // First slide 1.5x long, so stat leaders always switch half a cycle after rankings.
  const rot = useRotation(boards.length, STAT_MS, STAT_MS * 1.5)
  const board = boards[rot.i]
  if (!board) return null
  return (
    <Card className="flex min-h-0 flex-col p-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="shrink-0 font-display text-[19px] font-extrabold italic uppercase leading-none tracking-tight">Stat leaders</h2>
        <Pills className="flex-1" items={boards.map((b) => ({ key: b.key, label: STAT_SHORT[b.key] || b.label, title: b.label }))} rot={rot} />
        <HeadButton to="/ufc/fighters/stats">All stats</HeadButton>
      </div>
      <div key={board.key} className="grid animate-in fade-in grid-cols-5 gap-3 duration-500">
        {board.rows.map((r, k) => (
          <Link key={r.id} to={`/ufc/fighters/${r.id}`}
            className={cn('@container relative flex min-h-0 flex-col overflow-hidden rounded-xl border px-2 pb-2 pt-1.5 transition-colors hover:border-foreground/30',
              k === 0 ? 'border-primary/40 bg-primary/[0.04]' : 'border-border')}>
            <span className={cn('absolute left-2 top-1.5 z-10 font-display text-[16px] font-extrabold italic leading-none', k === 0 ? 'text-primary' : 'text-muted-foreground/60')}>{k + 1}</span>
            <div className="relative h-[150px] shrink-0">
              <FighterImage fighter={r} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-full w-auto max-w-none object-bottom" />
            </div>
            <div className="h-[3px] shrink-0 rounded-full bg-ink" />
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <CountryFlag countryCode={r.country_code} />
              <span className="truncate">{r.first_name}</span>
            </div>
            <div className="font-display font-extrabold italic uppercase leading-none tracking-tight" style={{ fontSize: fitName(r.last_name, 17) }}>
              <span className="line-clamp-2 pr-[0.12em]">{r.last_name}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <span className="truncate text-[9.5px] text-muted-foreground">{r.division}</span>
              <span className="font-display text-[20px] font-extrabold italic leading-none tabular-nums">{FMT[board.fmt](r.value)}</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Upcoming calendar: as many cards as fit beside the stat leaders
// ---------------------------------------------------------------------------
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short' })
const CAL_ROW_H = 54

// Stat leaders sets this row's height; the calendar shows as many fixed-height rows as
// fit in it (so the rows are never stretched or squeezed). The list is absolutely
// positioned, so it adds nothing to the row's height itself.
function Calendar({ events }) {
  const ref = useRef(null)
  const [fit, setFit] = useState(5)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setFit(Math.max(1, Math.floor(el.clientHeight / CAL_ROW_H))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <Card className="flex min-h-[200px] flex-col p-4">
      <SectionHead title="Upcoming"><HeadButton to="/model/upcoming">All cards</HeadButton></SectionHead>
      <div ref={ref} className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0 divide-y divide-border/70">
          {events.slice(0, fit).map((e) => {
            const d = new Date(`${e.date}T12:00:00`)
            const { numbered } = splitName(e.name)
            return (
              <Link key={e.id} to="/model/upcoming" className="flex items-center gap-3 hover:bg-muted/40" style={{ height: CAL_ROW_H }}>
                <div className={cn('flex w-11 shrink-0 flex-col items-center rounded-md py-1 text-white', numbered ? 'bg-primary' : 'bg-ink')}>
                  <span className="text-[9px] font-bold uppercase leading-none tracking-wider">{dayFmt.format(d)}</span>
                  <span className="font-display text-[20px] font-extrabold italic leading-none">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {/* Fight count rides the title line, so the location below gets the full width. */}
                  <div className="flex items-baseline gap-2">
                    <EventTitle name={e.name} className="min-w-0 flex-1 truncate text-[12.5px] font-bold" kickerClass="mr-1" />
                    <span className="shrink-0 text-[10.5px] font-semibold text-muted-foreground">{e.fights?.length || 0} fights</span>
                  </div>
                  <div className="truncate text-[10.5px] text-muted-foreground">
                    {e.main_card_at ? `Main card ${new Date(e.main_card_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })} · ` : ''}
                    {e.location || ''}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HomePage() {
  // Both payloads are warmed at app start (Layout), so this usually renders on frame one.
  const [upcoming, setUpcoming] = useState(() => peekCached('/ufc/upcoming'))
  const [home, setHome] = useState(() => peekCached('/ufc/home'))
  useEffect(() => {
    fetchUpcomingEvents().then(setUpcoming).catch(() => setUpcoming([]))
    fetchHome().then(setHome).catch(() => setHome({ p4p: [], rankings: [], last_event: null, stat_leaders: [], model_edges: [], articles: [] }))
  }, [])

  if (!upcoming || !home) return <PageLoader />
  const next = upcoming[0]

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4 pr-1">
      <Header event={next} home={home} />
      <CardStrip event={next} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FavoriteBets edges={home.model_edges || []} />
        <LastWeekend event={home.last_event} />
        <LatestArticles articles={home.articles || []} />
      </div>
      <RankingsStrip boards={home.rankings || []} />
      {/* Stretch: stat leaders takes the calendar's height, its portraits filling it. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <StatLeaders boards={home.stat_leaders || []} />
        <Calendar events={upcoming} />
      </div>
    </div>
  )
}

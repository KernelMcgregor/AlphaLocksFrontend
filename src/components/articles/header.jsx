// The article header: a face-off hero (both fighters, the event, the headline, the model,
// the countdown to the main card), and once that has scrolled away a slim bar pinned to
// the top of the page in the style of the home page's header.
import { ArrowLeft, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Countdown from '../arc/countdown/countdown'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import BeltIcon from '../ui/belt-icon'
import { CORNERS } from '../fight/corners'
import { ModelBar, Standing } from './embeds'
import { bestOdds, isTitle, lastName, record, weightLabel } from './fightText'
import { cn, formatOdds } from '../../lib/utils'

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const startFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
const day = (d) => (d ? dayFmt.format(new Date(`${d}T12:00:00`)) : '')

// "UFC 334: Gane vs. Hokit" -> the number in red, the rest in white.
export function EventName({ name = '', className }) {
  const i = name.indexOf(':')
  const kicker = i < 0 ? null : name.slice(0, i).trim()
  return (
    <span className={className}>
      {kicker && <span className="mr-2 text-primary">{kicker}</span>}
      {i < 0 ? name : name.slice(i + 1).trim()}
    </span>
  )
}

function Chips({ fight, meetings }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider">
      <span className="rounded bg-white/15 px-1.5 py-0.5">{weightLabel(fight.weight_class)}</span>
      {isTitle(fight.weight_class) && (
        <span className="inline-flex items-center gap-1 rounded bg-gold px-1.5 py-0.5 text-ink"><BeltIcon className="h-3 w-3" />Title fight</span>
      )}
      {meetings?.length > 0 && <span className="rounded bg-primary px-1.5 py-0.5">Rematch · Fight {meetings.length + 1}</span>}
    </div>
  )
}

// Each corner's standing: the belt or the model's division rank, the record, and the best
// moneyline price on offer (the one the odds panel highlights).
function standing(fight, ctx, side) {
  const price = bestOdds(fight.odds)[side]
  return {
    fighter: side === 'red' ? fight.red_fighter : fight.blue_fighter,
    champion: !!fight.champions?.[side],
    rank: ctx?.[side]?.glicko?.division_rank,
    division: weightLabel(fight.weight_class),
    price: price != null ? formatOdds(price) : null,
  }
}

// Record and best price, under the name.
function Meta({ st, right, className }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] tabular-nums text-white/70', right && 'flex-row-reverse', className)}>
      <span>{record(st.fighter)}</span>
      {st.price && <span className="font-bold text-white">{st.price}</span>}
    </div>
  )
}

// First name small, surname big with the flag beside it.
function Name({ st, right, size = 'lg' }) {
  return (
    <div className={cn('min-w-0 leading-none', right && 'text-right')}>
      <div className={cn('truncate font-semibold text-white/75', size === 'lg' ? 'text-[13px]' : 'text-[10.5px]')}>{st.fighter?.first_name}</div>
      <div className={cn('flex items-center gap-1.5', right && 'flex-row-reverse')}>
        <span className={cn('truncate font-display font-extrabold italic uppercase tracking-tight', size === 'lg' ? 'text-[30px] leading-[0.95]' : 'text-[20px]')}>{lastName(st.fighter)}</span>
        <CountryFlag countryCode={st.fighter?.country_code} className="shrink-0" />
      </div>
    </div>
  )
}

function Corner({ st, right }) {
  return (
    <div className="relative z-10 px-4 pb-3">
      <Name st={st} right={right} />
      <Meta st={st} right={right} className="mt-1" />
    </div>
  )
}

// Back to wherever the reader came from on the site; straight to the articles index when
// they landed here directly.
export function BackButton({ className, dark, fallback = '/ufc/articles' }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <button type="button" aria-label="Back" title="Back"
      onClick={() => (location.key !== 'default' ? navigate(-1) : navigate(fallback))}
      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors',
        dark ? 'bg-white/10 hover:bg-white/20' : 'bg-black/45 backdrop-blur hover:bg-black/65', className)}>
      <ArrowLeft className="h-4 w-4" />
    </button>
  )
}

const FightLink = ({ id, className }) => (
  <Link to={`/ufc/fights/${id}`} className={cn('shrink-0 rounded-md border border-white/25 px-3 py-1 text-[12px] font-semibold text-white hover:bg-white/10', className)}>
    Fight page
  </Link>
)

// One continuous field behind both fighters: no per-portrait shading, so no edges.
export function FaceOff({ fight, art, meetings, ctx, tint = true }) {
  const { event } = fight
  const field = tint
    ? `linear-gradient(90deg, color-mix(in srgb, ${CORNERS[0].css} 70%, #18181b) 0%, #18181b 38%, #18181b 62%, color-mix(in srgb, ${CORNERS[1].css} 70%, #18181b) 100%)`
    : '#2d2d2d'
  return (
    <div data-article-header className="relative overflow-hidden rounded-xl text-white" style={{ background: field }}>
      <div className="grid grid-cols-2 md:min-h-[290px] md:grid-cols-[minmax(0,250px)_1fr_minmax(0,250px)]">
        {['red', 'blue'].map((side, k) => {
          const st = standing(fight, ctx, side)
          return (
            <div key={side} className={cn('relative flex h-[200px] flex-col justify-end md:h-auto', k ? 'order-2 md:order-3' : 'order-1')}>
              <FighterImage fighter={st.fighter} fit="contain" className="absolute inset-x-0 bottom-0 top-4" imgClassName="h-full w-full object-contain object-bottom" />
              <Standing champion={st.champion} beltOnly
                className={cn('absolute top-3 z-10 h-6 min-w-6 text-[11px]', k ? 'left-3' : 'right-3')} />
              <Corner st={st} right={!!k} />
            </div>
          )
        })}
        <div className="relative z-10 order-3 col-span-2 flex flex-col items-center justify-center gap-2.5 px-5 py-5 text-center md:order-2 md:col-span-1 md:px-6">
          <EventName name={event?.name} className="font-display text-[20px] font-extrabold italic uppercase leading-none tracking-tight" />
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[12px] text-white/70">
            <span>{day(event?.date)}</span>
            {event?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
          </div>
          <Chips fight={fight} meetings={meetings} />
          <h1 className="max-w-[26ch] text-[24px] font-extrabold leading-[1.1] tracking-tight lg:text-[30px]">{art.title}</h1>
          <div className="w-full max-w-[340px] [&_.text-muted-foreground]:text-white/60"><ModelBar fight={fight} odds={false} /></div>
          {event?.main_card_at && (
            <div className="w-full max-w-[230px] [--color-foreground:#fff] [--color-muted-foreground:rgba(255,255,255,.6)]">
              <Countdown target={event.main_card_at} label="Main card starts in" completeLabel="Live now" />
            </div>
          )}
          <FightLink id={fight.id} />
        </div>
      </div>
      {/* Grounds the name blocks; spans the whole hero so it never draws a seam. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  )
}

// The slim bar: pinned to the top of the scroller, shown only while the layout's header
// (the element marked data-article-header) is entirely out of view above it.
// Fighters as on the home page (rank badge on the headshot, first name over the surname
// and flag), the event beside them, then the model, the countdown and the fight page.
export function StickyBar({ fight, ctx }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = document.querySelector('[data-article-header]')
    if (!el) return undefined
    // The top 80px is where the bar sits: the header counts as gone once it is under it.
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [fight.id])
  const { event } = fight
  const p = fight.prediction?.red_prob
  const r = p == null ? null : Math.round(p * 100)
  const side = (s, right) => {
    const st = standing(fight, ctx, s)
    return (
      <div className={cn('flex min-w-0 items-center gap-2.5', right && 'flex-row-reverse')}>
        <span className="relative shrink-0">
          <span className="block h-11 w-11 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
            <FighterImage fighter={st.fighter} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
          </span>
          <Standing champion={st.champion} beltOnly
            className={cn('absolute -bottom-1 h-[18px] min-w-[18px] text-[9px]', right ? '-left-1' : '-right-1')} />
        </span>
        <div className="min-w-0">
          <Name st={st} right={right} size="sm" />
          <Meta st={st} right={right} className="mt-0.5 text-[10.5px]" />
        </div>
      </div>
    )
  }
  return (
    <div className="sticky top-0 z-30 h-0">
      <div className={cn('flex items-center gap-4 rounded-xl bg-ink px-4 py-2 text-white shadow-lg transition-all duration-200',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0')}>
        <BackButton dark />
        {side('red')}
        <span className="shrink-0 font-display text-[14px] font-extrabold italic text-white/50">VS</span>
        {side('blue', true)}
        <div className="hidden min-w-0 border-l border-white/15 pl-4 leading-tight lg:block">
          <EventName name={event?.name} className="block truncate font-display text-[15px] font-extrabold italic uppercase tracking-tight" />
          <div className="truncate text-[11px] text-white/60">{event?.main_card_at ? startFmt.format(new Date(event.main_card_at)) : day(event?.date)}</div>
        </div>
        {r != null && (
          <div className="ml-auto hidden w-[170px] shrink-0 md:block">
            {/* The model's winner named over the bar, on their side of it. */}
            <div className={cn('mb-0.5 truncate text-[10px] font-extrabold uppercase tracking-wider', r >= 50 ? 'text-corner-red' : 'text-right text-corner-blue')}>
              Model pick: {lastName(r >= 50 ? fight.red_fighter : fight.blue_fighter)}
            </div>
            <div className="flex items-center gap-2 text-[12px] font-extrabold tabular-nums">
              <span className="text-corner-red">{r}%</span>
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-corner-red" style={{ width: `${r}%` }} />
                <div className="h-full flex-1 bg-corner-blue" />
              </div>
              <span className="text-corner-blue">{100 - r}%</span>
            </div>
          </div>
        )}
        {event?.main_card_at && (
          <div className="hidden shrink-0 lg:block [--color-border:rgba(255,255,255,.2)] [--color-card:transparent] [--color-foreground:#fff] [--color-muted-foreground:rgba(255,255,255,.6)]">
            <Countdown target={event.main_card_at} variant="compact" label="Main card" completeLabel="Live now" />
          </div>
        )}
        <FightLink id={fight.id} className={cn(r == null && 'ml-auto')} />
      </div>
    </div>
  )
}

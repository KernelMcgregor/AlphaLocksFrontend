// src/pages/UpcomingPage.jsx
//
// Upcoming as a one-screen dashboard: a featured bout on the left, every bout on
// every upcoming card in a rail on the right. Picking a rail card swaps the
// featured preview in place; the preview's CTA opens the full fight page.
//
// Nothing on the page scrolls except the rail — the featured preview is sized to
// whatever height the layout gives this page.
import { Calendar, Clock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import EventTabs from '../components/sports/EventTabs'
import FeaturedFight from '../components/sports/FeaturedFight'
import FightRailCard from '../components/sports/FightRailCard'
import PageLoader from '../components/PageLoader'
import { fetchFightContext, fetchUpcomingEvents, peekCached } from '../lib/api'
import { runQueue } from '../lib/prefetch'
import { daysUntil, parseLocation, summarizeEvent } from '../lib/upcomingSummary'
import { cn, formatDate } from '../lib/utils'

// Container-query classes, spelled out in full.
//
// Tailwind scans source text, so a variant assembled at runtime — `hidden ${bp}:flex` —
// never reaches the stylesheet, and the element is left permanently hidden. Same trap the
// tier classes on the full preview page carry a note about.
//
// The bar sheds its least load-bearing facts first as it narrows: venue, then location.
// Breakpoints are measured against the bar's own width, not the viewport's —
// the bar sits inside a sidebar-and-rail layout, so viewport width says little about the
// room it actually has.
const SHOW_VENUE = 'hidden @min-[1320px]:flex'
const SHOW_LOCATION = 'hidden @min-[820px]:flex'

// Labels that spell themselves out once the bar is wide enough to carry them.
const TITLES_SHORT = '@min-[980px]:hidden'
const TITLES_LONG = 'hidden @min-[980px]:inline'
const ARB_SHORT = '@min-[1180px]:hidden'
const ARB_LONG = 'hidden @min-[1180px]:inline'

/** One labelled figure in the status bar. `show` is a complete class string, see above. */
function StatusItem({ label, children, show }) {
  return (
    <span
      className={cn(
        'items-baseline gap-2 whitespace-nowrap border-l border-border pl-4 first:border-l-0 first:pl-0',
        show || 'flex',
      )}
    >
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</span>
      {children}
    </span>
  )
}

function StatusBar({ event }) {
  const sum = summarizeEvent(event)
  const days = daysUntil(event.date)
  const when = days == null ? '' : days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`
  const { city, country } = parseLocation(event.location)

  return (
    // @container so the breakpoints above track the bar, not the window.
    <div className="@container shrink-0">
      <div className="flex h-10 items-center gap-4 overflow-hidden rounded-lg border border-border bg-muted/40 px-3.5">
        <StatusItem label="Date">
          <span className="text-[12.5px] font-semibold tabular-nums">{formatDate(event.date)}</span>
        </StatusItem>

        <StatusItem label="Countdown">
          <span className="text-[13px] font-extrabold tabular-nums">{when}</span>
        </StatusItem>

        {/* ufcstats publishes only a date and a city for an event — no venue — so this
            stays empty until something fills event.venue. Kept rather than dropped so
            that the day it is populated it simply appears. */}
        {event.venue && (
          <StatusItem label="Venue" show={SHOW_VENUE}>
            <span className="max-w-[220px] truncate text-[12.5px] font-semibold" title={event.venue}>
              {event.venue}
            </span>
          </StatusItem>
        )}

        {city && (
          <StatusItem label="Location" show={SHOW_LOCATION}>
            <span className="text-[12.5px] font-semibold" title={event.location || undefined}>
              {city}
              {country && <span className="text-muted-foreground">, {country}</span>}
            </span>
          </StatusItem>
        )}

        {/* Card size. Nothing else up here distinguishes a 13-bout numbered card from a
            one-bout Fight Night, and they are very different pages. */}
        <StatusItem label="Bouts">
          <span className="text-[13px] font-extrabold tabular-nums">{event.fights.length}</span>
        </StatusItem>

        <StatusItem
          label={
            <>
              <span className={TITLES_SHORT}>Titles</span>
              <span className={TITLES_LONG}>Title fights</span>
            </>
          }
        >
          <span className="text-[13px] font-extrabold tabular-nums">{sum.titleFights}</span>
        </StatusItem>

        <StatusItem
          label={
            <>
              <span className={ARB_SHORT}>Arb open</span>
              <span className={ARB_LONG}>Arbitrage opportunities</span>
            </>
          }
        >
          {sum.arbCount ? (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-extrabold text-emerald-600">
              {sum.arbCount}
            </span>
          ) : (
            <span className="text-[12px] font-bold text-muted-foreground">0</span>
          )}
        </StatusItem>
      </div>
    </div>
  )
}

export default function UpcomingPage() {
  // Seeded from the client cache (warmed at app start by Layout), so the landing page
  // renders on the first frame whenever the data is already here.
  const [events, setEvents] = useState(() => peekCached('/ufc/upcoming'))
  const [selectedId, setSelectedId] = useState(null)
  const railRef = useRef(null)
  const groupRefs = useRef({})

  useEffect(() => {
    fetchUpcomingEvents().then(setEvents).catch(() => setEvents([]))
  }, [])

  // Warm every selection the rail can make, in the background, straight into the api
  // cache. A swap of the featured preview needs the fight's context (age, division rank),
  // which does not ride along with /ufc/upcoming; fetched on click it puts a loading
  // state on every selection. Ordered by event, so the card being looked at is ready
  // first. Recent form used to be warmed here too — two whole bout histories per fight,
  // ~126 requests across a slate — until it moved into the /ufc/upcoming payload; the
  // queue is a third of the size now, so the contexts land far sooner.
  useEffect(() => {
    if (!events?.length) return
    const tasks = []
    for (const e of events) for (const f of e.fights) tasks.push(() => fetchFightContext(f.id))
    return runQueue(tasks)
  }, [events])

  // Default selection: the main event of the next card. Derived rather than written
  // back into state by an effect — the fallback is a pure function of `events`, so
  // storing it would only add a render pass and a window where the two disagree.
  // The API lists bouts main-event first (ufc_fights.card_position).
  const activeId = selectedId ?? events?.[0]?.fights?.[0]?.id ?? null

  const { fight, event } = useMemo(() => {
    const all = events || []
    const owner = all.find((e) => e.fights.some((x) => x.id === activeId))
    return {
      fight: owner?.fights.find((x) => x.id === activeId) ?? null,
      event: owner ?? all[0] ?? null,
    }
  }, [events, activeId])

  const jumpToEvent = (e) => {
    if (e.fights?.[0]) setSelectedId(e.fights[0].id)
    const rail = railRef.current
    const el = groupRefs.current[e.id]
    if (rail && el) rail.scrollTo({ top: el.offsetTop, behavior: 'smooth' })
  }

  if (!events) return <PageLoader />

  if (!events.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <Calendar className="mb-2 h-10 w-10 opacity-30" />
        <p className="text-sm">No upcoming events</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Clock className="h-5 w-5 text-white" />
          </span>
          Upcoming
        </h1>
        <EventTabs events={events} activeId={event?.id} onSelect={jumpToEvent} />
      </div>

      {event && <StatusBar event={event} />}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_clamp(290px,20%,400px)]">
        <div className="min-h-0">
          {fight ? <FeaturedFight fight={fight} event={event} /> : null}
        </div>

        <div ref={railRef} className="relative min-h-0 overflow-y-auto rounded-xl border border-border bg-card">
          {events.map((e) => (
            <section key={e.id} ref={(el) => { groupRefs.current[e.id] = el }}>
              <div className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-border bg-muted px-3 py-2">
                <span className="truncate text-[11.5px] font-extrabold">{e.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(e.date)}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{e.fights.length} fights</span>
              </div>
              {e.fights.map((f) => (
                <FightRailCard
                  key={f.id}
                  fight={f}
                  selected={f.id === activeId}
                  onSelect={() => setSelectedId(f.id)}
                />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

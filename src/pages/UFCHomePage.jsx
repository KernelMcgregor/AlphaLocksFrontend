// UFC dashboard. One screen, no page scroll. Top-left is the last card's results as a
// list, top-right the next card's fights on a 3D ring, the articles slot runs along the
// bottom, and the pound-for-pound top ten holds the full-height right rail. Every panel
// scrolls inside itself.
import { BarChart3, Calendar, Clock, Layers, Newspaper, Swords, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CountryFlag from '../components/CountryFlag'
import FighterImage from '../components/sports/FighterImage'
import FightRingCard from '../components/sports/FightRingCard'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { CardRing } from '../components/ui/card-ring'
import { ScrollArea } from '../components/ui/scroll-area'
import {
  fetchEventDetail,
  fetchEventPredictions,
  fetchEvents,
  fetchRankings,
  fetchUpcomingEvents,
} from '../lib/api'
import { cn, formatDate } from '../lib/utils'

// The rest of the UFC section, kept in step with the sidebar tree.
const SECTIONS = [
  { label: 'Upcoming', icon: Clock, path: '/model/upcoming' },
  { label: 'Events & Fights', icon: Calendar, path: '/ufc/events' },
  { label: 'Fighter Stats', icon: BarChart3, path: '/ufc/fighters/stats' },
  { label: 'Rankings', icon: Layers, path: '/ufc/fighters/decompositions' },
]

function P4PRow({ fighter, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-accent"
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums',
          fighter.rank === 1
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        {fighter.rank}
      </span>
      <FighterImage fighter={fighter} className="h-8 w-8 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <CountryFlag countryCode={fighter.country_code} />
          <span className="truncate text-sm font-medium">
            {fighter.first_name} {fighter.last_name}
          </span>
        </div>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {fighter.wins}-{fighter.losses}{fighter.draws > 0 ? `-${fighter.draws}` : ''}
        </p>
      </div>
    </button>
  )
}

export default function UFCHomePage() {
  const navigate = useNavigate()
  const [upcoming, setUpcoming] = useState([])
  const [rankings, setRankings] = useState(null)
  const [lastEvent, setLastEvent] = useState(null)
  const [lastPredictions, setLastPredictions] = useState({})
  const [division, setDivision] = useState('p4p_men')
  const [eventMode, setEventMode] = useState('next')
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchUpcomingEvents().catch(() => []),
      fetchRankings().catch(() => ({ weight_classes: [] })),
    ])
      .then(([up, ranks]) => {
        setUpcoming(Array.isArray(up) ? up : [])
        setRankings(ranks)
      })
      .finally(() => setLoading(false))
  }, [])

  // Most recent completed card, loaded separately so the ring is not held up by it.
  useEffect(() => {
    let cancelled = false
    fetchEvents({ limit: 60 })
      .then((all) => {
        const now = new Date()
        const past = all
          .filter((e) => new Date(e.date) < now)
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
        if (!past) return null
        return Promise.all([
          fetchEventDetail(past.id),
          fetchEventPredictions(past.id).catch(() => ({})),
        ])
      })
      .then((res) => {
        if (cancelled || !res) return
        const [detail, preds] = res
        setLastEvent(detail)
        setLastPredictions(preds || {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const nextEvent = upcoming[0] || null

  // Graded fights only — no-contests say nothing about the card or the model.
  const lastResults = useMemo(
    () => (lastEvent?.fights || []).filter((f) => f.winner),
    [lastEvent],
  )

  // The event detail payload spells odds as scalars and keeps predictions in a side map;
  // normalise to the upcoming-event shape so one card component serves both modes.
  const ringItems = useMemo(() => {
    if (eventMode === 'next') {
      return (nextEvent?.fights || []).map((f) => ({ key: f.id, fight: f }))
    }
    return lastResults.map((f) => ({
      key: f.id,
      fight: {
        id: f.id,
        weight_class: f.weight_class,
        red_fighter: f.red_fighter,
        blue_fighter: f.blue_fighter,
        odds: f.red_odds != null || f.blue_odds != null
          ? [{ red_odds: f.red_odds, blue_odds: f.blue_odds }]
          : [],
        prediction: lastPredictions[String(f.id)] || null,
        winner: f.winner,
        method: f.method,
      },
    }))
  }, [eventMode, nextEvent, lastResults, lastPredictions])

  const shownEvent = eventMode === 'next' ? nextEvent : lastEvent

  const p4p = useMemo(() => {
    const wc = rankings?.weight_classes?.find((w) => w.key === division)
    return (wc?.fighters || []).slice(0, 10)
  }, [rankings, division])

  const hasWomensP4P = !!rankings?.weight_classes?.some((w) => w.key === 'p4p_women')

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
            <Swords className="h-4 w-4 text-white" />
          </span>
          UFC
        </h1>
        <nav className="flex flex-wrap items-center gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.path}
              onClick={() => navigate(s.path)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
      {/* Main area: ring + results on top, articles below */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {/* One ring for both cards, toggled between the next event and the last */}
        <Card className="flex min-h-0 min-w-0 flex-[3] flex-col overflow-hidden">
          <CardHeader className="shrink-0 p-3 pb-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex shrink-0 gap-1 rounded-lg bg-secondary p-0.5">
                {[
                  { key: 'next', label: 'Next event' },
                  { key: 'last', label: 'Last event' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setEventMode(tab.key); setActive(0) }}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      eventMode === tab.key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="min-w-0 sm:text-right">
                <CardTitle className="truncate text-sm">
                  {shownEvent ? shownEvent.name : '—'}
                </CardTitle>
                {shownEvent && (
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(shownEvent.date)}
                    {shownEvent.location ? ` · ${shownEvent.location}` : ''}
                    {` · ${ringItems.length} fights`}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 items-center p-3 pt-0">
            {ringItems.length === 0 ? (
              <p className="w-full py-10 text-center text-sm text-muted-foreground">
                {eventMode === 'next' ? 'No upcoming fights scheduled.' : 'No results yet.'}
              </p>
            ) : (
              <CardRing
                // Remount on mode change so the ring never animates a next-event card
                // into a last-event one.
                key={eventMode}
                items={ringItems}
                active={active}
                onActiveChange={setActive}
                // Card size is solved from the panel's measured size; these only bound it.
                minCardWidth={150}
                maxCardWidth={340}
                ariaLabel={eventMode === 'next' ? 'Upcoming fights' : 'Last event results'}
                renderItem={(item, { isActive }) => (
                  <FightRingCard
                    fight={item.fight}
                    isActive={isActive}
                    onClick={() => navigate(`/ufc/fights/${item.fight.id}`)}
                  />
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Articles — placeholder until the feed lands */}
        <Card className="flex min-h-[120px] flex-[2] flex-col overflow-hidden">
          <CardHeader className="shrink-0 p-3 pb-1">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              Articles
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-3 pt-0">
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
              <p className="text-xs text-muted-foreground">Articles coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right rail: pound-for-pound, full height */}
      <Card className="flex min-h-0 shrink-0 flex-col overflow-hidden lg:w-72">
        <CardHeader className="shrink-0 space-y-2 p-3 pb-1">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Top 10 Pound-for-Pound
          </CardTitle>
          {hasWomensP4P && (
            <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
              {[
                { key: 'p4p_men', label: 'Men' },
                { key: 'p4p_women', label: 'Women' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDivision(tab.key)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    division === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-3 pt-0">
          <ScrollArea className="h-full">
            {p4p.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Rankings unavailable.
              </p>
            ) : (
              <div className="space-y-0.5">
                {p4p.map((f) => (
                  <P4PRow
                    key={f.id}
                    fighter={f}
                    onClick={() => navigate(`/ufc/fighters/${f.id}`)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

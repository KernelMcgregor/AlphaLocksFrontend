import { Calendar, CalendarIcon, ChevronDown, Clock, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import WeightClassBadge from '../components/WeightClassBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Separator } from '../components/ui/separator'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../components/ui/table'
import CountryFlag from '../components/CountryFlag'
import UpcomingFightCard from '../components/sports/UpcomingFightCard'
import { fetchEvents, fetchEventDetail, fetchEventPredictions, fetchModelMetrics, fetchUpcomingEvents } from '../lib/api'
import { ScrollArea } from '../components/ui/scroll-area'
import { cn, formatDate } from '../lib/utils'

function MetricCard({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function ConfidenceBar({ label, accuracy, fights, correct, roi }) {
  const pct = (accuracy * 100).toFixed(1)
  const profitable = roi > 0
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-16 text-sm font-medium text-right shrink-0">{label}</span>
      <div className="flex-1 h-8 bg-secondary rounded-md overflow-hidden relative">
        <div
          className={cn(
            'h-full rounded-md transition-all',
            profitable ? 'bg-emerald-500' : 'bg-amber-500',
          )}
          style={{ width: `${Math.min(accuracy * 100, 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
          {pct}%
        </span>
      </div>
      <span className="w-24 text-xs text-muted-foreground text-right shrink-0 tabular-nums">
        {correct}/{fights}
      </span>
    </div>
  )
}

function PastFightCard({ fight, prediction }) {
  const { red_fighter, blue_fighter, winner } = fight
  const winnerId = String(winner?.id || '')
  const redWon = winnerId === String(red_fighter?.id || '')
  const blueWon = winnerId === String(blue_fighter?.id || '')
  const pred = prediction || null
  const predCorrect = pred && winner ? pred.predicted_winner === (redWon ? 'red' : 'blue') : null

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      {fight.weight_class && (
        <div className="mb-2">
          <WeightClassBadge weightClass={fight.weight_class} />
          {winner && fight.method && (
            <Badge variant="secondary" className="text-[10px] ml-1.5">
              {fight.method.trim()} {fight.finish_round ? `R${fight.finish_round}` : ''}
            </Badge>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <CountryFlag countryCode={red_fighter?.country_code} />
            <span className={cn('text-sm font-semibold', redWon && 'text-emerald-500')}>
              {red_fighter?.first_name} {red_fighter?.last_name}
            </span>
            {redWon && <Trophy className="h-3 w-3 text-emerald-500" />}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {red_fighter?.wins}-{red_fighter?.losses}{red_fighter?.draws > 0 ? `-${red_fighter.draws}` : ''}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <CountryFlag countryCode={blue_fighter?.country_code} />
            <span className={cn('text-sm font-semibold', blueWon && 'text-emerald-500')}>
              {blue_fighter?.first_name} {blue_fighter?.last_name}
            </span>
            {blueWon && <Trophy className="h-3 w-3 text-emerald-500" />}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {blue_fighter?.wins}-{blue_fighter?.losses}{blue_fighter?.draws > 0 ? `-${blue_fighter.draws}` : ''}
          </span>
        </div>
      </div>

      {pred ? (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'h-2 w-2 rounded-full',
              pred.predicted_winner === 'red' ? 'bg-red-500' : 'bg-blue-500'
            )} />
            <span className="text-muted-foreground">Pick:</span>
            <span className="font-semibold">
              {pred.predicted_winner === 'red'
                ? `${red_fighter?.first_name} ${red_fighter?.last_name}`
                : `${blue_fighter?.first_name} ${blue_fighter?.last_name}`}
            </span>
            <span className="text-muted-foreground">({(pred.red_prob > 0.5 ? pred.red_prob : 1 - pred.red_prob) * 100 | 0}%)</span>
          </div>
          {winner && (
            <Badge className={cn(
              'text-[10px]',
              predCorrect
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                : 'bg-red-500/15 text-red-500 border-red-500/30'
            )}>
              {predCorrect ? 'Correct' : 'Wrong'}
            </Badge>
          )}
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          No prediction
        </div>
      )}
    </div>
  )
}

/** Gap between filter chips, in px. Must match the `gap-2` on the row below. */
const TAB_GAP = 8

/**
 * Event filter chips that fill one row and spill the remainder into a "More" menu.
 *
 * The cut-off is measured, not guessed: event names vary from "UFC 333" to
 * "UFC Fight Night: Volkanovski vs. Evloev", so a fixed count would either wrap on a
 * laptop or leave half the row empty on a wide monitor. A hidden copy of the full row
 * supplies each chip's natural width; a ResizeObserver supplies the space available.
 *
 * Until the first measurement lands, `widths` is empty and every chip renders — the row
 * may wrap for one frame, which is preferable to flashing an empty filter bar.
 */
function EventTabs({ events, value, onChange }) {
  const containerRef = useRef(null)
  const measureRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [widths, setWidths] = useState([])
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    ro.observe(el)
    setContainerWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Re-measure whenever the card list changes: names drive chip width.
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    setWidths(Array.from(el.children).map((c) => c.getBoundingClientRect().width))
  }, [events])

  // widths = [All, ...events, More]. The All chip is never hidden; it is the reset.
  const visibleCount = (() => {
    if (!containerWidth || widths.length !== events.length + 2) return events.length
    const allW = widths[0]
    const moreW = widths[widths.length - 1]
    let used = allW
    for (let i = 0; i < events.length; i++) {
      const next = used + TAB_GAP + widths[i + 1]
      // Every chip past this one must still leave room for the More button, unless this
      // is the last chip — then More isn't rendered and its width is free.
      const needsMore = i < events.length - 1
      if (next + (needsMore ? TAB_GAP + moreW : 0) > containerWidth) return i
      used = next
    }
    return events.length
  })()

  const shown = events.slice(0, visibleCount)
  const overflow = events.slice(visibleCount)
  const selectedHidden = overflow.some((e) => e.id === value)

  // shrink-0 is load-bearing twice over: it keeps a chip at its natural width in the
  // visible row (flex children default to shrinking, which squeezed every name into an
  // unreadable stub), and it makes the hidden row measure natural widths rather than
  // squeezed ones — without it every chip measured small, the arithmetic concluded all
  // eight fit, and the row overflowed instead of spilling into the menu.
  const chipClass = 'shrink-0 whitespace-nowrap'

  return (
    <div className="relative hidden md:block shrink-0">
      {/* Hidden mirror of the full row, used only for width measurement. `w-max` keeps it
          out of the parent's width so the chips report their natural size. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 flex w-max gap-2"
        style={{ visibility: 'hidden' }}
      >
        <Button variant="outline" size="sm" className={chipClass}>All</Button>
        {events.map((event) => (
          <Button key={event.id} variant="outline" size="sm" className={chipClass}>
            {event.name}
          </Button>
        ))}
        <Button variant="outline" size="sm" className={cn(chipClass, 'gap-1')}>
          More (0) <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={containerRef} className="flex gap-2 overflow-hidden">
        <Button
          variant={value === 'all' ? 'default' : 'outline'}
          size="sm"
          className={chipClass}
          onClick={() => onChange('all')}
        >
          All
        </Button>
        {shown.map((event) => (
          <Button
            key={event.id}
            variant={value === event.id ? 'default' : 'outline'}
            size="sm"
            className={chipClass}
            onClick={() => onChange(event.id)}
          >
            {event.name}
          </Button>
        ))}
        {overflow.length > 0 && (
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={selectedHidden ? 'default' : 'outline'}
                size="sm"
                // Bounded: when the selection lives in the menu this shows the event's
                // name, which is longer than the "More (N)" the layout was measured
                // against and would otherwise push the row wider than it budgeted for.
                className="max-w-[15rem] shrink-0 gap-1"
              >
                <span className="truncate">
                  {selectedHidden
                    ? events.find((e) => e.id === value)?.name
                    : `More (${overflow.length})`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1.5">
              <div className="flex flex-col">
                {overflow.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => { onChange(event.id); setMoreOpen(false) }}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      event.id === value
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <span className="text-sm font-medium leading-tight">{event.name}</span>
                    <span
                      className={cn(
                        'text-[11px]',
                        event.id === value ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {formatDate(event.date)} · {event.fights.length} bout{event.fights.length === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 1)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function DateRangeFilter({ dateRange, onApply }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(dateRange.from)
  const [to, setTo] = useState(dateRange.to)

  useEffect(() => {
    if (open) { setFrom(dateRange.from); setTo(dateRange.to) }
  }, [open, dateRange])

  const presets = [
    { label: '6 months', months: 6 },
    { label: '1 year', months: 12 },
    { label: '2 years', months: 24 },
    { label: 'All time', months: null },
  ]

  const applyPreset = (months) => {
    const t = new Date()
    setTo(t.toISOString().slice(0, 10))
    if (months) {
      const f = new Date()
      f.setMonth(f.getMonth() - months)
      setFrom(f.toISOString().slice(0, 10))
    } else {
      setFrom('1993-01-01')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <CalendarIcon className="h-3.5 w-3.5" />
          {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.months)}
                className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">To</label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex justify-end gap-2 p-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => { onApply({ from, to }); setOpen(false) }}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function ModelPage({ tab = 'upcoming' }) {
  const navigate = useNavigate()
  const [allEvents, setAllEvents] = useState([])
  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [eventDetail, setEventDetail] = useState(null)
  const [eventLoading, setEventLoading] = useState(false)
  const [predictions, setPredictions] = useState({})
  const [metrics, setMetrics] = useState(null)
  const [upcoming, setUpcoming] = useState(null)
  const [upcomingFilter, setUpcomingFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchModelMetrics().then(setMetrics).catch(() => {})
    fetchUpcomingEvents().then(setUpcoming).catch(() => setUpcoming([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchEvents({ limit: 500 })
      .then((all) => {
        const now = new Date()
        const past = all
          .filter((e) => new Date(e.date) < now)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
        setAllEvents(past)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const events = allEvents.filter((e) => {
    const d = e.date?.slice(0, 10)
    return d >= dateRange.from && d <= dateRange.to
  })

  useEffect(() => {
    if (events.length > 0 && !events.find(e => e.id === selectedEventId)) {
      setSelectedEventId(events[0].id)
    }
  }, [dateRange, allEvents])

  useEffect(() => {
    if (!selectedEventId) {
      setEventDetail(null)
      setPredictions({})
      return
    }
    setEventLoading(true)
    Promise.all([
      fetchEventDetail(selectedEventId),
      fetchEventPredictions(selectedEventId),
    ])
      .then(([detail, preds]) => {
        setEventDetail(detail)
        setPredictions(preds || {})
      })
      .catch(() => {
        setEventDetail(null)
        setPredictions({})
      })
      .finally(() => setEventLoading(false))
  }, [selectedEventId])

  return (
    <div className="h-full flex flex-col">
      {tab === 'upcoming' && (
        <div className="flex-1 flex flex-col min-h-0">
          {!upcoming ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Calendar className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No upcoming events</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 h-full min-h-0">
              <div className="shrink-0 space-y-3">
                <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                    <Clock className="h-5 w-5 text-white" />
                  </span>
                  Upcoming
                  <span className="text-sm font-medium text-muted-foreground">— click any fight to view details</span>
                </h1>
              </div>
              <EventTabs
                events={upcoming}
                value={upcomingFilter}
                onChange={setUpcomingFilter}
              />
              <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <CardContent className="flex-1 min-h-0 pt-4">
                <ScrollArea className="h-full">
                  {upcoming.filter(e => upcomingFilter === 'all' || e.id === upcomingFilter).map((event, idx) => (
                    // A full-width rule above every event but the first. Cards carry their
                    // own borders, so the gap alone did not read as a section break once
                    // a card grid sat on both sides of it.
                    <div
                      key={event.id}
                      className={cn(idx > 0 && 'mt-6 border-t-2 border-border pt-5')}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-[15px] font-bold tracking-tight">{event.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.date)}{event.location ? ` — ${event.location}` : ''}
                        </span>
                      </div>
                      <div className="grid gap-2.5 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
                        {event.fights.map(fight => (
                          <UpcomingFightCard
                            key={fight.id}
                            fight={fight}
                            onOpen={() => navigate(`/ufc/fights/${fight.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
                </CardContent>
              </Card>
              {(() => {
                const filtered = upcoming.filter(e => upcomingFilter === 'all' || e.id === upcomingFilter)
                const allOdds = filtered.flatMap(e => e.fights.flatMap(f => f.odds || []))
                if (!allOdds.length) return null
                const latest = allOdds
                  .filter(o => o.updated_at)
                  .map(o => new Date(o.updated_at))
                  .sort((a, b) => b - a)[0]
                return (
                  <div className="shrink-0 text-[10px] text-muted-foreground mt-2 px-1">
                    <span>Odds from DraftKings unless otherwise indicated</span>
                    {latest && (
                      <span className="ml-2">
                        · Last updated {latest.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'past' && (
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="flex gap-4 h-full">
              {/* Event list */}
              <Card className="w-72 shrink-0 flex flex-col">
                <CardHeader className="pb-2 space-y-2">
                  <CardTitle className="text-sm">Events</CardTitle>
                  <DateRangeFilter dateRange={dateRange} onApply={setDateRange} />
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                <ScrollArea className="h-full space-y-1">
                  {events.map(event => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className={cn(
                        'w-full text-left rounded-md px-2.5 py-2 text-sm transition-all',
                        selectedEventId === event.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <div className="font-medium text-foreground truncate">{event.name}</div>
                      <div className="text-xs mt-0.5">{formatDate(event.date)}</div>
                    </button>
                  ))}
                </ScrollArea>
                </CardContent>
              </Card>

              {/* Fight cards */}
              <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {eventDetail ? eventDetail.name : 'Fights'}
                    </CardTitle>
                    {eventDetail && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(eventDetail.date)} — {eventDetail.fights.length} fights
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                <ScrollArea className="h-full">
                  {eventLoading && (
                    <div className="flex items-center justify-center h-32">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                  {eventDetail && !eventLoading && (
                    <div className="grid gap-2 grid-cols-1 xl:grid-cols-2">
                      {eventDetail.fights.map(fight => (
                        <PastFightCard key={fight.id} fight={fight} prediction={predictions[String(fight.id)]} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab === 'metrics' && (
        <ScrollArea className="flex-1">
          {!metrics ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Headline stats */}
              <div className="grid grid-cols-4 gap-3">
                <MetricCard
                  label="Overall Accuracy"
                  value={`${(metrics.accuracy * 100).toFixed(1)}%`}
                  sub={`${metrics.correct} / ${metrics.total} fights`}
                />
                <MetricCard
                  label="High Confidence"
                  value={(() => {
                    const high = metrics.confidence_splits.filter(s => s.label.match(/7|8/))
                    const t = high.reduce((a, s) => a + s.fights, 0)
                    const c = high.reduce((a, s) => a + s.correct, 0)
                    return t ? `${(c / t * 100).toFixed(1)}%` : '—'
                  })()}
                  sub="70%+ confidence"
                />
                <MetricCard
                  label="Best Bucket"
                  value={(() => {
                    const best = metrics.confidence_splits.reduce((a, b) => b.accuracy > a.accuracy ? b : a, { accuracy: 0 })
                    return `${(best.accuracy * 100).toFixed(1)}%`
                  })()}
                  sub={(() => {
                    const best = metrics.confidence_splits.reduce((a, b) => b.accuracy > a.accuracy ? b : a, { accuracy: 0, label: '' })
                    return `${best.label} confidence`
                  })()}
                />
                <MetricCard
                  label="Total P/L"
                  value={`${metrics.total_pl >= 0 ? '+' : ''}$${Math.abs(metrics.total_pl).toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                  sub={`${metrics.total_roi >= 0 ? '+' : ''}${metrics.total_roi.toFixed(1)}% ROI`}
                />
              </div>

              {/* Confidence splits */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Accuracy by Confidence</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Green = profitable (real odds where available, -110 fallback)
                  </p>
                </CardHeader>
                <CardContent>
                  {metrics.confidence_splits.map(split => (
                    <ConfidenceBar
                      key={split.label}
                      label={split.label}
                      accuracy={split.accuracy}
                      fights={split.fights}
                      correct={split.correct}
                      roi={split.roi}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* Profitability simulation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Flat Bet P/L ($100/fight)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Confidence</TableHead>
                        <TableHead className="text-right">Fights</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">P/L</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.confidence_splits.filter(s => s.fights_with_odds > 0).map(split => {
                        const profitable = split.roi > 0
                        return (
                          <TableRow key={split.label}>
                            <TableCell className="font-medium">{split.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{split.fights_with_odds}</TableCell>
                            <TableCell className="text-right tabular-nums">{(split.accuracy_with_odds * 100).toFixed(1)}%</TableCell>
                            <TableCell className={cn('text-right tabular-nums font-semibold', profitable ? 'text-emerald-500' : 'text-red-500')}>
                              {split.pl >= 0 ? '+' : ''}${split.pl.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </TableCell>
                            <TableCell className={cn('text-right tabular-nums font-semibold', profitable ? 'text-emerald-500' : 'text-red-500')}>
                              {split.roi >= 0 ? '+' : ''}{split.roi.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">All Picks</TableCell>
                        <TableCell className="text-right tabular-nums font-bold">{metrics.total_with_odds}</TableCell>
                        <TableCell className="text-right tabular-nums font-bold">{metrics.total_with_odds ? ((metrics.confidence_splits.reduce((a, s) => a + s.correct_with_odds, 0) / metrics.total_with_odds) * 100).toFixed(1) : 0}%</TableCell>
                        <TableCell className={cn('text-right tabular-nums font-bold', metrics.total_pl >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {metrics.total_pl >= 0 ? '+' : ''}${metrics.total_pl.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </TableCell>
                        <TableCell className={cn('text-right tabular-nums font-bold', metrics.total_roi >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {metrics.total_roi >= 0 ? '+' : ''}{metrics.total_roi.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  )
}

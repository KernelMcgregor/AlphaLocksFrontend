import { Calendar, CalendarIcon, MapPin, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import CountryFlag from '../components/CountryFlag'
import WeightClassBadge from '../components/WeightClassBadge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Separator } from '../components/ui/separator'
import { fetchEventDetail, fetchEventPredictions, fetchEvents } from '../lib/api'
import { cn, formatDate } from '../lib/utils'

function EventListItem({ event, isSelected, onClick }) {
  const isUpcoming = new Date(event.date) > new Date()
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-all hover:border-primary/30',
        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{event.name}</h3>
            {isUpcoming && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] shrink-0">
                Upcoming
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {formatDate(event.date)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function formatOdds(odds) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
}

function CompactFightCard({ fight, prediction, onClick }) {
  const { red_fighter, blue_fighter, winner } = fight
  const winnerId = String(winner?.id || '')
  const redWon = winnerId === String(red_fighter?.id || '')
  const blueWon = winnerId === String(blue_fighter?.id || '')
  const pred = prediction || null
  const predCorrect = pred && winner ? pred.predicted_winner === (redWon ? 'red' : 'blue') : null

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      {fight.weight_class && (
        <div className="mb-2">
          <WeightClassBadge weightClass={fight.weight_class} />
        </div>
      )}

      <div className="space-y-2">
        {/* Red fighter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <CountryFlag countryCode={red_fighter?.country_code} />
            <span className={cn('text-sm font-semibold truncate', redWon && 'text-emerald-500')}>
              {red_fighter?.first_name} {red_fighter?.last_name}
            </span>
            {red_fighter?.nickname && (
              <span className="text-xs text-muted-foreground truncate">"{red_fighter.nickname}"</span>
            )}
            {redWon && <Trophy className="h-3 w-3 text-emerald-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
            {fight.red_odds != null && (
              <span className="font-mono tabular-nums">{formatOdds(fight.red_odds)}</span>
            )}
            <span className="font-semibold text-foreground tabular-nums">
              {red_fighter?.wins}-{red_fighter?.losses}{red_fighter?.draws > 0 ? `-${red_fighter.draws}` : ''}
            </span>
          </div>
        </div>

        {/* Blue fighter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            <CountryFlag countryCode={blue_fighter?.country_code} />
            <span className={cn('text-sm font-semibold truncate', blueWon && 'text-emerald-500')}>
              {blue_fighter?.first_name} {blue_fighter?.last_name}
            </span>
            {blue_fighter?.nickname && (
              <span className="text-xs text-muted-foreground truncate">"{blue_fighter.nickname}"</span>
            )}
            {blueWon && <Trophy className="h-3 w-3 text-emerald-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
            {fight.blue_odds != null && (
              <span className="font-mono tabular-nums">{formatOdds(fight.blue_odds)}</span>
            )}
            <span className="font-semibold text-foreground tabular-nums">
              {blue_fighter?.wins}-{blue_fighter?.losses}{blue_fighter?.draws > 0 ? `-${blue_fighter.draws}` : ''}
            </span>
          </div>
        </div>
      </div>

      {pred && (
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
      )}
    </button>
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

export default function UFCPage() {
  const navigate = useNavigate()
  const [allEvents, setAllEvents] = useState([])
  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [eventDetail, setEventDetail] = useState(null)
  const [predictions, setPredictions] = useState({})
  const [eventLoading, setEventLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchEvents({ limit: 500 })
      .then((all) => {
        all.sort((a, b) => new Date(b.date) - new Date(a.date))
        setAllEvents(all)
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
      const now = new Date()
      const upcoming = events.find((e) => new Date(e.date) >= now)
      setSelectedEventId(upcoming?.id || events[0].id)
    }
  }, [dateRange, allEvents])

  useEffect(() => {
    if (!selectedEventId) {
      setEventDetail(null)
      return
    }
    setEventLoading(true)
    Promise.all([
      fetchEventDetail(selectedEventId),
      fetchEventPredictions(selectedEventId).catch(() => ({})),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Events list card */}
      <Card className="w-80 shrink-0 flex flex-col">
        <CardHeader className="pb-3 space-y-2">
          <CardTitle className="text-base">Events</CardTitle>
          <DateRangeFilter dateRange={dateRange} onApply={setDateRange} />
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-1.5 pt-0">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No events found.</p>
          ) : (
            events.map(event => (
              <EventListItem
                key={event.id}
                event={event}
                isSelected={selectedEventId === event.id}
                onClick={() => setSelectedEventId(event.id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Fights card */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {eventDetail ? eventDetail.name : 'Fights'}
            </CardTitle>
            {eventDetail && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(eventDetail.date)}</span>
                {eventDetail.location && <span>{eventDetail.location}</span>}
                <Badge variant="secondary" className="text-[10px]">{eventDetail.fights.length} fights</Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pt-0">
          {!selectedEventId && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Calendar className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Select an event</p>
            </div>
          )}

          {selectedEventId && eventLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {eventDetail && !eventLoading && (
            eventDetail.fights.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No fights for this event.</p>
            ) : (
              <div className="grid gap-2 grid-cols-1 xl:grid-cols-2">
                {eventDetail.fights.map(fight => (
                  <CompactFightCard
                    key={fight.id}
                    fight={fight}
                    prediction={predictions[String(fight.id)]}
                    onClick={() => navigate(`/ufc/fights/${fight.id}`)}
                  />
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}

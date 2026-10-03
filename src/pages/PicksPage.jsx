// src/pages/PicksPage.jsx
//
// Every market on an upcoming card, graded. One card per market: the pick, its price,
// the model against the de-vigged market, the edge and EV, and a letter grade.
//
// The grade is not a function of edge size. It is the realised ROI of that edge band in
// that market's walk-forward backtest (backend: app/services/ufc/grading.py), which is why
// a 10% edge on the moneyline and a 10% edge on "by KO" can land letters apart.
import { Target } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import PickCard from '../components/picks/PickCard'
import PicksFilterBar from '../components/picks/PicksFilterBar'
import { fetchPicksAll, fetchPicksV2, fetchUpcomingEvents, peekCached } from '../lib/api'
import {
  DEFAULT_FILTERS, ago, flattenPicks, gradeRank, priced, sortPicks,
} from '../lib/picks'
import { formatDate } from '../lib/utils'

// v2: defaults changed to everything shown; a saved v1 filter would hide most of the page.
// v3: one best pick per fight and typical prices by default.
const FILTER_KEY = 'picks.filters.v3'
// "All events" is several hundred cards, each with portraits; render them in pages.
const PAGE = 60

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null')
    return saved ? { ...DEFAULT_FILTERS, ...saved, q: '' } : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

/** Does a row pass every filter except, optionally, the market-group one? */
function passes(row, f, { ignoreGroups = false } = {}) {
  // "Best per fight": several markets often carry one opinion (X by decision, goes to
  // decision, not Y inside the distance); the API marks the strongest as primary.
  if (f.scope === 'primary' && !row.primary) return false
  if (!ignoreGroups && f.groups.length && !f.groups.includes(row.group)) return false
  if (f.minGrade === 'picks' && row.grade === '—') return false
  if (!['all', 'picks'].includes(f.minGrade) && gradeRank(row.grade) > gradeRank(f.minGrade)) return false
  if (f.book !== 'all' && row.best_book !== f.book) return false
  const a = priced(row, f.basis).american
  if (f.side === 'fav' && !(a != null && a < 0)) return false
  if (f.side === 'dog' && !(a != null && a > 0)) return false
  if (f.q) {
    const q = f.q.toLowerCase()
    if (!`${row.fight.red.name} ${row.fight.blue.name} ${row.label}`.toLowerCase().includes(q)) return false
  }
  return true
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-[380px] animate-pulse rounded-xl border border-border bg-muted/40" />
      ))}
    </div>
  )
}

export default function PicksPage() {
  const [events, setEvents] = useState(() => peekCached('/ufc/upcoming'))
  const [eventId, setEventId] = useState('all')
  // Keyed by the events it was fetched for, so switching events shows the skeleton
  // instead of the previous card, without resetting state inside the effect.
  const [result, setResult] = useState(null)
  const [filters, setFilters] = useState(loadFilters)

  useEffect(() => {
    fetchUpcomingEvents().then(setEvents).catch(() => setEvents([]))
  }, [])

  // "All events" is one batched request (all=true); a single card is its own. Neither waits
  // for the upcoming-events list, which only fills the Event dropdown.
  const key = eventId

  useEffect(() => {
    let live = true
    const load = key === 'all' ? fetchPicksAll() : fetchPicksV2(key).then((d) => [d])
    load
      .then((list) => live && setResult({ key, data: list.filter((d) => d.event && d.fights?.length) }))
      .catch((e) => live && setResult({ key, error: e.message }))
    return () => { live = false }
  }, [key])
  const current = result?.key === key ? result : null
  const data = current?.data ?? null
  const error = current?.error ?? null
  const single = data?.length === 1 ? data[0].event : null

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)) } catch { /* storage unavailable */ }
  }, [filters])

  const rows = useMemo(() => flattenPicks(data), [data])

  const books = useMemo(() => {
    const s = new Set()
    for (const r of rows) {
      if (r.best_book) s.add(r.best_book)
      for (const b of Object.keys(r.books || {})) s.add(b)
    }
    return [...s].sort()
  }, [rows])

  const counts = useMemo(() => {
    const c = {}
    for (const r of rows) if (passes(r, filters, { ignoreGroups: true })) c[r.group] = (c[r.group] || 0) + 1
    return c
  }, [rows, filters])

  const visible = useMemo(
    () => sortPicks(rows.filter((r) => passes(r, filters)), filters.sort, filters.basis),
    [rows, filters],
  )

  // How many cards are rendered. Keyed by the query, so any filter or event change starts
  // back at one page without an effect resetting it.
  const sig = `${key}|${JSON.stringify(filters)}`
  const [shownFor, setShownFor] = useState({ sig, n: PAGE })
  const limit = shownFor.sig === sig ? shownFor.n : PAGE
  const more = () => setShownFor({ sig, n: limit + PAGE })
  const sentinel = useRef(null)
  const hasMore = visible.length > limit
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShownFor({ sig, n: limit + PAGE }), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, limit, sig])

  // Freshest price on the page, for the header line.
  const newest = useMemo(
    () => rows.reduce((t, r) => (r.price_captured_at && r.price_captured_at > t ? r.price_captured_at : t), ''),
    [rows],
  )

  // The upcoming list when it has loaded, else the cards the all-events payload carries.
  const eventList = useMemo(() => {
    if (events?.length) return events.map((e) => ({ id: String(e.id), name: e.name }))
    return key === 'all' && data ? data.map((d) => ({ id: d.event.id, name: d.event.name })) : []
  }, [events, data, key])

  return (
    // The layout clips its content on desktop (pages own their scroll), so this div is the
    // scroll container; the filter bar's `sticky top-0` pins to it.
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-8 pr-1">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Target className="h-5 w-5 text-white" />
          </span>
          Picks
        </h1>
        {data?.length > 0 && (
          <div className="pb-0.5 text-[12.5px] text-muted-foreground">
            {single ? (
              <>
                <span className="font-semibold text-foreground">{single.name}</span>
                {single.date && <> · {formatDate(single.date)}</>}
              </>
            ) : (
              <span className="font-semibold text-foreground">{data.length} upcoming events</span>
            )}
            {newest && <> · prices updated {ago(newest)}</>}
            {data[0].grade_table?.version && <> · grade table {data[0].grade_table.version}</>}
          </div>
        )}
      </div>

      <PicksFilterBar
        filters={filters}
        setFilters={setFilters}
        events={eventList}
        eventId={eventId}
        onEvent={(id) => setEventId(id)}
        books={books}
        counts={counts}
        shown={visible.length}
      />

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-6 text-center text-[13px] text-rose-700">
          Couldn’t load picks: {error}
        </div>
      ) : !data ? (
        <Skeleton />
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-[13px] text-muted-foreground">
          No markets priced for this card yet. Props usually post during fight week.
        </div>
      ) : !visible.length ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-[13px] text-muted-foreground">
          No markets match these filters.{' '}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.slice(0, limit).map((r) => <PickCard key={r.id} row={r} basis={filters.basis} showEvent={!single} />)}
        </div>
      )}

      {data && hasMore && (
        <div ref={sentinel} className="flex justify-center">
          <button type="button" onClick={more} className="rounded-md border border-border bg-card px-4 py-2 text-[12.5px] font-semibold hover:bg-accent">
            Show more ({visible.length - limit} left)
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Grades describe how each market’s edge bands performed in past walk-forward backtests. They are not guarantees.
        Exchange prices never feed a grade. Bet responsibly.
      </p>
    </div>
  )
}

// Past Model Results — what every model pick would have returned on past cards, and how far
// to trust the model by edge size and other splits.
//
// Backed by /ufc/model/results/* over the walk-forward backtest ledger
// (alocks-backend/app/services/ufc/model_results.py), rebuilt after every event.
//
// Tab, filters and the selected event live in the URL (?tab=transparency&basis=open&event=...)
// so any view is a link someone can share.
import { TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { Card, CardContent } from '../components/ui/card'
import { SlideTabs } from '../components/ui/slide-tabs'
import PastEventsTab from '../components/results/PastEventsTab'
import ResultsFilterBar from '../components/results/ResultsFilterBar'
import TransparencyTab from '../components/results/TransparencyTab'
import { filterParams, readFilters, resultsQuery } from '../components/results/filters'
import { fetchPastResultsEvents, fetchPastResultsSplits, pastResultsPath, peekCached } from '../lib/api'

const TABS = [
  { key: 'events', label: 'Performance' },
  { key: 'transparency', label: 'Why trust it' },
]

export default function PastResultsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'transparency' ? 'transparency' : 'events'
  const filters = readFilters(params)
  const q = resultsQuery(filters)
  const path = tab === 'events' ? pastResultsPath.events(q) : pastResultsPath.splits(q)
  // answers keyed by path, plus the last answer per tab, which stays on screen (faded)
  // while a filter change loads
  const [got, setGot] = useState({})

  useEffect(() => {
    let live = true
    const fetcher = tab === 'events' ? fetchPastResultsEvents : fetchPastResultsSplits
    fetcher(q)
      .then((d) => live && setGot((g) => ({ ...g, [path]: { data: d }, [`last:${tab}`]: d })))
      .catch((e) => live && setGot((g) => ({ ...g, [path]: { error: e.message } })))
    return () => { live = false }
  }, [path, q, tab])

  // selecting an event swaps the detail panel in place, so it replaces the URL (no history spam)
  const go = (next) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) (v == null ? p.delete(k) : p.set(k, v))
    setParams(p, { replace: true })
  }
  const setFilters = (f) => go({ ...filterParams(f), event: params.get('event') })

  const fresh = got[path]?.data || peekCached(path)
  const data = fresh || got[`last:${tab}`]
  const loading = !fresh && !got[path]?.error
  const error = got[path]?.error

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-primary">
            <TrendingUp className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <h1 className="page-title">Model Results</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Walk-forward backtest · flat 1u · {filters.basis === 'open' ? 'opening' : 'closing'} line{filters.top && filters.minEv !== 'pick' ? ' · one pick per market' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ResultsFilterBar filters={filters} onChange={setFilters} coverage={data?.coverage} />
          <SlideTabs tabs={TABS} value={tab} onChange={(t) => go({ tab: t === 'events' ? null : t })} />
        </div>
      </div>

      {error ? (
        <Card><CardContent className="p-6"><p className="text-destructive">Couldn't load past results: {error}</p></CardContent></Card>
      ) : !data ? (
        <PageLoader />
      ) : (
        <div className={loading ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
          {tab === 'events' ? (
            <PastEventsTab data={data} filters={filters} onFilters={setFilters}
              eventId={params.get('event')} onEvent={(id) => go({ event: id })} />
          ) : (
            <TransparencyTab data={data} filters={filters} />
          )}
        </div>
      )}
    </div>
  )
}

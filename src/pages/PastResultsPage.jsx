// Past Model Results — what every model pick would have returned on past cards, and how far
// to trust the model by edge size and other splits.
//
// Backed by /ufc/model/results/* over the walk-forward backtest ledger
// (alocks-backend/app/services/ufc/model_results.py), rebuilt after every event.
//
// Tab, filters and the opened event live in the URL (?tab=transparency&basis=open&event=...)
// so any view is a link someone can share.
import { History } from 'lucide-react'
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
  { key: 'events', label: 'Past Events' },
  { key: 'transparency', label: 'Model Transparency' },
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
    <div className="flex h-full flex-col overflow-y-auto pr-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><History className="h-5 w-5 text-white" /></span>
            Past Model Results
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Every pick the models would have made on past cards, flat 1 unit, from walk-forward backtests.
          </p>
        </div>
        <SlideTabs tabs={TABS} value={tab} onChange={(t) => go({ tab: t === 'events' ? null : t })} />
      </div>

      <div className="sticky top-0 z-10 -mx-1 mb-3 bg-background/95 px-1 pb-1 backdrop-blur">
        <ResultsFilterBar filters={filters} onChange={setFilters} coverage={data?.coverage} />
      </div>

      {error ? (
        <Card><CardContent className="p-6"><p className="text-destructive">Couldn't load past results: {error}</p></CardContent></Card>
      ) : !data ? (
        <PageLoader />
      ) : (
        <div className={loading ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}>
          {tab === 'events' ? (
            <PastEventsTab data={data} filters={filters} eventId={params.get('event')}
              onEvent={(id) => go({ event: id })} />
          ) : (
            <TransparencyTab data={data} filters={filters} />
          )}
        </div>
      )}
    </div>
  )
}

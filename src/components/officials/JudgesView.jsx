// Officials page, Judges view — every UFC judge measured against what most judges would
// score on the same rounds. The selected judge (?j=) fills the side panel, as on Rankings.
//
// Backed by /ufc/judges and /ufc/judges/agreement (the map). Tab, filter, search, sort and
// selection live in the URL so any view is a link.
import { Search } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../PageLoader'
import JudgeMap from './JudgeMap'
import JudgePanel from './JudgePanel'
import JudgeTable, { JUDGE_SORT } from './JudgeTable'
import { ErrorCard } from './shared'
import { sortRows, useLoad, useUrlSort } from './lib'
import { SlideTabs } from '../ui/slide-tabs'
import { fetchJudgeAgreement, fetchJudges } from '../../lib/officialsApi'

const TABS = [
  { key: 'board', label: 'Leaderboard' },
  { key: 'map', label: 'Map' },
]
const SHOW = [
  { key: 'eligible', label: '150+ rounds' },
  { key: 'all', label: 'All' },
]

// The view's controls, rendered in the page header row (state lives in the URL).
export function JudgeControls() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'board'
  const show = params.get('show') === 'all' ? 'all' : 'eligible'
  const set = (k, v) => {
    const p = new URLSearchParams(params)
    if (v == null || v === '') p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }
  return (
    <>
      <SlideTabs size="sm" tabs={TABS} value={tab} onChange={(t) => set('tab', t === 'board' ? null : t)} />
      <SlideTabs size="sm" tabs={SHOW} value={show} onChange={(v) => set('show', v === 'all' ? 'all' : null)} />
      {tab === 'board' && (
        <>
          <label className="flex h-8 w-48 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12px] focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={params.get('q') || ''}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Find a judge"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
        </>
      )}
    </>
  )
}

const loadJudges = () => fetchJudges()
const loadAgreement = () => fetchJudgeAgreement()

export default function JudgesView() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'board'
  const show = params.get('show') === 'all' ? 'all' : 'eligible'
  const q = params.get('q') || ''
  const [sort, onSort] = useUrlSort(params, setParams, '-acc')
  const panelRef = useRef(null)

  const { data, error } = useLoad(loadJudges, 'judges')
  const agreement = useLoad(loadAgreement, tab === 'map' ? 'agreement' : null)

  const set = (k, v) => {
    const p = new URLSearchParams(params)
    if (v == null || v === '') p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }

  const rows = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    const pool = data.judges.filter((j) => (show === 'all' || j.eligible) && (!needle || j.name.toLowerCase().includes(needle)))
    return sortRows(pool, sort, JUDGE_SORT(data.pool))
  }, [data, show, q, sort])

  if (error) return <ErrorCard>Couldn't load judges: {error}</ErrorCard>
  if (!data) return <PageLoader />

  const picked = Number(params.get('j'))
  const selected = data.judges.find((j) => j.judge_id === picked) || rows[0]
  // Stacked (below lg) the panel sits above the list, so bring it into view on a pick.
  const select = (id) => {
    set('j', String(id))
    if (!window.matchMedia('(min-width: 1024px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 lg:overflow-hidden">
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[316px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <JudgePanel judge={selected} pool={data.pool} panelRef={panelRef} />
        {tab === 'map' ? (
          <div className="min-h-0">
            {agreement.error ? <ErrorCard>Couldn't load the judge map: {agreement.error}</ErrorCard>
              : agreement.data
                ? <JudgeMap data={agreement.data} judges={data.judges} showAll={show === 'all'} selectedId={selected?.judge_id} onSelect={select} />
                : <PageLoader size={120} />}
          </div>
        ) : (
          <JudgeTable rows={rows} pool={data.pool} sort={sort} onSort={onSort} selectedId={selected?.judge_id} onSelect={select} />
        )}
      </div>
    </div>
  )
}

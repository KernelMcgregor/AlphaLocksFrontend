// Robberies tab: decisions the stats say went to the wrong fighter, worst first, with the
// selected fight (?fight=) in the side panel.
//
// Backed by /ufc/robberies. Window, sort and selection live in the URL.
import { useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../PageLoader'
import { ErrorCard } from '../officials/shared'
import { sortRows, useLoad, useUrlSort } from '../officials/lib'
import { fetchRobberies } from '../../lib/highlightsApi'
import RobberyPanel from './RobberyPanel'
import RobberyTable, { ROBBERY_SORT } from './RobberyTable'
import { useWindow } from './window'

const load = (w) => fetchRobberies(w)

export default function RobberiesView() {
  const [params, setParams] = useSearchParams()
  const w = useWindow()
  const [sort, onSort] = useUrlSort(params, setParams, '-date')
  const panelRef = useRef(null)
  const { data, error } = useLoad(load, w)

  const rows = useMemo(() => (data ? sortRows(data, sort, ROBBERY_SORT) : []), [data, sort])

  if (error) return <ErrorCard>Couldn't load robberies: {error}</ErrorCard>
  if (!data) return <PageLoader />

  const selected = rows.find((r) => r.fight_id === params.get('fight')) || rows[0]
  const select = (id) => {
    const p = new URLSearchParams(params)
    p.set('fight', id)
    setParams(p, { replace: true })
    if (!window.matchMedia('(min-width: 1024px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2 lg:overflow-hidden">
      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[316px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        {selected ? <RobberyPanel r={selected} panelRef={panelRef} /> : <div />}
        <RobberyTable rows={rows} sort={sort} onSort={onSort} selectedId={selected?.fight_id} onSelect={select} />
      </div>
    </div>
  )
}

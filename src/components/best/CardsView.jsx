// Most exciting cards in the window, scored on every bout.
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../PageLoader'
import { ErrorCard, SortHead } from '../officials/shared'
import { shortDate, sortRows, useLoad, useUrlSort } from '../officials/lib'
import { fetchExcitingCards } from '../../lib/highlightsApi'
import CardPanel from './CardPanel'
import { Rank, RankTable, Split } from './layout'
import { Chip, Face } from './marks'
import { cardHighlights, resultText, surname } from './fight'
import { useSelect } from './useSelect'
import { useWindow } from './window'

const GRID = 'grid grid-cols-[28px_minmax(200px,1.3fr)_minmax(200px,1.1fr)_minmax(150px,0.8fr)_76px] items-center gap-3'
const load = (w) => fetchExcitingCards(w, 'full', 100)

// Sortable columns: the event by date, the best fight by its score, the card by its score.
const SORT = (c, k) => (k === 'date' ? c.date : k === 'best' ? c.fights[0]?.pct : c.score)

export default function CardsView() {
  const w = useWindow()
  const [params, setParams] = useSearchParams()
  const [sort, onSort] = useUrlSort(params, setParams, '-score')
  const [picked, select, panelRef] = useSelect('event')
  const { data, error } = useLoad(load, w)
  // Rank is the card's place by score, whatever the table is sorted by.
  const rows = useMemo(() => (data ? sortRows(data.map((c, i) => ({ ...c, rank: i + 1 })), sort, SORT) : []), [data, sort])
  if (error) return <ErrorCard>Couldn't load cards: {error}</ErrorCard>
  if (!data) return <PageLoader />
  const selected = rows.find((c) => c.event_id === picked) || rows[0]
  const head = (k, label, cls) => (
    <span className={cls}><SortHead k={k} sort={sort} onSort={onSort}>{label}</SortHead></span>
  )
  return (
    <Split panel={selected && <CardPanel c={selected} panelRef={panelRef} />}>
      <RankTable
        grid={GRID}
        minW="min-w-[700px]"
        head={(
          <>
            <span />
            {head('date', 'Event')}
            {head('best', 'Best fight')}
            <span>Highlights</span>
            {head('score', 'Card score', 'flex justify-center')}
          </>
        )}
        rows={rows}
        rowKey={(c) => c.event_id}
        selected={selected?.event_id}
        onSelect={select}
        empty="No cards in this window."
        renderRow={(c) => {
          const f = c.fights[0]
          return (
            <>
              <Rank n={c.rank} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold" title={c.event_name}>{c.event_name}</span>
                <span className="block text-[10.5px] font-semibold tabular-nums text-muted-foreground">{shortDate(c.date)} · {c.n_fights} fights</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex shrink-0 gap-0.5">
                  <Face fighter={f.red} className="h-7 w-7" />
                  <Face fighter={f.blue} className="h-7 w-7" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold">{surname(f.red.name, 10)} vs {surname(f.blue.name, 10)}</span>
                  <span className="block text-[10.5px] text-muted-foreground">{resultText(f)}</span>
                </span>
              </span>
              <span className="flex min-w-0 gap-1 overflow-hidden">
                {cardHighlights(c).map((h) => <Chip key={h} text={h} />)}
              </span>
              <span className="flex justify-center">
                <span className="rounded-md bg-ink px-2 py-0.5 font-display text-[18px] font-black italic leading-tight tabular-nums text-white">{Math.round(c.score)}</span>
              </span>
            </>
          )
        }}
      />
    </Split>
  )
}

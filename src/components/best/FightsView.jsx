// Most exciting fights in the window, best first; the picked bout (?fight=) in the panel.
// A name search (?q=) finds any bout, keeping its rank in the window.
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../PageLoader'
import { ErrorCard, SortHead } from '../officials/shared'
import { shortDate, sortRows, useLoad, useUrlSort } from '../officials/lib'
import { fetchExcitingFights } from '../../lib/highlightsApi'
import FightPanel from './FightPanel'
import { resultText, whyExciting } from './fight'
import { Rank, RankTable, Split } from './layout'
import { BonusMarks, Chip } from './marks'
import { useSelect } from './useSelect'
import { useWindow } from './window'

const GRID = 'grid grid-cols-[40px_minmax(200px,1.3fr)_84px_minmax(200px,1.1fr)_112px_80px] items-center gap-3'
const PAGE = 100
const MAX = 500
const load = (k) => {
  const [w, n, q] = k.split('|')
  return fetchExcitingFights(w, Number(n), q)
}

// The name search, in the page header row; typing settles into ?q= after a beat.
export function FightControls() {
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get('q') || '')
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') || '') === text.trim()) return
      const p = new URLSearchParams(params)
      if (text.trim()) p.set('q', text.trim())
      else p.delete('q')
      p.delete('fight')
      setParams(p, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [text, params, setParams])
  return (
    <label className="flex h-8 w-48 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12px] focus-within:ring-2 focus-within:ring-ring">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Find a fighter"
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </label>
  )
}

// Sortable columns: the fight by date, excitement by score.
const SORT = (f, k) => (k === 'date' ? f.date : f.score)

export default function FightsView() {
  const w = useWindow()
  const [params, setParams] = useSearchParams()
  const [sort, onSort] = useUrlSort(params, setParams, '-score')
  const q = params.get('q') || ''
  const [shown, setShown] = useState({ key: '', n: PAGE })
  const n = shown.key === `${w}|${q}` ? shown.n : PAGE
  const [picked, select, panelRef] = useSelect('fight')
  const { data, error } = useLoad(load, `${w}|${n}|${q}`)
  const rows = useMemo(() => (data ? sortRows(data, sort, SORT) : []), [data, sort])
  if (error) return <ErrorCard>Couldn't load fights: {error}</ErrorCard>
  if (!data) return <PageLoader />
  const selected = rows.find((f) => f.fight_id === picked) || rows[0]
  const head = (k, label, cls) => (
    <span className={cls}><SortHead k={k} sort={sort} onSort={onSort}>{label}</SortHead></span>
  )
  const more = !q && data.length === n && n < MAX
  return (
    <Split panel={selected && <FightPanel f={selected} panelRef={panelRef} />}>
      <RankTable
        grid={GRID}
        minW="min-w-[750px]"
        head={(
          <>
            <span />
            {head('date', 'Fight')}
            <span>Result</span>
            <span>Highlights</span>
            <span>Bonus</span>
            {head('score', 'Excitement', 'flex justify-center')}
          </>
        )}
        rows={rows}
        rowKey={(f) => f.fight_id}
        selected={selected?.fight_id}
        onSelect={select}
        empty={q ? 'No fights match.' : 'No fights in this window.'}
        renderRow={(f) => (
          <>
            <Rank n={f.rank} />
            <span className="flex min-w-0 items-center">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px]">
                  <span className={f.winner === 'red' ? 'font-bold' : 'text-muted-foreground'}>{f.red.name}</span>
                  <span className="text-muted-foreground/60"> vs </span>
                  <span className={f.winner === 'blue' ? 'font-bold' : 'text-muted-foreground'}>{f.blue.name}</span>
                </span>
                <span className="block truncate text-[10.5px] text-muted-foreground">{f.event_name} · {shortDate(f.date)}</span>
              </span>
            </span>
            <span className="whitespace-nowrap text-[12px] font-semibold">{resultText(f)}</span>
            <span className="flex min-w-0 gap-1 overflow-hidden">
              {whyExciting(f).slice(0, 2).map((h) => <Chip key={h} text={h} />)}
            </span>
            <BonusMarks f={f} />
            <span className="flex justify-center">
              <span className="rounded-md bg-ink px-2 py-0.5 font-display text-[18px] font-black italic leading-tight tabular-nums text-white">{Math.round(f.pct)}</span>
            </span>
          </>
        )}
        footer={more && (
          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={() => setShown({ key: `${w}|${q}`, n: Math.min(MAX, n + PAGE) })}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-semibold hover:border-primary hover:text-primary"
            >
              Show more
            </button>
          </div>
        )}
      />
    </Split>
  )
}

// src/pages/HypotheticalPage.jsx
//
// "What if they fought": any two fighters, scored by the same models as a booked bout.
//
// Two states, both driven by the URL (?red=&blue=&div=&title=&rounds=) so a matchup can be
// shared and the back button walks the picks:
//
//   picking   a grid of flip cards, one per fighter — active fighters by default, search
//             reaches everyone — filtered by division. Picks fill red, then blue.
//   matchup   the full upcoming-fight dashboard for the bout (UpcomingFightPage, as it is
//             for a booked fight) with a rail of fighters to swap into either corner.
//
// Weight class: the bout defaults to the heavier fighter's division (the lighter one
// moving up is the usual superfight) and can be set to any division on the same ladder,
// plus catchweight. Men's and women's fighters are never matched. A fighter fighting
// outside their division is called out, because the model only sees that through its
// division-movement and size features.
import { AlertTriangle, LoaderCircle, RotateCcw, Search, Shuffle, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import FighterFlipCard, { CARD_W } from '../components/hypothetical/FighterFlipCard'
import FighterImage from '../components/sports/FighterImage'
import { SlideTabs } from '../components/ui/slide-tabs'
import { fetchHypotheticalFighters } from '../lib/api'
import {
  DIVISIONS, DIVISION_BY_KEY, divisionLabel, isWomens, readSelection, sameLadder,
  selectionQuery, useHypothetical,
} from '../lib/hypothetical'
import { loadHypotheticalMatchup } from '../lib/matchup'
import { cn } from '../lib/utils'
import UpcomingFightPage from './UpcomingFightPage'

const PAGE = 48

function matches(f, q) {
  if (!q) return true
  const hay = `${f.first_name} ${f.last_name} ${f.nickname || ''}`.toLowerCase()
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))
}

function SearchBox({ value, onChange, placeholder, className }) {
  return (
    <label className={cn('flex h-9 items-center gap-2 rounded-lg border bg-card px-2.5', className)}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search">
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </label>
  )
}

function Title() {
  return (
    <h1 className="flex shrink-0 items-center gap-2 text-2xl font-extrabold tracking-tight">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
        <Shuffle className="h-5 w-5 text-white" />
      </span>
      Hypothetical
    </h1>
  )
}

// ---------------------------------------------------------------------------
// Picking: the card grid
// ---------------------------------------------------------------------------

// One line of division pills for the side the switch shows.
function DivisionPills({ value, onChange, counts, ladder }) {
  const pill = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        value === key ? 'border-blue-500 bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      {counts[key] != null && <span className={cn('ml-1', value === key ? 'text-blue-200' : 'text-muted-foreground/60')}>{counts[key]}</span>}
    </button>
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pill('all', 'All')}
      {DIVISIONS
        .filter((d) => d.key !== 'catchweight' && isWomens(d.key) === (ladder === 'F') && counts[d.key])
        .map((d) => pill(d.key, d.label.replace("Women's ", '')))}
    </div>
  )
}

function CornerSlot({ corner, fighter, onClear }) {
  const css = corner === 'red' ? 'border-corner-red' : 'border-corner-blue'
  return (
    <div className={cn('flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border-2 border-dashed px-2', fighter ? css : 'border-border')}>
      {fighter ? (
        <>
          <FighterImage fighter={fighter} className="h-8 w-8 shrink-0 rounded-md bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-extrabold">{fighter.first_name} {fighter.last_name}</div>
            <div className="text-[10px] text-muted-foreground">{divisionLabel(fighter.division)}</div>
          </div>
          <button type="button" onClick={onClear} aria-label={`Clear ${corner} corner`}>
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </>
      ) : (
        <span className="text-[12px] text-muted-foreground">Pick the {corner} corner</span>
      )}
    </div>
  )
}

function Picker({ fighters, sel, setSel }) {
  const [q, setQ] = useState('')
  const [division, setDivision] = useState('all')
  const [ladderChoice, setLadderChoice] = useState('M')
  const [activeOnly, setActiveOnly] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const sentinel = useRef(null)

  const byId = useMemo(() => Object.fromEntries(fighters.map((f) => [f.id, f])), [fighters])
  const red = sel.red ? byId[sel.red] : null
  const blue = sel.blue ? byId[sel.blue] : null
  const anchor = red || blue
  // Once a fighter is picked the other side of the ladder is out of reach, so the switch
  // follows them rather than offering cards that cannot be picked.
  const ladder = anchor ? anchor.sex : ladderChoice
  const divisionShown = division === 'all' || isWomens(division) === (ladder === 'F')
    ? division : 'all'

  // Search reaches everyone, so a retired name is findable; browsing defaults to the
  // active roster, which is what most matchups are made of.
  const pool = useMemo(
    () => fighters.filter((f) => f.sex === ladder
      && (q || !activeOnly || f.status === 'Active') && matches(f, q)),
    [fighters, q, activeOnly, ladder],
  )
  const counts = useMemo(() => {
    const c = {}
    for (const f of pool) c[f.division] = (c[f.division] || 0) + 1
    c.all = pool.length
    return c
  }, [pool])
  const list = useMemo(
    () => (divisionShown === 'all' ? pool : pool.filter((f) => f.division === divisionShown)),
    [pool, divisionShown],
  )

  // Reset paging whenever the list changes underneath it. Keyed on the inputs rather
  // than `list` itself, which is a new array each time.
  const listKey = `${q}|${divisionShown}|${activeOnly}|${ladder}`
  const [pagedFor, setPagedFor] = useState(listKey)
  if (pagedFor !== listKey) { setPagedFor(listKey); setShown(PAGE) }

  useEffect(() => {
    const el = sentinel.current
    if (!el) return undefined
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE)
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
    // Re-observed after each page: an observer only reports a CHANGE in intersection, so
    // a sentinel still in range after the grid grew would never fire again.
  }, [list.length, shown])

  const pick = (f) => {
    if (sel.red === f.id) return setSel({ ...sel, red: null })
    if (sel.blue === f.id) return setSel({ ...sel, blue: null })
    if (!sel.red) return setSel({ ...sel, red: f.id })
    if (!sel.blue) return setSel({ ...sel, blue: f.id })
    return setSel({ ...sel, blue: f.id })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Title />
        <p className="text-[12.5px] text-muted-foreground">
          Pick any two fighters and see what the model makes of a fight between them.
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 rounded-xl border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="Search every fighter…" className="w-full sm:w-72" />
          <SlideTabs
            size="sm"
            value={ladder}
            onChange={(v) => { if (!anchor) setLadderChoice(v) }}
            tabs={anchor
              ? [{ key: anchor.sex, label: anchor.sex === 'F' ? 'Women' : 'Men' }]
              : [{ key: 'M', label: 'Men' }, { key: 'F', label: 'Women' }]}
          />
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} disabled={Boolean(q)} />
            Active only
          </label>
          <div className="ml-auto flex w-full gap-2 sm:w-[min(560px,100%)]">
            <CornerSlot corner="red" fighter={red} onClear={() => setSel({ ...sel, red: null })} />
            <CornerSlot corner="blue" fighter={blue} onClear={() => setSel({ ...sel, blue: null })} />
          </div>
        </div>
        <DivisionPills value={divisionShown} onChange={setDivision} counts={counts} ladder={ladder} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-3">
        {list.length ? (
          <div className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_W - 20}px, 1fr))` }}>
            {list.slice(0, shown).map((f) => (
              <FighterFlipCard
                key={f.id}
                fighter={f}
                corner={sel.red === f.id ? 'red' : sel.blue === f.id ? 'blue' : null}
                disabled={!sameLadder(anchor, f)}
                onPick={() => pick(f)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No fighters match.</div>
        )}
        {shown < list.length && <div ref={sentinel} className="h-10" />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Matchup: featured bout + swap rail
// ---------------------------------------------------------------------------

function RailRow({ f, sel, onSwap }) {
  const inRed = sel.red === f.id
  const inBlue = sel.blue === f.id
  // A fighter already in the bout stays in their corner: the rail brings new fighters in,
  // it does not move the ones there.
  const btn = (corner, active) => (
    <button
      type="button"
      disabled={inRed || inBlue}
      onClick={() => onSwap(corner, f.id)}
      title={active ? `In the ${corner} corner` : inRed || inBlue ? 'Already in this bout' : `Put in the ${corner} corner`}
      className={cn(
        'h-6 w-6 rounded-md text-[10px] font-extrabold text-white transition-opacity',
        corner === 'red' ? 'bg-corner-red' : 'bg-corner-blue',
        active ? 'opacity-100 ring-2 ring-foreground/30' : 'opacity-35 hover:opacity-100',
      )}
    >
      {corner === 'red' ? 'R' : 'B'}
    </button>
  )
  return (
    <div className={cn('flex items-center gap-2 border-b border-border px-3 py-1.5', (inRed || inBlue) && 'bg-primary/5')}>
      <FighterImage fighter={f} className="h-9 w-9 shrink-0 rounded-md bg-muted" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-bold">{f.first_name} {f.last_name}</div>
        <div className="truncate text-[10px] tabular-nums text-muted-foreground">
          {f.wins}-{f.losses}{f.draws ? `-${f.draws}` : ''} · {DIVISION_BY_KEY[f.division]?.short ?? '—'}
          {f.rank != null ? ` #${f.rank}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {btn('red', inRed)}
        {btn('blue', inBlue)}
      </div>
    </div>
  )
}

function SwapRail({ fighters, sel, division, onSwap }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('division')
  const [shown, setShown] = useState(80)
  const list = useMemo(() => {
    const anchor = fighters.find((f) => f.id === sel.red) || fighters.find((f) => f.id === sel.blue)
    return fighters.filter((f) => {
      if (!sameLadder(anchor, f)) return false
      if (q) return matches(f, q)
      if (f.status !== 'Active') return false
      return scope === 'all' || division === 'catchweight' || f.division === division
    })
  }, [fighters, sel.red, sel.blue, q, scope, division])

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="shrink-0 space-y-2 border-b border-border bg-muted px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[11.5px] font-extrabold">Swap a fighter in</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{list.length}</span>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search…" />
        {!q && (
          <SlideTabs
            size="sm"
            value={scope}
            onChange={setScope}
            tabs={[{ key: 'division', label: DIVISION_BY_KEY[division]?.short ? `${DIVISION_BY_KEY[division].short} only` : 'Division' }, { key: 'all', label: 'All active' }]}
          />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" onScroll={(e) => {
        const el = e.currentTarget
        if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) setShown((n) => Math.min(n + 80, list.length))
      }}>
        {list.slice(0, shown).map((f) => <RailRow key={f.id} f={f} sel={sel} onSwap={onSwap} />)}
        {!list.length && <p className="p-4 text-center text-[12px] text-muted-foreground">No fighters match.</p>}
      </div>
    </div>
  )
}

function Controls({ sel, setSel, fight, fighters }) {
  const ladderWomen = fighters.find((f) => f.id === sel.red)?.sex === 'F'
  const options = DIVISIONS.filter((d) => d.key === 'catchweight' || isWomens(d.key) === ladderWomen)
  const division = fight?.division ?? sel.division
  const rounds = fight?.time_format === '5-5-5-5-5' ? 5 : sel.rounds ?? 3
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={division || ''}
        onChange={(e) => setSel({ ...sel, division: e.target.value })}
        className="h-8 rounded-lg border bg-card px-2 text-[12.5px] font-semibold"
        aria-label="Weight class"
      >
        {!division && <option value="">Weight class…</option>}
        {options.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
      </select>
      <SlideTabs
        size="sm"
        value={String(rounds)}
        onChange={(v) => setSel({ ...sel, rounds: Number(v) })}
        tabs={[{ key: '3', label: '3 rounds' }, { key: '5', label: '5 rounds' }]}
      />
    </div>
  )
}

function Matchup({ fighters, sel, setSel }) {
  const result = useHypothetical(sel)
  // Where the dashboard puts its section tabs: in this toolbar, beside the controls.
  const [tabsHost, setTabsHost] = useState(null)
  const fight = result.data?.fight

  // Swapping a fighter in re-derives the weight class (heavier fighter's) unless the
  // reader set one; title and round count stay as chosen.
  const swap = (corner, id) => {
    if (id === sel.red || id === sel.blue) return
    setSel({ ...sel, [corner]: id, division: null })
  }

  // Both fighters' logs and the event names, loaded before the dashboard mounts so it
  // opens complete (as FightDetailPage does for a booked bout). Keyed by the fight id the
  // payload carries, so a swap reads as loading at once.
  const [matchup, setMatchup] = useState({ for: null, value: null })
  const context = result.data?.context
  useEffect(() => {
    if (!fight) return undefined
    let cancelled = false
    loadHypotheticalMatchup(fight, context)
      .then((value) => { if (!cancelled) setMatchup({ for: fight.id, value }) })
    return () => { cancelled = true }
  }, [fight, context])
  const ready = result.status === 'ready' && matchup.for === fight?.id

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Title />
        <Controls sel={sel} setSel={setSel} fight={fight} fighters={fighters} />
        <div ref={setTabsHost} className="flex items-center" />
        <button
          type="button"
          onClick={() => setSel({ red: null, blue: null, division: null, title: false, rounds: null })}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> New matchup
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_clamp(290px,20%,400px)]">
        <div className="min-h-0 min-w-0">
          {ready ? (
            <UpcomingFightPage
              key={fight.id}
              fight={{ ...fight, event: { name: 'Hypothetical bout', date: fight.as_of } }}
              matchup={matchup.value}
              flanked
              tabsHost={tabsHost}
            />
          ) : result.status === 'warming' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-6 text-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-semibold">Building today&apos;s fighter features</p>
              <p className="max-w-sm text-[12px] text-muted-foreground">
                The model needs every fighter&apos;s record as of today. This runs once a day and can take
                fifteen minutes or so. The matchup will load on its own when it&apos;s done.
              </p>
            </div>
          ) : result.status === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <p className="text-sm font-semibold">Couldn&apos;t score this matchup</p>
              <p className="text-[12px] text-muted-foreground">{result.error}</p>
            </div>
          ) : (
            <PageLoader />
          )}
        </div>
        <SwapRail fighters={fighters} sel={sel} division={fight?.division ?? sel.division} onSwap={swap} />
      </div>
    </div>
  )
}

export default function HypotheticalPage() {
  const [params, setParams] = useSearchParams()
  const sel = useMemo(() => readSelection(params), [params])
  const setSel = (next) => setParams(selectionQuery(next))
  const [fighters, setFighters] = useState(null)

  useEffect(() => {
    fetchHypotheticalFighters().then(setFighters).catch(() => setFighters([]))
  }, [])

  if (!fighters) return <PageLoader />
  return sel.red && sel.blue
    ? <Matchup fighters={fighters} sel={sel} setSel={setSel} />
    : <Picker fighters={fighters} sel={sel} setSel={setSel} />
}

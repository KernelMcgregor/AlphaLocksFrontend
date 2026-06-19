// src/pages/FighterDecompositionsPage.jsx
import { Crown, Layers, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import { Card, CardContent } from '../components/ui/card'
import { fetchRankings } from '../lib/api'
import { cn, formatRecord } from '../lib/utils'
import { DIMS, buildPercentile, deriveProfile, initialsOf } from '../lib/fighterAnalytics'

const STRIKING = DIMS.filter((d) => d.group === 'striking')
const GRAPPLING = DIMS.filter((d) => d.group === 'grappling')
const ORDER = [...STRIKING, ...GRAPPLING] // striking block, then grappling block

// percentile → text color (no heatmap fills; quiet typographic emphasis)
function cellTone(v) {
  if (v >= 85) return 'font-extrabold text-blue-700 dark:text-blue-300'
  if (v >= 70) return 'font-bold text-blue-600 dark:text-blue-400'
  if (v >= 45) return 'font-semibold text-foreground'
  if (v >= 35) return 'font-semibold text-rose-500/90'
  return 'font-extrabold text-rose-600'
}

function RankCell({ rank }) {
  if (rank === 1) return <Crown className="mx-auto h-4 w-4 text-amber-500" />
  return (
    <span className={cn('tabular-nums', rank <= 5 ? 'font-extrabold text-blue-600' : 'font-semibold text-muted-foreground')}>
      {rank}
    </span>
  )
}

function Avatar({ fighter }) {
  if (fighter.image_url) {
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <img src={fighter.image_url} alt="" className="h-full w-full scale-110 object-cover object-top" />
      </div>
    )
  }
  const tier = fighter.rank === 1 ? 'bg-amber-500/15 text-amber-600' : fighter.rank <= 5 ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-1 ring-border', tier)}>
      {initialsOf(fighter)}
    </div>
  )
}

const COL = 'w-[58px] min-w-[58px]'

function HeaderCell({ dim, sortKey, sortDir, onSort, firstInGroup }) {
  const active = sortKey === dim.key
  return (
    <th
      onClick={() => onSort(dim.key)}
      title={dim.label}
      className={cn(
        'cursor-pointer select-none px-1 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide',
        COL,
        dim.group === 'striking' ? 'bg-amber-500/[0.06] text-amber-700 dark:text-amber-400' : 'bg-indigo-500/[0.06] text-indigo-600 dark:text-indigo-400',
        firstInGroup && 'border-l-2 border-background',
        active && 'underline underline-offset-4',
      )}
    >
      {dim.short}
      {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

function Row({ fighter, profile, view }) {
  return (
    <tr className="group border-b last:border-b-0 hover:bg-muted/40">
      <td className="sticky left-0 z-[2] w-[46px] min-w-[46px] bg-card px-2 py-2 text-center group-hover:bg-muted/40">
        <RankCell rank={fighter.rank} />
      </td>
      <td className="sticky left-[46px] z-[2] w-[212px] min-w-[212px] border-r bg-card px-3 py-2 group-hover:bg-muted/40">
        <Link to={`/ufc/fighters/${fighter.id}`} className="flex items-center gap-2.5">
          <Avatar fighter={fighter} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <CountryFlag countryCode={fighter.country_code} />
              <span className="truncate text-[14px] font-bold tracking-tight">
                {fighter.first_name} {fighter.last_name}
              </span>
            </span>
            {fighter.nickname && <span className="block truncate text-[11px] text-muted-foreground">"{fighter.nickname}"</span>}
          </span>
        </Link>
      </td>
      <td className="w-[72px] min-w-[72px] border-r px-2 py-2 text-center text-[12.5px] font-semibold tabular-nums text-muted-foreground">
        {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
      </td>
      {ORDER.map((dim, i) => {
        const d = profile.dims.find((x) => x.key === dim.key)
        const firstGrap = dim.key === GRAPPLING[0].key
        return (
          <td key={dim.key} className={cn('px-1 py-2 text-center tabular-nums', COL, firstGrap && 'border-l-2 border-muted')}>
            {view === 'raw' ? (
              <span className="text-[13px] font-semibold text-foreground">{(d.raw ?? 0).toFixed(1)}</span>
            ) : (
              <>
                <span className={cn('text-[13px]', cellTone(d.value))}>{d.value}</span>
                <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-muted">
                  <span className={cn('block h-full rounded-full', dim.group === 'striking' ? 'bg-amber-500' : 'bg-indigo-500')} style={{ width: `${d.value}%` }} />
                </span>
              </>
            )}
          </td>
        )
      })}
    </tr>
  )
}

function DivisionTable({ fighters, sortKey, sortDir, onSort, view }) {
  const pct = useMemo(() => buildPercentile(fighters), [fighters])
  const rows = useMemo(() => {
    const list = fighters.map((f) => ({ fighter: f, profile: deriveProfile(f, pct) }))
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'rank') return (a.fighter.rank - b.fighter.rank) * dir
      if (sortKey === 'rec') return (a.fighter.wins - b.fighter.wins) * dir
      const av = a.profile.dims.find((d) => d.key === sortKey)?.value ?? 0
      const bv = b.profile.dims.find((d) => d.key === sortKey)?.value ?? 0
      return (av - bv) * dir
    })
    return list
  }, [fighters, pct, sortKey, sortDir])

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 tabular-nums">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 z-[5] w-[46px] min-w-[46px] bg-muted/60 px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
            <th rowSpan={2} onClick={() => onSort('rank')} className="sticky left-[46px] z-[5] w-[212px] min-w-[212px] cursor-pointer border-r bg-muted/60 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fighter</th>
            <th rowSpan={2} onClick={() => onSort('rec')} className="w-[72px] min-w-[72px] cursor-pointer border-r bg-muted/60 px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rec</th>
            <th colSpan={STRIKING.length} className="bg-amber-500/[0.1] px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400">Striking</th>
            <th colSpan={GRAPPLING.length} className="border-l-2 border-background bg-indigo-500/[0.1] px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Grappling</th>
          </tr>
          <tr>
            {ORDER.map((dim) => (
              <HeaderCell key={dim.key} dim={dim} sortKey={sortKey} sortDir={sortDir} onSort={onSort} firstInGroup={dim.key === GRAPPLING[0].key} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ fighter, profile }) => (
            <Row key={fighter.id} fighter={fighter} profile={profile} view={view} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function FighterDecompositionsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeWc, setActiveWc] = useState(null)
  const [view, setView] = useState('percentile') // 'percentile' | 'raw'
  const [sortKey, setSortKey] = useState('rank')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    fetchRankings()
      .then((d) => {
        setData(d)
        if (d?.weight_classes?.length) {
          const lw = d.weight_classes.find((w) => w.key === 'lightweight') || d.weight_classes.find((w) => !w.key.startsWith('p4p')) || d.weight_classes[0]
          setActiveWc(lw.key)
        }
      })
      .catch((e) => setError(e.message))
  }, [])

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'rank' ? 'asc' : 'desc') }
  }

  if (error) return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load: {error}</p></CardContent></Card>
  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  const mens = data.weight_classes.filter((wc) => !wc.key.startsWith('w_') && wc.key !== 'p4p_women')
  const womens = data.weight_classes.filter((wc) => wc.key.startsWith('w_') || wc.key === 'p4p_women')
  const activeDiv = data.weight_classes.find((w) => w.key === activeWc)
  const isPfp = (key) => key.startsWith('p4p')

  const WcButton = ({ wc }) => {
    const active = activeWc === wc.key
    const gold = isPfp(wc.key)
    return (
      <button
        onClick={() => setActiveWc(wc.key)}
        className={cn(
          'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
          active && gold && 'border-amber-500 bg-amber-500 text-white shadow-sm',
          active && !gold && 'border-blue-500 bg-blue-600 text-white shadow-sm',
          !active && 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:text-foreground',
        )}
      >
        {wc.label}
        <span className={cn('ml-1', active ? (gold ? 'text-amber-200' : 'text-blue-200') : 'text-muted-foreground/60')}>
          {wc.fighters.length}
        </span>
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 pb-3">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><Layers className="h-5 w-5 text-white" /></span>
          Fighter Rankings
          <span className="text-sm font-medium text-muted-foreground">— all 13 model dimensions per fighter</span>
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Men</span>
              <div className="flex flex-wrap gap-1.5">
                {mens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Women</span>
              <div className="flex flex-wrap gap-1.5">
                {womens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
              </div>
            </div>
          </div>
          <div className="inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
            {['percentile', 'raw'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn('rounded-[7px] px-3 py-1.5 text-[11.5px] font-semibold capitalize transition-colors', view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {v === 'raw' ? 'Raw rating' : 'Percentile'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Card className="overflow-hidden p-0">
          <CardContent className="p-0">
            {activeDiv && <DivisionTable fighters={activeDiv.fighters} sortKey={sortKey} sortDir={sortDir} onSort={onSort} view={view} />}
          </CardContent>
        </Card>
        <p className="mt-3 px-1 text-[11.5px] text-muted-foreground">
          {view === 'raw'
            ? 'Raw model ratings (Glicko composite per dimension). Switch to percentile for division-relative rank.'
            : 'Percentile vs the active division — the bar under each value tracks it. Click a column to sort, a fighter to open their profile.'}
        </p>
      </div>
    </div>
  )
}

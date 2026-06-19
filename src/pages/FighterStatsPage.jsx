// src/pages/FighterStatsPage.jsx
import { BarChart3, Crown, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import { Card, CardContent } from '../components/ui/card'
import { ScrollArea } from '../components/ui/scroll-area'
// NOTE: add `export const fetchFighterStats = (id) => cachedRequest(`/ufc/fighters/${id}/stats`)`
// to src/lib/api.js — the endpoint already exists in routers/ufc.py.
import { fetchFighterFights, fetchFighterStats, fetchRankings } from '../lib/api'
import { cn, formatRecord } from '../lib/utils'
import { aggregateCareer, initialsOf } from '../lib/fighterAnalytics'

// Every tracked fight stat, grouped. dir = best-is direction.
const GROUPS = [
  { label: 'Striking', tone: 'amber', cols: [
    { key: 'slpm',   short: 'SLpM',  fmt: (v) => v.toFixed(2),         dir: 'desc', title: 'Significant strikes landed / min' },
    { key: 'tslpm',  short: 'TSL/m', fmt: (v) => v.toFixed(2),         dir: 'desc', title: 'Total strikes landed / min' },
    { key: 'sigAcc', short: 'Acc',   fmt: (v) => v + '%',              dir: 'desc', title: 'Significant strike accuracy' },
    { key: 'kd15',   short: 'KD',    fmt: (v) => v.toFixed(2),         dir: 'desc', title: 'Knockdowns / 15 min' },
  ] },
  { label: 'Target', tone: 'rose', cols: [
    { key: 'head',   short: 'Head',  fmt: (v) => v + '%',              dir: 'desc', title: 'Sig. strikes to the head' },
    { key: 'body',   short: 'Body',  fmt: (v) => v + '%',              dir: 'desc', title: 'Sig. strikes to the body' },
    { key: 'leg',    short: 'Leg',   fmt: (v) => v + '%',              dir: 'desc', title: 'Sig. strikes to the legs' },
  ] },
  { label: 'Position', tone: 'teal', cols: [
    { key: 'distance', short: 'Dist', fmt: (v) => v + '%',             dir: 'desc', title: 'Sig. strikes at distance' },
    { key: 'clinch',   short: 'Clin', fmt: (v) => v + '%',             dir: 'desc', title: 'Sig. strikes in the clinch' },
    { key: 'ground',   short: 'Grnd', fmt: (v) => v + '%',             dir: 'desc', title: 'Sig. strikes on the ground' },
  ] },
  { label: 'Grappling', tone: 'indigo', cols: [
    { key: 'td15',    short: 'TD',    fmt: (v) => v.toFixed(2),        dir: 'desc', title: 'Takedowns / 15 min' },
    { key: 'tdAcc',   short: 'TD Ac', fmt: (v) => v + '%',             dir: 'desc', title: 'Takedown accuracy' },
    { key: 'subAtt15', short: 'SubA', fmt: (v) => v.toFixed(1),        dir: 'desc', title: 'Submission attempts / 15 min' },
    { key: 'rev15',   short: 'Rev',   fmt: (v) => v.toFixed(1),        dir: 'desc', title: 'Reversals / 15 min' },
    { key: 'ctrl15',  short: 'Ctrl',  fmt: (v, r) => r.ctrl15Str,      dir: 'desc', title: 'Control time / 15 min' },
  ] },
  { label: 'Outcomes', tone: 'slate', cols: [
    { key: 'ko',         short: 'KO',   fmt: (v) => String(v),         dir: 'desc', title: 'Wins by KO / TKO' },
    { key: 'sub',        short: 'Sub',  fmt: (v) => String(v),         dir: 'desc', title: 'Wins by submission' },
    { key: 'dec',        short: 'Dec',  fmt: (v) => String(v),         dir: 'desc', title: 'Wins by decision' },
    { key: 'finishRate', short: 'Fin%', fmt: (v) => v + '%',           dir: 'desc', title: 'Finish rate' },
  ] },
]
const ALL_COLS = GROUPS.flatMap((g) => g.cols)
const GROUP_HEAD = {
  amber:  'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  rose:   'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
  teal:   'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
  slate:  'bg-muted text-muted-foreground',
}
const GROUP_CELL = {
  amber:  'bg-amber-500/[0.05]', rose: 'bg-rose-500/[0.05]', teal: 'bg-teal-500/[0.05]', indigo: 'bg-indigo-500/[0.05]', slate: 'bg-muted/40',
}
const COL = 'w-[60px] min-w-[60px]'

function Avatar({ fighter }) {
  if (fighter.image_url) {
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <img src={fighter.image_url} alt="" className="h-full w-full scale-110 object-cover object-top" />
      </div>
    )
  }
  const tier = fighter.rank === 1 ? 'bg-amber-500/15 text-amber-600' : fighter.rank <= 5 ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'
  return <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-1 ring-border', tier)}>{initialsOf(fighter)}</div>
}

export default function FighterStatsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeWc, setActiveWc] = useState(null)
  const [aggByWc, setAggByWc] = useState({})       // { [wcKey]: { [fighterId]: career } }
  const [loadingAgg, setLoadingAgg] = useState(false)
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

  // Lazily aggregate real fight stats for the active division (parallel, cached by lib/api).
  useEffect(() => {
    if (!data || !activeWc || aggByWc[activeWc]) return
    const div = data.weight_classes.find((w) => w.key === activeWc)
    if (!div) return
    let cancelled = false
    setLoadingAgg(true)
    Promise.all(
      div.fighters.map((f) =>
        Promise.all([fetchFighterStats(f.id).catch(() => []), fetchFighterFights(f.id).catch(() => [])])
          .then(([stats, fights]) => [f.id, aggregateCareer(stats, fights, f.id)]),
      ),
    )
      .then((entries) => {
        if (cancelled) return
        setAggByWc((prev) => ({ ...prev, [activeWc]: Object.fromEntries(entries) }))
      })
      .finally(() => !cancelled && setLoadingAgg(false))
    return () => { cancelled = true }
  }, [data, activeWc, aggByWc])

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'rank' ? 'asc' : 'desc') }
  }

  const activeDiv = data?.weight_classes.find((w) => w.key === activeWc)
  const agg = aggByWc[activeWc]

  // leaders per column (for accent highlight)
  const leaders = useMemo(() => {
    if (!activeDiv || !agg) return {}
    const out = {}
    ALL_COLS.forEach((c) => {
      let best = null
      activeDiv.fighters.forEach((f) => {
        const v = agg[f.id]?.[c.key]
        if (v == null) return
        if (best == null || v > best.v) best = { id: f.id, v }
      })
      out[c.key] = best?.id
    })
    return out
  }, [activeDiv, agg])

  const rows = useMemo(() => {
    if (!activeDiv) return []
    const list = activeDiv.fighters.map((f) => ({ fighter: f, career: agg?.[f.id] }))
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortKey === 'rank') return (a.fighter.rank - b.fighter.rank) * dir
      if (sortKey === 'rec') return (a.fighter.wins - b.fighter.wins) * dir
      return ((a.career?.[sortKey] ?? -1) - (b.career?.[sortKey] ?? -1)) * dir
    })
    return list
  }, [activeDiv, agg, sortKey, sortDir])

  if (error) return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load: {error}</p></CardContent></Card>
  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  const mens = data.weight_classes.filter((wc) => !wc.key.startsWith('w_') && wc.key !== 'p4p_women')
  const womens = data.weight_classes.filter((wc) => wc.key.startsWith('w_') || wc.key === 'p4p_women')
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
        <span className={cn('ml-1', active ? (gold ? 'text-amber-200' : 'text-blue-200') : 'text-muted-foreground/60')}>{wc.fighters.length}</span>
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 pb-3">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><BarChart3 className="h-5 w-5 text-white" /></span>
          Fighter Stats
          <span className="text-sm font-medium text-muted-foreground">— career fight metrics from UFCStats</span>
        </h1>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10 shrink-0">Men</span>
            <div className="flex flex-wrap gap-1.5">
              {mens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10 shrink-0">Women</span>
            <div className="flex flex-wrap gap-1.5">
              {womens.map((wc) => <WcButton key={wc.key} wc={wc} />)}
            </div>
          </div>
        </div>
      </div>

      {loadingAgg && !agg ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aggregating fight stats…</p>
          </div>
        </div>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <ScrollArea className="min-h-0 flex-1">
            <table className="w-full border-separate border-spacing-0 tabular-nums">
              <thead className="sticky top-0 z-[4] border-b border-border">
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-[5] w-[46px] min-w-[46px] bg-muted px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
                  <th rowSpan={2} onClick={() => onSort('rank')} className="sticky left-[46px] z-[5] w-[208px] min-w-[208px] cursor-pointer border-r bg-muted px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fighter</th>
                  <th rowSpan={2} onClick={() => onSort('rec')} className="w-[72px] min-w-[72px] cursor-pointer border-r bg-muted px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rec</th>
                  {GROUPS.map((g, gi) => (
                    <th key={g.label} colSpan={g.cols.length} className={cn('px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest', GROUP_HEAD[g.tone], gi > 0 && 'border-l-2 border-background')}>{g.label}</th>
                  ))}
                </tr>
                <tr>
                  {GROUPS.map((g) => g.cols.map((c, ci) => {
                    const active = sortKey === c.key
                    return (
                      <th key={c.key} onClick={() => onSort(c.key)} title={c.title} className={cn('cursor-pointer select-none px-1 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide', COL, GROUP_HEAD[g.tone], ci === 0 && 'border-l-2 border-background', active && 'underline underline-offset-4')}>
                        {c.short}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    )
                  }))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ fighter, career }) => (
                  <tr key={fighter.id} className="group border-b last:border-b-0 hover:bg-muted/40">
                    <td className="sticky left-0 z-[2] w-[46px] min-w-[46px] bg-card px-2 py-2 text-center group-hover:bg-muted/40">
                      {fighter.rank === 1 ? <Crown className="mx-auto h-4 w-4 text-amber-500" /> : <span className={cn('tabular-nums', fighter.rank <= 5 ? 'font-extrabold text-blue-600' : 'font-semibold text-muted-foreground')}>{fighter.rank}</span>}
                    </td>
                    <td className="sticky left-[46px] z-[2] w-[208px] min-w-[208px] border-r bg-card px-3 py-2 group-hover:bg-muted/40">
                      <Link to={`/ufc/fighters/${fighter.id}`} className="flex items-center gap-2.5">
                        <Avatar fighter={fighter} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <CountryFlag countryCode={fighter.country_code} />
                            <span className="truncate text-[14px] font-bold tracking-tight">{fighter.first_name} {fighter.last_name}</span>
                          </span>
                          {fighter.nickname && <span className="block truncate text-[11px] text-muted-foreground">"{fighter.nickname}"</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="w-[72px] min-w-[72px] border-r px-2 py-2 text-center text-[12.5px] font-semibold tabular-nums text-muted-foreground">
                      {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
                    </td>
                    {GROUPS.map((g) => g.cols.map((c, ci) => {
                      const lead = leaders[c.key] === fighter.id
                      return (
                        <td key={c.key} className={cn('px-1 py-2 text-center text-[13px] tabular-nums', COL, GROUP_CELL[g.tone], ci === 0 && 'border-l-2 border-background', lead ? 'font-extrabold text-blue-600' : 'font-semibold text-foreground')}>
                          {career ? c.fmt(career[c.key], career) : <span className="text-muted-foreground/40">·</span>}
                        </td>
                      )
                    }))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2">
            {loadingAgg && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <p className="text-[11.5px] text-muted-foreground">
              {loadingAgg ? 'Aggregating fight stats…' : 'Per-minute (SLpM/TSL/m) and per-15-min (TD, Sub, Rev, Ctrl) rates from UFCStats totals. Target & Position are shares of significant strikes. Leader in each column is highlighted.'}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

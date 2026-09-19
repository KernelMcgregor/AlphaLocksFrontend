// src/pages/RankingsPage.jsx
//
// The divisional standings board. One row per ranked fighter: where they stand, the
// six-fight window the rank is computed from, who they just beat, who they fight next,
// and which way they are moving.
//
// Same table format as Fighter Skills (FighterDecompositionsPage) — a real <table> with
// the # and Fighter columns pinned left and the rest scrolling horizontally, sortable
// column headers. The two pages are read the same way; only the columns differ.
//
// Every cell states its value outright; Form is the single exception, because six
// coloured pips genuinely need a key. Clicking a bout box opens the fight page, clicking
// anywhere else in the row opens the fighter.
//
// This page deliberately shows NO skill dimensions — those live on Fighter Skills. The
// split is the point: this page answers "where does this fighter stand", that one
// answers "what is this fighter good at".
import { ChevronDown, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import FighterImage from '../components/sports/FighterImage'
import BeltIcon from '../components/ui/belt-icon'
import { Card, CardContent } from '../components/ui/card'
import { Tip } from '../components/ui/tip'
import { fetchRankings } from '../lib/api'
import { cn, formatRecord } from '../lib/utils'

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

// Methods arrive as ufcstats spells them ("Decision - Unanimous"). In a table cell the
// prefix is dead width — the column header already says what this is.
function shortMethod(m) {
  if (!m) return '—'
  if (m.startsWith('Decision - ')) return `${m.slice(11)} dec`
  if (m.includes('Doctor')) return 'TKO (dr)'
  if (m === 'KO/TKO') return 'KO/TKO'
  if (m.startsWith('Submission')) return 'Sub'
  return m
}

// "May '26" — for a past bout the year is what matters, the day never does.
function monthYear(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
}

// "Sep 19" — for a booked bout the exact day is the whole point, and it is always
// near enough that the year is obvious.
function monthDay(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

function dayDelta(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

// "8mo" / "1.4y" — a layoff column has room for a number and a unit, nothing more.
function shortSpan(days) {
  if (days == null) return '—'
  const n = Math.abs(days)
  if (n < 31) return `${n}d`
  if (n < 365) return `${Math.round(n / 30.4)}mo`
  return `${(n / 365).toFixed(1)}y`
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ResultDot({ won, drew, className }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9.5px] font-extrabold text-white',
        drew ? 'bg-muted-foreground/60' : won ? 'bg-emerald-600' : 'bg-rose-600',
        className,
      )}
    >
      {drew ? 'D' : won ? 'W' : 'L'}
    </span>
  )
}

// Portraits are full-body shots, object-top cropped to a circle. `scale-110` zooms about
// the element's CENTRE, so it pushes 5% of the image out past the top edge — which is
// exactly the sliver of skull that was being clipped. Translating down by 6% returns the
// crown to just inside the rim; the extra zoom then overflows entirely at the bottom,
// where it is only shoulders.
function Portrait({ fighter, className, ring }) {
  return (
    <FighterImage
      fighter={fighter}
      alt=""
      className={cn('shrink-0 rounded-full bg-muted ring-1', ring || 'ring-border', className)}
      imgClassName="scale-110 translate-y-[6%]"
    />
  )
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

// The ranker pins the reigning champion to rank 1, so the board reads belt, 1, 2, 3 —
// the contender numbering everyone actually uses, where "#1" means top contender rather
// than champion. Pound-for-pound has no belt, so it stays 1, 2, 3.
function RankCell({ rank, hasChampion }) {
  if (hasChampion && rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
        <BeltIcon className="h-[21px] w-[21px] text-amber-500" strokeWidth={2.6} />
      </span>
    )
  }
  const shown = hasChampion ? rank - 1 : rank
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg text-[13px] tabular-nums',
        shown <= 5 ? 'bg-blue-500/10 font-extrabold text-blue-600' : 'font-semibold text-muted-foreground',
      )}
    >
      {shown}
    </span>
  )
}

function FighterCell({ fighter, hasChampion }) {
  return (
    <span className="flex items-center gap-2.5">
      <Portrait
        fighter={fighter}
        className="h-9 w-9"
        ring={hasChampion && fighter.rank === 1 ? 'ring-amber-400' : 'ring-border'}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <CountryFlag countryCode={fighter.country_code} />
          <span className="truncate text-[14px] font-bold tracking-tight">
            {fighter.first_name} {fighter.last_name}
          </span>
          {!fighter.eligible && (
            <span className="shrink-0 rounded bg-muted px-1 py-px text-[9px] font-bold uppercase text-muted-foreground">
              Inactive
            </span>
          )}
        </span>
        <span className="block truncate text-[11px] font-normal text-muted-foreground">
          {fighter.nickname ? `"${fighter.nickname}"` : formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
        </span>
      </span>
    </span>
  )
}

// The six-fight window the rank is computed from, oldest on the left. This is the one
// column that shows the *shape* of a resume rather than a summary of it — two fighters
// on 4-2 read completely differently when one lost the last two. It is also the only
// cell whose meaning is not legible without a key, hence the one surviving tooltip.
function FormCell({ ledger, streak, streakType }) {
  if (!ledger?.length) return <span className="text-[12px] text-muted-foreground/50">—</span>
  const chrono = [...ledger].reverse()
  return (
    <Tip
      className="flex items-center gap-1.5"
      content={
        <div className="w-[214px]">
          <div className="mb-1.5 border-b pb-1.5 text-[12px] font-extrabold tracking-tight">
            Last {chrono.length}
          </div>
          <div className="space-y-1">
            {chrono.map((b) => (
              <div key={b.fight_id} className="flex items-center gap-1.5">
                <ResultDot won={b.won} drew={b.drew} />
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{b.opponent_name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{shortMethod(b.method)}</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <span className="flex items-center gap-[3px]">
        {chrono.map((b) => (
          <span
            key={b.fight_id}
            className={cn(
              'h-4 w-[7px] rounded-[2px]',
              b.drew ? 'bg-muted-foreground/50' : b.won ? 'bg-emerald-500' : 'bg-rose-500',
            )}
          />
        ))}
      </span>
      {streak > 1 && (
        <span className={cn('text-[10.5px] font-extrabold tabular-nums', streakType === 'W' ? 'text-emerald-600' : 'text-rose-600')}>
          {streakType}{streak}
        </span>
      )}
    </Tip>
  )
}

// Strength of schedule is Tapology's 1-99 display figure — the summed tier of the last
// six opponents, rescaled. It is NOT an input to the rank, so it reads as context.
function SosCell({ sos }) {
  const v = sos || 0
  const tone = v >= 70 ? 'text-rose-600' : v >= 50 ? 'text-amber-600' : 'text-emerald-600'
  return <span className={cn('text-[14px] font-extrabold tabular-nums', tone)}>{v}</span>
}

// Time since the last scored bout: what separates an active contender from someone
// coasting on an old win, and a warning before the 21-month eligibility cliff.
function LastActiveCell({ bout, eligible }) {
  const days = dayDelta(bout?.date)
  if (days == null) return <span className="text-[12px] text-muted-foreground/50">—</span>
  const ago = Math.abs(days)
  const tone = !eligible || ago > 550 ? 'text-rose-600' : ago > 365 ? 'text-amber-600' : 'text-foreground'
  return (
    <span className="flex flex-col leading-tight">
      <span className={cn('text-[12.5px] font-bold tabular-nums', tone)}>{shortSpan(days)}</span>
      <span className="text-[10px] text-muted-foreground">{monthYear(bout.date)}</span>
    </span>
  )
}

// The boxed bout cells. Clicking either opens that fight's page.
const BOX = 'flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1 transition-colors cursor-pointer'
// Same rendered height as a filled box (border + py-1 + a two-line text block), so an
// unbooked row does not sit a few pixels shorter than its neighbours.
const BOX_EMPTY = 'block rounded-lg border border-dashed px-2 py-[9px] text-[11.5px] text-muted-foreground/50'

function LastFightCell({ bout }) {
  const navigate = useNavigate()
  if (!bout) {
    return <span className={BOX_EMPTY}>No bouts</span>
  }
  const opp = { id: bout.opponent_id, image_url: bout.opponent_image_url }
  const ended = bout.finish_round ? `R${bout.finish_round}` : null
  // Tint by outcome — the box itself carries the result, so the W/L never has to be
  // read off the text.
  const tint = bout.drew
    ? 'border-border bg-muted/50 hover:bg-muted'
    : bout.won
      ? 'border-emerald-500/30 bg-emerald-500/[0.08] hover:border-emerald-500/60 hover:bg-emerald-500/15'
      : 'border-rose-500/30 bg-rose-500/[0.08] hover:border-rose-500/60 hover:bg-rose-500/15'
  return (
    <span
      onClick={(e) => { e.stopPropagation(); navigate(`/ufc/fights/${bout.fight_id}`) }}
      className={cn(BOX, tint)}
    >
      <ResultDot won={bout.won} drew={bout.drew} />
      <Portrait fighter={opp} className="h-7 w-7" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[12.5px] font-semibold">{bout.opponent_name || '—'}</span>
        <span className="block truncate text-[10.5px] font-normal text-muted-foreground">
          {shortMethod(bout.method)}{ended ? ` · ${ended}` : ''}
        </span>
      </span>
    </span>
  )
}

function NextFightCell({ next }) {
  const navigate = useNavigate()
  if (!next) {
    return <span className={BOX_EMPTY}>Unbooked</span>
  }
  const opp = { id: next.opponent_id, image_url: next.opponent_image_url }
  return (
    <span
      onClick={(e) => { e.stopPropagation(); navigate(`/ufc/fights/${next.fight_id}`) }}
      className={cn(BOX, 'border-blue-500/25 bg-blue-500/[0.06] hover:border-blue-500/50 hover:bg-blue-500/12')}
    >
      <Portrait fighter={opp} className="h-7 w-7" ring="ring-blue-500/30" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{next.opponent_name}</span>
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
        {monthDay(next.event_date)}
      </span>
    </span>
  )
}

// `delta` is positive when the fighter climbed — the API already flips it, because ranks
// count down and an unflipped delta reads backwards to everyone.
function MovementCell({ movement }) {
  const delta = movement?.delta
  if (delta == null) {
    return (
      <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        New
      </span>
    )
  }
  if (delta === 0) return <span className="inline-flex text-muted-foreground/40"><Minus className="h-3.5 w-3.5" /></span>
  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-extrabold tabular-nums',
        up ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

// One entry per scrolling column: width, header, and the value the sorter reads.
// `value` returning null sinks the row to the bottom in BOTH directions — "Unbooked"
// and "New" are absent data, not extreme data, so they never top the list.
const COLUMNS = [
  { key: 'rec', label: 'Record', w: 'w-[72px] min-w-[72px]', align: 'text-center', dir: 'desc', value: (f) => f.wins - f.losses },
  { key: 'form', label: 'Form', w: 'w-[100px] min-w-[100px]', align: 'text-left', dir: 'desc', value: (f) => (f.ledger || []).filter((b) => b.won).length },
  { key: 'sos', label: 'SOS', w: 'w-[58px] min-w-[58px]', align: 'text-left', dir: 'desc', value: (f) => f.sos || 0 },
  // Ascending = oldest bout first, i.e. longest layoff at the top. That is the question
  // this column exists to answer — who is going stale — so it is the first-click default.
  { key: 'active', label: 'Last active', w: 'w-[84px] min-w-[84px]', align: 'text-left', dir: 'asc', value: (f) => (f.last_fight?.date ? Date.parse(`${f.last_fight.date}T00:00:00`) : null) },
  { key: 'last', label: 'Last fight', w: 'w-[214px] min-w-[214px]', align: 'text-left', dir: 'desc', value: (f) => (f.last_fight?.date ? Date.parse(`${f.last_fight.date}T00:00:00`) : null) },
  { key: 'next', label: 'Next fight', w: 'w-[230px] min-w-[230px]', align: 'text-left', dir: 'asc', value: (f) => (f.next_fight?.event_date ? Date.parse(`${f.next_fight.event_date}T00:00:00`) : null) },
  { key: 'move', label: 'Movement', w: 'w-[88px] min-w-[88px]', align: 'text-center', dir: 'desc', value: (f) => f.movement?.delta ?? null },
]

// Sticky cells need OPAQUE backgrounds. A translucent tint lets the non-sticky cells
// slide visibly underneath during horizontal scroll, and where the two translucent
// layers overlap they stack into a dark seam at the column boundary.
const TH = 'bg-muted px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'
// With border-separate the row border has to live on the cells — a border set on <tr>
// is not painted in the separated-borders model.
//
// py-1.5 rather than Fighter Skills' py-2 because the bout boxes add their own border
// and padding on top of the cell's; the two pages land on the same ~52px row as a
// result, which is the point — they are read as one table in two views.
const TD = 'border-b border-border px-2 py-1.5'

function HeaderCell({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key
  return (
    <th
      onClick={() => onSort(col.key)}
      className={cn(TH, col.w, col.align, 'cursor-pointer select-none transition-colors hover:text-foreground', active && 'text-foreground')}
    >
      {col.label}
      <span className={cn('ml-0.5 inline-block', !active && 'opacity-0')}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    </th>
  )
}

function Row({ fighter, hasChampion }) {
  const navigate = useNavigate()
  const go = () => navigate(`/ufc/fighters/${fighter.id}`)
  return (
    <tr
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter') go() }}
      tabIndex={0}
      className="group cursor-pointer hover:bg-muted"
    >
      <td className={cn(TD, 'sticky left-0 z-[2] w-[46px] min-w-[46px] bg-card text-center group-hover:bg-muted')}>
        <RankCell rank={fighter.rank} hasChampion={hasChampion} />
      </td>
      <td className={cn(TD, 'sticky left-[46px] z-[2] w-[218px] min-w-[218px] bg-card px-3 group-hover:bg-muted')}>
        <FighterCell fighter={fighter} hasChampion={hasChampion} />
      </td>
      <td className={cn(TD, 'w-[72px] min-w-[72px] text-center text-[12.5px] font-semibold tabular-nums text-muted-foreground')}>
        {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
      </td>
      <td className={cn(TD, 'w-[100px] min-w-[100px]')}>
        <FormCell ledger={fighter.ledger} streak={fighter.streak} streakType={fighter.streak_type} />
      </td>
      <td className={cn(TD, 'w-[58px] min-w-[58px]')}>
        <SosCell sos={fighter.sos} />
      </td>
      <td className={cn(TD, 'w-[84px] min-w-[84px]')}>
        <LastActiveCell bout={fighter.last_fight} eligible={fighter.eligible} />
      </td>
      <td className={cn(TD, 'w-[214px] min-w-[214px]')}>
        <LastFightCell bout={fighter.last_fight} />
      </td>
      <td className={cn(TD, 'w-[230px] min-w-[230px]')}>
        <NextFightCell next={fighter.next_fight} />
      </td>
      <td className={cn(TD, 'w-[88px] min-w-[88px] text-center')}>
        <MovementCell movement={fighter.movement} />
      </td>
    </tr>
  )
}

function DivisionTable({ fighters, hasChampion, sortKey, sortDir, onSort }) {
  const rows = useMemo(() => {
    const list = [...fighters]
    if (sortKey === 'rank') return list.sort((a, b) => (a.rank - b.rank) * (sortDir === 'asc' ? 1 : -1))
    const col = COLUMNS.find((c) => c.key === sortKey)
    if (!col) return list.sort((a, b) => a.rank - b.rank)
    const dir = sortDir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      const av = col.value(a)
      const bv = col.value(b)
      // Absent data sinks regardless of direction, then rank breaks ties so the board
      // never reshuffles arbitrarily within a group of equal values.
      if (av == null && bv == null) return a.rank - b.rank
      if (av == null) return 1
      if (bv == null) return -1
      return av === bv ? a.rank - b.rank : (av - bv) * dir
    })
  }, [fighters, sortKey, sortDir])

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 tabular-nums">
        <thead>
          <tr>
            <th
              onClick={() => onSort('rank')}
              className={cn(
                TH, 'sticky left-0 z-[5] w-[46px] min-w-[46px] cursor-pointer select-none transition-colors hover:text-foreground',
                sortKey === 'rank' && 'text-foreground',
              )}
            >
              #
              <span className={cn('ml-0.5 inline-block', sortKey !== 'rank' && 'opacity-0')}>
                {sortDir === 'asc' ? '↑' : '↓'}
              </span>
            </th>
            <th className={cn(TH, 'sticky left-[46px] z-[5] w-[218px] min-w-[218px] px-3 text-left')}>Fighter</th>
            {COLUMNS.map((col) => (
              <HeaderCell key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fighter) => (
            <Row key={fighter.id} fighter={fighter} hasChampion={hasChampion} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RankingsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeWc, setActiveWc] = useState(null)
  const [wcOpen, setWcOpen] = useState(false)
  const [sortKey, setSortKey] = useState('rank')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    fetchRankings()
      .then((d) => {
        setData(d)
        if (d?.weight_classes?.length) setActiveWc(d.weight_classes[0].key)
      })
      .catch((e) => setError(e.message))
  }, [])

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'rank' ? 'asc' : COLUMNS.find((c) => c.key === key)?.dir || 'desc')
    }
  }

  if (error) {
    return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load rankings: {error}</p></CardContent></Card>
  }
  if (!data) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!data.weight_classes?.length) {
    return (
      <Card><CardContent className="p-6">
        <p className="text-muted-foreground">No ranking data available. Run: python -m app.services.ufc.tapology_rankings</p>
      </CardContent></Card>
    )
  }

  const mens = data.weight_classes.filter((wc) => !wc.key.startsWith('w_') && wc.key !== 'p4p_women')
  const womens = data.weight_classes.filter((wc) => wc.key.startsWith('w_') || wc.key === 'p4p_women')
  const activeDiv = data.weight_classes.find((wc) => wc.key === activeWc)
  const movementDays = data.movement_days ?? 90
  // Pound-for-pound is not a division and has no belt, so its top row is #1, not a belt.
  const hasChampion = !!activeWc && !activeWc.startsWith('p4p')

  const WcButton = ({ wc }) => {
    const active = activeWc === wc.key
    const gold = wc.key.startsWith('p4p')
    return (
      <button
        onClick={() => { setActiveWc(wc.key); setWcOpen(false) }}
        className={cn(
          'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
          active && gold && 'border-amber-500 bg-amber-500 text-white shadow-sm',
          active && !gold && 'border-blue-500 bg-blue-600 text-white shadow-sm',
          !active && 'border-border bg-card text-muted-foreground hover:border-blue-300 hover:bg-muted/50 hover:text-foreground',
        )}
      >
        {wc.label}
        <span className={cn('ml-1 tabular-nums', active ? (gold ? 'text-amber-200' : 'text-blue-200') : 'text-muted-foreground/60')}>
          {wc.fighters.length}
        </span>
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 pb-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
            <TrendingUp className="h-5 w-5 text-white" />
          </span>
          Rankings
        </h1>

        {/* Mobile: collapsible division picker. The table itself scrolls sideways with
            the # and Fighter columns pinned, so it needs no separate mobile layout. */}
        <div className="md:hidden">
          <button
            onClick={() => setWcOpen(!wcOpen)}
            className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2"
          >
            <span className="text-sm font-semibold">{activeDiv?.label || ''}</span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', wcOpen && 'rotate-180')} />
          </button>
          {wcOpen && (
            <div className="mt-2 space-y-2 rounded-lg border bg-card p-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Men</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{mens.map((wc) => <WcButton key={wc.key} wc={wc} />)}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Women</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{womens.map((wc) => <WcButton key={wc.key} wc={wc} />)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="hidden space-y-1.5 md:block">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Men</span>
            <div className="flex flex-wrap gap-1.5">{mens.map((wc) => <WcButton key={wc.key} wc={wc} />)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Women</span>
            <div className="flex flex-wrap gap-1.5">{womens.map((wc) => <WcButton key={wc.key} wc={wc} />)}</div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Card className="overflow-hidden p-0 shadow-sm">
          <CardContent className="p-0">
            {activeDiv && (
              <DivisionTable
                fighters={activeDiv.fighters}
                hasChampion={hasChampion}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
            )}
          </CardContent>
        </Card>
        <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Click a column to sort · a bout box for the fight page · a row for the fighter profile. Form is
          the six-fight window the rank is computed from, oldest first — hover it for the bouts. SOS is
          Tapology&apos;s 1–99 strength-of-schedule figure, context only and not an input to the rank.
          Movement compares each fighter against the standings published ~{movementDays} days ago. Skill
          dimensions live on{' '}
          <Link to="/ufc/fighters/skills" className="font-semibold text-blue-600 hover:underline">Fighter Skills</Link>.
        </p>
      </div>
    </div>
  )
}

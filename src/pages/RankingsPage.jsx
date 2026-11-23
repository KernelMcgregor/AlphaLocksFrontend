import { ArrowRight, CalendarDays, ChevronDown, ChevronUp, Loader2, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/card'
import { RankTable, Split } from '../components/best/layout'
import DivisionTabs from '../components/rankings/DivisionTabs'
import { TIMELAPSE_DIVISIONS } from '../components/rankings/divisions'
import RankingsTimelapse from '../components/rankings/RankingsTimelapse'
import { SlideTabs } from '../components/ui/slide-tabs'
import CountryFlag from '../components/CountryFlag'
import FighterImage from '../components/sports/FighterImage'
import BeltIcon from '../components/ui/belt-icon'
import WavingFlag from '../components/sports/WavingFlag'
import { HeroChip } from '../components/hero/parts'
import { fetchAltRankings, fetchRankings } from '../lib/api'
import { cn, displayRank, fitName, formatRecord, isChampion } from '../lib/utils'

// ---------------------------------------------------------------------------
// Dimension model
// ---------------------------------------------------------------------------
const DIMS = ['pts', 'ko', 'kod', 'sub', 'subd', 'td', 'tdd', 'ctrl', 'ctrld', 'str_vol', 'str_acc', 'dist', 'gnd']

// The 8 axes shown on the radial graphs (a readable subset of the 13 dims).
const AXES = [
  { key: 'str_vol', label: 'Volume', group: 'striking' },
  { key: 'str_acc', label: 'Accuracy', group: 'striking' },
  { key: 'ko', label: 'KO Power', group: 'striking' },
  { key: 'kod', label: 'Chin', group: 'striking' },
  { key: 'td', label: 'Takedowns', group: 'grappling' },
  { key: 'tdd', label: 'TD Defense', group: 'grappling' },
  { key: 'ctrl', label: 'Control', group: 'grappling' },
  { key: 'sub', label: 'Submission', group: 'grappling' },
]

const STRIKING_DIMS = ['str_vol', 'str_acc', 'ko', 'kod', 'dist']
const GRAPPLING_DIMS = ['td', 'tdd', 'ctrl', 'ctrld', 'sub', 'subd', 'gnd']

function initialsOf(fighter) {
  return ((fighter.first_name?.[0] || '') + (fighter.last_name?.[0] || '')).toUpperCase()
}

// Build a percentile lookup across every ranked fighter in a division.
function buildPercentile(fighters) {
  const cols = {}
  DIMS.forEach((d) => {
    cols[d] = fighters.map((f) => f.dimensions?.[d] ?? 0).sort((a, b) => a - b)
  })
  return (dim, val) => {
    const arr = cols[dim]
    if (!arr || arr.length < 2) return 50
    let c = 0
    for (const v of arr) if (v <= val) c++
    return Math.round((c / arr.length) * 100)
  }
}

function deriveProfile(fighter, pct) {
  const dims = fighter.dimensions || {}
  const axes = AXES.map((a) => ({ ...a, value: pct(a.key, dims[a.key] ?? 0) }))
  const avg = (keys) => Math.round(keys.reduce((s, k) => s + pct(k, dims[k] ?? 0), 0) / keys.length)
  const striking = avg(STRIKING_DIMS)
  const grappling = avg(GRAPPLING_DIMS)
  const overall = Math.round((striking + grappling) / 2)
  return {
    axes,
    groups: [
      { label: 'Striking', value: striking, cls: 'text-amber-500', bar: 'bg-amber-500', stroke: 'stroke-amber-500', fill: 'fill-amber-500' },
      { label: 'Grappling', value: grappling, cls: 'text-indigo-500', bar: 'bg-indigo-500', stroke: 'stroke-indigo-500', fill: 'fill-indigo-500' },
      { label: 'Overall', value: overall, cls: 'text-primary', bar: 'bg-primary', stroke: 'stroke-primary', fill: 'fill-primary' },
    ],
    overall,
  }
}

// ---------------------------------------------------------------------------
// Skill radar (dependency-free inline SVG)
// ---------------------------------------------------------------------------
function polar(cx, cy, r, i, n) {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

// Eases a list of numbers toward `target` over `ms`, starting from wherever the last
// animation left them, so switching fighters mid-transition stays continuous. Instant
// under prefers-reduced-motion.
function useTweened(target, ms = 420) {
  const [cur, setCur] = useState(target)
  const curRef = useRef(target)
  const key = target.join(',')
  useEffect(() => {
    const to = key.split(',').map(Number)
    const from = curRef.current.length === to.length ? curRef.current : to
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms
    let raf, t0
    const step = (t) => {
      t0 ??= t
      const k = dur ? Math.min(1, (t - t0) / dur) : 1
      const e = 1 - (1 - k) ** 3
      const next = from.map((v, i) => v + (to[i] - v) * e)
      curRef.current = next
      setCur(next)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [key, ms])
  return cur
}

function RadarChart({ axes }) {
  const cx = 120, cy = 120, R = 92, n = axes.length
  const values = useTweened(axes.map((a) => a.value))
  const rings = [0.25, 0.5, 0.75, 1]
  return (
    <svg viewBox="-60 -18 360 276" width={290} height={237} className="h-full w-full">
      {rings.map((fr, gi) => (
        <polygon
          key={gi}
          points={axes.map((_, i) => polar(cx, cy, R * fr, i, n).join(',')).join(' ')}
          fill="none"
          className="stroke-border"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = polar(cx, cy, R, i, n)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" strokeWidth={1} />
      })}
      <polygon
        points={values.map((v, i) => polar(cx, cy, (R * v) / 100, i, n).join(',')).join(' ')}
        className="fill-primary/20 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const [x, y] = polar(cx, cy, (R * v) / 100, i, n)
        return <circle key={i} cx={x} cy={y} r={2.6} className="fill-background stroke-primary" strokeWidth={1.6} />
      })}
      {axes.map((a, i) => {
        const [x, y] = polar(cx, cy, R + 16, i, n)
        const dx = x - cx
        const anchor = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end'
        return (
          <text key={i} x={x} y={y + 4} fontSize={12.5} fontWeight={600} textAnchor={anchor} className="fill-muted-foreground">
            {a.label}
          </text>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
function FighterAvatar({ fighter, size = 'sm' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  // Nudged down inside the circle so the head clears the top edge. Same image URL as the side panel's portrait (FighterImage), so the full photo is
  // already in the browser cache when a row is clicked and the panel swaps instantly.
  if (fighter.image_url) {
    return (
      <div className={cn(dim, 'overflow-hidden rounded-full bg-muted ring-1 ring-border')}>
        <FighterImage fighter={fighter} loading="lazy" className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
      </div>
    )
  }
  const tier =
    isChampion(fighter) ? 'bg-gold/15 text-gold-foreground' :
    displayRank(fighter) <= 5 ? 'bg-primary/10 text-primary' :
    'bg-muted text-muted-foreground'
  return (
    <div className={cn(dim, 'flex items-center justify-center rounded-full text-[13px] font-extrabold tracking-tight ring-1 ring-border', tier)}>
      {initialsOf(fighter)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Side panel: the selected fighter (the champion, or #1 on P4P/BMF, by default), in the
// same shape as the Highlights and Officials panels: a dark stage, tiles, the radar,
// and the way into the full profile. The stage and the radar share the height.
// ---------------------------------------------------------------------------
function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}

// Labels sit in a two-line box, centred, so one-line labels line up with two-line ones.
function Tile({ label, value, cls }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 px-1 py-1.5">
      <span className={cn('text-[17px] font-extrabold leading-none tabular-nums', cls)}>{value}</span>
      <span className="mt-1 flex h-[11px] items-center text-center text-[8.5px] font-bold uppercase leading-[11px] tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

// The profile page's cover in miniature: the portrait on the waving flag to the right,
// the name in display type down the left with the standing, record and score.
function FighterStage({ row }) {
  const { fighter, division, boardLabel, bmfChampion } = row
  // The BMF holder's row has no board label (it is drawn as the board's champion).
  const champ = bmfChampion || isChampion(fighter)
  const belt = bmfChampion ? 'BMF champion' : `${division} champion`
  return (
    <div className="relative min-h-[200px] flex-[1.1] overflow-hidden rounded-lg bg-ink text-white">
      <div className="absolute inset-y-0 right-0 w-[58%]">
        <div className="absolute inset-0 opacity-70"><WavingFlag key={fighter.country_code} countryCode={fighter.country_code} /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        <FighterImage key={fighter.id} fighter={fighter} fit="contain" alt={`${fighter.first_name} ${fighter.last_name}`}
          className="absolute inset-x-0 bottom-0 top-3 z-10" />
      </div>
      <div className="relative z-20 flex h-full w-[62%] min-w-0 flex-col p-3">
        <div>
          {champ ? (
            <HeroChip className="bg-gold text-ink"><BeltIcon className="h-3 w-3" />{belt}</HeroChip>
          ) : (
            <HeroChip>#{row.rank} {boardLabel || division}</HeroChip>
          )}
        </div>
        <div className="mt-2 min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight text-white/80">{fighter.first_name}</div>
          <div className="@container w-full">
            <div className="font-display font-extrabold italic uppercase leading-[0.9] tracking-tight"
              style={{ fontSize: fitName(fighter.last_name, 40) }}>
              <span className="pr-[0.12em]">{fighter.last_name}</span>
            </div>
          </div>
          {fighter.nickname && <div className="mt-0.5 truncate text-[11px] italic text-white/55">"{fighter.nickname}"</div>}
        </div>
        <div className="mt-auto space-y-2">
          <div>
            <div className="font-display text-[30px] font-extrabold italic leading-none tabular-nums">{Math.round(row.display)}</div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/55">{bmfChampion ? 'BMF score' : boardLabel ? `${boardLabel} score` : 'Score'}</div>
          </div>
          <div>
            <div className="font-display text-[22px] font-extrabold italic leading-none tabular-nums">
              {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
            </div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/55">Record</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FighterPanel({ row, panelRef }) {
  const { fighter, profile } = row
  const [striking, grappling, overall] = profile.groups
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-card p-3">
      <FighterStage row={row} />
      <div className="grid shrink-0 grid-cols-3 gap-1.5">
        <Tile label="Striking" value={striking.value} cls={striking.cls} />
        <Tile label="Grappling" value={grappling.value} cls={grappling.cls} />
        <Tile label="Overall" value={overall.value} cls={overall.cls} />
      </div>
      <div className="flex min-h-[150px] flex-1 flex-col">
        <Label>Skill profile</Label>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <RadarChart axes={profile.axes} />
        </div>
      </div>
      <Link
        to={`/ufc/fighters/${fighter.id}`}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Full profile <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ranking table: one fixed-height line per fighter; a click loads the side panel
// ---------------------------------------------------------------------------
// The header sits inside the scroll box (sticky), so it shares the rows' width —
// outside it, the scrollbar narrowed the rows and the columns drifted from their labels.
// Last and Next show from xl; below that they collapse to nothing.
const gridFor = (hasMove) => hasMove
  ? 'grid grid-cols-[40px_40px_minmax(0,1fr)_60px_44px_0px_40px] xl:grid-cols-[40px_40px_minmax(0,1fr)_60px_44px_236px_40px] items-center gap-3'
  : 'grid grid-cols-[40px_40px_minmax(0,1fr)_60px_44px_0px] xl:grid-cols-[40px_40px_minmax(0,1fr)_60px_44px_236px] items-center gap-3'

function RankCell({ row }) {
  if (row.champ && !row.boardLabel) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15">
        <BeltIcon className="h-4 w-4 text-gold" />
      </div>
    )
  }
  return (
    <span className={cn(
      'font-display text-[22px] font-extrabold italic leading-none tabular-nums',
      row.rank <= 5 ? 'text-primary' : 'text-muted-foreground/70',
    )}>
      {row.rank}
    </span>
  )
}

const METHOD_SHORT = [['Decision - Unanimous', 'UD'], ['Decision - Split', 'SD'], ['Decision - Majority', 'MD'],
  ['Submission', 'SUB'], ['KO/TKO', 'KO'], ['TKO', 'TKO'], ['DQ', 'DQ']]
const methodShort = (m) => (METHOD_SHORT.find(([k]) => (m || '').startsWith(k)) || [null, m ? m.split(' ')[0] : ''])[1]
const monthDayYear = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })

// The payload has the opponent's full name only. Everything after the first name is the
// surname, so Saint Denis, Du Plessis and Dos Anjos stay whole.
const surname = (name) => {
  const w = (name || '').trim().split(/\s+/)
  return w.length > 1 ? w.slice(1).join(' ') : w[0] || ''
}

// One half of the Activity box: opens the fight. A span with a link role rather than a
// <Link>, since the row it sits in is itself a button.
function ActivityPart({ to, title, children, className }) {
  const navigate = useNavigate()
  const go = (e) => { e.stopPropagation(); navigate(to) }
  return (
    <span role="link" tabIndex={0} title={title} onClick={go}
      onKeyDown={(e) => e.key === 'Enter' && go(e)}
      className={cn('flex min-w-0 flex-1 basis-0 cursor-pointer flex-col justify-center px-2 py-1 transition-colors hover:bg-muted', className)}>
      {children}
    </span>
  )
}

// Last fight and, when one is booked, the next: one box, split in two when there is a
// next fight. Each half opens its fight page.
function ActivityCell({ last, next }) {
  if (!last && !next) return <span className="hidden text-[11px] text-muted-foreground/50 xl:block">–</span>
  const r = last && (last.drew ? 'D' : last.won ? 'W' : 'L')
  return (
    <span className="hidden h-9 min-w-0 overflow-hidden rounded-md border border-border bg-background xl:flex">
      {last && (
        <ActivityPart to={`/ufc/fights/${last.fight_id}`}
          title={`${r === 'W' ? 'Beat' : r === 'L' ? 'Lost to' : 'Drew with'} ${last.opponent_name} · ${last.method || ''} · ${fmtDate(last.date)}`}>
          <span className="flex min-w-0 items-center gap-1 text-[11.5px] leading-tight">
            <span className={cn('shrink-0 text-[10px] font-extrabold', r === 'W' ? 'text-emerald-600' : r === 'L' ? 'text-rose-600' : 'text-slate-500')}>{r}</span>
            <b className="truncate font-semibold">{surname(last.opponent_name)}</b>
            <span className="shrink-0 text-muted-foreground">
              {methodShort(last.method)}{!next && last.finish_round && !/^Decision/.test(last.method || '') ? ` R${last.finish_round}` : ''}
            </span>
          </span>
          {/* Alone in the box there is room for the card as well as the date. */}
          <span className="truncate text-[10px] leading-tight tabular-nums text-muted-foreground">
            {monthDayYear(last.date)}{!next && last.event_name ? ` · ${last.event_name.split(':')[0]}` : ''}
          </span>
        </ActivityPart>
      )}
      {next && (
        <ActivityPart to={`/ufc/fights/${next.fight_id}`} title={`${next.event_name} · ${fmtDate(next.event_date)}`}
          className={cn('bg-muted/40', last && 'border-l border-border')}>
          {/* Neutral, so a booking never reads as a second result. */}
          <span className="flex min-w-0 items-center gap-1 text-[11.5px] leading-tight">
            <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground" />
            <b className="truncate font-semibold">{surname(next.opponent_name)}</b>
          </span>
          <span className="text-[10px] leading-tight tabular-nums text-muted-foreground">{monthDayYear(next.event_date)}</span>
        </ActivityPart>
      )}
    </span>
  )
}

// Places gained (▲) or lost (▼) against the baseline snapshot; NEW = unranked then.
function MoveCell({ movement }) {
  if (!movement?.as_of) return <span className="text-[11px] text-muted-foreground/50">–</span>
  if (movement.prior_rank == null) return <span className="text-[10px] font-bold tracking-wide text-primary">NEW</span>
  const d = movement.delta
  if (!d) return <span className="text-[11px] text-muted-foreground/50">–</span>
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-bold tabular-nums', d > 0 ? 'text-emerald-600' : 'text-rose-600')}>
      {d > 0 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{Math.abs(d)}
    </span>
  )
}

// One row's cells; RankTable supplies the button, grid and selection.
function RankCells({ row, hasMove }) {
  const { fighter } = row
  const aside = row.subtitle ?? (fighter.nickname ? `"${fighter.nickname}"` : null)
  return (
    <>
      <div className="flex justify-center"><RankCell row={row} /></div>
      <FighterAvatar fighter={fighter} />
      {/* Name and nickname share one line, so a fighter without a nickname is not
          a row with a hole under the name. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <CountryFlag countryCode={fighter.country_code} />
        {/* The full name always shows; the nickname or division after it gives way first. */}
        <span className="shrink-0 whitespace-nowrap text-[14px] font-bold tracking-tight">{fighter.first_name} {fighter.last_name}</span>
        {row.champ && row.boardLabel && <BeltIcon className="h-3.5 w-3.5 shrink-0 text-gold" />}
        {aside && <span className="min-w-0 truncate text-[12px] text-muted-foreground">{aside}</span>}
      </div>
      <span className="text-[12.5px] font-semibold tabular-nums text-muted-foreground">
        {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
      </span>
      <span className="text-sm font-extrabold tabular-nums">{Math.round(row.display)}</span>
      <ActivityCell last={fighter.last_fight} next={fighter.next_fight} />
      {hasMove && <div><MoveCell movement={row.movement} /></div>}
    </>
  )
}

// Scores out of 100, the top of the board = 100. A pinned champion (a division's, or
// the BMF holder) is the top of the board whatever their points: they show 100 and
// everyone else is scaled to the best contender at 99, so a contender who outscores
// the champion still reads below them, as their rank does.
function withDisplay(rows) {
  const pinned = (r) => r.champ && !r.boardLabel
  const champ = rows.find(pinned)
  const others = rows.filter((r) => r !== champ)
  const top = Math.max(1e-9, ...others.map((r) => r.score))
  const scale = !champ ? 100 / top : champ.score >= top ? 100 / champ.score : 99 / top
  return rows.map((r) => {
    const display = r === champ ? 100 : Math.max(0, Math.min(100, r.score * scale))
    return { ...r, display }
  })
}

// The selected fighter's panel beside the ranked table: the Highlights pages' layout.
function RankingsBoard({ rows, scoreLabel }) {
  const [selectedId, setSelectedId] = useState(rows[0]?.fighter.id)
  const panelRef = useRef(null)
  // Stacked (below lg) the panel sits above the table, so bring it into view on a pick.
  const select = (id) => {
    setSelectedId(id)
    if (!window.matchMedia('(min-width: 1024px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const selected = rows.find((r) => r.fighter.id === selectedId) || rows[0]
  if (!selected) {
    return <Card><CardContent className="p-6"><p className="text-muted-foreground">No fighters ranked here yet.</p></CardContent></Card>
  }
  const hasMove = rows.some((r) => r.movement)
  const grid = gridFor(hasMove)
  const asOf = rows.find((r) => r.movement?.as_of)?.movement.as_of
  return (
    <Split panel={<FighterPanel row={selected} panelRef={panelRef} />}>
      <RankTable
        grid={grid}
        minW="min-w-[600px]"
        head={(
          <>
            <span className="text-center">Rank</span>
            <span />
            <span>Fighter</span>
            <span>Record</span>
            <span>{scoreLabel}</span>
            <span className="hidden xl:block">Activity</span>
            {hasMove && <span title={asOf ? `Change in rank since the ${fmtDate(asOf)} card` : undefined}>Move</span>}
          </>
        )}
        rows={rows}
        rowKey={(r) => r.fighter.id}
        selected={selected.fighter.id}
        onSelect={select}
        renderRow={(r) => <RankCells row={r} hasMove={hasMove} />}
        empty="No fighters ranked here yet."
      />
    </Split>
  )
}

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// ---------------------------------------------------------------------------
// Division board
// ---------------------------------------------------------------------------
function DivisionBoard({ fighters, label }) {
  const rows = useMemo(() => {
    const pct = buildPercentile(fighters)
    return withDisplay(fighters.map((f) => ({
      fighter: f,
      profile: deriveProfile(f, pct),
      division: label,
      rank: displayRank(f),
      champ: isChampion(f),
      score: f.score,
      movement: f.movement,
    })))
  }, [fighters, label])

  return <RankingsBoard rows={rows} scoreLabel="Score" />
}
// ---------------------------------------------------------------------------
// P4P / BMF board — the published top 15
// ---------------------------------------------------------------------------
const ALT_TOP = 15

function AltBoard({ kind, pool, weightClasses }) {
  const [loaded, setLoaded] = useState({ kind: null, data: null, error: null })

  useEffect(() => {
    let live = true
    fetchAltRankings(kind)
      .then((d) => live && setLoaded({ kind, data: d, error: null }))
      .catch((e) => live && setLoaded({ kind, data: null, error: e.message }))
    return () => { live = false }
  }, [kind])
  const data = loaded.kind === kind ? loaded.data : null

  // Each listed fighter is shown with their own division's ranking record, so the
  // panel matches the division board exactly; percentiles are taken within that division.
  const { byId, pctByDiv } = useMemo(() => {
    const byId = {}, pctByDiv = {}
    for (const wc of weightClasses) {
      pctByDiv[wc.key] = buildPercentile(wc.fighters)
      for (const f of wc.fighters) (byId[f.id] ||= []).push({ fighter: f, wc })
    }
    return { byId, pctByDiv }
  }, [weightClasses])

  const rows = useMemo(() => {
    if (!data) return null
    const label = kind === 'bmf' ? 'BMF' : 'P4P'
    // The BMF belt holder (rank 0) sits above the top 15 as champion.
    const sorted = [...(data.pools[pool] || [])].sort((a, b) => a.default_rank - b.default_rank)
    const holder = sorted.filter((a) => a.is_bmf_champion)
    const top = [...holder, ...sorted.filter((a) => !a.is_bmf_champion).slice(0, ALT_TOP)]
    return withDisplay(top.map((a) => {
      // A fighter ranked in two divisions uses the one the list filed them under.
      const entries = byId[a.id] || []
      const own = entries.find((e) => e.wc.key === a.division) || entries[0]
      // The division record wins for the row; the list's own champion flag is the
      // authority for the belt, since division standings may pre-date a title change.
      const fighter = { ...(own?.fighter || a), is_champion: a.is_champion }
      const pct = pctByDiv[own?.wc.key] || buildPercentile([fighter])
      return {
        fighter,
        profile: deriveProfile(fighter, pct),
        division: own?.wc.label || a.division_label,
        rank: a.default_rank,
        champ: !!a.is_champion || !!a.is_bmf_champion,
        bmfChampion: !!a.is_bmf_champion,
        score: a.default_score,
        subtitle: a.division_label,
        // No board label = drawn like a division champion (belt cell, CHAMPION badge).
        boardLabel: a.is_bmf_champion ? null : label,
        movement: a.movement,
      }
    }))
  }, [data, kind, pool, byId, pctByDiv])

  if (loaded.error && loaded.kind === kind) {
    return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load rankings: {loaded.error}</p></CardContent></Card>
  }
  if (!rows) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  return <RankingsBoard rows={rows} scoreLabel={kind === 'bmf' ? 'BMF score' : 'P4P score'} />
}

// The cross-division boards sit in the division picker next to the real divisions.
// Their keys follow the picker's `<kind>_<pool>` convention, which is also how the
// picker files them under Men or Women.
const ALT_BOARDS = [
  { key: 'p4p_men', kind: 'p4p', pool: 'men', label: 'P4P' },
  { key: 'bmf_men', kind: 'bmf', pool: 'men', label: 'BMF' },
  { key: 'p4p_women', kind: 'p4p', pool: 'women', label: 'P4P' },
  { key: 'bmf_women', kind: 'bmf', pool: 'women', label: 'BMF' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const VIEWS = [
  { key: 'current', label: 'Current' },
  { key: 'history', label: 'Time-lapse' },
]

export default function RankingsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // The selected division lives in the URL (?div=p4p_men), so a board is linkable.
  const [params, setParams] = useSearchParams()
  // Men's P4P is the landing view; a division is one click (or ?div=) away.
  const activeWc = params.get('div') || 'p4p_men'
  // ?view=history swaps the board for the time-lapse, which has its own ?division= (a
  // real division: there is no P4P or BMF history) and ?step=.
  const view = params.get('view') === 'history' ? 'history' : 'current'
  const historyDiv = params.get('division') || 'lightweight'
  const setActiveWc = (key) => setParams({ div: key }, { replace: true })
  const setHistoryDiv = (key) => {
    const p = new URLSearchParams(params)
    p.set('division', key)
    p.delete('on')
    setParams(p, { replace: true })
  }
  // Switching views carries the division across when the other view has it.
  const setView = (v) => {
    if (v === 'history') {
      const carry = TIMELAPSE_DIVISIONS.some((d) => d.key === activeWc) ? activeWc : historyDiv
      setParams({ view: 'history', division: carry }, { replace: true })
    } else {
      setParams(params.get('division') ? { div: params.get('division') } : {}, { replace: true })
    }
  }

  useEffect(() => {
    fetchRankings()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <Card><CardContent className="p-6"><p className="text-destructive">Failed to load rankings: {error}</p></CardContent></Card>
    )
  }
  if (!data?.weight_classes?.length) {
    return (
      <Card><CardContent className="p-6"><p className="text-muted-foreground">No ranking data available. Run: python -m app.services.ranking_service</p></CardContent></Card>
    )
  }

  const board = ALT_BOARDS.find((b) => b.key === activeWc)
  const activeDiv = data.weight_classes.find((wc) => wc.key === activeWc) || data.weight_classes[0]
  // P4P and BMF lead their row, ahead of the divisions.
  const pickerItems = [
    ...ALT_BOARDS.filter((b) => b.pool === 'men'),
    ...data.weight_classes.filter((wc) => !wc.key.startsWith('w_')),
    ...ALT_BOARDS.filter((b) => b.pool === 'women'),
    ...data.weight_classes.filter((wc) => wc.key.startsWith('w_')),
  ]

  // Desktop: the page fits the viewport and the panel and table scroll on their own.
  // Narrower: everything stacks and the page scrolls as one.
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <h1 className="page-title mr-2 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-5 w-5 text-white" />
          </span>
          Fighter Rankings
        </h1>
        {view === 'current'
          ? <DivisionTabs items={pickerItems} value={board ? board.key : activeDiv.key} onChange={setActiveWc} />
          : <DivisionTabs items={TIMELAPSE_DIVISIONS} value={historyDiv} onChange={setHistoryDiv} />}
        <div className="ml-auto">
          <SlideTabs tabs={VIEWS} value={view} onChange={setView} />
        </div>
      </div>

      {view === 'history'
        ? <RankingsTimelapse />
        : board
          ? <AltBoard key={board.key} kind={board.kind} pool={board.pool} weightClasses={data.weight_classes} />
          : <DivisionBoard key={activeDiv.key} fighters={activeDiv.fighters} label={activeDiv.label} />}
    </div>
  )
}

import { ChevronDown, ChevronUp, Loader2, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/card'
import DivisionPicker from '../components/sports/DivisionPicker'
import CountryFlag from '../components/CountryFlag'
import FighterImage from '../components/sports/FighterImage'
import WavingFlag from '../components/sports/WavingFlag'
import BeltIcon from '../components/ui/belt-icon'
import { fetchAltRankings, fetchRankings } from '../lib/api'
import { cn, formatRecord, isChampion, displayRank } from '../lib/utils'

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

function ordinal(n) {
  const v = Math.round(n)
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return v + (s[(m - 20) % 10] || s[m] || s[0])
}

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
  const sorted = [...axes].sort((a, b) => b.value - a.value)
  const avg = (keys) => Math.round(keys.reduce((s, k) => s + pct(k, dims[k] ?? 0), 0) / keys.length)
  const striking = avg(STRIKING_DIMS)
  const grappling = avg(GRAPPLING_DIMS)
  const overall = Math.round((striking + grappling) / 2)
  return {
    axes,
    topSkills: sorted.slice(0, 2),
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
// Side panel: the selected fighter (the champion, or #1 on P4P/BMF, by default).
// Sized to the viewport on desktop: the portrait takes whatever height is left
// after the name and badges: the portrait is capped (a tall box blew it up past the
// panel's width) and the radar takes the rest, so extra height goes to the chart. On a
// short screen the portrait crops from the bottom before the radar shrinks.
// ---------------------------------------------------------------------------
// True on a short desktop window (a laptop): there the panel goes side-by-side up top so
// the radar can take the full width and the rest of the height.
function useShortScreen() {
  const q = '(min-width: 1024px) and (max-height: 819px)'
  const [short, setShort] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setShort(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return short
}

function PanelPortrait({ row, className, imgClassName, badgeBottom }) {
  const { fighter, rank, champ, boardLabel } = row
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border bg-muted', className)}>
      <WavingFlag key={fighter.country_code} countryCode={fighter.country_code} />
      <div className="absolute inset-x-0 bottom-0 z-[5] h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
      <FighterImage
        fighter={fighter}
        fit="contain"
        alt={`${fighter.first_name} ${fighter.last_name}`}
        className="absolute inset-0 z-10 flex items-start justify-center pt-[3%]"
        imgClassName={imgClassName}
      />
      {/* A narrow portrait is mostly face up top, so its badge sits at the bottom instead. */}
      <div className={cn('absolute left-2 z-20', badgeBottom ? 'bottom-2' : 'top-2')}>
        {champ && !boardLabel ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-gold/50 bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-gold-foreground backdrop-blur">
            <BeltIcon className="h-3 w-3" /> CHAMPION
          </span>
        ) : (
          <span className="rounded-md bg-background/90 px-1.5 py-0.5 font-display text-lg font-extrabold italic leading-none text-primary backdrop-blur">
            #{rank}{boardLabel && <span className="ml-1 text-[11px] not-italic text-muted-foreground">{boardLabel}</span>}
          </span>
        )}
      </div>
    </div>
  )
}

function GroupScores({ profile, small }) {
  return (
    <div className={cn('flex shrink-0 gap-2 rounded-lg border border-border', small ? 'py-1.5' : 'py-2')}>
      {profile.groups.map((g) => (
        <div key={g.label} className="flex-1 text-center">
          <div className={cn('font-extrabold leading-none tabular-nums', small ? 'text-[15px]' : 'text-lg', g.cls)}>{g.value}</div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
        </div>
      ))}
    </div>
  )
}

function ProfileLink({ fighter, block }) {
  return (
    <Link
      to={`/ufc/fighters/${fighter.id}`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground/80 shadow-sm transition-colors hover:border-primary/40 hover:text-primary',
        block && 'w-full py-1.5',
      )}
    >
      View full profile
    </Link>
  )
}

function FighterPanel({ row, panelRef }) {
  const { fighter, profile, division, score, boardLabel } = row
  const short = useShortScreen()
  const chip = 'shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground/80'
  const record = <span className={chip}>{formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}</span>
  const scoreChip = <span className={chip}>{boardLabel ? `${boardLabel} ${score.toFixed(0)}` : `Score ${score.toFixed(0)}`}</span>
  const standing = isChampion(fighter) ? (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-md border border-gold/50 bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
      <BeltIcon className="h-3 w-3 shrink-0" /><span className="truncate">{boardLabel ? `${division} Champion` : 'Champion'}</span>
    </span>
  ) : (
    <span className="min-w-0 truncate rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
      #{displayRank(fighter)} {division}
    </span>
  )

  if (short) {
    // Laptop: portrait beside identity, the radar below at full width and height.
    return (
      <Card ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col overflow-y-auto p-3.5">
        <div className="grid shrink-0 grid-cols-[132px_minmax(0,1fr)] gap-3">
          <PanelPortrait row={row} badgeBottom className="h-[196px]" imgClassName="h-[115%] w-auto max-w-none object-top" />
          {/* Plain text rather than a stack of chips: name, one meta line, the standing,
              then the three ratings as rows (three columns didn't fit this width). */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-start gap-1.5">
              <CountryFlag countryCode={fighter.country_code} />
              <span className="line-clamp-2 text-[17px] font-extrabold leading-tight tracking-tight">{fighter.first_name} {fighter.last_name}</span>
            </div>
            <div className="mt-1 text-[12px] font-semibold tabular-nums text-muted-foreground">
              {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
              <span className="mx-1.5 text-muted-foreground/50">·</span>
              {boardLabel ? `${boardLabel} ${score.toFixed(0)}` : `Score ${score.toFixed(0)}`}
            </div>
            {isChampion(fighter) ? (
              <div className="mt-1 flex items-start gap-1 text-[12px] font-bold leading-tight text-gold-foreground">
                <BeltIcon className="mt-px h-3.5 w-3.5 shrink-0" />{boardLabel ? `${division} Champion` : 'Champion'}
              </div>
            ) : (
              <div className="mt-1 text-[12px] font-bold leading-tight text-primary">#{displayRank(fighter)} {division}</div>
            )}
            <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
              {profile.groups.map((g) => (
                <div key={g.label} className="grid grid-cols-[66px_minmax(0,1fr)_24px] items-center gap-1.5">
                  <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full transition-[width] duration-500', g.bar)} style={{ width: `${g.value}%` }} />
                  </div>
                  <span className={cn('text-right text-[13px] font-extrabold tabular-nums', g.cls)}>{g.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-2"><ProfileLink fighter={fighter} block /></div>
          </div>
        </div>
        <div className="mt-2.5 flex min-h-[200px] flex-1 flex-col border-t border-border pt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">Skill profile</span>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <RadarChart axes={profile.axes} />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col overflow-y-auto p-4">
      <PanelPortrait
        row={row}
        className="h-[260px] shrink-0 lg:h-auto lg:max-h-[330px] lg:min-h-[110px] lg:flex-1 lg:shrink 2xl:max-h-[380px]"
        imgClassName="h-[max(97%,300px)] w-auto max-w-none object-top"
      />

      {/* identity */}
      <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CountryFlag countryCode={fighter.country_code} />
          <span className="truncate text-xl font-extrabold leading-tight tracking-tight">{fighter.first_name} {fighter.last_name}</span>
        </div>
        <ProfileLink fighter={fighter} />
      </div>

      {/* record · score · standing — one line, always: the last chip truncates first */}
      <div className="mt-2 flex shrink-0 flex-nowrap items-center gap-1.5">{record}{scoreChip}{standing}</div>

      {/* skill radar + group scores */}
      <div className="mt-3 flex shrink-0 flex-col border-t border-border pt-2.5 lg:max-h-[345px] lg:min-h-[235px] lg:flex-[1.6] lg:shrink 2xl:max-h-[390px]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80">Skill profile</span>
        <div className="flex h-[240px] items-center justify-center lg:h-auto lg:min-h-0 lg:flex-1">
          <RadarChart axes={profile.axes} />
        </div>
        <GroupScores profile={profile} />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Ranking table: one fixed-height line per fighter; a click loads the side panel
// ---------------------------------------------------------------------------
// The header sits inside the scroll box (sticky), so it shares the rows' width —
// outside it, the scrollbar narrowed the rows and the columns drifted from their labels.
const gridFor = (hasMove) => hasMove
  ? 'grid grid-cols-[40px_40px_minmax(0,1fr)_64px_minmax(110px,150px)_48px] 2xl:grid-cols-[40px_40px_minmax(0,1fr)_64px_minmax(110px,150px)_48px_minmax(0,230px)] items-center gap-3'
  : 'grid grid-cols-[40px_40px_minmax(0,1fr)_64px_minmax(110px,150px)] 2xl:grid-cols-[40px_40px_minmax(0,1fr)_64px_minmax(110px,150px)_minmax(0,230px)] items-center gap-3'

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

function RankRow({ row, grid, hasMove, selected, onSelect }) {
  const { fighter, profile } = row
  const aside = row.subtitle ?? (fighter.nickname ? `"${fighter.nickname}"` : null)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        grid,
        'h-14 w-full border-b border-border/70 px-4 text-left transition-colors last:border-b-0',
        selected ? 'bg-primary/[0.05] shadow-[inset_3px_0_0_var(--color-primary)]' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex justify-center"><RankCell row={row} /></div>
      <FighterAvatar fighter={fighter} />
      {/* Name and nickname share one line, so a fighter without a nickname is not
          a row with a hole under the name. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <CountryFlag countryCode={fighter.country_code} />
        <span className="min-w-0 truncate text-[14.5px] font-bold tracking-tight">{fighter.first_name} {fighter.last_name}</span>
        {row.champ && row.boardLabel && <BeltIcon className="h-3.5 w-3.5 shrink-0 text-gold" />}
        {aside && <span className="min-w-0 shrink-[4] truncate text-[12px] text-muted-foreground">{aside}</span>}
      </div>
      <span className="text-[12.5px] font-semibold tabular-nums text-muted-foreground">
        {formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)}
      </span>
      <div className="flex items-center gap-2">
        <span className="w-9 text-sm font-extrabold tabular-nums">{row.score.toFixed(0)}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', row.champ && !row.boardLabel ? 'bg-gold' : row.rank <= 5 ? 'bg-primary' : 'bg-muted-foreground/45')}
            style={{ width: `${row.scorePct}%` }}
          />
        </div>
      </div>
      {hasMove && <div><MoveCell movement={row.movement} /></div>}
      <div className="hidden truncate text-[11.5px] text-muted-foreground 2xl:block">
        {profile.topSkills.map((s, i) => (
          <span key={s.key}>
            {i > 0 && <span className="mx-1.5 text-muted-foreground/40">·</span>}
            {s.label} <b className="font-semibold tabular-nums text-foreground/80">{ordinal(s.value)}</b>
          </span>
        ))}
      </div>
    </button>
  )
}

// Bar length: score scaled within the board, floored so the last row still shows.
function withScorePct(rows) {
  const vals = rows.map((r) => r.score)
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 1)
  return rows.map((r) => ({ ...r, scorePct: Math.max(8, Math.round(((r.score - min) / Math.max(max - min, 1)) * 92) + 8) }))
}

function RankingsBoard({ rows, scoreLabel, footer }) {
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
    <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)]">
      <FighterPanel row={selected} panelRef={panelRef} />
      <Card className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn(grid, 'sticky top-0 z-10 border-b border-border bg-muted px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground')}>
            <span className="text-center">Rank</span>
            <span />
            <span>Fighter</span>
            <span>Record</span>
            <span>{scoreLabel}</span>
            {hasMove && <span title={asOf ? `Change in rank since the ${fmtDate(asOf)} card` : undefined}>Move</span>}
            <span className="hidden 2xl:block">Top skills</span>
          </div>
          {rows.map((row) => (
            <RankRow
              key={row.fighter.id}
              row={row}
              grid={grid}
              hasMove={hasMove}
              selected={row.fighter.id === selected.fighter.id}
              onSelect={() => select(row.fighter.id)}
            />
          ))}
          {footer?.(asOf)}
        </div>
      </Card>
    </div>
  )
}

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// ---------------------------------------------------------------------------
// Division board
// ---------------------------------------------------------------------------
function DivisionBoard({ fighters, label, minRounds }) {
  const rows = useMemo(() => {
    const pct = buildPercentile(fighters)
    return withScorePct(fighters.map((f) => ({
      fighter: f,
      profile: deriveProfile(f, pct),
      division: label,
      rank: displayRank(f),
      champ: isChampion(f),
      score: f.score,
      movement: f.movement,
    })))
  }, [fighters, label])

  const footer = () => (
    <div className="space-y-1 border-t border-border bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground">
      <p>
        Every round in UFC history is processed to build <strong>13 skill dimensions</strong> per fighter — capturing{' '}
        <em>how</em> fighters win, not just <em>that</em> they win. Skills are <strong>percentiles within each division</strong>.
      </p>
      <p>Minimum {minRounds || 10} rounds fought to be ranked, active within last 3 years. Ratings decay after 6 months of inactivity.</p>
    </div>
  )
  return <RankingsBoard rows={rows} scoreLabel="Score" footer={footer} />
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
    const top = [...(data.pools[pool] || [])].sort((a, b) => a.default_rank - b.default_rank).slice(0, ALT_TOP)
    return withScorePct(top.map((a) => {
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
        champ: !!a.is_champion,
        score: a.default_score,
        subtitle: a.division_label,
        boardLabel: label,
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
export default function RankingsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // The selected division lives in the URL (?div=p4p_men), so a board is linkable.
  const [params, setParams] = useSearchParams()
  // Men's P4P is the landing view; a division is one click (or ?div=) away.
  const activeWc = params.get('div') || 'p4p_men'
  const setActiveWc = (key) => setParams({ div: key }, { replace: true })

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
    <div className="flex h-full flex-col gap-4 overflow-y-auto lg:overflow-hidden">
      <div className="shrink-0 space-y-3">
        <h1 className="page-title flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-5 w-5 text-white" />
          </span>
          Fighter Rankings
        </h1>
        <DivisionPicker weightClasses={pickerItems} active={board ? board.key : activeDiv.key} onSelect={setActiveWc} />
      </div>

      {board
        ? <AltBoard key={board.key} kind={board.kind} pool={board.pool} weightClasses={data.weight_classes} />
        : <DivisionBoard key={activeDiv.key} fighters={activeDiv.fighters} label={activeDiv.label} minRounds={data.min_rounds} />}
    </div>
  )
}

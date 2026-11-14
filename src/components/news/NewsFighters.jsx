// The fighters a news story is about, in the sidebar formats:
//   ProfileCard   one fighter: portrait, belt or rank, the bio from their profile page,
//                 last results, next fight
//   MatchupTape   two fighters set against each other: a tale of the tape
//   CompactCard   one of several
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, Standing } from '../articles/embeds'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import BeltIcon from '../ui/belt-icon'
import RadarChart from '../viz/RadarChart'
import { AXES } from '../../lib/fighterAnalytics'
import { cn, formatDate } from '../../lib/utils'

const methodShort = (m = '') => m.replace(/Decision - Unanimous/i, 'U Dec').replace(/Decision - Split/i, 'S Dec')
  .replace(/Decision - Majority/i, 'M Dec').replace(/Submission/i, 'Sub')
const year = (d) => (d ? String(d).slice(0, 4) : null)
const monthYear = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '')

function Name({ f, size = 'lg', right }) {
  return (
    <div className={cn('min-w-0 leading-tight', right && 'text-right')}>
      <div className="truncate text-[11.5px] text-muted-foreground">{f.first_name}</div>
      <div className={cn('flex items-center gap-1.5', right && 'flex-row-reverse')}>
        <span className={cn('truncate font-display font-extrabold italic uppercase tracking-tight', size === 'lg' ? 'text-[26px]' : 'text-[20px]')}>{f.last_name}</span>
        <CountryFlag countryCode={f.country_code} className="shrink-0" />
      </div>
      <div className="text-[11.5px] tabular-nums text-muted-foreground">{f.record}</div>
      <Division f={f} className={cn('text-[11px] text-muted-foreground', right && 'justify-end')} />
    </div>
  )
}

function Results({ f, next = true, dates = false, limit = 6 }) {
  if (!f.last?.length && !(next && f.next)) return null
  return (
    <div className="space-y-1">
      {f.last?.slice(0, limit).map((r) => (
        <Link key={r.fight_id} to={`/ufc/fights/${r.fight_id}`} className="flex items-center gap-2 text-[12px] hover:text-primary">
          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-extrabold text-white',
            r.result === 'W' ? 'bg-emerald-600' : r.result === 'L' ? 'bg-primary' : 'bg-muted-foreground')}>{r.result}</span>
          <span className="min-w-0 flex-1 truncate">{r.opponent}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{methodShort(r.method)}{r.round ? ` R${r.round}` : ''}</span>
          {dates && <span className="w-[58px] shrink-0 text-right tabular-nums text-muted-foreground">{monthYear(r.date)}</span>}
        </Link>
      ))}
      {next && f.next && (
        <Link to={`/ufc/fights/${f.next.fight_id}`}
          className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[12px] hover:bg-muted">
          <span className="min-w-0 truncate"><b>Next:</b> vs {f.next.opponent}</span>
          <span className="shrink-0 text-muted-foreground">{formatDate(f.next.date)}</span>
        </Link>
      )}
    </div>
  )
}

const BIO = [['Age', (b) => b.age], ['Height', (b) => b.height], ['Reach', (b) => b.reach], ['Style', (b) => b.style],
  ['From', (b) => b.hometown], ['UFC debut', (b) => year(b.debut)]]

// A fight history row: result, the opponent's headshot, name and flag, the event and
// date beneath, and how it ended on the right.
function HistoryRow({ r }) {
  const o = r.opponent_fighter
  const tone = r.result === 'W' ? 'bg-emerald-600' : r.result === 'L' ? 'bg-primary' : 'bg-muted-foreground'
  return (
    <Link to={`/ufc/fights/${r.fight_id}`} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-muted/60">
      <span className={cn('h-9 w-1 shrink-0 rounded-full', tone)} />
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        {o && <FighterImage fighter={o} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-extrabold', r.result === 'W' ? 'text-emerald-600' : r.result === 'L' ? 'text-primary' : 'text-muted-foreground')}>{r.result}</span>
          <span className="truncate text-[12.5px] font-semibold group-hover:text-primary">{r.opponent}</span>
          {o?.country_code && <CountryFlag countryCode={o.country_code} className="shrink-0" />}
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">{monthYear(r.date)}{r.event && ` · ${r.event.replace(/^UFC Fight Night: /, 'UFC FN: ')}`}</span>
      </span>
      <span className="shrink-0 text-right leading-tight">
        <span className="block text-[11.5px] font-bold">{methodShort(r.method).replace(/^Decision - /, '')}</span>
        <span className="block text-[10.5px] tabular-nums text-muted-foreground">R{r.round}{r.time ? ` ${r.time}` : ''}</span>
      </span>
    </Link>
  )
}

function History({ f }) {
  return (
    <div className="space-y-0.5">
      {f.next && (
        <Link to={`/ufc/fights/${f.next.fight_id}`}
          className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-ink px-3 py-2 text-[12px] text-white hover:bg-ink/90">
          <span className="min-w-0 truncate"><b className="text-primary">Next</b> vs {f.next.opponent}</span>
          <span className="shrink-0 text-white/70">{formatDate(f.next.date)}</span>
        </Link>
      )}
      {(f.last || []).map((r) => <HistoryRow key={r.fight_id} r={r} />)}
    </div>
  )
}

// Rank read with its division: "#6 Heavyweight", or the belt and "Heavyweight champion".
function Division({ f, className }) {
  if (!f.division) return null
  return (
    <div className={cn('flex min-w-0 max-w-full items-center gap-1 text-[11.5px] font-semibold capitalize', className)}>
      {f.champion ? (
        <><BeltIcon className="h-3.5 w-3.5 shrink-0 text-gold" /><span className="truncate">{f.division} champion</span></>
      ) : (
        <span className="truncate">{f.rank ? <span className="text-primary">#{f.rank} </span> : null}{f.division}</span>
      )}
    </div>
  )
}

const BIO_GRID = [['Age', (b) => b.age], ['Height', (b) => b.height], ['Reach', (b) => b.reach], ['Style', (b) => b.style],
  ['UFC debut', (b) => year(b.debut), 2], ['From', (b) => b.hometown, 2]]

// The radar filling whatever room the card leaves it, so it is as big as the screen allows
// and never cut off.
function FittedRadar({ axes }) {
  return (
    <div className="min-h-[150px] flex-1 px-1 pb-2">
      <RadarChart axes={axes} fit />
    </div>
  )
}

// One fighter's profile: their cut-out standing on the right with the name, record and
// bio set beside it, then a toggle between skills (radar and key rates) and fight
// history, and a link to the full profile. In the sidebar it is exactly the height of
// the screen; only the toggle's content scrolls.
export function ProfileCard({ f, compact, className }) {
  const rows = BIO_GRID.map(([l, get, span]) => [l, get(f.bio || {}), span]).filter(([, v]) => v)
  const axes = AXES.map((a) => ({ ...a, full: a.label, value: f.skills?.[a.key] ?? 0 }))
  const hasSkills = f.skills && AXES.some((a) => f.skills[a.key] != null)
  const tabs = [hasSkills ? 'Skills' : null, 'Fight history'].filter(Boolean)
  const [tab, setTab] = useState(tabs[0])
  const at = tabs.indexOf(tab) < 0 ? 0 : tabs.indexOf(tab)
  return (
    <div className={cn('flex flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-card [scrollbar-width:thin]', className)}>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_42%]">
        <div className="min-w-0 p-4 pb-3">
          <div className="truncate text-[12px] font-semibold leading-none text-muted-foreground">
            {f.first_name}
          </div>
          <div className="mt-0.5 truncate font-display text-[32px] font-extrabold italic uppercase leading-[0.95] tracking-tight" title={f.last_name}>{f.last_name}</div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold tabular-nums">
            <span className="flex items-center gap-1.5"><CountryFlag countryCode={f.country_code} />{f.record}</span>
            <Division f={f} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11.5px]">
            {rows.map(([l, v, span]) => (
              <div key={l} className={cn('min-w-0', span === 2 && 'col-span-2')}>
                <dt className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</dt>
                <dd className="truncate font-semibold" title={String(v)}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative min-h-[220px] overflow-hidden">
          <FighterImage fighter={f} fit="contain" className="absolute inset-x-0 bottom-0 top-11" imgClassName="h-full w-full object-contain object-bottom" />
          <Link to={`/ufc/fighters/${f.id}`}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-bold text-white shadow-sm hover:bg-primary/90">
            Full profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {compact ? (
        <div className="border-t border-border px-3 py-2.5"><Results f={f} dates limit={3} /></div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          {tabs.length > 1 && (
            <div className="relative mx-3 mt-3 flex shrink-0 rounded-lg bg-muted p-0.5">
              <span aria-hidden className="absolute inset-y-0.5 left-0.5 rounded-md bg-background shadow-sm transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
                style={{ width: `calc((100% - 4px) / ${tabs.length})`, transform: `translateX(${at * 100}%)` }} />
              {tabs.map((t, k) => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('relative z-10 flex-1 rounded-md py-1 text-[11.5px] font-semibold transition-colors', k === at ? 'text-foreground' : 'text-muted-foreground')}>{t}</button>
              ))}
            </div>
          )}
          {tabs[at] === 'Skills' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mt-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Percentile in division</div>
              <FittedRadar axes={axes} />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5 [scrollbar-width:thin]"><History f={f} /></div>
          )}
        </div>
      )}

    </div>
  )
}

export function MatchupTape({ a, b }) {
  const div = (f) => (f.champion ? `${f.division} champ` : f.rank ? `#${f.rank} ${f.division || ''}` : f.division)
  const rows = [['Record', a.record, b.record], ['Division', div(a), div(b)],
    ...BIO.slice(0, 5).map(([l, get]) => [l, get(a.bio || {}), get(b.bio || {})])]
    .filter(([, x, y]) => x || y)
  return (
    <Panel title="Tale of the tape">
      <div className="mb-1 grid grid-cols-[1fr_64px_1fr] items-end border-b border-border pb-2">
        {[a, b].map((f, k) => (
          <Link key={f.id} to={`/ufc/fighters/${f.id}`} className={cn('flex min-w-0 items-center gap-2', k ? 'order-3' : 'order-1 flex-row-reverse text-right')}>
            <span className="relative shrink-0">
              <span className="block h-10 w-10 overflow-hidden rounded-full bg-muted ring-1 ring-border">
                <FighterImage fighter={f} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
              </span>
              <Standing champion={f.champion} beltOnly className={cn('absolute -bottom-1 h-[18px] min-w-[18px] text-[9px]', k ? '-left-1' : '-right-1')} />
            </span>
            <span className={cn('truncate font-display text-[17px] font-extrabold italic uppercase', k ? 'text-corner-blue' : 'text-corner-red')}>{f.last_name}</span>
          </Link>
        ))}
        <span className="order-2" />
      </div>
      <div className="divide-y divide-border/60 text-[13px]">
        {rows.map(([label, x, y]) => (
          <div key={label} className="grid grid-cols-[1fr_64px_1fr] items-center py-1.5">
            <span className="truncate text-right font-semibold capitalize tabular-nums">{x || '–'}</span>
            <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="truncate font-semibold capitalize tabular-nums">{y || '–'}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
        <Results f={a} next={false} />
        <Results f={b} next={false} />
      </div>
    </Panel>
  )
}

export function CompactCard({ f }) {
  return (
    <Link to={`/ufc/fighters/${f.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-foreground/30">
      <span className="relative shrink-0">
        <span className="block h-12 w-12 overflow-hidden rounded-full bg-muted ring-1 ring-border">
          <FighterImage fighter={f} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
        </span>
        <Standing champion={f.champion} beltOnly className="absolute -bottom-1 -right-1 h-[18px] min-w-[18px] text-[9px]" />
      </span>
      <Name f={f} size="sm" />
    </Link>
  )
}

// Three or more fighters: tabs across the top that rotate every few seconds, a red bar
// sliding along under the active one to show the time left. Clicking a tab stops the
// rotation on that fighter.
const ROTATE_MS = 5000

export function FighterSwitcher({ fighters, className }) {
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto) return undefined
    const t = setTimeout(() => setI((k) => (k + 1) % fighters.length), ROTATE_MS)
    return () => clearTimeout(t)
  }, [i, auto, fighters.length])
  const f = fighters[Math.min(i, fighters.length - 1)]
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
        {fighters.map((x, k) => (
          <button key={x.id} onClick={() => { setI(k); setAuto(false) }} title={`${x.first_name} ${x.last_name}`}
            className={cn('relative flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-md py-1 transition-colors',
              k === i ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-background ring-1 ring-border">
              <FighterImage fighter={x} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
            </span>
            {/* Names while they fit (three fighters); with more, headshots only. */}
            {fighters.length <= 3 && <span className="truncate font-display text-[12.5px] font-extrabold italic uppercase">{x.last_name}</span>}
            {k === i && (
              <span key={`${i}-${auto}`} aria-hidden className="absolute bottom-0 left-0 h-[3px] bg-primary"
                style={auto ? { animation: `rotateBar ${ROTATE_MS}ms linear forwards` } : { width: '100%' }} />
            )}
          </button>
        ))}
      </div>
      <ProfileCard key={f.id} f={f} className="min-h-0 flex-1" />
    </div>
  )
}

// Two fighters, on the white card: names and standing above, both cut-outs standing on
// one line, the bio compared line by line down the middle, then the call to
// action (`children`). Fills the sidebar's height; only the comparison scrolls.
export function DuoCard({ fighters, children, className }) {
  const [a, b] = fighters
  const rows = [['Record', a.record, b.record], ...BIO_GRID.map(([l, get]) => [l, get(a.bio || {}), get(b.bio || {})])]
    .filter(([, x, y]) => x || y)
  const name = (f, k) => (
    <Link key={f.id} to={`/ufc/fighters/${f.id}`} className={cn('group min-w-0', k && 'flex flex-col items-end text-right')}>
      <div className="truncate text-[11px] font-semibold text-muted-foreground">{f.first_name}</div>
      <div className={cn('max-w-full truncate font-display text-[24px] font-extrabold italic uppercase leading-none tracking-tight group-hover:text-primary',
        k ? 'text-corner-blue' : 'text-corner-red')}>{f.last_name}</div>
      <div className={cn('mt-1 flex items-center gap-1.5', k && 'flex-row-reverse')}>
        <CountryFlag countryCode={f.country_code} />
        <Division f={f} className="text-[11px]" />
      </div>
    </Link>
  )
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-border bg-card', className)}>
      <div className="grid shrink-0 grid-cols-2 gap-3 px-3 pt-3">
        {name(a, 0)}
        {name(b, 1)}
      </div>
      {/* The two stand on the card's line; this area takes whatever height is left. */}
      <div className="relative grid min-h-[170px] flex-1 grid-cols-2 gap-2 border-b border-border px-2 pt-2">
        {[a, b].map((f) => (
          <Link key={f.id} to={`/ufc/fighters/${f.id}`} className="relative block">
            <FighterImage fighter={f} fit="contain" className="absolute inset-0" imgClassName="h-full w-full object-contain object-bottom" />
          </Link>
        ))}
        <span className="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 font-display text-[24px] font-extrabold italic text-foreground/20">VS</span>
      </div>
      <div className="shrink-0 divide-y divide-border/70 px-3 py-1 text-[12.5px]">
        {rows.map(([label, x, y]) => (
          <div key={label} className="grid grid-cols-[1fr_74px_1fr] items-center py-1.5">
            <span className="truncate font-semibold tabular-nums" title={String(x || '')}>{x || '–'}</span>
            <span className="text-center text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="truncate text-right font-semibold tabular-nums" title={String(y || '')}>{y || '–'}</span>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

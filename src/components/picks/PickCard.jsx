// One graded market as a card: the pick and its price, the model against the market,
// the grade, the fighter(s) it is about, and why the model sees it that way.
//
// "Why" depends on the market. Picks that back a fighter to win (moneyline, by-method,
// inside the distance) show the winner model's biggest drivers for or against that
// fighter. Every method and rounds market shows the model's six-way finish split with
// the cells the bet pays on highlighted, since that split is where its probability
// comes from.
import { ArrowUpRight, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import GradeChip from './GradeChip'
import {
  MARKET_GROUPS, ago, backsCorner, bandLabel, describeDriver, fmtPct, fmtRoi, fmtSigned,
  marketCorner, priced,
} from '../../lib/picks'
import { cn, formatOdds } from '../../lib/utils'

const GROUP_LABEL = Object.fromEntries(MARKET_GROUPS.map((g) => [g.key, g.label]))

const lastName = (name = '') => name.split(' ').slice(-1)[0]

function Portrait({ fighter, size = 'lg' }) {
  return (
    <div className={cn('relative shrink-0 self-end', size === 'lg' ? 'h-32 w-24' : 'h-24 w-[72px]')}>
      <FighterImage fighter={fighter} alt={fighter?.name} className="absolute inset-0" />
    </div>
  )
}

function Stat({ label, value, className, title }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('truncate text-[15px] font-extrabold tabular-nums', className)}>{value}</div>
    </div>
  )
}

/** Model and market probability on one track, so the gap is visible at a glance. */
function ProbTrack({ p, q }) {
  if (p == null) return null
  const up = q == null || p >= q
  return (
    <div className="relative mt-1 h-2 rounded-full bg-muted" aria-hidden>
      {q != null && (
        <div
          className={cn('absolute inset-y-0 rounded-full', up ? 'bg-emerald-500/35' : 'bg-rose-500/35')}
          style={{ left: `${Math.min(p, q) * 100}%`, width: `${Math.abs(p - q) * 100}%` }}
        />
      )}
      {q != null && (
        <div className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded bg-muted-foreground" style={{ left: `${q * 100}%` }} />
      )}
      <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-foreground" style={{ left: `${p * 100}%` }} />
    </div>
  )
}

// Which six-way cells a market pays on, so the grid can light them up.
function paidCells(m) {
  const k = m.market_key
  if (/^(red|blue)_(ko|sub|dec)$/.test(k)) return [k]
  if (k === 'decision') return m.pick === 'no' ? ['red_ko', 'red_sub', 'blue_ko', 'blue_sub'] : ['red_dec', 'blue_dec']
  const itd = /^itd_(red|blue)$/.exec(k)
  if (itd) {
    const c = itd[1]
    return m.pick === 'no' ? ['red', 'blue'].flatMap((x) => ['ko', 'sub', 'dec'].map((y) => `${x}_${y}`)).filter((x) => x !== `${c}_ko` && x !== `${c}_sub`) : [`${c}_ko`, `${c}_sub`]
  }
  return []
}

function MethodGrid({ fight, highlight }) {
  const mp = fight.method
  if (!mp) return null
  const on = new Set(highlight)
  const finish = mp.red_ko + mp.red_sub + mp.blue_ko + mp.blue_sub
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Model finish split</span>
        <span className="normal-case tracking-normal">Finish {fmtPct(finish, 0)} · Decision {fmtPct(1 - finish, 0)}</span>
      </div>
      <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1 text-[11px]">
        <span />
        {['KO/TKO', 'Sub', 'Dec'].map((h) => (
          <span key={h} className="text-center text-[9.5px] font-semibold text-muted-foreground">{h}</span>
        ))}
        {['red', 'blue'].map((c) => (
          <div key={c} className="contents">
            <span className="truncate pr-1 text-[11px] font-bold">{lastName(fight[c].name)}</span>
            {['ko', 'sub', 'dec'].map((x) => {
              const key = `${c}_${x}`
              return (
                <span
                  key={key}
                  className={cn(
                    'rounded px-1 py-0.5 text-center font-semibold tabular-nums',
                    on.has(key) ? 'bg-primary/15 text-foreground ring-1 ring-primary/50' : 'bg-muted/60 text-muted-foreground',
                  )}
                >
                  {fmtPct(mp[key], 0)}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Drivers({ fight, corner }) {
  const rows = (fight.drivers || []).map((d) => describeDriver(d, corner)).filter((r) => !r.redundant).slice(0, 4)
  if (!rows.length) return null
  const max = Math.max(...rows.map((r) => r.weight))
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Biggest model drivers for {lastName(fight[corner].name)}
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[11.5px]">
            {r.favours
              ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="for" />
              : <X className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-label="against" />}
            <span className="min-w-0 flex-1 truncate" title={r.label}>{r.label}</span>
            {r.detail && <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{r.detail}</span>}
            <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
              <span
                className={cn('block h-full rounded-full', r.favours ? 'bg-emerald-500' : 'bg-rose-500')}
                style={{ width: `${(r.weight / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function summary(m, price) {
  const p = m.p_model, q = m.q_market
  const parts = [`${m.group === 'moneyline' ? 'Model' : 'Our probability'} ${fmtPct(p)}`]
  if (q != null) parts.push(`market ${fmtPct(q)} (${fmtSigned(m.edge_pts, 1, ' pts')})`)
  let s = parts.join(' vs ') + '.'
  if (price.american != null && price.ev != null) {
    s += ` At ${formatOdds(price.american)}${price.book ? ` (${price.book})` : ''} that is ${fmtRoi(price.ev)} EV per $1.`
  }
  return s
}

const BADGE_TONE = {
  'stale price': 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  'line moved away': 'border-rose-500/40 text-rose-700 dark:text-rose-300',
  'opening line': 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  'exchange price': 'border-violet-500/40 text-violet-700 dark:text-violet-300',
}

export default function PickCard({ row, basis, showEvent = false }) {
  const { fight } = row
  const price = priced(row, basis)
  const corner = marketCorner(row)
  const backs = backsCorner(row)
  const noPick = row.grade === '—'
  const books = row.books ? Object.entries(row.books).sort((a, b) => b[1] - a[1]) : null
  const cells = paidCells(row)
  const evTone = price.ev == null ? '' : price.ev > 0 ? 'text-emerald-600' : 'text-rose-600'

  return (
    <article className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm', noPick && 'opacity-80')}>
      {/* Header: grade, market, pick */}
      <header className="flex items-start gap-3 border-b border-border px-4 pt-3.5 pb-3">
        <GradeChip grade={row.grade} basis={row.grade_basis} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>{GROUP_LABEL[row.group]}</span>
            {row.label !== row.pick_label && row.label !== GROUP_LABEL[row.group] && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate normal-case tracking-normal">{row.label}</span>
              </>
            )}
          </div>
          <h3 className="mt-0.5 text-[17px] font-extrabold leading-tight tracking-tight">
            {row.pick_label || <span className="text-muted-foreground">No edge on either side</span>}
          </h3>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {fight.red.name} vs {fight.blue.name}
            {fight.weight_class && <> · {fight.weight_class.replace(/^UFC /, '')}</>}
            {fight.five_round && <> · 5 rds</>}
            {showEvent && row.event && <> · {row.event.name}</>}
          </div>
        </div>
      </header>

      {/* Fighter(s) + numbers */}
      <div className="flex gap-3 px-4 pt-3">
        {corner ? (
          <div className="flex items-end">
            <Portrait fighter={fight[corner]} />
          </div>
        ) : (
          <div className="flex items-end -space-x-3">
            <Portrait fighter={fight.red} size="md" />
            <Portrait fighter={fight.blue} size="md" />
          </div>
        )}
        <div className="min-w-0 flex-1 pb-3">
          {corner && (
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold">
              <CountryFlag countryCode={fight[corner].country_code} />
              <span className="truncate">{fight[corner].name}</span>
              {fight[corner].nickname && <span className="truncate text-[11px] font-normal text-muted-foreground">“{fight[corner].nickname}”</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
            <Stat
              label={basis === 'median' ? 'Typical odds' : 'Best odds'}
              value={price.american != null ? formatOdds(price.american) : '—'}
              title={price.book || undefined}
            />
            <Stat
              label={row.group === 'moneyline' ? 'Model' : 'Our prob.'}
              value={fmtPct(row.p_model)}
              title={row.group === 'moneyline'
                ? 'Winner model, stacked with the market'
                : `Model ${fmtPct(row.p_model_raw)} blended with the market ${fmtPct(row.q_market)}`}
            />
            <Stat label="Market" value={fmtPct(row.q_market)} title={row.source ? `${row.source}, margin removed` : undefined} />
            <Stat label="EV / $1" value={price.ev != null ? fmtRoi(price.ev) : '—'} className={evTone} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span className="truncate">
              {price.american == null ? 'Not posted yet' : price.book ? `at ${price.book}` : ''}
              {basis !== 'median' && row.median_american != null && <> · typical {formatOdds(row.median_american)}</>}
            </span>
            <span className={cn('shrink-0 font-semibold tabular-nums', row.edge_pts > 0 ? 'text-emerald-600' : row.edge_pts < 0 ? 'text-rose-600' : '')}>
              Edge {fmtSigned(row.edge_pts, 1, ' pts')}
            </span>
          </div>
          <ProbTrack p={row.p_model} q={row.q_market} />
        </div>
      </div>

      {/* Why */}
      <div className="space-y-3 border-t border-border bg-muted/25 px-4 py-3">
        <p className="text-[12px] leading-snug">{summary(row, price)}</p>
        {backs && <Drivers fight={fight} corner={corner} />}
        {row.group !== 'moneyline' && <MethodGrid fight={fight} highlight={cells} />}
        {books && (
          <div className="flex flex-wrap gap-1">
            {books.map(([book, a]) => (
              <span
                key={book}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10.5px] tabular-nums',
                  book === row.best_book ? 'border-emerald-500/50 bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground',
                )}
              >
                {book} {formatOdds(a)}
              </span>
            ))}
            {row.reference && (
              <span
                className="rounded border border-dashed border-border px-1.5 py-0.5 text-[10.5px] tabular-nums text-muted-foreground"
                title="Sharp reference price: sets the market probability, not bettable from the US"
              >
                {row.reference.book} {formatOdds(row.reference.american)} · ref
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: backtest basis, badges, link */}
      <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-2.5 text-[10.5px] text-muted-foreground">
        {row.grade_basis && (
          <span className="tabular-nums" title={bandLabel(row.grade_basis.band)}>
            Backtest: {row.grade_basis.n.toLocaleString()} bets · expected {fmtRoi(row.grade_basis.expected_roi)} ROI
            {row.grade_basis.roi != null && <> (raw {fmtRoi(row.grade_basis.roi)})</>}
          </span>
        )}
        {row.badges?.map((b) => (
          <span key={b} className={cn('rounded-full border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide', BADGE_TONE[b] || 'border-border')}>
            {b}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3">
          {row.price_captured_at && <span>{ago(row.price_captured_at)}</span>}
          <Link to={`/ufc/fights/${fight.fight_id}`} className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">
            Fight <ArrowUpRight className="h-3 w-3" />
          </Link>
        </span>
      </footer>
    </article>
  )
}

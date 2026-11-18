// Pieces shared by the officials pages (judges, referees, robberies).
//
// Signed effects use the site's diverging pair: viz-1 (red) for positive, viz-neg
// (indigo) for negative, with the bar's side of the zero line carrying the sign too.
// An effect within 2 standard errors of zero is drawn faded — it is not evidence of
// anything — and its interval is always one hover away.
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { CORNERS } from '../fight/corners'
import { Tip } from '../ui/tip'
import SlideControls from '../viz/SlideControls'
import { useSlidingWindow } from '../viz/hooks'
import { divColor, isReal, KINDS, signed } from './lib'

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

// A Tip when there is tooltip content, else a plain div.
const Wrap = ({ content, ...rest }) => (content ? <Tip content={content} {...rest} /> : <div {...rest} />)

// One signed effect on a track centred on zero. `se` only decides whether the bar is
// drawn faded (within 2 SE of zero: too small to call); the interval itself isn't drawn.
// `marker`: a reference value drawn as a tick (the average judge, on the leans).
export function DivergingRow({ label, value, se, max, marker, fmt = (v) => signed(v, 2), tip, cls, dense }) {
  const clamp = (v) => Math.max(-max, Math.min(max, v))
  const x = (v) => 50 + (clamp(v) / max) * 50
  const real = se == null || isReal(value, se)
  const pos = value >= 0
  const barCls = cls || (pos ? 'bg-viz-1' : 'bg-viz-neg')
  return (
    <Wrap content={tip} className={cn('flex items-center gap-2.5', dense ? 'py-[3px]' : 'py-[5px]')}>
      <span className="w-[112px] shrink-0 truncate text-[11.5px] font-medium text-foreground/80">{label}</span>
      <div className={cn('relative min-w-[90px] flex-1', dense ? 'h-4' : 'h-5')}>
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        {value != null && (
          <div
            className={cn('absolute top-1/2 h-3 -translate-y-1/2 transition-all duration-500', barCls, pos ? 'rounded-r-[4px]' : 'rounded-l-[4px]', !real && 'opacity-30')}
            style={pos ? { left: '50%', width: `${x(value) - 50}%` } : { left: `${x(value)}%`, width: `${50 - x(value)}%` }}
          />
        )}
        {marker != null && (
          <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${x(marker)}%` }} />
        )}
      </div>
      <span className={cn('w-12 shrink-0 text-right text-[11px] font-bold tabular-nums', real ? 'text-foreground' : 'text-muted-foreground')}>
        {value == null ? '—' : fmt(value)}
      </span>
    </Wrap>
  )
}

// Direction words over a set of DivergingRows, lined up with their bars. `label` takes
// the row-label column, so a section title and its directions share one line.
export function AxisEnds({ left, right, label }) {
  return (
    <div className="flex items-center gap-2.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="w-[112px] shrink-0 truncate text-[10.5px] font-extrabold tracking-wider text-foreground">{label}</span>
      {/* Anchored on the zero line, each word on its own side, so short tracks don't crowd them. */}
      <span className="relative h-3 flex-1 whitespace-nowrap">
        <span className="absolute right-[calc(50%+8px)] top-0">← {left}</span>
        <span className="absolute left-[calc(50%+8px)] top-0">{right} →</span>
      </span>
      <span className="w-12 shrink-0" />
    </div>
  )
}

// A compact diverging cell for a table column: same encoding as DivergingRow, no text.
export function LeanCell({ value, se, max = 0.6, tip }) {
  if (value == null) return <span className="text-center text-muted-foreground">—</span>
  const v = Math.max(-max, Math.min(max, value))
  const w = (Math.abs(v) / max) * 50
  const real = se == null || isReal(value, se)
  return (
    <Tip content={tip} className="flex h-6 items-center">
      <div className="relative h-full w-full">
        <div className="absolute inset-y-1 left-1/2 w-px bg-border" />
        <div
          className={cn('absolute top-1/2 h-2.5 -translate-y-1/2', value >= 0 ? 'rounded-r-[3px] bg-viz-1' : 'rounded-l-[3px] bg-viz-neg', !real && 'opacity-25')}
          style={value >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
        />
      </div>
    </Tip>
  )
}

// Tooltip body for a lean: the number in words, nothing more.
export function LeanTip({ lean, meta, judgeName }) {
  if (!lean) return null
  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="font-bold">{meta.label}{judgeName ? ` · ${judgeName}` : ''}</div>
      <div>
        {!isReal(lean.effect, lean.se) ? 'Too small to call'
          : `Leans ${lean.effect > 0 ? 'toward' : 'against'} the ${meta.pos.toLowerCase()}`}
      </div>
    </div>
  )
}

// The deserve-to-win split for a decision: red's share from the left, blue's from the
// right, any draw share between; the tick marks 50%.
export function Meter({ pRed, pBlue, className }) {
  const r = pRed ?? 0
  const b = pBlue ?? 0
  const d = Math.max(0, 1 - r - b)
  return (
    // One continuous bar (red share from the left, any draw share gray, blue from the right);
    // the 50% mark is a tick over the bar rather than a gap cut through it.
    <div className={cn('relative h-2.5 w-full', className)}>
      <div className="flex h-full w-full overflow-hidden rounded-full bg-muted">
        {r > 0 && <div className="h-full" style={{ width: `${r * 100}%`, background: CORNERS[0].css }} />}
        {d > 0.005 && <div className="h-full bg-muted-foreground/30" style={{ width: `${d * 100}%` }} />}
        {b > 0 && <div className="h-full" style={{ width: `${b * 100}%`, background: CORNERS[1].css }} />}
      </div>
      <div className="absolute -inset-y-[3px] left-1/2 w-px -translate-x-1/2 bg-foreground/50" />
    </div>
  )
}

// A judge's total, coloured by the corner it went to.
export function CardScore({ card, name, judgeId, className }) {
  const side = card.side > 0 ? CORNERS[0] : card.side < 0 ? CORNERS[1] : null
  const chip = (
    <span
      className={cn('inline-flex rounded px-1.5 py-px text-[11px] font-bold tabular-nums', !side && 'bg-muted text-muted-foreground', className)}
      style={side ? { color: side.css, background: `color-mix(in srgb, ${side.css} 12%, transparent)` } : undefined}
    >
      {card.red}-{card.blue}
    </span>
  )
  if (!name) return chip
  const inner = judgeId != null
    ? <Link to={`/ufc/judges/${judgeId}`} className="hover:opacity-80">{chip}</Link>
    : chip
  return <Tip content={<span className="text-[11px] font-semibold">{name}</span>}>{inner}</Tip>
}

// Official winner chip beside a name.
export const WinMark = () => (
  <span className="rounded bg-foreground px-1 py-px text-[8.5px] font-black uppercase leading-none tracking-wide text-background">W</span>
)

export function KindBadge({ kind }) {
  return (
    <span className="rounded border border-border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
      {KINDS[kind] || kind}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({ icon: Icon, title, back, sub, children }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-3 w-3" />{back.label}
          </Link>
        )}
        <h1 className="page-title flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary"><Icon className="h-5 w-5 text-white" /></span>
          <span className="truncate">{title}</span>
          {sub}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Panel({ title, right, children, className }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-border bg-card p-3', className)}>
      {(title || right) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {title && <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-foreground">{title}</span>}
          {right && <span className="ml-auto">{right}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

export function FilterGroup({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

// A sortable column header. Sort state is owned by the page (it lives in the URL).
export function SortHead({ k, sort, onSort, children, className, title }) {
  const active = sort.key === k
  return (
    <button
      type="button"
      title={title}
      onClick={() => onSort(k)}
      className={cn('inline-flex items-center gap-0.5 whitespace-nowrap uppercase tracking-wider hover:text-foreground', active && 'text-foreground', className)}
    >
      {children}
      {active && (sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Fights per year
// ---------------------------------------------------------------------------
const YEAR_WIN = 12

// Columns per year from a {year: n} map, gaps filled, windowed like ActivityBars.
export function YearBars({ byYear, unit = 'fights' }) {
  const ys = Object.keys(byYear || {}).map(Number).sort((a, b) => a - b)
  const rows = ys.length ? Array.from({ length: ys[ys.length - 1] - ys[0] + 1 }, (_, i) => {
    const y = ys[0] + i
    return { year: y, count: byYear[y] || byYear[String(y)] || 0 }
  }) : []
  const win = useSlidingWindow(rows.length, YEAR_WIN, 4)
  if (!rows.length) return null
  const max = Math.max(1, ...rows.map((r) => r.count))
  const n = rows.length
  const size = Math.min(YEAR_WIN, n)
  return (
    <Panel
      title={`${unit[0].toUpperCase()}${unit.slice(1)} per year`}
      right={n > YEAR_WIN && <SlideControls win={win} label={`${rows[win.start]?.year}–${rows[win.end - 1]?.year}`} />}
    >
      <div className="overflow-hidden">
        <div
          className="flex h-[84px] items-end"
          style={{
            width: `${(n / size) * 100}%`,
            transform: `translateX(-${(win.start / n) * 100}%)`,
            transition: 'transform 560ms cubic-bezier(0.34, 1.42, 0.64, 1)',
          }}
        >
          {rows.map((r) => (
            <div
              key={r.year}
              className="flex shrink-0 flex-col items-center gap-1 px-[1px]"
              style={{ width: `${100 / n}%` }}
            >
              <span className="text-[10px] font-extrabold tabular-nums text-foreground">{r.count || ''}</span>
              <div className="w-full max-w-[24px] rounded-t-[4px] bg-primary" style={{ height: `${r.count ? Math.max(3, (r.count / max) * 46) : 0}px` }} />
              <span className="text-[9px] font-semibold text-muted-foreground">’{String(r.year).slice(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

export function ErrorCard({ children }) {
  return <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">{children}</div>
}

// Legend for divColor: a gradient bar with its two end values.
export function DivLegend({ label, lo, hi }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span className="font-semibold">{label}</span>
      <span className="tabular-nums">{lo}</span>
      <span
        className="h-2 w-24 rounded-full"
        style={{ background: `linear-gradient(90deg, var(--color-viz-neg), ${divColor(0, 1)}, var(--color-viz-1))` }}
      />
      <span className="tabular-nums">{hi}</span>
    </div>
  )
}

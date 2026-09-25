// The featured bout on the Upcoming dashboard.
//
// Three bands, top to bottom: a header naming the bout, a tale of the tape that carries
// every per-fighter number in one aligned table, and the model's verdict. Portrait
// columns flank the whole thing, each carrying its fighter's name, record, rank and
// probability at its foot.
//
// The tape is the centre of gravity on purpose. Every figure in it belongs to exactly one
// fighter and has a counterpart in the other corner, so a single three-column table —
// red value, label, blue value, under the two names — lets every row be read as a direct
// comparison. Odds and recent form are rows in it rather than panels of their own, which
// is what let the separate "odds across books" and "recent form" blocks go.
//
// Sized to its container: the page gives it one screen of height and nothing here scrolls.
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FighterImage from './FighterImage'
import WavingFlag from './WavingFlag'
import { fetchFightContext, peekCached } from '../../lib/api'
import { cn, formatOdds } from '../../lib/utils'
import { divisionAbbr, formatEdge, fullName, recordOf, summarizeFight, weightLabel } from '../../lib/upcomingSummary'

// Name size by length, as complete class strings — a variant built at runtime never
// reaches the stylesheet. Each step is itself a container-query clamp, so a name scales
// with the column AND starts smaller when it is long: "ALATENGHEILI" and "DVALISHVILI"
// overflowed a narrow column at the base size and broke across two lines mid-word.
const NAME_SIZE = [
  [9, 'text-[clamp(15px,14cqw,26px)]'],
  [12, 'text-[clamp(13px,11cqw,21px)]'],
  [Infinity, 'text-[clamp(11px,8.5cqw,17px)]'],
]
const nameSizeClass = (name) => NAME_SIZE.find(([max]) => (name || '').length <= max)[1]

const CORNERS = {
  red: { text: 'text-corner-red', bar: 'bg-corner-red' },
  blue: { text: 'text-corner-blue', bar: 'bg-corner-blue' },
}

// The name block at the foot of each portrait column. The media above it is sized off
// this, so the two stay in step: change one and the portrait's bottom edge moves with it.
// Fixed rather than content-sized because the portrait's bottom edge has to be predictable
// — it is the line the fade is drawn to.
const NAME_BLOCK_H = 104

// UFC.com writes "--" for a missing measurement rather than leaving it blank.
const val = (v) => {
  const t = typeof v === 'string' ? v.trim() : v
  return !t || t === '--' ? null : t
}
const heightIn = (v) => {
  const m = /(\d+)\s*'\s*(\d+)?/.exec(val(v) || '')
  return m ? Number(m[1]) * 12 + Number(m[2] || 0) : null
}
const reachIn = (v) => {
  const n = parseFloat(val(v) || '')
  return Number.isFinite(n) ? n : null
}
// "Aubervilliers, France" → "Aubervilliers" is worse than the whole string at this width,
// so keep it whole and let the cell truncate. Bare country names stay as they are.
const fromLabel = (v) => val(v)

function PortraitColumn({ fighter, corner, ctxSide, weightClass }) {
  const c = CORNERS[corner]
  const right = corner === 'blue'
  const rank = ctxSide?.glicko?.division_rank
  // "#2" alone does not say #2 of what, and this panel never repeats the division
  // anywhere near the rank.
  const division = divisionAbbr(weightClass)
  return (
    <Link
      to={`/ufc/fighters/${fighter?.id}`}
      className={cn(
        // @container: the type below is sized in cqw, off this column's own width rather
        // than the viewport's. The column is a clamped percentage of a layout that also
        // holds a sidebar and a rail, so viewport width is a poor proxy for it — at 1280
        // the column lands near its 140px floor and a fixed 24px name broke "BARCELOS"
        // across two lines mid-word.
        '@container group relative flex min-h-0 flex-col justify-end overflow-hidden',
        right ? 'border-l border-border' : 'border-r border-border',
      )}
    >
      {/* Media band: flag and portrait share it and end on the same line, just above the
          name. Previously the flag ran the full column while a tall gradient faded the
          portrait out well short of the bottom, which left a band of empty card between
          the two — the "weird whitespace". Bounding both to this band removes it. */}
      <div className="absolute inset-x-0 top-0 z-10" style={{ bottom: NAME_BLOCK_H }}>
        <span className={cn('absolute inset-x-0 top-0 z-20 h-[5px]', c.bar)} />
        <WavingFlag countryCode={fighter?.country_code} />

        {/* object-cover in a box this tall fills the height and crops the sides, which is
            exactly the framing wanted: the portrait spans from its top edge down to the
            name with no letterboxing, so it reads large without the figure shrinking.
            object-top pins the head, so raising or lowering the band moves the bottom of
            the frame rather than the face. */}
        <FighterImage
          fighter={fighter}
          alt={fullName(fighter)}
          className="absolute inset-x-0 bottom-0 z-10 top-[19%]"
        />

        {/* Short fade so the portrait and flag dissolve into the name block instead of
            stopping on a ruled line. */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-linear-to-t from-card to-transparent" />
      </div>

      <div
        className={cn('relative z-30 flex flex-col justify-end px-3.5 pb-3.5', right && 'text-right')}
        style={{ height: NAME_BLOCK_H }}
      >
        <div className="text-[clamp(10px,7cqw,13px)] font-semibold leading-none text-muted-foreground">{fighter?.first_name}</div>
        <div
          className={cn(
            'mt-0.5 break-words font-extrabold uppercase leading-[1.05] tracking-tight group-hover:underline',
            nameSizeClass(fighter?.last_name),
          )}
        >
          {fighter?.last_name || 'TBA'}
        </div>
        {/* Identity only. The model's number used to sit here too, but it is stated
            plainly in the verdict block below and again on every rail card, and three
            copies of it made the column read as a scoreboard rather than a fighter. */}
        <div className="mt-1 truncate text-[clamp(9px,5.4cqw,11.5px)] tabular-nums text-muted-foreground">
          {recordOf(fighter)}
          {rank != null ? ` · #${rank}${division ? ` ${division}` : ''}` : ''}
        </div>
      </div>
    </Link>
  )
}

/** Last five results, most recent first. The blue corner reads right-to-left so the most
 *  recent bout of each fighter sits nearest the centre label. */
function FormChips({ results, align }) {
  if (!results?.length) {
    return <span className="text-[10.5px] text-muted-foreground">No UFC bouts</span>
  }
  const chips = align === 'right' ? [...results].reverse() : results
  return (
    <span className={cn('flex gap-1', align === 'right' ? 'justify-start' : 'justify-end')}>
      {chips.map((r) => (
        <span
          key={r.id}
          title={`${r.draw ? 'Draw' : r.win ? 'Win' : 'Loss'}${r.method ? ` · ${r.method}` : ''}`}
          className={cn(
            'flex h-[17px] w-[17px] items-center justify-center rounded text-[9.5px] font-extrabold text-white',
            r.draw ? 'bg-muted-foreground' : r.win ? 'bg-emerald-600' : 'bg-rose-600',
          )}
        >
          {r.draw ? 'D' : r.win ? 'W' : 'L'}
        </span>
      ))}
    </span>
  )
}

const METHODS = [
  { key: 'ko_prob', label: 'KO/TKO', match: 'KO/TKO', stroke: 'var(--color-red-500)', text: 'text-red-500' },
  { key: 'sub_prob', label: 'Submission', match: 'Submission', stroke: 'var(--color-purple-500)', text: 'text-purple-500' },
  { key: 'dec_prob', label: 'Decision', match: 'Decision', stroke: 'var(--color-slate-400)', text: 'text-slate-500' },
]

/**
 * Method model as a donut.
 *
 * Drawn as three arcs of one circle via stroke-dasharray, so the three probabilities read
 * as parts of a whole — which they are, summing to 1 — rather than as three independent
 * bars. The predicted method is named in the hole.
 */
function MethodDonut({ methodPrediction, size = 76, stroke = 11 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  // Arc lengths and their running start, resolved before the render rather than
  // accumulated inside the map — a counter mutated mid-render is exactly what breaks
  // under re-entrant rendering.
  const rows = METHODS.reduce((acc, m) => {
    const prob = methodPrediction[m.key] || 0
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].len : 0
    acc.push({ ...m, prob, len: prob * c, start })
    return acc
  }, [])
  const predicted = rows.find((m) => m.match === methodPrediction.predicted_method) || rows[0]

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {rows.map((m) => (
            <circle
              key={m.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={m.stroke}
              strokeWidth={stroke}
              strokeDasharray={`${m.len} ${c - m.len}`}
              strokeDashoffset={-m.start}
              opacity={m.match === methodPrediction.predicted_method ? 1 : 0.45}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-[17px] font-extrabold leading-none tabular-nums', predicted.text)}>
            {Math.round(predicted.prob * 100)}%
          </span>
          <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">
            {predicted.label === 'Submission' ? 'Sub' : predicted.label}
          </span>
        </div>
      </div>
      <div className="flex w-[98px] shrink-0 flex-col gap-1">
        {rows.map((m) => (
          <span key={m.key} className="flex items-center gap-1 text-[10px] leading-none">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.stroke }} />
            <span className={cn('truncate', m.match === methodPrediction.predicted_method ? cn(m.text, 'font-bold') : 'text-muted-foreground')}>
              {m.label === 'Submission' ? 'Sub' : m.label}
            </span>
            <span className="ml-auto tabular-nums font-semibold">{Math.round(m.prob * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function FeaturedFight({ fight, event }) {
  const red = fight.red_fighter
  const blue = fight.blue_fighter
  const s = summarizeFight(fight)

  // Only the fight context is fetched now. Recent form used to mean pulling each
  // fighter's entire bout history just to read five results; it rides along with
  // /ufc/upcoming instead, so the chips are never in a loading state.
  const [data, setData] = useState({ for: null, ctx: null })
  useEffect(() => {
    let cancelled = false
    fetchFightContext(fight.id)
      .catch(() => null)
      .then((ctx) => { if (!cancelled) setData({ for: fight.id, ctx }) })
    return () => { cancelled = true }
  }, [fight.id])

  // Read on every render rather than memoised: the cache is mutable by design, and a
  // prefetch that lands mid-render should be picked up on the next paint, not pinned to
  // whatever was there when this fight was first selected. One Map lookup.
  const ctx = (data.for === fight.id ? data.ctx : null) ?? peekCached(`/ufc/fights/${fight.id}/context`)

  const tape = [
    { label: 'Age', r: ctx?.red?.age, b: ctx?.blue?.age },
    { label: 'Height', r: val(red?.height), b: val(blue?.height), cmp: heightIn },
    { label: 'Reach', r: val(red?.reach), b: val(blue?.reach), cmp: reachIn },
    { label: 'Stance', r: val(red?.stance), b: val(blue?.stance) },
    { label: 'Team', r: val(red?.trains_at), b: val(blue?.trains_at) },
    { label: 'From', r: fromLabel(red?.birthplace), b: fromLabel(blue?.birthplace) },
  ].map((row) => {
    // Only height and reach get an advantage mark — they have an unambiguous direction.
    const rn = row.cmp?.(row.r)
    const bn = row.cmp?.(row.b)
    return { ...row, redLead: rn != null && bn != null && rn > bn, blueLead: rn != null && bn != null && bn > rn }
  })

  const redPct = s.redProb != null ? Math.round(s.redProb * 100) : null
  const pickName = s.pickedRed == null ? null : (s.pickedRed ? red : blue)?.last_name

  // Capped and centred: on a wide monitor an uncapped table pushed each value out to its
  // own edge of the panel, metres from the label in the middle it belongs to.
  const cell = 'mx-auto grid w-full max-w-[clamp(460px,92%,860px)] grid-cols-[minmax(0,1fr)_74px_minmax(0,1fr)] items-center gap-2'

  return (
    <div className="grid h-full min-h-0 grid-cols-[clamp(140px,19%,340px)_minmax(0,1fr)_clamp(140px,19%,340px)] overflow-hidden rounded-xl border border-border bg-card">
      <PortraitColumn
        fighter={red}
        corner="red"
        ctxSide={ctx?.red}
        weightClass={fight.weight_class}
      />

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
          <span className="text-[11px] text-muted-foreground">{weightLabel(fight.weight_class)}</span>
          {s.title && (
            <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 text-[9.5px] font-extrabold uppercase tracking-wide text-amber-600">
              Title
            </span>
          )}
          <span className="ml-auto truncate text-[11px] text-muted-foreground">{event?.name}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3">
          {/* Names head the columns so every row below is read as "this fighter's value
              vs that fighter's value" without re-checking which side is which. */}
          <div className={cn(cell, 'shrink-0 border-b-2 border-border pb-1.5')}>
            <span className="truncate text-right text-[13px] font-extrabold uppercase tracking-tight text-corner-red" title={fullName(red)}>
              {red?.last_name || 'TBA'}
            </span>
            <span />
            <span className="truncate text-[13px] font-extrabold uppercase tracking-tight text-corner-blue" title={fullName(blue)}>
              {blue?.last_name || 'TBA'}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {tape.map((t) => (
              <div key={t.label} className={cn(cell, 'flex-1 border-b border-border/60')}>
                <span
                  className={cn(
                    'truncate text-right text-[12px] font-semibold',
                    t.strong && 'tabular-nums',
                    t.redLead && 'font-extrabold text-corner-red',
                  )}
                  title={typeof t.r === 'string' ? t.r : undefined}
                >
                  {t.r ?? '—'}
                </span>
                <span className="text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t.label}
                </span>
                <span
                  className={cn(
                    'truncate text-[12px] font-semibold',
                    t.strong && 'tabular-nums',
                    t.blueLead && 'font-extrabold text-corner-blue',
                  )}
                  title={typeof t.b === 'string' ? t.b : undefined}
                >
                  {t.b ?? '—'}
                </span>
              </div>
            ))}

            <div className={cn(cell, 'flex-1 border-b border-border/60')}>
              <FormChips results={red?.recent_form} />
              <span className="text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Form</span>
              <FormChips results={blue?.recent_form} align="right" />
            </div>

            {/* Below form, as the last row before the model's verdict: the price is what
                the model's number is read against. */}
            <div className={cn(cell, 'flex-1')}>
              <span className="truncate text-right text-[13px] font-bold tabular-nums">
                {s.picked?.red_odds != null ? formatOdds(s.picked.red_odds) : '—'}
              </span>
              <span className="text-center text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Odds</span>
              <span className="truncate text-[13px] font-bold tabular-nums">
                {s.picked?.blue_odds != null ? formatOdds(s.picked.blue_odds) : '—'}
              </span>
            </div>
          </div>

          {/* The model's verdict closes the panel: what it picks, and how it expects the
              fight to end. */}
          <div className="mx-auto mt-2 w-full max-w-[clamp(460px,92%,860px)] shrink-0 rounded-lg border border-border bg-muted/40 p-3">
            {redPct != null ? (
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Model pick</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={cn('min-w-0 truncate text-[18px] font-extrabold leading-none', s.pickedRed ? 'text-corner-red' : 'text-corner-blue')} title={pickName}>
                      {pickName}
                    </span>
                    <span className="shrink-0 text-[14px] font-extrabold tabular-nums">{Math.round(s.pickProb * 100)}%</span>
                  </div>
                  <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-border">
                    <span className="block bg-corner-red" style={{ width: `${redPct}%` }} />
                    <span className="block flex-1 bg-corner-blue" />
                  </span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[10px] tabular-nums text-muted-foreground">
                    <span>{redPct}/{100 - redPct}</span>
                    {s.marketProb != null && (
                      <>
                        <span>·</span>
                        <span>market {Math.round(s.marketProb * 100)}%</span>
                        <span
                          className={cn(
                            'font-bold',
                            s.edge >= 3 ? 'text-emerald-600' : s.edge <= -3 ? 'text-rose-600' : 'text-muted-foreground',
                          )}
                        >
                          {formatEdge(s.edge)} pts
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {fight.method_prediction && (
                  <div className="shrink-0 border-l border-border pl-4">
                    <MethodDonut methodPrediction={fight.method_prediction} />
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2 text-center text-[11px] text-muted-foreground">No prediction yet</div>
            )}
          </div>
        </div>

        <Link
          to={`/ufc/fights/${fight.id}`}
          className="@container mx-4 mb-3 flex shrink-0 items-center gap-3 rounded-lg bg-primary px-3.5 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <span className="flex min-w-0 flex-col">
            <span className="whitespace-nowrap text-[13.5px] font-bold">Read the full breakdown</span>
            {/* Dropped rather than truncated once the button is narrow: a clipped
                "…market m…" reads as a bug, where the heading alone reads as deliberate.
                Class spelled out in full — a variant built at runtime never reaches the
                stylesheet. */}
            <span className="hidden truncate text-[10.5px] text-primary-foreground/90 @min-[360px]:block">
              Analysis, projections and market moves
            </span>
          </span>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
        </Link>
      </div>

      <PortraitColumn
        fighter={blue}
        corner="blue"
        ctxSide={ctx?.blue}
        weightClass={fight.weight_class}
      />
    </div>
  )
}

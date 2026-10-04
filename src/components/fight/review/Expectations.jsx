// Performance against expectations: each fighter's output against the expected-stats
// projection made before the fight (walk-forward, so out of sample). The band is the
// model's 10th-90th percentile, the tick its point estimate, the dot what happened.
// Then the pre-fight keys to victory, each marked won or lost.
import { Check, X } from 'lucide-react'
import { fmtStat, rangeFmt } from '../../../lib/fightProjection'
import { cn } from '../../../lib/utils'
import { Tip } from '../../ui/tip'
import { cornerOf } from '../corners'
import { Box, CornerColumns, Empty } from '../layout'

const VERDICT_CLASS = {
  'well above': 'text-emerald-600',
  above: 'text-emerald-600/80',
  'as expected': 'text-muted-foreground',
  below: 'text-rose-600/80',
  'well below': 'text-rose-600',
}

function ExpectationRow({ row, domain, css }) {
  const x = (v) => `${Math.min(100, Math.max(0, (v / domain) * 100))}%`
  const rf = rangeFmt(row.fmt)
  const delta = row.fmt === 'clock'
    ? `${row.delta >= 0 ? '+' : '−'}${fmtStat(Math.abs(row.delta), 'clock')}`
    : `${row.delta >= 0 ? '+' : '−'}${fmtStat(Math.abs(row.delta), row.fmt === 'int' ? 'int' : 'dec1')}`
  return (
    <Tip content={(
      <span className="text-[11px]">
        <strong>{row.label}</strong>: {fmtStat(row.actual, row.fmt === 'clock' ? 'clock' : 'int')} against{' '}
        {fmtStat(row.expected, row.fmt)} expected
        {row.p10 != null && <> (80% range {fmtStat(row.p10, rf)}–{fmtStat(row.p90, rf)})</>}
        {row.ifDistance != null && <>; {fmtStat(row.ifDistance, row.fmt)} if it went the distance</>}.
      </span>
    )}>
      <div className="grid grid-cols-[86px_1fr_92px] items-center gap-2 py-1">
        <span className="truncate text-[11px] font-semibold text-foreground/80">{row.label}</span>
        <div className="relative h-4">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          {row.p10 != null && row.p90 != null && (
            <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm bg-muted-foreground/20"
              style={{ left: x(row.p10), width: `calc(${x(row.p90)} - ${x(row.p10)})` }} />
          )}
          <div className="absolute top-1/2 h-3.5 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-foreground/60" style={{ left: x(row.expected) }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-sm"
            style={{ left: x(row.actual), background: css }} />
        </div>
        <span className="flex items-baseline justify-end gap-1.5 tabular-nums">
          <span className="text-[12px] font-extrabold">{fmtStat(row.actual, row.fmt === 'clock' ? 'clock' : 'int')}</span>
          <span className={cn('text-[10.5px] font-bold', VERDICT_CLASS[row.verdict] || 'text-muted-foreground')}>{delta}</span>
        </span>
      </div>
    </Tip>
  )
}

export function Expectations({ rows, red, blue }) {
  if (!rows) {
    return <Box title="Against expectations"><Empty>No expected-stats projection was made for this bout.</Empty></Box>
  }
  // One scale per stat across both corners, so the two columns read against each other.
  const domain = {}
  for (const side of ['red', 'blue']) {
    for (const r of rows[side]) {
      domain[r.key] = Math.max(domain[r.key] || 0, r.p90 ?? 0, r.actual, r.expected) * 1.08 || 1
    }
  }
  const summary = (side) => {
    const above = rows[side].filter((r) => r.verdict === 'above' || r.verdict === 'well above').length
    const below = rows[side].filter((r) => r.verdict === 'below' || r.verdict === 'well below').length
    return (
      <span className="text-[10px] font-semibold text-muted-foreground">
        <span className="text-emerald-600">{above} above</span> · <span className="text-rose-600">{below} below</span>
      </span>
    )
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-muted-foreground/20" />80% range</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-[2px] bg-foreground/60" />expected</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-foreground/70" />actual</span>
        <span>Totals for the fight as it went, so a quick finish sits low on volume.</span>
      </div>
      <CornerColumns red={red} blue={blue} aside={summary}>
        {(side) => (
          <div className="divide-y divide-border/40">
            {rows[side].map((r) => (
              <ExpectationRow key={r.key} row={r} domain={domain[r.key]} css={cornerOf(side).css} />
            ))}
          </div>
        )}
      </CornerColumns>
    </div>
  )
}

export function KeysRevisited({ keys, red, blue }) {
  return (
    <Box
      title="Keys to victory, revisited"
      tip="The keys shown on the preview page: each a phase of the fight the expected-stats model projected one corner to win. Marked by whether they actually won it."
      note={keys.length ? `${keys.filter((k) => k.hit).length} of ${keys.length} played out` : null}
    >
      {keys.length ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {keys.map((k) => {
            const mine = k.side === 'red' ? red : blue
            const theirs = k.side === 'red' ? blue : red
            const Icon = k.hit ? Check : X
            return (
              <div key={k.id} className={cn('flex gap-2 rounded-md border p-2', k.hit ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5')}>
                <span className={cn('mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white', k.hit ? 'bg-emerald-600' : 'bg-rose-600')}>
                  <Icon className="h-3 w-3" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: cornerOf(k.side).css }} />
                    <span className="truncate text-[12px] font-extrabold">{mine.last_name}</span>
                    <span className="truncate text-[12px] font-bold text-foreground/80">{k.title}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                    <span className="font-semibold">Projected:</span> {k.projection.replaceAll('{opp}', theirs.last_name).replace(/\.\.$/, '.')}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-foreground/85">
                    <span className="font-semibold">Actual:</span> {k.line}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty>No phase of this fight was projected to clearly belong to either corner.</Empty>
      )}
    </Box>
  )
}

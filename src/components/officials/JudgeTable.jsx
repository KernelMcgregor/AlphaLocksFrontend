// The judges leaderboard: one row per judge, sortable. A click picks the judge for the
// side panel (JudgePanel), which links on to the full profile.
import { cn } from '../../lib/utils'
import { Tip } from '../ui/tip'
import { LeanTip, SortHead } from './shared'
import { isReal, LEANS, ordinal, per10, pct, pts, signed, totalLean } from './lib'
import { ScrollArea } from '../ui/scroll-area'

const GRID = 'grid grid-cols-[24px_minmax(120px,1fr)_52px_80px_68px_repeat(3,54px)_62px_60px] items-center gap-2'

export const JUDGE_SORT = (pool) => (j, k) => {
  switch (k) {
    case 'name': return j.name
    case 'rounds': return j.n_rounds
    case 'acc': return j.acc_above_exp
    case 'agree': return j.agree_above_exp
    case 'majority': return j.deciding_cards
    case 'dissents': return j.dissents
    default: return totalLean(pool, j, k)?.effect ?? null
  }
}

// A lean as a number (+ toward, − against), colored only when it's clearly not zero.
function LeanNum({ lean, meta, name }) {
  if (!lean) return <span className="text-center text-muted-foreground">—</span>
  const v = per10(lean.effect)
  const real = isReal(lean.effect, lean.se)
  return (
    <Tip content={<LeanTip lean={lean} meta={meta} judgeName={name} />} className="flex justify-center">
      <span className={cn('text-[12.5px] font-bold tabular-nums', !real ? 'text-muted-foreground/70' : v > 0 ? 'text-viz-1' : 'text-viz-neg')}>
        {signed(v, 1)}
      </span>
    </Tip>
  )
}

function JudgeRow({ j, rank, pool, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        GRID,
        'h-11 w-full border-b border-border/70 px-3 text-left transition-colors last:border-b-0',
        selected ? 'bg-primary/[0.05] shadow-[inset_3px_0_0_var(--color-primary)]' : 'hover:bg-muted/50',
      )}
    >
      <span className="text-center font-display text-[18px] font-extrabold italic leading-none tabular-nums text-muted-foreground/70">{rank}</span>
      <span className="truncate text-[13.5px] font-bold tracking-tight">{j.name}</span>
      <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{j.n_rounds.toLocaleString()}</span>
      <Tip
        content={<span className="text-[11px] tabular-nums">{pct(j.accuracy)} of rounds scored with the stats · most judges {pct(j.expected_accuracy)}</span>}
        className="flex items-baseline gap-1.5"
      >
        <span className="text-[13px] font-extrabold tabular-nums">{pts(j.acc_above_exp)}</span>
        {j.pct_acc_above_exp != null && <span className="text-[10px] tabular-nums text-muted-foreground">{ordinal(j.pct_acc_above_exp)}</span>}
      </Tip>
      <Tip content={<span className="text-[11px] tabular-nums">{pct(j.agree)} of rounds scored the same as the other judges</span>}>
        <span className="text-[13px] font-extrabold tabular-nums">{pts(j.agree_above_exp)}</span>
      </Tip>
      {LEANS.map((m) => <LeanNum key={m.key} lean={totalLean(pool, j, m.key)} meta={m} name={j.name} />)}
      <span className="text-center text-[12px] font-semibold tabular-nums">{j.deciding_cards}</span>
      <span className={cn('text-center text-[12px] font-semibold tabular-nums', !j.dissents && 'text-muted-foreground')}>{j.dissents ?? '—'}</span>
    </button>
  )
}

export default function JudgeTable({ rows, pool, sort, onSort, selectedId, onSelect }) {
  const head = (k, label, title, center) => (
    <span className={center ? 'flex justify-center' : undefined}>
      <SortHead k={k} sort={sort} onSort={onSort} title={title}>{label}</SortHead>
    </span>
  )
  return (
    // The header sits outside the scroll, so the scrollbar starts under it.
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className={cn(GRID, 'min-w-[660px] shrink-0 border-b border-border bg-muted px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground')}>
          <span />
          {head('name', 'Judge')}
          {head('rounds', 'Rounds')}
          {head('acc', 'With stats', 'Points more (or fewer) rounds scored the way the stats say than most judges manage on the same rounds')}
          {head('agree', 'With panel', 'Points more (or less) agreement with the other two judges than expected')}
          {LEANS.map((m) => <span key={m.key}>{head(m.key, m.short, m.tip, true)}</span>)}
          {head('majority', 'Majority', 'Split or majority decisions where they sided with the result (both majority judges count)', true)}
          {head('dissents', 'Dissents', 'Decisions where their card went against the result', true)}
        </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="!pr-0">
      <div className="min-w-[660px]">
        {rows.length
          ? rows.map((j, i) => (
            <JudgeRow
              key={j.judge_id}
              j={j}
              rank={i + 1}
              pool={pool}
              selected={j.judge_id === selectedId}
              onSelect={() => onSelect(j.judge_id)}
            />
          ))
          : <p className="py-10 text-center text-[12px] text-muted-foreground">No judges match.</p>}
      </div>
      </ScrollArea>
    </div>
  )
}

// Robberies leaderboard: one decision per row, worst first. A click picks the fight for
// the side panel (RobberyPanel). Sized to fit beside the panel without a sideways scroll.
import { cn } from '../../lib/utils'
import { Tip } from '../ui/tip'
import { ScrollArea } from '../ui/scroll-area'
import { CardScore, Meter, SortHead } from '../officials/shared'
import { KINDS, pct, shortDate } from '../officials/lib'
import { loserOf, shortName } from './robbery'

const GRID = 'grid grid-cols-[22px_minmax(0,1fr)_80px_112px_38px_38px_118px] items-center gap-2'

export const ROBBERY_SORT = (r, k) => {
  const l = loserOf(r)
  switch (k) {
    case 'date': return r.date
    case 'media': return l.media.of ? l.media.n / l.media.of : null
    case 'fans': return l.fans
    default: return r.robbery_score
  }
}

function Row({ r, rank, selected, onSelect }) {
  const l = loserOf(r)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        GRID,
        'h-12 w-full border-b border-border/70 pl-3 pr-6 text-left transition-colors last:border-b-0',
        selected ? 'bg-primary/[0.05] shadow-[inset_3px_0_0_var(--color-primary)]' : 'hover:bg-muted/50',
      )}
    >
      <span className="text-center font-display text-[17px] font-extrabold italic leading-none tabular-nums text-muted-foreground/70">{rank}</span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px]" title={`${l.loser.name} lost to ${l.winner.name}`}>
          <b className="font-bold">{shortName(l.loser.name)}</b>
          <span className="text-muted-foreground"> lost to </span>
          <span className="font-semibold">{shortName(l.winner.name)}</span>
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">
          <span className="font-semibold">{KINDS[r.kind] || r.kind}</span> · {r.event_name}
        </span>
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{shortDate(r.date)}</span>
      <Tip content={<span className="text-[11px] tabular-nums">{l.loser.name} wins {pct(l.share, 0)} of replays</span>} className="flex items-center gap-1.5">
        <Meter pRed={r.p_red} pBlue={r.p_blue} className="w-[62px] shrink-0" />
        <span className="text-[13px] font-extrabold tabular-nums">{pct(l.share, 0)}</span>
      </Tip>
      <span className={cn('text-center text-[12px] font-semibold tabular-nums', !l.media.of && 'text-muted-foreground')}>
        {l.media.of ? `${l.media.n}/${l.media.of}` : '—'}
      </span>
      <span className={cn('text-center text-[12px] font-semibold tabular-nums', l.fans == null && 'text-muted-foreground')}>
        {l.fans == null ? '—' : pct(l.fans, 0)}
      </span>
      <span className="flex gap-0.5">
        {r.cards.map((c, i) => <CardScore key={c.judge_id ?? i} card={c} className="px-1 text-[10.5px]" />)}
      </span>
    </button>
  )
}

export default function RobberyTable({ rows, sort, onSort, selectedId, onSelect }) {
  const head = (k, label, title, center) => (
    <span className={center ? 'flex justify-center' : undefined}>
      <SortHead k={k} sort={sort} onSort={onSort} title={title}>{label}</SortHead>
    </span>
  )
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn(GRID, 'shrink-0 border-b border-border bg-muted pl-3 pr-6 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground')}>
        <span />
        <span className="uppercase tracking-wider">Decision</span>
        {head('date', 'Date')}
        {head('score', 'Deserved', 'Share of replays the official loser wins')}
        {head('media', 'Media', 'Media scorecards for the official loser', true)}
        {head('fans', 'Fans', 'Fan scorecards for the official loser', true)}
        <span className="uppercase tracking-wider">Judges</span>
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="!pr-0">
        {rows.length
          ? rows.map((r, i) => (
            <Row key={r.fight_id} r={r} rank={i + 1} selected={r.fight_id === selectedId} onSelect={() => onSelect(r.fight_id)} />
          ))
          : <p className="py-10 text-center text-[12px] text-muted-foreground">No robberies in this window.</p>}
      </ScrollArea>
    </div>
  )
}

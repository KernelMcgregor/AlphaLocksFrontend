// Each corner's divisional rank entering the night and after it (fight.review.rankings,
// from ufc_ranking_history). Divisions follow the ranker's rule — a fighter is ranked in
// the class of their last two bouts — so a first fight away from home leaves the rank
// where it was ("pending"), and only the second one moves it ("moved").
import { ArrowRight, MoveDown, MoveUp } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Tip } from '../../ui/tip'
import { CORNERS } from '../corners'

const DIVISIONS = {
  flyweight: ['Flyweight', 'FLY'], bantamweight: ['Bantamweight', 'BW'], featherweight: ['Featherweight', 'FW'],
  lightweight: ['Lightweight', 'LW'], welterweight: ['Welterweight', 'WW'], middleweight: ['Middleweight', 'MW'],
  light_heavyweight: ['Light Heavyweight', 'LHW'], heavyweight: ['Heavyweight', 'HW'],
  w_strawweight: ["Women's Strawweight", 'W-SW'], w_flyweight: ["Women's Flyweight", 'W-FLY'],
  w_bantamweight: ["Women's Bantamweight", 'W-BW'],
}
const divisionName = (key) => DIVISIONS[key]?.[0] || key
const abbr = (key) => DIVISIONS[key]?.[1] || key

function RankChip({ row, muted }) {
  if (!row) return <span className="text-[11px] font-semibold text-muted-foreground">Unranked</span>
  return (
    <Tip content={<span className="text-[11px]">#{row.rank} of {row.total_ranked} ranked at {divisionName(row.weight_class)}</span>}>
      <span className={cn('text-[12px] font-extrabold tabular-nums', muted && 'text-foreground/60')}>
        #{row.rank} <span className="text-[9.5px] font-bold text-muted-foreground">{abbr(row.weight_class)}</span>
      </span>
    </Tip>
  )
}

function note(m, fightIn) {
  switch (m.status) {
    case 'pending':
      return `Fought at ${divisionName(fightIn)}. One bout away does not move a ranking (it takes two in a row), so still ranked at ${divisionName(m.before.weight_class)}.`
    case 'moved':
      return `Second straight bout at ${divisionName(m.after.weight_class)}: the move is established and the ranking follows.`
    case 'debut':
      return `UFC debut, enters at ${divisionName(m.after.weight_class)}.`
    case 'entered':
      return 'Back in the rankings.'
    case 'dropped':
      return 'Dropped out of the rankings.'
    case 'unranked':
      return fightIn ? null : 'Catchweight bouts count toward no division.'
    default:
      return null
  }
}

export default function RankMovement({ rankings, red, blue }) {
  if (!rankings) return null
  return (
    <div className="shrink-0 rounded-lg border border-border p-2.5">
      <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Rankings · in → out</div>
      <div className="grid gap-1.5">
        {[['red', red, CORNERS[0]], ['blue', blue, CORNERS[1]]].map(([side, f, c]) => {
          const m = rankings[side]
          if (!m) return null
          // Positive = climbed. Only meaningful inside one division.
          const delta = m.status === 'same' ? m.before.rank - m.after.rank : null
          const n = note(m, rankings.fought_in)
          return (
            <div key={side}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.css }} />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold">{f.last_name}</span>
                <RankChip row={m.before} muted />
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <RankChip row={m.after} />
                <span className={cn(
                  'flex w-9 shrink-0 items-center justify-end text-[10.5px] font-bold tabular-nums',
                  delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-muted-foreground',
                )}>
                  {delta > 0 && <MoveUp className="h-3 w-3" />}
                  {delta < 0 && <MoveDown className="h-3 w-3" />}
                  {delta == null ? '' : delta === 0 ? '—' : Math.abs(delta)}
                </span>
              </div>
              {n && <p className="ml-3.5 text-[9.5px] leading-snug text-muted-foreground">{n}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Side panel for the selected robbery: both fighters on the stage (it takes the height
// left over, so the panel never scrolls), the deserve-to-win gauge (it sweeps to each new
// pick, so the panel stays mounted across picks), who scored it for the loser, and the
// judges' cards round by round beside the stats' read.
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchDecisionRounds, fetchRoundStats } from '../../lib/officialsApi'
import { cn } from '../../lib/utils'
import DtwGauge from '../fight/review/DtwGauge'
import FightStage from './FightStage'
import { Meter } from '../officials/shared'
import { KINDS, lastName, pct, useLoad } from '../officials/lib'
import { Tip } from '../ui/tip'
import { loserOf, shortName } from './robbery'

function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}

// A headline number for the loser (the Judges panel's tiles).
function Tile({ label, value }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
      <span className="text-[18px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

const sideCls = (v) => (v > 0 ? 'text-corner-red' : v < 0 ? 'text-corner-blue' : '')
const mmss = (s) => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`

// Hover detail for a round: what each corner did.
function RoundTip({ x, r }) {
  if (!x) return null
  const row = (label, k, f = (v) => v) => (
    <div className="grid grid-cols-[1fr_40px_40px] gap-2 tabular-nums">
      <span>{label}</span>
      <span className="text-right text-corner-red">{f(x.red?.[k] ?? 0)}</span>
      <span className="text-right text-corner-blue">{f(x.blue?.[k] ?? 0)}</span>
    </div>
  )
  return (
    <div className="space-y-0.5 text-[11px]">
      <div className="grid grid-cols-[1fr_40px_40px] gap-2 font-bold">
        <span>Round {x.round}</span>
        <span className="text-right">{lastName(r.red.name)}</span>
        <span className="text-right">{lastName(r.blue.name)}</span>
      </div>
      {row('Sig. strikes', 'sig')}
      {row('Knockdowns', 'kd')}
      {row('Takedowns', 'td')}
      {row('Control', 'ctrl', mmss)}
    </div>
  )
}

const loadCards = (id) => fetchDecisionRounds(id)

const loadStats = (id) => fetchRoundStats(id)

function Rounds({ r }) {
  const { data, error } = useLoad(loadCards, r.fight_id)
  const stats = useLoad(loadStats, r.fight_id).data
  if (error) return <p className="text-[11px] text-destructive">{error}</p>
  if (!data) return <div className="h-[110px]" />
  const byRound = new Map((stats?.rounds || []).map((x) => [x.round, x]))
  const tpl = { gridTemplateColumns: `22px minmax(0,1fr) repeat(${data.judges.length}, 54px)` }
  return (
    <div className="flex flex-col">
      <div className="grid items-end gap-1.5 pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground" style={tpl}>
        <span>Rd</span>
        <span>Stats</span>
        {data.judges.map((j) => (
          <Link key={j.judge_id} to={`/ufc/judges/${j.judge_id}`} title={j.name}
            className={cn('whitespace-nowrap text-center normal-case tracking-normal hover:text-primary', lastName(j.name).length > 8 ? 'text-[9px]' : 'text-[10px]')}>
            {lastName(j.name)}
          </Link>
        ))}
      </div>
      <div className="flex flex-col">
        {data.rounds.map((x) => {
          const lead = x.p_red >= 0.5 ? 'red' : 'blue'
          return (
            <div key={x.round} className="grid h-[26px] items-center gap-1.5 border-t border-border/60" style={tpl}>
              <span className="text-[11.5px] font-extrabold">R{x.round}</span>
              <Tip content={<RoundTip x={byRound.get(x.round)} r={r} />} className="flex items-center gap-1.5">
                <Meter pRed={x.p_red} pBlue={1 - x.p_red} className="w-[46px] shrink-0" />
                <span className={cn('text-[11.5px] font-bold tabular-nums', lead === 'red' ? 'text-corner-red' : 'text-corner-blue')}>
                  {pct(Math.max(x.p_red, 1 - x.p_red), 0)}
                </span>
              </Tip>
              {x.scores.map((sc, k) => (
                <span key={k} className={cn('text-center text-[12px] font-bold tabular-nums', sc ? sideCls(sc.verdict) : 'text-muted-foreground')}>
                  {sc ? sc.score : '—'}
                </span>
              ))}
            </div>
          )
        })}
        <div className="grid shrink-0 items-center gap-1.5 border-t-2 border-foreground/70 pt-1.5" style={tpl}>
          <span className="col-span-2 text-[10px] font-extrabold uppercase">Total</span>
          {data.judges.map((j) => (
            <span key={j.judge_id} className={cn('text-center text-[12.5px] font-extrabold tabular-nums', sideCls(j.side))}>{j.red}-{j.blue}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RobberyPanel({ r, panelRef }) {
  if (!r) return null
  const l = loserOf(r)
  const judgesFor = r.cards.filter((c) => c.side === (l.side === 'red' ? 1 : -1)).length
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-card p-3">
      <FightStage red={r.red} blue={r.blue} winner={r.result > 0 ? 'red' : r.result < 0 ? 'blue' : null}
        eventName={r.event_name} date={r.date}
        corner={<span className="rounded bg-white/10 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white/80">{KINDS[r.kind] || r.kind}</span>} />

      <div className="shrink-0 rounded-lg border border-border bg-muted/30 px-2 pb-1.5 pt-1.5">
        <Label>Deserved to win</Label>
        <DtwGauge pRed={r.p_red} pBlue={r.p_blue} />
      </div>

      <div className="shrink-0">
        <Label>Scored it for {shortName(l.loser.name, 18)}</Label>
        <div className="mt-1.5 flex gap-2">
          <Tile label="Judges" value={`${judgesFor}/${r.cards.length}`} />
          <Tile label="Media" value={l.media.of ? `${l.media.n}/${l.media.of}` : '—'} />
          <Tile label="Fans" value={l.fans == null ? '—' : pct(l.fans, 0)} />
        </div>
      </div>

      <div className="shrink-0">
        <Label>Rounds</Label>
        <div className="mt-1"><Rounds r={r} /></div>
      </div>

      <Link
        to={`/ufc/fights/${r.fight_id}`}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Full fight <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// The judges and referee assigned to an upcoming fight, with each one's headline
// tendencies. Panels are entered by hand before a card, so most fights have none and
// this renders nothing.
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { fetchFightOfficials } from '../../lib/officialsApi'
import { Tip } from '../ui/tip'
import { leanPhrase, ordinal, pct, per10, pts, signed, topLean, useLoad } from './lib'

function Card({ role, name, to, children }) {
  const title = <span className="truncate text-[13px] font-extrabold tracking-tight">{name}</span>
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border p-3">
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{role}</span>
      {to ? <Link to={to} className="truncate hover:text-primary">{title}</Link> : title}
      <div className="mt-1.5 space-y-0.5 text-[11px]">{children}</div>
    </div>
  )
}

const Stat = ({ value, label, muted }) => (
  <div className="flex items-baseline gap-1.5">
    <b className={cn('tabular-nums', muted && 'font-semibold text-muted-foreground')}>{value}</b>
    <span className="truncate text-muted-foreground">{label}</span>
  </div>
)

function JudgeCard({ j }) {
  const p = j.profile
  const lean = p && topLean(p)
  return (
    <Card role="Judge" name={j.name} to={j.judge_id != null ? `/ufc/judges/${j.judge_id}` : null}>
      {!p ? <span className="text-muted-foreground">No record</span> : (
        <>
          <Stat value={pts(p.acc_above_exp)} label={`agrees with stats${p.pct_acc_above_exp != null ? ` · ${ordinal(p.pct_acc_above_exp)}` : ''}`} />
          {lean ? (
            <Tip content={<span className="text-[11px]">{leanPhrase(lean)}</span>}>
              <Stat value={signed(per10(lean.effect), 1)} label={leanPhrase(lean).toLowerCase()} />
            </Tip>
          ) : <Stat value="—" label="no standout lean" muted />}
        </>
      )}
    </Card>
  )
}

function RefereeCard({ r }) {
  const p = r.profile
  return (
    <Card role="Referee" name={r.name} to={r.referee_id != null ? `/ufc/referees/${r.referee_id}` : null}>
      {!p ? <span className="text-muted-foreground">No record</span> : (
        <>
          <Stat value={pct(p.finish_rate, 0)} label={`finish rate · ${p.n_fights} fights`} />
          {p.stoppage_index != null && (
            <Stat
              value={signed(p.stoppage_index, 2)}
              label={p.stoppage_index > 0.15 ? 'lets fights go longer' : p.stoppage_index < -0.15 ? 'stops fights early' : 'stoppage index'}
            />
          )}
        </>
      )}
    </Card>
  )
}

export default function AssignedOfficials({ fightId }) {
  const { data } = useLoad(fetchFightOfficials, fightId ?? null)
  if (!data || (!data.judges?.length && !data.referee)) return null
  return (
    <section className="flex shrink-0 flex-col">
      <div className="mb-3 flex shrink-0 items-baseline gap-2.5">
        <h2 className="font-display text-[22px] font-extrabold italic uppercase leading-none tracking-tight">Officials</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {data.referee && <RefereeCard r={data.referee} />}
        {data.judges.map((j) => <JudgeCard key={j.seq} j={j} />)}
      </div>
    </section>
  )
}

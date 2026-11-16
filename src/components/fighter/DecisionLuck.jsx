// Decision luck: how many of a fighter's decisions they deserved to win (deserve to win,
// 10,000 replays of each fight's own round stats) against how many the judges gave them.
// From /ufc/fighters/{id}/decision-luck. Finishes are left out.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDecisionLuck } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'

const N_ROWS = 4
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

function Stat({ label, value, cls }) {
  return (
    <div className="min-w-0">
      <div className={cn('font-display text-[24px] font-extrabold italic leading-none tabular-nums', cls)}>{value}</div>
      <div className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

// One decision: result, opponent, and the fighter's deserve-to-win share as a bar with
// the 50% line marked.
function Row({ f }) {
  const pct = Math.round(f.p * 100)
  const result = f.won ? 'W' : f.draw ? 'D' : 'L'
  const robbed = !f.won && !f.draw && f.p >= 0.6
  const gift = f.won && f.p <= 0.4
  return (
    <div className="grid grid-cols-[20px_minmax(0,1fr)_minmax(80px,0.9fr)_34px] items-center gap-2 py-1">
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold text-white',
        result === 'W' ? 'bg-emerald-500' : result === 'L' ? 'bg-rose-500' : 'bg-slate-400')}>{result}</span>
      <span className="min-w-0">
        <Link to={`/ufc/fighters/${f.opponent_id}`} className="block text-[12.5px] font-bold leading-tight hover:text-primary">
          {f.opponent_name || 'Unknown'}
        </Link>
        <span className="block text-[10.5px] leading-tight text-muted-foreground">
          {f.kind.toUpperCase()}{f.date ? ` · ${formatDate(f.date)}` : ''}
          {robbed && <span className="ml-1.5 font-bold text-rose-600">Robbed</span>}
          {gift && <span className="ml-1.5 font-bold text-amber-600">Gift</span>}
        </span>
      </span>
      <span className="relative h-2 overflow-hidden rounded-full bg-muted">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', f.p >= 0.5 ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${pct}%` }} />
        <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
      </span>
      <span className="text-right text-[11.5px] font-extrabold tabular-nums">{pct}%</span>
    </div>
  )
}

export default function DecisionLuck({ fighterId, className }) {
  const [state, setState] = useState({ id: null, data: null })
  useEffect(() => {
    let live = true
    fetchDecisionLuck(fighterId).then((d) => live && setState({ id: fighterId, data: d })).catch(() => live && setState({ id: fighterId, data: null }))
    return () => { live = false }
  }, [fighterId])
  const loaded = state.id === fighterId
  const d = loaded ? state.data : null
  // The card always renders (it fills the bottom of its column to keep the two columns
  // level); without decisions it says so instead of disappearing.
  const card = cn('flex flex-col rounded-xl border border-border p-2.5', className)
  const title = <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Decision luck</div>
  if (!d?.decisions) {
    return (
      <div className={card}>
        {title}
        {loaded && <p className="flex flex-1 items-center justify-center py-4 text-[12px] text-muted-foreground">No decisions yet</p>}
      </div>
    )
  }
  const luck = d.luck
  return (
    <div className={card}>
      {title}
      <div className="grid grid-cols-4 gap-2 border-b pb-2.5">
        <Stat label="Luck" value={`${luck > 0 ? '+' : ''}${luck.toFixed(1)}`}
          cls={luck >= 0.5 ? 'text-amber-600' : luck <= -0.5 ? 'text-rose-600' : ''} />
        <Stat label={`Won of ${d.decisions}`} value={fmt(d.won)} />
        <Stat label="Deserved" value={d.deserved.toFixed(1)} />
        <Stat label="Robbed · gifts" value={`${d.robberies} · ${d.gifts}`} />
      </div>
      <div className="mt-1.5 grid grid-cols-[20px_minmax(0,1fr)_minmax(80px,0.9fr)_34px] gap-2 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
        <span /><span>Decision</span><span className="col-span-2">Deserved to win</span>
      </div>
      <div className="divide-y divide-border/60">
        {d.fights.slice(0, N_ROWS).map((f) => <Row key={f.fight_id} f={f} />)}
      </div>
    </div>
  )
}

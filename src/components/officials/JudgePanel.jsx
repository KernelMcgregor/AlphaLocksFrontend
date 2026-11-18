// Side panel on the Officials page: the selected judge's breakdown in plain terms, with
// the way into the full profile. Same role as the fighter panel on Rankings.
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJudgeMisses } from '../../lib/officialsApi'
import { cn } from '../../lib/utils'
import { Tip } from '../ui/tip'
import { AxisEnds, DivergingRow } from './shared'
import { isReal, LEANS, ordinal, pct, per10, pts, REWARDS, shortDate, signed, span, totalLean, useLoad } from './lib'

function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}

// A headline rate: the judge's own number, then how far it sits from most judges.
function Rate({ label, value, vs, pctile, tip }) {
  const real = vs != null && Math.abs(vs) >= 0.01
  return (
    <Tip content={tip} className="flex min-w-0 flex-col rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
      <span className="text-[18px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-1 truncate text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('mt-0.5 truncate text-[11px] font-semibold tabular-nums', !real ? 'text-muted-foreground' : vs > 0 ? 'text-emerald-600' : 'text-rose-600')}>
        {pts(vs)} vs most{pctile != null && <span className="font-normal text-muted-foreground"> · {ordinal(pctile)}</span>}
      </span>
    </Tip>
  )
}

function Count({ label, value, tip }) {
  return (
    <Tip content={tip} className="flex flex-1 flex-col items-center rounded-lg border border-border py-1">
      <span className="text-[15px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
    </Tip>
  )
}

const MISS_H = 32
const loadMisses = (id) => fetchJudgeMisses(id, 12)

// The rounds they scored furthest from the stats, as many as fit the space left in the
// panel (measured, so the panel never scrolls and no row is cut in half).
function Misses({ judgeId }) {
  const box = useRef(null)
  const [space, setSpace] = useState(0)
  const { data } = useLoad(loadMisses, judgeId)
  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setSpace(e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // As many rows as fit at the minimum height, then stretched to share what's left (up to
  // a point), so the panel has no dead band above the button.
  const fit = Math.floor(space / MISS_H)
  const rows = (data || []).slice(0, fit)
  const rowH = rows.length ? Math.min(MISS_H + 12, space / rows.length) : MISS_H
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Label>Biggest misses</Label>
      <div ref={box} className="mt-0.5 min-h-0 flex-1 overflow-hidden">
        {rows.map((m) => {
          const red = m.verdict > 0
          const p = red ? m.p_red : 1 - m.p_red
          return (
            <Link
              key={`${m.fight_id}-${m.round}`}
              to={`/ufc/fights/${m.fight_id}`}
              style={{ height: rowH }}
              className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 hover:bg-muted/50"
            >
              <span className="text-[10.5px] font-bold text-muted-foreground">R{m.round}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px]">
                  <b className="font-bold">{red ? m.red_name : m.blue_name}</b>
                  <span className="text-muted-foreground"> over {red ? m.blue_name : m.red_name}</span>
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">{shortDate(m.date)}</span>
              </span>
              <span className="text-[11px] font-bold tabular-nums">{m.score} <span className="text-rose-600">{pct(p, 0)}</span></span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function JudgePanel({ judge: j, pool, panelRef }) {
  if (!j) return null
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3.5">
      <div>
        <div className="truncate text-lg font-extrabold leading-tight tracking-tight">{j.name}</div>
        <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-muted-foreground">
          {span(j.first_date, j.last_date)}
          <span className="mx-1.5 text-muted-foreground/50">·</span>{j.n_fights.toLocaleString()} fights
          <span className="mx-1.5 text-muted-foreground/50">·</span>{j.n_rounds.toLocaleString()} rounds
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Rate
          label="Scored with stats"
          value={pct(j.accuracy)}
          vs={j.acc_above_exp}
          pctile={j.pct_acc_above_exp}
          tip={<span className="text-[11px] tabular-nums">Gave the round to the fighter the stats favored. Most judges: {pct(j.expected_accuracy)} on the same rounds.</span>}
        />
        <Rate
          label="Agrees with panel"
          value={pct(j.agree)}
          vs={j.agree_above_exp}
          pctile={j.pct_agree_above_exp}
          tip={<span className="text-[11px]">How often they score a round the same way as the other two judges, beyond what you'd expect from how close the rounds were.</span>}
        />
      </div>

      <div>
        <AxisEnds label="Leans" left="Against" right="Toward" />
        <div className="mt-0.5">
          {LEANS.map((m) => {
            const t = totalLean(pool, j, m.key)
            return (
              <DivergingRow
                key={m.key}
                label={m.label}
                value={per10(t?.effect)}
                se={t ? t.se * 2.5 : null}
                max={2.5}
                fmt={(v) => signed(v, 1)}
                dense
              />
            )
          })}
        </div>
      </div>

      <div>
        <AxisEnds label="Stat weight" left="Less" right="More" />
        <div className="mt-0.5">
          {REWARDS.map((m) => {
            const l = j.leans?.[m.key]
            return (
              <DivergingRow
                key={m.key}
                label={m.label}
                value={l?.effect}
                se={l?.se}
                max={0.4}
                dense
                fmt={(v) => (!isReal(v, l?.se) ? 'Avg' : v > 0 ? 'More' : 'Less')}
              />
            )
          })}
        </div>
      </div>

      <div>
        <Label>Split &amp; majority decisions</Label>
        <div className="mt-1 flex gap-2">
          <Count label="In majority" value={j.deciding_cards} tip={<span className="text-[11px]">Split or majority decisions where they sided with the result (both majority judges count)</span>} />
          <Count label="Dissented" value={j.dissents ?? '—'} tip={<span className="text-[11px]">Decisions where their card went against the result</span>} />
          <Count label="Robbery cards" value={j.robbery_cards} tip={<span className="text-[11px]">Cards for the winner in decisions the stats gave the loser (70%+)</span>} />
        </div>
      </div>

      <Misses judgeId={j.judge_id} />

      <Link
        to={`/ufc/judges/${j.judge_id}`}
        className="inline-flex shrink-0 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Full profile <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

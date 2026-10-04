// The fight a round at a time: what each judge gave it, what the round model thinks a
// judge should give it, and the numbers that round produced — on one row, so a
// disputed round can be checked against the strikes and control that decided it.
// Judges' career dissent rates head their columns; the fan vote sits beside.
import { Users } from 'lucide-react'
import { cardSide, panelSummary } from '../../../lib/fightReview'
import { clock } from '../../../lib/fightProjection'
import { cn } from '../../../lib/utils'
import { Tip } from '../../ui/tip'
import { cornerOf, CORNERS } from '../corners'
import { Box, CornerLegend, Empty } from '../layout'

const pct = (p) => `${Math.round(p * 100)}%`

function ScoreCell({ cell, dissent, total }) {
  if (!cell || cell.red == null) return <span className="text-center text-muted-foreground">—</span>
  const side = cardSide(cell, { verdict: !total })
  const ded = (cell.red_ded || 0) + (cell.blue_ded || 0)
  return (
    <span
      className={cn(
        'mx-auto rounded px-1.5 py-px text-center tabular-nums',
        total ? 'text-[12px] font-black' : 'text-[11.5px] font-bold',
        dissent && 'ring-2 ring-amber-500/70',
      )}
      style={side === 'red' || side === 'blue'
        ? { color: cornerOf(side).css, background: `color-mix(in srgb, ${cornerOf(side).css} 12%, transparent)` }
        : undefined}
      title={ded ? `Includes a ${ded}-point deduction` : undefined}
    >
      {cell.red}-{cell.blue}{ded ? '*' : ''}
    </span>
  )
}

// Two numbers, red's first, the bigger one in its corner's colour.
function Pair({ r, b, fmt = (v) => v }) {
  return (
    <span className="text-center text-[11px] tabular-nums">
      <span className={r > b ? 'font-extrabold' : 'text-muted-foreground'} style={r > b ? { color: CORNERS[0].css } : undefined}>{fmt(r)}</span>
      <span className="text-muted-foreground/60"> – </span>
      <span className={b > r ? 'font-extrabold' : 'text-muted-foreground'} style={b > r ? { color: CORNERS[1].css } : undefined}>{fmt(b)}</span>
    </span>
  )
}

function ModelCell({ p }) {
  if (p == null) return <span className="text-center text-muted-foreground">—</span>
  const side = p >= 0.5 ? 'red' : 'blue'
  return (
    <span className="flex items-center justify-center gap-1 text-[11px] font-bold tabular-nums" style={{ color: cornerOf(side).css }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cornerOf(side).css }} />
      {pct(Math.max(p, 1 - p))}
    </span>
  )
}

export default function RoundsAndJudges({ fight, rounds, total, scorecards, dtw }) {
  const red = fight.red_fighter
  const blue = fight.blue_fighter
  const judges = scorecards?.judges || []
  const byRound = judges.some((j) => j.rounds.length)
  const panel = judges.length ? panelSummary(scorecards) : null
  const roundModel = dtw?.round_p_red || []
  if (!rounds.length && !judges.length) {
    return <Box title="Rounds"><Empty>No round-by-round data for this bout.</Empty></Box>
  }

  // Judges' columns only when there are round cards; UFCStats-only fights have totals.
  const judgeCols = byRound ? judges : []
  const cols = `52px ${judgeCols.map(() => 'minmax(56px,1fr)').join(' ')} ${roundModel.length ? '64px' : ''} minmax(78px,1.2fr) minmax(54px,0.8fr) minmax(78px,1fr) minmax(48px,0.7fr)`

  // Which judge broke from the other two in a round.
  const roundDissent = (rnd) => {
    const sides = judgeCols.map((j) => cardSide(j.rounds.find((r) => r.round === rnd), { verdict: true }))
    return sides.map((s) => s && sides.filter((t) => t === s).length === 1 && sides.filter(Boolean).length === 3)
  }

  const panelText = panel && (() => {
    const { red: r, blue: b } = panel.split
    const winner = panel.majority === 'red' ? red : panel.majority === 'blue' ? blue : null
    const kind = (fight.method || '').replace('Decision - ', '')
    const dissenter = panel.dissenters.map((s) => judges.find((j) => j.seq === s)?.name).filter(Boolean)
    return `${kind ? `${kind} decision` : 'Decision'}${winner ? ` for ${winner.last_name}` : ''}, ${Math.max(r, b)}–${Math.min(r, b)}${dissenter.length ? ` · ${dissenter.join(', ')} dissented` : ''}`
  })()

  return (
    <div className="grid gap-3">
      <Box
        title={judges.length ? 'Rounds & judges' : 'Rounds'}
        tip="Each row is one round. Judges' scores are as posted (an asterisk marks a point deduction). The model column is the chance an average judge gives the round to that corner, from the round's stats alone. A ringed score is a judge who broke from the other two that round."
        note={panelText}
        right={<CornerLegend red={red} blue={blue} />}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid items-end gap-1.5 border-b pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: cols }}>
              <span>Round</span>
              {judgeCols.map((j) => (
                <Tip key={j.seq} content={(
                  <span className="text-[11px]">
                    <strong>{j.name}</strong>
                    {j.career ? <> · dissented from the panel in {j.career.dissents} of {j.career.n} decisions ({pct(j.career.dissent_rate)})</> : ' · no career record'}
                  </span>
                )}>
                  <span className="flex flex-col items-center text-center normal-case">
                    <span className="truncate text-[10px] font-extrabold text-foreground">{j.name.split(' ').slice(-1)[0]}</span>
                    {j.career && <span className="text-[9px] font-semibold text-muted-foreground">{pct(j.career.dissent_rate)} dissent</span>}
                  </span>
                </Tip>
              ))}
              {roundModel.length > 0 && <span className="text-center">Model</span>}
              <span className="text-center">Sig. str</span>
              <span className="text-center">TD</span>
              <span className="text-center">Control</span>
              <span className="text-center">KD</span>
            </div>

            {rounds.map((r) => {
              const dissent = byRound ? roundDissent(r.round) : []
              return (
                <div key={r.round} className="grid items-center gap-1.5 border-b border-border/50 py-1.5" style={{ gridTemplateColumns: cols }}>
                  <span className="text-[11px] font-extrabold">
                    R{r.round}
                    {r.seconds != null && r.seconds < 300 && (
                      <span className="ml-1 text-[9.5px] font-semibold text-muted-foreground">{clock(r.seconds)}</span>
                    )}
                  </span>
                  {judgeCols.map((j, i) => (
                    <ScoreCell key={j.seq} cell={j.rounds.find((c) => c.round === r.round)} dissent={dissent[i]} />
                  ))}
                  {roundModel.length > 0 && <ModelCell p={roundModel[r.round - 1]} />}
                  <Pair r={r.red.sig_str_landed} b={r.blue.sig_str_landed} />
                  <Pair r={r.red.td_landed} b={r.blue.td_landed} />
                  <Pair r={r.red.ctrl_seconds} b={r.blue.ctrl_seconds} fmt={clock} />
                  <Pair r={r.red.kd} b={r.blue.kd} />
                </div>
              )
            })}

            {/* Totals: the judges' official cards and the whole-fight numbers. */}
            {(judges.length > 0 || total) && (
              <div className="grid items-center gap-1.5 pt-1.5" style={{ gridTemplateColumns: cols }}>
                <span className="text-[10px] font-black uppercase tracking-wide">Total</span>
                {judgeCols.map((j) => (
                  <ScoreCell key={j.seq} cell={j.total} total dissent={panel?.dissenters.includes(j.seq)} />
                ))}
                {roundModel.length > 0 && <span />}
                {total ? (
                  <>
                    <Pair r={total.red.sig_str_landed} b={total.blue.sig_str_landed} />
                    <Pair r={total.red.td_landed} b={total.blue.td_landed} />
                    <Pair r={total.red.ctrl_seconds} b={total.blue.ctrl_seconds} fmt={clock} />
                    <Pair r={total.red.kd} b={total.blue.kd} />
                  </>
                ) : <span className="col-span-4" />}
              </div>
            )}
          </div>
        </div>

        {/* UFCStats-only decisions: totals per judge, no rounds. */}
        {!byRound && judges.length > 0 && (
          <div className="mt-3 grid gap-2 border-t pt-2 sm:grid-cols-3">
            {judges.map((j) => (
              <div key={j.seq} className="flex items-center justify-between rounded-md border border-border/70 px-2 py-1">
                <span className="truncate text-[11px] font-bold">{j.name}</span>
                <ScoreCell cell={j.total} total dissent={panel?.dissenters.includes(j.seq)} />
              </div>
            ))}
          </div>
        )}
      </Box>

      {scorecards?.fans && (
        <Box
          title="Fan scorecards"
          tip="Scorecards submitted by readers of mmadecisions.com. Not a sample of anything in particular, but a good read of how the fight looked from the couch."
          note={`${scorecards.fans.n.toLocaleString()} cards`}
        >
          <FanVote fans={scorecards.fans} red={red} blue={blue} panel={panel} />
        </Box>
      )}
    </div>
  )
}

function FanVote({ fans, red, blue, panel }) {
  const n = fans.n || 1
  const segs = [
    { key: 'red', v: fans.red || 0, css: CORNERS[0].css, label: red.last_name },
    { key: 'draw', v: fans.draw || 0, css: null, label: 'Draw' },
    { key: 'blue', v: fans.blue || 0, css: CORNERS[1].css, label: blue.last_name },
  ]
  const fanPick = (fans.red || 0) > (fans.blue || 0) ? 'red' : (fans.blue || 0) > (fans.red || 0) ? 'blue' : null
  const disagree = panel && fanPick && panel.majority !== 'even' && fanPick !== panel.majority
  return (
    <>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
        {segs.map((s) => s.v > 0 && (
          <div key={s.key} className={cn('h-full', !s.css && 'bg-muted-foreground/30')}
            style={{ width: `${(s.v / n) * 100}%`, ...(s.css ? { background: s.css } : {}) }} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px]">
        {segs.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', !s.css && 'bg-muted-foreground/30')} style={s.css ? { background: s.css } : undefined} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-bold tabular-nums">{pct(s.v / n)}</span>
          </span>
        ))}
      </div>
      {disagree && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <Users className="h-3.5 w-3.5" />
          The fans scored it for {fanPick === 'red' ? red.last_name : blue.last_name}; the judges did not.
        </p>
      )}
    </>
  )
}

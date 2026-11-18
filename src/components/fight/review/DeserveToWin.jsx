// Deserve to win: the fight replayed 10,000 times from its own round stats, scored by
// three simulated judges (app/services/ufc/deserve_to_win.py). The headline is the
// share of replays each corner wins; under it the round model's read of every round
// and the cards it thinks were likeliest.
//
// For a finish the replays run the unfought rounds from the fight's form, so the
// number answers "who was winning, had it gone the distance" — not who deserved the
// knockout.
import { cardSide } from '../../../lib/fightReview'
import { cn } from '../../../lib/utils'
import { Tip } from '../../ui/tip'
import { cornerOf, CORNERS } from '../corners'
import { Box } from '../layout'
import { DTW_TONES as TONES, pct, verdictFor } from './dtwVerdict'

// Each judge's call on each round (points before deductions), from the mmadecisions
// round cards: [[{ name, side: 'red' | 'blue' | 'even' }, ...] per round].
function judgeVerdicts(scorecards) {
  const judges = scorecards?.judges || []
  if (!judges.some((j) => j.rounds?.length)) return []
  const n = Math.max(...judges.map((j) => Math.max(0, ...j.rounds.map((r) => r.round))))
  return Array.from({ length: n }, (_, i) => judges
    .map((j) => ({ name: j.name, side: cardSide(j.rounds.find((r) => r.round === i + 1), { verdict: true }) }))
    .filter((v) => v.side))
}

// A judge's verdict: a hollow dot at the outer end of the side they gave the round to
// (10-10s at the centre line), over the model's bar.
function JudgeDots({ calls, side }) {
  if (!calls.length) return null
  const css = side === 'even' ? 'var(--color-muted-foreground)' : cornerOf(side).css
  return (
    <span className={cn('pointer-events-none absolute top-1/2 flex -translate-y-1/2 gap-[3px]',
      side === 'red' ? 'left-[3px]' : side === 'blue' ? 'right-[3px]' : 'left-1/2 -translate-x-1/2')}>
      {calls.map((c) => (
        <span key={c.name} className="h-2.5 w-2.5 rounded-full border-2 bg-card ring-1 ring-card" style={{ borderColor: css }} />
      ))}
    </span>
  )
}

// One row per scheduled round: the chance a judge gives it to red, as a bar growing
// from the centre toward whoever took it, with each real judge's call on it. Rounds
// that were never fought (a finish) are drawn faint and labelled projected.
function RoundStrip({ rounds, observed, partialSeconds, names, verdicts = [] }) {
  return (
    <div className="grid gap-1">
      {rounds.map((p, i) => {
        const n = i + 1
        const projected = n > observed
        const partial = n === observed && partialSeconds != null
        const lead = p >= 0.5 ? 'red' : 'blue'
        const lean = Math.abs(p - 0.5) * 2
        const calls = verdicts[i] || []
        const on = (s) => calls.filter((c) => c.side === s)
        return (
          <Tip
            key={n}
            content={(
              <span className="text-[11px]">
                Round {n}{projected ? ' (never fought — projected from the fight\'s form)' : partial ? ` (${Math.floor(partialSeconds / 60)}:${String(partialSeconds % 60).padStart(2, '0')} fought)` : ''}:
                a judge gives it to <strong>{names[lead]}</strong> {pct(Math.max(p, 1 - p))} of the time.
                {calls.length > 0 && (
                  <span className="mt-1 block border-t pt-1">
                    {calls.map((c) => (
                      <span key={c.name} className="block">
                        {c.name}: <strong>{c.side === 'even' ? 'even' : names[c.side]}</strong>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            )}
          >
            <div className={cn('grid grid-cols-[42px_1fr_1fr_44px] items-center gap-1.5', projected && 'opacity-45')}>
              <span className="text-[10px] font-bold text-muted-foreground">
                R{n}{projected ? '*' : ''}
              </span>
              <div className="relative flex h-3.5 justify-end rounded-l bg-muted/50">
                {lead === 'red' && <div className="h-full rounded-l" style={{ width: `${lean * 100}%`, background: CORNERS[0].css }} />}
                <JudgeDots calls={on('red')} side="red" />
              </div>
              <div className="relative flex h-3.5 rounded-r bg-muted/50">
                {lead === 'blue' && <div className="h-full rounded-r" style={{ width: `${lean * 100}%`, background: CORNERS[1].css }} />}
                <JudgeDots calls={on('blue')} side="blue" />
                {on('even').length > 0 && <span className="absolute inset-y-0 left-0 w-0"><JudgeDots calls={on('even')} side="even" /></span>}
              </div>
              <span className="text-right text-[10px] font-bold tabular-nums" style={{ color: cornerOf(lead).css }}>
                {pct(Math.max(p, 1 - p))}
              </span>
            </div>
          </Tip>
        )
      })}
    </div>
  )
}

// Robbery index: the deserve-to-win share of the fighter the judges did NOT give the
// decision to (decisions only). Flagged from 0.7; the number lives in the tooltip.
function RobberyChip({ score, loser }) {
  if (score == null || score < 0.7) return null
  return (
    <Tip content={<span className="text-[11px]">{loser} wins <strong>{pct(score)}</strong> of replays but lost the decision</span>}>
      <span className="cursor-help rounded border border-rose-500/50 bg-rose-500/10 px-1.5 py-px text-[10px] font-black uppercase tracking-wide text-rose-700 dark:text-rose-400">
        Robbery
      </span>
    </Tip>
  )
}

export default function DeserveToWin({ dtw, fight, side, finished, scorecards }) {
  const names = { red: fight.red_fighter.last_name, blue: fight.blue_fighter.last_name }
  const verdicts = judgeVerdicts(scorecards)
  const v = verdictFor(dtw, side, finished, names)
  const Icon = v.icon
  const hasPanel = dtw.panel_p_red != null
  const decTypes = [
    ['Unanimous', dtw.p_ud], ['Split', dtw.p_sd], ['Majority', dtw.p_md],
  ].filter(([, p]) => p != null)

  return (
    <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
      <Box
        title="Deserve to win"
        tip={`The fight replayed ${dtw.n_sims.toLocaleString()} times from its round-by-round stats, each scored by three simulated judges. The share of replays each corner wins is how much the performance, not the official result, favoured them.${dtw.extrapolated ? ' This fight was finished, so rounds never fought are projected from how it was going.' : ''}`}
        note={`${dtw.n_sims.toLocaleString()} replays${dtw.extrapolated ? ' · projected to the distance' : ''}`}
        right={side && <RobberyChip score={dtw.robbery_score} loser={names[side === 'red' ? 'blue' : 'red']} />}
      >
        <div className={cn('mb-3 flex items-start gap-2 rounded-md border px-2.5 py-2', TONES[v.tone])}>
          <Icon className="mt-[1px] h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-[12.5px] font-extrabold">{v.title}</div>
            <div className="text-[11.5px] leading-snug opacity-90">{v.text}</div>
          </div>
        </div>

        {/* The meter: red | draw | blue, one 100% bar with the shares printed over it. */}
        <div className="flex items-end justify-between">
          {['red', 'blue'].map((s) => (
            <div key={s} className={cn('flex flex-col', s === 'blue' && 'items-end')}>
              <span className="text-[30px] font-black leading-none tabular-nums" style={{ color: cornerOf(s).css }}>
                {pct(dtw[`p_${s}`])}
              </span>
              <span className="mt-0.5 text-[11px] font-bold">
                {names[s]}
                {side === s && <span className="ml-1 rounded bg-emerald-600 px-1 text-[9px] font-black uppercase text-white">Won</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
          <div style={{ width: `${dtw.p_red * 100}%`, background: CORNERS[0].css }} />
          {dtw.p_draw > 0.005 && (
            <Tip className="h-full" style={{ width: `${dtw.p_draw * 100}%` }}
              content={<span className="text-[11px]">Draw in {pct(dtw.p_draw, 1)} of replays</span>}>
              <span className="block h-full w-full bg-muted-foreground/30" />
            </Tip>
          )}
          <div style={{ width: `${dtw.p_blue * 100}%`, background: CORNERS[1].css }} />
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[10px] text-muted-foreground">
          <span>Draw {pct(dtw.p_draw, 1)}</span>
          {decTypes.length > 0 && (
            <span>{decTypes.map(([l, p]) => `${l} ${pct(p)}`).join(' · ')}</span>
          )}
        </div>

        {hasPanel && (
          <div className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-[10.5px] text-muted-foreground">
            With this panel&apos;s own scoring tendencies: {names.red}{' '}
            <span className="font-bold tabular-nums text-foreground">{pct(dtw.panel_p_red)}</span>, {names.blue}{' '}
            <span className="font-bold tabular-nums text-foreground">{pct(dtw.panel_p_blue)}</span>
          </div>
        )}

        {dtw.top_cards?.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Likeliest cards</div>
            <div className="grid gap-1">
              {dtw.top_cards.slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.result === 'draw' ? 'var(--color-muted-foreground)' : cornerOf(c.result).css }} />
                  <span className="font-semibold tabular-nums">{(c.cards || []).join(', ')}</span>
                  <span className="text-muted-foreground">{c.result === 'draw' ? 'draw' : names[c.result]}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{pct(c.p, 1)}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[9.5px] text-muted-foreground">Cards read {names.red} first.</p>
          </div>
        )}
      </Box>

      <Box
        title="Round by round"
        tip={`The round model: the chance a judge scores each round for each corner, from that round's strikes, takedowns, control and knockdowns.${verdicts.length ? ' Hollow dots are the real judges\' calls.' : ''} Rounds marked * were never fought.`}
        note="who a judge gives each round to"
        right={verdicts.length > 0 && (
          <span className="flex items-center gap-1 text-[9.5px] font-semibold text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground bg-card" />Judge
          </span>
        )}
      >
        <RoundStrip
          rounds={dtw.round_p_red || []}
          observed={dtw.rounds_observed}
          partialSeconds={dtw.partial_round_seconds}
          names={names}
          verdicts={verdicts}
        />
        {dtw.extrapolated && (
          <p className="mt-2 text-[10px] italic text-muted-foreground">
            * projected: the fight ended in round {dtw.rounds_observed}.
          </p>
        )}
      </Box>
    </div>
  )
}

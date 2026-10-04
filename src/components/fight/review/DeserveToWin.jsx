// Deserve to win: the fight replayed 10,000 times from its own round stats, scored by
// three simulated judges (app/services/ufc/deserve_to_win.py). The headline is the
// share of replays each corner wins; under it the round model's read of every round
// and the cards it thinks were likeliest.
//
// For a finish the replays run the unfought rounds from the fight's form, so the
// number answers "who was winning, had it gone the distance" — not who deserved the
// knockout.
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Tip } from '../../ui/tip'
import { cornerOf, CORNERS } from '../corners'
import { Box } from '../layout'

const pct = (p, d = 0) => `${(p * 100).toFixed(d)}%`

// What kind of result this was, from the official winner's share of replays.
function verdictFor(dtw, side, finished, names) {
  if (!side) {
    const lead = dtw.p_red >= dtw.p_blue ? 'red' : 'blue'
    return {
      tone: 'neutral', icon: Scale,
      title: 'No winner on the night',
      text: `${names[lead]} wins ${pct(dtw[`p_${lead}`])} of replays.`,
    }
  }
  const won = dtw[`p_${side}`]
  const loser = side === 'red' ? 'blue' : 'red'
  if (finished) {
    return dtw[`p_${loser}`] > 0.5
      ? { tone: 'amber', icon: AlertTriangle, title: 'Comeback finish',
        text: `${names[loser]} was ahead: had it gone the distance, they win ${pct(dtw[`p_${loser}`])} of replays.` }
      : { tone: 'good', icon: CheckCircle2, title: 'Ahead when it ended',
        text: `${names[side]} was already winning it: ${pct(won)} of replays to the distance.` }
  }
  if (won < 0.3) {
    return { tone: 'bad', icon: AlertTriangle, title: 'Robbery watch',
      text: `${names[side]} got the decision but wins only ${pct(won)} of replays. ${names[loser]} wins ${pct(dtw[`p_${loser}`])}.` }
  }
  if (won < 0.5) {
    return { tone: 'amber', icon: Scale, title: 'Debatable decision',
      text: `${names[side]} got it, but wins only ${pct(won)} of replays — closer to a coin flip than the cards suggest.` }
  }
  return { tone: 'good', icon: CheckCircle2, title: 'Deserved',
    text: `${names[side]} wins ${pct(won)} of replays.` }
}

const TONES = {
  good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  neutral: 'border-border bg-muted/40 text-foreground',
}

// One row per scheduled round: the chance a judge gives it to red, as a bar growing
// from the centre toward whoever took it. Rounds that were never fought (a finish)
// are drawn faint and labelled projected.
function RoundStrip({ rounds, observed, partialSeconds, names }) {
  return (
    <div className="grid gap-1">
      {rounds.map((p, i) => {
        const n = i + 1
        const projected = n > observed
        const partial = n === observed && partialSeconds != null
        const lead = p >= 0.5 ? 'red' : 'blue'
        const lean = Math.abs(p - 0.5) * 2
        return (
          <Tip
            key={n}
            content={(
              <span className="text-[11px]">
                Round {n}{projected ? ' (never fought — projected from the fight\'s form)' : partial ? ` (${Math.floor(partialSeconds / 60)}:${String(partialSeconds % 60).padStart(2, '0')} fought)` : ''}:
                a judge gives it to <strong>{names[lead]}</strong> {pct(Math.max(p, 1 - p))} of the time.
              </span>
            )}
          >
            <div className={cn('grid grid-cols-[42px_1fr_1fr_44px] items-center gap-1.5', projected && 'opacity-45')}>
              <span className="text-[10px] font-bold text-muted-foreground">
                R{n}{projected ? '*' : ''}
              </span>
              <div className="flex h-3.5 justify-end rounded-l bg-muted/50">
                {lead === 'red' && <div className="h-full rounded-l" style={{ width: `${lean * 100}%`, background: CORNERS[0].css }} />}
              </div>
              <div className="flex h-3.5 rounded-r bg-muted/50">
                {lead === 'blue' && <div className="h-full rounded-r" style={{ width: `${lean * 100}%`, background: CORNERS[1].css }} />}
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

export default function DeserveToWin({ dtw, fight, side, finished }) {
  const names = { red: fight.red_fighter.last_name, blue: fight.blue_fighter.last_name }
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
        tip="The round model: the chance a judge scores each round for each corner, from that round's strikes, takedowns, control and knockdowns. Rounds marked * were never fought."
        note="who a judge gives each round to"
      >
        <RoundStrip
          rounds={dtw.round_p_red || []}
          observed={dtw.rounds_observed}
          partialSeconds={dtw.partial_round_seconds}
          names={names}
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

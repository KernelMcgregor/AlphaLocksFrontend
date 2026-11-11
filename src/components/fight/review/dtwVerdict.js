// Deserve-to-win verdict: what kind of result a fight was, from the official winner's
// share of replays. Shared by the fight page's meter and the Events page, so a fight
// gets the same label everywhere.
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react'

export const pct = (p, d = 0) => `${(p * 100).toFixed(d)}%`

// What kind of result this was, from the official winner's share of replays.
export function verdictFor(dtw, side, finished, names) {
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

export const DTW_TONES = {
  good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  neutral: 'border-border bg-muted/40 text-foreground',
}

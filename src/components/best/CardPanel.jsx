// Side panel for one card: a banner with the main event's fighters and the card's score,
// what made it (finishes, knockdowns, upsets, bonuses), its best bouts, and the way to
// the whole card on the Events page.
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import FighterImage from '../sports/FighterImage'
import { shortDate } from '../officials/lib'
import { cardStats, resultText } from './fight'
import { BonusMarks, Face } from './marks'

function Banner({ c }) {
  const main = c.fights.find((f) => f.card_position === 0) || c.fights[0]
  return (
    <div className="relative grid h-[132px] shrink-0 grid-cols-[minmax(0,1fr)_44%] overflow-hidden rounded-lg bg-ink text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_120%,rgba(210,10,10,0.45),transparent_60%)]" />
      <div className="relative z-10 flex min-w-0 flex-col justify-between p-3 pr-1">
        <div>
          <div className="font-display text-[18px] font-extrabold uppercase italic leading-[1.02] tracking-tight">{c.event_name}</div>
          <div className="mt-1 text-[11px] font-semibold tabular-nums text-white/60">{shortDate(c.date)} · {c.n_fights} fights</div>
        </div>
        <div className="flex items-end gap-2">
          <span className="font-display text-[40px] font-black italic leading-none tabular-nums">{Math.round(c.score)}</span>
          <span className="pb-1 text-[9.5px] font-bold uppercase tracking-wider text-white/60">Card score</span>
        </div>
      </div>
      <div className="relative flex gap-0.5 pt-2">
        {[['red', main.red], ['blue', main.blue]].map(([key, x]) => (
          <div key={key} className="relative min-w-0 flex-1">
            <FighterImage fighter={x} fit="contain" pose={key === 'blue' ? 'right' : undefined}
              className="absolute inset-0 flex items-end justify-center" imgClassName="h-full w-full object-contain object-bottom" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Why the card was good: finishes, knockdowns, upsets (winner a 40%-or-less underdog) and
// bonuses UFC gave.
function Stats({ c }) {
  const s = cardStats(c)
  const tiles = [
    { label: 'Finishes', value: `${s.finishes}/${s.total}` },
    { label: 'KDs', value: s.knockdowns },
    { label: 'Upsets', value: s.upsets },
    { label: 'Bonuses', value: s.bonuses },
  ]
  return (
    <div className="grid shrink-0 grid-cols-4 gap-1.5">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col items-center rounded-lg border border-border bg-muted/30 px-1 py-1.5">
          <span className="text-[17px] font-extrabold leading-none tabular-nums">{t.value}</span>
          <span className="mt-1 text-center text-[8.5px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">{t.label}</span>
        </div>
      ))}
    </div>
  )
}

function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}

// One of the card's best bouts: both fighters' full names (winner in bold), the score, and
// how it ended with any bonus it got.
function Bout({ f, i }) {
  const name = (x, key) => (
    <span className={cn('block truncate text-[12.5px] leading-tight', f.winner === key ? 'font-extrabold' : 'font-medium text-muted-foreground')}>{x.name}</span>
  )
  return (
    <Link to={`/ufc/fights/${f.fight_id}`} className="grid min-h-[40px] flex-1 grid-cols-[14px_60px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 hover:bg-muted/50">
      <span className="font-display text-[13px] font-extrabold italic tabular-nums text-muted-foreground/60">{i + 1}</span>
      <span className="flex gap-1">
        <Face fighter={f.red} className="h-7 w-7 ring-0" />
        <Face fighter={f.blue} className="h-7 w-7 ring-0" />
      </span>
      <span className="min-w-0">
        {name(f.red, 'red')}
        {name(f.blue, 'blue')}
      </span>
      <span className="flex flex-col items-end">
        <span className="text-[14px] font-extrabold leading-tight tabular-nums">{Math.round(f.pct)}</span>
        <span className="flex items-center gap-1 whitespace-nowrap text-[10px] text-muted-foreground">
          <BonusMarks f={f} />
          {resultText(f)}
        </span>
      </span>
    </Link>
  )
}

export default function CardPanel({ c, panelRef }) {
  if (!c) return null
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-card p-3">
      <Banner c={c} />
      <Stats c={c} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Label>Top fights</Label>
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          {c.fights.slice(0, 6).map((f, i) => <Bout key={f.fight_id} f={f} i={i} />)}
        </div>
      </div>
      <Link
        to={`/ufc/events?event=${c.event_id}`}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Whole card <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

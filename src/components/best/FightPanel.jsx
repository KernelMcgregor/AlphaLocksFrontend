// Side panel for one bout on the best-of tabs: both fighters on a dark stage with the
// excitement score, how it ended, its highlights, what the score is made of, and
// its numbers.
import { ArrowRight, Award, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { fightNumbers, resultText, whyExciting } from './fight'
import FightStage from './FightStage'
import { Chip } from './marks'

function Label({ children }) {
  return <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-foreground">{children}</div>
}

// What the score is made of: each part's share of what pushed it up (the shares add to
// 100%), as one stacked bar and a row per part. A part that pulled it down is marked so.
// The site's categorical palette (styles/index.css, --color-fam-*), one hue per part.
const PARTS = [
  { key: 'pace', label: 'Pace', color: 'var(--color-fam-1)' },
  { key: 'danger', label: 'Danger', color: 'var(--color-fam-2)' },
  { key: 'swings', label: 'Swings', color: 'var(--color-fam-3)' },
  { key: 'finish', label: 'Finish', color: 'var(--color-fam-4)' },
  { key: 'suspense', label: 'Suspense', color: 'var(--color-fam-5)' },
  { key: 'upset', label: 'Upset', color: 'var(--color-fam-6)' },
]

function Parts({ groups }) {
  const vals = PARTS.map((p) => ({ ...p, v: groups?.[p.key] ?? 0 }))
  const up = vals.reduce((a, p) => a + Math.max(0, p.v), 0)
  const share = (p) => (up > 0 && p.v > 0 ? p.v / up : 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {vals.filter((p) => share(p) > 0).map((p) => (
          <span key={p.key} className="h-full" style={{ width: `${share(p) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {vals.map((p) => (
          <div key={p.key} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.v > 0 ? p.color : 'var(--color-muted)' }} />
            <span className="font-semibold text-foreground/80">{p.label}</span>
            <span className={cn('ml-auto tabular-nums', p.v > 0 ? 'font-bold' : 'text-muted-foreground')}>
              {p.v > 0 ? `${Math.round(share(p) * 100)}%` : p.v < 0 ? 'held it back' : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Labels sit in a two-line box, centred, so one-line labels line up with two-line ones.
function Tile({ label, value }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-muted/30 px-1 py-1.5">
      <span className="text-[17px] font-extrabold leading-none tabular-nums">{value}</span>
      <span className="mt-1 flex h-[22px] items-center text-center text-[8.5px] font-bold uppercase leading-[11px] tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

export default function FightPanel({ f, panelRef }) {
  if (!f) return null
  const n = fightNumbers(f)
  const why = whyExciting(f)
  const award = 'inline-flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-gold-foreground'
  return (
    <div ref={panelRef} className="flex min-h-0 scroll-mt-3 flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-card p-3">
      <FightStage red={f.red} blue={f.blue} winner={f.winner} eventName={f.event_name} date={f.date}
        corner={(
          <>
            <div className="font-display text-[32px] font-black italic leading-none tabular-nums">{Math.round(f.pct)}</div>
            <div className="text-[8.5px] font-bold uppercase tracking-wider text-white/55">Excitement</div>
          </>
        )} />
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-extrabold">{resultText(f)}</span>
        {f.fotn && <span className={award}><Award className="h-3 w-3" />Fight of the Night</span>}
        {f.perf && <span className={award}><Zap className="h-3 w-3" />Performance</span>}
      </div>
      {why.length > 0 && (
        <div className="shrink-0">
          <Label>Highlights</Label>
          {/* Two rows at most; anything past them is left off. */}
          <div className="mt-1 flex max-h-[52px] flex-wrap gap-1 overflow-hidden">
            {why.map((w) => <Chip key={w} text={w} />)}
          </div>
        </div>
      )}
      <div className="shrink-0">
        <Label>What made the score</Label>
        <div className="mt-1.5"><Parts groups={f.groups} /></div>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-1.5">
        <Tile label="Strikes / min" value={n.pace.toFixed(1)} />
        <Tile label="KDs" value={n.kd} />
        <Tile label="Sub att." value={n.subs} />
        <Tile label="Lead changes" value={n.leadChanges} />
      </div>
      <Link
        to={`/ufc/fights/${f.fight_id}`}
        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        Full fight <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

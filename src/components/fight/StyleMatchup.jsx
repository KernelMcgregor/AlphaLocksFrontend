// Styles section of the fight pages: each corner's style family and blend with what they
// do most and least, and between them the habits where the two differ most and where
// they are most alike. From /ufc/styles/fighters/{id} for each corner (useStyleDetail).
import { Link } from 'react-router-dom'
import { BlendBar, HabitChips, SectionLabel } from '../styles/shared'
import { MirrorRow } from '../styles/ExplorerView'
import { blendOf, famColor, familyName, HABIT_TRAITS, mostAlike, mostDifferent } from '../../lib/styleTraits'
import { cn } from '../../lib/utils'
import { CORNERS } from './corners'

const COLORS = [CORNERS[0].css, CORNERS[1].css]

function Side({ detail, fighter, corner, right }) {
  const card = cn('flex flex-col gap-3 rounded-xl border border-border p-3', right && 'text-right')
  if (!detail) {
    return (
      <div className={card}>
        <div className="text-[13px] font-extrabold" style={{ color: corner.css }}>{fighter.last_name}</div>
        <p className="text-[12px] text-muted-foreground">Not enough UFC rounds for a style profile.</p>
      </div>
    )
  }
  const { fighter: style, families } = detail
  const fam = families?.[blendOf(style)[0].family]
  const habits = HABIT_TRAITS.map((k) => [k, style.profile[k]]).filter(([, v]) => v != null)
  const high = [...habits].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const low = [...habits].sort((a, b) => a[1] - b[1]).slice(0, 3)
  return (
    <div className={card}>
      <div>
        <Link to={`/ufc/fighters/${fighter.id}`} className="text-[13px] font-extrabold hover:underline" style={{ color: corner.css }}>
          {fighter.last_name}
        </Link>
        {fam && (
          <div className={cn('mt-0.5 flex items-center gap-2', right && 'flex-row-reverse')}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: famColor(fam.id) }} />
            <span className="font-display text-[20px] font-extrabold italic uppercase leading-none tracking-tight">{familyName(fam.name)}</span>
          </div>
        )}
      </div>
      <BlendBar fighter={style} families={families} singular className={cn(right && '[&>div:last-child]:justify-end')} />
      <HabitChips label="Does most" cls="text-emerald-600" items={high} right={right} />
      <HabitChips label="Does least" cls="text-rose-600" items={low} right={right} />
    </div>
  )
}

export default function StyleMatchup({ red, blue, styles }) {
  const a = styles.red?.fighter
  const b = styles.blue?.fighter
  const both = a && b
  if (!both) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Side detail={styles.red} fighter={red} corner={CORNERS[0]} />
        <Side detail={styles.blue} fighter={blue} corner={CORNERS[1]} right />
      </div>
    )
  }
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
      <Side detail={styles.red} fighter={red} corner={CORNERS[0]} />
      <div className="space-y-3 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span style={{ color: COLORS[0] }}>{red.last_name}</span>
          <span style={{ color: COLORS[1] }}>{blue.last_name}</span>
        </div>
        <div>
          <SectionLabel className="mb-1.5 text-center">Biggest differences</SectionLabel>
          <div className="space-y-1">{mostDifferent(a.profile, b.profile).map((t) => <MirrorRow key={t.k} t={t} colors={COLORS} />)}</div>
        </div>
        <div>
          <SectionLabel className="mb-1.5 text-center">Most alike</SectionLabel>
          <div className="space-y-1">{mostAlike(a.profile, b.profile).map((t) => <MirrorRow key={t.k} t={t} colors={COLORS} />)}</div>
        </div>
      </div>
      <Side detail={styles.blue} fighter={blue} corner={CORNERS[1]} right />
    </div>
  )
}

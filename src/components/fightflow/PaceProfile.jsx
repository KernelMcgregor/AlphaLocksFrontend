// Pace profile for the completed-fight page: each corner's significant strikes per
// minute by round, this bout or their career through it, against the division's rate
// for the same round (the tick). The chip is the career read: a fader drops off the
// division's curve after R1, a closer climbs above it (services/ufc/fightflow_pace).
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getFightPace } from '../../lib/fightflowApi'
import { Box, CornerColumns } from '../fight/layout'
import { cornerOf } from '../fight/corners'
import { SlideTabs } from '../ui/slide-tabs'
import { Tip } from '../ui/tip'
import { PaceColumns } from '../viz/RoundPacing'

// Same panel as RoundPacing's first.
const SLPM = { key: 'slpm', label: 'Sig. Str / Min', fmt: (v) => v.toFixed(1) }

const LABELS = {
  fader: { text: 'Fader', icon: TrendingDown },
  closer: { text: 'Closer', icon: TrendingUp },
  steady: { text: 'Steady', icon: Minus },
}

function PaceChip({ career }) {
  const l = LABELS[career?.label]
  if (!l) return null
  const shift = Math.round((Math.exp(career.shift) - 1) * 100)
  const Icon = l.icon
  return (
    <Tip content={(
      <span className="text-[11px]">
        Rounds 2+ vs round 1, both against the division: <strong>{shift > 0 ? '+' : ''}{shift}%</strong>
        {' '}· {career.fights} UFC bouts
      </span>
    )}>
      <span className="flex cursor-help items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-px text-[10px] font-black uppercase tracking-wide">
        <Icon className="h-3 w-3" />{l.text}
      </span>
    </Tip>
  )
}

export default function PaceProfile({ fight }) {
  const [loaded, setLoaded] = useState(null)
  const [mode, setMode] = useState('fight')

  useEffect(() => {
    let live = true
    getFightPace(fight.id).then((p) => { if (live) setLoaded({ id: fight.id, pace: p }) })
    return () => { live = false }
  }, [fight.id])

  // A response for the fight we navigated away from is not this fight's.
  const pace = loaded?.id === fight.id ? loaded.pace : null
  if (!pace?.red || !pace?.blue) return null

  const rows = (side) => (mode === 'fight'
    // A sliver of a finishing round is drawn faint, like a thin career round.
    ? pace[side].fight.map((r) => ({ round: r.round, slpm: r.slpm, norm: r.norm, n: r.minutes >= 1.5 ? 3 : 1 }))
    : pace[side].career.rounds.map((r) => ({ round: r.round, slpm: r.slpm, norm: r.norm, n: r.n })))

  return (
    <Box
      title="Pace by round"
      note="sig. strikes per minute · tick = division"
      right={(
        <SlideTabs
          size="sm"
          value={mode}
          onChange={setMode}
          tabs={[{ key: 'fight', label: 'This fight' }, { key: 'career', label: 'Career' }]}
        />
      )}
    >
      <CornerColumns
        red={fight.red_fighter}
        blue={fight.blue_fighter}
        aside={(side) => <PaceChip career={pace[side].career} />}
      >
        {(side) => (rows(side).length
          ? <PaceColumns rounds={rows(side)} panel={SLPM} accent={cornerOf(side).bar} normLabel="division" />
          : <p className="py-6 text-center text-[11.5px] text-muted-foreground">No round stats</p>)}
      </CornerColumns>
    </Box>
  )
}

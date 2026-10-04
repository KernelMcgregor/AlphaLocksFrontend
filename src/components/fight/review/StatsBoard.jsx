// The fight's own numbers: a red-vs-blue board for the whole fight or any round, the
// advanced per-fighter read computed from both corners' rows, and where the strikes
// landed. Same marks as the upcoming page's comparison, fed this fight instead of
// careers.
import { useMemo, useState } from 'react'
import { advancedStats } from '../../../lib/fightReview'
import { clock } from '../../../lib/fightProjection'
import { cn } from '../../../lib/utils'
import { SlideTabs } from '../../ui/slide-tabs'
import MirrorBars from '../../viz/MirrorBars'
import StatTile from '../../viz/StatTile'
import { CORNERS } from '../corners'
import { Box, CornerColumns, CornerLegend, Empty } from '../layout'

// landed/attempted pairs show both and an accuracy; counts and clocks show one number.
const BOARD = [
  { label: 'Sig. strikes', l: 'sig_str_landed', a: 'sig_str_attempted' },
  { label: 'Total strikes', l: 'total_str_landed', a: 'total_str_attempted' },
  { label: 'Knockdowns', l: 'kd' },
  { label: 'Takedowns', l: 'td_landed', a: 'td_attempted' },
  { label: 'Sub attempts', l: 'sub_att' },
  { label: 'Reversals', l: 'rev' },
  { label: 'Control', l: 'ctrl_seconds', fmt: clock },
  { label: 'Head', l: 'head_landed', a: 'head_attempted', group: 'Target' },
  { label: 'Body', l: 'body_landed', a: 'body_attempted', group: 'Target' },
  { label: 'Leg', l: 'leg_landed', a: 'leg_attempted', group: 'Target' },
  { label: 'Distance', l: 'distance_landed', a: 'distance_attempted', group: 'Position' },
  { label: 'Clinch', l: 'clinch_landed', a: 'clinch_attempted', group: 'Position' },
  { label: 'Ground', l: 'ground_landed', a: 'ground_attempted', group: 'Position' },
]

function BoardRow({ row, red, blue }) {
  const r = red[row.l] ?? 0
  const b = blue[row.l] ?? 0
  const max = Math.max(r, b, 1)
  const text = (me) => {
    const v = row.fmt ? row.fmt(me[row.l]) : me[row.l]
    if (!row.a) return v
    const att = me[row.a]
    return `${v}/${att}`
  }
  const acc = (me) => (row.a && me[row.a] ? `${Math.round((me[row.l] / me[row.a]) * 100)}%` : null)
  return (
    <div className="grid grid-cols-[1fr_96px_1fr] items-center gap-2 py-[3px]">
      <div className="flex items-center justify-end gap-2">
        <span className="text-[10px] tabular-nums text-muted-foreground">{acc(red)}</span>
        <span className={cn('text-[11.5px] tabular-nums', r > b ? 'font-extrabold' : 'font-semibold text-foreground/70')}>{text(red)}</span>
        <div className="flex h-2 w-[38%] justify-end rounded-l-full bg-muted/50">
          <div className="h-full rounded-l-full" style={{ width: `${(r / max) * 100}%`, background: CORNERS[0].css, opacity: r >= b ? 1 : 0.45 }} />
        </div>
      </div>
      <span className="text-center text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">{row.label}</span>
      <div className="flex items-center gap-2">
        <div className="flex h-2 w-[38%] rounded-r-full bg-muted/50">
          <div className="h-full rounded-r-full" style={{ width: `${(b / max) * 100}%`, background: CORNERS[1].css, opacity: b >= r ? 1 : 0.45 }} />
        </div>
        <span className={cn('text-[11.5px] tabular-nums', b > r ? 'font-extrabold' : 'font-semibold text-foreground/70')}>{text(blue)}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{acc(blue)}</span>
      </div>
    </div>
  )
}

const f2 = (v) => (v == null ? '—' : v.toFixed(2))
const p0 = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const signed = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`)

export default function StatsBoard({ fight, total, rounds }) {
  const [view, setView] = useState('total')
  const red = fight.red_fighter
  const blue = fight.blue_fighter
  const adv = useMemo(() => advancedStats(total, fight.fight_time_seconds), [total, fight.fight_time_seconds])

  // Where the strikes landed, this fight: share of each corner's landed sig. strikes,
  // and the per-minute rate, in MirrorBars' row shape.
  const split = useMemo(() => {
    if (!total) return null
    const mins = fight.fight_time_seconds ? fight.fight_time_seconds / 60 : null
    const rows = (keys) => keys.map(([label, col]) => {
      const r = total.red[col] || 0
      const b = total.blue[col] || 0
      return {
        label,
        self: total.red.sig_str_landed ? (r / total.red.sig_str_landed) * 100 : null,
        opp: total.blue.sig_str_landed ? (b / total.blue.sig_str_landed) * 100 : null,
        selfPm: mins ? r / mins : null,
        oppPm: mins ? b / mins : null,
      }
    })
    return {
      target: rows([['Head', 'head_landed'], ['Body', 'body_landed'], ['Leg', 'leg_landed']]),
      position: rows([['Distance', 'distance_landed'], ['Clinch', 'clinch_landed'], ['Ground', 'ground_landed']]),
    }
  }, [total, fight.fight_time_seconds])
  const [strikeMode, setStrikeMode] = useState('pct')

  if (!total) return <Box title="Fight stats"><Empty>No stats recorded for this bout.</Empty></Box>

  const shown = view === 'total' ? total : rounds.find((r) => `r${r.round}` === view) || total
  const tabs = [{ key: 'total', label: 'Total' }, ...rounds.map((r) => ({ key: `r${r.round}`, label: `R${r.round}` }))]

  return (
    <div className="grid gap-3">
      <Box
        title="Fight stats"
        right={tabs.length > 2 ? <SlideTabs size="sm" value={view} onChange={setView} tabs={tabs} /> : <CornerLegend red={red} blue={blue} />}
      >
        <div className="mb-1 grid grid-cols-[1fr_96px_1fr] gap-2 border-b pb-1 text-[10px] font-extrabold">
          <span className="flex items-center justify-end gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CORNERS[0].css }} />{red.last_name}</span>
          <span />
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CORNERS[1].css }} />{blue.last_name}</span>
        </div>
        {BOARD.map((row, i) => {
          const header = row.group && row.group !== BOARD[i - 1]?.group
          return (
            <div key={row.label}>
              {header && (
                <div className="mt-1.5 border-t border-border/60 pt-1 text-center text-[9px] font-bold uppercase tracking-wide text-foreground/60">
                  Sig. strikes by {row.group.toLowerCase()}
                </div>
              )}
              <BoardRow row={row} red={shown.red} blue={shown.blue} />
            </div>
          )
        })}
      </Box>

      {adv && (
        <CornerColumns red={red} blue={blue}>
          {(side) => {
            const a = adv[side]
            return (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                <StatTile label="Sig. str / min" value={f2(a.sigPerMin)} />
                <StatTile label="Diff / min" value={signed(a.sigDiffPerMin)} />
                <StatTile label="Share of sig. str" value={p0(a.sigShare)} />
                <StatTile label="Landed per absorbed" value={f2(a.damageRatio)} />
                <StatTile label="Sig. accuracy" value={p0(a.sigAcc)} />
                <StatTile label="Sig. defence" value={p0(a.sigDef)} />
                <StatTile label="TD accuracy" value={p0(a.tdAcc)} />
                <StatTile label="TD defence" value={p0(a.tdDef)} />
                <StatTile label="Control share" value={p0(a.ctrlShare)} />
                <StatTile label="Head-hunting" value={p0(a.headShare)} />
              </div>
            )
          }}
        </CornerColumns>
      )}

      {split && (
        <Box
          title="Where the strikes landed"
          right={<SlideTabs size="sm" value={strikeMode} onChange={setStrikeMode} tabs={[{ key: 'pct', label: 'Share' }, { key: 'pm', label: 'Per min' }]} />}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <MirrorBars title="Target" rows={split.target} mode={strikeMode}
              leftLabel={red.last_name} rightLabel={blue.last_name} leftClass={CORNERS[0].bar} rightClass={CORNERS[1].bar} />
            <MirrorBars title="Position" rows={split.position} mode={strikeMode}
              leftLabel={red.last_name} rightLabel={blue.last_name} leftClass={CORNERS[0].bar} rightClass={CORNERS[1].bar} />
          </div>
        </Box>
      )}
    </div>
  )
}

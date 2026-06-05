import { ChevronDown, ChevronUp, Swords, Trophy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import CountryFlag from '../CountryFlag'
import WeightClassBadge from '../WeightClassBadge'
import MethodPrediction from './MethodPrediction'
import { Progress } from '../ui/progress'
import { Separator } from '../ui/separator'

function ConfidenceMeter({ confidence }) {
  // confidence: 0-100, pick: 'red' | 'blue'
  const level =
    confidence >= 40 ? 'extreme' :
    confidence >= 30 ? 'very-high' :
    confidence >= 25 ? 'high' :
    confidence >= 15 ? 'moderate' :
    'low'

  const colors = {
    extreme:   { bar: 'bg-emerald-500', text: 'text-emerald-500', label: 'Extreme' },
    'very-high': { bar: 'bg-emerald-400', text: 'text-emerald-400', label: 'Very High' },
    high:      { bar: 'bg-blue-500',    text: 'text-blue-500',    label: 'High' },
    moderate:  { bar: 'bg-amber-500',   text: 'text-amber-500',   label: 'Moderate' },
    low:       { bar: 'bg-zinc-400',    text: 'text-zinc-400',    label: 'Low' },
  }

  const c = colors[level]

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn('text-xs font-semibold uppercase tracking-wider', c.text)}>
        {c.label} confidence
      </span>
      <div className="flex items-center gap-2 w-full max-w-[200px]">
        <Progress
          value={confidence}
          max={50}
          className="h-2.5"
          indicatorClassName={c.bar}
        />
        <span className={cn('text-sm font-bold tabular-nums', c.text)}>
          {confidence}%
        </span>
      </div>
    </div>
  )
}

function FighterSide({ fighter, corner, isWinner, isPick, stats }) {
  const cornerColor = corner === 'red'
    ? 'border-red-500/50 bg-red-500/5'
    : 'border-blue-500/50 bg-blue-500/5'
  const cornerLabel = corner === 'red'
    ? 'text-red-500 bg-red-500/10'
    : 'text-blue-500 bg-blue-500/10'

  return (
    <div className={cn(
      'flex-1 rounded-lg border p-4 transition-all',
      cornerColor,
      isPick && 'ring-2 ring-primary/40 shadow-sm',
    )}>
      <div className="flex items-start justify-between mb-2">
        <span className={cn('text-[10px] font-bold uppercase rounded px-1.5 py-0.5', cornerLabel)}>
          {corner}
        </span>
        <div className="flex gap-1">
          {isWinner && (
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
              <Trophy className="h-3 w-3 mr-0.5" /> W
            </Badge>
          )}
          {isPick && !isWinner && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
              Pick
            </Badge>
          )}
        </div>
      </div>

      <div className="mb-1">
        <h3 className="text-base font-bold leading-tight flex items-center gap-1.5">
          <CountryFlag countryCode={fighter.country_code} />
          {fighter.first_name} {fighter.last_name}
        </h3>
        {fighter.nickname && (
          <p className="text-xs text-muted-foreground">"{fighter.nickname}"</p>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <span className="font-semibold text-foreground">{fighter.wins}-{fighter.losses}{fighter.draws > 0 ? `-${fighter.draws}` : ''}</span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {fighter.height && fighter.height !== '--' && <span>{fighter.height}</span>}
          {fighter.reach && fighter.reach !== '--' && <span>{fighter.reach}" reach</span>}
          {fighter.stance && fighter.stance !== '--' && <span>{fighter.stance}</span>}
        </div>
      </div>

      {stats && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <StatBox label="Sig Str" value={stats.sig_str_landed} sub={`of ${stats.sig_str_attempted}`} />
          <StatBox label="TD" value={stats.td_landed} sub={`of ${stats.td_attempted}`} />
          <StatBox label="KD" value={stats.kd} />
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, sub }) {
  return (
    <div className="rounded bg-background/60 p-1.5">
      <div className="text-sm font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function FightStatsDetail({ stats }) {
  const red = stats?.find(s => s.corner === 'red' && s.round_number === 0)
  const blue = stats?.find(s => s.corner === 'blue' && s.round_number === 0)
  if (!red || !blue) return null

  const rows = [
    { label: 'Sig. Strikes', rVal: `${red.sig_str_landed}/${red.sig_str_attempted}`, bVal: `${blue.sig_str_landed}/${blue.sig_str_attempted}`, rPct: red.sig_str_attempted > 0 ? red.sig_str_landed / red.sig_str_attempted : 0, bPct: blue.sig_str_attempted > 0 ? blue.sig_str_landed / blue.sig_str_attempted : 0 },
    { label: 'Total Strikes', rVal: `${red.total_str_landed}/${red.total_str_attempted}`, bVal: `${blue.total_str_landed}/${blue.total_str_attempted}` },
    { label: 'Takedowns', rVal: `${red.td_landed}/${red.td_attempted}`, bVal: `${blue.td_landed}/${blue.td_attempted}` },
    { label: 'Sub. Attempts', rVal: red.sub_att, bVal: blue.sub_att },
    { label: 'Knockdowns', rVal: red.kd, bVal: blue.kd },
    { label: 'Control', rVal: formatCtrl(red.ctrl_seconds), bVal: formatCtrl(blue.ctrl_seconds) },
    { label: 'Head', rVal: `${red.head_landed}/${red.head_attempted}`, bVal: `${blue.head_landed}/${blue.head_attempted}` },
    { label: 'Body', rVal: `${red.body_landed}/${red.body_attempted}`, bVal: `${blue.body_landed}/${blue.body_attempted}` },
    { label: 'Leg', rVal: `${red.leg_landed}/${red.leg_attempted}`, bVal: `${blue.leg_landed}/${blue.leg_attempted}` },
  ]

  return (
    <div className="mt-3 space-y-1">
      <Separator className="my-2" />
      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Fight Stats</h4>
      {rows.map(row => (
        <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
          <div className="text-right font-mono tabular-nums">{row.rVal}</div>
          <div className="text-center text-muted-foreground w-24 truncate">{row.label}</div>
          <div className="text-left font-mono tabular-nums">{row.bVal}</div>
        </div>
      ))}
    </div>
  )
}

function formatCtrl(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function FightCard({ fight, prediction, methodPrediction }) {
  const [expanded, setExpanded] = useState(false)

  const { red_fighter, blue_fighter, winner, stats } = fight
  const redStats = stats?.find(s => s.corner === 'red' && s.round_number === 0)
  const blueStats = stats?.find(s => s.corner === 'blue' && s.round_number === 0)

  // Prediction data
  const confidence = prediction?.confidence // 0-50 scale
  const pickCorner = prediction?.pick // 'red' | 'blue'
  const isCompleted = !!winner
  const winnerId = String(winner?.id || '')
  const redId = String(red_fighter?.id || '')
  const blueId = String(blue_fighter?.id || '')

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Weight class + method header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {fight.weight_class && (
              <WeightClassBadge weightClass={fight.weight_class} />
            )}
            {isCompleted && fight.method && (
              <Badge variant="secondary" className="text-[10px]">
                {fight.method.trim()} {fight.finish_round ? `R${fight.finish_round}` : ''}
                {fight.finish_time ? ` ${fight.finish_time}` : ''}
              </Badge>
            )}
          </div>

          {/* Confidence meter */}
          {confidence != null && confidence > 0 && (
            <ConfidenceMeter confidence={confidence} pick={pickCorner} />
          )}
        </div>

        {/* Fighters */}
        <div className="flex gap-3">
          <FighterSide
            fighter={red_fighter}
            corner="red"
            isWinner={isCompleted && winnerId === redId}
            isPick={pickCorner === 'red'}
            stats={expanded ? null : redStats}
          />
          <div className="flex flex-col items-center justify-center px-1">
            <Swords className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground mt-1">VS</span>
          </div>
          <FighterSide
            fighter={blue_fighter}
            corner="blue"
            isWinner={isCompleted && winnerId === blueId}
            isPick={pickCorner === 'blue'}
            stats={expanded ? null : blueStats}
          />
        </div>

        {/* Method prediction */}
        {methodPrediction && <MethodPrediction methodPrediction={methodPrediction} />}

        {/* Expandable stats */}
        {stats && stats.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
            {expanded && (
              <FightStatsDetail stats={stats} />
            )}
          </>
        )}

        {/* Fight details line */}
        {fight.details && expanded && (
          <p className="mt-2 text-xs text-muted-foreground italic">{fight.details.trim()}</p>
        )}
        {fight.referee && expanded && (
          <p className="mt-1 text-xs text-muted-foreground">Referee: {fight.referee.trim()}</p>
        )}
      </CardContent>
    </Card>
  )
}

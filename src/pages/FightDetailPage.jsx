import { ArrowLeft, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import CountryFlag from '../components/CountryFlag'
import WeightClassBadge from '../components/WeightClassBadge'
import { fetchFight } from '../lib/api'
import { cn } from '../lib/utils'

function formatCtrl(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function StatRow({ label, redVal, blueVal }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-1.5">
      <div className="text-right font-mono text-sm tabular-nums">{redVal}</div>
      <div className="text-center text-xs text-muted-foreground w-28">{label}</div>
      <div className="text-left font-mono text-sm tabular-nums">{blueVal}</div>
    </div>
  )
}

function FighterHeader({ fighter, corner, isWinner }) {
  const dotColor = corner === 'red' ? 'bg-red-500' : 'bg-blue-500'

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
        <CountryFlag countryCode={fighter.country_code} />
        <h2 className={cn('text-lg font-bold', isWinner && 'text-emerald-500')}>
          {fighter.first_name} {fighter.last_name}
        </h2>
        {isWinner && <Trophy className="h-4 w-4 text-emerald-500" />}
      </div>
      {fighter.nickname && (
        <p className="text-sm text-muted-foreground ml-[18px]">"{fighter.nickname}"</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 ml-[18px] text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {fighter.wins}-{fighter.losses}{fighter.draws > 0 ? `-${fighter.draws}` : ''}
        </span>
        {fighter.height && fighter.height !== '--' && <span>{fighter.height}</span>}
        {fighter.reach && fighter.reach !== '--' && <span>{fighter.reach}" reach</span>}
        {fighter.stance && fighter.stance !== '--' && <span>{fighter.stance}</span>}
      </div>
    </div>
  )
}

export default function FightDetailPage() {
  const { id } = useParams()
  const [fight, setFight] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchFight(id)
      .then(setFight)
      .catch(() => setFight(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!fight) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Fight not found.</p>
        <Link to="/ufc" className="text-sm text-primary hover:underline">Back to events</Link>
      </div>
    )
  }

  const { red_fighter, blue_fighter, winner, stats } = fight
  const winnerId = String(winner?.id || '')
  const redWon = winnerId === String(red_fighter?.id || '')
  const blueWon = winnerId === String(blue_fighter?.id || '')

  const red = stats?.find(s => s.corner === 'red' && s.round_number === 0)
  const blue = stats?.find(s => s.corner === 'blue' && s.round_number === 0)

  const statRows = red && blue ? [
    { label: 'Sig. Strikes', redVal: `${red.sig_str_landed}/${red.sig_str_attempted}`, blueVal: `${blue.sig_str_landed}/${blue.sig_str_attempted}` },
    { label: 'Total Strikes', redVal: `${red.total_str_landed}/${red.total_str_attempted}`, blueVal: `${blue.total_str_landed}/${blue.total_str_attempted}` },
    { label: 'Takedowns', redVal: `${red.td_landed}/${red.td_attempted}`, blueVal: `${blue.td_landed}/${blue.td_attempted}` },
    { label: 'Sub. Attempts', redVal: red.sub_att, blueVal: blue.sub_att },
    { label: 'Knockdowns', redVal: red.kd, blueVal: blue.kd },
    { label: 'Control', redVal: formatCtrl(red.ctrl_seconds), blueVal: formatCtrl(blue.ctrl_seconds) },
    { label: 'Head', redVal: `${red.head_landed}/${red.head_attempted}`, blueVal: `${blue.head_landed}/${blue.head_attempted}` },
    { label: 'Body', redVal: `${red.body_landed}/${red.body_attempted}`, blueVal: `${blue.body_landed}/${blue.body_attempted}` },
    { label: 'Leg', redVal: `${red.leg_landed}/${red.leg_attempted}`, blueVal: `${blue.leg_landed}/${blue.leg_attempted}` },
  ] : []

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link to="/ufc" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      {/* Fight header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            {fight.weight_class && (
              <WeightClassBadge weightClass={fight.weight_class} />
            )}
            {winner && fight.method && (
              <Badge variant="secondary" className="text-xs">
                {fight.method.trim()} {fight.finish_round ? `R${fight.finish_round}` : ''}
                {fight.finish_time ? ` ${fight.finish_time}` : ''}
              </Badge>
            )}
          </div>

          <div className="flex gap-6">
            <FighterHeader fighter={red_fighter} corner="red" isWinner={redWon} />
            <FighterHeader fighter={blue_fighter} corner="blue" isWinner={blueWon} />
          </div>
        </CardContent>
      </Card>

      {/* Fight stats */}
      {statRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fight Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center pb-2 mb-1 border-b border-border">
              <div className="text-right text-xs font-semibold text-red-500 uppercase">Red</div>
              <div className="w-28" />
              <div className="text-left text-xs font-semibold text-blue-500 uppercase">Blue</div>
            </div>
            {statRows.map(row => (
              <StatRow key={row.label} {...row} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fight details */}
      {(fight.details || fight.referee) && (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground space-y-1">
            {fight.details && <p>{fight.details.trim()}</p>}
            {fight.referee && <p>Referee: {fight.referee.trim()}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

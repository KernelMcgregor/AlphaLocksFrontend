import { ArrowLeft, Brain, ChevronDown, ChevronRight, Eye, Info, TrendingUp, Trophy, X, Zap } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { useMemo, useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table'
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

function formatOdds(odds) {
  if (odds == null) return '—'
  return odds > 0 ? `+${odds}` : `${odds}`
}

function buildStatRows(red, blue) {
  return [
    { stat: 'Sig. Strikes', red: `${red.sig_str_landed}/${red.sig_str_attempted}`, blue: `${blue.sig_str_landed}/${blue.sig_str_attempted}` },
    { stat: 'Total Strikes', red: `${red.total_str_landed}/${red.total_str_attempted}`, blue: `${blue.total_str_landed}/${blue.total_str_attempted}` },
    { stat: 'Takedowns', red: `${red.td_landed}/${red.td_attempted}`, blue: `${blue.td_landed}/${blue.td_attempted}` },
    { stat: 'Sub. Attempts', red: red.sub_att, blue: blue.sub_att },
    { stat: 'Knockdowns', red: red.kd, blue: blue.kd },
    { stat: 'Control', red: formatCtrl(red.ctrl_seconds), blue: formatCtrl(blue.ctrl_seconds) },
    { stat: 'Head', red: `${red.head_landed}/${red.head_attempted}`, blue: `${blue.head_landed}/${blue.head_attempted}` },
    { stat: 'Body', red: `${red.body_landed}/${red.body_attempted}`, blue: `${blue.body_landed}/${blue.body_attempted}` },
    { stat: 'Leg', red: `${red.leg_landed}/${red.leg_attempted}`, blue: `${blue.leg_landed}/${blue.leg_attempted}` },
    { stat: 'Distance', red: `${red.distance_landed}/${red.distance_attempted}`, blue: `${blue.distance_landed}/${blue.distance_attempted}` },
    { stat: 'Clinch', red: `${red.clinch_landed}/${red.clinch_attempted}`, blue: `${blue.clinch_landed}/${blue.clinch_attempted}` },
    { stat: 'Ground', red: `${red.ground_landed}/${red.ground_attempted}`, blue: `${blue.ground_landed}/${blue.ground_attempted}` },
  ]
}

function FighterHeader({ fighter, corner, isWinner }) {
  const dotColor = corner === 'red' ? 'bg-red-500' : 'bg-blue-500'
  return (
    <div className="flex-1 flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
      {fighter.image_url && (
        <img
          src={fighter.image_url}
          alt={`${fighter.first_name} ${fighter.last_name}`}
          className="h-28 sm:h-40 object-contain object-bottom shrink-0 sm:translate-y-5 sm:order-last"
        />
      )}
      <div className="min-w-0 flex-1 py-2 sm:py-4">
        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
          <span className={cn('h-3 w-3 rounded-full shrink-0', dotColor)} />
          <CountryFlag countryCode={fighter.country_code} />
          <h2 className={cn('text-lg sm:text-2xl font-bold truncate', isWinner && 'text-emerald-500')}>
            {fighter.first_name} {fighter.last_name}
          </h2>
          {isWinner && <Trophy className="h-5 w-5 text-emerald-500 shrink-0" />}
        </div>
        {fighter.nickname && (
          <p className="text-sm text-muted-foreground sm:ml-[22px]">"{fighter.nickname}"</p>
        )}
        <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-1 sm:ml-[22px] text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {fighter.wins}-{fighter.losses}{fighter.draws > 0 ? `-${fighter.draws}` : ''}
          </span>
          {fighter.height && fighter.height !== '--' && <span>{fighter.height}</span>}
          {fighter.reach && fighter.reach !== '--' && <span>{fighter.reach}" reach</span>}
          {fighter.stance && fighter.stance !== '--' && <span>{fighter.stance}</span>}
        </div>
      </div>
    </div>
  )
}

function StatsTable({ stats, red_fighter, blue_fighter }) {
  const rounds = useMemo(() => [...new Set(stats.map(s => s.round_number))].filter(r => r > 0).sort((a, b) => a - b), [stats])
  const totalRed = useMemo(() => stats.find(s => s.corner === 'red' && s.round_number === 0), [stats])
  const totalBlue = useMemo(() => stats.find(s => s.corner === 'blue' && s.round_number === 0), [stats])

  if (!totalRed || !totalBlue) return null

  const totalRows = useMemo(() => buildStatRows(totalRed, totalBlue).map((r, i) => ({
    ...r,
    id: `total-${i}`,
    subRows: rounds.map(rnd => {
      const rr = stats.find(s => s.corner === 'red' && s.round_number === rnd)
      const rb = stats.find(s => s.corner === 'blue' && s.round_number === rnd)
      if (!rr || !rb) return null
      const roundRows = buildStatRows(rr, rb)
      return { stat: `R${rnd}`, red: roundRows[i].red, blue: roundRows[i].blue, id: `r${rnd}-${i}`, subRows: [] }
    }).filter(Boolean),
  })), [stats, rounds, totalRed, totalBlue])

  const columns = useMemo(() => [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => row.getCanExpand() ? (
        <button onClick={row.getToggleExpandedHandler()} className="p-0.5 hover:bg-muted rounded">
          {row.getIsExpanded() ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : null,
      size: 32,
    },
    {
      accessorKey: 'stat',
      header: 'Stat',
      cell: ({ row, getValue }) => (
        <span className={cn('text-xs', row.depth > 0 ? 'text-muted-foreground pl-2' : 'font-medium')}>
          {getValue()}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: 'red',
      header: () => <span className="text-red-500">{red_fighter.last_name}</span>,
      cell: ({ getValue }) => <span className="font-mono text-sm tabular-nums">{getValue()}</span>,
      size: 100,
      meta: { align: 'center' },
    },
    {
      accessorKey: 'blue',
      header: () => <span className="text-blue-500">{blue_fighter.last_name}</span>,
      cell: ({ getValue }) => <span className="font-mono text-sm tabular-nums">{getValue()}</span>,
      size: 100,
      meta: { align: 'center' },
    },
  ], [red_fighter, blue_fighter])

  const [expanded, setExpanded] = useState({})

  const table = useReactTable({
    data: totalRows,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: row => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: row => row.id,
    getRowCanExpand: row => Boolean(row.original.subRows && row.original.subRows.length > 0),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(hg => (
          <TableRow key={hg.id}>
            {hg.headers.map(header => (
              <TableHead
                key={header.id}
                className={cn('text-xs', header.column.columnDef.meta?.align === 'center' && 'text-center')}
                style={{ width: header.getSize() }}
              >
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id} className={cn(row.depth > 0 && 'bg-muted/30')}>
            {row.getVisibleCells().map(cell => (
              <TableCell
                key={cell.id}
                className={cn('py-1.5 px-3', cell.column.columnDef.meta?.align === 'center' && 'text-center')}
                style={{ width: cell.column.getSize() }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ShapBar({ feature, maxAbs }) {
  const width = maxAbs > 0 ? (Math.abs(feature.shap_value) / maxAbs) * 100 : 0
  const favorsRed = feature.shap_value > 0
  const label = feature.feature_name.replace(/_/g, ' ')

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-40 text-xs text-right truncate text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="flex-1 flex items-center">
        <div className="w-1/2 flex justify-end">
          {favorsRed && (
            <div className="h-5 rounded-l-sm bg-red-500/70" style={{ width: `${width}%` }} />
          )}
        </div>
        <div className="w-px h-6 bg-border shrink-0" />
        <div className="w-1/2">
          {!favorsRed && (
            <div className="h-5 rounded-r-sm bg-blue-500/70" style={{ width: `${width}%` }} />
          )}
        </div>
      </div>
      <div className="w-14 text-[11px] text-center tabular-nums text-muted-foreground">
        {feature.feature_value != null ? feature.feature_value.toFixed(2) : ''}
      </div>
    </div>
  )
}

function ShapModal({ shap_values, red_fighter, blue_fighter, onClose }) {
  const top = shap_values.slice(0, 10)
  const maxAbs = Math.max(...top.map(s => Math.abs(s.shap_value)), 0.001)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Prediction Reasoning</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top features driving this prediction.
              <span className="text-red-500 ml-1">{red_fighter.last_name}</span> favored left,
              <span className="text-blue-500 ml-1">{blue_fighter.last_name}</span> favored right
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center text-[10px] font-semibold text-muted-foreground uppercase pb-2 border-b border-border mb-1">
            <div className="w-40 text-right">Feature</div>
            <div className="flex items-center">
              <div className="w-1/2 text-center text-red-500">{red_fighter.last_name}</div>
              <div className="w-1/2 text-center text-blue-500">{blue_fighter.last_name}</div>
            </div>
            <div className="w-14 flex items-center justify-center gap-0.5">
              <span className="normal-case">Value</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Diff features show Red − Blue</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {top.map(s => <ShapBar key={s.feature_name} feature={s} maxAbs={maxAbs} />)}
        </div>
      </div>
    </div>
  )
}

export default function FightDetailPage() {
  const { id } = useParams()
  const [fight, setFight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showShap, setShowShap] = useState(false)

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

  const { red_fighter, blue_fighter, winner, stats, prediction, method_prediction, odds, shap_values, preview, event } = fight
  const winnerId = String(winner?.id || '')
  const redWon = winnerId === String(red_fighter?.id || '')
  const blueWon = winnerId === String(blue_fighter?.id || '')

  return (
    <div className="h-full flex flex-col overflow-y-auto xl:overflow-hidden">
      <div className="shrink-0 mb-4">
        <Link to="/ufc" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardContent className="p-6 flex-1 min-h-0 flex flex-col gap-6 xl:overflow-hidden">
            {/* Top row: fighters + fight info */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 shrink-0">
              {/* Fighters section */}
              <div className="xl:col-span-2 rounded-lg border border-border overflow-hidden px-4 sm:px-5 pt-2 pb-0">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                  <FighterHeader fighter={red_fighter} corner="red" isWinner={redWon} />
                  <div className="border-t sm:border-t-0 sm:border-l border-border" />
                  <FighterHeader fighter={blue_fighter} corner="blue" isWinner={blueWon} />
                </div>
              </div>

              {/* Fight info section */}
              <div className="rounded-lg border border-border p-4">
                {!winner && prediction ? (() => {
                  const pickProb = prediction.red_prob > 0.5 ? prediction.red_prob : 1 - prediction.red_prob
                  const pickSide = prediction.predicted_winner
                  const pickFighter = pickSide === 'red' ? red_fighter : blue_fighter
                  return (
                    <div className="flex h-full gap-4">
                      {/* Left: fight details */}
                      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2">
                        {fight.weight_class && <WeightClassBadge weightClass={fight.weight_class} />}
                        {event && (
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{event.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                            {event.location && (
                              <p className="text-xs text-muted-foreground">{event.location}</p>
                            )}
                          </div>
                        )}
                        {fight.time_format && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Format</h4>
                            <p className="text-xs">{fight.time_format}</p>
                          </div>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="border-l border-border" />

                      {/* Right: prediction */}
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
                        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Prediction</h3>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', pickSide === 'red' ? 'bg-red-500' : 'bg-blue-500')} />
                          <span className="text-sm font-bold">{pickFighter.last_name}</span>
                        </div>
                        <span className="text-2xl font-black text-foreground tabular-nums">{(pickProb * 100).toFixed(0)}%</span>
                        {method_prediction && (
                          <span className="text-[10px] text-muted-foreground">by {method_prediction.predicted_method}</span>
                        )}
                      </div>
                    </div>
                  )
                })() : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      {fight.weight_class && <WeightClassBadge weightClass={fight.weight_class} />}
                      {winner && fight.method && (
                        <Badge variant="secondary" className="text-xs">
                          {fight.method.trim()} {fight.finish_round ? `R${fight.finish_round}` : ''}
                          {fight.finish_time ? ` ${fight.finish_time}` : ''}
                        </Badge>
                      )}
                    </div>
                    {(fight.details || fight.referee) && (
                      <div className="space-y-1.5">
                        {fight.details && <p className="text-sm text-muted-foreground">{fight.details.trim()}</p>}
                        {fight.referee && <p className="text-sm text-muted-foreground">Referee: {fight.referee.trim()}</p>}
                      </div>
                    )}
                    {fight.time_format && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Format</h3>
                        <p className="text-sm">{fight.time_format}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Stats + prediction grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-0">
              {/* Fight Stats - takes 2 columns */}
              <div className="xl:col-span-2 min-h-0 flex flex-col">
                <div className="rounded-lg border border-border p-4 flex flex-col flex-1 min-h-0">
                  {winner ? (
                    <>
                      <h3 className="text-sm font-semibold mb-3">Fight Stats</h3>
                      {stats && stats.length > 0 && stats.some(s => s.round_number === 0) ? (
                        <StatsTable stats={stats.filter(s => s.round_number === 0 || (s.sig_str_attempted > 0 || s.total_str_attempted > 0 || s.td_attempted > 0 || s.ctrl_seconds > 0))} red_fighter={red_fighter} blue_fighter={blue_fighter} />
                      ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No stats available</p>
                      )}
                    </>
                  ) : preview ? (
                    <>
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <Brain className="h-4 w-4 text-primary" />
                          Written by KernelMcGregor
                        </h3>
                        <span className="text-[10px] text-muted-foreground">
                          {preview.generated_at && new Date(preview.generated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="overflow-y-auto flex-1 min-h-0 max-h-full">
                        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-th:text-foreground prose-td:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-table:text-sm">
                          <Markdown remarkPlugins={[remarkGfm]}>{preview.content}</Markdown>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold mb-3">Fight Stats</h3>
                      <p className="py-8 text-center text-sm text-muted-foreground">No stats yet — fight hasn't happened</p>
                    </>
                  )}
                </div>
              </div>

              {/* Right column — one scroll box through prediction / method / odds */}
              <div className="rounded-lg border border-border flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
                  {/* Model Prediction + Value Pick */}
                  {prediction && (() => {
                    // Value pick: side with the biggest gap between the model's probability and the
                    // market-implied probability. May be a DIFFERENT fighter than the model pick
                    // (often the underdog). It's the best price, not a winner prediction.
                    const impliedFromOdds = (american) =>
                      american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100)
                    const hasOdds = odds && odds.length > 0
                    const redModelProb = prediction.red_prob
                    const blueModelProb = 1 - prediction.red_prob
                    const bestRedOdds = hasOdds ? Math.max(...odds.map(o => o.red_odds)) : null
                    const bestBlueOdds = hasOdds ? Math.max(...odds.map(o => o.blue_odds)) : null
                    const redImplied = bestRedOdds != null ? impliedFromOdds(bestRedOdds) : null
                    const blueImplied = bestBlueOdds != null ? impliedFromOdds(bestBlueOdds) : null
                    const redEdge = redImplied != null ? (redModelProb - redImplied) * 100 : null
                    const blueEdge = blueImplied != null ? (blueModelProb - blueImplied) * 100 : null
                    let valueSide = null, valueEdge = null, valueModelProb = null, valueImplied = null
                    if (redEdge != null && blueEdge != null) {
                      if (redEdge >= blueEdge) { valueSide = 'red'; valueEdge = redEdge; valueModelProb = redModelProb; valueImplied = redImplied }
                      else { valueSide = 'blue'; valueEdge = blueEdge; valueModelProb = blueModelProb; valueImplied = blueImplied }
                    }
                    const valueFighter = valueSide === 'red' ? red_fighter : blue_fighter
                    const hasPositiveEdge = valueEdge != null && valueEdge > 0
                    const valueIsUnderdog = valueImplied != null && valueImplied < 0.5
                    return (
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold flex items-center gap-1.5">
                            <Brain className="h-4 w-4 text-primary" />
                            Prediction
                          </h3>
                          {shap_values && shap_values.length > 0 && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowShap(true)}>
                              <Eye className="h-3 w-3" />
                              View Reasoning
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className={cn('h-3 w-3 rounded-full', prediction.predicted_winner === 'red' ? 'bg-red-500' : 'bg-blue-500')} />
                          <span className="font-semibold text-sm">
                            {prediction.predicted_winner === 'red'
                              ? `${red_fighter.first_name} ${red_fighter.last_name}`
                              : `${blue_fighter.first_name} ${blue_fighter.last_name}`}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {((prediction.red_prob > 0.5 ? prediction.red_prob : 1 - prediction.red_prob) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <div className="h-2.5 rounded-l-full bg-red-500" style={{ width: `${prediction.red_prob * 100}%` }} />
                          <div className="h-2.5 rounded-r-full bg-blue-500" style={{ width: `${(1 - prediction.red_prob) * 100}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>{red_fighter.last_name} {(prediction.red_prob * 100).toFixed(1)}%</span>
                          <span>{((1 - prediction.red_prob) * 100).toFixed(1)}% {blue_fighter.last_name}</span>
                        </div>

                        {/* Value Pick — best price, not a winner prediction. May differ from the model pick. */}
                        {valueSide && (
                          <div className="mt-4 pt-3 border-t border-border">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Zap className="h-3.5 w-3.5 text-sky-500" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Value Pick</span>
                              <span className="text-[10px] text-muted-foreground">· best price, not a winner pick</span>
                            </div>
                            {hasPositiveEdge ? (
                              <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', valueSide === 'red' ? 'bg-red-500' : 'bg-blue-500')} />
                                    <span className="text-sm font-bold truncate">{valueFighter.first_name} {valueFighter.last_name}</span>
                                    {valueIsUnderdog && (
                                      <span className="text-[9px] font-bold text-sky-600 bg-background border border-sky-500/40 rounded px-1.5 py-0.5 leading-none shrink-0">UNDERDOG</span>
                                    )}
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-0.5 shrink-0">
                                    <TrendingUp className="h-3 w-3" />
                                    +{valueEdge.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="mt-2.5">
                                  <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 bg-primary/40 rounded-full" style={{ width: `${valueImplied * 100}%` }} />
                                    <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${valueModelProb * 100}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                    <span>Model {(valueModelProb * 100).toFixed(0)}%</span>
                                    <span>Market {(valueImplied * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-border bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground">No positive edge — the market is efficient on this fight.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Method Prediction */}
                  {method_prediction && (
                    <div className="p-4">
                      <h3 className="text-sm font-semibold mb-3">Method</h3>
                      <div className="space-y-2">
                        {[
                          { label: 'KO/TKO', prob: method_prediction.ko_prob },
                          { label: 'Submission', prob: method_prediction.sub_prob },
                          { label: 'Decision', prob: method_prediction.dec_prob },
                        ].sort((a, b) => b.prob - a.prob).map(m => (
                          <div key={m.label} className="flex items-center gap-2">
                            <span className="w-16 text-xs">{m.label}</span>
                            <div className="flex-1 h-5 bg-secondary rounded-md overflow-hidden relative">
                              <div
                                className={cn('h-full rounded-md', m.label === method_prediction.predicted_method ? 'bg-primary' : 'bg-muted-foreground/30')}
                                style={{ width: `${m.prob * 100}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                                {(m.prob * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Odds */}
                  {odds && odds.length > 0 && (
                    <div className="p-4">
                      <h3 className="text-sm font-semibold mb-3">Odds</h3>
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-muted-foreground pb-1 border-b border-border">
                        <span>Book</span>
                        <span className="text-center text-red-500">{red_fighter.last_name}</span>
                        <span className="text-center text-blue-500">{blue_fighter.last_name}</span>
                      </div>
                      <div>
                        {odds.map(o => (
                          <div key={o.bookmaker} className="grid grid-cols-3 gap-2 text-xs py-0.5">
                            <span className="text-muted-foreground">{o.bookmaker}</span>
                            <span className="text-center font-mono tabular-nums">{formatOdds(o.red_odds)}</span>
                            <span className="text-center font-mono tabular-nums">{formatOdds(o.blue_odds)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* SHAP Modal */}
      {showShap && shap_values && (
        <ShapModal
          shap_values={shap_values}
          red_fighter={red_fighter}
          blue_fighter={blue_fighter}
          onClose={() => setShowShap(false)}
        />
      )}
    </div>
  )
}

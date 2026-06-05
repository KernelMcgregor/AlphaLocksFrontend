import { ChevronDown, ChevronRight, Scale } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { fetchArbitrage } from '../lib/api'
import { cn } from '../lib/utils'

const fmtOdds = (v) => (v > 0 ? `+${v}` : `${v}`)

function BetCalculator({ row }) {
  const [stake, setStake] = useState(100)
  const [side, setSide] = useState('red') // which side user is betting

  const redOdds = row.best_red_odds
  const blueOdds = row.best_blue_odds

  // Calculate payouts
  const toDecimal = (american) =>
    american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1

  const redDec = toDecimal(redOdds)
  const blueDec = toDecimal(blueOdds)

  // For arb: if you bet $stake on one side, how much on the other to guarantee profit?
  let redStake, blueStake, redPayout, bluePayout, guaranteedProfit

  if (side === 'red') {
    redStake = stake
    // To arb: blueStake = redStake * redDec / blueDec
    blueStake = (redStake * redDec) / blueDec
    redPayout = redStake * redDec
    bluePayout = blueStake * blueDec
    guaranteedProfit = Math.min(redPayout - redStake - blueStake, bluePayout - redStake - blueStake)
  } else {
    blueStake = stake
    redStake = (blueStake * blueDec) / redDec
    redPayout = redStake * redDec
    bluePayout = blueStake * blueDec
    guaranteedProfit = Math.min(redPayout - redStake - blueStake, bluePayout - redStake - blueStake)
  }

  const totalStake = redStake + blueStake
  const roi = totalStake > 0 ? (guaranteedProfit / totalStake) * 100 : 0

  return (
    <div className="p-4 bg-muted/30 border-t border-border">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-6">
        {/* Red side */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-sm font-semibold">{row.red_fighter}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtOdds(redOdds)} on {row.best_red_book}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10">Bet:</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input
                type="number"
                value={side === 'red' ? stake : redStake.toFixed(2)}
                onChange={(e) => {
                  setSide('red')
                  setStake(parseFloat(e.target.value) || 0)
                }}
                className="w-28 rounded-md border border-border bg-background pl-5 pr-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Payout: <span className="font-semibold text-foreground">${redPayout.toFixed(2)}</span>
          </div>
        </div>

        {/* Blue side */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-sm font-semibold">{row.blue_fighter}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtOdds(blueOdds)} on {row.best_blue_book}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10">Bet:</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input
                type="number"
                value={side === 'blue' ? stake : blueStake.toFixed(2)}
                onChange={(e) => {
                  setSide('blue')
                  setStake(parseFloat(e.target.value) || 0)
                }}
                className="w-28 rounded-md border border-border bg-background pl-5 pr-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Payout: <span className="font-semibold text-foreground">${bluePayout.toFixed(2)}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-col items-end justify-center gap-1 min-w-[140px]">
          <div className="text-xs text-muted-foreground">Total stake</div>
          <div className="text-sm font-semibold tabular-nums">${totalStake.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">Guaranteed profit</div>
          <div className={cn(
            'text-lg font-bold tabular-nums',
            guaranteedProfit > 0 ? 'text-emerald-500' : 'text-red-500'
          )}>
            {guaranteedProfit >= 0 ? '+' : ''}${guaranteedProfit.toFixed(2)}
          </div>
          <div className={cn(
            'text-xs font-semibold tabular-nums',
            roi > 0 ? 'text-emerald-500' : 'text-red-500'
          )}>
            {roi >= 0 ? '+' : ''}{roi.toFixed(2)}% ROI
          </div>
        </div>
      </div>

      {/* All bookmaker odds */}
      {row.all_odds?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">All bookmaker odds</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {row.all_odds.map((o) => (
              <div
                key={o.bookmaker}
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-xs',
                  (o.bookmaker === row.best_red_book || o.bookmaker === row.best_blue_book)
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border'
                )}
              >
                <div className="font-medium truncate">{o.bookmaker}</div>
                <div className="flex justify-between mt-0.5 tabular-nums">
                  <span className={cn(o.bookmaker === row.best_red_book && 'text-emerald-500 font-semibold')}>
                    {fmtOdds(o.red_odds)}
                  </span>
                  <span className={cn(o.bookmaker === row.best_blue_book && 'text-emerald-500 font-semibold')}>
                    {fmtOdds(o.blue_odds)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ArbitragePage() {
  const [data, setData] = useState(null)
  const [sorting, setSorting] = useState([{ id: 'margin', desc: true }])

  useEffect(() => {
    fetchArbitrage().then(setData).catch(() => setData([]))
  }, [])

  const columns = useMemo(
    () => [
      {
        id: 'expand',
        header: () => null,
        cell: ({ row }) => (
          <Button
            onClick={row.getToggleExpandedHandler()}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        ),
        size: 40,
        meta: { className: 'w-10' },
      },
      {
        accessorKey: 'red_fighter',
        header: 'Matchup',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-sm font-medium">{row.original.red_fighter}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              <span className="text-sm font-medium">{row.original.blue_fighter}</span>
            </div>
          </div>
        ),
        meta: { className: 'w-[25%]' },
      },
      {
        accessorKey: 'event_name',
        header: 'Event',
        cell: ({ row }) => (
          <div>
            <div className="text-sm truncate">{row.original.event_name}</div>
            <div className="text-[10px] text-muted-foreground">{row.original.event_date}</div>
          </div>
        ),
        meta: { className: 'w-[25%]' },
      },
      {
        id: 'best_odds',
        header: 'Best Odds',
        cell: ({ row }) => (
          <div className="space-y-0.5 tabular-nums">
            <div className="text-xs">
              <span className="font-semibold">{fmtOdds(row.original.best_red_odds)}</span>
              <span className="text-muted-foreground ml-1 text-[10px]">{row.original.best_red_book}</span>
            </div>
            <div className="text-xs">
              <span className="font-semibold">{fmtOdds(row.original.best_blue_odds)}</span>
              <span className="text-muted-foreground ml-1 text-[10px]">{row.original.best_blue_book}</span>
            </div>
          </div>
        ),
        meta: { className: 'w-[20%]' },
      },
      {
        accessorKey: 'margin',
        header: 'Margin',
        cell: ({ row }) => {
          const m = row.original.margin
          const isArb = row.original.is_arb
          return (
            <Badge
              className={cn(
                'tabular-nums text-xs',
                isArb
                  ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                  : m > -2
                    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    : 'bg-secondary text-muted-foreground'
              )}
            >
              {m >= 0 ? '+' : ''}{m.toFixed(2)}%
            </Badge>
          )
        },
        meta: { className: 'w-20' },
        sortingFn: 'basic',
      },
      {
        id: 'books',
        header: 'Books',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.all_odds?.length || 0}
          </span>
        ),
        meta: { className: 'w-16' },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: data || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    getRowId: (row) => String(row.fight_id),
  })

  if (!data) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const arbCount = data.filter((d) => d.is_arb).length
  const nearArbCount = data.filter((d) => !d.is_arb && d.margin > -2).length

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {arbCount > 0 ? (
              <span className="text-emerald-500 font-semibold">{arbCount} arb{arbCount !== 1 ? 's' : ''} found</span>
            ) : (
              'No arbs right now'
            )}
            {nearArbCount > 0 && (
              <span className="ml-2">· {nearArbCount} near-arb{nearArbCount !== 1 ? 's' : ''} ({'<'}2%)</span>
            )}
          </div>
        </div>
        {data[0]?.updated_at && (
          <span className="text-[10px] text-muted-foreground">
            Odds updated {new Date(data[0].updated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-0">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.columnDef.meta?.className,
                        header.column.getCanSort() && 'cursor-pointer select-none',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && ' ^'}
                      {header.column.getIsSorted() === 'desc' && ' v'}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Scale className="h-10 w-10 mb-2 opacity-30" />
                      <p className="text-sm">No odds data available</p>
                      <p className="text-xs mt-1">Run the live odds scrape to fetch current lines</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <>
                    <TableRow
                      key={row.id}
                      className={cn(row.original.is_arb && 'bg-emerald-500/5')}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cell.column.columnDef.meta?.className}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell colSpan={columns.length} className="p-0">
                          <BetCalculator row={row.original} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

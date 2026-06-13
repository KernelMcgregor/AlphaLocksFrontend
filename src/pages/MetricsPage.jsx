import { BarChart3, DollarSign, SlidersHorizontal, Target, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { fetchModelMetrics, fetchMethodModelMetrics } from '../lib/api'
import { cn } from '../lib/utils'

function StatCard({ label, value, sub, icon: Icon, trend }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
            {sub && (
              <div className={cn('text-xs mt-1 tabular-nums', trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground')}>
                {sub}
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-md bg-primary/10 p-2">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ThresholdSlider({ fights, mode }) {
  const [threshold, setThreshold] = useState(0)

  const stats = useMemo(() => {
    if (!fights?.length) return null
    const key = mode === 'edge' ? 'edge' : 'conf'
    const plKey = mode === 'edge' ? 'edge_pl' : 'pick_pl'
    const wonKey = mode === 'edge' ? 'edge_won' : 'pick_won'

    // For confidence, threshold is in confidence units (0-0.5), display as 50-100%
    // For edge, threshold is in edge % (0-50)
    const filtered = fights.filter(f => {
      if (f[key] == null || f[plKey] == null) return false
      if (mode === 'edge') return f[key] >= threshold
      return f[key] >= threshold / 100 // convert slider % to decimal
    })

    const total = filtered.length
    const wins = filtered.filter(f => f[wonKey]).length
    const pl = filtered.reduce((sum, f) => sum + f[plKey], 0)
    const roi = total > 0 ? (pl / (total * 100)) * 100 : 0

    return { total, wins, accuracy: total > 0 ? wins / total : 0, pl, roi }
  }, [fights, threshold, mode])

  if (!stats) return null

  const maxThreshold = mode === 'edge' ? 30 : 30
  const thresholdLabel = mode === 'edge' ? `${threshold}% edge` : `${50 + threshold}% confidence`

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Threshold Simulator
          </CardTitle>
          <Badge variant="outline" className="tabular-nums">
            {stats.total} fights
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Drag to see P/L if you only bet on {mode === 'edge' ? 'edges' : 'picks'} above a threshold
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Min threshold: <span className="text-primary">{thresholdLabel}</span></span>
          </div>
          <input
            type="range"
            min={0}
            max={maxThreshold}
            step={1}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-primary h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{mode === 'edge' ? '0%' : '50%'}</span>
            <span>{mode === 'edge' ? `${maxThreshold}%` : `${50 + maxThreshold}%`}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{(stats.accuracy * 100).toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold tabular-nums">{stats.wins}/{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Record</div>
          </div>
          <div className="text-center">
            <div className={cn('text-lg font-bold tabular-nums', stats.pl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {stats.pl >= 0 ? '+' : ''}${Math.abs(stats.pl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-muted-foreground">P/L ($100/bet)</div>
          </div>
          <div className="text-center">
            <div className={cn('text-lg font-bold tabular-nums', stats.roi >= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">ROI</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PerformanceTable({ splits, mode }) {
  const [sorting, setSorting] = useState([])

  const columns = useMemo(() => {
    if (mode === 'picks') {
      return [
        {
          accessorKey: 'label',
          header: 'Confidence',
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
        },
        { accessorKey: 'fights_with_odds', header: 'Fights', meta: { align: 'right' } },
        {
          id: 'accuracy',
          accessorKey: 'accuracy_with_odds',
          header: 'Win Rate',
          cell: ({ getValue }) => {
            const v = getValue()
            return <span className="tabular-nums">{(v * 100).toFixed(1)}%</span>
          },
          meta: { align: 'right' },
          sortingFn: 'basic',
        },
        {
          id: 'pick_pl',
          accessorKey: 'pl',
          header: 'Pick P/L',
          cell: ({ getValue }) => {
            const v = getValue()
            return (
              <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {v >= 0 ? '+' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )
          },
          meta: { align: 'right' },
          sortingFn: 'basic',
        },
        {
          id: 'pick_roi',
          accessorKey: 'roi',
          header: 'Pick ROI',
          cell: ({ getValue }) => {
            const v = getValue()
            return (
              <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {v >= 0 ? '+' : ''}{v.toFixed(1)}%
              </span>
            )
          },
          meta: { align: 'right' },
          sortingFn: 'basic',
        },
        {
          id: 'edge_pl',
          accessorKey: 'edge_pl',
          header: 'Edge P/L',
          cell: ({ getValue }) => {
            const v = getValue()
            return (
              <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {v >= 0 ? '+' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )
          },
          meta: { align: 'right' },
          sortingFn: 'basic',
        },
        {
          id: 'edge_roi',
          accessorKey: 'edge_roi',
          header: 'Edge ROI',
          cell: ({ getValue }) => {
            const v = getValue()
            return (
              <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {v >= 0 ? '+' : ''}{v.toFixed(1)}%
              </span>
            )
          },
          meta: { align: 'right' },
          sortingFn: 'basic',
        },
      ]
    }

    // Edge mode columns
    return [
      {
        accessorKey: 'label',
        header: 'Edge Bucket',
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      },
      { accessorKey: 'fights_with_odds', header: 'Fights', meta: { align: 'right' } },
      {
        id: 'edge_accuracy',
        accessorKey: 'edge_accuracy',
        header: 'Edge Win Rate',
        cell: ({ getValue }) => <span className="tabular-nums">{(getValue() * 100).toFixed(1)}%</span>,
        meta: { align: 'right' },
        sortingFn: 'basic',
      },
      {
        id: 'edge_pl',
        accessorKey: 'edge_pl',
        header: 'Edge P/L',
        cell: ({ getValue }) => {
          const v = getValue()
          return (
            <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {v >= 0 ? '+' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )
        },
        meta: { align: 'right' },
        sortingFn: 'basic',
      },
      {
        id: 'edge_roi',
        accessorKey: 'edge_roi',
        header: 'Edge ROI',
        cell: ({ getValue }) => {
          const v = getValue()
          return (
            <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {v >= 0 ? '+' : ''}{v.toFixed(1)}%
            </span>
          )
        },
        meta: { align: 'right' },
        sortingFn: 'basic',
      },
      {
        id: 'pick_accuracy',
        accessorKey: 'pick_accuracy',
        header: 'Pick Win Rate',
        cell: ({ getValue }) => <span className="tabular-nums">{(getValue() * 100).toFixed(1)}%</span>,
        meta: { align: 'right' },
        sortingFn: 'basic',
      },
      {
        id: 'pick_pl',
        accessorKey: 'pick_pl',
        header: 'Pick P/L',
        cell: ({ getValue }) => {
          const v = getValue()
          return (
            <span className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-500' : 'text-red-400')}>
              {v >= 0 ? '+' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )
        },
        meta: { align: 'right' },
        sortingFn: 'basic',
      },
    ]
  }, [mode])

  const table = useReactTable({
    data: splits || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Compute footer totals
  const totals = useMemo(() => {
    if (!splits?.length) return null
    const fights = splits.reduce((a, s) => a + s.fights_with_odds, 0)
    if (mode === 'picks') {
      const pl = splits.reduce((a, s) => a + s.pl, 0)
      const edgePl = splits.reduce((a, s) => a + (s.edge_pl || 0), 0)
      const correct = splits.reduce((a, s) => a + s.correct_with_odds, 0)
      const edgeCorrect = splits.reduce((a, s) => a + (s.edge_correct || 0), 0)
      return {
        fights,
        accuracy: fights > 0 ? correct / fights : 0,
        pl,
        roi: fights > 0 ? (pl / (fights * 100)) * 100 : 0,
        edgePl,
        edgeRoi: fights > 0 ? (edgePl / (fights * 100)) * 100 : 0,
      }
    }
    const edgePl = splits.reduce((a, s) => a + s.edge_pl, 0)
    const pickPl = splits.reduce((a, s) => a + s.pick_pl, 0)
    const edgeCorrect = splits.reduce((a, s) => a + s.edge_correct, 0)
    const pickCorrect = splits.reduce((a, s) => a + s.pick_correct, 0)
    return {
      fights,
      edgeAccuracy: fights > 0 ? edgeCorrect / fights : 0,
      edgePl,
      edgeRoi: fights > 0 ? (edgePl / (fights * 100)) * 100 : 0,
      pickAccuracy: fights > 0 ? pickCorrect / fights : 0,
      pickPl,
      pickRoi: fights > 0 ? (pickPl / (fights * 100)) * 100 : 0,
    }
  }, [splits, mode])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {mode === 'picks' ? 'Performance by Confidence' : 'Performance by Edge'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {mode === 'picks'
            ? 'Click column headers to sort. Compares model pick vs edge-based betting at each confidence level.'
            : 'Click column headers to sort. Compares edge-based vs pick-based betting at each edge bucket.'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.columnDef.meta?.align === 'right' && 'text-right',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-foreground',
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' \u2191'}
                    {header.column.getIsSorted() === 'desc' && ' \u2193'}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      cell.column.columnDef.meta?.align === 'right' && 'text-right',
                      'tabular-nums',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {totals && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{totals.fights}</TableCell>
                {mode === 'picks' ? (
                  <>
                    <TableCell className="text-right font-bold tabular-nums">{(totals.accuracy * 100).toFixed(1)}%</TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.pl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.pl >= 0 ? '+' : ''}${totals.pl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.roi >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.roi >= 0 ? '+' : ''}{totals.roi.toFixed(1)}%
                    </TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.edgePl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.edgePl >= 0 ? '+' : ''}${totals.edgePl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.edgeRoi >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.edgeRoi >= 0 ? '+' : ''}{totals.edgeRoi.toFixed(1)}%
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right font-bold tabular-nums">{(totals.edgeAccuracy * 100).toFixed(1)}%</TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.edgePl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.edgePl >= 0 ? '+' : ''}${totals.edgePl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.edgeRoi >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.edgeRoi >= 0 ? '+' : ''}{totals.edgeRoi.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{(totals.pickAccuracy * 100).toFixed(1)}%</TableCell>
                    <TableCell className={cn('text-right font-bold tabular-nums', totals.pickPl >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                      {totals.pickPl >= 0 ? '+' : ''}${totals.pickPl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                  </>
                )}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  )
}

function MethodMetrics({ data }) {
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Method Accuracy"
          value={`${(data.accuracy * 100).toFixed(1)}%`}
          sub={`${data.correct} / ${data.total} fights`}
          icon={Target}
        />
        <StatCard
          label="Baseline"
          value={`${(data.baseline_accuracy * 100).toFixed(1)}%`}
          sub="Most common class"
          icon={BarChart3}
        />
        <StatCard
          label="Lift vs Baseline"
          value={`+${((data.accuracy - data.baseline_accuracy) * 100).toFixed(1)}pp`}
          sub={data.accuracy > data.baseline_accuracy ? 'Outperforming' : 'Underperforming'}
          icon={TrendingUp}
          trend={data.accuracy > data.baseline_accuracy ? 'up' : 'down'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-Class Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Predicted</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Correct</TableHead>
                <TableHead className="text-right">Precision</TableHead>
                <TableHead className="text-right">Recall</TableHead>
                <TableHead className="text-right">F1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.per_class.map(c => (
                <TableRow key={c.class}>
                  <TableCell className="font-medium">{c.class}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.predicted}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.actual}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.correct}</TableCell>
                  <TableCell className="text-right tabular-nums">{(c.precision * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{(c.recall * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{(c.f1 * 100).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState(null)
  const [methodMetrics, setMethodMetrics] = useState(null)
  const [model, setModel] = useState('winner') // 'winner' | 'method'
  const [viewMode, setViewMode] = useState('picks') // 'picks' | 'edge'

  useEffect(() => {
    fetchModelMetrics().then(setMetrics).catch(() => {})
    fetchMethodModelMetrics().then(setMethodMetrics).catch(() => {})
  }, [])

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <Tabs value={model} onValueChange={setModel}>
          <TabsList>
            <TabsTrigger value="winner">Winner Prediction</TabsTrigger>
            <TabsTrigger value="method">Method Prediction</TabsTrigger>
          </TabsList>
        </Tabs>

        {model === 'winner' && (
          <div className="flex items-center gap-1 rounded-md bg-muted p-1">
            <button
              onClick={() => setViewMode('picks')}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'picks' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              By Confidence
            </button>
            <button
              onClick={() => setViewMode('edge')}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'edge' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              By Edge
            </button>
          </div>
        )}
      </div>

      {model === 'winner' && (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <StatCard
              label="Overall Accuracy"
              value={`${(metrics.accuracy * 100).toFixed(1)}%`}
              sub={`${metrics.correct} / ${metrics.total} fights`}
              icon={Target}
            />
            <StatCard
              label="High Confidence"
              value={(() => {
                const high = metrics.confidence_splits.filter(s => s.label.match(/7|8/))
                const t = high.reduce((a, s) => a + s.fights, 0)
                const c = high.reduce((a, s) => a + s.correct, 0)
                return t ? `${((c / t) * 100).toFixed(1)}%` : '\u2014'
              })()}
              sub="70%+ confidence"
              icon={TrendingUp}
            />
            <StatCard
              label="Pick P/L"
              value={`${metrics.total_pl >= 0 ? '+' : ''}$${Math.abs(metrics.total_pl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub={`${metrics.total_roi >= 0 ? '+' : ''}${metrics.total_roi.toFixed(1)}% ROI`}
              icon={DollarSign}
              trend={metrics.total_roi >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="Edge P/L"
              value={`${metrics.total_edge_pl >= 0 ? '+' : ''}$${Math.abs(metrics.total_edge_pl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub={`${metrics.total_edge_roi >= 0 ? '+' : ''}${metrics.total_edge_roi.toFixed(1)}% ROI`}
              icon={DollarSign}
              trend={metrics.total_edge_roi >= 0 ? 'up' : 'down'}
            />
          </div>

          {/* Interactive table */}
          <PerformanceTable
            splits={viewMode === 'picks' ? metrics.confidence_splits : metrics.edge_splits}
            mode={viewMode}
          />

          {/* Threshold simulator */}
          <ThresholdSlider fights={metrics.fights} mode={viewMode} />
        </>
      )}

      {model === 'method' && (
        <MethodMetrics data={methodMetrics} />
      )}
    </div>
  )
}

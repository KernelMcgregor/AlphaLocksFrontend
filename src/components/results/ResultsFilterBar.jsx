// Controls shared by both Past Model Results tabs: which bets count and at what price.
import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import DateRangeFilter from '../filters/DateRangeFilter'
import { Dropdown, Field, Segmented } from '../picks/PicksFilterBar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '../../lib/utils'
import { MARKETS, MIN_EVS } from './filters'

function MarketsPicker({ selected, onChange }) {
  const all = MARKETS.map((m) => m.key)
  const isOn = (k) => !selected.length || selected.includes(k)
  const toggle = (k, checked) => {
    const cur = selected.length ? selected : all
    const next = checked ? [...new Set([...cur, k])] : cur.filter((x) => x !== k)
    if (!next.length) return                       // keep at least one market
    onChange(next.length === all.length ? [] : all.filter((x) => next.includes(x)))
  }
  const summary = !selected.length ? 'All markets'
    : selected.length === 1 ? MARKETS.find((m) => m.key === selected[0])?.label : `${selected.length} markets`
  const row = 'flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[12.5px] hover:bg-accent'
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Markets"
        className="flex h-8 w-[160px] items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-1">
        <label className={cn(row, 'font-semibold')}>
          <Checkbox className="size-4 rounded-[4px] border-border" checked={!selected.length}
            onCheckedChange={(c) => c && onChange([])} />
          All markets
        </label>
        <div className="my-1 h-px bg-border" />
        {MARKETS.map((m) => (
          <label key={m.key} className={row}>
            <Checkbox className="size-4 rounded-[4px] border-border" checked={isOn(m.key)}
              onCheckedChange={(c) => toggle(m.key, c)} />
            <span className={isOn(m.key) ? 'text-foreground' : 'text-muted-foreground'}>{m.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export default function ResultsFilterBar({ filters, onChange, coverage }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const range = { from: filters.from || coverage?.from || '', to: filters.to || coverage?.to || '' }
  const propsShown = !filters.markets.length || filters.markets.some((m) => m !== 'winner')
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
      <Field label="Dates">
        {range.from ? (
          <DateRangeFilter dateRange={range} allFrom={coverage?.from}
            onApply={({ from, to }) => set({ from: from === coverage?.from ? '' : from, to: to >= (coverage?.to || '') ? '' : to })} />
        ) : <div className="h-8" />}
      </Field>
      <Field label="Moneyline line">
        <Segmented label="Moneyline line" value={filters.basis} onChange={(basis) => set({ basis })}
          options={[{ key: 'open', label: 'Opening' }, { key: 'close', label: 'Closing' }]} />
      </Field>
      <Field label="Price">
        <Segmented label="Price" value={filters.price} onChange={(price) => set({ price })}
          options={[{ key: 'typical', label: 'Typical book' }, { key: 'best', label: 'Best book' }]} />
      </Field>
      <Field label="Minimum edge">
        <Dropdown label="Minimum edge" value={filters.minEv} onChange={(minEv) => set({ minEv })} options={MIN_EVS}
          className="w-[150px]" />
      </Field>
      <Field label="Markets">
        <MarketsPicker selected={filters.markets} onChange={(markets) => set({ markets })} />
      </Field>
      <div className="flex flex-col gap-1.5 pb-0.5">
        <label className="flex cursor-pointer items-center gap-2 text-[12px]">
          <Checkbox className="size-4 rounded-[4px] border-border" checked={filters.top}
            onCheckedChange={(c) => set({ top: !!c })} />
          One pick per market
        </label>
        {filters.basis === 'open' && propsShown && (
          <label className="flex cursor-pointer items-center gap-2 text-[12px]">
            <Checkbox className="size-4 rounded-[4px] border-border" checked={filters.props}
              onCheckedChange={(c) => set({ props: !!c })} />
            Include props (closing price)
          </label>
        )}
      </div>
    </div>
  )
}

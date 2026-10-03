// The Picks page's controls, pinned above the grid while it scrolls.
//
// The sportsbook filter means "the best price is at this book". Moneyline cards also list
// every book's price, but props are stored as best + median only, so for props the best
// book is the only one we know carries the line.
import { ChevronDown, Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { DEFAULT_FILTERS, MARKET_GROUPS, MIN_GRADES, SORTS } from '../../lib/picks'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '../../lib/utils'

function Field({ label, children, className }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const inputCls =
  'h-8 rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** The site's Radix select, sized to sit in the bar. options: [{ key, label }] */
function Dropdown({ label, value, onChange, options, className }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn('h-8 gap-2 px-2.5 py-0 text-[12.5px] font-semibold', className)}>
        <span className="truncate"><SelectValue /></span>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key} className="pl-2.5 text-[12.5px] data-[state=checked]:font-semibold data-[state=checked]:text-primary">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 rounded-md border border-border bg-muted/50 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded px-2.5 text-[12px] font-semibold transition-colors',
            value === o.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Multi-select of market groups: the site's checkbox inside a popover that stays open while
 *  ticking. `selected` = [] means every market. */
function MarketsDropdown({ selected, counts, onToggle, onAll }) {
  const isOn = (k) => !selected.length || selected.includes(k)
  const summary = !selected.length
    ? 'All markets'
    : selected.length === 1
      ? MARKET_GROUPS.find((g) => g.key === selected[0])?.label
      : `${selected.length} markets`
  const row = 'flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[12.5px] hover:bg-accent'
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Markets"
        className="flex h-8 w-[140px] items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[220px] p-1">
        <label className={cn(row, 'font-semibold')}>
          <Checkbox
            className="size-4 rounded-[4px] border-border"
            checked={!selected.length}
            onCheckedChange={(checked) => checked && onAll()}
          />
          All markets
        </label>
        <div className="my-1 h-px bg-border" />
        {MARKET_GROUPS.map((g) => (
          <label key={g.key} className={row}>
            <Checkbox
              className="size-4 rounded-[4px] border-border"
              checked={isOn(g.key)}
              onCheckedChange={(checked) => onToggle(g.key, checked)}
            />
            <span className={cn('flex-1', isOn(g.key) ? 'text-foreground' : 'text-muted-foreground')}>{g.label}</span>
            <span className="tabular-nums text-[11px] text-muted-foreground">{counts[g.key] ?? 0}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export default function PicksFilterBar({
  filters, setFilters, events, eventId, onEvent, books, counts, shown,
  view = 'picks', onView, arbCount = 0, stake, onStake,
}) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  // groups = [] means every market. Unticking one from "all" keeps the rest; ticking the
  // last missing one collapses back to [] so "All markets" reads as ticked again.
  const allKeys = MARKET_GROUPS.map((g) => g.key)
  const toggleGroup = (k, checked) => {
    const current = filters.groups.length ? filters.groups : allKeys
    const next = checked ? [...new Set([...current, k])] : current.filter((g) => g !== k)
    if (!next.length) return   // [] would mean "all"; keep at least one market ticked
    set({ groups: next.length === allKeys.length ? [] : next })
  }
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  return (
    <div className="z-20 -mx-1 rounded-xl md:sticky md:top-0 border border-border bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-2">
        {events?.length > 0 && (
          <Field label="Event">
            <Dropdown
              label="Event"
              value={eventId}
              onChange={onEvent}
              className="w-[200px]"
              options={[{ key: 'all', label: 'All events' }, ...events.map((e) => ({ key: e.id, label: e.name }))]}
            />
          </Field>
        )}

        <Field label="View">
          <Segmented
            label="Picks or arbitrage"
            value={view}
            onChange={onView}
            options={[
              { key: 'picks', label: 'Picks' },
              { key: 'arbs', label: `Arbitrage${arbCount ? ` (${arbCount})` : ''}` },
            ]}
          />
        </Field>

        {view === 'arbs' ? (
          <Field label="Total stake ($)">
            <input
              type="number"
              min="1"
              step="10"
              aria-label="Total stake"
              value={stake}
              onChange={(e) => onStake(Math.max(1, Number(e.target.value) || 0))}
              className={cn(inputCls, 'w-28 font-semibold tabular-nums')}
            />
          </Field>
        ) : (
        <>
        <Field label="Markets">
          <MarketsDropdown
            selected={filters.groups}
            counts={counts}
            onToggle={toggleGroup}
            onAll={() => set({ groups: [] })}
          />
        </Field>

        <Field label="Fighter">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search"
              className={cn(inputCls, 'w-32 pl-7')}
            />
          </div>
        </Field>

        <Field label="Sportsbook">
          <Dropdown
            label="Sportsbook"
            value={filters.book}
            onChange={(book) => set({ book })}
            className="w-[140px]"
            options={[{ key: 'all', label: 'All books' }, ...books.map((b) => ({ key: b, label: `Best at ${b}` }))]}
          />
        </Field>

        <Field label="Minimum grade">
          <Dropdown
            label="Minimum grade"
            value={filters.minGrade}
            onChange={(minGrade) => set({ minGrade })}
            className="w-[124px]"
            options={MIN_GRADES}
          />
        </Field>

        <Field label="Show">
          <Segmented
            label="Which picks"
            value={filters.scope || 'primary'}
            onChange={(scope) => set({ scope })}
            options={[{ key: 'primary', label: 'Best per fight' }, { key: 'all', label: 'All markets' }]}
          />
        </Field>

        <Field label="Price">
          <Segmented
            label="Price basis"
            value={filters.basis}
            onChange={(basis) => set({ basis })}
            options={[{ key: 'best', label: 'Best' }, { key: 'median', label: 'Typical' }]}
          />
        </Field>

        <Field label="Odds">
          <Segmented
            label="Favourites or underdogs"
            value={filters.side}
            onChange={(side) => set({ side })}
            options={[{ key: 'all', label: 'All' }, { key: 'fav', label: 'Favs' }, { key: 'dog', label: 'Dogs' }]}
          />
        </Field>

        <Field label="Sort">
          <Dropdown
            label="Sort"
            value={filters.sort}
            onChange={(sort) => set({ sort })}
            className="w-[130px]"
            options={SORTS}
          />
        </Field>
        </>
        )}

        <span className="ml-auto flex items-center gap-3 self-center pt-4 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{shown} shown</span>
          {view === 'picks' && dirty && (
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="font-semibold text-primary hover:underline">
              Reset
            </button>
          )}
        </span>
      </div>
    </div>
  )
}

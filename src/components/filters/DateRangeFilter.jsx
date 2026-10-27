// Date-range picker: a button showing the range, opening a popover with presets and two
// date inputs. Shared by the Events & Fights page and Past Model Results.
//
// `allFrom` is where the "All time" preset starts (the earliest date the page has data for).
import { CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Separator } from '../ui/separator'
import { formatDate } from '../../lib/utils'

const PRESETS = [
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: 'All time', months: null },
]

export default function DateRangeFilter({ dateRange, onApply, allFrom = '1993-01-01' }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(dateRange.from)
  const [to, setTo] = useState(dateRange.to)

  useEffect(() => {
    if (open) { setFrom(dateRange.from); setTo(dateRange.to) }
  }, [open, dateRange])

  const applyPreset = (months) => {
    const t = new Date()
    setTo(t.toISOString().slice(0, 10))
    if (months) {
      const f = new Date()
      f.setMonth(f.getMonth() - months)
      setFrom(f.toISOString().slice(0, 10))
    } else {
      setFrom(allFrom)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <CalendarIcon className="h-3.5 w-3.5" />
          {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.months)}
                className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">To</label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex justify-end gap-2 p-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => { onApply({ from, to }); setOpen(false) }}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// The date window shared by every best-of tab, kept in the URL as ?w= (all | last:Nm |
// year:YYYY). One toggle: the rolling windows, then Year, which opens a grid of years
// under the toggle and shows the picked year once chosen.
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover'
import { SlideTabs } from '../ui/slide-tabs'
import { ROLLING, useWindow, YEARS } from './window'

export default function WindowPicker() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const w = useWindow()
  const year = w.startsWith('year:') ? w.slice(5) : null
  const set = (v) => {
    const p = new URLSearchParams(params)
    if (v === 'all') p.delete('w')
    else p.set('w', v)
    p.delete('fight')
    p.delete('event')
    setParams(p, { replace: true })
  }
  const tabs = [
    ...ROLLING,
    {
      key: 'year',
      label: (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          {year || 'Year'}<ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        </span>
      ),
    },
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div>
          <SlideTabs size="sm" tabs={tabs} value={year ? 'year' : w}
            onChange={(k) => (k === 'year' ? setOpen((o) => !o) : set(k))} />
        </div>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-[232px] p-2">
        <div className="grid grid-cols-4 gap-1">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { set(`year:${y}`); setOpen(false) }}
              className={cn(
                'rounded-md py-1 text-[12px] font-semibold tabular-nums transition-colors',
                y === year ? 'bg-foreground text-background' : 'hover:bg-muted',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

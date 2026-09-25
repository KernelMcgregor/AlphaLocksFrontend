// Event chips that fill one row and spill the remainder into a "More" menu.
//
// The cut-off is measured, not guessed: event names run from "UFC 333" to
// "UFC Fight Night: Volkanovski vs. Evloev", so a fixed count would either wrap on a
// laptop or leave half the row empty on a wide monitor. A hidden copy of the full row
// supplies each chip's natural width; a ResizeObserver supplies the space available.
//
// Until the first measurement lands, `widths` is empty and every chip renders — the row
// may overflow for one frame, which is preferable to flashing an empty filter bar.
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn, formatDate } from '../../lib/utils'

/** Gap between chips, in px. Must match the `gap-2` on the rows below. */
const TAB_GAP = 8

// shrink-0 is load-bearing twice over: it keeps a chip at its natural width in the
// visible row (flex children default to shrinking, which squeezes every name into an
// unreadable stub), and it makes the hidden row measure natural widths rather than
// squeezed ones — without it every chip measures small, the arithmetic concludes they
// all fit, and the row overflows instead of spilling into the menu.
const CHIP = 'shrink-0 whitespace-nowrap'

// The More button is measured and rendered at one fixed width. When the active event is
// inside the menu the button shows that event's name instead of "More (N)", and a name is
// far wider than the counter the row was measured against — left to size itself it pushed
// the last chip past the row's right edge. Fixing the width means the budget and the
// render always agree, and the name truncates into the space actually reserved for it.
const MORE_W = 'w-[9.5rem]'

export default function EventTabs({ events, activeId, onSelect }) {
  const containerRef = useRef(null)
  const measureRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [widths, setWidths] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    ro.observe(el)
    setContainerWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Re-measure whenever the card list changes: names drive chip width.
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    setWidths(Array.from(el.children).map((c) => c.getBoundingClientRect().width))
  }, [events])

  // widths = [...events, More]
  const visibleCount = (() => {
    if (!containerWidth || widths.length !== events.length + 1) return events.length
    const moreW = widths[widths.length - 1]
    let used = 0
    for (let i = 0; i < events.length; i++) {
      const next = used + (i ? TAB_GAP : 0) + widths[i]
      // Every chip past this one must still leave room for the More button, unless this
      // is the last chip — then More isn't rendered and its width is free.
      const needsMore = i < events.length - 1
      if (next + (needsMore ? TAB_GAP + moreW : 0) > containerWidth) return i
      used = next
    }
    return events.length
  })()

  const shown = events.slice(0, visibleCount)
  const overflow = events.slice(visibleCount)
  const activeHidden = overflow.some((e) => e.id === activeId)

  return (
    <div className="relative min-w-0 flex-1">
      {/* Hidden mirror of the full row, used only for width measurement. `w-max` keeps
          it out of the parent's width so the chips report their natural size. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 flex w-max gap-2"
        style={{ visibility: 'hidden' }}
      >
        {events.map((e) => (
          <Button key={e.id} variant="outline" size="sm" className={CHIP}>{e.name}</Button>
        ))}
        <Button variant="outline" size="sm" className={cn(CHIP, MORE_W, 'gap-1')}>
          More (0) <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={containerRef} className="flex gap-2 overflow-hidden">
        {shown.map((e) => (
          <Button
            key={e.id}
            size="sm"
            variant={activeId === e.id ? 'default' : 'outline'}
            className={CHIP}
            onClick={() => onSelect(e)}
          >
            {e.name}
          </Button>
        ))}

        {overflow.length > 0 && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={activeHidden ? 'default' : 'outline'}
                className={cn(CHIP, MORE_W, 'gap-1')}
              >
                <span className="truncate">
                  {activeHidden
                    ? events.find((e) => e.id === activeId)?.name
                    : `More (${overflow.length})`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1.5">
              <div className="flex flex-col">
                {overflow.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { onSelect(e); setOpen(false) }}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      e.id === activeId
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <span className="text-sm font-medium leading-tight">{e.name}</span>
                    <span
                      className={cn(
                        'text-[11px]',
                        e.id === activeId ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {formatDate(e.date)} · {e.fights.length} bout{e.fights.length === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

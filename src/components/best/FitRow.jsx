// A single line of chips that never cuts one in half: as many as fit, then "+N" for the
// rest. N is always at least 2 (a "+1" chip would take the room of the chip it hides).
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

const GAP = 6

export default function FitRow({ items, render, className }) {
  const box = useRef(null)
  const measure = useRef(null)
  const [shown, setShown] = useState(items.length)

  useLayoutEffect(() => {
    const el = box.current
    const m = measure.current
    if (!el || !m) return undefined
    const fit = () => {
      const kids = [...m.children]
      const plus = kids.pop()?.offsetWidth ?? 0
      const widths = kids.map((k) => k.offsetWidth)
      const avail = el.clientWidth
      const total = widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, widths.length - 1)
      if (total <= avail) { setShown(widths.length); return }
      let k = 0
      let used = plus
      while (k < widths.length && used + widths[k] + GAP <= avail) { used += widths[k] + GAP; k += 1 }
      if (widths.length - k === 1) k -= 1
      setShown(Math.max(0, k))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items])

  const hidden = items.length - shown
  const plus = (n) => (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2 text-[11px] font-bold tabular-nums text-muted-foreground">+{n}</span>
  )
  return (
    <span ref={box} className={cn('relative flex min-w-0 items-center gap-1.5 overflow-hidden', className)}>
      <span ref={measure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-1.5">
        {items.map((it, i) => <span key={i} className="shrink-0">{render(it)}</span>)}
        {plus(items.length)}
      </span>
      {items.slice(0, shown).map((it, i) => <span key={i} className="shrink-0">{render(it)}</span>)}
      {hidden > 0 && plus(hidden)}
    </span>
  )
}

// src/components/ui/slide-tabs.jsx
// Sliding-pill tab switcher. The pill slides only on selection — hovering does not
// move it. Dependency-free (no framer-motion): the pill is a single absolutely
// positioned div driven by measured offsets + a CSS transition.
//
//   <SlideTabs
//     tabs={[{ key: 'a', label: 'Alpha' }, { key: 'b', label: 'Beta', badge: 12 }]}
//     value={tab}
//     onChange={setTab}
//   />
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

const SIZES = {
  sm: { list: 'p-0.5', tab: 'px-2.5 py-1 text-[11px] gap-1', radius: 'rounded-[7px]', inset: 'inset-y-0.5', track: 'rounded-[10px]' },
  default: { list: 'p-1', tab: 'px-3.5 py-1.5 text-[12.5px] gap-1.5', radius: 'rounded-lg', inset: 'inset-y-1', track: 'rounded-xl' },
  lg: { list: 'p-1', tab: 'px-5 py-2 text-sm gap-2', radius: 'rounded-full', inset: 'inset-y-1', track: 'rounded-full' },
}

export function SlideTabs({ tabs, value, onChange, size = 'default', className }) {
  const listRef = useRef(null)
  const tabRefs = useRef({})
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })

  const sz = SIZES[size] || SIZES.default

  const measure = useCallback(() => {
    const el = tabRefs.current[value]
    if (!el) return
    setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
  }, [value])

  useLayoutEffect(() => {
    measure()
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [measure, tabs])

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn('relative isolate inline-flex w-fit items-center bg-muted', sz.track, sz.list, className)}
    >
      {/* sliding pill */}
      <div
        aria-hidden
        className={cn(
          'absolute -z-10 bg-foreground shadow-sm',
          sz.radius,
          sz.inset,
          pill.ready && 'transition-[left,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
        )}
        style={{ left: pill.left, width: pill.width, opacity: pill.ready ? 1 : 0 }}
      />

      {tabs.map((t) => (
        <button
          key={t.key}
          ref={(el) => { tabRefs.current[t.key] = el }}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'relative z-10 inline-flex cursor-pointer items-center whitespace-nowrap font-semibold text-white mix-blend-difference',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            sz.tab,
            sz.radius
          )}
        >
          {t.icon}
          {t.label}
          {t.badge != null && <span className="tabular-nums opacity-60">{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export default SlideTabs

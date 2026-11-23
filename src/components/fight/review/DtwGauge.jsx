// The deserve-to-win gauge: red fills its share of the semicircle from the left, blue
// the rest, and the needle sits on the boundary. Arc and needle sweep together to the
// new split when a different fight is shown (instant under reduced motion). Shared by
// the Events page and the Highlights panels.
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'

// Eases a number toward `target` from wherever it currently is.
function useTweened(target, ms = 650) {
  const [cur, setCur] = useState(target)
  const curRef = useRef(target)
  useEffect(() => {
    const from = curRef.current
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms
    let raf, t0
    const step = (t) => {
      t0 ??= t
      const k = dur ? Math.min(1, (t - t0) / dur) : 1
      const e = 1 - (1 - k) ** 3
      curRef.current = from + (target - from) * e
      setCur(curRef.current)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return cur
}

// Point on the semicircle, `t` of the way from the left end (0) to the right (1).
const arcPoint = (t) => [100 - 84 * Math.cos(Math.PI * t), 100 - 84 * Math.sin(Math.PI * t)]

// `pRed`/`pBlue`: replay shares (draws are left out of the split). `size`: 'sm' on the
// Events hero, 'lg' in a side panel.
export default function DtwGauge({ pRed, pBlue, size = 'sm' }) {
  const decisive = (pRed ?? 0) + (pBlue ?? 0)
  const r = decisive > 0 ? Math.round((pRed / decisive) * 100) : 50
  const b = 100 - r
  const shown = useTweened(r / 100)
  const [x, y] = arcPoint(shown)
  const deg = shown * 180 - 90
  const lead = r >= b ? 'red' : 'blue'
  const lg = size === 'lg'
  const num = cn('pb-0.5 font-extrabold leading-none tabular-nums', lg ? 'w-14 text-[24px]' : 'w-11 text-[17px]')
  return (
    <div className="flex items-end justify-center gap-2">
      <span className={cn(num, 'text-right', lead === 'red' ? 'text-corner-red' : 'text-muted-foreground/70')}>{r}%</span>
      <svg viewBox="0 0 200 106" className={lg ? 'w-[180px]' : 'w-[132px]'}>
        {shown > 0.001 && <path d={`M 16 100 A 84 84 0 0 1 ${x} ${y}`} fill="none" strokeWidth="14" className="stroke-corner-red" />}
        {shown < 0.999 && <path d={`M ${x} ${y} A 84 84 0 0 1 184 100`} fill="none" strokeWidth="14" className="stroke-corner-blue" />}
        <line x1="100" y1="100" x2="100" y2="34" strokeWidth="4" strokeLinecap="round" className="stroke-foreground"
          transform={`rotate(${deg} 100 100)`} />
        <circle cx="100" cy="100" r="8" className="fill-foreground" />
        <circle cx="100" cy="100" r="3" className="fill-background" />
      </svg>
      <span className={cn(num, 'text-left', lead === 'blue' ? 'text-corner-blue' : 'text-muted-foreground/70')}>{b}%</span>
    </div>
  )
}

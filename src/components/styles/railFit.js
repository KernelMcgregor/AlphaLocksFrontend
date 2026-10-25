// Keeping a Fighter Styles rail exactly the screen's height without scrolling: when its
// content overflows, the caller's trim steps are applied one at a time, least important
// first, until it fits. A big monitor shows everything, a laptop only the essentials.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export const PORTRAIT_FULL = 190
export const PORTRAIT_SHORT = 120

// Trim steps shared by both rails, interleaved by the caller with its own list steps:
// 'bio:<row>' hides a bio row, 'portrait' shortens the portrait, 'compact' swaps it for a
// thumbnail beside the name.
export function bioPlan(steps) {
  return {
    hideBio: new Set(steps.filter((x) => x.startsWith('bio:')).map((x) => x.slice(4))),
    portrait: steps.includes('portrait') ? PORTRAIT_SHORT : PORTRAIT_FULL,
    // 'compact': the portrait becomes a thumbnail beside the name (small screens).
    compact: steps.includes('compact'),
  }
}

// Returns [ref, drop]: attach ref to the rail (which must be overflow-hidden at full
// height); `drop` is how many trim steps to apply. Starts from everything whenever the
// rail's height or `resetKey` changes, then drops one step per layout pass until nothing
// overflows. Layout effects run before paint, so the trimming is never seen. `watch` are
// values whose change can grow the content (re-check, without resetting).
export function useRailFit(nSteps, resetKey, watch = []) {
  const ref = useRef(null)
  const [drop, setDrop] = useState(0)
  const [fitFor, setFitFor] = useState(resetKey)
  if (fitFor !== resetKey) { setFitFor(resetKey); setDrop(0) }
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || getComputedStyle(el).overflow !== 'hidden') return   // stacked (small screens): page scrolls instead
    if (el.scrollHeight > el.clientHeight + 1 && drop < nSteps) setDrop((d) => d + 1)
  }, [drop, nSteps, resetKey, ...watch]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let h = el.clientHeight
    const ro = new ResizeObserver(() => { if (el.clientHeight !== h) { h = el.clientHeight; setDrop(0) } })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, drop]
}

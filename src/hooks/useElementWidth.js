import { useEffect, useRef, useState } from 'react'

// Width of an element in CSS pixels, tracked live. For SVG charts drawn at 1:1 scale:
// a viewBox scaled to fit a wide screen blows its 11px labels up to 25px.
export function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

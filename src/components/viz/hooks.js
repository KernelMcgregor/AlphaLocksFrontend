import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// A window that slides by `step` items rather than jumping a whole page, so the
// series reads as one continuous spectrum. `offset` counts items back from the
// newest; the charts render the whole series and translate to these bounds, so the
// motion is a real slide rather than a cut followed by an animation.
export function useSlidingWindow(total, size, step) {
  const [state, setState] = useState({ offset: 0 })
  const max = Math.max(0, total - size)
  const offset = Math.min(state.offset, max)

  const slide = (delta) => setState((s) => ({
    offset: Math.min(max, Math.max(0, Math.min(s.offset, max) + delta)),
  }))

  const end = total - offset
  return {
    start: Math.max(0, end - size),
    end,
    older: () => slide(step),
    newer: () => slide(-step),
    canOlder: offset < max,
    canNewer: offset > 0,
  }
}

// Measures its element so the chart can be drawn in real pixels — avoids the
// letterboxing a fixed viewBox gives you when the container height is fluid.
export function useElementSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

// The content column is one scroll container holding every section. The tab bar is a
// scrollspy over it: clicking scrolls, scrolling re-highlights. `lockUntil` swallows
// the spy for the duration of a click-driven smooth scroll, otherwise the highlight
// flickers through every section it passes on the way.
export function useScrollSpy(sections) {
  const scrollRef = useRef(null)
  const nodes = useRef({})
  const lockUntil = useRef(0)
  const [active, setActive] = useState(sections[0]?.key)

  const register = useCallback((id, el) => {
    if (el) nodes.current[id] = el
    else delete nodes.current[id]
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || !sections.length) return undefined
    const onScroll = () => {
      if (Date.now() < lockUntil.current) return
      // bottom of the scroll can never reach the last section's top, so pin it
      const atBottom = root.scrollHeight - root.scrollTop - root.clientHeight < 8
      let current = sections[0].key
      if (atBottom) {
        current = sections[sections.length - 1].key
      } else {
        const line = root.scrollTop + 28
        for (const sec of sections) {
          const el = nodes.current[sec.key]
          if (el && el.offsetTop <= line) current = sec.key
        }
      }
      setActive((a) => (a === current ? a : current))
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [sections])

  const scrollTo = (id) => {
    const root = scrollRef.current
    const el = nodes.current[id]
    if (!root || !el) return
    lockUntil.current = Date.now() + 800
    setActive(id)
    root.scrollTo({ top: Math.max(0, el.offsetTop - 12), behavior: 'smooth' })
  }

  // A section list that shrinks (a fight with no odds drops `market`) can leave
  // `active` pointing at a key that no longer has a tab, which blanks the
  // indicator. Resolved at read time rather than synced in an effect, so there is
  // no render where the caller sees a key that is not in its own list.
  const resolved = sections.some((s) => s.key === active) ? active : sections[0]?.key

  return { scrollRef, register, active: resolved, scrollTo }
}

import { useEffect, useRef, useState } from 'react'

// Whether a page's cover has scrolled up under its slim bar (`barH` px tall), so the bar
// can take over. `scrollRef` is the scroll container (useScrollSpy's ref, which carries
// `.current`); `ready` re-runs the hookup once a page that renders a loader first mounts.
export function usePastCover(scrollRef, ready, barH = 60) {
  const coverRef = useRef(null)
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    const onScroll = () => setPast(el.scrollTop > (coverRef.current?.offsetHeight ?? 400) - barH)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, ready, barH])
  return [coverRef, past]
}

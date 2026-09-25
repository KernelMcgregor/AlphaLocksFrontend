// Full-page loading state: the royal-blue Orb31, centred in the content area.
//
// Held back for a beat before it appears. Most page loads are now served from the
// client or server cache in well under that, and a WebGL orb that mounts, compiles its
// shader and unmounts again inside a few frames reads as a flicker rather than a
// loading state. Only a load slow enough to notice gets the orb.
import { useEffect, useState } from 'react'
import { Orb31 } from '@/components/orbs/orb-31'

const SHOW_AFTER_MS = 150

export default function PageLoader({ size = 200 }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ minHeight: size }}
      role="status"
      aria-label="Loading"
    >
      {show && <Orb31 size={size} state="idle" />}
    </div>
  )
}

// Cursor-following hover tooltip, rendered into document.body.
//
// The portal is not optional: triggers sit inside stacked overflow-hidden
// ancestors (sliding chart viewports, cards, the scrolling section column), and an
// absolutely-positioned bubble is clipped by every one of them.
//
// Position tracks the pointer rather than the trigger's box — anchoring to the
// element put the bubble in the same place no matter where you entered a wide row,
// which reads as disconnected from what you are pointing at.
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

const EDGE = 130 // keeps the bubble fully on screen near either side
const GAP = 14 // clearance so the cursor never sits on top of the bubble

export function Tip({ children, content, className, style }) {
  const [pos, setPos] = useState(null)
  const raf = useRef(0)

  const track = (e) => {
    const { clientX, clientY } = e
    // pointer events fire faster than paint; coalesce to one update per frame
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      setPos({ x: clientX, y: clientY })
    })
  }

  const clear = () => {
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
    setPos(null)
  }

  // Flip below the cursor when there is no room above, so a trigger near the top
  // of the viewport does not render the bubble off screen.
  const below = pos != null && pos.y < 190

  return (
    <div
      className={cn('relative', className)}
      style={style}
      onMouseEnter={track}
      onMouseMove={track}
      onMouseLeave={clear}
    >
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[200]"
          style={{
            left: Math.min(Math.max(pos.x, EDGE), window.innerWidth - EDGE),
            top: below ? pos.y + GAP : pos.y - GAP,
            transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
        >
          <div className="w-max max-w-[240px] rounded-lg border border-border bg-background px-2.5 py-2 text-left shadow-lg">
            {content}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default Tip

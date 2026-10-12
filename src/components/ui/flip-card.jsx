// A two-faced card that flips in 3D, tilts toward the pointer and catches a glare.
//
// Everything runs on motion springs rather than CSS transitions, so a flip that is
// interrupted mid-turn (a second click, a drag) carries its velocity instead of
// restarting from rest.
//
// The flip angle is cumulative — 0, 180, 360 — rather than toggling between 0 and 180,
// so every flip turns the same way. Toggling back would spin the card in reverse, which
// reads as an undo rather than a turn.
//
// Drag: horizontal travel (vertical for axis="x") turns the card directly; on release it
// settles on whichever face is nearer, or, with `dragDistance`, flips only once the
// drag has travelled that many pixels. A press that barely moves still counts as a click.
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

// Pixels of travel before a press stops being a click.
const CLICK_SLOP = 4
// Degrees turned per pixel dragged.
const DRAG_GAIN = 0.6

export default function FlipCard({
  front,
  back,
  axis = 'y',
  flipped: flippedProp,         // controlled; omit for uncontrolled
  defaultFlipped = false,
  flipOnClick = true,
  flipOnHover = false,
  draggable = false,
  dragDistance = 0,
  tilt = true,
  tiltMax = 12,
  glare = true,
  glareOpacity = 0.22,
  hoverScale = 1.03,
  perspective = 1100,
  stiffness = 170,
  damping = 20,
  width = 300,
  height = 400,
  radius = 22,
  background = 'var(--color-card)',
  color,
  shadow = true,
  shadowColor = '#000000',
  shadowOpacity = 0.45,
  onFlipChange,
  className,
  style,
}) {
  const controlled = flippedProp !== undefined
  const [innerFlipped, setInnerFlipped] = useState(defaultFlipped)
  const flipped = controlled ? flippedProp : innerFlipped

  const spring = { stiffness, damping }
  const angle = useMotionValue(defaultFlipped ? 180 : 0)
  const angleS = useSpring(angle, spring)
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const tiltXS = useSpring(tiltX, spring)
  const tiltYS = useSpring(tiltY, spring)
  const scale = useSpring(1, spring)
  const glareX = useMotionValue(50)
  const glareY = useMotionValue(50)
  const glareO = useSpring(0, spring)

  const flipOnY = axis !== 'x'
  // The tilt on the flip axis composes with the flip itself. The other tilt is applied
  // in the card's own frame, so on the back face it would point away from the pointer —
  // hence the sign from the current face.
  const rotateY = useTransform(() => (flipOnY ? angleS.get() + tiltYS.get() : tiltYS.get() * faceSign(angleS.get())))
  const rotateX = useTransform(() => (flipOnY ? tiltXS.get() : angleS.get() + tiltXS.get()))
  const glareBg = useTransform(
    () => `radial-gradient(circle at ${glareX.get()}% ${glareY.get()}%, rgba(255,255,255,${glareOpacity}), transparent 60%)`,
  )

  // Keep the angle on the face `flipped` names, turning forward to reach it.
  const lastFlipped = useRef(flipped)
  useEffect(() => {
    const cur = angle.get()
    const onBack = Math.round(cur / 180) % 2 !== 0
    if (onBack !== flipped) angle.set(Math.round(cur / 180) * 180 + 180)
    // Controlled: the parent already heard about this change, it is the one that made it.
    if (lastFlipped.current !== flipped) {
      lastFlipped.current = flipped
      if (!controlled) onFlipChange?.(flipped)
    }
  }, [flipped, angle, onFlipChange, controlled])

  const setFlipped = (next) => {
    if (!controlled) setInnerFlipped(next)
    else onFlipChange?.(next)
  }

  const drag = useRef(null)

  const onPointerDown = (e) => {
    if (!draggable && !flipOnClick) return
    drag.current = { start: flipOnY ? e.clientX : e.clientY, base: angle.get(), moved: 0, id: e.pointerId }
  }

  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    if (tilt) {
      tiltY.set((px - 0.5) * 2 * tiltMax)
      tiltX.set(-(py - 0.5) * 2 * tiltMax)
    }
    if (glare) { glareX.set(px * 100); glareY.set(py * 100) }

    const d = drag.current
    if (!d || !draggable) return
    const delta = (flipOnY ? e.clientX : e.clientY) - d.start
    d.moved = Math.max(d.moved, Math.abs(delta))
    if (d.moved > CLICK_SLOP) {
      if (!e.currentTarget.hasPointerCapture(d.id)) e.currentTarget.setPointerCapture(d.id)
      // Dragging along x turns about y; along y turns about x the other way round.
      angle.set(d.base + (flipOnY ? delta : -delta) * DRAG_GAIN)
    }
  }

  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const delta = (flipOnY ? e.clientX : e.clientY) - d.start
    if (d.moved <= CLICK_SLOP) {
      if (flipOnClick) setFlipped(!flipped)
      return
    }
    // A drag: settle on the nearer face, or flip once it has travelled far enough.
    const target = dragDistance > 0
      ? d.base + (Math.abs(delta) >= dragDistance ? Math.sign(flipOnY ? delta : -delta) * 180 : 0)
      : Math.round(angle.get() / 180) * 180
    angle.set(target)
    const onBack = Math.abs(Math.round(target / 180)) % 2 === 1
    if (onBack !== flipped) {
      // The angle is already where it should be; record the face without re-turning.
      lastFlipped.current = onBack
      if (controlled) onFlipChange?.(onBack)
      else { setInnerFlipped(onBack); onFlipChange?.(onBack) }
    }
  }

  const onEnter = () => {
    scale.set(hoverScale)
    if (glare) glareO.set(1)
    if (flipOnHover) setFlipped(true)
  }
  const onLeave = (e) => {
    tiltX.set(0)
    tiltY.set(0)
    scale.set(1)
    glareO.set(0)
    if (flipOnHover) setFlipped(false)
    if (drag.current) onPointerUp(e)
  }

  const face = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    background,
    color,
  }
  // Inside each face rather than over the card, so it sits on whichever side is up.
  const glareLayer = glare ? (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: glareBg, opacity: glareO, mixBlendMode: 'overlay',
      }}
    />
  ) : null
  const shadowCss = shadow ? `0 18px 40px -12px ${hexA(shadowColor, shadowOpacity)}` : undefined

  return (
    <div
      className={cn('relative select-none', (flipOnClick || draggable) && 'cursor-pointer', className)}
      style={{ width, height, perspective, touchAction: draggable ? 'pan-y' : undefined, ...style }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onLeave}
    >
      <motion.div
        style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', rotateX, rotateY, scale }}
      >
        <div style={{ ...face, boxShadow: shadowCss }}>{front}{glareLayer}</div>
        <div style={{ ...face, boxShadow: shadowCss, transform: flipOnY ? 'rotateY(180deg)' : 'rotateX(180deg)' }}>
          {back}{glareLayer}
        </div>
      </motion.div>
    </div>
  )
}

// +1 on the front face, -1 on the back.
function faceSign(deg) {
  return Math.abs(Math.round(deg / 180)) % 2 === 0 ? 1 : -1
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

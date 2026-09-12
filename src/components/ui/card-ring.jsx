// 3D rotating card ring. Cards sit on the face of a cylinder: the active card faces
// forward at z = 0 and each neighbour is rotated `angleStep` further around the axis and
// pushed out to `radius`, so it recedes with real perspective foreshortening rather than
// a faked scale. Cards past the second neighbour turn far enough to show their mirrored
// backs through the translucent card in front — that see-through depth is the effect.
//
// Geometry is driven by ring-relative offset, not by absolute index, so the ring looks
// identical whether it holds 5 cards or 15: a closed n-gon would spread 15 cards over
// 360deg and flatten the whole thing. Offsets beyond CLAMP_DEPTH are parked in the last
// slot at zero opacity, which hides the wrap-around — the card that jumps from +4 to -4
// does so while invisible.
//
// Dragging spins the ring live: the pointer maps to a fractional card offset that every
// card's angle and opacity read from, with transitions off for the duration, so the ring
// tracks the cursor instead of waiting for the release to jump one card.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

//: Offsets shown on screen: the active card plus two each side = five cards visible.
const VISIBLE_DEPTH = 2
//: Cards are positioned out to one slot beyond that, so a card entering view rotates in
//: from the correct angle rather than unfolding out of the last visible slot.
const CLAMP_DEPTH = VISIBLE_DEPTH + 1

//: How much horizontal room the ring needs, in card widths. The outermost visible card
//: sits at `radius * sin(angleStep)` and is `cardWidth * cos(angleStep)` wide on screen,
//: so at the default geometry the ring spans ~2.1 card widths. Card size is solved back
//: out of the measured container from this, which is what keeps the ghosts inside the
//: panel at every breakpoint instead of being clipped by its overflow.
const RING_SPAN = 2.1

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Shortest signed distance from `active` to `index` around the ring, in steps.
function ringDelta(index, active, count) {
  let d = (index - active) % count
  if (d > count / 2) d -= count
  if (d < -count / 2) d += count
  return d
}

// Opacity by continuous depth, so a half-dragged ring fades between stops instead of
// stepping. Stops: 1 at the front, 0.4 one out, 0.14 two out, gone by three.
function depthOpacity(depth) {
  const d = Math.abs(depth)
  if (d <= 1) return 1 - d * 0.6
  if (d <= 2) return 0.4 - (d - 1) * 0.26
  if (d <= CLAMP_DEPTH) return Math.max(0, 0.14 - (d - 2) * 0.14)
  return 0
}

export function CardRing({
  items,
  renderItem,
  active: controlledActive,
  onActiveChange,
  //: Card size is derived from the container unless `cardWidth` is passed explicitly.
  cardWidth: fixedCardWidth,
  minCardWidth = 140,
  maxCardWidth = 280,
  //: Card height as a multiple of its width.
  heightRatio = 1.3,
  //: Ring radius as a multiple of card width. Two cards `angleStep` apart intersect in
  //: 3D whenever the radius drops below `0.5 / tan(angleStep / 2)` card widths — 0.866
  //: at 60deg. Intersecting planes make the browser interleave them slice by slice,
  //: which is what bleeds a neighbour's text through the front card. Stay just above it.
  radiusRatio = 0.92,
  //: Degrees between neighbours. 60 matches a six-card ring, the reference proportion.
  angleStep = 60,
  perspective = 1500,
  className,
  showArrows = true,
  showDots = true,
  ariaLabel = 'Carousel',
}) {
  const count = items.length
  const hostRef = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  // Measure the containing panel rather than reading breakpoints: the ring shares its
  // row with other panels, so its size does not track the viewport's. The parent is
  // measured, not the host, because the host sizes itself to the ring it is laying out.
  useEffect(() => {
    const el = hostRef.current?.parentElement
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fit to whichever axis runs out first. Vertically the ring costs its card height plus
  // the breathing room above and below (RING_PAD) and the arrows/dots row (CONTROLS).
  const RING_PAD = 40
  const CONTROLS = 44
  const widthLimited = box.width ? box.width / RING_SPAN : minCardWidth
  const heightLimited = box.height
    ? (box.height - RING_PAD - CONTROLS) / heightRatio
    : Infinity
  const cardWidth = fixedCardWidth
    ?? Math.round(Math.min(maxCardWidth, Math.max(minCardWidth, Math.min(widthLimited, heightLimited))))
  const cardHeight = Math.round(cardWidth * heightRatio)

  const [uncontrolled, setUncontrolled] = useState(0)
  // Clamp during render rather than correcting in an effect: when the ring shrinks the
  // stale index would otherwise point past the last card for one frame.
  const rawActive = controlledActive ?? uncontrolled
  const active = count ? Math.min(rawActive, count - 1) : 0

  const setActive = useCallback(
    (next) => {
      const wrapped = count ? ((next % count) + count) % count : 0
      if (onActiveChange) onActiveChange(wrapped)
      if (controlledActive == null) setUncontrolled(wrapped)
    },
    [count, controlledActive, onActiveChange],
  )

  const radius = useMemo(() => cardWidth * radiusRatio, [cardWidth, radiusRatio])

  const prev = () => setActive(active - 1)
  const next = () => setActive(active + 1)

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  }

  // --- drag to spin -------------------------------------------------------------
  // `spin` is the live offset in cards. Every card reads it, so the whole ring turns
  // with the pointer; on release it rounds to the nearest card and the transition
  // animates the snap.
  const drag = useRef(null)
  const [spin, setSpin] = useState(0)
  // Mirrored into state because the render reads it: a ref alone would not re-enable the
  // snap transition on release.
  const [dragging, setDragging] = useState(false)
  const pxPerCard = cardWidth * 0.75

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return
    drag.current = { x: e.clientX, moved: false }
    setDragging(true)
    setSpin(0)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) drag.current.moved = true
    // Dragging right reveals the card to the left, so the offset runs against dx.
    setSpin(-dx / pxPerCard)
  }

  const endDrag = () => {
    if (!drag.current) return
    const settled = Math.round(spin)
    drag.current = null
    setDragging(false)
    setSpin(0)
    if (settled) setActive(active + settled)
  }

  if (!count) return null

  return (
    <div ref={hostRef} className={cn('flex w-full flex-col items-center gap-3', className)}>
      <div
        role="group"
        aria-label={ariaLabel}
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // Without this, grabbing a headshot starts the browser's native image drag and
        // the ring never sees the move events.
        onDragStart={(e) => e.preventDefault()}
        className={cn(
          'relative w-full touch-pan-y select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // Belt and braces with onDragStart: Safari honours the CSS, Firefox the event.
          '[&_img]:select-none [&_img]:[-webkit-user-drag:none]',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ height: cardHeight + RING_PAD, perspective: `${perspective}px` }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-0 w-0"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {items.map((item, i) => {
            const delta = ringDelta(i, active, count)
            // Where the card sits right now, mid-drag included.
            const live = delta - spin
            const depth = Math.abs(live)
            const isActive = delta === 0
            const opacity = depthOpacity(live)
            const slot = Math.sign(delta) * Math.min(Math.abs(delta), CLAMP_DEPTH)
            return (
              <div
                key={item.key ?? i}
                aria-hidden={!isActive}
                onClick={() => {
                  if (!isActive && opacity > 0.3 && !drag.current?.moved) setActive(i)
                }}
                className={cn('absolute', !isActive && opacity > 0.3 && 'cursor-pointer')}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  left: -cardWidth / 2,
                  top: -cardHeight / 2,
                  transform: `rotateY(${(slot - spin) * angleStep}deg) translateZ(${radius}px)`,
                  transformStyle: 'preserve-3d',
                  // Cards turned past 90deg face away; showing the back is what produces
                  // the mirrored ghosts reading through the front card.
                  backfaceVisibility: 'visible',
                  opacity,
                  // No transition while dragging, or the ring lags the pointer.
                  transition: dragging
                    ? 'none'
                    : `transform 700ms ${EASE}, opacity 700ms ${EASE}`,
                  pointerEvents: opacity > 0.05 ? 'auto' : 'none',
                  zIndex: CLAMP_DEPTH + 1 - Math.round(depth),
                }}
              >
                {renderItem(item, { isActive, delta })}
              </div>
            )
          })}
        </div>
      </div>

      {(showArrows || showDots) && (
        <div className="flex w-full items-center justify-between gap-4">
          {showArrows ? (
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : <span />}

          {showDots && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.key ?? i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === active}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === active ? 'w-6 bg-foreground' : 'w-1.5 bg-border hover:bg-muted-foreground',
                  )}
                />
              ))}
            </div>
          )}

          {showArrows ? (
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : <span />}
        </div>
      )}
    </div>
  )
}

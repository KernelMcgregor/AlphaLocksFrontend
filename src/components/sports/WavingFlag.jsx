// Animated flag backdrop for a fighter portrait.
//
// Draws the country flag to a canvas one vertical strip at a time, displacing each
// strip by a sum of sine waves (billow + ripple + two wrinkle frequencies) and
// shading it by the wave slope, which is what sells it as cloth rather than a
// skewed image. Cover-fits at the flag's own 4:3 aspect and oversizes so the waves
// never expose an edge.
//
// Lives here rather than in viz/ because it is fighter identity, not a chart.
import { useEffect, useRef } from 'react'

// flag-icons' SVGs carry a viewBox and no width/height, so Chrome hands them an
// intrinsic size of its own choosing (200×150) — and sub-rect sampling out of such
// an image is unreliable: the strip draws come back short or empty, which is what
// put a band of bare card along the bottom of every flag. The flag is therefore
// rasterised once into an offscreen canvas, and the strips sample from that: a
// canvas source has exact, known pixel bounds. 4:3 is the folder these come from,
// so the aspect is asserted rather than measured.
const FLAG_ASPECT = 4 / 3
// Rasterise above display size; the strips stretch the flag vertically, and
// sampling a 1:1 buffer through that made the colour boundaries mushy.
const SUPERSAMPLE = 2

// Is every column of the flag a single colour down its height?
//
// This decides how a flag is fitted into a box much taller than 4:3. Cover-fitting such a
// box crops to a ~10% central slice — fine for the USA or Brazil, where that slice still
// reads as the flag, but on a vertical tricolour (France, Italy, Ireland, Nigeria,
// Belgium, Romania) the slice is one flat band and reads as no flag at all.
//
// The fix for those is to show the full width and stretch vertically — and on a flag that
// passes this test the stretch is *invisible*, because there is nothing along the y axis
// to distort. Anything with horizontal structure fails and keeps the aspect-preserving
// cover-fit, so the flags that already look right are untouched.
//
// Band boundaries blur under downsampling, but a blurred boundary column is still uniform
// down its height, so it passes. A flag with a central emblem (Mexico, Spain, Portugal)
// does not, and correctly keeps cover-fit.
const UNIFORM_TOLERANCE = 18

function isVerticallyUniform(img) {
  const W = 48
  const H = 36
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const cx = c.getContext('2d', { willReadFrequently: true })
  cx.drawImage(img, 0, 0, W, H)
  let data
  // A tainted canvas throws here. Treating that as "not uniform" keeps the current
  // cover-fit, which is the safe direction to fail in.
  try { data = cx.getImageData(0, 0, W, H).data } catch { return false }
  for (let x = 0; x < W; x++) {
    const top = x * 4
    for (let y = 1; y < H; y++) {
      const i = (y * W + x) * 4
      if (
        Math.abs(data[i] - data[top]) > UNIFORM_TOLERANCE ||
        Math.abs(data[i + 1] - data[top + 1]) > UNIFORM_TOLERANCE ||
        Math.abs(data[i + 2] - data[top + 2]) > UNIFORM_TOLERANCE
      ) return false
    }
  }
  return true
}

export default function WavingFlag({ countryCode }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!countryCode) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = new URL(`/node_modules/flag-icons/flags/4x3/${countryCode.toLowerCase()}.svg`, import.meta.url).href

    // The rasterised flag, rebuilt only when the box it has to cover changes.
    let buf = null
    let bufFor = ''
    // Set once the image is decoded; see isVerticallyUniform.
    let uniform = false

    let frame
    let t = 0

    const draw = () => {
      // Match canvas pixels to display size
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
      }
      const W = canvas.width
      const H = canvas.height
      if (!W || !H || !img.complete || !img.naturalWidth) { frame = requestAnimationFrame(draw); return }

      // Cover-fit the flag at its own aspect ratio, then oversize so the waves
      // never reveal an edge. Scaling W and H independently (the previous
      // behaviour) stretched the flag whenever the container's aspect changed —
      // which it now does constantly, since the portrait flexes with the column.
      //
      // The width-fit branch applies only to a flag with no horizontal structure in a
      // box taller than 4:3 — see isVerticallyUniform. Both conditions matter: the
      // stretch is only invisible on such a flag, and only needed in such a box.
      let flagW
      let flagH
      if (uniform && W / H < FLAG_ASPECT) {
        flagW = W * 1.04
        flagH = H * 1.18
      } else {
        // The oversize exists only so the wave can never expose an edge, and the wave
        // needs very little: a strip is squashed to at most ~0.945 of flagH, so 1.08
        // guarantees coverage (0.945 * 1.08 > 1). It used to be 1.3, which on a tall
        // column magnified the flag by a further 20% for no reason — aspect-preserving
        // cover already crops hard there, and every extra bit of scale crops more.
        const scale = 1.08
        const boxAspect = W / H
        const baseW = boxAspect > FLAG_ASPECT ? W : H * FLAG_ASPECT
        const baseH = boxAspect > FLAG_ASPECT ? W / FLAG_ASPECT : H
        flagW = baseW * scale
        flagH = baseH * scale
      }
      const ox = (W - flagW) / 2
      const oy = (H - flagH) / 2

      const key = `${Math.round(flagW)}x${Math.round(flagH)}`
      if (bufFor !== key) {
        buf = buf || document.createElement('canvas')
        buf.width = Math.max(1, Math.ceil(flagW * SUPERSAMPLE))
        buf.height = Math.max(1, Math.ceil(flagH * SUPERSAMPLE))
        // Whole-image form only — see the note on FLAG_ASPECT.
        buf.getContext('2d').drawImage(img, 0, 0, buf.width, buf.height)
        bufFor = key
      }

      ctx.clearRect(0, 0, W, H)
      t += 0.02

      for (let i = 0; i < Math.ceil(flagW); i++) {
        const nx = i / flagW

        // Primary billow wave — large, slow
        const amp1 = 4 + 12 * nx * nx
        const wave1 = Math.sin(nx * 3.5 + t * 2.0) * amp1

        // Secondary ripple — faster, smaller
        const amp2 = 2 + 5 * nx
        const wave2 = Math.sin(nx * 8 - t * 3.2) * amp2 * 0.4

        // Wrinkle — high frequency, subtle, varies over time
        const wrinkle = Math.sin(nx * 22 + t * 4.5) * (1.5 + 3 * nx) * 0.35
        const wrinkle2 = Math.sin(nx * 35 - t * 2.8) * (1 + 2 * nx) * 0.2

        const dy = wave1 + wave2 + wrinkle + wrinkle2

        // Vertical stretch from wave compression
        const stretch = 1 + 0.04 * Math.cos(nx * 5 + t * 2) + 0.015 * Math.sin(nx * 18 + t * 3.5)

        // Lighting from primary wave slope + wrinkle detail
        const slope = Math.cos(nx * 3.5 + t * 2.0)
        const detail = Math.cos(nx * 22 + t * 4.5) * 0.4

        const sx = nx * buf.width
        const sw = Math.max(1, buf.width / flagW)

        const dx = ox + i
        const drawH = flagH * stretch
        // Belt and braces on top of the oversize: whatever the wave asks for, a
        // strip never starts below the top edge or ends above the bottom one, so
        // no combination of trough and squash can uncover the card behind.
        const drawY = Math.min(0, Math.max(H - drawH, oy + dy))

        ctx.drawImage(buf, sx, 0, sw, buf.height, dx, drawY, 1.5, drawH)

        // Lighting — broad shading + wrinkle highlights
        const light = slope * 0.08 + detail * 0.05
        if (light > 0) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(light, 0.15)})`
        } else {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(-light, 0.18)})`
        }
        ctx.fillRect(dx, drawY, 1.5, drawH)
      }

      frame = requestAnimationFrame(draw)
    }

    const start = () => {
      uniform = isVerticallyUniform(img)
      frame = requestAnimationFrame(draw)
    }
    img.onload = start
    if (img.complete && img.naturalWidth) start()

    return () => cancelAnimationFrame(frame)
  }, [countryCode])

  if (!countryCode) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
    />
  )
}

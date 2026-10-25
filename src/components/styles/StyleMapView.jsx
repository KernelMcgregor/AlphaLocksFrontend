// Style map: every fighter placed so that similar styles sit together — a frozen t-SNE
// of the era-adjusted style space. It keeps local neighbourhoods better than any other
// 2D layout we measured (~38% of a fighter's 8 closest matches land among their 8
// nearest dots; PCA/Isomap/spectral manage 5-20%), so only neighbourhoods are meaningful.
//
// Families read as territories: each family's members are washed in its colour and its
// name sits in a pill at the family's densest point, not at its mean (families are not
// contiguous, and a mean can land in someone else's region).
//
// Comp lines come from the similarity table, which since style space v4 is built from this
// same fingerprint — so a fighter's comps sit near them on the map.
// Canvas, not SVG: ~1,500 marks redrawn on every pan and zoom.
import { CircleDashed, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FighterImage from '../sports/FighterImage'
import { cn } from '../../lib/utils'
import { famColor, famColorsResolved } from '../../lib/styleTraits'
import { fighterImageUrl } from '../../lib/api'
import silhouette from '../../assets/fighter-silhouette.webp'
import { useStyleDetail } from '../../hooks/useStyleDetail'
import { useDivisionRanks } from '../../hooks/useDivisionRanks'
import { FighterBioCard } from './FighterBioCard'
import { bioPlan, useRailFit } from './railFit'
import { FighterCard, FighterPicker, SectionLabel, TraitBar } from './shared'

const PAD = 30
const MAX_ZOOM = 14
const N_COMPS = 5
// Zoomed in this far, dots become headshots: a circle cropped like FighterImage
// (square from the top of the portrait), ringed in the family colour.
const HEADSHOT_ZOOM = 4.5
// Area lens: a fixed-size circle that follows the mouse over the map; the panel
// summarises who is inside it. Fixed on screen, so zooming in narrows the area.
const LENS_PX = 70
const LENS_TRAITS = 5
const LENS_PEOPLE = 5

// The left rail is exactly the screen's height and never scrolls. When its content does
// not fit, these steps are applied one at a time, least important first, until it does:
// a big monitor shows everything, a laptop only the essentials.
const FIT_STEPS = [
  'bio:career', 'people', 'people', 'bio:stance', 'sim', 'traits', 'people', 'bio:reach',
  'sim', 'traits', 'portrait', 'compact', 'people', 'bio:body', 'sim', 'traits',
]
function fitPlan(drop) {
  const steps = FIT_STEPS.slice(0, drop)
  const n = (k) => steps.filter((x) => x === k).length
  return { ...bioPlan(steps), sim: 5 - n('sim'), traits: LENS_TRAITS - n('traits'), people: LENS_PEOPLE - n('people') }
}

// Everything the lens panel shows, for the fighters inside it. Fighters are weighted by a
// Gaussian on their distance from the centre (sd = half the radius), so one fighter
// crossing the edge barely moves the numbers: they drift as the circle moves, not jump.
const LENS_TRAIT_KEEP = 9   // a listed trait stays until it falls below this rank
function lensSummary(fighters, at, project, habitKeys, nFam) {
  // Screen space: the circle is LENS_PX on screen, whatever the zoom or map shape.
  const sd2 = 2 * (LENS_PX / 2) ** 2
  const inside = []
  for (const f of fighters) {
    const [px, py] = project(f)
    const d2 = (px - at[0]) ** 2 + (py - at[1]) ** 2
    if (d2 <= LENS_PX ** 2) inside.push({ f, w: Math.exp(-d2 / sd2) })
  }
  const W = inside.reduce((a, x) => a + x.w, 0) || 1
  const mix = Array.from({ length: nFam }, () => 0)
  for (const { f, w } of inside) for (const b of f.blend || [{ family: f.family, share: 1 }]) mix[b.family] += b.share * w
  const avg = (habitKeys || []).map((_, i) => {
    let s = 0, ws = 0
    for (const { f, w } of inside) { const v = f.habits?.[i]; if (v != null) { s += v * w; ws += w } }
    return ws ? s / ws : null
  })
  const ranked = (habitKeys || []).map((k, i) => ({ k, v: avg[i] })).filter((t) => t.v != null)
    .sort((a, b) => Math.abs(b.v - 50) - Math.abs(a.v - 50))
  // "Who's here": how closely each fighter's habits match the area's average profile
  // (cosine around the 50th percentile), best first.
  const dev = avg.map((v) => (v == null ? 0 : v - 50))
  const norm = Math.hypot(...dev) || 1
  const people = inside.map(({ f }) => {
    const x = (f.habits || []).map((v) => (v == null ? 0 : v - 50))
    const n = Math.hypot(...x) || 1
    return { f, match: x.reduce((a, v, i) => a + v * dev[i], 0) / (n * norm) }
  }).sort((a, b) => b.match - a.match)
  return {
    n: inside.length,
    prime: inside.length ? Math.round(inside.reduce((a, { f, w }) => a + f.prime_year * w, 0) / W) : null,
    mix: mix.map((v, fam) => ({ family: fam, share: v / W })).filter((m) => m.share >= 0.03).sort((a, b) => b.share - a.share),
    ranked, people,
  }
}

// Keep the listed traits steady: a trait already shown stays while it is still in the top
// LENS_TRAIT_KEEP; only the freed slots take the new leaders.
function stickyTraits(prev, ranked) {
  const order = ranked.map((t) => t.k)
  const keep = prev.filter((k) => { const i = order.indexOf(k); return i >= 0 && i < LENS_TRAIT_KEEP })
  for (const k of order) { if (keep.length >= LENS_TRAITS) break; if (!keep.includes(k)) keep.push(k) }
  return keep.slice(0, LENS_TRAITS)
}

// At rest, label this many of the best active fighters per family so the map has
// landmarks before anyone clicks.
const LANDMARKS_PER_FAMILY = 2

function useThemeTick() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const mo = new MutationObserver(() => setTick((t) => t + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => mo.disconnect()
  }, [])
  return tick
}

// The family member with the most same-family neighbours nearby: where the family is
// densest, which is where its label belongs.
function familyCores(fighters, nFam, radius) {
  return Array.from({ length: nFam }, (_, fam) => {
    const pts = fighters.filter((f) => f.family === fam)
    let best = pts[0]
    let bestN = -1
    for (const p of pts) {
      let n = 0
      for (const q of pts) if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < radius * radius) n++
      if (n > bestN) { bestN = n; best = p }
    }
    return best
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function StyleMapView({ data, byId, fighterId, onSelect }) {
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const isolated = null   // family isolation was removed with the families legend
  const [hover, setHover] = useState(null)
  // Cursor: an open hand over the map (it pans), a closed fist while dragging, and a
  // pointer over a fighter (a click selects them).
  const [grabbing, setGrabbing] = useState(false)
  // Last lens position in map units ({x, y, r}); kept when the mouse leaves so the panel
  // keeps the last area. lensOn = the mouse is over the map, so the circle is drawn.
  const [lens, setLens] = useState(null)
  const [lensOn, setLensOn] = useState(false)
  const themeTick = useThemeTick()
  const ranks = useDivisionRanks()
  const selected = byId.get(fighterId)
  // Comps ship inline with every fighter in /ufc/styles, so switching fighters is instant.
  // The per-fighter request is only a fallback for a backend that predates that; while it
  // loads, the last comps stay (faded) so the panel never collapses and re-expands.
  const inline = selected?.comps
  const { detail, loading } = useStyleDetail(inline ? null : fighterId)
  const fresh = useMemo(() => {
    if (inline) return inline.slice(0, N_COMPS).map((c) => byId.get(c.id) && { ...byId.get(c.id), similarity: c.similarity }).filter(Boolean)
    return detail ? (detail.comps || []).slice(0, N_COMPS) : null
  }, [inline, byId, detail])
  const [lastComps, setLastComps] = useState([])
  if (fresh && fresh !== lastComps) setLastComps(fresh)   // adjust state on new data, React's documented pattern
  const comps = fresh || lastComps
  const stale = !fresh && loading

  // Headshot cache for the zoomed-in map: id -> HTMLImageElement once loaded, or the
  // silhouette after an error. Loading one bumps imgTick so the canvas redraws.
  const imgs = useRef(new Map())
  const [imgTick, setImgTick] = useState(0)
  const headshot = useCallback((f) => {
    const hit = imgs.current.get(f.id)
    if (hit !== undefined) return hit && hit.complete && hit.naturalWidth ? hit : null
    const img = new Image()
    imgs.current.set(f.id, img)
    img.onload = () => setImgTick((t) => t + 1)
    img.onerror = () => {
      if (img.src.endsWith(silhouette)) return
      img.src = silhouette
    }
    img.src = fighterImageUrl(f) || silhouette
    return null
  }, [])

  const visible = useCallback((f) => isolated == null || f.family === isolated, [isolated])

  const landmarks = useMemo(() => {
    const per = new Map()
    const out = []
    for (const f of [...data.fighters].filter((f) => f.active).sort((a, b) => b.quality - a.quality)) {
      const n = per.get(f.family) || 0
      if (n < LANDMARKS_PER_FAMILY) { per.set(f.family, n + 1); out.push(f) }
    }
    return out
  }, [data])

  const cores = useMemo(() => familyCores(data.fighters, data.families.length, 0.07), [data])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // One scale for both axes, centred, so a wide stage never stretches the layout.
  // Fill the whole stage: x and y are scaled separately to the fighters' actual extent,
  // so a wide screen gets a wide map instead of a square with empty bands either side.
  // (The layout's axes carry no meaning of their own; only neighbourhoods do.)
  const ext = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const f of data.fighters) { x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x); y0 = Math.min(y0, f.y); y1 = Math.max(y1, f.y) }
    return { x0, y1, w: (x1 - x0) || 1, h: (y1 - y0) || 1 }
  }, [data])
  const sx = Math.max(0, size.w - 2 * PAD) / ext.w
  const sy = Math.max(0, size.h - 2 * PAD) / ext.h
  const side = Math.max(0, Math.min(size.w, size.h) - 2 * PAD)
  const project = useCallback((f) => (
    [(PAD + (f.x - ext.x0) * sx) * view.k + view.x, (PAD + (ext.y1 - f.y) * sy) * view.k + view.y]
  ), [ext, sx, sy, view])
  // Off the map, the circle rests on the selected fighter.
  const lensPt = useMemo(() => (lensOn && lens ? lens : selected ? { x: selected.x, y: selected.y } : null), [lensOn, lens, selected])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !size.w) return
    const dpr = window.devicePixelRatio || 1
    cv.width = size.w * dpr
    cv.height = size.h * dpr
    const ctx = cv.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    const cs = getComputedStyle(document.documentElement)
    const ink = cs.getPropertyValue('--color-foreground').trim()
    const card = cs.getPropertyValue('--color-card').trim()
    const muted = cs.getPropertyValue('--color-muted-foreground').trim()
    const fam = famColorsResolved()
    const font = (w, px) => `${w} ${px}px system-ui, -apple-system, sans-serif`
    const shown = data.fighters.filter(visible)

    // Territories: a wide, faint wash under each family's members.
    const washR = Math.max(14, side * 0.03 * Math.sqrt(view.k))
    ctx.globalAlpha = selected ? 0.03 : 0.06
    for (const f of shown) {
      const [px, py] = project(f)
      ctx.beginPath()
      ctx.arc(px, py, washR, 0, Math.PI * 2)
      ctx.fillStyle = fam[f.family]
      ctx.fill()
    }

    // Dots: retired first, active on top, so the current roster is never buried.
    const compIds = new Set(comps.map((c) => c.id))
    const focus = selected ? new Set([selected.id, ...compIds]) : null
    const lensC = lens && lensOn ? project(lens) : null
    const heads = view.k >= HEADSHOT_ZOOM
    const r = heads
      ? Math.min(20, 9 + 2.2 * (view.k - HEADSHOT_ZOOM))
      : Math.max(2.6, Math.min(5.5, 2.8 * Math.sqrt(view.k)))
    const drawHead = (f, rad, px, py) => {
      const img = headshot(f)
      ctx.save()
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      ctx.fillStyle = card
      ctx.fill()
      if (img) {
        ctx.clip()
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        ctx.drawImage(img, (img.naturalWidth - s) / 2, 0, s, s, px - rad, py - rad, rad * 2, rad * 2)
      }
      ctx.restore()
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      ctx.lineWidth = 2.5
      ctx.strokeStyle = fam[f.family]
      ctx.stroke()
    }
    for (const pass of [false, true]) {
      for (const f of shown) {
        if (f.active !== pass) continue
        const [px, py] = project(f)
        ctx.globalAlpha = lensC
          ? (((px - lensC[0]) ** 2 + (py - lensC[1]) ** 2 <= LENS_PX ** 2) ? (f.active ? 0.95 : 0.6) : (f.active ? 0.35 : 0.15))
          : focus ? (focus.has(f.id) ? 1 : 0.18) : f.active ? 0.9 : 0.4
        if (heads) {
          // Only what is on screen: a headshot is a network fetch the first time.
          if (px < -r || py < -r || px > size.w + r || py > size.h + r) continue
          drawHead(f, r, px, py)
          continue
        }
        ctx.beginPath()
        ctx.arc(px, py, f.active ? r : r * 0.8, 0, Math.PI * 2)
        ctx.fillStyle = fam[f.family]
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // Family name pills at each family's densest point.
    ctx.font = font(800, 11.5)
    const pills = []
    data.families.forEach((family, i) => {
      if ((isolated != null && i !== isolated) || !cores[i]) return
      const [px, py] = project(cores[i])
      const text = family.name.toUpperCase()
      const w = ctx.measureText(text).width + 16
      let y = py - 11
      // Step down past any pill already placed on this spot.
      for (let guard = 0; guard < 6 && pills.some((b) => px - w / 2 < b.x1 && px + w / 2 > b.x0 && y < b.y1 && y + 22 > b.y0); guard++) y += 24
      pills.push({ x0: px - w / 2, x1: px + w / 2, y0: y, y1: y + 22 })
      ctx.globalAlpha = selected ? 0.55 : 0.95
      roundRect(ctx, px - w / 2, y, w, 22, 11)
      ctx.fillStyle = fam[i]
      ctx.fill()
      ctx.globalAlpha = selected ? 0.8 : 1
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.fillText(text, px, y + 15)
    })
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1

    const placed = [...pills]
    const label = (f, strong) => {
      const [px, py] = project(f)
      ctx.font = font(strong ? 800 : 650, strong ? 13 : 11.5)
      const w = ctx.measureText(f.name).width
      // Flip to the left of the dot rather than run off the right edge.
      const x = px + 8 + w > size.w - 6 ? px - 8 - w : px + 8
      const y = py - 6
      const box = { x0: x - 2, y0: y - 12, x1: x + w + 2, y1: y + 3 }
      if (!strong && placed.some((b) => !(box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1))) return
      placed.push(box)
      ctx.lineWidth = 3.5
      ctx.strokeStyle = card
      ctx.strokeText(f.name, x, y)
      ctx.fillStyle = strong ? ink : muted
      ctx.fillText(f.name, x, y)
    }
    const ring = (f, rad, strong) => {
      const [px, py] = project(f)
      if (heads) {
        // Keep the face; mark focus with an outer ring instead of a filled dot.
        drawHead(f, r, px, py)
        ctx.beginPath()
        ctx.arc(px, py, r + 2.5, 0, Math.PI * 2)
        ctx.lineWidth = strong ? 2.5 : 1.5
        ctx.strokeStyle = strong ? ink : fam[f.family]
        ctx.stroke()
        return
      }
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      ctx.fillStyle = fam[f.family]
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = strong ? ink : card
      ctx.stroke()
    }

    if (selected) {
      const [sx0, sy0] = project(selected)
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.3
      for (const c of comps) {
        const [cx, cy] = project(c)
        ctx.globalAlpha = 0.25 + 0.75 * Math.max(0, (c.similarity - 0.5) / 0.5)
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(cx, cy); ctx.stroke()
      }
      ctx.globalAlpha = 1
      for (const c of comps) ring(c, r + 1.5, false)
      ring(selected, r + 3.5, true)
      label(selected, true)
      for (const c of comps) label(c, false)
    } else {
      for (const f of landmarks) if (visible(f)) label(f, false)
    }
    if (hover && hover.id !== selected?.id) ring(hover, r + 2.5, true)

    if (lensPt) {
      const [lx, ly] = project(lensPt)
      ctx.beginPath()
      ctx.arc(lx, ly, LENS_PX, 0, Math.PI * 2)
      ctx.globalAlpha = 0.05
      ctx.fillStyle = ink
      ctx.fill()
      ctx.globalAlpha = 0.8
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 1.5
      ctx.strokeStyle = ink
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }
  }, [data, size, side, view, isolated, hover, selected, comps, landmarks, cores, visible, project, themeTick, headshot, imgTick, lens, lensOn, lensPt])

  // Screen <-> map units, the inverse of project().
  const unproject = useCallback((mx, my) => (
    { x: ((mx - view.x) / view.k - PAD) / sx + ext.x0, y: ext.y1 - ((my - view.y) / view.k - PAD) / sy }
  ), [ext, sx, sy, view])
  const moveLens = (mx, my) => { setLens(unproject(mx, my)); setLensOn(true) }
  // The panel follows the circle a beat behind (debounced), so the words settle rather
  // than flicker while the mouse is moving.
  const [settled, setSettled] = useState(null)
  useEffect(() => {
    if (!lensPt || !size.w) return undefined
    const t = setTimeout(() => setSettled(project(lensPt)), 90)
    return () => clearTimeout(t)
  }, [lensPt, project, size.w])
  // The selected fighter is left out: the area describes who is around them.
  const others = useMemo(() => data.fighters.filter((f) => f.id !== selected?.id), [data, selected])
  const hovered = useMemo(() => (settled ? lensSummary(others, settled, project, data.habit_keys, data.families.length) : null), [settled, others, project, data])
  // A circle with nobody in it falls back to the circle around the selected fighter.
  const around = useMemo(() => (selected && size.w ? lensSummary(others, project(selected), project, data.habit_keys, data.families.length) : null),
    [selected, others, project, data, size.w])
  const showingAround = !hovered?.n
  const area = showingAround ? around : hovered
  const [traitKeys, setTraitKeys] = useState([])
  const nextKeys = area ? stickyTraits(traitKeys, area.ranked) : traitKeys
  if (nextKeys.join() !== traitKeys.join()) setTraitKeys(nextKeys)
  const areaTraits = area ? nextKeys.map((k) => area.ranked.find((t) => t.k === k)).filter(Boolean) : []
  const areaPeople = area ? area.people.slice(0, LENS_PEOPLE) : []

  const nearest = (mx, my) => {
    let best = null
    const reach = view.k >= HEADSHOT_ZOOM ? Math.min(20, 9 + 2.2 * (view.k - HEADSHOT_ZOOM)) : 14
    let bd = reach * reach
    for (const f of data.fighters) {
      if (!visible(f)) continue
      const [px, py] = project(f)
      const d = (px - mx) ** 2 + (py - my) ** 2
      if (d < bd) { bd = d; best = f }
    }
    return best
  }

  const drag = useRef(null)
  const local = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }
    setGrabbing(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (d) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
      if (d.moved) { setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy })); setHover(null); setLensOn(false); return }
    }
    const [mx, my] = local(e)
    moveLens(mx, my)
    setHover(nearest(mx, my))
  }
  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    setGrabbing(false)
    if (d && !d.moved) {
      const [mx, my] = local(e)
      const f = nearest(mx, my)
      if (f) onSelect(f.id)
    }
  }

  // Wheel zoom about the cursor. Attached natively: React's onWheel is passive, so it
  // cannot stop the page from scrolling underneath the map.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const rect = cv.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView((v) => {
        const k = Math.min(MAX_ZOOM, Math.max(1, v.k * Math.exp(-e.deltaY * 0.0015)))
        const f = k / v.k
        return { k, x: mx - (mx - v.x) * f, y: my - (my - v.y) * f }
      })
    }
    cv.addEventListener('wheel', onWheel, { passive: false })
    return () => cv.removeEventListener('wheel', onWheel)
  }, [])

  const hoverPos = hover ? project(hover) : null

  const [asideRef, drop] = useRailFit(FIT_STEPS.length, fighterId, [area, comps, size.h])
  const r0 = selected ? ranks[selected.id] : null
  const plan = fitPlan(drop)
  const row = (f, score, key) => (
    <li key={key}>
      <button onClick={() => onSelect(f.id)} className="flex w-full items-center gap-2.5 rounded-md px-1 py-0.5 text-left hover:bg-muted/60">
        <FighterImage fighter={f} className="h-8 w-8 shrink-0 rounded-full bg-muted" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{f.name}</span>
        <span className="shrink-0 text-[13px] font-extrabold tabular-nums">{score.toFixed(2)}</span>
      </button>
    </li>
  )

  // Left rail: the selected fighter's card as on their profile page (portrait, bio, style,
  // most similar), then the area under the circle.
  const aside = (
    <aside ref={asideRef} className="flex min-h-0 flex-col gap-3 lg:order-1 lg:h-full lg:overflow-hidden">
      {selected ? (
        <FighterBioCard fighter={selected} families={data.families} rank={r0} hideBio={plan.hideBio} portrait={plan.portrait} compact={plan.compact}>
          <SectionLabel className="mb-1 mt-2 border-t pt-2">Most similar</SectionLabel>
          <ol className={cn('space-y-0.5 transition-opacity', stale && 'opacity-40')}>
            {comps.slice(0, plan.sim).map((c) => row(c, c.similarity, c.id))}
          </ol>
        </FighterBioCard>
      ) : (
        <div className="shrink-0 rounded-lg border border-border bg-card p-3">
          <p className="text-[12.5px] text-muted-foreground">Search for a fighter on the map.</p>
        </div>
      )}

      {/* grow: takes whatever height the trimmed rail leaves, so its bottom always lines up
          with the map's. shrink-0 keeps it from squeezing below its content, which is what
          the fit check measures. */}
      <div className="shrink-0 grow rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <CircleDashed className="h-4 w-4 shrink-0" />
          <span className="truncate text-[14px] font-extrabold tracking-tight">{showingAround && selected ? `Around ${selected.name}` : 'This area'}</span>
          {area?.n > 0 && <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{area.n} fighters · prime ~{area.prime}</span>}
        </div>
        {!area || !area.n ? (
          <p className="mt-2 text-[12px] text-muted-foreground">Nobody nearby.</p>
        ) : (
          <>
            <div className="mt-2 flex h-[8px] w-full overflow-hidden rounded-full bg-muted">
              {area.mix.map((m) => <div key={m.family} style={{ width: `${m.share * 100}%`, background: famColor(m.family) }} />)}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
              {area.mix.map((m) => (
                <span key={m.family} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: famColor(m.family) }} />
                  <span className="font-semibold">{data.families[m.family]?.name}</span>
                  <span className="tabular-nums text-muted-foreground">{Math.round(m.share * 100)}%</span>
                </span>
              ))}
            </div>
            <SectionLabel className="mb-1.5 mt-3">Stands out for</SectionLabel>
            <div className="space-y-1.5">
              {areaTraits.slice(0, plan.traits).map((t) => <TraitBar key={t.k} trait={t.k} value={Math.round(t.v)} compact />)}
            </div>
            <SectionLabel className="mb-1 mt-3">Who's here · closest to the area's style</SectionLabel>
            <ol className="space-y-0.5">
              {areaPeople.slice(0, plan.people).map((p) => row(p.f, p.match, `a${p.f.id}`))}
            </ol>
          </>
        )}
      </div>
    </aside>
  )

  return (
    // Fills the page body exactly, so the map and the right-hand column end level with
    // the sidebar instead of scrolling.
    <div className="grid h-full gap-3 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(0,1fr)]">
      {aside}
      <div ref={stageRef} className="relative min-h-[460px] w-full overflow-hidden rounded-lg border border-border bg-card lg:order-2 lg:min-h-0">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Map of fighters placed by style similarity"
          className={cn('block h-full w-full touch-none', grabbing ? 'cursor-grabbing' : hover ? 'cursor-pointer' : 'cursor-grab')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { setHover(null); setLensOn(false) }}
          onDoubleClick={() => setView({ k: 1, x: 0, y: 0 })}
        />
        <FighterPicker fighters={data.fighters} placeholder="Search fighters…"
          className="absolute left-2 top-2 z-20 w-[260px] shadow-sm" onPick={(id) => onSelect(id)} />
        {(view.k !== 1 || view.x !== 0 || view.y !== 0) && (
          <button onClick={() => setView({ k: 1, x: 0, y: 0 })}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11.5px] font-semibold text-muted-foreground shadow-sm hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Reset view
          </button>
        )}
        {hover && hoverPos && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[240px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-border bg-background px-2.5 py-2 text-left shadow-lg"
            style={{ left: hoverPos[0], top: hoverPos[1] }}
          >
            <FighterCard fighter={hover} ranks={ranks} />
          </div>
        )}
      </div>

    </div>
  )
}

// Style tree: every style-eligible fighter on one zoomable canvas.
//
//   Down        = time: a fighter sits at their UFC debut (first fight).
//   Left→right  = how they fight, strikers to grapplers: each fighter's family blend
//                 weighted onto a fixed strike↔grapple axis (FAM_X), then rank-spread so
//                 the width is used evenly. The labels along the top name what each band
//                 of the width is (its dominant family + that family's centroid traits).
//   Lines       = a fighter's 1–2 closest style ancestors (style_page_service.ancestors:
//                 debuted 4+ years earlier, era-adjusted space). The first is the primary
//                 line, the second a thinner crossover, so the tree is really a DAG.
//
// Search (or click) a fighter to isolate their heritage: UP_GENS generations of influences
// and DOWN_GENS of heirs stay lit, the rest fades, and their primary line is drawn darkest.
// Drag to pan, scroll to zoom.
//
// Performance: nodes and links are a memoised layer under one <g transform>, so panning
// and zooming only rewrite that transform. Labels are placed once the view settles.
import { Maximize2, Minus, Plus, X as XIcon } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { divisionLabel, famColor, styleLabel, traitLabel } from '../../lib/styleTraits'
import { FighterPicker, Panel } from './shared'
import { FighterBioCard } from './FighterBioCard'
import { bioPlan, useRailFit } from './railFit'
import { useDivisionRanks } from '../../hooks/useDivisionRanks'

// Ancestors below this similarity don't get a line. Tune against the live sim
// distribution — too low and the hubs near the middle of the space collect everyone.
const MIN_LINK_SIM = 0.45
const MAX_PARENTS = 2
// Strike↔grapple position of each family id (RANGE, POUNCE, PATIENT, WRESTLE).
const FAM_X = [0, 0.3, 0.7, 1]
const SLOT = 15 // min world-px between two fighters debuting in the same year

// UFC debut as a decimal year: the tree's time axis. Falls back to the debut year.
const debutOf = (f) => {
  if (!f.first_fight) return f.first_year + 0.5
  const d = new Date(`${f.first_fight}T00:00:00`)
  return d.getFullYear() + (d - new Date(d.getFullYear(), 0, 1)) / 3.15576e10
}
const UP_GENS = 4
const DOWN_GENS = 3
const PAD = 110
const MAX_LABELS = 160
const PAN_MARGIN = 40
const ERAS = [
  [1993, 2001, 'Early UFC'], [2001, 2005, 'Zuffa'], [2005, 2011, 'TUF boom'],
  [2011, 2016, 'FOX era'], [2016, 2021, 'Modern'], [2021, 2030, 'APEX era'],
]

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 1000) / 1000 }
const lastName = (n) => n.split(' ').slice(-1)[0]
const years = (f) => `${f.first_year}–${f.active ? 'now' : f.last_year}`

function useSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height)
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

function buildGraph(fighters, byId) {
  const parents = new Map(), children = new Map(), links = []
  for (const f of fighters) {
    const list = (f.ancestors || [])
      .filter((a) => a.sim >= MIN_LINK_SIM && byId.has(a.id)).slice(0, MAX_PARENTS)
    parents.set(f.id, list)
    list.forEach((a, i) => {
      links.push({ from: a.id, to: f.id, sim: a.sim, primary: i === 0 })
      if (!children.has(a.id)) children.set(a.id, [])
      children.get(a.id).push({ id: f.id, sim: a.sim, primary: i === 0 })
    })
  }
  for (const l of children.values()) l.sort((a, b) => b.sim - a.sim)
  // Primary parents always debuted earlier, so primary links form a forest:
  // walk latest-first and every child is sized before its parent.
  const sub = new Map()
  for (const f of [...fighters].sort((a, b) => debutOf(b) - debutOf(a))) {
    sub.set(f.id, 1 + (children.get(f.id) || []).filter((c) => c.primary).reduce((s, c) => s + (sub.get(c.id) || 1), 0))
  }
  const dep = new Map()
  let depth = 0
  for (const f of [...fighters].sort((a, b) => debutOf(a) - debutOf(b))) {
    const p = parents.get(f.id)[0]
    const d = p ? (dep.get(p.id) ?? 0) + 1 : 0
    dep.set(f.id, d)
    depth = Math.max(depth, d)
  }
  const roots = fighters.filter((f) => !parents.get(f.id).length).length
  return { parents, children, links, sub, depth: depth + 1, roots }
}

function layoutX(fighters, families) {
  const score = (f) => (f.blend?.length ? f.blend : [{ family: f.family, share: 1 }])
    .reduce((s, b) => s + b.share * (FAM_X[b.family] ?? 0.5), 0)
  const ranked = [...fighters].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))
  const u = new Map(ranked.map((f, i) => [f.id, i / Math.max(1, ranked.length - 1)]))
  const rows = new Map()
  for (const f of fighters) {
    const k = Math.round(debutOf(f))
    if (!rows.has(k)) rows.set(k, [])
    rows.get(k).push(f)
  }
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length))
  const WW = Math.max(1200, widest * SLOT * 1.15)
  const xs = new Map()
  for (const list of rows.values()) {
    const it = list.map((f) => ({ f, t: u.get(f.id) * WW })).sort((a, b) => a.t - b.t)
    let last = -Infinity
    for (const o of it) { o.x = Math.max(o.t, last + SLOT); last = o.x }
    const off = it.reduce((s, o) => s + o.t - o.x, 0) / it.length
    for (const o of it) xs.set(o.f.id, o.x + off)
  }
  // Zones: runs of the dominant family across 12 slices of the width.
  const NB = 12, zones = []
  for (let b = 0; b < NB; b++) {
    const lo = b / NB, hi = (b + 1) / NB
    const counts = [0, 0, 0, 0]
    for (const f of ranked) { const v = u.get(f.id); if (v >= lo && (v < hi || b === NB - 1)) counts[f.family] = (counts[f.family] || 0) + 1 }
    const family = counts.indexOf(Math.max(...counts))
    const prev = zones[zones.length - 1]
    if (prev && prev.family === family) prev.x1 = hi * WW
    else zones.push({ family, x0: lo * WW, x1: hi * WW })
  }
  for (const z of zones) {
    const fm = families[z.family]
    z.name = fm?.name || ''
    z.traits = (fm?.traits || []).slice(0, 2).map(traitLabel)
  }
  const debuts = fighters.map(debutOf)
  return { xs, WW, zones, y0: Math.floor(Math.min(...debuts)) - 1, y1: Math.ceil(Math.max(...debuts)) + 1 }
}

// `via` picks which of the fighter's own ancestors the line goes through (0 = the closest,
// 1 = the second); above that it follows each ancestor's closest line.
function heritageOf(g, id, via = 0) {
  if (id == null) return null
  const set = new Set([id]), chain = []
  for (let c = id; c != null; c = g.parents.get(c)?.[c === id ? via : 0]?.id ?? null) { chain.unshift(c); set.add(c) }
  let fr = [id]
  for (let i = 0; i < UP_GENS; i++) {
    const nx = []
    for (const x of fr) for (const p of g.parents.get(x) || []) if (!set.has(p.id)) { set.add(p.id); nx.push(p.id) }
    fr = nx
  }
  fr = [id]
  for (let i = 0; i < DOWN_GENS; i++) {
    const nx = []
    for (const x of fr) for (const k of g.children.get(x) || []) if (!set.has(k.id)) { set.add(k.id); nx.push(k.id) }
    fr = nx
  }
  return { set, chain, chainSet: new Set(chain) }
}

// Greedy label placement: each label takes the first candidate spot that hits no placed
// label or other dot. Forced labels (the isolated fighter, their line) take the
// least-bad spot instead of disappearing.
function placeLabels(items, circles, W, H, seed) {
  const boxes = [...seed], out = []
  const over = (a, b) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1)
  for (const it of items) {
    const w = it.text.length * it.fs * 0.56, h = it.fs + 2
    const box = (c) => { const x0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'end' ? c.x - w : c.x; return { x0, x1: x0 + w, y0: c.y - h / 2, y1: c.y + h / 2 } }
    let pick = null, best = null
    for (const c of it.cands) {
      const b = box(c)
      const oob = b.x0 < 0 || b.x1 > W || b.y0 < 0 || b.y1 > H ? 100 : 0
      const n = boxes.filter((o) => over(b, o)).length * 3 + circles.filter((k) => k.id !== it.id && !(b.x1 < k.x - k.r || b.x0 > k.x + k.r || b.y1 < k.y - k.r || b.y0 > k.y + k.r)).length + oob
      if (n === 0) { pick = { c, b }; break }
      if (!best || n < best.n) best = { c, b, n }
    }
    if (!pick && it.force) pick = best
    if (pick) { boxes.push(pick.b); out.push({ ...it, x: pick.c.x, y: pick.c.y, anchor: pick.c.anchor }) }
  }
  return out
}

const TreeLayer = memo(function TreeLayer({ fighters, pos, links, her, rWorld, isoId, onHover, onPick }) {
  const edges = useMemo(() => links.map((l) => {
    const a = pos.get(l.from), b = pos.get(l.to)
    const my = (a.y + b.y) / 2
    const inH = her && her.set.has(l.from) && her.set.has(l.to)
    const onChain = inH && l.primary && her.chainSet.has(l.from) && her.chainSet.has(l.to)
    return {
      key: `${l.from}-${l.to}`, d: `M${a.x},${a.y}C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`, fam: b.fam, onChain,
      sw: onChain ? 3 : inH ? (l.primary ? 1.8 : 1.2) : (l.primary ? 1 : 0.7),
      op: her ? (inH ? (onChain ? 0.9 : l.primary ? 0.7 : 0.45) : 0.05) : (l.primary ? 0.36 : 0.18),
    }
  }).sort((a, b) => a.op - b.op), [links, pos, her])
  return (
    <>
      <g className="pointer-events-none">
        {edges.map((e) => (
          <path key={e.key} d={e.d} fill="none" stroke={e.onChain ? 'var(--color-foreground)' : famColor(e.fam)}
            strokeWidth={e.sw} strokeOpacity={e.op} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g>
        {fighters.map((f) => {
          const p = pos.get(f.id)
          const inH = !her || her.set.has(f.id)
          const isIso = f.id === isoId, onChain = her?.chainSet.has(f.id)
          return (
            <circle key={f.id} cx={p.x} cy={p.y} r={rWorld * (isIso ? 1.8 : onChain ? 1.35 : 1)} fill={famColor(f.family)}
              fillOpacity={inH ? 1 : 0.13} stroke={isIso || onChain ? 'var(--color-foreground)' : 'var(--color-card)'}
              strokeWidth={isIso ? 2.5 : onChain ? 1.8 : 0.8} vectorEffect="non-scaling-stroke" className="cursor-pointer"
              onPointerEnter={() => onHover(f.id)} onPointerLeave={() => onHover(null)} onClick={() => onPick(f.id)} />
          )
        })}
      </g>
    </>
  )
})

const ctrlBtn = 'flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 text-[11.5px] font-semibold shadow-sm hover:bg-muted'

// Left-rail trim order (see railFit): least important first.
// Rail trim order, least important first. Only the bio card trims: the heritage box below
// lists everyone and scrolls inside itself, so names are never dropped.
const TREE_FIT_STEPS = ['bio:career', 'bio:stance', 'bio:reach', 'portrait', 'compact', 'bio:body']

export default function StyleTreeView({ data, byId, chosenId, fighterId, onSelect }) {
  const fighters = data.fighters
  const families = data.families
  // Opens isolated on the page's fighter (the URL's, else the #1 P4P), like the map.
  const [isoId, setIsoId] = useState(() => [chosenId, fighterId].find((id) => id && byId.has(id)) ?? null)
  const [hoverId, setHoverId] = useState(null)
  const [view, setView] = useState(null)
  const [labelView, setLabelView] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [fitReq, setFitReq] = useState(isoId ? 'focus' : 'all')
  const [ref, { w, h }] = useSize()
  const draggedRef = useRef(false)

  const g = useMemo(() => buildGraph(fighters, byId), [fighters, byId])
  const X = useMemo(() => layoutX(fighters, families), [fighters, families])
  // World px per year, chosen so "fit all" fills the canvas at this aspect ratio.
  const YP = useMemo(() => (w ? Math.round(clamp((X.WW * (h - PAD)) / Math.max(1, w - PAD) / (X.y1 - X.y0), 12, 600) / 4) * 4 : 0), [X, w, h])
  const pos = useMemo(() => {
    const m = new Map()
    for (const f of fighters) m.set(f.id, { x: X.xs.get(f.id), y: (debutOf(f) - X.y0 + (hash01(f.id) - 0.5) * 0.3) * YP, fam: f.family })
    return m
  }, [fighters, X, YP])
  const links = useMemo(() => g.links.map((l) => ({ ...l })), [g])
  // Which ancestor the heritage line runs through; back to the closest on a new fighter.
  const [via, setVia] = useState({ id: isoId, i: 0 })
  const viaI = via.id === isoId ? via.i : 0
  const her = useMemo(() => heritageOf(g, isoId, viaI), [g, isoId, viaI])

  // Panning stops at the outermost fighters: the view can't go past the tree's edges
  // (plus PAN_MARGIN px), so there is never empty space to drag into. When the whole tree
  // fits on an axis, it stays centred on that axis.
  const bounds = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of pos.values()) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
    return { x0, x1, y0, y1 }
  }, [pos])
  const clampView = useCallback((v) => {
    if (!v || !w || !Number.isFinite(bounds.x0)) return v
    const axis = (t, a0, a1, size) => {
      const lo = size - PAN_MARGIN - a1 * v.k, hi = PAN_MARGIN - a0 * v.k
      return lo <= hi ? clamp(t, lo, hi) : (lo + hi) / 2
    }
    return { ...v, tx: axis(v.tx, bounds.x0, bounds.x1, w), ty: axis(v.ty, bounds.y0, bounds.y1, h) }
  }, [bounds, w, h])

  const fitTo = useCallback((ids) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const id of ids) { const p = pos.get(id); if (!p) continue; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
    const k = clamp(Math.min((w - PAD) / Math.max(60, x1 - x0), (h - PAD) / Math.max(60, y1 - y0)), 0.03, 3)
    return { k, tx: w / 2 - ((x0 + x1) / 2) * k, ty: h / 2 - ((y0 + y1) / 2) * k + 10 }
  }, [pos, w, h])

  useEffect(() => {
    if (!w || !YP || !fitReq) return
    const v = fitTo(fitReq === 'focus' && her ? [...her.set] : fighters.map((f) => f.id))
    setView(v); setLabelView(v); setFitReq(null)
  }, [fitReq, w, YP, her, fighters, fitTo])
  // Window resize: refit what's on screen.
  useEffect(() => { if (w) setFitReq((r) => r || (isoId ? 'focus' : 'all')) }, [w, h]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (dragging || !view) return
    const t = setTimeout(() => setLabelView(view), 120)
    return () => clearTimeout(t)
  }, [view, dragging])

  // Zoom-out floor: a little past "fit all", so the tree can't shrink to a speck.
  const allIds = useMemo(() => fighters.map((f) => f.id), [fighters])
  const minK = useMemo(() => (w && YP ? fitTo(allIds).k * 0.9 : 0.03), [w, YP, fitTo, allIds])
  const zoomAt = useCallback((mx, my, f) => setView((v) => {
    if (!v) return v
    const k = clamp(v.k * f, minK, 8), s = k / v.k
    return clampView({ k, tx: mx - (mx - v.tx) * s, ty: my - (my - v.ty) * s })
  }), [minK, clampView])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0018)) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, zoomAt])

  const onPointerDown = (e) => {
    if (e.button !== 0 || !view) return
    const start = { x: e.clientX, y: e.clientY, v: view }
    draggedRef.current = false
    const move = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y
      if (!draggedRef.current && Math.abs(dx) + Math.abs(dy) > 4) { draggedRef.current = true; setDragging(true); setHoverId(null) }
      if (draggedRef.current) setView(clampView({ ...start.v, tx: start.v.tx + dx, ty: start.v.ty + dy }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragging(false)
      setTimeout(() => { draggedRef.current = false }, 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const isolate = useCallback((id) => { setIsoId(id); setFitReq('focus'); onSelect(id) }, [onSelect])
  const onPick = useCallback((id) => { if (!draggedRef.current) isolate(id) }, [isolate])
  const onHover = useCallback((id) => { if (!draggedRef.current) setHoverId(id) }, [])
  const clearIso = () => { setIsoId(null); setFitReq('all') }

  // ---- labels (placed against the settled view; translated while panning) ----
  const eraMarks = useMemo(() => {
    if (!view || !YP) return []
    const sy = (yr) => (yr - X.y0) * YP * view.k + view.ty
    const out = []
    for (const [a, b, label] of ERAS) {
      const ya = sy(a), yb = sy(b)
      if (yb - ya > 26 && yb > 0 && ya < h) out.push({ y: clamp((Math.max(ya, 0) + Math.min(yb, h)) / 2, 40, h - 12), text: label.toUpperCase(), era: true })
    }
    if (YP * view.k * 5 > 60) for (let y = Math.ceil(X.y0 / 5) * 5; y <= X.y1; y += 5) { const yy = sy(y); if (yy > 40 && yy < h - 8) out.push({ y: yy, text: String(y) }) }
    return out
  }, [view, YP, X, h])

  const labels = useMemo(() => {
    if (!labelView || !w) return []
    const { k, tx, ty } = labelView
    const rS = clamp(2.2 + k * 3, 2.6, 8)
    const vis = []
    for (const f of fighters) {
      if (her && !her.set.has(f.id)) continue
      const p = pos.get(f.id), x = p.x * k + tx, y = p.y * k + ty
      if (x < -40 || x > w + 40 || y < -20 || y > h + 20) continue
      vis.push({ f, x, y })
    }
    const circles = vis.map((v) => ({ id: v.f.id, x: v.x, y: v.y, r: rS + 1 }))
    const pri = (v) => (v.f.id === isoId ? -1e9 : her?.chainSet.has(v.f.id) ? -1e8 : -((g.sub.get(v.f.id) || 1) * 10 + (v.f.quality || 0) / 10))
    const items = vis.sort((a, b) => pri(a) - pri(b)).slice(0, MAX_LABELS).map((v) => {
      const iso = v.f.id === isoId, chain = her?.chainSet.has(v.f.id)
      const fs = iso ? 13 : chain ? 11.5 : 10.5
      const r = iso ? rS * 1.8 : rS
      return {
        id: v.f.id, text: v.f.name, fs, bold: iso || chain || (g.sub.get(v.f.id) || 1) > 4, force: iso || chain,
        cands: [{ x: v.x + r + 5, y: v.y, anchor: 'start' }, { x: v.x - r - 5, y: v.y, anchor: 'end' },
          { x: v.x, y: v.y + r + fs / 2 + 3, anchor: 'middle' }, { x: v.x, y: v.y - r - fs / 2 - 3, anchor: 'middle' }],
      }
    })
    const seed = [{ x0: 0, x1: w, y0: 0, y1: 32 }, ...eraMarks.map((m) => ({ x0: 0, x1: 16 + m.text.length * 7, y0: m.y - 9, y1: m.y + 9 }))]
    return placeLabels(items, circles, w, h, seed)
  }, [labelView, fighters, pos, her, isoId, g, w, h]) // eslint-disable-line react-hooks/exhaustive-deps

  const zones = useMemo(() => {
    if (!view) return []
    const out = []
    let lastR = -Infinity
    for (const z of X.zones) {
      const x = ((z.x0 + z.x1) / 2) * view.k + view.tx
      for (const text of [[z.name, ...z.traits].join(' · '), z.name]) {
        const hw = (text.length * 6.2 + 28) / 2
        if (x - hw >= lastR + 6 && x + hw > 0 && x - hw < w) { out.push({ x, text, family: z.family }); lastR = x + hw; break }
      }
    }
    return out
  }, [view, X, w])

  const sameScale = labelView && view && labelView.k === view.k
  const labelShift = sameScale ? `translate(${view.tx - labelView.tx}px, ${view.ty - labelView.ty}px)` : undefined
  const rWorld = view ? clamp(2.2 + view.k * 3, 2.6, 8) / Math.pow(2, Math.round(Math.log2(view.k) * 4) / 4) : 3

  const hv = hoverId && !dragging ? byId.get(hoverId) : null
  const hvPos = hv && view ? (() => { const p = pos.get(hv.id); return { x: p.x * view.k + view.tx, y: p.y * view.k + view.ty } })() : null
  const hvParents = hv ? g.parents.get(hv.id) || [] : []

  // ---- rail ----
  const iso = isoId ? byId.get(isoId) : null
  // Siblings: the other fighters whose closest style ancestor (primary line) is the same
  // fighter as the isolated one's, most similar to that ancestor first.
  const siblings = useMemo(() => {
    if (!iso) return null
    // Follows the chosen line: the closest ancestor's heirs by default, or everyone who
    // draws on the second ancestor when the line is switched to it.
    const p = g.parents.get(iso.id)?.[viaI]
    if (!p) return { parent: null, list: [] }
    const list = (g.children.get(p.id) || []).filter((c) => (viaI === 0 ? c.primary : true) && c.id !== iso.id)
      .map((c) => ({ f: byId.get(c.id), sim: c.sim })).filter((x) => x.f)
    return { parent: byId.get(p.id), list }
  }, [iso, g, byId, viaI])
  const isoParents = iso ? g.parents.get(iso.id) || [] : []
  const isoHeirs = iso ? g.children.get(iso.id) || [] : []
  const ranks = useDivisionRanks()
  const [railRef, drop] = useRailFit(TREE_FIT_STEPS.length, `${isoId}:${viaI}`, [h])
  const plan = bioPlan(TREE_FIT_STEPS.slice(0, drop))
  // One list style for heritage, heirs and siblings: family dot, name, debut · division, score.
  const lineRow = (f, sim, key, { active, sub } = {}) => (
    <li key={key}>
      <button onClick={() => isolate(f.id)} className={cn('flex w-full items-center gap-2.5 rounded-md px-1 py-0.5 text-left hover:bg-muted', active && 'bg-blue-50')}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card" style={{ background: famColor(f.family) }} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[12px] font-bold">{f.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">{sub ?? `debut ${Math.floor(debutOf(f))} · ${divisionLabel(f.division)}`}</span>
        </span>
        {sim != null && <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-muted-foreground">{sim.toFixed(2)}</span>}
      </button>
    </li>
  )

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(0,1fr)]">
      <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:order-2">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
          {/* The isolating pill lives here, in the header, rather than floating over the tree. */}
          <div className="min-w-0 flex-1">
            {iso && (
              <div className="inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full bg-foreground py-1 pl-3 pr-1 text-[11.5px] text-background shadow-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: famColor(iso.family) }} />
                <span className="truncate">Isolating <b>{iso.name}</b> · {her.set.size} fighters in this line</span>
                <button onClick={clearIso} className="flex shrink-0 items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 font-semibold hover:bg-background/25">Show all <XIcon className="h-3 w-3" /></button>
              </div>
            )}
          </div>
          <FighterPicker fighters={fighters} onPick={isolate} placeholder="Isolate a fighter…" className="max-w-[220px]" />
        </div>

        <div ref={ref} onPointerDown={onPointerDown}
          className={cn('relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-muted/20', dragging ? 'cursor-grabbing' : 'cursor-grab')}>
          {view && YP > 0 && (
            <svg width={w} height={h} className="absolute inset-0 block">
              <rect width={w} height={h} fill="transparent" onClick={() => { if (!draggedRef.current && isoId) clearIso() }} />
              <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
                {ERAS.map(([a, b], i) => (
                  <rect key={a} x={-X.WW} y={(a - X.y0) * YP} width={X.WW * 3} height={(b - a) * YP}
                    className={cn('pointer-events-none', i % 2 ? 'fill-muted/50' : 'fill-transparent')} />
                ))}
                {X.zones.slice(1).map((z) => (
                  <line key={z.x0} x1={z.x0} x2={z.x0} y1={-YP * 10} y2={(X.y1 - X.y0 + 10) * YP} strokeDasharray="4 5"
                    vectorEffect="non-scaling-stroke" className="pointer-events-none stroke-border" />
                ))}
                <TreeLayer fighters={fighters} pos={pos} links={links} her={her} rWorld={rWorld} isoId={isoId} onHover={onHover} onPick={onPick} />
              </g>
            </svg>
          )}

          {/* Era names + years, left gutter */}
          <div className="pointer-events-none absolute inset-0">
            {eraMarks.map((m) => (
              <span key={m.text} className={cn('absolute left-2 -translate-y-1/2 rounded bg-card/85 px-1 text-[10px]',
                m.era ? 'font-extrabold tracking-wider text-muted-foreground' : 'font-semibold text-muted-foreground/70')} style={{ top: m.y }}>
                {m.text}
              </span>
            ))}
          </div>

          {/* Fighter names */}
          <div className="pointer-events-none absolute inset-0" style={{ transform: labelShift, opacity: sameScale ? 1 : 0 }}>
            {labels.map((l) => (
              <span key={l.id} className={cn('absolute whitespace-nowrap leading-none text-foreground [text-shadow:0_0_3px_var(--color-card),0_0_3px_var(--color-card),0_0_2px_var(--color-card)]',
                l.bold ? 'font-bold' : 'font-medium')}
                style={{ left: l.x, top: l.y, fontSize: l.fs, transform: `translate(${l.anchor === 'middle' ? '-50%' : l.anchor === 'end' ? '-100%' : '0'},-50%)` }}>
                {l.text}
              </span>
            ))}
          </div>

          {/* What each band of the width is */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-card to-transparent" />
          {zones.map((z) => (
            <span key={z.text + z.x} className="pointer-events-none absolute top-[7px] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-foreground/80 shadow-sm"
              style={{ left: z.x }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: famColor(z.family) }} />{z.text}
            </span>
          ))}


          <div className="absolute right-2.5 top-9 flex flex-col gap-1">
            <button className={ctrlBtn} aria-label="Zoom in" onClick={() => zoomAt(w / 2, h / 2, 1.5)}><Plus className="h-3.5 w-3.5" /></button>
            <button className={ctrlBtn} aria-label="Zoom out" onClick={() => zoomAt(w / 2, h / 2, 1 / 1.5)}><Minus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="absolute bottom-2.5 right-2.5 flex gap-1">
            {iso && <button className={ctrlBtn} onClick={() => setFitReq('focus')}>Fit lineage</button>}
            <button className={ctrlBtn} onClick={() => setFitReq('all')}><Maximize2 className="h-3 w-3" />Fit all</button>
          </div>
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-200px)] items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-md border border-border bg-card/95 px-2.5 py-1 text-[10.5px] text-muted-foreground">
            {families.map((f) => (
              <span key={f.id} className="flex items-center gap-1 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: famColor(f.id) }} />{f.name}</span>
            ))}
            <span className="font-bold text-foreground">← strikes · grapples →</span>
          </div>

          {hv && hvPos && (
            <div className={cn('pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-[11.5px] leading-snug text-background shadow',
              hvPos.x > w - 240 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3', '-translate-y-full')}
              style={{ left: hvPos.x, top: hvPos.y - 8 }}>
              <div className="font-bold">{hv.name}</div>
              <div className="opacity-80">{styleLabel(hv, families)} · {years(hv)}</div>
              <div className="opacity-80">
                {hvParents[0] ? `from ${byId.get(hvParents[0].id)?.name} (${hvParents[0].sim.toFixed(2)})${hvParents.length > 1 ? ' + 1 more' : ''}` : 'founding style'}
                {' · '}{(g.sub.get(hv.id) || 1) - 1} descendants
              </div>
            </div>
          )}
        </div>
      </section>

      <aside ref={railRef} className="flex min-h-0 flex-col gap-3 lg:order-1 lg:h-full lg:overflow-hidden">
        {iso && (
          <FighterBioCard fighter={iso} families={families} rank={ranks[iso.id]} hideBio={plan.hideBio} portrait={plan.portrait} compact={plan.compact}>
            {plan.compact ? (
              <div className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
                <b className="text-foreground">{(g.sub.get(iso.id) || 1) - 1}</b> descendants · <b className="text-foreground">{isoHeirs.length}</b> heirs · <b className="text-foreground">{her.chain.length}</b> generations
              </div>
            ) : (
            <div className="mt-2 grid grid-cols-3 gap-1.5 border-t pt-2">
              {[[(g.sub.get(iso.id) || 1) - 1, 'descendants'], [isoHeirs.length, 'direct heirs'], [her.chain.length, 'generations']].map(([v, l]) => (
                <div key={l} className="rounded-md border border-border bg-muted/40 px-2 py-1 leading-tight">
                  <div className="text-[16px] font-black tabular-nums">{v}</div>
                  <div className="text-[9.5px] font-semibold text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
            )}
          </FighterBioCard>
        )}
        {!iso && (
          <Panel className="grow" bodyClassName="flex items-center justify-center">
            <p className="max-w-[240px] text-center text-[12.5px] leading-relaxed text-muted-foreground">
              Click a fighter or search to trace their style back to its founding fighter, and see who carries it forward.
            </p>
          </Panel>
        )}

        {iso && (
        <Panel title="Heritage"
          action={isoParents.length > 1 && (
            // Two ancestors: the line can run through either. The closest is the default;
            // switching redraws the highlighted line on the tree too. One line, names ellipsised.
            <div className="flex min-w-0 items-center gap-1 text-[10.5px]">
              {isoParents.slice(0, 2).map((p, i) => (
                <button key={p.id} onClick={() => setVia({ id: isoId, i })} title={`Line through ${byId.get(p.id)?.name}`}
                  className={cn('inline-flex min-w-0 max-w-[96px] items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold',
                    viaI === i ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted')}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: famColor(byId.get(p.id)?.family) }} />
                  <span className="truncate">{lastName(byId.get(p.id)?.name || '')}</span>
                  <span className="shrink-0 tabular-nums">{p.sim.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
          className="min-h-[200px] flex-1 overflow-hidden" bodyClassName="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          <ol className="shrink-0">
            {her.chain.map((id, i) => {
              const f = byId.get(id)
              const last = i === her.chain.length - 1
              const next = !last ? g.parents.get(her.chain[i + 1])?.[her.chain[i + 1] === iso.id ? viaI : 0] : null
              return (
                <li key={id}>
                  <button onClick={() => isolate(id)} className={cn('flex w-full items-stretch gap-2.5 rounded-md px-1 text-left hover:bg-muted', last && 'bg-blue-50')}>
                    <span className="flex w-3 shrink-0 flex-col items-center">
                      <span className={cn('w-0.5 flex-1', i ? 'bg-border' : 'bg-transparent')} />
                      <span className={cn('shrink-0 rounded-full ring-2 ring-card', last ? 'h-3 w-3' : 'h-2.5 w-2.5')} style={{ background: famColor(f.family) }} />
                      <span className={cn('w-0.5 flex-1', last ? 'bg-transparent' : 'bg-border')} />
                    </span>
                    <span className="min-w-0 flex-1 py-1 leading-tight">
                      <span className={cn('block truncate text-[12px]', last ? 'font-extrabold' : 'font-bold')}>{f.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{i === 0 ? 'Founding style · ' : ''}debut {Math.floor(debutOf(f))} · {divisionLabel(f.division)}</span>
                    </span>
                    {next && <span className={cn('self-center text-[10.5px] font-bold tabular-nums', next.sim >= 0.85 ? 'text-green-700' : 'text-muted-foreground')}>↓ {next.sim.toFixed(2)}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="shrink-0 border-t border-border pt-2">
            <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
              {isoHeirs.length ? `Direct heirs · ${isoHeirs.length}` : 'No direct heirs yet'}
            </div>
            <ol className="space-y-0.5">
              {isoHeirs.map((c) => byId.get(c.id) && lineRow(byId.get(c.id), c.sim, c.id))}
            </ol>
          </div>
          {siblings && (
            <div className="shrink-0 border-t border-border pt-2">
              <div className="mb-1 truncate text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                {siblings.list.length
                  ? `Siblings · ${siblings.list.length} · also from ${siblings.parent.name}`
                  : siblings.parent ? `No siblings · nobody else from ${siblings.parent.name}` : 'No siblings · founding style'}
              </div>
              <ol className="space-y-0.5">
                {siblings.list.map(({ f, sim }) => lineRow(f, sim, f.id))}
              </ol>
            </div>
          )}
        </Panel>
        )}

      </aside>
    </div>
  )
}

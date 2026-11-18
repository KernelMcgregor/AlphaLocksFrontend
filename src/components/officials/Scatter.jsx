// A small SVG scatter for the officials pages: dots sized and coloured by the caller,
// optional edges under them, a hover tooltip anchored to the dot, and selective direct
// labels. Drawn in real pixels (useElementSize) so text never scales with the box.
import { useMemo, useState } from 'react'
import { useElementSize } from '../viz/hooks'

const DEFAULT_PAD = { l: 44, r: 16, t: 14, b: 34 }

const niceTicks = (lo, hi, n = 5) => {
  const step0 = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0
  const out = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10))
  return out
}

export default function Scatter({
  points, xDomain, yDomain, height = 420, edges = [], xTitle, yTitle, xFmt = (v) => v, yFmt = (v) => v,
  showYTicks = true, showXTicks = true, zeroX = false, zeroY = false, corners, renderTip, onClick, onHover, labelIds = [], activeId,
  pad, quadrants,
}) {
  // Plot margins: room for tick labels and titles by default; `pad` overrides for a bare plot.
  const PAD = { ...DEFAULT_PAD, ...pad }
  const [ref, { w }] = useElementSize()
  const [hover, setHover] = useState(null)
  const iw = Math.max(10, w - PAD.l - PAD.r)
  const ih = height - PAD.t - PAD.b
  const sx = (v) => PAD.l + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * iw
  const sy = (v) => PAD.t + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ih
  const xt = useMemo(() => niceTicks(xDomain[0], xDomain[1]), [xDomain])
  const yt = useMemo(() => niceTicks(yDomain[0], yDomain[1], 4), [yDomain])
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points])
  const hp = hover != null ? byId.get(hover) : null
  const focus = activeId ?? hover

  const enter = (id) => { setHover(id); onHover?.(id) }
  const leave = () => { setHover(null); onHover?.(null) }

  // Direct labels in priority order, skipping any that would collide with one already
  // placed (rough text box: 6px per character, 12px tall).
  const placed = []
  for (const id of labelIds) {
    const p = byId.get(id)
    if (!p || !w) continue
    const right = sx(p.x) < PAD.l + iw - 90
    const lw = (p.label?.length || 0) * 6
    const x0 = right ? sx(p.x) + p.r + 4 : sx(p.x) - p.r - 4 - lw
    const box = { x0, x1: x0 + lw, y0: sy(p.y) - 7, y1: sy(p.y) + 7 }
    if (placed.some(({ box: b }) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue
    placed.push({ p, right, box })
  }

  // big dots first so small ones stay on top and hoverable
  const ordered = useMemo(() => [...points].sort((a, b) => b.r - a.r), [points])

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} className="block select-none">
          {showYTicks && yt.map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={PAD.l + iw} y1={sy(v)} y2={sy(v)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.l - 6} y={sy(v) + 3.5} textAnchor="end" fontSize={10} className="fill-muted-foreground tabular-nums">{yFmt(v)}</text>
            </g>
          ))}
          {showXTicks && xt.map((v) => (
            <text key={`x${v}`} x={sx(v)} y={PAD.t + ih + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground tabular-nums">{xFmt(v)}</text>
          ))}
          {/* Quadrant tints ({ tl, tr, bl, br }: a color each), split at zero. */}
          {quadrants && xDomain[0] < 0 && yDomain[0] < 0 && [
            ['tl', PAD.l, PAD.t, sx(0) - PAD.l, sy(0) - PAD.t], ['tr', sx(0), PAD.t, PAD.l + iw - sx(0), sy(0) - PAD.t],
            ['bl', PAD.l, sy(0), sx(0) - PAD.l, PAD.t + ih - sy(0)], ['br', sx(0), sy(0), PAD.l + iw - sx(0), PAD.t + ih - sy(0)],
          ].map(([k, x, y, qw, qh]) => quadrants[k] && (
            <rect key={`q${k}`} x={x} y={y} width={Math.max(0, qw)} height={Math.max(0, qh)} fill={quadrants[k]} fillOpacity={0.06} />
          ))}
          {zeroX && xDomain[0] < 0 && xDomain[1] > 0 && (
            <line x1={sx(0)} x2={sx(0)} y1={PAD.t} y2={PAD.t + ih} className="stroke-foreground/25" strokeWidth={1} />
          )}
          {zeroY && yDomain[0] < 0 && yDomain[1] > 0 && (
            <line x1={PAD.l} x2={PAD.l + iw} y1={sy(0)} y2={sy(0)} className="stroke-foreground/25" strokeWidth={1} />
          )}
          {/* Quadrant names, tucked into the plot's corners. */}
          {corners && [
            ['tl', PAD.l + 6, PAD.t + 12, 'start'], ['tr', PAD.l + iw - 6, PAD.t + 12, 'end'],
            ['bl', PAD.l + 6, PAD.t + ih - 8, 'start'], ['br', PAD.l + iw - 6, PAD.t + ih - 8, 'end'],
          ].map(([k, x, y, anchor]) => corners[k] && (
            <text key={k} x={x} y={y} textAnchor={anchor} fontSize={10} fontWeight={700} letterSpacing="0.06em" className="pointer-events-none uppercase" style={{ fill: quadrants?.[k] || 'var(--color-muted-foreground)' }}>{corners[k]}</text>
          ))}
          {showXTicks && <line x1={PAD.l} x2={PAD.l + iw} y1={PAD.t + ih} y2={PAD.t + ih} className="stroke-border" strokeWidth={1} />}
          {xTitle && (
            <text x={PAD.l + iw} y={height - 4} textAnchor="end" fontSize={10} fontWeight={700} className="fill-muted-foreground uppercase" letterSpacing="0.06em">{xTitle}</text>
          )}
          {yTitle && (
            <text x={PAD.l} y={PAD.t - 4} fontSize={10} fontWeight={700} className="fill-muted-foreground uppercase" letterSpacing="0.06em">{yTitle}</text>
          )}

          {edges.map((e) => {
            const a = byId.get(e.a)
            const b = byId.get(e.b)
            if (!a || !b) return null
            return (
              <line
                key={`${e.a}-${e.b}`}
                x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)}
                stroke={e.stroke} strokeWidth={e.width} strokeOpacity={e.opacity} strokeLinecap="round"
              />
            )
          })}

          {ordered.map((p) => {
            const dim = focus != null && p.dim
            return (
              <circle
                key={p.id}
                cx={sx(p.x)} cy={sy(p.y)} r={p.r}
                style={{ fill: p.fill, transition: 'opacity 150ms' }}
                className="stroke-card"
                strokeWidth={2}
                opacity={dim ? 0.25 : 1}
              />
            )
          })}
          {focus != null && byId.get(focus) && (
            <circle cx={sx(byId.get(focus).x)} cy={sy(byId.get(focus).y)} r={byId.get(focus).r + 3} fill="none" className="stroke-foreground" strokeWidth={1.5} />
          )}

          {placed.map(({ p, right }) => {
            const id = p.id
            return (
              <text
                key={`l${id}`}
                x={sx(p.x) + (right ? p.r + 4 : -p.r - 4)} y={sy(p.y) + 3.5}
                textAnchor={right ? 'start' : 'end'} fontSize={10} fontWeight={600}
                className="pointer-events-none fill-foreground/75"
                paintOrder="stroke" stroke="var(--color-card)" strokeWidth={3}
              >
                {p.label}
              </text>
            )
          })}

          {/* Pointer: nearest dot within reach, so overlapping dots stay reachable.
              Keyboard: each dot is a focus target of its own. */}
          <rect
            x={0} y={0} width={w} height={height} fill="transparent"
            className={hover != null && onClick ? 'cursor-pointer' : undefined}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect()
              const mx = e.clientX - box.left
              const my = e.clientY - box.top
              let best = null
              let bd = Infinity
              for (const p of points) {
                const d = Math.hypot(sx(p.x) - mx, sy(p.y) - my) - p.r
                if (d < bd) { bd = d; best = p }
              }
              const id = best && bd < 18 ? best.id : null
              if (id !== hover) (id == null ? leave() : enter(id))
            }}
            onMouseLeave={leave}
            onClick={() => { if (hp) onClick?.(hp) }}
          />
          {ordered.map((p) => (
            <circle
              key={`h${p.id}`}
              cx={sx(p.x)} cy={sy(p.y)} r={p.r + 2}
              fill="transparent"
              className="pointer-events-none outline-none"
              tabIndex={0}
              role={onClick ? 'link' : undefined}
              aria-label={p.label}
              onFocus={() => enter(p.id)}
              onBlur={leave}
              onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(p) }}
            />
          ))}
        </svg>
      )}
      {hp && renderTip && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: Math.min(Math.max(sx(hp.x), 110), w - 110),
            top: sy(hp.y) - hp.r - 8,
            transform: sy(hp.y) < 130 ? `translate(-50%, ${hp.r * 2 + 16}px)` : 'translate(-50%, -100%)',
          }}
        >
          <div className="w-max max-w-[220px] rounded-lg border border-border bg-background px-2.5 py-2 text-left shadow-lg">
            {renderTip(hp)}
          </div>
        </div>
      )}
    </div>
  )
}

// src/pages/FighterProfilePage.jsx
import { ArrowLeft, Crown, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import { Card, CardContent } from '../components/ui/card'
import { ScrollArea } from '../components/ui/scroll-area'
// NOTE: add `export const fetchFighterStats = (id) => cachedRequest(`/ufc/fighters/${id}/stats`)`
// to src/lib/api.js — the endpoint already exists in routers/ufc.py.
import { fetchEvents, fetchFighter, fetchFighterFights, fetchFighterStats, fetchRankings } from '../lib/api'
import { cn, formatDate, formatRecord } from '../lib/utils'
import { aggregateCareer, buildPercentile, deriveProfile, initialsOf, methodLabel, ordinal } from '../lib/fighterAnalytics'

// ---------------------------------------------------------------------------
// Radial charts (dependency-free inline SVG — same family as RankingsPage)
// ---------------------------------------------------------------------------
function polar(cx, cy, r, i, n) {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function RadarChart({ axes }) {
  const cx = 120, cy = 120, R = 92, n = axes.length
  return (
    <svg viewBox="-30 -14 300 268" width={248} height={248} className="max-w-full">
      {[0.25, 0.5, 0.75, 1].map((fr, gi) => (
        <polygon key={gi} points={axes.map((_, i) => polar(cx, cy, R * fr, i, n).join(',')).join(' ')} fill="none" className="stroke-border" strokeWidth={1} />
      ))}
      {axes.map((_, i) => { const [x, y] = polar(cx, cy, R, i, n); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" strokeWidth={1} /> })}
      <polygon points={axes.map((a, i) => polar(cx, cy, (R * a.value) / 100, i, n).join(',')).join(' ')} className="fill-blue-500/20 stroke-blue-600" strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => { const [x, y] = polar(cx, cy, (R * a.value) / 100, i, n); return <circle key={i} cx={x} cy={y} r={2.6} className="fill-background stroke-blue-600" strokeWidth={1.6} /> })}
      {axes.map((a, i) => {
        const [x, y] = polar(cx, cy, R + 16, i, n)
        const dx = x - cx
        const anchor = Math.abs(dx) < 8 ? 'middle' : dx > 0 ? 'start' : 'end'
        return <text key={i} x={x} y={y + 3} fontSize={9} fontWeight={600} textAnchor={anchor} className="fill-muted-foreground">{a.label}</text>
      })}
    </svg>
  )
}

function RadialBars({ axes, overall }) {
  const cx = 120, cy = 120, r0 = 40, Rmax = 104, n = axes.length
  return (
    <svg viewBox="0 0 240 240" width={240} height={240} className="max-w-full">
      {axes.map((_, i) => { const [x1, y1] = polar(cx, cy, r0, i, n); const [x2, y2] = polar(cx, cy, Rmax, i, n); return <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-muted" strokeWidth={9} strokeLinecap="round" /> })}
      {axes.map((a, i) => { const [x1, y1] = polar(cx, cy, r0, i, n); const [x2, y2] = polar(cx, cy, r0 + ((Rmax - r0) * a.value) / 100, i, n); return <line key={`b${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className={a.group === 'striking' ? 'stroke-amber-500' : 'stroke-indigo-500'} strokeWidth={9} strokeLinecap="round" /> })}
      <circle cx={cx} cy={cy} r={31} className="fill-background stroke-border" strokeWidth={1} />
      <text x={cx} y={cy - 1} fontSize={20} fontWeight={800} textAnchor="middle" className="fill-foreground">{overall}</text>
      <text x={cx} y={cy + 13} fontSize={7.5} fontWeight={700} textAnchor="middle" letterSpacing="0.1em" className="fill-muted-foreground">OVR</text>
    </svg>
  )
}

function ActivityRings({ groups, overall }) {
  const cx = 120, cy = 120, sw = 16
  return (
    <svg viewBox="0 0 240 240" width={240} height={240} className="max-w-full">
      {[94, 70, 46].map((r, idx) => {
        const g = groups[idx]; const C = 2 * Math.PI * r
        return (
          <g key={idx}>
            <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-muted" strokeWidth={sw} />
            <circle cx={cx} cy={cy} r={r} fill="none" className={g.stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(C * g.value) / 100} ${C * 2}`} transform={`rotate(-90 ${cx} ${cy})`} />
          </g>
        )
      })}
      <text x={cx} y={cy - 1} fontSize={27} fontWeight={800} textAnchor="middle" className="fill-foreground">{overall}</text>
      <text x={cx} y={cy + 15} fontSize={8} fontWeight={700} textAnchor="middle" letterSpacing="0.12em" className="fill-muted-foreground">OVERALL</text>
    </svg>
  )
}

const GRAPH_STYLES = [{ key: 'radar', label: 'Radar' }, { key: 'columns', label: 'Radial bars' }, { key: 'rings', label: 'Rings' }]
const GRAPH_NOTE = {
  radar: 'Spider chart · 8 skill axes, radius = percentile',
  columns: 'Radial bars · length = percentile · amber striking, indigo grappling',
  rings: 'Concentric rings · Striking, Grappling, Overall',
}

function WavingFlag({ countryCode }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!countryCode) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = new URL(`/node_modules/flag-icons/flags/4x3/${countryCode.toLowerCase()}.svg`, import.meta.url).href
    imgRef.current = img

    let frame
    let t = 0
    let sized = false

    const draw = () => {
      // Match canvas pixels to display size
      if (!sized || canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        sized = true
      }
      const W = canvas.width
      const H = canvas.height
      if (!img.complete || !img.naturalWidth) { frame = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, W, H)
      t += 0.02

      // Oversized flag so waves don't reveal edges
      const scale = 1.35
      const flagW = W * scale
      const flagH = H * scale
      const ox = (W - flagW) / 2
      const oy = (H - flagH) / 2

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

        const sx = nx * img.naturalWidth
        const sw = Math.max(1, img.naturalWidth / flagW)

        const dx = ox + i
        const drawY = oy + dy
        const drawH = flagH * stretch

        ctx.drawImage(img, sx, 0, sw, img.naturalHeight, dx, drawY, 1.5, drawH)

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

    img.onload = () => { frame = requestAnimationFrame(draw) }
    if (img.complete) frame = requestAnimationFrame(draw)

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

function StatTile({ label, value }) {
  return (
    <div className="rounded-md border bg-muted/40 px-2 py-1.5">
      <div className="text-sm font-extrabold leading-none tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-[9px] font-semibold text-muted-foreground">{label}</div>
    </div>
  )
}



function DimBar({ dim }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[118px] shrink-0 text-[11.5px] font-medium text-foreground/80">{dim.label}</span>
      <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', dim.group === 'striking' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-500')} style={{ width: `${dim.value}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-extrabold tabular-nums text-foreground">{ordinal(dim.value)}</span>
    </div>
  )
}

export default function FighterProfilePage() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: null, fighter: null, fights: [], career: null, ranked: null, divisionLabel: null, divisionFighters: null })
  const [graph, setGraph] = useState('radar')
  const [oppData, setOppData] = useState({}) // { [fighterId]: { name, image_url } }

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.all([
      fetchFighter(id),
      fetchFighterFights(id).catch(() => []),
      fetchFighterStats(id).catch(() => []),
      fetchRankings().catch(() => ({ weight_classes: [] })),
      fetchEvents().catch(() => []),
    ])
      .then(([fighter, fights, stats, rankings, events]) => {
        if (cancelled) return
        let ranked = null, divisionLabel = null, divisionFighters = null
        for (const wc of rankings.weight_classes || []) {
          const hit = wc.fighters.find((f) => String(f.id) === String(id))
          if (hit && !wc.key.startsWith('p4p')) { ranked = hit; divisionLabel = wc.label; divisionFighters = wc.fighters; break }
          if (hit && !ranked) { ranked = hit; divisionLabel = wc.label; divisionFighters = wc.fighters }
        }
        const career = aggregateCareer(stats, fights, id)
        const eventMap = {}
        for (const e of events || []) eventMap[String(e.id)] = e.name
        setState({ loading: false, error: null, fighter, fights, career, ranked, divisionLabel, divisionFighters, rankings, eventMap })
      })
      .catch((e) => !cancelled && setState((s) => ({ ...s, loading: false, error: e.message })))
    return () => { cancelled = true }
  }, [id])

  const { loading, error, fighter, fights, career, ranked, divisionLabel, divisionFighters } = state

  // Resolve opponent data (name + image) for the recent-fights list.
  useEffect(() => {
    if (!fighter || !fights?.length) return
    const oppIds = [...new Set(fights.map((f) => (String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id)).filter(Boolean).map(String))]

    // Build lookup from ALL divisions in rankings data
    const fromRankings = {}
    for (const wc of state.rankings?.weight_classes || []) {
      for (const f of wc.fighters) {
        fromRankings[String(f.id)] = { name: `${f.first_name} ${f.last_name}`, image_url: f.image_url }
      }
    }

    // Apply known data immediately
    const resolved = {}
    const still = []
    for (const oid of oppIds) {
      if (oid in oppData) continue
      if (oid in fromRankings) resolved[oid] = fromRankings[oid]
      else still.push(oid)
    }
    if (Object.keys(resolved).length) {
      setOppData((prev) => ({ ...prev, ...resolved }))
    }

    if (!still.length) return
    let cancelled = false
    Promise.all(still.map((oid) => fetchFighter(oid).then((o) => [oid, { name: `${o.first_name} ${o.last_name}`, image_url: o.image_url }]).catch(() => [oid, { name: 'Unknown', image_url: null }])))
      .then((pairs) => { if (!cancelled) setOppData((prev) => ({ ...prev, ...Object.fromEntries(pairs) })) })
    return () => { cancelled = true }
  }, [fighter, fights, state.rankings]) // eslint-disable-line react-hooks/exhaustive-deps

  const profile = useMemo(() => {
    if (!ranked || !divisionFighters) return null
    return deriveProfile(ranked, buildPercentile(divisionFighters))
  }, [ranked, divisionFighters])

  const upcoming = useMemo(() => {
    if (!fighter || !fights?.length) return null
    const f = fights.find((f) => f.winner_id == null && !f.method && f.date && new Date(f.date) >= new Date())
    if (!f) return null
    const oppId = String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id
    return { id: f.id, oppId, date: f.date }
  }, [fights, fighter])

  const recent = useMemo(() => {
    if (!fighter) return []
    return (fights || [])
      .filter((f) => f.winner_id != null || f.method)
      .slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map((f) => {
        const win = String(f.winner_id) === String(fighter.id)
        const oppId = String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id
        const eventName = state.eventMap?.[String(f.event_id)] || null
        return { id: f.id, win, oppId, method: methodLabel(f.method), detail: f.details || '', round: f.finish_round, time: f.finish_time, date: f.date, eventName }
      })
  }, [fights, fighter, state.eventMap])

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (error) return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load fighter: {error}</p></CardContent></Card>
  if (!fighter) return null

  const isChamp = ranked?.rank === 1
  const record = formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* top bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 pb-3">
        <Link to="/ufc/fighters/stats" className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to fighters
        </Link>
        {ranked && <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{ranked.rank} {divisionLabel}</span>}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 lg:flex-row">
        {/* ---------------- LEFT: identity + scores ---------------- */}
        <div className="flex shrink-0 flex-col gap-3 overflow-y-auto p-3 lg:w-[280px]">
          {/* identity */}
          <div className="rounded-lg border border-border p-3">
            <div className="relative flex h-[200px] items-end justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-blue-500/10 to-transparent">
              <WavingFlag countryCode={fighter.country_code} />
              {fighter.image_url ? (
                <img src={fighter.image_url} alt={`${fighter.first_name} ${fighter.last_name}`} className="relative z-10 h-[190px] object-contain object-bottom" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-extrabold text-muted-foreground/30">{initialsOf(fighter)}</div>
              )}
              {isChamp && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-amber-600 backdrop-blur">
                  <Crown className="h-3 w-3" /> CHAMPION
                </div>
              )}
            </div>

            <div className="mt-2.5">
              <div className="flex items-center gap-2">
                <CountryFlag countryCode={fighter.country_code} />
                <h1 className="text-xl font-extrabold leading-none tracking-tight">{fighter.first_name} {fighter.last_name}</h1>
              </div>
              {fighter.nickname && <div className="mt-0.5 text-xs text-muted-foreground">"{fighter.nickname}"</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums">{record}</span>
                {ranked && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">Power {ranked.score.toFixed(0)}</span>}
              </div>
            </div>

            {/* bio */}
            <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t pt-2.5 text-sm">
              {[['Height', fighter.height], ['Weight', fighter.weight], ['Reach', fighter.reach], ['Stance', fighter.stance]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</div><div className="font-semibold text-[13px]">{v}</div></div>
              ))}
            </div>
          </div>

          {/* scores + outcomes */}
          <div className="rounded-lg border border-border p-3">
            {/* group scores */}
            {profile && (
              <div className="flex gap-1.5">
                {profile.groups.map((g) => (
                  <div key={g.label} className="flex-1 rounded-xl border bg-muted/40 py-2 text-center">
                    <div className={cn('text-lg font-extrabold leading-none tabular-nums', g.cls)}>{g.value}</div>
                    <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* outcomes */}
            {career?.hasStats && (
              <div className={profile ? 'mt-3' : ''}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Outcomes</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <StatTile label="Win %" value={`${career.winPct}%`} />
                  <StatTile label="Finish %" value={`${career.finishRate}%`} />
                  <StatTile label="KO/TKO" value={career.ko} />
                  <StatTile label="Submission" value={career.sub} />
                  <StatTile label="Decision" value={career.dec} />
                  <StatTile label="UFC fights" value={career.fightCount} />
                </div>
              </div>
            )}
          </div>

          {/* upcoming fight */}
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Upcoming Fight</div>
            {upcoming ? (() => {
              const opp = oppData[String(upcoming.oppId)]
              return (
                <div className="flex items-center gap-2.5">
                  <div className="shrink-0">
                    {opp?.image_url ? (
                      <img src={opp.image_url} alt="" className="h-9 w-9 rounded-full object-cover object-top" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {opp?.name ? opp.name.split(' ').map((n) => n[0]).join('') : '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/ufc/fighters/${upcoming.oppId}`} className="truncate text-[13px] font-bold hover:text-blue-600">
                      vs {opp?.name || 'TBA'}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">{formatDate(upcoming.date)}</div>
                  </div>
                </div>
              )
            })() : (
              <p className="text-xs text-muted-foreground">No upcoming fight scheduled</p>
            )}
          </div>
        </div>

        {/* ---------------- RIGHT: chart, decomposition, stats, fights ---------------- */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            {profile ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[260px_1fr]">
                {/* chart */}
                <div className="rounded-lg border border-border p-3 flex flex-col items-center">
                  <div className="mb-1.5 inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
                    {GRAPH_STYLES.map((g) => (
                      <button key={g.key} onClick={() => setGraph(g.key)} className={cn('rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors', graph === g.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{g.label}</button>
                    ))}
                  </div>
                  <div className="flex min-h-[220px] w-full items-center justify-center">
                    {graph === 'radar' && <RadarChart axes={profile.axes} />}
                    {graph === 'columns' && <RadialBars axes={profile.axes} overall={profile.overall} />}
                    {graph === 'rings' && <ActivityRings groups={profile.groups} overall={profile.overall} />}
                  </div>
                  <p className="mt-1 text-center text-[10px] leading-snug text-muted-foreground">{GRAPH_NOTE[graph]}</p>
                </div>

                {/* skill decomposition */}
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Skill Decomposition</span>
                    <span className="text-[11px] text-muted-foreground">vs {divisionLabel}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                    <div className="flex flex-col justify-between">
                      <div className="mb-2.5 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Striking</span><span className="text-xs font-extrabold tabular-nums text-amber-600">{profile.strikingScore} avg</span></div>
                      <div className="flex flex-1 flex-col justify-between gap-2.5">{profile.striking.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                    <div className="flex flex-col justify-between">
                      <div className="mb-2.5 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Grappling</span><span className="text-xs font-extrabold tabular-nums text-indigo-600">{profile.grapplingScore} avg</span></div>
                      <div className="flex flex-1 flex-col justify-between gap-2.5">{profile.grappling.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">No ranked skill decomposition for this fighter (unranked or insufficient rounds).</div>
            )}

            {/* career stats + recent fights side by side */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
              {/* career stats (striking + grappling only) */}
              {career?.hasStats && (
                <div className="min-h-0 overflow-y-auto rounded-lg border border-border p-4">
                  <div className="mb-2.5 text-[13px] font-extrabold tracking-tight">Career Stats</div>
                  <div className="space-y-2.5">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-600">Striking</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <StatTile label="Sig. str/min" value={career.slpm.toFixed(2)} />
                        <StatTile label="Total str/min" value={career.tslpm.toFixed(2)} />
                        <StatTile label="Str. acc" value={`${career.sigAcc}%`} />
                        <StatTile label="KD / 15" value={career.kd15.toFixed(2)} />
                        <StatTile label="Head" value={`${career.head}%`} />
                        <StatTile label="Body" value={`${career.body}%`} />
                        <StatTile label="Leg" value={`${career.leg}%`} />
                        <StatTile label="Distance" value={`${career.distance}%`} />
                        <StatTile label="Clinch" value={`${career.clinch}%`} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Grappling</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <StatTile label="TD / 15" value={career.td15.toFixed(2)} />
                        <StatTile label="TD acc" value={`${career.tdAcc}%`} />
                        <StatTile label="Ctrl / 15" value={career.ctrl15Str} />
                        <StatTile label="Sub att / 15" value={career.subAtt15.toFixed(1)} />
                        <StatTile label="Rev / 15" value={career.rev15.toFixed(1)} />
                        <StatTile label="Ground" value={`${career.ground}%`} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* recent fights */}
              <div className="flex min-h-0 flex-col rounded-lg border border-border">
                <div className="flex shrink-0 items-center justify-between px-4 py-2.5"><span className="text-[13px] font-extrabold tracking-tight">Recent Fights</span><span className="text-[11px] text-muted-foreground">{recent.length} fights</span></div>
                {recent.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No fight history available.</p>
                ) : (
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="flex flex-col gap-1.5 p-3">
                      {recent.map((r) => {
                        const opp = oppData[String(r.oppId)]
                        return (
                          <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
                            <div className="relative shrink-0">
                              {opp?.image_url ? (
                                <img src={opp.image_url} alt="" className="h-9 w-9 rounded-full object-cover object-top" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                  {opp?.name ? opp.name.split(' ').map((n) => n[0]).join('') : '?'}
                                </div>
                              )}
                              <div className={cn('absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full text-[8px] font-extrabold ring-2 ring-background', r.win ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>{r.win ? 'W' : 'L'}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link to={`/ufc/fighters/${r.oppId}`} className="truncate text-[13px] font-bold hover:text-blue-600">{opp?.name || 'Unknown'}</Link>
                              <div className="text-[11px] text-muted-foreground">
                                <span className="font-semibold text-foreground/70">{r.method}</span>
                                {r.round ? ` · R${r.round}` : ''}{r.time ? ` ${r.time}` : ''}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              {r.date && <div className="text-[10px] text-muted-foreground">{formatDate(r.date)}</div>}
                              {r.eventName && <div className="mt-0.5 max-w-[120px] truncate text-[9px] text-muted-foreground/70">{r.eventName}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

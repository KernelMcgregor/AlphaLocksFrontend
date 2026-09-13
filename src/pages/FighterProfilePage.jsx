// src/pages/FighterProfilePage.jsx
import { ArrowLeft, ChevronRight, Crown, Flame, Loader2, Swords, Timer, TrendingUp } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CountryFlag from '../components/CountryFlag'
import HeaderActions from '../components/layout/HeaderActions'
import SimilarFighters from '../components/sports/SimilarFighters'
import { Card, CardContent } from '../components/ui/card'
import { SlideTabs } from '../components/ui/slide-tabs'
import { Tip } from '../components/ui/tip'
import FighterMini from '../components/sports/FighterMini'
import WavingFlag from '../components/sports/WavingFlag'
// Shared chart vocabulary — these used to live in this file. See components/viz/.
import ActivityBars from '../components/viz/ActivityBars'
import BumpChart from '../components/viz/BumpChart'
import DimBar from '../components/viz/DimBar'
import { DumbbellRow, TwoWayLegend } from '../components/viz/Dumbbell'
import FormStrip from '../components/viz/FormStrip'
import HeroTile from '../components/viz/HeroTile'
import MirrorBars from '../components/viz/MirrorBars'
import RadarChart from '../components/viz/RadarChart'
import RoundPacing from '../components/viz/RoundPacing'
import Section from '../components/viz/Section'
import SkillCallout from '../components/viz/SkillCallout'
import SlideControls from '../components/viz/SlideControls'
import SplitBar from '../components/viz/SplitBar'
import StatTile from '../components/viz/StatTile'
import { useScrollSpy, useSlidingWindow } from '../components/viz/hooks'
// NOTE: add `export const fetchFighterStats = (id) => cachedRequest(`/ufc/fighters/${id}/stats`)`
// to src/lib/api.js — the endpoint already exists in routers/ufc.py.
import { fetchEvents, fetchFighter, fetchFighterCareerStats, fetchFighterFights, fetchFighterRankHistory, fetchFighterStats, fetchRankings } from '../lib/api'
import { clock, cn, formatDate, formatRecord } from '../lib/utils'
import { aggregateCareer, buildPercentile, deriveForm, deriveProfile, deriveRoundPacing, deriveRoundSurvival, deriveTwoWay, methodLabel } from '../lib/fighterAnalytics'
import FighterImage from '../components/sports/FighterImage'

// Captured once at module load — age only changes yearly, and reading the clock
// during render is impure.
const NOW = Date.now()

// Order here is the order they appear in the scrolling column.
const SECTIONS = [
  { key: 'skills', label: 'Skills' },
  { key: 'overview', label: 'Career Overview' },
  { key: 'career', label: 'Career Stats' },
  { key: 'fights', label: 'Fight History' },
]

// UFC.com writes "--" for a missing measurement rather than leaving it blank, and a
// truthy string sails through a plain falsy check. Reach alone has ~1,983 of them.
function val(v) {
  const t = typeof v === 'string' ? v.trim() : v
  return !t || t === '--' ? null : t
}

// Backend division keys are snake_case ("light_heavyweight", "p4p_men").
function divisionName(key) {
  if (!key) return null
  if (key.startsWith('p4p')) return 'Pound-for-pound'
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}


const STAT_KEYS = [
  'kd', 'sig_str_landed', 'sig_str_attempted', 'total_str_landed', 'total_str_attempted',
  'td_landed', 'td_attempted', 'sub_att', 'rev', 'ctrl_seconds',
  'head_landed', 'body_landed', 'leg_landed', 'distance_landed', 'clinch_landed', 'ground_landed',
]

// Per-fight totals: prefer the totals row (round_number 0), else sum the rounds.
function fightTotals(data) {
  if (!data) return null
  if (data.total) return data.total
  if (!data.rounds.length) return null
  const out = {}
  for (const k of STAT_KEYS) out[k] = data.rounds.reduce((sum, r) => sum + (Number(r[k]) || 0), 0)
  return out
}

// Expanded fight row — the fighter's own stat line for that bout.
// A row is padding if nothing at all was recorded in it.
const EMPTY_ROUND = (r) => !(
  Number(r.sig_str_attempted) || Number(r.total_str_attempted) || Number(r.td_attempted)
  || Number(r.sub_att) || Number(r.kd) || Number(r.ctrl_seconds) || Number(r.rev)
)

function FightDetail({ detail, data, finishRound }) {
  const t = fightTotals(data)

  // 286 fighter-fights carry zero-filled stat rows past the round the bout
  // actually ended in — one runs to R23 — so the table has to be capped rather
  // than rendering whatever rows exist. finish_round is authoritative; when it is
  // missing (no-contests) fall back to trimming the trailing empty rows.
  const rounds = useMemo(() => {
    const all = data?.rounds || []
    if (finishRound) return all.filter((r) => Number(r.round_number) <= finishRound)
    const out = all.slice()
    while (out.length && EMPTY_ROUND(out[out.length - 1])) out.pop()
    return out
  }, [data, finishRound])
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)
  const target = (t?.head_landed || 0) + (t?.body_landed || 0) + (t?.leg_landed || 0)
  const position = (t?.distance_landed || 0) + (t?.clinch_landed || 0) + (t?.ground_landed || 0)

  return (
    <div className="space-y-3 border-l-2 border-l-blue-500/40 bg-muted/25 px-3 py-2.5">
      {detail && <p className="text-[11.5px] leading-snug text-foreground/80">{detail}</p>}

      {!t ? (
        <p className="text-[11px] text-muted-foreground">No statistics recorded for this fight.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-6">
            <StatTile label="Sig. Strikes" value={`${t.sig_str_landed}/${t.sig_str_attempted}`} />
            <StatTile label="Sig. Accuracy" value={`${pct(t.sig_str_landed, t.sig_str_attempted)}%`} />
            <StatTile label="Total Strikes" value={t.total_str_landed} />
            <StatTile label="Knockdowns" value={t.kd} />
            <StatTile label="Takedowns" value={`${t.td_landed}/${t.td_attempted}`} />
            <StatTile label="Control" value={clock(t.ctrl_seconds)} />
          </div>

          {(target > 0 || position > 0) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {target > 0 && (
                <SplitBar
                  title="Target"
                  segments={[
                    { label: 'Head', value: pct(t.head_landed, target), cls: 'bg-viz-1' },
                    { label: 'Body', value: pct(t.body_landed, target), cls: 'bg-viz-2' },
                    { label: 'Leg', value: pct(t.leg_landed, target), cls: 'bg-viz-3' },
                  ]}
                />
              )}
              {position > 0 && (
                <SplitBar
                  title="Position"
                  segments={[
                    { label: 'Distance', value: pct(t.distance_landed, position), cls: 'bg-viz-1' },
                    { label: 'Clinch', value: pct(t.clinch_landed, position), cls: 'bg-viz-2' },
                    { label: 'Ground', value: pct(t.ground_landed, position), cls: 'bg-viz-3' },
                  ]}
                />
              )}
            </div>
          )}

          {rounds.length > 0 && (
            <div>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">By round</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-[11px]">
                  <thead>
                    <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="py-1 pr-3 font-bold">Rd</th>
                      <th className="py-1 pr-3 font-bold">Sig. str</th>
                      <th className="py-1 pr-3 font-bold">Total str</th>
                      <th className="py-1 pr-3 font-bold">TD</th>
                      <th className="py-1 pr-3 font-bold">Sub att</th>
                      <th className="py-1 pr-3 font-bold">KD</th>
                      <th className="py-1 font-bold">Control</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {rounds.map((r) => (
                      <tr key={r.round_number} className="border-t border-border/60">
                        <td className="py-1 pr-3 font-bold">R{r.round_number}</td>
                        <td className="py-1 pr-3">{r.sig_str_landed}/{r.sig_str_attempted}</td>
                        <td className="py-1 pr-3">{r.total_str_landed}/{r.total_str_attempted}</td>
                        <td className="py-1 pr-3">{r.td_landed}/{r.td_attempted}</td>
                        <td className="py-1 pr-3">{r.sub_att}</td>
                        <td className="py-1 pr-3">{r.kd}</td>
                        <td className="py-1">{clock(r.ctrl_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function FighterProfilePage() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: null, fighter: null, fights: [], career: null, ranked: null, divisionLabel: null, divisionFighters: null })
  const { scrollRef, register, active, scrollTo } = useScrollSpy(SECTIONS)
  const [openFight, setOpenFight] = useState(null) // one expanded row at a time
  const [strikeMode, setStrikeMode] = useState('pct') // strike map: share vs per-minute
  const [oppData, setOppData] = useState({}) // { [fighterId]: { name, image_url } }

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.all([
      fetchFighter(id),
      fetchFighterFights(id).catch(() => []),
      fetchFighterStats(id).catch(() => []),
      fetchRankings().catch(() => ({ weight_classes: [] })),
      // Must pass a limit — /ufc/events defaults to 50, which only names fights
      // from the 50 most recent events. 500 is the endpoint's cap and matches
      // what UFCPage/ModelPage request, so this shares their cache entry.
      fetchEvents({ limit: 500 }).catch(() => []),
      // Empty until the rank-history backfill has been run; the chart falls back
      // to output-per-fight in that case.
      fetchFighterRankHistory(id).catch(() => []),
      // The opponent-relative half of the career line. 404s for anyone with no
      // computed row (a debut fighter), which is normal — null, not an error.
      fetchFighterCareerStats(id).catch(() => null),
    ])
      .then(([fighter, fights, stats, rankings, events, rankHistory, cstats]) => {
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
        setState({ loading: false, error: null, fighter, fights, stats, rankHistory, cstats, career, ranked, divisionLabel, divisionFighters, rankings, eventMap })
      })
      .catch((e) => !cancelled && setState((s) => ({ ...s, loading: false, error: e.message })))
    return () => { cancelled = true }
  }, [id])

  const { loading, error, fighter, fights, career, ranked, divisionLabel, divisionFighters } = state

  // Resolve opponent data (name + image) for the recent-fights list.
  useEffect(() => {
    if (!fighter || !fights?.length) return
    const oppIds = [...new Set(fights.map((f) => (String(f.red_fighter_id) === String(fighter.id) ? f.blue_fighter_id : f.red_fighter_id)).filter(Boolean).map(String))]

    // Build lookup from ALL divisions in rankings data. Carries enough for the
    // hover card (record, rank, nickname), not just name + image.
    const fromRankings = {}
    for (const wc of state.rankings?.weight_classes || []) {
      const isP4P = wc.key?.startsWith('p4p')
      for (const f of wc.fighters) {
        const key = String(f.id)
        // A fighter appears in their division and in p4p; the divisional rank is
        // the meaningful one, so never let p4p overwrite it.
        if (fromRankings[key] && isP4P) continue
        fromRankings[key] = {
          name: `${f.first_name} ${f.last_name}`,
          image_url: f.image_url,
          nickname: f.nickname,
          country_code: f.country_code,
          record: formatRecord(f.wins, f.losses, f.draws || undefined),
          rank: isP4P ? null : f.rank,
          division: isP4P ? null : wc.label,
        }
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
    Promise.all(still.map((oid) => fetchFighter(oid)
      .then((o) => [oid, {
        name: `${o.first_name} ${o.last_name}`,
        image_url: o.image_url,
        nickname: o.nickname,
        country_code: o.country_code,
        record: formatRecord(o.wins, o.losses, o.draws || undefined),
      }])
      .catch(() => [oid, { name: 'Unknown', image_url: null }])))
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

  const form = useMemo(() => (fighter ? deriveForm(fights, fighter.id) : null), [fights, fighter])

  // Per-fight stat rows keyed by fight, split into the totals row and the rounds.
  const statsByFight = useMemo(() => {
    const map = {}
    for (const r of state.stats || []) {
      const k = String(r.fight_id)
      if (!map[k]) map[k] = { total: null, rounds: [] }
      if (Number(r.round_number) === 0) map[k].total = r
      else map[k].rounds.push(r)
    }
    for (const k of Object.keys(map)) map[k].rounds.sort((a, b) => a.round_number - b.round_number)
    return map
  }, [state.stats])

  // Significant strikes landed per minute, per fight, oldest first.
  const outputTrend = useMemo(() => {
    const fightById = {}
    for (const f of fights || []) fightById[String(f.id)] = f
    return recent
      .slice()
      .reverse()
      .map((r) => {
        const t = fightTotals(statsByFight[String(r.id)])
        const secs = fightById[String(r.id)]?.fight_time_seconds
        if (!t || !secs) return null
        // winner_id null means draw or no contest — null, not false, so the dot
        // stays neutral instead of being coloured as a loss.
        const decided = fightById[String(r.id)]?.winner_id != null
        return {
          id: r.id,
          date: r.date,
          win: decided ? r.win : null,
          oppId: r.oppId,
          spm: t.sig_str_landed / (secs / 60),
        }
      })
      .filter(Boolean)
  }, [recent, statsByFight, fights])

  // Rank after each bout when the backfill has been run, else the output series.
  // Both are per-fight and oldest-first, so the chart consumes them identically.
  const rankTrend = useMemo(() => (state.rankHistory || []).map((r) => ({
    id: r.fight_id || r.as_of,
    date: r.as_of,
    win: r.won,
    oppId: r.opponent_id,
    rank: r.rank,
    totalRanked: r.total_ranked,
    division: r.weight_class,
  })), [state.rankHistory])

  const usingRank = rankTrend.length > 1
  const trendData = usingRank ? rankTrend : outputTrend

  // Long careers get windowed so the charts stay readable. Both slide by a few
  // items per click rather than paging, so the series reads as one spectrum.
  const TREND_WIN = 12
  const YEAR_WIN = 6

  // Rank axis: always anchored at #1, extending only as far as the worst rank this
  // fighter actually held, so the scale is sized to their career rather than the
  // division. Ticks step 1, 5, 10, 15…
  const rankAxis = useMemo(() => {
    if (!usingRank) return null
    const worst = Math.max(...rankTrend.map((p) => p.rank), 1)
    const ticks = [1]
    for (let v = 5; v <= worst; v += 5) ticks.push(v)
    return { domain: [1, Math.max(worst + 0.4, 2)], ticks }
  }, [usingRank, rankTrend])
  const trendWin = useSlidingWindow(trendData.length, TREND_WIN, 5)
  const yearWin = useSlidingWindow(form?.activity?.length || 0, YEAR_WIN, 3)

  // Offense-vs-defense pairs and the strike map, from the server's career row.
  const twoWay = useMemo(() => deriveTwoWay(state.cstats), [state.cstats])

  // Tiles that also appear as a dumbbell endpoint must agree with it. aggregateCareer
  // counts only fights present in the stats payload AND carrying fight_time_seconds;
  // the server counts every fight with a totals row. Same metric, different fight
  // set, values differing in the second decimal — inches apart on screen. Prefer the
  // server row wherever it exists and fall back to the client aggregate.
  const tiles = useMemo(() => {
    const cs = state.cstats
    if (!cs || !career) return career
    const pick = (server, client, scale = 1) => (server == null ? client : server * scale)
    return {
      ...career,
      slpm: pick(cs.slpm, career.slpm),
      tslpm: pick(cs.tslpm, career.tslpm),
      sigAcc: Math.round(pick(cs.sig_acc, career.sigAcc / 100, 1) * 100),
      kd15: pick(cs.kd15, career.kd15),
      td15: pick(cs.td15, career.td15),
      tdAcc: Math.round(pick(cs.td_acc, career.tdAcc / 100, 1) * 100),
      ctrl15Str: cs.ctrl15 == null ? career.ctrl15Str : clock(cs.ctrl15),
      subAtt15: pick(cs.sub_att15, career.subAtt15),
    }
  }, [state.cstats, career])

  // Per-round pacing, pooled across every bout. Reuses the statsByFight index.
  const pacing = useMemo(
    () => deriveRoundPacing(statsByFight, fights),
    [statsByFight, fights],
  )

  const survival = useMemo(
    () => (fighter ? deriveRoundSurvival(fights, fighter.id) : null),
    [fights, fighter],
  )

  const toggleFight = (id) => setOpenFight((prev) => (prev === id ? null : id))

  // Extra bio rows derived from what the fighter/fight records already carry.
  const bio = useMemo(() => {
    if (!fighter) return {}
    const dated = (fights || [])
      .filter((f) => f.date && (f.winner_id != null || f.method))
      .map((f) => f.date)
      .sort()
    return {
      age: fighter.dob ? Math.floor((NOW - new Date(`${fighter.dob}T00:00:00`)) / 31557600000) : null,
      // Prefer the scraped octagon_debut; fall back to the earliest dated bout.
      debut: fighter.octagon_debut
        ? new Date(`${fighter.octagon_debut}T00:00:00`).getFullYear()
        : (dated.length ? new Date(`${dated[0]}T00:00:00`).getFullYear() : null),
      last: dated.length ? formatDate(dated[dated.length - 1]) : null,
    }
  }, [fighter, fights])

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (error) return <Card><CardContent className="p-6"><p className="text-destructive">Failed to load fighter: {error}</p></CardContent></Card>
  if (!fighter) return null

  const isChamp = ranked?.rank === 1
  const record = formatRecord(fighter.wins, fighter.losses, fighter.draws || undefined)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden lg:flex-row">
      {/* Actions live in the Layout breadcrumb row — see HeaderActions. */}
      <HeaderActions>
        <SlideTabs
          size="sm"
          value={active}
          onChange={scrollTo}
          tabs={SECTIONS.map((sec) => (
            sec.key === 'fights' ? { ...sec, badge: recent.length || null } : sec
          ))}
        />
        <Link to="/ufc/fighters/stats" className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to fighters
        </Link>
      </HeaderActions>

      {/* ---------------- LEFT: identity + scores ---------------- */}
      <div className="flex shrink-0 flex-col gap-3 overflow-y-auto lg:w-[280px]">
          {/* identity */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border p-2.5">
            {/* flex-1 so the portrait takes any leftover column height — otherwise the
                slack collects as dead space between this card and the one below. */}
            <div className="relative flex min-h-[132px] flex-1 items-end justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-blue-500/10 to-transparent">
              <WavingFlag countryCode={fighter.country_code} />
              <FighterImage
                fighter={fighter}
                fit="contain"
                alt={`${fighter.first_name} ${fighter.last_name}`}
                className="relative z-10 h-full w-full"
              />
              {isChamp && (
                <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-amber-600 backdrop-blur">
                  <Crown className="h-3 w-3" /> CHAMPION
                </div>
              )}
            </div>

            <div className="mt-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <CountryFlag countryCode={fighter.country_code} />
                <h1 className="text-lg font-extrabold leading-none tracking-tight">{fighter.first_name} {fighter.last_name}</h1>
              </div>
              {fighter.nickname && <div className="mt-0.5 text-[11px] text-muted-foreground">"{fighter.nickname}"</div>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-bold tabular-nums">{record}</span>
                {ranked && <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">Power {ranked.score.toFixed(0)}</span>}
                {ranked && divisionLabel && (
                  <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600">#{ranked.rank} {divisionLabel}</span>
                )}
              </div>
            </div>

            {/* bio — fixed row groups. Each row lays its surviving fields out evenly,
                and a row with nothing in it disappears, so sparse fields (style ~23%,
                gym ~24%, leg reach ~35%) collapse cleanly instead of leaving holes. */}
            <div className="mt-2 flex shrink-0 flex-col gap-1.5 border-t pt-2">
              {[
                [['Age', bio.age ? `${bio.age} yrs` : null], ['Height', val(fighter.height)], ['Weight', val(fighter.weight)]],
                [['Reach', val(fighter.reach)], ['Leg reach', val(fighter.leg_reach) ? `${fighter.leg_reach}"` : null]],
                [['Stance', val(fighter.stance)], ['Style', val(fighter.fighting_style)]],
                [
                  ['UFC debut', bio.debut],
                  // completed bouts in the fight log; career.fightCount only counts
                  // the ones that also have stat rows, so it undercounts
                  ['UFC fights', form?.results?.length || career?.fightCount || null],
                  ['Last activity', form?.daysSinceLast != null ? `${form.daysSinceLast} days` : null],
                ],
                [['From', val(fighter.birthplace)]],
                [['Gym', val(fighter.trains_at)]],
              ].map((row) => row.filter(([, v]) => v)).filter((row) => row.length).map((row) => (
                <div key={row.map(([k]) => k).join('-')} className="flex gap-2">
                  {row.map(([k, v]) => (
                    <div key={k} className="min-w-0 flex-1">
                      <div className="truncate whitespace-nowrap text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{k}</div>
                      <div className="truncate text-[13.5px] font-semibold leading-snug" title={String(v)}>{v}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* last / next fight, side by side under the bio */}
          <div className="grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-border p-2.5">
            {(() => {
              const last = form?.results?.[0]
              const opp = last ? oppData[String(last.oppId)] : null
              return (
                <div className="min-w-0">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Last fight</div>
                  {last ? (
                    <Tip content={<FighterMini f={opp} />}>
                    <Link to={`/ufc/fighters/${last.oppId}`} className="flex items-center gap-2 rounded-md transition-colors hover:bg-muted/50">
                      <div className="relative shrink-0">
                        <FighterImage fighter={opp} className="h-8 w-8 rounded-full bg-muted" />
                        <span className={cn(
                          'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-extrabold text-white ring-2 ring-card',
                          last.draw ? 'bg-slate-400' : last.win ? 'bg-emerald-500' : 'bg-rose-500',
                        )}>{last.draw ? 'D' : last.win ? 'W' : 'L'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold leading-tight">{opp?.name || 'Unknown'}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{last.date ? formatDate(last.date) : '—'}</div>
                      </div>
                    </Link>
                    </Tip>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No recorded fights</p>
                  )}
                </div>
              )
            })()}

            {(() => {
              const opp = upcoming ? oppData[String(upcoming.oppId)] : null
              return (
                <div className="min-w-0 border-l border-border pl-2.5">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Next fight</div>
                  {upcoming ? (
                    <Tip content={<FighterMini f={opp} />}>
                    <Link to={`/ufc/fighters/${upcoming.oppId}`} className="flex items-center gap-2 rounded-md transition-colors hover:bg-muted/50">
                      <FighterImage fighter={opp} className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-bold leading-tight">{opp?.name || 'TBA'}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{formatDate(upcoming.date)}</div>
                      </div>
                    </Link>
                    </Tip>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Not scheduled</p>
                  )}
                </div>
              )
            })()}
          </div>

        </div>

      {/* ------ RIGHT: one card, four tabs (skills / overview / stats / fights) ------ */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {/* one scroll container, one section per tab. `relative` matters: the spy
            reads section.offsetTop, which is measured against the offset parent. */}
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto p-4">
          {/* the rule belongs to the gap between sections, so it is applied to
              every section that follows another rather than to each one */}
          <div className="flex flex-col gap-5 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-5">

          <Section
            id="skills"
            title="Skills"
            note={profile ? `vs ${divisionLabel}` : null}
            register={register}
          >
            {profile ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,320px)_1fr]">
                {/* radar + best/worst axes */}
                <div className="flex flex-col rounded-lg border border-border p-3">
                  <div className="mb-1 flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Skill Radar</span>
                    <span className="text-[11px] text-muted-foreground">vs {divisionLabel}</span>
                  </div>
                  {/* radar takes the slack and scales down when the window is short;
                      max-h-full keeps it inside the card instead of forcing a scroll */}
                  <RadarChart axes={profile.axes} />
                  <p className="mt-1 shrink-0 text-center text-[10px] text-muted-foreground">
                    Hover an axis for detail · radius = percentile
                  </p>
                  <div className="mt-2.5 shrink-0 space-y-2 border-t pt-2.5">
                    <SkillCallout label="Strengths" dims={profile.strengths.slice(0, 3)} cls="text-emerald-600" />
                    <SkillCallout label="Weaknesses" dims={profile.weaknesses.slice(0, 3)} cls="text-rose-600" />
                  </div>

                  <div className="mb-1 mt-2.5 shrink-0 text-[9px] font-bold uppercase tracking-wide text-blue-600">Group Averages</div>
                  <div className="grid shrink-0 grid-cols-3 gap-1.5">
                    {profile.groups.map((g) => (
                      <div key={g.label} className="rounded-xl border bg-muted/40 py-2 text-center">
                        <div className={cn('text-lg font-extrabold leading-none tabular-nums', g.cls)}>{g.value}</div>
                        <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* skill decomposition */}
                <div className="flex flex-col rounded-lg border border-border p-3">
                  <div className="mb-2 flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Skill Decomposition</span>
                    <span className="text-[11px] text-muted-foreground">vs {divisionLabel}</span>
                  </div>
                  {/* Striking above, grappling below — one full-width column each,
                      so the bar track gets the whole card width instead of ~20px. */}
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="flex flex-1 flex-col">
                      <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Striking</span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-1.5">{profile.striking.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Grappling</span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-1.5">{profile.grappling.map((d) => <DimBar key={d.key} dim={d} />)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No ranked skill decomposition for this fighter (unranked or insufficient rounds).</p>
            )}
          </Section>

          <Section id="overview" title="Career Overview" register={register}>
            {form ? (
              <div className="grid flex-1 gap-3 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <HeroTile
                      icon={Flame}
                      label="Current streak"
                      value={`${form.streak}${form.streakWin ? 'W' : 'L'}`}
                      sub={`Longest win run: ${form.longestWin}`}
                      accent={form.streakWin ? 'text-emerald-500' : 'text-rose-500'}
                    />
                    <HeroTile icon={Timer} label="Octagon" value={form.octagonTime} sub={`Avg ${form.avgFightTime}`} />
                    <HeroTile icon={Swords} label="R1 finishes" value={form.r1Finishes} sub={`${form.distanceRate}% decisions`} />
                    <HeroTile
                      icon={TrendingUp}
                      label="Last fight"
                      value={form.daysSinceLast != null ? `${form.daysSinceLast}d` : '—'}
                      sub={form.lastDate ? formatDate(form.lastDate) : 'Date unknown'}
                    />
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Recent form</span>
                      <span className="text-[10px] text-muted-foreground">most recent first</span>
                    </div>
                    <FormStrip results={form.recentForm} oppData={oppData} eventMap={state.eventMap} />
                  </div>

                  {form.activity.length > 1 && (
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Fights per year</span>
                        {form.activity.length > 6 && (
                          <SlideControls
                            win={yearWin}
                            label={`${form.activity[yearWin.start]?.year ?? ''}–${form.activity[yearWin.end - 1]?.year ?? ''}`}
                          />
                        )}
                      </div>
                      <ActivityBars
                        activity={form.activity}
                        oppData={oppData}
                        start={yearWin.start}
                        size={YEAR_WIN}
                      />
                    </div>
                  )}

                  {trendData.length > 1 && (
                    <div className="flex h-[230px] flex-col rounded-lg border border-border p-2.5">
                      <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">
                          {usingRank ? 'Rank after each fight' : 'Output per fight'}
                        </span>
                        <SlideControls
                          win={trendWin}
                          label={`${trendWin.start + 1}–${trendWin.end} of ${trendData.length}`}
                        />
                      </div>
                      <BumpChart
                        start={trendWin.start}
                        size={TREND_WIN}
                        domain={rankAxis?.domain}
                        ticks={rankAxis?.ticks}
                        yLabel={usingRank ? 'RANK' : 'SIG. STR/MIN'}
                        invertY={usingRank}
                        formatValue={usingRank ? (v) => `#${Math.round(v)}` : (v) => v.toFixed(2)}
                        points={trendData.map((p) => {
                          const div = p.division ? divisionName(p.division) : null
                          return {
                            id: p.id,
                            win: p.win,
                            label: p.date ? String(p.date).slice(0, 4) : '—',
                            title: `${p.win == null ? '' : p.win ? 'W' : 'L'} vs ${oppData?.[String(p.oppId)]?.name || 'Unknown'}`.trim(),
                            sub: p.date ? formatDate(p.date) : null,
                            context: usingRank && div ? `${div}${p.totalRanked ? ` · of ${p.totalRanked}` : ''}` : null,
                            division: usingRank ? p.division : null,
                            divisionLabel: usingRank ? div : null,
                          }
                        })}
                        series={[{
                          key: usingRank ? 'rank' : 'spm',
                          label: usingRank ? 'Divisional rank' : 'Sig. str/min',
                          color: 'var(--color-viz-1)',
                          values: trendData.map((p) => (usingRank ? p.rank : p.spm)),
                        }]}
                      />
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col gap-3">
                  <div className="space-y-3 rounded-lg border border-border p-2.5">
                    {/* third person singular once the name is in: "wins" / "loses" */}
                    <SplitBar title={`How ${fighter.last_name} wins · ${form.totalWins}`} segments={form.winMethods} unit="" />
                    <SplitBar title={`How ${fighter.last_name} loses · ${form.totalLosses}`} segments={form.lossMethods} unit="" />
                  </div>

                  {career?.hasStats && (
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Career rates</div>
                      {/* Win%/Finish% live in the left panel — these are per-time rates instead. */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <StatTile label="Sig. Str / Min" value={tiles.slpm.toFixed(2)} />
                        <StatTile label="Str. Acc" value={`${career.sigAcc}%`} />
                        <StatTile label="KD / 15" value={career.kd15.toFixed(2)} />
                        <StatTile label="TD / 15" value={tiles.td15.toFixed(2)} />
                        <StatTile label="TD Acc" value={`${career.tdAcc}%`} />
                        <StatTile label="Ctrl / 15" value={career.ctrl15Str} />
                      </div>
                    </div>
                  )}

                  <SimilarFighters fighterId={fighter.id} className="flex flex-1 flex-col" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed fight history available.</p>
            )}
          </Section>

          <Section
            id="career"
            title="Career Stats"
            note={twoWay ? `${twoWay.fightCount} fights · ${Math.round(twoWay.totalMin ?? 0)} min logged` : null}
            register={register}
          >
            {career?.hasStats ? (
              <div className="flex flex-col gap-3">
              <div className="grid gap-3 xl:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Outcomes</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="Win %" value={`${career.winPct}%`} />
                    <StatTile label="Finish %" value={`${career.finishRate}%`} />
                    <StatTile
                      label="Avg Fight Time"
                      value={state.cstats?.avg_fight_sec != null ? clock(state.cstats.avg_fight_sec) : (form?.avgFightTime ?? '—')}
                    />
                    <StatTile label="Reversals / 15" value={career.rev15.toFixed(1)} />
                  </div>
                  <div className="mt-3 border-t pt-2.5">
                    <SplitBar
                      title={`Win Methods · ${career.ko + career.sub + career.dec}`}
                      unit=""
                      segments={[
                        { label: 'KO/TKO', value: career.ko, cls: 'bg-viz-1' },
                        { label: 'Submission', value: career.sub, cls: 'bg-viz-2' },
                        { label: 'Decision', value: career.dec, cls: 'bg-viz-3' },
                      ]}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">Striking</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="Sig. Str / Min" value={career.slpm.toFixed(2)} />
                    <StatTile label="Total Str / Min" value={tiles.tslpm.toFixed(2)} />
                    <StatTile label="Sig. Str. Accuracy" value={`${tiles.sigAcc}%`} />
                    <StatTile label="Knockdowns / 15" value={tiles.kd15.toFixed(2)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                    <StatTile label="Sig. Strikes Landed" value={career.totals.sig.toLocaleString()} />
                    <StatTile label="Sig. Strikes Thrown" value={career.totals.sigAtt.toLocaleString()} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-600">Grappling</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <StatTile label="TD / 15" value={career.td15.toFixed(2)} />
                    <StatTile label="TD Accuracy" value={`${tiles.tdAcc}%`} />
                    <StatTile label="Control / 15" value={tiles.ctrl15Str} />
                    <StatTile label="Sub Att / 15" value={tiles.subAtt15.toFixed(1)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                    <StatTile label="Takedowns Landed" value={career.totals.td} />
                    <StatTile label="Total Control" value={`${Math.round(career.totals.ctrlSeconds / 60)}m`} />
                  </div>
                </div>

                {/* Target and position splits used to live here, but the strike map
                    below shows the same shares AND the absorbed side — this card is
                    outcomes instead, which nothing else in the section covers. */}
              </div>

              {/* Offense vs defense + the strike map. Absent (rather than empty) when
                  the server has no career row for this fighter — the cards above and
                  the pacing row below are computed from different sources and still
                  render. */}
              {twoWay?.hasTwoWay && (
                <div className="grid gap-3 xl:grid-cols-[1.05fr_1fr]">
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Offense vs defense</span>
                      {/* one legend serves both cards in this row — same encoding */}
                      <TwoWayLegend />
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {twoWay.rows.map((r) => <DumbbellRow key={r.key} {...r} />)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">Strike profile</span>
                      <SlideTabs
                        size="sm"
                        value={strikeMode}
                        onChange={setStrikeMode}
                        tabs={[{ key: 'pct', label: 'Share' }, { key: 'pm', label: 'Per min' }]}
                      />
                    </div>
                    <div className="space-y-4">
                      <MirrorBars title="Target" rows={twoWay.target} mode={strikeMode} />
                      <div className="border-t pt-4">
                        <MirrorBars title="Position" rows={twoWay.position} mode={strikeMode} />
                      </div>
                      {twoWay.targetAcc.length > 0 && (
                        <div className="border-t pt-4">
                          {/* how well each side LANDS on a zone, as opposed to how
                              often they aim there — always a percentage, so this
                              block ignores the share/per-min toggle */}
                          <MirrorBars title="Accuracy By Target" rows={twoWay.targetAcc} mode="pct" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {pacing.length > 1 && (
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground/70">Pacing by round</div>
                  <RoundPacing rounds={pacing} survival={survival} />
                </div>
              )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No per-fight statistics recorded for this fighter.</p>
            )}
          </Section>

          <Section id="fights" title="Fight History" note={`${recent.length} fights`} register={register}>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fight history available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-left text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="w-6 py-1.5" />
                      <th className="w-8 py-1.5 font-bold">W/L</th>
                      <th className="py-1.5 pr-2 font-bold">Opponent</th>
                      <th className="py-1.5 pr-2 font-bold">Method</th>
                      <th className="w-10 py-1.5 pr-2 font-bold">Rd</th>
                      <th className="w-14 py-1.5 pr-2 font-bold">Time</th>
                      <th className="w-24 py-1.5 pr-2 font-bold">Date</th>
                      <th className="py-1.5 font-bold">Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => {
                      const opp = oppData[String(r.oppId)]
                      const open = openFight === r.id
                      const data = statsByFight[String(r.id)]
                      return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={() => toggleFight(r.id)}
                            className={cn('cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40', open && 'bg-muted/40')}
                          >
                            <td className="py-1.5 pl-1 text-muted-foreground">
                              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
                            </td>
                            <td className="py-1.5">
                              <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold text-white', r.win ? 'bg-emerald-500' : 'bg-rose-500')}>
                                {r.win ? 'W' : 'L'}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2">
                              <Tip className="flex items-center gap-2" content={<FighterMini f={opp} />}>
                                <FighterImage fighter={opp} className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                                <Link
                                  to={`/ufc/fighters/${r.oppId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate text-[12.5px] font-bold hover:text-blue-600"
                                >
                                  {opp?.name || 'Unknown'}
                                </Link>
                              </Tip>
                            </td>
                            <td className="py-1.5 pr-2 text-[11.5px] font-semibold text-foreground/70">{r.method}</td>
                            <td className="py-1.5 pr-2 text-[11.5px] tabular-nums text-muted-foreground">{r.round ? `R${r.round}` : '—'}</td>
                            <td className="py-1.5 pr-2 text-[11.5px] tabular-nums text-muted-foreground">{r.time || '—'}</td>
                            <td className="py-1.5 pr-2 text-[11px] text-muted-foreground">{r.date ? formatDate(r.date) : '—'}</td>
                            <td className="max-w-[180px] truncate py-1.5 text-[11px] text-muted-foreground/80">{r.eventName || '—'}</td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={8} className="p-0 pb-1.5">
                                <FightDetail detail={r.detail} data={data} finishRound={r.round} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          </div>
        </div>
      </div>
    </div>
  )
}

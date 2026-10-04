// src/pages/UpcomingFightPage.jsx
//
// The matchup dashboard for a fight that has not happened yet. Same shell as the
// fighter profile: a static identity rail on the left, one scrolling column of
// sections on the right, scrollspy tabs portalled into the breadcrumb row.
//
// Every number here comes from existing endpoints run through the existing pure
// derivations in lib/fighterAnalytics — each corner is put through the same
// functions the profile page uses for one fighter, and the two results are diffed.
// The only new call is /ufc/fights/:id/context, which serves the matchup-specific
// data (pre-fight Glicko skills, skill edges, shared opponents) that has no other
// route.
//
// Completed fights are NOT handled here — see CompletedFightPage.
import { ArrowLeft, Brain, Flame, Info, Timer, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import HeaderActions from '../components/layout/HeaderActions'
import FighterImage from '../components/sports/FighterImage'
import FighterMini from '../components/sports/FighterMini'
import { SlideTabs } from '../components/ui/slide-tabs'
import { Tip } from '../components/ui/tip'
import ActivityBars from '../components/viz/ActivityBars'
import DimBar from '../components/viz/DimBar'
import FightFlow from '../components/viz/FightFlow'
import { DumbbellRow, TwoWayLegend } from '../components/viz/Dumbbell'
import FormStrip from '../components/viz/FormStrip'
import HeroTile from '../components/viz/HeroTile'
import MarketMovement from '../components/viz/MarketMovement'
import MirrorBars from '../components/viz/MirrorBars'
import OutcomeGrid from '../components/viz/OutcomeGrid'
import ProbabilityWaterfall from '../components/viz/ProbabilityWaterfall'
import RadarChart from '../components/viz/RadarChart'
import RoundPacing from '../components/viz/RoundPacing'
import SurvivalCurve from '../components/viz/SurvivalCurve'
import Section from '../components/viz/Section'
import SkillCallout from '../components/viz/SkillCallout'
import SplitBar from '../components/viz/SplitBar'
import { useScrollSpy } from '../components/viz/hooks'
import { fetchFighter } from '../lib/api'
import {
  AXES, DIMS, aggregateCareer, deriveForm, deriveRoundPacing, deriveRoundSurvival,
  deriveTwoWay, ordinal,
} from '../lib/fighterAnalytics'
import { buildProjectedKeys, deriveFightFlow } from '../lib/fightProjection'
import { cn, formatDate, formatOdds } from '../lib/utils'
import { buildShapWaterfall } from '../lib/shapWaterfall'
import EventLine from '../components/fight/EventLine'
import MatchupCard from '../components/fight/MatchupCard'
import PreviewBox from '../components/fight/PreviewBox'
import { CORNERS, fullName, impliedFromOdds } from '../components/fight/corners'
import { CornerColumns, CornerHead, Empty } from '../components/fight/layout'




// Method segments, most-likely first. Spelled out rather than built at runtime
// — Tailwind scans source text for class names.
const METHOD_TINTS = ['bg-primary', 'bg-muted-foreground/55', 'bg-muted-foreground/30']



// ---------------------------------------------------------------------------
// Keys to victory — Glicko fallback
// ---------------------------------------------------------------------------
// Used only when a bout has no expected-stats projection yet (see
// lib/fightProjection.buildProjectedKeys, which is the primary source).
//
// A key is a mismatch, not a strength: one corner rating well in a skill the OTHER
// corner has no answer to. The pairs below are what answers what — takedowns are
// answered by takedown defence, knockout power by the chin, volume by strike
// defence — so each candidate is one fighter's attack percentile against the
// specific dimension their opponent would have to defend it with.
//
// Deliberately not the model: SHAP explains which inputs moved a win probability,
// which is a different question from what either fighter should try to do in the
// cage. The Glicko percentiles are per-division and directional, which is exactly
// what a tactical read needs.
const VICTORY_KEYS = [
  { attack: 'ko', defend: 'kod', label: 'Knockout power', against: 'chin', how: 'Land clean early and the chin may not hold' },
  { attack: 'td', defend: 'tdd', label: 'Takedowns', against: 'takedown defence', how: 'Change levels and take it to the mat' },
  { attack: 'ctrl', defend: 'tdd', label: 'Control time', against: 'takedown defence', how: 'Hold top position and drain the clock' },
  { attack: 'sub', defend: 'subd', label: 'Submission threat', against: 'submission defence', how: 'Hunt the finish once it hits the ground' },
  { attack: 'str_vol', defend: 'str_def', label: 'Volume', against: 'strike defence', how: 'Out-work him and bank rounds' },
  { attack: 'str_acc', defend: 'str_def', label: 'Accuracy', against: 'strike defence', how: 'Pick the openings rather than trade' },
  { attack: 'dist', defend: 'str_def', label: 'Distance striking', against: 'strike defence', how: 'Keep it long and fight behind the jab' },
  { attack: 'clinch', defend: 'tdd', label: 'Clinch work', against: 'takedown defence', how: 'Close the distance and work the fence' },
  { attack: 'gnd', defend: 'subd', label: 'Ground striking', against: 'guard', how: 'Pass, posture and make them carry weight' },
  { attack: 'pts', defend: 'durability', label: 'Pace', against: 'durability', how: 'Push a pace that cannot be answered late' },
]

// A key has to be a real edge on both sides of the pair: good enough to lean on,
// against a hole worth attacking. Both thresholds are divisional percentiles.
const KEY_ATTACK_FLOOR = 60
const KEY_DEFEND_CEILING = 50

function buildVictoryKeys(ctx) {
  const out = []
  for (const side of ['red', 'blue']) {
    const mine = ctx?.[side]?.glicko?.dimensions
    const theirs = ctx?.[side === 'red' ? 'blue' : 'red']?.glicko?.dimensions
    if (!mine || !theirs) continue
    for (const k of VICTORY_KEYS) {
      const attack = mine[k.attack]?.percentile
      const defend = theirs[k.defend]?.percentile
      if (attack == null || defend == null) continue
      if (attack < KEY_ATTACK_FLOOR || defend > KEY_DEFEND_CEILING) continue
      out.push({ ...k, side, attack, defend, gap: attack - defend, id: `${side}-${k.attack}` })
    }
  }
  // One key per hole per corner: volume, accuracy and distance striking all attack
  // strike defence, so an opponent with one bad number generated three near-identical
  // cards. The widest gap into that hole is the one worth reading.
  const best = new Map()
  for (const k of out) {
    const slot = `${k.side}-${k.defend}`
    if (!best.has(slot) || best.get(slot).gap < k.gap) best.set(slot, k)
  }

  // Three per corner at most, then widest first across both. Capping per corner
  // rather than globally keeps the underdog's routes on the board — a lopsided
  // fight would otherwise fill every slot with the favourite's.
  const perSide = { red: [], blue: [] }
  for (const k of [...best.values()].sort((a, b) => b.gap - a.gap)) {
    if (perSide[k.side].length < 3) perSide[k.side].push(k)
  }
  return [...perSide.red, ...perSide.blue].sort((a, b) => b.gap - a.gap)
}



// Pinned so the model's read stays on screen while the sections scroll.
function ModelVerdict({ prediction, methodPrediction, red, blue }) {
  if (!prediction) {
    return (
      <div className="shrink-0 rounded-lg border border-border p-2.5">
        <div className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">Model</div>
        <p className="mt-1 text-[11px] text-muted-foreground">No prediction for this fight yet.</p>
      </div>
    )
  }

  const redProb = prediction.red_prob
  const redPct = Math.round(redProb * 100)
  const pickRed = prediction.predicted_winner === 'red'
  const pick = pickRed ? red : blue
  const pickProb = pickRed ? redProb : 1 - redProb
  const hasBand = prediction.va_prob_low != null && prediction.va_prob_high != null

  // `full` is matched against predicted_method, which stores the long form.
  const methods = methodPrediction ? [
    { label: 'KO/TKO', full: 'KO/TKO', prob: methodPrediction.ko_prob },
    { label: 'Sub', full: 'Submission', prob: methodPrediction.sub_prob },
    { label: 'Dec', full: 'Decision', prob: methodPrediction.dec_prob },
  ].sort((a, b) => b.prob - a.prob) : []

  return (
    <div className="shrink-0 rounded-lg border border-border p-2.5">
      {/* Label, pick and number on one line: the rail's remaining height belongs
          to the radar underneath, and a header row of its own bought nothing. */}
      <div className="flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Pick</span>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pickRed ? CORNERS[0].css : CORNERS[1].css }} />
        <span className="truncate text-[13px] font-extrabold">{pick.last_name}</span>
        <span className="ml-auto shrink-0 text-[17px] font-black leading-none tabular-nums">{(pickProb * 100).toFixed(0)}%</span>
      </div>

      <div className="mt-1 flex items-center gap-0.5">
        <div className="h-2 rounded-l-full" style={{ width: `${redProb * 100}%`, background: CORNERS[0].css }} />
        <div className="h-2 rounded-r-full" style={{ width: `${(1 - redProb) * 100}%`, background: CORNERS[1].css }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[9.5px] tabular-nums text-muted-foreground">
        {/* Derive blue from the rounded red rather than rounding independently —
            0.245 rendered as "25%" and "76%", which sums to 101. */}
        <span>{red.last_name} {redPct}%</span>
        <span>{100 - redPct}% {blue.last_name}</span>
      </div>
      {hasBand && (
        <div className="mt-1 text-[9.5px] tabular-nums text-muted-foreground">
          Calibration range {(prediction.va_prob_low * 100).toFixed(0)}–{(prediction.va_prob_high * 100).toFixed(0)}% for {red.last_name}
        </div>
      )}

      {/* Method as one segmented bar rather than three stacked rows: the rail
          needs the vertical space for the skill radar below, and the split is
          the whole message — the per-method bar lengths said nothing the
          segments don't. */}
      {methods.length > 0 && (
        <div className="mt-1.5 border-t pt-1.5">
          <div className="flex h-2 overflow-hidden rounded-full">
            {methods.map((m, i) => (
              <div
                key={m.label}
                className={cn('h-full', METHOD_TINTS[i])}
                style={{ width: `${m.prob * 100}%` }}
                title={`${m.full} ${(m.prob * 100).toFixed(0)}%`}
              />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {methods.map((m, i) => (
              <span key={m.label} className="flex items-center gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', METHOD_TINTS[i])} />
                <span className="text-[9.5px] text-muted-foreground">{m.label}</span>
                <span className="text-[9.5px] font-bold tabular-nums">{(m.prob * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// The skill profile, in the Matchup section beside the keys to victory — the radar
// is the whole-profile view of the same percentiles the keys pick pairs out of.
function RadarPanel({ series }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border p-2.5">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-foreground/70">Skill Radar</span>
        {series.map((sr) => (
          <span key={sr.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: sr.color }} />
            <span className="text-[10px] font-semibold text-muted-foreground">{sr.label}</span>
          </span>
        ))}
      </div>
      {series.length ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Width-driven (capped at 300px) and centred in whatever height the
              keys column gives the row. */}
          <div className="flex flex-1 items-center">
            <RadarChart series={series} />
          </div>
        </div>
      ) : (
        <Empty>No pre-fight skill ratings yet.</Empty>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Matchup marks
// ---------------------------------------------------------------------------
// One shared opponent per row: the man both corners faced on the left, then what
// each of them did to him. Naming him once and letting the two boxes say only
// "who won and how" keeps each box to a single readable clause — repeating his
// name inside both of them was what made them overflow.
function OpponentResult({ result, fighter, corner }) {
  if (!result) {
    return (
      <div className="flex items-center rounded-md border border-dashed border-border/70 px-2 py-1 text-[10.5px] text-muted-foreground">
        Has not faced him
      </div>
    )
  }
  const won = result.won
  // "Decision - Unanimous" → "Unanimous Dec"; "KO/TKO" stays as it is.
  const method = (result.method || '').startsWith('Decision')
    ? `${(result.method.split('-')[1] || '').trim()} Dec`
    : (result.method || 'Result unrecorded')

  return (
    <div className={cn(
      'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1',
      won ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10',
    )}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: corner.css }} />
      <span className="shrink-0 text-[11.5px] font-extrabold">{fighter.last_name}</span>
      <span className={cn('shrink-0 text-[11px] font-bold', won ? 'text-emerald-700' : 'text-rose-700')}>
        {won ? 'win' : 'loss'}
      </span>
      <span className="truncate text-[10.5px] text-muted-foreground">
        by {method}{result.round ? ` · R${result.round}` : ''}
      </span>
      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
        {result.date ? String(result.date).slice(0, 4) : ''}
      </span>
    </div>
  )
}

// The site-wide fighter chip: portrait in a small rounded square, the standard
// FighterMini card on hover.
function FighterIcon({ fighter, info, linkTo, className }) {
  const img = (
    <FighterImage
      fighter={fighter}
      className={cn('shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted', className)}
      imgClassName="object-cover object-top"
    />
  )
  const node = linkTo ? <Link to={linkTo} className="shrink-0">{img}</Link> : img
  return info ? <Tip content={<FighterMini f={info} />}>{node}</Tip> : node
}

// One key to victory, read top to bottom: who and what, what the model projects, then
// why — the attacker's strength beside the opponent's matching weakness. The edge is a
// labelled three-step meter rather than a bare number; "+32" never said 32 of what.
const EDGE_STEPS = [
  { min: 0.5, label: 'Strong edge' },
  { min: 0.3, label: 'Clear edge' },
  { min: 0, label: 'Slight edge' },
]

function KeyWhy({ icon, who, verb, career, pctValue, skill }) {
  const tone = pctValue == null ? 'text-muted-foreground'
    : pctValue >= 60 ? 'text-emerald-600' : pctValue <= 40 ? 'text-rose-600' : 'text-muted-foreground'
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 text-[10.5px]">
      <span className={cn('shrink-0 font-bold', tone)}>{icon}</span>
      <span className="min-w-0 text-muted-foreground">
        <span className="font-semibold text-foreground">{who}</span>{' '}{verb}
        {career && <> <span className="font-semibold tabular-nums text-foreground">{career}</span></>}
        {pctValue != null && (
          <> · <span className={cn('font-semibold tabular-nums', tone)}>{ordinal(pctValue)}</span> pct {skill}</>
        )}
      </span>
    </div>
  )
}

function VictoryKey({ k, corner, mine, theirs }) {
  const stepIdx = EDGE_STEPS.findIndex((st) => k.edge >= st.min)
  const filled = EDGE_STEPS.length - stepIdx
  const lift = k.lift != null && Math.abs(k.lift) >= 0.1 ? k.lift : null
  return (
    <div className="flex min-w-0 gap-2 rounded-md border border-border/70 p-2">
      <span className="mt-[4px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corner.css }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-[12px] font-extrabold">{mine.last_name}</span>
          <span className="truncate text-[12px] font-bold text-foreground/80">{k.title}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[9.5px] font-semibold text-muted-foreground">
            <span className="flex gap-[2px]">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn('h-2 w-1.5 rounded-sm', i >= filled && 'bg-muted')}
                  style={i < filled ? { background: corner.css } : undefined}
                />
              ))}
            </span>
            {EDGE_STEPS[stepIdx].label}
          </span>
        </div>
        {k.projection && (
          <p className="mt-0.5 text-[11px] leading-snug text-foreground/80">
            {k.projection.replaceAll('{opp}', theirs.last_name).replace(/\.\.$/, '.')}
          </p>
        )}
        <div className="mt-1 grid gap-0.5 border-t border-border/60 pt-1">
          <KeyWhy icon="▲" who={mine.last_name} verb={k.strength.career ? 'averages' : 'rates'}
            career={k.strength.career} pctValue={k.strength.pct} skill={k.strength.label} />
          <KeyWhy icon="▼" who={theirs.last_name} verb={k.weakness.career ? 'allows' : 'rates'}
            career={k.weakness.career} pctValue={k.weakness.pct} skill={k.weakness.label} />
          {lift != null && (
            <p className="text-[10px] italic text-muted-foreground">
              {lift > 0
                ? `Projected ${Math.round(lift * 100)}% above ${mine.last_name}'s usual rate — ${theirs.last_name}'s defence is the reason.`
                : `Still ${Math.round(-lift * 100)}% below ${mine.last_name}'s usual rate: ${theirs.last_name} slows it down, just not enough.`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function CommonOpponent({ row, red, blue, oppData }) {
  const info = oppData?.[String(row.opponent_id)]
  return (
    <div className="grid items-center gap-2 border-t border-border/60 py-2 first:border-t-0 lg:grid-cols-[minmax(130px,180px)_1fr_1fr]">
      <Link
        to={`/ufc/fighters/${row.opponent_id}`}
        className="group flex min-w-0 items-center gap-2"
      >
        <FighterIcon fighter={info || { id: row.opponent_id }} info={info} className="h-8 w-8" />
        <span className="truncate text-[12px] font-bold group-hover:underline" title={row.opponent_name}>
          {row.opponent_name}
        </span>
      </Link>
      <OpponentResult result={row.red} fighter={red} corner={CORNERS[0]} />
      <OpponentResult result={row.blue} fighter={blue} corner={CORNERS[1]} />
    </div>
  )
}




// ---------------------------------------------------------------------------
export default function UpcomingFightPage({ fight, matchup }) {
  const navigate = useNavigate()
  const { red_fighter: red, blue_fighter: blue, prediction, method_prediction, odds, method_odds, shap_values, preview, event } = fight
  // Exchange quotes ride along on the fight payload; the price *curves* do not —
  // lib/matchup.js fetches those.
  const exchanges = fight.prediction_markets || null
  const marketConsensus = fight.market_consensus || null
  const propMarkets = fight.prop_markets || null
  // Polymarket's fight-level method markets, kept only where something has actually traded —
  // an untouched prop quotes a meaningless 0.50 (see the `traded` flag in the serving layer).
  const pmMethodProbs = useMemo(() => {
    const m = exchanges?.polymarket?.method
    if (!m) return null
    const out = {}
    for (const [k, v] of Object.entries(m)) if (v?.traded) out[k] = v.price
    return Object.keys(out).length ? out : null
  }, [exchanges])

  // `matchup` is loaded before this page mounts (lib/matchup.js), so every
  // section renders complete on the first frame instead of flashing "Loading…".
  const { ctx, perFighter, eventMap, marketHistory } = matchup
  const [oppData, setOppData] = useState({})         // { [id]: { name, image_url, ... } }
  const [strikeMode, setStrikeMode] = useState('pct')

  const redId = red?.id
  const blueId = blue?.id

  const derive = useMemo(() => {
    const out = {}
    for (const id of [redId, blueId]) {
      const d = perFighter[id]
      if (!d) { out[id] = null; continue }
      const statsByFight = {}
      for (const r of d.stats || []) {
        const k = String(r.fight_id)
        if (!statsByFight[k]) statsByFight[k] = { total: null, rounds: [] }
        if (Number(r.round_number) === 0) statsByFight[k].total = r
        else statsByFight[k].rounds.push(r)
      }
      for (const k of Object.keys(statsByFight)) {
        statsByFight[k].rounds.sort((a, b) => a.round_number - b.round_number)
      }
      out[id] = {
        form: deriveForm(d.fights, id),
        career: aggregateCareer(d.stats, d.fights, id),
        twoWay: deriveTwoWay(d.careerStats),
        pacing: deriveRoundPacing(statsByFight, d.fights),
        survival: deriveRoundSurvival(d.fights, id),
      }
    }
    return out
  }, [perFighter, redId, blueId])

  const redD = derive[redId]
  const blueD = derive[blueId]

  // Wave two: name the opponents behind the form chips. Non-blocking — the strip
  // renders immediately and the tooltips fill in. Cached per fighter, so moving
  // between fights on the same card mostly hits the cache.
  useEffect(() => {
    let cancelled = false
    const wanted = new Set()
    for (const d of [redD, blueD]) {
      for (const r of d?.form?.recentForm || []) if (r.oppId) wanted.add(String(r.oppId))
    }
    // Shared opponents get a portrait and the same hover card as form chips.
    for (const row of ctx?.common_opponents || []) {
      if (row.opponent_id) wanted.add(String(row.opponent_id))
    }
    const missing = [...wanted].filter((id) => !oppData[id])
    if (!missing.length) return undefined

    Promise.all(missing.map((id) => fetchFighter(id).then((f) => [id, f]).catch(() => null)))
      .then((pairs) => {
        if (cancelled) return
        const resolved = {}
        for (const p of pairs) {
          if (!p) continue
          const [id, f] = p
          resolved[id] = {
            name: fullName(f),
            image_url: f.image_url,
            has_image: f.has_image,
            id: f.id,
            nickname: f.nickname,
            country_code: f.country_code,
            record: `${f.wins}-${f.losses}${f.draws > 0 ? `-${f.draws}` : ''}`,
          }
        }
        if (Object.keys(resolved).length) setOppData((prev) => ({ ...prev, ...resolved }))
      })

    return () => { cancelled = true }
    // oppData is intentionally not a dependency: it is what this effect writes,
    // and `missing` already filters against it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redD, blueD, ctx])

  // Best available price per side, and where the model disagrees with it.
  const value = useMemo(() => {
    if (!prediction || !odds?.length) return null
    const bestRed = Math.max(...odds.map((o) => o.red_odds))
    const bestBlue = Math.max(...odds.map((o) => o.blue_odds))
    // The exchange consensus, volume-weighted across venues by the API. Carried alongside the
    // book price rather than blended into it: the book number is vig-inclusive and the exchange
    // number is not, so averaging them would produce a probability that is neither.
    const exch = marketConsensus?.red_prob ?? null
    const sides = [
      { key: 'red', fighter: red, model: prediction.red_prob, implied: impliedFromOdds(bestRed), best: bestRed, exchange: exch },
      { key: 'blue', fighter: blue, model: 1 - prediction.red_prob, implied: impliedFromOdds(bestBlue), best: bestBlue, exchange: exch == null ? null : 1 - exch },
    ].map((s) => ({
      ...s,
      edge: (s.model - s.implied) * 100,
      // Against a no-vig traded price there is no de-vig assumption in the comparison, which
      // makes this the more honest of the two edges shown.
      exchangeEdge: s.exchange == null ? null : (s.model - s.exchange) * 100,
    }))
    const top = sides[0].edge >= sides[1].edge ? sides[0] : sides[1]
    // The rail renders one decimal place, so anything under 0.05pp displays as
    // "+0.0%" — an edge callout that shows no edge. Treat that as none.
    return { sides, ...top, hasEdge: top.edge >= 0.05, isUnderdog: top.implied < 0.5 }
  }, [prediction, odds, red, blue, marketConsensus])

  const waterfall = useMemo(() => buildShapWaterfall(prediction, shap_values), [prediction, shap_values])

  // Market side of the outcome grid, sportsbooks first. Per cell: the BestFightOdds
  // consensus across books (de-vigged, with the best real price), else Bovada's six-way
  // price, else Polymarket where that prop has traded. Bovada's raw implied probabilities
  // carry ~20% hold, so an edge against them is mostly vig; they are de-vigged
  // proportionally, which needs all six prices — with any missing, Bovada is skipped.
  // A cell that falls back to Polymarket is tagged, so a mixed grid says which is which.
  const outcomeMarket = useMemo(() => {
    if (method_prediction?.red_ko_prob == null) return null
    const pmProps = exchanges?.polymarket?.fighter_props || {}
    const pmKey = { ko: 'ko_tko', sub: 'submission', dec: 'decision' }
    const cells = ['red', 'blue'].flatMap((side) => ['ko', 'sub', 'dec'].map((k) => [side, k]))
    const raw = cells.map(([side, k]) => method_odds?.[`${side}_${k}_odds`])
    const bovada = raw.every((o) => o != null) ? raw.map(impliedFromOdds) : null
    const hold = bovada ? bovada.reduce((a, b) => a + b, 0) : null
    const sources = new Set()
    const market = { red: {}, blue: {} }
    cells.forEach(([side, k], i) => {
      const pm = pmProps[side]?.[pmKey[k]]
      const bfo = propMarkets?.[`${side}_${k}`]
      if (bfo?.prob != null) {
        market[side][k] = { prob: bfo.prob, american: bfo.best_american, source: 'books' }; sources.add('Sportsbooks, no vig')
      } else if (bovada) {
        market[side][k] = { prob: bovada[i] / hold, american: raw[i], source: 'bovada' }; sources.add('Bovada, no vig')
      } else if (pm?.traded && pm.price != null) {
        market[side][k] = { prob: pm.price, american: null, source: 'polymarket' }; sources.add('Polymarket')
      } else market[side][k] = null
    })
    // Column totals: the fight-level method market, same order. With no fight-level book
    // price, the de-vigged Bovada cells summed down the column are the book's own total.
    const methodMarket = {}
    for (const [j, k] of ['ko', 'sub', 'dec'].entries()) {
      const bfo = k === 'dec' ? propMarkets?.dec_yes : null
      const pm = pmMethodProbs?.[pmKey[k]]
      if (bfo?.prob != null) methodMarket[k] = { prob: bfo.prob, american: bfo.best_american, source: 'books' }
      else if (method_odds?.[`${k}_prob`] != null) methodMarket[k] = { prob: method_odds[`${k}_prob`], american: method_odds[`${k}_odds`] ?? null, source: 'bovada' }
      else if (bovada) methodMarket[k] = { prob: (bovada[j] + bovada[j + 3]) / hold, american: null, source: 'bovada' }
      else if (pm != null) methodMarket[k] = { prob: pm, american: null, source: 'polymarket' }
      else methodMarket[k] = null
    }
    return { market, methodMarket, source: [...sources].join(' · ') || null }
  }, [method_prediction, method_odds, exchanges, pmMethodProbs, propMarkets])

  // Moneyline market for the grid's Win column, sportsbooks first: each book's two prices
  // de-vigged against each other, averaged across books. The exchange consensus (no vig)
  // only when no book has priced the fight.
  const winMarket = useMemo(() => {
    if (odds?.length) {
      const reds = odds.map((o) => {
        const r = impliedFromOdds(o.red_odds)
        return r / (r + impliedFromOdds(o.blue_odds))
      })
      const red = reds.reduce((a, b) => a + b, 0) / reds.length
      return { red: { prob: red, source: 'books' }, blue: { prob: 1 - red, source: 'books' } }
    }
    if (marketConsensus?.red_prob != null) {
      return { red: { prob: marketConsensus.red_prob, source: 'exchange' }, blue: { prob: 1 - marketConsensus.red_prob, source: 'exchange' } }
    }
    return null
  }, [odds, marketConsensus])

  // Market prices on the survival curve: P(still going at t). O/U x.5 rounds is the curve
  // at x.5 × 5 minutes, "goes the distance" its end. Books' consensus first (de-vigged),
  // else Polymarket where traded.
  const survivalMarkets = useMemo(() => {
    const pmRounds = exchanges?.polymarket?.rounds || {}
    const pmDistance = exchanges?.polymarket?.method?.distance
    const end = fight.round_prediction?.curve?.at(-1)?.t ?? 15
    const out = []
    for (const line of [0.5, 1.5, 2.5, 3.5, 4.5]) {
      const t = line * 5
      if (t >= end) continue
      const bfo = propMarkets?.[`ou_${line}_over`]
      const pm = pmRounds[`ou_${line}`]
      if (bfo?.prob != null) out.push({ t, prob: bfo.prob, label: `O/U ${line}`, source: `Books (${bfo.n_books ?? '?'}), no vig` })
      else if (pm?.traded && pm.price != null) out.push({ t, prob: pm.price, label: `O/U ${line}`, source: 'Polymarket' })
    }
    const dec = propMarkets?.dec_yes
    if (dec?.prob != null) out.push({ t: end, prob: dec.prob, label: 'Distance', source: 'Books, no vig' })
    else if (pmDistance?.traded && pmDistance.price != null) out.push({ t: end, prob: pmDistance.price, label: 'Distance', source: 'Polymarket' })
    return out
  }, [exchanges, propMarkets, fight.round_prediction])

  // Which outcome the grid is pointing at, lit up on the survival curve.
  const [outcomeFocus, setOutcomeFocus] = useState(null)

  // Skill series, straight off the Glicko snapshot percentiles.
  const radarSeries = useMemo(() => {
    if (!ctx) return []
    return CORNERS.map((c, i) => {
      const dims = ctx[c.key]?.glicko?.dimensions
      if (!dims) return null
      // A fighter outside the divisional rankings has ratings but no percentiles.
      // Coercing those to 0 drew a polygon collapsed onto the centre — an invisible
      // shape that still claimed a legend entry. Drop the series instead.
      if (!AXES.some((a) => dims[a.key]?.percentile != null)) return null
      return {
        key: c.key,
        label: (i === 0 ? red : blue)?.last_name || c.key,
        color: c.css,
        axes: AXES.map((a) => ({
          ...a,
          value: dims[a.key]?.percentile ?? 0,
          full: DIMS.find((d) => d.key === a.key)?.label ?? a.label,
        })),
      }
    }).filter(Boolean)
  }, [ctx, red, blue])

  // Full 15-dimension decomposition + best/worst callouts per corner.
  const skills = useMemo(() => {
    const build = (side) => {
      const dims = ctx?.[side]?.glicko?.dimensions
      if (!dims) return null
      const list = DIMS
        .filter((d) => dims[d.key]?.percentile != null)
        .map((d) => ({ ...d, value: dims[d.key].percentile, tier: dims[d.key].tier }))
      if (!list.length) return null
      const sorted = [...list].sort((a, b) => b.value - a.value)
      return {
        striking: list.filter((d) => d.group === 'striking'),
        grappling: list.filter((d) => d.group === 'grappling'),
        strengths: sorted.slice(0, 3),
        weaknesses: sorted.slice(-3).reverse(),
      }
    }
    return { red: build('red'), blue: build('blue') }
  }, [ctx])

  // Red-vs-blue rows built by pairing each corner's own career numbers. Both sides
  // of a row are "what this fighter does", so the shared scale is meaningful.
  // Reversals per control minute is dropped here only. On a single fighter's
  // profile it is a real tell about scrambles; in a two-corner comparison both
  // numbers round to ~0 in most matchups and the row reads as noise. The
  // derivation still returns it for every other caller.
  const headToHead = useMemo(() => {
    if (!redD?.twoWay || !blueD?.twoWay) return []
    const blueByKey = Object.fromEntries(blueD.twoWay.rows.map((r) => [r.key, r]))
    return redD.twoWay.rows
      .filter((r) => r.key !== 'rev')
      .map((r) => ({ key: r.key, label: r.label, fmt: r.fmt, self: r.self, opp: blueByKey[r.key]?.self }))
      .filter((r) => r.self != null || r.opp != null)
  }, [redD, blueD])

  const mirror = (which) => {
    const a = redD?.twoWay?.[which]
    const b = blueD?.twoWay?.[which]
    if (!a || !b) return []
    const blueByLabel = Object.fromEntries(b.map((r) => [r.label, r]))
    return a.map((r) => ({
      label: r.label,
      self: r.self,
      selfPm: r.selfPm,
      opp: blueByLabel[r.label]?.self,
      oppPm: blueByLabel[r.label]?.selfPm,
    }))
  }
  const targetRows = useMemo(() => mirror('target'), [redD, blueD])   // eslint-disable-line react-hooks/exhaustive-deps
  const positionRows = useMemo(() => mirror('position'), [redD, blueD]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fight Flow and the keys both read the expected-stats projection. A bout without
  // one (announced before the last serving run) falls back to the Glicko skill pairs,
  // put into the same card shape so one renderer handles both.
  const xs = fight.expected_stats
  const flow = useMemo(
    () => deriveFightFlow(xs, fight.round_prediction, ctx?.scheduled_rounds),
    [xs, fight.round_prediction, ctx],
  )
  const victoryKeys = useMemo(() => {
    const projected = buildProjectedKeys(xs, ctx, {
      red: perFighter[redId]?.careerStats,
      blue: perFighter[blueId]?.careerStats,
    })
    if (projected.length || flow) return projected
    return buildVictoryKeys(ctx).map((k) => ({
      id: k.id,
      side: k.side,
      title: k.label,
      edge: k.gap / 100,
      projection: k.how,
      strength: { label: k.label.toLowerCase(), career: null, pct: k.attack },
      weakness: { label: k.against, career: null, pct: k.defend },
      lift: null,
    }))
  }, [xs, ctx, perFighter, redId, blueId, flow])
  const keysFromProjection = Boolean(flow)

  const hasSkills = radarSeries.length > 0
  const loaded = Boolean(redD && blueD)

  // The tab bar is whatever this fight actually has data for — an early-announced
  // bout with no rated skills should not show an empty tab. The preview has no tab
  // of its own: it opens the Matchup section, and the full article is its own page.
  // Odds are not here: the market lives in the rail, not the scrolling column.
  const sections = useMemo(() => [
    { key: 'matchup', label: 'Matchup' },
    flow && { key: 'flow', label: 'Fight Flow' },
    { key: 'form', label: 'Form' },
    { key: 'tendencies', label: 'Tendencies' },
    prediction && { key: 'model', label: 'Model & Market' },
  ].filter(Boolean), [prediction, flow])

  const { scrollRef, register, active, scrollTo } = useScrollSpy(sections)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden lg:flex-row">
      <HeaderActions>
        <EventLine event={event} weightClass={fight.weight_class} scheduledRounds={ctx?.scheduled_rounds} />
        <SlideTabs size="sm" value={active} onChange={scrollTo} tabs={sections} />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </HeaderActions>

      {/* ---------------- LEFT: the fight itself ---------------- */}
      {/* 320px, down from 360: the tale of the tape and both odds boards still
          fit, and the 40px go to the sections, where the charts actually use them. */}
      <div className="flex min-h-0 shrink-0 flex-col gap-3 overflow-y-auto lg:w-[320px] lg:overflow-hidden">
        <MatchupCard red={red} blue={blue} ctx={ctx} weightClass={fight.weight_class} />
        <ModelVerdict
          prediction={prediction}
          methodPrediction={method_prediction}
          red={red}
          blue={blue}
        />
        {preview?.content && <PreviewBox preview={preview} fightId={fight.id} className="lg:flex-1" />}
      </div>

      {/* ---------------- RIGHT: one scroll, many sections ---------------- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-5">

            {/* ---- Matchup: the written read, the two profiles, and the routes ---- */}
            <Section
              id="matchup"
              title="Matchup"
              note="Both skill profiles, and where each corner can win it"
              register={register}
            >
              {/* The skill radar beside the routes to a win, then both careers
                  across the full width. */}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <RadarPanel series={radarSeries} />

                {/* ---- Keys to victory ---- */}
                <div className="min-w-0 rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Keys to victory</span>
                    <Tip content={(
                      <span className="text-[11px]">
                        {keysFromProjection
                          ? 'Each key is a part of this fight one corner is projected to win, from the expected-stats model (their offence against this opponent\'s defence). Underneath: what they do well, and what the opponent tends to allow. Percentiles are divisional skill ratings.'
                          : `No stat projection for this bout yet, so these are skill mismatches: one corner ${KEY_ATTACK_FLOOR}th percentile or better in a skill the other is ${KEY_DEFEND_CEILING}th or worse at defending.`}
                      </span>
                    )}>
                      <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
                    </Tip>
                    <span className="text-[10.5px] text-muted-foreground">their strength, the other side&apos;s weakness</span>
                  </div>
                  {victoryKeys.length ? (
                    <div className="grid gap-2">
                      {victoryKeys.slice(0, 6).map((k) => (
                        <VictoryKey
                          key={k.id}
                          k={k}
                          corner={k.side === 'red' ? CORNERS[0] : CORNERS[1]}
                          mine={k.side === 'red' ? red : blue}
                          theirs={k.side === 'red' ? blue : red}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      {keysFromProjection
                        ? 'No phase of this fight clearly belongs to either corner.'
                        : hasSkills
                          ? 'No clear mismatch: neither corner rates well in a skill the other is weak against.'
                          : 'No pre-fight skill ratings for this bout yet.'}
                    </Empty>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Fighter Comparison</span>
                    <Tip content={<span className="text-[11px]">Each fighter&apos;s own career average. Both dots are &quot;what this fighter does&quot;, so the row compares like with like.</span>}>
                      <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
                    </Tip>
                  </div>
                  <TwoWayLegend selfLabel={red.last_name} oppLabel={blue.last_name}
                      selfClass={CORNERS[0].bar} oppClass={CORNERS[1].bar} />
                </div>
                {!loaded ? (
                  <Empty>Loading career stats…</Empty>
                ) : headToHead.length ? (
                  // Full width now, so every row shows. Two columns, not three:
                  // each row's value labels are absolutely positioned above its
                  // dots and overhang the track, so at three columns they ran
                  // into the neighbouring row's label.
                  <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                    {headToHead.map((r) => (
                      <DumbbellRow
                        key={r.key} label={r.label} self={r.self} opp={r.opp} fmt={r.fmt}
                        selfClass={CORNERS[0].bar} oppClass={CORNERS[1].bar}
                        selfTextClass="text-corner-red" oppTextClass="text-corner-blue"
                      />
                    ))}
                  </div>
                ) : (
                  <Empty>Neither fighter has a computed career-stat line yet.</Empty>
                )}
              </div>
            </Section>

            {/* ---- Fight Flow: the expected-stats projection ---- */}
            {flow && (
              <Section
                id="flow"
                title="Fight Flow"
                note="How the fight is projected to play out, stat by stat"
                register={register}
              >
                <FightFlow
                  flow={flow}
                  names={{ red: red.last_name, blue: blue.last_name }}
                  css={{ red: CORNERS[0].css, blue: CORNERS[1].css }}
                />
              </Section>
            )}

            {/* ---- Form: what they are made of, who they have shared, how they
                 have been going ---- */}
            <Section
              id="form"
              title="Form"
              note="Last 10 bouts, then who they have both faced"
              register={register}
            >
              {!loaded ? <Empty>Loading fight history…</Empty> : (
                <CornerColumns red={red} blue={blue}>
                  {(side) => {
                    const d = side === 'red' ? redD : blueD
                    const c = side === 'red' ? ctx?.red : ctx?.blue
                    const form = d?.form
                    if (!form) return <Empty>No recorded UFC fights.</Empty>
                    return (
                      <>
                        <FormStrip results={form.recentForm} oppData={oppData} eventMap={eventMap} />

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <HeroTile
                            icon={Flame}
                            label={form.streakWin ? 'Win streak' : 'Loss streak'}
                            value={form.streak || '—'}
                            accent={form.streak && form.streakWin ? 'text-emerald-600' : form.streak ? 'text-rose-600' : undefined}
                          />
                          <HeroTile icon={Timer} label="Octagon time" value={form.octagonTime} sub={`avg ${form.avgFightTime}`} />
                          <HeroTile icon={Trophy} label="R1 finishes" value={form.r1Finishes} />
                          <HeroTile
                            label="Days since"
                            value={c?.days_since_last_fight ?? form.daysSinceLast ?? '—'}
                            sub={form.lastDate ? formatDate(form.lastDate) : null}
                          />
                        </div>

                        {c?.division_info?.division_change && (
                          <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10.5px] font-semibold text-amber-700">
                            Moving from {c.division_info.previous_division}
                          </div>
                        )}
                        {c?.division_info?.ufc_debut && (
                          <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10.5px] font-semibold text-amber-700">
                            UFC debut — no prior promotion record
                          </div>
                        )}

                        {form.activity?.length > 0 && (
                          <div className="mt-3 border-t pt-2">
                            <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-foreground/70">Fights per year</div>
                            <ActivityBars
                              activity={form.activity}
                              oppData={oppData}
                              start={Math.max(0, form.activity.length - 6)}
                              size={6}
                            />
                          </div>
                        )}

                        <div className="mt-3 grid gap-3 border-t pt-2 sm:grid-cols-2">
                          <SplitBar title="How they win" segments={form.winMethods} unit="" />
                          <SplitBar title="How they lose" segments={form.lossMethods} unit="" />
                        </div>
                      </>
                    )
                  }}
                </CornerColumns>
              )}

              {ctx?.common_opponents?.length > 0 && (
                <div className="mt-3 rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Common opponents</span>
                    <span className="text-[10.5px] text-muted-foreground">{ctx.common_opponents.length} shared</span>
                  </div>
                  {ctx.common_opponents.slice(0, 6).map((row) => (
                    <CommonOpponent key={row.opponent_id} row={row} red={red} blue={blue} oppData={oppData} />
                  ))}
                </div>
              )}
            </Section>

            {/* ---- Tendencies ---- */}
            <Section
              id="tendencies"
              title="Tendencies"
              note="Rated skills per corner, then career averages"
              register={register}
            >
              {hasSkills && (
                <div className="mb-3">
                <CornerColumns red={red} blue={blue}>
                  {(side) => {
                    const s = skills[side]
                    if (!s) return <Empty>No rated skill profile.</Empty>
                    return (
                      <>
                        <div className="space-y-2 border-b pb-2.5">
                          <SkillCallout label="Strengths" dims={s.strengths} cls="text-emerald-600" />
                          <SkillCallout label="Weaknesses" dims={s.weaknesses} cls="text-rose-600" />
                        </div>
                        <div className="mt-2.5">
                          <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-amber-600">Striking</div>
                          <div className="space-y-1">
                            {s.striking.map((d) => <DimBar key={d.key} dim={d} />)}
                          </div>
                          <div className="mb-1 mt-2.5 text-[9px] font-bold uppercase tracking-wide text-indigo-600">Grappling</div>
                          <div className="space-y-1">
                            {s.grappling.map((d) => <DimBar key={d.key} dim={d} />)}
                          </div>
                        </div>
                      </>
                    )
                  }}
                </CornerColumns>
                </div>
              )}

              {!loaded ? <Empty>Loading career stats…</Empty> : (
                <>
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-extrabold tracking-tight">Where they strike</span>
                      <SlideTabs
                        size="sm"
                        value={strikeMode}
                        onChange={setStrikeMode}
                        tabs={[{ key: 'pct', label: 'Share' }, { key: 'pm', label: 'Per min' }]}
                      />
                    </div>
                    {targetRows.length || positionRows.length ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {targetRows.length > 0 && (
                          <MirrorBars
                            title="Target"
                            rows={targetRows}
                            mode={strikeMode}
                            leftLabel={red.last_name}
                            rightLabel={blue.last_name}
                            leftClass={CORNERS[0].bar}
                            rightClass={CORNERS[1].bar}
                          />
                        )}
                        {positionRows.length > 0 && (
                          <MirrorBars
                            title="Position"
                            rows={positionRows}
                            mode={strikeMode}
                            leftLabel={red.last_name}
                            rightLabel={blue.last_name}
                            leftClass={CORNERS[0].bar}
                            rightClass={CORNERS[1].bar}
                          />
                        )}
                      </div>
                    ) : (
                      <Empty>No strike breakdown available for both fighters.</Empty>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    {CORNERS.map((corner, i) => {
                      const d = i === 0 ? redD : blueD
                      const fighter = i === 0 ? red : blue
                      // deriveRoundPacing returns the round array itself
                      if (!d?.pacing?.length) return null
                      return (
                        <div key={corner.key} className="rounded-lg border border-border p-3">
                          <div className="mb-2 flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corner.css }} />
                            <span className="text-[12px] font-extrabold">{fullName(fighter)}</span>
                            <span className="text-[10.5px] text-muted-foreground">pacing by round</span>
                          </div>
                          <RoundPacing rounds={d.pacing} survival={d.survival} accent={corner.bar} />
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </Section>

            {/* ---- Model ---- */}
            {prediction && (
              <Section
                id="model"
                title="Model &amp; Market"
                note="Where the probability comes from, and what the market is paying"
                register={register}
              >
                {waterfall && (() => {
                  const fav = waterfall.side === 'red' ? red : blue
                  const favMarket = value?.sides?.[waterfall.side === 'red' ? 0 : 1]?.implied ?? null
                  return (
                    <div className="mb-3 rounded-lg border border-border p-3">
                      <div className="mb-2 flex flex-wrap items-baseline gap-2">
                        <span className="text-[13px] font-extrabold tracking-tight">Winner model attribution</span>
                        <span className="text-[9.5px] text-muted-foreground">{fav.last_name} win probability</span>
                        <Tip content={(
                          <span className="text-[11px]">
                            Each row is one family of model inputs and how many points it moved{' '}
                            {fav.last_name}&apos;s win probability (the favourite). Base rate carries the
                            division-wide starting point and every input not listed. Market is the best
                            available price with vig included, so it flatters the favourite slightly.
                          </span>
                        )}>
                          <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
                        </Tip>
                        <span className="ml-auto flex items-center gap-3 text-[9.5px] font-semibold text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: CORNERS[0].css }} />{red.last_name}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: CORNERS[1].css }} />{blue.last_name}
                          </span>
                        </span>
                      </div>
                      <ProbabilityWaterfall
                        base={0.5}
                        steps={waterfall.steps}
                        final={waterfall.final}
                        market={favMarket}
                        calibration={waterfall.calibration}
                        redName={red.last_name}
                        blueName={blue.last_name}
                        side={waterfall.side}
                      />
                    </div>
                  )
                })()}

                {/* Who wins and how, next to the prices it is judged against. The grid's Win
                    column carries the moneyline edge and its headers the method edge, so the
                    separate "model vs market" and "method market" panels are gone; the board
                    stays for per-book prices. */}
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="flex flex-col rounded-lg border border-border p-3">
                    {method_prediction?.red_ko_prob != null ? (
                      <OutcomeGrid
                        rows={[
                          { side: 'red', name: red.last_name, css: CORNERS[0].css, cells: { ko: method_prediction.red_ko_prob, sub: method_prediction.red_sub_prob, dec: method_prediction.red_dec_prob } },
                          { side: 'blue', name: blue.last_name, css: CORNERS[1].css, cells: { ko: method_prediction.blue_ko_prob, sub: method_prediction.blue_sub_prob, dec: method_prediction.blue_dec_prob } },
                        ]}
                        market={outcomeMarket?.market}
                        methodMarket={outcomeMarket?.methodMarket}
                        winMarket={winMarket}
                        source={outcomeMarket?.source}
                        onHighlight={fight.round_prediction ? setOutcomeFocus : undefined}
                      />
                    ) : (
                      <>
                        <span className="text-[13px] font-extrabold tracking-tight">Method</span>
                        <Empty>No method prediction for this fight yet.</Empty>
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-extrabold tracking-tight">Moneyline board</span>
                      <span className="text-[9.5px] text-muted-foreground">
                        {odds?.length || 0} {odds?.length === 1 ? 'book' : 'books'} · best price in bold
                      </span>
                    </div>

                    {odds?.length ? (
                      <>
                        <div className="mb-1 grid grid-cols-[1fr_72px_72px_48px] gap-1.5 border-b pb-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                          <span>Book</span>
                          <CornerHead css={CORNERS[0].css} name={red.last_name} />
                          <CornerHead css={CORNERS[1].css} name={blue.last_name} />
                          <span className="text-right">Vig</span>
                        </div>
                        {(() => {
                          const bestRed = Math.max(...odds.map((o) => o.red_odds))
                          const bestBlue = Math.max(...odds.map((o) => o.blue_odds))
                          return odds.map((o) => {
                            // What the book keeps: the two vig-inclusive implied
                            // probabilities sum to more than 1, and the excess is the
                            // hold. It is the one number that says which book to use.
                            const vig = (impliedFromOdds(o.red_odds) + impliedFromOdds(o.blue_odds) - 1) * 100
                            return (
                              <div key={o.bookmaker} className="grid grid-cols-[1fr_72px_72px_48px] items-center gap-1.5 py-0.5 text-[11px]">
                                <span className="truncate text-muted-foreground" title={o.bookmaker}>{o.bookmaker}</span>
                                {[[o.red_odds, o.red_odds === bestRed], [o.blue_odds, o.blue_odds === bestBlue]].map(([v, isBest], i) => (
                                  <span
                                    key={i}
                                    className={cn('text-center tabular-nums', isBest ? 'font-bold text-foreground' : 'text-muted-foreground')}
                                  >
                                    {formatOdds(v)}
                                  </span>
                                ))}
                                <span className="text-right tabular-nums text-muted-foreground">
                                  {vig.toFixed(1)}%
                                </span>
                              </div>
                            )
                          })
                        })()}
                      </>
                    ) : (
                      <Empty>No prices posted for this fight yet.</Empty>
                    )}
                    {/* Exchanges sit below the sportsbooks and in their own block, because the
                        two are not the same kind of number. A book quotes American odds with a
                        hold baked in; an exchange quotes a traded probability with no vig, where
                        the cost of transacting is the bid/ask spread. Showing a "vig" column for
                        an exchange would be meaningless, and averaging the two together would be
                        worse. */}
                    {exchanges && Object.keys(exchanges).length > 0 && (
                      <div className="mt-2 rounded-md bg-muted/40 p-1.5">
                        <div className="mb-1 grid grid-cols-[1fr_72px_72px_48px] gap-1.5 border-b pb-1 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                          <span>Exchange</span>
                          <CornerHead css={CORNERS[0].css} name={red.last_name} />
                          <CornerHead css={CORNERS[1].css} name={blue.last_name} />
                          <span className="text-right">Spread</span>
                        </div>
                        {Object.entries(exchanges).map(([venue, payload]) => {
                          const ml = payload?.moneyline
                          if (!ml || ml.red_prob == null) return null
                          const spread = ml.red?.spread
                          const vol = ml.volume
                          return (
                            <div key={venue} className="grid grid-cols-[1fr_72px_72px_48px] items-center gap-1.5 py-0.5 text-[11px]">
                              <span className="truncate capitalize text-muted-foreground">
                                {venue}
                                {vol ? (
                                  <span className="ml-1 text-[9.5px] tabular-nums opacity-70">
                                    {vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : `$${Math.round(vol / 1e3)}k`}
                                  </span>
                                ) : null}
                              </span>
                              {[ml.red_prob, ml.blue_prob].map((v, i) => (
                                <span key={i} className="text-center font-bold tabular-nums">
                                  {v != null ? `${(v * 100).toFixed(1)}%` : '—'}
                                </span>
                              ))}
                              <span className="text-right tabular-nums text-muted-foreground">
                                {spread != null ? `${(spread * 100).toFixed(0)}¢` : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-border p-3">
                  {fight.round_prediction?.curve?.length ? (
                    <SurvivalCurve
                      prediction={fight.round_prediction}
                      markets={survivalMarkets}
                      names={{ red: red.last_name, blue: blue.last_name }}
                      css={{ red: CORNERS[0].css, blue: CORNERS[1].css }}
                      decSplit={method_prediction?.red_dec_prob != null ? {
                        red: method_prediction.red_dec_prob / ((method_prediction.red_dec_prob + method_prediction.blue_dec_prob) || 1),
                        blue: method_prediction.blue_dec_prob / ((method_prediction.red_dec_prob + method_prediction.blue_dec_prob) || 1),
                      } : null}
                      highlight={outcomeFocus}
                    />
                  ) : (
                    <>
                      <span className="text-[13px] font-extrabold tracking-tight">How long will it last?</span>
                      <Empty>Round predictions appear once the card is set.</Empty>
                    </>
                  )}
                </div>

                {marketHistory && Object.keys(marketHistory).length > 0 && (
                  <div className="mt-3 rounded-lg border border-border p-3">
                    <MarketMovement
                      series={marketHistory}
                      modelProb={prediction?.red_prob}
                      redName={red.last_name}
                      blueName={blue.last_name}
                      redCss={CORNERS[0].css}
                      blueCss={CORNERS[1].css}
                    />
                  </div>
                )}
              </Section>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

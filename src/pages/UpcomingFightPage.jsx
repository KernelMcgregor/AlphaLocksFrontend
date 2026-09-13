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
import { ArrowLeft, ArrowRight, Brain, Flame, Info, Timer, Trophy, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, useNavigate } from 'react-router-dom'
import WeightClassBadge from '../components/WeightClassBadge'
import HeaderActions from '../components/layout/HeaderActions'
import FighterImage from '../components/sports/FighterImage'
import FighterMini from '../components/sports/FighterMini'
import WavingFlag from '../components/sports/WavingFlag'
import { SlideTabs } from '../components/ui/slide-tabs'
import { Tip } from '../components/ui/tip'
import ActivityBars from '../components/viz/ActivityBars'
import DimBar from '../components/viz/DimBar'
import { DumbbellRow, TwoWayLegend } from '../components/viz/Dumbbell'
import FormStrip from '../components/viz/FormStrip'
import HeroTile from '../components/viz/HeroTile'
import MirrorBars from '../components/viz/MirrorBars'
import ProbabilityWaterfall from '../components/viz/ProbabilityWaterfall'
import RadarChart from '../components/viz/RadarChart'
import RoundPacing from '../components/viz/RoundPacing'
import Section from '../components/viz/Section'
import SkillCallout from '../components/viz/SkillCallout'
import SplitBar from '../components/viz/SplitBar'
import { useScrollSpy } from '../components/viz/hooks'
import {
  fetchEvents, fetchFighter, fetchFighterCareerStats, fetchFighterFights,
  fetchFighterStats, fetchFightContext,
} from '../lib/api'
import {
  AXES, DIMS, aggregateCareer, deriveForm, deriveRoundPacing, deriveRoundSurvival,
  deriveTwoWay, ordinal,
} from '../lib/fighterAnalytics'
import { cn, formatDate, formatOdds } from '../lib/utils'

// Corner identity, literal: the red corner is red and the blue corner is blue.
// Classes are spelled out rather than built from a token — Tailwind scans source
// text, so a class assembled at runtime is not guaranteed to be in the stylesheet.
const CORNERS = [
  { key: 'red', css: 'var(--color-corner-red)', bar: 'bg-corner-red', border: 'border-corner-red', tint: 'bg-corner-red/10' },
  { key: 'blue', css: 'var(--color-corner-blue)', bar: 'bg-corner-blue', border: 'border-corner-blue', tint: 'bg-corner-blue/10' },
]

const fullName = (f) => (f ? `${f.first_name} ${f.last_name}`.trim() : 'TBA')

// A bare "#1" doesn't say #1 of what, and Flyweight/Featherweight collide at any
// two-letter abbreviation — so flyweight is FLW and featherweight FW, the same
// split the promotion itself uses. Women's divisions take a W prefix.
const DIVISION_ABBR = [
  ['light heavyweight', 'LHW'],
  ['heavyweight', 'HW'],
  ['welterweight', 'WW'],
  ['middleweight', 'MW'],
  ['lightweight', 'LW'],
  ['featherweight', 'FW'],
  ['flyweight', 'FLW'],
  ['bantamweight', 'BW'],
  ['strawweight', 'SW'],
  ['catchweight', 'CW'],
]

function divisionAbbr(weightClass) {
  const wc = (weightClass || '').toLowerCase()
  const hit = DIVISION_ABBR.find(([name]) => wc.includes(name))
  if (!hit) return null
  // "Women's Flyweight Title Bout" → WFLW. The apostrophe varies by source.
  const womens = wc.includes('women')
  return `${womens ? 'W' : ''}${hit[1]}`
}

// Method segments, most-likely first. Spelled out rather than built at runtime
// — Tailwind scans source text for class names.
const METHOD_TINTS = ['bg-primary', 'bg-muted-foreground/55', 'bg-muted-foreground/30']

// UFC.com writes "--" for a missing measurement rather than leaving it blank.
function val(v) {
  const t = typeof v === 'string' ? v.trim() : v
  return !t || t === '--' ? null : t
}

const impliedFromOdds = (american) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100)

// ---------------------------------------------------------------------------
// Keys to victory
// ---------------------------------------------------------------------------
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
  { attack: 'ko', defend: 'kod', label: 'Knockout power', against: 'chin', how: 'Land clean early and he is in trouble' },
  { attack: 'td', defend: 'tdd', label: 'Takedowns', against: 'takedown defence', how: 'Change levels and take it to the mat' },
  { attack: 'ctrl', defend: 'tdd', label: 'Control time', against: 'takedown defence', how: 'Hold top position and drain the clock' },
  { attack: 'sub', defend: 'subd', label: 'Submission threat', against: 'submission defence', how: 'Hunt the finish once it hits the ground' },
  { attack: 'str_vol', defend: 'str_def', label: 'Volume', against: 'strike defence', how: 'Out-work him and bank rounds' },
  { attack: 'str_acc', defend: 'str_def', label: 'Accuracy', against: 'strike defence', how: 'Pick the openings rather than trade' },
  { attack: 'dist', defend: 'str_def', label: 'Distance striking', against: 'strike defence', how: 'Keep it long and fight behind the jab' },
  { attack: 'clinch', defend: 'tdd', label: 'Clinch work', against: 'takedown defence', how: 'Close the distance and work the fence' },
  { attack: 'gnd', defend: 'subd', label: 'Ground striking', against: 'guard', how: 'Pass, posture and make him carry weight' },
  { attack: 'pts', defend: 'durability', label: 'Pace', against: 'durability', how: 'Push a pace he cannot answer late' },
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

// ---------------------------------------------------------------------------
// Model attribution
// ---------------------------------------------------------------------------
// The stored SHAP values are per-feature and named for the model's own columns.
// Twelve rows of `diff_age_x_log_layoff` is not an explanation, so features are
// folded into families a reader can argue with. Order is fixed rather than sorted
// by size: the same fight read twice, and two fights read side by side, should put
// the same family in the same place.
const SHAP_FAMILIES = [
  { key: 'market', label: 'Market signal', test: (n) => n.includes('odds') },
  { key: 'skills', label: 'Rated skills', test: (n) => n.includes('glicko') },
  { key: 'rating', label: 'Rating & résumé', test: (n) => /elo|resume|career|streak|win_pct/.test(n) },
  { key: 'age', label: 'Age & prime', test: (n) => /age|peak|years/.test(n) },
  { key: 'activity', label: 'Layoff & activity', test: (n) => /layoff|days_since|fights_seen|rounds_seen/.test(n) },
  { key: 'physical', label: 'Physical', test: (n) => /height|reach|weight|stance/.test(n) },
  { key: 'output', label: 'Fight output', test: (n) => /sig_str|str_|td_|ctrl|kd|sub_att|ground|clinch|dist|pace|output/.test(n) },
  { key: 'finishing', label: 'Finishing', test: (n) => /ko_|sub_rate|dec_rate|finish/.test(n) },
  { key: 'other', label: 'Everything else', test: () => true },
]

const shapFamily = (name) => SHAP_FAMILIES.find((f) => f.test(name)).key

const logit = (p) => Math.log(p / (1 - p))
const sigmoid = (x) => 1 / (1 + Math.exp(-x))

// Heights are stored as `6' 2"`, reach as `74.0"`. Parsed to inches only so the
// tale of the tape can mark which side holds the physical edge.
function heightInches(v) {
  const m = /(\d+)\s*'\s*(\d+)?/.exec(val(v) || '')
  return m ? Number(m[1]) * 12 + Number(m[2] || 0) : null
}

function reachInches(v) {
  const n = parseFloat(val(v) || '')
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Left rail
// ---------------------------------------------------------------------------
// One half of the matchup box: the portrait over its waving flag, then the name
// and record beneath.
//
// The portrait sits flush with the card's top and outer edge — no padding, no
// frame — so the image gets every pixel of a narrow rail. Corner identity is the
// 2px rule under the image instead of a box around it, which is the only edge
// that was doing any work once the two halves met in the middle.
//
// The scale-up is the zoom: UFC's portraits are full-body, which at 150px wide
// left the head the size of a pea. Scaling from the top crops the shins and feet
// — the standard crop for a fight card — and never touches the face, which is
// the one part of the portrait that has to survive.
function CornerHalf({ fighter, corner, ctx, rounded, weightClass }) {
  const glicko = ctx?.glicko
  const division = divisionAbbr(weightClass)
  return (
    <Link
      to={`/ufc/fighters/${fighter.id}`}
      className="group flex min-w-0 flex-1 flex-col"
    >
      <div
        className={cn(
          'relative h-[156px] overflow-hidden border-b-[3px]',
          corner.border, corner.tint, rounded,
        )}
      >
        <WavingFlag countryCode={fighter.country_code} />
        <FighterImage
          fighter={fighter}
          fit="contain"
          alt={fullName(fighter)}
          className="relative z-10 h-full w-full"
          imgClassName="origin-top scale-[1.2]"
        />
      </div>

      {/* Names wrap rather than truncate — "Christian Leroy Duncan" cut off
          mid-word in a column this narrow, and a second line costs less than a
          lost name. The flag is on the portrait now, so it is not repeated here. */}
      <div className="mt-1.5 px-1.5 text-center text-[12.5px] font-extrabold leading-tight group-hover:underline">
        {fullName(fighter)}
      </div>
      {fighter.nickname && (
        <div className="truncate px-1.5 text-center text-[10px] italic leading-tight text-muted-foreground">
          &quot;{fighter.nickname}&quot;
        </div>
      )}

      <div className="mt-1 flex flex-wrap justify-center gap-1 px-1.5">
        <span className="rounded-md border bg-background px-1.5 py-px text-[10.5px] font-bold tabular-nums">
          {fighter.wins}-{fighter.losses}{fighter.draws > 0 ? `-${fighter.draws}` : ''}
        </span>
        {glicko?.division_rank != null && (
          <span
            className="rounded-md px-1.5 py-px text-[10.5px] font-bold text-white"
            style={{ background: corner.css }}
            title={weightClass || undefined}
          >
            #{glicko.division_rank}{division ? ` ${division}` : ''}
          </span>
        )}
      </div>
    </Link>
  )
}

// Both corners in one box: portraits side by side over a shared tale of the tape.
// The attributes are one centred column with each fighter's value flanking it, so
// every row is a direct comparison — two separate bio grids made the reader hold
// one number in their head while finding its counterpart.
// Rows past the core five only appear when the viewport is tall enough to hold
// them without squeezing the odds boards — height-based media queries rather than
// width, because what runs out on a laptop is vertical space. Spelled out as
// literal class strings: Tailwind scans source text, so a variant assembled at
// runtime would never make it into the stylesheet.
const TIER_CLASS = {
  0: 'flex',
  1: 'hidden [@media(min-height:820px)]:flex',
  2: 'hidden [@media(min-height:900px)]:flex',
  3: 'hidden [@media(min-height:1000px)]:flex',
}

// "35.00" — the UFC.com bio figure, which unlike reach carries no inch mark.
const legReach = (v) => {
  const n = parseFloat(val(v) || '')
  return Number.isFinite(n) ? `${n.toFixed(1)}"` : null
}

// Share of wins that came by stoppage — the one number that says whether a
// fighter's record was built by finishing people.
const finishPct = (f) => {
  const wins = f?.total_wins
  if (!wins) return null
  const rate = (f.ko_rate || 0) + (f.sub_rate || 0)
  return `${Math.round(rate * 100)}%`
}

function MatchupCard({ red, blue, ctx, weightClass }) {
  const rows = [
    { label: 'Age', r: ctx?.red?.age, b: ctx?.blue?.age, fmt: (v) => `${v} yrs` },
    { label: 'Height', r: val(red.height), b: val(blue.height), cmp: heightInches },
    // reach already carries its own inch mark ('74.0"')
    { label: 'Reach', r: val(red.reach), b: val(blue.reach), cmp: reachInches },
    { label: 'Leg', r: legReach(red.leg_reach), b: legReach(blue.leg_reach), cmp: reachInches, tier: 1 },
    { label: 'Stance', r: val(red.stance), b: val(blue.stance) },
    { label: 'Style', r: val(red.fighting_style), b: val(blue.fighting_style), tier: 1 },
    { label: 'Gym', r: val(red.trains_at), b: val(blue.trains_at), tier: 2 },
    {
      label: 'Layoff',
      r: ctx?.red?.days_since_last_fight,
      b: ctx?.blue?.days_since_last_fight,
      fmt: (v) => `${v} days`,
      tier: 2,
    },
    { label: 'From', r: val(red.birthplace), b: val(blue.birthplace) },
    {
      label: 'Finish',
      r: finishPct(ctx?.red?.finish_rates),
      b: finishPct(ctx?.blue?.finish_rates),
      tier: 3,
    },
    {
      label: 'Debut',
      r: red.octagon_debut ? formatDate(red.octagon_debut) : null,
      b: blue.octagon_debut ? formatDate(blue.octagon_debut) : null,
      tier: 3,
    },
    // A row where neither side has a value drops out rather than showing dashes.
  ].filter((row) => row.r != null || row.b != null)

  return (
    // No padding at the top: the portraits are the card's top edge, corner to
    // corner. `overflow-hidden` lets them square off against the card's radius.
    <div className="shrink-0 overflow-hidden rounded-lg border border-border pb-2.5">
      {/* The two portraits meet in the middle with no gap, so the red and blue
          rules butt against each other and read as one matchup rather than two
          cards. VS sits on the seam rather than between them. */}
      <div className="relative flex items-stretch">
        <CornerHalf fighter={red} corner={CORNERS[0]} ctx={ctx?.red} rounded="rounded-tl-md" weightClass={weightClass} />
        <CornerHalf fighter={blue} corner={CORNERS[1]} ctx={ctx?.blue} rounded="rounded-tr-md" weightClass={weightClass} />
        <span className="pointer-events-none absolute left-1/2 top-[78px] z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-muted-foreground shadow-sm">
          vs
        </span>
      </div>

      {rows.length > 0 && (
        <div className="mx-2.5 mt-2 border-t pt-1.5">
          {rows.map((row) => {
            // Only height and reach get an advantage mark: they have an
            // unambiguous direction. Younger is not strictly better and stance
            // has no ordering, so those rows stay neutral.
            const a = row.cmp ? row.cmp(row.r) : null
            const b = row.cmp ? row.cmp(row.b) : null
            const edge = a != null && b != null && a !== b ? (a > b ? 'r' : 'b') : null
            const side = (v, which) => {
              const text = v == null ? '—' : (row.fmt ? row.fmt(v) : v)
              return (
                <span
                  // Hometowns and gyms run long; truncate with the full value on hover
                  // rather than wrapping, which would make row heights uneven.
                  title={typeof text === 'string' && text !== '—' ? text : undefined}
                  className={cn(
                    'min-w-0 flex-1 truncate text-[11px] font-semibold tabular-nums',
                    which === 'r' ? 'text-right' : 'text-left',
                    edge === which ? 'font-extrabold' : 'text-foreground/75',
                  )}
                  style={edge === which ? { color: which === 'r' ? CORNERS[0].css : CORNERS[1].css } : undefined}
                >
                  {text}
                </span>
              )
            }
            return (
              <div key={row.label} className={cn('items-center gap-1.5 py-[1px]', TIER_CLASS[row.tier || 0])}>
                {side(row.r, 'r')}
                <span className="w-[46px] shrink-0 text-center text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </span>
                {side(row.b, 'b')}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// What the bout is and where it is, in the breadcrumb row next to the section tabs
// rather than in the left rail: it identifies the page, and on a short viewport the
// rail's vertical space is better spent on the fight itself.
function EventLine({ event, weightClass, scheduledRounds }) {
  if (!event && !weightClass) return null
  return (
    <div className="mr-1 hidden min-w-0 items-center gap-2 border-r border-border pr-3 lg:flex">
      <WeightClassBadge weightClass={weightClass} />
      {scheduledRounds && (
        <span className="shrink-0 rounded-md border bg-background px-1.5 py-px text-[10.5px] font-bold">
          {scheduledRounds} rounds
        </span>
      )}
      {event && (
        <>
          <span className="truncate text-[12.5px] font-extrabold tracking-tight">{event.name}</span>
          <span className="shrink-0 whitespace-nowrap text-[10.5px] text-muted-foreground">
            {formatDate(event.date)}
            {event.location ? ` · ${event.location}` : ''}
          </span>
        </>
      )}
    </div>
  )
}

// The written preview, folded into the Matchup section as a box of fixed height —
// the height the career-rates box used to have. Nothing is truncated in the text
// itself: the article is clipped by the box and faded out, and "Read more" opens
// the full piece on its own page. Clipping rather than slicing the markdown keeps
// tables and headings intact instead of cutting one in half.
function PreviewBox({ preview, fightId }) {
  const written = preview.generated_at ? formatDate(String(preview.generated_at).slice(0, 10)) : null

  return (
    // The article must not decide how tall this box is — the column beside it does.
    // An absolutely positioned card contributes nothing to the grid row, so the row
    // is sized by the keys list and the preview fills exactly that, whether that is
    // three keys or ten. The min-height is the floor for a fight with no keys at all.
    <div className="relative min-h-[240px]">
    <div className="absolute inset-0 flex flex-col rounded-lg border border-border p-3">
      <div className="mb-2 flex shrink-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold tracking-tight">Preview</span>
          <span className="text-[10.5px] text-muted-foreground">
            Written by KernelMcGregor{written ? ` · ${written}` : ''}
          </span>
        </div>
        {/* The corner link leaves for the index; getting the rest of *this*
            article is the button under the text, where the reader runs out. */}
        <Link
          to="/ufc/articles"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          See All Articles <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Headings are knocked back to near body size in here: at the article's
            own scale the h1 filled most of the box and the reader got a title
            instead of a preview. The full-length page keeps the real scale. */}
        <div className="prose prose-sm max-w-none text-foreground prose-headings:mb-1 prose-headings:mt-2 prose-headings:text-foreground prose-h1:text-[15px] prose-h1:leading-snug prose-h2:text-[13px] prose-h3:text-[12px] prose-p:my-1.5 prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-table:text-sm prose-th:text-foreground prose-td:text-foreground">
          <Markdown remarkPlugins={[remarkGfm]}>{preview.content}</Markdown>
        </div>
        {/* the article always overflows, so the fade is unconditional */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
      </div>

      <div className="mt-2 flex shrink-0 justify-center">
        <Link
          to={`/ufc/fights/${fightId}/preview`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 text-[11.5px] font-bold transition-colors hover:border-primary/50 hover:text-primary"
        >
          Read all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
    </div>
  )
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

// The skill profile, in the rail: it is identity, not analysis — the same reason
// the portraits and the tale of the tape live here. The prices moved down to the
// Model & Market section, where the model's number is there to judge them against.
//
// Takes the rail's leftover height and centres the chart in it, so the column runs
// corner to corner without a bordered box full of white under the ink.
function RadarPanel({ series }) {
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-border p-2.5 lg:flex-1">
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
          {/* `fit` — the chart scales to the height left over instead of sizing
              itself by width and spilling out of the panel. */}
          <div className="min-h-0 flex-1">
            <RadarChart series={series} fit />
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



// A two-column block where the same mark is repeated per corner, so the reader
// compares across rather than reading two unrelated panels.
function CornerColumns({ red, blue, children, className }) {
  return (
    <div className={cn('grid gap-3 lg:grid-cols-2', className)}>
      {[[CORNERS[0], red], [CORNERS[1], blue]].map(([corner, fighter]) => (
        <div key={corner.key} className="flex min-w-0 flex-col rounded-lg border border-border p-3">
          <div className="mb-2 flex shrink-0 items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corner.css }} />
            <span className="truncate text-[12px] font-extrabold">{fullName(fighter)}</span>
          </div>
          {children(corner.key)}
        </div>
      ))}
    </div>
  )
}

function Empty({ children }) {
  return <p className="py-6 text-center text-[11.5px] text-muted-foreground">{children}</p>
}

// ---------------------------------------------------------------------------
export default function UpcomingFightPage({ fight }) {
  const navigate = useNavigate()
  const { red_fighter: red, blue_fighter: blue, prediction, method_prediction, odds, method_odds, shap_values, preview, event } = fight

  // Keyed by fight id: a payload for a different fight reads as "not loaded yet"
  // rather than needing an effect to clear it first.
  const [loadedFor, setLoadedFor] = useState(null)
  const [data, setData] = useState({ ctx: null, perFighter: {} })
  const [oppData, setOppData] = useState({})         // { [id]: { name, image_url, ... } }
  const [eventMap, setEventMap] = useState({})
  const [strikeMode, setStrikeMode] = useState('pct')

  const redId = red?.id
  const blueId = blue?.id

  // Wave one: matchup context + the two fighters' logs, in parallel. Each call
  // degrades to an empty value rather than failing the page — a debuting fighter
  // legitimately has no career-stats row.
  useEffect(() => {
    let cancelled = false
    if (!redId || !blueId) return undefined

    const forFighter = (id) => Promise.all([
      fetchFighterFights(id).catch(() => []),
      fetchFighterStats(id).catch(() => []),
      fetchFighterCareerStats(id).catch(() => null),
    ]).then(([fights, stats, careerStats]) => ({ fights, stats, careerStats }))

    Promise.all([
      fetchFightContext(fight.id).catch(() => null),
      forFighter(redId),
      forFighter(blueId),
      // 500 is the endpoint cap and matches what UFCPage/FighterProfilePage ask
      // for, so this shares their cache entry rather than adding a request.
      fetchEvents({ limit: 500 }).catch(() => []),
    ]).then(([context, redData, blueData, events]) => {
      if (cancelled) return
      setData({ ctx: context, perFighter: { [redId]: redData, [blueId]: blueData } })
      setEventMap(Object.fromEntries((events || []).map((e) => [String(e.id), e.name])))
      setLoadedFor(fight.id)
    })

    return () => { cancelled = true }
  }, [fight.id, redId, blueId])

  const fresh = loadedFor === fight.id
  const ctx = fresh ? data.ctx : null

  const derive = useMemo(() => {
    const out = {}
    for (const id of [redId, blueId]) {
      const d = fresh ? data.perFighter[id] : null
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
  }, [data, fresh, redId, blueId])

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
    const sides = [
      { key: 'red', fighter: red, model: prediction.red_prob, implied: impliedFromOdds(bestRed), best: bestRed },
      { key: 'blue', fighter: blue, model: 1 - prediction.red_prob, implied: impliedFromOdds(bestBlue), best: bestBlue },
    ].map((s) => ({ ...s, edge: (s.model - s.implied) * 100 }))
    const top = sides[0].edge >= sides[1].edge ? sides[0] : sides[1]
    // The rail renders one decimal place, so anything under 0.05pp displays as
    // "+0.0%" — an edge callout that shows no edge. Treat that as none.
    return { sides, ...top, hasEdge: top.edge >= 0.05, isUnderdog: top.implied < 0.5 }
  }, [prediction, odds, red, blue])

  // The prediction as a walk from a coin flip to the number on the card.
  //
  // SHAP values are log-odds contributions from the raw model, while `red_prob` is
  // the calibrated probability, and only this fight's top 20 features are stored.
  // So the walk is anchored at the END — `logit(red_prob)` minus the stored
  // attributions is the starting point — and the difference between that and a coin
  // flip is shown as its own first step, "prior & unlisted". Every other step is
  // then exact, and the walk lands precisely on the displayed probability.
  const waterfall = useMemo(() => {
    if (!prediction?.red_prob || !shap_values?.length) return null
    const pFinal = Math.min(0.999, Math.max(0.001, prediction.red_prob))
    const stored = shap_values.reduce((a, v) => a + (v.shap_value || 0), 0)
    const baseLogit = logit(pFinal) - stored

    const sums = new Map()
    for (const v of shap_values) {
      const key = shapFamily(v.feature_name)
      sums.set(key, (sums.get(key) || 0) + (v.shap_value || 0))
    }

    // The market family is folded into the opening step rather than drawn: the
    // chart is a read of the fight, and a row saying the price is an input invites
    // the reader to discount everything under it. The walk still lands on the same
    // probability — nothing is dropped, only unlabelled.
    const opening = baseLogit + (sums.get('market') || 0)
    let cum = opening
    const steps = [{
      key: 'prior',
      label: 'Base rate',
      from: 0.5,
      to: sigmoid(opening),
      points: (sigmoid(opening) - 0.5) * 100,
    }]
    for (const fam of SHAP_FAMILIES) {
      if (fam.key === 'market') continue
      const v = sums.get(fam.key)
      if (v == null || Math.abs(v) < 1e-9) continue
      const from = sigmoid(cum)
      cum += v
      const to = sigmoid(cum)
      steps.push({ key: fam.key, label: fam.label, from, to, points: (to - from) * 100 })
    }

    return {
      steps,
      final: sigmoid(cum),
      calibration: prediction.va_prob_low != null && prediction.va_prob_high != null
        ? { low: prediction.va_prob_low, high: prediction.va_prob_high }
        : null,
    }
  }, [prediction, shap_values])

  const methodValue = useMemo(() => {
    if (!method_prediction || !method_odds || method_odds.ko_prob == null) return null
    const rows = [
      { label: 'KO/TKO', model: method_prediction.ko_prob, market: method_odds.ko_prob },
      { label: 'Submission', model: method_prediction.sub_prob, market: method_odds.sub_prob },
      { label: 'Decision', model: method_prediction.dec_prob, market: method_odds.dec_prob },
    ].map((r) => ({ ...r, edge: (r.model - r.market) * 100 }))
    return rows.reduce((a, b) => (a.edge > b.edge ? a : b))
  }, [method_prediction, method_odds])

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

  const victoryKeys = useMemo(() => buildVictoryKeys(ctx), [ctx])

  const hasSkills = radarSeries.length > 0
  const loaded = Boolean(redD && blueD)

  // The tab bar is whatever this fight actually has data for — an early-announced
  // bout with no rated skills should not show an empty tab. The preview has no tab
  // of its own: it opens the Matchup section, and the full article is its own page.
  // Odds are not here: the market lives in the rail, not the scrolling column.
  const sections = useMemo(() => [
    { key: 'matchup', label: 'Matchup' },
    { key: 'form', label: 'Form' },
    { key: 'tendencies', label: 'Tendencies' },
    prediction && { key: 'model', label: 'Model & Market' },
  ].filter(Boolean), [prediction])

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
          fit, and the 40px go to the sections, where the charts and the preview
          actually use them. */}
      <div className="flex min-h-0 shrink-0 flex-col gap-3 overflow-y-auto lg:w-[320px] lg:overflow-hidden">
        <MatchupCard red={red} blue={blue} ctx={ctx} weightClass={fight.weight_class} />
        <ModelVerdict
          prediction={prediction}
          methodPrediction={method_prediction}
          red={red}
          blue={blue}
        />
        <RadarPanel series={radarSeries} />
      </div>

      {/* ---------------- RIGHT: one scroll, many sections ---------------- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-5 [&>section+section]:border-t-2 [&>section+section]:border-foreground [&>section+section]:pt-5">

            {/* ---- Matchup: the written read, the two profiles, and the routes ---- */}
            <Section
              id="matchup"
              title="Matchup"
              note="The written read, both profiles, and where each corner can win it"
              register={register}
            >
              {/* The written read beside the routes to a win, then both careers
                  across the full width. The keys column sets the height of that
                  first row and the preview clips to it — see PreviewBox. */}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {preview?.content && <PreviewBox preview={preview} fightId={fight.id} />}

                {/* ---- Keys to victory ---- */}
                <div className="min-w-0 rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-extrabold tracking-tight">Keys to victory</span>
                    <Tip content={<span className="text-[11px]">A skill one corner rates well in, paired against the specific skill the other corner would have to stop it with. Both numbers are divisional percentiles: the attack is {KEY_ATTACK_FLOOR}th or better, the answer to it {KEY_DEFEND_CEILING}th or worse.</span>}>
                      <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
                    </Tip>
                    <span className="text-[10.5px] text-muted-foreground">strength against a hole, widest gap first</span>
                  </div>
                  {victoryKeys.length ? (
                    <div className="grid gap-2">
                      {victoryKeys.slice(0, 6).map((k) => {
                        const corner = k.side === 'red' ? CORNERS[0] : CORNERS[1]
                        const mine = k.side === 'red' ? red : blue
                        const theirs = k.side === 'red' ? blue : red
                        return (
                          <div key={k.id} className="flex min-w-0 gap-2 rounded-md border border-border/70 p-2">
                            <span className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corner.css }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5">
                                <span className="truncate text-[12px] font-extrabold" style={{ color: corner.css }}>
                                  {mine.last_name}
                                </span>
                                <span className="truncate text-[12px] font-bold">{k.label}</span>
                                <span className="ml-auto shrink-0 text-[11px] font-bold tabular-nums text-emerald-600">
                                  +{Math.round(k.gap)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                                <span className="tabular-nums">{ordinal(k.attack)}</span>
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <span className="block h-full rounded-full" style={{ width: `${k.gap}%`, background: corner.css }} />
                                </span>
                                <span className="truncate">{theirs.last_name} {k.against} {ordinal(k.defend)}</span>
                              </div>
                              <p className="mt-0.5 truncate text-[10.5px] text-foreground/70" title={k.how}>{k.how}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <Empty>
                      {hasSkills
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
                {waterfall && (
                  <div className="mb-3 rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline gap-2">
                      <span className="text-[13px] font-extrabold tracking-tight">How the probability is built</span>
                      <Tip content={<span className="text-[11px]">One step per family of features, in probability points, ending on the model&apos;s number for {red.last_name}. The market marker is the best available price with vig included.</span>}>
                        <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
                      </Tip>
                      <span className="ml-auto flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
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
                      market={value?.sides?.[0]?.implied ?? null}
                      calibration={waterfall.calibration}
                      redName={red.last_name}
                      blueName={blue.last_name}
                    />
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <div className="mb-2 text-[13px] font-extrabold tracking-tight">Method</div>
                      {method_prediction ? (
                        <div className="space-y-2">
                          {[
                            { label: 'KO/TKO', prob: method_prediction.ko_prob },
                            { label: 'Submission', prob: method_prediction.sub_prob },
                            { label: 'Decision', prob: method_prediction.dec_prob },
                          ].sort((a, b) => b.prob - a.prob).map((m) => (
                            <div key={m.label} className="flex items-center gap-2">
                              <span className="w-[74px] shrink-0 text-[11px]">{m.label}</span>
                              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-secondary">
                                <div
                                  className={cn('h-full rounded-md', m.label === method_prediction.predicted_method ? 'bg-primary' : 'bg-muted-foreground/30')}
                                  style={{ width: `${m.prob * 100}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                                  {(m.prob * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty>No method prediction.</Empty>
                      )}
                    </div>

                    {value && (
                      <div className="rounded-lg border border-border p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-sky-500" />
                          <span className="text-[13px] font-extrabold tracking-tight">Model vs market</span>
                        </div>
                        {value.sides.map((s) => (
                          <div key={s.key} className="flex items-center gap-2 border-t border-border/60 py-1.5 first:border-t-0">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.key === 'red' ? CORNERS[0].css : CORNERS[1].css }} />
                            <span className="truncate text-[11.5px] font-bold">{s.fighter.last_name}</span>
                            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {(s.model * 100).toFixed(0)}% vs {(s.implied * 100).toFixed(0)}%
                            </span>
                            <span className={cn(
                              'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
                              s.edge > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                            )}>
                              {s.edge > 0 ? '+' : ''}{s.edge.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                        {methodValue && (
                          <div className="mt-1.5 flex items-center gap-2 border-t pt-1.5">
                            <span className="truncate text-[11.5px] font-bold">{methodValue.label}</span>
                            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {(methodValue.model * 100).toFixed(0)}% vs {(methodValue.market * 100).toFixed(0)}%
                            </span>
                            <span className={cn(
                              'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
                              methodValue.edge > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                            )}>
                              {methodValue.edge > 0 ? '+' : ''}{methodValue.edge.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <p className="mt-1.5 text-[9.5px] leading-snug text-muted-foreground/80">
                          Market probability from the best available price, vig included.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* The market sits in this section rather than in its own: the
                    board is what the model's number is being judged against, and
                    reading them a page apart made that comparison a memory test.
                    The rail keeps the live prices for reference while scrolling. */}
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-extrabold tracking-tight">Moneyline board</span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {odds?.length || 0} {odds?.length === 1 ? 'book' : 'books'} · best price in colour
                      </span>
                    </div>
                    {odds?.length ? (
                      <>
                        <div className="mb-1 grid grid-cols-[1fr_58px_58px_54px] gap-1.5 border-b pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          <span />
                          <span className="truncate text-center" style={{ color: CORNERS[0].css }}>{red.last_name}</span>
                          <span className="truncate text-center" style={{ color: CORNERS[1].css }}>{blue.last_name}</span>
                          <span className="text-center normal-case">Vig</span>
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
                              <div key={o.bookmaker} className="grid grid-cols-[1fr_58px_58px_54px] items-center gap-1.5 py-0.5">
                                <span className="truncate text-[11px] text-muted-foreground" title={o.bookmaker}>{o.bookmaker}</span>
                                {[[o.red_odds, o.red_odds === bestRed, CORNERS[0].css], [o.blue_odds, o.blue_odds === bestBlue, CORNERS[1].css]].map(([v, isBest, css], i) => (
                                  <span
                                    key={i}
                                    className={cn('text-center font-mono text-[11px] tabular-nums', isBest ? 'font-bold' : 'text-muted-foreground')}
                                    style={isBest ? { color: css } : undefined}
                                  >
                                    {formatOdds(v)}
                                  </span>
                                ))}
                                <span className="text-center font-mono text-[10.5px] tabular-nums text-muted-foreground">
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
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-extrabold tracking-tight">Method market</span>
                      <span className="text-[10.5px] text-muted-foreground">
                        {method_odds ? `${method_odds.bookmaker || 'Bovada'} · model vs price` : 'not posted yet'}
                      </span>
                    </div>
                    {method_odds ? (
                      <>
                        <div className="mb-1 grid grid-cols-[64px_1fr_58px_58px_52px] gap-1.5 border-b pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          <span />
                          <span />
                          <span className="text-center normal-case">Model</span>
                          <span className="text-center normal-case">Market</span>
                          <span className="text-center normal-case">Edge</span>
                        </div>
                        {[
                          { label: 'KO/TKO', model: method_prediction?.ko_prob, market: method_odds.ko_prob, odds: method_odds.ko_odds },
                          { label: 'Submission', model: method_prediction?.sub_prob, market: method_odds.sub_prob, odds: method_odds.sub_odds },
                          { label: 'Decision', model: method_prediction?.dec_prob, market: method_odds.dec_prob, odds: method_odds.dec_odds },
                        ].map((m) => {
                          const edge = m.model != null && m.market != null ? (m.model - m.market) * 100 : null
                          return (
                            <div key={m.label} className="grid grid-cols-[64px_1fr_58px_58px_52px] items-center gap-1.5 py-0.5">
                              <span className="truncate text-[11px] font-semibold">{m.label}</span>
                              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{formatOdds(m.odds)}</span>
                              <span className="text-center text-[11px] font-bold tabular-nums">
                                {m.model != null ? `${(m.model * 100).toFixed(0)}%` : '—'}
                              </span>
                              <span className="text-center text-[11px] tabular-nums text-muted-foreground">
                                {m.market != null ? `${(m.market * 100).toFixed(0)}%` : '—'}
                              </span>
                              <span className={cn('text-center text-[11px] font-bold tabular-nums',
                                edge == null ? 'text-muted-foreground' : edge > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                                {edge == null ? '—' : `${edge > 0 ? '+' : ''}${edge.toFixed(1)}`}
                              </span>
                            </div>
                          )
                        })}
                        <p className="mt-1.5 text-[9.5px] leading-snug text-muted-foreground/80">
                          Market column is the book&apos;s de-vigged &quot;how will the fight end&quot; price;
                          per-fighter method prices are on the rail board.
                        </p>
                      </>
                    ) : (
                      <Empty>
                        Bovada posts method markets for the imminent card only, so this fills in
                        during fight week.
                      </Empty>
                    )}
                  </div>
                </div>
              </Section>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

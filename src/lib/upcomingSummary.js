// src/lib/upcomingSummary.js
// Per-fight numbers the Upcoming dashboard needs in more than one place (rail card,
// featured preview, event status bar). Pure functions over the /ufc/upcoming payload
// — the same fields UpcomingFightCard reads — so nothing here adds a request.

// DraftKings is the page's stated default; the rest are labelled wherever shown.
const BOOK_ORDER = ['DraftKings', 'FanDuel', 'Caesars', 'BetRivers']

export const fullName = (f) => (f ? `${f.first_name} ${f.last_name}`.trim() : 'TBA')

export const isTitleFight = (fight) => /title/i.test(fight?.weight_class || '')

// "Women's Flyweight Title Bout" → "Women's Flyweight". The title is shown as its own tag.
export const weightLabel = (wc) =>
  (wc || '').replace(/\s*title\s*/i, ' ').replace(/\s*bout$/i, '').trim() || 'Catchweight'

// A bare "#1" doesn't say #1 of what, and Flyweight/Featherweight collide at any
// two-letter abbreviation — so flyweight is FLW and featherweight FW, the same split the
// promotion itself uses. Women's divisions take a W prefix.
//
// Order matters: 'light heavyweight' has to be tested before 'heavyweight', or every
// light heavyweight comes back HW.
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

export function divisionAbbr(weightClass) {
  const wc = (weightClass || '').toLowerCase()
  const hit = DIVISION_ABBR.find(([name]) => wc.includes(name))
  if (!hit) return null
  // "Women's Flyweight Title Bout" → WFLW. The apostrophe varies by source.
  return `${wc.includes('women') ? 'W' : ''}${hit[1]}`
}

export const recordOf = (f) =>
  f ? `${f.wins}-${f.losses}${f.draws > 0 ? `-${f.draws}` : ''}` : ''

const implied = (american) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100)

export function summarizeFight(fight) {
  const pred = fight.prediction
  const exch = fight.exchange
  const odds = fight.odds || []

  const book = BOOK_ORDER.find((bk) => odds.some((o) => o.bookmaker === bk))
  const picked = book ? odds.find((o) => o.bookmaker === book) : odds[0] || null

  const redProb = pred ? pred.red_prob : null
  const pickedRed = pred ? pred.predicted_winner === 'red' : null
  const pickProb = pred ? (pickedRed ? pred.red_prob : 1 - pred.red_prob) : null
  // Exchange consensus oriented to the model's pick. Exchange quotes carry no vig,
  // so model minus market is meaningful without a de-vig step.
  const marketProb = exch && pred ? (pickedRed ? exch.red_prob : 1 - exch.red_prob) : null
  const edge = pickProb != null && marketProb != null ? (pickProb - marketProb) * 100 : null

  // Best price per side across every book. American odds: higher is always better
  // for the bettor, on both the plus and minus side.
  let bestRed = null
  let bestBlue = null
  for (const o of odds) {
    if (o.red_odds != null && (bestRed == null || o.red_odds > bestRed.red_odds)) bestRed = o
    if (o.blue_odds != null && (bestBlue == null || o.blue_odds > bestBlue.blue_odds)) bestBlue = o
  }
  const book2 = bestRed && bestBlue ? implied(bestRed.red_odds) + implied(bestBlue.blue_odds) : null
  // A two-way arb exists when the best prices on each side imply less than 100%.
  const arbRoi = book2 != null && book2 < 1 ? (1 / book2 - 1) * 100 : null

  return {
    picked,
    bookTag: book && book !== 'DraftKings' ? book : null,
    redProb,
    blueProb: redProb != null ? 1 - redProb : null,
    pickedRed,
    pickProb,
    marketProb,
    edge,
    bestRedBook: bestRed?.bookmaker ?? null,
    bestBlueBook: bestBlue?.bookmaker ?? null,
    bestRedOdds: bestRed?.red_odds ?? null,
    bestBlueOdds: bestBlue?.blue_odds ?? null,
    bookCount: odds.length,
    arbRoi,
    title: isTitleFight(fight),
  }
}

// Card-level figures for the status bar above the dashboard.
//
// Counts only. The bar used to carry the card's best edge and best arbitrage ROI as
// headline numbers; both are per-fight facts that the rail and the featured panel already
// state where they belong, and on most cards they were blank anyway — exchange quotes
// only reach the nearest event or two.
export function summarizeEvent(event) {
  const rows = (event?.fights || []).map((f) => summarizeFight(f))
  return {
    titleFights: rows.filter((r) => r.title).length,
    arbCount: rows.filter((r) => r.arbRoi != null).length,
  }
}

// Signed edge in whole points, for display. Rounding first matters: `(-0.4).toFixed(0)`
// is the string "-0", and a "+0" built by prefixing a sign is no better — neither says
// anything a bare "0" doesn't.
export function formatEdge(edge) {
  if (edge == null) return null
  const n = Math.round(edge)
  if (n === 0) return '0'
  return n > 0 ? `+${n}` : `${n}`
}

/**
 * Split an event's location string into parts.
 *
 * ufcstats writes "City, Region, Country" ("New York City, New York, USA") and sometimes
 * drops the region ("London, England, United Kingdom" keeps it; "Macau, China" does not).
 * The region is the least useful of the three for a reader — city plus country identifies
 * the venue's city unambiguously — so callers generally show those two.
 */
export function parseLocation(location) {
  const parts = (location || '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!parts.length) return { city: null, region: null, country: null }
  if (parts.length === 1) return { city: parts[0], region: null, country: null }
  if (parts.length === 2) return { city: parts[0], region: null, country: parts[1] }
  return { city: parts[0], region: parts[1], country: parts.slice(2).join(', ') }
}

// Whole days from today to the event date ('YYYY-MM-DD', local).
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

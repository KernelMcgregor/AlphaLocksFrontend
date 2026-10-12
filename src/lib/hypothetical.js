// Shared pieces of the hypothetical-bout pages (/ufc/hypothetical): division list, the
// URL <-> selection mapping, and a loader that rides out the server's warm-up.
import { useEffect, useState } from 'react'
import { fetchFighterFights, fetchHypothetical, fetchHypotheticalStatus } from './api'

// Mirrors services/ufc/hypothetical.DIVISIONS. Men's then women's, light to heavy.
export const DIVISIONS = [
  { key: 'flyweight', label: 'Flyweight', short: 'FLW' },
  { key: 'bantamweight', label: 'Bantamweight', short: 'BW' },
  { key: 'featherweight', label: 'Featherweight', short: 'FW' },
  { key: 'lightweight', label: 'Lightweight', short: 'LW' },
  { key: 'welterweight', label: 'Welterweight', short: 'WW' },
  { key: 'middleweight', label: 'Middleweight', short: 'MW' },
  { key: 'light_heavyweight', label: 'Light Heavyweight', short: 'LHW' },
  { key: 'heavyweight', label: 'Heavyweight', short: 'HW' },
  { key: 'w_strawweight', label: "Women's Strawweight", short: 'WSW' },
  { key: 'w_flyweight', label: "Women's Flyweight", short: 'WFLW' },
  { key: 'w_bantamweight', label: "Women's Bantamweight", short: 'WBW' },
  { key: 'w_featherweight', label: "Women's Featherweight", short: 'WFW' },
  { key: 'catchweight', label: 'Catchweight', short: 'CW' },
]
export const DIVISION_BY_KEY = Object.fromEntries(DIVISIONS.map((d) => [d.key, d]))
export const divisionLabel = (key) => DIVISION_BY_KEY[key]?.label ?? 'Unknown division'

export const isWomens = (key) => Boolean(key?.startsWith('w_'))
/** Men's and women's divisions are separate ladders; nobody is matched across them.
 *  Read off `sex` from the index rather than the division, which for a fighter whose
 *  last bouts were catchweights says nothing either way. */
export const sameLadder = (a, b) => !a || !b || a.sex === b.sex

/** Last five completed bouts, newest first, in the shape FeaturedFight's form chips read. */
export function recentForm(fights, fighterId) {
  return (fights || [])
    .filter((f) => f.winner_id || f.method)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5)
    .map((f) => ({
      id: f.id,
      win: String(f.winner_id) === String(fighterId),
      draw: !f.winner_id && /draw/i.test(f.method || ''),
      method: f.method,
    }))
}

/** The selection a URL describes. Ids stay strings: they are past 2^53. */
export function readSelection(params) {
  const rounds = Number(params.get('rounds'))
  return {
    red: params.get('red') || null,
    blue: params.get('blue') || null,
    division: params.get('div') || null,
    // No title-fight option on the page (removed); a `title` left in an old link is ignored.
    title: false,
    rounds: rounds === 3 || rounds === 5 ? rounds : null,
  }
}

export function selectionQuery({ red, blue, division, title, rounds }) {
  const q = new URLSearchParams()
  if (red) q.set('red', red)
  if (blue) q.set('blue', blue)
  if (division) q.set('div', division)
  if (title) q.set('title', '1')
  if (rounds) q.set('rounds', String(rounds))
  return q
}

// How often to re-ask while the server builds its fighter features (a few minutes,
// once a day at most).
const WARM_POLL_MS = 8000

/**
 * The prediction for a selection: { status: 'loading' | 'warming' | 'error' | 'ready',
 * data, error }. `data.fight.red_fighter`/`blue_fighter` carry `recent_form`.
 * While the server is warming up (503) it polls and retries on its own.
 */
export function useHypothetical(sel) {
  const key = sel.red && sel.blue
    ? `${sel.red}|${sel.blue}|${sel.division}|${sel.title}|${sel.rounds}` : null
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })

  useEffect(() => {
    if (!key) return undefined
    let cancelled = false
    let timer = null

    const attempt = () => {
      Promise.all([
        fetchHypothetical(sel),
        fetchFighterFights(sel.red).catch(() => []),
        fetchFighterFights(sel.blue).catch(() => []),
      ])
        .then(([data, redFights, blueFights]) => {
          if (cancelled) return
          const fight = {
            ...data.fight,
            red_fighter: { ...data.fight.red_fighter, recent_form: recentForm(redFights, sel.red) },
            blue_fighter: { ...data.fight.blue_fighter, recent_form: recentForm(blueFights, sel.blue) },
          }
          setState({ key, status: 'ready', data: { ...data, fight }, error: null })
        })
        .catch((err) => {
          if (cancelled) return
          if (/warming up/i.test(err.message)) {
            setState({ key, status: 'warming', data: null, error: err.message })
            // Wait for the build to land rather than hammering the predict route.
            timer = setTimeout(() => {
              fetchHypotheticalStatus().catch(() => null).finally(() => { if (!cancelled) attempt() })
            }, WARM_POLL_MS)
          } else {
            setState({ key, status: 'error', data: null, error: err.message })
          }
        })
    }
    attempt()
    return () => { cancelled = true; clearTimeout(timer) }
    // `key` covers every field of `sel` the request reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!key) return { status: 'idle', data: null, error: null }
  return state.key === key ? state : { status: 'loading', data: null, error: null }
}

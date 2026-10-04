// /ufc/fights/:id — one route, two very different pages.
//
// A fight that has not happened yet is a matchup to be analysed: skills, form,
// tendencies, the model's read, the market. A fight that has happened is a result
// to be reviewed. They share almost no sections, so rather than one component
// branching throughout, this fetches the fight and hands it to whichever page
// matches its state.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { fetchFight } from '../lib/api'
import { loadMatchup, loadReview } from '../lib/matchup'
import CompletedFightPage from './CompletedFightPage'
import UpcomingFightPage from './UpcomingFightPage'

// A result is a winner or, for draws and no contests, a recorded method — keying on
// the winner alone sent every draw to the upcoming-fight page.
const isPlayed = (fight) => Boolean(fight.winner || fight.method)

export default function FightDetailPage() {
  const { id } = useParams()
  // Keyed by the id it holds, so switching fights reads as "loading" immediately
  // without an effect having to clear the previous fight first.
  const [state, setState] = useState({ id: null, fight: null, matchup: null, review: null })

  useEffect(() => {
    // Navigating between two fights reuses this component, so a slow response for
    // the fight we just left could land after the new one and overwrite it.
    let cancelled = false
    fetchFight(id)
      // Both pages need more than the fight payload (histories, the matchup context,
      // the market curves). It is awaited HERE, before the page mounts, so the page
      // opens complete rather than section by section.
      .then((fight) => {
        if (!fight) return { fight, matchup: null, review: null }
        return isPlayed(fight)
          ? loadReview(fight).then((review) => ({ fight, matchup: null, review }))
          : loadMatchup(fight).then((matchup) => ({ fight, matchup, review: null }))
      })
      .then((loaded) => { if (!cancelled) setState({ id, ...loaded }) })
      .catch(() => { if (!cancelled) setState({ id, fight: null, matchup: null, review: null }) })
    return () => { cancelled = true }
  }, [id])

  if (state.id !== id) return <PageLoader />
  const { fight, matchup, review } = state

  if (!fight) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Fight not found.</p>
        <Link to="/ufc/events" className="text-sm text-primary hover:underline">Back to events</Link>
      </div>
    )
  }

  return isPlayed(fight)
    ? <CompletedFightPage fight={fight} review={review} />
    : <UpcomingFightPage fight={fight} matchup={matchup} />
}

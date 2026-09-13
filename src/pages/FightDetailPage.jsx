// /ufc/fights/:id — one route, two very different pages.
//
// A fight that has not happened yet is a matchup to be analysed: skills, form,
// tendencies, the model's read, the market. A fight that has happened is a result
// to be reviewed. They share almost no sections, so rather than one component
// branching throughout, this fetches the fight and hands it to whichever page
// matches its state.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchFight } from '../lib/api'
import CompletedFightPage from './CompletedFightPage'
import UpcomingFightPage from './UpcomingFightPage'

export default function FightDetailPage() {
  const { id } = useParams()
  // Keyed by the id it holds, so switching fights reads as "loading" immediately
  // without an effect having to clear the previous fight first.
  const [state, setState] = useState({ id: null, fight: null })

  useEffect(() => {
    // Navigating between two fights reuses this component, so a slow response for
    // the fight we just left could land after the new one and overwrite it.
    let cancelled = false
    fetchFight(id)
      .then((fight) => { if (!cancelled) setState({ id, fight }) })
      .catch(() => { if (!cancelled) setState({ id, fight: null }) })
    return () => { cancelled = true }
  }, [id])

  if (state.id !== id) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!state.fight) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Fight not found.</p>
        <Link to="/ufc/events" className="text-sm text-primary hover:underline">Back to events</Link>
      </div>
    )
  }

  return state.fight.winner
    ? <CompletedFightPage fight={state.fight} />
    : <UpcomingFightPage fight={state.fight} />
}

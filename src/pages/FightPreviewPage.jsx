// /ufc/fights/:id/preview: one article, beside the numbers behind it. The layout comes from
// the newsroom (components/articles/layouts.jsx), so a card's articles don't all look alike.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { parseArticle } from '../components/articles/articleText'
import { layoutKey } from '../components/articles/fightText'
import { ArticleLayout } from '../components/articles/layouts'
import { useRadar } from '../components/articles/useRadar'
import PageLoader from '../components/PageLoader'
import { fetchArticleMedia, fetchFight, peekCached } from '../lib/api'
import { formatDate } from '../lib/utils'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function FightPreviewPage() {
  const { id } = useParams()
  const [state, setState] = useState({ id: null, fight: null })
  useEffect(() => {
    let cancelled = false
    fetchFight(id)
      .then((fight) => { if (!cancelled) setState({ id, fight }) })
      .catch(() => { if (!cancelled) setState({ id, fight: null }) })
    return () => { cancelled = true }
  }, [id])

  const cached = state.id === id ? null : peekCached(`/ufc/fights/${id}`)
  const fight = state.id === id ? state.fight : cached
  const radar = useRadar(id, fight?.red_fighter, fight?.blue_fighter)
  const [media, setMedia] = useState({})
  useEffect(() => { fetchArticleMedia(id).then(setMedia).catch(() => setMedia({})) }, [id])
  if (state.id !== id && !cached) return <PageLoader />

  if (!fight?.preview?.content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">No article written for this fight.</p>
        <Link to={`/ufc/fights/${id}`} className="text-sm text-primary hover:underline">Back to the fight</Link>
      </div>
    )
  }

  const art = parseArticle(fight.preview.content)
  const written = fight.preview.generated_at ? formatDate(String(fight.preview.generated_at).slice(0, 10)) : ''
  const minutes = Math.max(1, Math.round(fight.preview.content.split(/\s+/).length / 230))
  return (
    <div className="h-full overflow-y-auto pb-6 pr-1">
      <ArticleLayout kind={layoutKey(fight)} fight={fight} art={art} radar={radar} written={written} minutes={minutes} media={media} meetings={fight.preview.meetings} />
    </div>
  )
}

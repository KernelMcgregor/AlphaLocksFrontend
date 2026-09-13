// /ufc/fights/:id/preview — the written preview on its own, full length.
//
// The fight page only has room for the opening of the article (a clamped box in
// the Matchup section); "Read more" lands here, where the piece is the page and
// nothing competes with it for height. Same fetch as FightDetailPage, so the
// preview is whatever the fight payload carries.
import { ArrowLeft, Brain } from 'lucide-react'
import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, useParams } from 'react-router-dom'
import { fetchFight } from '../lib/api'
import { formatDate } from '../lib/utils'

const fullName = (f) => (f ? `${f.first_name} ${f.last_name}`.trim() : 'TBA')

export default function FightPreviewPage() {
  const { id } = useParams()
  // Keyed by the id it holds so switching fights reads as "loading" immediately.
  const [state, setState] = useState({ id: null, fight: null })

  useEffect(() => {
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

  const fight = state.fight
  const preview = fight?.preview

  if (!preview?.content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">No preview written for this fight.</p>
        <Link to={`/ufc/fights/${id}`} className="text-sm text-primary hover:underline">Back to the fight</Link>
      </div>
    )
  }

  const { red_fighter: red, blue_fighter: blue, event } = fight
  const written = preview.generated_at ? formatDate(String(preview.generated_at).slice(0, 10)) : null

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">
            {red?.last_name || fullName(red)} vs. {blue?.last_name || fullName(blue)}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
            {event?.name && <span className="font-semibold text-foreground/80">{event.name}</span>}
            {event?.date && <span>· {formatDate(event.date)}</span>}
            {event?.location && <span>· {event.location}</span>}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-primary" />
            Written by KernelMcGregor{written ? ` · ${written}` : ''}
          </div>
        </div>
        <Link
          to={`/ufc/fights/${id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to matchup
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-5">
        <div className="prose prose-sm mx-auto max-w-[72ch] text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-th:text-foreground prose-td:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-table:text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{preview.content}</Markdown>
        </div>
      </div>
    </div>
  )
}

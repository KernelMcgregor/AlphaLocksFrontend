// /ufc/articles — every written preview, newest card first.
//
// The index behind "See All Articles" on a fight page. Rows come from
// /ufc/previews, which serves a headline and an opening line per article rather
// than the bodies — following a row lands on /ufc/fights/:id/preview, which
// serves the whole piece.
import { ArrowRight, Brain } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import WeightClassBadge from '../components/WeightClassBadge'
import { fetchPreviews } from '../lib/api'
import { formatDate } from '../lib/utils'

export default function ArticlesPage() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchPreviews({ limit: 120 })
      .then((r) => { if (!cancelled) setRows(r || []) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [])

  // Grouped by card: the articles for one event are written together and read
  // together, and an undifferentiated list of 120 headlines has no shape.
  const groups = useMemo(() => {
    if (!rows) return null
    const byEvent = new Map()
    for (const r of rows) {
      const key = r.event_name || 'Unscheduled'
      if (!byEvent.has(key)) byEvent.set(key, { name: key, date: r.event_date, location: r.event_location, items: [] })
      byEvent.get(key).items.push(r)
    }
    return [...byEvent.values()]
  }, [rows])

  if (!groups) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!groups.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No previews have been written yet.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-baseline gap-2">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Articles</h1>
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Brain className="h-3.5 w-3.5 text-primary" />
          Fight previews written by KernelMcGregor
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.name}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b pb-1.5">
                <h2 className="text-[15px] font-extrabold tracking-tight">{g.name}</h2>
                {g.date && <span className="text-[11px] text-muted-foreground">{formatDate(g.date)}</span>}
                {g.location && <span className="text-[11px] text-muted-foreground">· {g.location}</span>}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {g.items.length} {g.items.length === 1 ? 'article' : 'articles'}
                </span>
              </div>

              <div className="grid gap-2 xl:grid-cols-2">
                {g.items.map((r) => (
                  <Link
                    key={r.fight_id}
                    to={`/ufc/fights/${r.fight_id}/preview`}
                    className="group flex flex-col rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <WeightClassBadge weightClass={r.weight_class} />
                      {!r.is_upcoming && (
                        <span className="rounded-md border bg-background px-1.5 py-px text-[9.5px] font-bold text-muted-foreground">
                          Result in
                        </span>
                      )}
                      {r.generated_at && (
                        <span className="ml-auto text-[9.5px] text-muted-foreground">
                          {formatDate(String(r.generated_at).slice(0, 10))}
                        </span>
                      )}
                    </div>

                    <div className="text-[13.5px] font-extrabold leading-snug group-hover:underline">
                      {r.headline || `${r.red_name} vs. ${r.blue_name}`}
                    </div>
                    {r.lede && (
                      <p className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-muted-foreground">{r.lede}</p>
                    )}
                    <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-primary">
                      Read article <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

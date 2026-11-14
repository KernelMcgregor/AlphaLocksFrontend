// /ufc/articles: the news front page.
//
// Top story and top headlines, previews and news stories ranked together (frontPage.js:
// fight day belongs to the card's previews, a midweek day to the biggest recent news),
// the news desk's latest stories (/ufc/news), the next four previews as cards, a
// fight-week band for the next card with a countdown, then everything older in a latest
// list. Preview rows come from /ufc/previews (headline, lede, artwork; not the bodies).
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Countdown from '../components/arc/countdown/countdown'
import { ArticleArt } from '../components/articles/article'
import { parseUtc, rankFront } from '../components/articles/frontPage'
import { splitHeadline } from '../components/articles/articleText'
import PageLoader from '../components/PageLoader'
import NewsArt from '../components/news/NewsArt'
import { KIND_LABEL, newsHref } from '../components/news/newsText'
import { fetchNews, fetchPreviews, fetchUpcomingEvents, peekCached } from '../lib/api'
import { cn, formatDate } from '../lib/utils'

const PATH = '/ufc/previews?limit=120'

function ago(iso) {
  if (!iso) return ''
  const h = Math.round((Date.now() - parseUtc(iso)) / 3.6e6)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d < 14 ? `${d}d ago` : formatDate(iso.slice(0, 10))
}

const eventShort = (name = '') => {
  const k = name.split(':')[0].trim()
  return /^UFC\s+\d+/i.test(k) ? k : 'Fight Night'
}
const kicker = (r) => `${eventShort(r.event_name)} preview`
const title = (r) => splitHeadline(r.headline || '').title
const href = (r) => `/ufc/fights/${r.fight_id}/preview`

function Byline({ r, light }) {
  return (
    <div className={cn('flex items-center gap-2 text-[11.5px]', light ? 'text-white/70' : 'text-muted-foreground')}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-white">KM</span>
      <span><b className={cn('font-semibold', light ? 'text-white' : 'text-foreground')}>KernelMcGregor</b> · {ago(r.generated_at)} · {r.read_minutes} min read</span>
    </div>
  )
}

// The newsroom's layouts that read differently get named on their cards.
const LAYOUT_TAG = { rivalry: 'Rivalry', data: 'By the numbers', magazine: 'Long read' }

function Kicker({ r, className }) {
  return (
    <div className={cn('font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary', className)}>
      {kicker(r)}{LAYOUT_TAG[r.layout] && <span className="text-muted-foreground"> · {LAYOUT_TAG[r.layout]}</span>}
    </div>
  )
}

function NewsKicker({ n, className }) {
  return (
    <div className={cn('font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary', className)}>
      {KIND_LABEL[n.kind] || 'News'}
    </div>
  )
}

function TopStory({ entry }) {
  const news = entry.type === 'news'
  const r = entry.item
  return (
    <Link to={news ? newsHref(r.slug) : href(r)} className="group relative block min-h-[400px] overflow-hidden rounded-xl bg-ink">
      {news
        ? <NewsArt story={r} className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.02]" />
        : <ArticleArt image={r.image} fightId={r.fight_id} red={r.red} blue={r.blue} dark className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.02]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">Top story</span>
          {news ? <NewsKicker n={r} /> : <Kicker r={r} />}
        </div>
        <h2 className="mt-2 max-w-[24ch] text-[34px] font-extrabold leading-[1.08] tracking-tight text-white group-hover:underline">{news ? r.title : title(r)}</h2>
        {(news ? r.dek : r.lede) && <p className="mt-2 line-clamp-2 max-w-[70ch] font-serif text-[15px] leading-relaxed text-white/80">{news ? r.dek : r.lede}</p>}
        <div className="mt-3">{news
          ? <span className="text-[11.5px] text-white/70">{ago(r.published_at)}</span>
          : <Byline r={r} light />}</div>
      </div>
    </Link>
  )
}

function Headlines({ entries }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1 font-display text-[17px] font-extrabold italic uppercase tracking-tight">Top headlines</h3>
      <div className="divide-y divide-border/70">
        {entries.map(({ type, item: r }) => (
          <Link key={type === 'news' ? r.slug : r.fight_id} to={type === 'news' ? newsHref(r.slug) : href(r)}
            className="group flex gap-2 py-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">
              <span className="block font-display text-[10.5px] font-extrabold italic uppercase tracking-wide text-muted-foreground">
                {type === 'news' ? KIND_LABEL[r.kind] || 'News' : kicker(r)}
              </span>
              <span className="block text-[13px] font-bold leading-snug group-hover:text-primary">{type === 'news' ? r.title : title(r)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StoryCard({ r, dark }) {
  return (
    <Link to={href(r)} className={cn('group flex flex-col overflow-hidden rounded-xl', dark ? '' : 'border border-border bg-card')}>
      <ArticleArt image={r.image} fightId={r.fight_id} red={r.red} blue={r.blue} dark={dark} className={cn('h-[150px] shrink-0', dark && 'rounded-lg')} />
      <div className={cn('flex flex-1 flex-col', dark ? 'pt-2.5' : 'p-3')}>
        <Kicker r={r} className="text-[11px]" />
        <div className={cn('mt-1 line-clamp-3 text-[14.5px] font-extrabold leading-snug group-hover:underline', dark && 'text-white')}>{title(r)}</div>
        {!dark && <div className="mt-auto pt-2 text-[11px] text-muted-foreground">{ago(r.generated_at)} · {r.read_minutes} min read</div>}
      </div>
    </Link>
  )
}

function FightWeek({ event, rows }) {
  if (!event || !rows.length) return null
  const { kicker: k, title: t } = (() => {
    const i = event.name.indexOf(':')
    return { kicker: i < 0 ? '' : event.name.slice(0, i), title: i < 0 ? event.name : event.name.slice(i + 1).trim() }
  })()
  return (
    <section className="rounded-xl bg-ink p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-display text-[24px] font-extrabold italic uppercase leading-none tracking-tight text-white">
          <span className="text-primary">{/^UFC\s+\d+/i.test(k) ? k : 'Fight Night'}</span> fight week
        </h2>
        <span className="text-[12px] text-white/60">{t} · {formatDate(event.date)}</span>
        {event.main_card_at && (
          <div className="ml-auto w-[220px] [--color-foreground:#fff] [--color-muted-foreground:rgba(255,255,255,.6)]">
            <Countdown target={event.main_card_at} label="Main card starts in" completeLabel="Live now" />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {rows.slice(0, 4).map((r) => <StoryCard key={r.fight_id} r={r} dark />)}
      </div>
    </section>
  )
}

function LatestRow({ r }) {
  return (
    <Link to={href(r)} className="group flex gap-4 py-4">
      <ArticleArt image={r.image} fightId={r.fight_id} red={r.red} blue={r.blue} className="h-[104px] w-[170px] shrink-0 rounded-lg" />
      <div className="min-w-0">
        <div className="flex items-center gap-2"><Kicker r={r} className="text-[11px]" /><span className="text-[11px] text-muted-foreground">· {ago(r.generated_at)}</span></div>
        <div className="mt-0.5 text-[18px] font-extrabold leading-snug group-hover:underline">{title(r)}</div>
        {r.lede && <p className="mt-1 line-clamp-2 font-serif text-[14px] leading-relaxed text-muted-foreground">{r.lede}</p>}
      </div>
    </Link>
  )
}

// The news desk's stories, newest first: four picture cards, then the rest as a list.
function NewsBand({ stories }) {
  if (!stories?.length) return null
  const cards = stories.slice(0, 4)
  const more = stories.slice(4, 10)
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-[19px] font-extrabold italic uppercase tracking-tight">News</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((n) => (
          <Link key={n.slug} to={newsHref(n.slug)} className="group flex flex-col">
            <NewsArt story={n} className="h-[150px] shrink-0 rounded-lg" />
            <div className="mt-2 font-display text-[11px] font-extrabold italic uppercase tracking-wide text-primary">
              {KIND_LABEL[n.kind] || 'News'} <span className="text-muted-foreground">· {ago(n.published_at)}</span>
            </div>
            <div className="mt-0.5 line-clamp-3 text-[15px] font-extrabold leading-snug group-hover:underline">{n.title}</div>
            {n.dek && <p className="mt-1 line-clamp-2 font-serif text-[13px] leading-relaxed text-muted-foreground">{n.dek}</p>}
          </Link>
        ))}
      </div>
      {more.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-x-6 border-t border-border sm:grid-cols-2">
          {more.map((n) => (
            <Link key={n.slug} to={newsHref(n.slug)} className="group flex items-baseline gap-2 border-b border-border/70 py-2.5">
              <span className="shrink-0 font-display text-[10.5px] font-extrabold italic uppercase tracking-wide text-primary">{KIND_LABEL[n.kind] || 'News'}</span>
              <span className="truncate text-[13.5px] font-bold group-hover:underline">{n.title}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{ago(n.published_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default function ArticlesPage() {
  const [rows, setRows] = useState(() => peekCached(PATH))
  const [events, setEvents] = useState(() => peekCached('/ufc/upcoming') || [])
  const [q, setQ] = useState('')
  const [news, setNews] = useState(() => peekCached('/ufc/news?limit=30') || [])

  useEffect(() => {
    let live = true
    fetchPreviews({ limit: 120 }).then((r) => live && setRows(r || [])).catch(() => live && setRows([]))
    fetchNews(30).then((n) => live && setNews(n || [])).catch(() => {})
    fetchUpcomingEvents().then((e) => live && setEvents(e || [])).catch(() => {})
    return () => { live = false }
  }, [])

  // This week's card first, then later cards, then past ones (most recent first);
  // within a card, main event first.
  const ordered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return (rows || []).slice().sort((a, b) => {
      const da = a.event_date || ''
      const db = b.event_date || ''
      const ua = da >= today
      const ub = db >= today
      if (ua !== ub) return ua ? -1 : 1
      return (ua ? da.localeCompare(db) : db.localeCompare(da)) || (a.card_position ?? 99) - (b.card_position ?? 99)
    })
  }, [rows])

  if (!rows) return <PageLoader />

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const hits = searching
    ? ordered.filter((r) => words.every((w) => `${r.headline} ${r.red_name} ${r.blue_name} ${r.event_name}`.toLowerCase().includes(w)))
    : []

  const next = events[0]
  const nextRows = next ? ordered.filter((r) => r.event_name === next.name) : []
  // Lead and headlines: previews and news ranked together; with nothing current, the
  // newest card's main event leads.
  const ranked = rankFront(ordered, news || []).filter((e) => e.score > 0)
  const top = ranked.length ? ranked : ordered.slice(0, 1).map((r) => ({ type: 'preview', item: r }))
  const leadEntry = top[0]
  const lead = leadEntry.type === 'preview' ? leadEntry.item : null
  const topPreviews = new Set(top.filter((e) => e.type === 'preview').map((e) => e.item))
  const headEntries = [...top.slice(1, 8), ...ordered.filter((r) => !topPreviews.has(r)).map((r) => ({ type: 'preview', item: r }))].slice(0, 7)
  const headlines = headEntries.filter((e) => e.type === 'preview').map((e) => e.item)
  const pool = ordered.filter((r) => r !== lead && !headlines.includes(r))
  const cards = pool.slice(0, 4)
  const shown = new Set([lead, ...headlines, ...cards].filter(Boolean).map((r) => r.fight_id))
  const newsBand = (news || []).filter((n) => !(leadEntry.type === 'news' && leadEntry.item === n))
  const week = nextRows.filter((r) => r !== lead && !cards.includes(r))
  const latest = ordered.filter((r) => !shown.has(r.fight_id) && !week.slice(0, 4).includes(r))

  return (
    <div className="h-full overflow-y-auto pb-6 pr-1">
      <div className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3">
        <h1 className="page-title">Articles</h1>
        <div className="relative ml-auto w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles"
            className="h-9 w-full rounded-md border border-border bg-muted/40 pl-8 pr-3 text-[13px] outline-none focus:border-primary/50 focus:bg-background" />
        </div>
      </div>

      {!ordered.length ? (
        <p className="py-16 text-center text-muted-foreground">No articles yet.</p>
      ) : searching ? (
        <div className="rounded-xl border border-border bg-card px-5">
          {hits.length ? <div className="divide-y divide-border/70">{hits.map((r) => <LatestRow key={r.fight_id} r={r} />)}</div>
            : <p className="py-10 text-center text-muted-foreground">No articles match.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <TopStory entry={leadEntry} />
            <Headlines entries={headEntries} />
          </div>
          <NewsBand stories={newsBand} />
          {cards.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {cards.map((r) => <StoryCard key={r.fight_id} r={r} />)}
            </div>
          )}
          <FightWeek event={next} rows={week} />
          {latest.length > 0 && (
            <section className="rounded-xl border border-border bg-card px-5 pt-4">
              <h2 className="border-b border-border pb-2 font-display text-[19px] font-extrabold italic uppercase tracking-tight">Latest</h2>
              <div className="divide-y divide-border/70">{latest.map((r) => <LatestRow key={r.fight_id} r={r} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

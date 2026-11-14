// /ufc/news/:slug: one news story, in the format its subject calls for:
//   profile   one fighter: their profile beside the story
//   pair      two fighters in the same story: one profile with a switcher between them
//   matchup   two fighters set against each other (rumored fight, booking, callout,
//             trash talk): both in the header, a tale of the tape, run the matchup
//   group     three or more: the fighters in a row under the headline, the switcher
// Trash talk and things said at press conferences lead with the line itself.
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArticleBody } from '../components/articles/article'
import { parseArticle } from '../components/articles/articleText'
import { Byline } from '../components/articles/embeds'
import { BackButton } from '../components/articles/header'
import NewsArt from '../components/news/NewsArt'
import NewsBar from '../components/news/NewsBar'
import { DuoCard, FighterSwitcher, ProfileCard } from '../components/news/NewsFighters'
import { KIND_LABEL } from '../components/news/newsText'
import PageLoader from '../components/PageLoader'
import { fetchNewsStory, peekCached } from '../lib/api'
import { formatDate } from '../lib/utils'

const QUOTE_LED = new Set(['trash_talk', 'press_conference'])

// The story's first pull quote, for a quote-led header (and the body without it).
function leadQuote(body) {
  const m = body.match(/```chin-quote\n([\s\S]*?)```/)
  if (!m) return { quote: null, body }
  const lines = m[1].split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { quote: null, body }
  const [speaker, source] = lines[lines.length - 1].split('|').map((x) => x.trim())
  return { quote: { text: lines.slice(0, -1).join(' '), speaker, source }, body: body.replace(m[0], '').trim() }
}

function Header({ story, title, quote }) {
  return (
    <header data-article-header className="relative overflow-hidden rounded-xl">
      <NewsArt story={story} className={quote ? 'h-[380px] sm:h-[460px]' : 'h-[300px] sm:h-[400px]'} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-white sm:px-8 sm:pb-8">
        <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider">{KIND_LABEL[story.kind] || 'News'}</span>
        {quote ? (
          <>
            <blockquote className="mt-3 max-w-[900px] font-serif text-[26px] italic leading-snug sm:text-[36px]">“{quote.text}”</blockquote>
            <div className="mt-2 text-[12px] font-bold uppercase tracking-wider text-white/80">{quote.speaker}</div>
            <h1 className="mt-4 max-w-[900px] text-[20px] font-extrabold leading-tight tracking-tight sm:text-[24px]">{title}</h1>
          </>
        ) : (
          <h1 className="mt-2 max-w-[900px] text-[30px] font-extrabold leading-[1.06] tracking-tight sm:text-[44px]">{title}</h1>
        )}
      </div>
      {story.image?.source && (
        <a href={story.image.page} target="_blank" rel="noreferrer"
          className="absolute bottom-2 right-3 text-[10px] text-white/50 hover:text-white">Photo: {story.image.source}</a>
      )}
    </header>
  )
}

function Sidebar({ story }) {
  const fs = story.fighters || []
  if (!fs.length) return null
  if (fs.length === 2) {
    // Already booked against each other: the fight's preview. Otherwise, for a matchup
    // story, run it on the hypothetical page.
    const booked = fs[0].next?.fight_id && fs[0].next.fight_id === fs[1].next?.fight_id ? fs[0].next.fight_id : null
    const cta = 'flex shrink-0 items-center justify-center gap-1.5 bg-primary py-2.5 text-[12.5px] font-bold text-white hover:bg-primary/90'
    return (
      <DuoCard fighters={fs} className="xl:h-full">
        {booked ? (
          <Link to={`/ufc/fights/${booked}/preview`} className={cta}>View full preview <ArrowRight className="h-4 w-4" /></Link>
        ) : story.layout === 'matchup' && (
          <Link to={`/ufc/hypothetical?red=${fs[0].id}&blue=${fs[1].id}`} className={cta}>Run this matchup <ArrowRight className="h-4 w-4" /></Link>
        )}
      </DuoCard>
    )
  }
  if (fs.length > 2) return <FighterSwitcher fighters={fs.slice(0, 6)} className="xl:h-full" />
  return <ProfileCard f={fs[0]} className="xl:h-full" />
}

export default function NewsStoryPage() {
  const { slug } = useParams()
  const [state, setState] = useState(() => ({ slug, story: peekCached(`/ufc/news/${slug}`) }))
  useEffect(() => {
    let live = true
    fetchNewsStory(slug).then((s) => live && setState({ slug, story: s })).catch(() => live && setState({ slug, story: false }))
    return () => { live = false }
  }, [slug])
  const story = state.slug === slug ? state.story : null
  if (story == null) return <PageLoader />
  if (story === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">This story isn't available.</p>
        <Link to="/ufc/articles" className="text-sm text-primary hover:underline">Back to articles</Link>
      </div>
    )
  }

  const art = parseArticle(story.content || '')
  const title = art.title || story.title
  const { quote, body } = QUOTE_LED.has(story.kind) ? leadQuote(art.body) : { quote: null, body: art.body }
  const [a, b] = story.fighters || []
  const minutes = Math.max(1, Math.round((story.content || '').split(/\s+/).length / 230))
  return (
    <div className="relative h-full overflow-y-auto pb-6 pr-1">
      <NewsBar story={story} title={title} />
      <BackButton className="absolute left-3 top-3 z-20" />
      <div className="space-y-5">
        <Header story={story} title={title} quote={quote} />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
            {art.dek && <p className="font-serif text-[19px] leading-relaxed text-foreground">{art.dek}</p>}
            <div className="mt-4 border-t border-border pt-3">
              <Byline written={formatDate(String(story.published_at || '').slice(0, 10))} minutes={minutes} />
            </div>
            <ArticleBody body={body} red={a} blue={b} className="mt-5" />
          </article>
          {/* Never taller than the page: on wide screens it stays in view and scrolls on its own. */}
          {/* Exactly the height of the screen on wide screens. A single profile fills it and
              scrolls inside its own toggle; stacked cards scroll the column. */}
          <aside className="space-y-4 self-start xl:sticky xl:top-[64px] xl:h-[calc(100vh-96px)]">
            <Sidebar story={story} />
          </aside>
        </div>
      </div>
    </div>
  )
}

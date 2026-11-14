// Article layouts, so a card's articles do not all look alike. The newsroom picks one per
// article (fight.preview.layout, overridable in the admin dashboard); without one the page
// falls back on card position.
//
//   feature   main event, co-main, title fights: dark matchup banner, tabbed data panel
//   standard  a classic news header with a wide image, numbers in the sidebar
//   rivalry   rematches and grudge matches: split face-off hero, the history up top
//   magazine  a long read: full-bleed cover, one narrow column, big pull quotes
//   data      when the model and the market disagree: model vs market leads the page
//   brief     prelims: one compact card
import { Link } from 'react-router-dom'
import { ArticleArt, ArticleBody, History, Takeaways } from './article'
import { FaceOff } from './header'
import { extractTakeaways } from './articleText'
import { Byline, LineMovement, MarketsPanel, MatchupBox, MatchupCard, ModelBar } from './embeds'
import { eventShort, isTitle, lastName, marketRedProb, topMethod, weightLabel } from './fightText'
import FighterImage from '../sports/FighterImage'
import { cn, formatDate } from '../../lib/utils'

function FeatureLayout({ fight, ctx, art, radar, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <div className="space-y-5">
      <FaceOff fight={fight} art={art} meetings={meetings} ctx={ctx} tint={false} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          {art.dek && <p className="font-serif text-[19px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4 border-t border-border pt-3"><Byline written={written} minutes={minutes} /></div>
          <Takeaways items={takeaways} />
          {fight.article_image && (
            <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} className="mb-6 h-[340px] rounded-lg" />
          )}
          <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} className="mt-5" />
        </article>
        <Sidebar fight={fight} radar={radar} className="xl:sticky xl:top-[76px]" />
      </div>
    </div>
  )
}

function StandardLayout({ fight, art, radar, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="space-y-5">
      <header data-article-header className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="px-5 pb-5 pt-6 sm:px-8">
          <div className="pl-8 text-[11.5px] text-muted-foreground">
            <Link to="/ufc/articles" className="hover:text-primary">Articles</Link> › {eventShort(event?.name)} › Preview
          </div>
          <div className="mt-2 font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary">
            {eventShort(event?.name)} preview · {art.matchup}
          </div>
          <h1 className="mt-1 text-[30px] font-extrabold sm:text-[40px] leading-[1.06] tracking-tight">{art.title}</h1>
          {art.dek && <p className="mt-3 max-w-[75ch] font-serif text-[18px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4"><Byline written={written} minutes={minutes} /></div>
        </div>
        <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} className="h-[240px] sm:h-[380px]" />
      </header>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          <ArticleBody body={art.body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} />
        </article>
        <Sidebar fight={fight} radar={radar} className="xl:sticky xl:top-[76px]"><MatchupCard fight={fight} /></Sidebar>
      </div>
    </div>
  )
}

// The model's pick as a card over the cover: who, how likely, and the likeliest finish.
function PickCard({ fight }) {
  const p = fight.prediction?.red_prob
  if (p == null) return null
  const red = p >= 0.5
  const pick = red ? fight.red_fighter : fight.blue_fighter
  return (
    <div className="w-[260px] shrink-0 rounded-xl bg-black/55 p-3.5 backdrop-blur">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">Model pick</div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-[30px] font-extrabold italic uppercase leading-none">{lastName(pick)}</span>
        <span className={cn('font-display text-[26px] font-extrabold italic tabular-nums', red ? 'text-corner-red' : 'text-corner-blue')}>{Math.round((red ? p : 1 - p) * 100)}%</span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full bg-corner-red" style={{ width: `${p * 100}%` }} />
        <div className="h-full flex-1 bg-corner-blue" />
      </div>
      {topMethod(fight.method_prediction) && <div className="mt-1.5 text-[11px] text-white/70">Likeliest: {topMethod(fight.method_prediction)}</div>}
    </div>
  )
}

// Model vs market for the pick, as two big numbers and the gap between them.
function EdgeHero({ fight }) {
  const p = fight.prediction?.red_prob
  const m = marketRedProb(fight)
  if (p == null) return null
  const redPick = p >= 0.5
  const pick = redPick ? fight.red_fighter : fight.blue_fighter
  const model = (redPick ? p : 1 - p) * 100
  const market = m == null ? null : (redPick ? m : 1 - m) * 100
  const tone = redPick ? 'text-corner-red' : 'text-corner-blue'
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-3">
      {[[`Model: ${lastName(pick)}`, `${model.toFixed(1)}%`, tone],
        ['Market', market == null ? '–' : `${market.toFixed(1)}%`, 'text-white'],
        ['Edge', market == null ? '–' : `${model - market >= 0 ? '+' : ''}${(model - market).toFixed(1)}`, 'text-emerald-400']]
        .map(([label, value, cls], k) => (
          <div key={label} className={cn('bg-ink px-4 py-3', k === 2 && 'col-span-2 sm:col-span-1')}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
            <div className={cn('font-display text-[40px] font-extrabold italic leading-none tabular-nums sm:text-[48px]', cls)}>{value}</div>
          </div>
        ))}
    </div>
  )
}

function RivalryLayout({ fight, ctx, radar, art, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue } = fight
  const rematch = meetings?.length > 0
  return (
    <div className="space-y-5">
      <FaceOff fight={fight} art={art} meetings={meetings} ctx={ctx} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          {art.dek && <p className="font-serif text-[19px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4 border-t border-border pt-3"><Byline written={written} minutes={minutes} /></div>
          {rematch && !/```chin-history/.test(art.body) && <History meetings={meetings} red={red} blue={blue} />}
          <ArticleBody body={art.body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} className="mt-5" />
        </article>
        <Sidebar fight={fight} radar={radar} className="xl:sticky xl:top-[76px]" />
      </div>
    </div>
  )
}

function MagazineLayout({ fight, radar, art, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="space-y-6">
      <header data-article-header className="relative overflow-hidden rounded-xl">
        <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} dark className="h-[300px] sm:h-[420px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-x-8 gap-y-4 px-5 pb-6 text-white sm:px-8 sm:pb-8">
          <div className="min-w-0 max-w-[820px] flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider">
              <span className="rounded bg-primary px-1.5 py-0.5">{art.matchup}</span>
              <span className="rounded bg-white/15 px-1.5 py-0.5">{event?.name} · {formatDate(event?.date)}</span>
            </div>
            <h1 className="mt-2 text-[32px] font-extrabold leading-[1.04] tracking-tight sm:text-[48px]">{art.title}</h1>
          </div>
          <PickCard fight={fight} />
        </div>
      </header>
      {/* The long read keeps its narrow column; the numbers sit to its left. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Sidebar fight={fight} radar={radar} className="order-2 xl:sticky xl:top-[76px] xl:order-1" />
        <article className="order-1 mx-auto w-full max-w-[700px] px-1 xl:order-2 xl:mx-0">
          {art.dek && <p className="font-serif text-[20px] leading-relaxed text-foreground first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-[64px] first-letter:font-extrabold first-letter:leading-[0.85] first-letter:text-primary">{art.dek}</p>}
          <div className="mt-5 border-y border-border py-3"><Byline written={written} minutes={minutes} /></div>
          <ArticleBody body={art.body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings}
            quoteSize="lg" className="mt-5 text-[17.5px]" />
        </article>
      </div>
    </div>
  )
}

function DataLayout({ fight, art, radar, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <div className="space-y-5">
      <div data-article-header className="overflow-hidden rounded-xl bg-ink p-4 text-white sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 pl-9 text-[10px] font-extrabold uppercase tracking-wider">
          <span className="rounded bg-primary px-1.5 py-0.5">By the numbers</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5">{eventShort(event?.name)} · {formatDate(event?.date)}</span>
          {isTitle(fight.weight_class) && <span className="rounded bg-gold px-1.5 py-0.5 text-ink">{weightLabel(fight.weight_class)} title</span>}
        </div>
        <div className="grid gap-5 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
          <div className="space-y-4">
            <div className="font-display text-[13px] font-extrabold italic uppercase tracking-wide text-white/70">{art.matchup}</div>
            <h1 className="text-[30px] font-extrabold leading-[1.06] tracking-tight sm:text-[40px]">{art.title}</h1>
            <EdgeHero fight={fight} />
          </div>
          <div className="rounded-lg bg-white p-3 text-foreground empty:hidden"><LineMovement fight={fight} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          {art.dek && <p className="font-serif text-[18px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4 border-t border-border pt-3"><Byline written={written} minutes={minutes} /></div>
          <Takeaways items={takeaways} />
          <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} className="mt-5" />
        </article>
        <Sidebar fight={fight} radar={radar} className="xl:sticky xl:top-[76px]" />
      </div>
    </div>
  )
}

function BriefLayout({ fight, radar, art, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex min-h-[48px] flex-wrap items-center gap-x-3 gap-y-0.5 bg-ink py-2 pl-14 pr-4 text-[11px] text-white/80 sm:pr-6">
        <b className="font-display text-[13px] italic uppercase text-white">{event?.name}</b>
        <span>{weightLabel(fight.weight_class)}</span>
        {event?.date && <span className="ml-auto">{formatDate(event.date)}</span>}
      </div>
      <div data-article-header className="grid grid-cols-[72px_1fr_72px] items-center gap-3 border-b border-border px-4 py-3 sm:grid-cols-[96px_1fr_96px] sm:px-6">
        {[red, blue].map((f, k) => (
          <div key={k} className={cn('relative h-[72px] overflow-hidden rounded-lg bg-muted/50 sm:h-[96px]', k ? 'order-3' : 'order-1')}>
            <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[115%] w-auto max-w-none object-top" />
          </div>
        ))}
        <div className="order-2">
          <div className="mb-1 flex justify-between font-display text-[18px] font-extrabold italic uppercase leading-none sm:text-[22px]">
            <span>{lastName(red)}</span><span>{lastName(blue)}</span>
          </div>
          <ModelBar fight={fight} names={false} />
        </div>
      </div>
      <div className="px-5 py-6 sm:px-8">
        <div className="text-[11.5px] text-muted-foreground"><Link to="/ufc/articles" className="hover:text-primary">Articles</Link> › Prelims</div>
        <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-[32px]">{art.title}</h1>
        {art.dek && <p className="mt-2 font-serif text-[17px] leading-relaxed text-muted-foreground">{art.dek}</p>}
        <div className="mt-3"><Byline written={written} minutes={minutes} /></div>
        <Takeaways items={takeaways} />
        <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} className="mt-5" />
      </div>
    </article>
    <Sidebar fight={fight} radar={radar} />
    </div>
  )
}

// The numbers beside every article, in one order: the tape (with the skill radar behind
// its toggle), then the markets.
function Sidebar({ fight, radar, className, children }) {
  return (
    <aside className={cn('space-y-4 self-start', className)}>
      {children}
      <MatchupBox fight={fight} radar={radar} />
      <MarketsPanel fight={fight} />
    </aside>
  )
}

const LAYOUTS = {
  feature: FeatureLayout, standard: StandardLayout, rivalry: RivalryLayout,
  magazine: MagazineLayout, data: DataLayout, brief: BriefLayout,
}

export function ArticleLayout({ kind, ...props }) {
  const Layout = LAYOUTS[kind] || StandardLayout
  return <Layout {...props} />
}

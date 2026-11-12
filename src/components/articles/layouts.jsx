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
import { extractTakeaways } from './articleText'
import { Byline, LineMovement, MatchupCard, MethodsPanel, ModelBar, OddsTable, Panel, RadarPanel, Tabs, TaleOfTape } from './embeds'
import { eventShort, isTitle, lastName, marketRedProb, record, weightLabel } from './fightText'
import FighterImage from '../sports/FighterImage'
import { CORNERS } from '../fight/corners'
import { cn, formatDate } from '../../lib/utils'

function FeatureLayout({ fight, art, radar, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <div className="space-y-5">
      {/* Matchup banner */}
      <div className="relative grid grid-cols-2 overflow-hidden rounded-xl bg-ink text-white sm:h-[210px] sm:grid-cols-[minmax(0,220px)_1fr_minmax(0,220px)]">
        {[red, blue].map((f, k) => (
          <div key={k} className={cn('relative h-[170px] overflow-hidden sm:h-auto', k ? 'order-2 sm:order-3' : 'order-1')}>
            <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[120%] w-auto max-w-none object-top" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
            <div className={cn('absolute bottom-3 px-4', k ? 'right-0 text-right' : 'left-0')}>
              <div className="text-[10.5px] text-white/70">{record(f)}</div>
              <div className="font-display text-[26px] font-extrabold italic uppercase leading-none tracking-tight">{lastName(f)}</div>
            </div>
          </div>
        ))}
        <div className="order-3 col-span-2 flex flex-col items-center justify-center px-6 py-4 sm:order-2 sm:col-span-1 sm:py-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
            <span className="rounded bg-primary px-1.5 py-0.5">{eventShort(event?.name)} · {formatDate(event?.date)}</span>
            {isTitle(fight.weight_class) && <span className="rounded bg-gold px-1.5 py-0.5 text-ink">{weightLabel(fight.weight_class)} title</span>}
          </div>
          <div className="w-full max-w-[340px] [&_.text-muted-foreground]:text-white/60"><ModelBar fight={fight} size="lg" /></div>
          <Link to={`/ufc/fights/${fight.id}`} className="mt-3 rounded-md border border-white/25 px-3 py-1 text-[12px] font-semibold hover:bg-white/10">Full fight page</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          <div className="font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary">{eventShort(event?.name)} preview</div>
          <h1 className="mt-1 text-[30px] font-extrabold sm:text-[38px] leading-[1.08] tracking-tight">{art.title}</h1>
          {art.dek && <p className="mt-3 font-serif text-[18px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4 border-t border-border pt-3"><Byline written={written} minutes={minutes} /></div>
          <Takeaways items={takeaways} />
          {fight.article_image && (
            <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} className="mb-6 h-[340px] rounded-lg" />
          )}
          <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} />
        </article>
        <aside className="space-y-4 self-start xl:sticky xl:top-0">
          <Tabs tabs={[
            ...(radar?.length ? [{ label: 'Radar', node: <RadarPanel series={radar} /> }] : []),
            { label: 'Odds', node: <OddsTable fight={fight} /> },
            { label: 'Methods', node: <MethodsPanel fight={fight} /> },
          ]} />
          <LineMovement fight={fight} />
          <TaleOfTape fight={fight} />
        </aside>
      </div>
    </div>
  )
}

function StandardLayout({ fight, art, radar, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="px-5 pb-5 pt-6 sm:px-8">
          <div className="text-[11.5px] text-muted-foreground">
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
        <aside className="space-y-4 self-start xl:sticky xl:top-0">
          <MatchupCard fight={fight} />
          {radar?.length > 0 && <Panel title="Skill profile"><RadarPanel series={radar} /></Panel>}
          <Panel title="Odds by book"><OddsTable fight={fight} /></Panel>
          <TaleOfTape fight={fight} />
        </aside>
      </div>
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

function RivalryLayout({ fight, art, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const rematch = meetings?.length > 0
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-xl bg-ink text-white">
        <div className="absolute inset-0 grid grid-cols-2">
          <div style={{ background: `linear-gradient(110deg, ${CORNERS[0].css} -40%, transparent 70%)` }} />
          <div style={{ background: `linear-gradient(250deg, ${CORNERS[1].css} -40%, transparent 70%)` }} />
        </div>
        <div className="relative grid h-[230px] grid-cols-2 sm:h-[300px]">
          {[red, blue].map((f, k) => (
            <div key={k} className="relative overflow-hidden">
              <FighterImage fighter={f} fit="contain" className={cn('absolute inset-0 flex items-end', k ? 'justify-start' : 'justify-end')}
                imgClassName={cn('h-[118%] w-auto max-w-none object-top', !k && '-scale-x-100')} />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
              <div className={cn('absolute bottom-3 px-4 sm:bottom-5 sm:px-6', k ? 'right-0 text-right' : 'left-0')}>
                <div className="text-[11px] text-white/70">{record(f)}</div>
                <div className="font-display text-[30px] font-extrabold italic uppercase leading-none tracking-tight sm:text-[44px]">{lastName(f)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[54px] font-extrabold italic leading-none text-white/90 sm:text-[84px]">
          {rematch ? `${meetings.length + 1}` : 'VS'}
        </div>
        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 gap-2 text-[10px] font-extrabold uppercase tracking-wider">
          <span className="rounded bg-primary px-1.5 py-0.5">{rematch ? 'Rematch' : 'Grudge match'}</span>
          <span className="rounded bg-white/15 px-1.5 py-0.5">{eventShort(event?.name)} · {formatDate(event?.date)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-7">
          <div className="font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary">{art.matchup}</div>
          <h1 className="mt-1 text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[40px]">{art.title}</h1>
          {art.dek && <p className="mt-3 font-serif text-[18px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4 border-t border-border pt-3"><Byline written={written} minutes={minutes} /></div>
          {rematch && !/```chin-history/.test(art.body) && <History meetings={meetings} red={red} blue={blue} />}
          <ArticleBody body={art.body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} />
        </article>
        <aside className="space-y-4 self-start xl:sticky xl:top-0">
          <Panel><ModelBar fight={fight} size="lg" /></Panel>
          <LineMovement fight={fight} />
          <Tabs tabs={[{ label: 'Methods', node: <MethodsPanel fight={fight} /> }, { label: 'Odds', node: <OddsTable fight={fight} /> }]} />
          <TaleOfTape fight={fight} />
        </aside>
      </div>
    </div>
  )
}

function MagazineLayout({ fight, art, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-xl">
        <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} dark className="h-[340px] sm:h-[480px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[760px] px-5 pb-6 text-white sm:pb-9">
          <div className="font-display text-[12px] font-extrabold italic uppercase tracking-wider text-primary">{eventShort(event?.name)} · {art.matchup}</div>
          <h1 className="mt-1 text-[32px] font-extrabold leading-[1.04] tracking-tight sm:text-[50px]">{art.title}</h1>
        </div>
      </header>
      <article className="mx-auto max-w-[700px] px-1">
        {art.dek && <p className="font-serif text-[20px] leading-relaxed text-foreground first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-[64px] first-letter:font-extrabold first-letter:leading-[0.85] first-letter:text-primary">{art.dek}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
          <Byline written={written} minutes={minutes} />
          <div className="w-full max-w-[280px]"><ModelBar fight={fight} /></div>
        </div>
        <ArticleBody body={art.body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings}
          quoteSize="lg" className="mt-2 text-[17.5px]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Panel title="How it ends"><MethodsPanel fight={fight} /></Panel>
          <TaleOfTape fight={fight} />
        </div>
      </article>
    </div>
  )
}

function DataLayout({ fight, art, radar, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl bg-ink p-4 text-white sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
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
          <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} />
        </article>
        <aside className="space-y-4 self-start xl:sticky xl:top-0">
          <Panel title="How it ends"><MethodsPanel fight={fight} /></Panel>
          <Panel title="Odds by book"><OddsTable fight={fight} /></Panel>
          {radar?.length > 0 && <Panel title="Skill profile"><RadarPanel series={radar} /></Panel>}
        </aside>
      </div>
    </div>
  )
}

function BriefLayout({ fight, art, written, minutes, media, meetings }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <article className="mx-auto max-w-[780px] overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 bg-ink px-4 py-2 text-[11px] text-white/80 sm:px-6">
        <b className="font-display italic text-primary">{eventShort(event?.name)}</b>
        <span>{weightLabel(fight.weight_class)}</span>
        {event?.date && <span className="ml-auto">{formatDate(event.date)}</span>}
      </div>
      <div className="grid grid-cols-[72px_1fr_72px] items-center gap-3 border-b border-border px-4 py-3 sm:grid-cols-[96px_1fr_96px] sm:px-6">
        {[red, blue].map((f, k) => (
          <div key={k} className={cn('relative h-[72px] overflow-hidden rounded-lg bg-muted/50 sm:h-[96px]', k ? 'order-3' : 'order-1')}>
            <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[115%] w-auto max-w-none object-top" />
          </div>
        ))}
        <div className="order-2">
          <div className="mb-1 flex justify-between font-display text-[18px] font-extrabold italic uppercase leading-none sm:text-[22px]">
            <span>{lastName(red)}</span><span>{lastName(blue)}</span>
          </div>
          <ModelBar fight={fight} />
        </div>
      </div>
      <div className="px-5 py-6 sm:px-8">
        <div className="text-[11.5px] text-muted-foreground"><Link to="/ufc/articles" className="hover:text-primary">Articles</Link> › Prelims</div>
        <h1 className="mt-1 text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-[32px]">{art.title}</h1>
        {art.dek && <p className="mt-2 font-serif text-[17px] leading-relaxed text-muted-foreground">{art.dek}</p>}
        <div className="mt-3"><Byline written={written} minutes={minutes} /></div>
        <Takeaways items={takeaways} />
        <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} fight={fight} meetings={meetings} />
        <div className="mt-6"><TaleOfTape fight={fight} /></div>
      </div>
    </article>
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

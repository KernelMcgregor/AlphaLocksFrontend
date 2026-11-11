// /ufc/fights/:id/preview: one article, beside the numbers behind it.
//
// Two layouts so a card's articles don't all look alike:
//   feature  (main event, co-main, title fights): a dark matchup banner across the top,
//            the short-version box and art inside the article, a tabbed data panel.
//   standard (everyone else): a classic news header with a wide image, then the body
//            beside a matchup card, radar, odds and tale of the tape.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArticleArt, ArticleBody, Takeaways } from '../components/articles/article'
import { extractTakeaways, parseArticle } from '../components/articles/articleText'
import CountryFlag from '../components/CountryFlag'
import PageLoader from '../components/PageLoader'
import FighterImage from '../components/sports/FighterImage'
import BeltIcon from '../components/ui/belt-icon'
import MarketMovement from '../components/viz/MarketMovement'
import RadarChart from '../components/viz/RadarChart'
import { CORNERS } from '../components/fight/corners'
import { fetchArticleMedia, fetchFight, fetchFightContext, fetchMarketHistory, peekCached } from '../lib/api'
import { AXES } from '../lib/fighterAnalytics'
import { cn, formatDate, formatOdds } from '../lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const lastName = (f) => f?.last_name || 'TBA'
const record = (f) => (f ? `${f.wins ?? 0}-${f.losses ?? 0}${f.draws ? `-${f.draws}` : ''}` : '')
const isTitle = (wc = '') => /title/i.test(wc)
const weightLabel = (wc = '') => wc.replace(/^UFC\s+/i, '').replace(/\s*(Title\s*)?Bout$/i, '').replace(/\s*Title$/i, '').trim()
const eventShort = (name = '') => {
  const k = name.split(':')[0].trim()
  return /^UFC\s+\d+/i.test(k) ? k : 'Fight Night'
}
const age = (dob) => (dob ? Math.floor((Date.now() - Date.parse(dob)) / 3.15576e10) : null)
const val = (v) => (v && v !== '--' ? v : '–')
// Best price per corner across books (highest payout).
function bestOdds(odds = []) {
  const best = (k) => odds.map((o) => o[k]).filter((x) => x != null).reduce((a, b) => (a == null || b > a ? b : a), null)
  return { red: best('red_odds'), blue: best('blue_odds') }
}
const topMethod = (mp) => {
  if (!mp) return null
  const [label, p] = [['KO/TKO', mp.ko_prob], ['Submission', mp.sub_prob], ['Decision', mp.dec_prob]].sort((a, b) => b[1] - a[1])[0]
  return `${label} ${Math.round(p * 100)}%`
}

function Panel({ title, right, children, className }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      {title && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="font-display text-[16px] font-extrabold italic uppercase tracking-tight">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

function Byline({ written, minutes }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px] text-muted-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white">KM</span>
      <div className="leading-tight">
        <div className="font-bold text-foreground">KernelMcGregor</div>
        <div>{written} · {minutes} min read</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar pieces
// ---------------------------------------------------------------------------
function ModelBar({ fight, size = 'md' }) {
  const p = fight.prediction?.red_prob
  if (p == null) return null
  const r = Math.round(p * 100)
  const odds = bestOdds(fight.odds)
  return (
    <div>
      <div className={cn('flex items-baseline justify-between font-display font-extrabold italic tabular-nums', size === 'lg' ? 'text-[44px] leading-none' : 'text-[22px]')}>
        <span className={r >= 50 ? 'text-corner-red' : 'text-muted-foreground'}>{r}%</span>
        <span className={100 - r > 50 ? 'text-corner-blue' : 'text-muted-foreground'}>{100 - r}%</span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-corner-red" style={{ width: `${r}%` }} />
        <div className="h-full flex-1 bg-corner-blue" />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{odds.red != null ? formatOdds(odds.red) : ''}</span>
        <span>{topMethod(fight.method_prediction) ? `Likeliest: ${topMethod(fight.method_prediction)}` : ''}</span>
        <span>{odds.blue != null ? formatOdds(odds.blue) : ''}</span>
      </div>
    </div>
  )
}

function MatchupCard({ fight }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 bg-ink px-3 py-2 text-[11px] text-white/80">
        <b className="font-display italic text-primary">{eventShort(event?.name)}</b>
        <span>{weightLabel(fight.weight_class)}</span>
        {isTitle(fight.weight_class) && <span className="inline-flex items-center gap-0.5 font-bold text-gold"><BeltIcon className="h-3 w-3" /> Title</span>}
        {event?.date && <span className="ml-auto">{formatDate(event.date)}</span>}
      </div>
      <div className="grid h-[150px] grid-cols-2">
        {[red, blue].map((f, k) => (
          <div key={k} className="relative overflow-hidden bg-muted/40">
            <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[115%] w-auto max-w-none object-top" />
          </div>
        ))}
      </div>
      <div className="h-[3px] bg-ink" />
      <div className="p-3">
        <div className="mb-1 flex items-end justify-between gap-2">
          {[red, blue].map((f, k) => (
            <div key={k} className={cn('min-w-0', k && 'text-right')}>
              <div className={cn('flex items-center gap-1 text-[10.5px] text-muted-foreground', k && 'justify-end')}>
                {!k && <CountryFlag countryCode={f?.country_code} />}{record(f)}{k ? <CountryFlag countryCode={f?.country_code} /> : null}
              </div>
              <div className="font-display text-[22px] font-extrabold italic uppercase leading-none tracking-tight">{lastName(f)}</div>
            </div>
          ))}
        </div>
        <ModelBar fight={fight} />
      </div>
    </div>
  )
}

function useRadar(fightId, red, blue) {
  const [ctx, setCtx] = useState(null)
  useEffect(() => { fetchFightContext(fightId).then(setCtx).catch(() => setCtx({})) }, [fightId])
  return useMemo(() => {
    if (!ctx) return null
    return CORNERS.map((c, i) => {
      const dims = ctx[c.key]?.glicko?.dimensions
      if (!dims || !AXES.some((a) => dims[a.key]?.percentile != null)) return null
      return { key: c.key, label: lastName(i ? blue : red), color: c.css, axes: AXES.map((a) => ({ ...a, value: dims[a.key]?.percentile ?? 0 })) }
    }).filter(Boolean)
  }, [ctx, red, blue])
}

function RadarPanel({ series }) {
  if (!series?.length) return null
  return (
    <div>
      <RadarChart series={series} />
      <div className="mt-1 flex justify-center gap-4 text-[11px] font-semibold text-muted-foreground">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  )
}

function OddsTable({ fight }) {
  const rows = (fight.odds || []).filter((o) => o.red_odds != null && o.blue_odds != null)
  if (!rows.length) return <p className="text-[12px] text-muted-foreground">No odds posted yet.</p>
  const best = bestOdds(rows)
  return (
    <table className="w-full text-[12.5px] tabular-nums">
      <thead>
        <tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
          <th className="pb-1 text-left font-semibold">Book</th>
          <th className="pb-1 text-right font-semibold">{lastName(fight.red_fighter)}</th>
          <th className="pb-1 text-right font-semibold">{lastName(fight.blue_fighter)}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {rows.map((o) => (
          <tr key={o.bookmaker}>
            <td className="py-1">{o.bookmaker}</td>
            <td className={cn('py-1 text-right', o.red_odds === best.red && 'font-extrabold text-emerald-600')}>{formatOdds(o.red_odds)}</td>
            <td className={cn('py-1 text-right', o.blue_odds === best.blue && 'font-extrabold text-emerald-600')}>{formatOdds(o.blue_odds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MethodsPanel({ fight }) {
  const mp = fight.method_prediction
  if (!mp) return <p className="text-[12px] text-muted-foreground">No method prediction yet.</p>
  const rows = [
    [`${lastName(fight.red_fighter)} by KO/TKO`, mp.red_ko_prob, 'bg-corner-red'],
    [`${lastName(fight.red_fighter)} by submission`, mp.red_sub_prob, 'bg-corner-red'],
    [`${lastName(fight.red_fighter)} by decision`, mp.red_dec_prob, 'bg-corner-red'],
    [`${lastName(fight.blue_fighter)} by KO/TKO`, mp.blue_ko_prob, 'bg-corner-blue'],
    [`${lastName(fight.blue_fighter)} by submission`, mp.blue_sub_prob, 'bg-corner-blue'],
    [`${lastName(fight.blue_fighter)} by decision`, mp.blue_dec_prob, 'bg-corner-blue'],
  ].filter((r) => r[1] != null)
  return (
    <div className="space-y-2">
      {rows.map(([label, p, bar]) => (
        <div key={label}>
          <div className="flex justify-between text-[12px]"><span>{label}</span><b className="tabular-nums">{Math.round(p * 100)}%</b></div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', bar)} style={{ width: `${p * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function TaleOfTape({ fight }) {
  const { red_fighter: r, blue_fighter: b } = fight
  const rows = [
    ['Record', record(r), record(b)],
    ['Age', age(r?.dob) ?? '–', age(b?.dob) ?? '–'],
    ['Height', val(r?.height), val(b?.height)],
    ['Reach', val(r?.reach), val(b?.reach)],
    ['Stance', val(r?.stance), val(b?.stance)],
  ]
  return (
    <Panel title="Tale of the tape">
      <div className="divide-y divide-border/60 text-[13px]">
        {rows.map(([label, a, c]) => (
          <div key={label} className="grid grid-cols-[1fr_70px_1fr] items-center py-1.5">
            <span className="text-right font-semibold tabular-nums">{a}</span>
            <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{c}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function LineMovement({ fight }) {
  const [hist, setHist] = useState(null)
  useEffect(() => { fetchMarketHistory(fight.id).then(setHist).catch(() => setHist(null)) }, [fight.id])
  if (!hist || !Object.values(hist).some((v) => Array.isArray(v) && v.length)) return null
  return (
    <Panel title="Line movement">
      <MarketMovement series={hist} modelProb={fight.prediction?.red_prob} redName={lastName(fight.red_fighter)}
        blueName={lastName(fight.blue_fighter)} redCss={CORNERS[0].css} blueCss={CORNERS[1].css} />
    </Panel>
  )
}

function Tabs({ tabs }) {
  const [i, setI] = useState(0)
  return (
    <Panel title="Matchup data">
      <div className="mb-3 flex gap-1 rounded-lg bg-muted p-0.5">
        {tabs.map((t, k) => (
          <button key={t.label} onClick={() => setI(k)}
            className={cn('flex-1 rounded-md py-1 text-[11.5px] font-semibold', k === i ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs[i].node}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
function FeatureLayout({ fight, art, radar, written, minutes, media }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const { items: takeaways, body } = extractTakeaways(art.body)
  return (
    <div className="space-y-5">
      {/* Matchup banner */}
      <div className="relative grid h-[210px] grid-cols-[220px_1fr_220px] overflow-hidden rounded-xl bg-ink text-white">
        {[red, blue].map((f, k) => (
          <div key={k} className={cn('relative overflow-hidden', k ? 'order-3' : 'order-1')}>
            <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[120%] w-auto max-w-none object-top" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
            <div className={cn('absolute bottom-3 px-4', k ? 'right-0 text-right' : 'left-0')}>
              <div className="text-[10.5px] text-white/70">{record(f)}</div>
              <div className="font-display text-[26px] font-extrabold italic uppercase leading-none tracking-tight">{lastName(f)}</div>
            </div>
          </div>
        ))}
        <div className="order-2 flex flex-col items-center justify-center px-6">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
            <span className="rounded bg-primary px-1.5 py-0.5">{eventShort(event?.name)} · {formatDate(event?.date)}</span>
            {isTitle(fight.weight_class) && <span className="rounded bg-gold px-1.5 py-0.5 text-ink">{weightLabel(fight.weight_class)} title</span>}
          </div>
          <div className="w-full max-w-[340px] [&_.text-muted-foreground]:text-white/60"><ModelBar fight={fight} size="lg" /></div>
          <Link to={`/ufc/fights/${fight.id}`} className="mt-3 rounded-md border border-white/25 px-3 py-1 text-[12px] font-semibold hover:bg-white/10">Full fight page</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-8 py-7">
          <div className="font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary">{eventShort(event?.name)} preview</div>
          <h1 className="mt-1 text-[38px] font-extrabold leading-[1.08] tracking-tight">{art.title}</h1>
          {art.dek && <p className="mt-3 font-serif text-[18px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4 border-t border-border pt-3"><Byline written={written} minutes={minutes} /></div>
          <Takeaways items={takeaways} />
          {fight.article_image && (
            <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} className="mb-6 h-[340px] rounded-lg" />
          )}
          <ArticleBody body={body} red={red} blue={blue} verdict={art.verdict} media={media} />
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

function StandardLayout({ fight, art, radar, written, minutes, media }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="px-8 pb-5 pt-6">
          <div className="text-[11.5px] text-muted-foreground">
            <Link to="/ufc/articles" className="hover:text-primary">Articles</Link> › {eventShort(event?.name)} › Preview
          </div>
          <div className="mt-2 font-display text-[12px] font-extrabold italic uppercase tracking-wide text-primary">
            {eventShort(event?.name)} preview · {art.matchup}
          </div>
          <h1 className="mt-1 text-[40px] font-extrabold leading-[1.06] tracking-tight">{art.title}</h1>
          {art.dek && <p className="mt-3 max-w-[75ch] font-serif text-[18px] leading-relaxed text-muted-foreground">{art.dek}</p>}
          <div className="mt-4"><Byline written={written} minutes={minutes} /></div>
        </div>
        <ArticleArt image={fight.article_image} fightId={fight.id} red={red} blue={blue} className="h-[380px]" />
      </header>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-xl border border-border bg-card px-8 py-7">
          <ArticleBody body={art.body} red={red} blue={blue} verdict={art.verdict} media={media} />
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
  const feature = (fight.card_position != null && fight.card_position <= 1) || isTitle(fight.weight_class)
  const Layout = feature ? FeatureLayout : StandardLayout

  return (
    <div className="h-full overflow-y-auto pb-6 pr-1">
      <Layout fight={fight} art={art} radar={radar} written={written} minutes={minutes} media={media} />
    </div>
  )
}

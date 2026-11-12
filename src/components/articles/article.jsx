// Shared by the Articles index and the article page: a preview's artwork and the blocks the writer can
// drop into the body: charts (```chin-stats```, ```chin-bars```, ```chin-takeaways```), reporting
// (```chin-quote```, ```chin-history```, ```chin-video```, ```chin-tweet```) and live data from the
// fight payload (```chin-movement```, ```chin-odds```, ```chin-methods```, ```chin-model```, ```chin-tape```).
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tweet } from 'react-tweet'
import FighterImage from '../sports/FighterImage'
import { articleImageUrl, articleMediaUrl } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import { takeawayItems } from './articleText'
import { LineMovement, MethodsPanel, ModelBar, OddsTable, Panel, TaleOfTape } from './embeds'

// Artwork: the picked image cropped on its focal point, or the two portraits.
export function ArticleArt({ image, fightId, red, blue, className, dark }) {
  if (image) {
    return (
      <div className={cn('relative overflow-hidden bg-muted', className)}>
        <img src={articleImageUrl(fightId, image.v)} alt="" loading="lazy" className="h-full w-full object-cover"
          style={{ objectPosition: `${image.focal_x * 100}% ${image.focal_y * 100}%` }} />
      </div>
    )
  }
  return (
    <div className={cn('relative flex items-end overflow-hidden', dark ? 'bg-ink' : 'bg-gradient-to-b from-muted to-muted/40', className)}>
      {[red, blue].map((f, k) => (
        <div key={k} className="relative h-full w-1/2">
          <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[110%] w-auto max-w-none object-top" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart blocks
// ---------------------------------------------------------------------------
const TONE = { red: 'text-corner-red', blue: 'text-corner-blue', green: 'text-emerald-600' }

function StatsBlock({ src }) {
  const rows = src.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0])
  return (
    <div className="not-prose my-6 grid overflow-hidden rounded-lg border border-border border-t-2 border-t-primary"
      style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
      {rows.map(([value, label, tone], k) => (
        <div key={k} className={cn('px-4 py-3', k > 0 && 'border-l border-border')}>
          <div className={cn('font-display text-[28px] font-extrabold italic leading-none tabular-nums', TONE[tone] || 'text-foreground')}>{value}</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  )
}

function BarsBlock({ src, red, blue }) {
  const rows = src.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r.length >= 3 && r[0])
  return (
    <div className="not-prose my-6 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="mb-2 grid grid-cols-[28px_1fr_110px_1fr_28px] items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-wider">
        <span className="col-span-2 text-corner-red">{red?.last_name}</span>
        <span />
        <span className="col-span-2 text-right text-corner-blue">{blue?.last_name}</span>
      </div>
      {rows.map(([label, r, b]) => {
        const rv = Number(r) || 0
        const bv = Number(b) || 0
        return (
          <div key={label} className="grid grid-cols-[28px_1fr_110px_1fr_28px] items-center gap-2 py-[3px]">
            <span className="text-right text-[12px] tabular-nums text-muted-foreground">{r}</span>
            <div className="flex h-2 justify-end overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full bg-corner-red', rv < bv && 'opacity-40')} style={{ width: `${rv}%` }} />
            </div>
            <span className="text-center text-[11.5px] font-semibold">{label}</span>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full bg-corner-blue', bv < rv && 'opacity-40')} style={{ width: `${bv}%` }} />
            </div>
            <span className="text-[12px] tabular-nums text-muted-foreground">{b}</span>
          </div>
        )
      })}
    </div>
  )
}

export function Takeaways({ items }) {
  if (!items?.length) return null
  return (
    <div className="not-prose my-6 rounded-r-lg border-l-4 border-primary bg-primary/[0.05] px-4 py-3">
      <div className="mb-1.5 font-display text-[13px] font-extrabold italic uppercase tracking-wide text-primary">The short version</div>
      <ul className="list-disc space-y-1 pl-4 text-[13.5px] leading-snug">
        {items.map((t, k) => <li key={k}>{t}</li>)}
      </ul>
    </div>
  )
}

// ```chin-image``` "id | left|right|center | width%": a picture placed in the text.
// Floated left/right, the paragraphs that follow wrap around it (stacks on phones);
// center runs the full column. Cropped on the focal point set in the admin editor.
function ImageBlock({ src, media }) {
  const [id, align = 'right', width = '42'] = src.split('|').map((x) => x.trim())
  const m = media?.[id]
  const pos = m ? `${m.focal_x * 100}% ${m.focal_y * 100}%` : '50% 35%'
  const w = Math.min(100, Math.max(20, Number(width) || 42))
  const float = align === 'left' ? 'sm:float-left sm:mr-6' : align === 'right' ? 'sm:float-right sm:ml-6' : ''
  return (
    <span className={cn('not-prose mb-4 mt-1 block w-full overflow-hidden rounded-lg', float)}
      style={align === 'center' ? undefined : { width: `min(100%, ${w}%)` }}>
      <img src={articleMediaUrl(id)} alt="" loading="lazy"
        className={cn('block w-full object-cover', align === 'center' ? 'aspect-[16/9]' : 'aspect-[4/3]')}
        style={{ objectPosition: pos }} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Reporting blocks
// ---------------------------------------------------------------------------

// ```chin-quote``` "quote lines…" then "Speaker | Outlet or show | Month YYYY | url". The rule takes the
// speaker's corner colour when the speaker is one of the two fighters.
export function PullQuote({ src, red, blue, size = 'md' }) {
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const [speaker, outlet, when, url] = lines[lines.length - 1].split('|').map((x) => x.trim())
  const quote = lines.slice(0, -1).join(' ').replace(/^["“]|["”]$/g, '')
  const corner = [red, blue].findIndex((f) => f?.last_name && speaker?.includes(f.last_name))
  const source = [outlet, when].filter(Boolean).join(' · ')
  return (
    <figure className={cn('not-prose clear-both my-8 border-l-4 pl-5',
      corner === 0 ? 'border-corner-red' : corner === 1 ? 'border-corner-blue' : 'border-primary',
      size === 'lg' && 'xl:-mx-10 xl:pl-8')}>
      <blockquote className={cn('font-serif italic leading-snug text-foreground', size === 'lg' ? 'text-[28px]' : 'text-[22px]')}>
        “{quote}”
      </blockquote>
      <figcaption className="mt-2 text-[12.5px] text-muted-foreground">
        <span className="font-sans font-bold uppercase tracking-wide text-foreground">{speaker}</span>
        {source && <> · {url ? <a href={url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">{source}</a> : source}</>}
      </figcaption>
    </figure>
  )
}

// ```chin-history```: the earlier meetings between the two, from the fight payload.
export function History({ meetings, red, blue }) {
  if (!meetings?.length) return null
  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-border">
      <div className="bg-ink px-4 py-1.5 font-display text-[12px] font-extrabold italic uppercase tracking-wider text-white">
        {meetings.length > 1 ? 'Previous meetings' : 'Last time'}
      </div>
      <div className="divide-y divide-border">
        {meetings.map((m, k) => {
          const winner = m.winner || ''
          const corner = red && winner.endsWith(red.last_name) ? 'text-corner-red' : blue && winner.endsWith(blue.last_name) ? 'text-corner-blue' : ''
          return (
            <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5 text-[13px] sm:grid-cols-[180px_1fr_auto]">
              <div className="text-muted-foreground">{m.event}<span className="block text-[11.5px]">{formatDate(m.date)}</span></div>
              <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                <b className={corner}>{winner || 'No winner'}</b> <span className="text-muted-foreground">by</span> {m.method}
                {m.details && <span className="block text-[11.5px] text-muted-foreground">{m.details}</span>}
              </div>
              <div className="row-start-1 text-right font-display text-[18px] font-extrabold italic tabular-nums sm:row-start-auto">
                R{m.round} {m.time}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const youtubeId = (url = '') => url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1]

function Video({ src }) {
  const [url, start] = src.split('|').map((x) => x.trim())
  const id = youtubeId(url)
  if (!id) return null
  const t = Number(start) > 0 ? `?start=${Math.round(Number(start))}` : ''
  return (
    <div className="not-prose clear-both my-6 aspect-video overflow-hidden rounded-lg bg-ink">
      <iframe src={`https://www.youtube-nocookie.com/embed/${id}${t}`} title="Video" loading="lazy" className="h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  )
}

function TweetBlock({ src }) {
  const id = src.match(/status\/(\d+)/)?.[1]
  if (!id) return null
  return <div className="not-prose clear-both my-6 flex justify-center [&_.react-tweet-theme]:my-0"><Tweet id={id} /></div>
}

// ---------------------------------------------------------------------------
// Live data blocks (render nothing when the fight payload is missing)
// ---------------------------------------------------------------------------
function DataBlock({ lang, fight }) {
  if (!fight) return null
  const wrap = (node) => <div className="not-prose clear-both my-6">{node}</div>
  if (lang === 'chin-movement') return wrap(<LineMovement fight={fight} />)
  if (lang === 'chin-odds') return wrap(<Panel title="Odds by book"><OddsTable fight={fight} /></Panel>)
  if (lang === 'chin-methods') return wrap(<Panel title="How it ends"><MethodsPanel fight={fight} /></Panel>)
  if (lang === 'chin-model') return wrap(<Panel><ModelBar fight={fight} size="lg" /></Panel>)
  if (lang === 'chin-tape') return wrap(<TaleOfTape fight={fight} />)
  return null
}
const DATA_BLOCKS = new Set(['chin-movement', 'chin-odds', 'chin-methods', 'chin-model', 'chin-tape'])

export function ArticleBody({ body, red, blue, verdict, media, fight, meetings, quoteSize, className }) {
  return (
    <div className={cn('prose prose-neutral max-w-none font-serif text-[16.5px] leading-[1.75] text-foreground/90 prose-headings:font-sans prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-foreground prose-h2:mb-2 prose-h2:mt-8 prose-h2:text-[22px] prose-strong:text-foreground prose-table:block prose-table:overflow-x-auto prose-table:font-sans prose-table:text-[13px] prose-th:text-foreground prose-th:whitespace-nowrap', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const code = Array.isArray(children) ? children[0] : children
            const lang = /language-(chin-[\w-]+)/.exec(code?.props?.className || '')?.[1]
            const src = String(code?.props?.children ?? '').trim()
            if (lang === 'chin-stats') return <StatsBlock src={src} />
            if (lang === 'chin-bars') return <BarsBlock src={src} red={red} blue={blue} />
            if (lang === 'chin-takeaways') return <Takeaways items={takeawayItems(src)} />
            if (lang === 'chin-image') return <ImageBlock src={src} media={media} />
            if (lang === 'chin-quote') return <PullQuote src={src} red={red} blue={blue} size={quoteSize} />
            if (lang === 'chin-history') return <History meetings={meetings} red={red} blue={blue} />
            if (lang === 'chin-video') return <Video src={src} />
            if (lang === 'chin-tweet') return <TweetBlock src={src} />
            if (DATA_BLOCKS.has(lang)) return <DataBlock lang={lang} fight={fight} />
            if (lang) return null  // an unknown block never shows as raw text
            return <pre>{children}</pre>
          },
        }}
      >
        {body}
      </Markdown>
      {verdict && (
        <div className="not-prose clear-both mt-8 rounded-lg bg-ink px-5 py-4 text-white">
          <div className="font-display text-[12px] font-extrabold italic uppercase tracking-wider text-primary">The pick</div>
          <div className="mt-0.5 font-display text-[26px] font-extrabold italic uppercase leading-tight tracking-tight">{verdict}</div>
        </div>
      )}
    </div>
  )
}

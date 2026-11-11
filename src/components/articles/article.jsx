// Shared by the Articles index and the article page: a preview's artwork and the chart blocks the writer can
// drop into the body (```chin-stats```, ```chin-bars```, ```chin-takeaways```).
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import FighterImage from '../sports/FighterImage'
import { articleImageUrl, articleMediaUrl } from '../../lib/api'
import { cn } from '../../lib/utils'
import { takeawayItems } from './articleText'

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

export function ArticleBody({ body, red, blue, verdict, media }) {
  return (
    <div className="prose prose-neutral max-w-none font-serif text-[16.5px] leading-[1.75] text-foreground/90 prose-headings:font-sans prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:text-foreground prose-h2:mb-2 prose-h2:mt-8 prose-h2:text-[22px] prose-strong:text-foreground prose-table:font-sans prose-table:text-[13px] prose-th:text-foreground">
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

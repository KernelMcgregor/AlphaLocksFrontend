// The written preview, in the rail, taking whatever height the rail has left.
// Nothing is truncated in the text itself: the article is clipped by the box and
// faded out, and "Read all" opens the full piece on its own page. Clipping rather
// than slicing the markdown keeps tables and headings intact instead of cutting one
// in half.
import { ArrowRight } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { cn, formatDate } from '../../lib/utils'

export default function PreviewBox({ preview, fightId, className, title = 'Preview' }) {
  const written = preview.generated_at ? formatDate(String(preview.generated_at).slice(0, 10)) : null

  return (
    // The article must not decide how tall this box is — the rail does. An absolutely
    // positioned card contributes nothing to its parent's height, so the box is
    // exactly the space left under the cards above it. The min-height is the floor
    // for a short screen, where the rail scrolls instead.
    <div className={cn('relative min-h-[240px]', className)}>
    <div className="absolute inset-0 flex flex-col rounded-lg border border-border p-3">
      <div className="mb-2 flex shrink-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold tracking-tight">{title}</span>
          <span className="text-[10.5px] text-muted-foreground">
            Written by KernelMcGregor{written ? ` · ${written}` : ''}
          </span>
        </div>
        {/* The corner link leaves for the index; getting the rest of *this*
            article is the button under the text, where the reader runs out. */}
        <Link
          to="/ufc/articles"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
        >
          See All Articles <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Headings are knocked back to near body size in here: at the article's
            own scale the h1 filled most of the box and the reader got a title
            instead of a preview. The full-length page keeps the real scale. */}
        <div className="prose prose-sm max-w-none text-foreground prose-headings:mb-1 prose-headings:mt-2 prose-headings:text-foreground prose-h1:text-[15px] prose-h1:leading-snug prose-h2:text-[13px] prose-h3:text-[12px] prose-p:my-1.5 prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-table:text-sm prose-th:text-foreground prose-td:text-foreground">
          <Markdown remarkPlugins={[remarkGfm]}>{preview.content}</Markdown>
        </div>
        {/* the article always overflows, so the fade is unconditional */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
      </div>

      <div className="mt-2 flex shrink-0 justify-center">
        <Link
          to={`/ufc/fights/${fightId}/preview`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 text-[11.5px] font-bold transition-colors hover:border-primary/50 hover:text-primary"
        >
          Read all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
    </div>
  )
}

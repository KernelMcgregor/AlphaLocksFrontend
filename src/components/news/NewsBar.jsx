// The thin bar that slides in once a news story's header has scrolled away: back, the
// kind of story, the headline, and the fighters it is about.
import { useEffect, useState } from 'react'
import { Standing } from '../articles/embeds'
import { BackButton } from '../articles/header'
import FighterImage from '../sports/FighterImage'
import { KIND_LABEL } from './newsText'
import { cn } from '../../lib/utils'

export default function NewsBar({ story, title }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = document.querySelector('[data-article-header]')
    if (!el) return undefined
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [story.slug])
  return (
    <div className="sticky top-0 z-30 h-0">
      <div className={cn('flex items-center gap-3 rounded-xl bg-ink px-3 py-2 text-white shadow-lg transition-all duration-200',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0')}>
        <BackButton dark />
        <span className="hidden shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline">
          {KIND_LABEL[story.kind] || 'News'}
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-[16px] font-extrabold italic uppercase tracking-tight">{title}</span>
        <div className="hidden shrink-0 gap-2.5 sm:flex">
          {(story.fighters || []).slice(0, 4).map((f) => (
            <span key={f.id} className="relative">
              <span className="block h-9 w-9 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
                <FighterImage fighter={f} className="h-full w-full" imgClassName="origin-top translate-y-[12%] scale-110" />
              </span>
              <Standing champion={f.champion} rank={f.rank} className="absolute -bottom-1 -right-1 h-4 min-w-4 text-[8px]" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

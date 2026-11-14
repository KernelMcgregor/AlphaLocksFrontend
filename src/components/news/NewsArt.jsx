// A news story's picture: its cover (a source article's lead photo, framed on the faces),
// else the portraits of the fighters involved on a dark field.
import FighterImage from '../sports/FighterImage'
import { newsImageUrl } from '../../lib/api'
import { cn } from '../../lib/utils'

export default function NewsArt({ story, className }) {
  if (story.image) {
    return (
      <div className={cn('relative overflow-hidden bg-ink', className)}>
        <img src={newsImageUrl(story.slug, story.image.v)} alt="" loading="lazy" className="h-full w-full object-cover"
          style={{ objectPosition: `${story.image.focal_x * 100}% ${story.image.focal_y * 100}%` }} />
      </div>
    )
  }
  const fighters = (story.fighters || []).slice(0, 2)
  return (
    <div className={cn('relative flex items-end justify-center overflow-hidden bg-ink', className)}>
      {fighters.map((f) => (
        <div key={f.id} className="relative h-full w-1/2 max-w-[260px]">
          <FighterImage fighter={f} fit="contain" className="absolute inset-0 flex items-end justify-center" imgClassName="h-[110%] w-auto max-w-none object-top" />
        </div>
      ))}
    </div>
  )
}

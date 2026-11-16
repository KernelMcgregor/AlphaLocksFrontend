// Pieces of the ink hero band that opens the fighter profile and the fight pages: the
// portrait on its flag, the name (first name small, surname big in the display font, as
// on the home page and the event cards), chips, the style-family tag and the section tabs.
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import WavingFlag from '../sports/WavingFlag'
import { SlideTabs } from '../ui/slide-tabs'
import { blendOf, famColor, familyName } from '../../lib/styleTraits'
import { cn, fitName } from '../../lib/utils'

// Full height of the band. Cover-cropped from the top, so the head and shoulders survive.
export function HeroPortrait({ fighter, className, lost, border, children }) {
  return (
    <div className={cn('relative shrink-0 self-stretch overflow-hidden', border && 'border-b-[3px]', className)}
      style={border ? { borderColor: border } : undefined}>
      <WavingFlag countryCode={fighter?.country_code} />
      <FighterImage fighter={fighter} alt={`${fighter?.first_name} ${fighter?.last_name}`}
        className={cn('absolute inset-x-0 bottom-0 top-2 z-10', lost && 'opacity-55 grayscale')} />
      {children}
    </div>
  )
}

// Never truncated: the surname is sized to fit its column (fitName) and wraps between words.
export function HeroName({ fighter, right, size = 40, className }) {
  return (
    <div className={cn('min-w-0', right && 'text-right', className)}>
      <div className={cn('flex items-center gap-1.5 text-[12.5px] font-semibold leading-tight text-white/75', right && 'flex-row-reverse')}>
        <CountryFlag countryCode={fighter?.country_code} className="shrink-0" />
        <span className="truncate">{fighter?.first_name}</span>
      </div>
      <div className="@container w-full">
        <div className="font-display font-extrabold italic uppercase leading-[0.95] tracking-tight"
          style={{ fontSize: fitName(fighter?.last_name, size) }}>
          <span className="line-clamp-2 pr-[0.12em]">{fighter?.last_name || 'TBA'}</span>
        </div>
      </div>
    </div>
  )
}

export function HeroChip({ className, style, title, children }) {
  return (
    <span title={title} style={style}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-extrabold tabular-nums', className || 'bg-white/12')}>
      {children}
    </span>
  )
}

// The fighter's main style family and its share of their blend. `style` is a style row
// (routers/ufc._style_row); `name` alone (fight.styles) when no row has loaded.
export function FamilyTag({ style, families, name }) {
  const top = style ? blendOf(style)[0] : null
  const label = familyName((top && families?.[top.family]?.name) || name)
  if (!label) return null
  return (
    <HeroChip className="bg-white/12 font-bold" title="Style family">
      {top && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: famColor(top.family) }} />}
      {label}
      {top && top.share < 0.995 && <span className="font-semibold text-white/60">{Math.round(top.share * 100)}%</span>}
    </HeroChip>
  )
}

// The section tabs on the band: the selected tab red with white text, on a translucent track.
export function HeroTabs(props) {
  return <SlideTabs size="sm" tone="brand" {...props} />
}

// One fighter in the hypothetical-bout picker: a trading card that flips.
//
// Front: portrait, name, record, division and rank — enough to recognise and find them.
// Back: the tale of the tape, and the button that puts them in a corner. Picking lives on
// the back so that browsing (flip, read, flip back) and choosing are separate gestures;
// the small corner button on the front is the shortcut for someone who already knows.
import { Check, Plus } from 'lucide-react'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import FlipCard from '../ui/flip-card'
import { DIVISION_BY_KEY } from '../../lib/hypothetical'
import { cn, formatDate } from '../../lib/utils'

export const CARD_W = 196
export const CARD_H = 272

const CORNER_STYLE = {
  red: { ring: 'ring-corner-red', chip: 'bg-corner-red', label: 'Red corner' },
  blue: { ring: 'ring-corner-blue', chip: 'bg-corner-blue', label: 'Blue corner' },
}

const record = (f) => `${f.wins}-${f.losses}${f.draws ? `-${f.draws}` : ''}`

// A press on a button inside the card must not also start the card's flip or drag.
const stop = (e) => e.stopPropagation()

function PickButton({ picked, disabled, onPick, className, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={(e) => { e.stopPropagation(); onPick() }}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition-colors',
        disabled
          ? 'cursor-not-allowed bg-white/10 text-white/40'
          : picked ? 'bg-white text-zinc-900 hover:bg-white/85' : 'bg-blue-600 text-white hover:bg-blue-500',
        className,
      )}
    >
      {children}
    </button>
  )
}

function Front({ f, corner, disabled, onPick }) {
  const div = DIVISION_BY_KEY[f.division]
  const flag = f.country_code?.toLowerCase()
  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-800 text-zinc-50">
      {/* The flag fills the card behind the fighter. Static (flag-icons' SVG as a cover
          background) rather than the profile's WavingFlag: dozens of canvases animating
          at once is too much for a grid. */}
      {flag && (
        <span
          aria-hidden
          className={`fi fi-${flag} absolute inset-0 opacity-80`}
          style={{ width: '100%', height: '100%', backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/10 via-black/25 to-black/40" />

      {/* The whole figure, down to the card's bottom edge; the name sits over it. */}
      <FighterImage fighter={f} alt="" fit="contain" className="absolute inset-x-0 top-7 bottom-0" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-zinc-950 via-zinc-950/75 to-transparent" />

      <div className="absolute inset-x-2.5 top-2.5 z-10 flex items-center gap-1.5">
        {div && (
          <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wide backdrop-blur-sm">
            {div.short}
          </span>
        )}
        {f.rank != null && (
          <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9.5px] font-extrabold text-zinc-900">
            #{f.rank}
          </span>
        )}
        <PickButton
          picked={Boolean(corner)}
          disabled={disabled && !corner}
          onPick={onPick}
          className="ml-auto h-7 w-7 rounded-full"
        >
          {corner ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </PickButton>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-2.5">
        <div className="truncate text-[10.5px] font-semibold text-zinc-300">{f.first_name}</div>
        <div className="truncate text-[17px] font-extrabold uppercase leading-tight tracking-tight" title={`${f.first_name} ${f.last_name}`}>
          {f.last_name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-zinc-300">
          <CountryFlag countryCode={f.country_code} />
          <span>{record(f)}</span>
          {f.status && f.status !== 'Active' && <span className="truncate text-zinc-400">· {f.status}</span>}
        </div>
      </div>
    </div>
  )
}

function Back({ f, corner, disabled, onPick }) {
  const rows = [
    ['Record', record(f)],
    ['Age', f.age],
    ['Height', f.height && f.height !== '--' ? f.height : null],
    ['Reach', f.reach && f.reach !== '--' ? f.reach : null],
    ['Stance', f.stance],
    ['UFC bouts', f.ufc_fights],
    ['Last fight', f.last_fight ? formatDate(f.last_fight) : null],
  ]
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-zinc-900 p-3 text-zinc-50">
      <div className="truncate text-[13px] font-extrabold">{f.first_name} {f.last_name}</div>
      {f.nickname
        ? <div className="truncate text-[10.5px] italic text-zinc-400">&ldquo;{f.nickname}&rdquo;</div>
        : <div className="h-[15px]" />}
      <dl className="mt-1.5 min-h-0 flex-1 space-y-[3px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-[3px] text-[11px]">
            <dt className="text-zinc-400">{k}</dt>
            <dd className="truncate font-semibold tabular-nums">{v ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <PickButton picked={Boolean(corner)} disabled={disabled && !corner} onPick={onPick} className="mt-2 h-9 w-full shrink-0 text-[12.5px]">
        {corner ? <><Check className="h-4 w-4" /> In the {corner} corner</> : disabled ? 'Other division ladder' : <><Plus className="h-4 w-4" /> Pick fighter</>}
      </PickButton>
    </div>
  )
}

export default function FighterFlipCard({ fighter, corner, disabled, onPick }) {
  const cs = corner ? CORNER_STYLE[corner] : null
  return (
    <div className={cn('relative transition-opacity', disabled && !corner && 'opacity-45')}>
      <FlipCard
        width="100%"
        height={CARD_H}
        radius={16}
        tilt
        tiltMax={10}
        glare
        glareOpacity={0.22}
        hoverScale={1.03}
        draggable
        background="#18181b"
        color="#f5f5f5"
        shadowOpacity={0.35}
        className={cn('rounded-2xl', cs && `ring-[3px] ring-offset-2 ring-offset-background ${cs.ring}`)}
        front={<Front f={fighter} corner={corner} disabled={disabled} onPick={onPick} />}
        back={<Back f={fighter} corner={corner} disabled={disabled} onPick={onPick} />}
      />
      {cs && (
        <span className={cn('pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white shadow', cs.chip)}>
          {cs.label}
        </span>
      )}
    </div>
  )
}

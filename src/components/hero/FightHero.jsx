// The fight pages' cover and slim bar, as on the fighter profile.
//
// FightCover opens the page: both corners full-height on their flags at the edges, the
// names big between them with their record, rank and style family, the event and the
// countdown (upcoming) or the result (completed), the tale of the tape between them, and
// along the bottom the model's call and our preview. Once it has scrolled away, FightBar
// slides in as a thin header with both fighters and the tabs.
import { Link } from 'react-router-dom'
import Countdown from '../arc/countdown/countdown'
import { BackButton, EventName } from '../articles/header'
import { bestOdds, isTitle, weightLabel } from '../articles/fightText'
import { ArticleArt } from '../articles/article'
import { parseArticle } from '../articles/articleText'
import { CORNERS, cornerRank } from '../fight/corners'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import WavingFlag from '../sports/WavingFlag'
import BeltIcon from '../ui/belt-icon'
import { METHOD_LABEL, methodClass } from '../../lib/fightReview'
import { cn, fitName, formatDate, formatOdds } from '../../lib/utils'
import { FamilyTag, HeroChip, HeroTabs } from './parts'

// Light components set on the ink: their tokens re-pointed at white-on-dark.
const DARK = '[--color-foreground:#fff] [--color-muted-foreground:rgba(255,255,255,.6)] [--color-border:rgba(255,255,255,.12)] [--color-card:transparent] [--color-background:transparent] [--color-muted:rgba(255,255,255,.12)] text-white'

// Read once at load: whether a card is still ahead only matters to the hour.
const NOW = Date.now()

const recordText = (f) => `${f.wins ?? 0}-${f.losses ?? 0}${f.draws > 0 ? `-${f.draws}` : ''}`

// A corner's portrait over its flag, flush to the cover's edge, fading into the ink
// toward the middle so the names run over clean ground.
function Portrait({ fighter, right, won }) {
  return (
    <div className={cn('absolute inset-y-0 hidden w-[27%] md:block', right ? 'right-0' : 'left-0')}>
      <div className="absolute inset-0 opacity-70"><WavingFlag countryCode={fighter.country_code} /></div>
      <div className={cn('absolute inset-0 from-ink via-ink/40 to-transparent', right ? 'bg-gradient-to-r' : 'bg-gradient-to-l')} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
      {/* The right-facing pose is head to feet where the profile portrait stops at the
          thighs: drawn 1.85x tall from the top so both corners are framed alike. */}
      <FighterImage fighter={fighter} fit="contain" pose={right ? 'right' : undefined} alt={`${fighter.first_name} ${fighter.last_name}`}
        imgClassName={right && fighter.has_right_image ? '!h-[185%] !object-top' : undefined}
        className="absolute inset-x-0 bottom-0 top-4 z-10" />
      {won && (
        <span className={cn('absolute top-4 z-20 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white',
          right ? 'left-4' : 'right-4')}>Win</span>
      )}
    </div>
  )
}

function Corner({ fighter, corner, right, champion, ctx, weightClass, result, style, styleName }) {
  const { rank, division } = cornerRank({ ctx, rank: result ? result.rank ?? null : undefined, weightClass })
  return (
    <div className={cn('min-w-0', right && 'text-right')}>
      <Link to={`/ufc/fighters/${fighter.id}`} className="block hover:opacity-90">
        <span className="block text-[19px] font-semibold leading-tight text-white/80">{fighter.first_name}</span>
        <span className="@container block w-full">
          <span className="block font-display font-extrabold italic uppercase leading-[0.9] tracking-tight"
            style={{ fontSize: fitName(fighter.last_name, 68) }}>
            <span className="pr-[0.12em]">{fighter.last_name}</span>
          </span>
        </span>
      </Link>
      <div className={cn('mt-2 flex flex-wrap items-center gap-1.5', right && 'justify-end')}>
        <HeroChip className="bg-white text-ink" title={result ? 'Record going into this fight' : undefined}>
          {result?.record || recordText(fighter)}
        </HeroChip>
        {champion
          ? <HeroChip className="bg-gold text-ink"><BeltIcon className="h-3 w-3" />Champion</HeroChip>
          : rank != null && <HeroChip className="text-white" style={{ background: corner.css }}>#{rank}{division ? ` ${division}` : ''}</HeroChip>}
        <FamilyTag style={style?.fighter} families={style?.families} name={styleName} />
      </div>
    </div>
  )
}

function Result({ fight, side }) {
  const cls = methodClass(fight.method)
  const winner = side === 'red' ? fight.red_fighter : side === 'blue' ? fight.blue_fighter : null
  const how = cls ? METHOD_LABEL[cls] : (fight.method || '').trim()
  const when = fight.finish_round ? `R${fight.finish_round}${fight.finish_time ? ` · ${fight.finish_time}` : ''}` : null
  return (
    <div className="text-center">
      {winner ? (
        <>
          <div className="font-display text-[30px] font-extrabold italic uppercase leading-none tracking-tight"
            style={{ color: side === 'red' ? '#ff5a5a' : '#6aa8ff' }}>
            {winner.last_name} wins
          </div>
          <div className="mt-1 text-[13px] font-semibold text-white/80">by {how}{when ? ` · ${when}` : ''}</div>
          {/* A finish's details are the finishing sequence; a decision's are the judges'
              totals, which the Rounds section shows in full. */}
          {cls !== 'dec' && fight.details?.trim() && <div className="mt-0.5 text-[11.5px] text-white/55">{fight.details.trim()}</div>}
        </>
      ) : (
        <div className="font-display text-[26px] font-extrabold italic uppercase leading-none">{how || 'No result'}</div>
      )}
    </div>
  )
}

/**
 * @param styles    { red, blue }: each corner's /ufc/styles/fighters/{id} payload, or null
 * @param result    completed fights: { side, records: { red, blue }, ranks: { red, blue } }
 * @param tape      the tale of the tape, set in the middle between the portraits
 * @param children  the row along the bottom of the cover
 */
export default function FightCover({ fight, ctx, styles, result, rounds, coverRef, tape, cols, children }) {
  const { red_fighter: red, blue_fighter: blue, event } = fight
  const live = !result && event?.main_card_at && Date.parse(event.main_card_at) > NOW - 6 * 3.6e6
  const side = result?.side
  const corner = (key) => ({
    corner: CORNERS[key === 'red' ? 0 : 1],
    champion: !!fight.champions?.[key],
    ctx: ctx?.[key],
    weightClass: fight.weight_class,
    style: styles?.[key],
    styleName: fight.styles?.[key],
    result: result && { record: result.records?.[key], rank: result.ranks?.[key] },
  })

  return (
    <header ref={coverRef} className="relative shrink-0 overflow-hidden rounded-xl bg-ink text-white">
      <div className="relative">
        <Portrait fighter={red} won={side === 'red'} />
        <Portrait fighter={blue} right won={side === 'blue'} />
        <BackButton fallback="/ufc/events" className="absolute left-4 top-4 z-30 h-8 w-8" />

        <div className="relative z-20 flex flex-col items-center px-4 pb-4 pt-4 md:mx-[21%]">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
            {event && <EventName name={event.name} className="font-display text-[19px] font-extrabold italic uppercase leading-none tracking-tight" />}
            {event && <span className="text-[11.5px] text-white/60">{formatDate(event.date)}{event.location ? ` · ${event.location}` : ''}</span>}
            <span className="flex gap-1.5 text-[10px] font-extrabold uppercase tracking-wider">
              <HeroChip>{weightLabel(fight.weight_class)}</HeroChip>
              {isTitle(fight.weight_class) && <HeroChip className="bg-gold text-ink"><BeltIcon className="h-3 w-3" />Title fight</HeroChip>}
              {rounds && <HeroChip>{rounds} rounds</HeroChip>}
            </span>
          </div>

          {/* The countdown or the result sits under the event, centred, so each name gets
              half the width between the portraits. */}
          <div className="mt-2.5 flex justify-center">
            {result ? <Result fight={fight} side={side} />
              : live ? (
                <div className="flex justify-center [--color-border:rgba(255,255,255,.2)] [--color-card:transparent] [--color-foreground:#fff] [--color-muted-foreground:rgba(255,255,255,.6)]">
                  <Countdown target={event.main_card_at} variant="compact" label="Main card" completeLabel="Live now" />
                </div>
              ) : null}
          </div>
          <div className="mt-2 grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
            <Corner fighter={red} {...corner('red')} />
            <span className="font-display text-[34px] font-extrabold italic uppercase leading-none text-white/35">vs</span>
            <Corner fighter={blue} right {...corner('blue')} />
          </div>
          {tape && <div className={cn('mt-4 w-full max-w-[520px]', DARK)}>{tape}</div>}
        </div>
      </div>

      {children && (
        <div className={cn('relative z-20 grid items-center gap-6 border-t border-white/10 px-5 py-3.5', cols || 'lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)]', DARK)}>
          {children}
        </div>
      )}
    </header>
  )
}

// Our preview: the article's picture, headline, the opening lines and a way in.
export function PreviewTeaser({ fight }) {
  const a = parseArticle(fight.preview.content)
  // Hover zooms the picture inside its frame and steps the headline up a size; scaling
  // the whole card instead rendered the text blurry mid-transform.
  return (
    <Link to={`/ufc/fights/${fight.id}/preview`} className="group flex min-w-0 gap-4">
      <span className="block h-[120px] w-[38%] max-w-[230px] shrink-0 overflow-hidden rounded-lg shadow-lg transition-shadow group-hover:shadow-2xl">
        <ArticleArt image={fight.article_image} fightId={fight.id} red={fight.red_fighter} blue={fight.blue_fighter} dark
          className="h-full w-full transition-transform duration-300 group-hover:scale-110" />
      </span>
      <span className="flex h-[120px] min-w-0 flex-col">
        <span className="line-clamp-2 text-[15px] font-extrabold leading-snug transition-[font-size] duration-200 group-hover:text-[16px]">{a.title}</span>
        {a.dek && <span className="mt-1 line-clamp-2 font-serif text-[12.5px] leading-snug text-white/65 transition-colors group-hover:text-white/85">{a.dek}</span>}
        <span className="mt-auto inline-flex w-fit items-center rounded-md bg-primary px-3 py-1 text-[12px] font-bold text-white transition-colors group-hover:bg-primary/85">
          Read the preview
        </span>
      </span>
    </Link>
  )
}

// The odds: the best moneyline on each corner across books, and each corner's method
// lines under it when they are posted.
export function MarketCall({ fight }) {
  const { red_fighter: red, blue_fighter: blue } = fight
  const best = bestOdds(fight.odds || [])
  if (best.red == null && best.blue == null) return <div className="text-[13px] text-white/50">No lines yet.</div>
  // Each corner's method lines (Bovada), smaller under the moneyline, when posted.
  const mo = fight.method_odds
  const methods = (key) => [['KO', mo?.[`${key}_ko_odds`]], ['Sub', mo?.[`${key}_sub_odds`]], ['Dec', mo?.[`${key}_dec_odds`]]]
    .filter(([, v]) => v != null)
  const side = (f, price, c, key) => (
    <div className="min-w-0">
      <div className="truncate text-[13px] font-bold" style={{ color: c }}>{f.last_name}</div>
      <div className="mt-1 font-display text-[60px] font-extrabold italic leading-none tabular-nums">{price != null ? formatOdds(price) : '–'}</div>
      {methods(key).length > 0 && (
        <div className="mt-1.5 flex gap-3 text-[11px] text-white/55">
          {methods(key).map(([label, v]) => (
            <span key={label}>{label} <span className="font-bold tabular-nums text-white/90">{formatOdds(v)}</span></span>
          ))}
        </div>
      )}
    </div>
  )
  return (
    <div className="min-w-0 self-stretch border-white/10 lg:border-x lg:px-8">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/55">Betting odds</div>
      <div className="mt-2 flex gap-8">
        {side(red, best.red, '#ff5a5a', 'red')}
        {side(blue, best.blue, '#6aa8ff', 'blue')}
      </div>
    </div>
  )
}

// The model's call in big numbers, as the profile cover shows a fighter's: who it picks
// and how sure, the win split, and the method. `hit` (completed fights): whether it was right.
export function ModelCall({ prediction, methodPrediction, red, blue, hit }) {
  if (!prediction) return <div className="text-[13px] text-white/50">No model prediction for this fight.</div>
  const redP = prediction.red_prob
  const pickRed = prediction.predicted_winner === 'red'
  const pick = pickRed ? red : blue
  const p = Math.round((pickRed ? redP : 1 - redP) * 100)
  const methods = methodPrediction ? [
    ['KO/TKO', methodPrediction.ko_prob, 'bg-method-ko'],
    ['Decision', methodPrediction.dec_prob, 'bg-method-dec'],
    ['Submission', methodPrediction.sub_prob, 'bg-method-sub'],
  ].filter(([, v]) => v != null).sort((x, y) => y[1] - x[1]) : []
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/55">
        Model pick
        {hit != null && (
          <span className={cn('rounded px-1.5 py-px text-[9.5px] font-extrabold text-white', hit ? 'bg-emerald-600' : 'bg-rose-600')}>
            {hit ? 'Called it' : 'Missed'}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-[30px] font-extrabold italic uppercase leading-none tracking-tight"
          style={{ color: pickRed ? '#ff5a5a' : '#6aa8ff' }}>{pick.last_name}</span>
        <span className="font-display text-[30px] font-extrabold italic leading-none tabular-nums">{p}%</span>
      </div>
      <div className="mt-2 flex h-2 gap-0.5">
        <div className="rounded-l-full" style={{ width: `${redP * 100}%`, background: CORNERS[0].css }} />
        <div className="rounded-r-full" style={{ width: `${(1 - redP) * 100}%`, background: CORNERS[1].css }} />
      </div>
      {methods.length > 0 && (
        <div className="mt-2 flex gap-6">
          {methods.map(([label, v, cls]) => (
            <div key={label}>
              <div className="font-display text-[21px] font-extrabold italic leading-none tabular-nums">{Math.round(v * 100)}%</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/55">
                <span className={cn('h-1.5 w-1.5 rounded-full ring-1 ring-white/30', cls)} />{label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Pinned to the top of the scroll once the cover has gone: both fighters and the tabs.
export function FightBar({ show, fight, tabs, active, onTab }) {
  const { red_fighter: red, blue_fighter: blue } = fight
  const name = (f, c, right) => (
    <span className={cn('flex min-w-0 items-center gap-2', right && 'flex-row-reverse')}>
      <span className="shrink-0 rounded-full p-[2px]" style={{ background: c.css }}>
        <FighterImage fighter={f} className="h-8 w-8 rounded-full bg-white/10" />
      </span>
      <CountryFlag countryCode={f.country_code} className="hidden shrink-0 xl:inline-block" />
      <span className="truncate font-display text-[22px] font-extrabold italic uppercase leading-none tracking-tight">{f.last_name}</span>
    </span>
  )
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div className={cn('flex h-[52px] items-center gap-3 rounded-xl bg-ink px-3 text-white shadow-lg transition-all duration-200',
        show ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-3 opacity-0')}>
        <BackButton dark fallback="/ufc/events" className="h-7 w-7 shrink-0" />
        {name(red, CORNERS[0])}
        <span className="shrink-0 text-[11px] font-bold uppercase text-white/50">vs</span>
        {name(blue, CORNERS[1], true)}
        <div className="ml-auto flex min-w-0 shrink overflow-x-auto [scrollbar-width:none]">
          <HeroTabs className="shrink-0" tabs={tabs} value={active} onChange={onTab} />
        </div>
      </div>
    </div>
  )
}

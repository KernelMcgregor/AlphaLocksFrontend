// The fighter profile's cover and its slim bar.
//
// FighterCover opens the page: the full-body portrait on the waving flag, the name in big
// display type, the chips, the headline numbers, the vitals, and the last and next fight.
// Once the cover has scrolled away, ProfileBar slides in as a thin header pinned to the top of
// the scroll: avatar, name, record, rank and the section tabs.
import { Link } from 'react-router-dom'
import { BackButton } from '../articles/header'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import FighterMini from '../sports/FighterMini'
import WavingFlag from '../sports/WavingFlag'
import BeltIcon from '../ui/belt-icon'
import { Tip } from '../ui/tip'
import { cn, displayRank, fitName, formatDate } from '../../lib/utils'
import { FamilyTag, HeroChip, HeroTabs } from './parts'

function Chips({ record, ranked, divisionLabel, isChamp, style, families }) {
  return (
    <>
      <HeroChip className="bg-white text-ink">{record}</HeroChip>
      {ranked && divisionLabel && (isChamp
        ? <HeroChip className="bg-gold text-ink"><BeltIcon className="h-3 w-3" />{divisionLabel} Champion</HeroChip>
        : <HeroChip>#{displayRank(ranked)} {divisionLabel}</HeroChip>)}
      <FamilyTag style={style} families={families} />
    </>
  )
}

// Opens the fight itself: the review of the last one, the preview of the next.
function Bout({ label, opp, oppId, fightId, date, result }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</div>
      {oppId ? (
        <Tip content={<FighterMini f={opp} />}>
          <Link to={fightId ? `/ufc/fights/${fightId}` : `/ufc/fighters/${oppId}`} className="-mx-2 -my-1.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
            <span className="relative shrink-0">
              <FighterImage fighter={opp} className="h-10 w-10 rounded-full bg-white/10" />
              {result && (
                <span className={cn('absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-extrabold text-white ring-2 ring-ink',
                  result === 'D' ? 'bg-slate-400' : result === 'W' ? 'bg-emerald-500' : 'bg-rose-500')}>{result}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold leading-tight">{opp?.name || 'TBA'}</span>
              <span className="block text-[11px] text-white/55">{date ? formatDate(date) : ''}</span>
            </span>
          </Link>
        </Tip>
      ) : (
        <div className="text-[13px] text-white/45">{label === 'Next fight' ? 'Not scheduled' : 'None'}</div>
      )}
    </div>
  )
}

/**
 * @param stats   [[label, value, sub?], ...] the headline numbers, in display type
 * @param vitals  [[label, value], ...] age, height, reach, ...
 */
export default function FighterCover({
  fighter, record, ranked, divisionLabel, isChamp, style, families, stats, vitals, last, next, coverRef,
}) {
  return (
    <header ref={coverRef} className="relative flex shrink-0 overflow-hidden rounded-xl bg-ink text-white">
      {/* The portrait and its flag take the right of the cover; the flag fades into the
          ink on its left edge so the name runs over clean ground. */}
      <div className="absolute inset-y-0 right-0 w-[48%]">
        <div className="absolute inset-0 opacity-70"><WavingFlag countryCode={fighter.country_code} /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        <FighterImage fighter={fighter} fit="contain" alt={`${fighter.first_name} ${fighter.last_name}`}
          className="absolute inset-x-0 bottom-0 top-6 z-10" />
      </div>
      {/* Back sits in the corner over the flag, so it costs the name column no row. */}
      <BackButton fallback="/ufc/fighters/stats" className="absolute right-4 top-4 z-30 h-8 w-8" />

      <div className="relative z-20 flex w-[60%] min-w-0 flex-col pb-4 pl-8 pt-5 2xl:pl-10">
        <div className="w-full min-w-0 pb-5">
          <h1 className="min-w-0">
            <span className="block text-[22px] font-semibold leading-tight text-white/80">{fighter.first_name}</span>
            <span className="@container block w-full">
              <span className="block font-display font-extrabold italic uppercase leading-[0.88] tracking-tight"
                style={{ fontSize: fitName(fighter.last_name, 132) }}>
                <span className="pr-[0.12em]">{fighter.last_name}</span>
              </span>
            </span>
          </h1>
          {fighter.nickname && <div className="mt-1 text-[15px] italic text-white/60">"{fighter.nickname}"</div>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 [&>span]:px-2 [&>span]:py-1 [&>span]:text-[12px]">
            <Chips record={record} ranked={ranked} divisionLabel={divisionLabel} isChamp={isChamp} style={style} families={families} />
          </div>

          {stats.length > 0 && (
            <div className="mt-6 grid max-w-[760px] grid-cols-3 gap-x-4 gap-y-4 border-t border-white/10 pt-5 lg:grid-cols-6">
              {stats.map(([label, value, sub]) => (
                <div key={label} className="min-w-0">
                  <div className="font-display text-[34px] 2xl:text-[40px] font-extrabold italic leading-none tracking-tight tabular-nums">{value}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</div>
                  {sub && <div className="text-[11px] text-white/40">{sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {vitals.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{k}</div>
              <div className="text-[14px] font-semibold leading-snug">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-6 border-t border-white/10 pt-4 pr-6">
          <Bout label="Last fight" {...last} />
          <Bout label="Next fight" {...next} />
        </div>
      </div>
    </header>
  )
}

// Pinned to the top of the scroll once the cover has scrolled away. Lives in a zero-height sticky
// wrapper so it never takes room in the layout; it slides in rather than popping.
export function ProfileBar({ show, fighter, record, ranked, divisionLabel, isChamp, style, families, tabs, active, onTab }) {
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0">
      <div className={cn('flex h-[52px] items-center gap-3 rounded-xl bg-ink px-3 text-white shadow-lg transition-all duration-200',
        show ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-3 opacity-0')}>
        <BackButton dark fallback="/ufc/fighters/stats" className="h-7 w-7" />
        <FighterImage fighter={fighter} className="h-9 w-9 shrink-0 rounded-full bg-white/10" />
        <div className="flex min-w-0 shrink-0 items-baseline gap-1.5">
          <CountryFlag countryCode={fighter.country_code} className="shrink-0 self-center" />
          <span className="text-[13px] font-semibold text-white/75">{fighter.first_name}</span>
          <span className="font-display text-[24px] font-extrabold italic uppercase leading-none tracking-tight">{fighter.last_name}</span>
        </div>
        <div className="hidden min-w-0 items-center gap-1.5 overflow-hidden xl:flex">
          <Chips record={record} ranked={ranked} divisionLabel={divisionLabel} isChamp={isChamp} style={style} families={families} />
        </div>
        <div className="ml-auto flex min-w-0 shrink overflow-x-auto [scrollbar-width:none]">
          <HeroTabs className="shrink-0" tabs={tabs} value={active} onChange={onTab} />
        </div>
      </div>
    </div>
  )
}

// The fighter card both Fighter Styles views open their left rail with: portrait over the
// waving flag, name and badges, the profile page's bio rows, and the style blend. Anything
// passed as children (most similar, descendants...) renders under the blend.
//
// The rail-fitting helpers live in railFit.js (a component file may only export components).
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import WavingFlag from '../sports/WavingFlag'
import BeltIcon from '../ui/belt-icon'
import { cn, displayRank, isChampion } from '../../lib/utils'
import { divisionLabel } from '../../lib/styleTraits'
import { BlendBar, SectionLabel } from './shared'
import { PORTRAIT_FULL } from './railFit'

// Captured once at module load: age and "days since" only drift daily, and render must stay pure.
const NOW = Date.now()

function bioRows(f, hide) {
  return [
    ['body', [['Age', f.dob ? `${Math.floor((NOW - new Date(`${f.dob}T00:00:00`)) / 3.15576e10)} yrs` : null], ['Height', f.height], ['Weight', f.weight]]],
    ['reach', [['Reach', f.reach], ['Leg reach', f.leg_reach ? `${f.leg_reach}"` : null]]],
    ['stance', [['Stance', f.stance], ['Style', f.fighting_style]]],
    ['career', [['UFC debut', f.octagon_debut ? f.octagon_debut.slice(0, 4) : f.first_year],
      ['UFC fights', f.ufc_fights],
      ['Last activity', f.last_fight ? `${Math.round((NOW - new Date(`${f.last_fight}T00:00:00`)) / 8.64e7)} days` : null]]],
  ].filter(([id]) => !hide?.has(id)).map(([, row]) => row.filter(([, v]) => v)).filter((row) => row.length)
}

function Badges({ fighter, rank, small }) {
  const chip = small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'
  return (
    <div className={cn('mt-1 flex flex-wrap', small ? 'gap-1' : 'gap-1.5')}>
      <span className={cn('rounded-md border bg-background font-bold tabular-nums', chip)}>{fighter.record}</span>
      {rank?.score != null && <span className={cn('rounded-md bg-blue-600 font-bold text-white tabular-nums', chip)}>Power {rank.score.toFixed(0)}</span>}
      <span className={cn('rounded-md border border-blue-500/40 bg-blue-500/10 font-bold text-blue-600', chip)}>
        {rank ? (isChampion(rank) ? `${rank.division} Champion` : `#${displayRank(rank)} ${rank.division}`) : divisionLabel(fighter.division)}
      </span>
    </div>
  )
}

export function FighterBioCard({ fighter, families, rank, hideBio, portrait = PORTRAIT_FULL, compact = false, children }) {
  const rows = bioRows(fighter, hideBio)
  return (
    <div className="shrink-0 rounded-lg border border-border bg-card p-2.5">
      {compact ? (
        // Small screens: a thumbnail beside the name instead of the full portrait.
        <div className="flex items-center gap-2.5">
          <div className="relative h-[68px] w-[56px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-muted to-border/60">
            <FighterImage fighter={fighter} className="absolute inset-x-0 top-0 h-[80px] w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CountryFlag countryCode={fighter.country_code} />
              <span className="truncate text-[15px] font-extrabold leading-tight tracking-tight">{fighter.name}</span>
            </div>
            {fighter.nickname && <div className="truncate text-[10.5px] text-muted-foreground">"{fighter.nickname}"</div>}
            <Badges fighter={fighter} rank={rank} small />
          </div>
        </div>
      ) : (<>
      <div style={{ height: portrait }} className="relative flex shrink-0 items-end justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-blue-500/10 to-transparent">
        <WavingFlag countryCode={fighter.country_code} />
        <FighterImage fighter={fighter} fit="contain" alt={fighter.name} className="relative z-10 h-full w-full" />
        {isChampion(rank) && (
          <div className="absolute left-2 top-2 z-20 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-amber-600 backdrop-blur">
            <BeltIcon className="h-3 w-3" /> CHAMPION
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <div className="flex items-center gap-2">
          <CountryFlag countryCode={fighter.country_code} />
          <span className="truncate text-lg font-extrabold leading-none tracking-tight">{fighter.name}</span>
        </div>
        {fighter.nickname && <div className="mt-0.5 text-[11px] text-muted-foreground">"{fighter.nickname}"</div>}
        <Badges fighter={fighter} rank={rank} />
      </div>
      </>)}
      {rows.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 border-t pt-2">
          {rows.map((r) => (
            <div key={r.map(([k]) => k).join('-')} className="flex gap-2">
              {r.map(([k, v]) => (
                <div key={k} className="min-w-0 flex-1">
                  <div className="truncate whitespace-nowrap text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{k}</div>
                  <div className="truncate text-[13px] font-semibold leading-snug" title={String(v)}>{v}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 border-t pt-2">
        <SectionLabel className="mb-1">Style</SectionLabel>
        <BlendBar fighter={fighter} families={families} />
      </div>
      {children}
    </div>
  )
}


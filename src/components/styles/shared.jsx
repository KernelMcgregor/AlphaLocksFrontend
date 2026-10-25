// Pieces shared by the Fighter Styles tabs. Visual language follows the profile page:
// bordered cards with an extrabold title and a muted note, small uppercase section
// labels, amber (striking) and indigo (grappling) percentile bars.
import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import CountryFlag from '../CountryFlag'
import FighterImage from '../sports/FighterImage'
import FighterMini from '../sports/FighterMini'
import { Tip } from '../ui/tip'
import { useDivisionRanks } from '../../hooks/useDivisionRanks'
import { byP4P, useP4P } from '../../hooks/useP4P'
import { cn } from '../../lib/utils'
import { ordinal } from '../../lib/fighterAnalytics'
import { blendOf, divisionLabel, famColor, styleLabel, traitGroup, traitTitle } from '../../lib/styleTraits'

export function Panel({ title, note, action, children, className, bodyClassName }) {
  return (
    <section className={cn('flex flex-col rounded-lg border border-border bg-card p-3', className)}>
      {(title || action) && (
        <div className="mb-2 flex shrink-0 items-center gap-2">
          {title && <span className="text-[13px] font-extrabold tracking-tight">{title}</span>}
          {note && <span className="truncate text-[11px] text-muted-foreground">{note}</span>}
          {action && <div className="ml-auto min-w-0">{action}</div>}
        </div>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

export function SectionLabel({ children, className }) {
  return <div className={cn('text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground', className)}>{children}</div>
}

const BAR = {
  striking: 'bg-gradient-to-r from-amber-400 to-amber-500',
  grappling: 'bg-gradient-to-r from-indigo-400 to-indigo-500',
  outcome: 'bg-gradient-to-r from-slate-400 to-slate-500',
}

// One trait as a percentile track — DimBar's mark, with the trait's group picking the hue.
export function TraitBar({ trait, value, label, compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('shrink-0 truncate text-[11.5px] font-medium leading-tight text-foreground/80', compact ? 'w-[118px]' : 'w-[136px]')}>
        {label || traitTitle(trait)}
      </span>
      <div className="h-[7px] min-w-[48px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', BAR[traitGroup(trait)])} style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-extrabold tabular-nums text-foreground">{ordinal(value)}</span>
    </div>
  )
}

export function FamilyChip({ family, className }) {
  if (!family) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-semibold', className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: famColor(family.id) }} />
      {family.name}
    </span>
  )
}

// A fighter's family blend as one stacked bar plus named shares. Style is a continuum with
// four real families (style_page_service), so a fighter is shown as a mix, not a box.
export function BlendBar({ fighter, families, className }) {
  const blend = blendOf(fighter).filter((b) => families?.[b.family])
  if (!blend.length) return null
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex h-[7px] w-full overflow-hidden rounded-full bg-muted">
        {blend.map((b) => (
          <div key={b.family} style={{ width: `${b.share * 100}%`, background: famColor(b.family) }} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
        {blend.map((b) => (
          <span key={b.family} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: famColor(b.family) }} />
            <span className="font-semibold">{families[b.family].name}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(b.share * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Avatar ringed in the family colour, so identity and family read together.
export function FamilyAvatar({ fighter, size = 36, className }) {
  return (
    <span className={cn('block shrink-0 rounded-full p-[2px]', className)} style={{ background: famColor(fighter.family), width: size, height: size }}>
      <FighterImage fighter={fighter} className="h-full w-full rounded-full bg-muted" />
    </span>
  )
}

// The site's fighter hover card (FighterMini, as on the profile page's similar-fighters
// panel): headshot, name, record and divisional rank.
export function FighterCard({ fighter, ranks }) {
  return <FighterMini f={{ ...fighter, ...(ranks?.[fighter.id] || {}) }} />
}

export function FighterRow({ fighter, families, selected, onClick, right, dense, tip = true }) {
  const ranks = useDivisionRanks()
  const Wrap = tip ? Tip : 'div'
  return (
    <Wrap className="block" {...(tip ? { content: <FighterCard fighter={fighter} ranks={ranks} /> } : {})}>
    <button
      onClick={onClick}
      className={cn('flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 text-left transition-colors', dense ? 'py-1' : 'py-1.5',
        selected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-muted/70')}
    >
      <FamilyAvatar fighter={fighter} size={dense ? 26 : 30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <CountryFlag countryCode={fighter.country_code} className="shrink-0" />
          <span className="truncate text-[12.5px] font-bold">{fighter.name}</span>
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {[styleLabel(fighter, families), divisionLabel(fighter.division)].filter(Boolean).join(' · ')}
        </span>
      </span>
      {/* Omitted: active / career years. null: nothing on the right. */}
      {right !== undefined ? right : (
        <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
          {fighter.active ? 'Active' : `${fighter.first_year}–${String(fighter.last_year).slice(2)}`}
        </span>
      )}
    </button>
    </Wrap>
  )
}

// Every style-eligible fighter, searchable, in current P4P order (men's, then women's);
// fighters outside the P4P list follow by overall quality.
const LIST_CAP = 150
export function FighterList({ fighters, families, selectedId, onSelect, className, tips = true }) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('active')
  const p4p = useP4P()
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return fighters
      .filter((f) => (scope === 'all' || f.active) && (!needle || f.name.toLowerCase().includes(needle)))
      .sort(byP4P(p4p))
  }, [fighters, q, scope, p4p])

  return (
    <div className={cn('flex min-h-0 flex-col rounded-lg border border-border bg-card', className)}>
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-extrabold tracking-tight">Fighters</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">{rows.length.toLocaleString()}</span>
          <div className="ml-auto inline-flex gap-0.5 rounded-[10px] bg-muted p-0.5">
            {[['active', 'Active'], ['all', 'All-time']].map(([k, label]) => (
              <button key={k} onClick={() => setScope(k)}
                className={cn('rounded-[7px] px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  scope === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fighters…"
            aria-label="Search fighters"
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {rows.slice(0, LIST_CAP).map((f) => (
          <FighterRow key={f.id} fighter={f} families={families} selected={f.id === selectedId} onClick={() => onSelect(f.id)} tip={tips} right={null} />
        ))}
        {rows.length > LIST_CAP && (
          <p className="px-2 py-2 text-center text-[11px] text-muted-foreground">
            Showing {LIST_CAP} of {rows.length.toLocaleString()}. Search to narrow.
          </p>
        )}
        {rows.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">No fighters match "{q}".</p>}
      </div>
    </div>
  )
}

// Compact typeahead for toolbars.
export function FighterPicker({ fighters, onPick, placeholder = 'Find a fighter…', className }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const listId = useId()

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return []
    return fighters
      .filter((f) => f.name.toLowerCase().includes(needle))
      .sort((a, b) => (b.active - a.active) || (b.quality - a.quality))
      .slice(0, 8)
  }, [q, fighters])

  const pick = (f) => {
    onPick(f.id)
    setQ('')
    setOpen(false)
  }

  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-label="Find a fighter"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
          if (e.key === 'Enter' && matches[hi]) pick(matches[hi])
          if (e.key === 'Escape') setOpen(false)
        }}
        className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
      />
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {matches.map((f, i) => (
            <li
              key={f.id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); pick(f) }}
              onMouseEnter={() => setHi(i)}
              className={cn('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12.5px]', i === hi && 'bg-muted')}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: famColor(f.family) }} />
              <span className="truncate font-semibold">{f.name}</span>
              <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">
                {f.active ? 'Active' : `${f.first_year}–${f.last_year}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

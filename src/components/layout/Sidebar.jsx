import { BarChart3, Calendar, Clock, History, Layers, Newspaper, Orbit, Shuffle, Target, TrendingUp } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { BrandLockup } from './Brand'

// The site is UFC-only, so navigation is flat: section headers with their pages
// underneath. `match` lists extra paths that should light the item up (aliases and
// former URLs that still route to the same page).
const navSections = [
  {
    label: 'Predictions',
    items: [
      { label: 'Upcoming', icon: Clock, path: '/model/upcoming' },
      { label: 'Picks', icon: Target, path: '/picks' },
      { label: 'Past Results', icon: History, path: '/results' },
      { label: 'Hypothetical', icon: Shuffle, path: '/ufc/hypothetical', match: ['/ufc/hypothetical/breakdown'] },
    ],
  },
  {
    label: 'Events',
    items: [
      { label: 'Events & Fights', icon: Calendar, path: '/ufc/events' },
      { label: 'Articles', icon: Newspaper, path: '/ufc/articles' },
    ],
  },
  {
    label: 'Fighters',
    items: [
      { label: 'Rankings', icon: TrendingUp, path: '/ufc/rankings' },
      { label: 'Fighter Stats', icon: BarChart3, path: '/ufc/fighters/stats' },
      { label: 'Fighter Skills', icon: Layers, path: '/ufc/fighters/skills', match: ['/ufc/fighters/decompositions'] },
      { label: 'Fighter Styles', icon: Orbit, path: '/ufc/fighters/styles' },
    ],
  },
]

const isActive = (item, pathname) => item.path === pathname || (item.match?.includes(pathname) ?? false)

export default function Sidebar({ open, onClose }) {
  // Read on every render so back/forward and in-page links keep the highlight right.
  const { pathname } = useLocation()

  const sidebarContent = (
    <div className="flex h-full flex-col rounded-xl bg-ink shadow-lg">
      <Link to="/" onClick={onClose} className="px-3.5 pt-5 pb-4 2xl:px-4">
        <BrandLockup />
      </Link>

      <div className="mx-4 border-t border-white/10" />

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {navSections.map((section) => (
          <div key={section.label} className="mt-4">
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item, pathname)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-white/10 font-semibold text-white before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary'
                        : 'text-neutral-300 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      {/* 224px below 2xl: on a laptop the page needs the room more than the nav does. */}
      <aside className="hidden md:block w-56 2xl:w-64 shrink-0 p-3 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside className="relative w-64 h-full p-3">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

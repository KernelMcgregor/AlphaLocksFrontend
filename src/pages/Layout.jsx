import { ChevronsRight, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb'
import { fetchRankings, fetchUpcomingEvents } from '../../lib/api'
import Sidebar from './Sidebar'

function AppBreadcrumb() {
  const location = useLocation()
  const path = location.pathname

  // The UFC landing page titles itself; a one-item 'UFC' breadcrumb above it just
  // repeats the heading. Upcoming is the same case one level down — the sidebar marks
  // the section and the page carries its own 'Upcoming' title, so "UFC » Upcoming" is
  // a third statement of the same thing, and the card grid wants the vertical space.
  if (path === '/ufc' || path === '/' || path.startsWith('/model/upcoming')) return null

  // Build breadcrumb segments
  const crumbs = [{ label: 'UFC', path: '/' }]

  if (path.startsWith('/arbitrage')) {
    crumbs.push({ label: 'Arbitrage', path: null })
  } else if (path.startsWith('/ufc/rankings')) {
    crumbs.push({ label: 'Rankings', path: null })
  } else if (path === '/ufc/fighters/stats') {
    crumbs.push({ label: 'Fighter Stats', path: null })
  } else if (path === '/ufc/fighters/skills' || path === '/ufc/fighters/decompositions') {
    crumbs.push({ label: 'Fighter Skills', path: null })
  } else if (path.startsWith('/ufc/fighters/')) {
    crumbs.push({ label: 'Fighter Profile', path: null })
  } else if (path.startsWith('/ufc/fights/') && path.endsWith('/preview')) {
    crumbs.push({ label: 'Fight Preview', path: null })
  } else if (path.startsWith('/ufc/fights/')) {
    crumbs.push({ label: 'Fight Details', path: null })
  } else if (path === '/ufc/articles') {
    crumbs.push({ label: 'Articles', path: null })
  } else if (path === '/ufc/events') {
    crumbs.push({ label: 'Events & Fights', path: null })
  // '/ufc' is the section landing page — the root crumb already names it, so it gets no
  // second segment.
  } else if (path === '/' || path.startsWith('/model/upcoming')) {
    crumbs.push({ label: 'Upcoming', path: null })
  } else if (path.startsWith('/admin')) {
    crumbs.push({ label: 'Admin', path: null })
  }

  // Mark last item as current page
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <BreadcrumbItem key={crumb.label}>
              {i > 0 && (
                <BreadcrumbSeparator>
                  <ChevronsRight />
                </BreadcrumbSeparator>
              )}
              {isLast || !crumb.path ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.path}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // Pages that draw their own mobile header (FighterProfilePage) open the drawer
  // through this event rather than reaching into Layout's state.
  useEffect(() => {
    const open = () => setSidebarOpen(true)
    window.addEventListener('alocks:open-sidebar', open)
    return () => window.removeEventListener('alocks:open-sidebar', open)
  }, [])

  // Warm the two payloads most pages open with — the upcoming slate (Upcoming, UFC home)
  // and rankings (Rankings, Fighter Stats/Skills, every fighter profile) — into the api
  // cache at app start, so whichever page is visited next renders from memory. Failures
  // are ignored: the page fetches again on its own and shows its loader.
  useEffect(() => {
    fetchUpcomingEvents().catch(() => {})
    fetchRankings().catch(() => {})
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden px-3 py-4 md:px-4 md:py-4">
        <div className="mb-3 shrink-0 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <AppBreadcrumb />
          {/* Pages render their own actions here via <HeaderActions> so they don't
              need to spend a second full-width row on a toolbar. */}
          <div id="page-header-actions" className="ml-auto flex items-center gap-2" />
        </div>
        <div className="flex-1 overflow-auto md:overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}

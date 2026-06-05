import { ChevronsRight } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb'
import Sidebar from './Sidebar'

function AppBreadcrumb() {
  const location = useLocation()
  const path = location.pathname

  // Build breadcrumb segments
  const crumbs = [{ label: 'Dashboard', path: '/' }]

  if (path.startsWith('/arbitrage')) {
    crumbs.push({ label: 'UFC', path: '/ufc' })
    crumbs.push({ label: 'Model', path: '/model/upcoming' })
    crumbs.push({ label: 'Arbitrage', path: null })
  } else if (path.startsWith('/ufc') || path.startsWith('/model')) {
    crumbs.push({ label: 'UFC', path: '/ufc' })
    if (path.startsWith('/ufc/fights/')) {
      crumbs.push({ label: 'Fight Details', path: null })
    } else if (path.startsWith('/model')) {
      crumbs.push({ label: 'Model', path: '/model/upcoming' })
      if (path === '/model/upcoming') crumbs.push({ label: 'Upcoming', path: null })
      else if (path === '/model/past') crumbs.push({ label: 'Past Fights', path: null })
      else if (path === '/model/metrics') crumbs.push({ label: 'Metrics', path: null })
    }
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
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden px-8 py-6">
        <div className="mb-4 shrink-0">
          <AppBreadcrumb />
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}

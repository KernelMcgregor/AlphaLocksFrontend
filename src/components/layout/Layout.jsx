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
import Sidebar from './Sidebar'

function AppBreadcrumb() {
  const location = useLocation()
  const path = location.pathname

  // Build breadcrumb segments
  const crumbs = [{ label: 'UFC', path: '/' }]

  if (path.startsWith('/arbitrage')) {
    crumbs.push({ label: 'Arbitrage', path: null })
  } else if (path.startsWith('/ufc/rankings')) {
    crumbs.push({ label: 'Rankings', path: null })
  } else if (path.startsWith('/ufc/fights/')) {
    crumbs.push({ label: 'Fight Details', path: null })
  } else if (path === '/ufc') {
    crumbs.push({ label: 'Events & Fights', path: null })
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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden px-4 py-4 md:px-8 md:py-6">
        <div className="mb-4 shrink-0 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <AppBreadcrumb />
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}

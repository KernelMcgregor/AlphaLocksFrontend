import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

import { fetchAltRankings, fetchRankings, fetchUpcomingEvents } from '../../lib/api'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // Warm the two payloads most pages open with — the upcoming slate (Upcoming, UFC home)
  // and rankings (Rankings, Fighter Stats/Skills, every fighter profile) — into the api
  // cache at app start, so whichever page is visited next renders from memory. Failures
  // are ignored: the page fetches again on its own and shows its loader.
  useEffect(() => {
    fetchUpcomingEvents().catch(() => {})
    fetchRankings().catch(() => {})
    fetchAltRankings('p4p').catch(() => {})   // the Rankings page opens on P4P
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden px-3 py-4 md:px-4 md:py-4">
        {/* Hidden on desktop when no page has portalled actions into it; on mobile it
            still holds the menu button. */}
        <div className="mb-3 shrink-0 flex items-center gap-3 md:has-[#page-header-actions:empty]:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
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

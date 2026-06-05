import { BarChart3, Brain, Calendar, ChevronRight, Clock, History, Moon, Scale, Settings, Swords, Sun, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useStore from '../../hooks/useStore'
import { cn } from '../../lib/utils'

const navTree = [
  {
    id: 'ufc',
    label: 'UFC',
    icon: Swords,
    path: '/ufc',
    children: [
      { id: 'ufc-events', label: 'Events & Fights', icon: Calendar, path: '/ufc' },
      { id: 'ufc-fighters', label: 'Fighters', icon: Users, path: '/ufc/fighters' },
      {
        id: 'model',
        label: 'Model',
        icon: Brain,
        path: '/model',
        children: [
          { id: 'model-upcoming', label: 'Upcoming', icon: Clock, path: '/model/upcoming' },
          { id: 'model-arbitrage', label: 'Arbitrage', icon: Scale, path: '/arbitrage' },
          { id: 'model-past', label: 'Past Fights', icon: History, path: '/model/past' },
          { id: 'model-metrics', label: 'Metrics', icon: BarChart3, path: '/model/metrics' },
        ],
      },
    ],
  },
]

function TreeBranch({ node, navigate, activeId, setActiveId }) {
  const [expanded, setExpanded] = useState(true)
  const Icon = node.icon
  const hasChildren = node.children?.length > 0
  const isActive = activeId === node.id

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded)
          } else {
            setActiveId(node.id)
            navigate(node.path)
          }
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          'hover:bg-white/10',
          hasChildren && 'font-medium text-white',
          isActive && 'bg-white/15 text-white font-semibold',
          !isActive && !hasChildren && 'text-blue-100',
        )}
      >
        {hasChildren ? (
          <ChevronRight className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            expanded && 'rotate-90'
          )} />
        ) : (
          <span className="w-3.5" />
        )}
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="truncate">{node.label}</span>
      </button>

      {hasChildren && expanded && (
        <div className="relative ml-[19px] border-l border-blue-400/30">
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              navigate={navigate}
              activeId={activeId}
              setActiveId={setActiveId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function getInitialActiveId(pathname) {
  function search(nodes) {
    for (const node of nodes) {
      if (node.path === pathname && !node.children) return node.id
      if (node.children) {
        const found = search(node.children)
        if (found) return found
      }
    }
    return null
  }
  return search(navTree)
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useStore()
  const [activeId, setActiveId] = useState(() => getInitialActiveId(location.pathname))

  return (
    <aside className="w-64 shrink-0 p-3 h-screen sticky top-0">
      <div className="flex h-full flex-col rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 shadow-lg">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <TrendingUp className="h-7 w-7 text-white" />
          <span className="text-xl font-bold text-white tracking-tight">ALocks</span>
        </Link>

        <div className="mx-4 border-t border-blue-400/30" />

        {/* Tree Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navTree.map((node) => (
            <TreeBranch
              key={node.id}
              node={node}
              navigate={navigate}
              activeId={activeId}
              setActiveId={setActiveId}
            />
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="mx-4 border-t border-blue-400/30" />
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-blue-100 hover:bg-white/10 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            to="/admin"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-blue-100 hover:bg-white/10 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Admin
          </Link>
        </div>
      </div>
    </aside>
  )
}

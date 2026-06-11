import { BarChart3, Brain, Calendar, ChevronRight, Clock, Scale, Swords, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

const navTree = [
  {
    id: 'ufc',
    label: 'UFC',
    icon: Swords,
    path: '/ufc',
    children: [
      { id: 'ufc-events', label: 'Events & Fights', icon: Calendar, path: '/ufc' },
      {
        id: 'model',
        label: 'Model',
        icon: Brain,
        path: '/model',
        children: [
          { id: 'model-upcoming', label: 'Upcoming', icon: Clock, path: '/model/upcoming' },
          { id: 'model-picks', label: 'Picks', icon: TrendingUp, path: '/arbitrage' },
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

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeId, setActiveId] = useState(() => getInitialActiveId(location.pathname))

  const handleNavigate = (path) => {
    navigate(path)
    onClose?.()
  }

  const sidebarContent = (
    <div className="flex h-full flex-col rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 shadow-lg">
      {/* Logo */}
      <Link to="/" onClick={onClose} className="flex items-center gap-2.5 px-5 pt-5 pb-4">
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
            navigate={handleNavigate}
            activeId={activeId}
            setActiveId={setActiveId}
          />
        ))}
      </nav>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 shrink-0 p-3 h-screen sticky top-0">
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

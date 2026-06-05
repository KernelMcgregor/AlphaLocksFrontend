import { TrendingUp } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

const navLinks = [
  { name: 'UFC', path: '/ufc' },
  { name: 'Predictions', path: '/predictions' },
]

export default function Navbar() {
  const location = useLocation()

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <TrendingUp className="h-6 w-6" />
            ALocks
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === link.path
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Admin
          </Link>
        </div>
      </div>
    </nav>
  )
}

import { NavLink } from 'react-router-dom'
import { Home, Route as RouteIcon, UserCircle, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/route', icon: RouteIcon, label: 'Route' },
  { to: '/setup', icon: UserCircle, label: 'Profile' },
  { to: '/alert', icon: Bell, label: 'Alerts' },
]

export default function BottomNav() {
  return (
    <nav className="z-50 border-t border-border bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-primary/10',
                  )}
                >
                  <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

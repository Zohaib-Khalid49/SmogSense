import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Route as RouteIcon, UserCircle, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasUnreadAlert, clearAlertUnread, onAlertUnreadChange } from '@/lib/push'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/route', icon: RouteIcon, label: 'Route' },
  { to: '/setup', icon: UserCircle, label: 'Profile' },
  { to: '/alert', icon: Bell, label: 'Alerts', badgeable: true },
]

export default function BottomNav() {
  const location = useLocation()
  const [unread, setUnread] = useState(() => hasUnreadAlert())

  // Keep the badge in sync with the unread flag (same-tab + cross-tab).
  useEffect(() => onAlertUnreadChange(setUnread), [])

  // Opening the Alerts tab marks everything as read.
  useEffect(() => {
    if (location.pathname === '/alert') {
      clearAlertUnread()
    }
  }, [location.pathname])

  return (
    <nav className="z-50 border-t border-border bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-center justify-around py-2 sm:max-w-lg">
        {NAV_ITEMS.map(({ to, icon: Icon, label, badgeable }) => {
          const showBadge = badgeable && unread
          return (
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
                      'relative flex size-8 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-primary/10',
                    )}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} />
                    {showBadge && (
                      <span
                        className="absolute right-1 top-1 size-2.5 rounded-full bg-destructive ring-2 ring-card"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <span>
                    {label}
                    {showBadge && <span className="sr-only"> (new alert)</span>}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

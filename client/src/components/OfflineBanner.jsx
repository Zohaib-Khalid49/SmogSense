import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Online/offline indicator banner.
 *
 * - When offline: shows "You're offline — showing cached data"
 * - When back online: briefly shows "Back online" then auto-dismisses
 *
 * Renders inside AppLayout, above page content.
 */
export default function OfflineBanner() {
  const [state, setState] = useState(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'hidden'
  })

  useEffect(() => {
    function handleOffline() {
      setState('offline')
    }

    function handleOnline() {
      setState('online')
      // Auto-dismiss "back online" after 3 seconds
      setTimeout(() => setState('hidden'), 3000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (state === 'hidden') return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium transition-all',
        state === 'offline'
          ? 'bg-amber-500/90 text-white'
          : 'bg-green-500/90 text-white',
      )}
      role="status"
      aria-live="polite"
    >
      {state === 'offline' ? (
        <>
          <WifiOff className="size-3.5" />
          <span>You&apos;re offline — showing cached data</span>
        </>
      ) : (
        <>
          <Wifi className="size-3.5" />
          <span>Back online</span>
        </>
      )}
    </div>
  )
}

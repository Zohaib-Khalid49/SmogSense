import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Route as RouteIcon,
  Loader2,
  CloudSun,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import HazardCard from '@/components/HazardCard'
import LocationHint from '@/components/LocationHint'
import StatusMessage from '@/components/StatusMessage'
import { getHazardStatus } from '@/api/client'
import { getLocation } from '@/lib/geolocation'
import { getUserMessage } from '@/api/apiError'
import { loadProfiles } from '@/lib/storage'
import { getProfileType } from '@/lib/profiles'

const POLL_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  // Data states
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [noData, setNoData] = useState(false)

  // Geolocation
  const [geo, setGeo] = useState(null)

  // Profile switcher
  const [profiles, setProfiles] = useState(() => loadProfiles())
  const [activeProfileIndex, setActiveProfileIndex] = useState(0)
  const activeProfile = profiles[activeProfileIndex] ?? null
  const activeCategory = activeProfile?.profileId ?? 'adult'

  // Refs for cleanup
  const pollTimer = useRef(null)
  const abortRef = useRef(false)

  // Reload profiles from localStorage (in case they changed on the setup page)
  useEffect(() => {
    function handleStorage() {
      setProfiles(loadProfiles())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Also refresh profiles when the page becomes visible (navigated back from setup)
  useEffect(() => {
    function handleVisibilityProfiles() {
      if (document.visibilityState === 'visible') {
        setProfiles(loadProfiles())
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityProfiles)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityProfiles)
  }, [])

  /**
   * Fetch hazard status using current geo + active profile category.
   */
  const fetchStatus = useCallback(
    async (currentGeo, profileCategory) => {
      abortRef.current = false
      setLoading(true)
      setError(null)
      setNoData(false)

      try {
        const result = await getHazardStatus({
          lat: currentGeo?.lat,
          lng: currentGeo?.lng,
          profileCategory,
        })

        if (abortRef.current) return

        if (result === null) {
          setNoData(true)
          setStatus(null)
        } else {
          setStatus(result)
        }
      } catch (err) {
        if (abortRef.current) return
        setError(err)
      } finally {
        if (!abortRef.current) setLoading(false)
      }
    },
    [],
  )

  /**
   * Full refresh: get location then fetch status.
   */
  const refresh = useCallback(async () => {
    const loc = await getLocation()
    setGeo(loc)
    await fetchStatus(loc, activeCategory)
  }, [activeCategory, fetchStatus])

  // Initial load
  useEffect(() => {
    refresh() // eslint-disable-line react-hooks/set-state-in-effect
    return () => {
      abortRef.current = true
    }
  }, [refresh])

  // Re-fetch when active profile changes
  useEffect(() => {
    if (!geo) return
    fetchStatus(geo, activeCategory) // eslint-disable-line react-hooks/set-state-in-effect
  }, [activeCategory, geo, fetchStatus])

  // Auto-poll every 15 minutes
  useEffect(() => {
    pollTimer.current = setInterval(() => {
      if (geo) fetchStatus(geo, activeCategory)
    }, POLL_INTERVAL_MS)

    return () => clearInterval(pollTimer.current)
  }, [geo, activeCategory, fetchStatus])

  // Re-fetch when tab comes back into focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && geo) {
        fetchStatus(geo, activeCategory)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [geo, activeCategory, fetchStatus])

  // Derived
  const bandKey = status?.band ?? 'safe'
  const isFirstLoad = loading && status === null && error === null

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting + refresh button */}
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <CloudSun className="size-5 text-primary" />
        </div>
        <div className="flex flex-1 flex-col">
          <h1 className="text-lg font-bold">{getGreeting()}</h1>
          <p className="text-sm text-muted-foreground">
            Is it safe to go outside right now?
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`size-4.5 ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </header>

      {/* Profile switcher */}
      {profiles.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Viewing for</span>
          <div className="relative">
            <select
              value={activeProfileIndex}
              onChange={(e) => setActiveProfileIndex(Number(e.target.value))}
              className="appearance-none rounded-lg border border-border bg-card py-1.5 pl-3 pr-8 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {profiles.map((p, i) => {
                const type = getProfileType(p.profileId)
                return (
                  <option key={i} value={i}>
                    {p.label || type?.label || p.profileId}
                  </option>
                )
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* No profiles hint */}
      {profiles.length === 0 && (
        <Link
          to="/setup"
          className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          <span className="font-medium">Set up your profile</span>
          <span className="text-xs text-muted-foreground">
            — for personalized thresholds
          </span>
        </Link>
      )}

      {/* Location hint (shown when not using live GPS) */}
      {geo && <LocationHint hint={geo.hint} source={geo.source} />}

      {/* ── Status area: loading / error / noData / success ────────── */}

      {isFirstLoad && (
        <div className="flex min-h-56 items-center justify-center rounded-[var(--radius-card)] border border-border bg-card">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !isFirstLoad && (
        <StatusMessage
          type="error"
          message={getUserMessage(error)}
          hint="The data below may be outdated."
          onRetry={refresh}
        />
      )}

      {noData && !loading && (
        <StatusMessage
          type="noData"
          message="No air quality readings yet."
          hint="Data ingestion may not have run. Check back shortly."
          onRetry={refresh}
        />
      )}

      {status && !isFirstLoad && (
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 -z-10 translate-y-4 scale-95 rounded-[var(--radius-card)] opacity-30 blur-2xl"
            style={{ backgroundColor: `var(--${bandKey})` }}
            aria-hidden="true"
          />
          <HazardCard status={status} />
        </div>
      )}

      {/* Primary action */}
      <Button asChild size="lg" className="gap-2 shadow-sm">
        <Link to="/route">
          <RouteIcon className="size-4" />
          Plan a trip
        </Link>
      </Button>
    </div>
  )
}

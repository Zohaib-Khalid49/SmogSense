import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Route as RouteIcon, Loader2, CloudSun, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import HazardCard from '@/components/HazardCard'
import LocationHint from '@/components/LocationHint'
import StatusMessage from '@/components/StatusMessage'
import { getHazardStatus } from '@/api/client'
import { getLocation } from '@/lib/geolocation'
import { getUserMessage } from '@/api/apiError'

const POLL_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

// Dev-only toggle: only visible in dev mode AND mock mode
const SHOW_DEV_TOGGLE =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS !== 'false'
const DEV_BANDS = ['safe', 'caution', 'hazard']

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
  const [error, setError] = useState(null)  // ApiError or Error
  const [noData, setNoData] = useState(false)

  // Geolocation
  const [geo, setGeo] = useState(null) // { lat, lng, source, hint }

  // Dev toggle (only used when SHOW_DEV_TOGGLE is true)
  const [devBand, setDevBand] = useState('hazard')

  // Refs for cleanup
  const pollTimer = useRef(null)
  const abortRef = useRef(false)

  /**
   * Fetch hazard status using current geo + optional dev band override.
   * Handles loading, error, and noData states.
   */
  const fetchStatus = useCallback(
    async (currentGeo, band) => {
      abortRef.current = false
      setLoading(true)
      setError(null)
      setNoData(false)

      try {
        const result = await getHazardStatus({
          lat: currentGeo?.lat,
          lng: currentGeo?.lng,
          band: SHOW_DEV_TOGGLE ? band : undefined,
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
        // Keep stale status visible if we had one
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
    await fetchStatus(loc, devBand)
  }, [devBand, fetchStatus])

  // Initial load
  useEffect(() => {
    refresh() // eslint-disable-line react-hooks/set-state-in-effect
    return () => {
      abortRef.current = true
    }
  }, [refresh])

  // Re-fetch when dev band changes (dev mode only)
  useEffect(() => {
    if (!SHOW_DEV_TOGGLE || !geo) return
    fetchStatus(geo, devBand) // eslint-disable-line react-hooks/set-state-in-effect
  }, [devBand, geo, fetchStatus])

  // Auto-poll every 15 minutes
  useEffect(() => {
    pollTimer.current = setInterval(() => {
      if (geo) fetchStatus(geo, devBand)
    }, POLL_INTERVAL_MS)

    return () => clearInterval(pollTimer.current)
  }, [geo, devBand, fetchStatus])

  // Re-fetch when tab comes back into focus
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && geo) {
        fetchStatus(geo, devBand)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [geo, devBand, fetchStatus])

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

      {/* Location hint (shown when not using live GPS) */}
      {geo && <LocationHint hint={geo.hint} source={geo.source} />}

      {/* ── Status area: loading / error / noData / success ────────── */}

      {/* First load spinner */}
      {isFirstLoad && (
        <div className="flex min-h-56 items-center justify-center rounded-[var(--radius-card)] border border-border bg-card">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state (with stale data still visible below if available) */}
      {error && !isFirstLoad && (
        <StatusMessage
          type="error"
          message={getUserMessage(error)}
          hint="The data below may be outdated."
          onRetry={refresh}
        />
      )}

      {/* No data state */}
      {noData && !loading && (
        <StatusMessage
          type="noData"
          message="No air quality readings yet."
          hint="Data ingestion may not have run. Check back shortly."
          onRetry={refresh}
        />
      )}

      {/* Hazard card (shown on success, or stale during a background refresh) */}
      {status && !isFirstLoad && (
        <div className="relative">
          {/* Colored glow behind the card */}
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

      {/* Dev-only band preview toggle */}
      {SHOW_DEV_TOGGLE && (
        <div className="mt-2 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Dev preview — switch band
          </p>
          <div className="flex gap-2">
            {DEV_BANDS.map((b) => (
              <Button
                key={b}
                size="sm"
                variant={devBand === b ? 'default' : 'outline'}
                onClick={() => setDevBand(b)}
                className="flex-1 capitalize"
              >
                {b}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

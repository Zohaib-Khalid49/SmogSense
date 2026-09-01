import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Route as RouteIcon, Loader2, CloudSun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import HazardCard from '@/components/HazardCard'
import { getHazardStatus } from '@/api/mockApi'

// Dev-only toggle so we can preview every band state while building.
const DEV_BANDS = ['safe', 'caution', 'hazard']

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const [status, setStatus] = useState(null)
  const [devBand, setDevBand] = useState('hazard')

  // status is null while a fetch for the current band is in flight
  const loading = status === null || status.band !== devBand

  useEffect(() => {
    let active = true
    getHazardStatus({ band: devBand }).then((data) => {
      if (active) setStatus(data)
    })
    return () => {
      active = false
    }
  }, [devBand])

  const bandKey = status?.band ?? 'safe'

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting */}
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <CloudSun className="size-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold">{getGreeting()}</h1>
          <p className="text-sm text-muted-foreground">
            Is it safe to go outside right now?
          </p>
        </div>
      </header>

      {/* Hazard status with glow */}
      <div className="relative">
        {/* Colored glow behind the card that adapts to the current band */}
        {!loading && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 translate-y-4 scale-95 rounded-[var(--radius-card)] opacity-30 blur-2xl"
            style={{ backgroundColor: `var(--${bandKey})` }}
            aria-hidden="true"
          />
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-[var(--radius-card)] border border-border bg-card">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <HazardCard status={status} />
        )}
      </div>

      {/* Primary action */}
      <Button asChild size="lg" className="gap-2 shadow-sm">
        <Link to="/route">
          <RouteIcon className="size-4" />
          Plan a trip
        </Link>
      </Button>

      {/* Dev-only band preview toggle (remove before production) */}
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
    </div>
  )
}

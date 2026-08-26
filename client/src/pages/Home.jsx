import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Route as RouteIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import HazardCard from '@/components/HazardCard'
import { getHazardStatus } from '@/api/mockApi'

// Dev-only toggle so we can preview every band state while building.
const DEV_BANDS = ['safe', 'caution', 'hazard']

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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-xl font-bold">SmogSense</h1>
        <p className="text-sm text-muted-foreground">
          Is it safe to go outside right now?
        </p>
      </header>

      {/* Hazard status */}
      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[var(--radius-card)] border border-border bg-card">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <HazardCard status={status} />
      )}

      {/* Primary action */}
      <Button asChild size="lg" className="gap-2">
        <Link to="/route">
          <RouteIcon className="size-4" />
          Plan a trip
        </Link>
      </Button>

      {/* Dev-only band preview toggle (remove before production) */}
      <div className="mt-2 rounded-lg border border-dashed border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Dev preview — hazard band
        </p>
        <div className="flex gap-2">
          {DEV_BANDS.map((b) => (
            <Button
              key={b}
              size="sm"
              variant={devBand === b ? 'default' : 'outline'}
              onClick={() => setDevBand(b)}
              className="capitalize"
            >
              {b}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

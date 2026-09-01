import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline } from 'react-leaflet'
import {
  Loader2,
  MapPin,
  Navigation,
  Star,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BAND_CONFIG } from '@/lib/hazard'
import { getRouteComparison } from '@/api/mockApi'

/** Color for route polylines based on band */
const POLYLINE_COLORS = {
  safe: '#16a34a',
  caution: '#f59e0b',
  hazard: '#dc2626',
}

export default function RouteCheck() {
  const [data, setData] = useState(null)
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [searched, setSearched] = useState(true) // auto-search on mount

  const loading = searched && data === null

  function handleSearch(e) {
    e.preventDefault()
    setSearched(true)
    setData(null)
    getRouteComparison().then((result) => {
      setData(result)
      if (!origin) setOrigin(result.origin)
      if (!destination) setDestination(result.destination)
    })
  }

  // Auto-search on first mount for demo purposes
  useEffect(() => {
    let active = true
    getRouteComparison().then((result) => {
      if (active) {
        setData(result)
        setOrigin(result.origin)
        setDestination(result.destination)
      }
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">Route Check</h1>
        <p className="text-sm text-muted-foreground">
          Compare air quality between two route options.
        </p>
      </header>

      {/* Origin / Destination form */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2.5">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Origin (e.g. Gulberg III)"
            className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="relative">
          <Navigation className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination (e.g. Johar Town)"
            className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" className="self-end shadow-sm">
          Compare routes
        </Button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex min-h-44 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Map + comparison */}
      {data && (
        <>
          {/* Leaflet map */}
          <div className="overflow-hidden rounded-2xl border border-border shadow-md">
            <MapContainer
              center={[31.515, 74.365]}
              zoom={14}
              scrollWheelZoom={false}
              className="z-0 h-56 w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {data.routes.map((route) => (
                <Polyline
                  key={route.id}
                  positions={route.coords}
                  pathOptions={{
                    color: POLYLINE_COLORS[route.band] ?? '#64748b',
                    weight: route.id === data.recommended ? 5 : 3,
                    opacity: route.id === data.recommended ? 1 : 0.6,
                    dashArray: route.id === data.recommended ? undefined : '8 6',
                  }}
                />
              ))}
            </MapContainer>
          </div>

          {/* Route comparison cards */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Route comparison</p>
            {data.routes.map((route) => {
              const cfg = BAND_CONFIG[route.band] ?? BAND_CONFIG.hazard
              const isRecommended = route.id === data.recommended
              return (
                <Card
                  key={route.id}
                  className={cn(
                    'overflow-hidden transition-all',
                    isRecommended && 'ring-2 ring-primary/30 shadow-md',
                  )}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* PM2.5 circle */}
                    <div
                      className={cn(
                        'flex size-12 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm',
                        cfg.bg,
                      )}
                    >
                      <span className="text-sm font-bold">{route.pm25}</span>
                    </div>

                    {/* Route info */}
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {route.label}
                        </span>
                        {isRecommended && (
                          <Badge
                            variant="secondary"
                            className="gap-0.5 text-[10px] font-medium"
                          >
                            <Star className="size-3" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{route.distance}</span>
                        <span>{route.duration}</span>
                        <span className={cn('font-medium', cfg.text)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* External directions link */}
          <Button asChild variant="outline" className="gap-2 shadow-sm">
            <a
              href={`https://www.google.com/maps/dir/${encodeURIComponent(data.origin)}/${encodeURIComponent(data.destination)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" />
              Open in Google Maps
            </a>
          </Button>
        </>
      )}
    </div>
  )
}

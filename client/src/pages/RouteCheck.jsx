import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import {
  Loader2,
  MapPin,
  Star,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BAND_CONFIG } from '@/lib/hazard'
import { getRouteCheck } from '@/api/client'
import { getLocation } from '@/lib/geolocation'
import LocationSearch from '@/components/LocationSearch'
import StatusMessage from '@/components/StatusMessage'
import { getUserMessage } from '@/api/apiError'

const BAND_HEX = {
  safe: '#16a34a',
  caution: '#f59e0b',
  hazard: '#dc2626',
}

/** Build a colored circular map marker for a given band. */
function bandMarker(band) {
  const color = BAND_HEX[band] ?? '#64748b'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export default function RouteCheck() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Origin from geolocation
  const [origin, setOrigin] = useState(null) // { label, lat, lng }
  // Destination chosen via autocomplete
  const [destination, setDestination] = useState(null) // { label, lat, lng }

  // Detect origin on mount
  useEffect(() => {
    let active = true
    getLocation().then((loc) => {
      if (!active) return
      setOrigin({
        label: loc.source === 'gps' ? 'Your current location' : 'Central Lahore',
        lat: loc.lat,
        lng: loc.lng,
      })
    })
    return () => {
      active = false
    }
  }, [])

  const canCompare = origin && destination && !loading

  function handleCompare(e) {
    e.preventDefault()
    if (!origin || !destination) return
    setLoading(true)
    setError(null)
    setData(null)
    getRouteCheck({
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: destination.lat,
      destLng: destination.lng,
    })
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(err)
        setLoading(false)
      })
  }

  // Map center = midpoint between origin and destination (or Lahore center)
  const mapCenter = useMemo(() => {
    if (origin && destination) {
      return [(origin.lat + destination.lat) / 2, (origin.lng + destination.lng) / 2]
    }
    if (origin) return [origin.lat, origin.lng]
    return [31.5204, 74.3587]
  }, [origin, destination])

  // Which route is recommended (for line color)
  const recommendedBand = useMemo(() => {
    if (!data || data.routes.length < 2) return 'caution'
    const rec = data.routes.find((r) => r.id === data.recommended)
    return rec?.band ?? 'caution'
  }, [data])

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">Route Check</h1>
        <p className="text-sm text-muted-foreground">
          Compare air quality between your location and a destination.
        </p>
      </header>

      {/* Inputs */}
      <form onSubmit={handleCompare} className="flex flex-col gap-2.5">
        {/* Origin — read-only, from geolocation */}
        <div className="flex items-center gap-3 rounded-xl border border-input bg-muted/40 px-4 py-3">
          <MapPin className="size-4 flex-shrink-0 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <span className="text-sm font-medium">
              {origin ? origin.label : 'Detecting your location…'}
            </span>
          </div>
        </div>

        {/* Destination — autocomplete search */}
        <LocationSearch
          placeholder="Search destination (e.g. Johar Town)"
          selected={destination}
          onSelect={setDestination}
        />

        <Button
          type="submit"
          disabled={!canCompare}
          className="self-end shadow-sm"
        >
          {loading ? 'Comparing…' : 'Compare routes'}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <StatusMessage
          type="error"
          message={getUserMessage(error)}
          onRetry={handleCompare}
        />
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex min-h-44 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Results */}
      {data && data.routes.length > 0 && origin && destination && (
        <>
          {/* Map with two colored markers + connecting line */}
          <div className="overflow-hidden rounded-2xl border border-border shadow-md">
            <MapContainer
              key={`${origin.lat},${destination.lat}`}
              center={mapCenter}
              zoom={12}
              scrollWheelZoom={false}
              className="z-0 h-56 w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline
                positions={[
                  [origin.lat, origin.lng],
                  [destination.lat, destination.lng],
                ]}
                pathOptions={{
                  color: BAND_HEX[recommendedBand] ?? '#64748b',
                  weight: 4,
                  opacity: 0.7,
                  dashArray: '8 6',
                }}
              />
              <Marker
                position={[origin.lat, origin.lng]}
                icon={bandMarker(data.routes[0]?.band)}
              >
                <Popup>{origin.label}</Popup>
              </Marker>
              <Marker
                position={[destination.lat, destination.lng]}
                icon={bandMarker(data.routes[1]?.band)}
              >
                <Popup>{destination.label}</Popup>
              </Marker>
            </MapContainer>
          </div>

          {/* Verdict */}
          <div
            className={cn(
              'rounded-xl px-4 py-3 text-sm',
              data.meaningfulDifference
                ? 'bg-primary/5 text-foreground'
                : 'bg-muted/50 text-muted-foreground',
            )}
          >
            {data.advice ||
              (data.meaningfulDifference
                ? 'One area has meaningfully cleaner air.'
                : 'Both areas have similar air quality right now.')}
            {data.reliable === false && (
              <span className="mt-1 block text-xs text-caution">
                Based on model estimates — treat as approximate.
              </span>
            )}
          </div>

          {/* Comparison cards */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Comparison</p>
            {data.routes.map((route) => {
              const cfg = BAND_CONFIG[route.band] ?? BAND_CONFIG.hazard
              const isRecommended = route.id === data.recommended
              const label =
                route.id === 'origin' ? origin.label : destination.label
              return (
                <Card
                  key={route.id}
                  className={cn(
                    'overflow-hidden transition-all',
                    isRecommended && 'ring-2 ring-primary/30 shadow-md',
                  )}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={cn(
                        'flex size-12 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm',
                        cfg.bg,
                      )}
                    >
                      <span className="text-sm font-bold">{route.pm25}</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{label}</span>
                        {isRecommended && data.meaningfulDifference && (
                          <Badge
                            variant="secondary"
                            className="gap-0.5 text-[10px] font-medium"
                          >
                            <Star className="size-3" />
                            Cleaner
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className={cn('font-medium', cfg.text)}>
                          {cfg.label}
                        </span>
                        <span>PM2.5 {route.pm25} µg/m³</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* External directions */}
          <Button asChild variant="outline" className="gap-2 shadow-sm">
            <a
              href={`https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`}
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

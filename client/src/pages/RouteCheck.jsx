import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import {
  Loader2,
  MapPin,
  Wind,
  ExternalLink,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BAND_CONFIG, BAND_HEX, NEUTRAL_HEX } from '@/lib/hazard'
import { getRouteCheck } from '@/api/client'
import { getLocation, LAHORE_CENTER } from '@/lib/geolocation'
import { getHomeLocation } from '@/lib/storage'
import LocationSearch from '@/components/LocationSearch'
import LocationHint from '@/components/LocationHint'
import StatusMessage from '@/components/StatusMessage'
import { getUserMessage } from '@/api/apiError'

/** Build a colored circular map marker for a given band. */
function bandMarker(band) {
  const color = BAND_HEX[band] ?? NEUTRAL_HEX
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

/**
 * Derive an honest origin label from how the position was obtained.
 * The fallback coords are either the saved home area or central Lahore —
 * comparing against LAHORE_CENTER tells them apart.
 */
function originLabel(loc) {
  if (loc.source === 'gps') return 'Your location'
  if (loc.source === 'cached') return 'Your location (last known)'
  if (loc.lat === LAHORE_CENTER.lat && loc.lng === LAHORE_CENTER.lng) {
    return 'Central Lahore'
  }
  return getHomeLocation()?.label || 'Your saved area'
}

export default function RouteCheck() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Origin from geolocation — read-only, auto-detected (not user-selectable)
  const [origin, setOrigin] = useState(null) // { label, lat, lng, hint, source }
  const [locating, setLocating] = useState(false)
  // Destination chosen via autocomplete
  const [destination, setDestination] = useState(null) // { label, lat, lng }

  // Wrapper around the map so we can strip Leaflet's native `title` attributes
  // (zoom in/out, attribution) that otherwise show ugly black browser tooltips.
  const mapWrapRef = useRef(null)

  // Apply a detected position as the origin, with an honest label for how
  // it was obtained (gps / last known / saved home / central Lahore).
  const applyOrigin = useCallback((loc) => {
    setOrigin({
      label: originLabel(loc),
      lat: loc.lat,
      lng: loc.lng,
      hint: loc.hint,
      source: loc.source,
    })
  }, [])

  // Detect origin on mount
  useEffect(() => {
    let active = true
    getLocation().then((loc) => {
      if (!active) return
      applyOrigin(loc)
    })
    return () => {
      active = false
    }
  }, [applyOrigin])

  // Re-request location from the hint's "Enable location" CTA
  function handleLocRetry() {
    setLocating(true)
    getLocation()
      .then(applyOrigin)
      .finally(() => setLocating(false))
  }

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

  // Strip Leaflet's native `title` attributes (zoom controls, attribution)
  // so they don't render as default black browser tooltips. Runs whenever the
  // map (re)mounts with new data.
  useEffect(() => {
    if (!data) return
    const el = mapWrapRef.current
    if (!el) return
    const strip = () => {
      el.querySelectorAll('[title]').forEach((node) => node.removeAttribute('title'))
    }
    // Run now and shortly after, since Leaflet adds controls asynchronously.
    strip()
    const t = setTimeout(strip, 300)
    return () => clearTimeout(t)
  }, [data])

  // ── Interpret the result as destination-awareness advice ─────────────
  // The question we answer: "I want to go to <destination> — how's the air
  // there compared to where I am now, and should I go?"
  //
  // The backend gives the current nearest-station reading at each point.
  // We compare the destination against the user's current location and give
  // a directional verdict. We do NOT claim to know *why* two readings match
  // (e.g. shared station) and we do NOT suggest a "better time" — there's no
  // forecast in the backend, so that would be a guess.
  const verdict = useMemo(() => {
    if (!data || !origin || !destination) return null
    const routes = data.routes ?? []
    const originRoute = routes.find((r) => r.id === 'origin') ?? routes[0]
    const destRoute = routes.find((r) => r.id === 'destination') ?? routes[1]
    if (!originRoute || !destRoute) return null

    const originPm = originRoute.pm25
    const destPm = destRoute.pm25
    const diff = Math.abs(originPm - destPm)
    const meaningful = data.meaningfulDifference === true

    // Direction is framed around the destination the user wants to visit.
    let tone // 'destCleaner' | 'destWorse' | 'similar'
    let title
    let detail

    // NOTE: we intentionally do NOT use the backend's `advice` string here —
    // it's phrased around "routes" (primary/alternate), which is misleading
    // for this destination-vs-current comparison. We write our own copy that
    // matches what the data actually represents.
    if (meaningful && destPm < originPm) {
      tone = 'destCleaner'
      title = `Air is cleaner in ${destination.label}`
      detail = `PM2.5 is about ${diff} µg/m³ lower there than where you are now — a good time to go.`
    } else if (meaningful && destPm > originPm) {
      tone = 'destWorse'
      title = `Air is worse in ${destination.label} right now`
      detail = `PM2.5 is about ${diff} µg/m³ higher there than where you are. If your trip can wait, consider going when the air improves — or mask up and limit time outdoors.`
    } else {
      tone = 'similar'
      title = 'Air quality is about the same'
      detail = `${destination.label} reads similar to where you are right now, so air quality isn't a reason to delay. Choose based on traffic and convenience.`
    }

    return { tone, title, detail, destRoute, originRoute }
  }, [data, origin, destination])

  const verdictColor = {
    destCleaner: 'border-safe/30 bg-safe/5',
    destWorse: 'border-caution/30 bg-caution/5',
    similar: 'border-border bg-muted/40',
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">Going somewhere?</h1>
        <p className="text-sm text-muted-foreground">
          Check the air where you&apos;re headed before you set off.
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

        {/* Why we're not on live GPS (if applicable) — with retry */}
        <LocationHint
          hint={origin?.hint}
          source={origin?.source}
          onRetry={handleLocRetry}
          retrying={locating}
        />

        {/* Destination — autocomplete search */}
        <LocationSearch
          placeholder="Compare with… (e.g. Johar Town)"
          selected={destination}
          onSelect={setDestination}
        />

        <Button
          type="submit"
          disabled={!canCompare}
          className="self-end shadow-sm"
        >
          {loading ? 'Comparing…' : 'Compare air quality'}
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
      {verdict && origin && destination && (
        <>
          {/* Primary verdict card — the actual answer */}
          <div
            className={cn(
              'flex flex-col gap-1.5 rounded-2xl border px-4 py-4 shadow-sm',
              verdictColor[verdict.tone],
            )}
          >
            <div className="flex items-center gap-2">
              {verdict.tone === 'destCleaner' ? (
                <Wind className="size-4 flex-shrink-0 text-safe" />
              ) : verdict.tone === 'destWorse' ? (
                <AlertTriangle className="size-4 flex-shrink-0 text-caution" />
              ) : (
                <Info className="size-4 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">{verdict.title}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {verdict.detail}
            </p>
            {data.reliable === false && (
              <span className="mt-0.5 text-xs text-caution">
                Based on model estimates — treat as approximate.
              </span>
            )}
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-3">
            {[verdict.originRoute, verdict.destRoute].map((route, i) => {
              const cfg = BAND_CONFIG[route.band] ?? BAND_CONFIG.hazard
              const label = i === 0 ? origin.label : destination.label
              // Highlight the destination card only when it's meaningfully cleaner.
              const isCleaner =
                verdict.tone === 'destCleaner' && route.id === 'destination'
              return (
                <Card
                  key={route.id}
                  className={cn(
                    'overflow-hidden transition-all',
                    isCleaner && 'ring-2 ring-safe/40 shadow-md',
                  )}
                >
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {i === 0 ? 'From' : 'To'}
                    </span>
                    <div
                      className={cn(
                        'flex size-14 items-center justify-center rounded-full text-white shadow-sm',
                        cfg.bg,
                      )}
                    >
                      <div className="flex flex-col leading-none">
                        <span className="text-base font-bold">{route.pm25}</span>
                        <span className="text-[8px] font-medium opacity-90">
                          µg/m³
                        </span>
                      </div>
                    </div>
                    <span className="line-clamp-2 text-xs font-semibold leading-tight">
                      {label}
                    </span>
                    <span className={cn('text-xs font-medium', cfg.text)}>
                      {cfg.label}
                    </span>
                    {isCleaner && (
                      <Badge
                        variant="secondary"
                        className="gap-0.5 bg-safe/10 text-[10px] font-medium text-safe"
                      >
                        <Wind className="size-3" />
                        Cleaner air
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Map — spatial context, not a route. Neutral connector line. */}
          <div
            ref={mapWrapRef}
            className="overflow-hidden rounded-2xl border border-border shadow-md"
          >
            <MapContainer
              key={`${origin.lat},${destination.lat}`}
              center={mapCenter}
              zoom={12}
              scrollWheelZoom={false}
              className="z-0 h-52 w-full"
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
                  color: NEUTRAL_HEX,
                  weight: 2,
                  opacity: 0.6,
                  dashArray: '4 6',
                }}
              />
              <Marker
                position={[origin.lat, origin.lng]}
                icon={bandMarker(verdict.originRoute.band)}
              >
                <Popup>{origin.label}</Popup>
              </Marker>
              <Marker
                position={[destination.lat, destination.lng]}
                icon={bandMarker(verdict.destRoute.band)}
              >
                <Popup>{destination.label}</Popup>
              </Marker>
            </MapContainer>
          </div>

          {/* External directions — the one genuinely useful travel action */}
          <Button asChild variant="outline" className="gap-2 shadow-sm">
            <a
              href={`https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" />
              Get directions in Google Maps
            </a>
          </Button>
        </>
      )}
    </div>
  )
}

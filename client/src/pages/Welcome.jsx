import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  ArrowRight,
  Gauge,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import LocationSearch from '@/components/LocationSearch'
import { getLocation } from '@/lib/geolocation'
import { loadUser, saveUser } from '@/lib/storage'
import { cn } from '@/lib/utils'

/**
 * One-time Welcome / onboarding screen.
 *
 * Collects an optional display name and an encouraged (but optional) home
 * location — via place search or GPS — then marks the user onboarded and
 * hands off to profile setup.
 *
 * Home location is optional by design: if the user skips it, the app falls
 * back to central Lahore. We surface that tradeoff honestly rather than
 * silently defaulting, and GPS detection reports failure instead of
 * mislabeling the fallback as the user's choice.
 */

const VALUE_POINTS = [
  {
    icon: Gauge,
    title: 'Live air quality',
    text: 'Real-time PM2.5 for where you are in Lahore.',
    accent: { bg: 'bg-sky-500/10', text: 'text-sky-700' },
  },
  {
    icon: Users,
    title: 'Made personal',
    text: 'Tailored guidance for kids, elders, and health needs.',
    accent: { bg: 'bg-violet-500/10', text: 'text-violet-700' },
  },
  {
    icon: ShieldCheck,
    title: 'Private by default',
    text: 'No account. Everything stays on this device.',
    accent: { bg: 'bg-primary/10', text: 'text-primary' },
  },
]

export default function Welcome() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [home, setHome] = useState(null) // { label, lat, lng }
  const [detecting, setDetecting] = useState(false)
  // Honest feedback for the GPS path: 'gps' | 'fallback' | null
  const [detectResult, setDetectResult] = useState(null)

  async function handleUseMyLocation() {
    setDetecting(true)
    setDetectResult(null)
    try {
      const loc = await getLocation()
      const gotGps = loc.source === 'gps'
      setHome({
        label: gotGps ? 'My current location' : 'Central Lahore (default)',
        lat: loc.lat,
        lng: loc.lng,
      })
      setDetectResult(gotGps ? 'gps' : 'fallback')
    } finally {
      setDetecting(false)
    }
  }

  function handleSelectPlace(place) {
    setHome(place)
    setDetectResult(null)
  }

  function handleClearHome() {
    setHome(null)
    setDetectResult(null)
  }

  function handleContinue() {
    const existing = loadUser()
    saveUser({
      ...existing,
      name: name.trim(),
      home,
      onboarded: true,
    })
    navigate('/')
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 pb-1 pt-6 text-center">
        <img src="/favicon.svg" alt="" className="size-16" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome to SmogSense
          </h1>
          <p className="text-sm text-muted-foreground">
            Know when Lahore&apos;s air is safe to go out.
          </p>
        </div>
      </div>

      {/* Value points */}
      <ul className="flex flex-col gap-3">
        {VALUE_POINTS.map(({ icon: Icon, title, text, accent }) => (
          <li
            key={title}
            className="flex items-start gap-3.5 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5 shadow-sm backdrop-blur-sm"
          >
            <div
              className={cn(
                'flex size-9 flex-shrink-0 items-center justify-center rounded-xl',
                accent.bg,
              )}
            >
              <Icon className={cn('size-4.5', accent.text)} strokeWidth={1.9} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold leading-tight">{title}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {text}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <label htmlFor="user-name" className="text-sm font-medium">
          Your name <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="user-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hammad"
          className="rounded-xl border border-input bg-card px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Home location */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Your home area{' '}
          <span className="text-muted-foreground">(recommended)</span>
        </label>

        {home ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 flex-shrink-0 text-primary" />
                <span className="text-sm font-medium">{home.label}</span>
              </div>
              <button
                type="button"
                onClick={handleClearHome}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            </div>
            {detectResult === 'fallback' && (
              <p className="px-1 text-xs text-caution">
                Couldn&apos;t detect your location — defaulting to central
                Lahore. Search above to set your exact area.
              </p>
            )}
          </div>
        ) : (
          <LocationSearch
            placeholder="Search your area, or tap the pin →"
            selected={null}
            onSelect={handleSelectPlace}
            onUseCurrentLocation={handleUseMyLocation}
            locating={detecting}
          />
        )}
      </div>

      {/* Continue — pushed to the bottom, adapts to whether a home is set */}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button onClick={handleContinue} size="lg" className="gap-2 shadow-sm">
          Continue
          <ArrowRight className="size-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {home
            ? 'No account needed. Your info stays on this device.'
            : 'You can skip the location for now — we\u2019ll use central Lahore.'}
        </p>
      </div>
    </div>
  )
}

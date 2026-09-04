import { useState } from 'react'
import { MapPin, X, RefreshCw, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { locationHelpText } from '@/lib/platform'

/**
 * Small inline hint shown when the app is using cached or fallback location
 * instead of live GPS. Tells the user what's happening so they're not confused.
 *
 * When location was denied/unavailable (source === 'fallback') it also offers
 * a call to action: a "Try again" button that re-requests location, plus an
 * expandable "How to enable" helper — because browsers won't let us re-open
 * the permission prompt programmatically once it's been hard-denied.
 *
 * Dismissable for the current session (reappears on reload if the condition
 * still holds), so users who understand it can clear it away.
 *
 * @param {Object} props
 * @param {string} props.hint - the hint text from geolocation.getLocation()
 * @param {'gps'|'cached'|'fallback'} props.source
 * @param {() => void} [props.onRetry] - re-request location; shows a CTA when provided
 * @param {boolean} [props.retrying] - show a spinner while a retry is in flight
 * @param {string} [props.className]
 */
export default function LocationHint({
  hint,
  source,
  onRetry,
  retrying = false,
  className,
}) {
  const [dismissed, setDismissed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  if (!hint || source === 'gps' || dismissed) return null

  const isFallback = source === 'fallback'
  const showActions = isFallback && typeof onRetry === 'function'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg px-3 py-2.5 text-xs',
        isFallback ? 'bg-caution/10 text-caution' : 'bg-muted text-muted-foreground',
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-3.5 flex-shrink-0" />
        <span className="flex-1">{hint}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {showActions && (
        <>
          <div className="flex items-center gap-2 pl-5.5">
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 rounded-md bg-caution/15 px-2.5 py-1 font-semibold transition-colors hover:bg-caution/25 disabled:opacity-60"
            >
              <RefreshCw className={cn('size-3', retrying && 'animate-spin')} />
              {retrying ? 'Checking…' : 'Enable location'}
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-expanded={showHelp}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 opacity-80 transition-opacity hover:opacity-100"
            >
              <HelpCircle className="size-3" />
              How?
            </button>
          </div>

          {showHelp && (
            <p className="pl-5.5 leading-relaxed opacity-90">
              If nothing happens, location may be blocked. {locationHelpText()}
            </p>
          )}
        </>
      )}
    </div>
  )
}

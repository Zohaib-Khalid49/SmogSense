import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Small inline hint shown when the app is using cached or fallback location
 * instead of live GPS. Tells the user what's happening so they're not confused.
 *
 * @param {Object} props
 * @param {string} props.hint - the hint text from geolocation.getLocation()
 * @param {'gps'|'cached'|'fallback'} props.source
 * @param {string} [props.className]
 */
export default function LocationHint({ hint, source, className }) {
  if (!hint || source === 'gps') return null

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
        source === 'fallback'
          ? 'bg-caution/10 text-caution'
          : 'bg-muted text-muted-foreground',
        className,
      )}
      role="status"
    >
      <MapPin className="mt-0.5 size-3.5 flex-shrink-0" />
      <span>{hint}</span>
    </div>
  )
}

import { MapPin, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { BAND_CONFIG, CONFIDENCE_LABEL, formatUpdatedAt } from '@/lib/hazard'

const BAND_ICON = {
  safe: ShieldCheck,
  caution: AlertTriangle,
  hazard: ShieldAlert,
}

/**
 * The hero of the app. Shows the current hazard band for the user's location.
 *
 * @param {Object} props
 * @param {Object} props.status - hazard status in the API contract shape
 */
export default function HazardCard({ status }) {
  const { band, pm25, confidence, recommendation, location, updatedAt } = status
  const cfg = BAND_CONFIG[band] ?? BAND_CONFIG.hazard
  const Icon = BAND_ICON[band] ?? ShieldAlert

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] shadow-lg ring-1',
        cfg.ring,
      )}
    >
      {/* Colored band header — readable in one glance */}
      <div className={cn('flex flex-col items-center gap-1 px-6 py-8 text-white', cfg.bg)}>
        <Icon className="size-10" strokeWidth={2} aria-hidden="true" />
        <p className="text-sm font-medium tracking-wide opacity-90">
          {location}
        </p>
        <h2 className="text-4xl font-extrabold tracking-tight">{cfg.label}</h2>
        <p className="text-sm font-medium opacity-90">{cfg.tagline}</p>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 bg-card p-5 text-card-foreground">
        {/* Plain-language recommendation */}
        <p className="text-base leading-relaxed">{recommendation}</p>

        {/* Supporting details */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">PM2.5</span>
            <span className="text-lg font-semibold">
              {pm25}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                µg/m³
              </span>
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="font-medium">
              {CONFIDENCE_LABEL[confidence] ?? 'Model-based estimate'}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {formatUpdatedAt(updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

import { MapPin, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { BAND_CONFIG, CONFIDENCE_LABEL, formatUpdatedAt } from '@/lib/hazard'

const BAND_ICON = {
  safe: ShieldCheck,
  caution: AlertTriangle,
  hazard: ShieldAlert,
}

/** Gradient overlays per band to add richness to the header */
const BAND_GRADIENT = {
  safe: 'from-green-600 to-emerald-500',
  caution: 'from-amber-500 to-yellow-400',
  hazard: 'from-red-600 to-rose-500',
}

/**
 * The hero of the app. Shows the current hazard band for the user's location.
 */
export default function HazardCard({ status }) {
  const { band, pm25, confidence, recommendation, location, updatedAt } = status
  const cfg = BAND_CONFIG[band] ?? BAND_CONFIG.hazard
  const Icon = BAND_ICON[band] ?? ShieldAlert
  const gradient = BAND_GRADIENT[band] ?? BAND_GRADIENT.hazard

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] shadow-xl ring-1 transition-shadow',
        cfg.ring,
      )}
    >
      {/* Colored band header with gradient */}
      <div
        className={cn(
          'relative flex flex-col items-center gap-1.5 bg-gradient-to-br px-6 py-9 text-white',
          gradient,
        )}
      >
        {/* Subtle pattern overlay for texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        <Icon className="size-11 drop-shadow-md" strokeWidth={1.8} aria-hidden="true" />
        <p className="text-sm font-medium tracking-wide opacity-90">
          {location}
        </p>
        <h2 className="text-4xl font-extrabold tracking-tight drop-shadow-sm">
          {cfg.label}
        </h2>
        <p className="text-sm font-medium opacity-80">{cfg.tagline}</p>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 bg-card p-5 text-card-foreground">
        {/* Plain-language recommendation */}
        <p className="text-[15px] leading-relaxed">{recommendation}</p>

        {/* Supporting details */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              PM2.5
            </span>
            <span className="text-xl font-bold tabular-nums">
              {pm25}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                µg/m³
              </span>
            </span>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <Badge variant="secondary" className="text-[11px] font-medium">
              {CONFIDENCE_LABEL[confidence] ?? 'Model-based estimate'}
            </Badge>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {formatUpdatedAt(updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

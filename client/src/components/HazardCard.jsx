import { useState } from 'react'
import {
  MapPin,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Check,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  BAND_CONFIG,
  BAND_GRADIENT,
  CONFIDENCE_LABEL,
  formatCheckedAt,
  formatUpdatedAt,
  getIntensity,
} from '@/lib/hazard'

const BAND_ICON = {
  safe: ShieldCheck,
  caution: AlertTriangle,
  hazard: ShieldAlert,
}

/**
 * The hero of the app — a glanceable "what to do" card.
 *
 * Shows: band + short action headline, a few short action chips (the
 * actionable guidance), PM2.5 + confidence, and an expandable "Why?".
 */
export default function HazardCard({ status }) {
  const {
    band,
    pm25,
    confidence,
    headline,
    actions = [],
    recommendation,
    explanation,
    location,
    updatedAt,
    fetchedAt,
  } = status

  const cfg = BAND_CONFIG[band] ?? BAND_CONFIG.hazard
  const Icon = BAND_ICON[band] ?? ShieldAlert
  const gradient = BAND_GRADIENT[band] ?? BAND_GRADIENT.hazard

  // Finer-grained intensity within the band — gives the card day-to-day
  // movement even when the band label stays the same (common in Lahore).
  const intensity = getIntensity(pm25)

  // Measurement lag: station readings are often 1–2 h behind the wall clock.
  // When the check is meaningfully newer than the reading, show both —
  // "Updated 2:00 PM · Checked 4:25 PM" means this is the newest data
  // available, not that the app hasn't fetched since 2 PM.
  const lagMs =
    fetchedAt && updatedAt
      ? new Date(fetchedAt).getTime() - new Date(updatedAt).getTime()
      : 0
  const showCheckedAt = lagMs > 5 * 60 * 1000

  const [showWhy, setShowWhy] = useState(false)

  // The "why" text: prefer explanation, fall back to the summary sentence
  const whyText = explanation || recommendation
  const hasChips = Array.isArray(actions) && actions.length > 0

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
          'relative flex flex-col items-center gap-1 bg-gradient-to-br px-6 py-8 text-white',
          gradient,
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        <Icon className="size-10 drop-shadow-md" strokeWidth={1.8} aria-hidden="true" />
        <p className="text-xs font-medium tracking-wide opacity-90">
          {location}
        </p>
        <h2 className="text-4xl font-extrabold tracking-tight drop-shadow-sm">
          {cfg.label}
        </h2>
        {/* Action headline — the key thing to do, in a few words */}
        <p className="text-base font-semibold opacity-95">
          {headline || cfg.tagline}
        </p>

        {/* Intensity strip — shows *how bad within the band* so the card
            still moves when the band label doesn't. */}
        {intensity && (
          <div className="mt-3 flex w-full max-w-[15rem] flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-medium opacity-90">
              <span>Air pollution level</span>
              <span>{intensity.label}</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/25"
              role="progressbar"
              aria-valuenow={intensity.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Air pollution level: ${intensity.label}`}
            >
              <div
                className="h-full rounded-full bg-white/90 transition-all duration-500"
                style={{ width: `${intensity.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 bg-card p-5 text-card-foreground">
        {/* Short action chips — the "what to do" */}
        {hasChips && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              What to do
            </span>
            <div className="flex flex-wrap gap-2">
              {actions.map((action, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                    cfg.softBg,
                    cfg.text,
                  )}
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                  {action}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: if no chips, show the sentence */}
        {!hasChips && recommendation && (
          <p className="text-[15px] leading-relaxed">{recommendation}</p>
        )}

        {/* Why this? — expandable explanation */}
        {whyText && (
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={showWhy}
            >
              Why this?
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  showWhy && 'rotate-180',
                )}
              />
            </button>
            {showWhy && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {whyText}
              </p>
            )}
          </div>
        )}

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
              {showCheckedAt && ` · ${formatCheckedAt(fetchedAt)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

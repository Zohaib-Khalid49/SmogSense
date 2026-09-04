/**
 * Single source of truth for hazard-band presentation.
 * Maps a band key -> label, colors, and description used across the UI.
 */

export const BAND_CONFIG = {
  safe: {
    label: 'Safe',
    // Tailwind utility classes tied to the locked theme colors
    bg: 'bg-safe',
    text: 'text-safe',
    ring: 'ring-safe/30',
    softBg: 'bg-safe/10',
    tagline: 'Good to go',
  },
  caution: {
    label: 'Caution',
    bg: 'bg-caution',
    text: 'text-caution',
    ring: 'ring-caution/30',
    softBg: 'bg-caution/10',
    tagline: 'Take a precaution',
  },
  hazard: {
    label: 'Hazardous',
    bg: 'bg-hazard',
    text: 'text-hazard',
    ring: 'ring-hazard/30',
    softBg: 'bg-hazard/10',
    tagline: 'Avoid exposure',
  },
}

export const CONFIDENCE_LABEL = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  model: 'Model-based estimate',
  insufficient: 'Insufficient data',
}

/**
 * Band header gradients — the ONE source of truth for the colored hazard
 * headers (HazardCard, AlertDetail). Derived from the hazard tokens
 * (--safe / --caution / --hazard and their -soft variants) so the whole app
 * stays on-palette and theme changes propagate automatically.
 *
 * We use arbitrary-value Tailwind classes reading the CSS vars rather than
 * raw palette colors (previously from-green-600 to-emerald-500, etc.).
 */
export const BAND_GRADIENT = {
  safe: 'from-[var(--safe)] to-[var(--safe-soft)]',
  caution: 'from-[var(--caution)] to-[var(--caution-soft)]',
  hazard: 'from-[var(--hazard)] to-[var(--hazard-soft)]',
}

/**
 * Raw hex per band — the single source of truth for non-CSS contexts that
 * can't use Tailwind classes or CSS vars (e.g. Leaflet map markers/lines).
 * Kept in sync with the tokens in index.css.
 */
export const BAND_HEX = {
  safe: '#16a34a',
  caution: '#f59e0b',
  hazard: '#dc2626',
}

/** Neutral slate used for map lines / non-band map elements (matches --ring). */
export const NEUTRAL_HEX = '#94a3b8'

/** Format an ISO timestamp into a short "Updated 7:04 AM" or "Updated 25 Aug, 7:04 AM" string. */
export function formatUpdatedAt(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const time = d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })

    // Same day — just show the time
    if (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    ) {
      return `Updated ${time}`
    }

    // Different day — show date + time
    const date = d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
    })
    return `Updated ${date}, ${time}`
  } catch {
    return 'Updated just now'
  }
}

/** Format an ISO timestamp into a short "Checked 4:25 PM" string (time only). */
export function formatCheckedAt(iso) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return `Checked ${d.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`
  } catch {
    return ''
  }
}

/**
 * Intensity within the AQI scale.
 *
 * Lahore's air sits in the "Caution" band almost year-round, so the band
 * label alone rarely changes and the card feels static. This maps the raw
 * PM2.5 value onto the EPA breakpoints to give a finer-grained sense of
 * *how bad within the band* — a sub-level label and a 0–100 position for a
 * progress bar — so the card still moves day to day.
 *
 * This is presentation only. It does NOT change the safety band, which is
 * decided by the backend thresholds (getHazardBand).
 *
 * EPA 24-hour PM2.5 breakpoints (µg/m³):
 *   Good 0–9 · Moderate 9.1–35.4 · USG 35.5–55.4 · Unhealthy 55.5–125.4 ·
 *   Very Unhealthy 125.5–225.4 · Hazardous 225.5+
 *
 * @param {number} pm25
 * @returns {{ level: string, label: string, percent: number } | null}
 */
export function getIntensity(pm25) {
  if (typeof pm25 !== 'number' || Number.isNaN(pm25) || pm25 < 0) return null

  // Anchor points mapping PM2.5 → 0..100 across the meaningful range.
  // We cap at 150 so everyday Lahore values (30–60) use most of the bar,
  // while extreme smog still reads near the top.
  const CAP = 150
  const percent = Math.max(0, Math.min(100, Math.round((pm25 / CAP) * 100)))

  let level
  let label
  if (pm25 <= 9) {
    level = 'low'
    label = 'Clean air'
  } else if (pm25 <= 35.4) {
    level = 'low'
    label = 'Low'
  } else if (pm25 <= 55.4) {
    level = 'moderate'
    label = 'Moderate'
  } else if (pm25 <= 125.4) {
    level = 'high'
    label = 'High'
  } else {
    level = 'veryHigh'
    label = 'Very high'
  }

  return { level, label, percent }
}

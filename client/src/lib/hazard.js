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

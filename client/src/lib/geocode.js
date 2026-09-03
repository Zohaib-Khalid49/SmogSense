/**
 * Geocoding via Nominatim (OpenStreetMap) — free, no API key.
 *
 * Used for the Route Check location search: user types, we query
 * Nominatim, show matching places, and the user must pick one (which
 * gives us real coordinates). Random typed strings can't proceed because
 * only a selected suggestion carries coordinates.
 *
 * Results are biased to Lahore via a viewbox + bounded search.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// Lahore bounding box (matches backend bounds): lng,lat pairs for viewbox
// viewbox = left(lngMin),top(latMax),right(lngMax),bottom(latMin)
const LAHORE_VIEWBOX = '74.05,31.80,74.65,31.25'

/**
 * @typedef {Object} GeoSuggestion
 * @property {string} label - display name
 * @property {number} lat
 * @property {number} lng
 */

/**
 * Search for places matching a query, biased to Lahore.
 *
 * @param {string} query
 * @param {AbortSignal} [signal] - to cancel in-flight requests
 * @returns {Promise<GeoSuggestion[]>}
 */
export async function searchPlaces(query, signal) {
  const q = query.trim()
  if (q.length < 3) return []

  const params = new URLSearchParams({
    q: `${q}, Lahore, Pakistan`,
    format: 'json',
    addressdetails: '1',
    limit: '6',
    viewbox: LAHORE_VIEWBOX,
    bounded: '1',
    countrycodes: 'pk',
  })

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) return []

  const data = await res.json()
  if (!Array.isArray(data)) return []

  return data.map((item) => ({
    label: shortenLabel(item.display_name),
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }))
}

/**
 * Nominatim display names are long ("Johar Town, Lahore, Punjab, 54000, Pakistan").
 * Trim to the first 2-3 meaningful parts for a cleaner suggestion list.
 */
function shortenLabel(displayName) {
  if (!displayName) return ''
  const parts = displayName.split(',').map((p) => p.trim())
  // Drop the trailing country/postal-code noise
  return parts.slice(0, 3).join(', ')
}

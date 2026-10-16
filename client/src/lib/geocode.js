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
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const reverseCache = new Map()

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
 * Resolve GPS coordinates to a short area label.
 *
 * Results are cached by rounded coordinates so dashboard refreshes do not
 * repeatedly call Nominatim for the same position.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}
 */
export async function getAreaLabel(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  if (reverseCache.has(key)) return reverseCache.get(key)

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    zoom: '14',
  })

  try {
    const res = await fetch(`${REVERSE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null

    const data = await res.json()
    const address = data.address || {}
    const area =
      address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.village ||
      address.town ||
      address.city_district ||
      address.city ||
      null

    if (area) reverseCache.set(key, area)
    return area
  } catch {
    return null
  }
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

/**
 * Geolocation module for SmogSense.
 *
 * - Gets the user's GPS coordinates via the Browser Geolocation API
 * - Falls back to central Lahore (31.5204, 74.3587) if permission denied,
 *   timeout, or coordinates are outside Lahore bounds
 * - Persists last accepted position in localStorage
 * - Returns a status flag so the UI can show a hint when using fallback
 *
 * @see Backend-Client-Integration.md §4 Phase 1 task 2
 */

import { getHomeLocation } from '@/lib/storage'

const STORAGE_KEY = 'smogsense_last_position'
const TIMEOUT_MS = 10_000

/** Central Lahore — the fallback point */
export const LAHORE_CENTER = { lat: 31.5204, lng: 74.3587 }

/** Lahore bounding box (from backend config.js) */
const LAHORE_BOUNDS = {
  latMin: 31.25,
  latMax: 31.80,
  lngMin: 74.05,
  lngMax: 74.65,
}

/**
 * @typedef {Object} GeoResult
 * @property {number} lat
 * @property {number} lng
 * @property {'gps'|'cached'|'fallback'} source - how the position was obtained
 * @property {string|null} hint - user-facing hint when not using live GPS
 */

/**
 * Check if coordinates are within Lahore bounds.
 */
function isInLahore(lat, lng) {
  return (
    lat >= LAHORE_BOUNDS.latMin &&
    lat <= LAHORE_BOUNDS.latMax &&
    lng >= LAHORE_BOUNDS.lngMin &&
    lng <= LAHORE_BOUNDS.lngMax
  )
}

/**
 * Load the last saved position from localStorage.
 * @returns {{ lat: number, lng: number } | null}
 */
function loadCachedPosition() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const pos = JSON.parse(raw)
    if (typeof pos.lat === 'number' && typeof pos.lng === 'number') return pos
    return null
  } catch {
    return null
  }
}

/**
 * Save a position to localStorage.
 */
function cachePosition(lat, lng) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng }))
}

/**
 * Build a fallback GeoResult, preferring the user's saved home area
 * (set during onboarding) over central Lahore.
 *
 * @param {string} fallbackHint - hint to use if there's no saved home
 * @returns {GeoResult}
 */
function fallbackResult(fallbackHint) {
  const home = getHomeLocation()
  if (home && typeof home.lat === 'number' && typeof home.lng === 'number') {
    return {
      lat: home.lat,
      lng: home.lng,
      source: 'fallback',
      hint: `Showing your saved area (${home.label || 'home'}).`,
    }
  }
  return { ...LAHORE_CENTER, source: 'fallback', hint: fallbackHint }
}

/**
 * Get the user's current location.
 *
 * Priority:
 * 1. Live GPS (if permission granted + within Lahore)
 * 2. Cached last-known position (from localStorage)
 * 3. Fallback to Lahore center
 *
 * @returns {Promise<GeoResult>}
 */
export async function getLocation() {
  // Try live GPS
  if ('geolocation' in navigator) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: TIMEOUT_MS,
          maximumAge: 5 * 60 * 1000, // accept a 5-min cached reading
        })
      })

      const lat = pos.coords.latitude
      const lng = pos.coords.longitude

      if (isInLahore(lat, lng)) {
        cachePosition(lat, lng)
        return { lat, lng, source: 'gps', hint: null }
      }

      // Outside Lahore — fall back but tell the user
      return fallbackResult(
        'You appear to be outside Lahore — showing central Lahore data.',
      )
    } catch (err) {
      // Permission denied or timeout — try cache, then fallback
      const cached = loadCachedPosition()
      if (cached) {
        return {
          ...cached,
          source: 'cached',
          hint: 'Using your last known location.',
        }
      }

      return fallbackResult(
        err.code === 1
          ? 'Location access denied — showing your saved/central area. Enable location for precise data.'
          : 'Could not determine location — showing your saved/central area.',
      )
    }
  }

  // No geolocation API at all
  const cached = loadCachedPosition()
  if (cached) {
    return {
      ...cached,
      source: 'cached',
      hint: 'Using your last known location.',
    }
  }

  return fallbackResult('Location not available — showing your saved/central area.')
}

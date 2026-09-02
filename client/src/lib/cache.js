/**
 * Simple localStorage-backed response cache for offline resilience.
 *
 * Stores the last successful API response so the app can display stale
 * data (with a staleness badge) instead of a dead error screen when
 * the network is unavailable.
 *
 * Keys are prefixed to avoid collisions with other localStorage data.
 */

const CACHE_PREFIX = 'smogsense_cache_'

/**
 * Cache a successful API response.
 *
 * @param {string} key - cache key (e.g. 'hazard_status')
 * @param {any} data - the response data to cache
 */
export function cacheResponse(key, data) {
  if (!data) return
  try {
    const entry = {
      data,
      cachedAt: new Date().toISOString(),
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

/**
 * Retrieve a cached response.
 *
 * @param {string} key - cache key (e.g. 'hazard_status')
 * @returns {{ data: any, cachedAt: string } | null}
 */
export function getCachedResponse(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry?.data) return null
    return { data: entry.data, cachedAt: entry.cachedAt }
  } catch {
    return null
  }
}

/**
 * Remove a cached response.
 *
 * @param {string} key - cache key
 */
export function clearCache(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key)
  } catch {
    // ignore
  }
}

/**
 * Format a cachedAt timestamp as a human-readable relative string.
 *
 * @param {string} cachedAt - ISO timestamp
 * @returns {string} e.g. "5 min ago", "2 hours ago", "yesterday"
 */
export function formatCachedTime(cachedAt) {
  if (!cachedAt) return 'unknown'

  const now = Date.now()
  const then = new Date(cachedAt).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`

  // Fallback to formatted date
  return new Date(cachedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

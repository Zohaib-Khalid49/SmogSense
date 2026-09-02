/**
 * SmogSense API client — the single import for all pages.
 *
 * When VITE_USE_MOCKS is 'true' (or unset), functions return mock data
 * from mockApi.js — no backend needed, fastest for UI development.
 *
 * When VITE_USE_MOCKS is 'false', functions call the real backend via
 * httpClient.js and transform the response via transform.js.
 *
 * Pages import from here, never from mockApi/httpClient/transform directly.
 *
 * @see Backend-Client-Integration.md §3 (Target Architecture)
 */

import * as http from './httpClient'
import * as transform from './transform'
import * as mock from './mockApi'
import { cacheResponse, getCachedResponse } from '@/lib/cache'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

/**
 * Check if an error is a network/offline error (eligible for cache fallback).
 */
function isNetworkError(err) {
  return err?.code === 'NETWORK_ERROR' || err?.code === 'TIMEOUT'
}

// ─── Hazard Status ───────────────────────────────────────────────────

/**
 * Get the current hazard status for a location + profile.
 *
 * @param {Object} opts
 * @param {number} opts.lat - latitude
 * @param {number} opts.lng - longitude
 * @param {string} [opts.profileCategory] - one of the 6 profile categories
 * @param {string} [opts.band] - (mock only) force a specific band for dev preview
 * @returns {Promise<Object|null>} client-shaped hazard status, or null if no data
 */
export async function getHazardStatus({ lat, lng, profileCategory, band } = {}) {
  if (USE_MOCKS) {
    return mock.getHazardStatus({ band })
  }

  try {
    const { data, noData } = await http.get('/hazard-status', {
      lat,
      lng,
      profile_category: transform.toBackendCategory(profileCategory),
    })

    if (noData) return null
    const result = transform.toHazardStatus(data)

    // Cache successful response for offline fallback
    cacheResponse('hazard_status', result)

    return result
  } catch (err) {
    // On network error, try cached response
    if (isNetworkError(err)) {
      const cached = getCachedResponse('hazard_status')
      if (cached) {
        return { ...cached.data, isStale: true, cachedAt: cached.cachedAt }
      }
    }
    throw err
  }
}

// ─── Profiles ────────────────────────────────────────────────────────

/**
 * List all profiles for a user.
 *
 * @param {string} userId
 * @returns {Promise<Object[]>} array of client-shaped profiles
 */
export async function listProfiles(userId) {
  if (USE_MOCKS) {
    // Mock: return whatever is in localStorage (existing behavior)
    const { loadProfiles } = await import('@/lib/storage')
    return loadProfiles()
  }

  const { data } = await http.get(`/profiles/${userId}`)
  return transform.toProfiles(data)
}

/**
 * Create a new profile.
 *
 * @param {Object} profile
 * @param {string} profile.userId
 * @param {string} profile.name
 * @param {number} [profile.age]
 * @param {string} profile.category - one of the 6 profile categories
 * @param {string} [profile.subDetail]
 * @param {boolean} [profile.alertsEnabled]
 * @returns {Promise<Object>} the created profile in client shape
 */
export async function createProfile(profile) {
  if (USE_MOCKS) {
    // Mock: just return the shape — ProfileSetup already saves to localStorage
    return {
      profileId: profile.category + '_' + Date.now(),
      subDetail: profile.subDetail || null,
      label: profile.name || profile.category,
    }
  }

  const { data } = await http.post('/profiles', {
    user_id: profile.userId,
    name: profile.name,
    age: profile.age,
    category: transform.toBackendCategory(profile.category),
    sub_detail: profile.subDetail,
    alerts_enabled: profile.alertsEnabled ?? true,
  })

  return transform.toProfile(data)
}

/**
 * Update an existing profile.
 *
 * @param {string} profileId
 * @param {Object} updates - fields to update
 * @returns {Promise<Object>} the updated profile in client shape
 */
export async function updateProfile(profileId, updates) {
  if (USE_MOCKS) {
    return { profileId, ...updates }
  }

  const body = {}
  if (updates.name !== undefined) body.name = updates.name
  if (updates.age !== undefined) body.age = updates.age
  if (updates.category !== undefined) body.category = transform.toBackendCategory(updates.category)
  if (updates.subDetail !== undefined) body.sub_detail = updates.subDetail
  if (updates.alertsEnabled !== undefined) body.alerts_enabled = updates.alertsEnabled

  const { data } = await http.patch(`/profiles/${profileId}`, body)
  return transform.toProfile(data)
}

// ─── Route Check ─────────────────────────────────────────────────────

/**
 * Compare exposure between two routes.
 *
 * @param {Object} opts
 * @param {number} opts.originLat
 * @param {number} opts.originLng
 * @param {number} opts.destLat
 * @param {number} opts.destLng
 * @param {string} [opts.profileCategory]
 * @returns {Promise<Object|null>} client-shaped route comparison, or null if no data
 */
export async function getRouteCheck(opts = {}) {
  if (USE_MOCKS) {
    return mock.getRouteComparison()
  }

  try {
    const { data, noData } = await http.get('/route-check', {
      origin_lat: opts.originLat,
      origin_lng: opts.originLng,
      dest_lat: opts.destLat,
      dest_lng: opts.destLng,
      profile_category: transform.toBackendCategory(opts.profileCategory),
    })

    if (noData) return null
    const result = transform.toRouteComparison(data)

    // Cache successful response for offline fallback
    cacheResponse('route_check', result)

    return result
  } catch (err) {
    // On network error, try cached response
    if (isNetworkError(err)) {
      const cached = getCachedResponse('route_check')
      if (cached) {
        return { ...cached.data, isStale: true, cachedAt: cached.cachedAt }
      }
    }
    throw err
  }
}

// ─── Push alerts ─────────────────────────────────────────────────────

/**
 * Register a device for push notifications.
 *
 * @param {Object} opts
 * @param {string} opts.profileId
 * @param {string} opts.fcmToken
 * @returns {Promise<Object>} registration result
 */
export async function registerDevice({ profileId, fcmToken }) {
  if (USE_MOCKS) {
    return { success: true, profileId, fcmToken }
  }

  const { data } = await http.post('/alerts/register-device', {
    profile_id: profileId,
    fcm_token: fcmToken,
  })

  return data
}

// ─── Alert detail ────────────────────────────────────────────────────

/**
 * Get alert detail. In production, alerts come via push payload only
 * (no GET /alerts history endpoint exists — see Risks §7 #2).
 * This function exists for mock mode and as a future placeholder.
 *
 * @returns {Promise<Object>}
 */
export async function getAlertDetail() {
  if (USE_MOCKS) {
    return mock.getAlertDetail()
  }

  // No backend endpoint — return null in live mode.
  // AlertDetail page will rely on push notification payload data.
  return null
}

// ─── Health check (dev utility) ──────────────────────────────────────

/**
 * Check if the backend is reachable.
 * Useful for dev/debug — not called by UI components.
 *
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  if (USE_MOCKS) return true

  try {
    await http.get('/health')
    return true
  } catch {
    return false
  }
}

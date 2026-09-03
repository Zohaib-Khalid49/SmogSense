/**
 * Push notification module for SmogSense.
 *
 * Wraps Firebase Cloud Messaging with a clean API that gracefully degrades
 * when Firebase is not configured or the browser doesn't support push.
 *
 * All functions are safe to call without checking — they return sensible
 * defaults (false, null, []) when push is unavailable.
 *
 * @see lib/firebase.js for Firebase initialization
 * @see api/client.js for registerDevice()
 */

import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance, isPushSupported as _isPushSupported } from './firebase'
import { registerDevice } from '@/api/client'

// ── localStorage keys ─────────────────────────────────────────────────
const PUSH_DISMISSED_KEY = 'smogsense_push_dismissed'
const ALERT_PAYLOAD_KEY = 'smogsense_alert_payload'

// ── VAPID key (web push certificate) ─────────────────────────────────
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

// ── Support & Permission ──────────────────────────────────────────────

/**
 * Check if push notifications are supported and Firebase is configured.
 *
 * @returns {Promise<boolean>}
 */
export async function isPushSupported() {
  return _isPushSupported()
}

/**
 * Check if notification permission has been granted.
 *
 * @returns {boolean}
 */
export function isPermissionGranted() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/**
 * Check if the user has dismissed the push notification prompt.
 *
 * @returns {boolean}
 */
export function isPushDismissed() {
  try {
    return localStorage.getItem(PUSH_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Mark push notifications as dismissed (user doesn't want to see the prompt again).
 */
export function dismissPush() {
  try {
    localStorage.setItem(PUSH_DISMISSED_KEY, 'true')
  } catch {
    // localStorage unavailable
  }
}

/**
 * Reset the dismissed state (e.g., if user wants to enable later).
 */
export function resetPushDismissed() {
  try {
    localStorage.removeItem(PUSH_DISMISSED_KEY)
  } catch {
    // localStorage unavailable
  }
}

// ── Permission & Token ────────────────────────────────────────────────

/**
 * Request notification permission from the browser.
 *
 * @returns {Promise<boolean>} true if granted
 */
export async function requestPermission() {
  if (typeof Notification === 'undefined') return false

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch {
    return false
  }
}

/**
 * Get the FCM token for this device.
 * Requires permission to be granted first.
 *
 * @param {ServiceWorkerRegistration} [swRegistration] - PWA service worker registration
 * @returns {Promise<string|null>} the FCM token, or null on failure
 */
export async function getFcmToken(swRegistration) {
  const messaging = getMessagingInstance()
  if (!messaging) {
    console.warn('[push] Messaging not initialized')
    return null
  }

  console.log('[push] getToken with VAPID:', VAPID_KEY ? 'set' : 'not set')
  console.log('[push] SW registration:', swRegistration ? 'provided' : 'not provided')

  // Add timeout to prevent hanging
  const timeoutMs = 15000
  const tokenPromise = getToken(messaging, {
    vapidKey: VAPID_KEY || undefined,
    serviceWorkerRegistration: swRegistration,
  })

  try {
    const token = await Promise.race([
      tokenPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Token request timed out')), timeoutMs)
      ),
    ])
    return token || null
  } catch (err) {
    console.warn('[push] Failed to get FCM token:', err.message)
    return null
  }
}

/**
 * Token refresh handler.
 *
 * Firebase SDK v9+ handles token refresh internally — calling getToken()
 * always returns the current valid token. This function is provided for
 * backward compatibility and can be used to periodically re-register
 * profiles with the latest token.
 *
 * @param {(newToken: string) => void} callback - called with current token
 * @returns {() => void} cleanup function (no-op, Firebase manages internally)
 */
export function onFcmTokenRefresh() {
  // Firebase SDK v9+ auto-refreshes tokens internally.
  // Call getToken() again anytime you need the current token.
  // This is a no-op for compatibility. (Accepts a callback arg for
  // backward compatibility; it is intentionally unused.)
  return () => {}
}

/**
 * Subscribe to foreground messages (when app is open and focused).
 *
 * @param {(payload: object) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onForegroundMessage(callback) {
  const messaging = getMessagingInstance()
  if (!messaging) return () => {}

  const unsubscribe = onMessage(messaging, (payload) => {
    callback(payload)
  })

  return unsubscribe
}

// ── Profile Registration ──────────────────────────────────────────────

/**
 * Register all profiles with the backend for push notifications.
 * Only registers profiles that have a backend profileId (not just localStorage).
 *
 * @param {Array<{profileId: string}>} profiles - user's profiles
 * @param {string} fcmToken - the FCM token
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function registerAllProfiles(profiles, fcmToken) {
  if (!fcmToken || !Array.isArray(profiles)) {
    return { success: 0, failed: 0 }
  }

  let success = 0
  let failed = 0

  for (const profile of profiles) {
    // Only register profiles that have a backend ID (24-char hex from MongoDB)
    if (!profile.profileId || profile.profileId.length < 20) {
      continue
    }

    try {
      await registerDevice({
        profileId: profile.profileId,
        fcmToken,
      })
      success++
    } catch (err) {
      console.warn('[push] Failed to register profile:', profile.profileId, err.message)
      failed++
    }
  }

  return { success, failed }
}

// ── Alert Payload Storage ─────────────────────────────────────────────

/**
 * Store alert payload in sessionStorage (from push notification tap).
 *
 * @param {object} data - alert payload data
 */
export function storeAlertPayload(data) {
  if (!data) return
  try {
    sessionStorage.setItem(ALERT_PAYLOAD_KEY, JSON.stringify(data))
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Get and clear the stored alert payload.
 * Returns null if no payload is stored.
 *
 * @returns {object|null}
 */
export function getAlertPayload() {
  try {
    const raw = sessionStorage.getItem(ALERT_PAYLOAD_KEY)
    if (!raw) return null
    sessionStorage.removeItem(ALERT_PAYLOAD_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

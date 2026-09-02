/**
 * Firebase initialization for SmogSense.
 *
 * Reads VITE_FIREBASE_* env vars. If all required values are present the
 * Firebase app is initialised at import time and `messaging` is exported.
 *
 * When any var is missing, `messaging` is null and `isFirebaseConfigured`
 * is false — all downstream code should check before using.
 *
 * @see https://firebase.google.com/docs/web/setup
 */

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

// ── Config from env ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * True when all required Firebase env vars are set.
 */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (v) => v !== undefined && v !== '',
)

// Debug log in development
if (import.meta.env.DEV) {
  console.log('[firebase] Config:', {
    configured: isFirebaseConfigured,
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
  })
}

/**
 * The Firebase Messaging instance, or null if not configured / unsupported.
 * Initialise lazily on first access to avoid side-effects in non-browser
 * environments (SSR, tests).
 */
let _messaging = null
let _initialised = false

/**
 * Get the Firebase Messaging instance (lazy, singleton).
 * Returns null if Firebase is not configured or messaging is unsupported.
 *
 * @returns {import('firebase/messaging').Messaging|null}
 */
export function getMessagingInstance() {
  if (!isFirebaseConfigured) return null
  if (_initialised) return _messaging

  try {
    // Only initialise once (hot-reload safe)
    if (getApps().length === 0) {
      initializeApp(firebaseConfig)
    }
    _messaging = getMessaging()
    _initialised = true
    return _messaging
  } catch (err) {
    console.warn('[firebase] Failed to initialise messaging:', err.message)
    return null
  }
}

/**
 * Check if Firebase Messaging is supported in this browser.
 *
 * @returns {Promise<boolean>}
 */
export async function isPushSupported() {
  if (!isFirebaseConfigured) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

/**
 * The raw Firebase config object — needed by the service worker.
 * Exported so sw.js can reference the same values.
 */
export { firebaseConfig }

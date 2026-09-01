/**
 * User identity module for SmogSense.
 *
 * Generates a stable user_id via crypto.randomUUID() and persists it
 * in localStorage. The backend uses this to associate profiles with a device.
 *
 * No auth — acceptable for MVP. Clearing browser data orphans profiles
 * in Mongo (documented in integration doc Risks §7 #4).
 *
 * @see Backend-Client-Integration.md §3 (Identity without auth)
 */

const STORAGE_KEY = 'smogsense_user_id'

/**
 * Get the current user ID, or create one if it doesn't exist.
 * Always returns a stable string for this device/browser.
 *
 * @returns {string} UUID v4
 */
export function getUserId() {
  let id = localStorage.getItem(STORAGE_KEY)
  if (id) return id

  id = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}

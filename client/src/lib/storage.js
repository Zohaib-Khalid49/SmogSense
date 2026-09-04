/**
 * Simple localStorage helpers for profile persistence.
 * Keeps profile data on-device so the choice survives page refresh
 * and the Home screen can read the active profile.
 */

const PROFILES_KEY = 'smogsense_profiles'

/**
 * @typedef {Object} SavedProfile
 * @property {string} profileId - one of the 6 profile type ids
 * @property {string|null} subDetail - optional sub-detail id
 * @property {string} label - user-given name (e.g. "Mom", "Ahmed")
 */

/**
 * Load saved profiles from localStorage.
 * @returns {SavedProfile[]}
 */
export function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Save profiles to localStorage.
 * @param {SavedProfile[]} profiles
 */
export function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

/**
 * Check if onboarding (at least one profile) has been completed.
 * @returns {boolean}
 */
export function hasCompletedSetup() {
  return loadProfiles().length > 0
}

// ─── User / onboarding ───────────────────────────────────────────────

const USER_KEY = 'smogsense_user'

/**
 * @typedef {Object} SmogUser
 * @property {string} name - display name (optional, may be '')
 * @property {{ label: string, lat: number, lng: number } | null} home - saved home area
 * @property {boolean} onboarded - whether the welcome step is done
 */

/**
 * Load the user profile (name, home location, onboarded flag).
 * @returns {SmogUser}
 */
export function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return { name: '', home: null, onboarded: false }
    const u = JSON.parse(raw)
    return {
      name: u.name || '',
      home: u.home || null,
      onboarded: u.onboarded === true,
    }
  } catch {
    return { name: '', home: null, onboarded: false }
  }
}

/**
 * Save the user profile.
 * @param {SmogUser} user
 */
export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/**
 * Whether the user has completed the one-time welcome/onboarding step.
 * @returns {boolean}
 */
export function hasOnboarded() {
  return loadUser().onboarded === true
}

/**
 * Get the saved home location (or null).
 * @returns {{ label: string, lat: number, lng: number } | null}
 */
export function getHomeLocation() {
  return loadUser().home
}

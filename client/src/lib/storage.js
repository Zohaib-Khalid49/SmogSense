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

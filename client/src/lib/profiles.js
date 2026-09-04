/**
 * Profile types config — single source of truth.
 *
 * Each of the 6 vulnerable/needs profiles defined by the spec.
 * This drives the Profile Setup selector, the sub-detail step,
 * and the personalization logic across the app.
 */

/**
 * @typedef {Object} SubDetail
 * @property {string} id
 * @property {string} label
 */

/**
 * @typedef {Object} ProfileType
 * @property {string} id          - enum key sent to backend
 * @property {string} label       - display name
 * @property {string} description - short explanation for the selector
 * @property {string} icon        - Lucide icon name (imported in the component)
 * @property {SubDetail[]|null} subDetails - optional refinements
 */

/** Maximum profiles per device (frontend cap — backend enforces one-per-category) */
export const MAX_PROFILES = 4

/** @type {ProfileType[]} */
export const PROFILE_TYPES = [
  {
    id: 'adult',
    label: 'Adult',
    description: 'General healthy adult',
    icon: 'User',
    subDetails: null,
    ageRange: { min: 15, max: 64 },
  },
  {
    id: 'child',
    label: 'Child',
    description: 'Child under 18 (school-age)',
    icon: 'Baby',
    subDetails: null,
    ageRange: { min: 0, max: 17 },
  },
  {
    id: 'elderly',
    label: 'Elderly',
    description: 'Senior adult (60+)',
    icon: 'HeartPulse',
    subDetails: null,
    ageRange: { min: 60, max: 120 },
  },
  {
    id: 'pregnant',
    label: 'Pregnant Woman',
    description: 'Currently pregnant',
    icon: 'PersonStanding',
    subDetails: [
      { id: 'trimester_1', label: 'First trimester' },
      { id: 'trimester_2', label: 'Second trimester' },
      { id: 'trimester_3', label: 'Third trimester' },
    ],
    ageRange: { min: 12, max: 55 },
  },
  {
    id: 'respiratory',
    label: 'Asthma / COPD',
    description: 'Has a respiratory condition',
    icon: 'Wind',
    subDetails: [
      { id: 'asthma', label: 'Asthma' },
      { id: 'copd', label: 'COPD' },
      { id: 'other', label: 'Other respiratory condition' },
    ],
    ageRange: { min: 0, max: 120 },
  },
  {
    id: 'outdoor_worker',
    label: 'Outdoor Worker',
    description: 'Works outdoors regularly',
    icon: 'HardHat',
    subDetails: null,
    ageRange: { min: 15, max: 75 },
  },
]

/**
 * Validate an age against a profile type's expected range.
 *
 * @param {string} profileId - the category id
 * @param {number|string|null|undefined} age
 * @returns {string|null} an error message if invalid, or null if valid/empty
 */
export function validateAge(profileId, age) {
  // Age is optional — empty is always valid
  if (age === '' || age === null || age === undefined) return null

  const num = Number(age)
  if (Number.isNaN(num) || num < 0 || num > 120) {
    return 'Please enter a valid age.'
  }

  const type = getProfileType(profileId)
  const range = type?.ageRange
  if (!range) return null

  if (num < range.min || num > range.max) {
    return `Age ${num} doesn't match the ${type.label} profile (expected ${range.min}–${range.max}).`
  }

  return null
}

/**
 * Look up a profile type by its id.
 * @param {string} id
 * @returns {ProfileType|undefined}
 */
export function getProfileType(id) {
  return PROFILE_TYPES.find((p) => p.id === id)
}

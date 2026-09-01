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

/** Maximum profiles per device (frontend cap — backend should also enforce) */
export const MAX_PROFILES = 5

/** @type {ProfileType[]} */
export const PROFILE_TYPES = [
  {
    id: 'adult',
    label: 'Adult',
    description: 'General healthy adult',
    icon: 'User',
    subDetails: null,
  },
  {
    id: 'child',
    label: 'Child',
    description: 'Child under 14 (school-age)',
    icon: 'Baby',
    subDetails: null,
  },
  {
    id: 'elderly',
    label: 'Elderly',
    description: 'Senior adult (60+)',
    icon: 'HeartPulse',
    subDetails: null,
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
  },
  {
    id: 'outdoor_worker',
    label: 'Outdoor Worker',
    description: 'Works outdoors regularly',
    icon: 'HardHat',
    subDetails: null,
  },
]

/**
 * Look up a profile type by its id.
 * @param {string} id
 * @returns {ProfileType|undefined}
 */
export function getProfileType(id) {
  return PROFILE_TYPES.find((p) => p.id === id)
}

'use strict';

const { BANDS } = require('./thresholds');

/**
 * Recommendation Key Mapping
 * ──────────────────────────
 * Produces a deterministic key for each of the 18 (6 profiles × 3 bands)
 * combinations.  The key is used to:
 *   1. Look up the static fallback recommendation template.
 *   2. Seed the constrained Groq explanation prompt.
 *
 * Format:  "{band}_{profile}"  e.g. "caution_child"
 */

const PROFILE_CATEGORIES = Object.freeze([
  'adult',
  'child',
  'elderly',
  'pregnant_woman',
  'asthma_copd',
  'outdoor_worker',
]);

const ALL_PROFILES = Object.freeze([...PROFILE_CATEGORIES]);

/**
 * Build a recommendation key from a hazard band and profile category.
 *
 * @param {string} hazardBand      'safe' | 'caution' | 'hazardous'
 * @param {string} profileCategory One of the six profile categories
 * @returns {string}  e.g. "caution_children"
 */
function getRecommendationKey(hazardBand, profileCategory) {
  if (!Object.values(BANDS).includes(hazardBand)) {
    throw new Error(`Unknown hazard band: ${hazardBand}`);
  }
  if (!PROFILE_CATEGORIES.includes(profileCategory)) {
    throw new Error(`Unknown profile category: ${profileCategory}`);
  }
  return `${hazardBand}_${profileCategory}`;
}

/**
 * Return the complete set of all 18 valid recommendation keys.
 *
 * @returns {string[]}
 */
function getAllRecommendationKeys() {
  const keys = [];
  for (const band of Object.values(BANDS)) {
    for (const profile of PROFILE_CATEGORIES) {
      keys.push(`${band}_${profile}`);
    }
  }
  return keys;
}

/**
 * Validate that a string is a valid recommendation key.
 *
 * @param {string} key
 * @returns {boolean}
 */
function isValidRecommendationKey(key) {
  if (typeof key !== 'string') return false;
  const [band, ...rest] = key.split('_');
  const profile = rest.join('_');
  return (
    Object.values(BANDS).includes(band) &&
    PROFILE_CATEGORIES.includes(profile)
  );
}

module.exports = {
  PROFILE_CATEGORIES,
  ALL_PROFILES,
  getRecommendationKey,
  getAllRecommendationKeys,
  isValidRecommendationKey,
};

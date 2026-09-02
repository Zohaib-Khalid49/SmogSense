'use strict';

/**
 * PM2.5 Threshold Tables
 * ───────────────────────
 * Source: US EPA 24-hour PM2.5 breakpoints (rev. 2024)
 *   Good:            0.0 –  9.0 µg/m³
 *   Moderate:        9.1 – 35.4 µg/m³
 *   USG:            35.5 – 55.4 µg/m³
 *   Unhealthy:      55.5 –125.4 µg/m³
 *   Very Unhealthy:125.5 –225.4 µg/m³
 *   Hazardous:     225.5+       µg/m³
 *
 * SmogSense uses a 3-band categorical-shift model:
 *   • Adult:          Safe = Good + Moderate (0–35.4)
 *                     Caution = USG + Unhealthy (35.5–125.4)
 *                     Hazardous = Very Unhealthy + Hazardous (125.5+)
 *
 *   • Sensitive profiles (Child, Elderly, Pregnant Woman, Asthma/COPD, Outdoor Worker):
 *                     Safe = Good only (0–9.0)
 *                     Caution = Moderate + USG (9.1–55.4)
 *                     Hazardous = Unhealthy and above (55.5+)
 *
 * Note: Outdoor Worker shares the same numeric thresholds as other sensitive
 * profiles (heightened exposure risk), but has distinct recommendation content
 * tailored to occupational exposure — see recommendationTemplates.js.
 */

// ── EPA category boundaries (upper bounds) ─────
const EPA = Object.freeze({
  GOOD_MAX: 9.0,
  MODERATE_MAX: 35.4,
  USG_MAX: 55.4,
  UNHEALTHY_MAX: 125.4,
  VERY_UNHEALTHY_MAX: 225.4,
  // Above 225.4 = Hazardous
});

// ── Hazard bands ───────────────────────────────
const BANDS = Object.freeze({
  SAFE: 'safe',
  CAUTION: 'caution',
  HAZARDOUS: 'hazardous',
});

// Ordered from least to most severe
const BAND_ORDER = Object.freeze([BANDS.SAFE, BANDS.CAUTION, BANDS.HAZARDOUS]);

// ── Band threshold tables ──────────────────────
// Each entry: [upper_bound_inclusive, band_name]
// Evaluated top-down; first match wins.

const ADULT_THRESHOLDS = Object.freeze([
  { max: EPA.MODERATE_MAX, band: BANDS.SAFE },       // 0 – 35.4
  { max: EPA.UNHEALTHY_MAX, band: BANDS.CAUTION },    // 35.5 – 125.4
  { max: Infinity, band: BANDS.HAZARDOUS },            // 125.5+
]);

const SENSITIVE_THRESHOLDS = Object.freeze([
  { max: EPA.GOOD_MAX, band: BANDS.SAFE },            // 0 – 9.0
  { max: EPA.USG_MAX, band: BANDS.CAUTION },          // 9.1 – 55.4
  { max: Infinity, band: BANDS.HAZARDOUS },            // 55.5+
]);

// ── Profile classification ─────────────────────
const SENSITIVE_PROFILES = new Set([
  'child',
  'elderly',
  'pregnant_woman',
  'asthma_copd',
  'outdoor_worker',
]);

/**
 * Determine the hazard band for a given PM2.5 value and profile category.
 *
 * @param {number} pm25_24hr_avg  PM2.5 24-hour average concentration in µg/m³ (must be >= 0)
 * @param {string} profileCategory  One of the six profile categories
 * @returns {string}  Hazard band: 'safe' | 'caution' | 'hazardous'
 */
function getHazardBand(pm25_24hr_avg, profileCategory) {
  if (typeof pm25_24hr_avg !== 'number' || pm25_24hr_avg < 0 || Number.isNaN(pm25_24hr_avg)) {
    throw new Error(`Invalid PM2.5 value: ${pm25_24hr_avg}`);
  }

  const thresholds = SENSITIVE_PROFILES.has(profileCategory)
    ? SENSITIVE_THRESHOLDS
    : ADULT_THRESHOLDS;

  for (const { max, band } of thresholds) {
    if (pm25_24hr_avg <= max) return band;
  }

  // Should never reach here due to Infinity cap
  return BANDS.HAZARDOUS;
}

/**
 * Get the underlying EPA category name for a PM2.5 value.
 * Useful for logging and detailed reporting.
 *
 * @param {number} pm25_24hr_avg  PM2.5 24-hour average concentration in µg/m³
 * @returns {string}  EPA category name
 */
function getEpaCategory(pm25_24hr_avg) {
  if (typeof pm25_24hr_avg !== 'number' || pm25_24hr_avg < 0 || Number.isNaN(pm25_24hr_avg)) {
    throw new Error(`Invalid PM2.5 value: ${pm25_24hr_avg}`);
  }

  if (pm25_24hr_avg <= EPA.GOOD_MAX) return 'Good';
  if (pm25_24hr_avg <= EPA.MODERATE_MAX) return 'Moderate';
  if (pm25_24hr_avg <= EPA.USG_MAX) return 'Unhealthy for Sensitive Groups';
  if (pm25_24hr_avg <= EPA.UNHEALTHY_MAX) return 'Unhealthy';
  if (pm25_24hr_avg <= EPA.VERY_UNHEALTHY_MAX) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Check whether a profile category is considered sensitive.
 *
 * @param {string} profileCategory
 * @returns {boolean}
 */
function isSensitiveProfile(profileCategory) {
  return SENSITIVE_PROFILES.has(profileCategory);
}

module.exports = {
  EPA,
  BANDS,
  BAND_ORDER,
  ADULT_THRESHOLDS,
  SENSITIVE_THRESHOLDS,
  getHazardBand,
  getEpaCategory,
  isSensitiveProfile,
};

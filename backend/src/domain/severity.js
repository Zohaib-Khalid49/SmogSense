'use strict';

const { BANDS } = require('./thresholds');

/**
 * Severity Ordering
 * ──────────────────
 * Maps hazard bands and alert severity levels to numeric ranks
 * for comparison (higher = more severe).
 *
 * Alert severity progression:
 *   info     → safe conditions, general awareness
 *   caution  → moderate risk, sensitive groups should take care
 *   warning  → unhealthy levels, everyone should reduce exertion
 *   danger   → very unhealthy / hazardous, stay indoors
 */

// ── Alert severity levels ──────────────────────
const SEVERITY = Object.freeze({
  INFO: 'info',
  CAUTION: 'caution',
  WARNING: 'warning',
  DANGER: 'danger',
});

// ── Numeric ranking (higher = more severe) ─────
const SEVERITY_RANK = Object.freeze({
  [SEVERITY.INFO]: 0,
  [SEVERITY.CAUTION]: 1,
  [SEVERITY.WARNING]: 2,
  [SEVERITY.DANGER]: 3,
});

const SEVERITY_ORDER = Object.freeze([
  SEVERITY.INFO,
  SEVERITY.CAUTION,
  SEVERITY.WARNING,
  SEVERITY.DANGER,
]);

// ── Hazard band → alert severity mapping ───────
// For PM2.5 values within the "hazardous" band, we further subdivide
// based on the EPA boundary (125.4 µg/m³ = Very Unhealthy, 225.5+ = Hazardous).
const BAND_TO_SEVERITY = Object.freeze({
  [BANDS.SAFE]: SEVERITY.INFO,
  [BANDS.CAUTION]: SEVERITY.CAUTION,
  [BANDS.HAZARDOUS]: SEVERITY.WARNING, // default for hazardous band
});

/**
 * Get the numeric severity rank for comparison.
 *
 * @param {string} severity  Severity level string
 * @returns {number}  Numeric rank (higher = more severe)
 */
function getSeverityRank(severity) {
  const rank = SEVERITY_RANK[severity];
  if (rank === undefined) {
    throw new Error(`Unknown severity level: ${severity}`);
  }
  return rank;
}

/**
 * Check if severityA is more severe than severityB.
 *
 * @param {string} severityA
 * @param {string} severityB
 * @returns {boolean}
 */
function isMoreSevere(severityA, severityB) {
  return getSeverityRank(severityA) > getSeverityRank(severityB);
}

/**
 * Map a hazard band and PM2.5 value to the appropriate alert severity.
 *
 * Within the "hazardous" band, PM2.5 >= 225.5 (EPA Hazardous) gets
 * 'danger' severity instead of 'warning'.
 *
 * @param {string} hazardBand  One of: 'safe', 'caution', 'hazardous'
 * @param {number} pm25        PM2.5 concentration in µg/m³
 * @returns {string}  Alert severity level
 */
function mapBandToSeverity(hazardBand, pm25) {
  if (hazardBand === BANDS.HAZARDOUS && pm25 > 225.4) {
    return SEVERITY.DANGER;
  }
  return BAND_TO_SEVERITY[hazardBand] || SEVERITY.INFO;
}

module.exports = {
  SEVERITY,
  SEVERITY_RANK,
  SEVERITY_ORDER,
  getSeverityRank,
  isMoreSevere,
  mapBandToSeverity,
};

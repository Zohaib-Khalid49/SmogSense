'use strict';

/**
 * Confidence Level Calculation
 * ────────────────────────────
 * Determines how confident we are in a pollution reading based on:
 *   1. Distance to the nearest monitoring station
 *   2. Number of data sources that contributed (OpenAQ, CAMS)
 *   3. Data freshness (time since last reading)
 *
 * Confidence levels:
 *   high   — Station within 5 km, data < 1 hr old
 *   medium — Station within 15 km, data < 2 hr old
 *   low    — Station within 30 km, data < 3 hr old
 *   model_only — No station data, using CAMS model data only
 *   insufficient — No recent data at all
 */

const LEVELS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  MODEL_ONLY: 'model_only',
  INSUFFICIENT: 'insufficient',
});

// ── Distance thresholds (km) ──────────────────
const DISTANCE = Object.freeze({
  HIGH_MAX_KM: 5,
  MEDIUM_MAX_KM: 15,
  LOW_MAX_KM: 30,
});

// ── Freshness thresholds (ms) ─────────────────
const FRESHNESS = Object.freeze({
  HIGH_MAX_MS: 60 * 60 * 1000,       // 1 hour
  MEDIUM_MAX_MS: 2 * 60 * 60 * 1000, // 2 hours
  LOW_MAX_MS: 3 * 60 * 60 * 1000,    // 3 hours
});

/**
 * Calculate confidence level from station proximity and data age.
 *
 * @param {object} opts
 * @param {number|null} opts.distanceKm    Distance to nearest station (null = no station)
 * @param {number}      opts.freshnessMs   Milliseconds since last reading
 * @param {string[]}    opts.sources       Active data sources (e.g. ['openaq', 'cams'])
 * @returns {string}  Confidence level
 */
function calculateConfidence({ distanceKm, freshnessMs, sources }) {
  const hasStation = distanceKm !== null && distanceKm !== undefined;
  const hasOpenAq = Array.isArray(sources) && sources.includes('openaq');
  const hasCams = Array.isArray(sources) && sources.includes('cams');
  const sourceCount = (hasOpenAq ? 1 : 0) + (hasCams ? 1 : 0);

  // No data at all
  if (!hasStation && !hasCams) {
    return LEVELS.INSUFFICIENT;
  }

  // Only model data, no station
  if (!hasStation && hasCams) {
    return LEVELS.MODEL_ONLY;
  }

  // Station exists but data is too old
  if (freshnessMs > FRESHNESS.LOW_MAX_MS) {
    return LEVELS.LOW;
  }

  // Station within range — check distance + freshness tiers
  if (
    distanceKm <= DISTANCE.HIGH_MAX_KM &&
    freshnessMs <= FRESHNESS.HIGH_MAX_MS &&
    sourceCount >= 1
  ) {
    return LEVELS.HIGH;
  }

  if (
    distanceKm <= DISTANCE.MEDIUM_MAX_KM &&
    freshnessMs <= FRESHNESS.MEDIUM_MAX_MS
  ) {
    return LEVELS.MEDIUM;
  }

  if (distanceKm <= DISTANCE.LOW_MAX_KM) {
    return LEVELS.LOW;
  }

  // Station exists but beyond 30 km
  return LEVELS.LOW;
}

/**
 * Haversine distance between two lat/lng points in kilometres.
 *
 * @param {number} lat1  Latitude of point 1
 * @param {number} lng1  Longitude of point 1
 * @param {number} lat2  Latitude of point 2
 * @param {number} lng2  Longitude of point 2
 * @returns {number}  Distance in km (2 decimal places)
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 100) / 100;
}

module.exports = {
  LEVELS,
  DISTANCE,
  FRESHNESS,
  calculateConfidence,
  haversineKm,
};

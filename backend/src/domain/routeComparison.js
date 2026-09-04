'use strict';

const { getHazardBand, BANDS } = require('./thresholds');

/**
 * Route Exposure Comparison
 * ──────────────────────────
 * Compares two routes (or a route's exposure vs. the user's current location)
 * to determine if there is a meaningful difference in pollution exposure.
 *
 * Meaningful difference criteria (at least one must be true):
 *   1. Different hazard bands
 *   2. PM2.5 difference exceeds 5% of the higher value
 *   3. Confidence on both sides is at least 'medium'
 *
 * If confidence is 'insufficient' or 'model_only' on either side,
 * the comparison result is flagged as unreliable.
 */

// ── Confidence ranking for comparison eligibility ──
const CONFIDENCE_RANK = Object.freeze({
  insufficient: 0,
  model_only: 1,
  low: 2,
  medium: 3,
  high: 4,
});

// ── Meaningful-difference threshold ────────────
// A 5% relative gap is enough to call one area cleaner/worse. Lahore readings
// often sit close together, so a stricter threshold made almost everything
// read as "about the same"; 5% surfaces modest-but-real differences.
const PM25_DIFF_THRESHOLD = 0.05; // 5%

/**
 * Compare exposure between two routes.
 *
 * @param {object} primary   { pm25, confidence, profileCategory }
 * @param {object} alternate { pm25, confidence, profileCategory }
 * @returns {object}
 *   { meaningfulDifference, primaryBand, alternateBand,
 *     pm25Difference, pctDifference, advice, reliable }
 */
function compareRoutes(primary, alternate) {
  const primaryBand = getHazardBand(primary.pm25, primary.profileCategory);
  const alternateBand = getHazardBand(alternate.pm25, alternate.profileCategory);

  // Absolute and percentage PM2.5 difference
  const pm25Difference = Math.abs(primary.pm25 - alternate.pm25);
  const higherValue = Math.max(primary.pm25, alternate.pm25, 1); // avoid /0
  const pctDifference = pm25Difference / higherValue;

  // Different bands?
  const differentBands = primaryBand !== alternateBand;

  // Significant PM2.5 gap?
  const significantGap = pctDifference > PM25_DIFF_THRESHOLD;

  // Confidence sufficient for comparison?
  const primaryRank = CONFIDENCE_RANK[primary.confidence] ?? 0;
  const alternateRank = CONFIDENCE_RANK[alternate.confidence] ?? 0;
  const reliable = primaryRank >= CONFIDENCE_RANK.medium && alternateRank >= CONFIDENCE_RANK.medium;

  // Meaningful difference: bands differ OR gap > 5%, AND comparison is reliable
  const rawDifference = differentBands || significantGap;
  const meaningfulDifference = rawDifference && reliable;

  // Generate advice string
  const advice = generateAdvice(
    meaningfulDifference,
    reliable,
    primary.pm25,
    alternate.pm25,
    primaryBand,
    alternateBand,
  );

  return {
    meaningfulDifference,
    reliable,
    primaryBand,
    alternateBand,
    pm25Difference: Math.round(pm25Difference * 100) / 100,
    pctDifference: Math.round(pctDifference * 1000) / 1000,
    advice,
  };
}

/**
 * Generate human-readable advice for route comparison.
 *
 * @param {boolean} meaningful
 * @param {boolean} reliable
 * @param {number} primaryPm25
 * @param {number} alternatePm25
 * @param {string} primaryBand
 * @param {string} alternateBand
 * @returns {string}
 */
function generateAdvice(meaningful, reliable, primaryPm25, alternatePm25, primaryBand, alternateBand) {
  if (!reliable) {
    return 'Insufficient data to reliably compare routes. Consider checking again when more station data is available.';
  }

  if (!meaningful) {
    return 'Both routes have similar pollution exposure. Choose based on traffic and convenience.';
  }

  // There is a meaningful difference
  if (alternatePm25 < primaryPm25) {
    if (alternateBand === BANDS.SAFE && primaryBand !== BANDS.SAFE) {
      return 'The alternate route has significantly cleaner air. Consider taking it to reduce exposure.';
    }
    return 'The alternate route has lower pollution exposure. Consider it if convenient.';
  }

  if (primaryPm25 < alternatePm25) {
    if (primaryBand === BANDS.SAFE && alternateBand !== BANDS.SAFE) {
      return 'Your current route has significantly cleaner air than the alternative.';
    }
    return 'Your current route has lower pollution exposure than the alternative.';
  }

  return 'Both routes have similar pollution levels.';
}

module.exports = {
  CONFIDENCE_RANK,
  PM25_DIFF_THRESHOLD,
  compareRoutes,
};

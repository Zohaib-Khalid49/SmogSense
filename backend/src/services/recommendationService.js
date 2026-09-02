'use strict';

const { loggers } = require('../logger');
const { getRecommendationKey } = require('../domain/recommendationKeys');
const { getHazardBand, BANDS } = require('../domain/thresholds');
const { mapBandToSeverity } = require('../domain/severity');
const { getStaticRecommendation } = require('./recommendationTemplates');
const { generateExplanation } = require('./groqService');

const log = loggers.groq;

/**
 * Recommendation Service
 * ──────────────────────
 * Orchestrates the recommendation pipeline:
 *   1. Compute hazard band from PM2.5 + profile
 *   2. Check in-memory cache
 *   3. Try Groq LLM for a personalised explanation
 *   4. Fall back to static template on any failure
 *   5. Cache successful results
 *
 * The caller never needs to know whether the explanation came from
 * Groq or from the static template.
 */

// ── In-memory cache ────────────────────────────
// Key: "{hazardBand}_{profileCategory}"
// Value: { explanation, summary, advice, generatedAt }
// TTL: 10 minutes (explanations don't change for same band+profile)
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Get a complete recommendation for a given PM2.5 reading and profile.
 *
 * @param {object} opts
 * @param {number} opts.pm25             PM2.5 concentration in µg/m³
 * @param {string} opts.profileCategory  One of the six profile categories
 * @returns {Promise<object>}  { key, hazardBand, summary, explanation, advice, source, severity }
 */
async function getRecommendation({ pm25, profileCategory }) {
  const hazardBand = getHazardBand(pm25, profileCategory);
  const key = getRecommendationKey(hazardBand, profileCategory);
  const severity = mapBandToSeverity(hazardBand, pm25);

  // ── 1. Check cache ─────────────────────────
  const cached = getFromCache(key);
  if (cached) {
    log.debug({ key }, 'Cache hit');
    return {
      key,
      hazardBand,
      summary: cached.summary,
      explanation: cached.explanation,
      advice: cached.advice,
      severity,
      source: cached.source,
    };
  }

  // ── 2. Get static template (always available) ──
  const template = getStaticRecommendation(key);
  const summary = template?.summary || `Air quality is ${hazardBand}.`;
  const advice = template?.advice || [];

  // ── 3. Try Groq for a personalised explanation ──
  let explanation = null;
  let source = 'static';

  try {
    explanation = await generateExplanation({
      recommendationKey: key,
      hazardBand,
      profileCategory,
      pm25,
      staticSummary: summary,
    });

    if (explanation) {
      source = 'groq';
    }
  } catch (err) {
    // Groq failure — fall back silently
    log.warn({ key, err: err.message }, 'Groq explanation failed, using static');
  }

  // ── 4. Fall back to static if Groq failed ───
  if (!explanation) {
    explanation = summary;
    source = 'static';
  }

  // ── 5. Cache the result ────────────────────
  setCache(key, {
    summary,
    explanation,
    advice,
    source,
    generatedAt: Date.now(),
  });

  return {
    key,
    hazardBand,
    summary,
    explanation,
    advice,
    severity,
    source,
  };
}

/**
 * Retrieve a cached recommendation if still valid.
 *
 * @param {string} key
 * @returns {object|null}
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.generatedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

/**
 * Store a recommendation in the cache.
 *
 * @param {string} key
 * @param {object} value
 */
function setCache(key, value) {
  cache.set(key, value);
}

/**
 * Clear the recommendation cache (for testing).
 */
function clearCache() {
  cache.clear();
}

module.exports = { getRecommendation, clearCache };

'use strict';

const { loggers } = require('../logger');
const { getRecommendationKey } = require('../domain/recommendationKeys');
const { getHazardBand } = require('../domain/thresholds');
const { mapBandToSeverity } = require('../domain/severity');
const { getStaticRecommendation } = require('./recommendationTemplates');
const { generateRecommendation } = require('./groqService');

const log = loggers.groq;

/**
 * Recommendation Service
 * ──────────────────────
 * Orchestrates the recommendation pipeline:
 *   1. Compute hazard band from PM2.5 + profile
 *   2. Check context-aware cache
 *   3. Ask Groq for a PERSONALISED, structured recommendation using the full
 *      context (age, sub-detail, weather, confidence, PM2.5)
 *   4. Fall back to the static template (headline/summary/actions/advice)
 *      on any failure
 *   5. Cache successful results
 *
 * Output shape (consistent whether AI or fallback):
 *   { key, hazardBand, headline, summary, actions[], explanation, advice[], severity, source }
 */

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Get a complete recommendation for a reading + profile + context.
 *
 * @param {object} opts
 * @param {number} opts.pm25
 * @param {string} opts.profileCategory
 * @param {number} [opts.age]
 * @param {string} [opts.subDetail]
 * @param {object} [opts.weather]   { wind_speed_ms, humidity_pct, temperature_c }
 * @param {string} [opts.confidence]
 * @returns {Promise<object>}
 */
async function getRecommendation({
  pm25,
  profileCategory,
  age,
  subDetail,
  weather,
  confidence,
}) {
  const hazardBand = getHazardBand(pm25, profileCategory);
  const key = getRecommendationKey(hazardBand, profileCategory);
  const severity = mapBandToSeverity(hazardBand, pm25);

  // ── Static template (always available as grounding + fallback) ──
  const template = getStaticRecommendation(key) || {};
  const fallback = {
    headline: template.headline || null,
    summary: template.summary || `Air quality is ${hazardBand}.`,
    actions: Array.isArray(template.actions) ? template.actions : [],
    advice: Array.isArray(template.advice) ? template.advice : [],
  };

  // ── Context-aware cache key ─────────────────
  // Include age band + sub-detail so different people get different guidance.
  const ageBucket = bucketAge(age);
  const cacheKey = `${key}|${ageBucket}|${subDetail || '-'}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    log.debug({ cacheKey }, 'Recommendation cache hit');
    return { key, hazardBand, severity, ...cached };
  }

  // ── Ask Groq for personalised structured guidance ──
  let ai = null;
  try {
    ai = await generateRecommendation({
      hazardBand,
      profileCategory,
      pm25,
      confidence,
      age,
      subDetail,
      weather,
      fallback,
    });
  } catch (err) {
    log.warn({ key, err: err.message }, 'Groq recommendation failed, using static');
  }

  let result;
  if (ai) {
    result = {
      headline: ai.headline || fallback.headline,
      summary: ai.summary,
      actions: ai.actions,
      explanation: ai.explanation,
      advice: fallback.advice, // keep the fuller static advice for the "why" detail
      source: 'groq',
    };
  } else {
    result = {
      headline: fallback.headline,
      summary: fallback.summary,
      actions: fallback.actions,
      explanation: fallback.summary,
      advice: fallback.advice,
      source: 'static',
    };
  }

  setCache(cacheKey, result);

  return { key, hazardBand, severity, ...result };
}

/** Bucket ages so the cache doesn't fragment per exact year. */
function bucketAge(age) {
  if (typeof age !== 'number' || Number.isNaN(age)) return 'na';
  if (age < 5) return '0-4';
  if (age < 13) return '5-12';
  if (age < 18) return '13-17';
  if (age < 40) return '18-39';
  if (age < 60) return '40-59';
  return '60+';
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.generatedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  const { generatedAt, ...rest } = entry;
  void generatedAt;
  return rest;
}

function setCache(key, value) {
  cache.set(key, { ...value, generatedAt: Date.now() });
}

function clearCache() {
  cache.clear();
}

module.exports = { getRecommendation, clearCache };

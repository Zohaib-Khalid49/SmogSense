'use strict';

/**
 * Static Recommendation Templates
 * ──────────────────────────────
 * All 18 combinations (6 profiles × 3 hazard bands).
 * These serve as the authoritative fallback when the Groq LLM is
 * unavailable, rate-limited, or returns invalid output.
 *
 * Profiles: adult, child, elderly, pregnant_woman, asthma_copd, outdoor_worker
 *
 * IMPORTANT: No medical claims, diagnoses, or treatment advice.
 */

const templates = Object.freeze({
  // ═══════════════════════════════════════════════
  // SAFE — PM2.5 within acceptable range
  // ═══════════════════════════════════════════════

  safe_adult: {
    summary: 'Air quality is currently safe for normal activities.',
    advice: [
      'Enjoy outdoor activities as usual.',
      'Keep windows open for natural ventilation.',
    ],
  },

  safe_child: {
    summary: 'Air quality is currently safe for children\'s normal activities.',
    advice: [
      'Children can play outdoors as usual.',
      'Good conditions for outdoor school activities.',
    ],
  },

  safe_elderly: {
    summary: 'Air quality is currently safe for normal activities.',
    advice: [
      'Enjoy outdoor walks and activities.',
      'Good conditions for fresh-air ventilation at home.',
    ],
  },

  safe_pregnant_woman: {
    summary: 'Air quality is currently within safe levels.',
    advice: [
      'Normal outdoor activities are fine.',
      'Consider light outdoor exercise if comfortable.',
    ],
  },

  safe_asthma_copd: {
    summary: 'Air quality is currently within safe levels for you.',
    advice: [
      'Normal activities are generally fine.',
      'Keep your rescue inhaler accessible as a precaution.',
    ],
  },

  safe_outdoor_worker: {
    summary: 'Air quality is currently safe for outdoor work.',
    advice: [
      'Normal outdoor work activities can proceed.',
      'Good conditions for all scheduled outdoor tasks.',
    ],
  },

  // ═══════════════════════════════════════════════
  // CAUTION — Elevated PM2.5, sensitive groups at risk
  // ═══════════════════════════════════════════════

  caution_adult: {
    summary: 'Air quality is moderately elevated. Prolonged exertion may cause discomfort.',
    advice: [
      'Consider reducing prolonged outdoor exertion.',
      'Take breaks if you feel any throat or eye irritation.',
    ],
  },

  caution_child: {
    summary: 'Air quality is elevated. Children should reduce prolonged outdoor activity.',
    advice: [
      'Shorten outdoor play sessions.',
      'Watch for coughing or difficulty breathing.',
      'Move vigorous activities indoors.',
    ],
  },

  caution_elderly: {
    summary: 'Air quality is elevated. Reduce prolonged outdoor exertion.',
    advice: [
      'Limit long outdoor walks or strenuous activity.',
      'Stay hydrated and rest if you feel discomfort.',
      'Keep indoor spaces well-ventilated with filtered air if possible.',
    ],
  },

  caution_pregnant_woman: {
    summary: 'Air quality is elevated. Take extra care with outdoor exposure.',
    advice: [
      'Reduce time spent on outdoor exertion.',
      'Prefer indoor activities when possible.',
      'Stay well-hydrated.',
    ],
  },

  caution_asthma_copd: {
    summary: 'Air quality may trigger symptoms. Take extra precautions.',
    advice: [
      'Reduce prolonged outdoor exertion.',
      'Keep your rescue inhaler with you.',
      'Consider wearing a mask if going outside for extended periods.',
    ],
  },

  caution_outdoor_worker: {
    summary: 'Air quality is elevated. Reduce strenuous outdoor work where possible.',
    advice: [
      'Reschedule heavy physical tasks to early morning or evening if feasible.',
      'Take more frequent rest breaks in sheltered areas.',
      'Wear a protective mask during prolonged outdoor exposure.',
    ],
  },

  // ═══════════════════════════════════════════════
  // HAZARDOUS — Unhealthy for everyone
  // ═══════════════════════════════════════════════

  hazardous_adult: {
    summary: 'Air quality is unhealthy. Everyone should limit outdoor exposure.',
    advice: [
      'Stay indoors as much as possible.',
      'Keep windows and doors closed.',
      'Use an air purifier if available.',
      'Wear an N95 mask if you must go outside.',
    ],
  },

  hazardous_child: {
    summary: 'Air quality is unhealthy. Children should stay indoors.',
    advice: [
      'Keep children indoors with windows closed.',
      'Avoid all outdoor play and sports.',
      'Use an air purifier in children\'s rooms.',
      'Watch for persistent coughing or breathing difficulty.',
    ],
  },

  hazardous_elderly: {
    summary: 'Air quality is unhealthy. Stay indoors and limit exertion.',
    advice: [
      'Stay indoors with windows and doors closed.',
      'Avoid all outdoor physical activity.',
      'Run an air purifier if available.',
      'Seek fresh-air-filtered environments.',
    ],
  },

  hazardous_pregnant_woman: {
    summary: 'Air quality is unhealthy. Minimise all outdoor exposure.',
    advice: [
      'Stay indoors with windows closed.',
      'Avoid any outdoor exertion.',
      'Use an air purifier.',
      'Stay well-hydrated and rest.',
    ],
  },

  hazardous_asthma_copd: {
    summary: 'Air quality is dangerous for people with respiratory conditions. Stay indoors.',
    advice: [
      'Stay indoors with windows closed.',
      'Avoid all outdoor activity.',
      'Keep your rescue inhaler close at all times.',
      'Use an air purifier on high setting.',
    ],
  },

  hazardous_outdoor_worker: {
    summary: 'Air quality is dangerous. Outdoor work should be stopped or minimised.',
    advice: [
      'Stop or postpone non-essential outdoor work.',
      'If work cannot be avoided, wear a properly fitted N95 mask.',
      'Take frequent breaks in an air-filtered indoor space.',
      'Notify your supervisor about the hazardous air quality conditions.',
    ],
  },
});

/**
 * Look up a static recommendation template.
 *
 * @param {string} key  Recommendation key (e.g. "caution_children")
 * @returns {object|null}  { summary, advice[] } or null if not found
 */
function getStaticRecommendation(key) {
  return templates[key] || null;
}

/**
 * Return all template keys.
 * @returns {string[]}
 */
function getTemplateKeys() {
  return Object.keys(templates);
}

module.exports = { templates, getStaticRecommendation, getTemplateKeys };

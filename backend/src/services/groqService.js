'use strict';

const axios = require('axios');
const config = require('../config');
const { loggers } = require('../logger');

const log = loggers.groq;

// ── Prohibited medical terms ───────────────────
const PROHIBITED_PATTERNS = [
  /\bdiagnos/i,
  /\bprescri/i,
  /\bmedication\b/i,
  /\btreatment\b/i,
  /\bcure\b/i,
  /\bsymptom(s)?\b/i,
  /\bdisease\b/i,
  /\bdoctor\b/i,
  /\bphysician\b/i,
  /\bclinical\b/i,
  /\bdrug\b/i,
  /\bdosage\b/i,
];

// ── Constraints ────────────────────────────────
const MAX_LENGTH = 300;
const MIN_LENGTH = 20;

/**
 * Generate a constrained explanation via Groq.
 *
 * The LLM receives ONLY:
 *   • The hazard band
 *   • The profile category
 *   • The PM2.5 value
 *   • The static recommendation summary (as context)
 *
 * It does NOT receive raw sensor data, station details, or
 * any other sensitive information.
 *
 * @param {object} opts
 * @param {string} opts.recommendationKey  e.g. "caution_children"
 * @param {string} opts.hazardBand         e.g. "caution"
 * @param {string} opts.profileCategory    e.g. "children"
 * @param {number} opts.pm25               e.g. 42.3
 * @param {string} opts.staticSummary      The static template summary
 * @returns {Promise<string|null>}  Generated explanation, or null on failure
 */
async function generateExplanation({
  recommendationKey,
  hazardBand,
  profileCategory,
  pm25,
  staticSummary,
}) {
  const apiKey = config.groq.apiKey;
  if (!apiKey) {
    log.debug('No Groq API key configured — skipping LLM');
    return null;
  }

  const prompt = buildPrompt({ hazardBand, profileCategory, pm25, staticSummary });

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: config.groq.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an air-quality health advisor. Write a brief, friendly explanation ' +
              'in 1-3 sentences about the current air quality situation and what the person ' +
              'should do. Do NOT give medical advice, diagnose, prescribe, or mention ' +
              'medications. Keep it practical and actionable. Do not use bullet points.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: config.groq.maxTokens,
        temperature: 0.4,
        stream: false,
      },
      {
        timeout: config.groq.timeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status < 500,
      },
    );

    if (response.status === 429) {
      log.warn('Groq rate limit hit');
      return null;
    }

    if (response.status === 401 || response.status === 403) {
      log.error('Groq authentication failed');
      return null;
    }

    if (response.status !== 200) {
      log.error({ status: response.status }, 'Groq returned non-200');
      return null;
    }

    const explanation = extractExplanation(response.data);
    if (!explanation) return null;

    // ── Validate output ──────────────────────
    if (explanation.length < MIN_LENGTH) {
      log.warn({ length: explanation.length }, 'Groq output too short');
      return null;
    }

    if (explanation.length > MAX_LENGTH) {
      log.warn({ length: explanation.length }, 'Groq output too long, truncating');
      // Try to truncate at sentence boundary
      const truncated = truncateAtSentence(explanation, MAX_LENGTH);
      return truncated;
    }

    if (containsMedicalLanguage(explanation)) {
      log.warn('Groq output contains prohibited medical language');
      return null;
    }

    log.info({ key: recommendationKey, length: explanation.length }, 'Groq explanation generated');
    return explanation;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      log.warn('Groq request timed out');
      return null;
    }

    log.warn({ err: err.message }, 'Groq request failed');
    return null;
  }
}

/**
 * Build the user prompt for Groq.
 */
function buildPrompt({ hazardBand, profileCategory, pm25, staticSummary }) {
  const profileLabel = profileCategory.replace(/_/g, ' ');
  return (
    `Current air quality: ${hazardBand} (PM2.5: ${pm25} µg/m³). ` +
    `Profile: ${profileLabel}. ` +
    `Standard advice: "${staticSummary}". ` +
    `Write a brief, friendly explanation that expands on this advice.`
  );
}

/**
 * Extract the assistant's text from a Groq chat completion response.
 */
function extractExplanation(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;
  return content.trim();
}

/**
 * Check if text contains prohibited medical language.
 *
 * @param {string} text
 * @returns {boolean}  true if prohibited terms found
 */
function containsMedicalLanguage(text) {
  return PROHIBITED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Truncate text at the last sentence boundary within the max length.
 *
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncateAtSentence(text, maxLen) {
  const truncated = text.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxLen * 0.5) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated + '...';
}

module.exports = { generateExplanation, containsMedicalLanguage };

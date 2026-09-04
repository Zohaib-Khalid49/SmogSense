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
  /\bdisease\b/i,
  /\bdoctor\b/i,
  /\bphysician\b/i,
  /\bclinical\b/i,
  /\bdrug\b/i,
  /\bdosage\b/i,
];

// ── Constraints ────────────────────────────────
const HEADLINE_MAX = 40;
const SUMMARY_MAX = 140;
const EXPLANATION_MAX = 300;
const ACTION_MAX = 32; // each action chip: a few words
const MAX_ACTIONS = 4;

/**
 * Generate a personalised, structured recommendation via Groq.
 *
 * Unlike the old version, the LLM now receives the FULL decision context:
 *   • hazard band + PM2.5 value + confidence
 *   • profile category, age, and sub-detail (trimester / asthma vs COPD)
 *   • weather (wind, humidity, temperature) so it can reason about dispersion
 *
 * It returns STRUCTURED output the UI can render as a glanceable card:
 *   { headline, summary, actions[], explanation }
 *
 * Returns null on any failure so the caller can fall back to static templates.
 *
 * @param {object} opts
 * @param {string} opts.hazardBand         'safe' | 'caution' | 'hazardous'
 * @param {string} opts.profileCategory    e.g. 'child'
 * @param {number} opts.pm25               µg/m³
 * @param {string} [opts.confidence]       'high' | 'medium' | 'low' | 'model_only'
 * @param {number} [opts.age]              person's age
 * @param {string} [opts.subDetail]        e.g. 'trimester_2', 'asthma', 'copd'
 * @param {object} [opts.weather]          { wind_speed_ms, humidity_pct, temperature_c }
 * @param {object} [opts.fallback]         static { summary, advice[] } for grounding
 * @returns {Promise<{headline,summary,actions,explanation}|null>}
 */
async function generateRecommendation({
  hazardBand,
  profileCategory,
  pm25,
  confidence,
  age,
  subDetail,
  weather,
  fallback,
}) {
  const apiKey = config.groq.apiKey;
  if (!apiKey) {
    log.debug('No Groq API key configured — skipping LLM');
    return null;
  }

  const prompt = buildPrompt({
    hazardBand,
    profileCategory,
    pm25,
    confidence,
    age,
    subDetail,
    weather,
    fallback,
  });

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: config.groq.model,
        messages: [
          {
            role: 'system',
            content:
              'You are SmogSense, a friendly air-quality advisor for Lahore. ' +
              'Respond with ONLY a JSON object and nothing else — no markdown, no code fences, no text before or after. ' +
              'Schema: {"headline": string, "summary": string, "actions": string[], "explanation": string}. ' +
              'headline: 2-4 words naming the key action (e.g. "Limit outdoor time"). ' +
              'summary: one short plain sentence. ' +
              'actions: 2-4 items, each a SHORT phrase of 2-4 words (e.g. "Wear an N95", "Keep trips short"). ' +
              'explanation: 1-2 short sentences on why. ' +
              'Tailor everything to the person\'s age and situation and the reading. ' +
              'Never diagnose, prescribe, or name medications. Keep it plain for a non-expert.',
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

    const raw = response.data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') return null;

    const parsed = safeParseJson(raw);
    if (!parsed) {
      log.warn('Groq output was not valid JSON');
      return null;
    }

    const result = validateAndClean(parsed);
    if (!result) {
      log.warn('Groq output failed validation');
      return null;
    }

    log.info(
      { band: hazardBand, profile: profileCategory, actions: result.actions.length },
      'Groq recommendation generated',
    );
    return result;
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
 * Build the user prompt with the full decision context.
 */
function buildPrompt({
  hazardBand,
  profileCategory,
  pm25,
  confidence,
  age,
  subDetail,
  weather,
  fallback,
}) {
  const lines = [];
  lines.push(`Air quality band: ${hazardBand}.`);
  lines.push(`PM2.5: ${pm25} µg/m³.`);
  if (confidence) lines.push(`Reading confidence: ${confidence}.`);

  const profileLabel = profileCategory.replace(/_/g, ' ');
  let person = `Person: ${profileLabel}`;
  if (typeof age === 'number' && !Number.isNaN(age)) person += `, age ${age}`;
  if (subDetail) person += `, detail: ${humaniseSubDetail(subDetail)}`;
  lines.push(person + '.');

  if (weather) {
    const w = [];
    if (typeof weather.wind_speed_ms === 'number') {
      const wind = weather.wind_speed_ms;
      const windNote = wind < 1.5 ? ' (low — pollution may linger)' : '';
      w.push(`wind ${wind} m/s${windNote}`);
    }
    if (typeof weather.humidity_pct === 'number') w.push(`humidity ${weather.humidity_pct}%`);
    if (typeof weather.temperature_c === 'number') w.push(`temp ${weather.temperature_c}°C`);
    if (w.length) lines.push(`Weather: ${w.join(', ')}.`);
  }

  if (fallback?.summary) {
    lines.push(`Reference guidance: "${fallback.summary}".`);
  }

  lines.push(
    'Produce the JSON described in the system prompt, tailored specifically to this person and reading.',
  );
  return lines.join(' ');
}

/** Turn a sub-detail id into a human phrase for the prompt. */
function humaniseSubDetail(sub) {
  const map = {
    trimester_1: 'first trimester of pregnancy',
    trimester_2: 'second trimester of pregnancy',
    trimester_3: 'third trimester of pregnancy',
    asthma: 'has asthma',
    copd: 'has COPD',
    other: 'has a respiratory condition',
  };
  if (map[sub]) return map[sub];
  if (typeof sub === 'string' && sub.startsWith('other:')) {
    return `respiratory condition: ${sub.slice(6)}`;
  }
  return String(sub);
}

/** Parse JSON, tolerating stray markdown fences. */
function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validate and sanitise the structured LLM output.
 * Returns a clean object or null if it can't be trusted.
 */
function validateAndClean(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const headline = clip(str(obj.headline), HEADLINE_MAX);
  const summary = clip(str(obj.summary), SUMMARY_MAX);
  const explanation = clip(str(obj.explanation), EXPLANATION_MAX);

  let actions = Array.isArray(obj.actions)
    ? obj.actions.map((a) => clip(str(a), ACTION_MAX)).filter(Boolean)
    : [];
  actions = actions.slice(0, MAX_ACTIONS);

  // Must have at least a summary and one action to be useful
  if (!summary || actions.length === 0) return null;

  // Medical-language guard across all fields
  const combined = [headline, summary, explanation, ...actions].join(' ');
  if (containsMedicalLanguage(combined)) {
    log.warn('Groq output contains prohibited medical language');
    return null;
  }

  return {
    headline: headline || null,
    summary,
    actions,
    explanation: explanation || summary,
  };
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function clip(s, max) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max).trim() : s;
}

/**
 * Check if text contains prohibited medical language.
 * @param {string} text
 * @returns {boolean}
 */
function containsMedicalLanguage(text) {
  return PROHIBITED_PATTERNS.some((pattern) => pattern.test(text));
}

module.exports = { generateRecommendation, containsMedicalLanguage };

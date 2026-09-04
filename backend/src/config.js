'use strict';

require('dotenv').config();

function env(name, fallback) {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Required environment variable ${name} is not set`);
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw !== undefined && raw !== '') {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) throw new Error(`${name} must be a valid integer`);
    return parsed;
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Required integer environment variable ${name} is not set`);
}

function float(name, fallback) {
  const raw = process.env[name];
  if (raw !== undefined && raw !== '') {
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) throw new Error(`${name} must be a valid number`);
    return parsed;
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Required number environment variable ${name} is not set`);
}

const config = {
  // ── Server ──────────────────────────────────
  port: int('PORT', 3000),
  nodeEnv: env('NODE_ENV', 'development'),

  // ── MongoDB ─────────────────────────────────
  mongodb: {
    uri: env('MONGODB_URI', 'mongodb://localhost:27017/smogsense'),
    dbName: env('MONGODB_DB_NAME', 'smogsense'),
  },

  // ── Groq LLM ────────────────────────────────
  groq: {
    apiKey: env('GROQ_API_KEY', ''),
    model: env('GROQ_MODEL', 'openai/gpt-oss-20b'),
    maxTokens: 400,
    timeoutMs: 8000,
  },

  // ── Firebase / Push ──────────────────────────
  firebase: {
    serviceAccountPath: env('FIREBASE_SERVICE_ACCOUNT_PATH', ''),
  },

  // ── Lahore Region ───────────────────────────
  lahore: {
    center: { lat: 31.5204, lng: 74.3587 },
    bounds: {
      latMin: 31.25,
      latMax: 31.80,
      lngMin: 74.05,
      lngMax: 74.65,
    },
  },

  // ── OpenAQ (optional, improves rate limits) ──
  openaq: {
    apiKey: env('OPENAQ_API_KEY', ''),
  },

  // ── Upstream API endpoints ──────────────────
  apis: {
    openaq: 'https://api.openaq.org/v3',
    openMeteoAirQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    openMeteoWeather: 'https://api.open-meteo.com/v1/forecast',
  },

  // ── Ingestion ───────────────────────────────
  ingestion: {
    // How recent a reading must be to be usable. OpenAQ station readings are
    // inherently delayed — /latest returns the last *measurement* time, which
    // is commonly 1–2 h old — so a 1 h window caused constant fallback to the
    // CAMS model. 3 h keeps real station data usable and matches the LOW
    // confidence tier in domain/confidence.js. Override via READING_FRESHNESS_MS.
    freshnessMs: int('READING_FRESHNESS_MS', 3 * 60 * 60 * 1000),
    stationRadiusKm: 30,
    averagingWindowMs: 24 * 60 * 60 * 1000, // 24-hour rolling average
  },

  // ── Confidence thresholds ───────────────────
  confidence: {
    highRadiusKm: 5,
    mediumRadiusKm: 15,
    lowRadiusKm: 30,
  },

  // ── Alerts ──────────────────────────────────
  alerts: {
    dailyHourUtc: 1,
    suppressWindowMs: 2 * 60 * 60 * 1000,
  },

  // ── Scheduled jobs ──────────────────────────
  cron: {
    ingestion: '0 * * * *',
    dailyAlert: '0 1 * * *',
  },
};

module.exports = config;

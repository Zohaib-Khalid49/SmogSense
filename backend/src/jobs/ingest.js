'use strict';

const config = require('../config');
const { loggers } = require('../logger');
const db = require('../db');
const Reading = require('../models/Reading');
const Weather = require('../models/Weather');
const { fetchLatestReadings, UpstreamError } = require('../services/openaqAdapter');
const { fetchCamsData } = require('../services/openMeteoCamsAdapter');
const { fetchWeather } = require('../services/openMeteoWeatherAdapter');

const log = loggers.ingestion;

/**
 * Hourly Ingestion Job
 * ────────────────────
 * Fetches pollution and weather data from upstream sources and persists
 * them into MongoDB with idempotent upserts.
 *
 * Key rules:
 *   • Partial success: one source failing does not block others
 *   • Idempotent upserts: same station + timestamp = update, not duplicate
 *   • Never generates synthetic pollution values
 *   • Logs upstream failures without leaking details
 */

/**
 * Run a full ingestion cycle.
 *
 * @returns {object}  Summary of what was ingested
 */
async function runIngestion() {
  const { lat, lng } = config.lahore.center;
  const summary = {
    openaq: { success: false, count: 0, error: null },
    cams: { success: false, count: 0, error: null },
    weather: { success: false, count: 0, error: null },
  };

  log.info('Starting ingestion cycle');

  // ── 1. Fetch OpenAQ station readings ─────────
  let openaqReadings = [];
  try {
    openaqReadings = await fetchLatestReadings({ lat, lng });
    const upserted = await upsertReadings(openaqReadings);
    summary.openaq = { success: true, count: upserted, error: null };
    log.info({ count: upserted }, 'OpenAQ readings persisted');
  } catch (err) {
    summary.openaq = {
      success: false,
      count: 0,
      error: err.message,
    };
    log.error(
      { source: err.source || 'openaq', reason: err.reason || err.message },
      'OpenAQ ingestion failed',
    );
  }

  // ── 2. Fetch CAMS model data ─────────────────
  try {
    const camsReading = await fetchCamsData({ lat, lng });
    if (camsReading) {
      const upserted = await upsertReadings([camsReading]);
      summary.cams = { success: true, count: upserted, error: null };
      log.info('CAMS data persisted');
    } else {
      summary.cams = { success: true, count: 0, error: 'No data returned' };
    }
  } catch (err) {
    summary.cams = {
      success: false,
      count: 0,
      error: err.message,
    };
    log.error(
      { source: err.source || 'cams', reason: err.reason || err.message },
      'CAMS ingestion failed',
    );
  }

  // ── 3. Fetch weather data ────────────────────
  try {
    const weatherData = await fetchWeather({ lat, lng });
    if (weatherData) {
      await upsertWeather(weatherData);
      summary.weather = { success: true, count: 1, error: null };
      log.info('Weather data persisted');
    } else {
      summary.weather = { success: true, count: 0, error: 'No data returned' };
    }
  } catch (err) {
    summary.weather = {
      success: false,
      count: 0,
      error: err.message,
    };
    log.error(
      { source: err.source || 'weather', reason: err.reason || err.message },
      'Weather ingestion failed',
    );
  }

  // ── 4. Log overall result ────────────────────
  const totalSuccess =
    (summary.openaq.success ? 1 : 0) +
    (summary.cams.success ? 1 : 0) +
    (summary.weather.success ? 1 : 0);

  if (totalSuccess === 0) {
    log.error('All upstream sources failed — no data ingested');
  } else {
    log.info(
      {
        openaq: summary.openaq.count,
        cams: summary.cams.count,
        weather: summary.weather.count,
      },
      'Ingestion cycle complete',
    );
  }

  return summary;
}

/**
 * Idempotent upsert of readings into the readings collection.
 * Uses (station_id, timestamp) as the unique key.
 *
 * IMPORTANT: Never generates synthetic pollution values.
 * Only persists data that came directly from upstream sources.
 *
 * @param {Array} readings  Normalised reading objects
 * @returns {number}  Number of documents upserted
 */
async function upsertReadings(readings) {
  if (!Array.isArray(readings) || readings.length === 0) return 0;

  let count = 0;

  for (const reading of readings) {
    try {
      // Validate: must have pm25, station_id, and timestamp
      if (
        typeof reading.pm25 !== 'number' ||
        !reading.station_id ||
        !reading.timestamp
      ) {
        log.warn({ stationId: reading.station_id }, 'Skipping invalid reading');
        continue;
      }

      await Reading.findOneAndUpdate(
        {
          station_id: reading.station_id,
          timestamp: reading.timestamp,
        },
        {
          $set: {
            source: reading.source,
            pm25: reading.pm25,
            pm10: reading.pm10 ?? null,
            station_location: reading.station_location,
            station_name: reading.station_name,
          },
        },
        { upsert: true, new: true },
      );

      count++;
    } catch (err) {
      log.warn(
        { stationId: reading.station_id, err: err.message },
        'Failed to upsert reading',
      );
      // Continue with other readings
    }
  }

  return count;
}

/**
 * Idempotent upsert of weather data.
 * Uses timestamp as the unique key.
 *
 * @param {object} weatherData  Normalised weather object
 */
async function upsertWeather(weatherData) {
  if (!weatherData || !weatherData.timestamp) {
    log.warn('Skipping invalid weather data');
    return;
  }

  await Weather.findOneAndUpdate(
    { timestamp: weatherData.timestamp },
    {
      $set: {
        temperature_c: weatherData.temperature_c,
        humidity_pct: weatherData.humidity_pct,
        wind_speed_ms: weatherData.wind_speed_ms,
        wind_direction_deg: weatherData.wind_direction_deg,
        pressure_hpa: weatherData.pressure_hpa,
      },
    },
    { upsert: true, new: true },
  );
}

// ── Standalone execution ───────────────────────
// Run with: npm run ingest
if (require.main === module) {
  (async () => {
    try {
      await db.connect();
      const result = await runIngestion();
      console.log(JSON.stringify(result, null, 2));
      await db.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Fatal ingestion error:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { runIngestion, upsertReadings, upsertWeather };

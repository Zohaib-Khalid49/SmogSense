'use strict';

const axios = require('axios');
const config = require('../config');
const { loggers } = require('../logger');

const log = loggers.external;

// ── Timeout (OpenAQ can be slow) ──────────────
const TIMEOUT_MS = 10000;

/**
 * Fetch latest PM2.5 readings from OpenAQ stations near a location.
 *
 * Queries the OpenAQ v3 API for locations within a given radius and
 * returns normalised reading objects.
 *
 * @param {object} opts
 * @param {number} opts.lat       Latitude (Lahore center by default)
 * @param {number} opts.lng       Longitude
 * @param {number} [opts.radiusKm] Search radius in km
 * @returns {Promise<Array>}  Normalised readings (may be empty)
 * @throws {UpstreamError}  On network failure, timeout, or invalid response
 */
// ── OpenAQ API limits ──────────────────────────
// Maximum search radius allowed by OpenAQ v3 is 25,000 meters
const MAX_RADIUS_METERS = 25000;

async function fetchLatestReadings({ lat, lng, radiusKm }) {
  const radius = radiusKm ?? config.ingestion.stationRadiusKm;
  const radiusMeters = Math.min(radius * 1000, MAX_RADIUS_METERS);

  try {
    const response = await axios.get(`${config.apis.openaq}/locations`, {
      params: {
        coordinates: `${lat},${lng}`,
        radius: radiusMeters,
        parameter: 'pm25,pm10',
        limit: 50,
      },
      timeout: TIMEOUT_MS,
      headers: config.openaq?.apiKey
        ? { 'X-API-Key': config.openaq.apiKey }
        : undefined,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 401 || response.status === 403) {
      log.error('OpenAQ authentication failed');
      throw new UpstreamError('openaq', 'Authentication failed');
    }

    if (response.status === 429) {
      log.warn('OpenAQ rate limit hit');
      throw new UpstreamError('openaq', 'Rate limited', { retryAfter: true });
    }

    if (response.status !== 200) {
      log.error({ status: response.status }, 'OpenAQ returned non-200');
      throw new UpstreamError('openaq', `HTTP ${response.status}`);
    }

    return normaliseResponse(response.data);
  } catch (err) {
    if (err instanceof UpstreamError) throw err;

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      log.error('OpenAQ request timed out');
      throw new UpstreamError('openaq', 'Request timed out');
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      log.error({ code: err.code }, 'OpenAQ connection failed');
      throw new UpstreamError('openaq', 'Connection failed');
    }

    log.error({ err: err.message }, 'OpenAQ unexpected error');
    throw new UpstreamError('openaq', 'Unexpected error');
  }
}

/**
 * Normalise OpenAQ v3 response into internal reading schema.
 *
 * @param {object} data  Raw OpenAQ response
 * @returns {Array}  Normalised readings
 */
function normaliseResponse(data) {
  const results = data?.results;
  if (!Array.isArray(results)) {
    log.warn('OpenAQ response missing results array');
    return [];
  }

  const readings = [];

  for (const location of results) {
    try {
      // Validate required fields
      const stationId = String(location.id);
      const stationName = location.name || '';
      const coords = location.coordinates;
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        continue;
      }

      // Extract PM2.5 and PM10 measurements from sensors
      const sensors = location.sensors;
      if (!Array.isArray(sensors)) continue;

      let pm25Value = null;
      let pm10Value = null;
      let latestTimestamp = null;

      for (const sensor of sensors) {
        const latest = sensor.latest;
        if (!latest || typeof latest.value !== 'number') continue;

        const paramName = (sensor.parameter || sensor.name || '').toLowerCase();

        if ((paramName.includes('pm25') || paramName.includes('pm2.5')) && pm25Value === null) {
          pm25Value = Math.round(latest.value * 100) / 100;
          if (latest.datetime) {
            const ts = new Date(latest.datetime);
            if (!isNaN(ts.getTime())) latestTimestamp = ts;
          }
        } else if ((paramName.includes('pm10') || paramName.includes('pm 10')) && pm10Value === null) {
          pm10Value = Math.round(latest.value * 100) / 100;
        }
      }

      // PM2.5 is required to create a reading; PM10 is optional
      if (pm25Value === null) continue;

      const timestamp = latestTimestamp || new Date();
      if (isNaN(timestamp.getTime())) continue;

      readings.push({
        station_id: `openaq_${stationId}`,
        source: 'openaq',
        pm25: pm25Value,
        pm10: pm10Value,
        timestamp,
        station_location: {
          type: 'Point',
          coordinates: [coords.longitude, coords.latitude],
        },
        station_name: stationName,
      });
    } catch (parseErr) {
      log.warn(
        { locationId: location.id, err: parseErr.message },
        'Failed to parse OpenAQ location',
      );
      // Skip malformed entries, continue with others
    }
  }

  log.info({ count: readings.length }, 'OpenAQ readings normalised');
  return readings;
}

/**
 * Custom error for upstream adapter failures.
 * Carries enough info for structured logging without leaking to clients.
 */
class UpstreamError extends Error {
  constructor(source, reason, meta = {}) {
    super(`${source} upstream failure: ${reason}`);
    this.name = 'UpstreamError';
    this.source = source;
    this.reason = reason;
    this.meta = meta;
  }
}

module.exports = { fetchLatestReadings, UpstreamError };

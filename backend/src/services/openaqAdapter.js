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

  const authHeaders = config.openaq?.apiKey
    ? { 'X-API-Key': config.openaq.apiKey }
    : undefined;

  try {
    // ── Step 1: find nearby locations (metadata + sensor ids only) ──
    const response = await axios.get(`${config.apis.openaq}/locations`, {
      params: {
        coordinates: `${lat},${lng}`,
        radius: radiusMeters,
        limit: 100,
      },
      timeout: TIMEOUT_MS,
      headers: authHeaders,
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

    const locations = Array.isArray(response.data?.results)
      ? response.data.results
      : [];

    // ── Step 2: fetch each location's latest measurements ──────────
    // v3 /locations does NOT carry values; latest values live at
    // /locations/{id}/latest, keyed by sensorsId.
    const readings = await fetchLatestForLocations(locations, authHeaders);

    log.info({ count: readings.length }, 'OpenAQ readings normalised');
    return readings;
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
 * For each location, look up its pm25 (and pm10) sensor ids, fetch the
 * location's /latest payload, and match values by sensorsId.
 * Runs in small parallel batches to stay fast without hammering the API.
 *
 * @param {Array} locations  Raw /v3/locations results
 * @param {object|undefined} authHeaders
 * @returns {Promise<Array>}  Normalised readings
 */
async function fetchLatestForLocations(locations, authHeaders) {
  const BATCH_SIZE = 8;
  const readings = [];

  for (let i = 0; i < locations.length; i += BATCH_SIZE) {
    const batch = locations.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((loc) => fetchOneLocationReading(loc, authHeaders)),
    );
    for (const r of results) {
      if (r) readings.push(r);
    }
  }

  return readings;
}

/**
 * Fetch and normalise a single location's latest PM2.5 reading.
 * Returns null if the location has no usable PM2.5 value.
 */
async function fetchOneLocationReading(location, authHeaders) {
  try {
    const coords = location.coordinates;
    if (
      !coords ||
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number'
    ) {
      return null;
    }

    const sensors = Array.isArray(location.sensors) ? location.sensors : [];
    if (sensors.length === 0) return null;

    // Map sensorId → parameter name for pm25 / pm10
    let pm25SensorId = null;
    let pm10SensorId = null;
    for (const sensor of sensors) {
      const paramName = (
        sensor.parameter?.name ||
        sensor.parameter ||
        sensor.name ||
        ''
      )
        .toString()
        .toLowerCase();
      if ((paramName === 'pm25' || paramName === 'pm2.5') && pm25SensorId === null) {
        pm25SensorId = sensor.id;
      } else if (paramName === 'pm10' && pm10SensorId === null) {
        pm10SensorId = sensor.id;
      }
    }

    // No PM2.5 sensor at this station → skip
    if (pm25SensorId === null) return null;

    // Fetch the latest values for this location
    const latestRes = await axios.get(
      `${config.apis.openaq}/locations/${location.id}/latest`,
      {
        timeout: TIMEOUT_MS,
        headers: authHeaders,
        validateStatus: (status) => status < 500,
      },
    );

    if (latestRes.status !== 200) return null;

    const latestResults = Array.isArray(latestRes.data?.results)
      ? latestRes.data.results
      : [];

    let pm25Value = null;
    let pm10Value = null;
    let timestamp = null;

    for (const entry of latestResults) {
      if (typeof entry.value !== 'number') continue;
      if (entry.sensorsId === pm25SensorId) {
        pm25Value = Math.round(entry.value * 100) / 100;
        const dt = entry.datetime?.utc || entry.datetime;
        if (dt) {
          const ts = new Date(dt);
          if (!isNaN(ts.getTime())) timestamp = ts;
        }
      } else if (entry.sensorsId === pm10SensorId) {
        pm10Value = Math.round(entry.value * 100) / 100;
      }
    }

    // PM2.5 is required; must be a valid non-negative number
    if (pm25Value === null || pm25Value < 0) return null;

    return {
      station_id: `openaq_${location.id}`,
      source: 'openaq',
      pm25: pm25Value,
      pm10: pm10Value,
      timestamp: timestamp || new Date(),
      station_location: {
        type: 'Point',
        coordinates: [coords.longitude, coords.latitude],
      },
      station_name: location.name || '',
    };
  } catch (err) {
    log.warn(
      { locationId: location.id, err: err.message },
      'Failed to fetch OpenAQ location latest',
    );
    return null;
  }
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

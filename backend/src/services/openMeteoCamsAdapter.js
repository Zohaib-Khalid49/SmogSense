'use strict';

const axios = require('axios');
const config = require('../config');
const { loggers } = require('../logger');
const { UpstreamError } = require('./openaqAdapter');

const log = loggers.external;

// ── Timeout ────────────────────────────────────
const TIMEOUT_MS = 10000;

/**
 * Fetch current PM2.5 from Open-Meteo CAMS (Copernicus Atmosphere Monitoring Service).
 *
 * This is a gridded model — not a physical station. Returns a single
 * reading attributed to the CAMS source for the given coordinates.
 *
 * @param {object} opts
 * @param {number} opts.lat  Latitude
 * @param {number} opts.lng  Longitude
 * @returns {Promise<object|null>}  Normalised reading or null if unavailable
 * @throws {UpstreamError}  On failure
 */
async function fetchCamsData({ lat, lng }) {
  try {
    const response = await axios.get(config.apis.openMeteoAirQuality, {
      params: {
        latitude: lat,
        longitude: lng,
        current: 'pm2_5,pm10',
        timezone: 'auto',
      },
      timeout: TIMEOUT_MS,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      log.error({ status: response.status }, 'Open-Meteo CAMS returned non-200');
      throw new UpstreamError('cams', `HTTP ${response.status}`);
    }

    return normaliseResponse(response.data, lat, lng);
  } catch (err) {
    if (err instanceof UpstreamError) throw err;

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      log.error('Open-Meteo CAMS request timed out');
      throw new UpstreamError('cams', 'Request timed out');
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      log.error({ code: err.code }, 'Open-Meteo CAMS connection failed');
      throw new UpstreamError('cams', 'Connection failed');
    }

    log.error({ err: err.message }, 'Open-Meteo CAMS unexpected error');
    throw new UpstreamError('cams', 'Unexpected error');
  }
}

/**
 * Normalise Open-Meteo CAMS response.
 *
 * Open-Meteo returns:
 *   { current: { time: "2026-08-30T08:00", pm2_5: 42.3 } }
 *
 * @param {object} data  Raw API response
 * @param {number} lat   Query latitude
 * @param {number} lng   Query longitude
 * @returns {object|null}  Normalised reading
 */
function normaliseResponse(data, lat, lng) {
  const current = data?.current;
  if (!current) {
    log.warn('Open-Meteo CAMS response missing current data');
    return null;
  }

  const pm25 = current.pm2_5;
  if (typeof pm25 !== 'number' || isNaN(pm25) || pm25 < 0) {
    log.warn({ pm25 }, 'Open-Meteo CAMS returned invalid PM2.5');
    return null;
  }

  // PM10 is optional — not all CAMS grids report it
  let pm10 = null;
  if (typeof current.pm10 === 'number' && !isNaN(current.pm10) && current.pm10 >= 0) {
    pm10 = Math.round(current.pm10 * 100) / 100;
  }

  const timestamp = current.time ? new Date(current.time) : new Date();
  if (isNaN(timestamp.getTime())) {
    log.warn({ time: current.time }, 'Open-Meteo CAMS returned invalid timestamp');
    return null;
  }

  return {
    station_id: 'cams',
    source: 'cams',
    pm25: Math.round(pm25 * 100) / 100,
    pm10,
    timestamp,
    station_location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    station_name: 'CAMS Model (Open-Meteo)',
  };
}

module.exports = { fetchCamsData };

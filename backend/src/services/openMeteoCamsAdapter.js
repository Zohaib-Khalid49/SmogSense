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

/**
 * Build a grid of points covering Lahore's bounds so the CAMS fallback can
 * vary by location instead of returning one city-wide value everywhere.
 *
 * @param {object} bounds  { latMin, latMax, lngMin, lngMax }
 * @param {number} [steps] Points per axis (steps x steps grid). Default 3.
 * @returns {Array<{lat:number,lng:number}>}
 */
function buildLahoreGrid(bounds, steps = 3) {
  const { latMin, latMax, lngMin, lngMax } = bounds;
  const points = [];
  const denom = steps > 1 ? steps - 1 : 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const lat = latMin + ((latMax - latMin) * i) / denom;
      const lng = lngMin + ((lngMax - lngMin) * j) / denom;
      points.push({
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
      });
    }
  }
  return points;
}

/**
 * Fetch CAMS PM2.5 for a grid of points across Lahore in a single request.
 * Open-Meteo accepts comma-separated coordinates and returns an array of
 * per-location results, so the whole grid costs one API call.
 *
 * Each grid cell becomes a distinct pseudo-station (`cams_<lat>_<lng>`) with
 * its own coordinates, so the geospatial nearest-lookup can return the value
 * closest to the user rather than a single city-wide number.
 *
 * @param {object} opts
 * @param {object} opts.bounds  Lahore bounds { latMin, latMax, lngMin, lngMax }
 * @param {number} [opts.steps] Grid resolution per axis (default 3 → 9 points)
 * @returns {Promise<Array>}  Normalised readings (may be empty)
 * @throws {UpstreamError}  On failure
 */
async function fetchCamsGrid({ bounds, steps = 3 }) {
  const grid = buildLahoreGrid(bounds, steps);
  const latitudes = grid.map((p) => p.lat).join(',');
  const longitudes = grid.map((p) => p.lng).join(',');

  try {
    const response = await axios.get(config.apis.openMeteoAirQuality, {
      params: {
        latitude: latitudes,
        longitude: longitudes,
        current: 'pm2_5,pm10',
        timezone: 'auto',
      },
      timeout: TIMEOUT_MS,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      log.error({ status: response.status }, 'Open-Meteo CAMS grid returned non-200');
      throw new UpstreamError('cams', `HTTP ${response.status}`);
    }

    // For multiple coordinates Open-Meteo returns an array; for a single
    // point it returns an object. Normalise to an array either way.
    const payload = Array.isArray(response.data) ? response.data : [response.data];

    const readings = [];
    for (const cell of payload) {
      const lat = typeof cell.latitude === 'number' ? cell.latitude : null;
      const lng = typeof cell.longitude === 'number' ? cell.longitude : null;
      if (lat === null || lng === null) continue;
      const reading = normaliseGridCell(cell, lat, lng);
      if (reading) readings.push(reading);
    }

    log.info({ count: readings.length }, 'CAMS grid readings normalised');
    return readings;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw new UpstreamError('cams', 'Request timed out');
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new UpstreamError('cams', 'Connection failed');
    }
    log.error({ err: err.message }, 'Open-Meteo CAMS grid unexpected error');
    throw new UpstreamError('cams', 'Unexpected error');
  }
}

/**
 * Normalise one grid cell of a multi-point CAMS response into a reading
 * anchored at that cell's coordinates.
 */
function normaliseGridCell(data, lat, lng) {
  const current = data?.current;
  if (!current) return null;

  const pm25 = current.pm2_5;
  if (typeof pm25 !== 'number' || isNaN(pm25) || pm25 < 0) return null;

  let pm10 = null;
  if (typeof current.pm10 === 'number' && !isNaN(current.pm10) && current.pm10 >= 0) {
    pm10 = Math.round(current.pm10 * 100) / 100;
  }

  const timestamp = current.time ? new Date(current.time) : new Date();
  if (isNaN(timestamp.getTime())) return null;

  // Stable id per grid cell so hourly upserts update rather than duplicate.
  const stationId = `cams_${lat.toFixed(2)}_${lng.toFixed(2)}`;

  return {
    station_id: stationId,
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

module.exports = { fetchCamsData, fetchCamsGrid, buildLahoreGrid };

'use strict';

const axios = require('axios');
const config = require('../config');
const { loggers } = require('../logger');
const { UpstreamError } = require('./openaqAdapter');

const log = loggers.external;

// ── Timeout ────────────────────────────────────
const TIMEOUT_MS = 8000;

/**
 * Fetch current weather data from Open-Meteo Forecast API.
 *
 * Returns temperature, humidity, wind speed/direction, and pressure
 * for the given Lahore coordinates.
 *
 * @param {object} opts
 * @param {number} opts.lat  Latitude
 * @param {number} opts.lng  Longitude
 * @returns {Promise<object|null>}  Normalised weather data or null
 * @throws {UpstreamError}  On failure
 */
async function fetchWeather({ lat, lng }) {
  try {
    const response = await axios.get(config.apis.openMeteoWeather, {
      params: {
        latitude: lat,
        longitude: lng,
        current: [
          'temperature_2m',
          'relative_humidity_2m',
          'wind_speed_10m',
          'wind_direction_10m',
          'surface_pressure',
        ].join(','),
        timezone: 'auto',
      },
      timeout: TIMEOUT_MS,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      log.error({ status: response.status }, 'Open-Meteo weather returned non-200');
      throw new UpstreamError('weather', `HTTP ${response.status}`);
    }

    return normaliseResponse(response.data);
  } catch (err) {
    if (err instanceof UpstreamError) throw err;

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      log.error('Open-Meteo weather request timed out');
      throw new UpstreamError('weather', 'Request timed out');
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      log.error({ code: err.code }, 'Open-Meteo weather connection failed');
      throw new UpstreamError('weather', 'Connection failed');
    }

    log.error({ err: err.message }, 'Open-Meteo weather unexpected error');
    throw new UpstreamError('weather', 'Unexpected error');
  }
}

/**
 * Normalise Open-Meteo weather response.
 *
 * Open-Meteo returns:
 *   { current: {
 *       time: "2026-08-30T08:00",
 *       temperature_2m: 34.2,
 *       relative_humidity_2m: 65,
 *       wind_speed_10m: 12.5,     // km/h
 *       wind_direction_10m: 225,
 *       surface_pressure: 1008.3
 *     }
 *   }
 *
 * @param {object} data  Raw API response
 * @returns {object|null}  Normalised weather data
 */
function normaliseResponse(data) {
  const current = data?.current;
  if (!current) {
    log.warn('Open-Meteo weather response missing current data');
    return null;
  }

  const temperature = current.temperature_2m;
  if (typeof temperature !== 'number' || isNaN(temperature)) {
    log.warn('Open-Meteo weather missing valid temperature');
    return null;
  }

  const timestamp = current.time ? new Date(current.time) : new Date();
  if (isNaN(timestamp.getTime())) {
    log.warn({ time: current.time }, 'Open-Meteo weather invalid timestamp');
    return null;
  }

  // Convert wind speed from km/h to m/s (internal standard)
  const windSpeedKmh = current.wind_speed_10m;
  const windSpeedMs =
    typeof windSpeedKmh === 'number' && !isNaN(windSpeedKmh)
      ? Math.round((windSpeedKmh / 3.6) * 100) / 100
      : null;

  return {
    timestamp,
    temperature_c: Math.round(temperature * 10) / 10,
    humidity_pct:
      typeof current.relative_humidity_2m === 'number'
        ? Math.round(current.relative_humidity_2m)
        : null,
    wind_speed_ms: windSpeedMs,
    wind_direction_deg:
      typeof current.wind_direction_10m === 'number'
        ? Math.round(current.wind_direction_10m)
        : null,
    pressure_hpa:
      typeof current.surface_pressure === 'number'
        ? Math.round(current.surface_pressure * 10) / 10
        : null,
  };
}

module.exports = { fetchWeather };

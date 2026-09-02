'use strict';

const Reading = require('../models/Reading');
const Weather = require('../models/Weather');
const config = require('../config');
const { haversineKm } = require('../domain/confidence');
const { calculateRollingAverage } = require('../domain/rollingAverage');
const { loggers } = require('../logger');

const log = loggers.db;

/**
 * Data Access Service
 * ──────────────────
 * Provides query helpers for endpoints to retrieve cached readings
 * and weather from MongoDB. Never calls external APIs directly.
 */

/**
 * Find the best available reading near the given coordinates,
 * including a rolling 24-hour average for that station.
 *
 * Strategy:
 *   1. Query the latest reading from OpenAQ stations within the radius
 *   2. If no station data, fall back to CAMS model data
 *   3. Return the most recent reading with distance info
 *   4. Compute rolling 24-hour average for the matched station
 *
 * @param {number} lat  Query latitude
 * @param {number} lng  Query longitude
 * @returns {Promise<object|null>}  { reading, distanceKm, sources, averaging }
 */
async function findNearestReading(lat, lng) {
  const maxAge = new Date(Date.now() - config.ingestion.freshnessMs);
  const sources = [];

  // ── 1. Try OpenAQ station readings ──────────
  try {
    // Find all recent readings
    const readings = await Reading.find({
      timestamp: { $gte: maxAge },
      source: 'openaq',
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    if (readings.length > 0) {
      sources.push('openaq');

      // Find closest station
      let closest = null;
      let closestDist = Infinity;

      for (const r of readings) {
        const coords = r.station_location?.coordinates;
        if (!coords || coords.length !== 2) continue;

        const dist = haversineKm(lat, lng, coords[1], coords[0]);
        if (dist < closestDist) {
          closestDist = dist;
          closest = r;
        }
      }

      if (closest) {
        const averaging = await getStationRollingAverage(closest.station_id);
        return {
          reading: closest,
          distanceKm: closestDist,
          sources,
          freshnessMs: Date.now() - closest.timestamp.getTime(),
          averaging,
        };
      }
    }
  } catch (err) {
    log.warn({ err: err.message }, 'Error querying OpenAQ readings');
  }

  // ── 2. Fall back to CAMS model data ─────────
  try {
    const camsReading = await Reading.findOne({
      source: 'cams',
      timestamp: { $gte: maxAge },
    })
      .sort({ timestamp: -1 })
      .lean();

    if (camsReading) {
      sources.push('cams');
      const averaging = await getStationRollingAverage(camsReading.station_id);
      return {
        reading: camsReading,
        distanceKm: null, // CAMS is a model, not a station
        sources,
        freshnessMs: Date.now() - camsReading.timestamp.getTime(),
        averaging,
      };
    }
  } catch (err) {
    log.warn({ err: err.message }, 'Error querying CAMS data');
  }

  // ── 3. Check if we have any reading at all (even stale) ──
  try {
    const anyReading = await Reading.findOne({})
      .sort({ timestamp: -1 })
      .lean();

    if (anyReading) {
      sources.push(anyReading.source);
      const averaging = await getStationRollingAverage(anyReading.station_id);
      return {
        reading: anyReading,
        distanceKm:
          anyReading.source === 'openaq' && anyReading.station_location?.coordinates
            ? haversineKm(
                lat,
                lng,
                anyReading.station_location.coordinates[1],
                anyReading.station_location.coordinates[0],
              )
            : null,
        sources,
        freshnessMs: Date.now() - anyReading.timestamp.getTime(),
        averaging,
      };
    }
  } catch (err) {
    log.warn({ err: err.message }, 'Error querying any reading');
  }

  return null;
}

/**
 * Get the latest weather data from MongoDB.
 *
 * @returns {Promise<object|null>}
 */
async function findLatestWeather() {
  try {
    return await Weather.findOne({}).sort({ timestamp: -1 }).lean();
  } catch (err) {
    log.warn({ err: err.message }, 'Error querying weather');
    return null;
  }
}

/**
 * Compute the rolling 24-hour average for a given station.
 *
 * Queries the last 24 hours of readings for the station and computes
 * a simple flat (unweighted) average.  Uses the existing composite
 * index on (station_id, timestamp) for efficient lookup.
 *
 * @param {string} stationId  Station identifier
 * @returns {Promise<object>}  Rolling average result from domain layer
 */
async function getStationRollingAverage(stationId) {
  try {
    const windowStart = new Date(Date.now() - config.ingestion.averagingWindowMs);
    const history = await Reading.find({
      station_id: stationId,
      timestamp: { $gte: windowStart },
    })
      .sort({ timestamp: -1 })
      .select('pm25 timestamp')
      .lean();

    return calculateRollingAverage(history);
  } catch (err) {
    log.warn(
      { stationId, err: err.message },
      'Failed to compute rolling average',
    );
    return calculateRollingAverage([]);
  }
}

/**
 * Check if coordinates are within Lahore bounds.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
function isInLahoreBounds(lat, lng) {
  const { latMin, latMax, lngMin, lngMax } = config.lahore.bounds;
  return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
}

module.exports = { findNearestReading, getStationRollingAverage, findLatestWeather, isInLahoreBounds };

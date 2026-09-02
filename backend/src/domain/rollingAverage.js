'use strict';

/**
 * Rolling 24-Hour PM2.5 Average
 * ───────────────────────────────
 * Pure domain function (no DB, no network, no side effects).
 *
 * Computes a simple flat (unweighted) rolling average over the last
 * 24 hourly readings for a single station.  This is the MVP approach —
 * a defensible approximation of EPA's NowCast-weighted method.
 *
 * NowCast weighting is flagged as a V2 refinement if closer parity
 * with AirNow's exact numbers is needed.
 *
 * Warm-up period: if fewer than 24 hours of data exist, the average
 * is computed over whatever hours are available and flagged as a
 * partial-window average.
 */

// ── Constants ──────────────────────────────────
const FULL_WINDOW_HOURS = 24;
const FULL_WINDOW_MS = FULL_WINDOW_HOURS * 60 * 60 * 1000;

// Minimum hours required for a "full" confidence average
const MIN_HOURS_FOR_FULL = 24;

/**
 * Calculate the rolling average from an array of readings.
 *
 * @param {Array} readings     Array of objects with at least { pm25: number, timestamp: Date }
 * @param {object} [opts]
 * @param {number} [opts.windowMs]  Look-back window in ms (default 24 hours)
 * @returns {object}
 *   {
 *     pm25:          number   — averaged PM2.5 value
 *     hoursUsed:     number   — how many readings were included
 *     windowHours:   number   — target window size
 *     isFullWindow:  boolean  — true if 24 hours of data were available
 *     oldestReading: Date|null
 *     newestReading: Date|null
 *   }
 */
function calculateRollingAverage(readings, opts = {}) {
  const windowMs = opts.windowMs || FULL_WINDOW_MS;

  if (!Array.isArray(readings) || readings.length === 0) {
    return {
      pm25: null,
      hoursUsed: 0,
      windowHours: FULL_WINDOW_HOURS,
      isFullWindow: false,
      oldestReading: null,
      newestReading: null,
    };
  }

  // Sort newest-first so we take the most recent 24
  const sorted = [...readings]
    .filter((r) => typeof r.pm25 === 'number' && !isNaN(r.pm25) && r.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (sorted.length === 0) {
    return {
      pm25: null,
      hoursUsed: 0,
      windowHours: FULL_WINDOW_HOURS,
      isFullWindow: false,
      oldestReading: null,
      newestReading: null,
    };
  }

  // Take at most 24 readings (one per hour)
  const windowReadings = sorted.slice(0, FULL_WINDOW_HOURS);

  const sum = windowReadings.reduce((acc, r) => acc + r.pm25, 0);
  const avg = sum / windowReadings.length;

  return {
    pm25: Math.round(avg * 100) / 100,
    hoursUsed: windowReadings.length,
    windowHours: FULL_WINDOW_HOURS,
    isFullWindow: windowReadings.length >= MIN_HOURS_FOR_FULL,
    oldestReading: windowReadings.length > 0
      ? new Date(windowReadings[windowReadings.length - 1].timestamp)
      : null,
    newestReading: windowReadings.length > 0
      ? new Date(windowReadings[0].timestamp)
      : null,
  };
}

/**
 * Determine the confidence qualifier for a partial-window average.
 *
 * Returns one of:
 *   'full'      — 24 hours of data available
 *   'partial'   — 12–23 hours (reasonable approximation)
 *   'minimal'   — 1–11 hours (very rough)
 *   'none'      — no data
 *
 * @param {object} avgResult  Result from calculateRollingAverage()
 * @returns {string}
 */
function getAverageConfidence(avgResult) {
  if (!avgResult || avgResult.pm25 === null) return 'none';
  if (avgResult.isFullWindow) return 'full';
  if (avgResult.hoursUsed >= 12) return 'partial';
  return 'minimal';
}

module.exports = {
  FULL_WINDOW_HOURS,
  FULL_WINDOW_MS,
  MIN_HOURS_FOR_FULL,
  calculateRollingAverage,
  getAverageConfidence,
};

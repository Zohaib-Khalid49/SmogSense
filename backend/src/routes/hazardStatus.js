'use strict';

const { Router } = require('express');
const { validateQuery } = require('../middleware/validate');
const { findNearestReading, findLatestWeather, isInLahoreBounds } = require('../services/dataService');
const { calculateConfidence } = require('../domain/confidence');
const { getRecommendation } = require('../services/recommendationService');
const { PROFILE_CATEGORIES } = require('../domain/recommendationKeys');
const { getAverageConfidence } = require('../domain/rollingAverage');
const AppError = require('../errors/AppError');

const router = Router();

/**
 * GET /hazard-status
 * ──────────────────
 * Returns the current hazard band, recommendation, confidence level,
 * and last-updated timestamp for a given location and profile.
 *
 * Query params:
 *   lat              (required)  Latitude
 *   lng              (required)  Longitude
 *   profile_category (optional)  Default: adult
 */
const queryValidator = validateQuery({
  lat: { required: true, type: 'number', min: -90, max: 90 },
  lng: { required: true, type: 'number', min: -180, max: 180 },
  profile_category: { oneOf: PROFILE_CATEGORIES },
  age: { type: 'number', min: 0, max: 120 },
  sub_detail: { type: 'string' },
});

router.get('/hazard-status', queryValidator, async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const profileCategory = req.query.profile_category || 'adult';
    const age =
      req.query.age !== undefined && req.query.age !== ''
        ? Number(req.query.age)
        : undefined;
    const subDetail = req.query.sub_detail || undefined;

    // ── Validate coordinates are in Lahore ─────
    if (!isInLahoreBounds(lat, lng)) {
      return next(
        new AppError('Coordinates must be within Lahore city bounds', 400, {
          code: 'INVALID_COORDINATES',
        }),
      );
    }

    // ── Find nearest reading ───────────────────
    const result = await findNearestReading(lat, lng);

    if (!result) {
      return res.status(200).json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          code: 'NO_DATA',
          message: 'No air quality readings available yet. Ingestion may not have run.',
        },
      });
    }

    const { reading, distanceKm, sources, freshnessMs, averaging } = result;

    // ── Determine effective PM2.5 ──────────────
    // Use the 24-hour rolling average when available; fall back to the
    // raw hourly reading during warm-up or if averaging fails.
    const effectivePm25 =
      averaging && averaging.pm25 !== null ? averaging.pm25 : reading.pm25;

    // ── Calculate confidence ───────────────────
    const confidence = calculateConfidence({ distanceKm, freshnessMs, sources });
    const averageConfidence = getAverageConfidence(averaging);

    // ── Get latest weather (before recommendation, so the AI can use it) ──
    const weather = await findLatestWeather();

    // ── Get personalised recommendation ────────
    const recommendation = await getRecommendation({
      pm25: effectivePm25,
      profileCategory,
      age,
      subDetail,
      weather,
      confidence,
    });

    // ── Build response ─────────────────────────
    const responseData = {
      hazard_band: recommendation.hazardBand,
      pm25: effectivePm25,
      pm25_current: reading.pm25,
      pm25_24hr_avg: averaging ? averaging.pm25 : null,
      profile_category: profileCategory,
      confidence_level: confidence,
      last_updated: reading.timestamp.toISOString(),
      recommendation: {
        key: recommendation.key,
        headline: recommendation.headline,
        summary: recommendation.summary,
        actions: recommendation.actions,
        explanation: recommendation.explanation,
        advice: recommendation.advice,
        source: recommendation.source,
      },
      station: {
        id: reading.station_id,
        name: reading.station_name,
        distance_km: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
        source: reading.source,
        last_updated: reading.timestamp.toISOString(),
      },
      averaging: averaging
        ? {
            pm25_24hr_avg: averaging.pm25,
            hours_used: averaging.hoursUsed,
            is_full_window: averaging.isFullWindow,
            average_confidence: averageConfidence,
            oldest_reading: averaging.oldestReading
              ? averaging.oldestReading.toISOString()
              : null,
            newest_reading: averaging.newestReading
              ? averaging.newestReading.toISOString()
              : null,
          }
        : null,
      weather: weather
        ? {
            temperature_c: weather.temperature_c,
            humidity_pct: weather.humidity_pct,
            wind_speed_ms: weather.wind_speed_ms,
            wind_direction_deg: weather.wind_direction_deg,
          }
        : null,
    };

    res.json({
      success: true,
      data: responseData,
      meta: {
        timestamp: new Date().toISOString(),
        last_updated: reading.timestamp.toISOString(),
        confidence: confidence,
        sources,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

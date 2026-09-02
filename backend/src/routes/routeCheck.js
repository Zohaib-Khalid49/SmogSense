'use strict';

const { Router } = require('express');
const { validateQuery } = require('../middleware/validate');
const { findNearestReading, isInLahoreBounds } = require('../services/dataService');
const { calculateConfidence } = require('../domain/confidence');
const { compareRoutes } = require('../domain/routeComparison');
const { getRecommendation } = require('../services/recommendationService');
const { PROFILE_CATEGORIES } = require('../domain/recommendationKeys');
const AppError = require('../errors/AppError');

const router = Router();

/**
 * GET /route-check
 * ────────────────
 * Compares pollution exposure between an origin and destination point.
 * Returns both routes' hazard bands, confidence, and whether there is
 * a meaningful difference.
 *
 * Query params:
 *   origin_lat       (required)
 *   origin_lng       (required)
 *   dest_lat         (required)
 *   dest_lng         (required)
 *   profile_category (optional)  Default: adult
 */
const queryValidator = validateQuery({
  origin_lat: { required: true, type: 'number', min: -90, max: 90 },
  origin_lng: { required: true, type: 'number', min: -180, max: 180 },
  dest_lat: { required: true, type: 'number', min: -90, max: 90 },
  dest_lng: { required: true, type: 'number', min: -180, max: 180 },
  profile_category: { oneOf: PROFILE_CATEGORIES },
});

router.get('/route-check', queryValidator, async (req, res, next) => {
  try {
    const originLat = Number(req.query.origin_lat);
    const originLng = Number(req.query.origin_lng);
    const destLat = Number(req.query.dest_lat);
    const destLng = Number(req.query.dest_lng);
    const profileCategory = req.query.profile_category || 'adult';

    // ── Validate both points are in Lahore ─────
    if (!isInLahoreBounds(originLat, originLng)) {
      return next(
        new AppError('Origin coordinates must be within Lahore city bounds', 400, {
          code: 'INVALID_COORDINATES',
          details: [{ field: 'origin', message: 'Outside Lahore bounds' }],
        }),
      );
    }
    if (!isInLahoreBounds(destLat, destLng)) {
      return next(
        new AppError('Destination coordinates must be within Lahore city bounds', 400, {
          code: 'INVALID_COORDINATES',
          details: [{ field: 'destination', message: 'Outside Lahore bounds' }],
        }),
      );
    }

    // ── Fetch readings for both locations ──────
    const [originResult, destResult] = await Promise.all([
      findNearestReading(originLat, originLng),
      findNearestReading(destLat, destLng),
    ]);

    // Handle missing data
    if (!originResult && !destResult) {
      return res.status(200).json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          code: 'NO_DATA',
          message: 'No air quality readings available for either location.',
        },
      });
    }

    // ── Build route objects ───────────────────
    const primaryRoute = originResult
      ? {
          pm25: originResult.reading.pm25,
          confidence: calculateConfidence({
            distanceKm: originResult.distanceKm,
            freshnessMs: originResult.freshnessMs,
            sources: originResult.sources,
          }),
          profileCategory,
        }
      : { pm25: 0, confidence: 'insufficient', profileCategory };

    const alternateRoute = destResult
      ? {
          pm25: destResult.reading.pm25,
          confidence: calculateConfidence({
            distanceKm: destResult.distanceKm,
            freshnessMs: destResult.freshnessMs,
            sources: destResult.sources,
          }),
          profileCategory,
        }
      : { pm25: 0, confidence: 'insufficient', profileCategory };

    // ── Compare routes ─────────────────────────
    const comparison = compareRoutes(primaryRoute, alternateRoute);

    // ── Get recommendations for both ───────────
    const [primaryRec, alternateRec] = await Promise.all([
      getRecommendation({ pm25: primaryRoute.pm25, profileCategory }),
      getRecommendation({ pm25: alternateRoute.pm25, profileCategory }),
    ]);

    res.json({
      success: true,
      data: {
        primary_route: {
          band: comparison.primaryBand,
          pm25: primaryRoute.pm25,
          confidence: primaryRoute.confidence,
          recommendation_key: primaryRec.key,
        },
        alternate_route: {
          band: comparison.alternateBand,
          pm25: alternateRoute.pm25,
          confidence: alternateRoute.confidence,
          recommendation_key: alternateRec.key,
        },
        meaningful_difference: comparison.meaningfulDifference,
        reliable: comparison.reliable,
        advice: comparison.advice,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

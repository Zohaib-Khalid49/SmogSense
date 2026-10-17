'use strict';

const { Router } = require('express');
const mongoose = require('mongoose');
const { validateBody, validateParams } = require('../middleware/validate');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Alert = require('../models/Alert');
const AppError = require('../errors/AppError');
const config = require('../config');
const { findNearestReading } = require('../services/dataService');
const { getHazardBand } = require('../domain/thresholds');

const router = Router();

// ── GET /alerts/:user_id ───────────────────────
const userIdParamValidator = validateParams({
  user_id: { required: true, type: 'string' },
});

router.get('/alerts/:user_id', userIdParamValidator, async (req, res, next) => {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : config.lahore.center.lat;
    const lng = req.query.lng ? Number(req.query.lng) : config.lahore.center.lng;
    // The scheduler may not have run yet (or push delivery may have failed).
    // Evaluate the current opted-in profiles so the Alerts tab still reflects
    // a hazardous condition shown on the Home page.
    const profiles = await Profile.find({
      user_id: req.params.user_id,
      alerts_enabled: true,
    }).lean();
    const readingResult = await findNearestReading(
      lat,
      lng,
    );
    if (!readingResult || profiles.length === 0) {
      return res.json({ success: true, data: null });
    }

    const pm25 = readingResult.reading.pm25;
    const effectivePm25 =
      readingResult.averaging && readingResult.averaging.pm25 !== null
        ? readingResult.averaging.pm25
        : pm25;
    const hazardousProfiles = profiles.filter(
      (profile) => getHazardBand(effectivePm25, profile.category) === 'hazardous',
    );

    if (hazardousProfiles.length > 0) {
      return res.json({
        success: true,
        data: {
          id: `current_${Date.now()}`,
          profile_ids: hazardousProfiles.map((profile) => profile._id),
          severity: effectivePm25 > 225.4 ? 'danger' : 'warning',
          hazard_band: 'hazardous',
          pm25_value: effectivePm25,
          message: 'Air quality is hazardous for one or more of your profiles. Stay indoors with windows closed.',
          triggered_at: new Date().toISOString(),
        },
      });
    }

    const alert = await Alert.findOne({ user_id: req.params.user_id })
      .sort({ created_at: -1 })
      .lean();
    if (!alert) return res.json({ success: true, data: null });

    res.json({
      success: true,
      data: {
        id: alert._id,
        profile_ids: alert.profile_ids,
        severity: alert.severity,
        hazard_band: alert.hazard_band,
        pm25_value: alert.pm25_value,
        message: alert.message,
        triggered_at: alert.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /alerts/register-device
 * ────────────────────────────
 * Registers or updates an FCM push-notification token for a user.
 * Creates the user record if it doesn't exist.
 *
 * Body:
 *   profile_id (required)  — Profile to link the device to
 *   fcm_token  (required)  — Firebase Cloud Messaging token
 */
const registerValidator = validateBody({
  profile_id: { required: true, type: 'string' },
  fcm_token: { required: true, type: 'string' },
});

router.post('/alerts/register-device', registerValidator, async (req, res, next) => {
  try {
    const { profile_id, fcm_token } = req.body;

    // Validate profile_id
    if (!mongoose.Types.ObjectId.isValid(profile_id)) {
      return next(
        new AppError('Invalid profile_id format', 400, {
          code: 'INVALID_ID',
          message: 'profile_id must be a valid identifier',
        }),
      );
    }

    // Find the profile
    const profile = await Profile.findById(profile_id).lean();
    if (!profile) {
      return next(
        new AppError('Profile not found', 404, { code: 'NOT_FOUND' }),
      );
    }

    // Upsert the user with the FCM token
    await User.findOneAndUpdate(
      { _id: profile.user_id },
      {
        $set: {
          fcm_token,
          fcm_token_updated_at: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    res.json({
      success: true,
      data: {
        registered: true,
        profile_id: profile._id,
        user_id: profile.user_id,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

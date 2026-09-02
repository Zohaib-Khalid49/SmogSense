'use strict';

const { Router } = require('express');
const mongoose = require('mongoose');
const { validateBody, validateParams } = require('../middleware/validate');
const User = require('../models/User');
const Profile = require('../models/Profile');
const AppError = require('../errors/AppError');

const router = Router();

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

'use strict';

const { Router } = require('express');
const mongoose = require('mongoose');
const { validateBody, validateParams } = require('../middleware/validate');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { PROFILE_CATEGORIES } = require('../domain/recommendationKeys');
const AppError = require('../errors/AppError');

const router = Router();

// ── POST /profiles ─────────────────────────────
const createValidator = validateBody({
  user_id: { required: true, type: 'string' },
  category: { required: true, type: 'string', oneOf: PROFILE_CATEGORIES },
  name: { type: 'string' },
  age: { type: 'number', min: 0, max: 150 },
  alerts_enabled: { type: 'boolean' },
  fcm_token: { type: 'string' },
});

router.post('/profiles', createValidator, async (req, res, next) => {
  try {
    const { user_id, category, name, age, alerts_enabled, fcm_token } = req.body;

    // If fcm_token is provided, upsert the user
    if (fcm_token) {
      await User.findOneAndUpdate(
        { _id: user_id },
        { $set: { fcm_token, fcm_token_updated_at: new Date() } },
        { upsert: true, new: true },
      );
    }

    // Upsert profile — one per user_id + category to prevent duplicates
    const profile = await Profile.findOneAndUpdate(
      { user_id, category },
      {
        $set: {
          name: name || '',
          age,
          alerts_enabled: alerts_enabled !== undefined ? alerts_enabled : true,
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    res.status(201).json({
      success: true,
      data: {
        id: profile._id,
        user_id: profile.user_id,
        category: profile.category,
        name: profile.name,
        age: profile.age,
        alerts_enabled: profile.alerts_enabled,
        created_at: profile.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /profiles/:user_id ─────────────────────
const userIdParamValidator = validateParams({
  user_id: { required: true, type: 'string' },
});

router.get('/profiles/:user_id', userIdParamValidator, async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const profiles = await Profile.find({ user_id }).lean();

    res.json({
      success: true,
      data: profiles.map((p) => ({
        id: p._id,
        user_id: p.user_id,
        category: p.category,
        name: p.name,
        age: p.age,
        alerts_enabled: p.alerts_enabled,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /profiles/:profile_id ────────────────
const profileIdParamValidator = validateParams({
  profile_id: { required: true, pattern: /^[a-f\d]{24}$/i },
});

const updateValidator = validateBody({
  category: { type: 'string', oneOf: PROFILE_CATEGORIES },
  name: { type: 'string' },
  age: { type: 'number', min: 0, max: 150 },
  alerts_enabled: { type: 'boolean' },
});

router.patch('/profiles/:profile_id', profileIdParamValidator, updateValidator, async (req, res, next) => {
  try {
    const { profile_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(profile_id)) {
      return next(
        new AppError('Invalid profile_id format', 400, { code: 'INVALID_ID' }),
      );
    }

    const allowedFields = ['category', 'name', 'age', 'alerts_enabled'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return next(
        new AppError('No valid fields to update', 400, {
          code: 'INVALID_PARAMS',
          message: 'Provide at least one field to update',
        }),
      );
    }

    const profile = await Profile.findOneAndUpdate(
      { _id: profile_id },
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!profile) {
      return next(
        new AppError('Profile not found', 404, { code: 'NOT_FOUND' }),
      );
    }

    res.json({
      success: true,
      data: {
        id: profile._id,
        user_id: profile.user_id,
        category: profile.category,
        name: profile.name,
        age: profile.age,
        alerts_enabled: profile.alerts_enabled,
        updated_at: profile.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

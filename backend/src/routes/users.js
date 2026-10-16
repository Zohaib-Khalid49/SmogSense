'use strict';

const { Router } = require('express');
const { validateBody } = require('../middleware/validate');
const User = require('../models/User');
const Profile = require('../models/Profile');

const router = Router();

const userValidator = validateBody({
  user_id: { required: true, type: 'string' },
  name: { type: 'string' },
  location: { type: 'object' },
});

router.put('/users/:user_id', userValidator, async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const updates = {};

    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.location !== undefined) updates.location = req.body.location;

    const user = await User.findOneAndUpdate(
      { _id: user_id },
      { $set: updates },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        location: user.location || null,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:user_id', async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const [user, profiles] = await Promise.all([
      User.findOneAndDelete({ _id: user_id }).lean(),
      Profile.deleteMany({ user_id }),
    ]);

    res.json({
      success: true,
      data: {
        deleted: Boolean(user),
        profiles_deleted: profiles.deletedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

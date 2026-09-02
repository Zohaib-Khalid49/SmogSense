'use strict';

const { Schema, model } = require('mongoose');

const PROFILE_CATEGORIES = [
  'adult',
  'child',
  'elderly',
  'pregnant_woman',
  'asthma_copd',
  'outdoor_worker',
];

const HAZARD_BANDS = ['safe', 'caution', 'hazardous'];

const profileSchema = new Schema(
  {
    user_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: PROFILE_CATEGORIES,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    age: {
      type: Number,
      min: 0,
      max: 150,
    },
    alerts_enabled: {
      type: Boolean,
      default: true,
    },

    // ── Alert deduplication state ────────────────
    // Tracks the last hazard band that triggered an alert for this profile.
    // Used to suppress duplicate alerts when band is unchanged.
    last_alerted_band: {
      type: String,
      enum: [null, ...HAZARD_BANDS],
      default: null,
    },
    last_alerted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// ── Indexes ────────────────────────────────────
// user_id already has field-level index: true
// Alert evaluation: find opted-in profiles quickly
profileSchema.index({ alerts_enabled: 1, category: 1 });
// Prevent duplicate profiles for the same user + category
profileSchema.index({ user_id: 1, category: 1 }, { unique: true });

module.exports = model('Profile', profileSchema);

// Export enums for use in validation and domain logic
module.exports.PROFILE_CATEGORIES = PROFILE_CATEGORIES;
module.exports.HAZARD_BANDS = HAZARD_BANDS;

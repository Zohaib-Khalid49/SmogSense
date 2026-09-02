'use strict';

const { Schema, model } = require('mongoose');

const SEVERITY_LEVELS = ['info', 'caution', 'warning', 'danger'];

const alertSchema = new Schema(
  {
    user_id: {
      type: String,
      required: true,
    },
    profile_ids: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Profile',
      },
    ],
    severity: {
      type: String,
      required: true,
      enum: SEVERITY_LEVELS,
    },
    hazard_band: {
      type: String,
      required: true,
      enum: ['safe', 'caution', 'hazardous'],
    },
    pm25_value: {
      type: Number,
      required: false,
      min: 0,
      default: null,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    delivered: {
      type: Boolean,
      default: false,
    },
    delivered_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// ── Indexes ────────────────────────────────────
// Alert deduplication: recent alerts per user
alertSchema.index({ user_id: 1, created_at: -1 });
// Alert history queries
alertSchema.index({ created_at: -1 });
// Delivery status tracking
alertSchema.index({ delivered: 1, created_at: -1 });

module.exports = model('Alert', alertSchema);
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;

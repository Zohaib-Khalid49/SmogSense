'use strict';

const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    fcm_token: {
      type: String,
      required: true,
      trim: true,
    },
    fcm_token_updated_at: {
      type: Date,
      default: Date.now,
    },
    location: {
      type: new Schema({
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [lng, lat]
        },
      }, { _id: false }),
      default: undefined,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// ── Indexes ────────────────────────────────────
// Lookup by FCM token for push delivery
userSchema.index({ fcm_token: 1 });
// Geo queries: find users near a location (e.g. location-based alerts)
userSchema.index({ location: '2dsphere' });

module.exports = model('User', userSchema);

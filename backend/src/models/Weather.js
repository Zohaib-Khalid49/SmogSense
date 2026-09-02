'use strict';

const { Schema, model } = require('mongoose');

const weatherSchema = new Schema(
  {
    timestamp: {
      type: Date,
      required: true,
    },
    temperature_c: {
      type: Number,
      required: true,
    },
    humidity_pct: {
      type: Number,
      min: 0,
      max: 100,
    },
    wind_speed_ms: {
      type: Number,
      min: 0,
    },
    wind_direction_deg: {
      type: Number,
      min: 0,
      max: 360,
    },
    pressure_hpa: {
      type: Number,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// ── Indexes ────────────────────────────────────
// Idempotent upsert: one weather record per timestamp
weatherSchema.index({ timestamp: 1 }, { unique: true });
// Latest weather for hazard-status response
weatherSchema.index({ timestamp: -1 });

module.exports = model('Weather', weatherSchema);

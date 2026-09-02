'use strict';

const { Schema, model } = require('mongoose');

const SOURCES = ['openaq', 'cams'];

const readingSchema = new Schema(
  {
    station_id: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      enum: SOURCES,
    },
    pm25: {
      type: Number,
      required: true,
      min: 0,
    },
    pm10: {
      type: Number,
      required: false,
      min: 0,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    station_location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    station_name: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// ── Indexes ────────────────────────────────────
// Idempotent upsert: one reading per station per timestamp
readingSchema.index({ station_id: 1, timestamp: 1 }, { unique: true });
// Latest reading lookup for hazard-status
readingSchema.index({ timestamp: -1, pm25: 1 });
// Geo queries: find stations near a point
readingSchema.index({ station_location: '2dsphere' });

module.exports = model('Reading', readingSchema);
module.exports.SOURCES = SOURCES;

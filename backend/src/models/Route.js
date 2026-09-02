'use strict';

const { Schema, model } = require('mongoose');

const routeSchema = new Schema(
  {
    route_hash: {
      type: String,
      required: true,
    },
    origin: {
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
    destination: {
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
    waypoints: [
      {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [lng, lat]
        },
      },
    ],
    exposure_score: {
      type: Number,
      required: true,
    },
    pm25_avg: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// ── Indexes ────────────────────────────────────
// Route lookup by hash (for caching/comparison)
routeSchema.index({ route_hash: 1 });
// Geo queries on origin
routeSchema.index({ origin: '2dsphere' });
// Timestamp-based cleanup
routeSchema.index({ timestamp: -1 });

module.exports = model('Route', routeSchema);

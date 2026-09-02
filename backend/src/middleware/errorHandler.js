'use strict';

const { logger } = require('../logger');

/**
 * Global Express error-handling middleware.
 * Normalises every error into a consistent JSON envelope.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // ── Known application errors ────────────────
  if (err.name === 'AppError') {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
        message: err.message,
        ...err.meta,
      },
    });
  }

  // ── Mongoose validation errors ──────────────
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    });
  }

  // ── Mongoose cast errors (bad ObjectId) ─────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: `Invalid identifier: ${err.path}` },
    });
  }

  // ── Mongoose duplicate-key ──────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'unknown';
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE',
        message: `Duplicate value for field: ${field}`,
      },
    });
  }

  // ── Unexpected errors ──────────────────────
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

module.exports = errorHandler;

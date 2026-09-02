'use strict';

const AppError = require('../errors/AppError');

/**
 * Factory: validates req.query against a field descriptor map.
 *
 * Fields:
 *   required (boolean) — field must be present and non-empty
 *   type     (string)  — 'number' | 'string' (default string)
 *   min/max  (number)  — numeric range bounds
 *   pattern  (RegExp)  — string pattern match
 *   oneOf    (array)   — allowed string values
 */
function validateQuery(fields) {
  return (req, _res, next) => {
    const errors = [];

    for (const [key, rules] of Object.entries(fields)) {
      const raw = req.query[key];

      if (rules.required && (raw === undefined || raw === '')) {
        errors.push({ field: key, message: `${key} is required` });
        continue;
      }

      if (raw === undefined || raw === '') continue;

      if (rules.type === 'number') {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          errors.push({ field: key, message: `${key} must be a number` });
          continue;
        }
        if (rules.min !== undefined && num < rules.min) {
          errors.push({ field: key, message: `${key} must be >= ${rules.min}` });
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push({ field: key, message: `${key} must be <= ${rules.max}` });
        }
      }

      if (rules.pattern && !rules.pattern.test(raw)) {
        errors.push({
          field: key,
          message: `${key} does not match required format`,
        });
      }

      if (rules.oneOf && !rules.oneOf.includes(raw)) {
        errors.push({
          field: key,
          message: `${key} must be one of: ${rules.oneOf.join(', ')}`,
        });
      }
    }

    if (errors.length > 0) {
      return next(
        new AppError('Invalid query parameters', 400, {
          code: 'INVALID_PARAMS',
          details: errors,
        }),
      );
    }

    next();
  };
}

/**
 * Factory: validates req.body against a field descriptor map.
 * Same field descriptor format as validateQuery.
 */
function validateBody(fields) {
  return (req, _res, next) => {
    const body = req.body || {};
    const errors = [];

    for (const [key, rules] of Object.entries(fields)) {
      const raw = body[key];

      if (rules.required && (raw === undefined || raw === null || raw === '')) {
        errors.push({ field: key, message: `${key} is required` });
        continue;
      }

      if (raw === undefined || raw === null || raw === '') continue;

      if (rules.type === 'number') {
        if (typeof raw !== 'number' || Number.isNaN(raw)) {
          errors.push({ field: key, message: `${key} must be a number` });
          continue;
        }
        if (rules.min !== undefined && raw < rules.min) {
          errors.push({ field: key, message: `${key} must be >= ${rules.min}` });
        }
        if (rules.max !== undefined && raw > rules.max) {
          errors.push({ field: key, message: `${key} must be <= ${rules.max}` });
        }
      }

      if (rules.type === 'string' && typeof raw !== 'string') {
        errors.push({ field: key, message: `${key} must be a string` });
        continue;
      }

      if (rules.type === 'boolean' && typeof raw !== 'boolean') {
        errors.push({ field: key, message: `${key} must be a boolean` });
        continue;
      }

      if (rules.oneOf && !rules.oneOf.includes(raw)) {
        errors.push({
          field: key,
          message: `${key} must be one of: ${rules.oneOf.join(', ')}`,
        });
      }
    }

    if (errors.length > 0) {
      return next(
        new AppError('Invalid request body', 400, {
          code: 'INVALID_PARAMS',
          details: errors,
        }),
      );
    }

    next();
  };
}

/**
 * Validates req.params against a field descriptor map.
 */
function validateParams(fields) {
  return (req, _res, next) => {
    const errors = [];

    for (const [key, rules] of Object.entries(fields)) {
      const raw = req.params[key];

      if (rules.required && (raw === undefined || raw === '')) {
        errors.push({ field: key, message: `${key} is required` });
        continue;
      }

      if (raw === undefined || raw === '') continue;

      if (rules.pattern && !rules.pattern.test(raw)) {
        errors.push({
          field: key,
          message: `${key} does not match required format`,
        });
      }
    }

    if (errors.length > 0) {
      return next(
        new AppError('Invalid path parameters', 400, {
          code: 'INVALID_PARAMS',
          details: errors,
        }),
      );
    }

    next();
  };
}

module.exports = { validateQuery, validateBody, validateParams };

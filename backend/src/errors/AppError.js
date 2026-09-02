'use strict';

class AppError extends Error {
  /**
   * @param {string} message  Human-readable error description
   * @param {number} status   HTTP status code (default 400)
   * @param {object} [meta]   Optional extra context
   */
  constructor(message, status = 400, meta = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.meta = meta;
  }
}

module.exports = AppError;

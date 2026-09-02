'use strict';

const { loggers } = require('../logger');

const log = loggers.http;

/**
 * Lightweight request/response logger.
 * Avoids logging health-check noise and never logs request bodies that may
 * contain sensitive data.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Keep health probes out of the logs
    if (req.path === '/health' || req.path === '/ready') return;

    log.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip,
      },
      'request',
    );
  });

  next();
}

module.exports = requestLogger;

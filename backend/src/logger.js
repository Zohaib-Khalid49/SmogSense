'use strict';

const pino = require('pino');

const redact = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'config.groq.apiKey',
  'config.firebase.serviceAccountPath',
];

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: redact,
    censor: '[REDACTED]',
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// Pre-configured child loggers for each subsystem
const loggers = {
  http: logger.child({ module: 'http' }),
  db: logger.child({ module: 'db' }),
  ingestion: logger.child({ module: 'ingestion' }),
  groq: logger.child({ module: 'groq' }),
  alert: logger.child({ module: 'alert' }),
  external: logger.child({ module: 'external' }),
};

module.exports = { logger, loggers };

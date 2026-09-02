'use strict';

const { Router } = require('express');
const db = require('../db');

const router = Router();

/**
 * GET /health
 * Basic liveness probe — process is running.
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /ready
 * Readiness probe — MongoDB connection is healthy.
 */
router.get('/ready', (_req, res) => {
  const ready = db.isReady();
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      mongodb: ready ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;

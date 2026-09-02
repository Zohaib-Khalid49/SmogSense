'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const hazardStatusRoutes = require('./routes/hazardStatus');
const routeCheckRoutes = require('./routes/routeCheck');
const profileRoutes = require('./routes/profiles');
const alertRoutes = require('./routes/alerts');

const app = express();

// ── Global middleware ──────────────────────────
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);

// ── Routes ────────────────────────────────────
app.use('/', healthRoutes);
app.use('/', hazardStatusRoutes);
app.use('/', routeCheckRoutes);
app.use('/', profileRoutes);
app.use('/', alertRoutes);

// ── 404 handler ───────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// ── Error handler (must be last) ──────────────
app.use(errorHandler);

module.exports = app;

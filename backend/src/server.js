'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');
const { logger } = require('./logger');
const { startScheduler, stopScheduler } = require('./scheduler');
const { runIngestion } = require('./jobs/ingest');
const Reading = require('./models/Reading');

/**
 * On boot the scheduled cron won't fire until the top of the next hour, so a
 * freshly deployed/restarted server could serve an empty (or stale) DB for up
 * to an hour. This runs one ingestion at startup — but only if there's no
 * fresh reading already — so the app has data immediately after deploy.
 *
 * Runs in the background (after the server is listening) and never throws:
 * a transient upstream failure must not crash startup; the hourly cron will
 * retry regardless.
 */
async function runStartupIngestionIfNeeded() {
  try {
    const maxAge = new Date(Date.now() - config.ingestion.freshnessMs);
    const freshCount = await Reading.countDocuments({
      timestamp: { $gte: maxAge },
    });
    if (freshCount > 0) {
      logger.info(
        { freshCount },
        'Startup ingestion skipped — fresh data already present',
      );
      return;
    }
    logger.info('No fresh data on boot — running startup ingestion');
    await runIngestion();
    logger.info('Startup ingestion complete');
  } catch (err) {
    // Never fatal — the hourly scheduler will try again.
    logger.warn({ err: err.message }, 'Startup ingestion failed (non-fatal)');
  }
}

async function start() {
  try {
    await db.connect();

    // Start scheduled jobs (ingestion + alerts)
    startScheduler();

    app.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          env: config.nodeEnv,
          node: process.version,
        },
        'SmogSense backend started',
      );

      // Kick off startup ingestion in the background — after listening, so
      // health checks pass immediately and boot isn't blocked on upstream APIs.
      runStartupIngestionIfNeeded();
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  stopScheduler();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  stopScheduler();
  await db.disconnect();
  process.exit(0);
});

start();

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
 * to an hour. This runs one ingestion at startup — unless one has already run
 * since the most recent hourly slot — so the app has current data right
 * after deploy.
 *
 * Runs in the background (after the server is listening) and never throws:
 * a transient upstream failure must not crash startup; the hourly cron will
 * retry regardless.
 */
async function runStartupIngestionIfNeeded() {
  try {
    // Skip only if an ingestion has run since the last hourly cron slot.
    // Reading `timestamp`s are *measurement* times — gating on those (as this
    // once did, via a 3 h freshness window) let a restart happily serve a
    // 2-hour-old reading while upstream already had a newer one. Mongoose
    // bumps `updated_at` on every upsert, so the newest one tells us when
    // ingestion last wrote, regardless of how old the measurements are.
    // (Slot interval must stay in sync with cron.ingestion, which is hourly.)
    const lastSlot = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    const lastWrite = await Reading.findOne({})
      .sort({ updated_at: -1 })
      .select('updated_at')
      .lean();
    if (lastWrite && lastWrite.updated_at >= lastSlot) {
      logger.info(
        { lastIngestionAt: lastWrite.updated_at },
        'Startup ingestion skipped — ingestion already ran this hour',
      );
      return;
    }
    logger.info('No ingestion since the last hourly slot — running startup ingestion');
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

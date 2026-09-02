'use strict';

const cron = require('node-cron');
const config = require('./config');
const { loggers } = require('./logger');
const { runIngestion } = require('./jobs/ingest');
const { evaluateAlerts, runDailyAlert } = require('./services/alertProcessor');

const log = loggers.ingestion;

/**
 * Cron Scheduler
 * ──────────────
 * Schedules recurring jobs:
 *   • Hourly ingestion (data fetch + persist)
 *   • Alert evaluation (after each ingestion)
 *   • Daily pre-7AM notification
 */

let ingestionTask = null;
let dailyAlertTask = null;

/**
 * Start all scheduled jobs.
 */
function startScheduler() {
  // ── Hourly ingestion + alert evaluation ──────
  ingestionTask = cron.schedule(config.cron.ingestion, async () => {
    log.info('Scheduled ingestion starting');
    try {
      const ingestResult = await runIngestion();

      // Run alert evaluation after successful ingestion
      const anySuccess =
        ingestResult.openaq.success ||
        ingestResult.cams.success;

      if (anySuccess) {
        log.info('Running alert evaluation after ingestion');
        await evaluateAlerts();
      } else {
        log.warn('No data ingested — skipping alert evaluation');
      }
    } catch (err) {
      log.error({ err: err.message }, 'Scheduled ingestion failed');
    }
  });

  // ── Daily pre-7AM notification ───────────────
  dailyAlertTask = cron.schedule(config.cron.dailyAlert, async () => {
    log.info('Scheduled daily alert starting');
    try {
      await runDailyAlert();
    } catch (err) {
      log.error({ err: err.message }, 'Scheduled daily alert failed');
    }
  });

  log.info(
    {
      ingestionCron: config.cron.ingestion,
      dailyAlertCron: config.cron.dailyAlert,
    },
    'Scheduler started',
  );
}

/**
 * Stop all scheduled jobs.
 */
function stopScheduler() {
  if (ingestionTask) {
    ingestionTask.stop();
    ingestionTask = null;
  }
  if (dailyAlertTask) {
    dailyAlertTask.stop();
    dailyAlertTask = null;
  }
  log.info('Scheduler stopped');
}

module.exports = { startScheduler, stopScheduler };

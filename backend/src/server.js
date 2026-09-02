'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');
const { logger } = require('./logger');
const { startScheduler, stopScheduler } = require('./scheduler');

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

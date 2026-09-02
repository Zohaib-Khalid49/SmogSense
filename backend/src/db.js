'use strict';

const mongoose = require('mongoose');
const config = require('./config');
const { loggers } = require('./logger');

const log = loggers.db;

async function connect() {
  mongoose.connection.on('connected', () => {
    log.info('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    log.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    log.error({ err: err.message }, 'MongoDB connection error');
  });

  await mongoose.connect(config.mongodb.uri, {
    dbName: config.mongodb.dbName,
  });

  return mongoose.connection;
}

async function disconnect() {
  await mongoose.disconnect();
  log.info('MongoDB connection closed');
}

function isReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connect, disconnect, isReady };

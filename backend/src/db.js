'use strict';

const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./config');
const { loggers } = require('./logger');

const log = loggers.db;

/**
 * `mongodb+srv://` URIs need a DNS SRV lookup. Some networks/resolvers (seen
 * on local dev machines) refuse SRV queries, causing `querySrv ECONNREFUSED`.
 * Point the resolver at public DNS (Google, then Cloudflare) so the SRV lookup
 * succeeds regardless of the host's default DNS. Override via DNS_SERVERS
 * (comma-separated) or set to empty to keep the system resolver.
 */
function ensureSrvDns() {
  const uri = config.mongodb.uri || '';
  if (!uri.startsWith('mongodb+srv://')) return;
  const raw = process.env.DNS_SERVERS;
  if (raw === '') return; // explicit opt-out
  const servers = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['8.8.8.8', '1.1.1.1'];
  try {
    dns.setServers(servers);
  } catch (err) {
    log.warn({ err: err.message }, 'Could not override DNS servers');
  }
}

async function connect() {
  ensureSrvDns();
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
    // Tuned for a *remote* DB (e.g. Atlas), where the network can be slow or
    // briefly drop — unlike a local/Docker Mongo. These fail fast with clear
    // errors instead of hanging, and keep a warm connection pool.
    serverSelectionTimeoutMS: 10_000, // give up finding a server after 10s
    connectTimeoutMS: 10_000, // initial TCP/TLS handshake timeout
    socketTimeoutMS: 45_000, // drop a socket idle/stuck longer than this
    maxPoolSize: 10, // cap concurrent connections (Atlas free tier friendly)
    minPoolSize: 1, // keep at least one warm connection
    retryWrites: true, // retry a write once on transient network errors
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

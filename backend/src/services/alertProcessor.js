'use strict';

const config = require('../config');
const { loggers } = require('../logger');
const db = require('../db');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Alert = require('../models/Alert');
const { findNearestReading } = require('./dataService');
const { getHazardBand, BANDS } = require('../domain/thresholds');
const { mapBandToSeverity, SEVERITY_RANK } = require('../domain/severity');
const pushService = require('./pushService');

const log = loggers.alert;

/**
 * Alert Processor
 * ──────────────
 * Evaluates current air quality against all opted-in profiles,
 * detects severity increases, suppresses duplicates, and
 * delivers household-aggregated push notifications.
 *
 * Flow:
 *   1. Load all opted-in profiles with their users
 *   2. For each profile, calculate the current hazard band
 *   3. Compare with last_alerted_band — only escalate (never de-escalate alerts)
 *   4. Check suppression window (2 hours)
 *   5. Group profiles by user_id for household aggregation
 *   6. Create alert records and attempt push delivery
 */

/**
 * Run the alert evaluation cycle.
 *
 * @returns {Promise<object>}  Summary of alerts generated
 */
async function evaluateAlerts() {
  const { lat, lng } = config.lahore.center;
  const summary = { profilesChecked: 0, alertsGenerated: 0, alertsSuppressed: 0, pushSent: 0 };

  log.info('Starting alert evaluation cycle');

  // ── 1. Get current PM2.5 reading ─────────────
  const readingResult = await findNearestReading(lat, lng);
  if (!readingResult) {
    log.info('No readings available — skipping alert evaluation');
    return summary;
  }

  const pm25 = readingResult.reading.pm25;

  // ── 2. Load opted-in profiles ────────────────
  const profiles = await Profile.find({ alerts_enabled: true }).lean();

  if (profiles.length === 0) {
    log.info('No opted-in profiles found');
    return summary;
  }

  // Fetch all unique users referenced by these profiles
  const userIds = [...new Set(profiles.map((p) => p.user_id))];
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [u._id, u]));

  // ── 3. Evaluate each profile ─────────────────
  const userAlerts = new Map(); // user_id -> { severity, band, profileIds, maxPm25 }

  for (const profile of profiles) {
    summary.profilesChecked++;

    const currentBand = getHazardBand(pm25, profile.category);
    const currentSeverity = mapBandToSeverity(currentBand, pm25);

    // Check for severity increase only
    if (!shouldAlert(profile, currentBand, currentSeverity)) {
      summary.alertsSuppressed++;
      continue;
    }

    // Check suppression window
    if (isWithinSuppressionWindow(profile)) {
      summary.alertsSuppressed++;
      continue;
    }

    // Aggregate by user (household)
    const userId = profile.user_id;
    if (!userAlerts.has(userId)) {
      userAlerts.set(userId, {
        user: userMap.get(userId) || null,
        severity: currentSeverity,
        band: currentBand,
        profileIds: [],
        maxSeverityRank: SEVERITY_RANK[currentSeverity],
      });
    }

    const userEntry = userAlerts.get(userId);
    userEntry.profileIds.push(profile._id);

    // Use the most severe band across all profiles in the household
    const newRank = SEVERITY_RANK[currentSeverity];
    if (newRank > userEntry.maxSeverityRank) {
      userEntry.maxSeverityRank = newRank;
      userEntry.severity = currentSeverity;
      userEntry.band = currentBand;
    }
  }

  // ── 4. Create alerts and deliver ─────────────
  for (const [userId, alertData] of userAlerts) {
    const message = buildAlertMessage(alertData.severity, alertData.band);

    // Create alert record
    const alert = await Alert.create({
      user_id: userId,
      profile_ids: alertData.profileIds,
      severity: alertData.severity,
      hazard_band: alertData.band,
      pm25_value: pm25,
      message,
    });

    summary.alertsGenerated++;

    // Attempt push delivery
    const fcmToken = alertData.user?.fcm_token;
    const delivered = await pushService.sendPush({
      fcmToken,
      title: 'SmogSense Air Quality Alert',
      body: message,
      data: {
        type: 'hazard_alert',
        severity: alertData.severity,
        profile_ids: JSON.stringify(alertData.profileIds),
        timestamp: new Date().toISOString(),
      },
    });

    if (delivered) {
      summary.pushSent++;
      await Alert.findByIdAndUpdate(alert._id, {
        delivered: true,
        delivered_at: new Date(),
      });
    }

    // Update last_alerted_band for all profiles in this household
    await Profile.updateMany(
      { _id: { $in: alertData.profileIds } },
      {
        $set: {
          last_alerted_band: alertData.band,
          last_alerted_at: new Date(),
        },
      },
    );
  }

  log.info(summary, 'Alert evaluation complete');
  return summary;
}

/**
 * Determine if a profile should trigger an alert.
 * Only alerts on severity INCREASE (not decrease or same).
 *
 * @param {object} profile         Profile document
 * @param {string} currentBand     Current hazard band
 * @param {string} currentSeverity Current alert severity
 * @returns {boolean}
 */
function shouldAlert(profile, currentBand, currentSeverity) {
  const lastBand = profile.last_alerted_band;

  // First time alert — always send
  if (!lastBand) return true;

  // Same band — suppress
  if (lastBand === currentBand) return false;

  // Different band — only alert if severity increased
  const bandRank = { safe: 0, caution: 1, hazardous: 2 };
  const lastRank = bandRank[lastBand] ?? 0;
  const currentRank = bandRank[currentBand] ?? 0;

  return currentRank > lastRank;
}

/**
 * Check if the profile was alerted within the suppression window.
 *
 * @param {object} profile
 * @returns {boolean}
 */
function isWithinSuppressionWindow(profile) {
  if (!profile.last_alerted_at) return false;
  const elapsed = Date.now() - new Date(profile.last_alerted_at).getTime();
  return elapsed < config.alerts.suppressWindowMs;
}

/**
 * Build a human-readable alert message.
 *
 * @param {string} severity
 * @param {string} band
 * @returns {string}
 */
function buildAlertMessage(severity, band) {
  const bandLabel = band.charAt(0).toUpperCase() + band.slice(1);

  switch (severity) {
    case 'caution':
      return `Air quality has worsened to ${bandLabel} level. Sensitive groups should reduce outdoor exertion.`;
    case 'warning':
      return `Air quality is now ${bandLabel}. Everyone should limit outdoor exposure.`;
    case 'danger':
      return `Air quality is ${bandLabel}. Stay indoors with windows closed.`;
    default:
      return `Air quality update: ${bandLabel} level.`;
  }
}

/**
 * Run the daily pre-7AM notification.
 * Sends a summary of current conditions to all opted-in users.
 */
async function runDailyAlert() {
  const { lat, lng } = config.lahore.center;
  const summary = { sent: 0, failed: 0 };

  log.info('Starting daily alert notification');

  const readingResult = await findNearestReading(lat, lng);
  if (!readingResult) {
    log.info('No readings for daily alert');
    return summary;
  }

  const pm25 = readingResult.reading.pm25;

  // Get all unique users with opted-in profiles
  const profiles = await Profile.find({ alerts_enabled: true }).lean();

  const userIds = [...new Set(profiles.map((p) => p.user_id))];
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userById = new Map(users.map((u) => [u._id, u]));

  const userMap = new Map();
  for (const profile of profiles) {
    const userId = profile.user_id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        user: userById.get(userId) || null,
        categories: [],
      });
    }
    userMap.get(userId).categories.push(profile.category);
  }

  for (const [userId, userData] of userMap) {
    const band = getHazardBand(pm25, userData.categories[0]);
    const dailyMessage = buildDailyMessage(band, pm25);

    const delivered = await pushService.sendPush({
      fcmToken: userData.user?.fcm_token,
      title: 'SmogSense Daily Air Quality',
      body: dailyMessage,
      data: {
        type: 'daily_summary',
        band,
        pm25: String(pm25),
        timestamp: new Date().toISOString(),
      },
    });

    if (delivered) summary.sent++;
    else summary.failed++;
  }

  log.info(summary, 'Daily alert complete');
  return summary;
}

/**
 * Build a daily summary message.
 *
 * @param {string} band
 * @param {number} pm25
 * @returns {string}
 */
function buildDailyMessage(band, pm25) {
  const bandLabel = band.charAt(0).toUpperCase() + band.slice(1);
  return `Good morning! Today's air quality: ${bandLabel} (PM2.5: ${pm25} µg/m³). Open SmogSense for details.`;
}

// ── Standalone execution ───────────────────────
if (require.main === module) {
  (async () => {
    try {
      await db.connect();
      const mode = process.argv[2] === '--daily' ? 'daily' : 'evaluate';
      const result = mode === 'daily' ? await runDailyAlert() : await evaluateAlerts();
      console.log(JSON.stringify(result, null, 2));
      await db.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Fatal alert error:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { evaluateAlerts, runDailyAlert };

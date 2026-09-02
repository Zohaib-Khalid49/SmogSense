'use strict';

const admin = require('firebase-admin');
const config = require('../config');
const { loggers } = require('../logger');

const log = loggers.alert;

let initialised = false;

/**
 * Initialise Firebase Admin SDK.
 * Called lazily on first use. Returns false if no service account is configured.
 */
function initFirebase() {
  if (initialised) return true;

  const path = config.firebase.serviceAccountPath;
  if (!path) {
    log.info('No Firebase service account configured — push disabled');
    return false;
  }

  try {
    const serviceAccount = require(path);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialised = true;
    log.info('Firebase Admin initialised');
    return true;
  } catch (err) {
    log.error({ err: err.message }, 'Failed to initialise Firebase Admin');
    return false;
  }
}

/**
 * Send a push notification to a single device.
 *
 * @param {object} opts
 * @param {string} opts.fcmToken   Firebase Cloud Messaging token
 * @param {string} opts.title      Notification title
 * @param {string} opts.body       Notification body
 * @param {object} opts.data       Custom key-value data payload
 * @returns {Promise<boolean>}  true if sent, false if skipped/failed
 */
async function sendPush({ fcmToken, title, body, data }) {
  if (!initFirebase()) return false;

  if (!fcmToken) {
    log.debug('No FCM token — skipping push');
    return false;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
    });
    log.info({ title }, 'Push notification sent');
    return true;
  } catch (err) {
    log.warn({ err: err.message }, 'Push notification failed');
    return false;
  }
}

/**
 * Send push notifications to multiple devices (batch).
 *
 * @param {Array<object>} messages  Array of { fcmToken, title, body, data }
 * @returns {Promise<{success: number, failure: number}>}
 */
async function sendBatch(messages) {
  if (!initFirebase()) return { success: 0, failure: messages.length };

  let success = 0;
  let failure = 0;

  for (const msg of messages) {
    const sent = await sendPush(msg);
    if (sent) success++;
    else failure++;
  }

  return { success, failure };
}

module.exports = { sendPush, sendBatch, initFirebase };

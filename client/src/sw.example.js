/* eslint-disable no-undef */
/**
 * SmogSense Service Worker — TEMPLATE
 * ─────────────────────────────────────
 * Copy this file to sw.js and fill in your Firebase project config.
 *
 *   cp client/src/sw.example.js client/src/sw.js
 *
 * Get your config from:
 *   Firebase Console → Project Settings → General → Your apps → Web app
 *
 * The config is public/non-secret (embedded in the web bundle anyway).
 * Keep it out of Git — sw.js is in .gitignore.
 */

// ── 1. PWA Precaching (injected by vite-plugin-pwa at build time) ─────
// In production builds, vite-plugin-pwa replaces the import below.
// In dev mode, this file is served directly and __WB_MANIFEST is undefined.
import { precacheAndRoute } from 'workbox-precaching'
if (self.__WB_MANIFEST) {
  precacheAndRoute(self.__WB_MANIFEST)
}

// ── 2. Firebase Messaging Background Handler ─────────────────────────
// Import the compat SDK (works in service worker context, unlike modular SDK)
importScripts('https://www.googleapis.com/firebasejs/10.14.0/firebase-app-compat.js')
importScripts('https://www.googleapis.com/firebasejs/10.14.0/firebase-messaging-compat.js')

// ⚠️  Replace these with YOUR Firebase project config
firebase.initializeApp({
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
})

const messaging = firebase.messaging()

// Background message handler — shows notification when app is closed/backgrounded
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'SmogSense Alert'
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Air quality has changed.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: 'smogsense-alert',
    data: payload.data || {},
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// ── 3. Notification Click — open AlertDetail with payload ────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const alertData = event.notification.data || {}

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Store alert payload in sessionStorage for AlertDetail to read
      const storePayload = (client) => {
        // Use postMessage to send payload to the window
        client.postMessage({
          type: 'ALERT_PAYLOAD',
          data: alertData,
        })
      }

      // Try to focus an existing window
      for (const client of windowClients) {
        if (client.url.includes('/alert') || client.url.endsWith('/')) {
          storePayload(client)
          client.focus()
          // Navigate to alert page if not already there
          if (!client.url.includes('/alert')) {
            client.navigate(new URL('/alert', client.url).href)
          }
          return
        }
      }

      // No suitable window found — open a new one
      if (windowClients.length > 0) {
        const client = windowClients[0]
        storePayload(client)
        client.focus()
        client.navigate(new URL('/alert', client.url).href)
      } else {
        clients.openWindow('/alert').then((newClient) => {
          if (newClient) storePayload(newClient)
        })
      }
    }),
  )
})

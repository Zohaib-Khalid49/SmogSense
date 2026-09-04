/**
 * Small runtime helpers for tailoring UI to how the app is running.
 *
 * SmogSense is a PWA, so the same screen can render in a normal browser tab
 * or as an installed app in standalone mode (no address bar). Instructions
 * like "re-enable location" differ between those, so components need to know.
 */

/**
 * Is the app running as an installed PWA (standalone / no browser chrome)?
 *
 * Covers the standard `display-mode` media query, the newer `window-controls-overlay`
 * mode, and the legacy iOS Safari `navigator.standalone` flag.
 *
 * @returns {boolean}
 */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  const mm = window.matchMedia
  const byMedia =
    typeof mm === 'function' &&
    (mm('(display-mode: standalone)').matches ||
      mm('(display-mode: window-controls-overlay)').matches ||
      mm('(display-mode: fullscreen)').matches ||
      mm('(display-mode: minimal-ui)').matches)
  const iosLegacy = window.navigator?.standalone === true
  return Boolean(byMedia || iosLegacy)
}

/**
 * Coarse platform bucket, used only to pick the right wording for
 * OS-level permission instructions.
 *
 * @returns {'ios'|'android'|'desktop'}
 */
export function getPlatform() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPadOS 13+ reports as Mac; disambiguate via touch support
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/**
 * Human-readable guidance for re-enabling location, tailored to how the app
 * is running and the platform. Returns a single short sentence.
 *
 * @returns {string}
 */
export function locationHelpText() {
  const standalone = isStandalone()
  const platform = getPlatform()

  if (standalone) {
    if (platform === 'android') {
      return 'Open your phone Settings → Apps → SmogSense → Permissions, and set Location to Allow. Then tap “Enable location” again.'
    }
    if (platform === 'ios') {
      return 'Open Settings → SmogSense (or Settings → Privacy → Location Services), enable location, then tap “Enable location” again.'
    }
    // Installed desktop PWA
    return 'Click the app menu (⋮) → App info / Site settings, allow Location, then tap “Enable location” again.'
  }

  // Running in a normal browser tab — the address bar is available
  return 'Tap the lock or location icon in your browser’s address bar, set Location to Allow, then tap “Enable location” again.'
}

/**
 * Human-readable guidance for re-enabling notifications after they've been
 * blocked, tailored to how the app is running and the platform.
 *
 * @returns {string}
 */
export function notificationHelpText() {
  const standalone = isStandalone()
  const platform = getPlatform()

  if (standalone) {
    if (platform === 'android') {
      return 'Notifications are blocked. Open your phone Settings → Apps → SmogSense → Notifications and turn them on, then try again.'
    }
    if (platform === 'ios') {
      return 'Notifications are blocked. Open Settings → SmogSense → Notifications, allow them, then try again.'
    }
    // Installed desktop PWA
    return 'Notifications are blocked. Open the app menu (⋮) → App info / Site settings, allow Notifications, then try again.'
  }

  // Running in a normal browser tab
  return 'Notifications are blocked. Tap the lock icon in your browser’s address bar, allow Notifications, then try again.'
}

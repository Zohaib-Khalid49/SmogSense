/**
 * Mock API layer for SmogSense frontend.
 *
 * This returns data in the EXACT shape the real backend (Person A) will return,
 * so switching to the live API later is a one-line change (swap this import for
 * a real fetch). Keep this shape in sync with the shared API contract.
 *
 * Hazard status response shape:
 * {
 *   band:            'safe' | 'caution' | 'hazard'
 *   pm25:            number   (µg/m³)
 *   confidence:      'high' | 'medium' | 'model'
 *   recommendation:  string   (plain-language action)
 *   location:        string   (human-readable area name)
 *   updatedAt:       string   (ISO timestamp)
 *   source:          'station' | 'model'
 * }
 */

// A few canned responses so we can preview every band state during development.
const MOCK_STATES = {
  safe: {
    band: 'safe',
    pm25: 32,
    confidence: 'high',
    recommendation:
      'Air is clean right now. Normal outdoor activity is fine for everyone.',
    location: 'Gulberg, Lahore',
    updatedAt: new Date().toISOString(),
    source: 'station',
  },
  caution: {
    band: 'caution',
    pm25: 96,
    confidence: 'medium',
    recommendation:
      'Air is moderately polluted. Sensitive people should limit long outdoor exertion and consider a mask.',
    location: 'Gulberg, Lahore',
    updatedAt: new Date().toISOString(),
    source: 'station',
  },
  hazard: {
    band: 'hazard',
    pm25: 214,
    confidence: 'model',
    recommendation:
      'Air is hazardous. Avoid going outside if you can. If you must, wear an N95 and keep the trip short.',
    location: 'Gulberg, Lahore',
    updatedAt: new Date().toISOString(),
    source: 'model',
  },
}

/**
 * Fetch the current hazard status.
 * Mimics a network call with a small delay so we can build/test loading states.
 *
 * @param {Object} [opts]
 * @param {'safe'|'caution'|'hazard'} [opts.band] - force a band (dev only)
 * @returns {Promise<Object>} hazard status in the contract shape
 */
export function getHazardStatus({ band = 'hazard' } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_STATES[band] ?? MOCK_STATES.hazard)
    }, 600)
  })
}

/**
 * Alert detail response shape:
 * {
 *   id:              string   (alert id)
 *   reason:          string   (why the alert fired)
 *   band:            'safe' | 'caution' | 'hazard'
 *   pm25:            number   (µg/m³)
 *   confidence:      'high' | 'medium' | 'model'
 *   recommendation:  string   (plain-language action)
 *   location:        string   (human-readable area name)
 *   triggeredAt:     string   (ISO timestamp)
 *   type:            'scheduled' | 'threshold_change'
 * }
 */

const MOCK_ALERT = {
  id: 'alert_001',
  reason: 'Hazard band changed from Caution to Hazardous in your area.',
  band: 'hazard',
  pm25: 214,
  confidence: 'model',
  recommendation:
    'Air is hazardous. Avoid going outside if you can. If you must, wear an N95 and keep the trip short.',
  location: 'Gulberg, Lahore',
  triggeredAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
  type: 'threshold_change',
}

/**
 * Fetch the latest alert detail.
 * In production this would take an alert ID; for now returns a single mock.
 *
 * @returns {Promise<Object>} alert detail in the contract shape
 */
export function getAlertDetail() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_ALERT)
    }, 400)
  })
}

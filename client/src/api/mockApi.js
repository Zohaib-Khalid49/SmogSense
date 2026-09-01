/**
 * Mock API layer for SmogSense frontend.
 *
 * WARNING: These shapes are the CLIENT-SIDE shapes, NOT the raw backend shapes.
 * The backend returns a different format (snake_case, envelope wrapper, etc.).
 * The translation between backend and client shapes lives in transform.js.
 *
 * Pages should import from api/client.js (not directly from here).
 * client.js delegates to mockApi when VITE_USE_MOCKS=true.
 *
 * Client-side hazard status shape:
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

/**
 * Route comparison response shape:
 * {
 *   origin:      string   (human-readable name)
 *   destination: string   (human-readable name)
 *   routes: [
 *     {
 *       id:        string
 *       label:     string   (e.g. "Direct route", "Alternative route")
 *       pm25:      number   (average exposure along route, µg/m³)
 *       band:      'safe' | 'caution' | 'hazard'
 *       distance:  string   (e.g. "4.2 km")
 *       duration:  string   (e.g. "12 min")
 *       coords:    [lat, lng][]  (polyline for map display)
 *     }
 *   ]
 *   recommended: string  (id of the lower-exposure route)
 * }
 */

const MOCK_ROUTE_COMPARISON = {
  origin: 'Gulberg III, Lahore',
  destination: 'Lahore Grammar School, Johar Town',
  routes: [
    {
      id: 'direct',
      label: 'Direct route',
      pm25: 187,
      band: 'hazard',
      distance: '4.2 km',
      duration: '12 min',
      coords: [
        [31.5204, 74.3587],
        [31.5180, 74.3600],
        [31.5150, 74.3620],
        [31.5120, 74.3650],
        [31.5080, 74.3680],
        [31.5050, 74.3710],
      ],
    },
    {
      id: 'alternative',
      label: 'Alternative route',
      pm25: 134,
      band: 'caution',
      distance: '5.8 km',
      duration: '17 min',
      coords: [
        [31.5204, 74.3587],
        [31.5210, 74.3620],
        [31.5200, 74.3670],
        [31.5170, 74.3700],
        [31.5120, 74.3720],
        [31.5050, 74.3710],
      ],
    },
  ],
  recommended: 'alternative',
}

/**
 * Fetch a route comparison between two points.
 * In production, takes origin + destination coordinates; for now returns mock.
 *
 * @returns {Promise<Object>} route comparison in the contract shape
 */
export function getRouteComparison() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_ROUTE_COMPARISON)
    }, 800)
  })
}

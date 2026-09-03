/**
 * Transform adapters: backend shapes → client shapes.
 *
 * This is the SINGLE SOURCE OF TRUTH for mapping between the backend's
 * snake_case contract and the client's camelCase component props.
 * UI components never see backend field names — they keep their existing props.
 *
 * Every row of Backend-Client-Integration.md §2 is implemented here.
 *
 * All functions are pure (no side effects, no imports beyond this file)
 * so they're easy to unit test.
 */

// ─── Band ────────────────────────────────────────────────────────────

/** Backend sends 'hazardous'; client uses 'hazard' */
const BAND_MAP = {
  safe: 'safe',
  caution: 'caution',
  hazardous: 'hazard',
}

function toBand(backendBand) {
  return BAND_MAP[backendBand] ?? 'hazard'
}

// ─── Confidence ──────────────────────────────────────────────────────

/**
 * Backend: high | medium | low | model_only | insufficient
 * Client:  high | medium | low | model      | insufficient
 */
const CONFIDENCE_MAP = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  model_only: 'model',
  insufficient: 'insufficient',
}

function toConfidence(backendLevel) {
  return CONFIDENCE_MAP[backendLevel] ?? 'model'
}

// ─── Source ──────────────────────────────────────────────────────────

/** Backend station.source: openaq | cams → client source: station | model */
const SOURCE_MAP = {
  openaq: 'station',
  cams: 'model',
}

function toSource(backendSource) {
  return SOURCE_MAP[backendSource] ?? 'model'
}

// ─── Location ────────────────────────────────────────────────────────

/**
 * Backend: station: { id, name, distance_km, source }
 * Client:  location: "Name · 2.3 km away"
 */
function toLocation(station) {
  if (!station) return 'Lahore'
  const name = station.name || 'Nearby station'
  const dist =
    station.distance_km != null
      ? ` · ${station.distance_km} km away`
      : ''
  return `${name}${dist}`
}

// ─── Recommendation ──────────────────────────────────────────────────

/**
 * Backend: recommendation: { key, summary, explanation, advice[] }
 * Client (existing):  recommendation: string (the headline)
 *
 * We also pass through the richer fields so components can optionally
 * render them (explanation, advice bullets) without another adapter change.
 */
function toRecommendation(rec) {
  if (!rec) return { recommendation: '', explanation: '', advice: [] }
  if (typeof rec === 'string') return { recommendation: rec, explanation: '', advice: [] }

  return {
    recommendation: rec.summary || '',
    explanation: rec.explanation || '',
    advice: Array.isArray(rec.advice) ? rec.advice : [],
  }
}

// ─── Hazard Status (the main transform) ──────────────────────────────

/**
 * Transform a backend /hazard-status response into the client shape
 * that HazardCard / Home already expect.
 *
 * Backend shape (inside envelope.data):
 * {
 *   hazard_band, pm25, pm25_current, pm25_24hr_avg,
 *   confidence_level, average_confidence,
 *   recommendation: { key, summary, explanation, advice[] },
 *   station: { id, name, distance_km, source },
 *   last_updated, weather: { ... }, ...
 * }
 *
 * Client shape (what components expect):
 * {
 *   band, pm25, pm25Current, pm2524hrAvg,
 *   confidence, averageConfidence,
 *   recommendation, explanation, advice[],
 *   location, source, updatedAt,
 *   weather: { ... } (passthrough)
 * }
 */
export function toHazardStatus(raw) {
  if (!raw) return null

  const rec = toRecommendation(raw.recommendation)

  return {
    band: toBand(raw.hazard_band),
    pm25: raw.pm25 ?? raw.pm25_current ?? 0,
    pm25Current: raw.pm25_current ?? null,
    pm2524hrAvg: raw.pm25_24hr_avg ?? null,
    confidence: toConfidence(raw.confidence_level),
    averageConfidence: raw.average_confidence ?? null,
    recommendation: rec.recommendation,
    explanation: rec.explanation,
    advice: rec.advice,
    location: toLocation(raw.station),
    source: toSource(raw.station?.source),
    updatedAt: raw.last_updated || new Date().toISOString(),
    weather: raw.weather ?? null,
  }
}

// ─── Profile Category ─────────────────────────────────────────────────

/**
 * Client profile IDs differ from backend enums for two categories:
 *
 *   Client        | Backend
 *   ──────────────|────────────────
 *   pregnant      | pregnant_woman
 *   respiratory   | asthma_copd
 *
 * All other categories (adult, child, elderly, outdoor_worker) are identical.
 */
const CATEGORY_TO_BACKEND = {
  adult: 'adult',
  child: 'child',
  elderly: 'elderly',
  pregnant: 'pregnant_woman',
  respiratory: 'asthma_copd',
  outdoor_worker: 'outdoor_worker',
}

const CATEGORY_FROM_BACKEND = {
  adult: 'adult',
  child: 'child',
  elderly: 'elderly',
  pregnant_woman: 'pregnant',
  asthma_copd: 'respiratory',
  outdoor_worker: 'outdoor_worker',
}

/**
 * Convert a client profile category id to the backend enum value.
 * @param {string} clientCategory
 * @returns {string}
 */
export function toBackendCategory(clientCategory) {
  return CATEGORY_TO_BACKEND[clientCategory] ?? clientCategory
}

/**
 * Convert a backend profile category to the client id.
 * @param {string} backendCategory
 * @returns {string}
 */
function fromBackendCategory(backendCategory) {
  return CATEGORY_FROM_BACKEND[backendCategory] ?? backendCategory
}

// ─── Profile ─────────────────────────────────────────────────────────

/**
 * Transform a backend profile object into the client shape.
 *
 * Backend: { _id, user_id, name, age, category, alerts_enabled, ... }
 * Client:  { profileId, userId, name, age, profileCategory, alertsEnabled }
 */
export function toProfile(raw) {
  if (!raw) return null

  return {
    profileId: raw._id || raw.profile_id || '',
    userId: raw.user_id || '',
    name: raw.name || '',
    age: raw.age ?? null,
    profileCategory: fromBackendCategory(raw.category || 'adult'),
    alertsEnabled: raw.alerts_enabled !== false,
    subDetail: raw.sub_detail ?? null,
    label: raw.name || '',
  }
}

/**
 * Transform a list of backend profiles.
 */
export function toProfiles(rawList) {
  if (!Array.isArray(rawList)) return []
  return rawList.map(toProfile)
}

// ─── Route comparison ────────────────────────────────────────────────

/**
 * Transform a backend /route-check response into the client shape.
 *
 * Backend shape (inside envelope.data):
 * {
 *   primary_route:   { band, pm25, confidence, recommendation_key },
 *   alternate_route: { band, pm25, confidence, recommendation_key },
 *   meaningful_difference: boolean,
 *   reliable: boolean,
 *   advice: string,
 * }
 *
 * Client shape (what RouteCheck expects):
 * {
 *   routes: [{ id, label, pm25, band, confidence, distance, duration, coords }],
 *   recommended: id,
 *   meaningfulDifference: boolean,
 *   reliable: boolean,
 *   advice: string,
 * }
 *
 * The backend returns two point readings (origin + destination), NOT drawn
 * routes — so there are no polyline coords, distances, or durations.
 */
export function toRouteComparison(raw) {
  if (!raw) return null

  // Support both the real backend shape (primary_route/alternate_route)
  // and the legacy mock shape (routes[]), so mock mode still works.
  if (Array.isArray(raw.routes)) {
    const routes = raw.routes.map((r) => ({
      id: r.id || r.route_id || '',
      label: r.label || r.name || '',
      pm25: r.pm25 ?? 0,
      band: toBand(r.hazard_band ?? r.band),
      distance: r.distance || '',
      duration: r.duration || '',
      confidence: toConfidence(r.confidence_level ?? r.confidence),
      coords: r.coords || [],
    }))
    return {
      origin: raw.origin || '',
      destination: raw.destination || '',
      routes,
      recommended: raw.recommended || (routes[1]?.id ?? ''),
      meaningfulDifference: raw.meaningful_difference ?? null,
      reliable: raw.reliable ?? true,
      advice: raw.advice ?? '',
    }
  }

  // Real backend shape
  const primary = raw.primary_route
  const alternate = raw.alternate_route
  if (!primary && !alternate) return null

  const routes = []
  if (primary) {
    routes.push({
      id: 'origin',
      label: 'Your location',
      pm25: Math.round(primary.pm25 ?? 0),
      band: toBand(primary.band),
      confidence: toConfidence(primary.confidence),
      distance: '',
      duration: '',
      coords: [],
    })
  }
  if (alternate) {
    routes.push({
      id: 'destination',
      label: 'Destination',
      pm25: Math.round(alternate.pm25 ?? 0),
      band: toBand(alternate.confidence === 'insufficient' ? alternate.band : alternate.band),
      confidence: toConfidence(alternate.confidence),
      distance: '',
      duration: '',
      coords: [],
    })
  }

  // Recommend the lower-PM2.5 route
  let recommended = ''
  if (routes.length === 2) {
    recommended = routes[0].pm25 <= routes[1].pm25 ? routes[0].id : routes[1].id
  } else if (routes.length === 1) {
    recommended = routes[0].id
  }

  return {
    routes,
    recommended,
    meaningfulDifference: raw.meaningful_difference ?? null,
    reliable: raw.reliable ?? true,
    advice: raw.advice ?? '',
  }
}

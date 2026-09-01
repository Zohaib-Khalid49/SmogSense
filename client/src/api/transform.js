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
    profileCategory: raw.category || 'adult',
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
 * Adapts the band and confidence fields on each route entry,
 * and passes through the rest.
 */
export function toRouteComparison(raw) {
  if (!raw) return null

  const routes = Array.isArray(raw.routes)
    ? raw.routes.map((r) => ({
        id: r.id || r.route_id || '',
        label: r.label || r.name || '',
        pm25: r.pm25 ?? 0,
        band: toBand(r.hazard_band ?? r.band),
        distance: r.distance || '',
        duration: r.duration || '',
        confidence: toConfidence(r.confidence_level ?? r.confidence),
        coords: r.coords || [],
      }))
    : []

  return {
    origin: raw.origin || '',
    destination: raw.destination || '',
    routes,
    recommended: raw.recommended || (routes[1]?.id ?? ''),
    meaningfulDifference: raw.meaningful_difference ?? null,
  }
}

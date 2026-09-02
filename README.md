# SmogSense

SmogSense is a coordinate-based smog decision-support web app for Lahore, Pakistan. At the moment you need to decide — whether to go outside, commute, or send a child to school — it tells you how safe the air is where you are, with personalized guidance for every profile it supports: healthy adults, children, the elderly, pregnant women, people with asthma/COPD, and outdoor workers.

**Stack:** Node 22 · Express · MongoDB (Mongoose) · Groq LLM · Firebase FCM · React 19 · Vite · Tailwind CSS 4

## Repository Layout

| Path | Description |
|------|-------------|
| `backend/` | Node.js + Express API: OpenAQ/Open-Meteo ingestion, MongoDB persistence, hazard thresholds, Groq LLM recommendations, Firebase push alerts |
| `client/` | React 19 + Vite mobile-first PWA — fully integrated with the backend API, Firebase push notifications, and offline caching |

## Quick Start

### Backend

```bash
# 1. From the repo root, install dependencies
cd backend
npm install

# 2. Copy the environment template (it lives at the repo root)
cp ../.env.example .env

# 3. Edit .env — set MONGODB_URI and optionally GROQ_API_KEY
#    (dotenv loads .env from the backend/ working directory)

# 4. Start in development mode
npm run dev

# 5. Run tests
npm test
```

### Client

```bash
cd client
npm install

# Copy environment config
cp .env.development .env   # or edit .env.development directly

# Edit .env.development:
#   VITE_API_BASE_URL=http://localhost:3000   (backend URL)
#   VITE_USE_MOCKS=false                      (true = mock data, false = live backend)
#   VITE_FIREBASE_API_KEY=...                 (Firebase config for push notifications)
#   VITE_FIREBASE_AUTH_DOMAIN=...
#   VITE_FIREBASE_PROJECT_ID=...
#   VITE_FIREBASE_STORAGE_BUCKET=...
#   VITE_FIREBASE_MESSAGING_SENDER_ID=...
#   VITE_FIREBASE_APP_ID=...
#   VITE_FIREBASE_VAPID_KEY=...

npm run dev     # Vite dev server (default: http://localhost:5173)
```

> The client connects to the live backend API when `VITE_USE_MOCKS=false`. Set `VITE_USE_MOCKS=true` for offline development with canned responses. Push notifications require valid Firebase config values in the environment.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | Environment mode |
| `MONGODB_URI` | No | `mongodb://localhost:27017/smogsense` | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `smogsense` | Database name |
| `GROQ_API_KEY` | No | _(empty)_ | Groq API key for LLM explanations |
| `GROQ_MODEL` | No | `openai/gpt-oss-20b` | Groq model name |
| `OPENAQ_API_KEY` | No | _(empty)_ | OpenAQ API key (improves rate limits) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | _(empty)_ | Path to Firebase service-account JSON |
| `LOG_LEVEL` | No | `info` | Pino log level |

**Secrets are never logged.** Authorization headers, cookies, API keys, and Firebase paths are redacted in all log output.

### Client Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://localhost:3000` | Backend API base URL |
| `VITE_USE_MOCKS` | No | `true` | Use mock data instead of live backend |
| `VITE_FIREBASE_API_KEY` | For push | _(empty)_ | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | For push | _(empty)_ | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | For push | _(empty)_ | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | For push | _(empty)_ | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | For push | _(empty)_ | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | For push | _(empty)_ | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | For push | _(empty)_ | Firebase VAPID key for web push |

> Firebase variables are only required when push notifications are enabled. The app functions without them (hazard dashboard, profiles, route check all work independently).

## MongoDB Setup

### Collections & Indexes

**users**
- `{ fcm_token: 1 }` — push delivery lookup

**profiles**
- `{ user_id: 1 }` — profile retrieval per user
- `{ alerts_enabled: 1, category: 1 }` — alert evaluation query

**readings**
- `{ station_id: 1, timestamp: 1 }` **unique** — idempotent upsert
- `{ timestamp: -1, pm25: 1 }` — latest reading lookup
- `{ station_location: '2dsphere' }` — geo queries

**weather**
- `{ timestamp: 1 }` **unique** — idempotent upsert
- `{ timestamp: -1 }` — latest weather lookup

**alerts**
- `{ user_id: 1, created_at: -1 }` — alert deduplication
- `{ created_at: -1 }` — history queries
- `{ delivered: 1, created_at: -1 }` — delivery tracking

**routes**
- `{ route_hash: 1 }` — route lookup
- `{ origin: '2dsphere' }` — geo queries
- `{ timestamp: -1 }` — cleanup

### Initial Setup
```bash
mongosh
use smogsense
# Indexes are created automatically by Mongoose on first connection
```

## Scheduled Jobs

### Hourly Ingestion (`npm run ingest` or cron: `0 * * * *`)
1. Fetches PM2.5 station readings from **OpenAQ** (within 30 km of Lahore center)
2. Fetches CAMS model data from **Open-Meteo** for Lahore center
3. Fetches weather data from **Open-Meteo**
4. Persists with idempotent upserts — never generates synthetic values
5. Partial success: one source failing does not block others

### Alert Evaluation (runs after each successful ingestion)
1. Loads opted-in profiles
2. Calculates current hazard band from cached readings
3. Detects **severity increases only** (never alerts on de-escalation)
4. Suppresses duplicate alerts within 2-hour window
5. Aggregates multi-profile households into one notification
6. Creates alert records and attempts Firebase push delivery

### Daily Alert (cron: `0 1 * * *` — 6 AM PKT / 1 AM UTC)
Sends a morning summary notification to all opted-in users.

## API Reference

### Common Envelope

```json
// Success
{ "success": true, "data": { ... }, "meta": { "timestamp": "...", "sources": [...] } }

// Error
{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }
```

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_PARAMS` | 400 | Missing/malformed parameters |
| `INVALID_COORDINATES` | 400 | Outside Lahore bounds |
| `INVALID_PROFILE` | 400 | Unknown profile category |
| `INVALID_ID` | 400 | Malformed MongoDB ObjectId |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE` | 409 | Unique constraint violation |
| `VALIDATION_ERROR` | 422 | Schema validation failure |
| `NO_DATA` | 200 | No readings available (success with null data) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected error |

### Profile Categories
`adult` · `child` · `elderly` · `pregnant_woman` · `asthma_copd` · `outdoor_worker`

---

### `GET /health` — Liveness probe
### `GET /ready` — Readiness probe (MongoDB check)

---

### `GET /hazard-status`

| Param | Required | Description |
|-------|----------|-------------|
| `lat` | Yes | Latitude (-90 to 90) |
| `lng` | Yes | Longitude (-180 to 180) |
| `profile_category` | No | Default: `adult` |

```json
{
  "success": true,
  "data": {
    "hazard_band": "caution",
    "pm25": 42.3,
    "pm25_current": 68.0,
    "pm25_24hr_avg": 42.3,
    "profile_category": "child",
    "confidence_level": "high",
    "last_updated": "2026-08-30T08:15:00Z",
    "recommendation": {
      "key": "caution_child",
      "summary": "Air quality is elevated...",
      "explanation": "...",
      "advice": ["Shorten outdoor play sessions.", "..."]
    },
    "station": { "id": "...", "name": "...", "distance_km": 2.1, "source": "openaq" },
    "averaging": {
      "pm25_24hr_avg": 42.3,
      "hours_used": 24,
      "is_full_window": true,
      "average_confidence": "full",
      "oldest_reading": "2026-08-29T09:00:00Z",
      "newest_reading": "2026-08-30T08:00:00Z"
    },
    "weather": { "temperature_c": 34, "humidity_pct": 65, "wind_speed_ms": 3.2 }
  },
  "meta": { "timestamp": "...", "confidence": "high", "sources": ["openaq", "cams"] }
}
```

---

### `GET /route-check`

| Param | Required | Description |
|-------|----------|-------------|
| `origin_lat` | Yes | Origin latitude |
| `origin_lng` | Yes | Origin longitude |
| `dest_lat` | Yes | Destination latitude |
| `dest_lng` | Yes | Destination longitude |
| `profile_category` | No | Default: `adult` |

---

### `POST /profiles`

**Body:** `{ "user_id", "category", "name?", "age?", "alerts_enabled?", "fcm_token?" }`

### `GET /profiles/:user_id`

Returns array of profiles for a user.

### `PATCH /profiles/:profile_id`

**Body:** Any subset of `{ "category", "name", "age", "alerts_enabled" }`

### `POST /alerts/register-device`

**Body:** `{ "profile_id", "fcm_token" }`

## Rolling 24-Hour PM2.5 Average

### Why

The EPA's 24-hour PM2.5 breakpoints are designed for 24-hour averaged concentrations, not instantaneous hourly values. Applying them to raw hourly readings would cause false hazard triggers from transient spikes.

### Method

A **flat (unweighted) rolling average** of the last 24 hourly readings per station, recalculated at query time. This is a defensible MVP approximation of EPA's methodology.

**Pipeline:**
```
OpenAQ / Open-Meteo (hourly fetch)
        ↓
readings collection (raw hourly values — unchanged)
        ↓
Rolling 24-hour average (query-time computation)
        ↓
Averaged value → Hazard Threshold Engine
```

- Raw hourly readings are preserved as-is (useful for trend charts and route comparison).
- The averaged value feeds the hazard-status endpoint.
- Both `pm25_current` (raw) and `pm25_24hr_avg` are exposed in the API response.

### Warm-Up Period

For a new station with fewer than 24 hours of history, the average is computed over whatever hours are available. The `average_confidence` field indicates data maturity:

| Value | Meaning |
|-------|---------|
| `full` | 24 hours of data available |
| `partial` | 12–23 hours (reasonable approximation) |
| `minimal` | 1–11 hours (very rough) |
| `none` | No data available |

### V2 Backlog: NowCast-Weighted Average

EPA's real-time AQI (as displayed on AirNow) uses a NowCast-style weighted average that gives more weight to recent hours. A flat average diverges from this. NowCast weighting is deferred as a V2 refinement for closer parity with AirNow's exact numbers.

## Threshold Table Provenance

### US EPA 24-Hour PM2.5 Breakpoints (rev. 2024)

| EPA Category | PM2.5 Range (µg/m³) |
|-------------|---------------------|
| Good | 0.0 – 9.0 |
| Moderate | 9.1 – 35.4 |
| USG (Unhealthy for Sensitive Groups) | 35.5 – 55.4 |
| Unhealthy | 55.5 – 125.4 |
| Very Unhealthy | 125.5 – 225.4 |
| Hazardous | 225.5+ |

### Categorical-Shift Model (3-Band)

SmogSense maps 6 EPA categories into 3 hazard bands using a **categorical shift** — no numeric multipliers:

| Profile Group | Safe | Caution | Hazardous |
|---------------|------|---------|-----------|
| **Adult** | Good + Moderate (0–35.4) | USG + Unhealthy (35.5–125.4) | Very Unhealthy + Hazardous (125.5+) |
| **Sensitive** (Child, Elderly, Pregnant Woman, Asthma/COPD, Outdoor Worker) | Good only (0–9.0) | Moderate + USG (9.1–55.4) | Unhealthy+ (55.5+) |

Sensitive profiles trigger hazard bands **one EPA category earlier** than Adult.

## Confidence Semantics

| Level | Station Distance | Data Freshness | Sources |
|-------|-----------------|----------------|---------|
| `high` | ≤ 5 km | < 1 hour | ≥ 1 |
| `medium` | ≤ 15 km | < 2 hours | — |
| `low` | ≤ 30 km | < 3 hours | — |
| `model_only` | No station | — | CAMS only |
| `insufficient` | No station | — | None |

## Groq Configuration

- **Model:** `openai/gpt-oss-20b` (replaced `llama-3.1-8b-instant`, decommissioned by Groq on 2026-08-16)
- **Max tokens:** 200
- **Timeout:** 5 seconds
- **Temperature:** 0.4
- **Prohibited output:** medical language (diagnose, prescribe, medication, treatment, cure, symptom, disease, doctor, physician, clinical, drug, dosage)
- **Fallback:** static template on timeout, rate limit, invalid output, or medical language detection
- **Cache:** 10-minute TTL per `(hazard_band, profile_category)` key

## Push Notifications

The client uses Firebase Cloud Messaging (FCM) for web push notifications. The backend evaluates hazard severity changes for opted-in profiles and sends aggregated household alerts.

### Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Cloud Messaging** in the Firebase console
3. Generate a **Web Push certificate** under Project Settings → Cloud Messaging → Web Push certificates
4. Download the **service account JSON** from Project Settings → Service Accounts → Generate new private key
5. Place the service account file at `backend/private/firebase-service-account.json` (gitignored)
6. Copy the Firebase config values into `client/.env.development` (without quotes around values)
7. Copy the VAPID key into `client/src/sw.js` (with quotes — it's JavaScript)

### How It Works

- The client shows a 3-state permission component (prompt → enabled → disabled)
- On enable, the service worker registers with Firebase and obtains an FCM token
- The token is sent to the backend via `POST /alerts/register-device`
- Backend alert processor evaluates severity increases, deduplicates within 2-hour windows, and sends aggregated notifications
- Notification clicks open the AlertDetail page with the relevant alert context

## Offline Support

The client caches API responses in `localStorage` for resilience when connectivity is lost.

- **Hazard status & route check:** cached on every successful API response
- **Stale data badge:** when serving cached data, a warning banner shows "Showing cached data" with the last-updated time
- **Offline indicator:** a global amber banner appears when the browser detects loss of connectivity, auto-dismisses with a green "Back online" banner on reconnection
- **Profile editing:** blocked when offline (requires backend sync); the Continue button shows "Offline — cannot add profiles"
- **Cache module:** `client/src/lib/cache.js` — `cacheResponse()`, `getCachedResponse()`, `clearCache()`, `formatCachedTime()`

## Curl Examples

```bash
# Health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/ready

# Hazard status (DHA Lahore)
curl "http://localhost:3000/hazard-status?lat=31.47&lng=74.38&profile_category=child"

# Route comparison (DHA to Gulberg)
curl "http://localhost:3000/route-check?origin_lat=31.47&origin_lng=74.38&dest_lat=31.52&dest_lng=74.36"

# Create a profile
curl -X POST http://localhost:3000/profiles \
  -H "Content-Type: application/json" \
  -d '{"user_id":"507f1f77bcf86cd799439011","category":"child","name":"Ali","age":8,"alerts_enabled":true}'

# Get profiles for a user
curl http://localhost:3000/profiles/507f1f77bcf86cd799439011

# Update a profile
curl -X PATCH http://localhost:3000/profiles/507f1f77bcf86cd799439012 \
  -H "Content-Type: application/json" \
  -d '{"alerts_enabled":false}'

# Register push device
curl -X POST http://localhost:3000/alerts/register-device \
  -H "Content-Type: application/json" \
  -d '{"profile_id":"507f1f77bcf86cd799439012","fcm_token":"abc123..."}'

# Run manual ingestion (from backend/)
npm run ingest
```

## Known Limitations

1. **Simplified route model:** Route comparison uses nearest-station PM2.5 for each endpoint, not actual path-based exposure. A real routing engine (e.g., OSRM + per-segment pollution interpolation) would be needed for production-grade route recommendations.

2. **Single-city focus:** The backend is hardcoded for Lahore (bounds, coordinates). Multi-city support would require parameterising the city config.

3. **In-memory recommendation cache:** The Groq explanation cache is process-local and lost on restart. A Redis-backed cache would be needed for multi-instance deployments.

4. **No rate limiting on endpoints:** `express-rate-limit` is installed but not yet configured. Should be added before production deployment.

5. **No authentication:** Endpoints are currently open. JWT or API-key auth should be added for production.

6. **Firebase-only push:** Push notifications use Firebase Cloud Messaging exclusively. Other providers (APNs, web push) would require adapter additions.

## Project Structure

### Backend (`backend/`)

```
backend/
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Express app setup
│   ├── config.js              # Environment config + validation
│   ├── logger.js              # Pino logger with redaction
│   ├── db.js                  # MongoDB connection handling
│   ├── scheduler.js           # Cron job scheduler
│   ├── domain/                # Pure logic (no I/O)
│   │   ├── thresholds.js      # PM2.5 breakpoints + categorical shift
│   │   ├── severity.js        # Severity ordering
│   │   ├── recommendationKeys.js  # 18-combination mapping
│   │   ├── confidence.js      # Confidence calculation + Haversine
│   │   ├── rollingAverage.js  # Rolling 24-hour PM2.5 average
│   │   └── routeComparison.js # Route exposure comparison
│   ├── errors/
│   │   └── AppError.js
│   ├── middleware/
│   │   ├── errorHandler.js    # Global error handler
│   │   ├── requestLogger.js   # HTTP request logging
│   │   └── validate.js        # Query/body/param validators
│   ├── models/                # Mongoose schemas
│   │   ├── User.js
│   │   ├── Profile.js
│   │   ├── Reading.js
│   │   ├── Weather.js
│   │   ├── Alert.js
│   │   └── Route.js
│   ├── routes/
│   │   ├── health.js
│   │   ├── hazardStatus.js
│   │   ├── routeCheck.js
│   │   ├── profiles.js
│   │   └── alerts.js
│   ├── services/
│   │   ├── openaqAdapter.js
│   │   ├── openMeteoCamsAdapter.js
│   │   ├── openMeteoWeatherAdapter.js
│   │   ├── dataService.js
│   │   ├── groqService.js
│   │   ├── recommendationTemplates.js
│   │   ├── recommendationService.js
│   │   ├── pushService.js
│   │   └── alertProcessor.js
│   └── jobs/
│       └── ingest.js
├── tests/
│   ├── domain/
│   │   ├── thresholds.test.js       # 55 tests (all 18 mappings + boundaries + averaged inputs)
│   │   ├── confidence.test.js       # 13 tests (all tiers + Haversine)
│   │   ├── routeComparison.test.js  # 9 tests (meaningful diff + unreliable)
│   │   ├── recommendationKeys.test.js  # 24 tests (all 18 keys + invalid)
│   │   ├── rollingAverage.test.js   # 24 tests (sequence, warm-up, edge cases)
│   │   └── severity.test.js         # 7 tests (ordering + mapping)
│   └── services/
│       └── groqAndTemplates.test.js # 10 tests (medical detection + templates)
├── private/                   # Firebase service account (gitignored — never commit)
└── package.json
```

**Backend total: 143 tests, all passing.**

### Client (`client/`)

```
client/
├── index.html
├── vite.config.js             # Vite + React + Tailwind v4 + PWA plugin (SW enabled in dev)
├── public/                    # PWA icons (192, 512, maskable, apple-touch)
└── src/
    ├── main.jsx               # React 19 entry (StrictMode) + Firebase init
    ├── App.jsx                # Routing: Home, ProfileSetup, RouteCheck, AlertDetail
    ├── sw.js                  # Service worker: Firebase messaging + Workbox precaching
    ├── pages/
    │   ├── Home.jsx           # Hazard dashboard — live/mock data, profile switcher, stale data badge
    │   ├── ProfileSetup.jsx   # Household profile management — backend sync, offline blocking
    │   ├── RouteCheck.jsx     # Trip comparison — origin/dest picker, route exposure
    │   └── AlertDetail.jsx    # Push alert detail — FCM payload display
    ├── components/
    │   ├── AppLayout.jsx      # Mobile-first shell + OfflineBanner
    │   ├── HazardCard.jsx     # Hero: band, PM2.5, confidence, recommendation
    │   ├── BottomNav.jsx      # Tab navigation bar
    │   ├── LocationHint.jsx   # Location source indicator
    │   ├── NotificationPermission.jsx  # Push permission prompt (3-state: prompt/enabled/disabled)
    │   ├── OfflineBanner.jsx  # Online/offline indicator with auto-dismiss
    │   ├── ProfileCard.jsx    # Profile summary card
    │   ├── ProfileList.jsx    # Profile list with active selection
    │   ├── StatusMessage.jsx  # Info/warning/error/success message display
    │   ├── SubDetailPicker.jsx # Category sub-detail selector
    │   └── ui/                # badge, button, card, alert-dialog (Radix UI + CVA)
    ├── api/
    │   ├── client.js          # Endpoint functions with mock/live switch + offline caching
    │   ├── httpClient.js      # Fetch wrapper: base URL, 10s timeout, envelope unwrapping
    │   ├── apiError.js        # ApiError class (code, message, httpStatus) + user messages
    │   ├── transform.js       # Backend ↔ client shape adapters (snake_case, category mapping)
    │   └── mockApi.js         # Canned safe/caution/hazard responses (VITE_USE_MOCKS=true)
    ├── lib/
    │   ├── cache.js           # localStorage response cache for offline resilience
    │   ├── firebase.js        # Firebase app + messaging initialization
    │   ├── geolocation.js     # { lat, lng, source, hint } — falls back to Lahore center
    │   ├── hazard.js          # Band labels/colors, confidence labels (extended)
    │   ├── identity.js        # getOrCreateUserId() — UUID in localStorage
    │   ├── profiles.js        # Profile storage helpers (localStorage fallback)
    │   ├── push.js            # FCM token management, registration, timeout handling
    │   ├── storage.js         # localStorage read/write utilities
    │   └── utils.js           # cn() (clsx + tailwind-merge)
    └── index.css              # Tailwind v4 + theme tokens
```

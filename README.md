# SmogSense

## Why we built SmogSense

Every winter, Lahore disappears into its own smoke. The sky goes grey-brown
by late October, and by November the city is routinely ranked among the most
polluted on Earth. Schools close. Outdoor match schedules collapse. Hospital
ERs fill up with breathing difficulties. And through all of it, life goes on —
because it has to. People still commute, kids still walk to school,
families still decide, every single day, whether today is an outside day.

The apps don't help the way they should.

They'll tell you the AQI is 245. "Unhealthy." But that number is a citywide
average from a station that might be six kilometres from your street — and it
treats every pair of lungs as identical. The air that's merely unpleasant for
a healthy 25-year-old is a genuinely different story for a child with asthma,
a pregnant mother, or a rickshaw driver spending eight hours in it.

We kept running into the same gap: **the apps measure the air, but the
question is a decision.** Nobody should need a US EPA breakpoints table open
in a second tab to answer it.

That gap isn't abstract. For some families, it's not an inconvenience —
it's a health risk they manage every single day.

**Meet Fatima.** She's 34, a school teacher in Lahore, mother of two — a
six-year-old with mild asthma and a three-year-old in preschool.

Every smog-season morning, she faces the same dilemma. She opens her window
and thinks the air looks okay — but she can't be sure. Her son's school
messages *"AQI is high, send masks,"* but she has no way to verify it. One
weather app says 180. Another says 260. A third shows nothing at all.

Her husband's family has a history of COPD, and she worries about her kids
constantly — but all she gets is generic "stay indoors" advice that isn't
actionable when you have a life to live. Classes to teach, school runs to
make, groceries to buy.

Fatima's question was never *"what is the AQI?"* It's *"what do I do about my
kids today?"* — and no app she's ever used has even tried to answer it.

So SmogSense answers it directly.

- **A verdict, not a number** — safe / caution / hazardous, computed from
  PM2.5 at the station *nearest you*, against thresholds that tighten for
  your profile: child, pregnancy, asthma/COPD, outdoor work.
- **Advice you can act on** — plain-language guidance from an LLM, with a
  deterministic template fallback so the app never goes mute when the AI
  does.
- **Route awareness** — compare the air at your origin and your destination
  before you travel, not after.
- **Honest data** — monitoring stations report one to two hours late. Instead
  of quietly showing stale numbers, SmogSense says so: *"Updated 2:00 PM ·
  Checked 4:25 PM."* If the app can't reach the network, it shows the last
  known verdict and tells you it's stale.

On a smog-season morning, Fatima opens SmogSense instead of her window. It
finds the station nearest her, checks it against her son's profile — a child
with asthma has a far lower caution line than a healthy adult — and gives her
a straight answer: what the verdict is, whether the school-run route is any
worse than home, and what's worth doing about it. Different morning, different
question, an actual answer.

That honesty became a principle while building this: an air quality app that
quietly serves yesterday's number is worse than no app at all. Trust is the
feature.

SmogSense is live as an installable PWA — an Express + MongoDB backend
ingesting OpenAQ, Open-Meteo and CAMS data hourly, a React client with
offline caching, and push alerts when the air turns. Built in and for
Lahore's smog season, and ready for the next city that needs it.

## What it does

SmogSense is a coordinate-based smog decision-support web app for Lahore, Pakistan. At the moment you need to decide — whether to go outside, commute, or send a child to school — it tells you how safe the air is where you are, with personalized guidance for every profile it supports: healthy adults, children, the elderly, pregnant women, people with asthma/COPD, and outdoor workers.

**Stack:** Node 22 · Express · MongoDB (Mongoose) · Groq LLM · Firebase FCM · React 19 · Vite · Tailwind CSS 4

## Prerequisites

| Requirement | Required for | Notes |
|-------------|-------------|-------|
| **Node.js 22+** | Backend + Client | Use [nvm](https://github.com/nvm-sh/nvm) or check `.nvmrc` |
| **MongoDB** | Backend only | Local install or [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier works). Mongoose creates the database automatically on first connection |
| **Git** | Cloning | Standard git |
| Firebase project | Push notifications only | Optional — see [Push Notifications](#push-notifications) setup below |

## Repository Layout

| Path | Description |
|------|-------------|
| `backend/` | Node.js + Express API: OpenAQ/Open-Meteo ingestion, MongoDB persistence, hazard thresholds, Groq LLM recommendations, Firebase push alerts |
| `client/` | React 19 + Vite mobile-first PWA — fully integrated with the backend API, Firebase push notifications, offline caching, and Lahore-biased place search (Nominatim) |

## Quick Start

There are three ways to run SmogSense, depending on how much of the stack you need.

### Option A: Client Only (Mock Mode) — Fastest

No backend, no MongoDB, no Firebase. The client runs with canned responses — great for UI development.

```bash
git clone https://github.com/Zohaib-Khalid49/SmogSense.git
cd SmogSense/client
npm install

# Create .env.development (this file is gitignored, so it's not in the repo)
cat > .env.development << 'EOF'
VITE_API_BASE_URL=http://localhost:3000
VITE_USE_MOCKS=true
EOF

npm run dev
# → http://localhost:5173
```

### Option B: Client + Backend (No Push Notifications)

Full live API with real PM2.5 data from OpenAQ and Open-Meteo. No Firebase setup required.

**1. Start MongoDB** (if running locally):
```bash
# macOS / Linux
mongod

# Windows
mongod --dbpath C:\data\db

# Or use MongoDB Atlas — just paste the connection string in .env
```

**2. Set up and start the backend:**
```bash
cd backend
npm install

# Copy the environment template
cp ../.env.example .env       # Linux/macOS
# Copy-Item ..\.env.example .env   # Windows (PowerShell)

# Edit .env — at minimum set MONGODB_URI (or leave the default for local MongoDB)
# Optionally set GROQ_API_KEY for LLM-generated explanations
# Leave FIREBASE_SERVICE_ACCOUNT_PATH empty

npm run dev
# → http://localhost:3000
```

**3. Set up and start the client** (in a new terminal):
```bash
cd client
npm install

# Create .env.development (this file is gitignored, so it's not in the repo)
cat > .env.development << 'EOF'
VITE_API_BASE_URL=http://localhost:3000
VITE_USE_MOCKS=false
EOF

npm run dev
# → http://localhost:5173
```

### Option C: Full Stack (With Push Notifications)

Everything in Option B, plus Firebase Cloud Messaging. Requires a Firebase project.

**1. Complete Option B first** (backend + client running).

**2. Set up Firebase:**
- Create a project at [console.firebase.google.com](https://console.firebase.google.com)
- Enable **Cloud Messaging** in the Firebase console
- Generate a **Web Push certificate** (Project Settings → Cloud Messaging → Web Push certificates)
- Download the **service account JSON** (Project Settings → Service Accounts → Generate new private key)

**3. Configure the backend:**
```bash
# Place the service account file (gitignored, never commit)
cp ~/Downloads/your-service-account.json backend/private/firebase-service-account.json

# Edit backend/.env — set the path
FIREBASE_SERVICE_ACCOUNT_PATH=./private/firebase-service-account.json
```

**4. Configure the client:**
```bash
# Copy the service worker template (sw.js is gitignored)
cp client/src/sw.example.js client/src/sw.js

# Edit client/src/sw.js — replace YOUR_* placeholders with your Firebase config
# Values MUST be in quotes (it's JavaScript): apiKey: "AIza..."

# Edit client/.env.development — add Firebase values (NO quotes around values)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BNbx...
```

> These values live in `.env.development`, which only `npm run dev` loads. For production builds, mirror them into `client/.env.production.local` — see [Production Builds](#production-builds).

**5. Restart both servers** to pick up the new config.

> **Important quoting rules:**
> - `.env.development` values: **no quotes** (`VITE_FIREBASE_API_KEY=AIza...`)
> - `sw.js` values: **with quotes** (`apiKey: "AIza..."`) — it's JavaScript

### Running Tests

```bash
cd backend
npm test     # 143 tests, all passing
```

### First Data Load

On startup the backend runs one ingestion automatically unless ingestion has already run since the last hourly slot, so a newly started instance picks up the newest available data instead of waiting for the top of the hour (see [Scheduled Jobs](#scheduled-jobs)). To force a manual ingestion at any time:

```bash
cd backend
npm run ingest
```

This fetches current air quality data from OpenAQ and Open-Meteo. After ingestion, the client will show real hazard data. Ingestion runs automatically every hour via the built-in scheduler.

## Production Builds

```bash
cd client
npm run build     # → outputs to client/dist/
npm run preview   # serve the built bundle locally → http://localhost:4173
```

Vite loads env files **by mode** — the dev server and the build do not share config:

| Command | Vite mode | Env file read |
|---------|-----------|---------------|
| `npm run dev` | development | `client/.env.development` |
| `npm run build` | production | `client/.env.production.local` |

`.env.development` is **not** read by `npm run build`. Before building, create `client/.env.production.local` (gitignored via `*.local`) with the same unquoted values — otherwise the bundle ships with no API base URL and no Firebase config, and push notifications silently disable themselves:

```bash
# client/.env.production.local
VITE_API_BASE_URL=http://localhost:3000
VITE_USE_MOCKS=false
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BNbx...
```

**Deploying to a host** (Vercel, Netlify, ...)? Skip the local file — set the `VITE_*` variables in the host's environment settings and they are injected at build time. After deploying, add the live domain to the Firebase API key's HTTP referrer restrictions in Google Cloud Console.

> `dist/` is gitignored build output — deploy it to a host, never commit it.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | Environment mode |
| `MONGODB_URI` | No | `mongodb://localhost:27017/smogsense` | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `smogsense` | Database name |
| `DNS_SERVERS` | No | `8.8.8.8,1.1.1.1` | DNS resolvers for `mongodb+srv://` (Atlas) SRV lookups; set empty to use the system resolver |
| `GROQ_API_KEY` | No | _(empty)_ | Groq API key for LLM explanations |
| `GROQ_MODEL` | No | `openai/gpt-oss-20b` | Groq model name |
| `OPENAQ_API_KEY` | No | _(empty)_ | OpenAQ API key (improves rate limits) |
| `READING_FRESHNESS_MS` | No | `10800000` (3 h) | How recent a reading must be to be usable — OpenAQ station readings are commonly 1–2 h delayed |
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
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | For push | _(empty)_ | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | For push | _(empty)_ | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | For push | _(empty)_ | Firebase VAPID key for web push |

> Firebase variables are only required when push notifications are enabled. The app functions without them (hazard dashboard, profiles, route check all work independently).
>
> **Which file gets loaded:** `npm run dev` reads `.env.development`; `npm run build` reads `.env.production.local` (see [Production Builds](#production-builds)). Neither file is committed — both are gitignored.

## Scheduled Jobs

- **Startup ingestion** — on boot, one ingestion runs in the background unless one has already run since the last hourly cron slot, so a restart never serves hours-old data while upstream has newer readings
- **Hourly ingestion** — fetches PM2.5 from OpenAQ + CAMS from Open-Meteo + weather, persists to MongoDB
- **Alert evaluation** — runs after ingestion; checks severity increases, deduplicates, sends Firebase push
- **Daily summary** — morning notification at 6 AM PKT (1 AM UTC)

## API Reference

All responses use a JSON envelope: `{ "success": true, "data": { ... }, "meta": { ... } }`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness probe |
| `/ready` | GET | Readiness probe (MongoDB check) |
| `/hazard-status` | GET | Current hazard band + PM2.5 + recommendation for a location |
| `/route-check` | GET | Compare air quality between two points |
| `/profiles` | POST | Create a household profile |
| `/profiles/:user_id` | GET | List profiles for a user |
| `/profiles/:profile_id` | PATCH | Update a profile |
| `/profiles/:profile_id` | DELETE | Permanently delete a profile |
| `/alerts/register-device` | POST | Register FCM token for push notifications |

**Profile categories:** `adult` · `child` · `elderly` · `pregnant_woman` · `asthma_copd` · `outdoor_worker`

See `.env.example` and the route files in `backend/src/routes/` for full parameter details and response shapes.

## Offline Support

The client caches API responses in `localStorage` for resilience when connectivity is lost.

- **Hazard status & route check:** cached on every successful API response
- **Stale data badge:** when serving cached data, a warning banner shows "Showing cached data" with the last-updated time
- **Offline indicator:** a global amber banner appears when the browser detects loss of connectivity, auto-dismisses with a green "Back online" banner on reconnection
- **Profile editing:** blocked when offline (requires backend sync); the Continue button shows "Offline — cannot add profiles"
- **Cache module:** `client/src/lib/cache.js` — `cacheResponse()`, `getCachedResponse()`, `clearCache()`, `formatCachedTime()`

## Known Limitations

1. **Simplified route model:** Route comparison uses nearest-station PM2.5 for each endpoint, not actual path-based exposure. A real routing engine (e.g., OSRM + per-segment pollution interpolation) would be needed for production-grade route recommendations.

2. **Single-city focus:** The backend is hardcoded for Lahore (bounds, coordinates). Multi-city support would require parameterising the city config.

3. **In-memory recommendation cache:** The Groq explanation cache is process-local and lost on restart. A Redis-backed cache would be needed for multi-instance deployments.

4. **No rate limiting on endpoints:** `express-rate-limit` is installed but not yet configured. Should be added before production deployment.

5. **No authentication:** Endpoints are currently open. JWT or API-key auth should be added for production.

6. **Firebase-only push:** Push notifications use Firebase Cloud Messaging exclusively. Other providers (APNs, web push) would require adapter additions.

7. **Background push is dev-only:** `vite-plugin-pwa` runs in `generateSW` mode, so the production `dist/sw.js` is a plain workbox precache worker. The custom `client/src/sw.js` — whose Firebase handler shows notifications when the app is closed — is only active during `npm run dev`. Switching to `injectManifest` mode would include it in production builds.

## Project Structure

### Backend (`backend/`)

```
backend/src/
├── server.js, app.js, config.js, db.js, logger.js, scheduler.js
├── domain/          # Pure logic: thresholds, severity, confidence, rolling average, route comparison, recommendation keys
├── middleware/       # Error handler, request logger, validators
├── models/          # Mongoose schemas: User, Profile, Reading, Weather, Alert, Route
├── routes/          # Express routes: health, hazardStatus, routeCheck, profiles, alerts
├── services/        # OpenAQ/Open-Meteo adapters, Groq LLM, Firebase push, alert processor
└── jobs/            # Scheduled ingestion
```

### Client (`client/`)

```
client/src/
├── main.jsx, App.jsx, sw.example.js
├── pages/           # Home, ProfileSetup, RouteCheck, AlertDetail, Welcome
├── components/      # AppLayout, HazardCard, BottomNav, NotificationPermission, OfflineBanner, ...
├── api/             # client.js, httpClient.js, transform.js, apiError.js, mockApi.js
├── lib/             # cache, firebase, push, geolocation, geocode, identity, hazard, platform, profiles, storage, utils
└── index.css        # Tailwind v4 + theme tokens
```

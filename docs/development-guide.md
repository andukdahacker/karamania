# Karamania — Development Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 24+ | Server runtime |
| npm | Latest | Package management |
| Flutter SDK | ^3.9.2 | Mobile app |
| Dart SDK | ^3.9.2 | Flutter language |
| Docker | Latest | Local PostgreSQL |
| Xcode | Latest | iOS builds |
| Android Studio | Latest | Android builds |
| Git | Latest | Version control |

## Initial Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd karamania
```

### 2. Server setup

```bash
# Start local PostgreSQL
docker compose up -d

# Install server dependencies
cd apps/server
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your Firebase and API credentials

# Run database migrations
npx kysely migrate:latest

# Generate database types
npm run generate-types

# Start dev server (with hot reload)
npm run dev
```

Server runs at `http://localhost:3000`.

### 3. Flutter app setup

```bash
cd apps/flutter_app

# Install dependencies
flutter pub get

# Create dev dart defines file
cp dart_defines_dev.json.example dart_defines_dev.json
# Edit with your Firebase credentials and SERVER_URL=http://localhost:3000

# Run on connected device/simulator
flutter run --dart-define-from-file=dart_defines_dev.json
```

### 4. Bot participants (for multiplayer testing)

```bash
cd apps/server

# Spawn 5 active bots into a new party
npx tsx bots/manager.ts --bots 5 --party AUTO --behavior active

# Or join a specific party code
npx tsx bots/manager.ts --bots 3 --party ABCD

# Stress test with chaos bots
npx tsx bots/manager.ts --bots 11 --behavior chaos --party AUTO
```

**Bot behavior profiles:**

| Profile | Description | Use Case |
|---------|-------------|----------|
| `passive` | Occasional reactions (~30s) | Baseline participant |
| `active` | Frequent reactions, votes, accepts cards | Normal engaged user |
| `chaos` | Rapid actions (500ms), random disconnects | Stress testing |
| `spectator` | Listen-only, logs events | Debugging |

The bot system eliminates the need for multiple physical devices during local development.

### 5. Web landing (served by server)

The web landing page is served automatically by the server's `web-landing.ts` route from `apps/web_landing/`. No separate setup needed.

## Environment Variables

### Server (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_URL_TEST` | No | Test database URL |
| `JWT_SECRET` | Yes | Min 32 chars, for guest token signing |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `SPOTIFY_CLIENT_ID` | Yes | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app client secret |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase service account private key |
| `FIREBASE_STORAGE_BUCKET` | No | Firebase Storage bucket name |
| `NODE_ENV` | No | development (default) / production / test |
| `PORT` | No | 3000 (default) |
| `SENTRY_DSN` | No | Error tracking |

### Flutter (dart_defines_*.json)

| Variable | Description |
|----------|-------------|
| `SERVER_URL` | Backend API URL |
| `WEB_LANDING_URL` | Web landing page URL |
| `FIREBASE_IOS_API_KEY` | Firebase iOS API key |
| `FIREBASE_IOS_APP_ID` | Firebase iOS app ID |
| `FIREBASE_ANDROID_API_KEY` | Firebase Android API key |
| `FIREBASE_ANDROID_APP_ID` | Firebase Android app ID |
| `FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FIREBASE_IOS_BUNDLE_ID` | iOS bundle identifier |

## Development Commands

### Server

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (tsx --watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run compiled JS (production) |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run generate-types` | Regenerate Kysely types from DB |
| `npx kysely migrate:latest` | Run pending migrations |
| `npx tsx bots/manager.ts --bots N --party CODE` | Spawn bot participants |
| `k6 run k6/party-load.js -e PARTY_CODE=XXXX` | Run party load test (12 VUs, 5 min) |
| `k6 run k6/reaction-throughput.js -e PARTY_CODE=XXXX` | Run reaction stress test |

### Flutter

| Command | Description |
|---------|-------------|
| `flutter run --dart-define-from-file=dart_defines_dev.json` | Run dev build |
| `flutter test` | Run all tests |
| `flutter analyze` | Static analysis |
| `flutter build apk --flavor production --dart-define-from-file=dart_defines_production.json` | Build Android APK |
| `flutter build appbundle --flavor production --dart-define-from-file=dart_defines_production.json` | Build Android AAB |
| `flutter build ios --flavor production --dart-define-from-file=dart_defines_production.json` | Build iOS |

### Docker

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL |
| `docker compose down -v` | Stop + delete data |

## Testing

### Server (Vitest)

90+ test files organized by domain:

**Unit Tests:**
- `tests/routes/` — 12 REST endpoint tests
- `tests/socket-handlers/` — 19 real-time event tests
- `tests/services/` — 35 business logic tests (including 20 session-manager specializations)
- `tests/persistence/` — 5 repository tests
- `tests/dj-engine/` — 4 state machine tests
- `tests/integrations/` — 4 external API tests
- `tests/shared/` — 3 utility tests
- `tests/migrations/` — 1 schema test (real PostgreSQL)
- `tests/factories/` — Test data factory tests

**Integration Tests (real Socket.io + real server):**
- `tests/integration/party-flow.test.ts` — Full party lifecycle (create → join → play → end)
- `tests/integration/socket-lifecycle.test.ts` — Connect/disconnect, reconnection, host transfer
- `tests/integration/auth-upgrade.test.ts` — Guest-to-account upgrade flow

**E2E Tests (multi-bot scenarios):**
- `tests/e2e/party-lifecycle.e2e.test.ts` — Multiple bots, reactions, voting, ceremonies

**Concurrency Tests (race conditions):**
- `tests/concurrency/concurrent-reactions.test.ts` — Simultaneous reactions from multiple users
- `tests/concurrency/concurrent-voting.test.ts` — Simultaneous voting conflicts

**Test Infrastructure:**
- `tests/helpers/bot-client.ts` — Real Socket.io client wrapper with typed event helpers (`waitForEvent()`, `waitForDjState()`, `sendReaction()`, `castQuickPickVote()`)
- `tests/helpers/test-server.ts` — Real Fastify + Socket.io server on random port, with `resetAllServiceState()` for clean isolation
- `tests/helpers/test-db.ts` — Database seeding (`seedUser()`, `seedSession()`, `seedParticipant()`) and cleanup
- `tests/factories/` — Factories for `dj-state`, `session`, `user`, `participant`, `catalog`, `media-capture`

**Patterns:**
- Config and DB mocking in unit test files
- Real server + real Socket.io connections for integration/E2E/concurrency tests
- Bot client system with tracked event buffers for assertions
- Test factories: `createTestUser()`, `createTestSession()`, `createTestParticipant()`, `createTestDJContext()`

### Flutter (flutter_test + mocktail)

~50 test files mirroring `lib/` structure:
- `test/state/` — Provider tests
- `test/screens/` — Screen widget tests
- `test/widgets/` — Widget tests
- `test/audio/` — Audio engine tests
- `test/theme/` — Theme tests
- `test/api/` — API service tests
- `test/routing/` — Deep link tests
- `test/models/` — Model tests
- `test/constants/` — Constants tests
- `test/services/` — Service tests

**Setup:** `AppConfig.initializeForTest(flavor: 'dev')` for test-safe configuration.

## CI/CD

### Server CI (GitHub Actions)

`.github/workflows/server-ci.yml`:
- Triggers on push/PR to `apps/server/**`
- Node 24, PostgreSQL 16 service container
- Steps: npm ci → tsc --noEmit → migrate → test → verify codegen

### Flutter CI (GitHub Actions)

`.github/workflows/flutter-ci.yml`:
- Triggers on push/PR to `apps/flutter_app/**` on main branch
- Flutter 3.32.x (stable channel)
- Steps: flutter pub get → flutter analyze → flutter test
- Caching: Pub dependencies + .dart_tool
- CI environment: Mock Firebase credentials

## Performance Testing (k6)

Load and stress tests for the real-time server using [k6](https://k6.io/):

| Test | VUs | Duration | Target Metrics |
|------|-----|----------|----------------|
| `k6/party-load.js` | 12 | 5 min | Reaction round-trip p95 <200ms, DJ state sync p95 <200ms |
| `k6/reaction-throughput.js` | 12 | 2 min | Broadcast latency p95 <200ms, >50% success rate, <50 WS errors |

```bash
# Requires a running server with an active party
k6 run k6/party-load.js -e PARTY_CODE=ABC123 -e SERVER_URL=http://localhost:3000
k6 run k6/reaction-throughput.js -e PARTY_CODE=ABC123
```

## Deployment

See `SETUP_AND_DEPLOYMENT.md` for comprehensive deployment guide covering:
- Firebase setup (auth, storage, service accounts)
- YouTube & Spotify API keys
- Railway deployment (server + PostgreSQL + web landing)
- Android/iOS signing
- Deep linking configuration
- App store listings

## Code Conventions

### Server
- **TypeScript strict mode** with `noUncheckedIndexedAccess`
- **ESM modules** (`"type": "module"` in package.json)
- **Zod v4** for all validation (REST schemas registered in `globalRegistry` for OpenAPI)
- **Repository pattern** — all DB access in `persistence/` modules
- **Pure functions** in DJ engine (zero side effects)
- **Module-level Maps** for in-memory state (cleaned up via `clearSession()` functions)
- **Fire-and-forget** async for non-critical operations (scoring, event logging)

### Flutter
- **Provider/ChangeNotifier** for state management
- **Singleton pattern** for SocketClient and AudioEngine
- **DJTapButton** for all user interactions (enforces tap tier system)
- **DJTokens** for all styling constants
- **copy.dart** for all user-facing strings
- **Flavor-based configuration** (dev/staging/production)

### Naming
- Server: camelCase files, camelCase exports
- Flutter: snake_case files, PascalCase classes, camelCase methods
- Schemas: camelCase with `Schema` suffix
- Events: `namespace:action` format (e.g., `party:joined`, `dj:stateChanged`)

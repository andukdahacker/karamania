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

### 4. Web landing (served by server)

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

89 test files organized by domain:
- `tests/routes/` — 12 REST endpoint tests
- `tests/socket-handlers/` — 19 real-time event tests
- `tests/services/` — 35 business logic tests
- `tests/persistence/` — 5 repository tests
- `tests/dj-engine/` — 4 state machine tests
- `tests/integrations/` — 4 external API tests
- `tests/shared/` — 3 utility tests
- `tests/migrations/` — 1 schema test (real PostgreSQL)
- `tests/factories/` — Test data factory tests

**Patterns:**
- Config and DB mocking in every test file
- Flexible query chain pattern for Kysely mocking
- Fastify app setup/teardown in route tests
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

### Flutter CI

Not yet configured. Recommended:
- Trigger on `apps/flutter_app/**`
- Steps: flutter analyze → flutter test → flutter build

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

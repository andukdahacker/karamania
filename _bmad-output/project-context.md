---
project_name: 'karaoke-party-app'
user_name: 'Ducdo'
date: '2026-04-02'
status: 'complete'
sections_completed: ['technology_stack', 'audio_intelligence_pipeline', 'progressive_feature_unlock', 'testing_rules', 'anti_patterns_and_boundaries', 'pivot_migration_notes']
rule_count: 53
optimized_for_llm: true
---

# Project Context for AI Agents

_Critical rules and patterns for implementing Karamania. Read this before writing any code._

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture.md`

---

## Technology Stack

**Non-obvious constraints only** (check `package.json` and `pubspec.yaml` for full deps):

- **Fastify 5 + Socket.io 4:** `fastify-socket.io` does NOT support Fastify 5. Manual integration only:
  ```typescript
  const fastify = Fastify();
  const io = new Server(fastify.server);
  ```
- **Zod validation:** `fastify-type-provider-zod` v6.1.0 (Fastify 5 compatible)
- **TypeScript:** strict mode, ESM, `noUncheckedIndexedAccess: true`
- **Type generation:** Zod -> `@fastify/swagger` -> OpenAPI -> `dart-open-fetch` -> Dart types
- **dart-open-fetch:** CLI tool that generates typed Dart HTTP clients from OpenAPI spec. Installed from git: `dart pub global activate --source path <local-clone>/packages/dart_open_fetch`. Runtime dep: `dart_open_fetch_runtime` (git ref in pubspec.yaml)
- **DB types:** `kysely-codegen` auto-generates from live schema. `db/types.ts` is DO NOT EDIT
- **Guest JWT:** `jose` library (not jsonwebtoken). Server-signed, same shape as Firebase JWT
- **ACRCloud audio fingerprinting:** `flutter_acrcloud` SDK on client, server-side proxy for web fallback. Periodic 5-10s audio capture bursts every 30s (NOT continuous). Rate limit: ~360 calls/3hr session. Go/No-Go gate: >60% recognition accuracy in real karaoke rooms before committing to full implementation
- **LRCLIB lyrics API:** Free community API, no auth required. Returns LRC-format synced lyrics. Coverage gaps for obscure/Vietnamese songs — graceful "no lyrics" state required. Future upgrade path: Musixmatch commercial API
- **Microphone permission:** `RECORD_AUDIO` required for audio fingerprinting. Request at runtime, handle denial gracefully (→ manual song search fallback via FR120)
- **Battery budget:** <12% drain/hr with periodic audio capture. Acquire/release mic session — NEVER always-on

---

## Core Principle

**Server-authoritative architecture.** ALL game state lives on the server. Flutter is a thin display layer that sends user actions and renders server state. No game logic in Dart.

---

## Project Structure

Monorepo: `apps/flutter_app/`, `apps/server/`, `apps/web_landing/`. No monorepo tool.

### Server Boundaries (ENFORCED)

- `dj-engine/` -- **ZERO imports** from persistence, integrations, or socket-handlers. Pure logic only
- `audio-intelligence/` -- **ZERO imports** from persistence, integrations, or socket-handlers. Pure logic only (same boundary as `dj-engine/`)
- `persistence/` -- **ONLY** layer that imports from `db/`. No raw Kysely elsewhere
- `services/session-manager.ts` -- **ONLY** service that orchestrates across layers
- `socket-handlers/` -- Call services and dj-engine. **NEVER** call persistence directly
- `routes/` -- Call persistence directly (simple CRUD) and services for business logic

### Flutter Boundaries (ENFORCED)

- Providers are **read-only** from widgets (`context.watch<T>()`)
- **ONLY** `SocketClient` calls mutation methods on providers
- No widget creates its own socket listener
- No business logic in providers -- reactive state containers only
- No provider-to-provider access
- New providers needed for pivot: `LyricsProvider`, `DetectionProvider`, `UnlockProvider`, `LightShowProvider` — same rules apply

---

## Database Schema (MVP)

| Table | Key Columns |
|-------|-------------|
| `users` | `id`, `firebase_uid`, `display_name`, `avatar_url`, `created_at` |
| `sessions` | `id`, `host_user_id`, `party_code`, `status`, `dj_state` (JSONB), `event_stream` (JSONB), `vibe`, `venue_name`, `created_at`, `ended_at` |
| `session_participants` | `session_id`, `user_id`, `guest_name`, `participation_score`, `top_award`, `feedback_score`, `joined_at` |
| `media_captures` | `id`, `session_id`, `user_id`, `storage_path`, `trigger_type`, `dj_state_at_capture`, `created_at` |
| `karaoke_catalog` | `id`, `song_title`, `artist`, `youtube_video_id`, `channel`, `created_at`, `updated_at` |
| `lyrics_cache` | `id`, `isrc`, `title_artist_hash`, `lrc_content` (TEXT), `source` (enum: lrclib/musixmatch), `duration_ms`, `chant_lines` (JSONB), `fetched_at` |
| `detection_events` | `id`, `session_id`, `detected_at`, `song_title`, `artist`, `isrc`, `confidence`, `time_offset_ms`, `source` (enum: acr/manual/lounge) |
| `user_layer_state` | `session_id`, `user_id`, `songs_heard`, `current_layer` (enum: base/interaction/social), `layer_changed_at` |

All columns `snake_case`. Kysely types match DB exactly. Conversion to `camelCase` happens **ONCE** at the boundary (Zod schemas for REST, Socket.io event emission).

---

## Socket.io Event Catalog

| Namespace | Events | Direction |
|-----------|--------|-----------|
| `party` | `party:created`, `party:joined`, `party:ended`, `party:participantDisconnected`, `party:participantReconnected`, `party:hostTransferred` | Bidirectional |
| `dj` | `dj:stateChanged`, `dj:pause`, `dj:resume` | Server -> Client |
| `ceremony` | `ceremony:anticipation`, `ceremony:reveal`, `ceremony:quick` | Server -> Client |
| `reaction` | `reaction:sent`, `reaction:broadcast`, `reaction:streak` | Bidirectional |
| `sound` | `sound:play` | Bidirectional |
| `card` | `card:dealt`, `card:accepted`, `card:dismissed`, `card:redraw` | Bidirectional |
| `song` | `song:detected`, `song:queued`, `song:quickpick`, `song:spinwheel` | Bidirectional |
| `capture` | `capture:bubble`, `capture:started`, `capture:complete` | Bidirectional |
| `tv` | `tv:pair`, `tv:unpair`, `tv:status`, `tv:nowPlaying` | Bidirectional |
| `host` | `host:skip`, `host:override`, `host:songOver` | Client -> Server |
| `auth` | `auth:refreshRequired`, `auth:invalid` | Server -> Client |
| `detect` | `detect:result` (C→S), `detect:status`, `detect:songChanged` | Bidirectional |
| `lyrics` | `lyrics:synced`, `lyrics:unavailable` | Server -> Client |
| `light` | `light:intensity` | Server -> Client |
| `unlock` | `unlock:layerChanged` | Server -> Client |

Handler pattern: one file per namespace in `socket-handlers/`. Each exports `registerXHandlers(socket, session)`.

---

## Critical Implementation Rules

### Data Layer Casing

- DB columns + Kysely types + TypeScript services/persistence: `snake_case`
- Conversion to `camelCase` at boundary ONCE: Zod `.transform()` for REST, event emission for Socket.io
- Dart types: `camelCase` (dart-open-fetch generates this)

### Naming Conventions

- **TS files:** `kebab-case.ts`. **Dart files:** `snake_case.dart`
- **Types/Classes:** `PascalCase`. **Functions:** `camelCase`. **Constants:** `UPPER_SNAKE_CASE` (TS) / `camelCase` (Dart)
- **Zod schemas:** `camelCaseSchema` suffix
- **Widget keys:** `Key('kebab-case-descriptor')`
- **Socket.io events:** `namespace:action` -- always colon-separated

### Import Rules

- **Server:** relative imports only, include `.js` extension. No tsconfig aliases
- **Flutter:** `package:karamania/...` for cross-directory imports
- **NO barrel files** -- import directly from specific files

### State Persistence

- **Full persistence model**: DJ state written to PostgreSQL JSONB on EVERY state transition (fire-and-forget async)
- In-memory is hot cache, PostgreSQL is source of truth
- This supersedes PRD NFR13 ("deferred to v2")
- Event stream: in-memory array during session, batch write at session end

### Auth Pattern

- One middleware handles both Firebase JWT and server-signed guest JWT
- Both paths produce identical `socket.data` shape
- Auth status affects persistence only, never in-party capabilities

### Error Handling

- REST: `{ data: {...} }` or `{ error: { code: 'ERROR_CODE', message: '...' } }`
- Socket.io: payloads are direct objects (NOT wrapped)
- All errors use `AppError` type from `shared/errors.ts`
- `async/await` everywhere -- no `.then()` chains in TypeScript or Dart

### Rate Limiting

- Pure function in `services/rate-limiter.ts` -- no Socket.io dependency
- No hard blocks -- rewards diminish. Called for all user-action events

### Flutter Loading State

Every async operation uses this enum -- no custom patterns:
```dart
enum LoadingState { idle, loading, success, error }
```
Per-operation, not global (e.g., `playlistImportState`, not `isLoading`).

### Audio Intelligence Pipeline

**Pipeline flow:** Client audio capture → ACRCloud fingerprint → server `song:detected` → LRCLIB lyrics fetch → cache in `lyrics_cache` → broadcast `lyrics:synced` → chant detection → `light:intensity` broadcast

**Server-side rules:**
- `audio-intelligence/` module — new top-level server module alongside `dj-engine/`, `services/`, etc.
- Chant detection is a **pure function** on LRC data (server-side). Identifies repeated chorus lines with >70% precision target (NFR47). Output stored as `chant_lines` JSONB in `lyrics_cache`
- Light show energy mapping computed server-side from LRC timestamps. Broadcast as `light:intensity` events. Clients render locally at 60fps
- Lyrics fetch is **fire-and-forget async** — same pattern as DJ state persistence. Display does NOT wait for cache write
- Detection source abstraction: unified `SongContext` interface behind ACRCloud (primary), YouTube Lounge API (optional), and manual search (fallback)

**Client-side rules:**
- `flutter_acrcloud` SDK handles audio capture + fingerprint in one call
- Mic session: acquire before capture burst, release after. NEVER hold mic open between bursts
- LyricsDisplayWidget renders synced LRC with current-line highlighting
- LightShowEngine takes `light:intensity` events and renders screen color animation at 60fps
- All lyrics UI gracefully degrades to "no lyrics" state (NFR45) — never show errors or empty screens

**Boundary enforcement:**
- `audio-intelligence/` has ZERO imports from `persistence/` or `socket-handlers/` (same boundary as `dj-engine/`)
- Chant detection, energy mapping, and lyrics parsing are **pure functions** — unit-testable with no dependencies

### Progressive Feature Unlock

**Three layers, server-authoritative:**

| Layer | Trigger | Features Available |
|-------|---------|-------------------|
| **Base** (songs 1-2) | Join party | Synced lyrics, chant highlights, reactive light show, reactions |
| **Interaction** (songs 3-4) | 3rd song detected for user | Guess The Next Line, duet colors, soundboard |
| **Social** (songs 5+) | 5th song detected for user | Party cards, interludes (except Quick Vote), hype signals |

**Implementation rules:**
- `user_layer_state` table tracks per-user song count and current layer
- DJ engine transition guards check layer state BEFORE dealing cards, starting interludes, or activating games
- Quick Vote remains universal (single-tap, no spotlight) — available in all layers
- Icebreaker unchanged — pre-song activity, not layer-gated
- Late joiners get accelerated ramp-up (exact rules TBD in Story 13.5)
- Layer state persists across reconnects and server restarts (stored in PostgreSQL, reconstructed on recovery)
- `unlock:layerChanged` event broadcast when a user's layer advances — client uses this to reveal new UI elements with transition animation

**"No competition" principle (codified):**
- ZERO scoring, leaderboards, or points anywhere in the app
- Participation score is internal/server-only for award selection — never displayed to users
- Awards are celebratory, not competitive — "Most Enthusiastic" not "1st Place"

---

## Testing Rules

- **Server:** `apps/server/tests/` mirrors `src/`. Run: `npm test`
- **Flutter:** `apps/flutter_app/test/` mirrors `lib/`. Run: `flutter test`
- **DJ engine (`dj-engine/`): 100% unit test coverage required** -- all states, transitions, guards, timers, serialization round-trips
- **Audio intelligence (`audio-intelligence/`): 100% unit test coverage required** — same standard as `dj-engine/`. All pure functions: chant detection, energy mapping, LRC parsing, detection source abstraction
- **Progressive unlock state machine: 100% unit test coverage** — layer transitions, song counting, late joiner ramp-up, edge cases (reconnect mid-song, server restart)
- **Shared factories:** `tests/factories/` -- one per domain object. No inline test data
- **DB tests:** transaction per test, rolled back after completion
- **Integration/E2E tests:** Use real server (`tests/helpers/test-server.ts`) + real Socket.io connections (`tests/helpers/bot-client.ts`) + real DB (`tests/helpers/test-db.ts`). Never mock Socket.io for integration tests.
- **Concurrency tests:** Validate race conditions with parallel bot actions (e.g., 12 simultaneous voters)
- **DO NOT test:** animations, visual effects, confetti, color values, transition timings, light show animations, lyrics scroll smoothness, chant overlay visuals, 60fps rendering
- **DO test:** state transitions, data flow, event handling, serialization, pure logic, LRC parsing correctness, chant line identification, energy map computation, layer gating logic, detection fallback chain (ACRCloud → manual search)
- **New test factories needed:** `createTestLyricsCache()`, `createTestDetectionEvent()`, `createTestUserLayerState()`
- **CI:** Server CI (GitHub Actions, Node 24 + PostgreSQL 16) + Flutter CI (GitHub Actions, Flutter 3.32)

---

## Anti-Patterns (NEVER DO THESE)

| Wrong | Right |
|-------|-------|
| `socket.on('ceremonyReveal', ...)` | `socket.on('ceremony:reveal', ...)` |
| `{ error: "Something went wrong" }` | `{ error: { code: 'INTERNAL_ERROR', message: '...' } }` |
| `setState(() { djState = newState; })` | `context.watch<PartyProvider>().djState` |
| `apps/server/src/helpers/utils.ts` | Put in the specific module that uses it |
| `import { thing } from '@/services/thing'` | `import { thing } from '../services/thing.js'` |
| Barrel file `export { } from './sub-module'` | Import directly from the file |
| `.then((result) => { ... }).catch(...)` | `const result = await ...; try/catch` |
| `generateRandomAward()` (convincing fake) | `// TODO: Replace with award-generator.ts` |
| Inline test data `{ id: '1', name: 'test' }` | `createTestSession({ id: '1' })` |
| `Padding(padding: EdgeInsets.all(16))` | `Padding(padding: EdgeInsets.all(DJTokens.spaceMd))` |
| `Color(0xFF6C63FF)` in a widget | `DJTokens.actionPrimary` or vibe provider |
| Hardcoded strings in Flutter widgets | All copy in `constants/copy.dart` |
| Always-on microphone for audio capture | Acquire/release mic per 5-10s burst. NEVER hold open between 30s intervals |
| Chant detection on client (Flutter) | Chant detection is server-side pure function on LRC data. Client only renders results |
| Computing light show energy in Flutter | Server computes energy map from LRC timestamps, broadcasts `light:intensity`. Client only renders |
| Showing error screen when no lyrics found | Graceful "no lyrics" state with ambient visuals. Never error UI |
| Checking progressive unlock in widgets | Layer state comes from provider via `unlock:layerChanged` events. Widgets read, never compute |
| `lightstick` anything | Lightstick mode REMOVED. Replaced by reactive light show (FR136-139) |

---

## Development Workflow

### Type Generation Pipeline

1. Write Kysely migration -> `kysely-ctl migrate` -> `kysely-codegen` updates `db/types.ts`
2. Update Zod schemas in `shared/schemas/`
3. **Register schemas in `z.globalRegistry`** so they emit as `$ref` components in OpenAPI:
   ```typescript
   z.globalRegistry.add(mySchema, { id: 'MySchemaName' });
   ```
4. Add `response` schemas to route definitions (not just `body`)
5. Run server -> `@fastify/swagger` generates OpenAPI at `http://localhost:3000/openapi.json`
6. Run dart-open-fetch to generate Dart types:
   ```bash
   dart_open_fetch generate \
     --source http://localhost:3000/openapi.json \
     --output apps/flutter_app/lib/api/generated \
     --client-name KaramaniaApiClient
   ```
7. Generated output: `api/generated/models.dart` (typed models), `api/generated/clients/karamania_api_client.dart` (typed HTTP client), `api/generated/karamania_api.dart` (barrel)

**Schema registration pattern (required for `$ref`):**
- All Zod schemas in `shared/schemas/` must register with `z.globalRegistry.add(schema, { id: 'Name' })`
- Import schema files in `index.ts` BEFORE swagger init: `await import('./shared/schemas/auth-schemas.js')`
- Swagger config requires both `transform: jsonSchemaTransform` and `transformObject: jsonSchemaTransformObject`

**Known dart-open-fetch v0.1.0 limitations:**
- Nested inline objects generate as `Map<String, dynamic>` (not typed classes)
- Input/Output model duplication (`FooInput` + `Foo` for same schema)
- Enum fields generate as `String`
- See `~/Desktop/code/dart-open-fetch-improvements.md` for planned fixes

### Local Development Setup

```bash
# 1. Start PostgreSQL
docker compose up -d          # from repo root — postgres:16-alpine on port 5432

# 2. Run migrations
cd apps/server && npx kysely-ctl migrate

# 3. Start server (serves OpenAPI at /openapi.json)
cd apps/server && npx tsx --watch src/index.ts

# 4. Regenerate Dart types (requires server running)
dart_open_fetch generate \
  --source http://localhost:3000/openapi.json \
  --output apps/flutter_app/lib/api/generated \
  --client-name KaramaniaApiClient

# 5. Run Flutter
cd apps/flutter_app && flutter run --dart-define-from-file=dart_defines_local.json

# 6. Spawn bot participants (for multiplayer testing)
cd apps/server && npx tsx bots/manager.ts --bots 5 --party AUTO --behavior active
```

Firebase Admin SDK gracefully skips initialization in development mode (placeholder credentials in `.env` are fine for local dev without Firebase features).

### Bot System (Local Dev + Testing)

The bot system (`apps/server/bots/`) simulates multiple party participants without physical devices:

- **manager.ts** — CLI to spawn N bots: `npx tsx bots/manager.ts --bots 5 --party AUTO [--behavior active] [--server URL]`
- **bot-behaviors.ts** — 4 profiles: `passive` (~30s reactions), `active` (~5s + voting), `chaos` (500ms spam + disconnects), `spectator` (logging only)
- `--party AUTO` finds an active party or creates one; `--party XXXX` joins a specific code

### Test Infrastructure

**Integration/E2E tests** use real Socket.io connections (not mocks):
- `tests/helpers/bot-client.ts` — Real Socket.io client with typed helpers (`waitForEvent()`, `waitForDjState()`, `sendReaction()`, `castQuickPickVote()`)
- `tests/helpers/test-server.ts` — Real Fastify + Socket.io server on random port, `resetAllServiceState()` for clean isolation
- `tests/helpers/test-db.ts` — DB seeding (`seedUser()`, `seedSession()`, `seedParticipant()`) and cleanup

**Test levels:**
- Unit tests (~80 files) — Mocked services/DB
- Integration tests (3 files) — Real server + real sockets: party flow, socket lifecycle, auth upgrade
- E2E tests (1 file) — Multi-bot party lifecycle scenarios
- Concurrency tests (2 files) — Race conditions: simultaneous reactions, simultaneous voting

**Performance tests** (`k6/`):
- `party-load.js` — 12 VUs, 5 min, p95 <200ms target
- `reaction-throughput.js` — 12 VUs, 2 min, broadcast latency stress test
- Usage: `k6 run k6/party-load.js -e PARTY_CODE=XXXX`

### Commands

- Server dev: `cd apps/server && npx tsx --watch src/index.ts`
- Flutter dev: `cd apps/flutter_app && flutter run --dart-define-from-file=dart_defines_local.json`
- Server tests: `cd apps/server && npm test`
- Flutter tests: `cd apps/flutter_app && flutter test`
- Spawn bots: `cd apps/server && npx tsx bots/manager.ts --bots 5 --party AUTO --behavior active`
- k6 load test: `k6 run apps/server/k6/party-load.js -e PARTY_CODE=XXXX`
- Dart type generation: `dart_open_fetch generate --source http://localhost:3000/openapi.json --output apps/flutter_app/lib/api/generated --client-name KaramaniaApiClient`
- Docker postgres: `docker compose up -d` (from repo root)
- Server deploy: Railway auto-deploy on push to `main`

---

## Pivot Migration Notes (2026-04-02)

**Removed — Lightstick Mode:**
- Delete `apps/flutter_app/lib/widgets/lightstick_mode.dart`
- Delete `apps/server/src/socket-handlers/lightstick-handlers.ts`
- Remove FR63 (lightstick toggle), FR64 (lightstick glow) references
- FR66 revised: "Hype signal available alongside reactions and the reactive light show"

**Replaced by — Reactive Phone Light Show (FR136-139):**
- Automatic, music-synced, zero user interaction required
- Driven by `light:intensity` server events, not local toggle

**Detection source change:**
- ACRCloud is **primary** song detection (was YouTube Lounge API)
- YouTube Lounge API demoted to optional/secondary
- `song-detection.ts` needs refactoring to use `SongContext` interface with ACRCloud as primary source

**New server module:**
- `audio-intelligence/` — LRC parser, chant detector, energy mapper, detection source abstraction
- Follows `dj-engine/` boundary pattern (pure logic, zero external imports)

---

## Usage

- Read this file before implementing any story
- Follow ALL rules exactly as documented
- For deeper context on any decision, read the full architecture doc
- Update this file when patterns change during implementation

Last Updated: 2026-04-02

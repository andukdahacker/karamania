---
project_name: 'karaoke-party-app'
user_name: 'Ducdo'
date: '2026-03-08'
status: 'complete'
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

---

## Core Principle

**Server-authoritative architecture.** ALL game state lives on the server. Flutter is a thin display layer that sends user actions and renders server state. No game logic in Dart.

---

## Project Structure

Monorepo: `apps/flutter_app/`, `apps/server/`, `apps/web_landing/`. No monorepo tool.

### Server Boundaries (ENFORCED)

- `dj-engine/` -- **ZERO imports** from persistence, integrations, or socket-handlers. Pure logic only
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

---

## Database Schema (MVP)

| Table | Key Columns |
|-------|-------------|
| `users` | `id`, `firebase_uid`, `display_name`, `avatar_url`, `created_at` |
| `sessions` | `id`, `host_user_id`, `party_code`, `status`, `dj_state` (JSONB), `event_stream` (JSONB), `vibe`, `venue_name`, `created_at`, `ended_at` |
| `session_participants` | `session_id`, `user_id`, `guest_name`, `participation_score`, `top_award`, `feedback_score`, `joined_at` |
| `media_captures` | `id`, `session_id`, `user_id`, `storage_path`, `trigger_type`, `dj_state_at_capture`, `created_at` |
| `karaoke_catalog` | `id`, `song_title`, `artist`, `youtube_video_id`, `channel`, `created_at`, `updated_at` |

All columns `snake_case`. Kysely types match DB exactly. Conversion to `camelCase` happens **ONCE** at the boundary (Zod schemas for REST, Socket.io event emission).

---

## Socket.io Event Catalog

| Namespace | Events | Direction |
|-----------|--------|-----------|
| `party` | `party:created`, `party:joined`, `party:ended` | Bidirectional |
| `dj` | `dj:stateChanged`, `dj:pause`, `dj:resume` | Server -> Client |
| `ceremony` | `ceremony:anticipation`, `ceremony:reveal`, `ceremony:quick` | Server -> Client |
| `reaction` | `reaction:sent`, `reaction:broadcast`, `reaction:streak` | Bidirectional |
| `sound` | `sound:play` | Bidirectional |
| `card` | `card:dealt`, `card:accepted`, `card:dismissed`, `card:redraw` | Bidirectional |
| `song` | `song:detected`, `song:queued`, `song:quickpick`, `song:spinwheel` | Bidirectional |
| `capture` | `capture:bubble`, `capture:started`, `capture:complete` | Bidirectional |
| `host` | `host:skip`, `host:override`, `host:songOver` | Client -> Server |
| `auth` | `auth:refreshRequired`, `auth:invalid` | Server -> Client |

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

---

## Testing Rules

- **Server:** `apps/server/tests/` mirrors `src/`. Run: `npm test`
- **Flutter:** `apps/flutter_app/test/` mirrors `lib/`. Run: `flutter test`
- **DJ engine (`dj-engine/`): 100% unit test coverage required** -- all states, transitions, guards, timers, serialization round-trips
- **Shared factories:** `tests/factories/` -- one per domain object. No inline test data
- **DB tests:** transaction per test, rolled back after completion
- **DO NOT test:** animations, visual effects, confetti, color values, transition timings
- **DO test:** state transitions, data flow, event handling, serialization, pure logic

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
```

Firebase Admin SDK gracefully skips initialization in development mode (placeholder credentials in `.env` are fine for local dev without Firebase features).

### Commands

- Server dev: `cd apps/server && npx tsx --watch src/index.ts`
- Flutter dev: `cd apps/flutter_app && flutter run --dart-define-from-file=dart_defines_local.json`
- Server tests: `cd apps/server && npm test`
- Flutter tests: `cd apps/flutter_app && flutter test`
- Dart type generation: `dart_open_fetch generate --source http://localhost:3000/openapi.json --output apps/flutter_app/lib/api/generated --client-name KaramaniaApiClient`
- Docker postgres: `docker compose up -d` (from repo root)
- Server deploy: Railway auto-deploy on push to `main`

---

## Usage

- Read this file before implementing any story
- Follow ALL rules exactly as documented
- For deeper context on any decision, read the full architecture doc
- Update this file when patterns change during implementation

Last Updated: 2026-03-08

# Story 1.2: Server Foundation & Database Schema

Status: done

## Story

As a developer,
I want a production-ready server with database connectivity and initial schema,
so that all backend features have a solid foundation to build on.

## Acceptance Criteria

1. Given the server project is initialized in `apps/server/` with Fastify 5 + TypeScript strict ESM
   When the server starts
   Then it connects to PostgreSQL via Kysely and runs migrations for all 5 MVP tables (`users`, `sessions`, `session_participants`, `media_captures`, `karaoke_catalog`) matching the architecture schema

2. Given the server is running
   When any request is processed
   Then Pino structured logging is configured for all request/response cycles

3. Given the server environment
   When the server starts
   Then environment variables are loaded and validated (`DATABASE_URL`, `JWT_SECRET`, `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, Firebase credentials)

4. Given the server is running
   When a GET request is made to `/health`
   Then it returns server status and database connectivity check result

5. Given the server routes
   When Zod schemas are applied
   Then `fastify-type-provider-zod` v6.1.0 is configured as the type provider

6. Given the server project
   When the directory structure is inspected
   Then it follows the architecture: `src/{db,dj-engine,socket-handlers,integrations,services,persistence,routes,shared/{errors.ts,events.ts,schemas/}}`, `migrations/`, `scripts/`, `tests/`

7. Given the database schema is applied
   When `kysely-codegen` runs against the live schema
   Then it generates `db/types.ts` from live schema (DO NOT EDIT file)

8. Given the REST API
   When any endpoint returns a response
   Then responses follow `{ data: {...} }` or `{ error: { code, message } }` wrapping

9. Given the CI configuration
   When code is pushed
   Then GitHub Actions CI pipeline (`server-ci.yml`) runs Vitest + kysely-codegen type check

10. Given the codebase
    When file naming is inspected
    Then all file names use `kebab-case.ts` convention

11. Given the codebase
    When imports are inspected
    Then imports use relative paths with `.js` extension, no barrel files, no tsconfig aliases

## Tasks / Subtasks

- [x] Task 1: Initialize `apps/server/` project (AC: #1, #6, #10, #11)
  - [x] 1.1: `npm init` with ESM (`"type": "module"` in package.json)
  - [x] 1.2: Install production dependencies: `fastify@5`, `socket.io@4`, `kysely`, `pg`, `jose`, `zod`, `@fastify/swagger`, `fastify-type-provider-zod@6.1.0`, `@fastify/cors`, `dotenv`
  - [x] 1.3: Install dev dependencies: `typescript`, `@types/node`, `tsx`, `vitest`, `kysely-codegen`, `kysely-ctl`, `@types/pg`
  - [x] 1.4: Configure `tsconfig.json` with `strict: true`, ESM modules (`"module": "NodeNext"`, `"moduleResolution": "NodeNext"`), `noUncheckedIndexedAccess: true`, target ES2022+
  - [x] 1.5: Create full directory structure per architecture spec (see Dev Notes for complete list)
  - [x] 1.6: Add npm scripts: `dev`, `build`, `start`, `test`, `generate-types`

- [x] Task 2: Create entry point and config (AC: #2, #3)
  - [x] 2.1: Create `src/config.ts` — load and validate ALL env vars with Zod schema, fail fast on missing required vars. Load `dotenv` conditionally: only when `NODE_ENV !== 'production'` (Railway injects env vars directly)
  - [x] 2.2: Create `src/index.ts` — Fastify 5 setup with Pino logging (built-in, do NOT install `pino` separately), Zod type provider, CORS, Socket.io manual attach (`new Server(fastify.server)`), graceful shutdown (see shutdown pattern in Dev Notes)
  - [x] 2.3: Create `.env.example` with all required environment variables documented (include `DATABASE_URL_TEST` and `SENTRY_DSN` as placeholders)

- [x] Task 3: Database connection and migrations (AC: #1, #7)
  - [x] 3.1: Create `src/db/connection.ts` — Kysely instance with PostgreSQL dialect, connection pool (see code pattern in Dev Notes)
  - [x] 3.2: Create `kysely.config.ts` — Kysely CLI configuration (see code pattern in Dev Notes)
  - [x] 3.3: Create `migrations/001-initial-schema.ts` with `up` and `down` functions for **5 tables**:
    - `users`: `id` (UUID, PK, default gen_random_uuid()), `firebase_uid` (text, unique, nullable), `display_name` (text, not null), `avatar_url` (text, nullable), `created_at` (timestamptz, default now())
    - `sessions`: `id` (UUID, PK, default gen_random_uuid()), `host_user_id` (UUID, FK to users), `party_code` (varchar(6) — supports alphanumeric codes like 'VIBE'), `status` (text, default 'lobby', CHECK IN ('lobby', 'active', 'paused', 'ended')), `dj_state` (jsonb, nullable), `event_stream` (jsonb, nullable), `vibe` (text, nullable), `venue_name` (text, nullable), `created_at` (timestamptz, default now()), `ended_at` (timestamptz, nullable)
    - `session_participants`: `id` (UUID, PK, default gen_random_uuid()), `session_id` (UUID, FK to sessions, not null), `user_id` (UUID, FK to users, nullable — guests may not have user record), `guest_name` (text, nullable), `participation_score` (integer, default 0), `top_award` (text, nullable), `feedback_score` (smallint, nullable, CHECK between 1-5), `joined_at` (timestamptz, default now()). Add unique constraint: `UNIQUE(session_id, COALESCE(user_id::text, guest_name))` to prevent duplicate participants
    - `media_captures`: `id` (UUID, PK, default gen_random_uuid()), `session_id` (UUID, FK to sessions, not null), `user_id` (UUID, FK to users, nullable), `storage_path` (text, not null), `trigger_type` (text, not null), `dj_state_at_capture` (jsonb, nullable), `created_at` (timestamptz, default now())
    - `karaoke_catalog`: `id` (UUID, PK, default gen_random_uuid()), `song_title` (text, not null), `artist` (text, not null), `youtube_video_id` (text, unique, not null), `channel` (text, nullable), `is_classic` (boolean, default false — flags top 200 universally known karaoke songs for cold-start fallback FR91), `created_at` (timestamptz, default now()), `updated_at` (timestamptz, default now())
  - [x] 3.4: Add indexes: `idx_sessions_party_code` on sessions(party_code), `idx_users_firebase_uid` on users(firebase_uid), `idx_session_participants_session_id` on session_participants(session_id), `idx_karaoke_catalog_youtube_video_id` on karaoke_catalog(youtube_video_id)
  - [x] 3.5: Party code uniqueness: add partial unique index `CREATE UNIQUE INDEX idx_sessions_active_party_code ON sessions(party_code) WHERE status != 'ended'` — codes can be reused after session ends
  - [x] 3.6: Placeholder `src/db/types.ts` created with DO NOT EDIT header — `kysely-codegen` will regenerate against live DB

- [x] Task 4: Health check endpoint (AC: #4, #8)
  - [x] 4.1: Create `src/routes/health.ts` — `/health` GET endpoint that checks DB connectivity via `SELECT 1` query
  - [x] 4.2: Return `{ data: { status: "ok", database: "connected", timestamp: "..." } }` on success
  - [x] 4.3: Return `{ error: { code: "DATABASE_UNREACHABLE", message: "..." } }` with 503 on failure
  - [x] 4.4: Register route in `src/index.ts`

- [x] Task 5: Shared modules (AC: #6, #8)
  - [x] 5.1: Create `src/shared/errors.ts` — `AppError` type with `{ code: string, message: string, statusCode?: number }` and error factory functions
  - [x] 5.2: Create Fastify error handler that wraps all errors in `{ error: { code, message } }` format
  - [x] 5.3: Create `src/shared/schemas/common-schemas.ts` — shared response wrapper Zod schemas (`dataResponseSchema`, `errorResponseSchema`). Note: this file is a justified addition not in the architecture's schema listing
  - [x] 5.4: Create `src/shared/events.ts` — Socket.io event name constants skeleton with `namespace:action` naming convention. Placeholder: `// Populated as handlers are implemented in Story 1.3+`

- [x] Task 6: CI pipeline (AC: #9)
  - [x] 6.1: Create `.github/workflows/server-ci.yml` — trigger on push/PR for `apps/server/**` changes
  - [x] 6.2: Steps: checkout, Node.js 24 setup, npm ci, TypeScript type check (`tsc --noEmit`), run migrations against test DB (`kysely-ctl migrate`), Vitest run, kysely-codegen verify (ensure generated types match schema)

- [x] Task 7: Tests (AC: all)
  - [x] 7.1: Create `vitest.config.ts` with coverage configuration
  - [x] 7.2: Create `tests/factories/user.ts` — `createTestUser(overrides?)`
  - [x] 7.3: Create `tests/factories/session.ts` — `createTestSession(overrides?)`
  - [x] 7.4: Create `tests/factories/participant.ts` — `createTestParticipant(overrides?)`
  - [x] 7.5: Create `tests/routes/health.test.ts` — test health endpoint (success + DB failure scenarios)
  - [x] 7.6: Create `tests/config.test.ts` — test config validation (missing vars, valid vars)
  - [x] 7.7: Create `tests/shared/errors.test.ts` — test error factory and error handler
  - [x] 7.8: Create `tests/migrations/001-initial-schema.test.ts` — migration smoke test verifying `up()` and `down()` run successfully against test DB

## Dev Notes

### Architecture Compliance

- **Server-authoritative architecture** — ALL game state lives on server; this story establishes that foundation
- **Component boundaries** are ENFORCED:
  - `dj-engine/` — ZERO imports from persistence, integrations, or socket-handlers (pure logic only)
  - `persistence/` — ONLY layer that imports from `db/`; no raw Kysely queries elsewhere
  - `services/session-manager.ts` — ONLY service that orchestrates across layers
  - `socket-handlers/` — call services and dj-engine, NEVER persistence directly
  - `routes/` — call persistence directly (simple CRUD) and services for business logic
- **This story creates the skeleton only** — most directories will have placeholder README or be empty; future stories fill them
- `routes/health.ts` and `shared/schemas/common-schemas.ts` are justified additions not in the architecture doc's directory listing
- `services/guest-token.ts` and `integrations/firebase-admin.ts` exist in the architecture for Story 1.3 — do NOT create them here
- `tests/factories/dj-state.ts` (`createTestDJState`) exists in the architecture — deferred to Story 2.x when DJ engine is implemented

### Zod Version Compatibility (VERIFY BEFORE INSTALLING)

`@fastify/type-provider-zod@6.1.0` may not support Zod v4. Before installing, check the package's `peerDependencies`:
```bash
npm view @fastify/type-provider-zod@6.1.0 peerDependencies
```
If it requires Zod 3.x, use `zod@3.24.x` instead of `zod@4.x`. The Zod import pattern changed in v4 (`import { z } from 'zod/v4'` vs `from 'zod'`).

### Library Version Verification

Per Story 1.1 learnings: **always verify versions exist before installing**. Run `npm view <package> versions` for niche packages (`kysely-codegen`, `kysely-ctl`). If the specified version doesn't exist, use the latest available.

### Database Schema Notes

- All columns `snake_case` — matches PostgreSQL convention
- Kysely types match DB exactly (generated by `kysely-codegen`)
- Conversion to `camelCase` happens ONCE at the boundary (Zod `.transform()` for REST, event emission for Socket.io) — NOT in this story
- UUIDs for all `id` columns using PostgreSQL `gen_random_uuid()`
- `dj_state` column is JSONB — stores full DJ state machine snapshot, written on every state transition (fire-and-forget async)
- `event_stream` column is JSONB — stores session event array, batch-written at session end
- `session_participants` uses generated UUID PK with `UNIQUE(session_id, COALESCE(user_id::text, guest_name))` constraint — handles both authenticated users and guests without nullable composite key issues
- `party_code` is `varchar(6)` to support alphanumeric codes (architecture test factory uses `'VIBE'`, not just digits)
- `sessions.status` has CHECK constraint limiting to `'lobby'`, `'active'`, `'paused'`, `'ended'`
- Party code uniqueness enforced via partial unique index on active sessions only — codes can be reused after session ends

### Socket.io Integration

`fastify-socket.io` does NOT support Fastify 5 — manual integration required:
```typescript
import Fastify from 'fastify';
import { Server } from 'socket.io';
const fastify = Fastify({ logger: true }); // Pino is built-in, do NOT install pino separately
const io = new Server(fastify.server);
```
Socket.io is set up in this story but no event handlers are registered — that's Story 1.3. The `io` instance should be accessible to route handlers and services (attach to fastify via decoration or export).

### Config Validation Pattern

```typescript
// src/config.ts
import { z } from 'zod'; // Use 'zod/v4' if Zod v4, 'zod' if v3 — see compatibility note above
import 'dotenv/config'; // Only loads .env in local dev; Railway injects env vars directly

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(), // Test DB, not required in production
  JWT_SECRET: z.string().min(32),
  YOUTUBE_API_KEY: z.string(),
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().optional(), // Sentry integration deferred to future story
});

export type Config = z.infer<typeof envSchema>;
export const config = envSchema.parse(process.env);
```
Firebase Admin SDK (`firebase-admin`) is NOT installed in this story — it's Story 1.3 scope. However, the Firebase env vars are validated here to ensure they're present at startup.

### Kysely Configuration Pattern

```typescript
// kysely.config.ts
import { defineConfig } from 'kysely-ctl';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
  migrations: { migrationFolder: './migrations' },
});
```

### Database Connection Pattern

```typescript
// src/db/connection.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types.js'; // Generated by kysely-codegen — DO NOT EDIT types.ts
import { config } from '../config.js';

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DATABASE_URL,
    max: 10, // Railway default pool size
  }),
});

export const db = new Kysely<Database>({ dialect });
```

### Graceful Shutdown Pattern

```typescript
// In src/index.ts — shutdown sequence matters
const shutdown = async () => {
  io.close();           // 1. Close Socket.io connections first
  await fastify.close(); // 2. Close Fastify (closes HTTP server)
  await db.destroy();    // 3. Close DB connection pool
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Import Pattern (CRITICAL)

```typescript
// CORRECT
import { db } from '../db/connection.js';
import { AppError } from '../shared/errors.js';

// WRONG — no barrel files
import { db } from '../db/index.js';

// WRONG — no tsconfig aliases
import { db } from '@/db/connection';

// WRONG — missing .js extension
import { db } from '../db/connection';
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case.ts | `session-repository.ts`, `rate-limiter.ts` |
| Directories | kebab-case | `dj-engine/`, `socket-handlers/` |
| Types/Interfaces | PascalCase | `AppError`, `Config` |
| Functions | camelCase | `createTestSession`, `checkHealth` |
| Constants | UPPER_SNAKE_CASE | `MAX_PARTICIPANTS`, `HEARTBEAT_INTERVAL_MS` |
| Zod schemas | camelCase + Schema suffix | `healthResponseSchema` |

### Error Handling

- All errors use `AppError` type from `shared/errors.ts`
- Fastify error handler catches and formats ALL unhandled errors into `{ error: { code, message } }`
- `async/await` everywhere — NO `.then()` chains
- Every log entry should include context (`sessionId`, `userId` where available)

### Deferred Items

- **Sentry integration** (`@sentry/node`) — architecture specifies it but deferred to a future story. `SENTRY_DSN` added to `.env.example` as placeholder
- **Firebase Admin SDK** (`firebase-admin`) — Story 1.3 scope. Env vars validated here but package not installed
- **Socket.io event handlers** — Story 1.3 scope. Only `shared/events.ts` skeleton created here

### Previous Story Intelligence (Story 1.1)

**Patterns established that MUST continue:**
- Strict adherence to architecture document conventions
- TODO stubs for unbuilt dependencies (never convincing fakes like `generateRandomAward()`)
- Test factories in shared `tests/factories/` directory — one factory per domain object, no inline test data
- DO NOT test visual effects, animations, or colors — DO test state, data flow, pure logic

**Problems from 1.1 to learn from:**
- SDK/library version mismatches: verify actual latest versions before installing (see version verification note above)
- Test finder APIs: read Vitest docs carefully for assertion patterns
- Always check package `peerDependencies` for compatibility before installing

### Testing Strategy

- **Vitest** as test runner (consistent with ecosystem, fast)
- **Test factories** in `tests/factories/` — `createTestUser()`, `createTestSession()`, `createTestParticipant()`
- Unit tests: config validation, health endpoint, error handler
- Migration smoke test: verify `up()` and `down()` run successfully
- Health endpoint test can mock the DB check
- Database integration tests for persistence layer deferred to Story 1.3+

### CI Notes

- GitHub Actions workflow triggers only on `apps/server/**` changes
- Node.js 24.x per architecture spec (verify if Active LTS or Current as of March 2026)
- Steps: install, type-check, run migrations on test DB, test, verify generated types
- No deployment step — Railway auto-deploys from `main`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Server Technology Stack]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema Design]
- [Source: _bmad-output/planning-artifacts/architecture.md#Server Component Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Patterns - REST Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing Standards]
- [Source: _bmad-output/planning-artifacts/architecture.md#Deployment & Build Configuration]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 - Story 1.2]
- [Source: _bmad-output/project-context.md#Technology Stack]
- [Source: _bmad-output/project-context.md#Core Principle]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `fastify-type-provider-zod@6.1.0` requires Zod v4 (`>=4.1.5`) — confirmed via `npm view` peer dependencies. Package is `fastify-type-provider-zod` (not `@fastify/` scoped).
- Zod v4 API: `z.url()` and `z.email()` replace deprecated `z.string().url()` and `z.string().email()`. Import via `zod/v4`.
- `pg` module uses default export in ESM (`import pg from 'pg'`; `new pg.Pool(...)`) — not named exports.

### Completion Notes List

- **Task 1**: Initialized `apps/server/` with ESM, all dependencies installed (Fastify 5.8.1, Zod 4.3.6, Kysely 0.28.11, Socket.io 4.8.3), tsconfig strict ESM configured, full directory structure created per architecture.
- **Task 2**: Entry point with Fastify 5, Pino logging (built-in), Zod type provider, CORS, Socket.io manual attach, graceful shutdown. Config validates all env vars with Zod v4 schema, dotenv loaded conditionally.
- **Task 3**: Database connection via Kysely + PostgreSQL dialect with pool. Migration creates all 5 MVP tables with correct columns, types, FKs, CHECK constraints, unique constraints, and all specified indexes including partial unique index for active party codes. Placeholder `types.ts` created (kysely-codegen will regenerate against live DB).
- **Task 4**: Health endpoint at `/health` checks DB via `SELECT 1`, returns `{ data: {...} }` or `{ error: {...} }` with proper status codes.
- **Task 5**: `AppError` type with factory functions, Fastify error handler wrapping all errors in `{ error: { code, message } }`, common Zod response schemas, Socket.io event constants skeleton.
- **Task 6**: GitHub Actions CI pipeline triggering on `apps/server/**` changes with Node.js 24, type check, migrations, Vitest, and kysely-codegen type verification.
- **Task 7**: 23 tests across 4 test files — all passing. Config validation (9 tests), health endpoint (2 tests), error handler (10 tests), migration smoke test (2 tests). Test factories for users, sessions, participants.

### Change Log

- 2026-03-07: Implemented Story 1.2 — Server foundation with Fastify 5 + TypeScript strict ESM, database schema with 5 MVP tables, health endpoint, shared modules, CI pipeline, and comprehensive tests (23 passing).
- 2026-03-07: Code review (Opus 4.6) — Fixed 8 issues (3 HIGH, 3 MEDIUM, 2 LOW): broken CI kysely-codegen verify step, sham migration test replaced with real integration test, config test now imports actual envSchema, error handler now logs via Pino, factory validation tests added, dead void-io code removed, @fastify/swagger registered, Socket.io CORS restricted by env. 33 tests passing (31 + 2 skipped integration).

### File List

- `apps/server/package.json` (new)
- `apps/server/package-lock.json` (new)
- `apps/server/tsconfig.json` (new)
- `apps/server/.env.example` (new)
- `apps/server/kysely.config.ts` (new)
- `apps/server/vitest.config.ts` (new)
- `apps/server/src/index.ts` (new)
- `apps/server/src/config.ts` (new)
- `apps/server/src/db/connection.ts` (new)
- `apps/server/src/db/types.ts` (new — placeholder, DO NOT EDIT)
- `apps/server/src/routes/health.ts` (new)
- `apps/server/src/shared/errors.ts` (new)
- `apps/server/src/shared/events.ts` (new)
- `apps/server/src/shared/schemas/common-schemas.ts` (new)
- `apps/server/migrations/001-initial-schema.ts` (new)
- `apps/server/tests/config.test.ts` (new)
- `apps/server/tests/routes/health.test.ts` (new)
- `apps/server/tests/shared/errors.test.ts` (new)
- `apps/server/tests/migrations/001-initial-schema.test.ts` (new)
- `apps/server/tests/factories/user.ts` (new)
- `apps/server/tests/factories/session.ts` (new)
- `apps/server/tests/factories/participant.ts` (new)
- `apps/server/tests/factories/factories.test.ts` (new — review)
- `.github/workflows/server-ci.yml` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

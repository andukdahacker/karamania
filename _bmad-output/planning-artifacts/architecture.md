---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-06'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-karaoke-party-app-2026-03-04.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/research/market-karaoke-party-companion-research-2026-03-03.md'
workflowType: 'architecture'
project_name: 'karaoke-party-app'
user_name: 'Ducdo'
date: '2026-03-06'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
115 FRs across 9 major capability areas. The heaviest concentration is in Audience Participation (FR22-73, covering reactions, soundboard, party cards, lightstick mode, hype signals, and prompted media capture) and Song Integration (FR74-95, covering TV pairing, playlist import, suggestion engine, Quick Pick, Spin the Wheel, and fallback modes). Party Management (FR1-8, FR53, FR106-107) and the DJ Engine (FR9-15, FR51, FR54) form the foundational layer everything else depends on. Authentication/Identity (FR96-105) and Session Timeline (FR108-115) add persistence and re-engagement surfaces.

Architecturally, FRs cluster into three tiers:
1. **Real-time game engine** (DJ state machine, ceremonies, reactions, soundboard, party cards, interludes, voting) -- all server-authoritative, WebSocket-driven
2. **Integration layer** (YouTube Lounge API, YouTube Data API, Spotify Web API, Firebase Auth, Firebase Storage, PostgreSQL) -- external service orchestration
3. **Persistence & content** (session summaries, media captures, session timeline, shareable web views, setlist posters) -- data that outlives the party session

**Non-Functional Requirements:**
39 NFRs with the most architecturally impactful being:
- **NFR1-7, NFR26-27:** Strict latency budgets (200ms state sync, 100ms reactions, 50ms audio, 5ms event logging overhead) -- drives choice of transport protocol, audio architecture, and server topology
- **NFR8-13, NFR28:** Reliability requirements -- zero single points of failure in DJ engine, three-tier reconnection, graceful degradation below 3 players, no memory leaks over 3hr sessions
- **NFR14-20, NFR38-39:** Usability constraints -- 48px+ tap targets, single-tap interactions, centralized string constants for i18n, <50KB web landing page with <2s load
- **NFR29-33:** Song integration performance -- 5s playlist import, YouTube API quota management (<500 units/session), pre-built karaoke catalog (no live API calls during party), server-side Spotify token management
- **NFR34-37:** Auth/persistence -- JWT validation on handshake, guest-to-account upgrade without disconnection, async PostgreSQL writes, media access control with signed URLs

**Scale & Complexity:**

- Primary domain: Full-stack mobile (Flutter + Node.js)
- Complexity level: Medium-High
- Estimated architectural components: ~15 distinct server-side modules, ~12 Flutter screens, ~25 reusable widgets, 6 external service integrations

### State Architecture -- Full Persistence Model

**Decision: All session state is persisted on every DJ state transition. In-memory is a hot cache; PostgreSQL is the source of truth.**

This is a foundational architectural decision that affects every component. The DJ engine state machine is fully serializable, and every state transition triggers an async upsert of the complete DJ state as a JSONB column on the `sessions` table. The WebSocket broadcast does not wait for the DB write -- persistence is fire-and-forget with retry.

**Three state tiers:**

| Tier | Store | Lifecycle | Examples |
|------|-------|-----------|----------|
| Hot state (in-memory) | Node.js process | Lives while process runs, reconstructed from DB on restart | DJ state machine instance, WebSocket connections, active timers, event buffers |
| Persistent state | Railway PostgreSQL | Survives crashes and restarts | DJ state snapshots (JSONB), session summaries, user profiles, participation scores |
| External state | Firebase Storage | Independent of server | Media captures (photos, video, audio), uploaded in real-time by clients |

**Server restart recovery:**
1. Server boots, reads all sessions where `status = 'active'` from PostgreSQL
2. Reconstructs DJ state machines from persisted JSONB snapshots
3. Reconciles timers: expired timers are skipped, active timers resume with elapsed-time adjustment
4. Accepts client WebSocket reconnections -- clients experience a tier 3 (long) reconnection with full state sync
5. Party resumes from the last persisted state transition

**PRD Supersession (NFR13):** The PRD states "Full session persistence and recovery deferred to v2." This architecture decision supersedes that statement -- full persistence is MVP scope per explicit user decision during architecture creation. AI agents should follow this architecture document, not the PRD's NFR13 text, for persistence scope.

**Why full persistence over in-memory-only:**
- The party survives server crashes and Railway platform restarts
- Removes a class of data-loss risk from launch night
- Implementation cost is low: one JSONB column, one async upsert per state transition (~1 write every 2-4 minutes)
- Media captures already persist independently via Firebase Storage client uploads
- No new infrastructure required -- PostgreSQL is already provisioned

### Technical Constraints & Dependencies

| Constraint | Impact |
|-----------|--------|
| Solo developer | Single-server architecture, no microservices, "boring technology" mandate. Also an advantage: no inter-team coordination, monolithic server is the correct architecture for the team size |
| Flutter native (iOS + Android) | Single codebase but requires deep-link config, app store distribution, platform permission handling |
| YouTube Lounge API (unofficial) | Must abstract behind interface for swappability. Stateful (persistent connection) vs. stateless (suggestion-only fallback) interaction patterns behind a single interface -- the abstraction must handle this asymmetry |
| YouTube Data API v3 quota (10K units/day free) | Batched requests, <500 units per session, catalog pre-built offline |
| Firebase free tier limits | 5GB storage, auth free, monitor usage growth |
| Railway hosting | Single-process Node.js, co-located PostgreSQL, WebSocket-friendly |
| Budget Android devices (Vietnam market) | Performance testing on 3-year-old devices, <50MB app size, <80MB runtime memory |
| 2-3 hour session duration | Battery optimization, memory leak prevention, connection resilience |

### Integration Seam Mapping

The three backend services (Node.js/Socket.io, PostgreSQL, Firebase) are not independent. Key coupling points that require explicit architectural attention:

| Seam | Services Involved | Data Flow | Risk |
|------|-------------------|-----------|------|
| Auth handshake | Firebase Auth <-> Socket.io | Firebase JWT validated on WebSocket connection. Guest users get server-issued session token | Token expiry during 3hr session, refresh handling |
| Session persistence | Socket.io <-> PostgreSQL | DJ state written on every transition. Session summary written at party end | Async write failures, data consistency |
| Media tagging | Firebase Storage <-> Socket.io | Client uploads tagged with DJ state and session context from server | Race condition: media captured during state transition tagged with old or new state |
| Session timeline | PostgreSQL <-> Firebase Storage | Session detail view joins PostgreSQL session data with Firebase media by session ID | Cross-service query, no join possible -- client-side assembly |
| Lounge API lifecycle | YouTube Lounge API <-> Socket.io | Persistent Lounge connection managed per-session alongside WebSocket connections | Two persistent connections per session, both need health monitoring |

### Cross-Cutting Concerns Identified

1. **Full-persistence state synchronization** -- Every DJ state transition persists to PostgreSQL (async) and broadcasts to all clients (sync). The WebSocket transport, event buffering, reconnection model, and now crash recovery all depend on this dual-write pattern
2. **Authentication duality** -- Guest and authenticated users have identical in-session capabilities but different persistence. Every data-writing operation must handle both paths
3. **Event stream instrumentation** -- Every state transition and user action logged as structured events. This is both the analytics pipeline and the debugging tool. Must be async with <5ms overhead
4. **Audio coordination** -- Host phone as primary audio source for big moments, participant phones at reduced volume. Affects ceremony, soundboard, and state transition sounds
5. **Animation-timing as architecture** -- Server-coordinated timing for ceremony reveals (anticipation phase absorbs clock drift, future-timestamp-based synchronized reveal). This is a synchronization concern, not just UX polish
6. **Rate limiting** -- Reaction/soundboard spam prevention with progressive reward degradation (not hard blocks). Affects participation scoring and visual feedback simultaneously
7. **Media lifecycle** -- Capture -> tag -> background upload -> storage -> access control -> expiry (7-day for guests). Spans client capture, server tagging, Firebase Storage, and signed URL generation. Media persists independently of server state -- crash-safe by design
8. **Graceful degradation** -- Multiple fallback paths: TV pairing failure -> suggestion-only mode, low participant count -> reduced game set, reconnection tiers, ceremony type adaptation, server crash -> state recovery from PostgreSQL
9. **Internationalization readiness** -- All strings centralized in `constants/copy.dart` for Vietnamese localization fast-follow. Fonts must support Vietnamese diacritics
10. **Vibe system as architectural parameterization** -- A single enum value chosen at party creation (PartyVibe) propagates through the entire visual layer: ceremony confetti, reaction buttons, lightstick glow colors, award copy flavor. The theme provider is a cross-cutting dependency for every visual component
11. **Testability boundaries** -- Clear delineation required: unit-testable (DJ state machine logic, state serialization round-trips, timer reconciliation, pure Dart functions) vs. integration-testable (WebSocket + Flutter rendering, reconnection recovery, device behavior like screen lock/app backgrounding, audio playback)

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack mobile** -- Flutter native client + Node.js/Fastify real-time server + lightweight web landing page, organized as a monorepo.

### Current Verified Versions (March 2026)

| Technology | Version | Status |
|-----------|---------|--------|
| Flutter SDK | 3.41.2 | Stable |
| Dart | 3.x | Stable (bundled with Flutter) |
| Node.js | 24.x (Krypton) | Active LTS |
| Fastify | 5.8.1 | Latest |
| Socket.io | 4.x | Stable |
| TypeScript | 5.x | Stable |

### Language Alternatives Considered

**Evaluation criteria:** Socket.io support, Firebase Admin SDK, PostgreSQL drivers, YouTube Lounge API libraries, solo developer productivity, deployment simplicity.

| Language | Strengths for Karamania | Weaknesses for Karamania | Verdict |
|----------|------------------------|--------------------------|---------|
| **TypeScript/Node.js** | Socket.io native, official Firebase SDK, 3+ YouTube Lounge API libs, massive ecosystem, one language across client comms and server | Single-threaded event loop (irrelevant at MVP scale) | **Selected** |
| **Go** | Goroutines ideal for concurrent WebSockets, ~10x smaller memory footprint, compiled binary deployment | No Socket.io (must rebuild rooms, reconnection, namespacing from scratch), 1 YouTube Lounge API lib | Rejected -- infrastructure tax too high |
| **Elixir/Phoenix** | OTP GenServer is a supervised state machine with crash recovery built-in, Phoenix Channels handle WebSocket rooms natively, BEAM VM designed for this exact problem | No Firebase Admin SDK (raw REST only), zero YouTube Lounge API libs, 1/50th ecosystem size, steep learning curve | Rejected -- best theoretical fit but ecosystem gaps and learning curve are net negative for MVP |
| **Kotlin/Ktor** | JVM maturity, strong typing | No Socket.io, community-only Firebase SDK, zero YouTube Lounge API libs | Rejected -- no ecosystem advantage |
| **Rust** | Maximum performance, memory safety | No Socket.io, community-only Firebase SDK, zero YouTube Lounge API libs, highest learning curve | Rejected -- premature optimization for a state machine that processes one event every 2-4 minutes |

**Decision: TypeScript/Node.js.** Not because it's the best language for real-time state machines in the abstract, but because Socket.io is the project's real-time backbone (and Node.js-native), Firebase Admin SDK is official, YouTube Lounge API libraries exist (3+ maintained), and solo developer velocity is maximized by one language ecosystem. The performance ceiling is irrelevant -- Node.js handles 10K+ concurrent connections; MVP needs ~80.

**Future consideration:** If Karamania scales to thousands of concurrent parties and Node.js becomes the bottleneck, extracting the DJ engine to a Go or Rust microservice is the correct move. That's a v4 problem, not an MVP problem.

### Compatibility Note: Fastify 5 + Socket.io

The `fastify-socket.io` plugin (v5.1.0) only supports Fastify 4.x. An open issue (#180) tracks Fastify 5 support.

**Decision: Manual Socket.io integration.** Socket.io attaches directly to Fastify's underlying HTTP server -- no plugin needed:

```typescript
import Fastify from 'fastify';
import { Server } from 'socket.io';

const fastify = Fastify();
const io = new Server(fastify.server);
```

For a project where Socket.io is the primary transport layer, manual integration is cleaner -- no plugin abstraction between the application and the Socket.io API. This is the approach Socket.io's own documentation recommends for non-Express frameworks.

### Starter Options Considered

**Flutter Client:**

| Option | Verdict |
|--------|---------|
| `flutter create` (standard CLI) | **Selected.** Clean starting point, Provider added via pubspec.yaml. Project structure already defined in UX spec |
| ApparenceKit | Rejected -- uses Riverpod, paid boilerplate, wrong state management choice |
| GeekyAnts flutter-starter | Rejected -- uses Bloc, outdated |

**Node.js Server:**

| Option | Verdict |
|--------|---------|
| Fastify CLI (`fastify --ts`) | **Selected.** Generates TypeScript project with correct Fastify 5 config |
| NestJS | Rejected -- heavy abstraction layer, decorators, DI container adds complexity without benefit for a WebSocket-primary server |

**Web Landing Page:**

| Option | Verdict |
|--------|---------|
| Plain HTML/JS | **Selected.** <50KB requirement (NFR39), deep-link routing only. No framework needed |

### Selected Approach: CLI-Generated + Custom Structure

**Rationale:** Both Flutter and Fastify have CLI generators producing clean, correctly-configured projects. The UX spec already defines the Flutter project structure. A heavyweight starter template would mean fighting its opinions to match the architecture. Start clean, build what's needed.

**Initialization Commands:**

```bash
# Monorepo root
mkdir karamania && cd karamania
git init

# Flutter app
flutter create --org com.karamania --project-name karamania apps/flutter_app

# Node.js server
mkdir -p apps/server && cd apps/server
npm init -y
npm install fastify@5 socket.io typescript @types/node
npm install -D tsx @fastify/type-provider-typebox
npx tsc --init  # Configure for ESM + strict mode

# Web landing page
mkdir -p apps/web_landing
# Static HTML/JS -- no build step needed
```

### Architectural Decisions Provided by Starters

**Language & Runtime:**
- Flutter/Dart 3.x for client (from `flutter create`)
- TypeScript 5.x strict mode + Node.js 24 LTS for server (`strict: true`, `noUncheckedIndexedAccess: true`)
- ESM modules for server

**State Management:**
- Provider (ChangeNotifier) v6.x for Flutter -- lightweight, sufficient for thin-client architecture where server owns all game state

**Build Tooling:**
- Flutter's built-in build system (release mode AOT compilation) for client
- `tsx` for server development (TypeScript execution without separate compile step)

**Testing Framework:**
- `flutter_test` (built-in) for client unit and widget tests
- Vitest for server unit tests (DJ state machine: pure TypeScript functions, 100% coverage)

**Code Organization:**
- Flutter: structure defined in UX spec (`screens/`, `widgets/`, `state/`, `socket/`, `audio/`, `constants/`, `theme/`)
- Server: feature-based modules (`dj-engine/`, `socket-handlers/`, `integrations/`, `persistence/`)
- Monorepo: `apps/flutter_app/`, `apps/server/`, `apps/web_landing/`

**Development Experience:**
- Flutter hot reload for UI iteration
- `tsx --watch` for server auto-restart
- No Docker required for MVP (Railway handles deployment)

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data layer: Kysely query builder with plain JSON/JSONB state serialization, kysely-codegen for type safety
- Auth flow: Server-signed JWT for guests, Firebase JWT for authenticated users, unified Socket.io handshake middleware with explicit error paths
- Real-time protocol: Socket.io `namespace:action` event convention with manual Fastify integration
- REST validation: Zod via `fastify-type-provider-zod`
- Flutter routing: GoRouter (app-level) + DJ state-driven switching (in-party)

**Important Decisions (Shape Architecture):**
- Monitoring: Pino structured logging + Sentry error tracking
- CI/CD: GitHub Actions (tests) + Railway auto-deploy (server) + manual app distribution (MVP)
- Environment config: Railway env vars + `--dart-define` for Flutter
- Event stream: in-memory during session, batch write at session end
- Karaoke Catalog: PostgreSQL table, weekly offline refresh

**Deferred Decisions (Post-MVP):**
- Horizontal scaling (Socket.io Redis adapter, sticky sessions) -- v4
- Automated app store deployment -- v2
- External monitoring dashboard (Datadog, Grafana) -- when traffic justifies cost
- Socket.io event payload codegen for compile-time guarantees -- v2
- Incremental event stream flush (periodic background writes) -- v2 if crash-related data loss becomes an issue

### Data Architecture

**Query Layer: Kysely + kysely-codegen**
- Type-safe SQL query builder, zero dependencies, zero runtime magic
- PostgreSQL dialect with native JSONB support
- **kysely-codegen** auto-generates Database TypeScript types from the live database schema after migrations run. Added to CI pipeline -- type drift caught before merge
- Rationale: Minimal abstraction over SQL, type-safe without hiding queries, lightweight. Schema is small and queries are straightforward -- an ORM's abstraction adds complexity without benefit

**DJ State Serialization: Plain JSON into JSONB**
- `JSON.stringify(djState)` written to `sessions.dj_state` column (JSONB type)
- Queryable via PostgreSQL JSON operators for debugging and analytics
- Readable in database tools without deserialization
- A few KB per state snapshot, updated every 2-4 minutes

**Migrations: Kysely built-in (`kysely-ctl`)**
- Hand-written `up`/`down` migration functions in TypeScript
- Version-controlled migration files in `apps/server/migrations/`
- Expected 2-3 migration files for MVP schema
- Run via `kysely-ctl migrate` in CI and deployment
- After migrations: run `kysely-codegen` to regenerate Database types

**Schema (MVP):**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Authenticated user profiles | `id`, `firebase_uid`, `display_name`, `avatar_url`, `created_at` |
| `sessions` | Party sessions | `id`, `host_user_id`, `party_code`, `status`, `dj_state` (JSONB), `event_stream` (JSONB), `vibe`, `venue_name`, `created_at`, `ended_at` |
| `session_participants` | Per-user session data | `session_id`, `user_id`, `guest_name`, `participation_score`, `top_award`, `feedback_score`, `joined_at` |
| `media_captures` | Media metadata (files in Firebase Storage) | `id`, `session_id`, `user_id`, `storage_path`, `trigger_type`, `dj_state_at_capture`, `created_at` |
| `karaoke_catalog` | Pre-scraped karaoke songs | `id`, `song_title`, `artist`, `youtube_video_id`, `channel`, `created_at`, `updated_at` |

**Karaoke Catalog Index (FR85, NFR32):**
- PostgreSQL table with 10K+ tracks pre-scraped from popular karaoke YouTube channels
- Intersection queries against imported playlists use SQL joins -- PostgreSQL's strength
- Catalog refresh: weekly offline script that upserts rows (NFR32). No live API calls during party sessions
- Cold start fallback: `is_classic` boolean column flags top 200 universally known karaoke songs (FR91)

**Event Stream Architecture (FR42, NFR26):**
- **During session:** events accumulate in an in-memory array on the server (append-only). Array push is <1ms, well within the 5ms latency budget (NFR26)
- **At session end:** batch write the full event stream to `sessions.event_stream` JSONB column
- **Event schema:** typed per event category using discriminated union:

```typescript
type SessionEvent =
  | { type: 'dj:stateChanged'; ts: number; data: { from: DJState; to: DJState } }
  | { type: 'reaction:sent'; ts: number; userId: string; data: { emoji: string; streak: number } }
  | { type: 'ceremony:reveal'; ts: number; data: { award: string; recipientId: string; ceremonyType: 'full' | 'quick' } }
  | { type: 'card:accepted'; ts: number; userId: string; data: { cardId: string; cardType: string } }
  | { type: 'song:detected'; ts: number; data: { title: string; artist: string; videoId: string } }
  // ... additional event types per namespace
```

- **Crash resilience tradeoff:** if the server crashes, the event stream for active sessions is lost. The DJ state itself is persisted (write-on-transition), so the party recovers. Event data is valuable for analytics and go/no-go evaluation but not mission-critical for party operation. Periodic background flush (every 30-60s) deferred to v2 if crash-related data loss becomes a real issue

### Authentication & Security

**Guest Token Strategy: Server-signed JWT**
- Server generates JWT with `{guestId, sessionId, role: 'guest', exp}` using `jose` library
- Same token format as Firebase JWT -- one validation code path in Socket.io middleware
- TTL matches maximum session duration (6 hours, per NFR34)
- Stateless validation -- no server-side token store needed

**WebSocket Authentication Flow:**

```
Client connects with token in handshake auth
        |
Socket.io middleware extracts token
        |
   Check issuer
   /          \
Firebase       Server-signed
   |              |
Validate via    Validate
Admin SDK       signature
   |              |
   Extract        Extract
   userId         guestId + sessionId
   \              /
    Attach to socket.data
        |
    Match to active session
        |
    Connection established
```

Three cases handled by one middleware:
1. **Authenticated user** -- Firebase JWT, validated via Firebase Admin SDK
2. **Guest user** -- Server-signed JWT, validated locally
3. **Reconnecting user** -- Same token, server matches to existing session and replays buffered events

**Auth Middleware Error Paths:**

| Error Condition | Behavior | Client Experience |
|----------------|----------|-------------------|
| Firebase JWT expired (1hr TTL during 3hr party) | Server requests token refresh via `auth:refreshRequired` event. Client uses Firebase SDK to get fresh token and reconnects | Brief reconnection, transparent if <5s |
| Server-signed JWT invalid signature | Force disconnect with `auth:invalid` error event | "Session expired" message, return to join screen |
| Valid token but sessionId not found (session ended or crashed) | Disconnect with `session:notFound` error event | "This party has ended" message |
| Valid token but session is full (>12 participants) | Reject with `session:full` error event | "Party is full" message on join screen |

**Rate Limiting: Extracted Pure Function**
- Rate limiter implemented as a pure, testable function -- not embedded in Socket.io handler:

```typescript
// Pure function -- no Socket.io dependency, 100% unit testable
function checkRateLimit(
  events: number[],  // timestamps of recent events
  now: number,
  windowMs: number,  // 5000ms
  maxEvents: number  // 10
): { allowed: boolean; rewardMultiplier: number } {
  const windowEvents = events.filter(t => now - t < windowMs);
  if (windowEvents.length < maxEvents) return { allowed: true, rewardMultiplier: 1.0 };
  if (windowEvents.length < maxEvents * 2) {
    const overage = windowEvents.length - maxEvents;
    return { allowed: true, rewardMultiplier: Math.pow(0.5, overage) };
  }
  return { allowed: true, rewardMultiplier: 0 };
}
```

- Per NFR23: no hard block -- user can always tap, but reward and visual feedback diminish
- Socket.io handler calls the pure function, applies the multiplier to participation points and feedback
- Per-user event timestamp arrays stored in memory, cleaned up every 30s
- 5s inactivity resets the counter

### API & Communication Patterns

**REST API: Fastify + Zod**
- `fastify-type-provider-zod` v6.1.0 for request/response schema validation
- Zod schemas serve as single source of truth for types and validation
- Standard RESTful routes for non-realtime operations:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sessions` | GET | Session timeline (authenticated, paginated) |
| `/api/sessions/:id` | GET | Session detail with participants, setlist, awards |
| `/api/sessions/:id/share` | GET | Read-only web view (public, no auth) |
| `/api/playlists/import` | POST | Playlist URL import (YouTube Music / Spotify) |
| `/api/media/:id/url` | GET | Signed Firebase Storage URL for media access |

**WebSocket Event Convention: `namespace:action`**

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

**REST Type Generation: Zod -> OpenAPI -> dart-open-fetch**
- Fastify REST routes defined with Zod schemas (already decided)
- `@fastify/swagger` auto-generates OpenAPI 3.x spec from Zod schemas (Fastify does this natively)
- `dart_open_fetch generate` produces fully-typed Dart HTTP clients from the OpenAPI spec
- Pipeline: Zod schema (server) -> OpenAPI spec (auto-generated) -> Dart types + clients (auto-generated)
- Eliminates manual type sync for all REST endpoints -- types defined once in Zod, flow to Dart automatically
- Generated Dart clients include `fromJson`/`toJson`, sealed classes for unions, typed `ApiResponse<T>`
- Tool is developer-owned (`github.com/andukdahacker/dart-open-fetch`) -- can be extended as needed
- Run as part of build pipeline: after server schema changes, regenerate Dart clients

**Socket.io Event Type Sync (Deferred to v2):**
Socket.io event payloads are not part of OpenAPI and are not covered by the dart-open-fetch pipeline. For MVP, event payload types are manually maintained on both server and client using the `namespace:action` event catalog documented in this architecture doc. Compile-time event payload guarantees via codegen deferred to v2.

**Error Handling Standard:**

```typescript
type AppError = {
  code: string;        // 'SESSION_NOT_FOUND', 'LOUNGE_API_FAILED'
  message: string;     // Human-readable
  statusCode?: number; // HTTP status (REST only)
}
```

Consistent shape across REST responses (Fastify error handler) and Socket.io error events. All errors logged via Pino with correlation IDs (sessionId, userId).

### Frontend Architecture

**Navigation: GoRouter + DJ State Switching**
- **GoRouter** handles app-level navigation: home, join, lobby, session timeline, session detail
- Deep link support built-in: Universal Links (iOS) + App Links (Android) for QR code join flow
- **During active party:** GoRouter has a single `/party` route that renders a DJ state consumer widget. The DJ state switching happens *inside* that route via `switch (djState)`, not as separate GoRouter routes
- **Back button during party:** shows confirm exit dialog, does not pop route. Prevents accidental navigation away from active session
- **Party end:** DJ state transitions to `finale` -> after finale completes, GoRouter navigates back to home/timeline
- This cleanly separates the two routing systems -- GoRouter never conflicts with DJ state-driven screen changes

**Dependency Injection: Provider at root**
- `MultiProvider` wrapping `MaterialApp` with:
  - `PartyProvider` -- DJ state, participants, session data
  - `AuthProvider` -- Firebase Auth state, guest/account management
  - `CaptureProvider` -- Media capture state, upload queue
  - `TimelineProvider` -- Session history, timeline data
- Consistent with UX spec code examples
- `SocketClient` initialized as a singleton, dispatches events to providers

### Infrastructure & Deployment

**Environment Configuration:**

| Config | Location | Notes |
|--------|----------|-------|
| Firebase project config | Flutter: `firebase_options.dart` (FlutterFire CLI). Server: env vars | Generated, not hand-written |
| `DATABASE_URL` | Railway auto-injected | No manual config |
| YouTube Data API key | Railway env var | |
| Spotify Client ID / Secret | Railway env var | Server-side only (NFR33) |
| JWT signing secret | Railway env var | For guest token signing |
| Server URL | Flutter `--dart-define` per environment | Build-time config |
| Local dev | `.env` files (gitignored) | `dotenv` for server, `--dart-define-from-file` for Flutter |

**Monitoring & Logging:**
- **Pino** (Fastify's built-in logger) -- structured JSON logs, Railway captures stdout automatically. Free
- **Sentry free tier** -- unhandled exception tracking with stack traces. Critical for debugging live party crashes. 5K errors/month free
- Every log entry includes `sessionId` and `userId` for correlation
- DJ state transitions logged at `info` level, reactions at `debug` level

**CI/CD Pipeline:**
- **GitHub Actions** -- run Vitest (server) + `flutter test` (client) on push. Run `kysely-codegen` after migrations to verify type sync
- **Railway auto-deploy** -- server auto-deploys on push to `main`
- **Manual app distribution** -- TestFlight (iOS) + internal testing track (Android) for MVP friend group testing
- Automated app store deployment deferred to v2

**Scaling Strategy (Document the Wall):**

| Scale | Architecture | Status |
|-------|-------------|--------|
| MVP: 5-10 concurrent parties (~80 connections) | Single Railway process, single PostgreSQL instance | Current target |
| Growth: 100-500 concurrent parties | Vertical scaling (larger Railway instance), connection pooling | When needed |
| The wall: ~1,000+ concurrent parties | Horizontal scaling: Socket.io Redis adapter, sticky sessions, multiple server instances, load balancer | v4 problem |

No horizontal scaling architecture needed now. The single-process ceiling (~10K concurrent WebSocket connections) is 100x beyond MVP requirements.

### Decision Impact Analysis

**Implementation Sequence:**
1. PostgreSQL schema + Kysely migrations + kysely-codegen (Sprint 0, Day 3)
2. Firebase Auth setup + JWT guest token signing with `jose` (Sprint 0, Day 3)
3. Socket.io manual integration with Fastify + auth middleware with error paths (Sprint 0, Day 2-3)
4. GoRouter + deep link configuration + `/party` route structure (Sprint 0, Day 2)
5. Provider setup + SocketClient singleton (Sprint 0, Day 2)
6. Pino logging + Sentry integration (Sprint 0, Day 2)
7. Rate limiter pure function + unit tests (Sprint 1)
8. REST endpoints added incrementally as features require them (Sprint 2+)
9. Karaoke catalog table + initial scrape script (Sprint 0, Day 6)

**Cross-Component Dependencies:**
- Zod schemas define the REST contract between Flutter client and Fastify server -- auto-generated via `@fastify/swagger` -> `dart-open-fetch` pipeline. Socket.io event payloads remain manually synced for MVP
- Kysely Database types auto-generated by kysely-codegen from live schema -- type drift caught at CI time
- Socket.io event names (`namespace:action`) must match between server handlers and Flutter `SocketClient` listeners -- documented event catalog in this architecture doc serves as the contract
- GoRouter deep link configuration must match web landing page URL patterns and App Links / Universal Links setup
- Rate limiter pure function is consumed by multiple Socket.io handlers (reactions, soundboard, hype signal) -- single module, multiple consumers
- Event stream typed union must cover all `namespace:action` events -- add new event types as features are built

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (PostgreSQL via Kysely):**

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | snake_case, plural | `users`, `sessions`, `session_participants`, `media_captures`, `karaoke_catalog` |
| Columns | snake_case | `user_id`, `display_name`, `created_at`, `dj_state` |
| Foreign keys | `{referenced_table_singular}_id` | `user_id`, `session_id` |
| Indexes | `idx_{table}_{columns}` | `idx_sessions_party_code`, `idx_users_firebase_uid` |
| Enums | snake_case | `session_status`, `capture_trigger_type` |

**TypeScript (Server):**

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `dj-engine.ts`, `rate-limiter.ts`, `lounge-api.ts` |
| Directories | kebab-case | `dj-engine/`, `socket-handlers/`, `integrations/` |
| Classes/Types | PascalCase | `DJState`, `SessionEvent`, `AppError` |
| Functions | camelCase | `checkRateLimit`, `generateGuestToken` |
| Constants | UPPER_SNAKE_CASE | `MAX_PARTICIPANTS`, `HEARTBEAT_INTERVAL_MS` |
| Zod schemas | camelCase with `Schema` suffix | `sessionResponseSchema`, `playlistImportSchema` |
| Imports | Relative paths (no tsconfig aliases) | `import { checkRateLimit } from '../services/rate-limiter.js'` |

**Dart (Flutter):**

| Element | Convention | Example |
|---------|-----------|---------|
| Files | snake_case (Dart convention) | `party_provider.dart`, `ceremony_screen.dart` |
| Directories | snake_case | `screens/`, `widgets/`, `state/` |
| Classes | PascalCase | `PartyProvider`, `CeremonyReveal`, `DJTokens` |
| Functions/methods | camelCase | `onStateChanged`, `playSound` |
| Constants | camelCase (Dart convention) | `ceremonyBg`, `spaceXl` |
| Enums | PascalCase with camelCase values | `DJState.ceremony`, `PartyVibe.kpop` |
| Widget keys | `Key('kebab-case-descriptor')` | `Key('dj-state-ceremony')`, `Key('song-over-button')` |
| Imports | `package:karamania/...` for cross-directory | `import 'package:karamania/state/party_provider.dart'` |

**JSON / API:**

| Context | Convention | Example |
|---------|-----------|---------|
| REST response fields | camelCase | `{ "sessionId": "...", "createdAt": "..." }` |
| Socket.io event payloads | camelCase | `{ "djState": "ceremony", "awardTitle": "..." }` |
| Dates in JSON | ISO 8601 strings | `"2026-03-06T20:30:00Z"` |
| IDs | UUIDv4 strings | `"a1b2c3d4-..."` |

**Data Layer Casing Strategy:**
- Database columns: snake_case (PostgreSQL convention)
- Kysely types (generated by kysely-codegen): snake_case -- matches the DB exactly
- TypeScript data layer (repositories, services): snake_case -- matches Kysely types, no transformation
- Conversion to camelCase happens ONCE at the boundary: in Zod schemas for REST responses and in Socket.io event emission
- This eliminates transformation layers inside the application -- only the edge converts

### Structure Patterns

**Server (`apps/server/`):**

```
apps/server/
  src/
    index.ts                    # Entry point: Fastify + Socket.io setup
    config.ts                   # Environment variable loading + validation
    db/
      connection.ts             # Kysely instance
      types.ts                  # Generated by kysely-codegen (DO NOT EDIT)
    dj-engine/
      types.ts                  # DJState enum, DJTransition, DJContext, TimerConfig
      states.ts                 # State definitions (references types.ts)
      machine.ts                # State machine logic (pure functions)
      transitions.ts            # Transition guards and actions
      timers.ts                 # Timer management + reconciliation
      serializer.ts             # State <-> JSON serialization
    socket-handlers/
      auth-middleware.ts        # JWT validation (Firebase + guest)
      party-handlers.ts         # party:* events
      reaction-handlers.ts      # reaction:* events
      ceremony-handlers.ts      # ceremony:* events
      host-handlers.ts          # host:* events
      song-handlers.ts          # song:* events
      card-handlers.ts          # card:* events
      capture-handlers.ts       # capture:* events
    integrations/
      lounge-api.ts             # YouTube Lounge API client
      youtube-data.ts           # YouTube Data API v3
      spotify.ts                # Spotify Web API (Client Credentials)
      firebase-admin.ts         # Firebase Admin SDK setup
    services/
      session-manager.ts        # Session lifecycle orchestration (create, restore, teardown)
      rate-limiter.ts           # Pure rate limiting function
      award-generator.ts        # Award template selection logic
      suggestion-engine.ts      # Intersection-based song suggestions
      event-stream.ts           # In-memory event accumulator
    persistence/
      session-repository.ts     # Session CRUD + DJ state persistence
      user-repository.ts        # User CRUD
      catalog-repository.ts     # Karaoke catalog queries
      media-repository.ts       # Media metadata CRUD
    routes/
      sessions.ts               # REST: /api/sessions
      playlists.ts              # REST: /api/playlists
      media.ts                  # REST: /api/media
      share.ts                  # REST: /api/sessions/:id/share
    shared/
      errors.ts                 # AppError type + error factory functions
      events.ts                 # Socket.io event name constants
      schemas/
        session-schemas.ts      # Zod schemas for /api/sessions
        playlist-schemas.ts     # Zod schemas for /api/playlists
        media-schemas.ts        # Zod schemas for /api/media
        share-schemas.ts        # Zod schemas for /api/sessions/:id/share
  kysely.config.ts              # Kysely CLI configuration (migration path, DB connection)
  migrations/
    001-initial-schema.ts       # Kysely migration
  tests/
    factories/                  # Shared test data factories
      session.ts                # createTestSession(overrides?)
      participant.ts            # createTestParticipant(overrides?)
      dj-state.ts               # createTestDJState(overrides?)
    dj-engine/                  # Mirror src structure
      machine.test.ts
      transitions.test.ts
      timers.test.ts
      serializer.test.ts
    services/
      rate-limiter.test.ts
      award-generator.test.ts
      suggestion-engine.test.ts
```

**Flutter (`apps/flutter_app/`):** as defined in UX spec scaffold (step 3).

**Import & Export Rules:**
- **Server:** relative imports only, no tsconfig path aliases. Simpler, no build tool surprises
- **Flutter:** `package:karamania/...` for cross-directory imports (Dart convention, enforced by linter)
- **No barrel files** (`index.ts` re-exports) on server -- import directly from files. Prevents circular dependency issues
- Flutter follows the same principle -- import specific files, not barrels

**Test Location:**
- Server: `apps/server/tests/` mirroring `src/` structure
- Flutter: `apps/flutter_app/test/` mirroring `lib/` structure (Dart convention)
- Test file naming: `{module}.test.ts` (server), `{module}_test.dart` (Flutter)
- Shared test data: `tests/factories/` directory with one factory per domain object

### Format Patterns

**REST API Response Format:**

Success:
```json
{ "data": { "sessionId": "...", "status": "active" } }
```

Error:
```json
{ "error": { "code": "SESSION_NOT_FOUND", "message": "No active session with that code" } }
```

All REST responses wrapped in `{ data }` or `{ error }` -- never bare objects. This makes client-side parsing unambiguous.

**Socket.io Event Payload Format:**

Events are NOT wrapped -- payloads are the direct object:
```typescript
// Server emits:
io.to(sessionId).emit('ceremony:reveal', {
  awardTitle: 'Vocal Assassin',
  recipientId: 'abc-123',
  ceremonyType: 'full'
});
```

Rationale: Socket.io events are already namespaced by event name. Wrapping adds noise without benefit.

**Null Handling:**
- REST: omit null fields from response (don't send `"avatar": null`)
- Socket.io: omit null fields
- Database: use `NULL` -- Kysely handles the mapping
- Dart: nullable types (`String?`) for optional fields

### Communication Patterns

**Socket.io Event Registration:**

Every event handler follows this pattern on the server:

```typescript
// socket-handlers/reaction-handlers.ts
export function registerReactionHandlers(socket: Socket, session: SessionState) {
  socket.on('reaction:sent', async (data: ReactionPayload) => {
    const { allowed, rewardMultiplier } = checkRateLimit(/* ... */);
    session.addEvent({ type: 'reaction:sent', ts: Date.now(), userId: socket.data.userId, data });
    socket.to(session.id).emit('reaction:broadcast', { ...data, userId: socket.data.userId });
  });
}
```

Rules:
- One handler file per namespace
- Handler functions receive `socket` and `session` -- no global state access
- All events logged to the session event stream
- Rate limiter called for user-action events (reactions, soundboard, hype)

**Provider Update Pattern (Flutter):**

```dart
// Mutations: called ONLY from SocketClient event handlers
void onStateChanged(DJState state) {
  _djState = state;
  notifyListeners();
}
```

Rules:
- Providers are **read-only** from widgets (`context.watch<PartyProvider>()`)
- **Only** `SocketClient` calls mutation methods on providers
- No widget ever creates its own socket listener or mutates provider state directly
- No business logic in providers -- they are reactive state containers, not controllers
- No provider-to-provider access -- providers are independent state containers

**Async Pattern:**
- **`async/await` everywhere** in both TypeScript and Dart
- No `.then()` chains -- ever
- No callbacks except for Socket.io event registration (which is callback-based by API design)
- Error handling via `try/catch` blocks, not `.catch()`

### Process Patterns

**Loading States (Flutter):**

```dart
enum LoadingState { idle, loading, success, error }
```

- Every async operation uses this enum
- Widgets check `loadingState` to show skeleton/spinner/content/error
- Loading state is per-operation, not global (e.g., `playlistImportState`, not a global `isLoading`)

**Error Recovery:**

| Context | Pattern |
|---------|---------|
| WebSocket disconnect | Three-tier reconnection (automatic, no user action for <60s) |
| REST API failure | Show inline error message, retry button where applicable |
| Firebase Auth failure | Fallback to guest mode, never block join flow |
| Lounge API failure | Degrade to suggestion-only mode, single non-blocking host notification |
| PostgreSQL write failure | 3 retries with exponential backoff, log to disk on final failure |
| Media upload failure | Queue for background retry, never block party experience |

**Validation Timing:**
- **Client-side:** minimal -- validate presence/format only (party code is 4 digits, name is non-empty)
- **Server-side:** full validation via Zod schemas on REST, typed event handlers on Socket.io
- **Never** trust client data -- server is authoritative for all game state

**Dependency Stubs:**
When implementing a feature that depends on an unbuilt module, use a TODO stub -- never a fake implementation:

```typescript
// CORRECT:
// TODO: Replace with award-generator.ts when implemented
const award = { title: 'Placeholder Award', tone: 'comedic' as const };

// WRONG -- convincing fake that gets shipped:
const award = generateRandomAward();
```

A TODO is findable via search. A convincing fake gets forgotten and shipped.

### Testing Patterns

**Test Data Factories:**

All tests use shared factories from `tests/factories/`:

```typescript
// tests/factories/session.ts
export function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-1',
    status: 'active',
    party_code: 'VIBE',
    dj_state: createTestDJState(),
    vibe: 'general',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
```

Rules:
- One factory per domain object
- All tests import from factories -- no inline test data construction
- Factories return valid defaults, overrides customize specific fields
- Factory functions are pure -- no database or network calls

**Test Isolation:**
- Every test is independent -- no shared mutable state between tests
- Database tests: each test uses a transaction that rolls back after completion
- Socket.io tests: each test creates its own server instance
- No test depends on execution order

**What NOT to Test:**
- Do NOT test Flutter animations, visual effects, confetti curves, or transition timings
- Do NOT test CSS/styling values or color hex codes
- DO test: state transitions, data flow, event handling, serialization, pure business logic
- Integration tests cover ceremony flow end-to-end (state transition -> event emission -> client receives correct data) -- not visual correctness

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow the naming conventions in this document -- no exceptions for "consistency with external libraries"
2. Place new files in the correct directory per the structure patterns -- no new top-level directories without architecture doc update
3. Use the `AppError` type for all error handling -- no ad-hoc error objects
4. Register Socket.io events using the `namespace:action` convention -- no flat event names
5. Log all state transitions and user actions to the event stream -- no silent state changes
6. Use the rate limiter for all user-action events -- no unthrottled paths
7. Write tests mirroring the source structure -- no `__tests__` directories or alternative conventions
8. Use `Key()` on all interactive Flutter widgets and state-driven containers -- required for testing
9. Never hardcode strings in Flutter widgets -- all copy goes in `constants/copy.dart`
10. Never access providers from other providers -- providers are independent state containers
11. Never use magic numbers for spacing, sizing, or colors -- always reference `DJTokens` or vibe provider
12. Use `async/await` exclusively -- no `.then()` chains in TypeScript or Dart
13. Use relative imports on server, `package:karamania/...` in Flutter
14. Use shared test factories -- no inline test data construction
15. Use TODO stubs for unbuilt dependencies -- never fake implementations

**Anti-Patterns to Avoid:**

| Anti-Pattern | Correct Pattern |
|-------------|----------------|
| `socket.on('ceremonyReveal', ...)` | `socket.on('ceremony:reveal', ...)` |
| `{ error: "Something went wrong" }` | `{ error: { code: 'INTERNAL_ERROR', message: '...' } }` |
| `setState(() { djState = newState; })` | `context.watch<PartyProvider>().djState` |
| `apps/server/src/helpers/utils.ts` | Put in the specific module that uses it |
| `if (user != null) { ... } else if (guest != null)` | Both paths produce the same `socket.data` shape |
| Inline SQL strings | Kysely query builder |
| `DateTime.now()` in Dart for server-coordinated events | Use server-provided timestamp |
| `Padding(padding: EdgeInsets.all(16))` | `Padding(padding: EdgeInsets.all(DJTokens.spaceMd))` |
| `Color(0xFF6C63FF)` in a widget | `DJTokens.actionPrimary` or vibe provider |
| `import { thing } from '@/services/thing'` | `import { thing } from '../services/thing.js'` |
| `export { } from './sub-module'` barrel file | Import directly from the file |
| `.then((result) => { ... }).catch(...)` | `const result = await ...; try/catch` |
| `const award = generateRandomAward()` (fake) | `// TODO: Replace with award-generator.ts` |
| Inline test data `{ id: '1', name: 'test' }` | `createTestSession({ id: '1' })` |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
karamania/
|-- .github/
|   +-- workflows/
|       |-- server-ci.yml                    # Vitest + kysely-codegen type check
|       +-- flutter-ci.yml                   # flutter test + flutter analyze
|-- .gitignore
|-- README.md
|
+-- apps/
    |-- flutter_app/
    |   |-- lib/
    |   |   |-- main.dart                    # Entry point: Firebase init, MultiProvider, MaterialApp
    |   |   |-- app.dart                     # GoRouter config, deep link setup, route definitions
    |   |   |-- theme/
    |   |   |   |-- dj_tokens.dart           # Color/spacing/timing/typography constants
    |   |   |   +-- dj_theme.dart            # ThemeData factory + DJ state <-> color mapping
    |   |   |-- state/
    |   |   |   |-- party_provider.dart      # DJ state, participants, session data, vibe
    |   |   |   |-- auth_provider.dart       # Firebase Auth state, guest/account, token management
    |   |   |   |-- capture_provider.dart    # Media capture state, upload queue, bubble triggers
    |   |   |   +-- timeline_provider.dart   # Session history list, session detail data
    |   |   |-- socket/
    |   |   |   +-- client.dart              # Socket.io singleton, event dispatch to providers
    |   |   |-- audio/
    |   |   |   +-- engine.dart              # Audio player, sound preloading, volume coordination
    |   |   |-- constants/
    |   |   |   +-- copy.dart                # All UI strings: awards, prompts, cards, system messages
    |   |   |-- api/
    |   |   |   +-- generated/               # dart-open-fetch output (DO NOT EDIT)
    |   |   |-- screens/
    |   |   |   |-- home_screen.dart         # Timeline (auth) or Start/Join (guest)
    |   |   |   |-- session_detail_screen.dart # Past session: setlist, awards, media gallery
    |   |   |   |-- lobby_screen.dart        # Join flow, icebreaker, playlist import
    |   |   |   |-- party_screen.dart        # Active party container: switch(djState)
    |   |   |   |-- song_screen.dart         # Reactions, soundboard, lightstick, hype signal
    |   |   |   |-- ceremony_screen.dart     # Full + Quick award reveal choreography
    |   |   |   |-- interlude_screen.dart    # Kings Cup, Dare Pull, Quick Vote
    |   |   |   |-- quick_pick_screen.dart   # 5 song suggestions, group tap-to-vote
    |   |   |   |-- spin_wheel_screen.dart   # 8-song wheel, spin animation
    |   |   |   +-- finale_screen.dart       # End-of-night awards, setlist poster
    |   |   +-- widgets/
    |   |       |-- top_bar.dart             # Header with DJ state colors
    |   |       |-- participant_dot.dart     # Avatar circle + connection status
    |   |       |-- countdown_timer.dart     # Circular countdown animation
    |   |       |-- song_over_button.dart    # Host-only 500ms long-press trigger
    |   |       |-- confetti_layer.dart      # Animated confetti overlay
    |   |       |-- glow_effect.dart         # Radial glow for ceremonies
    |   |       |-- party_card_deal.dart     # Card deal / accept / dismiss / redraw
    |   |       |-- lightstick_mode.dart     # Full-screen glow with color picker
    |   |       |-- hype_signal_button.dart  # Camera flash / screen pulse trigger
    |   |       |-- capture_bubble.dart      # Floating capture prompt
    |   |       |-- capture_overlay.dart     # Active capture UI (photo/video/audio)
    |   |       |-- song_card.dart           # Reusable song card (title, artist, overlap count)
    |   |       |-- tv_pairing_overlay.dart  # Host: YouTube TV code entry
    |   |       |-- playlist_import_card.dart # URL paste + import progress
    |   |       |-- session_card.dart        # Timeline entry card
    |   |       +-- loading_skeleton.dart    # Pulsing logo placeholder
    |   |-- assets/
    |   |   +-- sounds/                      # 10 core audio assets (<500KB total)
    |   |-- test/
    |   |   |-- state/
    |   |   |   |-- party_provider_test.dart
    |   |   |   |-- auth_provider_test.dart
    |   |   |   |-- capture_provider_test.dart
    |   |   |   +-- timeline_provider_test.dart
    |   |   |-- socket/
    |   |   |   +-- client_test.dart         # Event routing to correct providers
    |   |   +-- widgets/
    |   |       |-- song_over_button_test.dart
    |   |       |-- party_card_deal_test.dart
    |   |       +-- countdown_timer_test.dart
    |   |-- dart_defines_local.json.example  # SERVER_URL, FIREBASE_* keys for --dart-define-from-file
    |   |-- pubspec.yaml                     # socket_io_client, firebase_auth, provider, go_router, etc.
    |   |-- analysis_options.yaml            # Dart linter rules
    |   |-- ios/                             # Universal Links config, permissions (camera, mic, flashlight)
    |   +-- android/                         # App Links config, permissions
    |
    |-- server/
    |   |-- src/
    |   |   |-- index.ts                     # Entry: Fastify + Socket.io setup, route/handler registration
    |   |   |-- config.ts                    # Env var loading + Zod validation
    |   |   |-- db/
    |   |   |   |-- connection.ts            # Kysely instance + PostgreSQL dialect
    |   |   |   +-- types.ts                 # Generated by kysely-codegen (DO NOT EDIT)
    |   |   |-- dj-engine/
    |   |   |   |-- types.ts                 # DJState enum, DJTransition, DJContext, TimerConfig
    |   |   |   |-- states.ts                # State definitions (references types.ts)
    |   |   |   |-- machine.ts               # State machine logic (pure functions)
    |   |   |   |-- transitions.ts           # Transition guards and side effects
    |   |   |   |-- timers.ts                # Timer management + crash reconciliation
    |   |   |   +-- serializer.ts            # DJState <-> JSON serialization
    |   |   |-- socket-handlers/
    |   |   |   |-- auth-middleware.ts        # JWT validation (Firebase + guest)
    |   |   |   |-- party-handlers.ts        # party:* events (create, join, end)
    |   |   |   |-- reaction-handlers.ts     # reaction:* events (sent, broadcast, streak)
    |   |   |   |-- ceremony-handlers.ts     # ceremony:* events (anticipation, reveal, quick)
    |   |   |   |-- host-handlers.ts         # host:* events (skip, override, songOver)
    |   |   |   |-- song-handlers.ts         # song:* events (detected, queued, quickpick, spinwheel)
    |   |   |   |-- card-handlers.ts         # card:* events (dealt, accepted, dismissed, redraw)
    |   |   |   |-- capture-handlers.ts      # capture:* events (bubble, started, complete)
    |   |   |   +-- sound-handlers.ts        # sound:* events (play)
    |   |   |-- integrations/
    |   |   |   |-- lounge-api.ts            # YouTube Lounge API client (persistent connection)
    |   |   |   |-- youtube-data.ts          # YouTube Data API v3 (playlist import, search)
    |   |   |   |-- spotify.ts               # Spotify Web API (Client Credentials, playlist import)
    |   |   |   +-- firebase-admin.ts        # Firebase Admin SDK setup (JWT verification)
    |   |   |-- services/
    |   |   |   |-- session-manager.ts       # Session lifecycle orchestration (create, restore, teardown)
    |   |   |   |-- rate-limiter.ts          # Pure rate limiting function
    |   |   |   |-- award-generator.ts       # Award template selection logic
    |   |   |   |-- suggestion-engine.ts     # Intersection-based song suggestions
    |   |   |   |-- event-stream.ts          # In-memory event accumulator
    |   |   |   +-- guest-token.ts           # Server-signed JWT generation (jose)
    |   |   |-- persistence/
    |   |   |   |-- session-repository.ts    # Session CRUD + DJ state upsert
    |   |   |   |-- user-repository.ts       # User CRUD + find-or-create
    |   |   |   |-- catalog-repository.ts    # Karaoke catalog queries + intersection
    |   |   |   +-- media-repository.ts      # Media metadata CRUD + signed URL generation
    |   |   |-- routes/
    |   |   |   |-- sessions.ts              # GET /api/sessions, GET /api/sessions/:id
    |   |   |   |-- playlists.ts             # POST /api/playlists/import
    |   |   |   |-- media.ts                 # GET /api/media/:id/url
    |   |   |   +-- share.ts                 # GET /api/sessions/:id/share (public, no auth)
    |   |   +-- shared/
    |   |       |-- errors.ts                # AppError type + error factory functions
    |   |       |-- events.ts                # Socket.io event name constants
    |   |       +-- schemas/
    |   |           |-- session-schemas.ts    # Zod schemas for /api/sessions
    |   |           |-- playlist-schemas.ts   # Zod schemas for /api/playlists
    |   |           |-- media-schemas.ts      # Zod schemas for /api/media
    |   |           +-- share-schemas.ts      # Zod schemas for /api/sessions/:id/share
    |   |-- kysely.config.ts                   # Kysely CLI configuration (migration path, DB connection)
    |   |-- migrations/
    |   |   +-- 001-initial-schema.ts        # users, sessions, session_participants, media_captures, karaoke_catalog
    |   |-- scripts/
    |   |   +-- catalog-scraper.ts           # Offline karaoke catalog refresh script
    |   |-- tests/
    |   |   |-- factories/
    |   |   |   |-- session.ts               # createTestSession(overrides?)
    |   |   |   |-- participant.ts           # createTestParticipant(overrides?)
    |   |   |   |-- dj-state.ts              # createTestDJState(overrides?)
    |   |   |   +-- user.ts                  # createTestUser(overrides?)
    |   |   |-- dj-engine/
    |   |   |   |-- machine.test.ts
    |   |   |   |-- transitions.test.ts
    |   |   |   |-- timers.test.ts
    |   |   |   +-- serializer.test.ts
    |   |   |-- services/
    |   |   |   |-- rate-limiter.test.ts
    |   |   |   |-- award-generator.test.ts
    |   |   |   +-- suggestion-engine.test.ts
    |   |   |-- socket-handlers/
    |   |   |   +-- auth-middleware.test.ts   # JWT validation paths (Firebase, guest, expired, invalid)
    |   |   +-- persistence/
    |   |       |-- session-repository.test.ts
    |   |       +-- catalog-repository.test.ts
    |   |-- package.json
    |   |-- tsconfig.json                    # strict: true, ESM, noUncheckedIndexedAccess
    |   |-- vitest.config.ts
    |   +-- .env.example                     # DATABASE_URL, JWT_SECRET, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, YOUTUBE_API_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
    |
    +-- web_landing/
    |   |-- index.html                       # Join page: QR/code entry, platform detect, deep link / store redirect
    |   |-- style.css                        # Minimal styling (<50KB total page budget per NFR39)
    |   +-- script.js                        # Deep link logic, platform detection, redirect
    |
    |-- docs/
    |   +-- openapi.json                     # Auto-generated from @fastify/swagger (committed for dart-open-fetch)
    |
    +-- tools/
        +-- generate-dart-types.sh           # Pipeline: build server -> extract OpenAPI -> dart-open-fetch -> copy to flutter_app
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Protocol | Auth | Direction |
|----------|----------|------|-----------|
| Flutter <-> Server (real-time) | Socket.io WebSocket | JWT in handshake auth | Bidirectional |
| Flutter <-> Server (REST) | HTTP/JSON via Fastify routes | Bearer token header | Client -> Server |
| Flutter <-> Firebase Auth | Firebase Flutter SDK | OAuth tokens (Google/Facebook) | Client -> Firebase |
| Flutter <-> Firebase Storage | Firebase Flutter SDK | Firebase auth token | Client -> Firebase |
| Server <-> PostgreSQL | Kysely over pg driver | `DATABASE_URL` connection string | Server -> DB |
| Server <-> Firebase Admin | Firebase Admin SDK | Service account | Server -> Firebase |
| Server <-> YouTube Lounge API | Persistent HTTP (unofficial) | TV pairing code (session-scoped) | Server -> YouTube |
| Server <-> YouTube Data API | REST | API key | Server -> YouTube |
| Server <-> Spotify Web API | REST | Client Credentials token | Server -> Spotify |
| Web Landing <-> Flutter | Deep link (Universal Links / App Links) | None (party code in URL) | Web -> App |

**Component Boundaries (Server):**

```
                    +---------------------------------------------+
                    |               index.ts (entry)              |
                    |     Fastify setup + Socket.io attach        |
                    +----------+--------------+-------------------+
                               |              |
              +----------------v--+     +-----v------------------+
              |   routes/         |     |  socket-handlers/       |
              |  (REST endpoints) |     |  (WS event handlers)    |
              |  Zod validation   |     |  auth-middleware         |
              +--------+----------+     +---------+---------------+
                       |                          |
                       |     +--------------------+
                       |     |                    |
              +--------v-----v--+    +------------v--------------+
              |   services/      |    |    dj-engine/             |
              |  session-manager |    |  (state machine, pure)    |
              |  rate-limiter    |    |  types.ts = shared types  |
              |  award-generator |    |  No DB, no I/O            |
              |  suggestion-eng. |    |  Fully unit testable      |
              |  event-stream    |    +--------------------------+
              |  guest-token     |
              +--------+--------+
                       |
              +--------v--------+    +--------------------------+
              |  persistence/    |    |    integrations/          |
              |  (Kysely queries)|    |  (external API clients)   |
              |  snake_case data |    |  lounge-api, youtube,     |
              |  DB is truth     |    |  spotify, firebase-admin  |
              +-----------------+    +--------------------------+
```

**Key boundary rules:**
- `dj-engine/` has **zero imports** from `persistence/`, `integrations/`, or `socket-handlers/`. It is pure logic, testable without any I/O
- `socket-handlers/` call `services/` and `dj-engine/` -- never `persistence/` directly
- `services/session-manager.ts` is the **only** service that orchestrates across layers (DJ engine + persistence + integrations) for session lifecycle operations (create, restore from DB, teardown)
- `routes/` call `persistence/` directly (REST is simple CRUD) and `services/` for business logic
- `persistence/` is the **only** layer that imports from `db/`. No raw Kysely queries anywhere else
- `integrations/` are called from `services/session-manager.ts` (Lounge API lifecycle) and `routes/` (playlist import) -- never from `dj-engine/`

**Component Boundaries (Flutter):**

```
              +------------------------------+
              |     screens/ (UI layer)       |
              |  Read from providers via      |
              |  context.watch<T>()           |
              |  Emit user actions to socket  |
              +------------------------------+
                             | reads
              +--------------v---------------+
              |     state/ (providers)        |
              |  Reactive state containers    |
              |  Mutated ONLY by SocketClient |
              |  No provider-to-provider deps |
              +--------------^---------------+
                             | mutates
              +--------------+---------------+
              |     socket/client.dart        |
              |  Single Socket.io connection  |
              |  Dispatches events to provs   |
              |  Sends user actions to server |
              +------------------------------+
```

**Data Boundaries:**

| Data Context | Casing | Transformation Point |
|-------------|--------|---------------------|
| PostgreSQL columns | snake_case | -- |
| Kysely types (generated) | snake_case | -- |
| TypeScript services/persistence | snake_case | -- |
| REST JSON responses (Zod) | camelCase | Zod schema `.transform()` in `routes/` |
| Socket.io event payloads | camelCase | Event emission in `socket-handlers/` |
| Dart API types (generated) | camelCase | dart-open-fetch output |
| Dart provider state | camelCase | -- |

### Requirements to Structure Mapping

**FR Category -> Directory Mapping:**

| FR Category | FRs | Server Location | Flutter Location |
|-------------|-----|-----------------|------------------|
| Party Management | FR1-8, FR53, FR106-107 | `socket-handlers/party-handlers.ts`, `services/session-manager.ts`, `persistence/session-repository.ts` | `screens/lobby_screen.dart`, `screens/home_screen.dart`, `state/party_provider.dart` |
| DJ Engine | FR9-15, FR51, FR54 | `dj-engine/*` (all files) | `screens/party_screen.dart` (state switch), `state/party_provider.dart` |
| Audience Reactions | FR22-27 | `socket-handlers/reaction-handlers.ts`, `services/rate-limiter.ts` | `screens/song_screen.dart` (reaction bar) |
| Soundboard | FR28-30 | `socket-handlers/sound-handlers.ts`, `services/rate-limiter.ts` | `screens/song_screen.dart` (soundboard toggle), `audio/engine.dart` |
| Party Cards | FR31-39 | `socket-handlers/card-handlers.ts`, `dj-engine/transitions.ts` | `widgets/party_card_deal.dart`, `constants/copy.dart` (card text) |
| Ceremonies | FR16-21, FR55-58 | `socket-handlers/ceremony-handlers.ts`, `services/award-generator.ts` | `screens/ceremony_screen.dart`, `widgets/confetti_layer.dart`, `widgets/glow_effect.dart` |
| Interludes | FR45-50 | `socket-handlers/party-handlers.ts` (game routing), `dj-engine/machine.ts` | `screens/interlude_screen.dart` |
| Lightstick + Hype | FR59-66 | `socket-handlers/reaction-handlers.ts` | `widgets/lightstick_mode.dart`, `widgets/hype_signal_button.dart` |
| Media Capture | FR67-73 | `socket-handlers/capture-handlers.ts`, `persistence/media-repository.ts` | `widgets/capture_bubble.dart`, `widgets/capture_overlay.dart`, `state/capture_provider.dart` |
| Song Integration | FR74-95 | `integrations/lounge-api.ts`, `integrations/youtube-data.ts`, `integrations/spotify.ts`, `services/suggestion-engine.ts`, `persistence/catalog-repository.ts`, `routes/playlists.ts` | `screens/quick_pick_screen.dart`, `screens/spin_wheel_screen.dart`, `widgets/tv_pairing_overlay.dart`, `widgets/playlist_import_card.dart`, `widgets/song_card.dart` |
| Auth & Identity | FR96-105 | `socket-handlers/auth-middleware.ts`, `services/guest-token.ts`, `persistence/user-repository.ts`, `integrations/firebase-admin.ts` | `state/auth_provider.dart`, `screens/home_screen.dart` (conditional) |
| Session Timeline | FR108-115 | `routes/sessions.ts`, `routes/share.ts`, `persistence/session-repository.ts` | `screens/home_screen.dart` (timeline list), `screens/session_detail_screen.dart`, `state/timeline_provider.dart`, `widgets/session_card.dart` |

**Cross-Cutting Concerns -> Location:**

| Concern | Server Location | Flutter Location |
|---------|-----------------|------------------|
| Full-persistence state sync | `persistence/session-repository.ts` (upsert), `dj-engine/serializer.ts` | -- (server-side only) |
| Session lifecycle orchestration | `services/session-manager.ts` (create, restore, teardown) | -- (server-side only) |
| Auth duality (guest + authenticated) | `socket-handlers/auth-middleware.ts`, `services/guest-token.ts` | `state/auth_provider.dart` |
| Event stream | `services/event-stream.ts` | -- (server-side only) |
| Audio coordination | -- (audio is client-side) | `audio/engine.dart` |
| Rate limiting | `services/rate-limiter.ts` | -- (server-side, client shows reward multiplier) |
| Error handling | `shared/errors.ts` | Provider `LoadingState` enum per operation |
| Vibe system | `persistence/session-repository.ts` (vibe column) | `theme/dj_tokens.dart`, `theme/dj_theme.dart` |
| i18n readiness | -- | `constants/copy.dart` (all strings centralized) |
| Logging + monitoring | Pino (built into Fastify) + Sentry | Sentry Flutter SDK |

### Integration Points

**Internal Communication:**

| From | To | Mechanism | Example |
|------|----|-----------|---------|
| `socket-handlers/party-handlers.ts` | `services/session-manager.ts` | Direct function call | `party:created` -> `sessionManager.create(...)` |
| `services/session-manager.ts` | `dj-engine/machine.ts` | Direct function call | Initialize DJ state for new session |
| `services/session-manager.ts` | `persistence/session-repository.ts` | Direct function call | Persist initial session + DJ state |
| `services/session-manager.ts` | `integrations/lounge-api.ts` | Direct function call | Start/stop Lounge API connection per session |
| `socket-handlers/*` | `services/rate-limiter.ts` | Direct function call | `reaction:sent` -> `checkRateLimit(...)` |
| `socket-handlers/*` | `services/event-stream.ts` | Direct function call | Every handler -> `session.addEvent(...)` |
| `socket-handlers/host-handlers.ts` | `dj-engine/machine.ts` | Direct function call | `host:songOver` -> `transition(state, 'SONG_ENDED')` |
| `dj-engine` result | `persistence/session-repository.ts` | Called by handler after transition | State transition -> async upsert (fire-and-forget) |
| `socket/client.dart` | `state/*_provider.dart` | Method call on provider | Server event -> `partyProvider.onStateChanged(...)` |
| `screens/*.dart` | `socket/client.dart` | Method call | User tap -> `socketClient.emit('reaction:sent', ...)` |
| `screens/*.dart` | `state/*_provider.dart` | `context.watch<T>()` | Widget rebuild on state change |

**External Integrations:**

| Integration | Lifecycle | Error Fallback |
|-------------|-----------|----------------|
| YouTube Lounge API | Persistent connection per session (managed by `session-manager.ts`) | Degrade to suggestion-only mode |
| YouTube Data API v3 | On-demand REST calls (playlist import, catalog refresh) | Cached catalog, offline data |
| Spotify Web API | On-demand REST calls (playlist import) | Skip Spotify suggestions, use YouTube-only pool |
| Firebase Auth | Client SDK (persistent), Admin SDK (per-request JWT verify) | Guest mode (never blocks join) |
| Firebase Storage | Client direct upload (media capture), server generates signed URLs | Queue for retry, never blocks party |
| Railway PostgreSQL | Persistent Kysely connection pool | 3 retries + exponential backoff, log on failure |

### File Organization Patterns

**Zod Schema Organization:**
- One schema file per REST route in `shared/schemas/`
- Schema file exports both request and response schemas for its route
- Route files import from their corresponding schema file
- Schema naming: `{resource}{Action}RequestSchema`, `{resource}{Action}ResponseSchema`

**DJ Engine Type Sharing:**
- `dj-engine/types.ts` is the single source of truth for all DJ-related types
- All other engine files (`states.ts`, `machine.ts`, `transitions.ts`, `timers.ts`, `serializer.ts`) import from `types.ts`
- `socket-handlers/` and `services/` also import DJ types from `dj-engine/types.ts`
- This prevents circular dependencies within the engine module

**Session Manager as Orchestrator:**
- `services/session-manager.ts` is the only service that crosses layer boundaries
- It coordinates: DJ engine initialization, persistence writes, Lounge API connections, event stream setup
- Socket handlers call `session-manager` for lifecycle operations (create, restore, end)
- Socket handlers call individual services directly for in-session operations (rate limiting, award generation)

### Development Workflow Integration

**Type Generation Pipeline:**

```
Server schema change
        |
        v
1. Write Kysely migration (apps/server/migrations/)
2. Run: kysely-ctl migrate
3. Run: kysely-codegen -> updates apps/server/src/db/types.ts
4. Update Zod schemas in apps/server/src/shared/schemas/
5. Run server (generates OpenAPI via @fastify/swagger)
6. Run: tools/generate-dart-types.sh
   -> Extracts docs/openapi.json
   -> Runs dart-open-fetch -> updates apps/flutter_app/lib/api/generated/
7. Commit generated files
```

**Development Servers:**

| Component | Command | Port | Hot Reload |
|-----------|---------|------|------------|
| Flutter app | `flutter run --dart-define-from-file=dart_defines_local.json` | -- (device/emulator) | Yes (Flutter hot reload) |
| Server | `tsx --watch src/index.ts` | 3000 | Yes (file watch restart) |
| Web landing | Open `index.html` in browser | -- (static file) | Manual refresh |

**Build & Deploy:**

| Component | Build | Deploy |
|-----------|-------|--------|
| Server | `tsc` (TypeScript -> JS) | Railway auto-deploy on push to `main` |
| Flutter (Android) | `flutter build apk --release` | Manual upload to Google Play internal testing |
| Flutter (iOS) | `flutter build ipa --release` | Manual upload to TestFlight |
| Web landing | No build step (static) | Served from same Railway domain |
| Catalog refresh | `tsx scripts/catalog-scraper.ts` | Manual run weekly (Railway cron job post-MVP) |

### Monorepo Strategy

**MVP: No monorepo tool.** The three apps (`flutter_app`, `server`, `web_landing`) share zero code and use different build systems (Flutter, tsc, none). A monorepo tool adds configuration overhead without benefit.

**Future extraction path (when admin dashboard or second JS app is added):**
1. Add root `package.json` with `"workspaces": ["apps/server", "apps/admin", "packages/*"]`
2. Extract `apps/server/src/shared/` to `packages/shared-types/` with its own `package.json`
3. Both JS apps import via `"@karamania/shared-types": "workspace:*"`
4. Optional: add `turbo.json` for orchestrated builds

The current `shared/` directory structure is already organized for clean extraction. Flutter remains unaffected -- it consumes server types via dart-open-fetch (OpenAPI -> Dart), not npm packages.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
All technology choices are mutually compatible and version-verified:
- Flutter 3.41.2 + Dart 3.x + `socket_io_client` + `firebase_auth` + `provider` + `go_router` -- no conflicts
- Node.js 24 LTS + Fastify 5.8.1 + Socket.io 4.x (manual integration, bypassing incompatible plugin) + TypeScript 5.x strict + ESM -- verified compatible
- Kysely + `kysely-codegen` + PostgreSQL + JSONB -- type-safe, no ORM conflicts
- Zod + `fastify-type-provider-zod` v6.1.0 + `@fastify/swagger` -- confirmed Fastify 5 compatible
- Firebase Auth (client SDK) + Firebase Admin SDK (server) + `jose` (guest JWT) -- complementary, no overlap

**Pattern Consistency:**
- Naming conventions are internally consistent: snake_case DB -> snake_case TypeScript data layer -> camelCase at REST/Socket.io boundary -> camelCase Dart. One transformation point, clearly documented
- `namespace:action` Socket.io convention is consistently applied across all 10 event namespaces
- Handler registration pattern (`registerXHandlers(socket, session)`) is uniform across all socket handler files
- Provider pattern (read-only from widgets, mutated only by SocketClient) is consistent and prevents state management conflicts

**Structure Alignment:**
- Project structure directly reflects boundary rules: `dj-engine/` has zero I/O imports, `persistence/` is the only Kysely consumer, `session-manager.ts` is the only cross-layer orchestrator
- Test structure mirrors source structure per enforcement guidelines
- Zod schemas split per route, matching route file organization

No contradictory decisions found.

### Requirements Coverage Validation

**Functional Requirements Coverage (115 FRs):**

| FR Category | FRs | Architectural Support | Status |
|-------------|-----|----------------------|--------|
| Party Management | FR1-8, FR53, FR106-107 | Socket.io handlers, session-manager, web landing page deep links | Covered |
| DJ Engine | FR9-15, FR51, FR54 | Pure state machine in `dj-engine/`, server-authoritative, full persistence | Covered |
| Performance & Spotlight | FR16-21, FR55-62 | Ceremony handlers, award-generator service, party card handlers | Covered |
| Audience Participation | FR22-28b | Reaction handlers, rate-limiter, sound handlers, audio engine | Covered |
| Audience Modes | FR63-66 | Reaction handlers (lightstick, hype signal events) | Covered |
| Media Capture | FR67-73 | Capture handlers, media-repository, Firebase Storage, capture_provider | Covered |
| Song Integration | FR74-95 | Lounge API, YouTube Data, Spotify integrations, suggestion-engine, catalog-repository | Covered |
| Auth & Identity | FR96-105 | Auth middleware, guest-token service, Firebase Admin, user-repository | Covered |
| Session Timeline | FR108-115 | REST routes (sessions, share), session-repository, timeline_provider | Covered |
| Host Controls | FR29-33 | Host handlers (Socket.io), host control widget | Covered |
| Memory & Sharing | FR34-39, FR52 | Award-generator, capture system, REST share endpoint | Covered |
| Session Intelligence | FR40-44 | Event stream service, participation scoring in handlers | Covered |
| Connection & Resilience | FR45-50 | Socket.io reconnection, three-tier model, heartbeat, wake lock | Covered |

All 115 FRs have architectural support. No gaps.

**Non-Functional Requirements Coverage (39 NFRs):**

| NFR | Requirement | Architectural Support | Status |
|-----|------------|----------------------|--------|
| NFR1-2 | 200ms state sync, 100ms reactions | Socket.io direct emit, no intermediate layers | Covered |
| NFR3, NFR6 | 50ms audio playback | Native audio engine with bundled pre-loaded assets | Covered |
| NFR4 | 3s ceremony completion | Award-generator is pure function, no I/O in hot path | Covered |
| NFR5 | 60fps with 12 participants | Flutter native rendering, rate limiter prevents spam | Covered |
| NFR7 | <50MB app size | Flutter AOT + <500KB audio assets | Covered |
| NFR8-9 | DJ resilience, reconnection | Server-authoritative, three-tier reconnection model | Covered |
| NFR10 | Server-recoverable state | Full persistence model (write-on-transition to PostgreSQL) | Covered |
| NFR11 | Concurrent vote handling | Server-authoritative vote counting in handlers | Covered |
| NFR12 | Low participant degradation | DJ engine transition guards check participant count | Covered |
| NFR13 | Server restart recovery | Architecture supersedes PRD: full persistence at MVP (see State Architecture section) | Covered |
| NFR14-20 | Usability constraints | Flutter widget patterns, DJTokens spacing, copy.dart centralization | Covered |
| NFR21-25 | Security | Session isolation, auth middleware, rate limiter, party code expiry | Covered |
| NFR26-27 | Event logging <5ms, ceremony sync | In-memory event stream (array push), server-coordinated timestamps | Covered |
| NFR28 | <15MB memory growth over 3hrs | No memory leaks: event cleanup, connection cleanup in session teardown | Covered |
| NFR29-33 | Song integration performance | Batched API calls, pre-built catalog, server-side Spotify tokens | Covered |
| NFR34-37 | Auth & persistence | JWT handshake, guest upgrade without disconnect, async writes, signed URLs | Covered |
| NFR38-39 | i18n readiness, web landing <50KB | `copy.dart` centralization, plain HTML/JS landing page | Covered |

### Implementation Readiness Validation

**Decision Completeness:**
- All critical decisions include specific library versions
- Implementation patterns include code examples for every major pattern (handler registration, provider updates, rate limiter, test factories, event stream types)
- 15 enforcement guidelines provide clear rules for AI agents
- Anti-patterns table gives concrete "wrong vs right" examples

**Structure Completeness:**
- Complete directory tree with every file named and annotated
- All 115 FRs mapped to specific server and Flutter locations
- Cross-cutting concerns mapped to their implementation files
- Integration points documented with mechanism and direction

**Pattern Completeness:**
- Naming conventions cover all 4 layers (DB, TypeScript, Dart, JSON/API)
- Communication patterns cover both REST and Socket.io with format examples
- Process patterns cover loading states, error recovery, validation timing, and dependency stubs
- Testing patterns cover factories, isolation, and what NOT to test

### Gap Analysis Results

**Critical Gaps: None.**

**Important Gaps (resolved during validation):**

1. **Host transfer logic (FR49):** FR49 specifies "host controls transfer to next-longest-connected participant after 60s host absence." **Resolution:** `services/session-manager.ts` owns host transfer as part of session lifecycle. Timer fires on host disconnect, checked against the 60s threshold
2. **Wake lock (FR50):** Preventing screen auto-lock during active participation. **Resolution:** `wakelock_plus` package in pubspec.yaml, managed by `PartyProvider` -- acquire on party join, release on party end or background
3. **Post-session feedback (FR43, FR52):** The "Would you use again?" North Star metric needs storage. **Resolution:** `feedback_score` column added to `session_participants` table (integer 1-5, nullable). Written as part of session summary at party end -- no separate endpoint needed
4. **Venue name (FR99, FR108, FR112):** Referenced in session summaries, timeline, and invites but no storage column. **Resolution:** Add `venue_name` (nullable text) to `sessions` table. Optional text input in lobby screen

**Nice-to-Have Gaps: None remaining.**

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed (115 FRs, 39 NFRs, 4 personas, 6 user journeys)
- [x] Scale and complexity assessed (medium-high, ~15 server modules, ~12 screens, ~25 widgets)
- [x] Technical constraints identified (solo dev, Flutter native, unofficial Lounge API, budget Android devices)
- [x] Cross-cutting concerns mapped (11 concerns with implementation locations)

**Architectural Decisions**

- [x] Critical decisions documented with verified versions (Fastify 5.8.1, Socket.io 4.x, Kysely, Zod, etc.)
- [x] Technology stack fully specified (Flutter + Node.js + PostgreSQL + Firebase)
- [x] Integration patterns defined (6 external services, all with fallback paths)
- [x] Performance considerations addressed (latency budgets, audio architecture, rate limiting)

**Implementation Patterns**

- [x] Naming conventions established (DB, TypeScript, Dart, JSON -- 4 layers, one transformation point)
- [x] Structure patterns defined (server directory, Flutter scaffold, test mirroring)
- [x] Communication patterns specified (REST format, Socket.io event format, null handling)
- [x] Process patterns documented (loading states, error recovery, validation timing, dependency stubs)

**Project Structure**

- [x] Complete directory structure defined (every file named and annotated)
- [x] Component boundaries established (server layers, Flutter layers, boundary rules)
- [x] Integration points mapped (internal + external, with mechanism and direction)
- [x] Requirements to structure mapping complete (all 115 FRs mapped)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Server-authoritative design eliminates entire classes of client-side state bugs
- Full persistence model (write-on-transition) exceeds PRD requirements and provides crash recovery from day one
- DJ engine as pure functions enables 100% unit test coverage of core game logic
- Clear boundary rules prevent the most common AI agent mistakes (god files, circular dependencies, mixed concerns)
- Type generation pipelines (kysely-codegen for DB, dart-open-fetch for REST) eliminate manual type sync
- Every FR and NFR has a mapped implementation location -- no ambiguity about "where does this go?"

**Areas for Future Enhancement:**
- Socket.io event payload codegen (compile-time type safety between server and Flutter) -- deferred to v2
- Horizontal scaling architecture (Redis adapter, sticky sessions) -- deferred to v4
- Incremental event stream flush (periodic background writes) -- deferred to v2
- Monorepo tooling (pnpm workspaces + Turborepo) -- when admin dashboard or second JS app is added

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented in this file
- Use implementation patterns consistently across all components
- Respect project structure and component boundaries -- no new top-level directories without architecture doc update
- Reference the enforcement guidelines (15 rules) and anti-patterns table for every implementation decision
- When in doubt, the architecture document is the source of truth for "how" and "where"
- This architecture supersedes the PRD on persistence scope (NFR13) -- full persistence is MVP

**Test Execution:**
- Server: `npm test` (mapped to `vitest run` in package.json scripts)
- Flutter: `flutter test`
- CI: both run in parallel via `server-ci.yml` and `flutter-ci.yml`

**Database Test Strategy:**
- Each persistence test creates a Kysely transaction, runs queries within it, and rolls back after completion
- Test database provisioned via `DATABASE_URL_TEST` env var pointing to a separate PostgreSQL database
- Migrations run before test suite via `kysely-ctl migrate` against the test database
- No test data persists between test runs -- transaction rollback guarantees isolation

**First Implementation Priority:**

```bash
# 1. Initialize monorepo structure
mkdir karamania && cd karamania && git init

# 2. Flutter app
flutter create --org com.karamania --project-name karamania apps/flutter_app

# 3. Node.js server
mkdir -p apps/server && cd apps/server
npm init -y
npm install fastify@5 socket.io typescript @types/node kysely pg jose zod @fastify/swagger
npm install -D tsx vitest kysely-codegen kysely-ctl @fastify/type-provider-zod
npx tsc --init  # Configure: strict, ESM, noUncheckedIndexedAccess

# 4. Create server directory structure per architecture doc
mkdir -p src/{db,dj-engine,socket-handlers,integrations,services,persistence,routes,shared/schemas}
mkdir -p migrations scripts tests/{factories,dj-engine,services,socket-handlers,persistence}

# 5. Create entry point and config
# src/index.ts (Fastify + Socket.io setup)
# src/config.ts (env var loading)
# kysely.config.ts (Kysely CLI configuration)

# 6. Web landing page
mkdir -p apps/web_landing

# 7. First migration: create initial schema
# (users, sessions, session_participants, media_captures, karaoke_catalog)

# 8. Generate types
# kysely-ctl migrate && kysely-codegen

# 9. Firebase project setup + FlutterFire CLI
```

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-03-06
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**

- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**

- 20+ architectural decisions made (language, framework, database, auth, real-time, state management, persistence, routing, validation, monitoring, CI/CD, type generation)
- 15 enforcement guidelines + anti-patterns table for AI agent consistency
- 3 architectural layers with clear boundary rules (server) + 3 Flutter layers
- 115 FRs + 39 NFRs fully supported with mapped implementation locations

### Quality Assurance Checklist

**Architecture Coherence**

- [x] All decisions work together without conflicts
- [x] Technology choices are compatible (versions verified)
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**Requirements Coverage**

- [x] All 115 functional requirements are supported
- [x] All 39 non-functional requirements are addressed
- [x] 11 cross-cutting concerns are handled with implementation locations
- [x] 10 external integration points are defined with fallback paths

**Implementation Readiness**

- [x] Decisions are specific and actionable (versions, library names, config options)
- [x] Patterns prevent agent conflicts (15 enforcement guidelines)
- [x] Structure is complete and unambiguous (every file named and annotated)
- [x] Code examples provided for all major patterns

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Create epics and stories, then begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

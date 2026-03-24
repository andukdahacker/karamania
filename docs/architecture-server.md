# Karamania Server — Architecture Document

## Overview

The Karamania server is a Fastify 5 + Socket.IO backend written in TypeScript (ES2022, strict mode). It provides REST API endpoints for session management, user profiles, and media operations, plus real-time WebSocket communication for the interactive party experience. At its core is a pure, immutable DJ state machine that orchestrates party flow through 8 distinct states.

## Technology Stack

| Category | Technology | Version | Justification |
|----------|-----------|---------|---------------|
| Framework | Fastify 5 | ^5.8.1 | High-performance HTTP, plugin architecture |
| Language | TypeScript | ^5.9.3 | Type safety, ES2022 target |
| Real-time | Socket.IO | ^4.8.3 | WebSocket with fallback, room-based broadcast |
| Database | PostgreSQL 16 | — | JSONB for flexible state, ACID compliance |
| ORM | Kysely | ^0.28.11 | Type-safe SQL query builder |
| Validation | Zod v4 | ^4.3.6 | Runtime validation + TypeScript inference |
| Auth | Firebase Admin + jose | ^13.7.0 / ^6.2.0 | Dual-path (Firebase + guest JWT) |
| API Docs | @fastify/swagger | ^9.7.0 | OpenAPI spec generation |
| Testing | Vitest | ^4.0.18 | Fast test runner with native ESM support |

## Architecture Pattern

**Event-driven with pure state machine core.**

```
┌─────────────────────────────────────────────────────────┐
│                    Socket.IO Layer                       │
│  15 handler modules (auth, party, host, song, etc.)     │
├─────────────────────────────────────────────────────────┤
│                    REST API Layer                        │
│  12 route modules (auth, sessions, catalog, etc.)       │
├─────────────────────────────────────────────────────────┤
│              Session Manager (Orchestrator)              │
│  Central hub: transitions, ceremonies, interludes, etc.  │
├────────────────┬────────────────────────────────────────┤
│   DJ Engine    │         36 Service Modules             │
│  Pure state    │  Rate limiter, peak detector,          │
│  machine       │  award generator, dealers, etc.        │
│  (zero deps)   │  (20+ in-memory Map stores)            │
├────────────────┴────────────────────────────────────────┤
│                  Persistence Layer                       │
│  4 repositories (Kysely): sessions, users, catalog,     │
│  media captures                                         │
├─────────────────────────────────────────────────────────┤
│                  Integration Layer                       │
│  Firebase Admin, YouTube Lounge, YouTube Data,           │
│  Spotify Web API                                        │
├─────────────────────────────────────────────────────────┤
│                  PostgreSQL 16                           │
│  5 tables + JSONB (dj_state, event_stream, summary)     │
└─────────────────────────────────────────────────────────┘
```

## DJ Engine — Pure State Machine

The DJ engine (`src/dj-engine/`) is the architectural centerpiece. It has **zero external dependencies** and uses immutable context snapshots.

### 8 DJ States

| State | Timeout | Purpose |
|-------|---------|---------|
| `lobby` | None | Pre-game setup, waiting for participants |
| `icebreaker` | 6s | First-session question voting |
| `songSelection` | 15s | Quick Pick voting or Spin the Wheel |
| `partyCardDeal` | 15s | Random party card display + interaction |
| `song` | 180s | Active karaoke performance |
| `ceremony` | 12s | Award reveal (2s anticipation + 10s reveal) |
| `interlude` | 15s | Activity voting + mini-games |
| `finale` | None | End-of-session awards and summary (terminal) |

### Core Cycle

```
songSelection → partyCardDeal → song → ceremony → interlude → songSelection (repeat)
```

**NFR12 Degradation:** With <3 participants, `partyCardDeal` and `interlude` are skipped.

### Ceremony Type Selection (priority order)
1. <3 participants → quick
2. First song (songCount === 1) → full
3. After song 5 → quick
4. Post-interlude AND last wasn't full → full
5. Last ceremony was full → quick
6. Default → full

### Side Effects (data, not execution)
The state machine returns side effects as data structures — the caller (session-manager) executes them:
- `broadcast` — notify clients of state change
- `scheduleTimer` — request timer scheduling
- `cancelTimer` — request timer cancellation
- `persist` — persist context to database

## Data Architecture

### Database Schema (5 tables)

**users**
- `id` (UUID PK), `firebase_uid` (unique, nullable for guests)
- `display_name`, `avatar_url`, `created_at`

**sessions**
- `id` (UUID PK), `host_user_id` (FK → users)
- `party_code` (unique partial index on active sessions)
- `status` (lobby | active | paused | ended)
- `dj_state` (JSONB — serialized DJContext)
- `event_stream` (JSONB — append-only event log)
- `summary` (JSONB — finale session summary)
- `vibe`, `venue_name`, `created_at`, `ended_at`

**session_participants**
- `id` (UUID PK), `session_id` (FK), `user_id` (FK, nullable)
- `guest_name` (nullable), unique on `COALESCE(user_id, guest_name)` per session
- `participation_score`, `top_award`, `feedback_score` (1-5)

**media_captures**
- `id` (UUID PK), `session_id` (FK), `user_id` (FK, nullable)
- `storage_path`, `trigger_type`, `dj_state_at_capture` (JSONB)

**karaoke_catalog**
- `id` (UUID PK), `youtube_video_id` (unique)
- `song_title`, `artist`, `channel`, `is_classic`

### In-Memory State (20+ Module-level Maps)

The server maintains extensive in-memory state for real-time performance:

| Store | Module | Key | Purpose |
|-------|--------|-----|---------|
| DJ contexts | `dj-state-store` | sessionId | Active party state |
| Connections | `connection-tracker` | sessionId → userId | Online tracking |
| Event streams | `event-stream` | sessionId | Audit trail (60+ types) |
| Song pools | `song-pool` | sessionId | Imported songs |
| Quick pick rounds | `quick-pick` | sessionId | Song vote state |
| Spin wheel rounds | `spin-wheel` | sessionId | Wheel animation state |
| Activity votes | `activity-voter` | sessionId | Interlude voting |
| Streak tracking | `streak-tracker` | sessionId:userId | Reaction streaks |
| Peak detection | `peak-detector` | sessionId | Reaction spike analysis |
| Rate limits | `rate-limiter` | userId | Event throttling |
| Dealt cards | `card-dealer` | sessionId | Card dedup |
| Timers | `timer-scheduler` | sessionId | setTimeout with pause/resume |
| Scores | `session-manager` | sessionId → userId | Participation scores |

## API Design

### REST Endpoints (21 total)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | None | Health check + DB status |
| POST | `/api/auth/guest` | None | Guest auth for party join |
| POST | `/api/sessions` | Optional | Create session (Firebase or guest host) |
| GET | `/api/sessions` | Required | List user's past sessions |
| GET | `/api/sessions/:id` | Required | Session detail (host only) |
| GET | `/api/sessions/:id/share` | None | Public session sharing |
| GET | `/api/catalog/search` | None | Song search (ILIKE) |
| GET | `/api/catalog/stats` | None | Catalog statistics |
| GET | `/api/catalog/classics` | None | Classic songs |
| POST | `/api/playlists/import` | Optional | Spotify/YouTube playlist import |
| GET | `/api/sessions/:id/suggestions` | Required | Song recommendations |
| POST | `/api/sessions/:id/captures` | None | Create capture metadata |
| GET | `/api/sessions/:id/captures` | Required | List session captures |
| GET | `/api/sessions/:id/captures/:cid/upload-url` | Required | Signed upload URL |
| GET | `/api/sessions/:id/captures/:cid/download-url` | Required | Signed download URL |
| GET | `/api/users/me` | Required | User profile |
| POST | `/api/users/upgrade` | Required | Guest-to-account upgrade |
| GET | `/api/users/me/media` | Required | User media gallery |
| GET | `/openapi.json` | None | OpenAPI spec |
| GET | `/.well-known/*` | None | Deep linking configs |
| GET | `/*` | None | Static web landing |

### Socket.IO Events (50+ event types)

**Categories:**
- Party lifecycle (join, start, end, participant management)
- DJ state transitions
- Song selection (quick pick, spin wheel, mode change)
- Reactions (send, broadcast, streaks)
- Soundboard
- Party cards (deal, accept, dismiss, redraw, group activation)
- Ceremonies (anticipation, reveal, quick)
- Interludes (vote, game start/end, quick vote)
- Icebreaker (start, vote, result)
- Finale (awards, stats, setlist, feedback)
- TV (pair, unpair, status, now playing)
- Captures (bubble, started, complete, persisted)
- Auth (upgrade, refresh required)

## Authentication Architecture

**Dual-path authentication:**

1. **Firebase Auth** — Authenticated users (Google sign-in)
   - Client sends Firebase ID token
   - Server verifies via Firebase Admin SDK
   - Creates/upserts user in PostgreSQL
   - Full access to session history, media gallery, profile

2. **Guest JWT** — Anonymous party access
   - Server generates HS256 token with 6h expiration
   - Payload: guestId (UUID), sessionId, role: 'guest'
   - Access limited to active session
   - Upgradeable to Firebase account mid-session

**Socket.IO middleware** validates both token types on connection, joining the socket to the sessionId room.

## Participation Scoring

Three tiers with rate-limiting multiplier:

| Tier | Points | Actions |
|------|--------|---------|
| Passive (1pt) | party joined, session present, lightstick toggle, votes |
| Active (3pts) | vibe change, reactions, sounds, hype, interlude votes |
| Engaged (5pts) | card accepted/completed, song queued |

Rate limiter: 5s window, <10 events = full credit, 10-20 = degraded multiplier (0.5^overage), ≥20 = blocked.

## Session Recovery

On server startup, `recoverActiveSessions()` reloads active sessions from the database, restoring DJ contexts to the in-memory store. Timer remaining durations are recalculated from persisted timestamps.

## Testing Strategy

- **89 test files** organized by domain (routes, socket-handlers, services, persistence, dj-engine, integrations, shared)
- **Vitest** with mock-based unit tests + real PostgreSQL integration test (migrations)
- **Flexible query chain pattern** for Kysely repository mocking
- **Test factories** for consistent test data generation
- **CI:** GitHub Actions with PostgreSQL 16 service container, Node 24

## Deployment

- **Runtime:** Railway (Node.js + PostgreSQL)
- **Migrations:** `npx kysely migrate:latest` (pre-deploy or Railway shell)
- **Environment:** 12 required env vars (DATABASE_URL, JWT_SECRET, Firebase, YouTube, Spotify)
- **Local:** Docker Compose for PostgreSQL, `npm run dev` with tsx --watch

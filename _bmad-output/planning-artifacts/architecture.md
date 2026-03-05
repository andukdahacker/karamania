---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-karaoke-party-app-2026-03-04.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/ux-design-directions.html'
  - '_bmad-output/planning-artifacts/research/market-karaoke-party-companion-research-2026-03-03.md'
  - '_bmad-output/analysis/brainstorming-session-2026-03-05.md'
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-03-05'
project_name: 'karaoke-party-app'
user_name: 'Ducdo'
date: '2026-03-05'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (112 FRs across 12 categories):**

**Tier 0 — Architectural Foundation (drive the hardest decisions):**

| Category | FRs | Architectural Weight |
|----------|-----|---------------------|
| DJ Engine & Party Flow | FR9-FR15, FR51, FR54 | Server-side state machine — 12+ states, 30+ transitions, guards, timeouts, ceremony sub-states, pause/resume. THE core architectural component. Everything downstream depends on this |
| Connection & Resilience | FR45-FR50 | WebSocket infrastructure, three-tier reconnection, heartbeat, host failover, per-client event buffer. The delivery mechanism for all state machine decisions |
| Session Intelligence | FR40-FR44 | Event stream foundation — every action logged as `{sessionId, userId, eventType, timestamp, metadata}`. Also the observability layer that makes silent error absorption debuggable |

**Tier 1 — Core Experience (substantial architectural surface):**

| Category | FRs | Architectural Weight |
|----------|-----|---------------------|
| Performance & Spotlight | FR16-FR21 | Ceremony sub-states (voting → silence → reveal), stagger model, server-coordinated timing, award generation |
| Audience Participation | FR22-FR28b | Real-time broadcast (<100ms), soundboard audio, reaction streaks, interlude game library |
| Party Cards | FR55-FR62 | Card pool management, deal/accept/dismiss/redraw flow, group involvement participant selection |
| Media Capture | FR67-FR73 | getUserMedia, MediaRecorder, iOS fallback, background upload queue, server-side peak detection |
| Host Controls | FR29-FR33 | Divergent UI (host overlay), state override, targeted Socket.io emits |
| Memory & Sharing | FR34-FR39, FR52 | Moment card generation, share intent, setlist poster, finale sequence |

**Tier 2 — Architecturally Additive (slot into whatever architecture Tier 0 establishes):**

| Category | FRs | Architectural Weight |
|----------|-----|---------------------|
| Party Management | FR1-FR8, FR53 | Session lifecycle, QR/code join, WebSocket connection setup — important but architecturally straightforward |
| Audience Modes | FR63-FR66 | Lightstick rendering (GPU animation), hype signal (torch API) — client-side only, no server architecture impact |
| Song Integration | FR74-FR95 | Lounge API, YouTube Data API, Spotify API, catalog index, suggestion algorithm — architecturally significant but Sprint 3 additive. Does NOT change foundation |

**Non-Functional Requirements (38 NFRs across 6 categories):**

| Category | Key Constraints |
|----------|----------------|
| Performance (9) | <200ms state sync, <100ms reactions, <50ms audio, 60fps with 12 clients, <100KB JS bundle |
| Reliability (7) | Zero single points of failure, race-condition-safe voting, graceful degradation below 3 players |
| Usability (7) | Single-tap interactions ≥48px, no text input beyond name, WCAG AA contrast, audio-first state transitions |
| Security (5) | Session isolation, no PII, rate limiting with diminishing returns, WebSocket authentication |
| Song Integration (5) | 5s playlist import, 10K YouTube API quota/day, graceful Lounge API failure, server-side catalog, server-side Spotify tokens |

**Scale & Complexity:**

- **Primary domain:** Real-time PWA — server-authoritative WebSocket architecture
- **Complexity level:** Medium-High
- **Estimated architectural components:** ~8 server-side modules, ~34 client components, 3 external API integrations, 1 persistent unofficial API integration
- **Concurrency model:** Single-process Node.js handling ~10-50 concurrent parties (8 phones each) at MVP scale. Documented ceiling at ~6,250 concurrent parties before horizontal scaling needed

### Technical Constraints & Dependencies

| Constraint | Impact | Source |
|-----------|--------|--------|
| PWA (no native app) | No push notifications, limited background processing, iOS capture limitations | Product Brief |
| Chrome ≥90, iOS Safari ≥15.4 | Browser API surface defined — Web Audio, WebSocket, getUserMedia, Screen Wake Lock | PRD |
| Server-authoritative state machine | All phones are thin clients. No client-side state transitions. Server is single source of truth | PRD, UX Spec |
| YouTube Lounge API (unofficial) | Could break at any time. Must abstract behind interface. Suggestion-only fallback required. **Persistent bidirectional connection** — fundamentally different from request/response APIs | Brainstorming |
| YouTube Data API v3 free tier | 10,000 units/day. Must batch efficiently — <500 units per party session | PRD NFR30 |
| Spotify Client Credentials flow | Public playlists only. No user OAuth. Server-side token management | PRD FR82, NFR33 |
| Firebase (Auth + Storage) | Social OAuth via Firebase Auth (50K MAU free). Firebase Storage for media captures (5GB free, $0.026/GB). Firebase Blaze plan (pay-as-you-go) required | Architecture Decision |
| Railway PostgreSQL | Managed PostgreSQL co-located with Node.js server. ~$0.55-5/month for small workloads | Architecture Decision |
| Solo developer | Single-process, boring tech, no microservices. Document the scaling wall, don't architect past it | Product Brief |
| Vietnam primary market | Budget Android devices (Galaxy A series, 3GB RAM), unreliable venue WiFi, Vietnamese diacritics in fonts | PRD, Market Research |
| iOS Safari quirks | AudioContext unlock on tap, WebSocket suspension on screen lock, video capture via native picker | PRD |
| Mobile-only portrait | No responsive breakpoints. 360-412px width range. No desktop, no tablet | UX Spec |

**Notably Absent (keeps architecture focused):**
- No multi-region deployment needs
- No payment/billing infrastructure
- No regulatory compliance beyond basic data privacy (no health/finance data)

**Present but managed (Firebase + Railway handle complexity):**
- Authentication via Firebase Auth (social OAuth + anonymous guest join) — no custom auth system to build or maintain
- User data persistence via Railway PostgreSQL — party history, profiles, highlight reel metadata. Co-located with server
- Media storage via Firebase Storage — linked to user profiles and party sessions
- All real-time game state remains in-memory on custom Node.js server — Firebase handles identity and storage, Railway PG handles persistence

### Cross-Cutting Concerns Identified

0. **DJ state machine integrity** — Concern #0, not just cross-cutting but foundational. If the state machine has bugs, nothing else matters. Every other concern is a delivery mechanism for state machine decisions. Pure JS, deterministic transitions, 100% unit test coverage justified
1. **Real-time synchronization** — Every feature depends on WebSocket state sync. Ceremony reveals require ±200ms cross-device coordination via server-sent timestamps
2. **Session lifecycle management** — Party creation, per-client event buffers for reconnection replay, buffer TTLs, memory ceilings, session cleanup on end/timeout. A 3-hour session with 12 phones generates thousands of buffered events — needs explicit memory bounds
3. **Three-tier reconnection** — Brief (<5s: transparent replay from buffer), Medium (5-60s: state snapshot), Long (>60s: full sync). Must work across all DJ states
4. **Web Audio lifecycle** — iOS AudioContext unlock on first tap, lazy buffer loading by DJ state, max 2 concurrent sources, new-source-preempts-oldest policy
5. **Silent error absorption + observability** — No error toasts, no retry buttons (Vietnamese social context: showing errors during a party is embarrassing). **Paired requirement:** event stream logging (FR42) is the debugging strategy. Every silent failure must be logged to the event stream. Without this pairing, a dev agent will build error absorption without corresponding observability
6. **Host/participant divergence** — 5 host-unique interactions (Song Over, Start Party, TV pairing, Now Playing, host controls). Same codebase, targeted Socket.io emits
7. **Graceful degradation cascade** — TV-paired ↔ suggestion-only, inline capture ↔ native picker, full ceremony ↔ quick ↔ skip, 12-person ↔ 3-person reduced mode
8. **Battery and performance budgets** — RAF dormancy during song state, adaptive heartbeat (5s/15s), wake lock release when watching TV, 30-particle confetti cap, <100KB JS
9. **Mock boundaries and testability** — The Lounge API has no sandbox or test environment — behavior only verifiable against a real YouTube TV. Architecture must define explicit stub points: Lounge API adapter interface, YouTube Data API response mocks, Spotify API response mocks. Request/response APIs (YouTube Data, Spotify, MusicBrainz) are straightforward to mock. The Lounge API persistent connection requires a dedicated mock that simulates nowPlaying events and queue responses

## Starter Template Evaluation

### Primary Technology Domain

**Real-time PWA with server-authoritative WebSocket architecture** — a split client/server codebase where the client is a thin Svelte UI and the server owns all state transitions. Not a traditional full-stack framework pattern — no SSR, no file-based routing, no database ORM. The primary technology split is:

- **Client:** Svelte 5 SPA via Vite (plain, not SvelteKit)
- **Server:** Node.js + Socket.io (vanilla Express or bare http)
- **Monorepo:** pnpm workspaces + Turborepo

### Starter Options Considered

| Option | Evaluation | Verdict |
|--------|-----------|---------|
| **SvelteKit** | Full-stack framework with SSR, file-based routing, adapters. Overkill — we need zero routing, zero SSR, zero server-side rendering. Adds complexity we'd immediately disable. User explicitly rejected | ❌ Rejected |
| **T3 Stack / RedwoodJS / Blitz** | React-centric full-stack starters. Wrong ecosystem, wrong framework | ❌ Wrong stack |
| **Custom monorepo from scratch** | Maximum control but high boilerplate cost. No standard template exists for Svelte+Socket.io monorepo | ⚠️ Fallback |
| **`create vite` svelte-ts + manual monorepo** | Vite's official Svelte+TypeScript template for client package. Manually scaffold server package. Wire together with pnpm workspaces + Turborepo | ✅ Selected |

No existing monorepo starter template combines Svelte 5 + Socket.io + TypeScript in a ready-made scaffold. The right approach is composing from well-maintained individual pieces rather than forcing a framework that fights the architecture.

### Selected Starter: Composed Monorepo

**Rationale:** There is no single "create" command that produces a Svelte+Socket.io monorepo. Instead, we compose from battle-tested parts:

1. **Client package** scaffolded with `create vite` (official, actively maintained by Vite team)
2. **Server package** hand-scaffolded (Express/http + Socket.io is too simple to need a generator)
3. **Monorepo glue** via pnpm workspaces + Turborepo (industry standard for TypeScript monorepos)

This is the "boring tech" philosophy from the Product Brief — no framework magic, no hidden conventions, every line of configuration visible and debuggable.

**Initialization Sequence:**

```bash
# 1. Initialize monorepo root
mkdir karamania && cd karamania
pnpm init
npx create-turbo@latest --skip-install

# 2. Scaffold client package
cd packages
npm create vite@latest client -- --template svelte-ts
cd client && pnpm install

# 3. Scaffold server package (manual)
mkdir -p ../server/src
cd ../server
pnpm init
# Add dependencies: socket.io, express (or bare http)
# Add devDependencies: typescript, vitest, tsx

# 4. Optional: shared types package
mkdir -p ../shared/src
cd ../shared
pnpm init
# Shared TypeScript interfaces for Socket.io events, DJ states, etc.
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
- TypeScript 5.x across all packages (strict mode)
- Node.js 22 LTS (server runtime)
- ES modules throughout (`"type": "module"`)
- Shared `tsconfig.base.json` at monorepo root, extended per package

**Styling Solution:**
- Tailwind CSS v4.2 (added post-scaffold to client package)
- CSS-first configuration (Tailwind v4 uses `@theme` in CSS, no `tailwind.config.js`)
- Space Grotesk + Inter fonts per UX spec design system

**Build Tooling:**
- Vite 7.3 (client dev server + production build)
- Turborepo (monorepo task orchestration — `turbo dev`, `turbo build`, `turbo test`)
- pnpm workspaces (dependency management, workspace protocol `workspace:*`)
- `tsx` for server development (TypeScript execution without build step)

**Testing Framework:**
- Vitest 4.0 (unit tests for both client and server packages)
- Same Vite config pipeline — zero additional test configuration for client
- Server tests: pure unit tests for DJ state machine, Socket.io handler tests with mock transport

**Code Organization:**
```
karamania/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json (root — scripts, devDependencies)
├── tsconfig.base.json
├── packages/
│   ├── client/           # Svelte 5 + Vite SPA
│   │   ├── src/
│   │   │   ├── lib/      # Components, stores, utilities
│   │   │   ├── App.svelte
│   │   │   └── main.ts
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── server/           # Node.js + Socket.io
│   │   ├── src/
│   │   │   ├── dj/       # State machine (Concern #0)
│   │   │   ├── socket/   # WebSocket handlers
│   │   │   ├── api/      # External API adapters
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared/           # Shared TypeScript types
│       ├── src/
│       │   ├── events.ts  # Socket.io event types
│       │   ├── states.ts  # DJ state definitions
│       │   └── index.ts
│       └── package.json
```

**Development Experience:**
- `turbo dev` — runs client Vite dev server + server in watch mode concurrently
- HMR for Svelte components via Vite
- Server auto-restart via `tsx --watch`
- Shared types package means client and server always agree on Socket.io event shapes
- Single `pnpm install` at root installs everything

### Verified Dependency Versions (March 2026)

| Package | Version | Role |
|---------|---------|------|
| Svelte | 5.53.7 | UI framework |
| Vite | 7.3.1 | Client build tool + dev server |
| Socket.io | 4.8.3 | WebSocket transport (client + server) |
| Tailwind CSS | 4.2.0 | Utility-first CSS |
| Vitest | 4.0.18 | Test framework |
| TypeScript | 5.x | Language (exact version from create-vite template) |
| Turborepo | latest | Monorepo orchestration |
| pnpm | 9.x | Package manager |

**Note:** Project initialization using this sequence should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- DJ state machine architecture (hand-rolled pure function with rejection logging)
- Real-time communication protocol (three primitives: BROADCAST_STATE, DELTA_EVENT, COORDINATED_REVEAL)
- Session state model (SessionManager + dual event log)
- Reconnection strategy (cursor-based on stateLog)
- Authentication model (Firebase Auth + guest join)
- Persistence layer (Railway PostgreSQL + Firebase Storage)

**Important Decisions (Shape Architecture):**
- External API integration patterns (LoungeSessionManager vs SongMetadataAdapter split)
- Frontend store architecture (Socket.io-driven Svelte stores)
- Graceful shutdown strategy
- Database schema and ORM choice (Drizzle)

**Deferred Decisions (Post-MVP):**
- CDN split for static client (same-server at MVP, split when traffic justifies)
- Cross-session personalization engine
- Media processing pipeline (highlight reel assembly)

### Authentication & Security

**Firebase Auth from day one.** Two join modes for zero-friction onboarding:

| Mode | Flow | Persistence |
|------|------|-------------|
| **Social login** | Google/Facebook OAuth via Firebase Auth → JWT → full profile | Party history, highlight reels, stats, media linked to account |
| **Guest join** | Name-only → Firebase anonymous auth → temporary JWT | Full in-session participation. Upgradeable to full account to claim highlights |

**Socket.io Handshake with Firebase JWT:**
- Client authenticates with Firebase (OAuth or anonymous) → receives ID token
- Socket.io connection sends `{ firebaseToken, partyCode }` in `auth` handshake
- Server validates JWT via `firebase-admin` SDK → extracts `uid`
- Host privilege: first authenticated user to create party = host. `hostToken` UUID for reconnection privilege restoration
- Guest users receive a server-issued session-scoped token with TTL matching max session duration (6 hours)
- Both token types grant identical in-session permissions — auth status affects persistence only, never in-party capabilities (FR105)

**Session Security:**

| Mechanism | Implementation |
|-----------|---------------|
| Party code | 4-char alphanumeric (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 32 chars, no ambiguous 0/O/1/I/L). Generated server-side, **validated for uniqueness against active session Map** with 3-attempt retry limit |
| Join credential | Party code + Firebase token in Socket.io `auth` handshake. Server validates: party exists, is joinable, player count < 12 |
| Host privilege | Random UUID `hostToken` returned on party creation, stored in host's browser memory. Sent on reconnect for host privilege restoration |
| Rate limiting | Per-socket sliding window: emoji 10/s, soundboard 3/s, global 30/s. Exceeded = silent drop + event stream log (Concern #5) |
| Session isolation | Each party is a Socket.io room. No cross-party data leakage |
| Media access | Authenticated users: own captures + session captures. Guest media: 7-day signed URLs (NFR37) |

### Data Architecture

**Three-layer data model:**

**Layer 1 — In-Memory (custom Node.js server):**
- `SessionManager` class wrapping `Map<string, PartySession>`
- `PartySession` is a plain serializable object (no class instances, no circular refs)
- Manager enforces invariants: max 12 players, valid state transitions, session lifecycle

**Dual Event Log:**
- `stateLog`: DJ state transitions, ceremony results, vote outcomes, player joins/leaves. Low frequency (~50-100/hour). Used for reconnection replay. Capped at 500 entries per session with oldest-trim eviction
- `activityLog`: Reactions, soundboard taps, streaks, captures. High frequency. Observability only — written to `pino`, never used for reconnection replay. Fire-and-forget, no cap needed
- Reconnection cursors track position in `stateLog` only

**Memory Ceilings:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max concurrent sessions | 100 | Well under ~6,250 ceiling. Hard-reject party creation beyond |
| stateLog max per session | 500 events | ~3 hours of DJ transitions. Trim oldest when exceeded |
| stateLog entry max size | 1KB | Guards against oversized metadata |
| Session timeout (host disconnect) | 5 minutes | Long enough for reconnection, short enough to free memory |
| Session timeout (all disconnect) | 2 minutes | No phones = party is dead |
| Session max duration | 4 hours | Hard cap. Auto-triggers finale sequence |
| Memory monitoring | `process.memoryUsage()` every 60s. Warn at 80% of 512MB heap, reject new sessions at 90% | Simple, no external dependency |

**Layer 2 — Railway PostgreSQL (persistent):**

| Table | Purpose | Written When |
|-------|---------|-------------|
| `profiles` | Firebase uid, display name, avatar URL, created_at | On first authenticated login (server upserts) |
| `parties` | Party code, host_uid, started_at, ended_at, settings | Party creation + updated at party end |
| `participants` | uid, party_id, role, joined_at | Player join |
| `session_summaries` | Setlist, awards, stats, ceremony results (JSONB) | Party end (batch write from stateLog) |
| `moments` | Type, timestamp, description, media_url, uid, party_id | Party end (batch write) |
| `media` | storage_path, uid, party_id, moment_type, created_at | Media upload completion |

- Access control enforced in server middleware (all DB queries go through the Node.js server, not direct client→DB)
- DB client: **Drizzle ORM** (lightweight, TypeScript-native, SQL-like — fits "boring tech" philosophy)
- Migrations: Drizzle Kit (`drizzle-kit push` for dev, `drizzle-kit migrate` for production)
- Session summary writes at party end are asynchronous — must not block real-time experience. 3 retries with exponential backoff, fallback to server disk log (FR103, NFR36)

**Layer 3 — Firebase Storage (media):**
- Bucket path: `captures/{partyId}/{uid}/{timestamp}.{ext}`
- Client uploads directly via Firebase JS SDK (offloads bandwidth from Socket.io server)
- Firebase Security Rules: authenticated users can upload to their own path, read media from parties they participated in
- Guest captures: linked to session ID, accessible via 7-day signed URLs
- Post-party browsing: client queries server API for moments → gets Firebase Storage download URLs

### API & Communication Patterns

**Three Communication Primitives:**

| Primitive | Use Case | Pattern |
|-----------|----------|---------|
| `BROADCAST_STATE` | DJ state transitions | Server pushes complete `DJState` object to all sockets in room via single `io.to(roomId).emit('dj:stateChanged', fullState)`. ~1-2KB payload. **All state transitions go through one `broadcastStateChange()` function** — never targeted, always room-wide |
| `DELTA_EVENT` | Emoji reactions, soundboard taps, streaks | Lightweight payloads (`{ userId, emoji, timestamp }`). Ephemeral UI updates. Do not modify DJ state. Not stored in stateLog |
| `COORDINATED_REVEAL` | Ceremony reveals, Spin the Wheel, finale awards | Server emits `{ result, revealAtTimestamp }`. Client calculates local animation duration as `revealAtTimestamp - Date.now()` and parameterizes animation curve accordingly. Enables ±200ms cross-device synchronization without frame-by-frame server control |

**Socket.io Event Naming:**
- Namespace: `domain:action` — e.g., `dj:stateChanged`, `ceremony:voteSubmitted`, `reaction:emoji`
- Server→client: past tense (something happened) — `stateChanged`, `voteSubmitted`, `cardDealt`
- Client→server: imperative (requesting action) — `submitVote`, `sendReaction`, `skipSong`
- All payloads typed via shared TypeScript interfaces

**Host/Participant Targeting:**
- Each party = Socket.io room `party:{code}`
- Host-specific UI data (Song Over button visibility, control overlay state) sent as separate non-state-changing supplementary event to host socket — **never as a state transition**
- Participant-targeted events (Party Card dealt to specific singer): `io.to(socketId).emit(...)`

**Reconnection Protocol (Three-Tier):**
- Client reconnects with `{ sessionId, playerId, lastStateLogIndex }`
- **Brief** (cursor gap ≤ 50 stateLog entries): replay events from cursor → transparent to user
- **Medium** (gap 50-500): send current full state snapshot → client resets
- **Long** (cursor behind trim point or >60s): full state snapshot + "you missed some things" indicator
- Host reconnection: additionally validates `hostToken` for privilege restoration

### DJ State Machine Architecture

**Implementation: Hand-Rolled Pure Function**

```typescript
function transition(
  state: DJState,
  event: DJEvent,
  context: PartyContext
): {
  nextState: DJState;
  effects: SideEffect[];
  rejected?: { from: string; event: string; reason: string };
}
```

- **State**: enum of DJ states + metadata (current singer, ceremony votes, timer deadlines)
- **Event**: union type of all inputs (HOST_SKIP, SONG_OVER, VOTE_SUBMITTED, TIMER_EXPIRED, PLAYER_JOINED, etc.)
- **Context**: read-only party data for guards (player count, settings, ceremony weight)
- **Effects**: array of side effects (`BROADCAST_STATE`, `START_TIMER`, `CANCEL_TIMER`, `EMIT_TO_HOST`, `DEAL_CARD`, `GENERATE_AWARD`, `COORDINATED_REVEAL`)
- **Rejected**: populated when a guard blocks a transition. Orchestrator MUST log at `warn` level via pino. Hard implementation rule — every silent rejection is observable

**Orchestrator Layer:**
- Thin layer above the pure function. Calls `transition()`, then executes returned effects via Socket.io/timers
- Only place with I/O. State machine never touches a socket, never calls `setTimeout`
- Timeouts: orchestrator manages `setTimeout`. `START_TIMER` effect sets the timer. On fire, orchestrator dispatches `TIMER_EXPIRED` back into the machine

**Ceremony Sub-States:**
- `CEREMONY_VOTING` (15s timer) → `CEREMONY_SILENCE` (1.5s) → `CEREMONY_REVEAL` (5s)
- First-class states in the enum (not nested). Simple to test
- **Do not trigger `data-dj-state` CSS changes** — single `ceremony` vibe entry, internal phase progression via `ceremony:phase` event consumed only by the Ceremony component. Prevents rapid background flashes during the 15-second choreographed sequence

**Testing Contract:**
- Pure function = pure unit tests. Feed state + event, assert output state + effects + rejected
- 100% branch coverage on `transition()` — justified by Concern #0
- Every transition path, every guard, every timeout behavior, every rejection reason tested
- Orchestrator layer: integration tests with mock Socket.io transport

### Frontend Architecture

**State Management:**
- Single reactive store per domain, updated exclusively by Socket.io event handlers:
  - `djStore` — current DJ state. Drives which screen component renders. Primary store
  - `partyStore` — players list, party code, host flag, session metadata
  - `reactionsStore` — ephemeral reaction feed, auto-decays
  - `captureStore` — media capture queue state
- Svelte 5 runes (`$state`, `$derived`) for reactive internals
- **No client-side state transitions.** Client never computes "what state should I be in"

**Component Architecture:**
- `App.svelte` reads `djStore.currentState`, renders appropriate screen via `{#if}` chain (not a router)
- `data-dj-state` attribute on `<body>` for CSS vibe theming per state
- Component groups:
  - **Screen** (one visible at a time): Lobby, Icebreaker, SongState, CeremonyVoting, CeremonySilence, CeremonyReveal, Interlude, Finale
  - **Overlay** (layered): HostControls, CaptureBubble, ReactionFeed, Soundboard
  - **Persistent** (always present): AudioManager, ConnectionStatus, WakeLock
- **Ceremony sub-states do NOT change `data-dj-state`**: enter `ceremony` state once (triggers vibe/background). Sub-state progression (`voting` → `silence` → `reveal`) communicated via `ceremony:phase` event, consumed only by the Ceremony component internally

**Web Audio — DJ Audio Mute Pattern:**
- Singleton AudioManager managing one `AudioContext`, unlocked on first user tap (iOS)
- Lazy-loads audio buffers by DJ state (don't preload ceremony sounds during lobby)
- Max 2 concurrent `AudioBufferSourceNode`. New source preempts oldest
- **DJ Audio Mute during song state**: DJ-initiated sounds (transition chimes, ambient loops) are suppressed. User-initiated sounds (soundboard, hype signal) remain fully functional. `AudioContext` is NOT suspended — only DJ-triggered playback is gated
- Exposed as store action: `audioStore.play('ceremony-reveal')`. Components never touch `AudioContext` directly

**PWA Configuration:**
- `vite-plugin-pwa` with precached app shell, audio buffers, fonts (Space Grotesk, Inter)
- No runtime caching of API responses (all data real-time via WebSocket)
- `display: standalone`, `orientation: portrait`
- Screen Wake Lock active during party states, released during song state
- Manifest theme color driven by current vibe palette

### External API Integration

**Architectural Split: Event-Stream vs Request/Response**

Two fundamentally different integration patterns, requiring separate abstractions:

**`LoungeSessionManager` — Persistent Event-Stream (per party):**
- Manages the Lounge API's persistent bidirectional connection lifecycle per party
- Operations: `pair(screenId)`, `disconnect()`, `onNowPlayingChanged(callback)`, `pushToQueue(videoId)`
- Lifecycle tied to `PartySession` — created on TV pairing, destroyed on party end or unpair
- Reconnection: 60s retry with exponential backoff before prompting re-pair (FR79)
- Mock implementation: simulates `nowPlaying` events on timer, returns success for queue pushes
- Fallback: returns `null` for nowPlaying, degrades to suggestion-only mode

**`SongMetadataAdapter` — Request/Response (server-level singletons):**

| Service | Pattern | Key Detail |
|---------|---------|------------|
| YouTube Data API | Batch proxy, server-side | Batch `videos.list` (50 IDs/request = 1 unit). Daily quota tracked in-memory, <500 units/session. Cache metadata per session |
| Spotify API | Client Credentials, auto-refresh | Server-level singleton (app-scoped tokens, 1hr expiry). Public playlist retrieval only. Extract track names + artists for suggestion engine |
| MusicBrainz | Direct query, no auth | Song metadata enrichment. Rate-limited by upstream (1 req/sec) |

**Fallback Cascade (runtime tiers):**

| Tier | Capability | Trigger |
|------|-----------|---------|
| Full | Lounge API + song detection + queue control | TV paired successfully |
| Suggestion-only | Suggestions work, no TV control | Lounge API fails or no TV |
| Playlist-only | Imported playlists as song pool, no live detection | YouTube Data API quota exceeded |
| Manual | Host announces songs verbally, app runs party features only | All song APIs fail |

DJ engine operates identically regardless of tier — it gets song metadata from different sources (or none).

### Infrastructure & Deployment

**Service Architecture:**

| Component | Service | Cost |
|-----------|---------|------|
| Node.js server | Railway Hobby | $5/mo (includes $5 usage credit) |
| PostgreSQL | Railway (same project) | ~$0.55-5/mo (usage-based) |
| Auth | Firebase Auth (Spark/Blaze) | Free (50K MAU) |
| Media storage | Firebase Storage (Blaze) | Free up to 5GB, then $0.026/GB |
| **Total MVP** | | **~$5-10/month** |

**Same-Server at MVP:** Express serves Vite production build from `packages/client/dist/` + Socket.io on same process. Single deployment artifact, single URL, no CORS. Post-MVP: split to CDN for static client.

**Environment Configuration:** `.env` with `dotenv`, validated at startup — fail fast if required vars missing:
- `DATABASE_URL` (Railway provides automatically)
- `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` (client + server)
- `FIREBASE_SERVICE_ACCOUNT_KEY` (server only — JSON, never exposed to client)
- `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `PORT`, `NODE_ENV`, `LOG_LEVEL`

**Monitoring & Logging:**
- `pino` for structured JSON logs (lightweight, fast)
- Event stream (FR40-44) as primary observability layer — every DJ state change, every player action, every silent error
- Health check: `GET /health` → `{ sessionCount, memoryUsage, uptime, dbConnected }`
- No external monitoring service at MVP. Railway provides basic metrics

**Graceful Shutdown:**
- `process.on('SIGTERM', gracefulShutdown)` — required for every deployment
- Sequence: (1) stop accepting new connections, (2) broadcast `party:ended { reason: 'server_restart' }` to all rooms, (3) wait up to 5s for Socket.io disconnect ACKs, (4) `process.exit(0)`
- Sprint 1 requirement alongside server scaffolding

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo scaffold + Firebase project setup + Railway PostgreSQL provisioning (Sprint 0)
2. DJ state machine pure function + 100% unit tests (Sprint 1 — blocks everything)
3. SessionManager + dual event log (Sprint 1)
4. Socket.io orchestrator layer + three communication primitives (Sprint 1)
5. Firebase Auth integration + Socket.io handshake validation (Sprint 1)
6. DB schema + Drizzle ORM setup + session summary writer (Sprint 1)
7. Svelte store architecture + App.svelte state routing (Sprint 1)
8. Reconnection protocol (Sprint 1)
9. AudioManager + DJ Audio Mute (Sprint 1)
10. Graceful shutdown handler (Sprint 1)
11. PWA configuration (Sprint 1)
12. Firebase Storage integration + media capture pipeline (Sprint 2)
13. External API adapters — Lounge, YouTube Data, Spotify (Sprint 3)

**Cross-Component Dependencies:**
- DJ state machine → orchestrator → Socket.io → Svelte stores → components (linear chain)
- SessionManager ↔ orchestrator (bidirectional: session provides context, orchestrator mutates session)
- Dual event log ↔ reconnection protocol (stateLog cursors drive reconnection tier)
- LoungeSessionManager ↔ SessionManager (lifecycle coupled to party lifecycle)
- AudioManager ← djStore (subscribes to state for DJ Audio Mute gating)
- Firebase Auth → Socket.io handshake → SessionManager (auth validates before session access)
- Session summary writer ← stateLog (reads event log at party end, writes to PostgreSQL)
- Firebase Storage ← captureStore (client uploads directly, server records metadata in PostgreSQL)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

12 conflict areas identified where AI agents could make different choices. Each pattern below is a mandatory rule, not a suggestion.

### Naming Patterns

**Database (Railway PostgreSQL via Drizzle):**
- Tables: `snake_case`, plural — `profiles`, `parties`, `participants`, `session_summaries`, `moments`, `media`
- Columns: `snake_case` — `party_id`, `host_uid`, `created_at`, `storage_path`
- Foreign keys: `{referenced_table_singular}_id` — `party_id`, `profile_id`
- Indexes: `idx_{table}_{columns}` — `idx_participants_party_id`
- Drizzle schema uses camelCase in TypeScript, maps to snake_case in SQL via Drizzle's column naming

**Socket.io Events:**
- Format: `domain:action` — `dj:stateChanged`, `ceremony:voteSubmitted`, `reaction:emoji`
- Server→client: past tense — `stateChanged`, `playerJoined`, `cardDealt`
- Client→server: imperative — `submitVote`, `sendReaction`, `skipSong`
- Host supplementary events: past tense (notifications, not commands) — `host:songOverPrompted`, `host:controlsUpdated`
- Domain prefixes: `dj`, `ceremony`, `reaction`, `host`, `player`, `capture`, `song`, `party`, `auth`
- `song:` is a separate domain from `dj:` — song events (`song:detected`, `song:queuePushed`, `song:suggestionReady`, `song:playlistImported`) feed INTO the DJ engine but are NOT DJ state transitions

**TypeScript / Code:**
- Variables and functions: `camelCase` — `partyCode`, `getSessionById()`, `handleVoteSubmit()`
- Types and interfaces: `PascalCase` — `DJState`, `PartySession`, `SideEffect`, `CeremonyVote`
- Enums: `PascalCase` name, `UPPER_SNAKE_CASE` values — `enum DJStateType { LOBBY, ICEBREAKER, SONG_ACTIVE, CEREMONY_VOTING }`
- Constants: `UPPER_SNAKE_CASE` — `MAX_PLAYERS`, `STALE_LOG_TTL`, `HEARTBEAT_INTERVAL`
- No Hungarian notation, no `I` prefix on interfaces

**Svelte Components:**
- Files: `PascalCase.svelte` — `CeremonyReveal.svelte`, `HostControls.svelte`, `AudioManager.svelte`
- Co-located styles: `<style>` block in same `.svelte` file, never separate CSS files
- Props use Svelte 5 `$props()` rune, typed inline

**Files and Directories:**
- TypeScript files: `camelCase.ts` — `djEngine.ts`, `sessionManager.ts`, `loungeAdapter.ts`
- Test files: `{name}.test.ts` co-located — `djEngine.test.ts` next to `djEngine.ts`
- Directory names: `camelCase` — `packages/server/src/dj/`, `packages/client/src/lib/stores/`
- Exception: config files at root follow their convention (`turbo.json`, `pnpm-workspace.yaml`, `drizzle.config.ts`)

### Structure Patterns

**Test Organization:**

| Test Type | Location | Naming |
|-----------|----------|--------|
| Unit (single module) | Co-located: `src/dj/djEngine.test.ts` | `{name}.test.ts` |
| Integration (multi-domain) | `packages/server/src/__integration__/` | `{feature}.integration.test.ts` |
| Client component | Co-located: `src/lib/components/screens/Lobby.test.ts` | `{Component}.test.ts` |

Examples: `__integration__/reconnection.integration.test.ts`, `__integration__/ceremonyFlow.integration.test.ts`

**Client Component Organization:**
```
packages/client/src/lib/
├── components/
│   ├── screens/          # One per DJ state (or state group)
│   │   ├── Lobby.svelte
│   │   ├── SongState.svelte
│   │   ├── CeremonyVoting.svelte
│   │   └── Finale.svelte
│   ├── overlays/         # Layered on top of screens
│   │   ├── HostControls.svelte
│   │   ├── ReactionFeed.svelte
│   │   └── CaptureBubble.svelte
│   ├── persistent/       # Always mounted
│   │   ├── AudioManager.svelte
│   │   └── ConnectionStatus.svelte
│   └── shared/           # Reused across screens
│       ├── Avatar.svelte
│       ├── Timer.svelte
│       └── ParticleEffect.svelte
├── stores/
│   ├── djStore.svelte.ts
│   ├── partyStore.svelte.ts
│   ├── reactionsStore.svelte.ts
│   ├── captureStore.svelte.ts
│   ├── songStore.svelte.ts
│   └── connectionStore.svelte.ts
├── services/
│   └── audioManager.ts   # Imperative singleton, non-reactive
├── socket/
│   └── client.ts         # Socket.io connection + event handlers
└── firebase/
    ├── auth.ts           # Firebase Auth helpers
    └── storage.ts        # Firebase Storage upload helpers
```

**Server Module Organization:**
```
packages/server/src/
├── dj/                   # Concern #0: state machine
│   ├── djEngine.ts       # Pure transition function
│   ├── orchestrator.ts   # Effect executor (Socket.io, timers)
│   ├── guards.ts         # Transition guard conditions
│   └── types.ts          # DJState, DJEvent, SideEffect types
├── session/              # Session lifecycle
│   ├── sessionManager.ts
│   ├── eventLog.ts       # Dual log (stateLog + activityLog)
│   └── types.ts
├── socket/               # WebSocket layer
│   ├── handlers.ts       # Event handler registration
│   ├── auth.ts           # Firebase JWT validation
│   └── rooms.ts          # Room management helpers
├── db/                   # Persistence
│   ├── schema.ts         # Drizzle schema definitions
│   ├── client.ts         # Drizzle client initialization
│   └── queries.ts        # Named query functions
├── api/                  # External API adapters
│   ├── lounge/           # LoungeSessionManager
│   ├── youtube/          # YouTube Data API batch proxy
│   ├── spotify/          # Spotify Client Credentials
│   └── musicbrainz/      # MusicBrainz lookups
├── firebase/             # Firebase Admin SDK
│   ├── admin.ts          # Firebase Admin initialization
│   └── storage.ts        # Signed URL generation
├── __integration__/      # Cross-domain integration tests
│   ├── reconnection.integration.test.ts
│   └── ceremonyFlow.integration.test.ts
└── index.ts              # Express + Socket.io server bootstrap
```

### Store & Service Architecture

**Stores (reactive, Svelte 5 runes, UI-facing):**

| Store | Domain | Mutated By |
|-------|--------|-----------|
| `djStore` | DJ state, current ceremony phase | Socket.io handler only |
| `partyStore` | Players, party code, host flag, metadata | Socket.io handler only |
| `reactionsStore` | Ephemeral reaction feed | Socket.io handler + internal auto-decay timer |
| `captureStore` | Capture UI state, upload progress | Socket.io handler + local UI state (camera open/close) |
| `songStore` | Playlist data, suggestions, Quick Pick/Spin state, Lounge status | Socket.io handler only |
| `connectionStore` | WebSocket lifecycle, reconnection tier, quality | Socket.io client events (local) |

**Services (imperative singletons, non-reactive, infrastructure-facing):**

| Service | Location | Pattern |
|---------|----------|---------|
| `AudioManager` | Client singleton | Imperative API (`play()`, `stop()`). Exposes reactive facade via `audioStore` for UI binding. Lives in `services/`, not `stores/` |
| `LoungeSessionManager` | Server, per-party | Persistent connection lifecycle. Communicates via Socket.io events to client |
| `SpotifyService` | Server singleton | Token management + API proxy |
| `YouTubeDataService` | Server singleton | Batch proxy + quota tracking |

**Concrete Store Template (Svelte 5 runes — copy-pasteable):**

```typescript
// stores/djStore.svelte.ts

// Module-scoped $state — NOT exported directly
let currentState = $state<DJState>(initialState);
let currentPhase = $state<string | null>(null);

// Exported: read-only derived getters ONLY
export const djStore = {
  get current() { return currentState; },
  get phase() { return currentPhase; },
  get isCeremony() { return currentState.type.startsWith('CEREMONY'); },

  // Socket handler methods — NEVER import in .svelte files
  _handleStateChange(payload: StateChangePayload) {
    currentState = payload.state;
  },
  _handlePhaseChange(phase: string) {
    currentPhase = phase;
  }
};
```

**Store Mutation Rules:**
- Components NEVER mutate **server-authoritative state** (DJ, party, ceremony, song selection) directly — always Socket.io → server → broadcast → store handler
- **Client-only ephemeral state** may be mutated locally without a server round-trip:
  - `captureStore`: opening camera preview, toggling capture UI
  - `reactionsStore`: auto-decay via internal `setTimeout`
  - `connectionStore`: WebSocket lifecycle events from Socket.io client
  - Audio playback state in `AudioManager` service
- **Rule of thumb**: if the server needs to know about it, it goes through Socket.io. If only the local phone cares, mutate locally

### Format Patterns

**Socket.io Payload Structures:**

```typescript
// Server → Client (state change)
interface StateChangePayload {
  state: DJState;
  timestamp: number;       // Unix ms via toUnixMs()
  transition?: string;
}

// Server → Client (delta event)
interface DeltaEventPayload {
  type: string;
  userId: string;
  data: Record<string, unknown>;
  timestamp: number;       // Unix ms
}

// Server → Client (coordinated reveal)
interface CoordinatedRevealPayload {
  result: unknown;
  revealAtTimestamp: number; // Unix ms
  animationType: string;
}

// Client → Server (action request)
interface ActionPayload {
  action: string;
  data?: Record<string, unknown>;
}
```

**REST Responses (health check, party history, media queries):**
```typescript
// Success
{ data: T, meta?: { page?: number, total?: number } }

// Error
{ error: { code: string, message: string } }
```
- HTTP status codes: 200, 201, 400, 401, 404, 500. No others at MVP

**Shared Timestamp Utility (mandatory):**

All timestamp format conversions MUST go through `packages/shared/src/timestamps.ts`:

```typescript
export const toUnixMs = (date: Date): number => date.getTime();
export const fromUnixMs = (ms: number): Date => new Date(ms);
export const toISO = (date: Date): string => date.toISOString();
export const fromPgTimestamp = (pg: Date | string): Date =>
  typeof pg === 'string' ? new Date(pg) : pg;
```

- No inline `Date.now()` except in `timestamps.ts` and test files
- No `.toISOString()` outside `timestamps.ts`
- Socket.io payloads: Unix ms (via `toUnixMs()`)
- REST responses: ISO 8601 (via `toISO()`)
- PostgreSQL: `timestamp with time zone` — Drizzle returns JS `Date`, convert via utility

**JSON Field Naming:**
- All JSON payloads (Socket.io + REST): **camelCase**
- Database columns: snake_case (Drizzle maps automatically)
- Never mix conventions in the same payload

### Process Patterns

**Error Handling — Silent Absorption + Observability (Concern #5):**

```typescript
// ❌ WRONG — never show errors to users
try { ... } catch (err) {
  showToast('Something went wrong');
}

// ❌ WRONG — swallowing without logging
try { ... } catch (err) { /* ignore */ }

// ✅ CORRECT — absorb silently, log with sessionId
try { ... } catch (err) {
  logger.error({ sessionId, err, context: 'media_upload' }, 'Silent failure');
  eventLog.append(sessionId, {
    type: 'error',
    subtype: 'media_upload_failed',
    metadata: { error: err.message }
  });
}
```

- **Rule**: No `alert()`, no error toasts, no retry dialogs, no error boundaries that show UI. Ever.
- **Rule**: Every `catch` block MUST log to pino with `sessionId` AND append to event stream. If it doesn't log, it's a bug.
- **Rule**: Graceful degradation on failure — degrade to next tier (Concern #7), never tell the user

**Loading States:**
- No client-side loading spinners for Socket.io operations
- Loading state ONLY for: initial connection (PWA loading screen), Firebase Auth flow (OAuth redirect), media upload progress (background indicator)
- Loading state naming: `isConnecting`, `isAuthenticating`, `uploadProgress`

**Validation:**
- Client-side: minimal (empty party code, name > 20 chars)
- Server-side: authoritative. State machine guards validate all transitions. Socket handlers validate payloads
- Never duplicate validation logic between client and server

### Logging Pattern (Server)

```typescript
import { logger } from './logger'; // pino instance

logger.info({ sessionId, playerId, event: 'vote_submitted' }, 'Vote received');
logger.warn({ sessionId, from: state, event, reason }, 'Transition rejected');
logger.error({ sessionId, err }, 'Session summary write failed');
```

- Always structured (object first, message second)
- Always include `sessionId` for session-scoped logs
- Levels: `error` (failures), `warn` (rejections, degradations), `info` (state changes, lifecycle), `debug` (event details)
- Never log full payloads at `info` level — use `debug`

### Anti-Patterns & Enforcement

| # | Anti-Pattern | Correct Pattern | Verification |
|---|-------------|----------------|--------------|
| 1 | `import styles from './Component.module.css'` | `<style>` block in `.svelte` file | `grep -r "module.css" packages/client/` |
| 2 | `tests/__tests__/djEngine.test.ts` | `src/dj/djEngine.test.ts` (co-located) | `find packages -name "__tests__" -type d` (should only find `__integration__`) |
| 3 | `socket.emit('stateChanged', newState)` from client | Client emits action → server transitions → server broadcasts | `grep -r "emit.*stateChanged\|emit.*Changed" packages/client/` |
| 4 | `try { } catch { /* ignore */ }` | `try { } catch { logger.error({sessionId, ...}); eventLog.append(...); }` | Custom ESLint rule `no-silent-catch` |
| 5 | `<Loading>` spinner for Socket.io ops | Server pushes state; client always has current state | `grep -r "loading\|spinner\|isLoading" packages/client/src/lib/components/screens/` |
| 6 | `io.to(hostSocket).emit('dj:stateChanged', ...)` | `broadcastStateChange()` to entire room | `grep -r "\.emit.*dj:stateChanged" packages/server/` — should appear only in `broadcastStateChange()` |
| 7 | `new Date().toISOString()` in Socket.io payload | `toUnixMs()` from shared timestamp utility | `grep -rn "toISOString\|new Date(" packages/server/src/socket/` |
| 8 | `catch(err) { logger.error(err) }` without sessionId | `logger.error({ sessionId, err, context }, msg)` | Custom ESLint rule or `ts-morph` architectural test |
| 9 | Hardcoded user-facing strings in `.svelte` components | Import from `lib/strings/ui.ts` — centralized string constants (NFR38) | `grep -rn ">[A-Z][a-z].*<" packages/client/src/lib/components/` (spot-check for inline text) |

**CI Enforcement Test:**
A `ts-morph` architectural test or custom ESLint rule (`no-silent-catch`) that:
1. Finds every `catch` block in `packages/server/src/`
2. Asserts it contains a `logger.error()` or `logger.warn()` call
3. Asserts the log call includes `sessionId` in the structured object
4. Fails the build if any catch block violates

## Project Structure & Boundaries

### Complete Project Directory Structure

```
karamania/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Turborepo build + test + lint pipeline
├── .env.example                      # Template for required env vars
├── .gitignore
├── .npmrc                            # pnpm config
├── package.json                      # Root: scripts, devDependencies
├── pnpm-workspace.yaml               # Workspace: packages/*
├── turbo.json                        # Pipeline: dev, build, test, lint
├── tsconfig.base.json                # Shared TS config, extended per package
│
├── packages/
│   ├── shared/                       # Shared TypeScript types + utilities
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # Public API barrel
│   │       ├── events.ts             # Socket.io event name constants + payload types
│   │       ├── states.ts             # DJStateType enum, DJState interface, DJEvent union
│   │       ├── timestamps.ts         # toUnixMs(), toISO(), fromPgTimestamp() — mandatory
│   │       └── types.ts              # PartySession, PlayerInfo, CeremonyVote, SideEffect
│   │
│   ├── client/                       # Svelte 5 + Vite SPA (PWA)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts            # Svelte + PWA + Tailwind plugins
│   │   ├── index.html
│   │   ├── public/
│   │   │   ├── manifest.webmanifest  # PWA: standalone, portrait
│   │   │   ├── icons/                # PWA icons (192, 512)
│   │   │   └── audio/                # Pre-loaded sound effects
│   │   │       ├── ceremony-reveal.mp3
│   │   │       ├── ceremony-voting.mp3
│   │   │       ├── state-transition.mp3
│   │   │       ├── card-deal.mp3
│   │   │       ├── airhorn.mp3
│   │   │       └── applause.mp3
│   │   └── src/
│   │       ├── main.ts               # App bootstrap, Firebase init, Socket.io connect
│   │       ├── App.svelte            # {#if} chain on djStore.current, data-dj-state on body
│   │       ├── app.css               # Tailwind v4 @import, @theme (vibe palettes), fonts
│   │       ├── vite-env.d.ts
│   │       └── lib/
│   │           ├── components/
│   │           │   ├── screens/           # One per DJ state (13 screens)
│   │           │   │   ├── Lobby.svelte          # FR1-FR8: join, QR, player list, auth prompt
│   │           │   │   ├── Icebreaker.svelte     # FR14: first-60s tap activity
│   │           │   │   ├── CardDeal.svelte       # FR55-FR62: card deal/accept/dismiss
│   │           │   │   ├── SongState.svelte      # FR22-FR28b: reactions, soundboard, lightstick
│   │           │   │   ├── QuickPick.svelte      # FR85-FR87: 5 suggestions, tap-to-vote
│   │           │   │   ├── SpinTheWheel.svelte   # FR88-FR89: 8 picks, animated selection
│   │           │   │   ├── SuggestionDisplay.svelte # FR93-FR94: suggestion-only mode display
│   │           │   │   ├── CeremonyVoting.svelte # FR16-FR18: vote UI, 15s timer
│   │           │   │   ├── CeremonySilence.svelte # Anticipation phase (1.5s)
│   │           │   │   ├── CeremonyReveal.svelte  # FR19-FR21: award reveal, confetti
│   │           │   │   ├── QuickCeremony.svelte   # ceremony.quick_reveal: abbreviated reveal
│   │           │   │   ├── Interlude.svelte       # FR22-FR28b: Kings Cup, Dare Pull, Quick Vote
│   │           │   │   └── Finale.svelte          # FR34-FR39, FR52: awards parade, setlist
│   │           │   ├── overlays/          # Layered on top of screens (6 overlays)
│   │           │   │   ├── HostControls.svelte    # FR29-FR33: skip, pause, override
│   │           │   │   ├── ReactionFeed.svelte    # FR22-FR23: emoji stream
│   │           │   │   ├── Soundboard.svelte      # FR24: 4-6 sound buttons
│   │           │   │   ├── CaptureBubble.svelte   # FR67-FR73: media capture prompt
│   │           │   │   ├── NowPlaying.svelte      # FR51, FR94: dual-mode (see note below)
│   │           │   │   └── TvPairing.svelte       # FR74-FR78: host-only lobby overlay
│   │           │   ├── persistent/        # Always mounted (3 components)
│   │           │   │   ├── AudioManager.svelte    # Web Audio lifecycle, DJ Audio Mute
│   │           │   │   ├── ConnectionStatus.svelte # Reconnection tier indicator
│   │           │   │   └── WakeLock.svelte        # Screen Wake Lock API
│   │           │   └── shared/            # Reused across screens (8 components)
│   │           │       ├── Avatar.svelte          # Player avatar (name initial + color)
│   │           │       ├── Timer.svelte           # Countdown timer (ceremony, voting)
│   │           │       ├── ParticleEffect.svelte  # Confetti (30-particle cap)
│   │           │       ├── SpinWheel.svelte       # Animated wheel rendering
│   │           │       ├── LightstickMode.svelte  # FR63-FR64: GPU animation
│   │           │       ├── HypeSignal.svelte      # FR65-FR66: flash/screen torch
│   │           │       ├── MomentCard.svelte      # Shareable 9:16 artifact (ceremony + finale)
│   │           │       └── SetlistPoster.svelte   # Shareable setlist with defensive rendering
│   │           ├── stores/
│   │           │   ├── djStore.svelte.ts          # DJ state + ceremony phase
│   │           │   ├── partyStore.svelte.ts       # Players, code, host flag
│   │           │   ├── reactionsStore.svelte.ts   # Ephemeral feed + auto-decay
│   │           │   ├── captureStore.svelte.ts     # Capture UI + upload progress
│   │           │   ├── songStore.svelte.ts        # Playlists, suggestions, Quick Pick/Spin
│   │           │   ├── connectionStore.svelte.ts  # WebSocket lifecycle, reconnect tier
│   │           │   ├── audioStore.svelte.ts       # Reactive facade for AudioManager service
│   │           │   └── vibeStore.svelte.ts        # Vibe palette state, data-dj-state mapping
│   │           ├── strings/
│   │           │   └── ui.ts                      # All user-facing strings (NFR38: i18n-ready)
│   │           ├── services/
│   │           │   └── audioManager.ts            # Imperative singleton: AudioContext, buffers
│   │           ├── socket/
│   │           │   └── client.ts                  # Socket.io init, event→store handler wiring
│   │           └── firebase/
│   │               ├── auth.ts                    # Firebase Auth: login, guest, upgrade
│   │               └── storage.ts                 # Firebase Storage: upload, signed URLs
│   │
│   └── server/                       # Node.js + Express + Socket.io
│       ├── package.json
│       ├── tsconfig.json
│       ├── drizzle.config.ts          # Drizzle Kit migration config
│       ├── data/
│       │   └── karaokeCatalog.json    # Pre-scraped catalog (loaded at startup)
│       └── src/
│           ├── index.ts               # Express + Socket.io bootstrap, env validation
│           ├── config.ts              # Environment vars, validated at startup
│           ├── logger.ts              # pino instance configuration
│           ├── dj/                    # Concern #0: DJ State Machine
│           │   ├── djEngine.ts        # Pure transition function (ALL states incl. ceremony)
│           │   ├── djEngine.test.ts   # 100% branch coverage
│           │   ├── orchestrator.ts    # Effect executor (Socket.io, timers)
│           │   ├── orchestrator.test.ts
│           │   ├── guards.ts          # Transition guard conditions (ALL guards incl. ceremony)
│           │   ├── guards.test.ts
│           │   └── types.ts           # Re-exported from shared
│           ├── session/
│           │   ├── sessionManager.ts  # Map<PartySession> + invariants + partyCode generation
│           │   ├── sessionManager.test.ts
│           │   ├── eventLog.ts        # stateLog + activityLog
│           │   ├── eventLog.test.ts
│           │   └── types.ts
│           ├── socket/
│           │   ├── handlers.ts        # Event handler registration + reconnection logic
│           │   ├── handlers.test.ts
│           │   ├── auth.ts            # Firebase JWT validation middleware
│           │   ├── auth.test.ts
│           │   └── rooms.ts           # broadcastStateChange(), room helpers
│           ├── db/
│           │   ├── schema.ts          # Drizzle schema definitions
│           │   ├── client.ts          # Drizzle client init (DATABASE_URL)
│           │   ├── queries.ts         # Named query functions
│           │   ├── queries.test.ts
│           │   └── migrations/        # Drizzle Kit generated
│           ├── api/
│           │   ├── lounge/
│           │   │   ├── loungeSessionManager.ts   # Persistent connection per party
│           │   │   ├── loungeSessionManager.test.ts
│           │   │   ├── loungeMock.ts             # Dev/test mock
│           │   │   └── types.ts
│           │   ├── youtube/
│           │   │   ├── youtubeDataService.ts     # Batch proxy + quota tracking
│           │   │   ├── youtubeDataService.test.ts
│           │   │   └── types.ts
│           │   ├── spotify/
│           │   │   ├── spotifyService.ts         # Client Credentials + auto-refresh
│           │   │   ├── spotifyService.test.ts
│           │   │   └── types.ts
│           │   ├── musicbrainz/
│           │   │   ├── musicbrainzService.ts
│           │   │   └── types.ts
│           │   └── catalog/
│           │       ├── catalogService.ts          # Loads karaokeCatalog.json, search/match
│           │       ├── catalogService.test.ts
│           │       ├── suggestionEngine.ts        # Intersection: group playlists ∩ catalog
│           │       ├── suggestionEngine.test.ts
│           │       └── types.ts
│           ├── firebase/
│           │   ├── admin.ts           # Firebase Admin SDK init
│           │   └── storage.ts         # Signed URL generation
│           ├── health.ts              # GET /health endpoint
│           ├── shutdown.ts            # SIGTERM graceful shutdown handler
│           └── __integration__/
│               ├── reconnection.integration.test.ts
│               ├── ceremonyFlow.integration.test.ts
│               └── sessionLifecycle.integration.test.ts
```

### NowPlaying Dual-Mode Behavior

`NowPlaying.svelte` operates in two distinct modes via prop-based switch:

| Mode | Trigger | Behavior | Audience |
|------|---------|----------|----------|
| **TV-paired** | Lounge API connected | Passive display — auto-updates from `song:detected` events | All participants |
| **Suggestion-only** | No TV pairing | Host-only action button — "Mark Now Playing" (FR94). Host manually marks current song | Host only (Concern #6 divergence) |

The component receives `mode` from `songStore.loungeConnected` and `isHost` from `partyStore`.

### Architectural Boundaries

**Boundary 1: Client ↔ Server (Socket.io)**
- ALL real-time communication flows through Socket.io
- Client never directly accesses PostgreSQL or server-side services
- State changes flow one direction: server → client (via `broadcastStateChange()`)
- Actions flow the opposite: client → server (via `socket.emit(action)`)
- Firebase Auth JWT validated at Socket.io handshake

**Boundary 2: Client ↔ Firebase (Direct)**
- Firebase Auth: client handles OAuth flow directly with Firebase JS SDK
- Firebase Storage: client uploads media directly (signed upload URL from server)
- No Socket.io involvement in auth or media upload

**Boundary 3: Server ↔ Railway PostgreSQL (Drizzle)**
- All DB access goes through `packages/server/src/db/queries.ts` — no raw SQL elsewhere
- 5 distinct write triggers:
  1. **First authenticated login**: profile upsert (`profiles` table)
  2. **Party creation**: insert `parties` row
  3. **Player join**: insert `participants` row
  4. **Media upload completion**: insert `media` row (async, during active session, triggered by Firebase Storage callback)
  5. **Party end**: batch write — update `parties.ended_at`, insert `session_summaries`, insert `moments`
- No DB reads during active party gameplay — all game state is in-memory
- Post-party reads: server REST API endpoints for party history, moment queries

**Boundary 4: Server ↔ External APIs**
- All external API calls go through dedicated adapter services in `packages/server/src/api/`
- Each adapter has a mock implementation for dev/test
- No client-side external API calls (except Firebase)
- Lounge API has its own lifecycle boundary — tied to PartySession

**Boundary 5: Shared Package**
- `packages/shared/` contains ONLY TypeScript types, enums, constants, and the timestamp utility
- No runtime dependencies — zero `import` of npm packages
- Both client and server import from shared — single source of truth for event shapes

**Boundary 6: Reconnection Protocol (cross-cutting recovery flow)**
- Crosses 4 modules: `socket/handlers.ts` (receives reconnect) → `session/sessionManager.ts` (provides state snapshot) → `session/eventLog.ts` (cursor-based replay from stateLog) → `dj/djEngine.ts` (current state, read-only)
- Three tiers with distinct data paths:
  - Brief (≤50 stateLog gap): replay from eventLog
  - Medium (50-500 gap): full state snapshot from sessionManager
  - Long (cursor behind trim or >60s): full sync + "missed events" indicator
- Host reconnection additionally validates `hostToken` via `socket/auth.ts`
- Must be integration-tested as its own boundary (`__integration__/reconnection.integration.test.ts`)

### Requirements to Structure Mapping

| FR Category | Client Location | Server Location |
|------------|----------------|----------------|
| Party Management (FR1-FR8, FR53) | `screens/Lobby.svelte`, `stores/partyStore` | `session/sessionManager.ts`, `socket/handlers.ts` |
| DJ Engine (FR9-FR15, FR51, FR54) | `App.svelte` ({#if} chain), `stores/djStore` | `dj/djEngine.ts`, `dj/orchestrator.ts` |
| Performance & Spotlight (FR16-FR21) | `screens/CeremonyVoting`, `CeremonySilence`, `CeremonyReveal`, `QuickCeremony` | `dj/djEngine.ts` (ceremony states + guards) |
| Audience Participation (FR22-FR28b) | `overlays/ReactionFeed`, `overlays/Soundboard`, `screens/Interlude` | `socket/handlers.ts` (reaction broadcast) |
| Host Controls (FR29-FR33) | `overlays/HostControls.svelte` | `socket/handlers.ts` (host-targeted events) |
| Memory & Sharing (FR34-FR39, FR52) | `screens/Finale.svelte`, `shared/MomentCard`, `shared/SetlistPoster` | `db/queries.ts` (session summary write) |
| Session Intelligence (FR40-FR44) | — (server-only) | `session/eventLog.ts` |
| Connection & Resilience (FR45-FR50) | `stores/connectionStore`, `persistent/ConnectionStatus` | `socket/handlers.ts` (reconnection), `session/eventLog.ts` |
| Party Cards (FR55-FR62) | `screens/CardDeal.svelte` | `dj/djEngine.ts` (CARD_DEAL state) |
| Audience Modes (FR63-FR66) | `shared/LightstickMode`, `shared/HypeSignal` | — (client-only) |
| Media Capture (FR67-FR73) | `overlays/CaptureBubble`, `stores/captureStore`, `firebase/storage.ts` | `firebase/storage.ts`, `db/queries.ts` |
| Song Integration (FR74-FR95) | `screens/QuickPick`, `SpinTheWheel`, `SuggestionDisplay`, `overlays/TvPairing`, `overlays/NowPlaying`, `stores/songStore` | `api/lounge/`, `api/youtube/`, `api/spotify/`, `api/catalog/` |
| Auth & Identity (FR96-FR105) | `firebase/auth.ts`, `screens/Lobby.svelte` | `socket/auth.ts`, `firebase/admin.ts`, `db/queries.ts` |

**Cross-Cutting Concerns → Locations:**

| Concern | Primary Location | Touches |
|---------|-----------------|---------|
| #0 DJ State Machine | `server/src/dj/` | Everything downstream |
| #1 Real-time Sync | `server/src/socket/rooms.ts` | All stores, all screens |
| #2 Session Lifecycle | `server/src/session/` | `socket/handlers.ts`, `db/queries.ts` |
| #3 Reconnection | `server/src/socket/handlers.ts` | `session/eventLog.ts`, `stores/connectionStore` |
| #4 Web Audio | `client/services/audioManager.ts` | `persistent/AudioManager.svelte`, `stores/audioStore` |
| #5 Silent Errors | Every `catch` block | `server/logger.ts`, `session/eventLog.ts` |
| #6 Host Divergence | `server/src/socket/rooms.ts` | `overlays/HostControls`, `overlays/NowPlaying` |
| #7 Degradation | `server/src/api/` (fallback cascade) | `stores/songStore`, `stores/connectionStore` |
| #8 Battery/Perf | `client/services/audioManager.ts`, `persistent/WakeLock` | Component RAF usage |
| #9 Mock Boundaries | `server/src/api/lounge/loungeMock.ts` | `__integration__/` tests |
| Vibe Theming | `client/stores/vibeStore.svelte.ts`, `app.css` | Every screen via `data-dj-state` |

### Data Flow

```
[User Tap] → Component → socket.emit(action) → Server Socket Handler
  → djEngine.transition(state, event, context)
  → { nextState, effects[], rejected? }
  → Orchestrator executes effects:
      → broadcastStateChange() → io.to(room).emit('dj:stateChanged')
      → START_TIMER → setTimeout → TIMER_EXPIRED → back to djEngine
      → EMIT_TO_HOST → io.to(hostSocket).emit(supplementary)
      → stateLog.append(event)
  → All client stores update from Socket.io events
  → Svelte reactivity renders new UI

[Party End] → Server writes to Railway PostgreSQL:
  → session_summaries (from stateLog)
  → moments (from stateLog)
  → parties (update ended_at)

[Media Capture] → Client uploads to Firebase Storage:
  → CaptureBubble → getUserMedia → MediaRecorder → blob
  → firebase/storage.ts → uploadBytes(ref, blob)
  → Server records metadata in PostgreSQL media table

[Reconnection] → Client reconnects with lastStateLogIndex:
  → Server checks cursor gap against stateLog
  → Brief: replay events → Medium: snapshot → Long: full sync
  → Stores reset to current state → UI re-renders
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices verified compatible (March 2026 versions). Svelte 5 + Vite 7 + Tailwind v4 + TypeScript 5 + Socket.io 4.8 + Node.js 22 + Firebase + Drizzle ORM + Railway PostgreSQL. No version conflicts or incompatibilities found.

**Pattern Consistency:** Naming conventions (camelCase TS, snake_case DB, domain:action Socket.io) are consistent and non-overlapping. Store mutation rules align with server-authoritative model. Anti-patterns table provides concrete enforcement. Shared timestamp utility prevents format conversion bugs.

**Structure Alignment:** Project tree supports all architectural decisions. 6 boundaries properly defined. FR→directory mapping covers all 105 FRs. Cross-cutting concerns mapped to specific locations.

### Requirements Coverage ✅

**Functional Requirements (FR1-FR105):** All 105 FRs have explicit architectural support with client and server locations mapped.

**Non-Functional Requirements (NFR1-NFR37):** All 37 NFRs addressed:
- Performance (NFR1-9): Socket.io <200ms, delta events <100ms, Web Audio <50ms, RAF dormancy, 30-particle cap, bundle budget <100KB
- Reliability (NFR10-16): state machine guards, three-tier reconnection, graceful shutdown
- Usability (NFR17-20): WCAG AA in CSS, audio cues, 1-tap host controls
- Security (NFR21-25): party code expiry, rate limiting, session isolation, WebSocket auth
- Song Integration (NFR29-33): batch proxy, quota tracking, Lounge fallback, server-side catalog, Spotify tokens
- Auth & Persistence (NFR34-37): Firebase JWT, guest upgrade, async DB writes, media access control

### Gap Analysis — Resolved

**Gap 1 (Resolved): Karaoke Catalog Index + Suggestion Engine**

Added to project structure:
- `packages/server/data/karaokeCatalog.json` — pre-scraped catalog loaded into memory at server startup. Weekly offline refresh (NFR32)
- `packages/server/src/api/catalog/catalogService.ts` — loads catalog, provides fuzzy search/match functions
- `packages/server/src/api/catalog/suggestionEngine.ts` — intersection-based algorithm: songs group knows (from imported playlists) ∩ karaoke catalog, ranked by overlap count + genre momentum (FR85)
- Added to FR→directory mapping

**Gap 2 (Resolved): Bundle Size Monitoring**

- Add `vite-plugin-bundle-analyzer` to CI pipeline
- Budget: <100KB JS gzipped (NFR8)
- Sprint 0 task: configure Vite build with size reporting, fail CI if budget exceeded
- Document in `packages/client/vite.config.ts` as a build constraint

**Gap 3 (Resolved): Guest-to-Account Upgrade WebSocket Continuity**

**Hard implementation rule:** Guest-to-account upgrade MUST use `signInWithPopup()` (not `signInWithRedirect()`).

Flow:
1. Guest taps "Save your stats" → `firebase/auth.ts` calls `signInWithPopup(provider)`
2. Popup opens → user completes OAuth → popup returns Firebase credential
3. Main page (and WebSocket) stays alive throughout
4. Client emits `socket.emit('auth:upgrade', { firebaseToken })` with the new JWT
5. Server validates new token via `firebase-admin`, links existing session participant record to the new Firebase UID
6. Server upserts `profiles` table with the new authenticated user
7. Client receives `auth:upgraded` confirmation — stores update with authenticated state

**Why not redirect:** `signInWithRedirect()` navigates the browser away, killing the Socket.io connection and losing in-memory session state. The popup approach keeps everything alive. NFR35 requires upgrade in under 5 seconds without WebSocket interruption — popup achieves this.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analyzed (105 FRs + 37 NFRs across 14 categories)
- [x] Scale assessed (~100 concurrent sessions MVP, 6,250 ceiling documented)
- [x] 12 technical constraints identified
- [x] 10 cross-cutting concerns + vibe theming mapped

**✅ Technology Stack**
- [x] All versions verified via web search (March 2026)
- [x] Svelte 5.53.7, Vite 7.3.1, Socket.io 4.8.3, Tailwind 4.2.0, Vitest 4.0.18
- [x] Firebase Auth, Firebase Storage, Railway PostgreSQL, Drizzle ORM
- [x] pnpm workspaces + Turborepo monorepo

**✅ Architectural Decisions**
- [x] 7 decision categories resolved (State/Memory, Communication, DJ Engine, Frontend, External APIs, Security, Infrastructure)
- [x] DJ state machine: hand-rolled pure function with rejection logging
- [x] 3 communication primitives (BROADCAST_STATE, DELTA_EVENT, COORDINATED_REVEAL)
- [x] Dual event log (stateLog for replay, activityLog for observability)
- [x] 4-tier song integration fallback cascade
- [x] Graceful SIGTERM shutdown handler
- [x] Guest-to-account upgrade via popup auth

**✅ Implementation Patterns**
- [x] Naming conventions for DB, Socket.io, TypeScript, Svelte, files
- [x] 8 stores + services architecture with concrete Svelte 5 template
- [x] Store mutation rules scoped (server-authoritative vs client-local ephemeral)
- [x] 8 anti-patterns with verification methods
- [x] CI enforcement test for silent error logging
- [x] Shared timestamp utility (mandatory, no inline conversions)
- [x] Integration test location policy (co-located unit, `__integration__/` cross-domain)

**✅ Project Structure**
- [x] Complete directory tree (3 packages, ~70 files)
- [x] 13 screens, 6 overlays, 3 persistent, 8 shared components
- [x] 8 stores + vibeStore defined with domain boundaries
- [x] Server modules: dj, session, socket, db, api (5 adapters including catalog), firebase
- [x] 6 architectural boundaries defined
- [x] FR→directory mapping for all 105 FRs
- [x] Cross-cutting concerns→location mapping for all 10 + vibe theming

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- DJ state machine as pure function — testable, deterministic, zero side effects. The single most important architectural bet
- Three communication primitives cover all real-time patterns without ad-hoc invention
- Dual event log naturally implements three-tier reconnection AND provides the persistence write hook
- Firebase Auth + Railway PG + Firebase Storage: ~$5-10/month, boring-tech, no operational surprises
- Anti-patterns table with verification methods prevents AI agent drift
- Concrete Svelte 5 store template is copy-pasteable — agents can't deviate
- Every silent error is paired with observability — the event stream IS the debugging strategy

**Areas for Future Enhancement:**
- CDN split for static client (post-MVP when traffic warrants)
- Cross-session personalization engine (v2, powered by party history in PostgreSQL)
- Media processing pipeline for highlight reel assembly (v3)
- Horizontal scaling documentation (when approaching the 6,250 concurrent party ceiling)
- Migrate karaoke catalog from JSON file to PostgreSQL table when catalog exceeds memory budget

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently — naming, stores, anti-patterns
- Respect project structure and 6 boundaries
- Refer to this document for all architectural questions
- When in doubt: server is authoritative, client is a thin renderer, errors are silent but logged

**First Implementation Priority:**
1. Sprint 0: Monorepo scaffold (`create vite` + manual server), Firebase project setup, Railway PostgreSQL provisioning, DB schema via Drizzle
2. Sprint 1: DJ state machine pure function + 100% unit tests (blocks everything else)

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-03-05
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**

- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**

- 30+ architectural decisions made across 7 categories
- 5-domain naming conventions + 8 anti-patterns + concrete store template
- 3 packages with ~70 files specified
- 105 FRs + 37 NFRs fully supported

**AI Agent Implementation Guide**

- Technology stack: Svelte 5.53.7, Vite 7.3.1, Socket.io 4.8.3, Tailwind CSS 4.2.0, Vitest 4.0.18, Drizzle ORM 0.44.2, Firebase Auth 11.6.1, Railway PostgreSQL 17
- Consistency rules that prevent implementation conflicts (8 anti-patterns with grep verification)
- Project structure with 6 clearly defined boundaries
- Integration patterns: 3 communication primitives, dual event log, three-tier reconnection

### Implementation Handoff

**For AI Agents:**
This architecture document is your complete guide for implementing Karamania. Follow all decisions, patterns, and structures exactly as documented.

**Development Sequence:**

1. Initialize monorepo: `pnpm create vite client --template svelte-ts` + manual `server/` + `packages/shared/`
2. Configure Turborepo, pnpm workspaces, shared tsconfig
3. Provision Firebase project (Auth + Storage) + Railway PostgreSQL
4. Drizzle schema: parties, participants, events, media tables
5. Implement DJ state machine pure function with 100% unit test coverage
6. Socket.io server with room management + 3 communication primitives
7. Build features following established patterns, boundary rules, and anti-patterns

### Quality Assurance Checklist

**Architecture Coherence**

- [x] All decisions work together without conflicts
- [x] Technology choices are compatible (verified versions)
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**Requirements Coverage**

- [x] All 105 functional requirements are supported
- [x] All 37 non-functional requirements are addressed
- [x] Cross-cutting concerns are handled (10 + vibe theming)
- [x] Integration points are defined

**Implementation Readiness**

- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts (8 anti-patterns + verification)
- [x] Structure is complete and unambiguous (~70 files)
- [x] Examples are provided for clarity (concrete store template, timestamp utility)

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

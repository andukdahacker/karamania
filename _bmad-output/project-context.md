---
project_name: 'karaoke-party-app'
user_name: 'Ducdo'
date: '2026-03-05'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 65
optimized_for_llm: true
party_mode_rounds: 3
improvements_accepted: 23
---

# Project Context for AI Agents

_Critical rules and patterns for implementing Karamania. Focus on unobvious details that agents will otherwise get wrong._

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture.md`

---

## Technology Stack & Versions

| Package | Version | Role |
|---------|---------|------|
| Svelte | 5.53.7 | UI framework — **runes only** (`$state`, `$derived`, `$props`) |
| Vite | 7.3.1 | Client build + dev server |
| TypeScript | 5.8 | Strict mode, ES modules throughout |
| Socket.io | 4.8.3 | Real-time WebSocket (client + server) |
| Tailwind CSS | 4.2.0 | v4 CSS-first config (`@theme` in CSS, no `tailwind.config.js`) |
| Vitest | 4.0.18 | Unit + integration testing |
| Drizzle ORM | 0.44.2 | PostgreSQL ORM (TypeScript-native) |
| Firebase Auth | 11.6.1 | Social OAuth + anonymous guest auth |
| Firebase Storage | — | Media capture uploads (client direct) |
| Railway PostgreSQL | 17 | Persistent data (co-located with server) |
| pino | — | Structured JSON logging |
| Node.js | 22 LTS | Server runtime |
| pnpm | 9.x | Package manager (workspaces) |
| Turborepo | latest | Monorepo task orchestration |

**Monorepo structure:** `packages/client/` (Svelte SPA), `packages/server/` (Node.js + Socket.io), `packages/shared/` (types + utilities only)

---

## Critical Implementation Rules

### The One Rule That Overrides Everything

**The server is authoritative. The client is a thin renderer. The client NEVER computes state transitions.**

Every tap → `socket.emit(action)` → server `djEngine.transition()` → server broadcasts new state → client store updates → Svelte reactivity renders. No exceptions.

### Language-Specific Rules (TypeScript)

- **Strict mode** in all packages. No `any` types except explicit `unknown` escape hatches
- **ES modules** everywhere (`"type": "module"` in all `package.json`)
- **Import from shared:** `import { DJState, toUnixMs } from '@karamania/shared'` — types and utilities always from shared package
- **No barrel re-exports** in server or client — import from specific files. **Exception:** `packages/shared/src/index.ts` is the sole barrel export (public API for the shared package)
- **Enum values are `UPPER_SNAKE_CASE`:** `enum DJStateType { LOBBY, ICEBREAKER, SONG_ACTIVE, CEREMONY_VOTING }`
- **No `I` prefix** on interfaces, no Hungarian notation
- **All timestamps through utility:** `packages/shared/src/timestamps.ts` — never `new Date()` or `.toISOString()` inline (except in tests and the utility itself)

### Framework-Specific Rules (Svelte 5)

**Stores use module-scoped `$state` runes — NOT class-based, NOT writable stores:**

```typescript
// stores/djStore.svelte.ts — THE canonical pattern
let currentState = $state<DJState>(initialState);
let currentPhase = $state<string | null>(null);

export const djStore = {
  get current() { return currentState; },
  get phase() { return currentPhase; },
  get isCeremony() { return currentState.type.startsWith('CEREMONY'); },
  _handleStateChange(payload: StateChangePayload) { currentState = payload.state; },
  _handlePhaseChange(phase: string) { currentPhase = phase; }
};
```

- `$state` variables are **module-scoped, never exported directly**
- External access via **getter-only object properties**
- Mutation methods prefixed `_handle` — called from `socket/client.ts` handlers, **never from `.svelte` components**
- Components use `$props()` rune for props, typed inline
- Co-located `<style>` blocks — never separate CSS files, never CSS modules

**Store mutation scoping:**
- **Server-authoritative stores** (dj, party, ceremony, song): mutation ONLY via Socket.io event handlers
- **Client-local ephemeral** (capture UI, reactions auto-decay, connection status, audio): may mutate locally

**8 stores + vibeStore:** `djStore`, `partyStore`, `reactionsStore`, `captureStore`, `songStore`, `connectionStore`, `audioStore` (reactive facade), `vibeStore`

**Services vs stores:** `audioManager.ts` is an imperative singleton in `services/`, not a store. `audioStore` wraps it as a reactive facade

**App.svelte routing — NO router library:**
```svelte
<!-- App.svelte — {#if} chain on djStore, NOT a router -->
{#if djStore.current.type === 'LOBBY'}
  <Lobby />
{:else if djStore.current.type === 'SONG_ACTIVE'}
  <SongState />
{:else if djStore.current.type === 'CEREMONY_VOTING'}
  <CeremonyVoting />
<!-- ... all DJ states ... -->
{/if}
```
- No `svelte-routing`, no SvelteKit, no file-based routing. The DJ state IS the router
- `data-dj-state` attribute on `<body>` drives CSS vibe theming per state (background, palette, animations)
- `vibeStore` maps `DJStateType` → vibe palette. Components never compute their own colors

**`PartySession` serialization constraint:**
- `PartySession` MUST be a plain serializable object — no class instances, no circular refs, no Map/Set
- `SessionManager` wraps `Map<string, PartySession>` but individual sessions are JSON-safe
- This enables state snapshots for reconnection and session summary writes

**Web Audio constraints:**
- Singleton `AudioManager` managing one `AudioContext`, unlocked on first user tap (iOS requirement)
- **Max 2 concurrent `AudioBufferSourceNode`** — new source preempts oldest
- **Lazy buffer loading by DJ state** — don't preload ceremony sounds during lobby
- Exposed as `audioStore.play('ceremony-reveal')` — components NEVER touch `AudioContext` directly

**Component group mounting rules (4 groups):**

| Group | Mount Behavior | Example |
|-------|---------------|---------|
| **Screens** | One visible at a time, switched by `djStore.current.type` in `App.svelte` `{#if}` chain | `Lobby`, `SongState`, `CeremonyVoting`, `Finale` |
| **Overlays** | Layered on top of screens, multiple can be visible simultaneously | `HostControls`, `ReactionFeed`, `Soundboard`, `CaptureBubble` |
| **Persistent** | Always mounted regardless of DJ state, never unmounted during session | `AudioManager`, `ConnectionStatus`, `WakeLock` |
| **Shared** | Reusable sub-components imported by screens/overlays, not mounted directly in `App.svelte` | `Avatar`, `Timer`, `ParticleEffect`, `MomentCard` |

- New components MUST be placed in the correct group — don't conditionally mount a persistent, don't layer a screen
- Overlays render via their own visibility logic (e.g., `HostControls` checks `partyStore.isHost`), not the `{#if}` chain

**Client Socket.io wiring — ALL in `socket/client.ts`:**

```typescript
// socket/client.ts — THE single wiring point for all event→store routing
socket.on('dj:stateChanged', (payload) => djStore._handleStateChange(payload));
socket.on('ceremony:phase', (phase) => djStore._handlePhaseChange(phase));
socket.on('reaction:emoji', (payload) => reactionsStore._handleReaction(payload));
// ... all events wired here, nowhere else
```

- Components NEVER call `socket.on()` — all wiring lives in this one file
- Components emit actions via imported helper: `socket.emit('ceremony:submitVote', data)`
- This is the single point of truth for what Socket.io events exist and where they route

### DJ State Machine Rules

**Pure function — Concern #0. If this has bugs, nothing else matters.**

```typescript
function transition(state: DJState, event: DJEvent, context: PartyContext): {
  nextState: DJState;
  effects: SideEffect[];
  rejected?: { from: string; event: string; reason: string };
}
```

- **Zero side effects** in `djEngine.ts` — no Socket.io, no setTimeout, no I/O
- **Orchestrator** is the thin layer that executes returned `effects[]` (broadcasting, timers, DB writes)
- **Every rejected transition** MUST be logged at `warn` level via pino with `sessionId`
- **Timer management loop:** orchestrator calls `transition()` → gets `START_TIMER` effect → orchestrator calls `setTimeout` → on fire, orchestrator dispatches `TIMER_EXPIRED` event back into `transition()`. `CANCEL_TIMER` → `clearTimeout`. The state machine NEVER calls `setTimeout` or `clearTimeout` directly
- **100% branch coverage** on `transition()` — justified, non-negotiable
- **Ceremony sub-states** (`CEREMONY_VOTING` → `CEREMONY_SILENCE` → `CEREMONY_REVEAL`) are first-class enum values, NOT nested
- **Ceremony sub-states do NOT change `data-dj-state`** on `<body>` — enter `ceremony` vibe once, use internal `ceremony:phase` events for sub-state progression

### Socket.io Rules

**Three communication primitives (never invent a fourth):**

| Primitive | Use | Pattern |
|-----------|-----|---------|
| `BROADCAST_STATE` | DJ state transitions | `broadcastStateChange()` → `io.to(room).emit('dj:stateChanged', fullState)`. Always room-wide, never targeted |
| `DELTA_EVENT` | Reactions, soundboard | Lightweight ephemeral payloads. Do NOT modify DJ state. NOT stored in stateLog |
| `COORDINATED_REVEAL` | Ceremony reveals | `{ result, revealAtTimestamp }` — client calculates animation duration locally |

**Event naming:**
- Format: `domain:action` — `dj:stateChanged`, `ceremony:voteSubmitted`, `reaction:emoji`
- Server→client: **past tense** — `stateChanged`, `playerJoined`, `cardDealt`
- Client→server: **imperative** — `submitVote`, `sendReaction`, `skipSong`
- Domains: `dj`, `ceremony`, `reaction`, `host`, `player`, `capture`, `song`, `party`, `auth`
- **`song:` is a separate domain from `dj:`** — song events feed INTO the DJ engine but are NOT state transitions

**`broadcastStateChange()` is the ONLY function that emits `dj:stateChanged`** — never emit it directly

### Authentication Rules

- **Firebase Auth from day one** — two modes: social OAuth (Google/Facebook) + anonymous guest
- **Socket.io handshake** sends `{ firebaseToken, partyCode }` in `auth` — server validates JWT via `firebase-admin`
- **Guest upgrade MUST use `signInWithPopup()`** — NEVER `signInWithRedirect()` (kills WebSocket)
- Both token types grant **identical in-session permissions** — auth status affects persistence only
- Host privilege: first user to create party = host. `hostToken` UUID for reconnection privilege restoration

### Database Rules (Railway PostgreSQL + Drizzle)

- **No DB reads during active gameplay** — all game state is in-memory
- **5 write triggers only:** first login (profile upsert), party creation, player join, media upload completion, party end (batch)
- **Party end writes are async** — 3 retries with exponential backoff, fallback to disk log
- **All queries through `db/queries.ts`** — no raw SQL elsewhere
- **Drizzle naming:** camelCase in TypeScript → snake_case in SQL (Drizzle maps automatically)
- Tables: `profiles`, `parties`, `participants`, `session_summaries`, `moments`, `media`
- **Firebase Storage path:** `captures/{partyId}/{uid}/{timestamp}.{ext}` — Firebase Security Rules enforce per-user write, per-party read

### Error Handling — The Silent Error Rule

```typescript
// ❌ NEVER — no error UI, no toasts, no retry dialogs
try { ... } catch (err) { showToast('Something went wrong'); }

// ❌ NEVER — swallowing without logging
try { ... } catch (err) { /* ignore */ }

// ✅ ALWAYS — absorb silently, log with sessionId
try { ... } catch (err) {
  logger.error({ sessionId, err, context: 'media_upload' }, 'Silent failure');
  eventLog.append(sessionId, { type: 'error', subtype: 'media_upload_failed', metadata: { error: err.message } });
}
```

- No `alert()`, no error toasts, no retry buttons, no error boundaries that show UI. **Ever.**
- Every `catch` MUST log to pino with `sessionId` AND append to event stream
- Graceful degradation on failure — degrade to next tier, never tell the user
- CI enforcement: `ts-morph` or ESLint rule `no-silent-catch` validates every catch block

---

## Testing Rules

- **Unit tests co-located:** `djEngine.test.ts` next to `djEngine.ts`
- **Integration tests in `__integration__/`:** `packages/server/src/__integration__/reconnection.integration.test.ts`
- **DJ state machine: 100% branch coverage** — every transition path, guard, timeout, rejection
- **Orchestrator:** integration tests with mock Socket.io transport
- **Pure function tests:** feed `(state, event, context)`, assert `{ nextState, effects, rejected }`
- **External API mocks — two distinct strategies:**
  - **Lounge API (persistent connection):** `loungeMock.ts` simulates `nowPlaying` events on timer + returns success for queue pushes. Must mock the persistent bidirectional connection, NOT a REST API
  - **YouTube Data / Spotify / MusicBrainz (request/response):** Standard response mocks. Straightforward to mock
- **Named integration tests (3):** `reconnection.integration.test.ts`, `ceremonyFlow.integration.test.ts`, `sessionLifecycle.integration.test.ts` — each covers a cross-domain boundary
- **No loading spinners in tests** — Socket.io ops don't have loading states

---

## Code Quality & Style Rules

### Naming Conventions (5 domains)

| Domain | Convention | Example |
|--------|-----------|---------|
| Database | `snake_case`, plural tables | `session_summaries`, `host_uid`, `idx_participants_party_id` |
| Socket.io | `domain:action` | `dj:stateChanged`, `ceremony:voteSubmitted` |
| TypeScript | `camelCase` vars/functions, `PascalCase` types, `UPPER_SNAKE_CASE` constants | `partyCode`, `DJState`, `MAX_PLAYERS` |
| Svelte | `PascalCase.svelte` | `CeremonyReveal.svelte`, `HostControls.svelte` |
| Files | `camelCase.ts`, `{name}.test.ts` | `djEngine.ts`, `djEngine.test.ts` |

### Logging Pattern (Server)

```typescript
logger.info({ sessionId, playerId, event: 'vote_submitted' }, 'Vote received');
logger.warn({ sessionId, from: state, event, reason }, 'Transition rejected');
logger.error({ sessionId, err }, 'Session summary write failed');
```

- Always structured: object first, message second
- Always include `sessionId` for session-scoped logs
- Never log full payloads at `info` — use `debug`

### REST Response Format

```typescript
// Success: { data: T, meta?: { page?, total? } }
// Error:   { error: { code: string, message: string } }
```

HTTP codes: 200, 201, 400, 401, 404, 500 only

---

## Development Workflow Rules

- **pnpm only** — `pnpm install` at root, workspace protocol `workspace:*`
- **Turborepo pipeline:** `turbo dev`, `turbo build`, `turbo test`, `turbo lint`
- **Server dev:** `tsx --watch` for auto-restart
- **Client dev:** Vite HMR
- **Bundle budget:** <100KB JS gzipped. `vite-plugin-bundle-analyzer` in CI, fail build if exceeded
- **Environment variables:** validated at startup with `dotenv` — fail fast if missing
- **Required env vars:** `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `PORT`, `NODE_ENV`, `LOG_LEVEL`
- **Same-server at MVP:** Express serves Vite build from `packages/client/dist/` + Socket.io on same process

---

## Critical Don't-Miss Rules

### Anti-Patterns Table

| # | WRONG | RIGHT | Verify |
|---|-------|-------|--------|
| 1 | CSS modules (`Component.module.css`) | `<style>` in `.svelte` file | `grep -r "module.css" packages/client/` |
| 2 | `tests/__tests__/` directories | Co-located `{name}.test.ts` | `find packages -name "__tests__" -type d` |
| 3 | Client emitting state changes | Client emits action → server transitions → server broadcasts | `grep -r "emit.*stateChanged" packages/client/` |
| 4 | Empty catch blocks | Every catch: `logger.error({sessionId})` + `eventLog.append()` | ESLint `no-silent-catch` |
| 5 | Loading spinners for Socket.io | Server pushes state; client always has current state | `grep -r "isLoading" packages/client/src/lib/components/screens/` |
| 6 | Targeted `dj:stateChanged` emits | `broadcastStateChange()` to entire room | `grep -r "emit.*dj:stateChanged" packages/server/` |
| 7 | Inline `new Date().toISOString()` | Shared timestamp utility | `grep -rn "toISOString\|new Date(" packages/server/src/socket/` |
| 8 | `logger.error(err)` without sessionId | `logger.error({ sessionId, err, context }, msg)` | ESLint or `ts-morph` test |
| 9 | Router library (`svelte-routing`, SvelteKit, file-based routing) | `{#if}` chain on `djStore.current.type` in `App.svelte` | `grep -r "svelte-routing\|goto\|navigate" packages/client/` |
| 10 | Hardcoded user-facing strings in `.svelte` components | Import from `lib/strings/ui.ts` — centralized constants (NFR38, i18n-ready) | `grep -rn ">[A-Z][a-z].*<" packages/client/src/lib/components/` |

### Host/Participant Divergence (5 host-unique interactions)

The host sees a different UI than participants. Same codebase, targeted Socket.io emits:

1. **Song Over button** — host only, triggers `dj:songOver` event
2. **Start Party** — host initiates party start from lobby
3. **TV Pairing** — host-only lobby overlay (`TvPairing.svelte`)
4. **Now Playing** — dual-mode: host gets "Mark Now Playing" action in suggestion-only mode
5. **Host Controls overlay** — skip, pause, override (always available to host)

Host-specific data sent as **separate supplementary events** to host socket — never as state transitions. `partyStore.isHost` drives conditional rendering.

### 4-Tier Song Integration Fallback Cascade

| Tier | Capability | Trigger |
|------|-----------|---------|
| Full | Lounge API + song detection + queue control | TV paired successfully |
| Suggestion-only | Suggestions work, no TV control | Lounge API fails or no TV |
| Playlist-only | Imported playlists as song pool, no live detection | YouTube Data API quota exceeded |
| Manual | Host announces songs verbally, app runs party features only | All song APIs fail |

DJ engine operates identically regardless of tier. Degrade silently — never tell the user.

### Max 12 Players Per Party

- Hard limit enforced in `sessionManager.ts` — reject join if `participants.length >= 12`
- DJ state machine guards use player count for ceremony thresholds (e.g., skip ceremony if < 3 players)
- UI layouts assume max 12 avatars — grid/list designs must work at 1-12 range
- Graceful degradation below 3 players: reduced ceremony mode (NFR11)

### Karaoke Catalog & Suggestion Engine

- **`packages/server/data/karaokeCatalog.json`** — pre-scraped catalog loaded into memory at server startup
- **`api/catalog/catalogService.ts`** — loads catalog, provides fuzzy search/match
- **`api/catalog/suggestionEngine.ts`** — intersection algorithm: songs the group knows (from imported Spotify/YouTube playlists) ∩ karaoke catalog, ranked by overlap count + genre momentum
- Weekly offline catalog refresh (NFR32) — not a runtime API call
- Drives Quick Pick (FR85-FR87) and Spin the Wheel (FR88-FR89) song selection features

### Rate Limiting (per-socket sliding window)

| Action | Limit | On Exceed |
|--------|-------|-----------|
| Emoji reactions | 10/s | Silent drop + event stream log |
| Soundboard taps | 3/s | Silent drop + event stream log |
| Global (all actions) | 30/s | Silent drop + event stream log |

### UI Constraints

- **Touch targets: minimum 48px** — all interactive elements. No exceptions (NFR17)
- **No text input beyond player name** — everything is single-tap. No chat, no search boxes, no typing during party (NFR18)
- **WCAG AA contrast** — all text and interactive elements meet 4.5:1 contrast ratio (NFR20)
- **Mobile-only portrait: 360-412px width** — no responsive breakpoints, no desktop layout, no tablet. Do NOT add media queries for larger screens
- **Audio-first state transitions** — every DJ state change has an audio cue before visual change (NFR20)

### Performance Budget Rules

- **RAF dormancy during song state** — no `requestAnimationFrame` loops ticking when user is singing. Animations suspend, resume on next state transition
- **Adaptive heartbeat:** 5s interval during active states, 15s during song state (battery saving)
- **Confetti particle cap: 30 particles** — `ParticleEffect.svelte` must enforce hard max, regardless of how many events trigger it
- **60fps with 12 clients** — test on budget Android (Galaxy A series, 3GB RAM)
- **Bundle budget:** <100KB JS gzipped (documented in Workflow Rules, enforced in CI)

### PWA Configuration

- `display: standalone`, `orientation: portrait` — mobile-only, no desktop
- **Precache:** app shell, audio buffers (`public/audio/`), fonts (Space Grotesk, Inter)
- **No runtime caching** of API responses — all data real-time via WebSocket
- **Wake Lock lifecycle:** active during party states, **released during song state** (battery saving)
- Manifest theme color driven by current vibe palette via `vibeStore`

### Edge Cases That Will Bite You

- **iOS Safari:** AudioContext requires unlock on first user tap. Buffer loading must be lazy by DJ state
- **iOS Safari:** WebSocket suspends on screen lock — reconnection protocol handles this
- **iOS video capture:** Falls back to native file picker (no inline `getUserMedia`)
- **Vietnam market:** Budget Android (3GB RAM), unreliable WiFi — keep memory lean, reconnection robust
- **Vietnamese diacritics:** Ensure UTF-8 everywhere, fonts must support Vietnamese characters (Space Grotesk + Inter both support Vietnamese)
- **i18n readiness (NFR38):** All user-facing strings in `lib/strings/ui.ts` — never hardcode text in components. Vietnamese localization is fast-follow; string extraction must be trivial
- **DJ Audio Mute:** During song state, suppress DJ-initiated sounds but keep user-initiated (soundboard) live. AudioContext is NOT suspended — only DJ playback is gated
- **Party code:** 4-char from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 chars, no ambiguous 0/O/1/I/L). Validate uniqueness against active session Map
- **Graceful shutdown:** `SIGTERM` → broadcast `party:ended` to all rooms → wait 5s → exit

### Architectural Boundaries (6)

1. **Client ↔ Server:** ALL real-time through Socket.io. Client never touches PostgreSQL
2. **Client ↔ Firebase:** Auth + Storage direct. No Socket.io involvement
3. **Server ↔ PostgreSQL:** All through `db/queries.ts`. No DB reads during gameplay
4. **Server ↔ External APIs:** All through `api/` adapters. Each has a mock. Client never calls external APIs (except Firebase)
5. **Shared Package:** Types, enums, constants, timestamp utility ONLY. Zero npm dependencies
6. **Reconnection Protocol:** Crosses 4 modules (socket → session → eventLog → djEngine). Integration tested as own boundary

### Memory Ceilings

| Parameter | Value |
|-----------|-------|
| Max concurrent sessions | 100 |
| stateLog per session | 500 events (oldest-trim) |
| stateLog entry max | 1KB |
| Session timeout (host disconnect) | 5 min |
| Session timeout (all disconnect) | 2 min |
| Session max duration | 4 hours |
| Memory monitoring | `process.memoryUsage()` every 60s, warn 80%, reject 90% of 512MB |

### Dual Event Log

- **stateLog:** DJ transitions, ceremony results, votes, joins/leaves. Low frequency. Used for reconnection replay. Capped at 500
- **activityLog:** Reactions, soundboard, streaks, captures. High frequency. Observability only — pino, never for reconnection. Fire-and-forget

### Reconnection Tiers

| Tier | Condition | Action |
|------|-----------|--------|
| Brief | ≤50 stateLog gap | Replay events from cursor |
| Medium | 50-500 gap | Full state snapshot |
| Long | Cursor behind trim or >60s | Full sync + "missed events" indicator |

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- For full architectural details, consult `_bmad-output/planning-artifacts/architecture.md`

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack or patterns change
- Remove rules that become obvious over time
- Review after each epic for accuracy

Last Updated: 2026-03-05

---

**When in doubt:** Server is authoritative. Client is a thin renderer. Errors are silent but logged. Check the architecture document.

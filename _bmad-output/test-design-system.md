# System-Level Test Design: Karamania

**Date:** 2026-03-24
**Author:** TEA Agent
**Status:** Draft
**Mode:** System-Level (Phase 3 Testability Review)

---

## Executive Summary

**Scope:** Full system testability review for a real-time multiplayer karaoke party app (Flutter + Node.js/Socket.io + PostgreSQL + Firebase)

**Risk Summary:**
- Total risks identified: 14
- High-priority risks (>=6): 5
- Critical categories: TECH (real-time sync), SEC (auth), PERF (latency), OPS (local dev)

**Key Finding:** The app's multiplayer nature creates a fundamental testability challenge -- you need 3+ devices to test core flows. This document addresses that gap with a bot client strategy and local dev harness.

---

## Testability Assessment

### Controllability: CONCERNS

**Strengths:**
- DJ engine is pure functions with zero I/O imports -- 100% unit testable
- Three-tier architecture (handlers -> services -> persistence) enables clean mocking boundaries
- Server-authoritative design means all critical state is testable server-side
- Zod schemas at every boundary enable contract testing
- Factory pattern established server-side (`createTestUser`, `createTestSession`, etc.)

**Concerns:**
- **No bot/headless client** for simulating multiplayer without physical devices
- **No database seed script** -- developers must manually set up test state
- **SocketClient is a singleton** -- hard to inject test doubles in Flutter
- **External APIs (YouTube Lounge, Spotify) have no local mock server** -- tests rely on `vi.mock()` which doesn't test HTTP contract
- **No way to trigger DJ state transitions from outside** the socket flow -- need a test/debug API endpoint or admin socket command

**Recommendations:**
1. Create a **headless bot client** (Node.js script) that can join a party, send reactions, vote, and respond to cards -- eliminates the 3-device requirement for local dev
2. Add a **seed endpoint** (`POST /api/test/seed` behind `NODE_ENV=test` guard) for setting up test scenarios
3. Add a **debug/admin socket namespace** (`/admin`) for forcing DJ state transitions during dev
4. Create a **mock API server** (MSW or similar) for YouTube/Spotify integration testing

### Observability: PASS

**Strengths:**
- Event stream logging captures every DJ transition with timestamps and metadata
- Socket.io connection tracking with `connection-tracker.ts`
- Full session persistence on every state transition (enables post-mortem analysis)
- Fastify request logging built-in
- Graceful shutdown hooks provide clean teardown observability

**Minor Gaps:**
- No structured logging format (JSON) for machine parsing
- No OpenTelemetry or trace IDs for cross-service correlation
- No client-side error reporting (Sentry/Crashlytics not configured)

### Reliability: CONCERNS

**Strengths:**
- Connection resilience with three-tier reconnection (brief/medium/long)
- Host transfer logic (60s absence threshold)
- Write-on-transition persistence pattern (crash recovery)
- Rate limiter is a pure function (testable, isolated)
- PostgreSQL connection pool with retry logic

**Concerns:**
- **No socket integration tests** -- server socket handlers are tested in isolation but never tested with an actual Socket.io client connecting
- **No reconnection scenario tests** -- the three-tier reconnection is documented but not exercised in tests
- **No concurrent vote race condition tests** -- critical for Quick Pick and Quick Vote
- **Singleton patterns in Flutter** (SocketClient, UploadQueue) create test isolation risks

---

## Architecturally Significant Requirements (ASRs)

| ASR ID | Requirement | NFR Ref | Risk Score | Category | Notes |
|--------|-------------|---------|------------|----------|-------|
| ASR-1 | DJ state sync <=200ms to all participants | NFR1-2 | 9 (3x3) | PERF | Core experience -- laggy sync kills the party |
| ASR-2 | Emoji reactions visible <=100ms | NFR2 | 6 (3x2) | PERF | High-frequency events, 12 concurrent senders |
| ASR-3 | Session recovery after server restart | NFR10,13 | 6 (2x3) | TECH | Full persistence model mitigates but untested |
| ASR-4 | Concurrent votes without race conditions | NFR11 | 6 (3x2) | DATA | Quick Pick/Vote with 12 simultaneous voters |
| ASR-5 | Guest auth never blocks party join | NFR34 | 6 (2x3) | BUS | Revenue/engagement impact if join fails |
| ASR-6 | YouTube Lounge API failure graceful | NFR31 | 4 (2x2) | TECH | Fallback to suggestion-only mode exists |
| ASR-7 | Media upload never blocks party | NFR -- | 3 (1x3) | TECH | Background upload with retry already designed |
| ASR-8 | App size <50MB | NFR7 | 2 (1x2) | OPS | Pre-bundled audio assets need monitoring |
| ASR-9 | 60fps @ 12 participants | NFR5 | 4 (2x2) | PERF | Flutter rendering under heavy socket updates |
| ASR-10 | Memory growth <15MB over 3 hours | NFR28 | 4 (2x2) | PERF | Long sessions, event stream accumulation |

---

## Test Levels Strategy

Given the architecture (mobile client + server + real-time WebSocket + external APIs), the recommended split is:

### Recommended Test Pyramid

```
              ╭─────────╮
              │  E2E    │  10% - Critical multiplayer user journeys
              │ (new!)  │  Flutter integration_test + bot clients
              ├─────────┤
              │  API /  │  25% - Socket handler contracts, REST endpoints,
              │ Integ.  │  DB integration, external API contracts
              ├─────────┤
              │  Unit   │  65% - DJ engine, state management, models,
              │         │  utilities, factories, pure business logic
              ╰─────────╯
```

**Rationale for heavy unit (65%):**
- DJ engine is pure functions -- highest ROI for unit tests
- 12+ state machine with 30+ transitions needs exhaustive edge case coverage
- Rate limiter, song normalizer, title parser are pure functions

**Rationale for significant integration (25%):**
- Socket handler -> service -> persistence chain is the critical path
- External API contracts (YouTube, Spotify) need contract verification
- Database queries need real PostgreSQL validation (not ORM mocks)

**Rationale for E2E (10%):**
- Multiplayer flows CANNOT be validated at lower levels
- DJ state sync latency is only measurable end-to-end
- Join -> play -> react -> ceremony -> finale is the core journey

### Test Levels by Component

| Component | Unit | Integration | E2E |
|-----------|------|-------------|-----|
| DJ Engine (state machine) | Heavy (pure functions) | Light (persistence) | Smoke (full cycle) |
| Socket Handlers | Light (validation) | Heavy (with real Socket.io client) | Critical paths only |
| REST Routes | Light (validation) | Heavy (Fastify inject) | N/A |
| Flutter Screens | Widget tests | N/A | Critical journeys |
| Flutter State (Providers) | Heavy | N/A | Via journeys |
| External APIs | N/A | Contract tests (MSW) | N/A |
| Database/Persistence | N/A | Heavy (real PostgreSQL) | N/A |

---

## NFR Testing Approach

### Performance Testing

| NFR | Target | Test Approach | Tool |
|-----|--------|---------------|------|
| NFR1-2 | State sync <=200ms | Bot client measures round-trip time | Custom bot + timestamps |
| NFR2 | Reactions <=100ms | Measure emit-to-broadcast latency | Socket.io instrumentation |
| NFR5 | 60fps @ 12 participants | Flutter performance overlay in integration_test | Flutter DevTools |
| NFR28 | Memory <15MB growth/3hr | Long-running session with memory profiling | Dart Observatory |
| NFR29 | Playlist import <5s | API benchmark tests | Vitest with timing assertions |

**Load Testing Strategy:**
- Use k6 with WebSocket protocol support to simulate 12 concurrent participants
- Script: join session -> send reactions (2/sec) -> vote -> respond to cards
- Measure: p95 latency, message ordering, server CPU/memory

### Security Testing

| NFR | Target | Test Approach |
|-----|--------|---------------|
| NFR21 | Party codes expire | Integration test: expired code returns 403 |
| NFR23 | Rate limiting works | Integration test: exceed threshold, verify throttle |
| NFR24 | Session isolation | Integration test: user A can't emit to session B |
| NFR25 | Authenticated WebSocket | Integration test: no token -> connection rejected |
| Guest JWT | Session-scoped, 6hr TTL | Unit test: token expiry, scope validation |

### Reliability Testing

| NFR | Target | Test Approach |
|-----|--------|---------------|
| NFR8-9 | DJ continues on disconnect | Integration: disconnect host socket, verify DJ advances |
| NFR10 | Server crash recovery | Integration: kill server, restart, verify session state |
| NFR11 | Concurrent votes | Integration: 12 simultaneous vote emissions, verify count |
| NFR13 | Graceful shutdown | Integration: SIGTERM, verify cleanup and persistence |

### Maintainability

| Target | Test Approach |
|--------|---------------|
| Test coverage >=80% critical paths | Vitest coverage (already configured), add Flutter coverage |
| No type drift | Codegen verification in CI (already exists for server) |
| No API contract drift | OpenAPI schema validation + Flutter codegen verification |

---

## Test Environment Requirements

### Local Development Environment

**Current Setup:**
```
Developer Machine
├── Docker: PostgreSQL 16
├── Server: tsx --watch (hot reload)
├── Flutter: flutter run (hot reload)
└── Manual: Open app on 1 phone/emulator
```

**Problem:** Testing a 12-person karaoke party requires multiple devices. Currently, the only way to test multiplayer flows is:
1. Run server locally
2. Open Flutter app on 2-3 physical devices or emulators
3. Manually join party on each device
4. Manually interact on each device simultaneously

This is slow, error-prone, and impossible for one developer to do alone.

### Proposed Local Dev Environment

```
Developer Machine
├── Docker: PostgreSQL 16
├── Server: tsx --watch (hot reload)
├── Flutter: flutter run (hot reload on 1 device)
├── Bot Manager: node bots/manager.ts (NEW)
│   ├── Bot 1: "Auto-DJ" — joins, reacts, votes automatically
│   ├── Bot 2: "Chaos Monkey" — rapid reactions, disconnects, reconnects
│   └── Bot N: configurable behavior profiles
├── Mock API Server: MSW (NEW)
│   ├── YouTube Lounge API mock (pairing + playback)
│   ├── YouTube Data API mock (playlist, metadata)
│   └── Spotify Web API mock (playlist import)
└── Seed Script: tsx scripts/seed-test-data.ts (NEW)
    ├── Creates test users
    ├── Creates active session in specific DJ state
    └── Pre-populates song catalog subset
```

### Bot Client Architecture (KEY RECOMMENDATION)

**Purpose:** Simulate multiple party participants without physical devices. Essential for both local dev AND automated E2E testing.

**Implementation:**

```typescript
// bots/bot-client.ts
import { io, Socket } from 'socket.io-client';

interface BotConfig {
  name: string;
  behavior: 'passive' | 'active' | 'chaos' | 'spectator';
  reactionRate: number;  // reactions per minute
  voteDelay: number;     // ms to wait before voting
  disconnectChance: number; // 0-1, for chaos bot
}

class BotClient {
  private socket: Socket;

  constructor(private config: BotConfig) {}

  async joinParty(serverUrl: string, partyCode: string): Promise<void> {
    // 1. REST: POST /api/auth/guest { displayName }
    // 2. Socket: connect with token
    // 3. Socket: emit 'party:join' { partyCode }
  }

  async startBehavior(): Promise<void> {
    // Listen for DJ state changes
    // React based on behavior profile
    // Vote when prompted
    // Respond to cards
  }
}
```

**Bot Behavior Profiles:**

| Profile | Description | Use Case |
|---------|-------------|----------|
| `passive` | Joins, listens, occasional reactions (1/min) | Baseline participant |
| `active` | Frequent reactions (10/min), always votes, accepts cards | Normal engaged user |
| `chaos` | Rapid reactions (30/sec), random disconnects, rejoins | Stress testing, edge cases |
| `spectator` | Joins, does nothing | Min-interaction testing |
| `host-mirror` | Mirrors host actions with slight delay | Testing concurrent host actions |

**Bot Manager (Orchestrator):**

```typescript
// bots/manager.ts
// CLI: npx tsx bots/manager.ts --bots 5 --server http://localhost:3000 --party ABCD
// Creates 5 bots with mixed profiles, joins them to party ABCD
// Logs all events for debugging
```

### CI/CD Environment

**Current:** Server CI only (PostgreSQL service container, Vitest)

**Proposed additions:**

| Environment | Purpose | Infrastructure |
|-------------|---------|----------------|
| CI - Server | Unit + integration tests | GitHub Actions + PostgreSQL 16 (existing) |
| CI - Flutter | Unit + widget tests | GitHub Actions + Flutter SDK (NEW) |
| CI - Socket Integration | Real server + bot clients | GitHub Actions + PostgreSQL + server process (NEW) |
| CI - E2E (future) | Full stack with Flutter driver | Self-hosted runner or cloud device farm (LATER) |

---

## E2E Test Strategy

### What to Cover at E2E Level

E2E tests should only cover **critical multiplayer journeys** that cannot be validated at lower levels:

**P0 E2E Scenarios (must have):**

| ID | Scenario | Participants | Duration | Why E2E? |
|----|----------|-------------|----------|----------|
| E2E-001 | Host creates party, 3 guests join via code, DJ cycles through 2 songs, party ends | 4 (1 host + 3 bots) | ~3 min | Full lifecycle validation |
| E2E-002 | Host disconnects mid-song, DJ auto-transfers to next participant, party continues | 3 (1 host + 2 bots) | ~2 min | Reconnection + host transfer |
| E2E-003 | 6 participants vote simultaneously in Quick Pick, correct winner selected | 7 (1 host + 6 bots) | ~1 min | Concurrent vote race condition |
| E2E-004 | Guest joins, upgrades to OAuth mid-session, socket continues without drop | 2 (1 real + 1 bot) | ~2 min | Auth upgrade continuity |

**P1 E2E Scenarios (should have):**

| ID | Scenario | Why E2E? |
|----|----------|----------|
| E2E-005 | Full ceremony flow: singing -> ceremony -> awards -> next song | Multi-step state transitions |
| E2E-006 | Playlist import (YouTube) -> song suggestion -> Quick Pick -> TV playback | External API chain |
| E2E-007 | Party card dealt -> accepted -> group card triggers -> completed | Card lifecycle across participants |
| E2E-008 | 12 participants sustained for 30 minutes with continuous reactions | Performance/stability |

### E2E Test Implementation

**Approach: Server-side E2E with bot clients** (not Flutter driver tests initially)

Why server-side first:
1. Bot clients test the real Socket.io protocol -- if the server works, the Flutter client works
2. No need for device farm or emulators
3. Runs in CI without special infrastructure
4. Fast iteration (no app build step)
5. Covers the multiplayer aspect that can't be tested any other way

```typescript
// tests/e2e/party-lifecycle.e2e.test.ts
import { createBotClient } from '../../bots/bot-client';
import { startServer, stopServer } from '../helpers/server-lifecycle';

describe('E2E: Party Lifecycle', () => {
  let server: FastifyInstance;
  let host: BotClient;
  let guests: BotClient[];

  beforeAll(async () => {
    server = await startServer(); // Real server on random port
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it('E2E-001: Full party lifecycle with 4 participants', async () => {
    // 1. Host creates party
    host = createBotClient({ name: 'Host', behavior: 'active' });
    const { partyCode } = await host.createParty(serverUrl);

    // 2. Guests join
    guests = await Promise.all([
      createBotClient({ name: 'Guest-1', behavior: 'active' }).joinParty(serverUrl, partyCode),
      createBotClient({ name: 'Guest-2', behavior: 'passive' }).joinParty(serverUrl, partyCode),
      createBotClient({ name: 'Guest-3', behavior: 'active' }).joinParty(serverUrl, partyCode),
    ]);

    // 3. Host starts party
    await host.startParty();

    // 4. Wait for DJ to cycle through singing -> ceremony -> singing
    await host.waitForState('singing');
    await host.skipSong(); // Skip to next
    await host.waitForState('ceremony');
    await host.waitForState('singing'); // Auto-advance after ceremony

    // 5. End party
    await host.endParty();

    // 6. Verify session persisted correctly
    const session = await getSession(host.sessionId);
    expect(session.status).toBe('ended');
    expect(session.participants).toHaveLength(4);
  });
});
```

### Flutter Integration Tests (Later Phase)

Once bot clients validate server behavior, add Flutter `integration_test/` for UI validation:

| Test | What it validates | When to add |
|------|-------------------|-------------|
| `join_flow_test.dart` | QR scan -> lobby -> party screen renders | After bot E2E stable |
| `reaction_ui_test.dart` | Tap emoji -> animation plays -> streak counter | After bot E2E stable |
| `ceremony_ui_test.dart` | Award animations render correctly | After bot E2E stable |

---

## Manual Test Plan

### Pre-Release QA Checklist

**Party Creation & Join (15 min):**

- [ ] Create party on iOS, join on Android via QR code
- [ ] Create party on Android, join on iOS via party code
- [ ] Join via web landing page deep link (iOS + Android)
- [ ] Join mid-session, verify catch-up summary shown
- [ ] Verify lobby shows all participant names and avatars
- [ ] Verify host FAB controls accessible within 1 tap

**DJ Engine & Song Flow (20 min):**

- [ ] DJ cycles through: icebreaker -> singing -> ceremony -> singing automatically
- [ ] Host skip advances to next song/state
- [ ] Host pause stops DJ, resume continues
- [ ] 90s inactivity auto-pause triggers
- [ ] Audio cues play on state transitions (distinct sounds)
- [ ] Ceremony awards display correctly (Full ceremony with 4+ participants)

**Multiplayer Real-Time (20 min):**

- [ ] Emoji reactions visible on all devices within ~200ms
- [ ] Reaction streaks trigger at 5/10/20/50 milestones
- [ ] Soundboard effects play on all devices
- [ ] Party card appears on selected participant's device
- [ ] Group card announced to all participants
- [ ] Quick Pick: all participants can vote, winner displayed correctly
- [ ] Spin the Wheel: animation synced, veto works once per round

**Connection Resilience (15 min):**

- [ ] Kill app on participant's phone -> rejoin within 5 min -> state preserved
- [ ] Kill app on host's phone -> 60s -> host transfers to next participant
- [ ] Put phone on airplane mode 10s -> auto-reconnect without error
- [ ] Server restart -> all participants reconnect, session continues

**Song Integration (15 min):**

- [ ] Import YouTube Music playlist (<5s for 50 tracks)
- [ ] Import Spotify playlist (<5s for 50 tracks)
- [ ] TV pairing via YouTube Lounge code
- [ ] Song plays on TV when DJ enters singing state
- [ ] Suggestion-only mode works when TV not paired

**Media Capture (10 min):**

- [ ] Capture bubble appears during singing/ceremony
- [ ] Take photo -> appears in session gallery
- [ ] Record 5s video -> uploads in background
- [ ] Record audio snippet -> uploads in background
- [ ] Media accessible for 7 days as guest

**Auth & Profile (10 min):**

- [ ] Guest join with name only (no login required)
- [ ] Google OAuth login
- [ ] Facebook OAuth login
- [ ] Guest upgrade to account mid-session (no disconnect)
- [ ] Session history visible on home screen after auth

**Session Timeline & Sharing (10 min):**

- [ ] Session list shows 20 most recent
- [ ] Session detail shows participants, setlist, awards, media
- [ ] Share session via link (web view renders correctly)
- [ ] "Let's go again!" message sends successfully

**Performance & Device (10 min):**

- [ ] App size <50MB on both platforms
- [ ] Smooth 60fps with 6+ participants tapping simultaneously
- [ ] Screen stays on during active party (wake lock)
- [ ] App doesn't crash after 1 hour continuous use
- [ ] Memory doesn't grow excessively (check via DevTools)

**Edge Cases (10 min):**

- [ ] Solo host party (only 1 participant) -- DJ handles gracefully
- [ ] Rate limiting kicks in at rapid tapping (visual feedback dims)
- [ ] Expired party code returns friendly error
- [ ] Network timeout on playlist import shows retry option

---

## Testability Concerns

### CONCERN 1: Multiplayer Testing Requires Physical Devices (Score: 9 - BLOCK)

**Issue:** Core app functionality (party join, reactions, voting, ceremonies) requires multiple simultaneous participants. Currently no way to simulate this without 3+ physical devices or emulators.

**Impact:** Developers cannot test the most critical flows during local development. Bugs in multiplayer logic are only caught during manual testing or production.

**Mitigation:** Build bot client system (described above). This is the #1 recommendation.

**Status:** BLOCKING for effective development -- should be Sprint 0 priority.

### CONCERN 2: No Socket Integration Tests (Score: 6)

**Issue:** Socket handlers are tested with mocked Socket.io objects. No test verifies that a real Socket.io client can connect, authenticate, join a party, and receive broadcasts.

**Impact:** Contract bugs between server and client go undetected until manual testing.

**Mitigation:** Add socket integration tests using real Socket.io client (same bot client code). Run in CI with real server instance.

### CONCERN 3: External API Dependencies Untestable Locally (Score: 4)

**Issue:** YouTube Lounge API (unofficial), YouTube Data API, and Spotify Web API are mocked with `vi.mock()`. No HTTP-level contract testing exists.

**Impact:** API contract changes or request format errors are not caught until runtime.

**Mitigation:** Add MSW (Mock Service Worker) for HTTP-level mock server. Create response fixtures from real API captures. Lower priority since fallback/degradation paths exist.

### CONCERN 4: No Flutter CI (Score: 4)

**Issue:** Flutter tests only run locally. No CI workflow validates Flutter code on push/PR.

**Impact:** Flutter regressions can merge to main undetected.

**Mitigation:** Add `.github/workflows/flutter-ci.yml` with `flutter test` and `flutter analyze`.

---

## Local Development Harness (NEW -- Addressing User Request)

### The Problem

Karamania is a multiplayer party game. The core experience -- reactions, voting, cards, ceremonies -- only makes sense with multiple participants. A developer working on the emoji reaction feature needs to:

1. See reactions sent by OTHER participants
2. See reaction streaks building across the group
3. See the DJ engine responding to group activity
4. Test what happens when 6 people vote simultaneously

Currently, this requires juggling 3+ phones/emulators manually. This is the biggest friction point in the development workflow.

### The Solution: Dev Harness

A local development tool that auto-populates your party with bot participants:

**Quick Start:**

```bash
# Terminal 1: Start server
cd apps/server && npm run dev

# Terminal 2: Start Flutter app (your device/emulator)
cd apps/flutter_app && flutter run --dart-define-from-file=dart_defines_dev.json

# Terminal 3: Start bots (NEW)
cd apps/server && npx tsx bots/manager.ts --bots 5 --party AUTO
# AUTO = finds active party or creates one
```

**What the bots do:**
- Automatically join your active party
- Send emoji reactions at realistic intervals
- Vote when Quick Pick / Quick Vote appears
- Accept party cards when dealt
- Simulate disconnects/reconnects (chaos bot)
- Log all events to console for debugging

**Dev Scenarios:**

| Scenario | Command | What Happens |
|----------|---------|--------------|
| Normal party | `--bots 5 --behavior active` | 5 active participants join |
| Stress test | `--bots 11 --behavior chaos` | 11 chaos bots spam reactions |
| Solo dev | `--bots 1 --behavior spectator` | 1 quiet participant for 2-person minimum |
| Voting test | `--bots 8 --behavior vote-split` | 8 bots split votes 4-4 for tie scenario |
| Reconnection | `--bots 3 --behavior reconnect` | 3 bots that disconnect/reconnect periodically |

**Implementation Priority:**

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| 1 | Basic bot: join, listen, react | 1 day |
| 2 | Bot manager: spawn N bots, mixed profiles | 0.5 days |
| 3 | Voting + card behavior | 0.5 days |
| 4 | Chaos/reconnect behavior | 0.5 days |
| 5 | CLI with `--party AUTO` detection | 0.5 days |
| **Total** | **Full dev harness** | **3 days** |

### Database Seed Script

```bash
# Seed local database with test data
npx tsx scripts/seed-test-data.ts

# What it creates:
# - 5 test users (test-host, test-guest-1..4)
# - Pre-populated karaoke catalog (100 songs)
# - 3 historical sessions with participants, setlists, and media
# - Useful for testing session timeline, session detail screens
```

### Mock API Server

```bash
# Start mock server for external APIs (optional, for offline dev)
npx tsx scripts/mock-api-server.ts --port 3001

# Mocks:
# - YouTube Lounge API: fake TV pairing, playback state
# - YouTube Data API: playlist response, video metadata
# - Spotify Web API: playlist response, auth token
# Configure via: apps/server/.env.local
#   YOUTUBE_LOUNGE_URL=http://localhost:3001/lounge
#   YOUTUBE_DATA_URL=http://localhost:3001/youtube
#   SPOTIFY_API_URL=http://localhost:3001/spotify
```

---

## Recommendations for Implementation

### Sprint 0 Priorities (Before Feature Development)

| # | Task | Effort | Justification |
|---|------|--------|---------------|
| 1 | **Bot client (basic)** -- join, react, vote | 1 day | Unblocks multiplayer dev for the entire team |
| 2 | **Bot manager** -- spawn N bots via CLI | 0.5 days | Makes bot client usable |
| 3 | **Database seed script** | 0.5 days | Eliminates manual test data setup |
| 4 | **Flutter CI workflow** | 0.5 days | Catches regressions automatically |
| 5 | **Socket integration test harness** | 1 day | Uses bot client code, validates real protocol |

**Total Sprint 0 test infra:** ~3.5 days

### Near-Term (Sprint 1-2)

| # | Task | Effort |
|---|------|--------|
| 6 | E2E-001 test (full party lifecycle) | 1 day |
| 7 | E2E-002 test (host disconnect + transfer) | 0.5 days |
| 8 | E2E-003 test (concurrent voting) | 0.5 days |
| 9 | Mock API server (YouTube/Spotify) | 1 day |
| 10 | Existing test quality fixes (Phase 1-2 from test-review) | 2-3 days |

### Later (Sprint 3+)

| # | Task | Effort |
|---|------|--------|
| 11 | Flutter integration_test setup | 1 day |
| 12 | Performance/load testing with k6 | 2 days |
| 13 | Manual QA checklist execution (pre-TestFlight) | 1 day |
| 14 | Bot chaos profiles for resilience testing | 1 day |

---

## Risk Assessment (Full Matrix)

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|------|--------|-------|------------|-------|
| R-001 | PERF | DJ state sync exceeds 200ms under 12 participants | 3 | 3 | 9 | Bot load testing, p95 latency monitoring | Dev |
| R-002 | TECH | Multiplayer flows untestable during dev | 3 | 3 | 9 | Bot client system (Sprint 0) | Dev |
| R-003 | DATA | Concurrent votes cause race condition | 3 | 2 | 6 | Server-side atomic counting, E2E-003 test | Dev |
| R-004 | SEC | Guest JWT forgery or session hijacking | 2 | 3 | 6 | JWT validation tests, session isolation tests | Dev |
| R-005 | TECH | Server crash loses active session state | 2 | 3 | 6 | Recovery integration test, persistence validation | Dev |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation |
|---------|----------|-------------|------|--------|-------|------------|
| R-006 | TECH | YouTube Lounge API changes break TV pairing | 2 | 2 | 4 | Graceful degradation exists, add contract test |
| R-007 | PERF | Memory leak in 3-hour session | 2 | 2 | 4 | Long-running bot session, memory profiling |
| R-008 | OPS | No Flutter CI catches regressions late | 2 | 2 | 4 | Add Flutter CI workflow |
| R-009 | PERF | 60fps drops with 12 active participants | 2 | 2 | 4 | Flutter performance profiling in integration_test |
| R-010 | BUS | Auth upgrade drops WebSocket connection | 2 | 2 | 4 | E2E-004 test validates continuity |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
|---------|----------|-------------|------|--------|-------|--------|
| R-011 | OPS | App size exceeds 50MB | 1 | 2 | 2 | Monitor in CI build step |
| R-012 | BUS | Deep link fails on specific OS version | 1 | 2 | 2 | Manual test on oldest supported OS |
| R-013 | TECH | Spotify API rate limit during playlist import | 1 | 1 | 1 | Server-side token caching exists |
| R-014 | OPS | Docker PostgreSQL version drift from Railway | 1 | 1 | 1 | Pin version in docker-compose |

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **DJ engine (pure functions)**: >=90% line coverage
- **Socket handlers**: >=80% branch coverage
- **REST routes**: >=80% line coverage
- **Flutter state management**: >=70% line coverage
- **Critical paths (E2E)**: 4 P0 scenarios passing

### Non-Negotiable Requirements

- [ ] All P0 E2E tests pass (E2E-001 through E2E-004)
- [ ] No high-risk (>=6) items unmitigated
- [ ] Bot client system functional for local dev
- [ ] Flutter CI workflow passing
- [ ] DJ engine test coverage >=90%

---

## Appendix

### Knowledge Base References

- `nfr-criteria.md` - NFR validation approach (performance, security, reliability thresholds)
- `test-levels-framework.md` - Test level selection strategy (unit vs integration vs E2E)
- `risk-governance.md` - Risk classification (6 categories), scoring, gate decision engine
- `test-quality.md` - Quality standards, Definition of Done
- `probability-impact.md` - Risk scoring methodology (probability x impact matrix)
- `test-priorities-matrix.md` - P0-P3 prioritization criteria

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- Test Quality Review: `_bmad-output/test-review.md`
- Test Quality Fix Plan: `_bmad-output/planning-artifacts/test-quality-fix-plan.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `testarch-test-design` v4.0 (System-Level Mode)
**Date**: 2026-03-24

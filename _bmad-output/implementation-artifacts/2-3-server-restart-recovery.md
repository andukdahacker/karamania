# Story 2.3: Server Restart Recovery

Status: done

## Story

As a system operator,
I want active parties to recover automatically after a server restart,
so that no party is lost due to server issues.

## Acceptance Criteria

1. **Given** the server restarts **When** active sessions exist in the database **Then** the server reads all sessions with `status = 'active'` and reconstructs DJ state machines from the `dj_state` JSONB column
2. **Given** a recovered session has an active timer **When** the timer's elapsed time is calculated from `timerStartedAt` **Then** expired timers trigger immediate TIMEOUT transition; unexpired timers are rescheduled with the remaining duration
3. **Given** DJ state recovery completes **When** clients reconnect via Socket.io's automatic reconnection **Then** clients receive a `dj:stateChanged` event with the recovered state during the normal reconnection flow (tier 3 long reconnection with full state sync)
4. **Given** DJ state recovery fails for a session **When** deserialization or reconstruction cannot complete **Then** the session is gracefully terminated: status set to `'ended'` in the database, and reconnecting clients receive a `party:ended` event with reason `'session_recovery_failed'`
5. **Given** recovery is tested **When** unit tests run **Then** all recovery scenarios are covered: mid-song, mid-ceremony, mid-interlude, paused state (timer fields null), lobby state (no DJ state), and corrupted DJ state

## Tasks / Subtasks

- [x] Task 1: Add `findActiveSessions()` to session-repository (AC: #1)
  - [x] 1.1 Add query: `SELECT * FROM sessions WHERE status = 'active'`
  - [x] 1.2 Unit test with mocked Kysely chain
- [x] Task 2: Create `recoverActiveSessions()` in session-manager (AC: #1, #2, #4)
  - [x] 2.1 Fetch all active sessions via `findActiveSessions()`
  - [x] 2.2 For each session with non-null `dj_state`: deserialize via `deserializeDJContext()`
  - [x] 2.3 Reconcile timers using `calculateRemainingMs(context, Date.now())`
  - [x] 2.4 If remaining > 0: return `scheduleTimer` side effect with remaining duration
  - [x] 2.5 If remaining === 0 (timer expired during downtime): call `processTransition()` with TIMEOUT event to advance state, then check new state's timer
  - [x] 2.6 Store recovered DJContext in an in-memory session store (Map<sessionId, DJContext>)
  - [x] 2.7 Return recovery results: `{ recovered: string[], failed: string[] }`
  - [x] 2.8 On deserialization failure: log error, set session status to `'ended'`, add to `failed` list
- [x] Task 3: Create in-memory DJ state store (AC: #1, #3)
  - [x] 3.1 Create `services/dj-state-store.ts` with `Map<string, DJContext>`
  - [x] 3.2 Export functions: `getSessionDjState(sessionId)`, `setSessionDjState(sessionId, context)`, `removeSessionDjState(sessionId)`, `getAllActiveSessions()`
  - [x] 3.3 Refactor `initializeDjState()` and `processDjTransition()` to also write to the in-memory store
  - [x] 3.4 Unit tests for the store module
- [x] Task 4: Integrate recovery into server boot sequence (AC: #1, #2)
  - [x] 4.1 In `index.ts`, call `recoverActiveSessions()` AFTER DB connection but BEFORE `setupSocketHandlers()`
  - [x] 4.2 Log recovery summary at `info` level: count of recovered and failed sessions
  - [x] 4.3 Recovery must not block server start on partial failure — successful sessions proceed, failed sessions are ended
- [x] Task 5: Wire timer side effects to actual scheduling (AC: #2)
  - [x] 5.1 Create `services/timer-scheduler.ts` with `scheduleSessionTimer(sessionId, durationMs, onTimeout)` and `cancelSessionTimer(sessionId)`
  - [x] 5.2 The `onTimeout` callback calls `processDjTransition()` with TIMEOUT event and broadcasts the result
  - [x] 5.3 Use this scheduler from recovery AND from normal `processDjTransition()` side-effect handling
  - [x] 5.4 Unit tests with fake timers (`vi.useFakeTimers()`)
- [x] Task 6: Ensure reconnecting clients get recovered state (AC: #3)
  - [x] 6.1 In `connection-handler.ts` reconnection flow, after join, check if session has DJ state in the in-memory store
  - [x] 6.2 If DJ state exists: emit `dj:stateChanged` to the reconnecting socket with current state
  - [x] 6.3 This uses the existing reconnection pathway — no new protocol needed
- [x] Task 7: Graceful termination for failed recovery (AC: #4)
  - [x] 7.1 In `recoverActiveSessions()`, on failure: call `sessionRepo.updateStatus(sessionId, 'ended')`
  - [x] 7.2 Store failed session IDs so reconnecting clients can be notified
  - [x] 7.3 In connection-handler, if session status is `'ended'`: emit `party:ended` with `{ reason: 'session_recovery_failed' }` and disconnect
- [x] Task 8: Comprehensive unit tests (AC: #5)
  - [x] 8.1 Test recovery of session in mid-song state (timer partially elapsed)
  - [x] 8.2 Test recovery of session in mid-ceremony state
  - [x] 8.3 Test recovery of session in mid-interlude state
  - [x] 8.4 Test recovery with expired timer (should auto-advance via TIMEOUT)
  - [x] 8.5 Test recovery of paused state (timerStartedAt=null, timerDurationMs=null — no timer to reconcile)
  - [x] 8.6 Test recovery of lobby state (dj_state=null — skip, no recovery needed)
  - [x] 8.7 Test recovery with corrupted/invalid DJ state JSON (should gracefully end session)
  - [x] 8.8 Test recovery with multiple active sessions (mix of success and failure)
  - [x] 8.9 Test that failed recovery sets session status to 'ended'
  - [x] 8.10 Test recovery of session with timer that expired during downtime triggers cascading transitions (e.g., songSelection timeout → song → scheduleTimer)

## Dev Notes

### Architecture Compliance

- **`persistence/session-repository.ts`** is the ONLY file importing from `db/` — `findActiveSessions()` goes here
- **`services/session-manager.ts`** orchestrates recovery — the ONLY cross-boundary service
- **`dj-engine/`** has ZERO external imports — `calculateRemainingMs()` and `deserializeDJContext()` are already there and pure
- **New `services/dj-state-store.ts`** is an in-memory Map — no persistence imports needed
- **New `services/timer-scheduler.ts`** handles `setTimeout`/`clearTimeout` — no dj-engine imports, just calls back to session-manager
- Import chain: `index.ts` → `session-manager` → `persistence/session-repository` → `db/`

### Critical Implementation Patterns (from Stories 2.1 & 2.2)

**Fire-and-Forget Persistence:**
```typescript
void persistDjState(sessionId, serializedState);  // CORRECT — don't await
```

**Side Effects as Data (dj-engine is pure):**
```typescript
const { newContext, sideEffects } = processTransition(context, { type: 'TIMEOUT' }, Date.now());
// Caller interprets side effects: broadcast, scheduleTimer, cancelTimer, persist
```

**Timer Reconciliation (already implemented in `dj-engine/timers.ts`):**
```typescript
const remaining = calculateRemainingMs(recoveredContext, Date.now());
if (remaining === 0) {
  // Timer expired during downtime — trigger TIMEOUT transition
  const { newContext, sideEffects } = processTransition(recoveredContext, { type: 'TIMEOUT' }, Date.now());
} else {
  // Timer still active — reschedule with remaining duration
  scheduleSessionTimer(sessionId, remaining, onTimeout);
}
```

**Cascading Expired Timers:** When a timer expired during downtime and TIMEOUT advances to a new timed state (e.g., songSelection → partyCardDeal), the new state may also have an expired timer relative to the original `timerStartedAt`. However, since `processTransition` sets `timerStartedAt = now`, the new timer starts fresh from recovery time. This is correct behavior — we recover to the next live state, not replay every skipped state.

**Deserialization with Validation (already implemented in `dj-engine/serializer.ts`):**
```typescript
const context = deserializeDJContext(session.dj_state); // Throws DJEngineError on invalid data
```

### In-Memory DJ State Store Design

Currently, DJ state is created in `initializeDjState()` and passed through side effects, but there's no central in-memory store. For recovery, we need one:
- `Map<string, DJContext>` keyed by sessionId
- Written on: `initializeDjState()`, `processDjTransition()`, `recoverActiveSessions()`
- Read on: client reconnection (to send current DJ state), `processDjTransition()` (to get current context)
- Removed on: session end

This store is the "hot cache" referenced in the architecture. Currently, state flows through function parameters. Adding the store centralizes it for recovery access.

### Timer Scheduler Design

Currently, timer scheduling is mentioned in side effects but not actually implemented (placeholder for future stories). This story needs real timers because recovery must reschedule them. The scheduler is simple:
- `Map<string, NodeJS.Timeout>` keyed by sessionId
- `scheduleSessionTimer(sessionId, durationMs, onTimeout)` — clears existing timer, sets new one
- `cancelSessionTimer(sessionId)` — clears timer if exists
- `onTimeout` callback: load DJ state from store → `processDjTransition(TIMEOUT)` → broadcast → reschedule if new state has timer

### Reconnection State Sync

The existing `connection-handler.ts` already sends `PARTY_PARTICIPANTS` on reconnection (line 90-96). For DJ state recovery:
- After sending participants, check `getSessionDjState(sessionId)`
- If DJ state exists, emit `dj:stateChanged` with `{ state: context.state, ...relevant fields }`
- This is the same event Story 2.4 will formalize — we emit the raw state for now

### What NOT to Build

- No new Socket.io events — use existing `dj:stateChanged` (defined in event catalog)
- No Flutter changes — this is server-only
- No event stream replay — events are in-memory during session (Story 2.8), lost on restart
- No horizontal scaling — single-process is 100x beyond MVP (architecture doc)
- No new database migrations — `sessions.dj_state` JSONB column already exists

### Project Structure Notes

- New files: `apps/server/src/services/dj-state-store.ts`, `apps/server/src/services/timer-scheduler.ts`
- Modified files: `apps/server/src/services/session-manager.ts`, `apps/server/src/persistence/session-repository.ts`, `apps/server/src/index.ts`, `apps/server/src/socket-handlers/connection-handler.ts`
- New test files: `apps/server/tests/services/dj-state-store.test.ts`, `apps/server/tests/services/timer-scheduler.test.ts`, `apps/server/tests/services/session-manager-recovery.test.ts`
- Alignment with unified project structure confirmed — all paths follow existing conventions

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#State Architecture] — Three-state model, server restart recovery steps 1-5
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — Three state tiers (hot/persistent/external)
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Recovery] — PostgreSQL write failure: 3 retries with exponential backoff
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — Acceptance criteria and BDD scenarios
- [Source: _bmad-output/implementation-artifacts/2-1-dj-engine-state-machine-server.md] — DJState enum, DJContext fields, processTransition(), calculateRemainingMs(), concurrency model
- [Source: _bmad-output/implementation-artifacts/2-2-dj-state-persistence.md] — persistDjState() fire-and-forget pattern, loadDjState(), session-manager DJ integration
- [Source: _bmad-output/project-context.md#Server Boundaries] — Enforced layer boundaries
- [Source: _bmad-output/project-context.md#State Persistence] — Full persistence model, in-memory hot cache, PostgreSQL source of truth

### Git Intelligence (Recent Commits)

- `f311f03` Story 2.2: DJ state persistence — established fire-and-forget pattern, `persistDjState()`, `loadDjState()`, `processDjTransition()`
- `59f6c88` Story 2.1: DJ engine state machine — established pure function architecture, side effects as data, `calculateRemainingMs()`
- `b0bec5e` Story 1.8: Connection resilience — established reconnection tracking, host transfer timers, `connection-tracker.ts`
- Pattern: all stories use `vi.mock()` for external deps, test factories for data, `vi.clearAllMocks()` in beforeEach

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — clean implementation with no blocking issues.

### Completion Notes List
- Task 1: Added `findActiveSessions()` to session-repository — simple query for `status = 'active'`, 2 unit tests
- Task 3: Created `dj-state-store.ts` — pure in-memory Map with get/set/remove/getAll/clear, 8 unit tests. Refactored `initializeDjState()`, `processDjTransition()`, and `startSession()` to write to store
- Task 5: Created `timer-scheduler.ts` — manages `setTimeout`/`clearTimeout` per sessionId, auto-clears on fire, 11 unit tests with `vi.useFakeTimers()`
- Task 2: Created `recoverActiveSessions()` — fetches active sessions, deserializes DJ state, reconciles timers (reschedule active / TIMEOUT expired), stores in memory, gracefully ends corrupted sessions. Added `isRecoveryFailed()` helper and `handleRecoveryTimeout()` callback
- Task 4: Integrated recovery into `index.ts` boot sequence — called after Firebase init, before socket handlers, with info-level logging
- Task 6: Added DJ state sync to connection-handler — after PARTY_PARTICIPANTS emit, checks store and emits `dj:stateChanged` if DJ state exists
- Task 7: Added failed recovery handling — checks `isRecoveryFailed()` before join, emits `party:ended` with `session_recovery_failed` reason and disconnects. Updated existing `party-join.test.ts` mocks
- Task 8: 15 comprehensive recovery tests covering all AC #5 scenarios plus `isRecoveryFailed` tests

### Implementation Plan
Implemented in dependency order: Task 1 (repo query) → Task 3 (state store) → Task 5 (timer scheduler) → Task 2 (recovery logic) → Task 4 (boot integration) → Task 6 (client sync) → Task 7 (failure handling) → Task 8 (comprehensive tests)

### File List
New files:
- apps/server/src/services/dj-state-store.ts
- apps/server/src/services/timer-scheduler.ts
- apps/server/tests/services/dj-state-store.test.ts
- apps/server/tests/services/timer-scheduler.test.ts
- apps/server/tests/services/session-manager-recovery.test.ts

Modified files:
- apps/server/src/persistence/session-repository.ts
- apps/server/src/services/session-manager.ts
- apps/server/src/socket-handlers/connection-handler.ts
- apps/server/src/index.ts
- apps/server/tests/persistence/session-repository.test.ts
- apps/server/tests/socket-handlers/party-join.test.ts

### Change Log
- 2026-03-11: Implemented Story 2.3 — Server restart recovery with in-memory DJ state store, timer scheduler, boot-time recovery, client reconnection state sync, and graceful failure handling. 294 tests passing (6 new tests added to existing files, 34 new tests in 3 new test files).
- 2026-03-11: Code review fixes — (H1) Added scheduleTimer/cancelTimer side effect handling to processDjTransition (Task 5.3 compliance). (H2) Moved setSessionDjState into initializeDjState (Task 3.3 compliance). (M1) Replaced dynamic import with static import for getSessionDjState. (M2) Added clearRecoveryFailed() to prevent memory leak. (M3) Moved registerPartyHandlers after isRecoveryFailed check. 4 new tests added, 298 tests passing.

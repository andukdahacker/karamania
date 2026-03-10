# Story 2.1: DJ Engine State Machine (Server)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a pure-logic state machine that governs the party game loop,
So that the party cycles through activities automatically with well-defined transitions and guards.

## Acceptance Criteria

1. **Given** the DJ engine is implemented in `dj-engine/` with zero imports from persistence, integrations, or socket-handlers
   **When** the engine is initialized for a session
   **Then** it implements the core cycle: song selection -> party card deal -> song -> ceremony -> interlude -> repeat (FR9)
   **And** all state transitions have defined guards that must be satisfied before transitioning
   **And** each state has configurable timeouts that trigger automatic advancement
   **And** placeholder transitions exist for party cards (Epic 4), ceremonies (Epic 3), and interludes (Epic 7)
   **And** the state machine is fully serializable (toJSON/fromJSON) for persistence round-trips
   **And** 100% unit test coverage is achieved for all states, transitions, guards, timers, and serialization round-trips
   **And** shared test factories in `tests/factories/` are used -- no inline test data
   **And** the engine handles concurrent state transition requests without race conditions (NFR11)

## Tasks / Subtasks

- [x] Task 1: Create DJ Engine type definitions (AC: #1)
  - [x] 1.1 Create `apps/server/src/dj-engine/types.ts` with DJState enum, DJTransition type, DJContext interface, TimerConfig interface
  - [x] 1.2 Define DJState enum: `lobby`, `songSelection`, `partyCardDeal`, `song`, `ceremony`, `interlude`, `finale`
  - [x] 1.3 Define DJTransition type as discriminated union of all valid transition events (e.g., `SESSION_STARTED`, `SONG_SELECTED`, `SONG_ENDED`, `CEREMONY_DONE`, `INTERLUDE_DONE`, `CARD_DEALT`, `CARD_DONE`, `HOST_SKIP`, `HOST_OVERRIDE` (with `targetState: DJState` payload), `TIMEOUT`, `END_PARTY`). NOTE: Pause/resume are NOT DJ transitions -- they are session-level operations handled by the caller (Story 2.6) that freeze/unfreeze timers without changing DJState
  - [x] 1.4 Define DJContext interface: `{ state: DJState, sessionId: string, participantCount: number, songCount: number, sessionStartedAt: number | null, currentPerformer: string | null, timerStartedAt: number | null, timerDurationMs: number | null, cycleHistory: DJState[], metadata: Record<string, unknown> }`. `songCount` increments on every `SONG_ENDED` -- critical for FR14 ceremony selection rules (Story 2.9: Quick default after song 5). `sessionStartedAt` supports FR15 front-loading of participation activities in first 30 minutes. `cycleHistory` tracks state sequence to prevent consecutive Full ceremonies (FR14)
  - [x] 1.5 Define TimerConfig: `Record<DJState, number>` with default timeouts per state

- [x] Task 2: Create state definitions (AC: #1)
  - [x] 2.1 Create `apps/server/src/dj-engine/states.ts`
  - [x] 2.2 Define state configuration map: for each DJState, specify allowed transitions, timeout behavior, and guard functions
  - [x] 2.3 Implement the core cycle order: `songSelection -> partyCardDeal -> song -> ceremony -> interlude -> songSelection` (repeat)
  - [x] 2.4 Mark `partyCardDeal`, `ceremony`, `interlude` as placeholder states that auto-advance (Epic 3, 4, 7 will implement full behavior)

- [x] Task 3: Create transition guards and actions (AC: #1)
  - [x] 3.1 Create `apps/server/src/dj-engine/transitions.ts`
  - [x] 3.2 Implement guard functions that validate preconditions before each transition (e.g., `canStartSession` requires participantCount >= 1, `canSelectSong` requires state is songSelection). Include participant-count guards per NFR12: when `participantCount < 3`, skip `partyCardDeal` and `interlude` states (transition directly to next valid state in cycle), and set `metadata.forcedQuickCeremony = true` so Story 2.9 can enforce Quick-only ceremonies
  - [x] 3.3 Implement `transition(context: DJContext, event: DJTransition): DJContext` as the core pure function
  - [x] 3.4 Return new DJContext (immutable -- never mutate input) with updated state, cycleHistory, metadata
  - [x] 3.5 Throw typed errors for invalid transitions (use AppError pattern from `shared/errors.ts` but DO NOT import it -- define DJ-specific error type locally)
  - [x] 3.6 Handle concurrent transition requests: transition function is synchronous and pure, so caller serializes access

- [x] Task 4: Create timer management (AC: #1)
  - [x] 4.1 Create `apps/server/src/dj-engine/timers.ts`
  - [x] 4.2 Define default timer durations per state (songSelection: 30s, partyCardDeal: 5s placeholder, song: 180s, ceremony: 10s placeholder, interlude: 15s placeholder)
  - [x] 4.3 Implement `createTimerConfig(overrides?: Partial<TimerConfig>): TimerConfig`
  - [x] 4.4 Implement `getNextTransition(state: DJState): DJTransition` -- returns the `TIMEOUT` transition event for auto-advancement (every timed state uses `TIMEOUT` as the timer-fired event)
  - [x] 4.5 Implement `calculateRemainingMs(context: DJContext, now: number): number` for crash recovery timer reconciliation
  - [x] 4.6 Timer management is pure data -- actual setTimeout scheduling is NOT in dj-engine (that's the caller's responsibility in socket-handlers/services)

- [x] Task 5: Create serializer (AC: #1)
  - [x] 5.1 Create `apps/server/src/dj-engine/serializer.ts`
  - [x] 5.2 Implement `serializeDJContext(context: DJContext): unknown` -- returns JSON-safe object for JSONB storage
  - [x] 5.3 Implement `deserializeDJContext(json: unknown): DJContext` -- reconstructs from JSONB with validation
  - [x] 5.4 Round-trip guarantee: `deserializeDJContext(serializeDJContext(ctx))` deep-equals `ctx` for all valid states
  - [x] 5.5 Handle edge cases: null/undefined fields, invalid state values, missing required fields (throw descriptive errors)

- [x] Task 6: Create machine orchestrator (AC: #1)
  - [x] 6.1 Create `apps/server/src/dj-engine/machine.ts`
  - [x] 6.2 Implement `createDJContext(sessionId: string, participantCount: number): DJContext` -- initializes in `lobby` state
  - [x] 6.3 Implement `processTransition(context: DJContext, event: DJTransition): { newContext: DJContext, sideEffects: DJSideEffect[] }` -- applies guards, transitions, and returns side effects for caller
  - [x] 6.4 Define DJSideEffect type: `{ type: 'broadcast' | 'scheduleTimer' | 'cancelTimer' | 'persist', data: unknown }` -- side effects are DATA, not execution (pure function)
  - [x] 6.5 Side effects tell the caller (socket-handler/service) WHAT to do, but dj-engine never does I/O itself

- [x] Task 7: Create test factory (AC: #1)
  - [x] 7.1 Create `apps/server/tests/factories/dj-state.ts`
  - [x] 7.2 Implement `createTestDJContext(overrides?: Partial<DJContext>): DJContext` with sensible defaults (state: lobby, songCount: 0, participantCount: 3)
  - [x] 7.3 Add helper: `createTestDJContextInState(state: DJState, overrides?): DJContext` for easy state-specific test setup

- [x] Task 8: Write unit tests -- 100% coverage (AC: #1)
  - [x] 8.1 Create `apps/server/tests/dj-engine/machine.test.ts` -- test createDJContext, processTransition for all valid paths
  - [x] 8.2 Create `apps/server/tests/dj-engine/transitions.test.ts` -- test every guard, every valid transition, every invalid transition rejection
  - [x] 8.3 Create `apps/server/tests/dj-engine/timers.test.ts` -- test timer configs, getNextTransition, calculateRemainingMs with various elapsed times
  - [x] 8.4 Create `apps/server/tests/dj-engine/serializer.test.ts` -- test round-trips for every DJState, edge cases (null fields, bad input), error messages
  - [x] 8.5 Test the full cycle: lobby -> songSelection -> partyCardDeal -> song -> ceremony -> interlude -> songSelection (verify loop)
  - [x] 8.6 Test concurrent transition handling: two transitions on same context, only first succeeds
  - [x] 8.7 Test placeholder states auto-advance correctly via TIMEOUT event
  - [x] 8.8 Test low-participant guards: with participantCount < 3, verify partyCardDeal and interlude are skipped, metadata.forcedQuickCeremony is set (NFR12)
  - [x] 8.9 Test HOST_OVERRIDE transitions to specified target state
  - [x] 8.10 Test songCount increments on SONG_ENDED and sessionStartedAt is set on SESSION_STARTED
  - [x] 8.11 All tests use `createTestDJContext` factory -- zero inline test data

## Dev Notes

### Architecture Compliance (CRITICAL)

**Boundary rule: `dj-engine/` has ZERO imports from outside itself.** No imports from:
- `persistence/` -- no DB access
- `integrations/` -- no external APIs
- `socket-handlers/` -- no Socket.io
- `services/` -- no session-manager
- `shared/errors.ts` -- define DJ-specific error types locally in `types.ts`
- `db/` -- no Kysely

The ONLY valid imports are between dj-engine files (e.g., `machine.ts` imports from `./types.js`, `./transitions.js`, `./states.js`).

**Pure function architecture:** Every function takes input, returns output, no side effects. Timer scheduling, DB writes, and Socket.io broadcasts are the caller's responsibility -- dj-engine returns side-effect descriptors as data.

### DJState Enum Values

The Flutter app already defines `DJState` in `apps/flutter_app/lib/theme/dj_theme.dart`:
```dart
enum DJState { lobby, songSelection, partyCardDeal, song, ceremony, interlude, finale }
```

The server enum in `dj-engine/types.ts` MUST use identical values. These are serialized as strings in `dj:stateChanged` events and the JSONB `dj_state` column. Mismatch = broken app.

### Existing Infrastructure

| What | Where | Relevant To |
|------|-------|-------------|
| `sessions.dj_state` JSONB column | DB schema, ready | Serializer output format |
| `sessions.status` CHECK constraint | `'lobby' \| 'active' \| 'paused' \| 'ended'` | Session status is SEPARATE from DJState |
| `DJ_STATE_CHANGED` event constant | `src/shared/events.ts` | Socket handler will use this (Story 2.4) |
| `DJ_PAUSE`, `DJ_RESUME` events | `src/shared/events.ts` | Used by socket handlers (Story 2.6) -- NOT dj-engine transitions |
| `session-manager.ts` | `src/services/` | Will call `createDJContext()` on session start (not this story's concern) |
| `connection-tracker.ts` | `src/services/` | Tracks participant count (input to DJ context) |
| Test factories | `tests/factories/session.ts`, `participant.ts`, `user.ts` | Existing patterns to follow |
| `createTestSession()` | `tests/factories/session.ts` | Already has `dj_state: null` default -- update NOT needed (session factory is for DB, not engine) |

### Session Status vs DJState -- Two Different Things

- **Session status** (`sessions.status`): `lobby | active | paused | ended` -- managed by session-manager, represents session lifecycle
- **DJState**: `lobby | songSelection | partyCardDeal | song | ceremony | interlude | finale` -- managed by dj-engine, represents game loop position

When session status is `active`, the DJ engine cycles through its states. When session status is `paused`, the caller freezes the DJ engine's timer but DJState is preserved -- no DJTransition event is fired for pause/resume. The caller (session-manager/socket-handler) handles pause by cancelling the active timer and resume by restarting it with `calculateRemainingMs()`. Do NOT conflate these or add pause as a DJState or DJTransition.

### Placeholder States

`partyCardDeal`, `ceremony`, and `interlude` are placeholder states in this story. They should:
- Have configurable timeouts (short defaults: 5s, 10s, 15s)
- Auto-advance to the next state in the cycle when timeout fires
- Accept the standard transition event to move forward
- Later epics (3, 4, 7) will add real behavior WITHOUT changing the state machine structure

Use TODO comments: `// TODO: Epic 4 implements full party card behavior`

### Low-Participant Degradation (NFR12)

When `participantCount < 3`, the DJ engine must adapt the cycle:
- **Skip `partyCardDeal`:** transition directly from `songSelection` to `song`
- **Skip `interlude`:** transition directly from `ceremony` to `songSelection`
- **Set `metadata.forcedQuickCeremony = true`:** Story 2.9 reads this to enforce Quick-only ceremonies
- Cycle becomes: `songSelection -> song -> ceremony -> songSelection` (simplified loop)

Guards must check `context.participantCount` at transition time, not at initialization. Participant count can change mid-session (joins/disconnects).

### HOST_OVERRIDE vs HOST_SKIP

- **HOST_SKIP:** Advances to the next state in the natural cycle order (e.g., skip ceremony -> go to interlude)
- **HOST_OVERRIDE:** Jumps to a specific target state (e.g., from interlude, jump directly to songSelection). Takes `{ targetState: DJState }` payload. Guard must validate the target is a legal override destination (cannot override to `lobby` or `finale` from mid-cycle)

### Concurrency Model

The `transition()` function is pure and synchronous. Concurrency control is the caller's responsibility:
- Socket handler queues transitions per session
- If two events arrive simultaneously, process sequentially
- The dj-engine itself doesn't need locks/mutexes because it's pure

### Import Convention

All server imports use relative paths with `.js` extension:
```typescript
import { DJState, DJContext } from './types.js';
import { getStateConfig } from './states.js';
```

### Test Framework

- **Vitest** (`vitest@^4.0.18`) -- already in package.json
- Test files: `*.test.ts` in `tests/dj-engine/`
- Run: `cd apps/server && npm test`
- Use `describe`/`it`/`expect` from vitest
- No mocking needed -- everything is pure functions
- Note: `tsconfig.json` excludes `tests/` directory. Type-checking in tests is handled by Vitest's built-in TypeScript support, not `tsc`

### Side Effect Pattern

The `processTransition` function returns side effects as data, not execution:

```typescript
// machine.ts returns:
{
  newContext: { state: 'song', ... },
  sideEffects: [
    { type: 'broadcast', data: { from: 'songSelection', to: 'song' } },
    { type: 'scheduleTimer', data: { durationMs: 180000, transitionEvent: 'TIMEOUT' } },
    { type: 'cancelTimer', data: {} },
    { type: 'persist', data: { context: { /* serialized */ } } }
  ]
}
```

The socket handler (Story 2.4) interprets these side effects and performs actual I/O. This keeps dj-engine pure and testable.

**Broadcast payload shape** must match the architecture's `SessionEvent` type:
```typescript
// Architecture-defined event stream format:
{ type: 'dj:stateChanged', ts: number, data: { from: DJState, to: DJState } }
```
The `broadcast` side effect `data` field should contain `{ from: DJState, to: DJState }`. The caller adds the `ts` timestamp and event name when emitting via Socket.io.

### Project Structure Notes

Files to create (all under `apps/server/`):

```
src/dj-engine/
  types.ts        # DJState, DJTransition, DJContext, TimerConfig, DJSideEffect, DJEngineError, StateConfig
  states.ts       # State config map, allowed transitions per state
  machine.ts      # createDJContext, processTransition (main entry points)
  transitions.ts  # Guard functions, transition logic
  timers.ts       # Timer config, getNextTransition, calculateRemainingMs
  serializer.ts   # serializeDJContext, deserializeDJContext

tests/factories/
  dj-state.ts     # createTestDJContext, createTestDJContextInState

tests/dj-engine/
  machine.test.ts
  transitions.test.ts
  timers.test.ts
  serializer.test.ts
```

No other files should be created or modified in this story. No changes to session-manager, socket-handlers, Flutter, or persistence layer.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#dj-engine/ structure] -- File layout, type definitions
- [Source: _bmad-output/planning-artifacts/architecture.md#State Architecture] -- Full persistence model, three state tiers
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing Patterns] -- Factory pattern, test isolation
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] -- 15 mandatory rules
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] -- Acceptance criteria, FR9, NFR11
- [Source: _bmad-output/project-context.md#Server Boundaries] -- dj-engine zero-import rule
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] -- Naming, imports, casing
- [Source: apps/flutter_app/lib/theme/dj_theme.dart] -- DJState enum values (must match)
- [Source: apps/server/src/shared/events.ts] -- DJ_STATE_CHANGED, DJ_PAUSE, DJ_RESUME constants
- [Source: apps/server/src/db/types.ts] -- SessionsTable.dj_state is `unknown | null` (JSONB)
- [Source: _bmad-output/planning-artifacts/prd.md#FR9] -- Core cycle auto-cycling requirement
- [Source: _bmad-output/planning-artifacts/prd.md#FR14] -- Ceremony type selection rules (songCount dependency)
- [Source: _bmad-output/planning-artifacts/prd.md#FR15] -- Front-loading participation in first 30 minutes (sessionStartedAt)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR11] -- Concurrent transition handling without race conditions
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12] -- Low-participant degradation (<3 players)
- [Source: _bmad-output/planning-artifacts/architecture.md#Event Stream Architecture] -- SessionEvent discriminated union, broadcast payload shape

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial test run: 1 failure — `CARD_DONE` missing from `partyCardDeal` allowed transitions in `states.ts`. Fixed by adding it.
- Second test run: 243 passed, 0 failed, 2 pre-existing skips.

### Completion Notes List

- **Task 1:** Created `types.ts` with DJState const enum (matching Flutter), DJTransition discriminated union (11 event types), DJContext interface, TimerConfig, DJSideEffect union type, DJEngineError class, StateConfig interface. Zero external imports.
- **Task 2:** Created `states.ts` with state config map defining allowed transitions per state, `getNextCycleState()` with NFR12 low-participant degradation, `isValidOverrideTarget()` guard. Placeholder states marked with TODO comments for Epics 3, 4, 7.
- **Task 3:** Created `transitions.ts` with guard functions (`canStartSession`, `validateTransitionAllowed`, `validateOverrideTarget`), core `transition()` pure function. Immutable context — never mutates input. Sets `forcedQuickCeremony` metadata for <3 participants. Increments `songCount` on `SONG_ENDED`, sets `sessionStartedAt` on `SESSION_STARTED`.
- **Task 4:** Created `timers.ts` with default durations (30s/5s/180s/10s/15s), `createTimerConfig()` with overrides, `getNextTransition()` returning TIMEOUT, `calculateRemainingMs()` for crash recovery.
- **Task 5:** Created `serializer.ts` with `serializeDJContext()`/`deserializeDJContext()`. Comprehensive validation on deserialization. Round-trip guarantee tested for all states.
- **Task 6:** Created `machine.ts` with `createDJContext()` and `processTransition()`. Returns side effects as data: cancelTimer, broadcast (from/to), scheduleTimer, persist. Sets timer fields on context for timed states.
- **Task 7:** Created `dj-state.ts` factory with `createTestDJContext()` (defaults: lobby, 3 participants) and `createTestDJContextInState()` helper.
- **Task 8:** 86 new dj-engine tests across 4 test files. Full cycle test, concurrent transition test, placeholder auto-advance, NFR12 low-participant guards, HOST_OVERRIDE, serialization round-trips for all states, error edge cases. All tests use factory — zero inline test data.

### Change Log

- 2026-03-09: Implemented Story 2.1 — DJ Engine State Machine (Server). Created 6 source files in `dj-engine/`, 1 test factory, 4 test files (86 tests). All 243 server tests pass.
- 2026-03-10: Code review fixes — Made `transition()` and `processTransition()` pure by accepting `now: number` parameter instead of calling `Date.now()`. Fixed mutation of `transition()` return value in `processTransition()` (now uses spread). Module-level timer config constant. Removed `END_PARTY` from `finale` allowed transitions (terminal state). `getNextCycleState` throws on invalid state instead of silent return. Removed unused `_state` param from `getNextTransition()`. Reverted out-of-scope changes to copy.dart, lobby_screen.dart, session-schemas.ts. Updated all tests for deterministic `now` assertions. 244 tests pass.

### File List

**New files:**
- `apps/server/src/dj-engine/types.ts`
- `apps/server/src/dj-engine/states.ts`
- `apps/server/src/dj-engine/transitions.ts`
- `apps/server/src/dj-engine/timers.ts`
- `apps/server/src/dj-engine/serializer.ts`
- `apps/server/src/dj-engine/machine.ts`
- `apps/server/tests/factories/dj-state.ts`
- `apps/server/tests/dj-engine/machine.test.ts`
- `apps/server/tests/dj-engine/transitions.test.ts`
- `apps/server/tests/dj-engine/timers.test.ts`
- `apps/server/tests/dj-engine/serializer.test.ts`

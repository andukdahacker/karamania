# Story 2.2: DJ State Persistence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system operator,
I want DJ state persisted on every transition,
So that the server always has the latest party state in the database as the source of truth.

## Acceptance Criteria

1. **Given** the DJ engine transitions to a new state
   **When** the transition completes
   **Then** the full DJ state is serialized as JSONB and written to the `sessions.dj_state` column via async fire-and-forget
   **And** in-memory state serves as the hot cache while PostgreSQL is the source of truth
   **And** persistence writes go through `persistence/` layer only -- the only layer that imports from `db/`
   **And** `services/session-manager.ts` orchestrates across layers as the only cross-boundary service

## Tasks / Subtasks

- [x] Task 1: Add `updateDjState` to session repository (AC: #1)
  - [x] 1.1 Add `updateDjState(sessionId: string, djState: unknown): Promise<void>` to `apps/server/src/persistence/session-repository.ts`
  - [x] 1.2 Use Kysely `updateTable('sessions').set({ dj_state: djState }).where('id', '=', sessionId).execute()`
  - [x] 1.3 This is a simple fire-and-forget write -- no return value needed

- [x] Task 2: Add DJ state persistence orchestration to session-manager (AC: #1)
  - [x] 2.1 Add `persistDjState(sessionId: string, serializedState: unknown): Promise<void>` to `apps/server/src/services/session-manager.ts`
  - [x] 2.2 This function calls `sessionRepo.updateDjState(sessionId, serializedState)` wrapped in try/catch
  - [x] 2.3 On error: log warning but do NOT throw -- fire-and-forget means persistence failure must not crash the session
  - [x] 2.4 Import `serializeDJContext` is NOT done here -- the caller passes already-serialized data (from the `persist` side effect)

- [x] Task 3: Add `initializeDjState` to session-manager for session start (AC: #1)
  - [x] 3.1 Add `initializeDjState(sessionId: string, participantCount: number): Promise<{ djContext: DJContext; sideEffects: DJSideEffect[] }>` to `session-manager.ts`
  - [x] 3.2 Import `createDJContext` and `processTransition` from `../dj-engine/machine.js` and types from `../dj-engine/types.js`
  - [x] 3.3 Call `createDJContext(sessionId, participantCount)` to get initial lobby context
  - [x] 3.4 Call `processTransition(context, { type: 'SESSION_STARTED' }, Date.now())` to transition to songSelection (note: `now` param has a default but pass explicitly for testability)
  - [x] 3.5 Extract the `persist` side effect and call `persistDjState` with the serialized context as fire-and-forget
  - [x] 3.6 Return `{ djContext: newContext, sideEffects }` -- caller needs both for broadcasting and timer scheduling

- [x] Task 4: Integrate DJ state initialization into `startSession` (AC: #1)
  - [x] 4.1 Update `startSession` in session-manager.ts to call `initializeDjState` after status update
  - [x] 4.2 Change return type to `Promise<{ status: string; djContext: DJContext; sideEffects: DJSideEffect[] }>`
  - [x] 4.3 Pass `participants.length` to `initializeDjState` and spread its return into the result
  - [x] 4.4 IMPORTANT: Existing caller `socket-handlers/party-handlers.ts` ignores the return value (just awaits) so the type extension is backward-compatible -- do NOT modify party-handlers.ts (that's Story 2.4)
  - [x] 4.5 IMPORTANT: Update existing test in `tests/services/session-manager.test.ts:145` -- change `expect(result).toEqual({ status: 'active' })` to `expect(result).toMatchObject({ status: 'active' })` or update expected value to include djContext/sideEffects

- [x] Task 5: Add `loadDjState` to session-manager for state recovery (AC: #1)
  - [x] 5.1 Add `loadDjState(sessionId: string): Promise<DJContext | null>` to session-manager.ts
  - [x] 5.2 Call `sessionRepo.findById(sessionId)` to get the session row
  - [x] 5.3 If `session.dj_state` is null, return null
  - [x] 5.4 Import `deserializeDJContext` from `../dj-engine/serializer.js` and deserialize
  - [x] 5.5 On deserialization error: log error and return null (graceful degradation)

- [x] Task 6: Create `processDjTransition` orchestrator in session-manager (AC: #1)
  - [x] 6.1 Add `processDjTransition(sessionId: string, context: DJContext, event: DJTransition): Promise<{ newContext: DJContext; sideEffects: DJSideEffect[] }>` to session-manager.ts
  - [x] 6.2 Call `processTransition(context, event, Date.now())` from dj-engine
  - [x] 6.3 Find the `persist` side effect from the returned sideEffects array
  - [x] 6.4 Call `persistDjState(sessionId, persistEffect.data.context)` as fire-and-forget (`void` -- no await blocking the response)
  - [x] 6.5 Return the full result (newContext + sideEffects) to the caller for broadcasting/timer scheduling
  - [x] 6.6 IMPORTANT: The caller (socket handler, Story 2.4) will interpret broadcast/timer side effects. This story only handles the persist side effect.

- [x] Task 7: Write unit tests for persistence layer (AC: #1)
  - [x] 7.1 Add `updateDjState` tests to existing `apps/server/tests/persistence/session-repository.test.ts` -- follow existing mock-based pattern (vi.mock db/connection.js with mock query builders, NOT transaction rollback)
  - [x] 7.2 Test: updateDjState calls `db.updateTable('sessions').set({ dj_state }).where('id').execute()` with correct args
  - [x] 7.3 Test: updateDjState with null passes null to set()
  - [x] 7.4 Test: updateDjState does not throw when execute() resolves (fire-and-forget safe)

- [x] Task 8: Write unit tests for session-manager DJ functions (AC: #1)
  - [x] 8.1 Create `apps/server/tests/services/session-manager-dj.test.ts`
  - [x] 8.2 Mock ALL dependencies using the project's established pattern:
    - `vi.mock('../../src/config.js', ...)` with full config shape (see existing session-manager.test.ts for exact mock)
    - `vi.mock('../../src/db/connection.js', ...)` with empty db
    - `vi.mock('../../src/persistence/session-repository.js', ...)` with ALL functions including `updateDjState`
    - `vi.mock('../../src/services/party-code.js', ...)` if needed
    - `vi.mock('../../src/dj-engine/machine.js', ...)` -- mock `createDJContext` and `processTransition`
    - `vi.mock('../../src/dj-engine/serializer.js', ...)` -- mock `deserializeDJContext`
  - [x] 8.3 CRITICAL: Use dynamic imports inside each test: `const { persistDjState } = await import('../../src/services/session-manager.js')` -- this is how existing tests ensure mocks are applied
  - [x] 8.4 Test: `persistDjState` calls `sessionRepo.updateDjState` with correct args
  - [x] 8.5 Test: `persistDjState` catches and logs errors without throwing
  - [x] 8.6 Test: `initializeDjState` creates context, transitions to songSelection, persists, and returns `{ djContext, sideEffects }`
  - [x] 8.7 Test: `loadDjState` returns deserialized DJContext when dj_state exists
  - [x] 8.8 Test: `loadDjState` returns null when session not found or dj_state is null
  - [x] 8.9 Test: `loadDjState` returns null and logs on deserialization failure
  - [x] 8.10 Test: `processDjTransition` calls processTransition, extracts persist effect, fires persistDjState
  - [x] 8.11 Test: `processDjTransition` persist is fire-and-forget (not awaited in the response path)
  - [x] 8.12 Use `createTestDJContext` factory from `tests/factories/dj-state.ts` and `createTestSession` from `tests/factories/session.ts` -- no inline test data

## Dev Notes

### Architecture Compliance (CRITICAL)

**Boundary rules enforced in this story:**
- `persistence/session-repository.ts` is the ONLY file that imports from `db/` -- all DB access goes here
- `services/session-manager.ts` is the ONLY service that orchestrates across layers (calls both persistence and dj-engine)
- `dj-engine/` remains ZERO external imports -- session-manager imports FROM dj-engine, never the reverse
- Socket handlers (Story 2.4) will call session-manager, never persistence directly for DJ state

**Import chain:**
```
socket-handler (future 2.4) -> session-manager -> persistence/session-repository -> db/
                             -> dj-engine/machine, dj-engine/serializer
```

### Fire-and-Forget Pattern

The persistence write MUST be fire-and-forget:
```typescript
// CORRECT: fire-and-forget -- don't await in the hot path
void persistDjState(sessionId, serializedState);

// WRONG: awaiting persistence blocks the response
await persistDjState(sessionId, serializedState);  // NO!
```

Why: The in-memory state is the hot cache. Persistence is for durability only. Blocking on DB writes would add latency to every state transition, violating the 200ms broadcast requirement (NFR1). If a persist fails, the in-memory state is still correct -- the next transition will persist again.

Log persistence errors at `warn` level for monitoring but never throw.

### DJ Engine Side Effect Integration

Story 2.1 established that `processTransition()` returns side effects as data:
```typescript
const { newContext, sideEffects } = processTransition(context, event, Date.now());
// sideEffects includes: cancelTimer, broadcast, scheduleTimer, persist
```

The `persist` side effect contains:
```typescript
{ type: 'persist', data: { context: /* serialized DJContext */ } }
```

This story handles ONLY the `persist` side effect. The other side effects (broadcast, scheduleTimer, cancelTimer) are handled by socket handlers in Story 2.4.

### Existing Code to Modify

| File | Change |
|------|--------|
| `src/persistence/session-repository.ts` | Add `updateDjState()` function |
| `src/services/session-manager.ts` | Add `persistDjState()`, `initializeDjState()`, `loadDjState()`, `processDjTransition()` |

### Existing Code to Reuse (DO NOT RECREATE)

| What | Where | How |
|------|-------|-----|
| `createDJContext()` | `dj-engine/machine.ts` | Creates initial lobby context |
| `processTransition()` | `dj-engine/machine.ts` | Returns newContext + sideEffects including persist |
| `serializeDJContext()` | `dj-engine/serializer.ts` | Already used inside processTransition for persist side effect |
| `deserializeDJContext()` | `dj-engine/serializer.ts` | For loadDjState recovery |
| `DJContext`, `DJTransition`, `DJSideEffect` | `dj-engine/types.ts` | Type imports only |
| `createTestDJContext()` | `tests/factories/dj-state.ts` | Test factory for DJ contexts |
| `createTestSession()` | `tests/factories/session.ts` | Test factory for session DB rows |
| `db` connection | `db/connection.ts` | Already imported by session-repository |
| `createAppError()` | `shared/errors.ts` | Error creation pattern |

### Session-Manager `startSession` Integration

The current `startSession` in session-manager.ts:
1. Validates session exists and is in lobby
2. Validates host ownership
3. Validates >= 3 participants
4. Updates status to 'active'

After this story, it should ALSO:
5. Call `initializeDjState(sessionId, participants.length)`
6. Return the DJContext and sideEffects so the socket handler (Story 2.4) can broadcast

The return type changes from `{ status: string }` to include DJ context:
```typescript
Promise<{ status: string; djContext: DJContext; sideEffects: DJSideEffect[] }>
```

**Existing callers affected:**
- `socket-handlers/party-handlers.ts:16` calls `await startSession(...)` and ignores the return value -- backward-compatible, do NOT modify (Story 2.4 will consume the new fields)
- `tests/services/session-manager.test.ts:145` uses `.toEqual({ status: 'active' })` -- this MUST be updated to `.toMatchObject({ status: 'active' })` or the test will break due to extra fields

### Existing Tests to Update

`tests/services/session-manager.test.ts` has existing tests for `startSession` that will need updating:
- The `startSession` test mocks must now also mock dj-engine modules since `initializeDjState` imports from them
- The mock for session-repository must include `updateDjState`
- The assertion `expect(result).toEqual({ status: 'active' })` must change to `toMatchObject`

### Database Column Info

- `sessions.dj_state` column type: `unknown | null` in Kysely types (JSONB in PostgreSQL)
- Column already exists from initial migration -- no migration needed
- Kysely accepts any JSON-serializable value for JSONB columns

### Testing Patterns (from existing codebase)

- **Vitest** (`vitest@^4.0.18`) with globals: true (describe/it/expect available without import, but import from 'vitest' is also fine)
- Test files in `apps/server/tests/` mirror `src/` structure
- **Mock-based testing** -- all persistence and service tests mock dependencies via `vi.mock()`, NO transaction rollback
- **Dynamic imports required** -- use `const { fn } = await import('../../src/services/session-manager.js')` inside each test to ensure mocks are applied before module loads
- **Config mock required** -- every test file must mock `../../src/config.js` with full config shape (see existing `session-manager.test.ts` for template)
- `beforeEach(() => vi.clearAllMocks())` for test isolation
- All DJ state test data via `createTestDJContext()` factory, session data via `createTestSession()`

### What NOT to Do

- Do NOT modify any `dj-engine/` files -- they are pure and complete from Story 2.1
- Do NOT create socket handlers or broadcasting -- that's Story 2.4
- Do NOT implement timer scheduling -- that's the socket handler's job (Story 2.4)
- Do NOT add pause/resume handling -- that's Story 2.6
- Do NOT create a new service file -- add to existing `session-manager.ts`
- Do NOT add recovery-on-startup logic -- that's Story 2.3
- Do NOT use `.then()` chains -- use `async/await` everywhere
- Do NOT modify `socket-handlers/party-handlers.ts` -- it calls `startSession` but doesn't use the return value yet (Story 2.4)
- Do NOT break existing tests in `tests/services/session-manager.test.ts` -- update assertions as needed when `startSession` return type changes

### Project Structure Notes

Files to modify:
```
apps/server/src/persistence/session-repository.ts       # Add updateDjState
apps/server/src/services/session-manager.ts              # Add DJ orchestration functions
apps/server/tests/persistence/session-repository.test.ts # Add updateDjState tests (file exists)
apps/server/tests/services/session-manager.test.ts       # Update startSession assertion (file exists)
```

Files to create:
```
apps/server/tests/services/session-manager-dj.test.ts   # New DJ-specific session-manager tests
```

No other files should be created or modified.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] -- Acceptance criteria
- [Source: _bmad-output/project-context.md#Server Boundaries] -- persistence/ is ONLY layer importing db/, session-manager.ts is ONLY cross-boundary service
- [Source: _bmad-output/project-context.md#State Persistence] -- Full persistence model, fire-and-forget, in-memory hot cache
- [Source: _bmad-output/planning-artifacts/architecture.md#State Architecture] -- Three state tiers
- [Source: apps/server/src/dj-engine/machine.ts] -- processTransition returns persist side effect
- [Source: apps/server/src/dj-engine/serializer.ts] -- serializeDJContext/deserializeDJContext
- [Source: apps/server/src/dj-engine/types.ts] -- DJContext, DJTransition, DJSideEffect types
- [Source: apps/server/src/persistence/session-repository.ts] -- Existing repository pattern
- [Source: apps/server/src/services/session-manager.ts] -- Existing service to extend
- [Source: apps/server/src/db/types.ts:21-30] -- SessionsTable.dj_state is `unknown | null`
- [Source: 2-1-dj-engine-state-machine-server.md] -- Previous story learnings, side effect pattern, serializer details

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None -- clean implementation, no debugging needed.

### Completion Notes List

- Task 1: Added `updateDjState(sessionId, djState)` to session-repository.ts -- simple Kysely update, fire-and-forget write
- Task 2: Added `persistDjState` to session-manager.ts -- wraps repo call in try/catch, logs warn on failure, never throws
- Task 3: Added `initializeDjState` -- creates DJ context, processes SESSION_STARTED transition, fires persist side effect
- Task 4: Updated `startSession` return type to include djContext + sideEffects, calls initializeDjState after status update. Updated existing test assertion from toEqual to toMatchObject. Added dj-engine mocks to existing test file.
- Task 5: Added `loadDjState` -- fetches session, deserializes dj_state JSONB, returns null on missing/error with graceful degradation
- Task 6: Added `processDjTransition` -- orchestrates processTransition call, extracts persist side effect as fire-and-forget (void -- not awaited)
- Task 7: Added 3 tests to session-repository.test.ts for updateDjState (correct args, null handling, no-throw)
- Task 8: Created session-manager-dj.test.ts with 9 tests covering all DJ functions including fire-and-forget verification
- Used type guard `Extract<DJSideEffect, { type: 'persist' }>` for proper TypeScript narrowing of persist side effect
- Architecture boundaries maintained: persistence/ only layer importing db/, session-manager.ts only cross-boundary orchestrator, dj-engine/ untouched

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Date:** 2026-03-10
**Outcome:** Approved with fixes applied

**Issues Found:** 1 High, 4 Medium, 2 Low (all HIGH/MEDIUM fixed)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| H1 | HIGH | `initializeDjState` test missing persist assertion | Added `expect(mockUpdateDjState).toHaveBeenCalledWith(...)` |
| M1 | MEDIUM | `startSession` DJ return fields never tested | Added `djContext` and `sideEffects` assertions |
| M2 | MEDIUM | `createDJContext` mock returns wrong initial state (`songSelection` instead of `lobby`) | Fixed mock to return `lobby` state |
| M3 | MEDIUM | No test for missing persist side effect path | Added 2 tests for `initializeDjState` and `processDjTransition` |
| M4 | MEDIUM | `processDjTransition` test missing persist assertion | Added `expect(mockUpdateDjState).toHaveBeenCalledWith(...)` |
| L1 | LOW | Redundant `undefined` check in `loadDjState` | Not fixed (defensive, harmless) |
| L2 | LOW | Functions don't accept `now` param for testability | Not fixed (tests use `expect.any(Number)`) |

**Tests after review:** 258 passed, 2 skipped, 0 failures

### Change Log

- 2026-03-10: Code review fixes -- 5 test issues fixed, 2 new tests added (258 total)
- 2026-03-10: Story 2.2 implemented -- DJ state persistence layer with fire-and-forget writes, 12 new tests (256 total, 0 regressions)

### File List

Modified:
- apps/server/src/persistence/session-repository.ts (added updateDjState)
- apps/server/src/services/session-manager.ts (added persistDjState, initializeDjState, loadDjState, processDjTransition; updated startSession return type)
- apps/server/tests/persistence/session-repository.test.ts (added 3 updateDjState tests)
- apps/server/tests/services/session-manager.test.ts (added dj-engine mocks, updated startSession assertion + DJ return field assertions, fixed createDJContext mock state)
- apps/server/tests/services/session-manager-dj.test.ts (added persist assertions, added 2 missing-persist-path tests)

Created:
- apps/server/tests/services/session-manager-dj.test.ts (11 tests for DJ session-manager functions)

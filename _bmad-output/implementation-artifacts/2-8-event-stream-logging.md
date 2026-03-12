# Story 2.8: Event Stream Logging

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want every state transition, user action, and DJ decision logged as structured events,
so that session history can be reconstructed and analytics derived post-session.

## Acceptance Criteria

1. **Given** any state transition, user action, or DJ decision occurs during a party **When** the event is generated **Then** it is logged as a structured event with schema: `{sessionId, userId, eventType, timestamp, metadata}` (FR42)
2. **Given** events are being logged during a session **When** the session is active **Then** events are stored in an in-memory array (append-only, array push <1ms)
3. **Given** a session ends **When** the event stream is finalized **Then** the complete event stream is batch-written to the `sessions.event_stream` JSONB column in PostgreSQL
4. **Given** event logging occurs **When** any user-facing operation is in progress **Then** logging is asynchronous and adds no more than 5ms latency to any user-facing operation (NFR26)

## Tasks / Subtasks

- [x] Task 1: Create event stream types and service (AC: #1, #2, #4)
  - [x] 1.1 Create `apps/server/src/services/event-stream.ts`:
    - Import `DJState` from `../dj-engine/types.js`
    - Define `SessionEvent` discriminated union type as specified in Dev Notes below (see "SessionEvent Type Definition")
    - **No `sessionId` in events** — events are stored per-session in the JSONB column, so sessionId is implicit. This matches the architecture spec
    - Create in-memory store: `const streams = new Map<string, SessionEvent[]>()`
    - Implement functions:
      - `appendEvent(sessionId: string, event: SessionEvent): void` — pushes event to array in map. Creates array if not exists. Synchronous — array push is <1ms (NFR26)
      - `getEventStream(sessionId: string): SessionEvent[]` — returns copy of array (or empty array if not found)
      - `flushEventStream(sessionId: string): SessionEvent[]` — returns the array AND removes it from the map (for batch write at session end)
      - `removeEventStream(sessionId: string): void` — cleanup without returning data
      - `clearAllStreams(): void` — for testing
    - **CRITICAL:** All functions are synchronous. No async, no promises, no I/O. This is a pure in-memory accumulator
  - [x] 1.2 Export types from event-stream.ts. No barrel file — import directly per project rules

- [x] Task 2: Add batch write to persistence layer (AC: #3)
  - [x] 2.1 In `apps/server/src/persistence/session-repository.ts`, add function:
    ```typescript
    export async function writeEventStream(sessionId: string, events: unknown[]): Promise<void> {
      await db
        .updateTable('sessions')
        .set({ event_stream: JSON.stringify(events) })
        .where('id', '=', sessionId)
        .execute();
    }
    ```
    - Uses Kysely's JSON serialization for JSONB column
    - This is a single UPDATE — not per-event writes
    - Called only once at session end (batch write pattern)

- [x] Task 3: Hook event logging into session-manager (AC: #1, #4)
  - [x] 3.1 In `apps/server/src/services/session-manager.ts`:
    - Import `appendEvent`, `flushEventStream`, `removeEventStream` from `./event-stream.js`
    - Import `writeEventStream` from `../persistence/session-repository.js`
  - [x] 3.2 Add optional `userId?: string` as 4th parameter to `processDjTransition()`:
    - New signature: `async processDjTransition(sessionId: string, context: DJContext, event: DJTransition, userId?: string)`
    - After `processTransition()` returns `newContext` and `sideEffects`, append a `dj:stateChanged` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'dj:stateChanged',
      ts: Date.now(),
      userId,
      data: { from: context.state, to: newContext.state, trigger: event.type },
    });
    ```
    - The `trigger` field captures WHAT caused the transition (e.g., 'HOST_SKIP', 'TIMEOUT', 'SONG_ENDED') — this is an intentional enhancement over the architecture spec's `{ from, to }` schema, adding analytics value
    - `userId` is `undefined` for timer-driven TIMEOUT transitions. The timer callback in session-manager's side-effect handler calls `processDjTransition(sessionId, context, { type: 'TIMEOUT' })` — no userId available since it's system-driven. Pass `undefined` explicitly
  - [x] 3.3 In `startSession()`: After successful transition, append `party:started` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'party:started',
      ts: Date.now(),
      userId: hostUserId,
      data: { participantCount },
    });
    ```
  - [x] 3.4 In `endSession()` — **ordering is critical**, insert event stream logic BEFORE existing cleanup:
    - **Step A:** Append `party:ended` event (DJ context still available in memory):
      ```typescript
      const djContext = getSessionDjState(sessionId);
      appendEvent(sessionId, {
        type: 'party:ended',
        ts: Date.now(),
        userId: hostUserId,
        data: {
          songCount: djContext?.songCount ?? 0,
          duration: djContext?.sessionStartedAt ? Date.now() - djContext.sessionStartedAt : 0,
        },
      });
      ```
    - **Step B:** Flush and write event stream to DB (BEFORE `removeSessionDjState` and other cleanup):
      ```typescript
      const events = flushEventStream(sessionId);
      if (events.length > 0) {
        writeEventStream(sessionId, events).catch((err) => {
          logger.error({ err, sessionId }, 'Failed to write event stream');
        });
      }
      ```
    - **Step C:** Existing cleanup continues: `removeSessionDjState`, `cancelSessionTimer`, `removeSession`, `removeActivitySession`
    - **CRITICAL:** The batch write is fire-and-forget async. Session end is NOT blocked by event persistence. But the `appendEvent` and `flushEventStream` calls MUST happen while DJ context is still in memory
  - [x] 3.5 In `handleParticipantJoin()`: Append `party:joined` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'party:joined',
      ts: Date.now(),
      userId,
      data: { displayName, role },
    });
    ```
  - [x] 3.6 Add optional `userId?: string` as 2nd parameter to `pauseSession()`:
    - New signature: `async pauseSession(sessionId: string, userId?: string)`
    - Append `dj:pause` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'dj:pause',
      ts: Date.now(),
      userId,
      data: { fromState: context.state },
    });
    ```
  - [x] 3.7 Add optional `userId?: string` as 2nd parameter to `resumeSession()`:
    - New signature: `async resumeSession(sessionId: string, userId?: string)`
    - Append `dj:resume` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'dj:resume',
      ts: Date.now(),
      userId,
      data: { toState: newContext.state },
    });
    ```
  - [x] 3.8 In `kickPlayer()`: Append `party:kicked` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'party:kicked',
      ts: Date.now(),
      userId: hostUserId,
      data: { kickedUserId: targetUserId },
    });
    ```
  - [x] 3.9 In `transferHost()`: Append `party:hostTransferred` event:
    ```typescript
    appendEvent(sessionId, {
      type: 'party:hostTransferred',
      ts: Date.now(),
      data: { fromUserId: currentHostId, toUserId: newHostUserId },
    });
    ```

- [x] Task 4: Hook event logging into socket handlers (AC: #1)
  - [x] 4.1 In `apps/server/src/socket-handlers/host-handlers.ts`:
    - Import `appendEvent` from `../services/event-stream.js`
    - In `HOST_SKIP` handler (line ~72): Append `host:skip` event, then pass userId to processDjTransition:
      - `appendEvent(socket.data.sessionId, { type: 'host:skip', ts: Date.now(), userId: socket.data.userId, data: { fromState: context.state } })`
      - Change call to: `processDjTransition(sessionId, context, { type: 'HOST_SKIP' }, socket.data.userId)`
    - In `HOST_OVERRIDE` handler (line ~96): Append `host:override` event, pass userId:
      - `appendEvent(socket.data.sessionId, { type: 'host:override', ts: Date.now(), userId: socket.data.userId, data: { fromState: context.state, toState: targetState } })`
      - Change call to: `processDjTransition(sessionId, context, { type: 'HOST_OVERRIDE', targetState }, socket.data.userId)`
    - In `HOST_SONG_OVER` handler (line ~115): Append `host:songOver` event, pass userId:
      - `appendEvent(socket.data.sessionId, { type: 'host:songOver', ts: Date.now(), userId: socket.data.userId, data: {} })`
      - Change call to: `processDjTransition(sessionId, context, { type: 'SONG_ENDED' }, socket.data.userId)`
    - In `HOST_PAUSE` handler (line ~30): Change call to: `pauseSession(sessionId, socket.data.userId)`
    - In `HOST_RESUME` handler (line ~48): Change call to: `resumeSession(sessionId, socket.data.userId)`
  - [x] 4.2 In `apps/server/src/socket-handlers/party-handlers.ts`:
    - Import `appendEvent` from `../services/event-stream.js`
    - In `PARTY_VIBE_CHANGED` handler: Append `party:vibeChanged` event
  - [x] 4.3 In `apps/server/src/socket-handlers/connection-handler.ts`:
    - Import `appendEvent` from `../services/event-stream.js`
    - **Do NOT log `party:left` on socket disconnect.** The disconnect handler starts a 5-minute reconnection grace period — logging on disconnect would create false events for users who reconnect within the window
    - Instead, log `party:left` ONLY in the 5-minute cleanup timer callback (line ~178), when the disconnect is considered final:
      ```typescript
      // Inside the cleanup timer callback (after reconnection window expires):
      appendEvent(sessionId, {
        type: 'party:left',
        ts: Date.now(),
        userId: disconnectedUserId,
        data: { displayName },
      });
      ```
    - If accessing displayName in the cleanup callback is complex (it may not be available after `removeDisconnectedEntry`), capture it when the disconnect first occurs and pass it via closure
    - Kicks are already covered by `party:kicked` in session-manager (Task 3.8) — do not double-log

- [x] Task 5: Handle recovery and crash scenarios (AC: #2)
  - [x] 5.1 In `recoverActiveSessions()` in session-manager.ts:
    - After recovering a session, the event stream for that session is lost (was in-memory)
    - Append a dedicated recovery marker event (NOT a fake `dj:stateChanged`):
      ```typescript
      appendEvent(sessionId, {
        type: 'system:recovery',
        ts: Date.now(),
        data: { recoveredState: recoveredContext.state, songCount: recoveredContext.songCount },
      });
      ```
    - Add `system:recovery` to the `SessionEvent` discriminated union (see Dev Notes type definition)
    - This marks the gap in the event stream for analytics — prior events from before the crash are lost
  - [x] 5.2 **Do NOT implement periodic background flush** — architecture explicitly defers this to v2:
    > "Periodic background flush (every 30-60s) deferred to v2 if crash-related data loss becomes a real issue"

- [x] Task 6: Tests (AC: #1, #2, #3, #4)
  - [x] 6.1 Create `apps/server/tests/services/event-stream.test.ts`:
    - Test `appendEvent` adds event to correct session stream
    - Test `appendEvent` creates new stream if not exists
    - Test `getEventStream` returns copy (not reference) of events array
    - Test `getEventStream` returns empty array for unknown session
    - Test `flushEventStream` returns events AND removes from map
    - Test `flushEventStream` returns empty array for unknown session
    - Test `removeEventStream` clears session data
    - Test `clearAllStreams` empties all data
    - Test multiple sessions have independent streams
    - Test event ordering is preserved (FIFO)
    - Test high volume: 1000 events append in <5ms (NFR26 verification)
  - [x] 6.2 Create `apps/server/tests/persistence/event-stream-write.test.ts`:
    - Test `writeEventStream` writes JSONB to sessions table
    - Test `writeEventStream` with empty array writes empty JSON array
    - Test `writeEventStream` for non-existent session doesn't crash
    - Use transaction-per-test pattern (rollback after completion) per testing rules
    - Use `createTestSession()` factory for test data
  - [x] 6.3 Extend `apps/server/tests/services/session-manager.test.ts`:
    - Test `processDjTransition` appends `dj:stateChanged` event
    - Test `startSession` appends `party:started` event
    - Test `endSession` appends `party:ended` event AND flushes to DB
    - Test `handleParticipantJoin` appends `party:joined` event
    - Test `pauseSession` appends `dj:pause` event
    - Test `resumeSession` appends `dj:resume` event
    - Test `kickPlayer` appends `party:kicked` event
    - Test `transferHost` appends `party:hostTransferred` event
    - Mock `writeEventStream` to verify batch write call at session end
  - [x] 6.4 Extend `apps/server/tests/socket-handlers/host-handlers.test.ts`:
    - Test HOST_SKIP appends `host:skip` event
    - Test HOST_OVERRIDE appends `host:override` event
    - Test HOST_SONG_OVER appends `host:songOver` event
    - Test HOST_PAUSE passes userId to pauseSession
    - Test HOST_RESUME passes userId to resumeSession
  - [x] 6.5 Extend `apps/server/tests/socket-handlers/party-handlers.test.ts`:
    - Test PARTY_VIBE_CHANGED appends `party:vibeChanged` event
  - [x] 6.6 Test recovery scenario in `session-manager-recovery.test.ts`:
    - Test recovered sessions get a `system:recovery` marker event with recovered state and song count

## Dev Notes

### Architecture Decision: In-Memory Accumulator Pattern

Per architecture document, event stream uses an **in-memory array accumulator** with batch write at session end:

1. During session: `appendEvent()` pushes to `Map<sessionId, SessionEvent[]>` — synchronous array push is <1ms
2. At session end: `flushEventStream()` returns all events, `writeEventStream()` batch-writes to `sessions.event_stream` JSONB
3. If server crashes: event stream for active sessions is lost. DJ state is separately persisted (write-on-transition), so party recovers. Event data loss is acceptable for MVP
4. Periodic background flush is **explicitly deferred to v2**

[Source: _bmad-output/planning-artifacts/architecture.md#Event Stream Architecture]

### SessionEvent Type Definition

Events do NOT contain `sessionId` — they are stored per-session in the `sessions.event_stream` JSONB column, making sessionId implicit. The `appendEvent(sessionId, event)` function uses sessionId only as the map key.

```typescript
export type SessionEvent =
  | { type: 'dj:stateChanged'; ts: number; userId?: string; data: { from: DJState; to: DJState; trigger: string } }
  | { type: 'dj:pause'; ts: number; userId?: string; data: { fromState: DJState } }
  | { type: 'dj:resume'; ts: number; userId?: string; data: { toState: DJState } }
  | { type: 'party:started'; ts: number; userId: string; data: { participantCount: number } }
  | { type: 'party:ended'; ts: number; userId: string; data: { songCount: number; duration: number } }
  | { type: 'party:joined'; ts: number; userId: string; data: { displayName: string; role: 'guest' | 'authenticated' } }
  | { type: 'party:left'; ts: number; userId: string; data: { displayName: string } }
  | { type: 'party:kicked'; ts: number; userId: string; data: { kickedUserId: string } }
  | { type: 'party:hostTransferred'; ts: number; userId?: string; data: { fromUserId: string; toUserId: string } }
  | { type: 'party:vibeChanged'; ts: number; userId: string; data: { vibe: string } }
  | { type: 'host:skip'; ts: number; userId: string; data: { fromState: DJState } }
  | { type: 'host:override'; ts: number; userId: string; data: { fromState: DJState; toState: DJState } }
  | { type: 'host:songOver'; ts: number; userId: string; data: Record<string, never> }
  | { type: 'system:recovery'; ts: number; data: { recoveredState: DJState; songCount: number } };
```

Future epics add their own event types (reactions, cards, songs, ceremonies, captures) to this union using the same `appendEvent()` API.

### FR42 Schema Mapping

FR42 specifies `{sessionId, userId, eventType, timestamp, metadata}`. The architecture refines this to a typed discriminated union. Field mapping:
- FR42 `sessionId` → implicit (stored per-session in JSONB column)
- FR42 `eventType` → `type` (matches Socket.io `namespace:action` convention)
- FR42 `timestamp` → `ts` (millisecond Unix timestamp, compact field name)
- FR42 `metadata` → `data` (typed per event variant, not a generic `Record<string, unknown>`)
- FR42 `userId` → `userId` (optional — `undefined` for system-driven events like TIMEOUT transitions)

The `dj:stateChanged` data includes a `trigger` field (`DJTransition.type` value) beyond what the architecture spec shows. This is an intentional enhancement — it captures whether the transition was user-initiated (`HOST_SKIP`, `HOST_OVERRIDE`) or system-driven (`TIMEOUT`, `SESSION_STARTED`), which is critical for analytics.

[Source: _bmad-output/planning-artifacts/architecture.md#L306-321]
[Source: _bmad-output/planning-artifacts/prd.md#FR42]

### Server Boundaries (ENFORCED)

- `dj-engine/` — **ZERO changes**. Event logging is NOT a state machine concern. The engine returns side effects as data; the orchestrator (session-manager) decides what to log
- `services/event-stream.ts` — **NEW file**. Pure in-memory accumulator. ZERO imports from persistence, socket, or dj-engine (except types)
- `services/session-manager.ts` — **MODIFIED**. Orchestrates event logging at key lifecycle points. This is the ONLY service that crosses layer boundaries (per architecture)
- `persistence/session-repository.ts` — **MODIFIED**. Adds `writeEventStream()` for batch JSONB write
- `socket-handlers/` — **MODIFIED**. Adds `appendEvent()` calls for user-action events that don't flow through session-manager

### Signature Changes: userId Parameter

Three functions get an optional `userId?: string` parameter added for event attribution:

| Function | Current Signature | New Signature |
|----------|-------------------|---------------|
| `processDjTransition` | `(sessionId, context, event)` | `(sessionId, context, event, userId?)` |
| `pauseSession` | `(sessionId)` | `(sessionId, userId?)` |
| `resumeSession` | `(sessionId)` | `(sessionId, userId?)` |

Socket handlers pass `socket.data.userId`. Timer-driven TIMEOUT callbacks pass `undefined`. This approach is chosen over adding userId to DJTransition metadata because it keeps dj-engine types unchanged (ZERO changes to dj-engine/).

### What This Story Does NOT Build

- **No periodic background flush** — Deferred to v2 per architecture. Event stream is lost on crash
- **No client-side event logging** — All events are server-side. Flutter is a thin display layer
- **No reaction/card/song/ceremony/capture events** — Those event types are added by their respective epics (3, 4, 5, 6). This story builds the infrastructure and logs DJ + party lifecycle events
- **No event stream querying/analytics** — Post-session analytics queries are a separate concern. The JSONB column is queryable via PostgreSQL JSON operators
- **No event stream API endpoint** — No REST endpoint to read events. Events are internal for now
- **No Flutter changes** — This is entirely server-side

### Performance: NFR26 Compliance

The 5ms latency budget is easily met:
- `appendEvent()` is a synchronous `Array.push()` call — <0.1ms
- No async I/O during event logging
- Batch write happens only at session end, fire-and-forget (doesn't block the `endSession` response)
- No serialization overhead during append — events are already JS objects

### Crash Resilience Tradeoff

Per architecture: "if the server crashes, the event stream for active sessions is lost. The DJ state itself is persisted (write-on-transition), so the party recovers. Event data is valuable for analytics and go/no-go evaluation but not mission-critical for party operation."

This is an **accepted tradeoff** for MVP. The recovery handler appends a `system:recovery` marker event so analytics can identify gaps in the event stream.

[Source: _bmad-output/planning-artifacts/architecture.md#L321]

### Database: event_stream Column Already Exists

The `sessions.event_stream` JSONB column was created in the initial migration (`001-initial-schema.ts`). No migration needed. The column is nullable and currently stores `null` for all sessions.

After this story, ended sessions will have their event stream written as a JSON array to this column.

### Testing Strategy

- **event-stream.ts**: Pure unit tests — no mocking needed, test the Map-based accumulator directly
- **session-repository writeEventStream**: DB integration test with transaction rollback
- **session-manager**: Mock `event-stream` and `session-repository` to verify correct events appended at lifecycle points
- **socket-handlers**: Verify `appendEvent` called with correct event type and data
- **Performance**: Verify 1000 events append in <5ms (simple benchmark test)
- Use shared factories (`createTestDJContext`, `createTestSession`) per testing rules
- Framework: Vitest with `vi.mock()`

### Previous Story Intelligence (Story 2.7)

Story 2.7 was Flutter-only (audio cues). No server changes. Key patterns:
- SocketClient integration pattern: hooks added to existing event listeners
- Graceful degradation: failures logged but never crash the app
- Clean module boundaries: new module (audio/) with zero cross-dependencies

For this story (2.8): Same clean boundary approach — `event-stream.ts` is a standalone module. Integration via session-manager and socket handlers.

### Git Intelligence

Recent commits show consistent pattern:
- Stories implement in `apps/server/src/` following the module structure
- Tests mirror source in `apps/server/tests/`
- Factories in `tests/factories/` for consistent test data
- Each story modifies session-manager.ts as the orchestration layer

### Project Structure Notes

New files:
- `apps/server/src/services/event-stream.ts` (in-memory event accumulator + types)
- `apps/server/tests/services/event-stream.test.ts`
- `apps/server/tests/persistence/event-stream-write.test.ts`

Modified files:
- `apps/server/src/persistence/session-repository.ts` (add `writeEventStream`)
- `apps/server/src/services/session-manager.ts` (add event logging at lifecycle points, add userId params)
- `apps/server/src/socket-handlers/host-handlers.ts` (add event logging for host actions)
- `apps/server/src/socket-handlers/party-handlers.ts` (add event logging for vibe change)
- `apps/server/src/socket-handlers/connection-handler.ts` (add event logging for disconnect)

Existing test files to extend:
- `apps/server/tests/services/session-manager.test.ts`
- `apps/server/tests/services/session-manager-dj.test.ts`
- `apps/server/tests/services/session-manager-recovery.test.ts`
- `apps/server/tests/socket-handlers/host-handlers.test.ts`
- `apps/server/tests/socket-handlers/party-handlers.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Event Stream Architecture (L306-321)] — In-memory accumulator, batch write, event schema, crash resilience tradeoff
- [Source: _bmad-output/planning-artifacts/architecture.md#L619] — `services/event-stream.ts` specified in directory structure
- [Source: _bmad-output/planning-artifacts/architecture.md#L101-106] — Cross-cutting: event stream instrumentation, <5ms overhead
- [Source: _bmad-output/planning-artifacts/architecture.md#L727,L842] — All events logged, no silent state changes
- [Source: _bmad-output/planning-artifacts/prd.md#FR42] — Structured event stream with schema `{sessionId, userId, eventType, timestamp, metadata}`
- [Source: _bmad-output/planning-artifacts/prd.md#NFR26] — Event logging async, <5ms latency overhead
- [Source: _bmad-output/project-context.md#State Persistence] — Event stream: in-memory array during session, batch write at session end
- [Source: _bmad-output/project-context.md#Server Boundaries] — session-manager.ts is ONLY service that orchestrates across layers
- [Source: _bmad-output/project-context.md#Testing Rules] — Server tests mirror src, shared factories, DB tests use transaction rollback
- [Source: apps/server/src/dj-engine/types.ts] — DJState, DJTransition, DJContext, DJSideEffect types
- [Source: apps/server/src/dj-engine/machine.ts] — processTransition() pure function, side effects as data
- [Source: apps/server/src/services/session-manager.ts] — processDjTransition, startSession, endSession, pauseSession, resumeSession, handleParticipantJoin, kickPlayer, transferHost
- [Source: apps/server/src/persistence/session-repository.ts] — updateDjState pattern for JSONB writes
- [Source: apps/server/src/db/types.ts] — SessionsTable.event_stream: `unknown | null` JSONB column
- [Source: apps/server/src/shared/events.ts] — Socket.io event constants (namespace:action naming)
- [Source: apps/server/src/socket-handlers/host-handlers.ts] — HOST_SKIP, HOST_OVERRIDE, HOST_SONG_OVER, HOST_PAUSE, HOST_RESUME handlers
- [Source: apps/server/src/socket-handlers/party-handlers.ts] — PARTY_VIBE_CHANGED, PARTY_START handlers
- [Source: apps/server/src/socket-handlers/connection-handler.ts] — Connection/disconnection lifecycle
- [Source: _bmad-output/implementation-artifacts/2-7-audio-cues-and-state-transition-sounds.md] — Previous story: Flutter-only, no server changes, clean module boundaries

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Created `event-stream.ts` — pure in-memory Map-based event accumulator with SessionEvent discriminated union type (14 event variants). All functions synchronous, <1ms (NFR26). 12 unit tests including 1000-event performance benchmark.
- Added `writeEventStream()` to `session-repository.ts` — single UPDATE for batch JSONB write at session end. 3 tests.
- Integrated event logging into `session-manager.ts` at all lifecycle points: processDjTransition (dj:stateChanged), startSession (party:started), endSession (party:ended + flush to DB), handleParticipantJoin (party:joined), pauseSession (dj:pause), resumeSession (dj:resume), kickPlayer (party:kicked), transferHost (party:hostTransferred). Added userId parameter to processDjTransition, pauseSession, resumeSession.
- Integrated event logging into socket handlers: host:skip, host:override, host:songOver events in host-handlers.ts; party:vibeChanged in party-handlers.ts; party:left (on 5-min cleanup timer) in connection-handler.ts.
- Added system:recovery marker event in recoverActiveSessions for analytics gap detection.
- No periodic background flush (deferred to v2 per architecture).
- endSession flush is fire-and-forget — session end is not blocked by event persistence.
- All 407 tests pass (33 test files), 0 regressions. TypeScript compiles clean.

### Change Log

- 2026-03-12: Implemented Story 2.8 — Event Stream Logging (all 6 tasks)
- 2026-03-12: Code review fixes — enriched host:songOver event data with fromState, fixed recovery event logging post-timeout state, consolidated Date.now() in endSession, added ordering comment for END_PARTY event sequence

### File List

New files:
- `apps/server/src/services/event-stream.ts`
- `apps/server/tests/services/event-stream.test.ts`
- `apps/server/tests/persistence/event-stream-write.test.ts`

Modified files:
- `apps/server/src/persistence/session-repository.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/socket-handlers/host-handlers.ts`
- `apps/server/src/socket-handlers/party-handlers.ts`
- `apps/server/src/socket-handlers/connection-handler.ts`
- `apps/server/tests/services/session-manager.test.ts`
- `apps/server/tests/services/session-manager-dj.test.ts`
- `apps/server/tests/services/session-manager-recovery.test.ts`
- `apps/server/tests/socket-handlers/host-handlers.test.ts`
- `apps/server/tests/socket-handlers/party-handlers.test.ts`

# Story 2.9: Ceremony Type Selection Rules

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want ceremony types selected automatically based on session context,
so that the ceremony variety keeps the party engaging without repetition.

## Acceptance Criteria

1. **Given** a song just ended **When** the DJ engine determines the ceremony type **Then** a full ceremony is selected for the first song of the session (FR14)
2. **Given** a song just ended after an interlude **When** the DJ engine determines the ceremony type **Then** a full ceremony is selected for the first song after the interlude (FR14)
3. **Given** the previous ceremony was a full ceremony **When** the DJ engine determines the next ceremony type **Then** a quick ceremony is selected (two consecutive full ceremonies never occur) (FR14)
4. **Given** the session has completed 5 or more songs (songCount >= 5) **When** the DJ engine determines the ceremony type **Then** quick ceremony is the default (FR14)
5. **Given** a ceremony is about to start **When** the host uses the control overlay to skip **Then** the ceremony is skipped entirely via existing HOST_SKIP transition (FR14)
6. **Given** fewer than 3 participants in the party **When** the DJ engine selects ceremony type **Then** it defaults to quick ceremony (NFR12)
7. **Given** fewer than 3 participants **When** the DJ cycle advances **Then** group interludes are skipped (already implemented in `getNextCycleState`) and DJ engine continues cycling with song → ceremony → song (NFR12)

## Tasks / Subtasks

- [x] Task 1: Add CeremonyType to DJ engine types (AC: #1-#4, #6)
  - [x] 1.1 In `apps/server/src/dj-engine/types.ts`, add:
    ```typescript
    export const CeremonyType = {
      full: 'full',
      quick: 'quick',
    } as const;

    export type CeremonyType = (typeof CeremonyType)[keyof typeof CeremonyType];
    ```
    Follow the same const-object-plus-type pattern used for `DJState`

- [x] Task 2: Create ceremony selection pure function (AC: #1-#4, #6)
  - [x] 2.1 Create `apps/server/src/dj-engine/ceremony-selection.ts`:
    - Import `CeremonyType`, `DJState` from `./types.js` and `DJContext` type
    - **ZERO imports from outside dj-engine/** — this is pure logic
    - Implement `selectCeremonyType(context: DJContext): CeremonyType`:
      ```typescript
      export function selectCeremonyType(context: DJContext): CeremonyType {
        // Rule 1: Small group always gets quick (NFR12)
        if (context.participantCount < 3) {
          return CeremonyType.quick;
        }

        // Rule 2: First song of session always gets full
        if (context.songCount === 1) {
          return CeremonyType.full;
        }

        // Rule 3: After song 5, default to quick
        if (context.songCount >= 5) {
          return CeremonyType.quick;
        }

        // Rule 4: First song after interlude gets full
        if (wasPostInterlude(context.cycleHistory)) {
          // But check Rule 5 first: no consecutive full ceremonies
          const lastCeremonyType = context.metadata.lastCeremonyType as CeremonyType | undefined;
          if (lastCeremonyType === CeremonyType.full) {
            return CeremonyType.quick;
          }
          return CeremonyType.full;
        }

        // Rule 5: No two consecutive full ceremonies
        const lastCeremonyType = context.metadata.lastCeremonyType as CeremonyType | undefined;
        if (lastCeremonyType === CeremonyType.full) {
          return CeremonyType.quick;
        }

        // Default: full ceremony
        return CeremonyType.full;
      }
      ```
    - Implement helper `wasPostInterlude(cycleHistory: DJState[]): boolean`:
      - Walk `cycleHistory` backwards from the end
      - Find the most recent `songSelection` entry — this marks the start of the current mini-cycle
      - Check if the state immediately BEFORE that `songSelection` is `interlude`
      - Return `true` if so, `false` otherwise (including if no songSelection found)
      - **WHY this approach:** The cycle is `...interlude → songSelection → [partyCardDeal →] song → ceremony`. The `getNextCycleState` function always routes from interlude to songSelection. So checking what's before songSelection reliably detects post-interlude:
        ```typescript
        export function wasPostInterlude(cycleHistory: DJState[]): boolean {
          for (let i = cycleHistory.length - 1; i >= 0; i--) {
            if (cycleHistory[i] === DJState.songSelection) {
              return i > 0 && cycleHistory[i - 1] === DJState.interlude;
            }
          }
          return false;
        }
        ```
    - Export both functions for testing

- [x] Task 3: Integrate ceremony type into transition metadata (AC: #1-#4, #6)
  - [x] 3.1 In `apps/server/src/dj-engine/transitions.ts`:
    - Import `selectCeremonyType` from `./ceremony-selection.js`
    - Import `CeremonyType` from `./types.js`
    - In the `transition()` function, after computing `nextState`, add ceremony type selection:
      ```typescript
      // After line: const nextState = computeNextState(context, event);
      // Before building new context:

      // Determine ceremony type metadata
      let ceremonyMetadata: Record<string, unknown> = {};
      if (nextState === DJState.ceremony) {
        // Build a temporary context with the new state to evaluate ceremony rules
        // songCount is already updated for SONG_ENDED events
        const evalContext: DJContext = {
          ...context,
          state: nextState,
          songCount: event.type === 'SONG_ENDED' ? context.songCount + 1 : context.songCount,
          cycleHistory: [...context.cycleHistory, nextState],
        };
        const ceremonyType = selectCeremonyType(evalContext);
        ceremonyMetadata = { ceremonyType, lastCeremonyType: ceremonyType };
      } else {
        // Preserve lastCeremonyType for consecutive-full tracking
        ceremonyMetadata = context.metadata.lastCeremonyType
          ? { lastCeremonyType: context.metadata.lastCeremonyType }
          : {};
      }
      ```
    - Update the return statement metadata spread:
      ```typescript
      metadata: {
        ...context.metadata,
        ...ceremonyMetadata,
        ...(context.participantCount < 3 ? { forcedQuickCeremony: true } : {}),
      },
      ```
    - **CRITICAL:** The `ceremonyType` field in metadata is the active ceremony type for the CURRENT ceremony state. The `lastCeremonyType` field persists across states for consecutive-full tracking
    - The existing `forcedQuickCeremony` flag is preserved for backward compatibility but `ceremonyType` is now the authoritative field

- [x] Task 4: Broadcast ceremony type with state change (AC: #1-#6)
  - [x] 4.1 In `apps/server/src/services/dj-broadcaster.ts`:
    - The current broadcast payload does NOT include `metadata` — it sends a curated subset of DJContext fields via `buildDjStatePayload()`
    - Add `ceremonyType` field to the broadcast payload:
      ```typescript
      // Add to buildDjStatePayload() return object:
      ceremonyType: context.state === DJState.ceremony
        ? (context.metadata.ceremonyType as string | undefined) ?? null
        : null,
      ```
    - This lets Flutter know which ceremony UI to render (full vs quick)
  - [x] 4.2 Update Flutter `SocketClient` to read `ceremonyType` from the `dj:stateChanged` payload and store it on the provider
    - In `apps/flutter_app/lib/socket/client.dart`: extract `ceremonyType` from the `dj:stateChanged` payload data map, pass it to the provider mutation
    - In `apps/flutter_app/lib/state/party_provider.dart`: add `String? _ceremonyType` private field with getter, add `ceremonyType` parameter to `onDjStateUpdate()` method (follows existing named-parameter pattern)
    - **ONLY** SocketClient calls the mutation method (per Flutter boundaries)

- [x] Task 5: Add event stream logging for ceremony type (AC: #1-#4)
  - [x] 5.1 In `apps/server/src/services/event-stream.ts`:
    - Add `ceremony:typeSelected` event type to `SessionEvent` union:
      ```typescript
      | { type: 'ceremony:typeSelected'; ts: number; data: { ceremonyType: 'full' | 'quick'; songCount: number; participantCount: number } }
      ```
  - [x] 5.2 In `apps/server/src/services/session-manager.ts`:
    - After `processDjTransition` completes and the new state is `ceremony`, append event:
      ```typescript
      if (newContext.state === DJState.ceremony) {
        appendEvent(sessionId, {
          type: 'ceremony:typeSelected',
          ts: Date.now(),
          data: {
            ceremonyType: (newContext.metadata.ceremonyType as string) ?? 'quick',
            songCount: newContext.songCount,
            participantCount: newContext.participantCount,
          },
        });
      }
      ```

- [x] Task 6: Tests (AC: #1-#7)
  - [x] 6.1 Create `apps/server/tests/dj-engine/ceremony-selection.test.ts`:
    - Test first song of session (songCount=1) returns `full`
    - Test first song after interlude returns `full` (check cycleHistory ends with [..., interlude, song, ceremony])
    - Test no two consecutive full ceremonies (lastCeremonyType='full' → returns 'quick')
    - Test after song 5 (songCount > 5) returns `quick`
    - Test small group (<3 participants) always returns `quick` regardless of other rules
    - Test default case returns `full` when no special rules apply
    - Test `wasPostInterlude` returns true when songSelection preceded by interlude in history
    - Test `wasPostInterlude` returns false when songSelection preceded by ceremony (small group cycle)
    - Test `wasPostInterlude` returns false for first cycle (songSelection preceded by lobby)
    - Test `wasPostInterlude` returns false when no songSelection in history
    - Test rule priority: small group overrides first-song (participantCount=2, songCount=1 → quick)
    - Test rule priority: consecutive-full overrides post-interlude (lastCeremonyType='full', after interlude → quick)
    - Test rule priority: songCount>=5 overrides post-interlude
    - Use `createTestDJContext` factory from `tests/factories/`
  - [x] 6.2 Extend `apps/server/tests/dj-engine/transitions.test.ts`:
    - Test entering ceremony state sets `ceremonyType` in metadata
    - Test entering ceremony state sets `lastCeremonyType` in metadata
    - Test non-ceremony state preserves `lastCeremonyType` from previous metadata
    - Test `forcedQuickCeremony` still set for <3 participants
    - Test ceremony type is 'full' for first song transition (song→ceremony with songCount=0→1)
    - Test ceremony type is 'quick' after consecutive full
    - Test HOST_OVERRIDE to ceremony state also triggers ceremony type selection and sets metadata
  - [x] 6.3 Extend `apps/server/tests/services/session-manager.test.ts` or `session-manager-dj.test.ts`:
    - Test `processDjTransition` to ceremony state appends `ceremony:typeSelected` event
    - Test event data includes correct ceremonyType, songCount, participantCount
  - [x] 6.4 If broadcaster changes made, test ceremony type is included in broadcast payload
  - [x] 6.5 **Regression tests**: Run full existing test suite to verify no breakage:
    - All existing transition tests still pass (metadata changes are additive)
    - All existing session-manager tests still pass
    - All existing serialization round-trip tests still pass (metadata is `Record<string, unknown>`)

## Dev Notes

### Architecture Decision: Pure Function in DJ Engine

Ceremony selection is a **pure function** in `dj-engine/ceremony-selection.ts` with ZERO side effects and ZERO imports from outside `dj-engine/`. This follows the established pattern:
- `machine.ts` orchestrates transitions
- `transitions.ts` computes next state and context
- `states.ts` defines state configuration
- `ceremony-selection.ts` (NEW) determines ceremony type based on context

The function is called FROM `transitions.ts` during context building — NOT from session-manager. This keeps all game logic in the engine and the orchestrator thin.

[Source: _bmad-output/planning-artifacts/architecture.md — DJ engine is pure logic, session-manager orchestrates]
[Source: _bmad-output/project-context.md#Server Boundaries — dj-engine/ ZERO imports from persistence, integrations, or socket-handlers]

### Ceremony Type Selection Rules (Priority Order)

Rules are evaluated in priority order (first match wins):

| Priority | Rule | Result | Source |
|----------|------|--------|--------|
| 1 | `participantCount < 3` | quick | NFR12 |
| 2 | `songCount === 1` (first song) | full | FR14 |
| 3 | `songCount >= 5` (after song 5) | quick | FR14 |
| 4 | Post-interlude cycle AND `lastCeremonyType !== 'full'` | full | FR14 |
| 5 | `lastCeremonyType === 'full'` | quick | FR14 (no consecutive full) |
| 6 | Default | full | FR14 |

### Metadata Fields for Ceremony Tracking

Two metadata fields are used:

| Field | Scope | Purpose |
|-------|-------|---------|
| `ceremonyType` | Set when entering ceremony state, persists in metadata until next ceremony | Active ceremony type — consumed by broadcaster (only sent when `state === ceremony`) |
| `lastCeremonyType` | Persists across all states | Tracks previous ceremony for consecutive-full prevention |

The existing `forcedQuickCeremony` flag (set in transitions.ts for <3 participants) is preserved but `ceremonyType` is now authoritative. Future code should use `ceremonyType`.

### Context Fields Already Available

The `DJContext` already has everything needed for ceremony selection:
- `songCount` — incremented on `SONG_ENDED` in transitions.ts (line 100)
- `participantCount` — set at context creation, updatable
- `cycleHistory` — appended on every transition (line 94) — tracks full state progression
- `metadata` — `Record<string, unknown>` — flexible key-value store for engine-internal data

No new fields on `DJContext` interface needed. Everything goes through `metadata`.

### Cycle History Analysis

`cycleHistory` records every state visited: `[lobby, songSelection, partyCardDeal, song, ceremony, interlude, songSelection, partyCardDeal, song, ceremony, ...]`

To determine "first song after interlude", use `wasPostInterlude()`:
1. Walk backwards through `cycleHistory` to find the most recent `songSelection`
2. Check if the state immediately BEFORE that `songSelection` is `interlude`
3. The cycle always routes `interlude → songSelection`, so this reliably detects post-interlude

**Why NOT "first non-ceremony state":** Walking backwards from ceremony, the first non-ceremony state is always `song` (the cycle is `...song → ceremony`). You'd never reach `interlude` that way because `song` always sits between `interlude` and `ceremony` in the cycle.

### What This Story Does NOT Build

- **No ceremony UI/animation** — That's Epic 3 (Stories 3.2, 3.3, 3.4). This story only determines the TYPE
- **No award generation** — That's Epic 3 Story 3.2 (award-template-engine)
- **No participation scoring** — That's Epic 3 Story 3.1
- **No ceremony:anticipation, ceremony:reveal, ceremony:quick socket events** — Those are Epic 3 ceremony experience stories. The ceremony state still auto-advances via TIMEOUT (10s placeholder)
- **No changes to ceremony timer duration** — Remains 10s placeholder until Epic 3

### Existing Code to NOT Modify

- `dj-engine/states.ts` — No changes. Ceremony state config and cycle logic unchanged
- `dj-engine/machine.ts` — No changes. processTransition orchestration unchanged
- `dj-engine/timers.ts` — No changes. Timer durations unchanged
- `dj-engine/serializer.ts` — No changes. Already handles `metadata: Record<string, unknown>` generically
- Socket handlers — No changes. HOST_SKIP already works for ceremony skip (AC #5)

### Previous Story Intelligence (Story 2.8)

Story 2.8 established:
- `SessionEvent` discriminated union type in `event-stream.ts` — extend with `ceremony:typeSelected`
- `appendEvent()` pattern in session-manager — same pattern for logging ceremony type selection
- Event stream is in-memory accumulator with batch write — no performance concern for one extra event per ceremony
- All 407 tests pass across 33 test files — baseline for regression testing

Key lesson: Keep new module (`ceremony-selection.ts`) as a standalone pure function. Integration via transitions.ts (engine-internal) and session-manager (orchestration).

### Git Intelligence

Recent commits follow pattern:
- New pure-logic files in `dj-engine/` get their own test file in `tests/dj-engine/`
- Session-manager is modified for orchestration hooks (event logging, broadcasting)
- Test factories in `tests/factories/` — use `createTestDJContext` for ceremony selection tests
- Each story modifies session-manager.ts incrementally

### Broadcasting Ceremony Type to Flutter

The current `broadcastDjState` in `dj-broadcaster.ts` sends a subset of DJContext fields. Check if `metadata` or `ceremonyType` is already included. If NOT, add `ceremonyType` to the broadcast payload so Flutter can render the correct ceremony screen variant.

Flutter needs to know ceremony type to switch between:
- Full ceremony screen (anticipation → reveal choreography) — Epic 3
- Quick ceremony screen (immediate reveal) — Epic 3

For now (this story), Flutter just needs to STORE the value. The ceremony_screen.dart rendering is Epic 3.

### Project Structure Notes

New files:
- `apps/server/src/dj-engine/ceremony-selection.ts` — Pure ceremony type selection function
- `apps/server/tests/dj-engine/ceremony-selection.test.ts` — Comprehensive rule tests

Modified files:
- `apps/server/src/dj-engine/types.ts` — Add `CeremonyType` const + type
- `apps/server/src/dj-engine/transitions.ts` — Call selectCeremonyType, set metadata
- `apps/server/src/services/event-stream.ts` — Add `ceremony:typeSelected` event type
- `apps/server/src/services/session-manager.ts` — Append ceremony type event
- `apps/server/src/services/dj-broadcaster.ts` — Add ceremonyType to broadcast payload (if not already included)
- `apps/flutter_app/lib/socket/client.dart` — Extract ceremonyType from dj:stateChanged payload
- `apps/flutter_app/lib/state/party_provider.dart` — Add ceremonyType parameter to onDjStateUpdate()

Existing test files to extend:
- `apps/server/tests/dj-engine/transitions.test.ts`
- `apps/server/tests/services/session-manager.test.ts` or `session-manager-dj.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.9] — Ceremony type selection rules, host override, small group accommodation
- [Source: _bmad-output/planning-artifacts/architecture.md#L315] — ceremony:reveal event schema with ceremonyType: 'full' | 'quick'
- [Source: _bmad-output/planning-artifacts/architecture.md#L108] — Animation-timing as architecture, server-coordinated timing for ceremony reveals
- [Source: _bmad-output/planning-artifacts/architecture.md#L111] — Graceful degradation, ceremony type adaptation
- [Source: _bmad-output/planning-artifacts/architecture.md#L1338] — NFR12: DJ engine transition guards check participant count
- [Source: _bmad-output/project-context.md#Server Boundaries] — dj-engine/ ZERO imports from persistence, integrations, or socket-handlers
- [Source: _bmad-output/project-context.md#Core Principle] — Server-authoritative architecture
- [Source: apps/server/src/dj-engine/types.ts] — DJState, DJContext (cycleHistory, metadata, songCount, participantCount)
- [Source: apps/server/src/dj-engine/transitions.ts] — transition() function, metadata spreading, forcedQuickCeremony flag
- [Source: apps/server/src/dj-engine/states.ts] — getNextCycleState() with participantCount < 3 degradation
- [Source: apps/server/src/dj-engine/machine.ts] — processTransition() pure function, side effect generation
- [Source: apps/server/src/services/session-manager.ts] — processDjTransition orchestration, event stream integration
- [Source: apps/server/src/services/dj-broadcaster.ts] — broadcastDjState payload structure
- [Source: apps/server/src/services/event-stream.ts] — SessionEvent union, appendEvent API
- [Source: _bmad-output/implementation-artifacts/2-8-event-stream-logging.md] — Previous story: event stream infrastructure, appendEvent pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Server test suite: 437 passed, 0 failed (34 test files)
- Flutter test suite: all tests passed (exit code 0)

### Completion Notes List

- Task 1: Added `CeremonyType` const+type to `types.ts` following `DJState` pattern
- Task 2: Created `ceremony-selection.ts` with `selectCeremonyType()` pure function and `wasPostInterlude()` helper. ZERO imports from outside dj-engine/
- Task 3: Integrated ceremony type selection into `transitions.ts` — called when `nextState === DJState.ceremony`, sets `ceremonyType` and `lastCeremonyType` in metadata. Non-ceremony transitions preserve `lastCeremonyType`
- Task 4: Added `ceremonyType` to `buildDjStatePayload()` in broadcaster (null when not in ceremony state). Updated Flutter `PartyProvider.onDjStateUpdate()` with `ceremonyType` parameter, `SocketClient` passes it from `dj:stateChanged` and `dj:resume` payloads
- Task 5: Added `ceremony:typeSelected` event to `SessionEvent` union. `processDjTransition` appends event when entering ceremony state
- Task 6: Created 14 new ceremony-selection tests, 8 new transition tests, 3 new session-manager ceremony event tests, 2 new broadcaster tests. Updated 3 existing broadcaster tests for new `ceremonyType` field. Full regression suite green

### Change Log

- 2026-03-12: Implemented Story 2.9 — ceremony type selection rules with full test coverage
- 2026-03-12: Code review fixes — reset ceremonyType on session end/kick in Flutter, clear stale ceremonyType from metadata on non-ceremony transitions, replace double type assertion with type guard in session-manager, add boundary and HOST_OVERRIDE test coverage

### File List

New files:
- `apps/server/src/dj-engine/ceremony-selection.ts`
- `apps/server/tests/dj-engine/ceremony-selection.test.ts`

Modified files:
- `apps/server/src/dj-engine/types.ts`
- `apps/server/src/dj-engine/transitions.ts`
- `apps/server/src/services/event-stream.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/services/dj-broadcaster.ts`
- `apps/server/tests/dj-engine/transitions.test.ts`
- `apps/server/tests/services/session-manager-dj.test.ts`
- `apps/server/tests/services/dj-broadcaster.test.ts`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/state/party_provider.dart`

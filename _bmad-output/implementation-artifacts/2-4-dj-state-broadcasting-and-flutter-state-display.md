# Story 2.4: DJ State Broadcasting & Flutter State Display

Status: done

## Story

As a party participant,
I want to see the current party activity update in real-time on my phone,
so that I always know what's happening in the party.

## Acceptance Criteria

1. **Given** the DJ engine transitions to a new state on the server **When** the state change is emitted **Then** all connected participants receive the `dj:stateChanged` event within 200ms (NFR1) containing state, sessionId, songCount, participantCount, currentPerformer, timerStartedAt, and timerDurationMs
2. **Given** the Flutter app receives a `dj:stateChanged` event **When** the SocketClient singleton processes it **Then** it mutates the appropriate provider (only SocketClient calls mutation methods on providers) **And** widgets use `context.watch<T>()` for read-only provider access **And** no widget creates its own socket listener
3. **Given** a participant is in an active party **When** the single `/party` route is displayed **Then** the screen shows the current DJ state name and relevant context (performer, timer info) instead of the placeholder "DJ engine coming in the next update"
4. **Given** a participant is in an active party state **When** any activity is displayed **Then** `wakelock_plus` prevents phone screen auto-lock (FR50)
5. **Given** the party starts via `party:start` **When** `startSession()` completes and initializes the DJ engine **Then** the initial `dj:stateChanged` event is broadcast to all participants (not just `party:started`)
6. **Given** a timer-driven TIMEOUT transition occurs **When** `processDjTransition()` completes **Then** the resulting DJ state is broadcast to all session participants via Socket.io

## Tasks / Subtasks

- [x] Task 1: Create DJ state broadcast infrastructure on server (AC: #1, #5, #6)
  - [x] 1.1 Create `services/dj-broadcaster.ts` with `initDjBroadcaster(io: SocketIOServer)` that stores io reference at module level, and `broadcastDjState(sessionId: string, context: DJContext)` that emits `dj:stateChanged` to all room members via `io.to(sessionId).emit(EVENTS.DJ_STATE_CHANGED, payload)`. Also export a `buildDjStatePayload(context: DJContext)` helper that constructs the payload object — reuse this in connection-handler to avoid payload shape drift
  - [x] 1.2 In `connection-handler.ts` `setupSocketHandlers()`, call `initDjBroadcaster(io)` after auth middleware setup — import from `../services/dj-broadcaster.js`
  - [x] 1.3 In `session-manager.ts` `processDjTransition()`, handle the `broadcast` side effect by calling `broadcastDjState(sessionId, newContext)` — currently this side effect is completely ignored. Import from `../services/dj-broadcaster.js` (services → services, no boundary violation)
  - [x] 1.4 Refactor `connection-handler.ts` lines 110-118 to use `buildDjStatePayload(djState)` from dj-broadcaster instead of manually constructing the payload — single source of truth for payload shape
  - [x] 1.5 Unit tests for `dj-broadcaster.ts`: mock io, verify `io.to(sessionId).emit()` is called with correct payload shape, verify `buildDjStatePayload()` returns correct fields
  - [x] 1.6 NOTE: Sockets already join their session room in auth-middleware (`socket.join(socket.data.sessionId)` at line 80) — `io.to(sessionId)` broadcasting works without additional room setup
- [x] Task 2: Broadcast initial DJ state on party start (AC: #5)
  - [x] 2.1 In `party-handlers.ts`, after `startSession()` returns `{ djContext, sideEffects }`, call `broadcastDjState(socket.data.sessionId, djContext)` to send initial DJ state to all participants (import from `../services/dj-broadcaster.js`)
  - [x] 2.2 Unit test: verify `party:start` emits both `party:started` AND `dj:stateChanged` — NOTE: `party:start` handler has NO existing tests in `party-handlers.test.ts` (only `party:vibeChanged` is tested), so create tests from scratch
- [x] Task 3: Add `dj:stateChanged` listener in Flutter SocketClient (AC: #2)
  - [x] 3.1 In `socket/client.dart` `_setupPartyListeners()`, add listener for `dj:stateChanged` event
  - [x] 3.2 Parse payload: `state` (String → DJState enum via `.byName()`), `songCount` (int), `participantCount` (int), `currentPerformer` (String?), `timerStartedAt` (int?), `timerDurationMs` (int?)
  - [x] 3.3 Call `partyProvider.onDjStateUpdate(...)` with all parsed fields (new method replacing `onDJStateChanged`)
  - [x] 3.4 Unit test: verify SocketClient correctly parses payload and calls provider mutation
- [x] Task 4: Expand PartyProvider with full DJ state fields (AC: #2)
  - [x] 4.1 Add private fields: `_songCount`, `_currentPerformer`, `_timerStartedAt`, `_timerDurationMs` (all nullable/defaulted)
  - [x] 4.2 Add public getters for all new fields
  - [x] 4.3 Replace `onDJStateChanged(DJState value)` with `onDjStateUpdate({required DJState state, int? songCount, int? participantCount, String? currentPerformer, int? timerStartedAt, int? timerDurationMs})` — updates all fields and calls `notifyListeners()` once
  - [x] 4.4 Update `_participantCount` from DJ state payload only if non-null AND session status is `'active'` (server DJ state count is authoritative during active session; `party:joined` event handles lobby count). This prevents race conditions when both events arrive near-simultaneously
  - [x] 4.5 Unit tests for PartyProvider: extend existing `test/state/party_provider_test.dart` (427 lines) — verify all fields update on `onDjStateUpdate`, verify single `notifyListeners()` call, verify participantCount only updates when non-null
- [x] Task 5: Update PartyScreen to display DJ state (AC: #3)
  - [x] 5.1 Replace the placeholder content in `_buildPartyContent()` — remove `Copy.djEngineComingSoon` text
  - [x] 5.2 Display current DJ state name (e.g., "Song Selection", "Song", "Ceremony") using a human-readable label
  - [x] 5.3 Display current performer name if available (`partyProvider.currentPerformer`)
  - [x] 5.4 Display countdown timer if `timerStartedAt` and `timerDurationMs` are set — use a `StreamBuilder` with periodic timer or `AnimatedBuilder` to count down remaining time
  - [x] 5.5 Add DJ state label strings to `constants/copy.dart` (e.g., `djStateLobby`, `djStateSongSelection`, `djStateSong`, etc.)
  - [x] 5.6 Background color already reactive via `partyProvider.backgroundColor` which uses `djStateBackgroundColor(_djState, _vibe)` — no changes needed
  - [x] 5.7 Widget tests: extend existing `test/screens/party_screen_test.dart` (330 lines) — verify correct state label displays for each DJState, verify performer name shows when available, verify timer displays when metadata present. Use existing `_wrapWithProviders()` helper
- [x] Task 6: Add wakelock_plus for screen auto-lock prevention (AC: #4)
  - [x] 6.1 Add `wakelock_plus: ^1.2.8` to `pubspec.yaml` dependencies
  - [x] 6.2 In `PartyProvider`, add wakelock management: call `WakelockPlus.enable()` inside `onDjStateUpdate()` when state is not `lobby` or `finale`, call `WakelockPlus.disable()` when state is `lobby` or `finale` or on session end. Architecture mandates PartyProvider owns wakelock lifecycle — NOT PartyScreen
  - [x] 6.3 Add `_wakelockEnabled` boolean field to PartyProvider to track current wakelock state and avoid redundant enable/disable calls
  - [x] 6.4 Import `wakelock_plus` in `party_provider.dart` only — no wakelock code in screens

## Dev Notes

### Critical Architecture Compliance

**Server Boundaries (ENFORCED):**
- `dj-engine/` has ZERO external imports — already compliant, no changes needed there
- `persistence/` is the ONLY layer that imports from `db/` — no persistence changes in this story
- `socket-handlers/` call services and dj-engine, never persistence directly
- `services/session-manager.ts` orchestrates across layers — imports `broadcastDjState` from `services/dj-broadcaster.ts` (services → services, preserves boundary rules)
- `dj-broadcaster.ts` lives in `services/` NOT `socket-handlers/` — this preserves the one-directional dependency: socket-handlers → services (never the reverse)

**Flutter Boundaries (ENFORCED):**
- Providers are read-only from widgets (`context.watch<T>()`) — existing pattern, maintain it
- ONLY `SocketClient` calls mutation methods on providers — `onDjStateUpdate()` is called only from SocketClient
- No widget creates its own socket listener — all listeners in `_setupPartyListeners()`
- No business logic in providers — PartyProvider remains a reactive state container (wakelock enable/disable is a side effect, not business logic)
- No provider-to-provider access — no cross-provider calls

### DJ State Payload Shape (Source of Truth)

The `dj:stateChanged` payload is currently hardcoded in `connection-handler.ts` lines 110-118. Extract this into `buildDjStatePayload()` in `services/dj-broadcaster.ts` and use for ALL broadcasts (room-wide and single-client reconnection):

```typescript
{
  state: context.state,          // DJState string: 'lobby' | 'songSelection' | 'partyCardDeal' | 'song' | 'ceremony' | 'interlude' | 'finale'
  sessionId: context.sessionId,
  songCount: context.songCount,
  participantCount: context.participantCount,
  currentPerformer: context.currentPerformer,  // string | null
  timerStartedAt: context.timerStartedAt,      // number | null (epoch ms)
  timerDurationMs: context.timerDurationMs,     // number | null
}
```

DJContext fields in `dj-engine/types.ts` are already camelCase — no transformation needed at Socket.io emission boundary. The fields pass through directly to the payload.

### Broadcast Side Effect Gap (CRITICAL)

`processDjTransition()` in `session-manager.ts` currently handles `persist`, `scheduleTimer`, and `cancelTimer` side effects, but **completely ignores the `broadcast` side effect** returned by the state machine. The `broadcast` side effect `{ type: 'broadcast', data: { from: DJState, to: DJState } }` is produced by `processTransition()` in `machine.ts` but never acted upon. This is the core gap this story fills.

### Timer Timeout Broadcasting

`handleRecoveryTimeout()` in session-manager calls `processDjTransition()` for TIMEOUT events. Once Task 1.3 adds broadcast handling to `processDjTransition()`, timer-driven transitions will automatically broadcast to all participants — no additional wiring needed.

### Initial Party Start Flow

Current `party-handlers.ts` `party:start` handler:
1. Calls `startSession()` → returns `{ status, djContext, sideEffects }`
2. Emits `party:started` with `{ status: 'active' }` to all
3. **Missing:** Does NOT emit initial DJ state

After Task 2: also broadcasts `dj:stateChanged` with the initial DJ context (typically `songSelection` state).

### DJState Enum Already Exists in Flutter

`apps/flutter_app/lib/theme/dj_theme.dart` already defines:
```dart
enum DJState { lobby, songSelection, partyCardDeal, song, ceremony, interlude, finale }
```

The `DJState.values.byName(stateString)` call will parse server strings directly. The enum values match the server `DJState` const exactly.

### Countdown Timer Display

For the countdown timer (Task 5.4), use a `Timer.periodic` with 1-second intervals started when `timerStartedAt` and `timerDurationMs` are both non-null. Calculate remaining as:
```dart
final elapsed = DateTime.now().millisecondsSinceEpoch - timerStartedAt!;
final remaining = ((timerDurationMs! - elapsed) / 1000).ceil();
```

CRITICAL: Cancel the periodic timer when:
1. A new `dj:stateChanged` arrives (restart with new values or stop if timer fields are null)
2. `timerStartedAt` or `timerDurationMs` becomes null (state without timer, e.g., lobby, finale)
3. Widget is disposed

Use `StatefulWidget` lifecycle — listen to provider changes, restart/cancel timer accordingly. Failure to cancel creates a memory leak (NFR28: <15MB memory growth over 3hrs).

### What NOT to Build

- No new Socket.io events — use existing `dj:stateChanged` (already in EVENTS const)
- No new database changes — DJ state JSONB column already exists
- No state-specific full screens (song lyrics, ceremony animations, etc.) — those are future stories
- No host control overlay — that's Story 2.5
- No pause/resume handling — that's Story 2.6
- No audio cues — that's Story 2.7
- No Zod schema for DJ state payload — Socket.io payloads are direct objects per architecture
- No `dj-engine/` changes — the engine is complete and pure

### Existing Test Patterns & Infrastructure

**Server tests:**
- `vi.mock()` for external deps, test factories from `tests/factories/`, `vi.clearAllMocks()` in beforeEach
- Factory: `createTestDJContext()` from `tests/factories/dj-state.ts` — use for DJ state test data
- Socket.io mock pattern from `party-join.test.ts`: `io.to = vi.fn().mockReturnValue({ emit: vi.fn() })` — verify with `expect(io.to).toHaveBeenCalledWith('session-id')`
- `party-handlers.test.ts` only tests `party:vibeChanged` — the `party:start` handler has NO existing tests, create from scratch

**Flutter tests (extend existing, do NOT create new files):**
- `test/state/party_provider_test.dart` (427 lines) — has `onDJStateChanged` test, extend with `onDjStateUpdate` tests
- `test/screens/party_screen_test.dart` (330 lines) — has `_wrapWithProviders()` helper, extend with DJ state display tests
- `test/socket/client_test.dart` (24 lines) — minimal, extend with `dj:stateChanged` listener test
- Pattern: `ChangeNotifier` testing with `addListener` for notification counting (verify exactly 1 `notifyListeners()` call)

### Project Structure Notes

New files:
- `apps/server/src/services/dj-broadcaster.ts` (broadcast utility — lives in services layer, NOT socket-handlers)
- `apps/server/tests/services/dj-broadcaster.test.ts`

Modified files:
- `apps/server/src/socket-handlers/connection-handler.ts` (add `initDjBroadcaster(io)` call, refactor DJ state emit to use `buildDjStatePayload()`)
- `apps/server/src/socket-handlers/party-handlers.ts` (broadcast initial DJ state on party:start)
- `apps/server/src/services/session-manager.ts` (handle broadcast side effect, import from dj-broadcaster)
- `apps/flutter_app/lib/socket/client.dart` (add `dj:stateChanged` listener)
- `apps/flutter_app/lib/state/party_provider.dart` (expand DJ state fields, new mutation method, wakelock management)
- `apps/flutter_app/lib/screens/party_screen.dart` (replace placeholder with DJ state display)
- `apps/flutter_app/lib/constants/copy.dart` (add DJ state label strings)
- `apps/flutter_app/pubspec.yaml` (add `wakelock_plus`)

Updated test files (extend existing, do NOT create new):
- `apps/server/tests/services/dj-broadcaster.test.ts` (NEW)
- `apps/server/tests/socket-handlers/party-handlers.test.ts` (add `party:start` tests)
- `apps/server/tests/services/session-manager-dj.test.ts` (add broadcast side effect tests)
- `apps/flutter_app/test/state/party_provider_test.dart` (extend with `onDjStateUpdate` tests)
- `apps/flutter_app/test/screens/party_screen_test.dart` (extend with DJ state display tests)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket Architecture] — Socket.io event patterns, dj:stateChanged direction
- [Source: _bmad-output/planning-artifacts/architecture.md#Flutter State Management] — Provider patterns, SocketClient-only mutations
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — Acceptance criteria with BDD scenarios
- [Source: _bmad-output/project-context.md#Server Boundaries] — Enforced layer boundaries
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — Provider read-only from widgets, SocketClient-only mutations
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog] — dj:stateChanged is Server -> Client
- [Source: _bmad-output/implementation-artifacts/2-3-server-restart-recovery.md] — dj-state-store, timer-scheduler, connection-handler DJ state emit pattern, processDjTransition, handleRecoveryTimeout
- [Source: _bmad-output/implementation-artifacts/2-1-dj-engine-state-machine-server.md] — DJState enum, processTransition() pure function, broadcast side effect
- [Source: _bmad-output/implementation-artifacts/2-2-dj-state-persistence.md] — persistDjState() fire-and-forget, session-manager DJ integration

### Git Intelligence (Recent Commits)

- `805fc81` Story 2.3: Server restart recovery — created dj-state-store.ts, timer-scheduler.ts, recovery logic, connection-handler DJ state emit (single-client on reconnect)
- `f311f03` Story 2.2: DJ state persistence — established persistDjState() fire-and-forget, processDjTransition() side effect handling
- `59f6c88` Story 2.1: DJ engine state machine — established pure function architecture, side effects as data (including broadcast effect), DJState enum
- Pattern: all stories use `vi.mock()` for external deps, test factories, `vi.clearAllMocks()` in beforeEach

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation.

### Completion Notes List

- Task 1: Created `services/dj-broadcaster.ts` with `initDjBroadcaster()`, `broadcastDjState()`, and `buildDjStatePayload()`. Added call in `connection-handler.ts` `setupSocketHandlers()`. Handled `broadcast` side effect in `processDjTransition()`. Refactored connection-handler to use `buildDjStatePayload()` for single source of truth. 5 unit tests.
- Task 2: Added `broadcastDjState()` call in `party-handlers.ts` after `startSession()` returns. Created `party:start` handler tests from scratch (2 tests: success path + silent failure).
- Task 3: Added `dj:stateChanged` listener in `SocketClient._setupPartyListeners()`. Parses payload and calls `partyProvider.onDjStateUpdate()`.
- Task 4: Expanded `PartyProvider` with `_songCount`, `_currentPerformer`, `_timerStartedAt`, `_timerDurationMs` fields. Replaced `onDJStateChanged()` with `onDjStateUpdate()` that updates all fields in single `notifyListeners()`. Participant count only updates when non-null AND session is active. 10 new unit tests.
- Task 5: Replaced placeholder content in `_buildPartyContent()` with DJ state label, performer name, and countdown timer. Added `_updateCountdown()`/`_tickCountdown()` methods with proper timer lifecycle. Added DJ state labels to `copy.dart` with `djStateLabel()` method. 5 new widget tests.
- Task 6: Added `wakelock_plus: ^1.2.8` dependency. Wakelock managed in `PartyProvider.onDjStateUpdate()` — enabled for active states (not lobby/finale), disabled otherwise. Wakelock toggle is injectable for testability. 4 new unit tests.

### Change Log

- 2026-03-11: Implemented Story 2.4 — DJ state broadcasting from server to Flutter clients with real-time display

### File List

New files:
- `apps/server/src/services/dj-broadcaster.ts`
- `apps/server/tests/services/dj-broadcaster.test.ts`

Modified files:
- `apps/server/src/socket-handlers/connection-handler.ts`
- `apps/server/src/socket-handlers/party-handlers.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/tests/socket-handlers/party-handlers.test.ts`
- `apps/server/tests/socket-handlers/party-start.test.ts`
- `apps/server/tests/services/session-manager-dj.test.ts`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/pubspec.yaml`
- `apps/flutter_app/pubspec.lock`
- `apps/flutter_app/test/socket/client_test.dart`
- `apps/flutter_app/test/state/party_provider_test.dart`
- `apps/flutter_app/test/screens/party_screen_test.dart`

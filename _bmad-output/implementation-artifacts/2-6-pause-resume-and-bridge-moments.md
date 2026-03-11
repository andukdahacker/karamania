# Story 2.6: Pause, Resume & Bridge Moments

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a host,
I want the party to pause gracefully during breaks and build hype before each song,
so that the energy flows naturally with the real-world activity.

## Acceptance Criteria

1. **Given** an active party session **When** the host triggers pause via the control overlay **Then** the DJ engine enters pause state and all participants see a paused indicator (FR11)
2. **Given** an active party session **When** 90+ seconds of inactivity is detected across all users **Then** the system auto-triggers pause state (FR11)
3. **Given** the party is paused **When** the host un-pauses or activity resumes **Then** the DJ engine resumes to the next state in the cycle: if mid-song -> song, if mid-ceremony -> ceremony, if mid-interlude -> interlude (FR12)
4. **Given** a physical-world transition is occurring (first song prompt, song selection, mic handoff) **When** the DJ engine reaches a bridge moment **Then** bridge moment activities are displayed to maintain engagement during the transition (FR10)
5. **Given** the next performer has been determined **When** the DJ engine enters the pre-song state **Then** a pre-song hype announcement showing the next performer's name is displayed on all phones (FR17)

## Tasks / Subtasks

- [x] Task 1: Add pause/resume fields to DJ engine types and serialization (AC: #1, #3)
  - [x] 1.1 In `apps/server/src/dj-engine/types.ts`: Add `isPaused: boolean`, `pausedAt: number | null`, `pausedFromState: DJState | null`, and `timerRemainingMs: number | null` to `DJContext` interface. Keep the existing comment "Pause/resume are NOT transitions — they are session-level operations (Story 2.6)."
  - [x] 1.2 In `apps/server/src/dj-engine/serializer.ts`: Update `serializeDJContext()` to include `isPaused`, `pausedAt`, `pausedFromState`, `timerRemainingMs` fields. Update `deserializeDJContext()` to validate and restore these fields (boolean for isPaused, nullable number for pausedAt/timerRemainingMs, nullable DJState string for pausedFromState)
  - [x] 1.3 In `apps/server/src/dj-engine/machine.ts`: Update `createDJContext()` to include defaults: `isPaused: false`, `pausedAt: null`, `pausedFromState: null`, `timerRemainingMs: null`
  - [x] 1.4 In `apps/server/tests/factories/dj-state.ts`: Update `createTestDJContext()` factory to include `isPaused: false`, `pausedAt: null`, `pausedFromState: null`, `timerRemainingMs: null`
  - [x] 1.5 Unit tests: Verify serialization round-trip with isPaused=true and all pause fields set, verify defaults in createDJContext, verify deserializeDJContext rejects invalid pause field types

- [x] Task 2: Add pause/resume timer support (AC: #1, #3)
  - [x] 2.1 In `apps/server/src/services/timer-scheduler.ts`: Add `pauseSessionTimer(sessionId: string): number | null` — Clears the active setTimeout for session. Returns remaining milliseconds if timer was active (calculate from timer start time and duration), or null if no timer. Store the timer's creation timestamp and duration in a separate metadata map so remaining can be computed: add `const timerMeta = new Map<string, { startedAt: number; durationMs: number }>()`. Update `scheduleSessionTimer()` to store metadata alongside timer. Update `cancelSessionTimer()` to also clear metadata
  - [x] 2.2 In `apps/server/src/services/timer-scheduler.ts`: Add `resumeSessionTimer(sessionId: string, remainingMs: number, onTimeout: () => void): void` — Schedules a new timer with the given remaining milliseconds (same as `scheduleSessionTimer` but semantically named for resume). Internally calls `scheduleSessionTimer(sessionId, remainingMs, onTimeout)`
  - [x] 2.3 Unit tests for timer-scheduler: test pauseSessionTimer returns correct remaining ms, test pauseSessionTimer returns null when no timer, test resumeSessionTimer reschedules with correct remaining ms, test cancelSessionTimer clears metadata

- [x] Task 3: Implement pause/resume in session-manager (AC: #1, #3)
  - [x] 3.1 In `apps/server/src/services/session-manager.ts`: Implement `pauseSession(sessionId: string): Promise<DJContext>`:
    - Load context from `getSessionDjState(sessionId)` — throw if null or already in lobby/finale
    - Guard: if `context.isPaused === true`, throw AppError('ALREADY_PAUSED')
    - Call `pauseSessionTimer(sessionId)` to get remaining ms
    - Update context: `isPaused: true`, `pausedAt: Date.now()`, `pausedFromState: context.state`, `timerRemainingMs: remainingMs` (null if no timer was active)
    - Store updated context via `setSessionDjState(sessionId, updatedContext)`
    - Persist via `persistDjState(sessionId, serializeDJContext(updatedContext))` (fire-and-forget async)
    - Broadcast via `broadcastDjPause(sessionId, updatedContext)` (new broadcaster function)
    - Return updatedContext
  - [x] 3.2 In `apps/server/src/services/session-manager.ts`: Implement `resumeSession(sessionId: string): Promise<DJContext>`:
    - Load context from `getSessionDjState(sessionId)` — throw if null
    - Guard: if `context.isPaused === false`, throw AppError('NOT_PAUSED')
    - If `context.timerRemainingMs !== null && context.timerRemainingMs > 0`: call `resumeSessionTimer(sessionId, context.timerRemainingMs, () => handleTimeout(sessionId))` where `handleTimeout` loads context and calls `processDjTransition(sessionId, ctx, { type: 'TIMEOUT' })`
    - Update context: `isPaused: false`, `pausedAt: null`, `pausedFromState: null`, `timerRemainingMs: null`, update `timerStartedAt: Date.now()`, `timerDurationMs: context.timerRemainingMs` (if timer was resumed, so client countdown updates)
    - Store, persist, broadcast via `broadcastDjResume(sessionId, updatedContext)` (new broadcaster function)
    - Return updatedContext
  - [x] 3.3 Update `recoverActiveSessions()` in session-manager.ts: After deserializing context, check `context.isPaused === true`. If paused: skip timer reconciliation entirely (don't schedule any timer), just store in memory and log "Session {id} recovered in paused state". The existing comment on line ~75 ("No timer to reconcile (paused or no-timeout state)") already anticipates this
  - [x] 3.4 Ensure `endSession()` works regardless of pause state: If `context.isPaused === true` when `endSession()` is called, clear `isPaused` on the context before calling `processDjTransition(sessionId, context, { type: 'END_PARTY' })`. No guard needed — ending the party while paused is a valid host action. The resulting finale context should have `isPaused: false`
  - [x] 3.5 Unit tests: test pauseSession stores remaining timer, pauses correctly, persists, broadcasts; test resumeSession reschedules timer, clears pause state, persists, broadcasts; test pauseSession rejects if already paused, if in lobby, if in finale; test resumeSession rejects if not paused; test recovery skips timer reconciliation for paused sessions; test endSession while paused clears isPaused and transitions to finale

- [x] Task 4: Add pause/resume broadcasting (AC: #1, #3)
  - [x] 4.1 In `apps/server/src/services/dj-broadcaster.ts`: Add `broadcastDjPause(sessionId: string, context: DJContext): void` — Emits `EVENTS.DJ_PAUSE` to the Socket.IO room with payload `{ isPaused: true, pausedFromState: context.pausedFromState, timerRemainingMs: context.timerRemainingMs }`. Import and use `getIO()` same as existing `broadcastDjState()`
  - [x] 4.2 In `apps/server/src/services/dj-broadcaster.ts`: Add `broadcastDjResume(sessionId: string, context: DJContext): void` — Emits `EVENTS.DJ_RESUME` to the Socket.IO room with payload from `buildDjStatePayload(context)` (full state so clients update timer/state). This sends the same shape as `dj:stateChanged` so the Flutter client can update its countdown timer correctly
  - [x] 4.3 Update `buildDjStatePayload()` to include `isPaused: boolean` field in the return type and value. This ensures `dj:stateChanged` events (broadcast on normal transitions) also carry the pause flag — clients joining mid-pause will see the correct state
  - [x] 4.4 Unit tests: test broadcastDjPause emits correct event and payload, test broadcastDjResume emits full state payload, test buildDjStatePayload includes isPaused

- [x] Task 5: Add host pause/resume handlers (AC: #1, #3)
  - [x] 5.1 In `apps/server/src/socket-handlers/host-handlers.ts`: Add `EVENTS.DJ_PAUSE` handler (`host:pause` — NOTE: The client emits `host:pause`, server broadcasts `dj:pause`). Actually check events.ts — the events are `dj:pause` and `dj:resume` (Server -> Client). We need NEW client->server events. Add to `apps/server/src/shared/events.ts`: `HOST_PAUSE: 'host:pause'` and `HOST_RESUME: 'host:resume'`
  - [x] 5.2 Implement `host:pause` handler in host-handlers.ts: validate host via existing `validateHost(socket)`, call `pauseSession(socket.data.sessionId)` from session-manager, log success. Wrap in try/catch — emit `error` event with code on failure (ALREADY_PAUSED, etc.)
  - [x] 5.3 Implement `host:resume` handler in host-handlers.ts: validate host, call `resumeSession(socket.data.sessionId)`, log success. Same error handling pattern
  - [x] 5.4 Register both handlers in `registerHostHandlers()` function alongside existing skip/override/songOver/endParty/kickPlayer
  - [x] 5.5 Add pause guard to existing `host:skip` and `host:override` handlers: Before calling `processDjTransition()`, check `context.isPaused === true`. If paused, emit `error` event with code `SESSION_PAUSED` and message "Cannot skip/override while paused — resume first". Do NOT auto-resume. This prevents inconsistent state where a transition fires but pause flags remain set
  - [x] 5.6 Unit tests: test host:pause validates host, calls pauseSession, handles ALREADY_PAUSED error; test host:resume validates host, calls resumeSession, handles NOT_PAUSED error; test non-host rejection for both; test host:skip while paused returns SESSION_PAUSED error; test host:override while paused returns SESSION_PAUSED error

- [x] Task 6: Implement auto-pause on inactivity (AC: #2)
  - [x] 6.1 Create `apps/server/src/services/activity-tracker.ts`:
    - `const activityMap = new Map<string, number>()` — maps sessionId → lastActivityTimestamp
    - `recordActivity(sessionId: string): void` — Sets `activityMap.set(sessionId, Date.now())`
    - `getLastActivity(sessionId: string): number | undefined` — Returns timestamp
    - `removeSession(sessionId: string): void` — Cleans up on session end
    - `clearAll(): void` — For testing/shutdown
  - [x] 6.2 Create `apps/server/src/services/inactivity-monitor.ts`:
    - `const INACTIVITY_THRESHOLD_MS = 90_000` (90 seconds, exported for testing)
    - `const CHECK_INTERVAL_MS = 15_000` (check every 15 seconds, exported for testing)
    - `let intervalHandle: NodeJS.Timeout | null`
    - `startInactivityMonitor(): void` — Sets `setInterval` that iterates all active sessions from `getAllActiveSessions()` (dj-state-store). For each: check if `getLastActivity(sessionId)` is older than `INACTIVITY_THRESHOLD_MS`, AND `context.isPaused === false`, AND state is not `lobby` or `finale`. If all true: call `pauseSession(sessionId)` from session-manager. Log "Auto-pausing session {id} due to inactivity"
    - `stopInactivityMonitor(): void` — Clears interval
    - Export both functions
  - [x] 6.3 In `apps/server/src/socket-handlers/host-handlers.ts` and `apps/server/src/socket-handlers/party-handlers.ts`: After each incoming event handler, call `recordActivity(socket.data.sessionId)`. This means ANY user action (host or participant) resets the inactivity timer for the session. Import from `activity-tracker.ts`
  - [x] 6.4 In `apps/server/src/socket-handlers/connection-handler.ts`: Call `recordActivity(sessionId)` on new connection. Start inactivity monitor in `apps/server/src/index.ts` after Socket.IO initialization, alongside the existing `initDjBroadcaster(io)` call
  - [x] 6.5 Clean up: In `endSession()` (session-manager.ts), call `removeSession(sessionId)` on activity-tracker to prevent stale entries. In `stopInactivityMonitor()`, clear all activity data
  - [x] 6.6 Unit tests for activity-tracker: recordActivity stores timestamp, getLastActivity returns correct value, removeSession cleans up. Unit tests for inactivity-monitor: test auto-pause triggers after 90s inactivity, test active sessions are not paused, test paused sessions are not re-paused, test lobby/finale sessions are skipped

- [x] Task 7: Bridge moment & pre-song hype display (Flutter) (AC: #4, #5)
  - [x] 7.1 The `songSelection` state IS the bridge moment in the current DJ cycle. The existing PartyScreen already shows a different display per DJ state. Create `apps/flutter_app/lib/widgets/bridge_moment_display.dart` — a widget shown when DJ state is `songSelection`:
    - If `currentPerformer != null`: Show pre-song hype card with performer name prominently displayed (FR17). Use large text with `Theme.of(context).textTheme.displayLarge`, animate entrance with `AnimatedOpacity`/`SlideTransition`
    - If `currentPerformer == null` (first song or no performer yet): Show a generic bridge moment — "Get ready!" or "Who's up next?" prompt. Use `Copy` constants for all text
    - Include a subtle animation or visual treatment to maintain energy (simple scale/fade, no elaborate animations per project rules)
  - [x] 7.2 Add copy constants to `apps/flutter_app/lib/constants/copy.dart`:
    - `bridgeGetReady = 'Get Ready!'`
    - `bridgeWhosNext = 'Who\'s up next?'`
    - `bridgeUpNext = 'Up Next'`
    - `bridgeHypePrefix = '🎤'` (or use icon instead of emoji)
    - `bridgeLetsGo = 'Let\'s Go!'`
  - [x] 7.3 In `apps/flutter_app/lib/screens/party_screen.dart`: Replace the current `songSelection` state display content with `BridgeMomentDisplay(currentPerformer: partyProvider.currentPerformer)`. The `songSelection` label and countdown timer remain — the bridge widget adds the hype content
  - [x] 7.4 Widget test for bridge_moment_display: test shows performer name when provided (FR17), test shows generic prompt when no performer, test uses correct Key identifiers

- [x] Task 8: Flutter pause state display and controls (AC: #1, #3)
  - [x] 8.1 In `apps/flutter_app/lib/state/party_provider.dart`: Add `bool _isPaused = false` and `String? _pausedFromState` fields with getters. Add `onDjPause({required String pausedFromState, int? timerRemainingMs})` method: sets `_isPaused = true`, `_pausedFromState = pausedFromState`, calls `notifyListeners()`. Add `onDjResume()` method: calls through to `onDjStateUpdate()` with the full state payload from the resume event (since resume broadcasts full DJ state)
  - [x] 8.2 In `apps/flutter_app/lib/socket/client.dart`: Add listener for `dj:pause` in `_setupPartyListeners()`: parse payload `{ isPaused, pausedFromState, timerRemainingMs }`, call `_partyProvider?.onDjPause(pausedFromState: ..., timerRemainingMs: ...)`. Add listener for `dj:resume`: parse full state payload (same shape as `dj:stateChanged`), call `_partyProvider?.onDjStateUpdate(...)` with all fields (this resets `_isPaused` to false since the `isPaused` field in the payload will be false), then also call `_partyProvider?.onDjResume()` to explicitly clear pause state
  - [x] 8.3 Update `onDjStateUpdate()` in PartyProvider to also set `_isPaused` from payload if the `isPaused` field is provided (for `dj:stateChanged` events that carry the flag). This handles mid-session joins where the client needs to know if the session is paused
  - [x] 8.4 Add emit methods to `apps/flutter_app/lib/socket/client.dart`: `emitHostPause()` → emit `host:pause`, `emitHostResume()` → emit `host:resume`
  - [x] 8.5 In `apps/flutter_app/lib/widgets/host_controls_overlay.dart`: Enable the pause button (currently disabled with `onTap: null` and grayed out). When `partyProvider.isPaused == false`: show "Pause" button with pause icon, `onTap: () => SocketClient.instance.emitHostPause()`. When `partyProvider.isPaused == true`: change button to "Resume" with play icon, `onTap: () => SocketClient.instance.emitHostResume()`, use `DJTokens.actionConfirm` (green) color to indicate resumable
  - [x] 8.6 In `apps/flutter_app/lib/screens/party_screen.dart`: Add pause overlay indicator. When `partyProvider.isPaused == true`, show a semi-transparent overlay with "Paused" text centered on screen, above the DJ state content but below host controls. Use `DJTokens.textPrimary` on a dark scrim. Include the `pausedFromState` label so participants know what was happening ("Paused during Song", "Paused during Ceremony", etc.). When paused, stop/hide the countdown timer (since timer is frozen)
  - [x] 8.7 Update copy constants: `pausedLabel = 'Paused'`, `pausedDuring = 'Paused during'`, `hostControlResume = 'Resume'`, update `hostControlPauseComingSoon` to remove "Coming soon" (no longer needed). Remove the `Tooltip` wrapper around pause button
  - [x] 8.8 In `apps/flutter_app/lib/theme/dj_theme.dart`: Add `DJState` handling — no new enum value needed since pause is NOT a state, it's a flag on the current state. The background color stays as whatever state was active when paused (e.g., paused during song = song color with scrim overlay)

- [x] Task 9: Tests for pause/resume Flutter (AC: #1, #2, #3)
  - [x] 9.1 Extend `apps/flutter_app/test/state/party_provider_test.dart`: test onDjPause sets isPaused and pausedFromState, test onDjResume clears pause state, test onDjStateUpdate with isPaused flag from mid-session join
  - [x] 9.2 Extend `apps/flutter_app/test/socket/client_test.dart`: test dj:pause listener calls onDjPause with correct args, test dj:resume listener calls onDjStateUpdate and clears pause, test emitHostPause/emitHostResume emit correct events
  - [x] 9.3 Extend `apps/flutter_app/test/widgets/host_controls_overlay_test.dart`: test pause button is enabled (no longer disabled), test pause button calls emitHostPause when not paused, test button changes to Resume when paused, test resume button calls emitHostResume
  - [x] 9.4 Extend `apps/flutter_app/test/screens/party_screen_test.dart`: test paused overlay appears when isPaused=true, test paused overlay shows correct "Paused during X" text, test countdown timer is hidden when paused, test paused overlay disappears on resume
  - [x] 9.5 Create `apps/flutter_app/test/widgets/bridge_moment_display_test.dart`: test shows performer name when provided, test shows generic prompt when no performer, test correct keys are used

## Dev Notes

### Critical Design Decision: Pause is NOT a State Machine Transition

The comment in `dj-engine/types.ts` line 22 is explicit: "Pause/resume are NOT transitions — they are session-level operations (Story 2.6)." This means:

- **DO NOT** add PAUSE/RESUME to the `DJTransition` union type
- **DO NOT** add a `paused` value to the `DJState` enum
- Pause is implemented as boolean flags on `DJContext`: `isPaused`, `pausedAt`, `pausedFromState`, `timerRemainingMs`
- The underlying DJ state (song, ceremony, etc.) is PRESERVED during pause — when resumed, the same state continues with its remaining timer
- `pauseSession()` and `resumeSession()` are standalone functions in session-manager, parallel to `processDjTransition()` but NOT using the state machine

### Timer Pause/Resume Mechanics

When paused:
1. `pauseSessionTimer(sessionId)` clears the active `setTimeout` and returns remaining milliseconds
2. Remaining ms = `timerMeta.durationMs - (Date.now() - timerMeta.startedAt)`
3. This value is stored in `context.timerRemainingMs` and persisted to DB

When resumed:
1. `resumeSessionTimer(sessionId, remainingMs, onTimeout)` creates a new `setTimeout` with the stored remaining ms
2. `timerStartedAt` and `timerDurationMs` are updated on the context so the Flutter client's countdown timer renders correctly
3. If `timerRemainingMs` was null (paused during a state with no active timer), no timer is scheduled

### Auto-Pause Implementation (90s Inactivity)

Architecture: Two new services working together:
- **activity-tracker.ts** — Simple map of `sessionId → lastActivityTimestamp`. Updated on EVERY incoming socket event (host or participant)
- **inactivity-monitor.ts** — Periodic interval (every 15s) that checks all active sessions. If any session has no activity for 90+ seconds AND is not already paused AND not in lobby/finale, auto-triggers `pauseSession()`

Activity is recorded in socket handlers (party-handlers and host-handlers) after processing each event. This means reactions, card plays, song selections — any user interaction resets the counter.

### Bridge Moments and Pre-Song Hype

The `songSelection` state in the DJ cycle IS the bridge moment. It's the physical-world transition where the mic is being handed off, the next song is being selected, etc. The 30-second timeout on `songSelection` provides a natural window.

**Pre-song hype (FR17):** When `currentPerformer` is set on the DJ context (which happens when a performer is determined for the next song), the `songSelection` display should prominently show "Up Next: {performer name}" as a hype card. This uses the existing `currentPerformer` field in DJContext — no new fields needed.

**Note:** In the current MVP, `currentPerformer` is set by the server when a song is selected/assigned. Epic 5 (song integration) will implement the full song selection flow. For now, the bridge moment display should handle both cases:
- `currentPerformer != null` → Pre-song hype with name
- `currentPerformer == null` → Generic bridge moment ("Get ready!")

### Server Boundaries (ENFORCED)

- `dj-engine/` — Types and serialization changes ONLY. No imports from services or persistence. The pause logic lives in session-manager, NOT in the state machine
- `services/session-manager.ts` — Orchestrates pause/resume across layers (dj-state-store, persistence, dj-broadcaster, timer-scheduler, activity-tracker)
- `services/activity-tracker.ts` — Pure in-memory map, ZERO external imports
- `services/inactivity-monitor.ts` — Imports from dj-state-store (to iterate sessions), activity-tracker (to check timestamps), and session-manager (to call pauseSession)
- `socket-handlers/` — Call session-manager for pause/resume. Record activity via activity-tracker. NEVER call persistence directly
- `persistence/` — No changes needed for this story. DJ state persistence uses existing `persistDjState()` with the updated serialized context

### Flutter Boundaries (ENFORCED)

- Providers are read-only from widgets (`context.watch<T>()`) — pause indicator reads `isPaused` via watch
- ONLY `SocketClient` calls mutation methods on providers — pause/resume events go through socket listeners
- No widget creates its own socket listener — `dj:pause` and `dj:resume` listeners in `_setupPartyListeners()`
- No business logic in providers — PartyProvider stores `isPaused` flag, doesn't decide when to pause
- Pause button emits socket event, does NOT directly mutate provider

### Existing Event Constants Already Defined

In `apps/server/src/shared/events.ts`:
```typescript
DJ_PAUSE: 'dj:pause',    // Server -> Client (already defined!)
DJ_RESUME: 'dj:resume',  // Server -> Client (already defined!)
```

Need to ADD:
```typescript
HOST_PAUSE: 'host:pause',    // Client -> Server
HOST_RESUME: 'host:resume',  // Client -> Server
```

### Existing Host Controls Overlay Pause Button

In `apps/flutter_app/lib/widgets/host_controls_overlay.dart` lines 91-100, the pause button is currently:
```dart
const Tooltip(
  message: Copy.hostControlPauseComingSoon,
  child: _ControlButton(
    key: Key('host-control-pause'),
    label: Copy.hostControlPause,
    icon: Icons.pause,
    color: DJTokens.textSecondary,  // Grayed out
    onTap: null,                    // Disabled
  ),
),
```
This needs to be enabled with actual pause/resume functionality and state-dependent appearance.

### Recovery Behavior for Paused Sessions

`recoverActiveSessions()` in session-manager.ts already has a code path for "no timer to reconcile" (line ~75). When `context.isPaused === true`:
1. Skip ALL timer reconciliation (don't schedule any timer)
2. Store context in memory as-is
3. Log recovery of paused session
4. When clients reconnect, they receive the paused state via `dj:stateChanged` (which now includes `isPaused` flag)

### What NOT to Build

- No new DJState enum value for `paused` — pause is a boolean flag, not a state
- No `PAUSE`/`RESUME` in DJTransition union — these are session-level operations
- No database migration — isPaused is stored in the existing `dj_state` JSONB column
- No audio cues on pause/resume — that's Story 2.7
- No song queue or performer assignment logic — that's Epic 5. The bridge display uses whatever `currentPerformer` value exists
- No elaborate bridge moment animations — simple, functional UI per project rules
- No activity-based auto-resume — only host can resume. AC#3 wording "or activity resumes" is deferred to post-MVP. For this story, only explicit host action via `host:resume` triggers resume. Auto-pause (inactivity) is implemented; auto-resume is NOT
- No changes to `dj-engine/transitions.ts` or `dj-engine/states.ts` — pause does not affect the state machine logic

### Project Structure Notes

New files:
- `apps/server/src/services/activity-tracker.ts` (activity timestamp tracking)
- `apps/server/src/services/inactivity-monitor.ts` (auto-pause interval checker)
- `apps/flutter_app/lib/widgets/bridge_moment_display.dart` (bridge moment / pre-song hype widget)
- `apps/flutter_app/test/widgets/bridge_moment_display_test.dart`

Modified files:
- `apps/server/src/dj-engine/types.ts` (add isPaused, pausedAt, pausedFromState, timerRemainingMs to DJContext)
- `apps/server/src/dj-engine/serializer.ts` (serialize/deserialize new pause fields)
- `apps/server/src/dj-engine/machine.ts` (update createDJContext defaults)
- `apps/server/src/shared/events.ts` (add HOST_PAUSE, HOST_RESUME)
- `apps/server/src/services/timer-scheduler.ts` (add pauseSessionTimer, resumeSessionTimer, timer metadata tracking)
- `apps/server/src/services/session-manager.ts` (add pauseSession, resumeSession, update recovery)
- `apps/server/src/services/dj-broadcaster.ts` (add broadcastDjPause, broadcastDjResume, update buildDjStatePayload)
- `apps/server/src/socket-handlers/host-handlers.ts` (add host:pause, host:resume handlers, record activity)
- `apps/server/src/socket-handlers/party-handlers.ts` (record activity on all events)
- `apps/server/src/socket-handlers/connection-handler.ts` (record activity on connection)
- `apps/server/tests/factories/dj-state.ts` (add pause field defaults)
- `apps/flutter_app/lib/state/party_provider.dart` (add isPaused, pausedFromState, onDjPause, onDjResume)
- `apps/flutter_app/lib/socket/client.dart` (add dj:pause/dj:resume listeners, emitHostPause/emitHostResume)
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` (enable pause button, add resume state)
- `apps/flutter_app/lib/screens/party_screen.dart` (add paused overlay, integrate bridge moment display)
- `apps/flutter_app/lib/constants/copy.dart` (add bridge moment + pause strings)

Existing test files to extend:
- `apps/server/tests/dj-engine/serializer.test.ts` (pause field round-trip tests)
- `apps/server/tests/dj-engine/machine.test.ts` (createDJContext defaults)
- `apps/server/tests/services/session-manager-dj.test.ts` (pauseSession, resumeSession, recovery tests)
- `apps/server/tests/services/timer-scheduler.test.ts` (pause/resume timer tests — file exists with 122 lines)
- `apps/flutter_app/test/state/party_provider_test.dart` (pause state tests)
- `apps/flutter_app/test/socket/client_test.dart` (pause/resume listener + emitter tests)
- `apps/flutter_app/test/widgets/host_controls_overlay_test.dart` (enabled pause/resume button tests)
- `apps/flutter_app/test/screens/party_screen_test.dart` (paused overlay + bridge moment tests)

New test files:
- `apps/server/tests/services/activity-tracker.test.ts`
- `apps/server/tests/services/inactivity-monitor.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR10] — Bridge moment activities during physical-world transitions
- [Source: _bmad-output/planning-artifacts/prd.md#FR11] — Pause state: host-triggered + 90s inactivity auto-pause
- [Source: _bmad-output/planning-artifacts/prd.md#FR12] — Resume to next state in cycle
- [Source: _bmad-output/planning-artifacts/prd.md#FR17] — Pre-song hype announcement with performer name
- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket Architecture] — dj:pause, dj:resume events (Server -> Client)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Physical-Digital Synchronization] — Bridge moments and pause states feel natural
- [Source: _bmad-output/project-context.md#Server Boundaries] — Enforced layer boundaries
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — Provider read-only from widgets
- [Source: _bmad-output/project-context.md#State Persistence] — Full persistence model, JSONB on every transition
- [Source: apps/server/src/dj-engine/types.ts#L22] — "Pause/resume are NOT transitions" comment
- [Source: apps/server/src/shared/events.ts] — DJ_PAUSE and DJ_RESUME already defined
- [Source: apps/server/src/services/timer-scheduler.ts] — Current timer management (scheduleSessionTimer, cancelSessionTimer)
- [Source: apps/server/src/services/session-manager.ts] — processDjTransition, recoverActiveSessions, endSession patterns
- [Source: apps/server/src/services/dj-broadcaster.ts] — broadcastDjState, buildDjStatePayload patterns
- [Source: apps/flutter_app/lib/widgets/host_controls_overlay.dart#L91-100] — Existing disabled pause button placeholder
- [Source: apps/flutter_app/lib/state/party_provider.dart] — Current DJ state fields, onDjStateUpdate pattern
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — Current state display, countdown timer, Stack layout
- [Source: _bmad-output/implementation-artifacts/2-5-host-controls-overlay.md] — Previous story: host handler patterns, validateHost, side effect handling, endSession/kickPlayer patterns

### Git Intelligence (Recent Commits)

- `41af463` Story 2.5: Host Controls Overlay — host-handlers.ts created with validateHost pattern, endSession + kickPlayer in session-manager, HostControlsOverlay with disabled pause, SongOverButton reusing DjTapButton
- `331d3e6` Story 2.4: DJ state broadcasting — dj-broadcaster.ts, broadcastDjState, buildDjStatePayload, PartyProvider DJ state fields, PartyScreen state display + countdown timer
- `805fc81` Story 2.3: Server restart recovery — recoverActiveSessions(), timer reconciliation, "no timer to reconcile" comment
- `f311f03` Story 2.2: DJ state persistence — persistDjState() fire-and-forget, serializer, JSONB storage
- `59f6c88` Story 2.1: DJ engine state machine — pure function architecture, DJContext, DJTransition, side effects as data
- Pattern: all server tests use `vi.mock()` for external deps, shared test factories, `vi.clearAllMocks()` in beforeEach
- Flutter tests: extend existing files, use `_wrapWithProviders()` helpers

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Code review fixes applied: added pausedFromState/timerRemainingMs to buildDjStatePayload, added missing Flutter tests (client_test, party_screen_test), added resumeSession SESSION_NOT_FOUND test, added inactivity monitor edge case tests, fixed double notifyListeners on resume, added shutdown cleanup for inactivity monitor and timers, changed console.log to console.warn in inactivity monitor

### File List

**New files:**
- `apps/server/src/services/activity-tracker.ts` — Activity timestamp tracking (in-memory map)
- `apps/server/src/services/inactivity-monitor.ts` — Auto-pause on 90s inactivity
- `apps/server/tests/services/activity-tracker.test.ts` — Activity tracker unit tests
- `apps/server/tests/services/inactivity-monitor.test.ts` — Inactivity monitor unit tests
- `apps/flutter_app/lib/widgets/bridge_moment_display.dart` — Bridge moment / pre-song hype widget
- `apps/flutter_app/test/widgets/bridge_moment_display_test.dart` — Bridge moment widget tests

**Modified server source:**
- `apps/server/src/dj-engine/types.ts` — Added isPaused, pausedAt, pausedFromState, timerRemainingMs to DJContext
- `apps/server/src/dj-engine/serializer.ts` — Serialize/deserialize pause fields
- `apps/server/src/dj-engine/machine.ts` — Updated createDJContext defaults
- `apps/server/src/shared/events.ts` — Added HOST_PAUSE, HOST_RESUME events
- `apps/server/src/services/timer-scheduler.ts` — Added pauseSessionTimer, resumeSessionTimer, timer metadata
- `apps/server/src/services/session-manager.ts` — Added pauseSession, resumeSession, updated recovery and endSession
- `apps/server/src/services/dj-broadcaster.ts` — Added broadcastDjPause, broadcastDjResume, updated buildDjStatePayload with pausedFromState/timerRemainingMs
- `apps/server/src/socket-handlers/host-handlers.ts` — Added host:pause/resume handlers, pause guards on skip/override, recordActivity
- `apps/server/src/socket-handlers/party-handlers.ts` — Added recordActivity on all events
- `apps/server/src/socket-handlers/connection-handler.ts` — Added recordActivity on connection
- `apps/server/src/index.ts` — Started inactivity monitor, added shutdown cleanup

**Modified server tests:**
- `apps/server/tests/factories/dj-state.ts` — Added pause field defaults
- `apps/server/tests/dj-engine/machine.test.ts` — createDJContext pause defaults test
- `apps/server/tests/dj-engine/serializer.test.ts` — Pause field round-trip and validation tests
- `apps/server/tests/services/timer-scheduler.test.ts` — Pause/resume timer tests
- `apps/server/tests/services/session-manager-dj.test.ts` — pauseSession, resumeSession, endSession while paused tests
- `apps/server/tests/services/session-manager-recovery.test.ts` — Paused session recovery test
- `apps/server/tests/services/dj-broadcaster.test.ts` — Pause/resume broadcast tests, updated payload assertions
- `apps/server/tests/socket-handlers/host-handlers.test.ts` — Host pause/resume handler tests, pause guard tests

**Modified Flutter source:**
- `apps/flutter_app/lib/constants/copy.dart` — Bridge moment and pause string constants
- `apps/flutter_app/lib/state/party_provider.dart` — Added isPaused, pausedFromState, onDjPause, onDjResume
- `apps/flutter_app/lib/socket/client.dart` — Added dj:pause/dj:resume listeners, emitHostPause/emitHostResume
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` — Enabled pause button, toggle pause/resume
- `apps/flutter_app/lib/screens/party_screen.dart` — Pause overlay, bridge moment display integration

**Modified Flutter tests:**
- `apps/flutter_app/test/state/party_provider_test.dart` — Pause state tests
- `apps/flutter_app/test/widgets/host_controls_overlay_test.dart` — Pause/resume button tests
- `apps/flutter_app/test/socket/client_test.dart` — dj:pause/resume parsing, emitHostPause/Resume tests
- `apps/flutter_app/test/screens/party_screen_test.dart` — Pause overlay, bridge moment, countdown hidden when paused tests

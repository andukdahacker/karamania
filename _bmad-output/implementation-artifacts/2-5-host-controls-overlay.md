# Story 2.5: Host Controls Overlay

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a host,
I want quick access to party controls without leaving the participant experience,
so that I can manage the party flow seamlessly.

## Acceptance Criteria

1. **Given** the host is viewing any participant screen during an active party **When** they tap the persistent floating action button (bottom-right corner) **Then** a control overlay expands within 1 tap, accessible in <1 second from any screen state (FR29, NFR19)
2. **Given** the host control overlay is open **When** the host taps "Skip" **Then** the current activity is skipped and the DJ engine advances to the next state (FR30)
3. **Given** the host control overlay is open **When** the host taps "Pause" **Then** the DJ engine enters pause state and all participants see a paused indicator (FR31) — NOTE: Pause/resume DJ engine transitions are Story 2.6. This story wires the UI button but shows it as disabled with "Coming soon" indicator. No socket event emitted.
4. **Given** the host control overlay is open **When** the host taps "Resume" on a paused engine **Then** the DJ engine resumes (FR31) — Same deferral note as AC#3
5. **Given** the host control overlay is open **When** the host selects "Override Next" and picks a target activity **Then** the DJ engine overrides the next activity selection to the chosen type (FR32)
6. **Given** the host control overlay is open **When** the host taps "Kick Player" and selects a participant **Then** that participant is removed from the session
7. **Given** the host control overlay is open **When** the host taps "End Party" and confirms **Then** the party transitions to finale state and all participants are notified (FR33)
8. **Given** the host controls are displayed **When** any control button is rendered **Then** all tap targets are no smaller than 48x48px (NFR14)
9. **Given** a song is in progress **When** the host views the participant screen **Then** a persistent, always-visible "Song Over!" trigger is displayed allowing the host to signal that a song has ended (FR16) — This is OUTSIDE the overlay, always visible during `song` state
10. **Given** a non-host participant views the party screen **When** they look at the UI **Then** they do NOT see the host FAB or Song Over button

## Tasks / Subtasks

- [x] Task 1: Add persistence and session-manager methods (AC: #6, #7)
  - [x] 1.1 Add `removeParticipant(sessionId: string, userId: string)` to `persistence/session-repository.ts`: `DELETE FROM session_participants WHERE session_id = $1 AND user_id = $2`
  - [x] 1.2 Update `updateStatus()` in `persistence/session-repository.ts` to also set `ended_at: new Date()` when status is `'ended'` (or add a dedicated `endSession` repo method that sets both)
  - [x] 1.3 Add event constants to `shared/events.ts`: `HOST_END_PARTY: 'host:endParty'`, `HOST_KICK_PLAYER: 'host:kickPlayer'`, `PARTY_PARTICIPANT_REMOVED: 'party:participantRemoved'`
  - [x] 1.4 Implement `endSession(sessionId: string, hostUserId: string)` in `session-manager.ts`:
    - Load DJ context from `getSessionDjState(sessionId)`
    - Call `processDjTransition(sessionId, context, { type: 'END_PARTY' })` — this automatically handles broadcast (finale state), persist, and cancelTimer via existing side effect handling
    - Update DB via `sessionRepo.updateStatus(sessionId, 'ended')` (with `ended_at`)
    - Clean up in-memory state: `removeSessionDjState(sessionId)` from dj-state-store, `cancelSessionTimer(sessionId)`, `removeSession(sessionId)` from connection-tracker
    - Return the finale DJ context
  - [x] 1.5 Implement `kickPlayer(sessionId: string, hostUserId: string, targetUserId: string)` in `session-manager.ts`:
    - Verify host via `sessionRepo.findById(sessionId)` comparing `host_user_id === hostUserId`
    - Verify target is not host (can't kick yourself)
    - Call `sessionRepo.removeParticipant(sessionId, targetUserId)`
    - Update DJ context: decrement `participantCount`, persist updated context via `persistDjState()`
    - Return `{ kickedUserId: targetUserId }`
  - [x] 1.6 Unit tests for new session-manager methods: end session transitions to finale + DB update + cleanup, kick player removes participant + updates count, both reject non-host callers

- [x] Task 2: Create server-side host event handlers (AC: #2, #5, #6, #7, #9)
  - [x] 2.1 Create `apps/server/src/socket-handlers/host-handlers.ts` with `registerHostHandlers(socket: AuthenticatedSocket, io: SocketIOServer)` — NOTE: must accept `io` parameter (unlike `registerPartyHandlers`) because kick-player needs to emit to a specific socket and disconnect it
  - [x] 2.2 Add host validation helper inside host-handlers: load session via `sessionRepo.findById(socket.data.sessionId)`, verify `socket.data.userId === session.host_user_id`. Reject with `socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can perform this action' })`. Do NOT use `getConnectionInfo()` (does not exist) — use the DB as authoritative source
  - [x] 2.3 Implement `host:skip` handler: validate host, load context from `getSessionDjState(sessionId)`, call `processDjTransition(sessionId, context, { type: 'HOST_SKIP' })` — broadcast happens automatically via side effects
  - [x] 2.4 Implement `host:override` handler: validate host, accept `{ targetState: string }` payload, validate targetState is a valid override target (songSelection, partyCardDeal, song, ceremony, interlude — NOT lobby or finale), call `processDjTransition(sessionId, context, { type: 'HOST_OVERRIDE', targetState })`
  - [x] 2.5 Implement `host:songOver` handler: validate host, load context, verify `context.state === 'song'` (reject otherwise), call `processDjTransition(sessionId, context, { type: 'SONG_ENDED' })`
  - [x] 2.6 Implement `host:endParty` handler: validate host, call `endSession(sessionId, hostUserId)` from session-manager, then emit `PARTY_ENDED` to entire room via `io.to(sessionId).emit(EVENTS.PARTY_ENDED, { reason: 'host_ended' })`
  - [x] 2.7 Implement `host:kickPlayer` handler: validate host, accept `{ userId: string }` payload, call `kickPlayer(sessionId, hostUserId, targetUserId)` from session-manager, find kicked user's socket via `getActiveConnections(sessionId)` from connection-tracker (find entry where `conn.userId === targetUserId`, get `conn.socketId`), emit `PARTY_PARTICIPANT_REMOVED` to kicked socket via `io.to(socketId).emit(...)`, force disconnect via `io.sockets.sockets.get(socketId)?.disconnect(true)`, broadcast updated participant count to room
  - [x] 2.8 Register in `connection-handler.ts`: add `import { registerHostHandlers } from './host-handlers.js'` and call `registerHostHandlers(s, io)` right after `registerPartyHandlers(s)` in the connection callback
  - [x] 2.9 Unit tests for host-handlers: test all handlers with host validation (reject non-host), test skip/override/songOver/endParty/kickPlayer success paths, test edge cases (skip from lobby = DJEngineError, songOver when not in song state = error, override to lobby = error)

- [x] Task 3: Create Flutter host controls overlay widget (AC: #1, #2, #5, #6, #7, #8)
  - [x] 3.1 Create `apps/flutter_app/lib/widgets/host_controls_overlay.dart` — a `StatefulWidget` that renders a bottom-right FAB which expands into a semi-transparent overlay panel with control buttons. This widget REPLACES the existing invite FAB in PartyScreen
  - [x] 3.2 FAB design: use the current vibe's accent color (accessed via `PartyVibe` in `dj_theme.dart`) or `DJTokens.actionConfirm`, 56x56px minimum, icon = settings/gear icon. When tapped, animate expansion to a column of control buttons (use `AnimatedSwitcher` or `AnimatedContainer`)
  - [x] 3.3 Control buttons in overlay (all 48x48px minimum tap targets per NFR14):
    - "Invite" — opens `_InviteSheet` (move invite logic from current PartyScreen FAB into overlay)
    - "Skip" — calls `SocketClient.instance.emitHostSkip()`, available when DJ state is songSelection, partyCardDeal, song, ceremony, or interlude
    - "Override Next" — opens a sub-menu with activity options (songSelection, partyCardDeal, song, ceremony, interlude), calls `SocketClient.instance.emitHostOverride(selected)`
    - "Pause" — disabled button with "Coming soon" tooltip (Story 2.6 deferred). Do NOT emit any event
    - "End Party" — shows confirmation dialog (`showDialog` with confirm/cancel), then calls `SocketClient.instance.emitHostEndParty()`
    - "Kick Player" — shows participant list picker using `partyProvider.participants` (existing field, filter out self/host), then calls `SocketClient.instance.emitHostKickPlayer(userId)`
  - [x] 3.4 Overlay dismiss: tap outside overlay (use `GestureDetector` on barrier) or tap FAB again to collapse
  - [x] 3.5 Only render this widget when `partyProvider.isHost == true` — widget itself checks, but parent also gates
  - [x] 3.6 All strings in `constants/copy.dart`: `hostControlInvite`, `hostControlSkip`, `hostControlOverride`, `hostControlPause`, `hostControlPauseComingSoon`, `hostControlEndParty`, `hostControlKickPlayer`, `hostControlEndPartyConfirmTitle`, `hostControlEndPartyConfirmBody`, `hostControlEndPartyConfirmYes`, `hostControlEndPartyConfirmNo`, `hostKickedMessage`

- [x] Task 4: Create Song Over button widget (AC: #9, #10)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/song_over_button.dart` — a persistent button visible ONLY to host AND ONLY when DJ state is `song`
  - [x] 4.2 REUSE `DjTapButton` with `tier: TapTier.consequential` — this already implements the exact 500ms hold-to-confirm pattern with fill animation, `LinearProgressIndicator`, and `HapticFeedback.heavyImpact`. Do NOT build a custom `GestureDetector` — that would reinvent the wheel. Wrap `DjTapButton` with appropriate styling:
    ```dart
    DjTapButton(
      key: const Key('song-over-button'),
      tier: TapTier.consequential,
      onTap: () => SocketClient.instance.emitHostSongOver(),
      child: Text(Copy.hostSongOverLabel),
    )
    ```
  - [x] 4.3 Position: bottom-center of screen, prominent size, use `DJTokens.actionDanger` color or vibe accent
  - [x] 4.4 Minimum 48x48px tap target (NFR14) — `DjTapButton` already enforces this
  - [x] 4.5 Add strings to `constants/copy.dart`: `hostSongOverLabel = 'Song Over!'`, `hostSongOverHint = 'Hold to end song'`

- [x] Task 5: Integrate host controls into PartyScreen (AC: #1, #9, #10)
  - [x] 5.1 Remove the existing `FloatingActionButton` (lines 162-169 that show QR invite icon) — this is replaced by the `HostControlsOverlay` which includes invite as one of its options
  - [x] 5.2 In `party_screen.dart`, add `HostControlsOverlay` as a `Stack` child positioned bottom-right, only when `partyProvider.isHost && partyProvider.djState != DJState.lobby && partyProvider.djState != DJState.finale`
  - [x] 5.3 Add `SongOverButton` positioned bottom-center, only when `partyProvider.isHost && partyProvider.djState == DJState.song`
  - [x] 5.4 Ensure the controls overlay appears above all other content (place last in Stack children for proper z-ordering)
  - [x] 5.5 Move the `_InviteSheet` inner class (currently in PartyScreen) to a shared location or pass it to `HostControlsOverlay` so the invite action can still show the same bottom sheet

- [x] Task 6: Add Socket.io event handling for host actions in Flutter (AC: #6, #7)
  - [x] 6.1 In `socket/client.dart`, add emitter methods (all call `_socket?.emit(event, data)`):
    - `emitHostSkip()` → emit `host:skip`
    - `emitHostOverride(String targetState)` → emit `host:override`, `{'targetState': targetState}`
    - `emitHostSongOver()` → emit `host:songOver`
    - `emitHostEndParty()` → emit `host:endParty`
    - `emitHostKickPlayer(String userId)` → emit `host:kickPlayer`, `{'userId': userId}`
  - [x] 6.2 Add `onSessionEnded()` method to `PartyProvider`: sets `_sessionStatus = 'ended'`, clears DJ state fields, disables wakelock, calls `notifyListeners()`. Add `onKicked()` method: same as ended but sets a `_kickedMessage` field for UI display
  - [x] 6.3 Add listener for `party:ended` event in `_setupPartyListeners()`: call `_partyProvider?.onSessionEnded()`. Navigation: PartyScreen watches `partyProvider.sessionStatus` — when it becomes `'ended'`, use `GoRouter.of(context).go('/')` to navigate home. Do NOT call GoRouter from SocketClient (no BuildContext). The provider state change triggers the widget to navigate
  - [x] 6.4 Add listener for `party:participantRemoved` in `_setupPartyListeners()`: parse `{ userId }` payload. If `userId == _userId`, call `_partyProvider?.onKicked()` and `disconnect()`. If another user, update participant count via `_partyProvider?.onParticipantRemoved(userId)`

- [x] Task 7: Widget and unit tests (AC: all)
  - [x] 7.1 Create `apps/flutter_app/test/widgets/host_controls_overlay_test.dart`: test overlay only shows for host, test FAB expands/collapses, test each control button emits correct socket event, test confirmation dialog for end party, test participant picker for kick player, test pause button is disabled
  - [x] 7.2 Create `apps/flutter_app/test/widgets/song_over_button_test.dart`: test only shows for host during song state, test DjTapButton consequential tier is used, test hidden for non-host
  - [x] 7.3 Extend `apps/flutter_app/test/screens/party_screen_test.dart`: test host controls overlay presence for host in active states, test absence for non-host, test absence in lobby/finale, test Song Over button presence during song state for host only
  - [x] 7.4 Extend `apps/flutter_app/test/socket/client_test.dart`: test emitter methods for host actions, test party:ended listener calls onSessionEnded, test party:participantRemoved listener handles self-kick and other-kick
  - [x] 7.5 Create `apps/server/tests/socket-handlers/host-handlers.test.ts`: test all handlers with auth validation, test rejection of non-host users, test each handler's happy path and error cases
  - [x] 7.6 Extend `apps/server/tests/services/session-manager-dj.test.ts`: test endSession (transitions to finale + DB update + in-memory cleanup) and kickPlayer (removes participant + decrements count + persists)

## Dev Notes

### Critical Architecture Compliance

**Server Boundaries (ENFORCED):**
- `dj-engine/` has ZERO external imports — no changes needed to dj-engine for this story. HOST_SKIP, HOST_OVERRIDE, and END_PARTY transitions are already defined in `dj-engine/states.ts` with proper `allowedTransitions`
- `socket-handlers/host-handlers.ts` calls `services/session-manager.ts` for all business logic — never calls persistence directly (except host validation via `sessionRepo.findById()` which is a read-only check)
- `services/session-manager.ts` orchestrates across layers (dj-state-store, persistence, dj-broadcaster, timer-scheduler)
- `persistence/` is the ONLY layer that imports from `db/` — kick player DB deletion goes through `sessionRepo.removeParticipant()`

**Flutter Boundaries (ENFORCED):**
- Providers are read-only from widgets (`context.watch<T>()`) — host controls overlay reads `isHost`, `djState`, `participants` via watch
- ONLY `SocketClient` calls mutation methods on providers — overlay emits socket events, never mutates provider directly
- No widget creates its own socket listener — all listeners in `_setupPartyListeners()`
- No business logic in providers — PartyProvider remains a reactive state container
- Navigation triggered by provider state change (widget watches `sessionStatus`), NOT from SocketClient

### DJ Engine Transitions Already Implemented

The pure state machine in `dj-engine/` already supports all transitions needed:

**HOST_SKIP** — Allowed from: `songSelection`, `partyCardDeal`, `song`, `ceremony`, `interlude`. Advances to next state in cycle via `getNextCycleState()`.

**HOST_OVERRIDE** — Allowed from same states as HOST_SKIP. Accepts `targetState` parameter. Can target: `songSelection`, `partyCardDeal`, `song`, `ceremony`, `interlude` (NOT `lobby` or `finale`). Validated by `isValidOverrideTarget()` in `states.ts`.

**END_PARTY** — Allowed from ALL states except `finale`. Transitions to `finale`.

**SONG_ENDED** — Allowed from `song`. Transitions to `ceremony` (normal flow). This is what `host:songOver` triggers.

**Pause/Resume** — Per `dj-engine/types.ts` comments: "Pause/resume are NOT transitions — they are session-level operations (Story 2.6)." The UI buttons should be visible but disabled with a "Coming soon" indicator. Do NOT emit any events for pause/resume.

### Side Effect Handling (Already Wired)

`processDjTransition()` in `session-manager.ts` already handles ALL side effects returned by the state machine:
- `broadcast` → calls `broadcastDjState()` (dj-broadcaster) — emits `dj:stateChanged` to all room members
- `persist` → calls `persistDjState()` (fire-and-forget async)
- `scheduleTimer` → calls `scheduleSessionTimer()` (timer-scheduler)
- `cancelTimer` → calls `cancelSessionTimer()` (timer-scheduler)

So calling `processDjTransition()` for HOST_SKIP, HOST_OVERRIDE, SONG_ENDED, and END_PARTY will automatically broadcast the new state to all clients, persist to DB, and manage timers. No additional wiring needed for these transitions.

### Host Validation Pattern (Server)

Host identity must be validated on every host action. The authoritative source is the database:

```typescript
import * as sessionRepo from '../persistence/session-repository.js';

async function validateHost(socket: AuthenticatedSocket): Promise<void> {
  const session = await sessionRepo.findById(socket.data.sessionId);
  if (!session || session.host_user_id !== socket.data.userId) {
    socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can perform this action' });
    throw new Error('Not host');
  }
}
```

Do NOT use `getConnectionInfo()` — that function does not exist. The connection-tracker has `getActiveConnections(sessionId)` which returns a list, but the DB `sessions.host_user_id` is the authoritative source for host identity.

### Handler Registration Pattern

`registerHostHandlers` needs the `io` server reference (unlike `registerPartyHandlers` which only needs `socket`). This is because kick-player must emit to a specific socket ID and force-disconnect it:

```typescript
// host-handlers.ts
export function registerHostHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void { ... }

// connection-handler.ts (in io.on('connection') callback)
registerPartyHandlers(s);
registerHostHandlers(s, io);
```

### End Session Implementation Details

`endSession()` in session-manager orchestrates:
1. Load DJ context from `getSessionDjState(sessionId)` — if null, session may already be ended
2. Call `processDjTransition(sessionId, context, { type: 'END_PARTY' })` — automatically broadcasts `dj:stateChanged` with finale, persists, cancels timers
3. Update DB: call `sessionRepo.updateStatus(sessionId, 'ended')` — must also set `ended_at` (update `updateStatus` to handle this)
4. Clean up in-memory state: `removeSessionDjState(sessionId)` from dj-state-store, `cancelSessionTimer(sessionId)` from timer-scheduler, `removeSession(sessionId)` from connection-tracker
5. The host-handler then emits `PARTY_ENDED` to the room (separate from `dj:stateChanged`)

### Kick Player Implementation Details

`kickPlayer()` in session-manager:
1. Verify host via `sessionRepo.findById(sessionId)` → `session.host_user_id === hostUserId`
2. Verify target is not host (`targetUserId !== hostUserId`)
3. Call `sessionRepo.removeParticipant(sessionId, targetUserId)` — new method needed in session-repository
4. Load DJ context, decrement `participantCount`, update in-memory and persist
5. Return `{ kickedUserId: targetUserId }`
6. The host-handler then: finds kicked socket via `getActiveConnections(sessionId)`, emits `PARTY_PARTICIPANT_REMOVED` to that socket, force-disconnects it, broadcasts updated count to room

### Song Over Button — Reuse DjTapButton

The existing `DjTapButton` widget (`widgets/dj_tap_button.dart`) already implements the exact 500ms hold-to-confirm pattern needed:
- `TapTier.consequential` = 500ms hold timer with `LinearProgressIndicator` fill animation
- `HapticFeedback.heavyImpact` on confirm
- `AnimatedScale` for visual feedback
- Requires `Key` parameter (architecture rule)

Import from `package:karamania/widgets/dj_tap_button.dart` and `package:karamania/constants/tap_tiers.dart`. Do NOT build a custom GestureDetector — that reinvents existing functionality.

### Flutter Navigation on Party End / Kick

SocketClient has no `BuildContext`, so it cannot call GoRouter directly. Pattern:
1. SocketClient receives `party:ended` → calls `partyProvider.onSessionEnded()`
2. `PartyProvider.onSessionEnded()` sets `_sessionStatus = 'ended'`, clears state, calls `notifyListeners()`
3. `PartyScreen` watches `partyProvider.sessionStatus` — when `'ended'`, calls `context.go('/')` (GoRouter)
4. Same pattern for kick: `partyProvider.onKicked()` sets status + kicked message → widget navigates + shows snackbar

### Existing Participant List in PartyProvider

`PartyProvider` already tracks `_participants` as `List<ParticipantInfo>` with fields `{userId, displayName, isOnline}`. The kick player picker in the overlay should use `context.watch<PartyProvider>().participants` and filter out entries where `userId == currentHostId` (can't kick yourself).

### Event Constants to Add

In `shared/events.ts`:
```typescript
HOST_END_PARTY: 'host:endParty',
HOST_KICK_PLAYER: 'host:kickPlayer',
PARTY_PARTICIPANT_REMOVED: 'party:participantRemoved',
```

The existing constants already include: `HOST_SKIP`, `HOST_OVERRIDE`, `HOST_SONG_OVER`.

### Existing API Methods in Key Services

**dj-state-store.ts:**
- `getSessionDjState(sessionId)` — load from in-memory cache
- `setSessionDjState(sessionId, context)` — update cache
- `removeSessionDjState(sessionId)` — delete from cache (use for endSession cleanup)
- `getAllActiveSessions()`, `clearAllSessions()`

**connection-tracker.ts:**
- `getActiveConnections(sessionId)` — returns `TrackedConnection[]` with `{socketId, userId, displayName, connectedAt, isHost}`
- `removeSession(sessionId)` — cleans up all connection state for a session
- `trackDisconnection()`, `updateHostStatus()`, etc.

**timer-scheduler.ts:**
- `cancelSessionTimer(sessionId)` — cancel active timer for session

### What NOT to Build

- No pause/resume DJ state machine transitions — that's Story 2.6. Show pause button as disabled, emit nothing
- No audio cues on state transitions — that's Story 2.7
- No event stream logging — that's Story 2.8
- No ceremony type selection — that's Story 2.9
- No song detection or queue management — that's Epic 5
- No elaborate animations for overlay (keep it functional, not fancy)
- No `dj-engine/` changes — all needed transitions already exist
- No new database migrations — existing schema supports everything needed
- No custom GestureDetector for Song Over — reuse DjTapButton with TapTier.consequential
- No `getConnectionInfo()` calls — that function does not exist

### Project Structure Notes

New files:
- `apps/server/src/socket-handlers/host-handlers.ts` (host event handlers)
- `apps/server/tests/socket-handlers/host-handlers.test.ts` (host handler tests)
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` (overlay widget)
- `apps/flutter_app/lib/widgets/song_over_button.dart` (song over button wrapping DjTapButton)
- `apps/flutter_app/test/widgets/host_controls_overlay_test.dart`
- `apps/flutter_app/test/widgets/song_over_button_test.dart`

Modified files:
- `apps/server/src/shared/events.ts` (add HOST_END_PARTY, HOST_KICK_PLAYER, PARTY_PARTICIPANT_REMOVED)
- `apps/server/src/persistence/session-repository.ts` (add removeParticipant, update updateStatus for ended_at)
- `apps/server/src/services/session-manager.ts` (add endSession, kickPlayer methods)
- `apps/server/src/socket-handlers/connection-handler.ts` (register host handlers with io reference)
- `apps/flutter_app/lib/screens/party_screen.dart` (replace invite FAB with overlay + add song over button + add navigation on session end)
- `apps/flutter_app/lib/socket/client.dart` (add host action emitters + party:ended and party:participantRemoved listeners)
- `apps/flutter_app/lib/constants/copy.dart` (add host control strings + kicked message)
- `apps/flutter_app/lib/state/party_provider.dart` (add onSessionEnded, onKicked, onParticipantRemoved methods)

Existing test files to extend:
- `apps/server/tests/services/session-manager-dj.test.ts` (endSession, kickPlayer tests)
- `apps/flutter_app/test/screens/party_screen_test.dart` (host controls presence tests)
- `apps/flutter_app/test/socket/client_test.dart` (host emitter + listener tests)
- `apps/flutter_app/test/state/party_provider_test.dart` (onSessionEnded, onKicked tests)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket Architecture] — Socket.io event patterns, host:skip/override/songOver events
- [Source: _bmad-output/planning-artifacts/architecture.md#Flutter State Management] — Provider patterns, SocketClient-only mutations
- [Source: _bmad-output/planning-artifacts/architecture.md#Host Controls] — FR29-33, host transfer, song_over_button.dart spec
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — Full acceptance criteria
- [Source: _bmad-output/project-context.md#Server Boundaries] — Enforced layer boundaries
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — Provider read-only from widgets
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog] — host namespace events Client -> Server
- [Source: _bmad-output/implementation-artifacts/2-4-dj-state-broadcasting-and-flutter-state-display.md] — Previous story: dj-broadcaster, broadcastDjState, buildDjStatePayload, PartyProvider DJ state fields, PartyScreen structure
- [Source: apps/server/src/dj-engine/states.ts] — HOST_SKIP/HOST_OVERRIDE/END_PARTY already in allowedTransitions, isValidOverrideTarget()
- [Source: apps/server/src/dj-engine/types.ts] — DJTransition enum, "Pause/resume are NOT transitions" comment
- [Source: apps/server/src/dj-engine/transitions.ts] — transition() pure function, computeNextState for HOST_SKIP/OVERRIDE/END_PARTY
- [Source: apps/server/src/services/session-manager.ts] — processDjTransition() side effect handling, TODO: endSession()
- [Source: apps/server/src/shared/events.ts] — Existing HOST_SKIP, HOST_OVERRIDE, HOST_SONG_OVER constants
- [Source: apps/server/src/services/connection-tracker.ts] — getActiveConnections() for finding socket IDs, removeSession() for cleanup
- [Source: apps/server/src/services/dj-state-store.ts] — removeSessionDjState() for cleanup
- [Source: apps/server/src/persistence/session-repository.ts] — Current methods, missing removeParticipant
- [Source: apps/flutter_app/lib/state/party_provider.dart] — isHost boolean, participants list, onHostTransferred(), DJ state tracking
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — Existing FAB for QR invites (host-only, lines 162-169), Stack layout
- [Source: apps/flutter_app/lib/widgets/dj_tap_button.dart] — DjTapButton with TapTier.consequential (500ms hold), existing widget to reuse for Song Over
- [Source: apps/flutter_app/lib/theme/dj_tokens.dart] — actionConfirm (green), actionDanger (red), spacing constants. NO actionPrimary — use vibe accent or actionConfirm
- [Source: apps/flutter_app/lib/theme/dj_theme.dart] — PartyVibe.accent/primary colors for vibe-aware theming

### Git Intelligence (Recent Commits)

- `331d3e6` Story 2.4: DJ state broadcasting — created dj-broadcaster.ts, expanded PartyProvider with DJ state fields, replaced PartyScreen placeholder with DJ state display, added countdown timer
- `805fc81` Story 2.3: Server restart recovery — dj-state-store, timer-scheduler, recovery logic
- `f311f03` Story 2.2: DJ state persistence — persistDjState() fire-and-forget, processDjTransition() side effect handling
- `59f6c88` Story 2.1: DJ engine state machine — pure function architecture, side effects as data, DJState enum, HOST_SKIP/HOST_OVERRIDE/END_PARTY transitions defined
- Pattern: all stories use `vi.mock()` for external deps, test factories, `vi.clearAllMocks()` in beforeEach
- Flutter tests: extend existing files, use `_wrapWithProviders()` helpers, `ChangeNotifier` testing patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Added `removeParticipant()` to session-repository, updated `updateStatus()` to set `ended_at` when status='ended', added 3 event constants (HOST_END_PARTY, HOST_KICK_PLAYER, PARTY_PARTICIPANT_REMOVED), implemented `endSession()` and `kickPlayer()` in session-manager with full in-memory cleanup. 3 unit tests added.
- Task 2: Created `host-handlers.ts` with `registerHostHandlers(socket, io)` — 5 handlers (skip, override, songOver, endParty, kickPlayer) all with DB-based host validation. Registered in connection-handler. 8 unit tests added.
- Task 3: Created `HostControlsOverlay` StatefulWidget — expandable FAB with 6 control buttons (Invite, Skip, Override Next, Pause (disabled), Kick Player, End Party). Uses vibe accent colors, 48x48px min tap targets. Barrier dismiss + FAB toggle. All strings in copy.dart.
- Task 4: Created `SongOverButton` reusing `DjTapButton` with `TapTier.consequential` (500ms hold-to-confirm). Styled with `actionDanger` color, bottom-center positioning.
- Task 5: Replaced `FloatingActionButton` in PartyScreen with `HostControlsOverlay` (active states only) and `SongOverButton` (song state only, host only). Added `context.go('/')` navigation on session end via provider state watch. Overlay placed last in Stack for z-ordering.
- Task 6: Added 5 host action emitter methods to SocketClient. Added `party:ended` and `party:participantRemoved` listeners. Added `onSessionEnded()`, `onKicked()`, `onParticipantRemoved()` to PartyProvider. Navigation triggered by provider state change, not from SocketClient.
- Task 7: Extended party_provider_test.dart (+4 tests), party_screen_test.dart (+5 new, replaced 2 old FAB tests), created host-handlers.test.ts (8 tests), extended session-manager-dj.test.ts (+3 tests). All 319 server tests and all Flutter tests pass with 0 regressions.

### Change Log

- 2026-03-11: Implemented Story 2.5 — Host Controls Overlay with all 7 tasks complete
- 2026-03-11: Code review fixes — Created missing test files (host_controls_overlay_test, song_over_button_test), extended client_test.dart with host tests, fixed kick player picker using sessionId instead of userId (H1), fixed kickPlayer persisting raw DJContext instead of serialized (H2), added error logging to host handlers (H3), added host validation to endSession (H4), fixed _ControlButton to use super.key (M1), added Tooltip with hostSongOverHint to SongOverButton (M2), removed redundant isHost check in kick filter (M3)

### File List

**New files:**
- `apps/server/src/socket-handlers/host-handlers.ts`
- `apps/server/tests/socket-handlers/host-handlers.test.ts`
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart`
- `apps/flutter_app/lib/widgets/song_over_button.dart`
- `apps/flutter_app/test/widgets/host_controls_overlay_test.dart`
- `apps/flutter_app/test/widgets/song_over_button_test.dart`

**Modified files:**
- `apps/server/src/shared/events.ts` — added HOST_END_PARTY, HOST_KICK_PLAYER, PARTY_PARTICIPANT_REMOVED
- `apps/server/src/persistence/session-repository.ts` — added removeParticipant(), updated updateStatus() for ended_at
- `apps/server/src/services/session-manager.ts` — added endSession(), kickPlayer(), imported removeSessionDjState + removeSession
- `apps/server/src/socket-handlers/connection-handler.ts` — registered host handlers
- `apps/server/tests/services/session-manager-dj.test.ts` — added endSession + kickPlayer tests
- `apps/flutter_app/lib/screens/party_screen.dart` — replaced FAB with overlay + song over button, added session-end navigation
- `apps/flutter_app/lib/socket/client.dart` — added 5 host emitters + party:ended/participantRemoved listeners
- `apps/flutter_app/lib/constants/copy.dart` — added host control + song over strings
- `apps/flutter_app/lib/state/party_provider.dart` — added onSessionEnded, onKicked, onParticipantRemoved, kickedMessage
- `apps/flutter_app/test/state/party_provider_test.dart` — added 4 new tests
- `apps/flutter_app/test/socket/client_test.dart` — added 9 host emitter, event listener, and currentUserId tests
- `apps/flutter_app/test/screens/party_screen_test.dart` — replaced 2 FAB tests, added 5 host controls/song over tests

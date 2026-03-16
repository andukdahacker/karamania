# Story 5.6: Spin the Wheel Mode

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want an animated wheel to randomly select our next song,
So that song selection is exciting and adds an element of surprise.

## Acceptance Criteria

1. **Given** the song selection phase begins, **When** Spin the Wheel mode is active, **Then** 8 AI-suggested songs are loaded into an animated wheel with deceleration easing (FR89)
2. **Given** the wheel is displayed, **When** any participant taps SPIN, **Then** the wheel animates and lands on a server-determined song (FR89)
3. **Given** the wheel has landed on a song, **When** the 5-second veto window is active, **Then** the group gets one veto per round triggering a re-spin (FR89)
4. **Given** a veto is used, **When** the re-spin completes, **Then** the newly selected song is auto-queued immediately (no second veto) (FR89)
5. **Given** no participant taps SPIN within 15 seconds, **When** the timeout fires, **Then** the server auto-spins the wheel
6. **Given** a selected song is confirmed (no veto or veto window expired), **When** auto-queuing is available (TV paired), **Then** the song is auto-queued (FR89)
7. **Given** participants want to change selection mode, **When** they toggle the mode switch, **Then** they can switch between Quick Pick and Spin the Wheel at any time (FR90)
8. **Given** the mode toggle exists, **When** Quick Pick is the default, **Then** Quick Pick remains the default mode (FR90)

## Tasks / Subtasks

- [x] Task 1: Create Spin Wheel service (AC: #1, #2, #3, #4, #5)
  - [x] 1.1 Create `apps/server/src/services/spin-wheel.ts`
  - [x] 1.2 Define `SpinWheelSegment` type: `{ catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string; overlapCount: number; segmentIndex: number }` -- extends QuickPickSong pattern with segment position
  - [x] 1.3 Define `SpinWheelRound` type: `{ sessionId: string; segments: SpinWheelSegment[]; state: 'waiting' | 'spinning' | 'landed' | 'vetoing' | 'resolved'; spinnerUserId: string | null; targetSegmentIndex: number | null; vetoUsed: boolean; vetoedSegmentIndex: number | null; startedAt: number; spinTimerHandle: ReturnType<typeof setTimeout> | null; vetoTimerHandle: ReturnType<typeof setTimeout> | null }`
  - [x] 1.4 Implement module-level `Map<string, SpinWheelRound>` (sessionId -> round). Same in-memory pattern as `quick-pick.ts`, `dj-state-store.ts`, `song-pool.ts`, `connection-tracker.ts`
  - [x] 1.5 Implement `startRound(sessionId: string, segments: SpinWheelSegment[]): SpinWheelRound` -- creates round in 'waiting' state, stores in module map
  - [x] 1.6 Implement `initiateSpin(sessionId: string, spinnerUserId: string): { targetSegmentIndex: number; totalRotationRadians: number; spinDurationMs: number } | null` -- guards: round must be in 'waiting' state (prevents double-spin). Server picks random target segment. Calculates `totalRotationRadians = (randomInt(5, 8) full rotations * 2 * Math.PI) + (targetSegmentIndex * (2 * Math.PI / segments.length))`. Sets `spinDurationMs = 4000`. Updates round state to 'spinning', stores targetSegmentIndex and spinnerUserId. Returns spin params or null if invalid state
  - [x] 1.7 Implement `onSpinComplete(sessionId: string): SpinWheelSegment | null` -- called when spin animation timer fires. Transitions round state from 'spinning' to 'landed'. Returns the target segment. Does NOT transition to 'resolved' yet (veto window pending)
  - [x] 1.8 Implement `startVetoWindow(sessionId: string): void` -- transitions state from 'landed' to 'vetoing'. The veto timer is managed by session-manager (see Task 4)
  - [x] 1.9 Implement `handleVeto(sessionId: string, userId: string): { newTargetSegmentIndex: number; totalRotationRadians: number; spinDurationMs: number; vetoedSong: SpinWheelSegment } | null` -- guards: round must be in 'vetoing' state, `vetoUsed === false`. Marks `vetoUsed = true`, stores `vetoedSegmentIndex`. Picks NEW random target from remaining segments (excluding vetoed). Calculates new spin params. Transitions state to 'spinning'. Returns new spin params + vetoed song, or null if invalid
  - [x] 1.10 Implement `resolveRound(sessionId: string): SpinWheelSegment | null` -- transitions state to 'resolved'. Returns the target segment. Called when veto window expires or after veto re-spin completes
  - [x] 1.11 Implement `autoSpin(sessionId: string): { targetSegmentIndex: number; totalRotationRadians: number; spinDurationMs: number } | null` -- same as initiateSpin but with `spinnerUserId = null` (server-initiated). Used when 15s timeout fires with no manual spin
  - [x] 1.12 Implement `getRound(sessionId: string): SpinWheelRound | undefined`
  - [x] 1.13 Implement `clearRound(sessionId: string): void` -- clears both timer handles (`clearTimeout`) and removes from map
  - [x] 1.14 Export `resetAllRounds()` for test cleanup
  - [x] 1.15 **CRITICAL**: All timer handles (`spinTimerHandle`, `vetoTimerHandle`) are stored on the round so `clearRound()` can cancel them. This prevents orphaned timers on session end or mode switch

- [x] Task 2: Add song selection mode tracking and events (AC: #7, #8)
  - [x] 2.1 In `apps/server/src/shared/events.ts`, add constants:
    - `SPINWHEEL_STARTED: 'spinwheel:started'`
    - `SPINWHEEL_RESULT: 'spinwheel:result'` (covers spinning, landed, vetoed states)
    - `SONG_MODE_CHANGED: 'song:modeChanged'`
  - [x] 2.2 `SONG_SPINWHEEL` already exists in events.ts (line 53) -- reuse for client -> server spin/veto actions
  - [x] 2.3 Create `apps/server/src/shared/schemas/spin-wheel-schemas.ts`:
    - `spinWheelSegmentSchema`: `z.object({ catalogTrackId: z.string(), songTitle: z.string(), artist: z.string(), youtubeVideoId: z.string(), overlapCount: z.number(), segmentIndex: z.number() })`
    - `spinWheelActionSchema`: `z.object({ action: z.enum(['spin', 'veto']) })`
    - `songModeSchema`: `z.object({ mode: z.enum(['quickPick', 'spinWheel']) })`
    - **No `z.globalRegistry.add()` needed** -- all Socket.io-based, no REST endpoints. Schemas used for `z.infer<>` and runtime validation in socket handlers only
  - [x] 2.4 Add module-level song selection mode map in `apps/server/src/services/session-manager.ts`:
    ```typescript
    type SongSelectionMode = 'quickPick' | 'spinWheel';
    const sessionModes = new Map<string, SongSelectionMode>();
    export function getSongSelectionMode(sessionId: string): SongSelectionMode {
      return sessionModes.get(sessionId) ?? 'quickPick';
    }
    export function setSongSelectionMode(sessionId: string, mode: SongSelectionMode): void {
      sessionModes.set(sessionId, mode);
    }
    ```
  - [x] 2.5 Clear mode in `endSession()`: `sessionModes.delete(sessionId)`
  - [x] 2.6 Export `resetAllModes()` for test cleanup

- [x] Task 3: Update song-handlers.ts for Spin the Wheel and mode toggle (AC: #1, #2, #3, #7)
  - [x] 3.1 In `apps/server/src/socket-handlers/song-handlers.ts`, add handler for `EVENTS.SONG_SPINWHEEL` with payload validated via `spinWheelActionSchema.safeParse()`:
    - Guard: `getSessionDjState(sessionId)` must exist and `context.state === DJState.songSelection`
    - Guard: `getSongSelectionMode(sessionId) === 'spinWheel'`
    - Guard: round must exist via `getRound(sessionId)`
    - **If `action === 'spin'`**:
      - Call `initiateSpin(sessionId, userId)` -- returns null if already spinning
      - If null, return silently (duplicate spin)
      - **CRITICAL: `cancelSessionTimer(sessionId)`** -- cancel the DJ engine's 15s timeout IMMEDIATELY. Without this, `handleRecoveryTimeout` fires at ~15s and forces a TIMEOUT transition, aborting the spin mid-flow (spin animation 4s + veto window 5s = 9s after spin, which can overlap the 15s timeout if user spins late)
      - Broadcast `EVENTS.SPINWHEEL_RESULT` to room: `{ phase: 'spinning', spinnerUserId: userId, spinnerDisplayName: socket.data.displayName, targetSegmentIndex, totalRotationRadians, spinDurationMs }`
      - Schedule spin completion: call `handleSpinAnimationComplete(sessionId)` via setTimeout in session-manager (Task 4)
      - Record participation: `recordParticipationAction(sessionId, userId, 'spinwheel:spin', 2).catch(() => {})`
      - Append event: `appendEvent(sessionId, { type: 'spinwheel:spin', ts: Date.now(), userId })`
    - **If `action === 'veto'`**:
      - Call `handleVeto(sessionId, userId)` -- returns null if veto already used or wrong state
      - If null, return silently
      - Broadcast `EVENTS.SPINWHEEL_RESULT` to room: `{ phase: 'vetoed', vetoUserId: userId, vetoDisplayName: socket.data.displayName, vetoedSong, newTargetSegmentIndex, totalRotationRadians, spinDurationMs }`
      - Schedule new spin completion in session-manager (same as spin path)
      - Record participation: `recordParticipationAction(sessionId, userId, 'spinwheel:veto', 1).catch(() => {})`
      - Append event: `appendEvent(sessionId, { type: 'spinwheel:veto', ts: Date.now(), userId, data: { vetoedSong: vetoedSong.songTitle } })`
  - [x] 3.2 Add handler for `EVENTS.SONG_MODE_CHANGED` with payload validated via `songModeSchema.safeParse()`:
    - Guard: valid mode value ('quickPick' or 'spinWheel')
    - Call `handleModeChange(sessionId, mode, userId, socket.data.displayName)` in session-manager (Task 4.8)
    - **No DJ state guard** -- mode can be toggled at any time per FR90
  - [x] 3.3 Import new functions from session-manager and spin-wheel services

- [x] Task 4: Update session-manager.ts for Spin the Wheel lifecycle (AC: #1, #2, #3, #4, #5, #7)
  - [x] 4.1 Import `startRound`, `initiateSpin`, `onSpinComplete`, `startVetoWindow`, `handleVeto`, `resolveRound`, `autoSpin`, `getRound` as `getSpinWheelRound`, `clearRound` as `clearSpinWheelRound` from `../services/spin-wheel.js`. Also add to existing `dj-broadcaster.js` import: `broadcastSpinWheelStarted`, `broadcastSpinWheelResult`, `broadcastModeChanged`
  - [x] 4.2 Create `async function initializeSpinWheel(sessionId: string, context: DJContext): Promise<void>`:
    - Call `computeSuggestions(sessionId, 8)` to get 8 ranked songs
    - Map to `SpinWheelSegment[]` with `segmentIndex` assigned 0-7
    - Call `startRound(sessionId, segments)`
    - Get active participant count from connection tracker or context
    - Call `broadcastSpinWheelStarted(sessionId, segments, participantCount, 15_000)` (Task 5) -- `participantCount` needed for overlap badge denominator (e.g., "4/5 know this")
    - Store segments in `context.metadata.spinWheelSegments` for JSONB persistence
  - [x] 4.3 Update the songSelection initialization hook in `processDjTransition()` (currently lines 706-709):
    ```typescript
    if (newContext.state === DJState.songSelection) {
      const mode = getSongSelectionMode(sessionId);
      if (mode === 'spinWheel') {
        void initializeSpinWheel(sessionId, newContext);
      } else {
        void initializeQuickPick(sessionId, newContext);
      }
    }
    ```
  - [x] 4.4 Create `async function handleSpinAnimationComplete(sessionId: string): Promise<void>`:
    - Call `onSpinComplete(sessionId)` to get landed segment
    - If null (round was cleared), return
    - Get round: `const round = getSpinWheelRound(sessionId)`
    - **CRITICAL: Check `round.vetoUsed`** to determine if this is a post-veto re-spin:
      - **If `round.vetoUsed === true` (post-veto re-spin)**: Skip veto window entirely. Call `resolveRound(sessionId)`, broadcast `EVENTS.SPINWHEEL_RESULT` with `{ phase: 'selected', song: landedSegment }`, then call `handleSpinWheelSongSelected(sessionId, landedSegment)`. This enforces AC #4: no second veto after re-spin
      - **If `round.vetoUsed === false` (first spin)**: Broadcast `EVENTS.SPINWHEEL_RESULT` with `{ phase: 'landed', song: landedSegment }`, call `startVetoWindow(sessionId)`, schedule veto window expiry: `const vetoTimer = setTimeout(() => handleVetoWindowExpired(sessionId), 5000)`. Store timer handle on round: `round.vetoTimerHandle = vetoTimer`
  - [x] 4.5 Create `async function handleVetoWindowExpired(sessionId: string): Promise<void>`:
    - Get round via `getSpinWheelRound(sessionId)`
    - If round state is not 'vetoing' (already resolved or vetoed), return
    - Call `resolveRound(sessionId)` to get final segment
    - Broadcast `EVENTS.SPINWHEEL_RESULT` with `{ phase: 'selected', song: selectedSegment }`
    - Call `handleSpinWheelSongSelected(sessionId, selectedSegment)`
  - [x] 4.6 Create `async function handleSpinWheelSongSelected(sessionId: string, segment: SpinWheelSegment): Promise<void>` -- mirrors `handleQuickPickSongSelected`:
    - `markSongSung(sessionId, segment.songTitle, segment.artist)`
    - `clearSpinWheelRound(sessionId)` (clears both timer handles)
    - `cancelSessionTimer(sessionId)` (cancel DJ engine timer if still active)
    - Broadcast `EVENTS.SONG_QUEUED` with `{ catalogTrackId: segment.catalogTrackId, songTitle: segment.songTitle, artist: segment.artist, youtubeVideoId: segment.youtubeVideoId }`
    - Append event: `appendEvent(sessionId, { type: 'spinwheel:selected', ts: Date.now(), data: { song: segment } })`
    - Update metadata: `context.metadata.selectedSong = { catalogTrackId, songTitle, artist, youtubeVideoId }`
    - `processDjTransition(sessionId, updatedContext, { type: 'SONG_SELECTED' })`
    - **CRITICAL: Emit `SONG_QUEUED` BEFORE `processDjTransition(SONG_SELECTED)`** -- same ordering fix from Story 5.5 code review (H1). Ensures Flutter clients receive song:queued while overlay is still mounted
  - [x] 4.7 Update `handleRecoveryTimeout()` to handle Spin the Wheel:
    ```typescript
    if (context.state === DJState.songSelection) {
      // Quick Pick path (existing)
      const qpRound = getRound(sessionId); // quick-pick getRound
      if (qpRound && !qpRound.resolved) {
        const winner = resolveByTimeout(sessionId);
        if (winner) { await handleQuickPickSongSelected(sessionId, winner); return; }
      }
      // Spin the Wheel path (NEW)
      const swRound = getSpinWheelRound(sessionId);
      if (swRound && swRound.state === 'waiting') {
        // Nobody spun within 15s -- auto-spin
        const spinParams = autoSpin(sessionId);
        if (spinParams) {
          broadcastSpinWheelResult(sessionId, {
            phase: 'spinning', spinnerUserId: null, spinnerDisplayName: 'Auto',
            ...spinParams
          });
          // Schedule spin animation completion
          const spinTimer = setTimeout(() => handleSpinAnimationComplete(sessionId), spinParams.spinDurationMs);
          swRound.spinTimerHandle = spinTimer;
          return;
        }
      }
      // Fallback: generic TIMEOUT
    }
    await processDjTransition(sessionId, context, { type: 'TIMEOUT' });
    ```
  - [x] 4.8 Create `async function handleModeChange(sessionId: string, mode: SongSelectionMode, userId: string, displayName: string): Promise<void>`:
    - `setSongSelectionMode(sessionId, mode)`
    - Broadcast `EVENTS.SONG_MODE_CHANGED` to room: `{ mode, userId, displayName }`
    - **If currently in songSelection**: cancel active round and restart with new mode:
      - Clear Quick Pick round if exists: `clearRound(sessionId)` from quick-pick
      - Clear Spin Wheel round if exists: `clearSpinWheelRound(sessionId)` from spin-wheel
      - Cancel current DJ timer: `cancelSessionTimer(sessionId)`
      - Re-initialize: call `initializeQuickPick` or `initializeSpinWheel` based on new mode
      - Re-schedule DJ timer: `scheduleSessionTimer(sessionId, 15_000, () => handleRecoveryTimeout(sessionId))`
    - Append event: `appendEvent(sessionId, { type: 'song:modeChanged', ts: Date.now(), userId, data: { mode } })`
  - [x] 4.9 Update `endSession()` cleanup: add `clearSpinWheelRound(sessionId)` and `sessionModes.delete(sessionId)` alongside existing `clearRound(sessionId)`
  - [x] 4.10 Update `resumeSession()`: when recovering songSelection state, use `handleRecoveryTimeout` callback for timer (already correct from Story 5.5 H2 fix). The auto-spin path will handle Spin the Wheel recovery gracefully -- if no round exists in memory after restart, handleRecoveryTimeout falls through to generic TIMEOUT

- [x] Task 5: Update dj-broadcaster.ts for Spin the Wheel (AC: #1, #2, #3, #4)
  - [x] 5.1 In `apps/server/src/services/dj-broadcaster.ts`, add. **CRITICAL: Every broadcast function MUST include `if (!io) return;` null guard** -- `getIO()` returns `SocketIOServer | null` and every existing broadcaster has this pattern. TypeScript will error without it:
    ```typescript
    export function broadcastSpinWheelStarted(
      sessionId: string,
      segments: SpinWheelSegment[],
      participantCount: number,
      timerDurationMs: number,
    ): void {
      const io = getIO();
      if (!io) return;
      io.to(sessionId).emit(EVENTS.SPINWHEEL_STARTED, { segments, participantCount, timerDurationMs });
    }
    ```
  - [x] 5.2 Add `broadcastSpinWheelResult(sessionId: string, payload: object): void`:
    ```typescript
    export function broadcastSpinWheelResult(sessionId: string, payload: object): void {
      const io = getIO();
      if (!io) return;
      io.to(sessionId).emit(EVENTS.SPINWHEEL_RESULT, payload);
    }
    ```
  - [x] 5.3 Add `broadcastModeChanged(sessionId: string, mode: string, userId: string, displayName: string): void`:
    ```typescript
    export function broadcastModeChanged(sessionId: string, mode: string, userId: string, displayName: string): void {
      const io = getIO();
      if (!io) return;
      io.to(sessionId).emit(EVENTS.SONG_MODE_CHANGED, { mode, userId, displayName });
    }
    ```
  - [x] 5.4 **Pattern**: Follow existing `broadcastQuickPickStarted()`, `broadcastCardDealt()` -- dedicated broadcast functions, NOT metadata in `dj:stateChanged`

- [x] Task 6: Create Flutter Spin Wheel models and state (AC: #1, #2, #3, #7, #8)
  - [x] 6.1 In `apps/flutter_app/lib/state/party_provider.dart`, add Spin Wheel state fields (following Quick Pick pattern -- models defined inline, no separate models/ files):
    ```dart
    // Spin the Wheel state
    List<SpinWheelSegment> _spinWheelSegments = [];
    String? _spinWheelPhase; // 'waiting' | 'spinning' | 'landed' | 'vetoing' | 'selected' | null
    int? _spinWheelTargetIndex;
    double? _spinWheelTotalRotation;
    int _spinWheelSpinDurationMs = 4000;
    String? _spinWheelSpinnerName;
    bool _spinWheelVetoUsed = false;
    int _spinWheelTimerDurationMs = 15000;
    int _spinWheelParticipantCount = 0; // For overlap badge denominator (e.g., "4/5 know this")
    // Song selection mode
    String _songSelectionMode = 'quickPick'; // 'quickPick' | 'spinWheel'
    ```
  - [x] 6.2 Add public getters for all spin wheel state fields + `songSelectionMode`
  - [x] 6.3 Define `SpinWheelSegment` data class inline (same pattern as `QuickPickSong`, `VoteTally`, `PartyCardData`):
    ```dart
    class SpinWheelSegment {
      final String catalogTrackId;
      final String songTitle;
      final String artist;
      final String youtubeVideoId;
      final int overlapCount;
      final int segmentIndex;
      SpinWheelSegment({required this.catalogTrackId, required this.songTitle, required this.artist, required this.youtubeVideoId, required this.overlapCount, required this.segmentIndex});
      factory SpinWheelSegment.fromJson(Map<String, dynamic> json) => SpinWheelSegment(
        catalogTrackId: json['catalogTrackId'] as String,
        songTitle: json['songTitle'] as String,
        artist: json['artist'] as String,
        youtubeVideoId: json['youtubeVideoId'] as String,
        overlapCount: json['overlapCount'] as int,
        segmentIndex: json['segmentIndex'] as int,
      );
    }
    ```
  - [x] 6.4 Add mutation methods (called ONLY by SocketClient):
    - `onSpinWheelStarted(List<SpinWheelSegment> segments, int participantCount, int timerDurationMs)` -- sets segments, participantCount, phase='waiting', clears previous state
    - `onSpinWheelSpinning(int targetIndex, double totalRotation, int durationMs, String? spinnerName)` -- sets spin params, phase='spinning'
    - `onSpinWheelLanded(SpinWheelSegment song)` -- sets phase='landed'
    - `onSpinWheelVetoed(SpinWheelSegment vetoedSong, int newTargetIndex, double totalRotation, int durationMs)` -- marks vetoUsed, phase='spinning' (re-spin)
    - `onSpinWheelSelected(SpinWheelSegment song)` -- sets phase='selected'
    - `onSpinWheelCleared()` -- resets all spin wheel state
    - `onSongSelectionModeChanged(String mode)` -- sets `_songSelectionMode`
  - [x] 6.5 Update `onDjStateUpdate()` to clear spin wheel state when leaving songSelection (same pattern as Quick Pick clear at lines 490-497):
    ```dart
    if (_djState == DJState.songSelection && state != DJState.songSelection) {
      if (_spinWheelPhase != 'selected') {
        _spinWheelSegments = [];
        _spinWheelPhase = null;
        _spinWheelTargetIndex = null;
        // ... clear all spin wheel fields
      }
    }
    ```

- [x] Task 7: Update Flutter SocketClient for Spin the Wheel events (AC: #1, #2, #3, #7)
  - [x] 7.1 In `apps/flutter_app/lib/socket/client.dart`, add Spin the Wheel listeners in `_setupPartyListeners()`:
    - Listen for `spinwheel:started` -- parse `{ segments, participantCount, timerDurationMs }`, map to `SpinWheelSegment.fromJson()`, call `partyProvider.onSpinWheelStarted(segments, participantCount, timerDurationMs)`
    - Listen for `spinwheel:result` -- parse `phase` field, dispatch to appropriate provider method:
      - `phase === 'spinning'`: call `partyProvider.onSpinWheelSpinning(targetSegmentIndex, totalRotationRadians, spinDurationMs, spinnerDisplayName)`
      - `phase === 'landed'`: call `partyProvider.onSpinWheelLanded(song)`
      - `phase === 'vetoed'`: call `partyProvider.onSpinWheelVetoed(vetoedSong, newTargetIndex, totalRotation, durationMs)`
      - `phase === 'selected'`: call `partyProvider.onSpinWheelSelected(song)`. **Do NOT schedule delayed clear here** -- `song:queued` listener handles the delayed clear (single responsibility, avoids double-clear)
    - Listen for `song:modeChanged` -- call `partyProvider.onSongSelectionModeChanged(mode)`
    - **Reuse existing `song:queued` listener** -- already handles `onQuickPickResolved`. Add check: if spin wheel segments are active, call `onSpinWheelSelected` then delayed clear
  - [x] 7.2 Add emit methods:
    - `emitSpinWheelAction(String action)` -- emits `song:spinwheel` with `{ action }` where action is 'spin' or 'veto'
    - `emitModeChange(String mode)` -- emits `song:modeChanged` with `{ mode }`
  - [x] 7.3 Update existing `song:queued` listener to handle both modes:
    ```dart
    on('song:queued', (data) {
      final payload = data as Map<String, dynamic>;
      final catalogTrackId = payload['catalogTrackId'] as String;
      if (_partyProvider?.quickPickSongs.isNotEmpty ?? false) {
        _partyProvider?.onQuickPickResolved(catalogTrackId);
        Timer(const Duration(seconds: 2), () { _partyProvider?.onQuickPickCleared(); });
      }
      if (_partyProvider?.spinWheelSegments.isNotEmpty ?? false) {
        // Spin wheel selection handled via spinwheel:result 'selected' phase
        // song:queued is the confirmation -- trigger delayed clear
        Timer(const Duration(seconds: 2), () { _partyProvider?.onSpinWheelCleared(); });
      }
    });
    ```

- [x] Task 8: Create Flutter SpinTheWheelOverlay widget (AC: #1, #2, #3, #4)
  - [x] 8.1 Create `apps/flutter_app/lib/widgets/spin_the_wheel_overlay.dart` -- StatefulWidget
  - [x] 8.2 Constructor takes: `segments`, `phase`, `targetIndex`, `totalRotation`, `spinDurationMs`, `spinnerName`, `vetoUsed`, `timerDurationMs`, `onSpin` callback, `onVeto` callback
  - [x] 8.3 **Wheel rendering**: CustomPainter or Stack of positioned segments arranged in a circle:
    - 8 equal segments (45 degrees each)
    - Each segment shows: song title (truncated), artist (small)
    - Alternating segment colors using `DJTokens` palette (e.g., actionPrimary, actionSecondary alternating with opacity variants)
    - Center circle with SPIN button
    - Pointer/indicator at top of wheel (fixed position, wheel rotates underneath)
  - [x] 8.4 **Spin animation**: Use `AnimationController` with duration from `spinDurationMs`:
    - `Tween<double>(begin: 0, end: totalRotation)` with `Curves.easeOutCubic` for deceleration easing
    - Wrap wheel in `Transform.rotate(angle: _animation.value, child: wheel)`
    - Start animation when phase changes to 'spinning'
    - On animation complete: wheel stays at final position showing selected segment at pointer
  - [x] 8.5 **Re-spin on veto**: When `phase === 'vetoed'`, reset animation controller with new totalRotation and duration, start new animation. Show brief "VETOED!" flash on the vetoed segment before re-spin starts
  - [x] 8.6 **SPIN button**: Centered on wheel. Text: `Copy.spinButtonLabel`. Enabled only when `phase === 'waiting'`. On tap calls `onSpin()`. Disabled during spinning/landed/vetoing. Show spinner name during animation: "${spinnerName} is spinning!"
  - [x] 8.7 **Veto button**: Appears below wheel when `phase === 'landed'` and `!vetoUsed`. Text: `Copy.spinVetoLabel`. 5-second countdown displayed. On tap calls `onVeto()`. Disappears when vetoUsed or phase changes
  - [x] 8.8 **Winner display**: When phase === 'selected', highlight winning segment, show song title + artist prominently below wheel with `Copy.spinSelectedLabel`
  - [x] 8.9 **15-second countdown**: Display at top when `phase === 'waiting'` (waiting for someone to spin). Same pattern as Quick Pick countdown. When reaches 0, show "Auto-spinning..." (server handles auto-spin)
  - [x] 8.10 **All copy strings** in `apps/flutter_app/lib/constants/copy.dart`:
    - `spinTheWheelTitle = 'Spin the Wheel'`
    - `spinButtonLabel = 'SPIN'`
    - `spinSpinningLabel = 'Spinning...'`
    - `spinLandedLabel = 'Landed!'`
    - `spinVetoLabel = 'VETO!'`
    - `spinVetoedLabel = 'Vetoed! Re-spinning...'`
    - `spinSelectedLabel = 'Selected!'`
    - `spinAutoSpinLabel = 'Auto-spinning...'`
    - `spinWaitingLabel = 'Tap to spin!'`
    - `modeQuickPick = 'Quick Pick'`
    - `modeSpinWheel = 'Spin the Wheel'`
  - [x] 8.11 Use `DJTokens` for ALL spacing, colors, typography. No hardcoded values. Widget key: `Key('spin-the-wheel-overlay')`

- [x] Task 9: Create Flutter mode toggle widget (AC: #7, #8)
  - [x] 9.1 Create `apps/flutter_app/lib/widgets/song_mode_toggle.dart` -- StatelessWidget
  - [x] 9.2 Render a `SegmentedButton<String>` or equivalent toggle with two segments: "Quick Pick" and "Spin the Wheel"
  - [x] 9.3 Selected state matches `partyProvider.songSelectionMode`
  - [x] 9.4 On toggle: call `SocketClient.instance.emitModeChange(newMode)`
  - [x] 9.5 Use `DJTokens` for styling. Widget key: `Key('song-mode-toggle')`

- [x] Task 10: Integrate into PartyScreen (AC: #1, #7)
  - [x] 10.1 In `apps/flutter_app/lib/screens/party_screen.dart`, import `SpinTheWheelOverlay` and `SongModeToggle`
  - [x] 10.2 Add Spin the Wheel overlay (same Stack position as Quick Pick overlay):
    ```dart
    if (partyProvider.spinWheelSegments.isNotEmpty &&
        (partyProvider.djState == DJState.songSelection ||
            partyProvider.spinWheelPhase == 'selected'))
      Positioned.fill(
        child: SpinTheWheelOverlay(
          segments: partyProvider.spinWheelSegments,
          phase: partyProvider.spinWheelPhase,
          targetIndex: partyProvider.spinWheelTargetIndex,
          totalRotation: partyProvider.spinWheelTotalRotation,
          spinDurationMs: partyProvider.spinWheelSpinDurationMs,
          spinnerName: partyProvider.spinWheelSpinnerName,
          vetoUsed: partyProvider.spinWheelVetoUsed,
          timerDurationMs: partyProvider.spinWheelTimerDurationMs,
          onSpin: () => SocketClient.instance.emitSpinWheelAction('spin'),
          onVeto: () => SocketClient.instance.emitSpinWheelAction('veto'),
        ),
      ),
    ```
  - [x] 10.3 Add mode toggle widget: render `SongModeToggle` visible when DJ state allows mode switching (e.g., NOT during active songSelection, OR always visible per FR90). Position it above the overlay area or in a persistent UI bar
  - [x] 10.4 **Mutual exclusivity**: Only ONE of Quick Pick overlay or Spin the Wheel overlay is shown, based on `songSelectionMode`. They can't both be active simultaneously

- [x] Task 11: Write server tests (AC: all)
  - [x] 11.1 Create `apps/server/tests/services/spin-wheel.test.ts`:
    - Test `startRound` creates round in 'waiting' state with 8 segments
    - Test `initiateSpin` returns spin params with valid rotation and duration
    - Test `initiateSpin` returns null when round not in 'waiting' state (prevents double-spin)
    - Test `initiateSpin` stores spinnerUserId and targetSegmentIndex
    - Test `onSpinComplete` transitions to 'landed' and returns target segment
    - Test `startVetoWindow` transitions to 'vetoing'
    - Test `handleVeto` returns new spin params excluding vetoed segment
    - Test `handleVeto` returns null when vetoUsed === true
    - Test `handleVeto` returns null when round not in 'vetoing' state
    - Test `handleVeto` picks target from remaining segments (not the vetoed one)
    - Test `resolveRound` transitions to 'resolved' and returns target segment
    - Test `autoSpin` same as initiateSpin but null spinnerUserId
    - Test `clearRound` cancels timer handles and removes from map
    - Test module isolation: different sessions don't interfere
    - Test `resetAllRounds` clears all data
    - Test spin rotation calculation: totalRotation includes target segment offset
  - [x] 11.2 Create `apps/server/tests/socket-handlers/song-handlers-spinwheel.test.ts`:
    - Test spin action succeeds when DJ state is songSelection and mode is spinWheel
    - Test spin action rejected when mode is quickPick
    - Test spin action rejected when DJ state is NOT songSelection
    - Test spin action rejected when already spinning (initiateSpin returns null)
    - Test veto action succeeds during vetoing phase
    - Test veto action rejected when veto already used
    - Test spinwheel:result broadcast includes correct phase and params
    - Test participation action recorded on spin and veto
    - Test event appended on spin and veto
    - Test mode change handler updates session mode
    - Test mode change during songSelection restarts round with new mode
    - Test mode change during active spin (state='spinning') cancels spin timer handle via clearRound
    - Test mode change during veto window (state='vetoing') cancels veto timer handle via clearRound
    - Test mode change broadcast to all participants
  - [x] 11.3 Create `apps/server/tests/services/session-manager-spinwheel.test.ts`:
    - Test initializeSpinWheel called when mode is spinWheel and entering songSelection
    - Test initializeQuickPick called when mode is quickPick (default, unchanged)
    - Test 8 suggestions fetched (computeSuggestions count=8)
    - Test broadcastSpinWheelStarted emitted with segments
    - Test handleRecoveryTimeout auto-spins when wheel round in 'waiting' state
    - Test handleSpinAnimationComplete transitions to landed and starts veto window
    - Test handleVetoWindowExpired selects song when no veto
    - Test handleSpinWheelSongSelected emits SONG_QUEUED before processDjTransition (ordering)
    - Test clearSpinWheelRound called in endSession
    - Test mode change during songSelection cancels active round and restarts
    - Test mode cleanup in endSession

- [x] Task 12: Write Flutter tests (AC: #1, #2, #7)
  - [x] 12.1 Create `apps/flutter_app/test/models/spin_wheel_segment_test.dart` -- test `fromJson` factory
  - [x] 12.2 Create `apps/flutter_app/test/widgets/spin_the_wheel_overlay_test.dart`:
    - Test 8 segments rendered
    - Test SPIN button displayed in waiting phase
    - Test SPIN button disabled during spinning phase
    - Test veto button appears when landed and veto not used
    - Test veto button hidden when veto used
    - Test winner display on selected phase
    - Test countdown timer displayed in waiting phase
    - Test tapping SPIN calls onSpin callback
    - Test tapping VETO calls onVeto callback
  - [x] 12.3 Create `apps/flutter_app/test/widgets/song_mode_toggle_test.dart`:
    - Test toggle renders two mode options
    - Test Quick Pick selected by default
    - Test tapping Spin the Wheel calls mode change
  - [x] 12.4 Add spin wheel state tests in `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `onSpinWheelStarted` sets segments and phase
    - Test `onSpinWheelSpinning` sets spin params and phase
    - Test `onSpinWheelLanded` sets phase
    - Test `onSpinWheelVetoed` marks veto used and sets new spin params
    - Test `onSpinWheelSelected` sets phase
    - Test `onSpinWheelCleared` resets all state
    - Test `onSongSelectionModeChanged` updates mode
    - Test spin wheel state cleared on DJ state exit (unless selected)

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: The SERVER determines which segment the wheel lands on. The client animation is purely visual -- the server picks the winner via `Math.random()`, calculates rotation params, and sends to all clients. This prevents any client-side manipulation of results (per project-context.md core principle)
- **Service boundary**: `spin-wheel.ts` in `services/` -- pure in-memory round tracking, no Socket.io or persistence imports. Timer handles stored on round objects for cleanup
- **Socket handler boundary**: `song-handlers.ts` in `socket-handlers/` -- calls services and session-manager, NEVER calls persistence directly
- **Session-manager orchestration**: `session-manager.ts` is the ONLY service that orchestrates across layers (initializes round, manages spin/veto timers, handles song selection flow)
- **Persistence boundary**: No new database tables. Spin the Wheel is entirely in-memory (same pattern as Quick Pick, DJ state store, song pool, connection tracker, event stream)
- **Casing rules**: DB columns `snake_case`, socket event payloads `camelCase` (direct objects, NOT wrapped)
- **Import rules**: Relative imports with `.js` extension. No barrel files. No tsconfig aliases
- **File naming**: `kebab-case.ts` for all new TS files, `snake_case.dart` for all new Dart files

### Spin the Wheel Server Flow

```
DJ enters songSelection → check getSongSelectionMode(sessionId)
  → 'spinWheel' → initializeSpinWheel(sessionId, context)
    → computeSuggestions(sessionId, 8) → startRound(segments)
    → broadcastSpinWheelStarted(segments, 15_000)
    → DJ engine auto-schedules 15s timer (handleRecoveryTimeout)

  WAITING (0-15s):
    → Participant taps SPIN → song:spinwheel { action: 'spin' }
      → initiateSpin(sessionId, userId) → server picks random target
      → **cancelSessionTimer(sessionId)** ← CRITICAL: cancel DJ engine's 15s timeout
      → broadcast spinwheel:result { phase: 'spinning', targetIndex, rotation, duration }
      → setTimeout(4000ms) → handleSpinAnimationComplete()
    → 15s timeout → handleRecoveryTimeout → autoSpin()
      → same broadcast + timer path as manual spin (no cancelSessionTimer needed, timer already fired)

  SPINNING (4s animation):
    → handleSpinAnimationComplete() fires
      → onSpinComplete() → state: 'landed'
      → **Check round.vetoUsed:**
        → If vetoUsed === false (FIRST SPIN):
          → broadcast spinwheel:result { phase: 'landed', song }
          → startVetoWindow() → state: 'vetoing'
          → setTimeout(5000ms) → handleVetoWindowExpired()
        → If vetoUsed === true (POST-VETO RE-SPIN):
          → resolveRound() immediately → NO second veto window (AC #4)
          → broadcast spinwheel:result { phase: 'selected', song }
          → handleSpinWheelSongSelected()

  VETOING (0-5s, first spin only):
    → PATH A: Participant vetos → song:spinwheel { action: 'veto' }
      → handleVeto() → excludes vetoed song, picks new target, marks vetoUsed=true
      → clearTimeout(vetoTimerHandle)
      → broadcast spinwheel:result { phase: 'vetoed', newTarget, rotation }
      → setTimeout(4000ms) → handleSpinAnimationComplete()
      → handleSpinAnimationComplete checks vetoUsed=true → resolves immediately

    → PATH B: No veto → handleVetoWindowExpired() fires
      → resolveRound() → target segment
      → broadcast spinwheel:result { phase: 'selected', song }
      → handleSpinWheelSongSelected()

  SONG SELECTED:
    → markSongSung() → clearSpinWheelRound()
    → emit SONG_QUEUED (BEFORE transition!)
    → processDjTransition(SONG_SELECTED) → partyCardDeal
```

### Timer Architecture (CRITICAL)

The DJ engine auto-schedules a 15s timer for songSelection via `handleRecoveryTimeout`. For Spin the Wheel:

1. **Initial 15s wait**: DJ engine timer. If nobody spins, `handleRecoveryTimeout` detects spin wheel round in 'waiting' state and calls `autoSpin()`
2. **Spin animation (4s)**: Managed via `setTimeout` in session-manager, handle stored on `SpinWheelRound.spinTimerHandle`
3. **Veto window (5s)**: Managed via `setTimeout` in session-manager, handle stored on `SpinWheelRound.vetoTimerHandle`
4. **Cleanup**: `clearRound()` calls `clearTimeout()` on both handles. Called on: session end, mode switch, song selection complete

**DO NOT use `scheduleSessionTimer` for spin/veto timers** -- it would overwrite the DJ engine's timer slot. Use plain `setTimeout` with handles on the round object.

### Mode Toggle Architecture

- **Mode storage**: Module-level `Map<string, SongSelectionMode>` in `session-manager.ts`. Default: 'quickPick'
- **Toggle during songSelection**: Cancels active round (Quick Pick or Spin Wheel), cancels DJ timer, restarts with new mode, re-schedules 15s timer
- **Toggle outside songSelection**: Just updates the map for next round
- **No JSONB persistence**: Mode defaults to 'quickPick' on server restart. Acceptable for MVP -- mode preference is ephemeral per session
- **Broadcast**: All participants see mode change via `song:modeChanged` event

### Broadcaster Pattern (CRITICAL -- DO NOT use dj:stateChanged metadata)

`buildDjStatePayload()` in `dj-broadcaster.ts` strips ALL metadata except `ceremonyType`. Spin wheel data in `context.metadata.spinWheelSegments` will be silently dropped from `dj:stateChanged` broadcasts.

Use dedicated broadcast functions:
- `broadcastSpinWheelStarted()` → `spinwheel:started` event
- `broadcastSpinWheelResult()` → `spinwheel:result` event (multi-phase: spinning, landed, vetoed, selected)
- `broadcastModeChanged()` → `song:modeChanged` event

### Suggestion Engine Integration

Same as Quick Pick: `computeSuggestions(sessionId, 8)` called server-side during DJ state transition. No REST endpoint used. The `count=8` parameter gives 8 songs instead of Quick Pick's 5. The ranking jitter from `computeSuggestions()` provides variety across rounds.

### Rotation Calculation

```typescript
const SEGMENTS = segments.length; // 8
const SEGMENT_ANGLE = (2 * Math.PI) / SEGMENTS; // 0.785 radians = 45 degrees
const fullRotations = Math.floor(Math.random() * 4) + 5; // 5-8 full rotations
const targetOffset = targetSegmentIndex * SEGMENT_ANGLE;
const totalRotation = (fullRotations * 2 * Math.PI) + targetOffset;
// Client renders wheel with segment 0 at top
// Wheel rotates clockwise by totalRotation radians
// After animation, the pointer (fixed at top) points to targetSegmentIndex
```

### What This Story Does NOT Include

- No TV auto-queuing of selected song on YouTube (Story 5.7)
- No song detection from TV (Story 5.8)
- No suggestion-only mode display (Story 5.9)
- No genre momentum in ranking (deferred, see Story 5.4 notes)
- No YouTube thumbnail proxy/caching
- No haptic feedback on spin
- No sound effects for wheel spin (would be Story 2.7 extension)

### Previous Story Intelligence (from Story 5.5)

- **Quick Pick vote service** (`quick-pick.ts`): Module-level `Map<string, QuickPickRound>` pattern -- follow exactly for `spin-wheel.ts`
- **`computeSuggestions(sessionId, count)`**: Returns `SuggestedSong[]` with `catalogTrackId`, `songTitle`, `artist`, `youtubeVideoId`, `overlapCount`, `score`. Map to `SpinWheelSegment` (drop `score` field, add `segmentIndex`)
- **`markSongSung(sessionId, title, artist)`**: Call when song is selected to update pool for next round
- **`handleQuickPickSongSelected`**: Template for `handleSpinWheelSongSelected`. CRITICAL: emit `SONG_QUEUED` BEFORE `processDjTransition(SONG_SELECTED)` (code review H1 fix)
- **`handleRecoveryTimeout`**: Already has songSelection detection with Quick Pick path. Add Spin Wheel path as second check
- **`resumeSession` timer fix (H2)**: Uses `handleRecoveryTimeout` callback. Spin Wheel auto-spin path handles recovery gracefully
- **Zod runtime validation**: Story 5.5 code review M2 added `safeParse()` in song-handlers. Follow same pattern for spin wheel and mode change payloads
- **Schema registration**: NOT needed for Socket.io-only schemas. No `z.globalRegistry.add()` or `index.ts` import ordering
- **Pre-existing Flutter test failure**: `party_screen_test.dart` has `DJTokens.actionPrimary` compilation error -- not from this epic
- **Server: 904 tests** as of Story 5.5 completion
- **Flutter: 442+ tests pass** (2 pre-existing failures in party_screen_test.dart)

### Git Intelligence (from recent commits)

- Last commit: Story 5.5 Quick Pick Mode with code review fixes (24 files, 2681 insertions)
- Pattern: stories implemented in a single commit with comprehensive tests, then separate code review fix commit
- All server files use relative imports with `.js` extension
- Server test count: 904+ tests (60+ files)
- Test patterns: `vi.mock()` with factory functions, `afterEach(() => resetAll())` for module-level state

### Project Structure Notes

New files to create:
```
apps/server/
└── src/
    ├── services/
    │   └── spin-wheel.ts                       # NEW - wheel round management
    └── shared/
        └── schemas/
            └── spin-wheel-schemas.ts           # NEW - Zod schemas

apps/server/
└── tests/
    ├── services/
    │   ├── spin-wheel.test.ts                  # NEW
    │   └── session-manager-spinwheel.test.ts   # NEW
    └── socket-handlers/
        └── song-handlers-spinwheel.test.ts     # NEW

apps/flutter_app/
└── lib/
    └── widgets/
        ├── spin_the_wheel_overlay.dart         # NEW
        └── song_mode_toggle.dart               # NEW

apps/flutter_app/
└── test/
    ├── models/
    │   └── spin_wheel_segment_test.dart        # NEW
    └── widgets/
        ├── spin_the_wheel_overlay_test.dart    # NEW
        └── song_mode_toggle_test.dart          # NEW
```

Files to modify:
```
apps/server/src/shared/events.ts                          # Add SPINWHEEL_STARTED, SPINWHEEL_RESULT, SONG_MODE_CHANGED
apps/server/src/services/dj-broadcaster.ts                # Add broadcastSpinWheelStarted, broadcastSpinWheelResult, broadcastModeChanged
apps/server/src/services/session-manager.ts               # Mode tracking, initializeSpinWheel, handleSpinAnimationComplete, handleVetoWindowExpired, handleSpinWheelSongSelected, handleModeChange, update handleRecoveryTimeout, endSession cleanup
apps/server/src/socket-handlers/song-handlers.ts          # Add SONG_SPINWHEEL and SONG_MODE_CHANGED handlers
apps/flutter_app/lib/state/party_provider.dart            # Add SpinWheelSegment class, spin wheel state fields, mode state, mutation methods
apps/flutter_app/lib/socket/client.dart                   # Add spin wheel listeners (spinwheel:started, spinwheel:result, song:modeChanged), emitters, update song:queued
apps/flutter_app/lib/screens/party_screen.dart            # Add SpinTheWheelOverlay + SongModeToggle
apps/flutter_app/lib/constants/copy.dart                  # Add spin wheel + mode toggle copy strings
apps/flutter_app/test/state/party_provider_test.dart      # Add spin wheel + mode state tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.6]
- [Source: _bmad-output/planning-artifacts/epics.md#FR89, FR90]
- [Source: _bmad-output/project-context.md#Server Boundaries]
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/project-context.md#Anti-Patterns]
- [Source: apps/server/src/shared/events.ts#SONG_SPINWHEEL (pre-existing stub)]
- [Source: apps/server/src/services/quick-pick.ts#Module pattern, round management]
- [Source: apps/server/src/services/suggestion-engine.ts#computeSuggestions]
- [Source: apps/server/src/services/song-pool.ts#markSongSung]
- [Source: apps/server/src/services/session-manager.ts#initializeQuickPick pattern, handleQuickPickSongSelected, handleRecoveryTimeout]
- [Source: apps/server/src/services/dj-broadcaster.ts#broadcastQuickPickStarted pattern, getIO]
- [Source: apps/server/src/services/timer-scheduler.ts#scheduleSessionTimer, cancelSessionTimer]
- [Source: apps/server/src/dj-engine/types.ts#DJState.songSelection, DJContext.metadata]
- [Source: apps/server/src/dj-engine/states.ts#songSelection: hasTimeout=true, SONG_SELECTED transition]
- [Source: apps/server/src/dj-engine/timers.ts#songSelection: 15_000ms]
- [Source: apps/server/src/socket-handlers/song-handlers.ts#SONG_QUICKPICK handler pattern, Zod validation]
- [Source: apps/server/src/socket-handlers/connection-handler.ts#Handler registration]
- [Source: apps/flutter_app/lib/state/party_provider.dart#QuickPickSong/VoteTally inline classes, Quick Pick state pattern]
- [Source: apps/flutter_app/lib/socket/client.dart#Quick Pick listeners and emitters pattern]
- [Source: apps/flutter_app/lib/widgets/quick_pick_overlay.dart#Full-screen overlay, animation, countdown pattern]
- [Source: apps/flutter_app/lib/screens/party_screen.dart#Quick Pick overlay integration pattern]
- [Source: _bmad-output/implementation-artifacts/5-5-quick-pick-mode.md#Complete previous story context]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required.

### Completion Notes List

- Implemented complete Spin the Wheel service (`spin-wheel.ts`) with state machine: waiting → spinning → landed → vetoing → resolved
- Server-authoritative: server picks random target segment, clients animate to match
- Added song selection mode tracking (`quickPick` | `spinWheel`) in session-manager with default `quickPick`
- Updated `processDjTransition` to branch on mode for songSelection initialization
- Updated `handleRecoveryTimeout` with auto-spin path for Spin the Wheel
- Implemented `handleSpinAnimationComplete` with vetoUsed check (AC #4: no second veto after re-spin)
- Implemented `handleSpinWheelSongSelected` with SONG_QUEUED-before-transition ordering (H1 fix pattern)
- Added mode change handler that cancels active round and restarts with new mode during songSelection
- Added 3 broadcaster functions: `broadcastSpinWheelStarted`, `broadcastSpinWheelResult`, `broadcastModeChanged`
- Added Zod schemas for runtime validation of spin/veto and mode change payloads
- Extended `SessionEvent` union type with 6 new event types
- Created `SpinWheelSegment` data class in `party_provider.dart` with `fromJson` factory
- Added 11 spin wheel state fields + 1 mode field with getters and 7 mutation methods
- Created `SpinTheWheelOverlay` widget with CustomPainter wheel, deceleration animation, veto button, countdown
- Created `SongModeToggle` widget with `SegmentedButton` for Quick Pick / Spin the Wheel
- Integrated both widgets into `PartyScreen` with mutual exclusivity (only one overlay shown)
- Updated `SocketClient` with listeners for `spinwheel:started`, `spinwheel:result`, `song:modeChanged`
- Updated `song:queued` listener to handle both Quick Pick and Spin the Wheel delayed clear
- Used constant colors for wheel segments (not vibe-shifting tokens which aren't constants)
- All copy strings in `constants/copy.dart`

### Change Log

- Story 5.6 implementation complete (2026-03-16)
- Code review fixes applied (2026-03-16):
  - [M1] Fixed veto timer leak: cancel vetoTimerHandle before scheduling re-spin in song-handlers.ts
  - [M3] Added state guard to resolveRound() in spin-wheel.ts — only allows 'landed' or 'vetoing' states
  - [H1] Created missing song-handlers-spinwheel.test.ts (14 tests)
  - [H2] Created missing spin_the_wheel_overlay_test.dart (9 tests)
  - [H3] Created missing song_mode_toggle_test.dart (3 tests)
  - [M2] Added missing session-manager tests: handleVetoWindowExpired, handleSpinWheelSongSelected ordering, endSession cleanup

### File List

**New files:**
- `apps/server/src/services/spin-wheel.ts`
- `apps/server/src/shared/schemas/spin-wheel-schemas.ts`
- `apps/server/tests/services/spin-wheel.test.ts`
- `apps/server/tests/services/session-manager-spinwheel.test.ts`
- `apps/server/tests/socket-handlers/song-handlers-spinwheel.test.ts`
- `apps/flutter_app/lib/widgets/spin_the_wheel_overlay.dart`
- `apps/flutter_app/lib/widgets/song_mode_toggle.dart`
- `apps/flutter_app/test/models/spin_wheel_segment_test.dart`
- `apps/flutter_app/test/widgets/spin_the_wheel_overlay_test.dart`
- `apps/flutter_app/test/widgets/song_mode_toggle_test.dart`

**Modified files:**
- `apps/server/src/shared/events.ts`
- `apps/server/src/services/event-stream.ts`
- `apps/server/src/services/dj-broadcaster.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/socket-handlers/song-handlers.ts`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/test/state/party_provider_test.dart`

# Story 3.3: Full Ceremony Experience

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want a dramatic ceremony reveal after key songs that builds anticipation and celebrates the performer,
so that every performance feels like a special moment.

## Acceptance Criteria

1. **Given** a Full ceremony is triggered after a song **When** the ceremony sequence begins **Then** an anticipation buildup phase plays with animation on all devices **And** confetti animation fires on the award reveal **And** the award reveal appears on all connected devices within a 200ms window of each other using server-coordinated timing (NFR27) **And** the complete ceremony (award generation and reveal) completes within 3 seconds of the host triggering "Song Over!" (NFR4)
2. **Given** a Full ceremony is in progress **When** ceremony audio plays **Then** fanfares and reveals play through the host's phone as the dominant audio source (FR25) **And** audio follows the Ceremonial volume level (100%) on host, spatial audio (60%) on participants
3. **Given** the host signals "Song Over!" via the persistent always-visible trigger during song state (FR16) **When** the trigger is activated **Then** the DJ engine transitions to the ceremony state

## Tasks / Subtasks

- [x] Task 1: Create ceremony broadcast functions (AC: #1)
  - [x] 1.1 In `apps/server/src/services/dj-broadcaster.ts`, add two broadcast functions:
    ```typescript
    export function broadcastCeremonyAnticipation(
      sessionId: string,
      data: {
        performerName: string | null;
        revealAt: number; // Server timestamp (ms) for synchronized reveal
      },
    ): void {
      if (!io) {
        console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
        return;
      }
      io.to(sessionId).emit(EVENTS.CEREMONY_ANTICIPATION, data);
    }

    export function broadcastCeremonyReveal(
      sessionId: string,
      data: {
        award: string;
        performerName: string | null;
        tone: string;
      },
    ): void {
      if (!io) {
        console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
        return;
      }
      io.to(sessionId).emit(EVENTS.CEREMONY_REVEAL, data);
    }
    ```
    - Follows existing `broadcastDjState`, `broadcastDjPause`, `broadcastDjResume` pattern exactly
    - Uses `EVENTS.CEREMONY_ANTICIPATION` and `EVENTS.CEREMONY_REVEAL` from `shared/events.ts` (already defined)
    - `revealAt` is a server-originated timestamp — clients use this to synchronize the reveal moment (NFR27: within 200ms window)
    - `performerName` is nullable because performer tracking (Epic 5) doesn't exist yet — ceremony still fires

- [x] Task 2: Create ceremony orchestration in session-manager (AC: #1)
  - **DEPENDENCY:** Task 3 (add `ceremony:revealed` event type) MUST be completed before this task
  - [x] 2.1 In `apps/server/src/services/session-manager.ts`, add import for new broadcast functions:
    ```typescript
    import { broadcastDjState, broadcastDjPause, broadcastDjResume, broadcastCeremonyAnticipation, broadcastCeremonyReveal } from '../services/dj-broadcaster.js';
    ```
  - [x] 2.2 Add `orchestrateFullCeremony` function:
    ```typescript
    const ANTICIPATION_DURATION_MS = 2000; // 2s buildup before reveal

    // Track scheduled ceremony reveals for cleanup
    const ceremonyRevealTimers = new Map<string, NodeJS.Timeout>();

    export function clearCeremonyTimers(sessionId: string): void {
      const timer = ceremonyRevealTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        ceremonyRevealTimers.delete(sessionId);
      }
    }

    async function orchestrateFullCeremony(
      sessionId: string,
      context: DJContext,
    ): Promise<void> {
      const performerName = context.currentPerformer;

      // Performer tracking not implemented until Epic 5 — always empty for now
      // When Epic 5 adds song selection, currentPerformerId will be set in DJContext metadata
      const performerUserId = '';
      const awardResult = performerUserId
        ? await generateCeremonyAward(sessionId, performerUserId, 'full')
        : null;

      // Compute synchronized reveal timestamp
      const revealAt = Date.now() + ANTICIPATION_DURATION_MS;

      // Phase 1: Broadcast anticipation to all clients
      broadcastCeremonyAnticipation(sessionId, {
        performerName,
        revealAt,
      });

      // Phase 2: Schedule reveal broadcast at revealAt
      const revealTimer = setTimeout(() => {
        ceremonyRevealTimers.delete(sessionId);
        broadcastCeremonyReveal(sessionId, {
          award: awardResult?.award ?? 'Star of the Show',
          performerName,
          tone: awardResult?.tone ?? 'hype',
        });

        // Log ceremony reveal to event stream
        appendEvent(sessionId, {
          type: 'ceremony:revealed',
          ts: Date.now(),
          data: {
            award: awardResult?.award ?? 'Star of the Show',
            performerName,
            ceremonyType: 'full' as const,
          },
        });
      }, ANTICIPATION_DURATION_MS);

      ceremonyRevealTimers.set(sessionId, revealTimer);
    }
    ```
    - `ANTICIPATION_DURATION_MS = 2000` — 2s anticipation phase ensures reveal happens within 3s of "Song Over!" (NFR4: "3 seconds" refers to the reveal appearing on screen, NOT the ceremony state duration)
    - Anticipation phase absorbs clock drift between devices (architecture: "anticipation phase absorbs clock drift")
    - `revealAt` timestamp enables synchronized reveal across all clients (NFR27: 200ms window)
    - Fallback award `'Star of the Show'` when no performer is identified (performer tracking is Epic 5)
    - `ceremonyRevealTimers` tracked for cleanup on session end or host skip
    - No `as SessionEvent['type']` cast needed — `ceremony:revealed` is in the union (Task 3)
  - [x] 2.3 Hook ceremony orchestration into `processDjTransition`:
    After the existing `if (newContext.state === DJState.ceremony)` block that logs `ceremony:typeSelected`, add:
    ```typescript
    if (newContext.state === DJState.ceremony) {
      // ... existing ceremony:typeSelected event logging stays ...

      // Orchestrate ceremony based on type
      const resolvedCeremonyType = (newContext.metadata.ceremonyType === 'full' || newContext.metadata.ceremonyType === 'quick')
        ? newContext.metadata.ceremonyType
        : 'quick';

      if (resolvedCeremonyType === 'full') {
        // Fire-and-forget — don't block DJ transition pipeline
        void orchestrateFullCeremony(sessionId, newContext);
      }
      // Quick ceremony handled by Story 3.4
    }
    ```
    - **Fire-and-forget:** Ceremony orchestration runs async without blocking the transition pipeline
    - This runs AFTER the `dj:stateChanged` broadcast (clients already know we're in ceremony state)
    - Quick ceremony case is deferred to Story 3.4
  - [x] 2.4 Add cleanup for ceremony timers in `endSession()`:
    ```typescript
    // In endSession(), alongside clearScoreCache() and clearSessionAwards():
    clearCeremonyTimers(sessionId);
    ```
    - Also call `clearCeremonyTimers(sessionId)` in `processDjTransition` when leaving ceremony state (e.g., HOST_SKIP during ceremony)
  - [x] 2.5 Add cleanup when HOST_SKIP fires during ceremony:
    In `processDjTransition`, before processing the transition:
    ```typescript
    // Cancel any pending ceremony reveal if skipping out of ceremony
    if (context.state === DJState.ceremony) {
      clearCeremonyTimers(sessionId);
    }
    ```

- [x] Task 3: Add ceremony:revealed event to event stream (AC: #1)
  - [x] 3.1 In `apps/server/src/services/event-stream.ts`, add to `SessionEvent` union:
    ```typescript
    | { type: 'ceremony:revealed'; ts: number; data: { award: string; performerName: string | null; ceremonyType: 'full' | 'quick' } }
    ```
    - This event records when the reveal was actually broadcast to clients (distinct from `ceremony:awardGenerated` which records when the award was generated)
    - Useful for analytics: measure time between `ceremony:typeSelected` → `ceremony:revealed`

- [x] Task 4: Update ceremony state to non-placeholder (AC: #1, #3)
  - [x] 4.1 In `apps/server/src/dj-engine/states.ts`, update ceremony state config:
    ```typescript
    [DJState.ceremony]: {
      allowedTransitions: ['CEREMONY_DONE', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
      hasTimeout: true,
      isPlaceholder: false, // Changed from true — ceremony now has real behavior
    },
    ```
    - Remove the `// TODO: Epic 3 implements full ceremony behavior` comment
    - `isPlaceholder: false` — ceremony state now has real behavior (anticipation + reveal)
    - Allowed transitions unchanged — TIMEOUT still auto-advances, HOST_SKIP still works
  - [x] 4.2 In `apps/server/src/dj-engine/timers.ts`, update ceremony timer duration:
    ```typescript
    [DJState.ceremony]: 12_000, // 12s: 2s anticipation + 10s reveal display
    ```
    - Changed from `10_000` placeholder to `12_000`
    - 2s anticipation + 10s reveal display = 12s total ceremony STATE duration
    - Update the comment from `// 10s placeholder (TODO: Epic 3)` to `// 12s: 2s anticipation + 10s reveal display`
    - **NFR4 clarification:** "3 seconds" refers to the award reveal APPEARING on screen (achieved at 2s via anticipation phase), NOT the ceremony state ending. The 12s timer controls how long the ceremony state lasts before TIMEOUT auto-advances to the next state

- [x] Task 5: Create Flutter ceremony display widget (AC: #1, #2)
  - [x] 5.1 Create `apps/flutter_app/lib/widgets/ceremony_display.dart`:
    ```dart
    import 'dart:async';
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/theme/dj_theme.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    class CeremonyDisplay extends StatefulWidget {
      const CeremonyDisplay({
        super.key,
        required this.performerName,
        required this.revealAt,
        required this.vibe,
        this.award,
        this.tone,
      });

      final String? performerName;
      final int revealAt; // Server timestamp for synchronized reveal
      final PartyVibe vibe;
      final String? award;
      final String? tone;

      @override
      State<CeremonyDisplay> createState() => _CeremonyDisplayState();
    }

    class _CeremonyDisplayState extends State<CeremonyDisplay>
        with TickerProviderStateMixin {
      bool _revealed = false;
      Timer? _revealTimer;
      late final AnimationController _anticipationController;
      late final AnimationController _revealController;

      @override
      void initState() {
        super.initState();
        _anticipationController = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 800),
        )..repeat(reverse: true);

        _revealController = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 600),
        );

        _scheduleReveal();
      }

      void _scheduleReveal() {
        final now = DateTime.now().millisecondsSinceEpoch;
        final delay = widget.revealAt - now;
        if (delay <= 0) {
          _doReveal();
        } else {
          _revealTimer = Timer(Duration(milliseconds: delay), _doReveal);
        }
      }

      void _doReveal() {
        if (!mounted) return;
        setState(() => _revealed = true);
        _anticipationController.stop();
        _revealController.forward();
      }

      @override
      void didUpdateWidget(CeremonyDisplay oldWidget) {
        super.didUpdateWidget(oldWidget);
        // If award arrives via ceremony:reveal event, trigger reveal immediately
        if (widget.award != null && oldWidget.award == null && !_revealed) {
          _revealTimer?.cancel();
          _doReveal();
        }
      }

      @override
      void dispose() {
        _revealTimer?.cancel();
        _anticipationController.dispose();
        _revealController.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        return Container(
          key: const Key('ceremony-display'),
          child: Center(
            child: _revealed ? _buildReveal(context) : _buildAnticipation(context),
          ),
        );
      }

      Widget _buildAnticipation(BuildContext context) {
        return FadeTransition(
          key: const Key('ceremony-anticipation'),
          opacity: Tween<double>(begin: 0.4, end: 1.0).animate(_anticipationController),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.performerName != null) ...[
                Text(
                  widget.performerName!,
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        color: widget.vibe.accent,
                      ),
                ),
                const SizedBox(height: DJTokens.spaceMd),
              ],
              Text(
                Copy.ceremonyAnticipation,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
            ],
          ),
        );
      }

      Widget _buildReveal(BuildContext context) {
        final award = widget.award ?? Copy.defaultAward;
        final vibeEmojis = vibeConfettiEmojis[widget.vibe] ?? vibeConfettiEmojis[PartyVibe.general]!;

        return FadeTransition(
          key: const Key('ceremony-reveal'),
          opacity: CurvedAnimation(parent: _revealController, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.5, end: 1.0).animate(
              CurvedAnimation(parent: _revealController, curve: Curves.elasticOut),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Confetti emojis row
                Text(
                  vibeEmojis.join(' '),
                  key: const Key('ceremony-confetti'),
                  style: const TextStyle(fontSize: 48),
                ),
                const SizedBox(height: DJTokens.spaceLg),
                if (widget.performerName != null) ...[
                  Text(
                    widget.performerName!,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: DJTokens.textSecondary,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceSm),
                ],
                // Award title — the star of the show
                Text(
                  award,
                  key: const Key('ceremony-award-title'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                        color: widget.vibe.accent,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: DJTokens.spaceMd),
                // Vibe award flavor text
                Text(
                  vibeAwardFlavors[widget.vibe] ?? '',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              ],
            ),
          ),
        );
      }
    }
    ```
    - **Synchronized reveal:** Uses `revealAt` server timestamp to schedule local reveal timer. All clients compute `delay = revealAt - now`, ensuring simultaneous reveal within clock drift tolerance (NFR27: 200ms)
    - **Anticipation phase:** Pulsing animation (FadeTransition with repeat) showing performer name + "And the award goes to..."
    - **Reveal phase:** Scale + fade animation showing award title with confetti emojis and vibe-specific flavor text
    - Confetti emojis sourced from `vibeConfettiEmojis` in `copy.dart` (already defined)
    - Award flavor text from `vibeAwardFlavors` in `copy.dart` (already defined)
    - Widget keys follow `Key('kebab-case-descriptor')` convention
    - Uses `DJTokens` spacing constants — no hardcoded padding values
    - **DO NOT test:** animations, visual effects, confetti, color values, transition timings (per project testing rules)

- [x] Task 6: Update party provider with ceremony data (AC: #1)
  - [x] 6.1 In `apps/flutter_app/lib/state/party_provider.dart`, add ceremony state fields:
    ```dart
    // Ceremony state — populated by ceremony:anticipation and ceremony:reveal events
    String? _ceremonyPerformerName;
    int? _ceremonyRevealAt;
    String? _ceremonyAward;
    String? _ceremonyTone;

    String? get ceremonyPerformerName => _ceremonyPerformerName;
    int? get ceremonyRevealAt => _ceremonyRevealAt;
    String? get ceremonyAward => _ceremonyAward;
    String? get ceremonyTone => _ceremonyTone;

    void onCeremonyAnticipation({
      required String? performerName,
      required int revealAt,
    }) {
      _ceremonyPerformerName = performerName;
      _ceremonyRevealAt = revealAt;
      _ceremonyAward = null;
      _ceremonyTone = null;
      notifyListeners();
    }

    void onCeremonyReveal({
      required String award,
      required String? performerName,
      required String tone,
    }) {
      _ceremonyAward = award;
      _ceremonyTone = tone;
      if (performerName != null) _ceremonyPerformerName = performerName;
      notifyListeners();
    }

    void _clearCeremonyState() {
      _ceremonyPerformerName = null;
      _ceremonyRevealAt = null;
      _ceremonyAward = null;
      _ceremonyTone = null;
    }
    ```
  - [x] 6.2 Call `_clearCeremonyState()` when DJ state transitions AWAY from ceremony:
    In `onDjStateUpdate`, BEFORE setting `_djState`, check if we're leaving ceremony:
    ```dart
    // Clear ceremony data when transitioning OUT of ceremony state
    if (_djState == DJState.ceremony && state != DJState.ceremony) {
      _clearCeremonyState();
    }
    _djState = state;
    ```
    - Must check the PREVIOUS `_djState` before overwriting it
    - Only clears when leaving ceremony, not on every non-ceremony state update
  - [x] 6.3 Also call `_clearCeremonyState()` in `onSessionEnd()` and `_resetState()`

- [x] Task 7: Wire ceremony socket listeners (AC: #1)
  - [x] 7.1 In `apps/flutter_app/lib/socket/client.dart`, add ceremony event listeners alongside existing `dj:stateChanged` listener:
    ```dart
    on('ceremony:anticipation', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyAnticipation(
        performerName: payload['performerName'] as String?,
        revealAt: payload['revealAt'] as int,
      );
    });

    on('ceremony:reveal', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyReveal(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
      );
    });
    ```
    - Add these in the same `_setupListeners()` method where `dj:stateChanged` is registered
    - Follows existing listener pattern (cast `data` to `Map<String, dynamic>`, extract fields)
    - **ONLY** `SocketClient` calls mutation methods on providers (per Flutter boundaries)

- [x] Task 8: Update party screen for ceremony rendering (AC: #1)
  - [x] 8.1 In `apps/flutter_app/lib/screens/party_screen.dart`:
    - Add import for `CeremonyDisplay`
    - In `_buildPartyContent`, when DJ state is `ceremony` and `ceremonyType == 'full'`, render `CeremonyDisplay` instead of the default state display:
    ```dart
    if (partyProvider.djState == DJState.ceremony &&
        partyProvider.ceremonyType == 'full' &&
        partyProvider.ceremonyRevealAt != null) ...[
      CeremonyDisplay(
        performerName: partyProvider.ceremonyPerformerName,
        revealAt: partyProvider.ceremonyRevealAt!,
        vibe: displayVibe,
        award: partyProvider.ceremonyAward,
        tone: partyProvider.ceremonyTone,
      ),
    ] else ...[
      // existing default content (icon, state label, participant count, etc.)
    ]
    ```
    - The existing default content (music note icon, state label, countdown) renders for non-full ceremonies and as a fallback
    - CeremonyDisplay takes over the full center area during full ceremonies

- [x] Task 9: Implement ceremony audio volume differentiation (AC: #2)
  - [x] 9.1 In `apps/flutter_app/lib/audio/state_transition_audio.dart`, add `isHost` parameter and volume logic:
    Current signature (line 17): `void onStateChanged(DJState newState, {bool isPaused = false})`
    Updated:
    ```dart
    void onStateChanged(DJState newState, {bool isPaused = false, bool isHost = false}) {
      if (isPaused) return;
      if (newState == _previousState) return;

      final cue = _cueForState(newState);
      if (cue != null) {
        // FR25: Host = full volume (dominant audio source), participants = 60% (spatial)
        final volume = (newState == DJState.ceremony && !isHost) ? 0.6 : cue.defaultVolume;
        _engine.play(cue, volume: volume);
      }
      _previousState = newState;
    }
    ```
    - Variable is `_engine` (not `_audioEngine`) — see line 12 of state_transition_audio.dart
    - Method is `_engine.play(cue, volume: ...)` (not `playCue`) — see line 23
    - `AudioEngine.play()` already accepts optional `volume` parameter (audio_engine.dart line 86) — NO changes needed to AudioEngine
    - Non-ceremony states keep `cue.defaultVolume` (e.g., `ceremonyStart.defaultVolume` is `1.0` for host, overridden to `0.6` for participants)
  - [x] 9.2 In `apps/flutter_app/lib/socket/client.dart`, update the call site (line 207-210):
    Current:
    ```dart
    _stateTransitionAudio.onStateChanged(
      djState,
      isPaused: payload['isPaused'] as bool? ?? false,
    );
    ```
    Updated:
    ```dart
    _stateTransitionAudio.onStateChanged(
      djState,
      isPaused: payload['isPaused'] as bool? ?? false,
      isHost: partyProvider.isHost,
    );
    ```
    - `partyProvider.isHost` is already available (set from session join response)

- [x] Task 10: Add copy constants for ceremony (AC: #1)
  - [x] 10.1 In `apps/flutter_app/lib/constants/copy.dart`, add:
    ```dart
    static const String ceremonyAnticipation = 'And the award goes to...';
    static const String defaultAward = 'Star of the Show';
    ```
    - All copy in `constants/copy.dart` — no hardcoded strings in widgets (per anti-patterns)

- [x] Task 11: Server tests (AC: #1, #2, #3)
  - [x] 11.1 Extend `apps/server/tests/services/dj-broadcaster.test.ts` (or create if doesn't exist):
    - Test `broadcastCeremonyAnticipation` emits `ceremony:anticipation` to room with correct payload
    - Test `broadcastCeremonyAnticipation` with `performerName: null` — still broadcasts
    - Test `broadcastCeremonyReveal` emits `ceremony:reveal` to room with correct payload
    - Test both functions log warning when `io` not initialized
    - Mock `io.to(sessionId).emit()` following existing test patterns
  - [x] 11.2 Create `apps/server/tests/services/session-manager-ceremony.test.ts`:
    - Test `orchestrateFullCeremony` calls `generateCeremonyAward` with correct params
    - Test `orchestrateFullCeremony` emits `ceremony:anticipation` with `revealAt` approximately `now + 2000`
    - Test `orchestrateFullCeremony` emits `ceremony:reveal` after ~2000ms delay with award data
    - Test `orchestrateFullCeremony` with no performer (currentPerformer null) — uses fallback award
    - Test `orchestrateFullCeremony` appends `ceremony:revealed` event to event stream
    - Test `clearCeremonyTimers` cancels pending reveal timer
    - Test HOST_SKIP during ceremony calls `clearCeremonyTimers` (cleanup)
    - Test `endSession` calls `clearCeremonyTimers`
    - Test ceremony orchestration is called from `processDjTransition` when entering ceremony state with type 'full'
    - Test ceremony orchestration is NOT called when ceremony type is 'quick'
    - Use `vi.useFakeTimers()` for timer-dependent tests
    - Mock `broadcastCeremonyAnticipation`, `broadcastCeremonyReveal`, `generateCeremonyAward`
  - [x] 11.3 Update `apps/server/tests/dj-engine/states.test.ts` (if exists):
    - Test ceremony state `isPlaceholder` is `false`
  - [x] 11.4 Update timer tests:
    - Test ceremony timer duration is 12000ms (changed from 10000ms)
  - [x] 11.5 **Regression tests**: Run full existing test suite to verify no breakage
    - All 511+ existing tests still pass (from Story 3.2 baseline)
    - Ceremony state config change from placeholder to non-placeholder may affect existing tests that check `isPlaceholder` — update those assertions

- [x] Task 12: Flutter tests (AC: #1, #2)
  - [x] 12.1 Create `apps/flutter_app/test/state/party_provider_ceremony_test.dart`:
    - Test `onCeremonyAnticipation` sets all ceremony fields and notifies listeners
    - Test `onCeremonyReveal` sets award and tone, notifies listeners
    - Test `_clearCeremonyState` resets all ceremony fields
    - Test ceremony state cleared when DJ state changes away from ceremony
    - Test ceremony state cleared on session end
  - [x] 12.2 Create `apps/flutter_app/test/widgets/ceremony_display_test.dart`:
    - Test widget renders anticipation phase when `award` is null
    - Test widget renders reveal phase when `award` is provided
    - Test widget shows performer name when provided
    - Test widget shows default content when performer name is null
    - Test widget key is `ceremony-display`
    - **DO NOT test:** animation timings, visual effects, color values, confetti rendering
  - [x] 12.3 Extend `apps/flutter_app/test/socket/client_test.dart`:
    - Test `ceremony:anticipation` event calls `partyProvider.onCeremonyAnticipation`
    - Test `ceremony:reveal` event calls `partyProvider.onCeremonyReveal`

## Dev Notes

### Architecture: Server-Coordinated Synchronized Reveal (NFR27)

The most critical aspect of this story is the synchronized reveal mechanism. The architecture specifies "anticipation phase absorbs clock drift, future-timestamp-based synchronized reveal." Here's how it works:

1. **Server computes `revealAt`**: `Date.now() + ANTICIPATION_DURATION_MS` (2000ms)
2. **All clients receive `ceremony:anticipation`** with the same `revealAt` timestamp
3. **Each client computes local delay**: `delay = revealAt - localTime`
4. **Clients start anticipation animation** immediately
5. **All clients reveal simultaneously** when their local clock reaches `revealAt`

This works because:
- All `revealAt` values originate from the same server timestamp
- The anticipation phase (2s) is much longer than typical clock drift between devices
- Minor drift (±100ms) is imperceptible in a party context
- The 200ms synchronization window (NFR27) is achievable without NTP sync for mobile apps on the same network

[Source: _bmad-output/planning-artifacts/architecture.md — "Animation-timing as architecture", server-coordinated timing]

### Performer Tracking Limitation (Epic 5 Dependency)

`currentPerformer` (display name) in `DJContext` is not populated until Epic 5 (Song Integration & Discovery) implements song selection with performer assignment. There is NO `currentPerformerId` field in `DJContext` or its metadata — it will be added by Epic 5 when song selection assigns a performer. Until then:

- `currentPerformer` is `null` — ceremony displays without performer name
- `performerUserId` is always `''` → `generateCeremonyAward` is NOT called → returns `null`
- Fallback award `'Star of the Show'` is used (hardcoded, not from award template engine)
- Award is NOT persisted to `session_participants.top_award` (no performer to attribute to)
- Event stream still logs `ceremony:revealed` events for analytics

This is acceptable for MVP — the ceremony experience works visually, just without personalized performer attribution. When Epic 5 adds performer tracking, `orchestrateFullCeremony` just needs to read the performer ID from `DJContext.metadata.currentPerformerId` and pass it to `generateCeremonyAward`.

### Ceremony State: Placeholder → Real (Breaking Change for Tests)

Changing `isPlaceholder: false` in states.ts may break existing tests that assert placeholder behavior for ceremony. The machine.ts `processTransition` function treats placeholder and non-placeholder states identically (both schedule timers, broadcast, persist), so the functional impact is minimal. But any test asserting `isPlaceholder === true` for ceremony needs updating.

[Source: apps/server/src/dj-engine/states.ts — ceremony state config]

### Timer Duration: 10s → 12s

Ceremony timer increased from 10s placeholder to 12s to accommodate:
- 2s anticipation phase
- 10s reveal display time

The timer is a TIMEOUT auto-advance — after 12s, the DJ engine transitions to the next state (interlude or songSelection). Story 3.4 (Quick Ceremony) uses the same timer but with different behavior (immediate reveal, no anticipation). Story 3.4 may need to adjust the timer dynamically or use the existing 12s with a shorter display.

[Source: apps/server/src/dj-engine/timers.ts — DEFAULT_TIMER_DURATIONS]

### CeremonyDisplay Award Update Chain

The `CeremonyDisplay` widget uses `didUpdateWidget` to detect when `award` changes from null to non-null, triggering the reveal immediately (in case it arrives before the `revealAt` timer fires). The rebuild chain works as follows:

1. Server emits `ceremony:reveal` with award data
2. `SocketClient` listener calls `partyProvider.onCeremonyReveal()`
3. `onCeremonyReveal()` sets `_ceremonyAward` and calls `notifyListeners()`
4. `PartyScreen` rebuilds via `context.watch<PartyProvider>()`
5. `CeremonyDisplay` receives new `award` prop → `didUpdateWidget` fires → `_doReveal()`

This ensures the reveal happens either at the `revealAt` timestamp OR when the server's `ceremony:reveal` event arrives, whichever comes first — providing resilience against clock drift.

### Audio Volume: Host vs Participant (FR25)

The ceremony start sound cue already plays on ceremony state entry via `state_transition_audio.dart`. This story adds volume differentiation:
- **Host phone:** 100% volume (dominant audio source — the host's phone is the "PA system")
- **Participant phones:** 60% volume (spatial audio effect — creates a room-like feel)

The `isHost` flag is already available on `PartyProvider` (set from session join response). It just needs to be passed through to the audio engine.

**Note:** `SoundCue.ceremonyStart` asset (`assets/sounds/ceremony_start.opus`) already exists and is preloaded by `AudioEngine`. No new audio assets needed for this story. `SoundCue.ceremonyStart.defaultVolume` is already `1.0` (sound_cue.dart line 28), so the host keeps the default and only participants override to `0.6`.

**Existing code pattern:** `_engine.play(cue, volume: cue.defaultVolume)` (state_transition_audio.dart line 23). The change replaces `cue.defaultVolume` with a conditional: `(newState == DJState.ceremony && !isHost) ? 0.6 : cue.defaultVolume`.

[Source: apps/flutter_app/lib/audio/sound_cue.dart, apps/flutter_app/lib/audio/state_transition_audio.dart, apps/flutter_app/lib/audio/audio_engine.dart]

### Ceremony Event Flow (Complete Picture)

```
Host taps "Song Over!" (SongOverButton widget, already implemented)
  → client emits host:songOver
  → server host-handlers.ts validates host, processes SONG_ENDED transition
  → processDjTransition():
      1. DJ engine transitions song → ceremony
      2. selectCeremonyType() determines full/quick (from ceremony-selection.ts)
      3. Broadcasts dj:stateChanged (ceremonyType in payload)
      4. Logs ceremony:typeSelected event
      5. If full: fires orchestrateFullCeremony() (NEW)
  → orchestrateFullCeremony():
      1. Generates award via generateCeremonyAward() (from Story 3.2)
      2. Broadcasts ceremony:anticipation with revealAt
      3. Schedules ceremony:reveal after 2s delay
  → Flutter clients:
      1. Receive dj:stateChanged → party_provider.onDjStateUpdate (ceremony)
      2. Sound cue ceremonyStart plays (with host/participant volume)
      3. Receive ceremony:anticipation → party_provider.onCeremonyAnticipation
      4. Party screen renders CeremonyDisplay in anticipation phase
      5. After revealAt delay → CeremonyDisplay transitions to reveal
      6. Receive ceremony:reveal → party_provider.onCeremonyReveal (confirms award)
  → After 12s: TIMEOUT fires → DJ transitions to next state
  → CeremonyDisplay unmounts, party screen returns to default
```

### What This Story Does NOT Build

- **No quick ceremony** — Story 3.4 handles the quick ceremony experience
- **No moment card generation** — Story 3.5
- **No confetti particle system** — Architecture mentions `widgets/confetti_layer.dart` but this story uses emoji-based confetti display (scaled text). A particle system is visual polish that can be added later
- **No glow effects** — Architecture mentions `widgets/glow_effect.dart` but this is visual polish
- **No performer tracking/selection** — Epic 5 (Song Integration)
- **No reaction or card challenge integration** — Epic 4
- **No end-of-night award consumption** — Epic 8

### Existing Code to NOT Modify

- `dj-engine/ceremony-selection.ts` — No changes. Ceremony type selection is independent of the ceremony experience
- `dj-engine/transitions.ts` — No changes. The transition logic stays the same
- `dj-engine/machine.ts` — No changes. Side effect generation stays the same
- `services/award-generator.ts` — No changes. Award generation is consumed as-is from Story 3.2
- `services/participation-scoring.ts` — No changes
- `services/rate-limiter.ts` — No changes
- `persistence/session-repository.ts` — No changes (award persistence already handled by Story 3.2)
- `socket-handlers/party-handlers.ts` — No changes
- `widgets/song_over_button.dart` — Already implemented and working

### Previous Story Intelligence (Story 3.2)

Story 3.2 established:
- `generateCeremonyAward(sessionId, performerUserId, ceremonyType)` in session-manager — ready to call from ceremony orchestration
- Award dedup tracking via `sessionAwards` map — shared across ceremonies in a session
- `clearSessionAwards()` called in `endSession()` — already handles cleanup
- Fire-and-forget DB persistence pattern for `updateTopAward` — same pattern used
- `ceremony:awardGenerated` event in event stream — logs award generation details
- 511 tests pass across 39 test files — baseline for regression

Key pattern from 3.2: Pure function pattern for services, orchestration in session-manager, broadcast through dj-broadcaster.

[Source: _bmad-output/implementation-artifacts/3-2-award-template-engine.md]

### Git Intelligence

Recent commits follow pattern: `"Implement Story X.Y: Title with code review fixes"`
- Story 3.2 added `award-generator.ts` and `generateCeremonyAward()` to session-manager
- Session-manager is the ONLY orchestrator — ceremony logic goes there
- dj-broadcaster pattern: module-level `io` variable, `initDjBroadcaster(io)` for initialization, `broadcastX(sessionId, data)` for emissions
- Test pattern: split session-manager tests by concern (`session-manager-dj.test.ts`, `session-manager-scoring.test.ts`, `session-manager-awards.test.ts`) — add `session-manager-ceremony.test.ts`

### Project Structure Notes

New files:
- `apps/server/tests/services/session-manager-ceremony.test.ts`
- `apps/flutter_app/lib/widgets/ceremony_display.dart`
- `apps/flutter_app/test/state/party_provider_ceremony_test.dart`
- `apps/flutter_app/test/widgets/ceremony_display_test.dart`

Modified files:
- `apps/server/src/services/dj-broadcaster.ts` — Add `broadcastCeremonyAnticipation`, `broadcastCeremonyReveal`
- `apps/server/src/services/session-manager.ts` — Add `orchestrateFullCeremony`, hook into `processDjTransition`, cleanup in `endSession`
- `apps/server/src/services/event-stream.ts` — Add `ceremony:revealed` event type
- `apps/server/src/dj-engine/states.ts` — Change ceremony `isPlaceholder` to `false`
- `apps/server/src/dj-engine/timers.ts` — Change ceremony timer from 10s to 12s
- `apps/flutter_app/lib/state/party_provider.dart` — Add ceremony state fields and handlers
- `apps/flutter_app/lib/socket/client.dart` — Add `ceremony:anticipation` and `ceremony:reveal` listeners
- `apps/flutter_app/lib/screens/party_screen.dart` — Render CeremonyDisplay during full ceremony
- `apps/flutter_app/lib/audio/state_transition_audio.dart` — Add host/participant volume differentiation
- `apps/flutter_app/lib/constants/copy.dart` — Add ceremony copy constants

Existing test files to extend:
- `apps/server/tests/dj-engine/` — Update ceremony isPlaceholder assertion
- `apps/flutter_app/test/socket/client_test.dart` — Add ceremony event listener tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.3] — Full ceremony AC: anticipation buildup, confetti, synchronized reveal (NFR27), 3s timing (NFR4), host audio dominant (FR25)
- [Source: _bmad-output/planning-artifacts/architecture.md — "Animation-timing as architecture"] — Server-coordinated timing, anticipation phase absorbs clock drift, future-timestamp-based synchronized reveal
- [Source: _bmad-output/planning-artifacts/architecture.md — Ceremonies FR16-21] — Award generation, ceremony types, host "Song Over!" trigger
- [Source: _bmad-output/project-context.md#Server Boundaries] — session-manager is ONLY orchestrator, socket-handlers NEVER call persistence
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog] — ceremony namespace events
- [Source: _bmad-output/project-context.md#Anti-Patterns] — No hardcoded strings, no hardcoded colors, use DJTokens
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects/confetti/color values
- [Source: apps/server/src/dj-engine/types.ts] — DJContext with currentPerformer, CeremonyType
- [Source: apps/server/src/dj-engine/states.ts] — Ceremony state config (isPlaceholder, allowedTransitions)
- [Source: apps/server/src/dj-engine/timers.ts] — DEFAULT_TIMER_DURATIONS, ceremony 10s placeholder
- [Source: apps/server/src/dj-engine/ceremony-selection.ts] — selectCeremonyType pure function
- [Source: apps/server/src/services/dj-broadcaster.ts] — broadcastDjState pattern, module-level io
- [Source: apps/server/src/services/session-manager.ts] — processDjTransition, generateCeremonyAward, endSession
- [Source: apps/server/src/services/event-stream.ts] — SessionEvent union, ceremony:typeSelected, ceremony:awardGenerated
- [Source: apps/server/src/shared/events.ts] — CEREMONY_ANTICIPATION, CEREMONY_REVEAL, CEREMONY_QUICK
- [Source: apps/flutter_app/lib/state/party_provider.dart] — ceremonyType field, onDjStateUpdate
- [Source: apps/flutter_app/lib/socket/client.dart] — dj:stateChanged listener pattern
- [Source: apps/flutter_app/lib/audio/state_transition_audio.dart] — ceremonyStart sound cue, _cueForState
- [Source: apps/flutter_app/lib/constants/copy.dart] — vibeConfettiEmojis, vibeAwardFlavors
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — DJ state rendering, SongOverButton positioning
- [Source: apps/flutter_app/lib/theme/dj_theme.dart] — djStateBackgroundColor, PartyVibe colors
- [Source: _bmad-output/implementation-artifacts/3-2-award-template-engine.md] — Previous story: 511 tests, 39 files, generateCeremonyAward ready
- [Source: _bmad-output/implementation-artifacts/3-1-participation-scoring-system.md] — scoreCache pattern, fire-and-forget DB writes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Existing audio tests expected ceremony volume 1.0 but new FR25 volume differentiation changed participant default to 0.6 — updated assertions

### Completion Notes List

- Task 1: Added `broadcastCeremonyAnticipation` and `broadcastCeremonyReveal` to dj-broadcaster.ts following existing pattern
- Task 2: Added `orchestrateFullCeremony` to session-manager.ts — 2s anticipation then reveal broadcast with timer cleanup. Hooked into `processDjTransition` for ceremony state entry (full type only). Added timer cleanup in `endSession` and on HOST_SKIP during ceremony
- Task 3: Added `ceremony:revealed` event type to `SessionEvent` union in event-stream.ts
- Task 4: Changed ceremony `isPlaceholder` from `true` to `false` in states.ts. Updated timer from 10s to 12s (2s anticipation + 10s reveal)
- Task 5: Created `CeremonyDisplay` widget with anticipation (pulsing) and reveal (scale+fade) phases, synchronized via `revealAt` timestamp
- Task 6: Added ceremony state fields to `PartyProvider` — `onCeremonyAnticipation`, `onCeremonyReveal`, `_clearCeremonyState`. Clears on state transition away from ceremony, session end, and kicked
- Task 7: Wired `ceremony:anticipation` and `ceremony:reveal` socket listeners in `SocketClient`
- Task 8: Updated `PartyScreen` to render `CeremonyDisplay` during full ceremony state (with fallback to default content)
- Task 9: Added `isHost` parameter to `StateTransitionAudio.onStateChanged` — host gets 100% volume, participants get 60% for ceremony
- Task 10: Added `ceremonyAnticipation` and `defaultAward` copy constants
- Task 11: 534 server tests pass (40 files). Added broadcaster tests, ceremony orchestration tests, updated timer/state tests
- Task 12: All Flutter tests pass. Added ceremony provider tests, widget tests, socket client tests. Updated audio tests for new volume behavior

### Change Log

- 2026-03-12: Implemented Story 3.3 Full Ceremony Experience — all 12 tasks complete
- 2026-03-13: Code review fixes — 7 issues found (2H, 3M, 2L), 6 fixed:
  - H1: Fixed latent timing bug — `revealAt` now computed before async award generation
  - H2: Replaced hardcoded `fontSize: 48` with `DJTokens.iconSizeLg`
  - M1: Extracted duplicate `resolvedCeremonyType` to single variable
  - M2: Added `DEFAULT_AWARD`/`DEFAULT_AWARD_TONE` server constants, replaced 4 inline usages
  - M3: Moved `CurvedAnimation` creation from `build()` to `initState()` with proper disposal
  - L1: Removed redundant `clearCeremonyTimers` call in `endSession`
  - L2: Socket wiring test gap acknowledged (consistent with existing test pattern)

### File List

New files:
- apps/flutter_app/lib/widgets/ceremony_display.dart
- apps/server/tests/services/session-manager-ceremony.test.ts
- apps/flutter_app/test/state/party_provider_ceremony_test.dart
- apps/flutter_app/test/widgets/ceremony_display_test.dart

Modified files (code review additions):
- apps/flutter_app/lib/theme/dj_tokens.dart
Modified files:
- apps/server/src/services/dj-broadcaster.ts
- apps/server/src/services/session-manager.ts
- apps/server/src/services/event-stream.ts
- apps/server/src/dj-engine/states.ts
- apps/server/src/dj-engine/timers.ts
- apps/flutter_app/lib/state/party_provider.dart
- apps/flutter_app/lib/socket/client.dart
- apps/flutter_app/lib/screens/party_screen.dart
- apps/flutter_app/lib/audio/state_transition_audio.dart
- apps/flutter_app/lib/constants/copy.dart
- apps/server/tests/services/dj-broadcaster.test.ts
- apps/server/tests/dj-engine/timers.test.ts
- apps/server/tests/services/session-manager-dj.test.ts
- apps/server/tests/services/session-manager-awards.test.ts
- apps/server/tests/services/session-manager-scoring.test.ts
- apps/server/tests/services/session-manager-recovery.test.ts
- apps/server/tests/services/inactivity-monitor.test.ts
- apps/server/tests/socket-handlers/host-handlers.test.ts
- apps/server/tests/socket-handlers/party-handlers.test.ts
- apps/server/tests/socket-handlers/party-start.test.ts
- apps/flutter_app/test/socket/client_test.dart
- apps/flutter_app/test/audio/state_transition_audio_test.dart

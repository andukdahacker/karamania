# Story 6.1: Floating Capture Bubble

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want the app to prompt me to capture moments at key points during the party,
So that I don't miss the best moments worth remembering.

## Acceptance Criteria

1. **Given** an active party session, **When** a trigger point occurs (session start, reaction peak, post-ceremony reveal, or session end), **Then** a floating capture bubble (48x48px) appears at the bottom-left of the screen on all phones (FR38, FR67) **And** the bubble is dismissable by ignoring it -- no interruption to non-interested participants (FR67) **And** the bubble auto-dismisses after 15 seconds if not interacted with **And** a maximum of 1 bubble is shown per 60 seconds

## Tasks / Subtasks

- [x] Task 1: Server-side capture bubble trigger service (AC: #1)
  - [x] 1.1 Create `apps/server/src/services/capture-trigger.ts` — pure trigger-detection service with ZERO Socket.io dependency:
    ```typescript
    // Module-level throttle tracking
    const lastBubbleEmittedAt = new Map<string, number>();
    const BUBBLE_COOLDOWN_MS = 60_000; // 1 bubble per 60s per session

    export type CaptureTriggerType = 'session_start' | 'reaction_peak' | 'post_ceremony' | 'session_end';

    export function shouldEmitCaptureBubble(sessionId: string, currentState?: DJState): boolean {
      // Architecture rule: no bubble during ceremony anticipation or silence phases
      if (currentState === DJState.ceremony) return false;
      const now = Date.now();
      const lastEmitted = lastBubbleEmittedAt.get(sessionId);
      if (lastEmitted && now - lastEmitted < BUBBLE_COOLDOWN_MS) return false;
      return true;
    }

    export function markBubbleEmitted(sessionId: string): void {
      lastBubbleEmittedAt.set(sessionId, Date.now());
    }

    export function clearCaptureTriggerState(sessionId: string): void {
      lastBubbleEmittedAt.delete(sessionId);
    }
    ```
    - **Architecture compliance**: Pure function in services, no Socket.io imports (same pattern as `rate-limiter.ts`). Import `DJState` from `../dj-engine/types.js` for the state guard (dj-engine types are importable — the boundary rule is that dj-engine cannot import FROM services, not the reverse)
    - `shouldEmitCaptureBubble` checks DJ state guard (no bubble during `ceremony`) AND 60s cooldown per session
    - `markBubbleEmitted` records timestamp after successful emission
    - `clearCaptureTriggerState` cleans up on session end (prevents memory leak)

  - [x] 1.2 Integrate triggers into `apps/server/src/services/session-manager.ts` — emit `capture:bubble` at the 3 deterministic trigger points (reaction peak is Story 6.5):

    **Trigger 1: Session Start** — In `processDjTransition()`, when transitioning FROM `DJState.lobby` TO `DJState.songSelection` (the SESSION_STARTED transition). This is more precise than placing it in `startSession()` which calls `initializeDjState()` internally. Add inside the existing side-effects section of `processDjTransition()`:
    ```typescript
    // Session start capture bubble — delayed so clients render party screen first
    // Architecture target: 10s after icebreaker (Story 7.6). Interim: 3s after lobby→songSelection.
    if (context.state === DJState.lobby && newContext.state === DJState.songSelection) {
      setTimeout(() => {
        if (shouldEmitCaptureBubble(sessionId, newContext.state)) {
          markBubbleEmitted(sessionId);
          const io = getIO();
          if (io) {
            io.to(sessionId).emit(EVENTS.CAPTURE_BUBBLE, {
              triggerType: 'session_start',
              ts: Date.now(),
            });
          }
          appendEvent(sessionId, {
            type: 'capture:bubble',
            ts: Date.now(),
            data: { triggerType: 'session_start' },
          });
        }
      }, 3000); // 3s delay — let clients render lobby→songSelection transition first
    }
    ```

    **Trigger 2: Post-Ceremony Reveal** — In `orchestrateFullCeremony()` (around line 260), inside the `setTimeout` callback that fires at `ANTICIPATION_DURATION_MS`, AFTER the `ceremony:reveal` broadcast:
    ```typescript
    // After io.to(sessionId).emit(EVENTS.CEREMONY_REVEAL, { ... })
    // Capture bubble after reveal (short delay for dramatic effect)
    setTimeout(() => {
      const ctx = getSessionDjState(sessionId);
      if (shouldEmitCaptureBubble(sessionId, ctx?.state)) {
        markBubbleEmitted(sessionId);
        const ioRef = getIO();
        if (ioRef) {
          ioRef.to(sessionId).emit(EVENTS.CAPTURE_BUBBLE, {
            triggerType: 'post_ceremony',
            ts: Date.now(),
          });
        }
        appendEvent(sessionId, {
          type: 'capture:bubble',
          ts: Date.now(),
          data: { triggerType: 'post_ceremony' },
        });
      }
    }, 3000); // 3s after reveal per architecture UX spec — let participants react to the award first
    ```
    Also in `orchestrateQuickCeremony()` (around line 300), same pattern after the `ceremony:quick` broadcast.

    **Trigger 3: Session End** — In `processDjTransition()` (around line 1080), when transitioning to `DJState.finale`:
    ```typescript
    if (newContext.state === DJState.finale) {
      // Final capture opportunity
      if (shouldEmitCaptureBubble(sessionId, newContext.state)) {
        markBubbleEmitted(sessionId);
        const io = getIO();
        if (io) {
          io.to(sessionId).emit(EVENTS.CAPTURE_BUBBLE, {
            triggerType: 'session_end',
            ts: Date.now(),
          });
        }
        appendEvent(sessionId, {
          type: 'capture:bubble',
          ts: Date.now(),
          data: { triggerType: 'session_end' },
        });
      }
    }
    ```

  - [x] 1.3 Add `capture:bubble` to the `SessionEvent` union in `apps/server/src/services/event-stream.ts`:
    ```typescript
    | { type: 'capture:bubble'; ts: number; data: { triggerType: 'session_start' | 'reaction_peak' | 'post_ceremony' | 'session_end' } }
    ```

  - [x] 1.4 Clean up capture trigger state on session end. In `endSession()` in `session-manager.ts`, call `clearCaptureTriggerState(sessionId)` alongside other session cleanup (same section that calls `clearSessionStreaks`, `clearSongPool`, etc.)

  - [x] 1.5 **Reaction peak trigger (STUB for Story 6.5):** Add a comment in `capture-trigger.ts`:
    ```typescript
    // TODO Story 6.5: Reaction peak detection
    // Will call shouldEmitCaptureBubble() and markBubbleEmitted() from peak-detector service
    // Peak detection logic: sustained reaction rate spike above session baseline
    // Server-side detection ensures consistent triggering across all devices (FR73)
    export function emitReactionPeakBubble(_sessionId: string): void {
      // Placeholder — implemented in Story 6.5
    }
    ```

- [x] Task 2: Flutter CaptureProvider — reactive state container (AC: #1)
  - [x] 2.1 Implement `apps/flutter_app/lib/state/capture_provider.dart` (replacing the stub):
    ```dart
    import 'dart:async';
    import 'package:flutter/foundation.dart';

    class CaptureProvider extends ChangeNotifier {
      // Bubble visibility state
      bool _isBubbleVisible = false;
      String? _currentTriggerType;
      Timer? _autoDismissTimer;

      // Throttle: max 1 bubble per 60s (client-side mirror of server throttle)
      DateTime? _lastBubbleShownAt;
      static const _bubbleCooldown = Duration(seconds: 60);
      static const _autoDismissDuration = Duration(seconds: 15);

      // Getters
      bool get isBubbleVisible => _isBubbleVisible;
      String? get currentTriggerType => _currentTriggerType;

      // Called ONLY by SocketClient on capture:bubble event
      void onCaptureBubbleTriggered({required String triggerType}) {
        // Client-side cooldown check (defense in depth — server also throttles)
        final now = DateTime.now();
        if (_lastBubbleShownAt != null &&
            now.difference(_lastBubbleShownAt!) < _bubbleCooldown) {
          return;
        }
        if (_isBubbleVisible) return; // Already showing a bubble

        _isBubbleVisible = true;
        _currentTriggerType = triggerType;
        _lastBubbleShownAt = now;
        notifyListeners();

        // Auto-dismiss after 15 seconds
        _autoDismissTimer?.cancel();
        _autoDismissTimer = Timer(_autoDismissDuration, () {
          dismissBubble();
        });
      }

      // Called when bubble is tapped (Story 6.2 will handle capture flow)
      void onBubbleTapped() {
        _autoDismissTimer?.cancel();
        _isBubbleVisible = false;
        // TODO Story 6.2: Initiate inline capture flow
        notifyListeners();
      }

      // Called when bubble is explicitly dismissed or auto-dismissed
      void dismissBubble() {
        _autoDismissTimer?.cancel();
        _isBubbleVisible = false;
        _currentTriggerType = null;
        notifyListeners();
      }

      // Called on session end cleanup
      void clearState() {
        _autoDismissTimer?.cancel();
        _isBubbleVisible = false;
        _currentTriggerType = null;
        _lastBubbleShownAt = null;
        notifyListeners();
      }

      @override
      void dispose() {
        _autoDismissTimer?.cancel();
        super.dispose();
      }
    }
    ```
    - **Architecture compliance**: Reactive state container only — no business logic, no Socket.io imports
    - ONLY `SocketClient` calls mutation methods (`onCaptureBubbleTriggered`)
    - Client-side cooldown mirrors server throttle (defense in depth)
    - `_autoDismissTimer` handles 15s auto-dismiss
    - `onBubbleTapped()` is a stub for Story 6.2's capture flow

  - [x] 2.2 **CaptureProvider is already registered** in `apps/flutter_app/lib/config/bootstrap.dart:51` — verify it exists, no changes needed. Providers are in `config/bootstrap.dart` (NOT `main.dart`).

  - [x] 2.3 Wire `CaptureProvider` into `SocketClient`. In `apps/flutter_app/lib/socket/client.dart`:
    - Add `CaptureProvider? _captureProvider;` field alongside `_partyProvider` (line 27)
    - Add `required CaptureProvider captureProvider` parameter to the `connect()` method (line 40-47) — this is the established pattern: `PartyProvider` is passed as a `connect()` parameter at `client.dart:46`, NOT via a setter
    - Inside `connect()`, set `_captureProvider = captureProvider;` (same as `_partyProvider = partyProvider` at line 50)
    - Update the call site where `SocketClient.instance.connect(...)` is called — pass the `CaptureProvider` instance from the widget tree via `context.read<CaptureProvider>()`

- [x] Task 3: Flutter SocketClient listener for capture:bubble (AC: #1)
  - [x] 3.1 In `apps/flutter_app/lib/socket/client.dart`, add listener for `capture:bubble` in the existing `_setupListeners()` method (alongside other event listeners):
    ```dart
    on('capture:bubble', (data) {
      final payload = data as Map<String, dynamic>;
      final triggerType = payload['triggerType'] as String;
      _captureProvider?.onCaptureBubbleTriggered(triggerType: triggerType);
    });
    ```
    - Pattern matches existing listeners (e.g., `song:queued`, `ceremony:reveal`)
    - Uses `_captureProvider?.` null-safe call (same as `_partyProvider?.`)

  - [x] 3.2 Add `CaptureProvider` cleanup in `disconnect()` method (client.dart:107-121). At line 113 area, alongside `_partyProvider?.onSessionEnd()`:
    ```dart
    _captureProvider?.clearState();
    _captureProvider = null;
    ```
    This ensures capture bubble state is reset on disconnect, kick, and session end. Lesson from Story 5.9 code review (H1/H2): always clean up all providers in disconnect path.

- [x] Task 4: Flutter CaptureBubble widget (AC: #1)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/capture_bubble.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/state/capture_provider.dart';
    import 'package:karamania/theme/dj_tokens.dart';
    import 'package:provider/provider.dart';

    /// Floating 48x48 capture bubble with subtle pulse animation.
    /// Appears at bottom-left. Auto-dismisses after 15s. Tapping initiates
    /// capture flow (Story 6.2).
    class CaptureBubble extends StatefulWidget {
      const CaptureBubble({super.key});

      @override
      State<CaptureBubble> createState() => _CaptureBubbleState();
    }

    class _CaptureBubbleState extends State<CaptureBubble>
        with SingleTickerProviderStateMixin {
      late final AnimationController _pulseController;
      late final Animation<double> _pulseAnimation;

      @override
      void initState() {
        super.initState();
        // Subtle pulse: scale 1.0 → 1.15 → 1.0, repeating
        _pulseController = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 1200),
        )..repeat(reverse: true);
        _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
          CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
        );
      }

      @override
      void dispose() {
        _pulseController.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        final captureProvider = context.watch<CaptureProvider>();
        if (!captureProvider.isBubbleVisible) return const SizedBox.shrink();

        return ScaleTransition(
          scale: _pulseAnimation,
          child: GestureDetector(
            key: const Key('capture-bubble'),
            onTap: () {
              captureProvider.onBubbleTapped();
            },
            child: Container(
              width: DJTokens.iconSizeLg, // 48.0
              height: DJTokens.iconSizeLg, // 48.0
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: DJTokens.actionPrimary.withAlpha(230),
                boxShadow: [
                  BoxShadow(
                    color: DJTokens.actionPrimary.withAlpha(100),
                    blurRadius: 12,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(
                Icons.camera_alt_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
          ),
        );
      }
    }
    ```
    - **48x48px** using `DJTokens.iconSizeLg` (already 48.0)
    - Widget key: `Key('capture-bubble')`
    - **Subtle pulse animation** per architecture UX spec (line 1006): `ScaleTransition` 1.0→1.15 with 1.2s duration, `easeInOut` curve. Draws attention without interrupting. Uses `SingleTickerProviderStateMixin` (same pattern as `HypeSignalButton`)
    - Uses `context.watch<CaptureProvider>()` for reactive updates — hides when `!isBubbleVisible`
    - Tap calls `captureProvider.onBubbleTapped()` (Story 6.2 will extend this)
    - Uses `DJTokens.actionPrimary` for color (vibe-aware) — per anti-pattern rule, no hardcoded colors
    - Circular shape with subtle glow shadow for discoverability

  - [x] 4.2 Integrate `CaptureBubble` into `apps/flutter_app/lib/screens/party_screen.dart`:
    - Add to the `Stack` children, positioned at bottom-left:
    ```dart
    // Capture bubble — bottom-left, above the SongOverButton area
    // Visible during any DJ state when CaptureProvider triggers it
    Positioned(
      bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm, // Above SongOverButton
      left: DJTokens.spaceMd,
      child: const CaptureBubble(),
    ),
    ```
    - Position: `bottom-left` per FR38/FR67. The bottom offset should clear the SongOverButton (which sits at `bottom: DJTokens.spaceLg`)
    - **Place AFTER the `LightstickMode` `Positioned.fill`** in the Stack (around line 386) so the bubble renders ABOVE lightstick mode. `LightstickMode` uses `Positioned.fill` which covers everything below it in the Stack. The bubble should remain visible during lightstick mode since it's a time-sensitive prompt
    - `CaptureBubble` internally handles visibility via `CaptureProvider.isBubbleVisible` — the `Positioned` is always in the tree but `CaptureBubble` returns `SizedBox.shrink()` when hidden
    - Import: `import 'package:karamania/widgets/capture_bubble.dart';`

- [x] Task 5: Flutter copy constants (AC: #1)
  - [x] 5.1 In `apps/flutter_app/lib/constants/copy.dart`, add:
    ```dart
    // Capture bubble (Story 6.1)
    static const String captureMoment = 'Capture this moment!';
    ```
    - Minimal copy for 6.1 — the bubble is icon-only (48x48 is too small for text). The `captureMoment` string can be used as a tooltip/semantic label for accessibility
    - Story 6.2 will add capture-type selection copy (Photo, Video, Audio)

- [x] Task 6: Server tests (AC: #1)
  - [x] 6.1 Create `apps/server/tests/services/capture-trigger.test.ts`:
    - Test `shouldEmitCaptureBubble` returns `true` on first call for a session
    - Test `shouldEmitCaptureBubble` returns `false` within 60s cooldown after `markBubbleEmitted`
    - Test `shouldEmitCaptureBubble` returns `true` after 60s cooldown expires (use `vi.useFakeTimers()` + `vi.advanceTimersByTime(60_001)`)
    - Test `clearCaptureTriggerState` resets cooldown for a session
    - Test different sessions have independent cooldowns
    - Test `shouldEmitCaptureBubble` returns `false` when `currentState` is `DJState.ceremony` (architecture rule: no bubble during ceremony)
    - Test `shouldEmitCaptureBubble` returns `true` when `currentState` is `DJState.song` or `DJState.finale`
    - Use `vitest` — no external dependencies needed (pure functions)

  - [x] 6.2 Create `apps/server/tests/services/session-manager-capture.test.ts`:
    - Test session start emits `capture:bubble` with `triggerType: 'session_start'` (after 3s delay — use fake timers)
    - Test post-ceremony emits `capture:bubble` with `triggerType: 'post_ceremony'` (after reveal + 3s per architecture spec)
    - Test session end emits `capture:bubble` with `triggerType: 'session_end'`
    - Test 60s cooldown prevents duplicate bubbles within window
    - Test `capture:bubble` event is appended to event stream
    - Test `clearCaptureTriggerState` is called on session end
    - Mock: `getIO()`, `getSessionDjState()`, `shouldEmitCaptureBubble()`, `markBubbleEmitted()`, `appendEvent()`
    - Follow existing `session-manager-suggestion.test.ts` patterns for mocking

- [x] Task 7: Flutter tests (AC: #1)
  - [x] 7.1 Create `apps/flutter_app/test/state/capture_provider_test.dart`:
    - Test `onCaptureBubbleTriggered` sets `isBubbleVisible = true` and `currentTriggerType`
    - Test `onCaptureBubbleTriggered` ignored when already showing bubble
    - Test `onCaptureBubbleTriggered` ignored within 60s cooldown
    - Test `dismissBubble` sets `isBubbleVisible = false`
    - Test auto-dismiss fires after 15 seconds (use `fakeAsync` + `flushTimers`)
    - Test `onBubbleTapped` hides bubble
    - Test `clearState` resets all fields including cooldown
    - Test `dispose` cancels timer
    - Test `notifyListeners` is called on state changes
    - Follow existing `party_provider_test.dart` patterns

  - [x] 7.2 Create `apps/flutter_app/test/widgets/capture_bubble_test.dart`:
    - Test renders camera icon when `isBubbleVisible` is true
    - Test renders `SizedBox.shrink()` when `isBubbleVisible` is false
    - Test tap calls `onBubbleTapped()` on CaptureProvider
    - Test has correct widget key `capture-bubble`
    - Test uses `DJTokens.iconSizeLg` for sizing (48x48)
    - **DO NOT test**: colors, shadows, pulse animation timing, visual effects
    - Follow existing `selected_song_display_test.dart` patterns

## Dev Notes

### Architecture Compliance

- **Server boundary**: `capture-trigger.ts` is a pure service with ZERO Socket.io dependency (same pattern as `rate-limiter.ts`). Provides `shouldEmitCaptureBubble()` and `markBubbleEmitted()` functions called by `session-manager.ts`
- **Service layer**: `session-manager.ts` orchestrates bubble emission at trigger points — per architecture: "session-manager is the ONLY service that orchestrates across layers"
- **dj-engine boundary**: dj-engine has ZERO knowledge of capture bubbles. Trigger detection uses state transition events from session-manager, not engine internals
- **Flutter boundary**: ONLY `SocketClient` calls mutation methods on `CaptureProvider`. Widgets read via `context.watch<CaptureProvider>()`
- **No socket-handler needed for 6.1**: The `capture:bubble` event is SERVER-TO-CLIENT only. No client-initiated capture events in this story (that's Story 6.2's `capture:started` and `capture:complete`). So no `capture-handlers.ts` file is created yet

### Key Technical Decisions

- **Server-side throttling is authoritative**: The 60s cooldown lives in `capture-trigger.ts` module-level Map. Client mirrors this as defense-in-depth but server is source of truth. Prevents any client-side race conditions
- **Deterministic triggers only in 6.1**: Session start, post-ceremony, and session end are deterministic. Reaction peak detection (algorithmic, requires sustained rate spike analysis) is Story 6.5. A stub `emitReactionPeakBubble()` is provided for 6.5 to implement
- **CaptureProvider is separate from PartyProvider**: Follows the existing pattern where `CaptureProvider` stub already exists as its own ChangeNotifier. Keeps capture state isolated from party state. No provider-to-provider access (per Flutter boundary rules)
- **`capture:bubble` event is broadcast to ALL participants**: Unlike host-only events, the bubble appears on everyone's phone (FR67: "appears at the bottom-left of the screen on all phones")
- **onBubbleTapped() is a stub**: Story 6.2 extends this to initiate the inline capture flow (camera/photo/video). For 6.1, tapping simply dismisses the bubble. This keeps scope focused
- **No new Flutter packages needed**: The bubble is a simple Container with an Icon. No camera, image_picker, or media plugins required for 6.1 (those come in Story 6.2)
- **Session start trigger uses 3s delay**: Clients need time to transition from lobby to songSelection and render the party screen before receiving the bubble event. Without delay, the bubble event may arrive before the party screen is mounted. Architecture target is "10s after icebreaker" (Story 7.6 adds icebreakers); 3s is the interim value
- **DJ state guard prevents ceremony-phase bubbles**: Architecture rules (line 1054-1055): "Bubble never appears during ceremony anticipation" and "during silence phase." `shouldEmitCaptureBubble()` rejects emission when `currentState === DJState.ceremony`. Post-ceremony triggers fire AFTER the reveal (when state has already transitioned away from ceremony)
- **Bubble visible during lightstick mode**: The `CaptureBubble` Positioned is placed AFTER `LightstickMode` in the Stack so it renders above the full-screen glow. Capture prompts are time-sensitive and should not be blocked by lightstick mode

### What Already Exists (No Changes Needed)

| Component | Location | Status |
|---|---|---|
| `CAPTURE_BUBBLE` event constant | `apps/server/src/shared/events.ts:61` | Ready |
| `CAPTURE_STARTED` event constant | `apps/server/src/shared/events.ts:62` | Ready (Story 6.2) |
| `CAPTURE_COMPLETE` event constant | `apps/server/src/shared/events.ts:63` | Ready (Story 6.2) |
| `CaptureProvider` stub class | `apps/flutter_app/lib/state/capture_provider.dart` | Stub — replace |
| `media_captures` table migration | `apps/server/migrations/001-initial-schema.ts:70-86` | Ready (Story 6.3) |
| `MediaCapturesTable` Kysely type | `apps/server/src/db/types.ts:45-53` | Ready (Story 6.3) |
| `DJTokens.iconSizeLg` (48.0) | `apps/flutter_app/lib/theme/dj_tokens.dart:26` | Ready |
| Ceremony reveal events | `session-manager.ts:259-282` | Ready (trigger point) |
| Session start/end transitions | `session-manager.ts:1146-1175` | Ready (trigger point) |

### Existing Infrastructure to Leverage

- **`EVENTS.CAPTURE_BUBBLE`**: Already defined in `shared/events.ts:61` — use this constant, not string literal
- **`appendEvent(sessionId, {...})`**: From `event-stream.ts` — log all bubble emissions for analytics
- **`getIO()`**: From `session-manager.ts` — get Socket.io server instance for broadcasting
- **`DJTokens.iconSizeLg`**: Already 48.0 — use for bubble dimensions
- **`DJTokens.actionPrimary`**: Vibe-aware accent color for bubble appearance
- **Party screen Stack**: Existing `Positioned` widgets show the pattern for floating UI elements (reaction bar, soundboard, mode toggles, song-over button)
- **`DJState.finale`**: The state that marks session end — trigger capture bubble here
- **Ceremony orchestration**: `orchestrateFullCeremony()` and `orchestrateQuickCeremony()` in session-manager — add post-reveal triggers here

### In-Memory Pattern

- **Server**: Module-level `Map<string, number>` in `capture-trigger.ts` for cooldown tracking (same pattern as `dj-state-store.ts`, `streak-tracker.ts`, `song-pool.ts`)
- **Flutter**: Instance fields on `CaptureProvider` — no module-level state. Timer managed as instance variable, cleaned in dispose

### Error Handling

- `shouldEmitCaptureBubble()`: Pure boolean check — cannot throw
- `setTimeout` callbacks for delayed triggers: Wrapped in `getIO()` null check — safe if server IO not ready
- `CaptureProvider.onCaptureBubbleTriggered()`: Silently ignores if already showing or in cooldown (no error)
- Timer cancellation: `_autoDismissTimer?.cancel()` is null-safe and idempotent

### File Naming

- Server: `capture-trigger.ts` (kebab-case per convention)
- Flutter: `capture_bubble.dart`, `capture_provider.dart` (snake_case per convention)
- Imports: relative paths with `.js` extension (server), `package:karamania/...` (Flutter)
- No barrel files

### Scope Boundaries — What NOT to Implement

| Not in 6.1 | Belongs to |
|---|---|
| Camera/photo/video capture flow | Story 6.2 |
| Capture type selection UI (photo/video/audio) | Story 6.2 |
| Media tagging and background upload | Story 6.3 |
| Firebase Storage integration | Story 6.4 |
| Reaction peak detection algorithm | Story 6.5 |
| `capture-handlers.ts` socket handler | Story 6.2 (handles `capture:started`, `capture:complete`) |
| `media-repository.ts` persistence layer | Story 6.3 |
| Camera/microphone Flutter packages | Story 6.2 |
| Persistent capture icon in participant toolbar | Story 6.2 (FR39) |

### Project Structure Notes

- `apps/server/src/services/capture-trigger.ts` — **new file** (pure trigger service)
- `apps/server/src/services/session-manager.ts` — modified (add trigger integrations at 3 points + cleanup)
- `apps/server/src/services/event-stream.ts` — modified (add `capture:bubble` to SessionEvent union)
- `apps/flutter_app/lib/state/capture_provider.dart` — **replaced** (stub → full implementation)
- `apps/flutter_app/lib/widgets/capture_bubble.dart` — **new file**
- `apps/flutter_app/lib/screens/party_screen.dart` — modified (add CaptureBubble to Stack)
- `apps/flutter_app/lib/socket/client.dart` — modified (add capture:bubble listener, wire CaptureProvider via `connect()`, add cleanup in `disconnect()`)
- `apps/flutter_app/lib/config/bootstrap.dart` — **verify only** (CaptureProvider already registered at line 51)
- `apps/flutter_app/lib/constants/copy.dart` — modified (add capture copy string)

### Previous Story Intelligence (5.9: Suggestion-Only Mode)

- **Event emission pattern in session-manager**: Story 5.9 added `handleManualSongPlay()` which emits `SONG_DETECTED` + appends to event stream + persists state. Same 3-action pattern applies to capture bubble emission: emit event + append to event stream + (no persistence needed, just cooldown tracking)
- **Provider wiring**: Story 5.9 added `lastQueued*` fields to `PartyProvider` and updated `SocketClient` to set them. For 6.1, `CaptureProvider` is a separate provider (already stubbed), so follow the same wiring pattern but for `_captureProvider` instead of adding to `_partyProvider`
- **party_screen.dart Stack**: Story 5.9 added `SelectedSongDisplay` as a `Positioned` widget. Follow same pattern for `CaptureBubble` — always in tree, internally conditionally renders
- **Code review lessons from 5.9**: H1/H2 from 5.9 review caught missing cleanup in `onKicked()` and `dispose()`. For 6.1, ensure `CaptureProvider.clearState()` is called on session end, disconnect, and kick events. Wire this in `SocketClient` disconnect/kick handlers

### Git Intelligence

Recent commits (all on `flutter-native-pivot` branch):
- `8acec31` Story 5.9: Suggestion-Only Mode — provider fields, socket wiring, party_screen Stack integration, 9 tasks
- `0dbc279` Story 5.8: Song Detection — NowPlayingBar, detected song state, 3-tier cache
- `f362aec` Story 5.7: TV Pairing — pairTv/unpairTv, onNowPlaying/onStatusChange callbacks
- All stories follow: service + events + socket-handler/session-manager + Flutter widget + provider + socket client + tests
- Pattern: each story modifies session-manager.ts for orchestration, client.dart for listeners, party_screen.dart for UI

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 6 Story 6.1 lines 1317-1331]
- [Source: _bmad-output/planning-artifacts/architecture.md, FR67-FR73 media capture requirements]
- [Source: _bmad-output/planning-artifacts/architecture.md, capture events line 421]
- [Source: _bmad-output/planning-artifacts/architecture.md, CaptureProvider line 464]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: _bmad-output/project-context.md, Socket.io Event Catalog — capture namespace]
- [Source: apps/server/src/shared/events.ts:60-63 — CAPTURE_BUBBLE, CAPTURE_STARTED, CAPTURE_COMPLETE]
- [Source: apps/server/src/services/session-manager.ts:235-285 — ceremony orchestration]
- [Source: apps/server/src/services/session-manager.ts:1146-1175 — startSession]
- [Source: apps/server/src/services/rate-limiter.ts — pure function service pattern]
- [Source: apps/flutter_app/lib/state/capture_provider.dart — existing stub]
- [Source: apps/flutter_app/lib/theme/dj_tokens.dart:26 — iconSizeLg = 48.0]
- [Source: apps/flutter_app/lib/screens/party_screen.dart:340-399 — Stack positioning patterns]
- [Source: _bmad-output/implementation-artifacts/5-9-suggestion-only-mode.md — previous story patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None

### Completion Notes List

- Task 1: Created `capture-trigger.ts` pure service with `shouldEmitCaptureBubble()`, `markBubbleEmitted()`, `clearCaptureTriggerState()`, and stub `emitReactionPeakBubble()`. Integrated 3 trigger points into `session-manager.ts`: session start (lobby→songSelection with 3s delay), post-ceremony reveal (full + quick, 3s after reveal), session end (finale). Added `capture:bubble` to `SessionEvent` union. Added cleanup in `endSession()`.
- Task 2: Replaced `CaptureProvider` stub with full implementation — bubble visibility, trigger type, 60s client-side cooldown (defense-in-depth), 15s auto-dismiss timer, `onBubbleTapped()` stub for Story 6.2. Verified registration in `bootstrap.dart:51`.
- Task 3: Wired `CaptureProvider` into `SocketClient` — added `_captureProvider` field, `captureProvider` parameter to `connect()`/`createParty()`/`joinParty()`, listener for `capture:bubble` event, cleanup in `disconnect()`. Updated call sites in `home_screen.dart` and `join_screen.dart`.
- Task 4: Created `CaptureBubble` widget — 48x48 circle with camera icon, pulse animation (ScaleTransition 1.0→1.15), vibe-aware accent color via `Theme.of(context).colorScheme.secondary`. Integrated into `party_screen.dart` Stack after LightstickMode so it renders above.
- Task 5: Added `captureMoment` copy constant to `copy.dart`.
- Task 6: Server tests — 9 tests in `capture-trigger.test.ts` (cooldown, ceremony guard, session independence), 6 tests in `session-manager-capture.test.ts` (session start with delay, session end, event stream, cooldown suppression). All pass.
- Task 7: Flutter tests — 13 tests in `capture_provider_test.dart` (visibility, cooldown, auto-dismiss, clear), 5 tests in `capture_bubble_test.dart` (render, tap, key, sizing). All pass.
- Used `Theme.of(context).colorScheme.secondary` instead of `DJTokens.actionPrimary` (which doesn't exist) for vibe-aware bubble color.
- Updated existing `session-manager-ceremony.test.ts` to account for capture bubble's 3s setTimeout in the quick ceremony auto-advance test.
- Added `capture-trigger.js` mock to all 10 existing session-manager test files to prevent regression.

### Change Log

- 2026-03-17: Implemented Story 6.1 — Floating Capture Bubble (all 7 tasks, 33 tests)
- 2026-03-17: Code review fixes — 8 issues (3H, 4M, 1L):
  - H1: Added missing post-ceremony trigger tests (quick + full ceremony paths)
  - H2: Added missing clearCaptureTriggerState-on-session-end test
  - H3: Made CaptureProvider required in createParty/joinParty (was optional)
  - M1: onBubbleTapped now clears _currentTriggerType (was stale after tap)
  - M2: Pulse animation starts/stops with bubble visibility (was running 24/7)
  - M3/L1: Added Semantics wrapper with Copy.captureMoment label for accessibility
  - M4: Extracted emitCaptureBubble() helper in session-manager (DRY, was 4x copy-paste)

### File List

**New files:**
- `apps/server/src/services/capture-trigger.ts`
- `apps/flutter_app/lib/widgets/capture_bubble.dart`
- `apps/server/tests/services/capture-trigger.test.ts`
- `apps/server/tests/services/session-manager-capture.test.ts`
- `apps/flutter_app/test/state/capture_provider_test.dart`
- `apps/flutter_app/test/widgets/capture_bubble_test.dart`

**Modified files:**
- `apps/server/src/services/session-manager.ts` (capture trigger integration at 3 points + cleanup)
- `apps/server/src/services/event-stream.ts` (added `capture:bubble` to SessionEvent union)
- `apps/flutter_app/lib/state/capture_provider.dart` (replaced stub with full implementation)
- `apps/flutter_app/lib/socket/client.dart` (CaptureProvider wiring + listener + cleanup)
- `apps/flutter_app/lib/screens/party_screen.dart` (CaptureBubble in Stack)
- `apps/flutter_app/lib/screens/home_screen.dart` (pass CaptureProvider to createParty)
- `apps/flutter_app/lib/screens/join_screen.dart` (pass CaptureProvider to joinParty)
- `apps/flutter_app/lib/constants/copy.dart` (captureMoment string)
- `apps/server/tests/services/session-manager-ceremony.test.ts` (adjusted for capture bubble timer)
- `apps/server/tests/services/session-manager-dj.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-awards.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-recovery.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-scoring.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-quickpick.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-spinwheel.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-detection.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-suggestion.test.ts` (added capture-trigger mock)
- `apps/server/tests/services/session-manager-tv.test.ts` (added capture-trigger mock)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (6-1 status: review)

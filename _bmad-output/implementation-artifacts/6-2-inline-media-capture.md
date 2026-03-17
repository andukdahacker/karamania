# Story 6.2: Inline Media Capture

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to quickly capture a photo, video, or audio clip without leaving the party screen,
So that capturing moments is seamless and doesn't interrupt my party experience.

## Acceptance Criteria

1. **Given** a capture bubble is displayed, **When** a participant taps the bubble, **Then** the bubble expands into a capture mode selector with three options: Photo, Video (5s max), Audio (10s max) (FR68) **And** capture initiation takes exactly 2 taps: one to pop the bubble, one to start capture (FR68)

2. **Given** the capture mode selector is shown, **When** the participant selects a capture type, **Then** capture uses native device camera/microphone APIs with uniform behavior on iOS and Android (FR69) **And** capture completes without navigating away from the party screen (FR69) **And** no preview or edit screen is shown — capture auto-completes

3. **Given** a photo capture is selected, **When** the participant taps the photo option, **Then** the native camera opens via `image_picker` (front-facing default), participant takes one photo, and it auto-closes returning to the party screen

4. **Given** a video capture is selected, **When** the participant taps the video option, **Then** an inline viewfinder appears with a visual countdown ring showing remaining time (5s max), tap again to stop early, auto-stops at 5s

5. **Given** an audio capture is selected, **When** the participant taps the audio option, **Then** a pulsing waveform visualization appears (no viewfinder), tap to start recording, auto-stops at 10s or tap to stop early

6. **Given** a participant wants to capture outside of bubble prompts, **When** they tap the persistent capture icon in the participant toolbar, **Then** they can manually initiate a media capture at any time (FR39) **And** the manual capture is independent of the bubble prompt system

7. **Given** a capture is initiated (bubble or manual), **When** the capture starts, **Then** a `capture:started` event is emitted to the server with `{captureType, triggerType}` **And** when capture completes, a `capture:complete` event is emitted with `{captureType, triggerType, durationMs}` (NOTE: `filePath` is deferred to Story 6.3 which handles upload queueing — captured files remain local-only in 6.2)

## Tasks / Subtasks

- [x] Task 1: Add Flutter dependencies for media capture (AC: #2, #3, #4, #5)
  - [x] 1.1 Add `image_picker` to `apps/flutter_app/pubspec.yaml` — handles photo and video capture natively on iOS and Android:
    ```yaml
    dependencies:
      image_picker: ^1.1.2
    ```
    - `image_picker` provides uniform native camera access on both platforms. Opens as native overlay, returns to app seamlessly — WebSocket stays connected
    - **DO NOT add `camera` package** — `image_picker` is sufficient for Story 6.2's capture-and-return flow. The `camera` package is for custom viewfinder UIs (not needed here)

  - [x] 1.2 Add `record` to `apps/flutter_app/pubspec.yaml` — handles audio recording on both platforms:
    ```yaml
    dependencies:
      record: ^5.2.0
    ```
    - `record` provides cross-platform audio recording from microphone to file. Supports pause/resume, multiple codecs
    - Uses AVFoundation on iOS, AudioRecord+MediaCodec on Android

  - [x] 1.3 Add `path_provider` to `apps/flutter_app/pubspec.yaml` — required for audio capture temp file storage:
    ```yaml
    dependencies:
      path_provider: ^2.1.5
    ```
    - Provides `getTemporaryDirectory()` used by audio capture to write `.m4a` files
    - May already be a transitive dependency, but must be explicit for direct usage

  - [x] 1.4 Add iOS permissions to `apps/flutter_app/ios/Runner/Info.plist`:
    ```xml
    <key>NSCameraUsageDescription</key>
    <string>Karamania needs camera access to capture party moments</string>
    <key>NSMicrophoneUsageDescription</key>
    <string>Karamania needs microphone access to record party audio</string>
    ```
    - Check if these already exist before adding duplicates
    - Android permissions: `image_picker` and `record` handle runtime permissions automatically via their respective Android platform implementations

  - [x] 1.5 Run `flutter pub get` to install dependencies

- [x] Task 2: Server-side capture event handlers (AC: #7)
  - [x] 2.1 Create `apps/server/src/socket-handlers/capture-handlers.ts` — handle `capture:started` and `capture:complete` events:
    ```typescript
    import type { Server as SocketIOServer } from 'socket.io';
    import type { AuthenticatedSocket } from '../shared/socket-types.js';
    import { EVENTS } from '../shared/events.js';
    import { appendEvent } from '../services/event-stream.js';

    export function registerCaptureHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
      socket.on(EVENTS.CAPTURE_STARTED, (data: {
        captureType: 'photo' | 'video' | 'audio';
        triggerType: 'session_start' | 'reaction_peak' | 'post_ceremony' | 'session_end' | 'manual';
      }) => {
        const sessionId = socket.data.sessionId;
        if (!sessionId) return;

        appendEvent(sessionId, {
          type: 'capture:started',
          ts: Date.now(),
          userId: socket.data.userId,
          data: {
            captureType: data.captureType,
            triggerType: data.triggerType,
          },
        });
      });

      socket.on(EVENTS.CAPTURE_COMPLETE, (data: {
        captureType: 'photo' | 'video' | 'audio';
        triggerType: 'session_start' | 'reaction_peak' | 'post_ceremony' | 'session_end' | 'manual';
        durationMs?: number;
      }) => {
        const sessionId = socket.data.sessionId;
        if (!sessionId) return;

        appendEvent(sessionId, {
          type: 'capture:complete',
          ts: Date.now(),
          userId: socket.data.userId,
          data: {
            captureType: data.captureType,
            triggerType: data.triggerType,
            durationMs: data.durationMs,
          },
        });

        // NOTE: Actual media upload and storage is Story 6.3/6.4
        // This handler only logs the event for analytics
      });
    }
    ```
    - **CRITICAL**: Use `AuthenticatedSocket` from `../shared/socket-types.js` — NOT generic `Socket`. All existing handlers use `AuthenticatedSocket` which types `socket.data.sessionId` and `socket.data.userId` correctly. Use `SocketIOServer` type alias for the Server import (matches existing handler conventions)
    - **Architecture compliance**: Socket handlers call services (event-stream). NEVER call persistence directly
    - Pattern matches existing handlers (e.g., `reaction-handlers.ts`, `song-handlers.ts`)
    - `triggerType: 'manual'` added for FR39 persistent capture icon (not a bubble trigger)

  - [x] 2.2 Register `capture-handlers.ts` in `apps/server/src/socket-handlers/connection-handler.ts` (this is where ALL socket handlers are registered — verify by finding `registerReactionHandlers`, `registerSongHandlers` etc.). Add sibling import:
    ```typescript
    import { registerCaptureHandlers } from './capture-handlers.js';
    // ... in the connection handler function, alongside other handler registrations:
    registerCaptureHandlers(socket, io);
    ```
    - Import path is `./capture-handlers.js` (sibling in same `socket-handlers/` directory)

  - [x] 2.3 Add `capture:started` and `capture:complete` to the `SessionEvent` union in `apps/server/src/services/event-stream.ts`:
    ```typescript
    | { type: 'capture:started'; ts: number; userId: string; data: { captureType: 'photo' | 'video' | 'audio'; triggerType: string } }
    | { type: 'capture:complete'; ts: number; userId: string; data: { captureType: 'photo' | 'video' | 'audio'; triggerType: string; durationMs?: number } }
    ```
    - **IMPORTANT**: `userId` is at the top level (alongside `ts`), NOT inside `data`. This matches the codebase convention for all user-initiated events (`reaction:sent`, `party:joined`, `lightstick:toggled`, etc.). Only server-initiated events like `capture:bubble` omit `userId` at top level
    ```

- [x] Task 3: Expand CaptureProvider for capture flow state (AC: #1, #2, #6)
  - [x] 3.1 Extend `apps/flutter_app/lib/state/capture_provider.dart` with capture flow state. Add these fields and methods to the existing class:
    ```dart
    // --- Capture flow state (Story 6.2) ---

    // Capture mode selector visibility (after bubble pop)
    bool _isSelectorVisible = false;
    bool get isSelectorVisible => _isSelectorVisible;

    // Active capture state
    CaptureType? _activeCaptureType;
    CaptureType? get activeCaptureType => _activeCaptureType;

    bool _isCapturing = false;
    bool get isCapturing => _isCapturing;

    // Track trigger source for analytics
    String _captureTriggerType = 'manual';
    String get captureTriggerType => _captureTriggerType;

    // Video/audio countdown seconds
    int _recordingSecondsRemaining = 0;
    int get recordingSecondsRemaining => _recordingSecondsRemaining;

    // Recording countdown tick timer
    Timer? _countdownTimer;
    ```

    Add the `CaptureType` enum at the top of the file (outside the class):
    ```dart
    /// Capture types — must stay in sync with server-side type union
    /// in capture-handlers.ts: 'photo' | 'video' | 'audio'
    enum CaptureType { photo, video, audio }
    ```

  - [x] 3.2 Update `onBubbleTapped()` to show the capture mode selector instead of just dismissing:
    ```dart
    void onBubbleTapped() {
      _autoDismissTimer?.cancel();
      _isBubbleVisible = false;
      _captureTriggerType = _currentTriggerType ?? 'manual';
      _currentTriggerType = null; // Clear stale trigger (6.1 code review M1 pattern)
      _isSelectorVisible = true;
      notifyListeners();
    }
    ```

  - [x] 3.3 Add method to initiate manual capture (FR39 persistent icon):
    ```dart
    void onManualCaptureTriggered() {
      if (_isCapturing || _isSelectorVisible) return;
      _captureTriggerType = 'manual';
      _isSelectorVisible = true;
      notifyListeners();
    }
    ```

  - [x] 3.4 Add capture lifecycle methods:
    ```dart
    void onCaptureTypeSelected(CaptureType type) {
      _isSelectorVisible = false;
      _activeCaptureType = type;
      _isCapturing = true;

      if (type == CaptureType.video) {
        _recordingSecondsRemaining = 5;
        _startCountdown();
      } else if (type == CaptureType.audio) {
        _recordingSecondsRemaining = 10;
        _startCountdown();
      }

      notifyListeners();
    }

    void _startCountdown() {
      _countdownTimer?.cancel();
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        _recordingSecondsRemaining--;
        if (_recordingSecondsRemaining <= 0) {
          timer.cancel();
          // Auto-stop is handled by the capture overlay widget
        }
        notifyListeners();
      });
    }

    void onCaptureComplete() {
      _countdownTimer?.cancel();
      _isCapturing = false;
      _activeCaptureType = null;
      _recordingSecondsRemaining = 0;
      notifyListeners();
    }

    void onCaptureCancelled() {
      _countdownTimer?.cancel();
      _isSelectorVisible = false;
      _isCapturing = false;
      _activeCaptureType = null;
      _recordingSecondsRemaining = 0;
      notifyListeners();
    }
    ```

  - [x] 3.5 Update `dismissBubble()` and `clearState()` to also reset capture flow state:
    ```dart
    void dismissBubble() {
      _autoDismissTimer?.cancel();
      _isBubbleVisible = false;
      _currentTriggerType = null;
      _isSelectorVisible = false; // Also dismiss selector if open
      notifyListeners();
    }

    void clearState() {
      _autoDismissTimer?.cancel();
      _countdownTimer?.cancel();
      _isBubbleVisible = false;
      _currentTriggerType = null;
      _lastBubbleShownAt = null;
      _isSelectorVisible = false;
      _isCapturing = false;
      _activeCaptureType = null;
      _recordingSecondsRemaining = 0;
      _captureTriggerType = 'manual';
      notifyListeners();
    }
    ```

  - [x] 3.6 Update `dispose()` to cancel all timers:
    ```dart
    @override
    void dispose() {
      _autoDismissTimer?.cancel();
      _countdownTimer?.cancel();
      super.dispose();
    }
    ```

- [x] Task 4: Create CaptureOverlay widget — capture mode selector + active capture UI (AC: #1, #2, #3, #4, #5)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/capture_overlay.dart` — the full inline capture experience:
    ```dart
    import 'dart:async';
    import 'dart:io';
    import 'package:flutter/material.dart';
    import 'package:image_picker/image_picker.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/socket/client.dart';
    import 'package:karamania/state/capture_provider.dart';
    import 'package:karamania/theme/dj_tokens.dart';
    import 'package:provider/provider.dart';
    import 'package:record/record.dart';

    /// Inline capture overlay — shows mode selector after bubble pop,
    /// then handles photo/video/audio capture without leaving party screen.
    class CaptureOverlay extends StatefulWidget {
      const CaptureOverlay({super.key});

      @override
      State<CaptureOverlay> createState() => _CaptureOverlayState();
    }
    ```

    The overlay has TWO phases:

    **Phase 1 — Mode Selector** (when `isSelectorVisible == true`):
    - Three circular buttons in a row: 📷 Photo · 📹 Video · 🎤 Audio
    - Appears at same position where the bubble was (bottom-left area)
    - Tap outside to cancel (calls `onCaptureCancelled()`)
    - 200ms fade-in animation per architecture UX spec
    - Each button labeled with text from `Copy` constants

    **Phase 2 — Active Capture** (when `isCapturing == true`):
    - **Photo**: Call `ImagePicker().pickImage(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front)`. On return (non-null), emit `capture:complete`, call `onCaptureComplete()`. If null (user cancelled native picker), call `onCaptureCancelled()`
    - **Video**: Call `ImagePicker().pickVideo(source: ImageSource.camera, preferredCameraDevice: CameraDevice.front, maxDuration: Duration(seconds: 5))`. Show countdown ring overlay while recording. On return, emit `capture:complete` with `durationMs`, call `onCaptureComplete()`
    - **Audio**: Use `AudioRecorder()` from `record` package. Show pulsing waveform indicator. Auto-stop at 10s. Tap-to-stop early. On complete, emit `capture:complete` with `durationMs`, call `onCaptureComplete()`

  - [x] 4.2 **Mode Selector UI implementation details:**
    ```dart
    Widget _buildModeSelector(CaptureProvider provider) {
      return GestureDetector(
        key: const Key('capture-selector-backdrop'),
        onTap: () => provider.onCaptureCancelled(),
        behavior: HitTestBehavior.opaque,
        child: Align(
          alignment: Alignment.bottomLeft,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm,
              left: DJTokens.spaceMd,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildCaptureButton(
                  key: 'capture-photo',
                  icon: Icons.camera_alt_rounded,
                  label: Copy.capturePhoto,
                  onTap: () => _startCapture(provider, CaptureType.photo),
                ),
                SizedBox(width: DJTokens.spaceSm),
                _buildCaptureButton(
                  key: 'capture-video',
                  icon: Icons.videocam_rounded,
                  label: Copy.captureVideo,
                  onTap: () => _startCapture(provider, CaptureType.video),
                ),
                SizedBox(width: DJTokens.spaceSm),
                _buildCaptureButton(
                  key: 'capture-audio',
                  icon: Icons.mic_rounded,
                  label: Copy.captureAudio,
                  onTap: () => _startCapture(provider, CaptureType.audio),
                ),
              ],
            ),
          ),
        ),
      );
    }
    ```
    - Each button: 56x56 circle with icon + label below
    - Use `Theme.of(context).colorScheme.secondary` for button color (same as CaptureBubble — vibe-aware, Story 6.1 code review established this pattern)
    - Widget keys: `capture-photo`, `capture-video`, `capture-audio`

  - [x] 4.3 **Photo capture flow:**
    ```dart
    Future<void> _capturePhoto(CaptureProvider provider) async {
      SocketClient.instance.emitCaptureStarted(
        captureType: 'photo',
        triggerType: provider.captureTriggerType,
      );

      final picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
      );

      if (image != null) {
        // Capture succeeded — file at image.path
        // Story 6.3 will handle upload queueing
        SocketClient.instance.emitCaptureComplete(
          captureType: 'photo',
          triggerType: provider.captureTriggerType,
        );
        provider.onCaptureComplete();
      } else {
        // User cancelled native picker
        provider.onCaptureCancelled();
      }
    }
    ```
    - `ImageSource.camera` opens native camera — NOT gallery
    - `preferredCameraDevice: CameraDevice.front` for selfie default (party moments)
    - No preview/edit — auto-completes on capture (Locket pattern per architecture)
    - File stored at `image.path` — Story 6.3 queues for upload
    - Uses `SocketClient.instance.emitCaptureStarted/Complete()` wrappers — NEVER call `emit()` directly from widgets

  - [x] 4.4 **Video capture flow:**
    ```dart
    Future<void> _captureVideo(CaptureProvider provider) async {
      final stopwatch = Stopwatch()..start();

      SocketClient.instance.emitCaptureStarted(
        captureType: 'video',
        triggerType: provider.captureTriggerType,
      );

      final picker = ImagePicker();
      final XFile? video = await picker.pickVideo(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxDuration: const Duration(seconds: 5),
      );

      stopwatch.stop();

      if (video != null) {
        SocketClient.instance.emitCaptureComplete(
          captureType: 'video',
          triggerType: provider.captureTriggerType,
          durationMs: stopwatch.elapsedMilliseconds,
        );
        provider.onCaptureComplete();
      } else {
        provider.onCaptureCancelled();
      }
    }
    ```
    - `maxDuration: Duration(seconds: 5)` enforces the 5s limit at the native level
    - Uses `Stopwatch` for accurate duration measurement — the CaptureProvider countdown timer runs independently and may not sync with native camera recording start/stop
    - NOTE: `image_picker` opens native camera for video. The native picker enforces `maxDuration` itself. The CaptureProvider countdown is informational for audio only (where capture is inline)

  - [x] 4.5 **Audio capture flow:**
    ```dart
    // State fields on _CaptureOverlayState:
    AudioRecorder? _activeRecorder;
    Timer? _audioStopTimer;
    Stopwatch? _audioStopwatch;

    Future<void> _captureAudio(CaptureProvider provider) async {
      final recorder = AudioRecorder();

      if (!await recorder.hasPermission()) {
        provider.onCaptureCancelled();
        return;
      }

      SocketClient.instance.emitCaptureStarted(
        captureType: 'audio',
        triggerType: provider.captureTriggerType,
      );

      // Get temp directory for audio file
      final tempDir = await getTemporaryDirectory();
      final filePath = '${tempDir.path}/capture_${DateTime.now().millisecondsSinceEpoch}.m4a';

      try {
        await recorder.start(
          const RecordConfig(encoder: AudioEncoder.aacLc),
          path: filePath,
        );
      } catch (e) {
        // Microphone unavailable or other platform error
        recorder.dispose();
        provider.onCaptureCancelled();
        return;
      }

      _audioStopwatch = Stopwatch()..start();
      _activeRecorder = recorder;

      // Auto-stop timer (10s max)
      _audioStopTimer = Timer(const Duration(seconds: 10), () async {
        if (await recorder.isRecording()) {
          final path = await recorder.stop();
          _onAudioComplete(provider, path);
        }
      });
    }

    Future<void> _stopAudioRecording(CaptureProvider provider) async {
      _audioStopTimer?.cancel();
      if (_activeRecorder != null && await _activeRecorder!.isRecording()) {
        final path = await _activeRecorder!.stop();
        _onAudioComplete(provider, path);
      }
    }

    void _onAudioComplete(CaptureProvider provider, String? path) {
      _audioStopwatch?.stop();
      final durationMs = _audioStopwatch?.elapsedMilliseconds ?? 0;

      if (path != null) {
        SocketClient.instance.emitCaptureComplete(
          captureType: 'audio',
          triggerType: provider.captureTriggerType,
          durationMs: durationMs,
        );
        provider.onCaptureComplete();
      } else {
        provider.onCaptureCancelled();
      }
      _activeRecorder?.dispose();
      _activeRecorder = null;
      _audioStopwatch = null;
    }

    @override
    void dispose() {
      _audioStopTimer?.cancel();
      _activeRecorder?.dispose();
      _activeRecorder = null;
      super.dispose();
    }
    ```
    - `AudioEncoder.aacLc` — widely supported on both platforms, good compression
    - Audio capture does NOT use native picker — it's fully inline with a Flutter pulsing indicator UI
    - `getTemporaryDirectory()` from `path_provider` (added in Task 1.3)
    - Import: `import 'package:path_provider/path_provider.dart';`
    - Verify `record` package v5.x import: `import 'package:record/record.dart';` — check pub.dev for exact export path
    - Recorder must be `.dispose()`d after use — both in `_onAudioComplete` and widget `dispose()`
    - `recorder.start()` wrapped in try/catch — microphone may be unavailable on some devices
    - Uses `Stopwatch` for accurate duration (not provider countdown which ticks per-second)

  - [x] 4.6 **Audio recording indicator UI:**
    - When `isCapturing && activeCaptureType == audio`: show a bottom-positioned container with:
      - Pulsing red dot (recording indicator)
      - Countdown text using `context.watch<CaptureProvider>().recordingSecondsRemaining` for reactive updates
      - Tap-to-stop button that calls `_stopAudioRecording(provider)`
    - Widget key: `capture-audio-indicator`
    - No actual waveform visualization in 6.2 (keep simple — a pulsing dot + countdown is sufficient)

  - [x] 4.7 **Mode selector fade-in animation:**
    - Wrap the mode selector in `AnimatedOpacity` with `duration: Duration(milliseconds: 200)` per architecture UX spec
    - `opacity: 1.0` when `isSelectorVisible`, transitioning from 0.0
    - This gives the "bubble expands into selector" feel described in FR68

- [x] Task 5: Persistent capture icon in participant toolbar (AC: #6)
  - [x] 5.1 Create `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/state/capture_provider.dart';
    import 'package:karamania/theme/dj_tokens.dart';
    import 'package:provider/provider.dart';

    /// Persistent capture icon in participant toolbar (FR39).
    /// Always visible. Independent of bubble system.
    class CaptureToolbarIcon extends StatelessWidget {
      const CaptureToolbarIcon({super.key});

      @override
      Widget build(BuildContext context) {
        final captureProvider = context.watch<CaptureProvider>();

        return Semantics(
          label: Copy.captureManual,
          child: IconButton(
            key: const Key('capture-toolbar-icon'),
            icon: const Icon(Icons.camera_alt_outlined),
            iconSize: 24,
            color: Colors.white.withAlpha(200),
            onPressed: captureProvider.isCapturing || captureProvider.isSelectorVisible
                ? null // Disabled while capture in progress
                : () => captureProvider.onManualCaptureTriggered(),
          ),
        );
      }
    }
    ```
    - Widget key: `capture-toolbar-icon`
    - Disabled when capture already in progress (prevent double-capture)
    - Uses `camera_alt_outlined` (outline variant) to differentiate from bubble's `camera_alt_rounded` (filled)

  - [x] 5.2 Integrate `CaptureToolbarIcon` into the party screen Stack in `apps/flutter_app/lib/screens/party_screen.dart`. The icon must be **always visible** (not gated by DJ state) since FR39 allows capture "at any time." Add as its own `Positioned` widget:
    ```dart
    // Persistent capture icon — always visible (FR39)
    // Independent of bubble system and DJ state
    Positioned(
      bottom: DJTokens.spaceLg,
      left: DJTokens.spaceMd,
      child: const CaptureToolbarIcon(),
    ),
    ```
    - Position: bottom-left, below where the CaptureBubble appears (bubble is at `bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm`)
    - Must be OUTSIDE any DJ state conditional blocks — the mode toggle buttons (lightstick, hype) are gated to `DJState.song && !isLightstickMode` but the capture icon is not
    - Place BEFORE the CaptureBubble `Positioned` in the Stack (bubble renders on top when both visible)
    - Import: `import 'package:karamania/widgets/capture_toolbar_icon.dart';`

- [x] Task 6: Integrate CaptureOverlay into party screen (AC: #1, #2)
  - [x] 6.1 Add `CaptureOverlay` to the party screen Stack in `apps/flutter_app/lib/screens/party_screen.dart`:
    ```dart
    // Capture overlay — mode selector and active capture UI
    // Placed AFTER CaptureBubble and LightstickMode in Stack (renders on top of everything)
    const Positioned.fill(
      child: CaptureOverlay(),
    ),
    ```
    - `Positioned.fill` because the overlay needs full-screen tap-to-dismiss and positioning
    - CaptureOverlay internally shows nothing when `!isSelectorVisible && !isCapturing` (returns `SizedBox.shrink()`)
    - Place AFTER CaptureBubble in the Stack
    - Import: `import 'package:karamania/widgets/capture_overlay.dart';`

- [x] Task 7: Add capture emit wrapper methods to SocketClient (AC: #7)
  - [x] 7.1 Add named wrapper methods to `apps/flutter_app/lib/socket/client.dart`. All existing event emissions use named wrappers (e.g., `emitReaction()`, `emitSoundboard()`, `pairTv()`). No widget in the codebase calls `emit()` directly — this is an enforced boundary rule. Add:
    ```dart
    void emitCaptureStarted({
      required String captureType,
      required String triggerType,
    }) {
      _socket?.emit('capture:started', {
        'captureType': captureType,
        'triggerType': triggerType,
      });
    }

    void emitCaptureComplete({
      required String captureType,
      required String triggerType,
      int? durationMs,
    }) {
      _socket?.emit('capture:complete', {
        'captureType': captureType,
        'triggerType': triggerType,
        if (durationMs != null) 'durationMs': durationMs,
      });
    }
    ```
    - Uses `_socket?.emit()` directly (not the public `emit()` method) — this matches ALL existing wrapper methods in SocketClient (e.g., `emitReaction`, `emitSoundboard`)
    - Event string literals `'capture:started'` and `'capture:complete'` appear ONLY here — CaptureOverlay calls these wrappers, never `_socket?.emit()` or `emit()` directly
    - Place alongside other emit wrappers in the SocketClient class

- [x] Task 8: Add copy constants (AC: #1, #6)
  - [x] 8.1 Add to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    // Capture mode selector (Story 6.2)
    static const String capturePhoto = 'Photo';
    static const String captureVideo = 'Video';
    static const String captureAudio = 'Audio';
    static const String captureManual = 'Capture a moment';
    static const String captureRecording = 'Recording...';
    static const String captureRecordingStop = 'Tap to stop';
    ```
    - All user-facing strings in copy.dart per anti-pattern rules

- [x] Task 9: Server tests (AC: #7)
  - [x] 9.1 Create `apps/server/tests/socket-handlers/capture-handlers.test.ts`:
    - Test `capture:started` event appends to event stream with correct userId, captureType, triggerType
    - Test `capture:complete` event appends to event stream with correct data including durationMs
    - Test events are ignored when no sessionId on socket.data
    - Test `triggerType: 'manual'` is accepted (FR39 manual capture)
    - Mock: `appendEvent` from event-stream
    - Mock socket as `AuthenticatedSocket` (NOT generic `Socket`) with typed `socket.data.sessionId` and `socket.data.userId` — follow existing `reaction-handlers.test.ts` patterns exactly

- [x] Task 10: Flutter tests (AC: #1, #2, #3, #4, #5, #6)
  - [x] 10.1 Extend `apps/flutter_app/test/state/capture_provider_test.dart` with new tests:
    - Test `onBubbleTapped` sets `isSelectorVisible = true` and `isBubbleVisible = false`
    - Test `onManualCaptureTriggered` sets `isSelectorVisible = true` with triggerType 'manual'
    - Test `onManualCaptureTriggered` ignored when already capturing or selector visible
    - Test `onCaptureTypeSelected(photo)` sets `isCapturing = true`, `activeCaptureType = photo`
    - Test `onCaptureTypeSelected(video)` starts countdown from 5
    - Test `onCaptureTypeSelected(audio)` starts countdown from 10
    - Test countdown decrements every second (use `fakeAsync`)
    - Test `onCaptureComplete` resets all capture state
    - Test `onCaptureCancelled` resets all capture state
    - Test `clearState` resets capture flow state (new fields)

  - [x] 10.2 Create `apps/flutter_app/test/widgets/capture_overlay_test.dart`:
    - Test shows nothing when `!isSelectorVisible && !isCapturing`
    - Test shows mode selector with 3 buttons when `isSelectorVisible`
    - Test tap on photo button calls `onCaptureTypeSelected(CaptureType.photo)`
    - Test tap on video button calls `onCaptureTypeSelected(CaptureType.video)`
    - Test tap on audio button calls `onCaptureTypeSelected(CaptureType.audio)`
    - Test tap outside selector calls `onCaptureCancelled()`
    - Test widget keys exist: `capture-photo`, `capture-video`, `capture-audio`
    - Test selector backdrop key: `capture-selector-backdrop`
    - **DO NOT test**: animations, colors, shadows, visual effects, actual camera/recorder calls
    - Mock `ImagePicker` and `AudioRecorder` in tests

  - [x] 10.3 Create `apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart`:
    - Test renders camera icon
    - Test tap calls `onManualCaptureTriggered()`
    - Test disabled when `isCapturing` is true
    - Test disabled when `isSelectorVisible` is true
    - Test widget key: `capture-toolbar-icon`

## Dev Notes

### Architecture Compliance

- **Server boundary**: `capture-handlers.ts` is a socket handler that calls `appendEvent()` from event-stream service. NEVER calls persistence directly (media persistence is Story 6.3/6.4)
- **Service layer**: No new service needed for 6.2 — capture events are logged via existing `appendEvent()`. The `capture-trigger.ts` service from Story 6.1 handles bubble triggers; 6.2 only handles the capture flow after the bubble is tapped
- **Flutter boundary**: `CaptureOverlay` calls `SocketClient.instance.emitCaptureStarted/Complete()` wrappers — NEVER raw `emit()`. All existing emissions in the codebase use named wrapper methods on SocketClient. Provider mutations go through `CaptureProvider` methods only. Widgets read via `context.watch<CaptureProvider>()`
- **No provider-to-provider access**: `CaptureProvider` is independent. Does not access `PartyProvider` or any other provider

### Key Technical Decisions

- **`image_picker` over `camera` package**: Architecture specifies `image_picker` for photo and video. It opens native camera overlay (not a custom viewfinder), returns to app seamlessly. WebSocket stays connected during native camera. The `camera` package would give more control but adds complexity for no benefit in 6.2's capture-and-return flow
- **`record` package for audio**: Architecture specifies `record` for audio recording. Supports AAC encoding, works on both platforms, allows programmatic start/stop with duration control. Audio capture is fully inline (no native picker)
- **2-tap capture flow**: Pop bubble → show selector → tap capture type → capture starts. This matches FR68's "2 taps" requirement. The selector is the intermediate step between bubble and capture
- **No preview/edit**: Architecture explicitly states "No preview/edit step — capture → auto-upload → done. Designed rawness (Locket pattern)". All captures auto-complete and return to party screen
- **Front camera default**: Party moments are selfie-oriented. `preferredCameraDevice: CameraDevice.front` is a hint — user can still switch to rear camera in native picker
- **AC #4 known limitation — no inline countdown ring for video**: AC #4 specifies "visual countdown ring showing remaining time" but `image_picker` opens the native camera UI which has its own recording controls. A custom inline viewfinder would require the `camera` package (significant additional complexity). The native picker enforces `maxDuration: 5s` natively. This trade-off is intentional per architecture's choice of `image_picker` over `camera` package
- **File storage is local-only in 6.2**: Captured files stay in device temp directory. Upload queueing is Story 6.3, Firebase Storage is Story 6.4. Don't implement upload logic here
- **capture:started/complete are analytics events**: These events log capture activity to the event stream for post-session analytics. They don't trigger any server-side state changes or broadcasts to other participants. This keeps 6.2 simple
- **Manual capture (FR39) reuses same flow**: The persistent toolbar icon calls `onManualCaptureTriggered()` which shows the same mode selector as bubble pop. Only difference is `triggerType: 'manual'` in the analytics event

### What Already Exists (From Story 6.1)

| Component | Location | Status |
|---|---|---|
| `CAPTURE_BUBBLE` event constant | `apps/server/src/shared/events.ts:61` | Ready |
| `CAPTURE_STARTED` event constant | `apps/server/src/shared/events.ts:62` | Ready — use this |
| `CAPTURE_COMPLETE` event constant | `apps/server/src/shared/events.ts:63` | Ready — use this |
| `CaptureProvider` with bubble state | `apps/flutter_app/lib/state/capture_provider.dart` | Extend (don't replace) |
| `CaptureBubble` widget | `apps/flutter_app/lib/widgets/capture_bubble.dart` | No changes needed |
| `capture-trigger.ts` service | `apps/server/src/services/capture-trigger.ts` | No changes needed |
| `capture:bubble` in SessionEvent | `apps/server/src/services/event-stream.ts` | Extend with new event types |
| `capture:bubble` listener in SocketClient | `apps/flutter_app/lib/socket/client.dart` | No changes needed |
| `CaptureProvider` in bootstrap | `apps/flutter_app/lib/config/bootstrap.dart` | No changes needed |
| `DJTokens.iconSizeLg` (48.0) | `apps/flutter_app/lib/theme/dj_tokens.dart` | Available for sizing |
| `Copy.captureMoment` | `apps/flutter_app/lib/constants/copy.dart` | Exists, add more strings |
| Party screen CaptureBubble positioning | `apps/flutter_app/lib/screens/party_screen.dart:388-393` | Reference for overlay position |

### What Does NOT Exist Yet (Create in 6.2)

| Component | Location | Purpose |
|---|---|---|
| `capture-handlers.ts` | `apps/server/src/socket-handlers/` | Handle capture:started, capture:complete |
| `capture_overlay.dart` | `apps/flutter_app/lib/widgets/` | Mode selector + active capture UI |
| `capture_toolbar_icon.dart` | `apps/flutter_app/lib/widgets/` | Persistent manual capture (FR39) |

### Previous Story Intelligence (6.1: Floating Capture Bubble)

- **CaptureProvider `onBubbleTapped()` has TODO**: Story 6.1 left a stub — "TODO Story 6.2: Initiate inline capture flow". Replace this with the mode selector logic
- **Code review lessons from 6.1**: H3 made CaptureProvider required in `createParty`/`joinParty`. M2 optimized pulse animation to start/stop with visibility. M3/L1 added Semantics wrapper. Apply same patterns: required parameters, animation lifecycle, accessibility labels
- **Provider wiring pattern from 6.1**: CaptureProvider passed to SocketClient via `connect()` method. No new wiring needed for 6.2 — the provider is already connected. Note: `captureProvider` is `required` in `createParty()`/`joinParty()` (6.1 code review H3) but optional in `connect()` — this is existing state, not a 6.2 concern
- **CaptureBubble position**: `bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm, left: DJTokens.spaceMd`. The mode selector should appear at the same position (expanding from where the bubble was)
- **Session cleanup pattern**: 6.1 established `CaptureProvider.clearState()` called in `SocketClient.disconnect()`. The new capture flow fields must be reset in `clearState()` too
- **Event emission pattern**: 6.1 emits `capture:bubble` from server → client. 6.2 emits `capture:started` and `capture:complete` from client → server. Different direction but same event stream logging via `appendEvent()`

### Git Intelligence

Recent commits (all on `flutter-native-pivot` branch):
- `fdeedd2` Story 6.1: Floating Capture Bubble — capture-trigger.ts, CaptureProvider, CaptureBubble widget, 3 server triggers, 33 tests
- Pattern: each story modifies session-manager.ts for orchestration, client.dart for listeners, party_screen.dart for UI
- Story 6.2 does NOT modify session-manager.ts (capture flow is client-driven, server just logs events)
- Story 6.2 DOES modify: capture_provider.dart (extend), party_screen.dart (add overlay + toolbar icon), client.dart (add emit wrappers), connection-handler.ts (register capture handlers)

### Scope Boundaries — What NOT to Implement

| Not in 6.2 | Belongs to |
|---|---|
| Background upload queue | Story 6.3 |
| Media tagging with DJ state | Story 6.3 |
| Firebase Storage integration | Story 6.4 |
| `media-repository.ts` persistence | Story 6.3/6.4 |
| Reaction peak detection | Story 6.5 |
| Upload progress indicator | Story 6.3 |
| Post-session media gallery | Story 9.4 |
| Signed URL generation | Story 6.4 |
| Actual waveform visualization | Future enhancement (pulsing dot is sufficient) |

### Project Structure Notes

**New files:**
- `apps/server/src/socket-handlers/capture-handlers.ts` — capture event handlers
- `apps/flutter_app/lib/widgets/capture_overlay.dart` — mode selector + capture UI
- `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart` — persistent capture icon (FR39)
- `apps/server/tests/socket-handlers/capture-handlers.test.ts`
- `apps/flutter_app/test/widgets/capture_overlay_test.dart`
- `apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart`

**Modified files:**
- `apps/flutter_app/pubspec.yaml` — add `image_picker`, `record`, `path_provider` dependencies
- `apps/flutter_app/ios/Runner/Info.plist` — add camera/microphone permission strings
- `apps/flutter_app/lib/state/capture_provider.dart` — extend with capture flow state
- `apps/flutter_app/lib/screens/party_screen.dart` — add CaptureOverlay + CaptureToolbarIcon
- `apps/flutter_app/lib/socket/client.dart` — add `emitCaptureStarted()` and `emitCaptureComplete()` wrapper methods
- `apps/server/src/socket-handlers/connection-handler.ts` — register `registerCaptureHandlers`
- `apps/flutter_app/lib/constants/copy.dart` — add capture copy strings
- `apps/server/src/services/event-stream.ts` — add capture:started/complete to SessionEvent union
- `apps/flutter_app/test/state/capture_provider_test.dart` — extend with new tests

**Verify only (no changes):**
- `apps/flutter_app/lib/widgets/capture_bubble.dart` — bubble tap already calls `onBubbleTapped()`
- `apps/flutter_app/lib/config/bootstrap.dart` — CaptureProvider already registered
- `apps/server/src/shared/events.ts` — CAPTURE_STARTED, CAPTURE_COMPLETE already defined
- `apps/server/src/services/capture-trigger.ts` — no changes (trigger logic is 6.1)

### Error Handling

- `ImagePicker.pickImage/pickVideo`: Returns `null` if user cancels native picker → call `onCaptureCancelled()`
- `AudioRecorder.hasPermission()`: Returns `false` if denied → call `onCaptureCancelled()`, do NOT show error dialog (graceful degradation)
- `AudioRecorder.start()`: May throw if microphone unavailable → wrap in try/catch, call `onCaptureCancelled()` on error
- `AudioRecorder.stop()`: May return null → handle gracefully
- Socket emit failures: Fire-and-forget — analytics events are not critical path
- Timer cancellation: All timers (`_countdownTimer`, `_audioStopTimer`) must be cancelled in `dispose()` and `onCaptureCancelled()`

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 6 Story 6.2 — FR68, FR69, FR39]
- [Source: _bmad-output/planning-artifacts/architecture.md, FR67-FR73 media capture requirements]
- [Source: _bmad-output/planning-artifacts/architecture.md, capture events line 421]
- [Source: _bmad-output/planning-artifacts/architecture.md, CaptureProvider line 464]
- [Source: _bmad-output/planning-artifacts/architecture.md, capture_overlay.dart line 929]
- [Source: _bmad-output/planning-artifacts/architecture.md, capture-handlers.ts line 607]
- [Source: _bmad-output/planning-artifacts/architecture.md, Firebase Storage integration pattern line 1207]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: _bmad-output/project-context.md, Socket.io Event Catalog — capture namespace]
- [Source: _bmad-output/implementation-artifacts/6-1-floating-capture-bubble.md — previous story patterns]
- [Source: apps/server/src/shared/events.ts:60-63 — CAPTURE_STARTED, CAPTURE_COMPLETE constants]
- [Source: pub.dev/packages/image_picker — Flutter native camera capture]
- [Source: pub.dev/packages/record — Flutter audio recording]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Added `image_picker`, `record`, `path_provider` dependencies. Added iOS camera/microphone permissions. `flutter pub get` succeeded.
- Task 2: Created `capture-handlers.ts` with `capture:started` and `capture:complete` handlers. Registered in `connection-handler.ts`. Added event types to `SessionEvent` union in `event-stream.ts`.
- Task 3: Extended `CaptureProvider` with capture flow state: `CaptureType` enum, selector visibility, active capture tracking, countdown timer, trigger type for analytics. Updated `onBubbleTapped()` to show mode selector. Added `onManualCaptureTriggered()`, `onCaptureTypeSelected()`, `onCaptureComplete()`, `onCaptureCancelled()`. Updated `dismissBubble()`, `clearState()`, `dispose()`.
- Task 4: Created `CaptureOverlay` widget with mode selector (3 buttons: photo/video/audio), photo capture via `ImagePicker`, video capture via `ImagePicker` with 5s max, audio capture via `AudioRecorder` with 10s auto-stop. Audio indicator with countdown and tap-to-stop.
- Task 5: Created `CaptureToolbarIcon` — persistent capture icon (FR39) with disabled state during capture. Integrated into party screen at bottom-left.
- Task 6: Integrated `CaptureOverlay` into party screen Stack as `Positioned.fill`.
- Task 7: Added `emitCaptureStarted()` and `emitCaptureComplete()` wrapper methods to `SocketClient`.
- Task 8: Added 6 copy constants for capture UI.
- Task 9: Created server tests (8 tests) covering both event handlers, missing sessionId, and manual trigger type.
- Task 10: Extended `capture_provider_test.dart` (15 new tests), created `capture_overlay_test.dart` (8 tests), created `capture_toolbar_icon_test.dart` (5 tests). Total: 28 new Flutter tests.

### Change Log

- 2026-03-17: Implemented Story 6.2 Inline Media Capture — all 10 tasks complete, 36 new tests (8 server + 28 Flutter), no regressions
- 2026-03-18: Code review fixes applied (H1, H2, M1, M2, M3): Fixed provider state leak on widget disposal during audio recording; added server-side input validation for capture events; added pulsing animation to audio recording indicator; removed invisible video countdown timer; wrapped hasPermission in try/catch. 5 new server validation tests added. Total: 41 server tests + 28 Flutter tests for story 6.2

### File List

**New files:**
- `apps/server/src/socket-handlers/capture-handlers.ts`
- `apps/flutter_app/lib/widgets/capture_overlay.dart`
- `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart`
- `apps/server/tests/socket-handlers/capture-handlers.test.ts`
- `apps/flutter_app/test/widgets/capture_overlay_test.dart`
- `apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart`

**Modified files:**
- `apps/flutter_app/pubspec.yaml` — added image_picker, record, path_provider
- `apps/flutter_app/ios/Runner/Info.plist` — added NSCameraUsageDescription, NSMicrophoneUsageDescription
- `apps/flutter_app/lib/state/capture_provider.dart` — extended with capture flow state + CaptureType enum
- `apps/flutter_app/lib/screens/party_screen.dart` — added CaptureOverlay + CaptureToolbarIcon
- `apps/flutter_app/lib/socket/client.dart` — added emitCaptureStarted/Complete wrappers
- `apps/server/src/socket-handlers/connection-handler.ts` — registered capture handlers
- `apps/flutter_app/lib/constants/copy.dart` — added capture copy strings
- `apps/server/src/services/event-stream.ts` — added capture:started/complete to SessionEvent union
- `apps/flutter_app/test/state/capture_provider_test.dart` — extended with 15 new tests

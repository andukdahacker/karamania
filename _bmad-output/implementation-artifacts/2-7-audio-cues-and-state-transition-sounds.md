# Story 2.7: Audio Cues & State Transition Sounds

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to hear distinct sounds when the party transitions between activities,
so that I know what's happening even when I'm not looking at my phone.

## Acceptance Criteria

1. **Given** the DJ engine transitions between states **When** a state change occurs **Then** a unique audio cue plays for each transition type: song start, ceremony start, interlude start, and party card deal — minimum 4 distinct sounds (FR26, NFR18)
2. **Given** a state transition audio cue plays **When** the sound is triggered **Then** each audio cue is at least 0.5s duration (FR26)
3. **Given** a state transition audio cue plays **When** the sound is triggered **Then** the audio cue is audible at phone speaker volume (NFR18)
4. **Given** the app is installed **When** audio assets are loaded **Then** all audio is bundled with the app and playable within 50ms of trigger — no network round-trip (NFR6)
5. **Given** the app is installed **When** audio assets are checked **Then** total audio assets contribute to keeping app install size under 50MB (NFR7) — audio assets are <500KB total with 10 core asset slots

## Tasks / Subtasks

- [x] Task 1: Add flutter_soloud dependency and create audio engine (AC: #4, #5)
  - [x] 1.1 Add `flutter_soloud: ^3.4.6` to `apps/flutter_app/pubspec.yaml` dependencies. Run `flutter pub get`
  - [x] 1.2 Create `apps/flutter_app/lib/audio/audio_engine.dart`:
    - Import `package:flutter_soloud/flutter_soloud.dart`
    - Create singleton class `AudioEngine` with `static final instance = AudioEngine._()` private constructor
    - Add `bool _initialized = false` guard
    - Add `Future<void> init()` method: call `SoLoud.instance.init()`, set `_initialized = true`. Guard against double-init. Wrap in try/catch — log error but do NOT crash app if audio init fails (graceful degradation)
    - Add `Future<void> dispose()` method: call `SoLoud.instance.deinit()`, set `_initialized = false`
    - Add `Map<String, AudioSource> _loadedSounds = {}` for caching loaded audio sources
    - Add `Future<void> preloadAll()` method: iterate `SoundCue.values`, call `_loadSound()` for each, store in `_loadedSounds` map. Log any failures but continue (don't block app startup)
    - Add private `Future<void> _loadSound(SoundCue cue)` method: call `SoLoud.instance.loadAsset(cue.assetPath)`, store result in `_loadedSounds[cue.name]`
    - Add `void play(SoundCue cue, {double volume = 0.7})` method: guard `if (!_initialized) return`. Get `AudioSource` from `_loadedSounds[cue.name]`. If null, log warning and return (graceful). Call `SoLoud.instance.play(source, volume: volume)`. No await — fire-and-forget
    - Add `void setGlobalVolume(double volume)` method: clamp 0.0-1.0, call `SoLoud.instance.setGlobalVolume(volume)`
  - [x] 1.3 Create `apps/flutter_app/lib/audio/sound_cue.dart`:
    - Define `enum SoundCue` with values: `songStart`, `ceremonyStart`, `interludeStart`, `partyCardDeal`, `pauseChime`, `resumeChime`, `partyJoined`, `countdownTick`, `errorBuzz`, `uiTap`
    - Add `String get assetPath` getter returning `'assets/sounds/${name}.opus'` (snake_case conversion: `songStart` → `assets/sounds/song_start.opus`)
    - Add `double get defaultVolume` getter: `songStart` → 0.7 (transitional), `ceremonyStart` → 1.0 (ceremonial), `interludeStart` → 0.7, `partyCardDeal` → 0.7, `pauseChime` → 0.4 (ambient), `resumeChime` → 0.7, others → 0.7
    - Export both files from audio directory (but NO barrel file — import directly per project rules)
  - [x] 1.4 Register audio assets in `pubspec.yaml` under `flutter.assets`:
    ```yaml
    assets:
      - assets/sounds/
    ```
  - [x] 1.5 Create placeholder audio asset files in `apps/flutter_app/assets/sounds/`. For now, create 4 minimum required `.opus` files as silent/placeholder stubs (1-second silence in opus format). The actual sound design is a separate concern — the dev story focuses on the infrastructure:
    - `song_start.opus`
    - `ceremony_start.opus`
    - `interlude_start.opus`
    - `party_card_deal.opus`
    - Optionally also: `pause_chime.opus`, `resume_chime.opus`, `party_joined.opus`, `countdown_tick.opus`, `error_buzz.opus`, `ui_tap.opus`
    - **CRITICAL:** Total assets must be <500KB. Each placeholder can be generated with `ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 1 -c:a libopus -b:a 16k <filename>.opus` (~2KB each). Real sound files to be provided later by sound designer
  - [x] 1.6 Initialize AudioEngine in app startup. In `apps/flutter_app/lib/config/bootstrap.dart`: after Firebase init (line 35) and before `runApp()` (line 37), add:
    ```dart
    // Audio engine init — graceful degradation if fails
    try {
      await AudioEngine.instance.init();
      await AudioEngine.instance.preloadAll();
    } catch (e) {
      debugPrint('Audio init failed: $e');
    }
    ```
    **NOT in main.dart** — `WidgetsFlutterBinding.ensureInitialized()` and `runApp()` live in `config/bootstrap.dart`

- [x] Task 2: Play audio cues on DJ state transitions in Flutter (AC: #1, #2, #3)
  - [x] 2.1 Create `apps/flutter_app/lib/audio/state_transition_audio.dart`:
    - Import `DJState` from `package:karamania/theme/dj_theme.dart` (the enum lives there, NOT in a dedicated file)
    - Create class `StateTransitionAudio` (not a singleton — instantiated by SocketClient)
    - Add `DJState? _previousState` field to track state changes (type-safe enum, not String)
    - Add `void onStateChanged(DJState newState, {bool isPaused = false})` method:
      - Guard: if `isPaused` return (no audio during pause)
      - Guard: if `newState == _previousState` return (no duplicate cues)
      - Map state to `SoundCue` using switch on `DJState` enum:
        - `DJState.song` → `SoundCue.songStart`
        - `DJState.ceremony` → `SoundCue.ceremonyStart`
        - `DJState.interlude` → `SoundCue.interludeStart`
        - `DJState.partyCardDeal` → `SoundCue.partyCardDeal`
        - `DJState.lobby`, `DJState.songSelection`, `DJState.finale` → no cue (null)
      - **NOTE:** There are NO sub-states like `ceremonySinger`/`ceremonyReveal`. The DJState enum has exactly 7 values: `lobby`, `songSelection`, `partyCardDeal`, `song`, `ceremony`, `interlude`, `finale` (see `dj_theme.dart:51-59` and server `types.ts:8-16`)
      - If cue is not null: `AudioEngine.instance.play(cue, volume: cue.defaultVolume)`
      - Update `_previousState = newState`
    - Add `void onPause()` method: `AudioEngine.instance.play(SoundCue.pauseChime, volume: SoundCue.pauseChime.defaultVolume)`
    - Add `void onResume()` method: `AudioEngine.instance.play(SoundCue.resumeChime, volume: SoundCue.resumeChime.defaultVolume)`
    - Add `void reset()` method: sets `_previousState = null` (for session end/leave)
  - [x] 2.2 In `apps/flutter_app/lib/socket/client.dart`:
    - Add `final _stateTransitionAudio = StateTransitionAudio()` field on `SocketClient`
    - In the `dj:stateChanged` listener (line 176): AFTER the try/catch DJState parse succeeds (after line 185) and after `partyProvider.onDjStateUpdate(...)` (line 186), call `_stateTransitionAudio.onStateChanged(djState, isPaused: payload['isPaused'] as bool? ?? false)` — use the already-parsed `djState` enum, NOT the raw string
    - In the `dj:pause` listener (line 198): after `partyProvider.onDjPause(...)` (line 200), call `_stateTransitionAudio.onPause()`
    - In the `dj:resume` listener (line 207): after `partyProvider.onDjStateUpdate(...)` (line 216), call `_stateTransitionAudio.onResume()`. Note: this listener does NOT call a separate `onDjResume()` on the provider — it calls `onDjStateUpdate()` with `isPaused:false`
    - Reset audio on ALL cleanup paths:
      - In `disconnect()` method (line 94): add `_stateTransitionAudio.reset()` before nulling `_partyProvider`
      - In `party:ended` listener (line 230): add `_stateTransitionAudio.reset()` alongside `partyProvider.onSessionEnded()`
      - In `party:participantRemoved` self-kick path (line 239-240): add `_stateTransitionAudio.reset()` before `disconnect()`
    - `_stateTransitionAudio` does NOT need null-checking — it's a non-nullable field on SocketClient
  - [x] 2.3 Do NOT add any server-side audio logic. The `sound:play` event in events.ts is for the soundboard feature (Epic 4), not for state transition sounds. State transition audio cues are entirely client-side — the Flutter app decides which sound to play based on the DJ state it receives

- [x] Task 3: Volume differentiation for host vs participant (AC: #3)
  - [x] 3.1 In `apps/flutter_app/lib/audio/audio_engine.dart`: Add `void setRole({required bool isHost, bool accessibilityEqualVolume = false})` method:
    - If `accessibilityEqualVolume`: `setGlobalVolume(1.0)` for ALL devices (UX spec line 2071: "No spatial audio volume split" for reduced-motion/accessibility users)
    - Else if `isHost`: `setGlobalVolume(1.0)` (host at full volume — primary audio source per UX spec)
    - Else: `setGlobalVolume(0.6)` (participants at 60% per UX spatial audio spec)
  - [x] 3.2 In `apps/flutter_app/lib/socket/client.dart`: When party is joined and role is known (after `party:joined` or `party:created` events), call `AudioEngine.instance.setRole(isHost: partyProvider.isHost, accessibilityEqualVolume: ...)`. Read accessibility preference from the `AccessibilityProvider` (already registered in `bootstrap.dart` line 44). Use `Provider.of<AccessibilityProvider>(context, listen: false).reduceMotion` or pass the flag through the socket client setup
  - [x] 3.3 No server changes needed — volume differentiation is purely client-side

- [x] Task 4: Tests for AudioEngine (AC: #4)
  - [x] 4.1 Create `apps/flutter_app/test/audio/audio_engine_test.dart`:
    - Test `init()` calls SoLoud.instance.init() (mock SoLoud)
    - Test `init()` is idempotent (calling twice doesn't double-init)
    - Test `preloadAll()` loads all SoundCue values
    - Test `play()` when initialized calls SoLoud.instance.play with correct source and volume
    - Test `play()` when NOT initialized is a no-op (no crash)
    - Test `play()` with unknown/unloaded cue is a no-op (graceful degradation)
    - Test `setGlobalVolume()` clamps values to 0.0-1.0
    - Test `setRole(isHost: true)` sets volume to 1.0
    - Test `setRole(isHost: false)` sets volume to 0.6
    - Test `dispose()` calls deinit
    - **Note:** flutter_soloud's `SoLoud.instance` is a singleton. Tests should mock/stub it. Use `mocktail` to create `MockSoLoud`. Since `SoLoud` may not be easily mockable, consider wrapping the dependency: create a minimal `SoLoudWrapper` interface that `AudioEngine` depends on, with a real and mock implementation. OR test at the integration level by verifying the `AudioEngine` public API behavior without mocking SoLoud internals — check `_initialized` flag behavior, `_loadedSounds` map state, etc.
  - [x] 4.2 Create `apps/flutter_app/test/audio/state_transition_audio_test.dart`:
    - Test `onStateChanged(DJState.song)` plays `SoundCue.songStart`
    - Test `onStateChanged(DJState.ceremony)` plays `SoundCue.ceremonyStart`
    - Test `onStateChanged(DJState.interlude)` plays `SoundCue.interludeStart`
    - Test `onStateChanged(DJState.partyCardDeal)` plays `SoundCue.partyCardDeal`
    - Test `onStateChanged(DJState.lobby)` plays no sound
    - Test `onStateChanged(DJState.songSelection)` plays no sound
    - Test `onStateChanged(DJState.finale)` plays no sound
    - Test `onStateChanged(DJState.song)` called twice plays sound only once (dedup)
    - Test `onStateChanged` with `isPaused: true` plays no sound
    - Test `onPause()` plays `SoundCue.pauseChime`
    - Test `onResume()` plays `SoundCue.resumeChime`
    - Test `reset()` clears previous state, allowing same state to trigger again
  - [x] 4.3 Extend `apps/flutter_app/test/socket/client_test.dart`:
    - Test `dj:stateChanged` event triggers audio cue via StateTransitionAudio
    - Test `dj:pause` event triggers pause chime
    - Test `dj:resume` event triggers resume chime
    - Test disconnect/leave calls reset on StateTransitionAudio

## Dev Notes

### Audio Package: flutter_soloud (NOT audioplayers or just_audio)

The architecture/PRD mention "just_audio or audioplayers" but those are poor fits for short sound effects:
- **audioplayers:** `PlayerMode.lowLatency` has persistent Android bugs and no iOS equivalent
- **just_audio:** Designed for music/podcast playback, heavyweight AudioPlayer instances, no fire-and-forget API

**flutter_soloud v3.4.6** is the Flutter team's officially recommended solution for game/UI audio:
- C++ SoLoud engine via FFI — no platform channel overhead
- Fire-and-forget `play()` that returns instantly
- Native multi-voice support for overlapping sounds
- Sub-50ms trigger latency (meets NFR6)
- Listed in official Flutter cookbook and Casual Games Toolkit

Usage pattern:
```dart
// Init once at app startup
await SoLoud.instance.init();
final source = await SoLoud.instance.loadAsset('assets/sounds/song_start.opus');

// Play anywhere — fire and forget
SoLoud.instance.play(source, volume: 0.7);
```

### Audio Volume Levels (from UX Design Specification)

| Context | Volume Level |
|---------|-------------|
| Ambient (pause chime, UI taps) | 40% (0.4) |
| Transitional (song start, interlude, party card) | 70% (0.7) |
| Ceremonial (ceremony start) | 100% (1.0) |
| Host device (spatial primary) | 100% global volume |
| Participant device (spatial audience) | 60% global volume |
| Max simultaneous sources | 2 |

### Audio Assets Strategy

- Format: Opus (`.opus`) — excellent compression, supported by flutter_soloud
- Budget: 10 core asset slots, <500KB total
- Location: `apps/flutter_app/assets/sounds/`
- This story creates placeholder/silent audio files. Real sound design is a separate concern
- Placeholder generation: `ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 1 -c:a libopus -b:a 16k <filename>.opus` (~2KB each)
- Sound design guidelines from UX spec:
  - Ascending two-note chime for positive events
  - Song state as dramatic contrast (near-silent during songs)
  - Silence-before-reveal pattern (1s silence before award reveal — Epic 3)

### State-to-Sound Mapping

| DJState Enum Value | Sound Cue | When Triggered |
|--------------------|-----------|----------------|
| `DJState.song` | `songStart` | Entering song state |
| `DJState.ceremony` | `ceremonyStart` | Entering ceremony state |
| `DJState.interlude` | `interludeStart` | Entering interlude state |
| `DJState.partyCardDeal` | `partyCardDeal` | Entering party card deal state |
| `DJState.lobby` | none | No audio cue |
| `DJState.finale` | none | Finale audio handled in Epic 8 |
| `DJState.songSelection` | none | Bridge moment is visual only (Story 2.6) |
| (pause event) | `pauseChime` | On `dj:pause` socket event (not a DJState) |
| (resume event) | `resumeChime` | On `dj:resume` socket event (not a DJState) |

**DJState enum has exactly 7 values** (defined in `dj_theme.dart:51-59`): `lobby`, `songSelection`, `partyCardDeal`, `song`, `ceremony`, `interlude`, `finale`. There are NO sub-states. The switch must be exhaustive over all 7 values.

### What This Story Does NOT Build

- **No soundboard** — That's Epic 4 (Story 4.3). The `sound:play` event in events.ts is for soundboard, NOT state transition sounds
- **No ceremony audio** — FR25 ceremony fanfares through host phone is Epic 3
- **No sound-handlers.ts on server** — Sound handler socket file is for the soundboard (Epic 4). State transition audio is entirely client-side
- **No audio capture** — That's Epic 6 (FR68/FR69)
- **No countdown audio shift** — Higher register/faster tempo at 5 seconds is a future enhancement
- **No silence-before-reveal** — 1s silence before award reveal is Epic 3
- **No real sound design** — Placeholder audio files only. Sound designer provides real assets later
- **No background music** — Explicitly prohibited per UX spec ("no background music during gameplay")

### DJState Enum Location (Non-Obvious)

The Flutter `DJState` enum is defined in `apps/flutter_app/lib/theme/dj_theme.dart:51-59`, NOT in a dedicated types file. Import as `package:karamania/theme/dj_theme.dart`. The `dj:stateChanged` listener in `client.dart` already parses the raw string to this enum via `DJState.values.byName(stateString)` with a try/catch guard — audio hooks receive the already-parsed enum, not raw strings.

### Accessibility: Equal Volume Mode

UX spec (line 2071-2079) requires: when reduced-motion accessibility is active, disable spatial audio volume split — all devices play at same volume. The `AccessibilityProvider` is already registered in `bootstrap.dart:44`. The `setRole()` method accepts an `accessibilityEqualVolume` flag to honor this.

### Critical Architecture Decision: Audio is Client-Side Only

State transition audio cues are triggered ENTIRELY on the Flutter client:
1. Server emits `dj:stateChanged` with the new state
2. Flutter `SocketClient` receives the event
3. `StateTransitionAudio.onStateChanged()` maps state → sound cue
4. `AudioEngine.play()` fires the sound locally

There is NO server involvement in playing state transition sounds. The server doesn't know or care about audio playback. This keeps the `dj-engine/` boundary clean (zero imports from integrations).

### Server Boundaries (ENFORCED)

- **No server changes needed for this story** (except potentially adding placeholder sound event constants if desired for future use, but NOT required)
- `dj-engine/` — ZERO changes. Audio is not a state machine concern
- `socket-handlers/` — No new handlers. State transition sounds are triggered by the existing `dj:stateChanged` event
- `services/` — No changes

### Flutter Boundaries (ENFORCED)

- `audio/audio_engine.dart` — Singleton wrapper around SoLoud. Preloads, plays, manages volume. ZERO imports from providers or socket
- `audio/state_transition_audio.dart` — Maps DJ states to sound cues. ZERO imports from providers. Only imports from `audio/`
- `audio/sound_cue.dart` — Pure enum, zero imports
- `socket/client.dart` — ONLY place that calls `StateTransitionAudio` methods. Connects state events to audio cues
- Providers are read-only from widgets — no audio logic in providers
- No widget triggers audio directly — audio triggered from SocketClient listeners only

### Graceful Degradation

Audio failure must NEVER crash the app or block party functionality:
- `AudioEngine.init()` failure → logged, app continues without sound
- `preloadAll()` individual asset failure → logged, other assets still work
- `play()` on unloaded cue → silent no-op, logged
- `play()` when not initialized → silent no-op
- This matches the project's error handling philosophy — audio is enhancement, not core

### Project Structure Notes

New files:
- `apps/flutter_app/lib/audio/audio_engine.dart` (SoLoud wrapper singleton)
- `apps/flutter_app/lib/audio/sound_cue.dart` (sound cue enum with asset paths and default volumes)
- `apps/flutter_app/lib/audio/state_transition_audio.dart` (DJ state → sound cue mapper)
- `apps/flutter_app/assets/sounds/song_start.opus` (placeholder)
- `apps/flutter_app/assets/sounds/ceremony_start.opus` (placeholder)
- `apps/flutter_app/assets/sounds/interlude_start.opus` (placeholder)
- `apps/flutter_app/assets/sounds/party_card_deal.opus` (placeholder)
- `apps/flutter_app/assets/sounds/pause_chime.opus` (placeholder, optional)
- `apps/flutter_app/assets/sounds/resume_chime.opus` (placeholder, optional)
- `apps/flutter_app/test/audio/audio_engine_test.dart`
- `apps/flutter_app/test/audio/state_transition_audio_test.dart`

Modified files:
- `apps/flutter_app/pubspec.yaml` (add flutter_soloud dependency and assets registration)
- `apps/flutter_app/lib/config/bootstrap.dart` (init AudioEngine after Firebase, before runApp)
- `apps/flutter_app/lib/socket/client.dart` (add StateTransitionAudio calls on DJ events, reset on all cleanup paths)

Existing test files to extend:
- `apps/flutter_app/test/socket/client_test.dart` (audio trigger tests on DJ events)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7] — Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR26] — Unique audio cue for every DJ state transition (minimum 4 distinct sounds, 0.5s+ duration)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR3] — Soundboard audio within 50ms (same engine serves state cues)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR6] — Bundled audio assets, playable within 50ms, no network round-trip
- [Source: _bmad-output/planning-artifacts/prd.md#NFR7] — App install size <50MB including audio assets
- [Source: _bmad-output/planning-artifacts/prd.md#NFR18] — State transition audio cues (0.5s+, unique per transition type, audible at phone speaker)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Audio Design] — Volume levels (ambient 40%, transitional 70%, ceremonial 100%), spatial audio (host 100%, participants 60%)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Sound Design Patterns] — Ascending chime for positive, silence-before-reveal, preloaded assets
- [Source: _bmad-output/planning-artifacts/architecture.md#Directory Structure] — `audio/engine.dart`, `sounds/` directory with 10 core assets <500KB
- [Source: _bmad-output/project-context.md#Server Boundaries] — dj-engine has ZERO imports from integrations
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — Only SocketClient calls mutation methods
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations, visual effects, transition timings. DO test state transitions, data flow, event handling
- [Source: _bmad-output/implementation-artifacts/2-6-pause-resume-and-bridge-moments.md] — Previous story: dj:pause/dj:resume listener patterns in SocketClient, PartyProvider isPaused flag
- [Source: apps/flutter_app/lib/socket/client.dart] — Existing DJ state change handling, dj:pause/resume listeners
- [Source: apps/server/src/shared/events.ts#L35] — SOUND_PLAY event defined (for future soundboard, not this story)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#L2071-2079] — Accessibility: no spatial audio volume split for reduced-motion users
- [Source: apps/flutter_app/lib/theme/dj_theme.dart#L51-59] — DJState enum definition (lobby, songSelection, partyCardDeal, song, ceremony, interlude, finale)
- [Source: apps/flutter_app/lib/config/bootstrap.dart] — App startup: WidgetsFlutterBinding, Firebase init, providers, runApp. AudioEngine init goes here
- [Source: apps/flutter_app/lib/socket/client.dart#L176-227] — Existing dj:stateChanged, dj:pause, dj:resume listeners with DJState parsing
- [Source: apps/flutter_app/lib/socket/client.dart#L94-107] — disconnect() cleanup method
- [Source: pub.dev/packages/flutter_soloud] — v3.4.6, Flutter team recommended, C++ SoLoud engine via FFI
- [Source: docs.flutter.dev/cookbook/audio/soloud] — Official Flutter cookbook for flutter_soloud

### Git Intelligence (Recent Commits)

- `38c83f6` Story 2.6: Pause, Resume & Bridge Moments — dj:pause/dj:resume listeners in SocketClient, isPaused flag in PartyProvider, activity tracker, inactivity monitor, bridge moment display. **Direct dependency: audio cues for pause/resume events hook into these listeners**
- `41af463` Story 2.5: Host Controls Overlay — host-handlers.ts, HostControlsOverlay widget, validateHost pattern
- `331d3e6` Story 2.4: DJ state broadcasting — dj-broadcaster.ts, buildDjStatePayload, PartyProvider DJ state fields, PartyScreen state display. **Direct dependency: dj:stateChanged listener is where audio cues are triggered**
- `805fc81` Story 2.3: Server restart recovery — recoverActiveSessions, timer reconciliation
- `f311f03` Story 2.2: DJ state persistence — persistDjState fire-and-forget, serializer
- `59f6c88` Story 2.1: DJ engine state machine — DJContext, DJState enum, DJTransition types. **Direct dependency: DJState values are what we map to sound cues**
- Pattern: Flutter tests use `mocktail` for mocking, `_wrapWithProviders()` helpers, Key-based widget finding

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Implemented AudioEngine singleton wrapping flutter_soloud v3.5.0 (resolved from ^3.4.6) with graceful degradation on all failure paths
- Created SoundCue enum with 10 cue values, snake_case asset path conversion, and per-cue default volumes (ambient 0.4, transitional 0.7, ceremonial 1.0)
- Created StateTransitionAudio class mapping all 7 DJState enum values to sound cues (4 with audio, 3 silent) with deduplication and isPaused guard
- Integrated audio hooks into SocketClient: dj:stateChanged, dj:pause, dj:resume listeners with reset on disconnect/party:ended/kicked
- Added volume differentiation via setRole() — host at 1.0, participant at 0.6, with accessibilityEqualVolume override
- Generated 10 silent placeholder opus files (~1.1KB each, ~11.5KB total — well under 500KB budget)
- AudioEngine init added to bootstrap.dart between Firebase init and runApp with try/catch graceful degradation
- Added mocktail dev dependency for test mocking support
- 40 new audio tests + 256 existing tests = 296 total, all passing
- No server changes needed — audio is entirely client-side per architecture

### Change Log

- 2026-03-12: Implemented Story 2.7 — Audio cues & state transition sounds (all 4 tasks complete)
- 2026-03-12: Code review fixes — Added SoLoudWrapper abstraction for AudioEngine testability, made StateTransitionAudio and SocketClient dependencies injectable, rewrote all audio tests with proper mocking (eliminated "testing the mock" anti-pattern), added audio integration tests to client_test.dart, removed unused mocktail import

### File List

New files:
- apps/flutter_app/lib/audio/audio_engine.dart
- apps/flutter_app/lib/audio/sound_cue.dart
- apps/flutter_app/lib/audio/state_transition_audio.dart
- apps/flutter_app/assets/sounds/song_start.opus
- apps/flutter_app/assets/sounds/ceremony_start.opus
- apps/flutter_app/assets/sounds/interlude_start.opus
- apps/flutter_app/assets/sounds/party_card_deal.opus
- apps/flutter_app/assets/sounds/pause_chime.opus
- apps/flutter_app/assets/sounds/resume_chime.opus
- apps/flutter_app/assets/sounds/party_joined.opus
- apps/flutter_app/assets/sounds/countdown_tick.opus
- apps/flutter_app/assets/sounds/error_buzz.opus
- apps/flutter_app/assets/sounds/ui_tap.opus
- apps/flutter_app/test/audio/audio_engine_test.dart
- apps/flutter_app/test/audio/sound_cue_test.dart
- apps/flutter_app/test/audio/state_transition_audio_test.dart

Modified files:
- apps/flutter_app/pubspec.yaml (flutter_soloud + mocktail deps, assets/sounds/ registration)
- apps/flutter_app/lib/config/bootstrap.dart (AudioEngine init/preload)
- apps/flutter_app/lib/socket/client.dart (StateTransitionAudio integration, setRole calls, @visibleForTesting audio override)
- apps/flutter_app/test/socket/client_test.dart (added audio integration tests)

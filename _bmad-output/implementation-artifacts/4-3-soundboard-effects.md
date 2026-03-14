# Story 4.3: Soundboard Effects

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to trigger fun sound effects during performances,
so that I can add comedic or hype moments to the live experience.

## Acceptance Criteria

1. **Given** a song is being performed **When** a participant taps a soundboard button **Then** the sound effect plays audibly through their phone speaker (FR24) **And** the sound is broadcast to all other participants' phones **And** 4-6 sounds are available **And** audio playback begins within 50ms of tap on the originating device (NFR3) **And** sound assets are bundled with the app — no network round-trip on playback (NFR6) **And** soundboard tap targets are no smaller than 48x48px (NFR14)
2. **Given** a participant is triggering soundboard effects rapidly **When** rate limiting thresholds are exceeded **Then** the same rate limiting rules apply as emoji reactions (NFR23): after 10 events in 5 seconds, each subsequent event earns 50% fewer participation points **And** no hard block — sounds always play locally **And** rate limiting resets after 5 seconds of inactivity **And** note: unlike reactions, soundboard has no floating visual element to dim — rate limiting only affects participation points
3. **Given** a participant triggers a soundboard effect **When** the participation score is updated **Then** soundboard events contribute to the active participation tier (3pts) scaled by `rewardMultiplier` — this is already mapped in `participation-scoring.ts` as `'sound:play': ParticipationTier.active`, NO additional scoring logic needed
4. **Given** the DJ state is NOT `song` **When** a participant attempts to trigger a soundboard effect **Then** the soundboard UI is hidden and the server silently drops any `sound:play` events
5. **Given** a participant triggers a soundboard effect **When** another participant receives the broadcast **Then** the same sound plays on their phone via `AudioEngine` using the same `SoundCue` value

## Tasks / Subtasks

- [x]Task 1: Add soundboard SoundCue entries and placeholder assets (AC: #1, #5)
  - [x]1.1 In `apps/flutter_app/lib/audio/sound_cue.dart`, add 6 soundboard sound cues to the `SoundCue` enum. Insert after the existing `uiTap` entry:
    ```dart
    // Soundboard effects (Story 4.3)
    sbAirHorn,
    sbCrowdCheer,
    sbDrumRoll,
    sbRecordScratch,
    sbRimshot,
    sbWolfWhistle;
    ```
    **Prefix `sb` ensures clear namespace separation from state transition cues.**

    Add their default volumes in the `defaultVolume` switch — all soundboard effects at 1.0 (intentional user actions, not ambient):
    ```dart
    SoundCue.sbAirHorn => 1.0,
    SoundCue.sbCrowdCheer => 1.0,
    SoundCue.sbDrumRoll => 1.0,
    SoundCue.sbRecordScratch => 1.0,
    SoundCue.sbRimshot => 1.0,
    SoundCue.sbWolfWhistle => 1.0,
    ```
    The `assetPath` getter auto-converts: `sbAirHorn` → `assets/sounds/sb_air_horn.opus`.

  - [x]1.2 Create 6 placeholder `.opus` files in `apps/flutter_app/assets/sounds/`:
    - `sb_air_horn.opus`
    - `sb_crowd_cheer.opus`
    - `sb_drum_roll.opus`
    - `sb_record_scratch.opus`
    - `sb_rimshot.opus`
    - `sb_wolf_whistle.opus`

    **These are placeholder audio files** — copy any existing `.opus` file (e.g., `ui_tap.opus`) to create placeholders. Real audio assets will be swapped in later. Each file must be valid `.opus` format to avoid `flutter_soloud` load errors.

    **CRITICAL:** Verify these paths are already covered by the existing `assets/sounds/` entry in `pubspec.yaml`. The existing entry `- assets/sounds/` covers all files in that directory — no `pubspec.yaml` modification needed.

- [x]Task 2: Create soundboard handler on server (AC: #1, #2, #3, #4)
  - [x]2.1 Create `apps/server/src/socket-handlers/soundboard-handlers.ts`:
    ```typescript
    import type { Server as SocketIOServer } from 'socket.io';
    import type { AuthenticatedSocket } from '../shared/socket-types.js';
    import { EVENTS } from '../shared/events.js';
    import { getSessionDjState } from '../services/dj-state-store.js';
    import { DJState } from '../dj-engine/types.js';
    import { checkRateLimit, recordUserEvent } from '../services/rate-limiter.js';
    import { recordParticipationAction } from '../services/session-manager.js';
    import { recordActivity } from '../services/activity-tracker.js';
    import { appendEvent } from '../services/event-stream.js';

    const VALID_SOUNDS = [
      'sbAirHorn',
      'sbCrowdCheer',
      'sbDrumRoll',
      'sbRecordScratch',
      'sbRimshot',
      'sbWolfWhistle',
    ] as const;

    export function registerSoundboardHandlers(
      socket: AuthenticatedSocket,
      io: SocketIOServer
    ): void {
      socket.on(EVENTS.SOUND_PLAY, async (data: { soundId: string }) => {
        const { sessionId, userId } = socket.data;
        if (!sessionId || !userId) return;
        if (typeof data?.soundId !== 'string') return;
        if (!VALID_SOUNDS.includes(data.soundId as typeof VALID_SOUNDS[number])) return;

        // State guard: soundboard only during song state (AC #4)
        const context = getSessionDjState(sessionId);
        if (!context || context.state !== DJState.song) return;

        recordActivity(sessionId);

        // Rate limiting — reuse same infrastructure as reactions (AC #2)
        const now = Date.now();
        const timestamps = recordUserEvent(userId, now);
        const { rewardMultiplier } = checkRateLimit(timestamps, now);

        // Broadcast to all OTHER participants (sender plays locally for 50ms target)
        socket.to(sessionId).emit(EVENTS.SOUND_PLAY, {
          userId,
          soundId: data.soundId,
          rewardMultiplier,
        });

        // Participation scoring (fire-and-forget) — already mapped as active tier (AC #3)
        recordParticipationAction(sessionId, userId, 'sound:play', rewardMultiplier).catch(() => {});

        // Log to event stream
        appendEvent(sessionId, {
          type: 'sound:play',
          ts: now,
          userId,
          data: { soundId: data.soundId },
        });
      });
    }
    ```
    **Design decisions:**
    - `VALID_SOUNDS` array validates soundId to prevent injection of arbitrary sound names
    - `socket.to(sessionId).emit()` sends to all participants EXCEPT sender — sender plays sound locally immediately for 50ms latency target (NFR3). This is DIFFERENT from `reaction:broadcast` which uses `io.to(sessionId).emit()` to send to ALL including sender (reactions need visual confirmation on sender's screen)
    - Rate limiting uses the SAME `recordUserEvent` + `checkRateLimit` as reactions — soundboard events and reaction events share the same rate limit window per user (they count together, which is correct because both are "tap spam" actions)
    - `recordParticipationAction` already handles `'sound:play'` scoring at Active tier (3pts * rewardMultiplier)
    - `rewardMultiplier` included in broadcast so receiving clients can optionally adjust visual feedback
    - DJ state guard silently drops events when not in `song` state (AC #4)

  - [x]2.2 Add `'sound:play'` event type to `SessionEvent` union in `apps/server/src/services/event-stream.ts`. Add after the existing `reaction:sent` line:
    ```typescript
    | { type: 'sound:play'; ts: number; userId: string; data: { soundId: string } }
    ```

  - [x]2.3 Register handler in `apps/server/src/socket-handlers/connection-handler.ts`:
    - Add import: `import { registerSoundboardHandlers } from './soundboard-handlers.js';`
    - Add registration call AFTER `registerReactionHandlers(s, io);` (line 47):
      ```typescript
      registerSoundboardHandlers(s, io);
      ```

- [x]Task 3: Add soundboard copy and sound definitions (AC: #1)
  - [x]3.1 In `apps/flutter_app/lib/constants/copy.dart`, add soundboard button definitions. These map `SoundCue` values to display emoji and label:
    ```dart
    /// Soundboard button definitions — soundId matches SoundCue.name for AudioEngine lookup.
    class SoundboardButton {
      const SoundboardButton({required this.soundId, required this.emoji, required this.label});
      final String soundId;
      final String emoji;
      final String label;
    }

    const List<SoundboardButton> soundboardButtons = [
      SoundboardButton(soundId: 'sbAirHorn', emoji: '📯', label: 'Air Horn'),
      SoundboardButton(soundId: 'sbCrowdCheer', emoji: '🎉', label: 'Cheer'),
      SoundboardButton(soundId: 'sbDrumRoll', emoji: '🥁', label: 'Drum Roll'),
      SoundboardButton(soundId: 'sbRecordScratch', emoji: '💿', label: 'Scratch'),
      SoundboardButton(soundId: 'sbRimshot', emoji: '🪘', label: 'Rimshot'),
      SoundboardButton(soundId: 'sbWolfWhistle', emoji: '🐺', label: 'Whistle'),
    ];
    ```
    **Design decisions:**
    - `soundId` matches `SoundCue.name` exactly — used for both socket emission and local `AudioEngine` lookup via `SoundCue.values.byName(soundId)`
    - 6 sounds (within FR24's 4-6 range)
    - Emoji representations for visual consistency with the reaction bar
    - Short labels for compact display

- [x]Task 4: Add SocketClient soundboard methods (AC: #1, #5)
  - [x]4.1 In `apps/flutter_app/lib/socket/client.dart`, add emit method. Place after the existing `emitReaction()` method:
    ```dart
    void emitSoundboard(String soundId) {
      _socket?.emit('sound:play', {'soundId': soundId});
    }
    ```

  - [x]4.2 In `apps/flutter_app/lib/socket/client.dart`, add `sound:play` listener in `_setupPartyListeners()` after the existing `reaction:streak` listener. This listener handles sounds BROADCAST FROM OTHER USERS (the sender plays locally immediately):
    ```dart
    // Soundboard broadcast from other users — play sound locally
    on('sound:play', (data) {
      final payload = data as Map<String, dynamic>;
      final soundId = payload['soundId'] as String;
      try {
        final cue = SoundCue.values.byName(soundId);
        AudioEngine.instance.play(cue);
      } catch (_) {
        // Unknown soundId — ignore silently
      }
    });
    ```
    **CRITICAL:**
    - Import `SoundCue` and `AudioEngine` if not already imported (Story 2.7 added `StateTransitionAudio` import but may not have direct `AudioEngine`/`SoundCue` imports)
    - `SoundCue.values.byName(soundId)` throws `ArgumentError` if soundId doesn't match — wrapped in try/catch for safety
    - NO provider call needed here — the sound plays directly via AudioEngine. There's no visual state to update for received sounds (unlike reactions which need floating emoji animations)
    - The sender does NOT receive this broadcast (`socket.to()` excludes sender) — sender plays locally via the widget `onTap` handler

- [x]Task 5: Create SoundboardBar widget (AC: #1, #2)
  - [x]5.1 Create `apps/flutter_app/lib/widgets/soundboard_bar.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/audio/audio_engine.dart';
    import 'package:karamania/audio/sound_cue.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/socket/client.dart';
    import 'package:karamania/widgets/dj_tap_button.dart';
    import 'package:karamania/constants/tap_tiers.dart';

    /// Horizontal row of soundboard effect buttons.
    /// Only shown during DJState.song.
    class SoundboardBar extends StatelessWidget {
      const SoundboardBar({super.key});

      @override
      Widget build(BuildContext context) {
        return Row(
          key: const Key('soundboard-bar'),
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: soundboardButtons.map((button) {
            return DJTapButton(
              key: Key('soundboard-${button.soundId}'),
              tier: TapTier.social,
              onTap: () {
                // Play locally IMMEDIATELY for 50ms latency (NFR3)
                try {
                  final cue = SoundCue.values.byName(button.soundId);
                  AudioEngine.instance.play(cue);
                } catch (_) {}
                // Emit to server for broadcast to others + scoring
                SocketClient.instance.emitSoundboard(button.soundId);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    button.emoji,
                    style: const TextStyle(fontSize: 24),
                  ),
                ],
              ),
            );
          }).toList(),
        );
      }
    }
    ```
    **Design decisions:**
    - Plays sound LOCALLY first via `AudioEngine.instance.play(cue)` — guarantees <50ms latency (NFR3) since assets are bundled (NFR6). Then emits to server for broadcast to others
    - Uses `DJTapButton` with `TapTier.social` (same as ReactionBar) — 56x56px min size exceeds 48x48px requirement (NFR14), includes lightImpact haptic and 200ms debounce
    - `Key('soundboard-${button.soundId}')` for each button — enables targeted testing
    - Emoji at 24px (smaller than reaction bar's 32px) because 6 buttons need more horizontal space
    - No label text shown — emoji is sufficient for quick recognition and keeps buttons compact. Labels are available in `SoundboardButton` for accessibility/tooltips if needed later
    - try/catch around `SoundCue.values.byName` for defensive coding

- [x]Task 6: Integrate soundboard into party screen (AC: #1, #4)
  - [x]6.1 In `apps/flutter_app/lib/screens/party_screen.dart`, add import:
    ```dart
    import 'package:karamania/widgets/soundboard_bar.dart';
    ```

  - [x]6.2 Add the SoundboardBar in the Stack, positioned ABOVE the ReactionBar. The ReactionBar is at `bottom: DJTokens.spaceLg + 48`. Place the SoundboardBar above it with spacing:
    ```dart
    // After the streak milestone overlay and BEFORE the ReactionBar:
    // Soundboard bar — positioned above reaction bar during song
    if (partyProvider.djState == DJState.song)
      Positioned(
        bottom: DJTokens.spaceLg + 48 + 56 + DJTokens.spaceSm,
        left: 0,
        right: 0,
        child: const SoundboardBar(),
      ),
    ```
    **Positioning math:**
    - ReactionBar bottom: `DJTokens.spaceLg + 48` = 72px
    - ReactionBar height: ~56px (TapTier.social min size)
    - Gap: `DJTokens.spaceSm` = 8px
    - SoundboardBar bottom: `72 + 56 + 8` = 136px

    **CRITICAL:** Condition is `DJState.song` only — same as reaction bar (AC #4). No host-only restriction — FR24 says "all participants can trigger soundboard effects."

- [x]Task 7: Server tests (AC: #1, #2, #3, #4, #5)
  - [x]7.1 Create `apps/server/tests/socket-handlers/soundboard-handlers.test.ts`:
    - Test `sound:play` handler validates `soundId` is a known value — unknown soundId silently dropped
    - Test `sound:play` handler validates `soundId` is a string — non-string silently dropped
    - Test handler only fires during `DJState.song` — other states silently drop the event (AC #4)
    - Test handler returns early if `sessionId` or `userId` missing
    - Test valid sound emits broadcast via `socket.to(sessionId).emit()` (NOT `io.to()`) with `{ userId, soundId, rewardMultiplier }` (AC #1)
    - Test broadcast includes correct `rewardMultiplier` from rate limiter (AC #2)
    - Test `recordParticipationAction` called with `'sound:play'` action and `rewardMultiplier` (AC #3)
    - Test `appendEvent` called with `{ type: 'sound:play', ts, userId, data: { soundId } }`
    - Test `recordActivity` called with `sessionId`
    - Test rate limiting applies: after 10 events in 5s, `rewardMultiplier` < 1.0 (AC #2) — use mock to control `checkRateLimit` return
    - Test event is NOT blocked when rate-limited — broadcast still fires (AC #2: no hard block)

    **Mock pattern:** Follow `reaction-handlers.test.ts`:
    ```typescript
    vi.mock('../services/dj-state-store.js');
    vi.mock('../services/rate-limiter.js');
    vi.mock('../services/session-manager.js');
    vi.mock('../services/activity-tracker.js');
    vi.mock('../services/event-stream.js');
    ```

    **Socket mock pattern:** Must mock both `socket.to(sessionId).emit()` chain AND `socket.data`:
    ```typescript
    const mockSocket = {
      data: { sessionId: 'session1', userId: 'user1', displayName: 'Test' },
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
    ```
    Note: `socket.to(room).emit()` returns `this` (chainable), so `to` must return `mockSocket`.

  - [x]7.2 Verify `connection-handler.ts` registration — no separate test needed, just verify the import and call are in place. Existing connection handler tests will catch registration failures via integration.

  - [x]7.3 **Regression tests**: Run full server test suite — all existing tests must pass. Expected: 593 existing + ~12 new soundboard tests.

- [x]Task 8: Flutter tests (AC: #1, #5)
  - [x]8.1 Create `apps/flutter_app/test/widgets/soundboard_bar_test.dart`:
    - Test renders 6 soundboard buttons
    - Test each button has correct `Key('soundboard-${soundId}')` for all 6 sounds
    - Test has `Key('soundboard-bar')` on the Row
    - Test each button displays the correct emoji
    - Test `onTap` calls `SocketClient.instance.emitSoundboard(soundId)` — mock SocketClient
    - Test `onTap` calls `AudioEngine.instance.play(cue)` for local playback — mock AudioEngine
    - **DO NOT test:** animation details, exact font sizes, layout positioning

  - [x]8.2 Update `apps/flutter_app/test/socket/client_test.dart`:
    - Test `emitSoundboard()` emits `'sound:play'` event with `{ 'soundId': soundId }`
    - Test `sound:play` listener calls `AudioEngine.instance.play()` with correct `SoundCue`
    - Test `sound:play` listener handles unknown soundId gracefully (no crash)
    - Follow existing pattern from `emitReaction()` and `reaction:broadcast` tests

  - [x]8.3 Update `apps/flutter_app/test/audio/sound_cue_test.dart`:
    - Test new soundboard cues generate correct asset paths (e.g., `sbAirHorn` → `assets/sounds/sb_air_horn.opus`)
    - Test all soundboard cues have `defaultVolume` of 1.0

  - [x]8.4 **Regression tests**: Run full Flutter test suite — all existing tests must pass. Expected: 379 existing + ~14 new soundboard tests.

## Dev Notes

### Architecture: Local-First Audio with Server Broadcast

Soundboard follows a **hybrid local-first + server-broadcast** pattern to satisfy both the 50ms latency requirement (NFR3) and the party experience:

1. User taps soundboard button → Flutter plays sound LOCALLY via `AudioEngine.instance.play(cue)` immediately (0ms latency, assets bundled per NFR6)
2. Flutter emits `sound:play` to server with `{ soundId }`
3. Server validates DJ state + applies rate limiting
4. Server broadcasts to all OTHER participants via `socket.to(sessionId).emit()` (excludes sender)
5. Other clients receive broadcast → play same sound via `AudioEngine`

**Key difference from reactions:** Reactions use `io.to(sessionId).emit()` (ALL including sender) because the sender needs visual emoji animation. Soundboard uses `socket.to(sessionId).emit()` (excludes sender) because the sender already played the sound locally.

[Source: _bmad-output/project-context.md#Core Principle — "Server-authoritative architecture"]

### Existing Infrastructure (DO NOT Recreate)

**Already built — consume as-is:**
- **AudioEngine** (`audio/audio_engine.dart`): Singleton, `play(SoundCue, volume?)`, preloads all `SoundCue.values`. **EXTEND** SoundCue enum only
- **SoundCue enum** (`audio/sound_cue.dart`): Auto-converts name to `assets/sounds/{snake_case}.opus`. **EXTEND** with 6 new entries
- **Rate limiter** (`services/rate-limiter.ts`): `checkRateLimit()` + `recordUserEvent()`. **DO NOT MODIFY** — reuse exactly as reactions do
- **Participation scoring** (`services/participation-scoring.ts`): `'sound:play'` already mapped as Active tier (3pts). **DO NOT MODIFY**
- **Event constants** (`shared/events.ts`): `SOUND_PLAY: 'sound:play'` already defined at line 35. **DO NOT MODIFY**
- **DJTapButton** (`widgets/dj_tap_button.dart`): Existing tap button with tier system. **DO NOT MODIFY**
- **TapTier.social** (`constants/tap_tiers.dart`): 56x56px min, lightImpact haptic, 200ms debounce. **DO NOT MODIFY**
- **Activity tracker** (`services/activity-tracker.ts`): `recordActivity(sessionId)`. **DO NOT MODIFY**
- **Event stream** (`services/event-stream.ts`): `appendEvent()`. **EXTEND** SessionEvent union with `sound:play` type
- **Connection handler** (`socket-handlers/connection-handler.ts`): Handler registration. **EXTEND** with `registerSoundboardHandlers`

### Rate Limiting Shared Window

Soundboard events and reaction events share the SAME rate limit window per user. They both call `recordUserEvent(userId, now)` which shares the same `userEventTimestamps` Map. This means:
- A user spamming 8 reactions + 3 soundboard taps in 5s = 11 events in window → rate limiting kicks in
- This is the correct behavior — prevents abuse from mixing event types
- The 200ms debounce on `DJTapButton` (TapTier.social) also naturally limits tap rate

### Soundboard Sound Naming Convention

All soundboard `SoundCue` entries are prefixed with `sb` (short for "soundboard"):
- `sbAirHorn`, `sbCrowdCheer`, `sbDrumRoll`, `sbRecordScratch`, `sbRimshot`, `sbWolfWhistle`

This prevents any naming collision with existing state transition sounds (e.g., a future "cheer" transition vs the soundboard "cheer"). The `assetPath` getter auto-converts to snake_case: `sbAirHorn` → `assets/sounds/sb_air_horn.opus`.

### AudioEngine Preloading

`AudioEngine.preloadAll()` iterates `SoundCue.values` and loads every sound asset. Adding new `SoundCue` entries automatically includes them in preloading — **no modification to `AudioEngine` or `preloadAll()` needed**.

### What This Story Does NOT Build

- **No soundboard visual feedback on OTHER users' screens** — no notification like "Player X played Air Horn". Only the audio plays. Visual notifications could be added later
- **No vibe-specific soundboard sounds** — same 6 sounds for all vibes. Vibe-specific sets could be added later
- **No soundboard usage in event stream for end-of-night analytics** — event stream logging is included, but no summary/display feature yet
- **No soundboard disable toggle for host** — host cannot selectively disable soundboard (could be added with host controls later)
- **No streak tracking for soundboard** — unlike reactions which have milestones at 5/10/20/50, soundboard has no streak system

### Previous Story Intelligence (Story 4.2)

Key learnings to apply:
- **Import paths matter**: Use `session-manager.js` for scoring, `dj-state-store.js` for DJ state, `activity-tracker.js` for keepalive
- **Handler signature**: `registerXxxHandlers(socket, io)` — takes BOTH socket and io
- **`recordParticipationAction` handles event logging internally for scoring** — DO NOT call scoring again. But DO call `appendEvent` separately for the `sound:play` event type (separate from the `participation:scored` event that `recordParticipationAction` writes)
- **`mounted` check after async gaps** (Timer callbacks, animation completion)
- **Test baseline: 593 server tests, 379 Flutter tests**

### Code Review Patterns from 4.1 and 4.2

Common issues found and fixed in previous stories:
- [H1] Wrong import paths for service functions — double-check against actual source
- [H2] Wrong function names — verify exact function signatures in source files
- [H3] Duplicate event logging — `recordParticipationAction` writes `participation:scored` event. The `sound:play` event stream entry is SEPARATE
- [M1] Wrong provider field access pattern — `_partyProvider?.` in SocketClient
- [M4] Missing `recordActivity()` call for session keepalive
- [H1 from 4.2] Map deletion during iteration — collect keys first, then delete

**Apply these lessons:** Double-check every import path, function name, and service call against the actual source files.

### Project Structure Notes

New files:
- `apps/server/src/socket-handlers/soundboard-handlers.ts`
- `apps/server/tests/socket-handlers/soundboard-handlers.test.ts`
- `apps/flutter_app/lib/widgets/soundboard_bar.dart`
- `apps/flutter_app/test/widgets/soundboard_bar_test.dart`
- `apps/flutter_app/assets/sounds/sb_air_horn.opus` (placeholder)
- `apps/flutter_app/assets/sounds/sb_crowd_cheer.opus` (placeholder)
- `apps/flutter_app/assets/sounds/sb_drum_roll.opus` (placeholder)
- `apps/flutter_app/assets/sounds/sb_record_scratch.opus` (placeholder)
- `apps/flutter_app/assets/sounds/sb_rimshot.opus` (placeholder)
- `apps/flutter_app/assets/sounds/sb_wolf_whistle.opus` (placeholder)

Modified files:
- `apps/flutter_app/lib/audio/sound_cue.dart` — Add 6 soundboard SoundCue entries with default volumes
- `apps/server/src/services/event-stream.ts` — Add `sound:play` type to SessionEvent union
- `apps/server/src/socket-handlers/connection-handler.ts` — Import and register `registerSoundboardHandlers`
- `apps/flutter_app/lib/socket/client.dart` — Add `emitSoundboard()` method and `sound:play` listener
- `apps/flutter_app/lib/constants/copy.dart` — Add `SoundboardButton` class and `soundboardButtons` list
- `apps/flutter_app/lib/screens/party_screen.dart` — Add SoundboardBar import and widget in Stack above ReactionBar
- `apps/flutter_app/test/socket/client_test.dart` — Add soundboard emit and listener tests
- `apps/flutter_app/test/audio/sound_cue_test.dart` — Add soundboard cue asset path and volume tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.3] — Soundboard effects: 4-6 sounds, 50ms playback, bundled assets, rate limiting
- [Source: _bmad-output/planning-artifacts/epics.md#FR24] — All participants can trigger soundboard effects (4-6 sounds) that play audibly through their phone speaker
- [Source: _bmad-output/planning-artifacts/epics.md#NFR3] — Soundboard audio must begin playback within 50ms of tap
- [Source: _bmad-output/planning-artifacts/epics.md#NFR6] — Sound assets must be bundled with the app
- [Source: _bmad-output/planning-artifacts/epics.md#NFR14] — Tap targets no smaller than 48x48px
- [Source: _bmad-output/planning-artifacts/epics.md#NFR23] — Rate limiting: 10 events/5s, exponential decay, no hard block, 5s reset
- [Source: _bmad-output/project-context.md#Core Principle] — Server-authoritative architecture
- [Source: _bmad-output/project-context.md#Server Boundaries] — socket-handlers call services, NEVER persistence directly
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog] — sound:play is Bidirectional
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects
- [Source: _bmad-output/project-context.md#Anti-Patterns] — No hardcoded strings, use copy.dart
- [Source: apps/server/src/shared/events.ts#line35] — SOUND_PLAY already defined
- [Source: apps/server/src/services/participation-scoring.ts#line22] — 'sound:play' already mapped as active tier (3pts)
- [Source: apps/server/src/services/rate-limiter.ts] — checkRateLimit + recordUserEvent reused as-is
- [Source: apps/server/src/socket-handlers/reaction-handlers.ts] — Handler pattern to follow (state guard, rate limit, broadcast, scoring, event logging)
- [Source: apps/server/src/socket-handlers/connection-handler.ts#line47] — Registration point for new handler
- [Source: apps/flutter_app/lib/audio/sound_cue.dart] — SoundCue enum with assetPath auto-conversion
- [Source: apps/flutter_app/lib/audio/audio_engine.dart] — AudioEngine.instance.play(cue) — fire-and-forget playback
- [Source: apps/flutter_app/lib/widgets/reaction_bar.dart] — UI pattern: DJTapButton + TapTier.social in Row
- [Source: apps/flutter_app/lib/socket/client.dart] — emitReaction() pattern for emitSoundboard()
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — Stack layout, ReactionBar at bottom: spaceLg + 48
- [Source: _bmad-output/implementation-artifacts/4-2-reaction-streaks-and-milestones.md] — Previous story: 593 server tests, 379 Flutter tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blocking issues.

### Completion Notes List

- Task 1: Added 6 soundboard SoundCue entries (sbAirHorn, sbCrowdCheer, sbDrumRoll, sbRecordScratch, sbRimshot, sbWolfWhistle) with 1.0 default volume. Created 6 placeholder .opus files by copying existing ui_tap.opus.
- Task 2: Created soundboard-handlers.ts with DJ state guard, rate limiting (shared window with reactions), socket.to() broadcast (excludes sender), participation scoring, and event stream logging. Added sound:play to SessionEvent union. Registered handler in connection-handler.ts.
- Task 3: Added SoundboardButton class and soundboardButtons list in constants/soundboard_config.dart (extracted from copy.dart per code review) with 6 emoji-labeled buttons.
- Task 4: Added emitSoundboard() method and sound:play listener in SocketClient. Listener plays received sounds via AudioEngine with try/catch for unknown soundIds.
- Task 5: Created SoundboardBar widget using DJTapButton with TapTier.social. Local-first audio playback for <50ms latency, then server emit for broadcast.
- Task 6: Integrated SoundboardBar into party_screen.dart positioned above ReactionBar, visible only during DJState.song.
- Task 7: Created 13 server tests covering broadcast, rate limiting, scoring, event logging, state guard, and validation. All 606 server tests pass.
- Task 8: Created 6 widget tests (4 render + 2 tap interaction), 5 client tests (1 emit + 3 SoundCue resolution + 1 empty soundId), 3 sound_cue tests. All 394 Flutter tests pass.

### Change Log

- 2026-03-14: Implemented Story 4.3 Soundboard Effects — 6 soundboard sounds, server handler with rate limiting, Flutter widget, full test coverage
- 2026-03-14: Code review fixes — [H3] Extracted SoundboardButton from copy.dart to soundboard_config.dart, [M1] Removed unnecessary Column wrapper in SoundboardBar, [H1] Added tap interaction tests for SoundboardBar, [H2] Improved sound:play listener tests with actual SoundCue resolution verification

### File List

New files:
- apps/server/src/socket-handlers/soundboard-handlers.ts
- apps/server/tests/socket-handlers/soundboard-handlers.test.ts
- apps/flutter_app/lib/constants/soundboard_config.dart
- apps/flutter_app/lib/widgets/soundboard_bar.dart
- apps/flutter_app/test/widgets/soundboard_bar_test.dart
- apps/flutter_app/assets/sounds/sb_air_horn.opus
- apps/flutter_app/assets/sounds/sb_crowd_cheer.opus
- apps/flutter_app/assets/sounds/sb_drum_roll.opus
- apps/flutter_app/assets/sounds/sb_record_scratch.opus
- apps/flutter_app/assets/sounds/sb_rimshot.opus
- apps/flutter_app/assets/sounds/sb_wolf_whistle.opus

Modified files:
- apps/flutter_app/lib/audio/sound_cue.dart
- apps/server/src/services/event-stream.ts
- apps/server/src/socket-handlers/connection-handler.ts
- apps/flutter_app/lib/socket/client.dart
- apps/flutter_app/lib/constants/copy.dart
- apps/flutter_app/lib/screens/party_screen.dart
- apps/flutter_app/test/socket/client_test.dart
- apps/flutter_app/test/audio/sound_cue_test.dart

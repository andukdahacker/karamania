# Story 4.7: Lightstick Mode & Hype Signal

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an audience member,
I want to wave my phone like a lightstick or flash encouragement at the performer,
so that I can physically participate in the performance atmosphere.

## Acceptance Criteria

1. **Given** a song is being performed **When** an audience participant toggles their view mode **Then** they can switch between lean-in mode (reactions/soundboard) and lightstick mode (FR63) **And** the toggle is a single tap — instant full-screen transition **And** mode selection is private — no broadcast of which mode a user is in
2. **Given** a participant is in lightstick mode **When** the mode is active **Then** a full-screen animated glow effect is rendered (FR64) **And** the screen fills with a pulsing, breathing glow in the current accent color **And** the user can change the glow color via 5 color picker dots matching the vibe palette along the bottom edge (FR64) **And** no synchronization between devices is required — free-form mode (FR64) **And** reactions and soundboard are NOT available in lightstick mode (full-screen glow replaces them) **And** tap anywhere or swipe down exits back to lean-in mode
3. **Given** a participant wants to encourage the performer **When** they activate the hype signal **Then** a screen-based pulse effect fires with 3 rapid white flashes via AnimationController (FR65) **And** device flashlight activates via native torch API (FR65) **And** the hype signal works uniformly on both iOS and Android (FR65) **And** a 5-second cooldown applies between hype signals per user (prevents seizure risk from continuous strobing) **And** the button shows a circular refill indicator during cooldown
4. **Given** all audience participation modes **When** a participant is in any mode during a song **Then** lightstick mode and hype signal are available alongside reactions (FR66) **And** hype signal is available in BOTH lean-in and lightstick modes **And** participants can switch between modes freely during a song (FR66) **And** Song Over button (host) remains visible in ALL modes
5. **Given** participation scoring is active **When** a participant uses lightstick mode **Then** lightstick mode active time is tracked and scores as passive (1pt) **And** hype signal activation scores as active (3pts) **And** hype signal uses a dedicated per-user cooldown tracker (5s hard cooldown), lightstick activation uses standard rate limiter
6. **Given** a user has `prefers-reduced-motion` enabled **When** lightstick mode is active **Then** a static color fill is rendered with no pulse animation **And** hype signal fires a single screen flash (no strobe) with no flashlight activation

## Tasks / Subtasks

- [x] Task 1: Add lightstick and hype signal event constants and event stream types (AC: #1, #3, #5)
  - [x]1.1 In `apps/server/src/shared/events.ts`, add after existing card events:
    - `LIGHTSTICK_TOGGLED: 'lightstick:toggled'` — emitted when user enters/exits lightstick mode (for participation tracking only)
    - `HYPE_FIRED: 'hype:fired'` — emitted when user fires hype signal (for participation scoring + event stream)
    - **Naming convention:** follows `SOUND_PLAY` / `'sound:play'`, `REACTION_SENT` / `'reaction:sent'` pattern
  - [x]1.2 In `apps/server/src/services/event-stream.ts`, extend `SessionEvent` union:
    - Add `| { type: 'lightstick:toggled'; ts: number; userId: string; data: { active: boolean } }`
    - Add `| { type: 'hype:fired'; ts: number; userId: string; data: {} }`

- [x] Task 2: Register lightstick and hype actions in participation scoring (AC: #5)
  - [x]2.1 In `apps/server/src/services/participation-scoring.ts`:
    - Add `'lightstick:toggled': ParticipationTier.passive` to `ACTION_TIER_MAP` (1pt)
    - Add `'hype:fired': ParticipationTier.active` to `ACTION_TIER_MAP` (3pts)
    - **CRITICAL:** Without these entries, `recordParticipationAction` returns 0 points — scoring silently does nothing

- [x] Task 3: Create server-side lightstick and hype signal handlers (AC: #1, #3, #5)
  - [x]3.1 Create `apps/server/src/socket-handlers/lightstick-handlers.ts`:
    - Follow `soundboard-handlers.ts` pattern exactly (same structure, guards)
    - Export `registerLightstickHandlers(socket, io)` — extract `sessionId` and `userId` from `socket.data` inside the handler (same 2-param signature as all other handlers)
    - **`lightstick:toggled` handler:**
      - Guard: only during `DJState.song` state
      - Payload: `{ active: boolean }`
      - If `active === true`: call `recordParticipationAction(sessionId, userId, 'lightstick:toggled', 1.0)` — passive scoring (1pt)
      - Call `recordActivity(sessionId)` to reset inactivity timer
      - Append to event stream: `{ type: 'lightstick:toggled', ts: Date.now(), userId, data: { active } }`
      - NO broadcast — mode selection is private (UX spec requirement)
    - **`hype:fired` handler:**
      - Guard: only during `DJState.song` state
      - **CRITICAL: DO NOT use `checkRateLimit()` for hype cooldown.** The shared rate limiter never returns `allowed: false` (only decaying `rewardMultiplier`), and `recordUserEvent` shares a global timestamp store keyed by `userId` that would corrupt reaction/soundboard rate limiting. Instead, implement a dedicated per-user cooldown:
        ```typescript
        const lastHypeTime = new Map<string, number>(); // module-level
        ```
      - Check `lastHypeTime.get(userId)` — if less than 5000ms ago, emit `hype:cooldown` back to sender socket only with `{ remainingMs: 5000 - elapsed }` and return
      - If allowed: set `lastHypeTime.set(userId, Date.now())`
      - Call `recordParticipationAction(sessionId, userId, 'hype:fired', 1.0)` — active scoring (3pts, tier from ACTION_TIER_MAP)
      - Call `recordActivity(sessionId)` to reset inactivity timer
      - Append to event stream: `{ type: 'hype:fired', ts: Date.now(), userId, data: {} }`
      - NO broadcast of hype signal — each user's hype is local (flash + torch on their own phone)
      - Clean up `lastHypeTime` entries when socket disconnects (in the disconnect handler or via a WeakRef pattern)
  - [x]3.2 Register handlers in `apps/server/src/socket-handlers/connection-handler.ts`:
    - Import `registerLightstickHandlers` from `./lightstick-handlers.js`
    - Call `registerLightstickHandlers(socket, io)` alongside existing reaction/soundboard handler registrations

- [x] Task 4: Add Flutter socket emissions for lightstick and hype events (AC: #1, #3)
  - [x]4.1 In `apps/flutter_app/lib/socket/client.dart`:
    - Add `emitLightstickToggled(bool active)`:
      ```dart
      _socket?.emit('lightstick:toggled', {'active': active});
      ```
    - Add `emitHypeSignal()`:
      ```dart
      _socket?.emit('hype:fired', {});
      ```
    - Add listener for `'hype:cooldown'` event (server sends when rate-limited):
      - Parse payload: `{ remainingMs: int }`
      - Call `partyProvider.onHypeCooldownEnforced(remainingMs)` to reset client-side cooldown timer
    - **NOTE:** No incoming broadcast listeners needed — lightstick is local, hype is local. Server only scores and logs.

- [x] Task 5: Update PartyProvider with lightstick and hype state (AC: #1-6)
  - [x]5.1 In `apps/flutter_app/lib/state/party_provider.dart`:
    - Add enum or bool for song view mode:
      ```dart
      bool _isLightstickMode = false;
      ```
    - Add lightstick color state:
      ```dart
      Color _lightstickColor = const Color(0xFFFFD700); // default: vibe accent
      ```
    - Add hype cooldown state:
      ```dart
      bool _isHypeCooldown = false;
      DateTime? _hypeCooldownEnd;
      ```
    - Add methods:
      - `setLightstickMode(bool active)`: called by UI toggle, sets `_isLightstickMode = active`, `notifyListeners()`. **Provider only manages state — the widget/screen calls `socketClient.emitLightstickToggled()` separately.** Same pattern as reaction/soundboard where widget handles socket emission.
      - `setLightstickColor(Color color)`: sets `_lightstickColor = color`, `notifyListeners()`
      - `onHypeCooldownEnforced(int remainingMs)`: server-enforced cooldown — sets `_isHypeCooldown = true`, `_hypeCooldownEnd = DateTime.now().add(Duration(milliseconds: remainingMs))`, `notifyListeners()`
      - `startHypeCooldown()`: client-side 5s cooldown — sets `_isHypeCooldown = true`, `_hypeCooldownEnd = DateTime.now().add(Duration(seconds: 5))`, `notifyListeners()`. Called by the widget BEFORE emitting to server.
      - `clearHypeCooldown()`: sets `_isHypeCooldown = false`, `_hypeCooldownEnd = null`, `notifyListeners()`
    - Add getters: `isLightstickMode`, `lightstickColor`, `isHypeCooldown`, `hypeCooldownEnd`
  - [x]5.2 **Explicit reset on song exit:** In the existing `onDjStateUpdate` method's song-exit cleanup block (same location as other song-state resets):
    - Set `_isLightstickMode = false`
    - Set `_isHypeCooldown = false`, `_hypeCooldownEnd = null`
    - This ensures clean state when re-entering song state for the next performer

- [x] Task 6: Create LightstickMode widget (AC: #2, #6)
  - [x]6.1 Create `apps/flutter_app/lib/widgets/lightstick_mode.dart`:
    - Full-screen widget that renders an animated glow effect
    - **Glow animation:** Use `AnimationController` with `duration: Duration(seconds: 2)`, `repeat(reverse: true)` to create a breathing/pulsing glow. Apply via `AnimatedBuilder` with `Opacity` or `ColorTween` on a full-viewport `Container` with a `RadialGradient`
    - The glow color is `partyProvider.lightstickColor` — the gradient goes from the color at center to transparent at edges
    - **Color picker:** Row of 5 `GestureDetector` circles along the bottom edge. Colors derived from the current vibe palette:
      - Use `context.watch<PartyProvider>().vibe` to get the `PartyVibe` enum, then access `.accent`, `.glow`, `.primary` + 2 hardcoded universal colors (white `0xFFFFFFFF` and warm red `0xFFFF4444`). **There is no `VibeProvider` — vibe is accessed via `PartyProvider.vibe`**
      - Active color has a white border and scale(1.2) transform
      - Tap calls `partyProvider.setLightstickColor(selectedColor)`
    - **Exit:** `GestureDetector` on the entire glow area — tap anywhere OR vertical drag down calls `partyProvider.setLightstickMode(false)` + `socketClient.emitLightstickToggled(false)`
    - **Hype button:** `HypeSignalButton` widget rendered at bottom-right, always accessible
    - **Song Over button:** If `partyProvider.isHost`, render `SongOverButton` in absolute position (same as lean-in mode) — host controls always visible
    - **Reduced motion:** Check `MediaQuery.of(context).disableAnimations`. If true: static `Container` with solid color fill, no `AnimationController`
    - Use `DJTokens` for spacing. No hardcoded colors except the 2 universal picker colors

- [x] Task 7: Create HypeSignalButton widget (AC: #3, #6)
  - [x]7.1 Create `apps/flutter_app/lib/widgets/hype_signal_button.dart`:
    - Stateful widget with its own `AnimationController` for the screen flash effect
    - **Tap behavior:**
      - If `partyProvider.isHypeCooldown == true`: do nothing (button is dimmed)
      - Otherwise:
        1. Call `partyProvider.startHypeCooldown()` — starts client-side 5s cooldown
        2. Call `socketClient.emitHypeSignal()` — notify server for scoring/logging
        3. Trigger screen flash: 3 rapid white pulses using `AnimationController` with `duration: Duration(milliseconds: 150)` repeated 3 times. Render as a full-screen white `Container` with opacity driven by animation
        4. Activate device flashlight: use `TorchLight` or similar plugin. Call `turnOn()` for 500ms total during the flash sequence, then `turnOff()`. Wrap in try/catch — flashlight may not be available on all devices (emulator, devices without flash). Failure is silent
    - **Cooldown indicator:** Circular progress indicator (like a radial timer refilling over 5 seconds). Use `CircularProgressIndicator` or custom painter. During cooldown, button icon is dimmed (`DJTokens.textSecondary`). When cooldown ends, button returns to full brightness
    - **Cooldown timer:** Start a `Timer` for 5 seconds in `startHypeCooldown`. When timer fires, call `partyProvider.clearHypeCooldown()`. Cancel timer in `dispose()`
    - **Button appearance:** Icon button with lightning bolt icon. Size: 48x48 minimum (NFR14 touch target). Use `context.watch<PartyProvider>().vibe.accent` for active state color. **`DJTokens.actionPrimary` does NOT exist** — it's a vibe-shifting token accessed via `PartyVibe`
    - **Reduced motion:** Single flash instead of 3, no flashlight activation. Check `MediaQuery.of(context).disableAnimations`
  - [x]7.2 Add flashlight plugin to `apps/flutter_app/pubspec.yaml`:
    - **IMPORTANT: Verify the chosen package compiles and works on both iOS and Android before committing.** The `torch_light` package on pub.dev has limited usage. Alternatives to evaluate: `flashlight_control`, `lamp`, or `camera` package's torch mode.
    - Add the chosen package (e.g., `torch_light: ^2.0.0` or latest stable)
    - Run `flutter pub get`
    - The key requirement: simple on/off control of device LED flash, cross-platform. No camera permissions should be needed.
    - Flashlight is a graceful degradation feature — if the plugin fails or is unavailable (emulator, no flash LED), the screen flash still works. Wrap all torch calls in try/catch with silent failure.

- [x] Task 8: Integrate lightstick and hype into PartyScreen (AC: #1, #4)
  - [x]8.1 In `apps/flutter_app/lib/screens/party_screen.dart`:
    - The song state UI uses multiple independent `Positioned` widgets in a `Stack`: `SoundboardBar` (~line 271), `ReactionBar` (~line 279), `ReactionFeed` (~line 242), `StreakMilestoneOverlay` (~line 258), `SongOverButton` (~line 286), plus any group card overlays from Story 4.6
    - **CRITICAL:** When lightstick mode is active, you must conditionally hide ALL lean-in mode widgets (SoundboardBar, ReactionBar, ReactionFeed, StreakMilestoneOverlay). Do NOT use a simple if/else wrapping a single block — each `Positioned` widget must be independently conditional:
      ```dart
      // Each lean-in widget gets wrapped:
      if (!partyProvider.isLightstickMode) ...[
        Positioned(/* SoundboardBar */),
        Positioned(/* ReactionBar */),
        Positioned(/* ReactionFeed */),
        Positioned(/* StreakMilestoneOverlay */),
      ],
      if (partyProvider.isLightstickMode)
        LightstickMode(
          onExit: () {
            partyProvider.setLightstickMode(false);
            socketClient.emitLightstickToggled(false);
          },
        ),
      ```
    - **Always visible regardless of mode:** `SongOverButton` (host only), `GroupCardAnnouncementOverlay` (if active), `TagTeamFlashWidget` (if active)
    - Add mode toggle buttons row in lean-in mode (positioned above SongOverButton):
      - `[💡 Lightstick]` button — taps call `partyProvider.setLightstickMode(true)` + `socketClient.emitLightstickToggled(true)`
      - `[⚡ Hype]` button — renders `HypeSignalButton` widget (available in BOTH modes — also rendered inside `LightstickMode` widget)
    - **Positioning:** Mode toggle buttons use a `Positioned` widget following existing `bottom:` offset pattern

- [x] Task 9: Add copy strings (AC: #1-4)
  - [x]9.1 In `apps/flutter_app/lib/constants/copy.dart`:
    - `lightstickToggle: 'Lightstick'`
    - `lightstickExitHint: 'Tap anywhere to exit'`
    - `hypeSignalButton: 'Hype'`
    - `hypeSignalCooldown: 'Recharging...'`

- [x] Task 10: Write server tests (AC: #1-5)
  - [x]10.1 Create `apps/server/tests/socket-handlers/lightstick-handlers.test.ts`:
    - Test `lightstick:toggled` handler:
      - Only fires during `DJState.song` — rejected in other states
      - Records participation action with passive scoring
      - Appends event to event stream with `active: true/false`
      - Does NOT broadcast to other participants (private mode)
    - Test `hype:fired` handler:
      - Only fires during `DJState.song` — rejected in other states
      - First fire: records participation action with active scoring, appends to event stream
      - Second fire within 5s: returns `hype:cooldown` to sender with `remainingMs`
      - After 5s cooldown: fires again successfully
      - Does NOT broadcast to other participants
      - Test `lastHypeTime` map cleanup on disconnect
    - Use existing test factories for mock socket/session objects (follow `soundboard-handlers.test.ts` pattern)

- [x] Task 11: Write Flutter tests (AC: #1-6)
  - [x]11.1 Create `apps/flutter_app/test/widgets/lightstick_mode_test.dart`:
    - Test full-screen glow renders with provider's lightstick color
    - Test color picker dots render (5 dots)
    - Test tapping a color dot updates provider's lightstick color
    - Test tap anywhere triggers exit callback
    - Test hype button is rendered within lightstick mode
    - Test Song Over button visible when isHost
    - DO NOT test: exact animation values, glow gradients, reduced motion specifics
  - [x]11.2 Create `apps/flutter_app/test/widgets/hype_signal_button_test.dart`:
    - Test tap triggers screen flash effect
    - Test button is dimmed during cooldown
    - Test cooldown indicator renders during cooldown
    - Test button re-enables after cooldown expires
    - Test tap during cooldown does nothing
    - DO NOT test: flashlight activation (hardware-dependent), exact animation timing
  - [x]11.3 In `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `setLightstickMode(true)` sets `isLightstickMode` to true
    - Test `setLightstickMode(false)` sets `isLightstickMode` to false
    - Test `setLightstickColor` updates `lightstickColor`
    - Test `startHypeCooldown` sets `isHypeCooldown` to true
    - Test `clearHypeCooldown` sets `isHypeCooldown` to false
    - Test lightstick mode resets to false when DJ state leaves song
    - Test hype cooldown resets to false when DJ state leaves song
    - Test `onHypeCooldownEnforced` from server sets cooldown state

## Dev Notes

### Architecture Compliance

- **Server-authoritative:** Server handles participation scoring and event logging. Lightstick mode is purely client-side visual — no game state on server. Hype signal scoring happens server-side. The server does NOT broadcast lightstick/hype events to other users — these are local experiences.
- **Socket handler pattern:** `registerLightstickHandlers()` follows `registerSoundboardHandlers()` exactly. One file in `socket-handlers/`, exported function with `(socket, io)` signature — extract `sessionId`/`userId` from `socket.data` inside. **NOTE:** Architecture doc maps lightstick/hype to `reaction-handlers.ts`, but a separate `lightstick-handlers.ts` is a better separation of concerns.
- **Boundary enforcement:** `lightstick-handlers.ts` goes in `socket-handlers/` — it calls services (rate-limiter, event-stream, session-manager). ZERO persistence imports. Rate limiter is a pure function with no Socket.io dependency.
- **Provider pattern:** `PartyProvider` is a read-only reactive container. Widgets call `setLightstickMode()` and `setLightstickColor()` for state changes. Socket emissions happen in the widget/screen layer, NOT in the provider. Provider does not import or reference `SocketClient`.
- **No provider-to-provider access:** `LightstickMode` widget reads from `PartyProvider` via `context.watch` — vibe colors come from `PartyProvider.vibe` (there is no separate `VibeProvider`). No provider accesses another provider.

### Existing Code to Reuse (DO NOT Recreate)

| What | File (under `apps/server/src/` or `apps/flutter_app/lib/`) | Key exports / line refs |
|------|------|------------|
| Soundboard handler (template) | `socket-handlers/soundboard-handlers.ts` | `registerSoundboardHandlers()` — copy this structure for lightstick handlers |
| Reaction handler (template) | `socket-handlers/reaction-handlers.ts` | Similar guard pattern, rate limiting integration |
| Rate limiter | `services/rate-limiter.ts` | `checkRateLimit()` — use for lightstick toggle (standard limits). **DO NOT use for hype cooldown** — it never returns `allowed: false` and shares global state. Hype needs dedicated `Map<string, number>` |
| Participation scoring | `services/participation-scoring.ts` | `ACTION_TIER_MAP` — **MUST add** `'lightstick:toggled'` (passive) and `'hype:fired'` (active) entries |
| Event stream | `services/event-stream.ts` | `appendEvent()` — extend `SessionEvent` union |
| Event constants | `shared/events.ts` | Add `LIGHTSTICK_TOGGLED` and `HYPE_FIRED` |
| Activity tracker | `services/session-manager.ts` | `recordActivity(sessionId)` — call from both handlers to reset inactivity timer |
| recordParticipationAction | `services/session-manager.ts` | `recordParticipationAction(sessionId, userId, actionType, rewardMultiplier)` — handles scoring + event stream logging |
| Connection handler registration | `socket-handlers/connection-handler.ts` | Registration point for new handler — call `registerLightstickHandlers(socket, io)` |
| Party provider | `state/party_provider.dart` | Add lightstick/hype state fields here |
| Socket client | `socket/client.dart` | Add `emitLightstickToggled()`, `emitHypeSignal()` emissions |
| Party screen | `screens/party_screen.dart:269-290` | Song state Stack — integrate mode toggle + conditional rendering |
| Reaction bar | `widgets/reaction_bar.dart` | Existing song-state widget (hidden in lightstick mode) |
| Soundboard bar | `widgets/soundboard_bar.dart` | Existing song-state widget (hidden in lightstick mode) |
| DJTokens | `theme/dj_tokens.dart` | Spacing, text styling, `textSecondary` for dimmed cooldown state. **`actionPrimary` does NOT exist in DJTokens** — use vibe colors |
| Vibe theme | `theme/dj_theme.dart` | `PartyVibe` enum with `.accent`, `.glow`, `.primary` — accessed via `context.watch<PartyProvider>().vibe`. Use for hype button color + lightstick color palette |
| Song Over button | `widgets/song_over_button.dart` | Must remain visible in both modes |
| Pulse animation pattern | `widgets/tag_team_flash_widget.dart` | `AnimationController` with `repeat(reverse: true)` — similar breathing effect for lightstick glow |
| Streak overlay pattern | `widgets/reaction_streak_overlay.dart` | Full-screen overlay animation pattern |
| Copy strings | `constants/copy.dart` | Add lightstick/hype copy at end of existing strings |
| Wakelock usage | `state/party_provider.dart:9,44-46` | Pattern for integrating native plugins — follow for torch_light |

### Key Design Decisions

**Why no broadcast for lightstick/hype?** The UX spec explicitly states "mode selection is private — no broadcast of which mode a user is in." Lightstick mode is a local visual experience (phone-as-lightstick in a physical room). Hype signal is also local — the physical flash/strobe IS the communication to the singer across the room. No need for digital echo.

**Why server-side hype cooldown with dedicated Map?** Client-side cooldown prevents spamming, but a malicious client could bypass it. Server enforces the 5s cooldown via a per-user `Map<string, number>` (NOT `checkRateLimit()` — that function never blocks, only decays rewards, and its shared `recordUserEvent` state would corrupt reaction/soundboard rate limiting). The server responds with `hype:cooldown` if the client fires too fast.

**Why evaluate flashlight plugins carefully?** The `torch_light` package has limited pub.dev usage. Dev should verify it compiles and runs on both iOS and Android before committing. Alternatives: `flashlight_control`, `camera` torch mode. The flashlight is a graceful degradation feature — screen flash always works, LED is optional.

**Lightstick color picker — 5 colors:** 3 from vibe palette (`accent`, `glow`, `primary`) + 2 universal (white, warm red). This gives variety without overwhelming the UX. Colors are intentionally vibe-aware — lightstick in "Chill Vibes" mode will have different defaults than "Hype Mode."

### Participation Scoring Integration

| Action | Tier | Points | Rate Limiting | ACTION_TIER_MAP Entry |
|--------|------|--------|---------------|----------------------|
| `lightstick:toggled` (active=true) | Passive | 1pt | Standard `checkRateLimit()` (10/5s window) | `'lightstick:toggled': ParticipationTier.passive` |
| `hype:fired` | Active | 3pts | Dedicated `Map<string, number>` (hard 5s cooldown) | `'hype:fired': ParticipationTier.active` |

**CRITICAL:** Both action types MUST be added to `ACTION_TIER_MAP` in `participation-scoring.ts` (Task 2). Without them, `recordParticipationAction` returns 0 points silently. Follow the exact same `recordParticipationAction` + `recordActivity` pattern used in `soundboard-handlers.ts`.

### New Files

- `apps/server/src/socket-handlers/lightstick-handlers.ts` — socket handlers for lightstick toggle + hype signal
- `apps/flutter_app/lib/widgets/lightstick_mode.dart` — full-screen lightstick glow + color picker
- `apps/flutter_app/lib/widgets/hype_signal_button.dart` — hype flash button with cooldown
- `apps/server/tests/socket-handlers/lightstick-handlers.test.ts` — server handler tests
- `apps/flutter_app/test/widgets/lightstick_mode_test.dart` — lightstick widget tests
- `apps/flutter_app/test/widgets/hype_signal_button_test.dart` — hype button widget tests

### Modified Files

- `apps/server/src/shared/events.ts` — add `LIGHTSTICK_TOGGLED`, `HYPE_FIRED` constants
- `apps/server/src/services/participation-scoring.ts` — add `lightstick:toggled` and `hype:fired` to `ACTION_TIER_MAP`
- `apps/server/src/services/event-stream.ts` — add lightstick/hype to `SessionEvent` union
- `apps/server/src/socket-handlers/connection-handler.ts` — register lightstick handlers
- `apps/flutter_app/lib/state/party_provider.dart` — add lightstick mode + hype cooldown state
- `apps/flutter_app/lib/socket/client.dart` — add emit methods + `hype:cooldown` listener
- `apps/flutter_app/lib/screens/party_screen.dart` — conditional lean-in/lightstick rendering + mode toggle buttons
- `apps/flutter_app/lib/constants/copy.dart` — add lightstick/hype copy strings
- `apps/flutter_app/pubspec.yaml` — add `torch_light` dependency
- `apps/flutter_app/test/state/party_provider_test.dart` — add lightstick/hype state tests

### Previous Story (4.6) Intelligence

- Story 4.6 established the pattern for group card overlays in `party_screen.dart` — lightstick follows a similar conditional rendering approach in the Stack
- `party_screen.dart` uses `Positioned` widgets with `bottom:` offsets for song-state UI layout — mode toggle buttons should follow this pattern
- 677 server tests pass, 444/445 Flutter tests pass (1 pre-existing failure in party_screen_test.dart unrelated) — regression baseline
- All Epic 4 stories (4.1-4.6) are done — this is the final story in Epic 4

### Git Intelligence (Recent Patterns)

- 16 files changed in Story 4.6, expect ~14-16 files for this story (similar scope)
- Socket handler tests follow: describe blocks per handler, mock socket/session objects from factories
- Flutter widget tests use `WidgetTester`, mock providers with `ChangeNotifierProvider.value`
- Event stream extension pattern: add type to `SessionEvent` union, call `appendEvent()` with matching shape
- All commits squashed with code review fixes

### References

- [Source: _bmad-output/project-context.md] — all architecture rules, boundaries, and anti-patterns
- [Source: _bmad-output/planning-artifacts/prd.md#FR63-FR66] — lightstick mode and hype signal functional requirements
- [Source: _bmad-output/planning-artifacts/prd.md#Participation-Weighting] — passive (1pt) for lightstick, active (3pts) for hype
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Song-State-Screen-Layout] — lean-in vs lightstick mode layouts, color picker design, hype button specs
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Mode-Toggle-Design-Rules] — mode switching rules, private mode, host controls visibility
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Reduced-Motion] — lightstick static fill, hype single flash, no flashlight
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4-Story-4.7] — acceptance criteria and story definition
- [Source: _bmad-output/planning-artifacts/architecture.md#File-Structure] — `lightstick_mode.dart`, `hype_signal_button.dart` planned locations

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed duplicate key issue in lightstick color picker: `PartyVibe.general` has accent=glow=0xFFFFD700, causing duplicate widget keys. Changed from color-value-based keys to index-based keys.
- torch_light ^2.0.0 does not exist on pub.dev; downgraded to ^1.1.0 which resolved and installed successfully.

### Completion Notes List

- Task 1: Added `LIGHTSTICK_TOGGLED`, `HYPE_FIRED`, `HYPE_COOLDOWN` event constants to `events.ts`. Extended `SessionEvent` union with lightstick:toggled and hype:fired types.
- Task 2: Added `lightstick:toggled` (passive, 1pt) and `hype:fired` (active, 3pts) to `ACTION_TIER_MAP` in `participation-scoring.ts`.
- Task 3: Created `lightstick-handlers.ts` following soundboard handler pattern. Lightstick toggle records participation when active=true with standard rate limiting. Hype signal uses dedicated `Map<string, number>` for 5s hard cooldown (NOT shared rate limiter). No broadcasts — both are private/local experiences. Cleanup on disconnect. Registered in connection-handler.ts.
- Task 4: Added `emitLightstickToggled()`, `emitHypeSignal()` methods and `hype:cooldown` listener to `SocketClient`.
- Task 5: Added lightstick mode state (`isLightstickMode`, `lightstickColor`) and hype cooldown state (`isHypeCooldown`, `hypeCooldownEnd`) to `PartyProvider`. All states reset on song exit.
- Task 6: Created `LightstickMode` widget with breathing glow animation, 5-color picker (3 vibe + white + warm red), exit on tap/swipe, hype button, and Song Over button for hosts. Supports reduced motion (static color fill).
- Task 7: Created `HypeSignalButton` widget with screen flash (3 rapid white pulses via Overlay), flashlight activation (torch_light, graceful degradation), 5s cooldown with circular progress indicator. Reduced motion: single flash, no flashlight.
- Task 8: Integrated lightstick mode into `PartyScreen` with conditional lean-in/lightstick rendering. Mode toggle buttons (Lightstick + Hype) positioned in lean-in mode. SongOverButton, GroupCardAnnouncementOverlay, TagTeamFlashWidget remain visible in both modes.
- Task 9: Added copy strings to `copy.dart`.
- Task 10: Created server tests (14 new tests). All 691 server tests pass.
- Task 11: Created Flutter widget tests for LightstickMode (7 tests) and HypeSignalButton (6 tests). Added 9 party_provider tests for lightstick/hype state. All new tests pass. 1 pre-existing failure in party_screen_test.dart (DJTokens.actionPrimary in tag_team_flash_widget.dart from Story 4.6) — not related.

### Change Log

- 2026-03-15: Implemented Story 4.7 — Lightstick Mode & Hype Signal (all 11 tasks, all ACs)
- 2026-03-15: Code review fixes — removed duplicate SongOverButton from LightstickMode widget (rendered by PartyScreen instead), fixed flash overlay dispose race condition, deferred AnimationController creation to didChangeDependencies for reduced motion, session-scoped hype cooldown key, added input validation tests

### File List

**New files:**
- apps/server/src/socket-handlers/lightstick-handlers.ts
- apps/flutter_app/lib/widgets/lightstick_mode.dart
- apps/flutter_app/lib/widgets/hype_signal_button.dart
- apps/server/tests/socket-handlers/lightstick-handlers.test.ts
- apps/flutter_app/test/widgets/lightstick_mode_test.dart
- apps/flutter_app/test/widgets/hype_signal_button_test.dart

**Modified files:**
- apps/server/src/shared/events.ts — added LIGHTSTICK_TOGGLED, HYPE_FIRED, HYPE_COOLDOWN constants
- apps/server/src/services/event-stream.ts — added lightstick/hype to SessionEvent union
- apps/server/src/services/participation-scoring.ts — added lightstick:toggled and hype:fired to ACTION_TIER_MAP
- apps/server/src/socket-handlers/connection-handler.ts — registered lightstick handlers
- apps/flutter_app/lib/state/party_provider.dart — added lightstick mode + hype cooldown state
- apps/flutter_app/lib/socket/client.dart — added emit methods + hype:cooldown listener
- apps/flutter_app/lib/screens/party_screen.dart — conditional lean-in/lightstick rendering + mode toggle buttons
- apps/flutter_app/lib/constants/copy.dart — added lightstick/hype copy strings
- apps/flutter_app/pubspec.yaml — added torch_light: ^1.1.0 dependency
- apps/flutter_app/pubspec.lock — updated from pubspec.yaml torch_light addition
- apps/flutter_app/test/state/party_provider_test.dart — added lightstick/hype state tests
- _bmad-output/implementation-artifacts/sprint-status.yaml — story status tracking

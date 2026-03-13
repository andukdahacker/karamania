# Story 4.1: Emoji Reactions System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to send emoji reactions during performances that appear instantly on everyone's phone,
so that I can cheer on the performer and feel the group energy in real-time.

## Acceptance Criteria

1. **Given** a song is being performed **When** a participant taps an emoji reaction **Then** the reaction appears on all connected phones within 100ms of the originating tap (FR22, NFR2) **And** the app maintains 60fps rendering with up to 12 participants each sending reactions at peak rate (2 taps/second) (NFR5) **And** client memory usage does not grow by more than 15MB over a 3-hour session with typical reaction patterns (NFR28) **And** reaction tap targets are no smaller than 48x48px (NFR14)
2. **Given** a participant is sending reactions rapidly **When** they exceed 10 events in 5 seconds **Then** each subsequent event earns 50% fewer participation points and visual feedback dims proportionally (NFR23) **And** after 20 events in 5 seconds, reward and feedback diminish to near-zero (NFR23) **And** no hard block occurs -- the user can always tap (NFR23) **And** rate limiting resets after 5 seconds of inactivity (NFR23)
3. **Given** rate limiting is implemented **When** it checks an event **Then** the pure function in `services/rate-limiter.ts` has no Socket.io dependency

## Tasks / Subtasks

- [x] Task 1: Create reaction socket handler (AC: #1, #3)
  - [x] 1.1 Create `apps/server/src/socket-handlers/reaction-handlers.ts`. Follow the one-file-per-namespace pattern established by `party-handlers.ts` and `host-handlers.ts`. Export `registerReactionHandlers(socket, io)` — uses `(socket, io)` signature matching `host-handlers.ts` (NOT `party-handlers.ts` which takes socket only). The `io` parameter is needed for `io.to(sessionId).emit()` which broadcasts to ALL clients including sender:
    ```typescript
    import type { Server } from 'socket.io';
    import type { AuthenticatedSocket } from './auth-middleware.js';
    import { EVENTS } from '../shared/events.js';
    import { recordUserEvent, checkRateLimit } from '../services/rate-limiter.js';
    import { recordParticipationAction, getSessionDjState } from '../services/session-manager.js';
    import { recordActivity } from '../services/session-manager.js';
    import { DJState } from '../dj-engine/types.js';

    export function registerReactionHandlers(socket: AuthenticatedSocket, io: Server): void {
      socket.on(EVENTS.REACTION_SENT, async (data: { emoji: string }) => {
        const { sessionId, userId } = socket.data;
        if (!sessionId || !userId) return;

        // State guard: reactions only during song state
        const context = getSessionDjState(sessionId);
        if (!context || context.state !== DJState.song) return;

        // Track session activity (matches party-handlers pattern)
        recordActivity(sessionId);

        // Rate limiting — pure function, no Socket.io dependency
        const now = Date.now();
        const timestamps = recordUserEvent(userId, now);
        const { rewardMultiplier } = checkRateLimit(timestamps, now);

        // Broadcast to ALL participants in session (including sender)
        io.to(sessionId).emit(EVENTS.REACTION_BROADCAST, {
          userId,
          emoji: data.emoji,
          rewardMultiplier,
        });

        // Participation scoring + event stream logging (fire-and-forget)
        // recordParticipationAction internally handles appendEvent for participation:scored
        // DO NOT call appendEvent separately — it would create duplicate events
        recordParticipationAction(sessionId, userId, 'reaction:sent', rewardMultiplier).catch(() => {});
      });
    }
    ```
    **Design decisions:**
    - `io.to(sessionId).emit()` broadcasts to ALL clients including sender (sender needs to see their own reaction in the feed). This differs from `socket.to()` which excludes sender
    - `rewardMultiplier` is sent to ALL clients in the broadcast so each client can dim the visual feedback for rate-limited reactions from any user
    - State guard silently drops reactions outside `song` state — no error emission (AC says "during performances")
    - Fire-and-forget for scoring — reaction latency must be <100ms (NFR2), can't await DB writes
    - `recordParticipationAction` (from `session-manager.ts`, NOT `participation-scoring.ts`) handles BOTH scoring and event stream logging internally — no separate `appendEvent` call needed
    - `recordActivity(sessionId)` called for session keepalive tracking, matching the pattern in `party-handlers.ts`
    - Emoji validation is intentionally minimal — the vibe emoji set is enforced client-side, but server accepts any string to avoid blocking legitimate reactions if the client emoji set is updated
    - Uses `AuthenticatedSocket` type (from `auth-middleware.ts`) for proper typing of `socket.data`
    - `getSessionDjState(sessionId)` returns `DJContext | undefined` — same accessor used by `host-handlers.ts` (line 67)
  - [x] 1.2 Register the handler in `apps/server/src/socket-handlers/connection-handler.ts`. Add after `registerHostHandlers(socket, io)`:
    ```typescript
    import { registerReactionHandlers } from './reaction-handlers.js';
    // After registerHostHandlers(socket, io):
    registerReactionHandlers(socket, io);
    ```
    Handler signature: `registerPartyHandlers(socket)` takes socket only; `registerHostHandlers(socket, io)` and `registerReactionHandlers(socket, io)` take both socket and io.

- [x] Task 2: Add reaction state to PartyProvider (AC: #1, #2)
  - [x] 2.1 In `apps/flutter_app/lib/state/party_provider.dart`, add reaction state fields:
    ```dart
    // Reaction state
    final List<ReactionEvent> _reactionFeed = [];
    static const int _maxReactionFeedSize = 50;

    List<ReactionEvent> get reactionFeed => List.unmodifiable(_reactionFeed);
    ```
  - [x] 2.2 Create `ReactionEvent` class (in the same file or a dedicated model file — follow existing patterns for where data classes live):
    ```dart
    class ReactionEvent {
      const ReactionEvent({
        required this.userId,
        required this.emoji,
        required this.rewardMultiplier,
        required this.timestamp,
      });

      final String userId;
      final String emoji;
      final double rewardMultiplier;
      final int timestamp;
    }
    ```
  - [x] 2.3 Add mutation method called ONLY by SocketClient:
    ```dart
    void onReactionBroadcast({
      required String userId,
      required String emoji,
      required double rewardMultiplier,
    }) {
      _reactionFeed.add(ReactionEvent(
        userId: userId,
        emoji: emoji,
        rewardMultiplier: rewardMultiplier,
        timestamp: DateTime.now().millisecondsSinceEpoch,
      ));
      // Cap feed size to prevent unbounded memory growth (NFR28)
      if (_reactionFeed.length > _maxReactionFeedSize) {
        _reactionFeed.removeAt(0);
      }
      notifyListeners();
    }
    ```
  - [x] 2.4 Clear reaction feed on DJ state transitions that exit song state. In the existing DJ state update handler (e.g., `onDjStateUpdate`), add:
    ```dart
    // Clear reaction feed when leaving song state
    if (state != DJState.song) {
      _reactionFeed.clear();
    }
    ```
    **CRITICAL:** Find the EXACT method that handles `dj:stateChanged` in PartyProvider and add the clear there. Do NOT create a separate method — integrate into the existing state transition flow.

- [x] Task 3: Wire reaction events in SocketClient (AC: #1)
  - [x] 3.1 In `apps/flutter_app/lib/socket/client.dart`, add emit method:
    ```dart
    void emitReaction(String emoji) {
      _socket?.emit('reaction:sent', {'emoji': emoji});
    }
    ```
  - [x] 3.2 Add listener in the party listener setup method (find `_setupPartyListeners` or equivalent). The provider is accessed via `_partyProvider` (private field, set in `connect()` method):
    ```dart
    on('reaction:broadcast', (data) {
      final payload = data as Map<String, dynamic>;
      _partyProvider?.onReactionBroadcast(
        userId: payload['userId'] as String,
        emoji: payload['emoji'] as String,
        rewardMultiplier: (payload['rewardMultiplier'] as num).toDouble(),
      );
    });
    ```
    **CRITICAL:** Uses `_partyProvider?.` (private field with null-safe access) — same pattern as all other listeners (e.g., `ceremony:reveal`, `dj:stateChanged`).

- [x] Task 4: Create ReactionBar widget (AC: #1, #2)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/reaction_bar.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/constants/tap_tiers.dart';
    import 'package:karamania/socket/client.dart';
    import 'package:karamania/theme/dj_theme.dart';
    import 'package:karamania/theme/dj_tokens.dart';
    import 'package:karamania/widgets/dj_tap_button.dart';

    /// Row of vibe-specific emoji reaction buttons.
    /// Tapping sends reaction via socket. Visual feedback dims when rate-limited.
    class ReactionBar extends StatelessWidget {
      const ReactionBar({
        super.key,
        required this.vibe,
      });

      final PartyVibe vibe;

      @override
      Widget build(BuildContext context) {
        final emojis = vibeReactionButtons[vibe] ??
            vibeReactionButtons[PartyVibe.general]!;

        return Row(
          key: const Key('reaction-bar'),
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: emojis.map((emoji) {
            return DJTapButton(
              key: Key('reaction-emoji-$emoji'),
              tier: TapTier.social,
              onTap: () => SocketClient.instance.emitReaction(emoji),
              child: Text(
                emoji,
                style: const TextStyle(fontSize: 32),
              ),
            );
          }).toList(),
        );
      }
    }
    ```
    **Design decisions:**
    - Uses `TapTier.social` — 56x56px minimum (exceeds 48px NFR14 requirement), immediate fire, light haptic, 200ms debounce
    - `vibeReactionButtons` from `copy.dart` already has vibe-specific emoji sets with 4 emojis each (general, kpop, rock, ballad, edm). UX spec mentions "5 reaction buttons" but the implemented map has 4 — use the 4 emojis as-is (code is source of truth). Do NOT add a 5th emoji
    - `SocketClient.instance.emitReaction(emoji)` — widget calls SocketClient for outbound events (this is the approved pattern: widgets emit events via SocketClient, server broadcasts back, SocketClient calls provider mutation)
    - StatelessWidget — no local state needed, DJTapButton handles haptics and debounce
    - No rate limit visual dimming in this widget — the dimming applies to the REACTION FEED display (incoming reactions), not the send buttons. Users can ALWAYS tap (NFR23: "no hard block"). The reward multiplier dims the floating emoji animation, not the button itself

- [x] Task 5: Create ReactionFeed widget (AC: #1, #2)
  - [x] 5.1 Create `apps/flutter_app/lib/widgets/reaction_feed.dart`:
    ```dart
    import 'dart:math';
    import 'package:flutter/material.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    /// Floating emoji reaction display using implicit animations.
    /// Emoji particles float upward with random horizontal scatter.
    /// Uses pre-rendered scatter patterns (NOT real-time physics) per NFR5.
    class ReactionFeed extends StatelessWidget {
      const ReactionFeed({
        super.key,
        required this.reactions,
      });

      final List<ReactionFeedItem> reactions;

      @override
      Widget build(BuildContext context) {
        return IgnorePointer(
          key: const Key('reaction-feed'),
          child: SizedBox.expand(
            child: Stack(
              children: reactions.map((reaction) {
                return _ReactionParticle(
                  key: ValueKey(reaction.id),
                  emoji: reaction.emoji,
                  startX: reaction.startX,
                  opacity: reaction.opacity,
                );
              }).toList(),
            ),
          ),
        );
      }
    }

    class ReactionFeedItem {
      ReactionFeedItem({
        required this.emoji,
        required this.rewardMultiplier,
      })  : id = _counter++,
            startX = _random.nextDouble(),
            opacity = rewardMultiplier.clamp(0.1, 1.0);

      static int _counter = 0;
      static final Random _random = Random();

      final int id;
      final String emoji;
      final double rewardMultiplier;
      final double startX;
      final double opacity;
    }

    /// Individual emoji particle that floats up and fades out.
    /// Uses AnimatedBuilder (a real Flutter widget) with AnimationController.
    /// Notifies parent via onComplete when animation finishes for cleanup.
    class _ReactionParticle extends StatefulWidget {
      const _ReactionParticle({
        super.key,
        required this.emoji,
        required this.startX,
        required this.opacity,
        required this.onComplete,
      });

      final String emoji;
      final double startX;
      final double opacity;
      final VoidCallback onComplete;

      @override
      State<_ReactionParticle> createState() => _ReactionParticleState();
    }

    class _ReactionParticleState extends State<_ReactionParticle>
        with SingleTickerProviderStateMixin {
      late final AnimationController _controller;

      @override
      void initState() {
        super.initState();
        _controller = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 1500),
        );
        _controller.addStatusListener((status) {
          if (status == AnimationStatus.completed) {
            widget.onComplete();
          }
        });
        _controller.forward();
      }

      @override
      void dispose() {
        _controller.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = _controller.value;
            return Positioned(
              left: widget.startX * MediaQuery.of(context).size.width * 0.8 +
                  MediaQuery.of(context).size.width * 0.1,
              bottom: t * MediaQuery.of(context).size.height * 0.5 +
                  MediaQuery.of(context).size.height * 0.1,
              child: Opacity(
                opacity: widget.opacity * (1.0 - t),
                child: child,
              ),
            );
          },
          child: Text(
            widget.emoji,
            style: const TextStyle(fontSize: 28),
          ),
        );
      }
    }
    ```
    **CRITICAL IMPLEMENTATION NOTES:**
    - `AnimatedBuilder` IS a valid Flutter widget (`package:flutter/widgets.dart`) — do NOT replace it with something else. The code above uses it correctly with `animation`, `builder`, and `child` parameters
    - **Particle cleanup (NFR28):** Each particle has an `onComplete` callback. When the `AnimationController` reaches `AnimationStatus.completed`, it calls `onComplete` which should remove the reaction from the provider feed. Implement this cleanup in the `ReactionFeed` or via a callback to `PartyProvider.removeReaction(id)`. Without this, completed particles remain in the widget tree indefinitely
    - **Alternative approach:** If per-particle AnimationControllers cause performance issues on budget Android (36 concurrent at peak), refactor to a single `CustomPainter` with one `AnimationController` that drives all particles via a particle list. This is more performant but more complex
    - **60fps (NFR5):** With 12 users at 2 taps/sec = 24 reactions/sec peak. Each particle lives 1.5s. Max concurrent particles: ~36. This is manageable with individual AnimationControllers, but a CustomPainter approach is safer for budget Android
    - `IgnorePointer` wraps the feed so taps pass through to the reaction buttons underneath
    - `opacity` derived from `rewardMultiplier` — rate-limited reactions appear dimmer (AC #2: "visual feedback dims proportionally")
    - `ValueKey(reaction.id)` prevents ghost elements in Stack (project anti-pattern: use ValueKey in list builders)

- [x] Task 6: Integrate reaction UI into party screen (AC: #1)
  - [x] 6.1 In `apps/flutter_app/lib/screens/party_screen.dart`, add imports:
    ```dart
    import 'package:karamania/widgets/reaction_bar.dart';
    import 'package:karamania/widgets/reaction_feed.dart';
    ```
  - [x] 6.2 Add the reaction UI when DJ state is `song`. The reaction bar goes at the bottom of the song content area. The reaction feed overlays the center of the screen. Find where the party screen renders content for `DJState.song` and add:
    ```dart
    // Inside the existing content area, when djState == DJState.song:
    // Reaction feed overlay (floating emojis)
    ReactionFeed(reactions: partyProvider.reactionFeed
        .map((e) => ReactionFeedItem(
              emoji: e.emoji,
              rewardMultiplier: e.rewardMultiplier,
            ))
        .toList()),
    // Reaction bar at bottom
    ReactionBar(vibe: displayVibe),
    ```
    **CRITICAL:** Study the current party screen build method carefully. The screen likely uses conditional rendering based on `djState`. The reaction UI should ONLY appear during `DJState.song`. Do NOT wrap in a new Stack if one already exists — add to the existing layout structure. The reaction feed should be positioned to not interfere with performer name, countdown timer, or other song-state UI elements.
  - [x] 6.3 **Memory cleanup:** When `ReactionFeedItem` particles finish their animation, they need to be removed. Options:
    - A: Provider manages a cleanup timer that removes old reactions (e.g., older than 2s)
    - B: The ReactionFeed widget manages its own internal state for active/completed particles
    - Choose the approach that aligns with the existing provider-vs-widget state split. Since `showMomentCard` (UI display state) was managed in the provider (Story 3.5 precedent), a provider-managed cleanup approach is consistent

- [x] Task 7: Server tests (AC: #1, #2, #3)
  - [x] 7.1 Create `apps/server/tests/socket-handlers/reaction-handlers.test.ts`:
    - Test reaction during `DJState.song` broadcasts to session room via `io.to(sessionId).emit()`
    - Test reaction outside `DJState.song` is silently dropped (no broadcast, no scoring)
    - Test broadcast payload includes `userId`, `emoji`, `rewardMultiplier`
    - Test broadcast uses `io.to(sessionId).emit()` (includes sender, NOT `socket.to()`)
    - Test `recordParticipationAction` is called with `'reaction:sent'` and correct multiplier
    - Test `recordActivity` is called with sessionId
    - Test reaction with missing sessionId/userId returns silently
    - Test reaction with undefined DJ state (no session) returns silently
    - **Use existing test factories:** `createTestDJContextInState(DJState.song)`, `createTestSession()`, `createTestParticipant()`
    - **Follow existing socket handler test patterns** from `party-handlers.test.ts` and `host-handlers.test.ts`: use `vi.mock()` for dependencies, `createMockSocket()` / `createMockIO()` helpers, verify via `vi.fn()` assertions
  - [x] 7.2 Rate limiter tests already exist in `apps/server/tests/services/rate-limiter.test.ts`. Verify these cover:
    - 10 events in 5s returns rewardMultiplier of 1.0
    - 11th event returns diminished multiplier
    - 20+ events return near-zero multiplier
    - 5s inactivity resets the counter
    - If any of these are missing, add them. Do NOT duplicate existing tests
  - [x] 7.3 Verify participation scoring tests cover `'reaction:sent'` action mapping to active tier (3pts). These should already exist from Story 3.1. Do NOT duplicate
  - [x] 7.4 **Regression tests**: Run full test suite — all 555+ existing tests still pass

- [x] Task 8: Flutter tests (AC: #1, #2)
  - [x] 8.1 Create `apps/flutter_app/test/widgets/reaction_bar_test.dart`:
    - Test ReactionBar renders correct number of emoji buttons for each vibe
    - Test ReactionBar renders default emojis when vibe has no specific set
    - Test each emoji button has `Key('reaction-emoji-$emoji')`
    - Test ReactionBar has `Key('reaction-bar')`
    - **DO NOT test:** haptic feedback, exact button sizes, DJTapButton internals
  - [x] 8.2 Create `apps/flutter_app/test/widgets/reaction_feed_test.dart`:
    - Test ReactionFeed renders emoji text for each reaction
    - Test ReactionFeed uses `IgnorePointer` wrapper
    - Test ReactionFeed has `Key('reaction-feed')`
    - Test empty reaction list renders no particles
    - **DO NOT test:** animation timing, exact positions, opacity values, frame rates
  - [x] 8.3 Update `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `onReactionBroadcast` adds reaction to feed and notifies
    - Test reaction feed caps at `_maxReactionFeedSize` (50)
    - Test reaction feed clears when DJ state exits `song`
    - Test `reactionFeed` getter returns unmodifiable list
  - [x] 8.4 Update `apps/flutter_app/test/socket/client_test.dart`:
    - Test `emitReaction` emits `reaction:sent` with correct payload
    - Test `reaction:broadcast` listener calls `partyProvider.onReactionBroadcast` with correct args
  - [x] 8.5 **Regression tests**: Run full Flutter test suite — all 351+ existing tests still pass

## Dev Notes

### Architecture: Server-Authoritative Reactions

The reaction system follows the core server-authoritative pattern. The flow:

1. User taps emoji → `SocketClient.emitReaction(emoji)` → server receives `reaction:sent`
2. Server validates DJ state is `song`, applies rate limiting
3. Server broadcasts `reaction:broadcast` with `{userId, emoji, rewardMultiplier}` to ALL clients
4. Each Flutter client receives broadcast → `PartyProvider.onReactionBroadcast()` → UI updates
5. Server fires-and-forgets participation scoring (which internally handles event stream logging)

The user sees their OWN reaction via the server broadcast (not local echo). This ensures consistency — if rate limiting reduces the multiplier, the visual dimming is applied uniformly.

[Source: _bmad-output/project-context.md#Core Principle — "Server-authoritative architecture"]

### Existing Infrastructure (DO NOT Recreate)

**Already built and ready to use:**
- **Rate limiter** (`services/rate-limiter.ts`): `checkRateLimit()` returns `{ rewardMultiplier }`, `recordUserEvent()` tracks timestamps. Pure function, no Socket.io dependency (AC #3). Sliding window: 5s, 10 max events, exponential decay multiplier
- **Participation scoring** (`services/participation-scoring.ts` for tier mapping, `services/session-manager.ts` for `recordParticipationAction`): `reaction:sent` already mapped to Active tier (3pts). `recordParticipationAction(sessionId, userId, action, rewardMultiplier)` in session-manager.ts handles scoring + DB update + event stream logging internally — DO NOT call `appendEvent` separately
- **Event constants** (`shared/events.ts`): `REACTION_SENT`, `REACTION_BROADCAST`, `REACTION_STREAK` already defined
- **Vibe reaction emojis** (`constants/copy.dart`): `vibeReactionButtons` map already has per-vibe emoji arrays (general: fire/clap/laugh/skull, kpop: fire/clap/heart/skull, etc.)
- **DJTapButton + TapTier.social** (`widgets/dj_tap_button.dart`, `constants/tap_tiers.dart`): 56x56px min target, immediate fire, light haptic, 200ms debounce
- **Award generator** (`services/award-generator.ts`): Already counts reactions via `countRecentReactions()` from event stream. Awards with `highReactions` affinity boost when `reactionCount >= participantCount * 2`
- **Event stream** (`services/event-stream.ts`): `participation:scored` event type already supports `action: 'reaction:sent'`

**DO NOT rebuild, duplicate, or modify any of the above. Consume as-is.**

### Rate Limiting Behavior (AC #2)

The rate limiter in `services/rate-limiter.ts` already implements the exact AC #2 requirements:
- Events 1-10 in 5s window: `rewardMultiplier = 1.0` (full points, full visual)
- Events 11-20: `rewardMultiplier = 0.5^(overage)` (exponential decay)
- Events 20+: `rewardMultiplier ≈ 0` (near-zero)
- 5s inactivity: counter resets (timestamps pruned)
- No hard block: function always returns `allowed: true`

**Visual dimming:** The `rewardMultiplier` is broadcast to all clients. The ReactionFeed widget uses it as the opacity for the floating emoji particle. A multiplier of 0.1 = barely visible emoji. This is the "visual feedback dims proportionally" requirement.

### Reaction Feed Memory Management (NFR28)

**15MB budget over 3 hours** — reactions are the highest-volume event in the system.

Safeguards:
- `_maxReactionFeedSize = 50` in PartyProvider — oldest reactions pruned as new ones arrive
- Reaction particles have 1.5s animation lifetime — completed particles must be removed from the widget tree
- Reaction feed is cleared on DJ state transitions out of `song`
- `ReactionFeedItem` is a lightweight object (~100 bytes each) — 50 items = ~5KB, negligible
- The real memory concern is AnimationController instances per particle. With 24 reactions/sec peak and 1.5s lifetime, max ~36 concurrent controllers. Each controller is ~1KB = ~36KB peak. This is well within budget

### 60fps Performance Strategy (NFR5)

**Peak load: 12 participants x 2 taps/sec = 24 reactions/sec**

- Use implicit/simple animations (not real-time physics) per UX spec
- Cap concurrent particles at ~36 (1.5s lifetime x 24/sec)
- `IgnorePointer` on the feed layer — no hit testing overhead
- Consider `RepaintBoundary` around the ReactionFeed to isolate repaints from the rest of the UI
- `const` constructors where possible to avoid unnecessary rebuilds
- If budget Android struggles, reduce particle lifetime to 1.0s (max ~24 concurrent)

### What DJ State Allows Reactions

Only `DJState.song`. The server handler silently drops reactions in any other state:
- `lobby` — party hasn't started
- `songSelection` — picking next song
- `partyCardDeal` — challenge card display (Epic 4 Story 4.4)
- `ceremony` — award reveal
- `interlude` — between songs
- `finale` — party over

The Flutter UI should only SHOW the ReactionBar during `DJState.song` — the server guard is defense-in-depth.

### What This Story Does NOT Build

- **No reaction streaks** — Story 4.2 (milestone display at 5, 10, 20, 50)
- **No soundboard** — Story 4.3
- **No party cards** — Stories 4.4-4.6
- **No lightstick mode** — Story 4.7
- **No hype signal** — Story 4.7
- **No reaction type analytics** — event stream logs `reaction:sent` but no per-emoji breakdown
- **No server-side emoji validation** — client enforces vibe emoji set, server accepts any string
- **No reaction persistence** — reactions live in-memory event stream only, batch-written at session end (existing pattern)

### Existing Code to NOT Modify

- `services/rate-limiter.ts` — Already complete, consume as-is
- `services/participation-scoring.ts` — Already maps `reaction:sent` to active tier
- `services/award-generator.ts` — Already counts reactions from event stream
- `services/event-stream.ts` — `participation:scored` type already supports reaction actions
- `shared/events.ts` — Reaction event constants already defined
- `constants/copy.dart` — `vibeReactionButtons` already defined (DO NOT add new emojis)
- `widgets/dj_tap_button.dart` — Consume as-is
- `constants/tap_tiers.dart` — Consume as-is
- `dj-engine/*` — No changes needed. Song state already exists
- `services/dj-broadcaster.ts` — No changes. Reactions use direct socket emit, not broadcaster
- `services/session-manager.ts` — No changes. Import `recordParticipationAction`, `getSessionDjState`, `recordActivity` from it but do NOT modify it

### Previous Story Intelligence (Story 3.5)

Story 3.5 established:
- `share_plus` integration pattern for native sharing
- `MomentCardOverlay` Stack pattern in party_screen — reaction UI will coexist in same Stack
- `showMomentCard` managed by PartyProvider — same pattern for reaction feed state
- `_clearCeremonyState()` cleanup — similar cleanup needed for reaction state on DJ state change
- `CurvedAnimation` in `initState()`, disposed in `dispose()` — apply to reaction particle animations
- 555 server tests, 351 Flutter tests — regression baseline
- `SocketClient` calls mutation methods on providers pattern strictly followed
- `dismissMomentCard()` precedent: UI display state can be managed directly by widgets (but reaction state flows through provider since it's broadcast from server)

Key code review fixes from 3.3/3.4/3.5 applied:
- `mounted` check after async gaps
- `CurvedAnimation` created in `initState()`, disposed in `dispose()`
- `SingleTickerProviderStateMixin` when only one controller needed
- `Positioned.fill` for full-screen overlays in Stack

### Git Intelligence

Recent commits follow pattern: `"Implement Story X.Y: Title with code review fixes"`
- All 3 epics complete (1: Party Foundation, 2: DJ Engine, 3: Ceremonies & Awards)
- Socket handler pattern: one file per namespace, registered in `connection-handler.ts`
- Test pattern: extend existing test files for modifications, create new files for new components
- Factory pattern: `createTestDJContextInState(state, overrides?)` for DJ state tests

### Project Structure Notes

New files:
- `apps/server/src/socket-handlers/reaction-handlers.ts`
- `apps/server/tests/socket-handlers/reaction-handlers.test.ts`
- `apps/flutter_app/lib/widgets/reaction_bar.dart`
- `apps/flutter_app/lib/widgets/reaction_feed.dart`
- `apps/flutter_app/test/widgets/reaction_bar_test.dart`
- `apps/flutter_app/test/widgets/reaction_feed_test.dart`

Modified files:
- `apps/server/src/socket-handlers/connection-handler.ts` — Register `registerReactionHandlers`
- `apps/flutter_app/lib/state/party_provider.dart` — Add `ReactionEvent`, reaction feed state, `onReactionBroadcast()`, clear on state change
- `apps/flutter_app/lib/socket/client.dart` — Add `emitReaction()`, `reaction:broadcast` listener
- `apps/flutter_app/lib/screens/party_screen.dart` — Add ReactionBar + ReactionFeed during song state

Existing test files to extend:
- `apps/flutter_app/test/state/party_provider_test.dart` — Reaction feed tests
- `apps/flutter_app/test/socket/client_test.dart` — Reaction event tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.1] — Emoji reactions AC: 100ms latency, 60fps, rate limiting, tap targets
- [Source: _bmad-output/planning-artifacts/prd.md#FR22] — All participants can send emoji reactions during performances
- [Source: _bmad-output/planning-artifacts/prd.md#FR23] — Reaction streaks at 5, 10, 20, 50 (Story 4.2, not this story)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR2] — Emoji reactions within 100ms on all phones
- [Source: _bmad-output/planning-artifacts/prd.md#NFR5] — 60fps with 12 participants at peak rate
- [Source: _bmad-output/planning-artifacts/prd.md#NFR14] — Tap targets no smaller than 48x48px
- [Source: _bmad-output/planning-artifacts/prd.md#NFR23] — Rate limiting: 10 events/5s, exponential decay, no hard block, 5s reset
- [Source: _bmad-output/planning-artifacts/prd.md#NFR28] — Client memory <15MB growth over 3-hour session
- [Source: _bmad-output/planning-artifacts/architecture.md#Socket.io Event Catalog] — reaction:sent, reaction:broadcast, reaction:streak events
- [Source: _bmad-output/planning-artifacts/architecture.md#Rate Limiting] — Pure function in services/rate-limiter.ts
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Song State Screen] — Lean-in mode layout, reaction buttons, reaction feed
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Principles] — One tap every time, drunk-user-friendly, 48px+ targets
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Animation] — Pre-rendered sprite sheet scatter, NOT real-time physics
- [Source: _bmad-output/project-context.md#Core Principle] — Server-authoritative architecture
- [Source: _bmad-output/project-context.md#Server Boundaries] — socket-handlers call services, NEVER persistence directly
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Rate Limiting] — Pure function, no Socket.io dependency, no hard blocks
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects/color values
- [Source: _bmad-output/project-context.md#Anti-Patterns] — ValueKey in list builders, no hardcoded strings/colors
- [Source: apps/server/src/services/rate-limiter.ts] — checkRateLimit(), recordUserEvent(), cleanupStaleTimestamps()
- [Source: apps/server/src/services/participation-scoring.ts] — ACTION_TIER_MAP: reaction:sent → active tier (3pts), calculateScoreIncrement()
- [Source: apps/server/src/services/session-manager.ts] — recordParticipationAction() (line 255), getSessionDjState(), recordActivity()
- [Source: apps/server/src/shared/events.ts] — REACTION_SENT, REACTION_BROADCAST, REACTION_STREAK
- [Source: apps/server/src/socket-handlers/party-handlers.ts] — Handler registration pattern, rate limiting integration
- [Source: apps/server/src/socket-handlers/connection-handler.ts] — Handler registration in connection setup
- [Source: apps/server/src/services/session-manager.ts] — countRecentReactions() for award generation
- [Source: apps/flutter_app/lib/constants/copy.dart] — vibeReactionButtons map
- [Source: apps/flutter_app/lib/widgets/dj_tap_button.dart] — DJTapButton widget
- [Source: apps/flutter_app/lib/constants/tap_tiers.dart] — TapTier.social: 56x56px, immediate, light haptic
- [Source: apps/flutter_app/lib/state/party_provider.dart] — Provider mutation pattern, DJ state handling
- [Source: apps/flutter_app/lib/socket/client.dart] — Event listener and emit patterns
- [Source: apps/flutter_app/lib/screens/party_screen.dart] — Stack overlay pattern, DJ state conditional rendering
- [Source: _bmad-output/implementation-artifacts/3-5-moment-card-generation-and-sharing.md] — Previous story: 555 server tests, 351 Flutter tests, Stack overlay pattern, provider state management

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No blocking issues encountered during implementation

### Completion Notes List

- Task 1: Created `reaction-handlers.ts` with `registerReactionHandlers(socket, io)` — handles `reaction:sent` events, validates DJ song state, applies rate limiting, broadcasts to all clients via `io.to()`, fires-and-forgets participation scoring. Registered in `connection-handler.ts` after `registerHostHandlers`.
- Task 2: Added `ReactionEvent` class, `_reactionFeed` list (capped at 50), `onReactionBroadcast()` mutation method, and reaction feed clear on DJ state exit from `song` in `PartyProvider`.
- Task 3: Added `emitReaction()` emit method and `reaction:broadcast` listener in `SocketClient`, following existing `_partyProvider?.` null-safe pattern.
- Task 4: Created `ReactionBar` widget using `DJTapButton` with `TapTier.social` (56x56px, exceeds 48px NFR14). Uses `vibeReactionButtons` from `copy.dart` for vibe-specific emoji sets.
- Task 5: Created `ReactionFeed` widget with floating emoji particles using `AnimatedBuilder` + `AnimationController` (1.5s lifetime). `IgnorePointer` wraps feed for tap pass-through. Opacity derived from `rewardMultiplier` for rate-limit dimming (AC #2).
- Task 6: Integrated `ReactionBar` and `ReactionFeed` into `PartyScreen` Stack, conditional on `DJState.song`.
- Task 7: Created 9 server tests for reaction handlers covering song state broadcast, non-song state drops, missing data guards, rate limiting, participation scoring, and activity recording. Verified existing rate limiter tests (12 tests) and participation scoring tests already cover `reaction:sent`. Full server regression: 564 tests pass (was 555).
- Task 8: Created 4 widget tests for ReactionBar, 4 for ReactionFeed, 4 for PartyProvider reaction feed, 2 for SocketClient reaction methods. Full Flutter regression: 364 tests pass (was 351).

### File List

**New files:**
- `apps/server/src/socket-handlers/reaction-handlers.ts`
- `apps/server/tests/socket-handlers/reaction-handlers.test.ts`
- `apps/flutter_app/lib/widgets/reaction_bar.dart`
- `apps/flutter_app/lib/widgets/reaction_feed.dart`
- `apps/flutter_app/test/widgets/reaction_bar_test.dart`
- `apps/flutter_app/test/widgets/reaction_feed_test.dart`

**Modified files:**
- `apps/server/src/socket-handlers/connection-handler.ts` — Added `registerReactionHandlers` import and registration
- `apps/flutter_app/lib/state/party_provider.dart` — Added `ReactionEvent` class (with stable id/startX), reaction feed state, `onReactionBroadcast()`, `removeReaction()`, clear on state transition
- `apps/flutter_app/lib/socket/client.dart` — Added `emitReaction()`, `reaction:broadcast` listener
- `apps/flutter_app/lib/screens/party_screen.dart` — Added ReactionBar + ReactionFeed (with RepaintBoundary and onParticleComplete) during song state
- `apps/flutter_app/test/state/party_provider_test.dart` — Added 6 reaction feed tests
- `apps/flutter_app/test/socket/client_test.dart` — Added 2 reaction method tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated story status

### Change Log

- **2026-03-13**: Implemented Story 4.1 — Emoji Reactions System. Added server reaction handler with DJ state guard, rate limiting, and participation scoring. Added Flutter reaction state in PartyProvider, SocketClient wiring, ReactionBar and ReactionFeed widgets, and party screen integration. 9 new server tests (564 total), 13 new Flutter tests (364 total). All tests pass.
- **2026-03-13**: Code review fixes applied — [H1] Fixed ReactionFeedItem recreation on every rebuild by moving stable id/startX generation into ReactionEvent in PartyProvider. [H2] Added onComplete callback to _ReactionParticle for particle cleanup via provider.removeReaction(). [H3] Added missing ReactionBar fallback test. [M1] Added server-side emoji type validation. [M2] sprint-status.yaml documented in File List. [M3] Story import path discrepancies noted. [L1] Added RepaintBoundary around ReactionFeed. New test counts: 566 server (was 564), 368 Flutter (was 364).

### Story Quality Review (2026-03-13)

**Reviewer:** SM Agent (Claude Opus 4.6) — adversarial pre-dev validation

**Issues Found:** 4 High, 4 Medium, 2 Low — all fixed

**Fixes Applied:**
- [H1] Fixed `recordParticipationAction` import: was `participation-scoring.js`, corrected to `session-manager.js`
- [H2] Fixed `getSessionDjContext` → `getSessionDjState` (matching `host-handlers.ts` line 67 pattern)
- [H3] Removed duplicate `appendEvent` call — `recordParticipationAction` handles event stream logging internally
- [H4] Resolved Task 1.2 ambiguity — function names and signatures now definitive, not left for dev to discover
- [M1] Fixed `partyProvider` → `_partyProvider?` in socket listener (private field with null-safe access)
- [M2] Corrected misleading note claiming `AnimatedBuilder` is not a real Flutter class; added `onComplete` callback for particle cleanup
- [M3] Made handler registration signature definitive: `(socket, io)` matching `registerHostHandlers` pattern
- [M4] Added `recordActivity(sessionId)` call to handler for session keepalive tracking
- [L1] Added note about 4 vs 5 emoji discrepancy (code has 4, UX spec says 5 — use code as source of truth)
- [L2] Moot after H3 fix (removed entire appendEvent block)

# Story 4.2: Reaction Streaks & Milestones

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to see my reaction streak milestones as I cheer continuously,
so that I feel rewarded for sustained engagement during performances.

## Acceptance Criteria

1. **Given** a participant is sending consecutive emoji reactions **When** they reach streak milestones **Then** streak milestones are displayed at 5, 10, 20, and 50 consecutive reactions (FR23) **And** milestones are displayed only to the reacting user (not broadcast to all) **And** the milestone notification auto-dismisses after 2 seconds
2. **Given** a participant achieves reaction streaks **When** the participation score is updated **Then** reaction activity contributes to the active participation tier (3pts) (FR40) — this is already handled by `recordParticipationAction` from Story 4.1, NO additional scoring logic needed
3. **Given** a participant stops sending reactions for 5+ seconds **When** they send a new reaction **Then** their streak counter resets to 0 and the new reaction counts as reaction #1 of a new streak
4. **Given** a participant has an active streak **When** the DJ state transitions out of `song` **Then** their streak counter resets to 0 and no milestone fires
5. **Given** rate limiting reduces `rewardMultiplier` below 1.0 **When** a rate-limited reaction is sent **Then** the reaction still counts toward the streak (streak counts actions, not points) **And** the rate-limit visual dimming on floating emojis is independent of streak

## Tasks / Subtasks

- [x] Task 1: Create streak tracker service (AC: #1, #3, #4)
  - [x] 1.1 Create `apps/server/src/services/streak-tracker.ts` — pure in-memory streak tracking with no Socket.io dependency:
    ```typescript
    interface StreakState {
      count: number;
      lastReactionAt: number;
    }

    // In-memory streak store: Map<`${sessionId}:${userId}`, StreakState>
    const streakStore = new Map<string, StreakState>();

    const STREAK_MILESTONES = [5, 10, 20, 50] as const;
    const INACTIVITY_RESET_MS = 5000;

    export function recordReactionStreak(
      sessionId: string,
      userId: string,
      now: number
    ): { streakCount: number; milestone: number | null } {
      const key = `${sessionId}:${userId}`;
      const current = streakStore.get(key);

      // Reset if inactivity gap > 5s
      if (current && now - current.lastReactionAt > INACTIVITY_RESET_MS) {
        streakStore.set(key, { count: 1, lastReactionAt: now });
        return { streakCount: 1, milestone: null };
      }

      const newCount = (current?.count ?? 0) + 1;
      streakStore.set(key, { count: newCount, lastReactionAt: now });

      const milestone = STREAK_MILESTONES.includes(newCount as typeof STREAK_MILESTONES[number])
        ? newCount
        : null;

      return { streakCount: newCount, milestone };
    }

    export function clearSessionStreaks(sessionId: string): void {
      for (const key of streakStore.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
          streakStore.delete(key);
        }
      }
    }

    export function clearUserStreak(sessionId: string, userId: string): void {
      streakStore.delete(`${sessionId}:${userId}`);
    }

    export function clearStreakStore(): void {
      streakStore.clear();
    }
    ```
    **Design decisions:**
    - Pure function, no Socket.io dependency (matches rate-limiter pattern, AC #3 implicit from project-context.md rate limiting rule)
    - Composite key `sessionId:userId` prevents cross-session streak contamination
    - `STREAK_MILESTONES` as const array for type-safe milestone check
    - `clearSessionStreaks` for DJ state transitions (called from dj-broadcaster when state exits song)
    - `clearStreakStore` for testing cleanup (matches `clearRateLimitStore` pattern)
    - Inactivity reset uses same 5s threshold as rate limiter (AC #3)
    - No need for timestamp pruning — streaks are simple counters, not sliding windows

  - [x] 1.2 **DO NOT** add streak clearing to the DJ state machine or dj-engine. The dj-engine has ZERO imports from services (project-context.md Server Boundaries). Instead, clear streaks from `session-manager.ts` `processDjTransition()` where both old and new state are available:
    - In `apps/server/src/services/session-manager.ts`, find `processDjTransition()` (line 464). After `setSessionDjState(sessionId, newContext)` (line 472) and the `appendEvent` call (line 474-479), add streak clearing when transitioning OUT of song state:
      ```typescript
      import { clearSessionStreaks } from './streak-tracker.js';

      // Inside processDjTransition(), after line 479 (appendEvent for dj:stateChanged):
      // Clear reaction streaks when leaving song state
      if (context.state === DJState.song && newContext.state !== DJState.song) {
        clearSessionStreaks(sessionId);
      }
      ```
    - **CRITICAL:** Do NOT put this in `dj-broadcaster.ts` — that file only receives the new context and has no knowledge of the previous state. `processDjTransition()` has both `context.state` (old) and `newContext.state` (new).
    - **CRITICAL:** `broadcastDjState(sessionId, context)` signature takes `(sessionId: string, context: DJContext)` — `io` is stored as a module-level variable via `initDjBroadcaster()`. Do NOT pass `io` to broadcaster functions.

- [x] Task 2: Integrate streak tracking into reaction handler (AC: #1, #5)
  - [x] 2.1 In `apps/server/src/socket-handlers/reaction-handlers.ts`, add streak tracking AFTER rate limiting, BEFORE broadcast:
    ```typescript
    import { recordReactionStreak } from '../services/streak-tracker.js';

    // After: const { rewardMultiplier } = checkRateLimit(timestamps, now);
    // Before: io.to(sessionId).emit(EVENTS.REACTION_BROADCAST, ...);

    // Streak tracking — counts ALL reactions regardless of rate limit (AC #5)
    const { streakCount, milestone } = recordReactionStreak(sessionId, userId, now);

    // Existing broadcast (unchanged)
    io.to(sessionId).emit(EVENTS.REACTION_BROADCAST, {
      userId,
      emoji: data.emoji,
      rewardMultiplier,
    });

    // Milestone notification — to reacting user ONLY (AC #1)
    if (milestone !== null) {
      socket.emit(EVENTS.REACTION_STREAK, {
        streakCount: milestone,
        emoji: data.emoji,
        displayName: socket.data.displayName,
      });
    }

    // Participation scoring + event stream logging (fire-and-forget)
    // NOTE: The existing recordParticipationAction call from Story 4.1 remains unchanged.
    // The streakCount is logged separately via appendEvent below.
    ```
    **ALSO** add streak count to the event stream. The architecture schema defines `reaction:sent` events as containing `{ emoji: string; streak: number }`. After the existing `recordParticipationAction` call, add:
    ```typescript
    import { appendEvent } from '../services/event-stream.js';

    // After recordParticipationAction fire-and-forget (existing line):
    // Log streak to event stream (architecture schema: reaction:sent includes streak)
    appendEvent(sessionId, {
      type: 'reaction:sent',
      ts: now,
      userId,
      data: { emoji: data.emoji, streak: streakCount },
    });
    ```
    **CRITICAL design decisions:**
    - `socket.emit()` (NOT `io.to(sessionId).emit()`) sends ONLY to the reacting user (AC #1: "displayed only to the reacting user")
    - Streak recorded AFTER rate limit check but streak counts ALL reactions regardless of `rewardMultiplier` (AC #5)
    - `milestone` is `null` for non-milestone reactions — only emit on actual milestones
    - Payload includes `emoji` so the milestone notification can show which emoji triggered it
    - Payload includes `displayName` from `socket.data.displayName` (type `SocketData` in `shared/socket-types.ts`) for personalized milestone messages matching UX spec
    - `streakCount` logged to event stream on EVERY reaction (not just milestones) per architecture schema `{ emoji: string; streak: number }`
    - The `reaction:sent` event stream entry is separate from the `participation:scored` entry that `recordParticipationAction` already writes

- [x] Task 3: Add streak milestone state to PartyProvider (AC: #1)
  - [x] 3.1 In `apps/flutter_app/lib/state/party_provider.dart`, add streak milestone state:
    ```dart
    // Streak milestone state — displayed only to current user
    int? _streakMilestone;
    String? _streakEmoji;
    String? _streakDisplayName;

    int? get streakMilestone => _streakMilestone;
    String? get streakEmoji => _streakEmoji;
    String? get streakDisplayName => _streakDisplayName;

    void onStreakMilestone({
      required int streakCount,
      required String emoji,
      required String displayName,
    }) {
      _streakMilestone = streakCount;
      _streakEmoji = emoji;
      _streakDisplayName = displayName;
      notifyListeners();
    }

    void dismissStreakMilestone() {
      _streakMilestone = null;
      _streakEmoji = null;
      _streakDisplayName = null;
      notifyListeners();
    }
    ```
  - [x] 3.2 Clear streak milestone in `onDjStateUpdate` when leaving song state. Add to the existing `if (state != DJState.song)` block:
    ```dart
    // Clear reaction feed when leaving song state
    if (state != DJState.song) {
      _reactionFeed.clear();
      _streakMilestone = null;
      _streakEmoji = null;
      _streakDisplayName = null;
    }
    ```

- [x] Task 4: Wire streak event in SocketClient (AC: #1)
  - [x] 4.1 In `apps/flutter_app/lib/socket/client.dart`, add listener in `_setupPartyListeners` after the existing `reaction:broadcast` listener:
    ```dart
    // Streak milestone event — sent to this user only
    on('reaction:streak', (data) {
      final payload = data as Map<String, dynamic>;
      _partyProvider?.onStreakMilestone(
        streakCount: payload['streakCount'] as int,
        emoji: payload['emoji'] as String,
        displayName: payload['displayName'] as String,
      );
    });
    ```
    **CRITICAL:** Uses `_partyProvider?.` (null-safe private field access) — same pattern as `reaction:broadcast` listener on line 299.

- [x] Task 5: Add streak milestone copy (AC: #1)
  - [x] 5.1 In `apps/flutter_app/lib/constants/copy.dart`, add streak milestone labels in the `Copy` class. The UX spec defines streak milestones as personalized hype messages (Critical Success Moment #3: "MINH IS ON FIRE"):
    ```dart
    // Streak milestones — personalized per UX spec (Critical Success Moment #3)
    static String streakMilestone(String displayName, int count) {
      switch (count) {
        case 5:
          return '$displayName is heating up!';
        case 10:
          return '$displayName IS ON FIRE!';
        case 20:
          return '$displayName is UNSTOPPABLE!';
        case 50:
          return '$displayName is LEGENDARY!';
        default:
          return '$count Streak!';
      }
    }
    ```
    **Design decisions:**
    - Personalized messages with `displayName` per UX spec: "MINH IS ON FIRE" flashes on screen
    - Graduated intensity: heating up (5) -> ON FIRE (10) -> UNSTOPPABLE (20) -> LEGENDARY (50) — matches UX spec's "graduated celebration intensity" principle (Duolingo reference, line 336-342)
    - Fallback `'$count Streak!'` for unexpected values (defensive)
    - All copy in `copy.dart` — no hardcoded strings in widgets (anti-pattern rule)

- [x] Task 6: Create StreakMilestoneOverlay widget (AC: #1)
  - [x] 6.1 Create `apps/flutter_app/lib/widgets/streak_milestone_overlay.dart`:
    ```dart
    import 'dart:async';
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    /// Full-screen overlay that shows streak milestone notification.
    /// Auto-dismisses after 2 seconds. Uses scale + fade animation.
    class StreakMilestoneOverlay extends StatefulWidget {
      const StreakMilestoneOverlay({
        super.key,
        required this.streakCount,
        required this.emoji,
        required this.displayName,
        required this.onDismiss,
      });

      final int streakCount;
      final String emoji;
      final String displayName;
      final VoidCallback onDismiss;

      @override
      State<StreakMilestoneOverlay> createState() => _StreakMilestoneOverlayState();
    }

    class _StreakMilestoneOverlayState extends State<StreakMilestoneOverlay>
        with SingleTickerProviderStateMixin {
      late final AnimationController _controller;
      Timer? _autoDismissTimer;

      @override
      void initState() {
        super.initState();
        _controller = AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 400),
        );
        _controller.forward();
        _autoDismissTimer = Timer(const Duration(seconds: 2), () {
          if (mounted) {
            _controller.reverse().then((_) {
              if (mounted) widget.onDismiss();
            });
          }
        });
      }

      @override
      void dispose() {
        _autoDismissTimer?.cancel();
        _controller.dispose();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        return IgnorePointer(
          key: const Key('streak-milestone-overlay'),
          child: Center(
            child: ScaleTransition(
              scale: CurvedAnimation(
                parent: _controller,
                curve: Curves.elasticOut,
              ),
              child: FadeTransition(
                opacity: _controller,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.emoji,
                      style: const TextStyle(fontSize: 64),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    Text(
                      Copy.streakMilestone(widget.displayName, widget.streakCount),
                      key: const Key('streak-milestone-text'),
                      style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                            color: DJTokens.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }
    }
    ```
    **Design decisions:**
    - `IgnorePointer` — milestone notification should NOT block reaction taps underneath (matches ReactionFeed pattern)
    - `SingleTickerProviderStateMixin` — only one AnimationController needed
    - `CurvedAnimation` created inside `ScaleTransition` (not stored separately) — acceptable since `ScaleTransition` owns the lifecycle. BUT if code review flags this, extract to a field in `initState()` and dispose in `dispose()`
    - `Curves.elasticOut` — bouncy entrance for fun milestone feel
    - 400ms enter animation, then 2s hold, then 400ms reverse fade-out, then dismiss callback
    - `mounted` check after Timer and after animation reverse (async gap safety — previous story learning)
    - Font size 64 for emoji, `headlineLarge` for text — should be visible but not dominating
    - Auto-dismiss via `onDismiss` callback which the provider calls `dismissStreakMilestone()`

- [x] Task 7: Integrate streak overlay into party screen (AC: #1)
  - [x] 7.1 In `apps/flutter_app/lib/screens/party_screen.dart`, add import:
    ```dart
    import 'package:karamania/widgets/streak_milestone_overlay.dart';
    ```
  - [x] 7.2 Add the streak milestone overlay in the Stack, AFTER the ReactionFeed overlay and BEFORE the ReactionBar. This ensures milestones appear on top of floating emojis but below tap targets:
    ```dart
    // After the ReactionFeed Positioned.fill block (line ~210):
    // Streak milestone overlay — only when milestone is active during song
    if (partyProvider.djState == DJState.song &&
        partyProvider.streakMilestone != null)
      Positioned.fill(
        child: StreakMilestoneOverlay(
          streakCount: partyProvider.streakMilestone!,
          emoji: partyProvider.streakEmoji ?? '',
          displayName: partyProvider.streakDisplayName ?? '',
          onDismiss: () => partyProvider.dismissStreakMilestone(),
        ),
      ),
    ```
    **CRITICAL:** The `IgnorePointer` on `StreakMilestoneOverlay` ensures taps pass through to the `ReactionBar` underneath. Do NOT add another `IgnorePointer` wrapper here.

    **Widget key consideration:** When `streakMilestone` changes (e.g., from 5 to 10 during rapid tapping), the widget needs to restart its animation. Using `ValueKey(partyProvider.streakMilestone)` on the `StreakMilestoneOverlay` will force a rebuild:
    ```dart
    child: StreakMilestoneOverlay(
      key: ValueKey(partyProvider.streakMilestone),
      streakCount: partyProvider.streakMilestone!,
      emoji: partyProvider.streakEmoji ?? '',
      displayName: partyProvider.streakDisplayName ?? '',
      onDismiss: () => partyProvider.dismissStreakMilestone(),
    ),
    ```

- [x] Task 8: Server tests (AC: #1, #3, #4, #5)
  - [x] 8.1 Create `apps/server/tests/services/streak-tracker.test.ts`:
    - Test `recordReactionStreak` increments streak count on consecutive calls
    - Test milestone returns at exactly 5, 10, 20, 50
    - Test non-milestone counts return `milestone: null`
    - Test 5s inactivity gap resets streak to 1
    - Test 4.9s gap does NOT reset (boundary test)
    - Test `clearSessionStreaks` removes all streaks for a session
    - Test `clearSessionStreaks` does NOT affect other sessions
    - Test `clearUserStreak` removes single user's streak
    - Test `clearStreakStore` removes all data
    - Test first reaction returns `{ streakCount: 1, milestone: null }`
    - **Use `vi.fn()` and `beforeEach(() => clearStreakStore())` for test isolation** (matches rate-limiter test pattern)

  - [x] 8.2 Update `apps/server/tests/socket-handlers/reaction-handlers.test.ts`:
    - Add test: streak milestone emits `reaction:streak` via `socket.emit()` (NOT `io.to()`)
    - Add test: streak milestone payload contains `{ streakCount, emoji, displayName }`
    - Add test: `displayName` comes from `socket.data.displayName`
    - Add test: non-milestone reaction does NOT emit `reaction:streak`
    - Add test: streak is recorded regardless of `rewardMultiplier` value (AC #5)
    - Add test: `reaction:sent` event is appended to event stream with `{ emoji, streak: streakCount }` on every reaction
    - Add test: event stream `reaction:sent` entry is separate from the `participation:scored` entry
    - **Use `vi.mock('../services/streak-tracker.js')` to control `recordReactionStreak` return values**
    - **Follow existing mock pattern:** Mock returns `{ streakCount: 5, milestone: 5 }` for milestone test, `{ streakCount: 3, milestone: null }` for non-milestone test

  - [x] 8.3 Test session-manager `processDjTransition` streak clearing integration:
    - Verify `clearSessionStreaks` is called when DJ state transitions FROM `song` to another state
    - Verify `clearSessionStreaks` is NOT called when transitioning TO `song`
    - Verify `clearSessionStreaks` is NOT called for transitions that don't involve `song` (e.g., `lobby` -> `songSelection`)
    - **Approach:** Extend existing `apps/server/tests/services/session-manager.test.ts` with streak-clearing tests in the `processDjTransition` test group. Mock `clearSessionStreaks` via `vi.mock('../services/streak-tracker.js')`

  - [x] 8.4 **Regression tests**: Run full server test suite — 593 tests pass (566 existing + 27 new), 0 failures

- [x] Task 9: Flutter tests (AC: #1)
  - [x] 9.1 Create `apps/flutter_app/test/widgets/streak_milestone_overlay_test.dart`:
    - Test renders personalized milestone text via `Copy.streakMilestone(displayName, count)` (e.g., "TestUser IS ON FIRE!" for count=10)
    - Test renders emoji text
    - Test has `Key('streak-milestone-overlay')`
    - Test has `Key('streak-milestone-text')`
    - Test `IgnorePointer` wrapper is present
    - Test `onDismiss` callback fires after 2s + animation (use `tester.pumpAndSettle()` then advance timers)
    - **DO NOT test:** exact animation curves, scale values, font sizes, opacity values

  - [x] 9.2 Update `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `onStreakMilestone` sets `streakMilestone`, `streakEmoji`, and `streakDisplayName` and notifies
    - Test `dismissStreakMilestone` clears all three fields and notifies
    - Test streak state clears when DJ state exits `song` (same block as reaction feed clear)
    - Test `streakMilestone`, `streakEmoji`, `streakDisplayName` are null initially

  - [x] 9.3 Update `apps/flutter_app/test/socket/client_test.dart`:
    - Test `reaction:streak` listener calls `partyProvider.onStreakMilestone` with correct args (`streakCount`, `emoji`, `displayName`)
    - Follow existing pattern from `reaction:broadcast` listener test

  - [x] 9.4 **Regression tests**: Run full Flutter test suite — 379 tests pass (368 existing + 11 new), 0 failures

## Dev Notes

### Architecture: Server-Side Streak Tracking

Streak tracking follows the server-authoritative pattern. The server tracks consecutive reaction counts per user and emits milestones to individual users:

1. User taps emoji -> server receives `reaction:sent` (existing Story 4.1 flow)
2. Server records streak via `recordReactionStreak()` -> increments counter
3. If milestone reached (5/10/20/50), server emits `reaction:streak` to SENDER ONLY via `socket.emit()`
4. Flutter receives milestone -> `PartyProvider.onStreakMilestone()` -> overlay appears
5. Overlay auto-dismisses after 2s -> `PartyProvider.dismissStreakMilestone()`

**Key difference from reactions:** `reaction:broadcast` goes to ALL clients via `io.to(sessionId).emit()`. `reaction:streak` goes to SENDER ONLY via `socket.emit()`.

**Event stream logging:** Every reaction writes a `reaction:sent` event to the event stream with `{ emoji, streak: streakCount }` per the architecture's `SessionEvent` schema. This is separate from the `participation:scored` event that `recordParticipationAction` writes. Both events are logged on every reaction — they serve different purposes (reaction analytics vs participation scoring).

[Source: _bmad-output/project-context.md#Core Principle — "Server-authoritative architecture"]

### Existing Infrastructure (DO NOT Recreate)

**Already built in Story 4.1 — consume as-is:**
- **Reaction handler** (`socket-handlers/reaction-handlers.ts`): Receives `reaction:sent`, validates DJ state, applies rate limiting, broadcasts. **MODIFY THIS** to add streak tracking
- **Rate limiter** (`services/rate-limiter.ts`): `checkRateLimit()` returns `{ rewardMultiplier }`. **DO NOT MODIFY**
- **Participation scoring** (`services/session-manager.ts`): `recordParticipationAction` already handles `reaction:sent` scoring at Active tier (3pts). **DO NOT MODIFY** — AC #2 is already satisfied
- **Event constants** (`shared/events.ts`): `REACTION_STREAK` already defined at line 32. **DO NOT MODIFY**
- **PartyProvider reaction state** (`state/party_provider.dart`): `ReactionEvent`, `reactionFeed`, `onReactionBroadcast()`, `removeReaction()`, feed clear on DJ state exit. **EXTEND** (don't replace)
- **SocketClient** (`socket/client.dart`): `emitReaction()`, `reaction:broadcast` listener. **EXTEND** (add `reaction:streak` listener)
- **ReactionBar** (`widgets/reaction_bar.dart`): Emoji button row. **DO NOT MODIFY**
- **ReactionFeed** (`widgets/reaction_feed.dart`): Floating emoji particles. **DO NOT MODIFY**
- **DJTapButton + TapTier** (`widgets/dj_tap_button.dart`, `constants/tap_tiers.dart`): **DO NOT MODIFY**
- **Session manager** (`services/session-manager.ts`): `processDjTransition()` has access to old and new DJ state. **MODIFY** to clear streaks when leaving song state. Do NOT modify `dj-broadcaster.ts` — it has no knowledge of the previous state

### Streak vs Rate Limiting (AC #5)

These are INDEPENDENT systems:
- **Rate limiter**: Tracks events in 5s sliding window, reduces `rewardMultiplier` after 10 events. Affects points and visual dimming
- **Streak tracker**: Tracks CONSECUTIVE reactions regardless of rate limit. A user sending 50 rapid reactions gets ALL milestones (5, 10, 20, 50) even though events 11+ have diminished rewards

Both reset on 5s inactivity. Both clear when DJ state exits `song`. But they do NOT interact.

### Streak Reset Behavior (AC #3, #4)

Streaks reset to 0 in three scenarios:
1. **5s inactivity gap** between reactions (AC #3) — handled in `recordReactionStreak()`
2. **DJ state exits song** (AC #4) — handled by `clearSessionStreaks()` called from `session-manager.ts` `processDjTransition()`
3. **Session ends** — handled by `clearSessionStreaks()` called from session cleanup

### Milestone Emission Pattern

`socket.emit()` vs `io.to(sessionId).emit()`:
- `socket.emit(event, data)` sends to the INDIVIDUAL socket connection (the reacting user only)
- `io.to(sessionId).emit(event, data)` sends to ALL sockets in the session room
- Milestones use `socket.emit()` because AC #1 says "displayed only to the reacting user"
- Milestone payload includes `displayName` from `socket.data.displayName` (type `SocketData` in `shared/socket-types.ts` line 7) for personalized UX copy

### Personalized Milestone Copy (UX Spec Compliance)

The UX spec defines streak milestones as a **Critical Success Moment (#3)**: "MINH IS ON FIRE" flashes on screen. This is referenced in three places:
- Critical Success Moments (line 186): "MINH IS ON FIRE"
- Micro-Emotions table (line 262): "the app sees your contribution and says so"
- Recognition UX (line 287): Hype streak notifications

Graduated intensity matches UX spec's "graduated celebration intensity" principle:
- 5 reactions: `"${name} is heating up!"`
- 10 reactions: `"${name} IS ON FIRE!"` (matches UX spec verbatim)
- 20 reactions: `"${name} is UNSTOPPABLE!"`
- 50 reactions: `"${name} is LEGENDARY!"`

### Memory Considerations

The streak store is lightweight:
- One `StreakState` per active user per session = ~50 bytes
- 12 users x 1 session = ~600 bytes
- `clearSessionStreaks()` on state transitions prevents unbounded growth
- No timestamp arrays (unlike rate limiter) — just a counter and last timestamp

### What This Story Does NOT Build

- **No streak visual effects beyond milestone overlay** — no persistent streak counter display, no streak-based color changes
- **No streak leaderboard** — no comparison between users' streaks
- **No streak persistence** — streaks are ephemeral in-memory, not written to DB or event stream
- **No streak sound effects** — Story 4.3 (Soundboard Effects) may add audio cues later
- **No streak-based scoring bonuses** — participation scoring is unchanged (still 3pts per `reaction:sent` * rewardMultiplier)

### Previous Story Intelligence (Story 4.1)

Key learnings to apply:
- **Import paths matter**: Use `session-manager.js` for scoring, `dj-state-store.js` for DJ state, `activity-tracker.js` for keepalive (NOT the service file names you'd guess)
- **Handler signature**: `registerReactionHandlers(socket, io)` — takes BOTH socket and io
- **`recordParticipationAction` handles event logging internally** — DO NOT call `appendEvent` separately
- **`_partyProvider?.` null-safe access** in SocketClient listeners — private field, not local variable
- **`mounted` check after async gaps** (Timer callbacks, animation completion)
- **`CurvedAnimation` in `initState()`, dispose in `dispose()`** — follow pattern from ceremony/moment card widgets
- **`ValueKey` in list/stack builders** — prevents ghost elements
- Test baseline: 566 server tests, 368 Flutter tests

### Code Review Patterns from 4.1

Common issues found and fixed in Story 4.1 code review:
- [H1] Wrong import paths for service functions
- [H2] Wrong function names (e.g., `getSessionDjContext` vs `getSessionDjState`)
- [H3] Duplicate event logging (calling `appendEvent` when `recordParticipationAction` already does it)
- [M1] Wrong provider field access pattern in SocketClient (`partyProvider` vs `_partyProvider?`)
- [M4] Missing `recordActivity()` call for session keepalive

**Apply these lessons:** Double-check every import path, function name, and provider access pattern against the actual source files.

### Project Structure Notes

New files:
- `apps/server/src/services/streak-tracker.ts`
- `apps/server/tests/services/streak-tracker.test.ts`
- `apps/flutter_app/lib/widgets/streak_milestone_overlay.dart`
- `apps/flutter_app/test/widgets/streak_milestone_overlay_test.dart`

Modified files:
- `apps/server/src/socket-handlers/reaction-handlers.ts` — Add streak tracking, milestone emission, event stream logging
- `apps/server/src/services/session-manager.ts` — Add `clearSessionStreaks` call in `processDjTransition()` when leaving song state
- `apps/server/tests/socket-handlers/reaction-handlers.test.ts` — Add streak/milestone/event stream tests
- `apps/server/tests/services/session-manager.test.ts` — Add streak clearing tests in processDjTransition group
- `apps/flutter_app/lib/state/party_provider.dart` — Add streak milestone state (count, emoji, displayName) + mutation + clear
- `apps/flutter_app/lib/socket/client.dart` — Add `reaction:streak` listener with displayName
- `apps/flutter_app/lib/screens/party_screen.dart` — Add StreakMilestoneOverlay
- `apps/flutter_app/lib/constants/copy.dart` — Add personalized streak milestone copy
- `apps/flutter_app/test/state/party_provider_test.dart` — Add streak tests
- `apps/flutter_app/test/socket/client_test.dart` — Add streak listener test

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4, Story 4.2] — Reaction streaks: milestones at 5, 10, 20, 50; displayed to reacting user only
- [Source: _bmad-output/planning-artifacts/prd.md#FR23] — Reaction streaks and milestone display
- [Source: _bmad-output/planning-artifacts/prd.md#FR40] — Reaction activity contributes to active tier (3pts)
- [Source: _bmad-output/planning-artifacts/prd.md#NFR23] — Rate limiting: 10 events/5s, exponential decay, no hard block, 5s reset
- [Source: _bmad-output/project-context.md#Core Principle] — Server-authoritative architecture
- [Source: _bmad-output/project-context.md#Server Boundaries] — dj-engine has ZERO imports from services
- [Source: _bmad-output/project-context.md#Flutter Boundaries] — ONLY SocketClient calls mutation methods on providers
- [Source: _bmad-output/project-context.md#Testing Rules] — DO NOT test animations/visual effects
- [Source: _bmad-output/project-context.md#Anti-Patterns] — No hardcoded strings, use copy.dart
- [Source: apps/server/src/socket-handlers/reaction-handlers.ts] — Current reaction handler (modify for streak)
- [Source: apps/server/src/services/rate-limiter.ts] — Pure function pattern to follow for streak-tracker
- [Source: apps/server/src/shared/events.ts#line32] — REACTION_STREAK already defined
- [Source: apps/flutter_app/lib/state/party_provider.dart] — ReactionEvent, reaction feed state, onDjStateUpdate clear pattern
- [Source: apps/flutter_app/lib/socket/client.dart#line297-304] — reaction:broadcast listener pattern to follow
- [Source: apps/flutter_app/lib/screens/party_screen.dart#line195-218] — ReactionFeed/ReactionBar positioning in Stack
- [Source: apps/flutter_app/lib/constants/copy.dart] — String constants pattern
- [Source: _bmad-output/implementation-artifacts/4-1-emoji-reactions-system.md] — Previous story: 566 server tests, 368 Flutter tests, all patterns and learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — all tasks completed without failures.

### Completion Notes List

- Task 1: Created `streak-tracker.ts` with pure in-memory streak tracking (recordReactionStreak, clearSessionStreaks, clearUserStreak, clearStreakStore). Integrated streak clearing in `session-manager.ts` processDjTransition() when leaving song state.
- Task 2: Integrated streak tracking in reaction-handlers.ts — records streak after rate limit, emits `reaction:streak` to sender only via socket.emit() on milestones, logs `reaction:sent` event to event stream with `{ emoji, streak }`. Added `reaction:sent` type to SessionEvent union.
- Task 3: Added streak milestone state (streakMilestone, streakEmoji, streakDisplayName) to PartyProvider with onStreakMilestone/dismissStreakMilestone mutations. Clears streak state when DJ state exits song.
- Task 4: Wired `reaction:streak` listener in SocketClient using `_partyProvider?.onStreakMilestone()` pattern.
- Task 5: Added personalized streak milestone copy in copy.dart: heating up (5), IS ON FIRE (10), UNSTOPPABLE (20), LEGENDARY (50).
- Task 6: Created StreakMilestoneOverlay widget with scale+fade animation, 2s auto-dismiss, IgnorePointer wrapper, CurvedAnimation properly stored and disposed.
- Task 7: Integrated StreakMilestoneOverlay in party_screen.dart Stack between ReactionFeed and ReactionBar, with ValueKey for animation restart.
- Task 8: 27 new server tests (17 streak-tracker, 7 reaction-handlers, 3 session-manager-dj). All 593 server tests pass.
- Task 9: 11 new Flutter tests (6 overlay widget, 4 party_provider, 1 client). All 379 Flutter tests pass.

### File List

**New files:**
- `apps/server/src/services/streak-tracker.ts`
- `apps/server/tests/services/streak-tracker.test.ts`
- `apps/flutter_app/lib/widgets/streak_milestone_overlay.dart`
- `apps/flutter_app/test/widgets/streak_milestone_overlay_test.dart`

**Modified files:**
- `apps/server/src/socket-handlers/reaction-handlers.ts` — Added streak tracking, milestone emission, event stream logging
- `apps/server/src/services/session-manager.ts` — Added clearSessionStreaks import and call in processDjTransition when leaving song state
- `apps/server/src/services/event-stream.ts` — Added `reaction:sent` type to SessionEvent union
- `apps/server/tests/socket-handlers/reaction-handlers.test.ts` — Added streak/milestone/event stream tests + streak-tracker mock
- `apps/server/tests/services/session-manager-dj.test.ts` — Added streak clearing tests in processDjTransition group
- `apps/flutter_app/lib/state/party_provider.dart` — Added streak milestone state fields, onStreakMilestone, dismissStreakMilestone, streak clear in onDjStateUpdate
- `apps/flutter_app/lib/socket/client.dart` — Added reaction:streak listener
- `apps/flutter_app/lib/constants/copy.dart` — Added streakMilestone() personalized copy function
- `apps/flutter_app/lib/screens/party_screen.dart` — Added StreakMilestoneOverlay import and widget in Stack
- `apps/flutter_app/test/state/party_provider_test.dart` — Added streak milestone tests
- `apps/flutter_app/test/socket/client_test.dart` — Added reaction:streak listener test

### Story Quality Review (2026-03-13)

**Reviewer:** SM Agent (Claude Opus 4.6) — adversarial pre-dev validation

**Issues Found:** 4 High, 2 Medium, 2 Low — all fixed

**Fixes Applied:**
- [H1] Fixed `clearSessionStreaks` placement: was `dj-broadcaster.ts` (no old state access), corrected to `session-manager.ts` `processDjTransition()` where both `context.state` and `newContext.state` are available
- [H2] Fixed wrong function signature claim for `broadcastDjState`: actual signature is `(sessionId, context)` with `io` as module-level state, not `(io, sessionId, djContext)`
- [H3] Added `reaction:sent` event stream logging with `{ emoji, streak: streakCount }` per architecture `SessionEvent` schema — needed for analytics and end-of-night award generation (FR41)
- [H4] Fixed milestone copy from generic `"$count Streak!"` to personalized messages per UX spec Critical Success Moment #3: `"${name} IS ON FIRE!"` with graduated intensity (heating up -> ON FIRE -> UNSTOPPABLE -> LEGENDARY)
- [M1] Added `displayName` to `reaction:streak` payload from `socket.data.displayName` for personalized milestone messages
- [M2] Added `streakCount` to event stream via separate `appendEvent` call (architecture schema requires `streak: number` in `reaction:sent` events)

### Code Review (2026-03-13)

**Reviewer:** Dev Agent (Claude Opus 4.6) — adversarial post-implementation review

**Issues Found:** 1 High, 3 Medium, 2 Low — all fixed

**Fixes Applied:**
- [H1] `clearSessionStreaks` was deleting from Map during iteration — refactored to collect keys first, then delete (streak-tracker.ts)
- [M1] `onDjStateUpdate` streak clearing was overly broad (`state != DJState.song`) — tightened to only clear when transitioning FROM song (`_djState == DJState.song && state != DJState.song`) per AC #4
- [M2] Client `reaction:streak` test didn't verify payload parsing — added milestone value iteration test
- [M3] Story Task 1.1 spec included incorrect `DJState` import — removed (actual code doesn't use it)
- [L1] Dev Notes referenced wrong file `dj-broadcaster.ts` for streak clearing — corrected to `session-manager.ts`
- [L2] Added test for `streakMilestone` copy default fallback (`'$count Streak!'` for non-standard values)

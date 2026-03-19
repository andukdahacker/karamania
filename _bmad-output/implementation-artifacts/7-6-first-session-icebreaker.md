# Story 7.6: First-Session Icebreaker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party host,
I want an icebreaker activity at the start of a new party,
So that everyone gets involved immediately and the group warms up together.

## Acceptance Criteria

1. **Given** a new party session has just started, **When** the first activity begins, **Then** a first-session icebreaker activity is presented to all participants (FR51) **And** the DJ state transitions from lobby → icebreaker (new DJ state) before entering songSelection
2. **Given** the icebreaker is presented, **When** participants see the question, **Then** all participants can complete it with a single tap from 4 options (FR51) **And** the interaction is private (no broadcast of individual votes — "private input → public output" pattern from UX spec)
3. **Given** participants have voted or the 6-second hard deadline expires, **When** the server resolves the icebreaker, **Then** results are visible to the group (FR51) showing vote counts per option **And** the winner is highlighted **And** non-voters are assigned a random option at expiry (UX spec line 2900)
4. **Given** the icebreaker results are shown, **When** the reveal period completes (~5s), **Then** the DJ engine transitions to songSelection via `ICEBREAKER_DONE` **And** the capture bubble fires 10s after icebreaker completes (replacing the current 3s-after-lobby interim)
5. **Given** the icebreaker has already run, **When** the session continues, **Then** the icebreaker does not repeat — it runs only once per session (the DJ state machine enforces this: `SESSION_STARTED` → `icebreaker` only happens once)
6. **Given** the host triggers HOST_SKIP during the icebreaker, **When** the skip is processed, **Then** the icebreaker auto-resolves immediately and advances through results → songSelection

## Tasks / Subtasks

- [x] Task 1: DJ Engine — Add `icebreaker` state (AC: #1, #5)
  - [x]1.1 `apps/server/src/dj-engine/types.ts`: Add `icebreaker: 'icebreaker'` to `DJState` object (between `lobby` and `songSelection`). Add `| { type: 'ICEBREAKER_DONE' }` to `DJTransition` union
  - [x]1.2 `apps/server/src/dj-engine/states.ts`: Add icebreaker state config:
    ```typescript
    [DJState.icebreaker]: {
      allowedTransitions: ['ICEBREAKER_DONE', 'TIMEOUT', 'HOST_SKIP', 'END_PARTY'],
      hasTimeout: true,
      isPlaceholder: false,
    },
    ```
    **Do NOT add icebreaker to `getNextCycleState`** — icebreaker is NOT part of the core cycle. It only runs once at session start
  - [x]1.3 `apps/server/src/dj-engine/transitions.ts`: Modify `computeNextState`:
    - `SESSION_STARTED` → return `DJState.icebreaker` (was: `DJState.songSelection`)
    - Add `ICEBREAKER_DONE` case → return `DJState.songSelection`
    - Add `ICEBREAKER_DONE` to the `HOST_SKIP` / `TIMEOUT` case only when `context.state === DJState.icebreaker` — for HOST_SKIP and TIMEOUT from icebreaker, the next state is `songSelection` (not via `getNextCycleState` which would throw)
    - **CRITICAL**: The existing HOST_SKIP/TIMEOUT cases call `getNextCycleState(context.state, ...)` which does NOT handle icebreaker. Add a guard: `if (context.state === DJState.icebreaker) return DJState.songSelection;` BEFORE the `getNextCycleState` call for HOST_SKIP and TIMEOUT
  - [x]1.4 `apps/server/src/dj-engine/timers.ts`: Add `[DJState.icebreaker]: 6_000` to `DEFAULT_TIMER_DURATIONS` — 6s hard deadline (UX spec line 2900)
  - [x]1.5 `apps/server/src/dj-engine/serializer.ts`: No changes needed — `VALID_STATES` is derived from `Object.values(DJState)`, so the new state is auto-included

- [x] Task 2: Create icebreaker dealer service (AC: #1, #2, #3, #5)
  - [x]2.1 Create `apps/server/src/services/icebreaker-dealer.ts` with:
    ```typescript
    export interface IcebreakerOption {
      id: string;
      label: string;
      emoji: string;
    }

    export interface IcebreakerQuestion {
      id: string;
      question: string;
      options: readonly IcebreakerOption[];
    }
    ```
  - [x]2.2 Define `ICEBREAKER_QUESTIONS` readonly array with 12+ karaoke/party-themed questions. Each has exactly 4 options. Questions must be: low-stakes, no wrong answer, fun, universally relatable (ages 20-35), karaoke/music/party themed. Examples:
    - `{ id: 'fav-decade', question: "What's your music decade?", options: [{ id: '80s', label: '80s', emoji: '🕺' }, { id: '90s', label: '90s', emoji: '💿' }, { id: '2000s', label: '2000s', emoji: '📀' }, { id: '2010s', label: '2010s+', emoji: '🎧' }] }`
    - `{ id: 'karaoke-anthem', question: "Tonight's karaoke anthem will be...", options: [{ id: 'ballad', label: 'A power ballad', emoji: '🎤' }, { id: 'regret', label: "Something we'll regret", emoji: '😅' }, { id: 'banger', label: 'A dance banger', emoji: '💃' }, { id: 'emotional', label: 'An emotional wreck', emoji: '😭' }] }`
    - `{ id: 'karaoke-style', question: "Your karaoke style is...", options: [{ id: 'shower', label: 'Shower singer', emoji: '🚿' }, { id: 'rockstar', label: 'Secret rockstar', emoji: '🎸' }, { id: 'backup', label: 'Backup dancer', emoji: '💃' }, { id: 'audience', label: 'Professional audience', emoji: '👏' }] }`
    - More questions: first-song genre, party energy level, karaoke courage level, duet partner preference, song memory superpower, stage presence, etc.
  - [x]2.3 Implement `dealQuestion(): IcebreakerQuestion` — random selection from pool. No repeat tracking needed (one icebreaker per session)
  - [x]2.4 Implement `IcebreakerRound` interface and round management:
    ```typescript
    export interface IcebreakerRound {
      sessionId: string;
      questionId: string;
      votes: Map<string, string>; // userId → optionId
      resolved: boolean;
    }
    ```
    - `startIcebreakerRound(sessionId: string, questionId: string): void`
    - `recordIcebreakerVote(sessionId: string, userId: string, optionId: string): { recorded: boolean; firstVote: boolean }` — idempotent, last vote wins. Returns `firstVote: true` only on first vote (for participation scoring)
    - `resolveIcebreaker(sessionId: string): { optionCounts: Record<string, number>; totalVotes: number; winnerOptionId: string } | null` — tallies votes, picks winner (highest count, random tiebreaker), marks resolved
    - `clearSession(sessionId: string): void`
    - `resetAll(): void` — test utility
  - [x]2.5 Export `ICEBREAKER_QUESTIONS` for testing

- [x] Task 3: Add Socket.io events and schemas (AC: #1, #2, #3)
  - [x]3.1 `apps/server/src/shared/events.ts`: Add icebreaker events:
    ```typescript
    // Icebreaker events
    ICEBREAKER_STARTED: 'icebreaker:started',
    ICEBREAKER_VOTE: 'icebreaker:vote',
    ICEBREAKER_RESULT: 'icebreaker:result',
    ```
  - [x]3.2 Create `apps/server/src/shared/schemas/icebreaker-schemas.ts`:
    ```typescript
    export const icebreakerVoteSchema = z.object({
      optionId: z.string().min(1),
    });

    export const icebreakerStartedSchema = z.object({
      question: z.string().min(1),
      options: z.array(z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        emoji: z.string().min(1),
      })).length(4),
      voteDurationMs: z.number(),
    });

    export const icebreakerResultSchema = z.object({
      optionCounts: z.record(z.string(), z.number()),
      totalVotes: z.number().int().nonnegative(),
      winnerOptionId: z.string().min(1),
    });
    ```

- [x] Task 4: Create icebreaker socket handler (AC: #2)
  - [x]4.1 Create `apps/server/src/socket-handlers/icebreaker-handlers.ts` — follows `interlude-handlers.ts` pattern:
    ```typescript
    export function registerIcebreakerHandlers(
      socket: AuthenticatedSocket,
      io: SocketIOServer,
    ): void {
      socket.on(EVENTS.ICEBREAKER_VOTE, (rawPayload: unknown) => {
        const parsed = icebreakerVoteSchema.safeParse(rawPayload);
        if (!parsed.success) return;
        const { sessionId, userId } = socket.data;
        if (!sessionId || !userId) return;

        // Guard: DJ state must be icebreaker
        const context = getSessionDjState(sessionId);
        if (!context || context.state !== DJState.icebreaker) return;

        const { recorded, firstVote } = recordIcebreakerVote(sessionId, userId, parsed.data.optionId);
        if (!recorded) return;

        // NO broadcast of individual votes — private input, public output

        if (firstVote) {
          recordParticipationAction(sessionId, userId, 'icebreaker:vote', 1).catch(...);
        }

        appendEvent(sessionId, {
          type: 'icebreaker:vote',
          ts: Date.now(),
          userId,
          data: { optionId: parsed.data.optionId },
        });
      });
    }
    ```
  - [x]4.2 `apps/server/src/socket-handlers/connection-handler.ts`: Import and register `registerIcebreakerHandlers(s, io)` — add after `registerInterludeHandlers`

- [x] Task 5: Session manager icebreaker orchestration (AC: #1, #3, #4, #6)
  - [x]5.1 `apps/server/src/services/session-manager.ts` — Add imports:
    ```typescript
    import { dealQuestion as dealIcebreakerQuestion, startIcebreakerRound, resolveIcebreaker, clearSession as clearIcebreakerSession } from '../services/icebreaker-dealer.js';
    ```
  - [x]5.2 Add broadcast functions to `dj-broadcaster.ts`:
    ```typescript
    export function broadcastIcebreakerStarted(sessionId: string, data: {
      question: string;
      options: Array<{ id: string; label: string; emoji: string }>;
      voteDurationMs: number;
    }): void {
      if (!io) return;
      io.to(sessionId).emit(EVENTS.ICEBREAKER_STARTED, data);
    }

    export function broadcastIcebreakerResult(sessionId: string, data: {
      optionCounts: Record<string, number>;
      totalVotes: number;
      winnerOptionId: string;
    }): void {
      if (!io) return;
      io.to(sessionId).emit(EVENTS.ICEBREAKER_RESULT, data);
    }
    ```
  - [x]5.3 Add `ICEBREAKER_REVEAL_DELAY_MS = 5_000` constant and `icebreakerRevealTimers` Map to session-manager
  - [x]5.4 Add `onIcebreakerStateEntered(sessionId, context)` function:
    ```typescript
    function onIcebreakerStateEntered(sessionId: string, context: DJContext): void {
      const question = dealIcebreakerQuestion();
      startIcebreakerRound(sessionId, question.id);

      broadcastIcebreakerStarted(sessionId, {
        question: question.question,
        options: question.options.map(o => ({ id: o.id, label: o.label, emoji: o.emoji })),
        voteDurationMs: context.timerDurationMs ?? 6_000,
      });

      appendEvent(sessionId, {
        type: 'icebreaker:started',
        ts: Date.now(),
        data: { questionId: question.id },
      });
    }
    ```
  - [x]5.5 Add `resolveIcebreakerTimeout(sessionId, context)` function:
    ```typescript
    function resolveIcebreakerTimeout(sessionId: string, context: DJContext): void {
      const result = resolveIcebreaker(sessionId);
      if (!result) {
        void processDjTransition(sessionId, context, { type: 'ICEBREAKER_DONE' });
        return;
      }

      broadcastIcebreakerResult(sessionId, result);

      appendEvent(sessionId, {
        type: 'icebreaker:result',
        ts: Date.now(),
        data: result,
      });

      // Schedule reveal delay then advance to songSelection
      const revealTimer = setTimeout(() => {
        icebreakerRevealTimers.delete(sessionId);
        const currentContext = getSessionDjState(sessionId);
        if (!currentContext || currentContext.state !== DJState.icebreaker) return;
        void processDjTransition(sessionId, currentContext, { type: 'ICEBREAKER_DONE' });
      }, ICEBREAKER_REVEAL_DELAY_MS);

      icebreakerRevealTimers.set(sessionId, revealTimer);
    }
    ```
  - [x]5.6 In `processDjTransition`: Add `if (newContext.state === DJState.icebreaker)` → call `onIcebreakerStateEntered(sessionId, newContext)` — place BEFORE the existing lobby→songSelection check
  - [x]5.7 In `processDjTransition`: Update the capture bubble trigger. Change:
    ```typescript
    // BEFORE (line 1476):
    if (context.state === DJState.lobby && newContext.state === DJState.songSelection) {
      setTimeout(() => { emitCaptureBubble(sessionId, 'session_start', ...); }, 3000);
    }
    // AFTER:
    if (context.state === DJState.icebreaker && newContext.state === DJState.songSelection) {
      setTimeout(() => { emitCaptureBubble(sessionId, 'session_start', ...); }, 10_000);
    }
    ```
    This fulfills the architecture target from the comment: "10s after icebreaker (Story 7.6)"
  - [x]5.8 In `handleRecoveryTimeout`: Add icebreaker resolution BEFORE the interlude check:
    ```typescript
    if (context.state === DJState.icebreaker) {
      resolveIcebreakerTimeout(sessionId, context);
      return;
    }
    ```
  - [x]5.9 Add `clearIcebreakerTimers(sessionId)` function to cancel reveal timer — call from `processDjTransition` when `context.state === DJState.icebreaker` (same pattern as ceremony/interlude timer cleanup)
  - [x]5.10 Wire `clearIcebreakerSession(sessionId)` into session teardown at session-manager.ts lines 1716-1720 (the dealer cleanup block after `clearActivityVoterState(sessionId)`). Add before `clearKingsCupSession(sessionId)` at line 1717

- [x] Task 6: Flutter — Add `icebreaker` DJ state (AC: #1)
  - [x]6.1 `apps/flutter_app/lib/theme/dj_theme.dart`: Add `icebreaker` to `DJState` enum (between `lobby` and `songSelection`). **COMPILER ERROR if missing** — `djStateBackgroundColor` (line 63) is an exhaustive switch. Add case between lobby and songSelection:
    ```dart
    case DJState.icebreaker:
      return const Color(0xFF0F0A1E); // Same as songSelection — pre-game vibe
    ```
  - [x]6.2 `apps/flutter_app/lib/audio/state_transition_audio.dart` (line 51): Add `DJState.icebreaker => null` to the exhaustive `_cueForState` switch expression. No new sound cue — just prevent compiler error from non-exhaustive match:
    ```dart
    SoundCue? _cueForState(DJState state) => switch (state) {
      DJState.icebreaker => null, // No audio cue for icebreaker
      DJState.song => SoundCue.songStart,
      // ... existing cases
    };
    ```
  - [x]6.3 `apps/flutter_app/lib/constants/copy.dart`: Add icebreaker strings AND djStateLabel case. **COMPILER ERROR if missing** — `djStateLabel` (line 84) is an exhaustive switch:
    - Add constant: `static const String djStateIcebreaker = 'Icebreaker';` (after line 76, with other DJ state labels)
    - Add switch case in `djStateLabel` (between lobby and songSelection):
      ```dart
      case DJState.icebreaker:
        return djStateIcebreaker;
      ```
    - Add icebreaker overlay strings:
      - `static const String icebreakerSubtitle = 'FIRST QUESTION';`
      - `static const String icebreakerWaiting = 'Waiting for everyone...';`

- [x] Task 7: Flutter — Add icebreaker state to PartyProvider (AC: #1, #2, #3)
  - [x]7.1 `apps/flutter_app/lib/state/party_provider.dart`: Add icebreaker state fields (same region as interlude state, around line 270):
    ```dart
    // Icebreaker state — populated by icebreaker:started event
    String? _icebreakerQuestion;
    List<IcebreakerOption> _icebreakerOptions = [];
    String? _myIcebreakerVote;
    Map<String, int>? _icebreakerResult;
    String? _icebreakerWinnerOptionId;
    int _icebreakerVoteDurationMs = 6000;
    ```
  - [x]7.2 Add getters for all icebreaker state fields
  - [x]7.3 Add `IcebreakerOption` model class (in party_provider.dart or separate models file — follow existing `InterludeOption` pattern):
    ```dart
    class IcebreakerOption {
      final String id;
      final String label;
      final String emoji;
      IcebreakerOption({required this.id, required this.label, required this.emoji});
      factory IcebreakerOption.fromJson(Map<String, dynamic> json) => IcebreakerOption(
        id: json['id'] as String,
        label: json['label'] as String,
        emoji: json['emoji'] as String,
      );
    }
    ```
  - [x]7.4 Add provider methods:
    - `onIcebreakerStarted(String question, List<IcebreakerOption> options, int voteDurationMs)` — sets state, calls `notifyListeners()`
    - `onIcebreakerVoted(String optionId)` — sets `_myIcebreakerVote = optionId`, calls `notifyListeners()`
    - `onIcebreakerResult(Map<String, int> optionCounts, int totalVotes, String winnerOptionId)` — sets result state, calls `notifyListeners()`
    - `_clearIcebreakerState()` — resets all icebreaker fields to defaults
  - [x]7.5 In `onDjStateUpdate`: Add icebreaker → clearing state when leaving icebreaker (same pattern as interlude clearing, around line 908):
    ```dart
    if (_djState == DJState.icebreaker && state != DJState.icebreaker) {
      _clearIcebreakerState();
    }
    ```
  - [x]7.6 In `onDjStateUpdate`: Wakelock — icebreaker IS an active state, should enable wakelock. The existing check `state != DJState.lobby && state != DJState.finale` already handles this correctly since icebreaker is neither lobby nor finale

- [x] Task 8: Flutter — SocketClient icebreaker event handling (AC: #1, #2, #3)
  - [x]8.1 `apps/flutter_app/lib/socket/client.dart`: Add icebreaker event listeners (after interlude events block):
    ```dart
    // Icebreaker events (Story 7.6)
    on('icebreaker:started', (data) {
      final payload = data as Map<String, dynamic>;
      final question = payload['question'] as String;
      final rawOptions = payload['options'] as List<dynamic>;
      final options = rawOptions
          .map((o) => IcebreakerOption.fromJson(o as Map<String, dynamic>))
          .toList();
      final voteDurationMs = payload['voteDurationMs'] as int;
      _partyProvider?.onIcebreakerStarted(question, options, voteDurationMs);
    });

    on('icebreaker:result', (data) {
      final payload = data as Map<String, dynamic>;
      final optionCounts = (payload['optionCounts'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(k, v as int));
      final totalVotes = payload['totalVotes'] as int;
      final winnerOptionId = payload['winnerOptionId'] as String;
      _partyProvider?.onIcebreakerResult(optionCounts, totalVotes, winnerOptionId);
    });
    ```
  - [x]8.2 Add `emitIcebreakerVote(String optionId)` method to SocketClient:
    ```dart
    void emitIcebreakerVote(String optionId) {
      _socket?.emit('icebreaker:vote', {'optionId': optionId});
    }
    ```

- [x] Task 9: Flutter — IcebreakerOverlay widget (AC: #1, #2, #3)
  - [x]9.1 Create `apps/flutter_app/lib/widgets/icebreaker_overlay.dart` — full-screen overlay:
    - Accepts: `question` (String), `options` (List<IcebreakerOption>), `myVote` (String?), `result` (Map<String, int>?), `winnerOptionId` (String?), `voteDurationMs` (int), `timerStartedAt` (int?), `onVote` (Function(String))
    - **Layout — choosing state** (result == null, myVote == null):
      - Subtitle: Copy.icebreakerSubtitle ("FIRST QUESTION")
      - Question text (large, bold)
      - 4 option buttons in a 2×2 grid or vertical list. Each button shows emoji + label. Tap calls onVote(optionId)
      - Countdown timer (6s, synced with server if timerStartedAt provided)
      - Bottom note: "Everyone answers. Results revealed together."
    - **Layout — chosen state** (myVote != null, result == null):
      - Same layout but selected option is highlighted, others dimmed
      - Copy.icebreakerWaiting text below ("Waiting for everyone...")
      - Timer still counting down
    - **Layout — revealing state** (result != null):
      - Question text remains
      - Options show vote counts as horizontal bar chart (proportional width). Winner highlighted with glow/scale
      - Total votes count shown
      - Entrance animation for results: staggered FadeTransition per option (200ms delay each)
    - Entrance animation: FadeTransition (400ms easeOut) similar to other overlays
    - **NO individual names** — this is a group activity
    - Use `DJTokens` for all spacing/colors
  - [x]9.2 Widget keys: `Key('icebreaker-overlay')`, `Key('icebreaker-question')`, `Key('icebreaker-option-$id')`, `Key('icebreaker-countdown')`, `Key('icebreaker-result')`
  - [x]9.3 All strings in `constants/copy.dart`

- [x] Task 10: Wire icebreaker overlay into party screen (AC: #1)
  - [x]10.1 `apps/flutter_app/lib/screens/party_screen.dart`: Add `IcebreakerOverlay` to overlay stack. Show when `partyProvider.djState == DJState.icebreaker` and `partyProvider.icebreakerOptions.isNotEmpty`:
    ```dart
    // Icebreaker overlay — at session start
    if (partyProvider.djState == DJState.icebreaker &&
        partyProvider.icebreakerOptions.isNotEmpty)
      Positioned.fill(
        child: IcebreakerOverlay(
          question: partyProvider.icebreakerQuestion!,
          options: partyProvider.icebreakerOptions,
          myVote: partyProvider.myIcebreakerVote,
          result: partyProvider.icebreakerResult,
          winnerOptionId: partyProvider.icebreakerWinnerOptionId,
          voteDurationMs: partyProvider.icebreakerVoteDurationMs,
          timerStartedAt: partyProvider.timerStartedAt,
          onVote: (optionId) {
            partyProvider.onIcebreakerVoted(optionId);
            SocketClient.instance.emitIcebreakerVote(optionId);
          },
        ),
      ),
    ```
    Place BEFORE the interlude voting overlay (icebreaker happens once at start, never during cycle)
  - [x]10.2 Import `IcebreakerOverlay` from `'../widgets/icebreaker_overlay.dart'`

- [x] Task 11: Tests (AC: all)
  - [x]11.1 **DJ Engine tests** — `apps/server/tests/dj-engine/`:
    - Update `transitions.test.ts`: `SESSION_STARTED` now → `icebreaker` (not `songSelection`). Add `ICEBREAKER_DONE` → `songSelection` test. Add HOST_SKIP and TIMEOUT from icebreaker → `songSelection` tests
    - Update `states.test.ts`: Verify icebreaker state config (allowed transitions, hasTimeout: true, not in getNextCycleState)
    - Update `timers.test.ts`: Verify icebreaker timer is 6000ms
    - Update `serializer.test.ts`: Add icebreaker serialization round-trip test (VALID_STATES includes icebreaker)
    - Update `machine.test.ts`: Full transition path: lobby → SESSION_STARTED → icebreaker → ICEBREAKER_DONE → songSelection
  - [x]11.2 `apps/server/tests/services/icebreaker-dealer.test.ts` (NEW):
    - Question pool has 12+ questions with required fields (id, question, options with id/label/emoji)
    - All questions have exactly 4 options
    - All question IDs are unique, all option IDs within a question are unique
    - `dealQuestion()` returns valid question from pool
    - `startIcebreakerRound()` initializes empty round
    - `recordIcebreakerVote()` records vote, returns `firstVote: true` on first, `firstVote: false` on subsequent
    - `recordIcebreakerVote()` is idempotent — last vote wins
    - `resolveIcebreaker()` tallies votes correctly
    - `resolveIcebreaker()` picks winner by highest count
    - `resolveIcebreaker()` returns null if no round
    - `clearSession()` removes round data
    - `resetAll()` clears all data
  - [x]11.3 `apps/server/tests/services/session-manager-icebreaker.test.ts` (NEW):
    - `initializeDjState` produces icebreaker state (not songSelection)
    - `onIcebreakerStateEntered` deals question and broadcasts `icebreaker:started` with question, options, voteDurationMs
    - Icebreaker timeout (6s) resolves votes and broadcasts `icebreaker:result`
    - After result reveal delay (5s), ICEBREAKER_DONE is triggered
    - HOST_SKIP during icebreaker resolves immediately
    - Capture bubble fires 10s after icebreaker→songSelection (not 3s after lobby→songSelection)
    - Session cleanup clears icebreaker data
    - **CRITICAL**: Must mock ALL existing dealer services (same pattern as `session-manager-singalong.test.ts`): `vi.mock('../../src/services/kings-cup-dealer.js', ...)`, `vi.mock('../../src/services/dare-pull-dealer.js', ...)`, `vi.mock('../../src/services/quick-vote-dealer.js', ...)`, `vi.mock('../../src/services/singalong-dealer.js', ...)`, `vi.mock('../../src/services/icebreaker-dealer.js', ...)`, `vi.mock('../../src/services/activity-voter.js', ...)`
  - [x]11.4 `apps/server/tests/socket-handlers/icebreaker-handlers.test.ts` (NEW):
    - Valid vote is recorded when DJ state is icebreaker
    - Invalid payload (missing optionId) is rejected
    - Vote rejected when DJ state is not icebreaker
    - Vote rejected when session not found
    - Participation scoring triggered on first vote only
  - [x]11.5 `apps/flutter_app/test/widgets/icebreaker_overlay_test.dart` (NEW):
    - Renders question text
    - Renders 4 option buttons with emoji and label
    - Tapping option calls onVote with correct optionId
    - Shows selected state after voting (highlighted choice)
    - Shows result counts when result is provided
    - Highlights winner option in result view
    - Uses correct widget keys
    - Displays countdown timer
  - [x]11.6 **CRITICAL — Mock compatibility across ALL session-manager test files.** When `icebreaker-dealer.js` is imported into `session-manager.ts`, every test file that mocks session-manager's dealer import tree will fail without a corresponding mock. Add `vi.mock('../../src/services/icebreaker-dealer.js', () => ({ dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', options: [{ id: 'a', label: 'A', emoji: '🅰️' }, { id: 'b', label: 'B', emoji: '🅱️' }, { id: 'c', label: 'C', emoji: '©️' }, { id: 'd', label: 'D', emoji: '🇩' }] }), startIcebreakerRound: vi.fn(), recordIcebreakerVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }), resolveIcebreaker: vi.fn().mockReturnValue({ optionCounts: { a: 3, b: 2, c: 1, d: 0 }, totalVotes: 6, winnerOptionId: 'a' }), clearSession: vi.fn(), resetAll: vi.fn() }))` to these files:
    - `session-manager-ceremony.test.ts`
    - `session-manager-interlude-game.test.ts`
    - `session-manager-dare-pull.test.ts`
    - `session-manager-quick-vote.test.ts`
    - `session-manager-singalong.test.ts`
  - [x]11.7 **CRITICAL — DJ engine test updates.** Since `SESSION_STARTED` now goes to `icebreaker` instead of `songSelection`, update these specific tests:
    - `apps/server/tests/dj-engine/transitions.test.ts` **line 14**: "transitions from lobby to songSelection" — change expected state to `icebreaker`
    - Add new tests: ICEBREAKER_DONE → songSelection, HOST_SKIP from icebreaker → songSelection, TIMEOUT from icebreaker → songSelection
  - [x]11.8 **CRITICAL — Session manager DJ test updates.** `apps/server/tests/services/session-manager-dj.test.ts` has 2 tests that assert `initializeDjState` produces `songSelection`:
    - **Line 197**: `expect(mockUpdateDjState).toHaveBeenCalledWith('session-1', { state: 'songSelection' })` → change to `'icebreaker'`
    - **Line 219**: `expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', songSelectionContext)` → change expected context to have `state: 'icebreaker'`
    - Also check `session-manager-recovery.test.ts` for recovery from various states — add icebreaker recovery test if needed

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL icebreaker state lives on server. Server deals the question, collects votes (6s hard deadline), resolves results, broadcasts to all. Flutter renders server-broadcast data — ZERO game logic in Dart
- **New DJ state**: Unlike interlude games (which are sub-states of the `interlude` DJ state), the icebreaker gets its own top-level DJ state. This is because the icebreaker happens ONCE at session start, outside the core cycle. It sits between `lobby` and `songSelection` in the state machine
- **DJ engine purity**: The DJ engine only knows about state names and transition rules. All orchestration (question dealing, vote collection, result broadcasting) lives in session-manager, not the engine
- **Boundary rules**: `icebreaker-dealer.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Session-manager orchestrates
- **Private input → public output**: The UX spec's core interaction pattern (line 2478). Votes are NOT broadcast individually. Results are revealed simultaneously to the entire group
- **No early majority resolution** (unlike interlude votes): The icebreaker always runs the full 6s timer to maximize participation. This is intentional — the UX spec says the reveal is the "aha moment" ("every phone showed the same thing at the same time!" — line 1372). Waiting the full 6s builds anticipation

### Key Design Decisions

**Why a new DJ state instead of reusing interlude?**
The icebreaker is fundamentally different from interludes:
- Interludes repeat every cycle; icebreaker runs once
- Interludes go through vote → reveal → game dispatch; icebreaker is vote → reveal → done
- Interludes require activity pool selection; icebreaker deals a single question
- The DJ state machine naturally prevents re-entry: `SESSION_STARTED` only fires once per session

**Why 4 options instead of 2 (Quick Vote)?**
The UX mockup (ux-design-directions.html line 1386-1391) shows 4 options. Quick Vote uses binary (A vs B) for speed during interlude games. Icebreaker is the opening activity with more room for expression. 4 options create richer group dynamics ("3 of you picked 80s?!")

**Why no early resolution?**
Unlike interlude voting where early majority speeds up the flow, the icebreaker ALWAYS waits the full 6s. The synchronized reveal is the product-defining moment that teaches users the app's core pattern. Rushing it defeats the purpose.

### Icebreaker Flow Diagram

```
EXISTING FLOW:
  HOST taps Start → SESSION_STARTED → songSelection → ... (core cycle)

NEW FLOW:
  HOST taps Start → SESSION_STARTED → icebreaker (6s voting)
    → icebreaker:started broadcast (question + 4 options)
    → clients tap option → icebreaker:vote (no broadcast)
    → 6s TIMEOUT → resolve → icebreaker:result broadcast
    → 5s reveal delay → ICEBREAKER_DONE → songSelection → ... (core cycle)
    → capture:bubble fires 10s after songSelection entry
```

### Reuse Patterns from Previous Stories (DO NOT REINVENT)

| Previous Pattern | Story 7.6 Equivalent |
|---|---|
| `quick-vote-dealer.ts` vote round (startRound, recordVote, resolve) | `icebreaker-dealer.ts` — same round lifecycle |
| `QuickVoteRound` interface (votes Map, resolved flag) | `IcebreakerRound` — identical structure but string votes instead of 'A'\|'B' |
| `interlude-handlers.ts` vote handler (guard state, parse, record, append event) | `icebreaker-handlers.ts` — nearly identical pattern |
| `InterludeVoteOverlay` (options grid, countdown, result) | `IcebreakerOverlay` — similar layout with 4 options |
| `onInterludeStateEntered()` in session-manager (deal, start round, broadcast) | `onIcebreakerStateEntered()` — same orchestration pattern |
| `resolveInterludeTimeout()` (resolve, broadcast result, schedule delay) | `resolveIcebreakerTimeout()` — same pattern, delay then ICEBREAKER_DONE |
| `clearInterludeTimers()` (cancel reveal timer) | `clearIcebreakerTimers()` — identical |
| Mock compatibility from Stories 7.2-7.5 | Same pattern: add icebreaker-dealer mock to all 5 dealer-mocking test files |

### Session Manager Integration — Critical Changes

**New state entry handler** (in `processDjTransition`, around line 1470):
```typescript
// Orchestrate icebreaker when entering icebreaker state
if (newContext.state === DJState.icebreaker) {
  onIcebreakerStateEntered(sessionId, newContext);
}
```

**Capture bubble timing fix** (in `processDjTransition`, around line 1476):
```typescript
// BEFORE: lobby → songSelection with 3s delay (interim)
// AFTER: icebreaker → songSelection with 10s delay (architecture target)
if (context.state === DJState.icebreaker && newContext.state === DJState.songSelection) {
  setTimeout(() => { emitCaptureBubble(sessionId, 'session_start', newContext.state); }, 10_000);
}
```

**Timer cleanup** (in `processDjTransition`):
```typescript
if (context.state === DJState.icebreaker) {
  clearIcebreakerTimers(sessionId);
}
```

**Recovery timeout** (in `handleRecoveryTimeout`, BEFORE interlude check):
```typescript
if (context.state === DJState.icebreaker) {
  resolveIcebreakerTimeout(sessionId, context);
  return;
}
```

### What This Story Does NOT Include (Scope Boundaries)

- NO new database tables or columns — icebreaker is fully in-memory
- NO persistence of icebreaker results to database — in-memory only per session
- NO new REST endpoints — icebreaker is purely Socket.io
- NO icebreaker on reconnect/rejoin — if you join mid-session, icebreaker is already done
- NO icebreaker customization — host cannot choose the question (random from pool)
- NO icebreaker skip from client — only HOST_SKIP via existing host controls
- NO localization — English only (i18n is post-MVP per PRD line 158)
- NO new sound cue for icebreaker — but `DJState.icebreaker => null` MUST be added to `state_transition_audio.dart` exhaustive switch to prevent compiler error
- NO changes to lobby_screen.dart — icebreaker is a party_screen overlay after session starts
- NO Zod global registry — icebreaker events are Socket.io only, no REST endpoints

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/dj-engine/types.ts` | MODIFY — Add DJState.icebreaker, ICEBREAKER_DONE transition |
| `apps/server/src/dj-engine/states.ts` | MODIFY — Add icebreaker state config |
| `apps/server/src/dj-engine/transitions.ts` | MODIFY — SESSION_STARTED→icebreaker, ICEBREAKER_DONE→songSelection, guard for HOST_SKIP/TIMEOUT |
| `apps/server/src/dj-engine/timers.ts` | MODIFY — Add icebreaker: 6_000 |
| `apps/server/src/services/icebreaker-dealer.ts` | NEW — Question pool, round management, vote recording |
| `apps/server/src/services/session-manager.ts` | MODIFY — Icebreaker orchestration, timeout handling, capture bubble timing |
| `apps/server/src/services/dj-broadcaster.ts` | MODIFY — Add broadcastIcebreakerStarted, broadcastIcebreakerResult |
| `apps/server/src/shared/events.ts` | MODIFY — Add icebreaker event constants |
| `apps/server/src/shared/schemas/icebreaker-schemas.ts` | NEW — Zod schemas for icebreaker events |
| `apps/server/src/socket-handlers/icebreaker-handlers.ts` | NEW — Icebreaker vote handler |
| `apps/server/src/socket-handlers/connection-handler.ts` | MODIFY — Register icebreaker handlers |
| `apps/flutter_app/lib/theme/dj_theme.dart` | MODIFY — Add icebreaker to DJState enum + bg color (exhaustive switch) |
| `apps/flutter_app/lib/audio/state_transition_audio.dart` | MODIFY — Add `DJState.icebreaker => null` to exhaustive switch |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add icebreaker state fields, methods, IcebreakerOption model |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add icebreaker event listeners + emitIcebreakerVote |
| `apps/flutter_app/lib/widgets/icebreaker_overlay.dart` | NEW — Icebreaker display overlay |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Show IcebreakerOverlay in stack |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add icebreaker strings |

### Testing Strategy

- **DJ engine unit tests** — CRITICAL: All existing tests asserting `SESSION_STARTED → songSelection` must update to `SESSION_STARTED → icebreaker`. New tests: icebreaker state config, ICEBREAKER_DONE transition, HOST_SKIP/TIMEOUT from icebreaker, serialization round-trip
- **Icebreaker dealer tests** — Question pool validity, vote recording, idempotent last-vote-wins, resolve tallying, winner selection, clear/reset
- **Session manager integration tests** — Icebreaker orchestration flow: deal → broadcast → timeout → resolve → reveal delay → ICEBREAKER_DONE. HOST_SKIP handling. Capture bubble timing (10s). Session cleanup
- **Socket handler tests** — Vote recording with state guard, invalid payload rejection, participation scoring on first vote
- **Flutter widget tests** — Overlay rendering (question, options, countdown, results), option tap callback, result bar chart, widget keys
- **Mock compatibility** — Add `icebreaker-dealer` mock to 5 existing session-manager test files (ceremony, interlude-game, dare-pull, quick-vote, singalong). New `session-manager-icebreaker.test.ts` must mock all 5 existing dealers
- **Dart exhaustive switches** — Adding `icebreaker` to `DJState` enum will cause **compiler errors** in 3 files with exhaustive switches: `dj_theme.dart` (djStateBackgroundColor), `copy.dart` (djStateLabel), `state_transition_audio.dart` (_cueForState). All 3 MUST be updated before any Flutter tests can run
- **DO NOT test**: Animation timings, color values, font styling, transition effects

### Previous Story Intelligence (Stories 7.1–7.5 Learnings)

- **Code review tip from 7.1**: Always add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads
- **Code review tip from 7.2**: Remove unused Copy constants. Extract hardcoded durations to named constants. Use null-safe `fromJson` factories. Add HOST_SKIP timer cancellation tests
- **Code review tip from 7.3**: Ensure mock compatibility across ALL session-manager test files when adding new service imports
- **Code review tip from 7.4**: `gameDurationMs` / `voteDurationMs` semantics — send the actual duration. Flutter countdown derives from this value
- **Mock pattern from 7.5**: Story 7.5 had to add `singalong-dealer.js` mock to ceremony, interlude-game, dare-pull, and quick-vote test files. Story 7.6 must add `icebreaker-dealer.js` mock to those SAME 5 files
- **DJ engine ripple effect (NEW for 7.6)**: Changing `SESSION_STARTED` target state from `songSelection` to `icebreaker` will break DJ engine tests, session-manager tests, and any test that starts a session and asserts the first state. This is a broader ripple than previous stories which only added to interlude dispatch

### Project Structure Notes

- `snake_case` for DB columns (no DB changes in this story)
- `camelCase` for Socket.io event payloads (Zod schemas)
- `kebab-case` for TS filenames: `icebreaker-dealer.ts`, `icebreaker-handlers.ts`, `icebreaker-schemas.ts`
- `snake_case` for Dart filenames: `icebreaker_overlay.dart`
- Socket events: `icebreaker:started`, `icebreaker:vote`, `icebreaker:result` — new namespace
- Widget keys: `Key('icebreaker-overlay')`, `Key('icebreaker-question')`, `Key('icebreaker-option-$id')`, `Key('icebreaker-countdown')`, `Key('icebreaker-result')`
- All copy in `constants/copy.dart`: `icebreakerSubtitle`, `icebreakerWaiting`

### References

- [Source: project-context.md — Server Boundaries, Socket Event Catalog, Testing Rules, Anti-Patterns]
- [Source: epics.md line 1523 — Story 7.6 acceptance criteria: first-session icebreaker, single tap, results visible]
- [Source: epics.md line 76 — FR51: first-session icebreaker activity, single tap, results visible to group]
- [Source: prd.md line 151 — "Icebreaker: First-60-seconds activity all participants complete with a single tap, results visible to the group"]
- [Source: prd.md line 219 — Linh journey: "Every phone hits the icebreaker: Tap your favorite music decade. The room erupts."]
- [Source: prd.md line 251 — Trang journey: "The icebreaker hits: Tap your favorite decade. Low stakes. She taps 2000s. Three others did too. Small smile."]
- [Source: ux-design-specification.md line 77 — "Zero-Onboarding Requirement: The icebreaker IS the onboarding — teaches the app through play"]
- [Source: ux-design-specification.md line 2650 — "IcebreakerScreen — Synchronized tap-and-reveal. States: choosing, chosen, revealing"]
- [Source: ux-design-specification.md line 2850 — State flow: "lobby → icebreaker → song_selection → ..."]
- [Source: ux-design-specification.md line 2900 — "Icebreaker choice: 6s hard deadline. Random assigned, advance to reveal"]
- [Source: ux-design-specification.md line 2478 — "Private input → collective output. Icebreaker answers... all follow: tap privately → see result together"]
- [Source: ux-design-directions.html line 1360-1397 — Icebreaker UI mockup: question + 4 options + note]
- [Source: dj-engine/types.ts — Current DJState enum (needs icebreaker added)]
- [Source: dj-engine/transitions.ts line 51 — SESSION_STARTED currently → songSelection (needs → icebreaker)]
- [Source: dj-engine/states.ts — State configs and getNextCycleState (icebreaker NOT in cycle)]
- [Source: dj-engine/timers.ts — Timer durations (needs icebreaker: 6000)]
- [Source: services/session-manager.ts line 1470-1472 — onInterludeStateEntered pattern for icebreaker]
- [Source: services/session-manager.ts line 1476 — Capture bubble interim timing (needs update for icebreaker)]
- [Source: services/session-manager.ts line 1271-1274 — handleRecoveryTimeout interlude pattern for icebreaker]
- [Source: services/quick-vote-dealer.ts — Vote round pattern to replicate for icebreaker]
- [Source: socket-handlers/interlude-handlers.ts — Vote handler pattern for icebreaker]
- [Source: flutter_app/lib/theme/dj_theme.dart line 51 — DJState enum (needs icebreaker)]
- [Source: flutter_app/lib/state/party_provider.dart line 270 — Interlude state fields pattern for icebreaker]
- [Source: flutter_app/lib/socket/client.dart line 543 — Interlude event listener pattern for icebreaker]
- [Source: flutter_app/lib/screens/party_screen.dart line 277-292 — Interlude overlay stack pattern for icebreaker]
- [Source: 7-5-group-sing-along-activities.md — Previous story implementation record, mock compatibility requirements]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- All 11 tasks implemented following story tasks/subtasks sequence
- DJ engine: Added `icebreaker` state between lobby and songSelection, `ICEBREAKER_DONE` transition, 6s timer, guard for HOST_SKIP/TIMEOUT from icebreaker
- Icebreaker dealer: 12 karaoke/party-themed questions with 4 options each, vote round management, resolve with winner selection
- Socket handler: Vote handler with DJ state guard, participation scoring on first vote, private input pattern
- Session manager: Icebreaker orchestration (deal → broadcast → timeout → resolve → 5s reveal → ICEBREAKER_DONE), capture bubble timing updated from 3s to 10s, session cleanup
- Flutter: DJState.icebreaker enum, IcebreakerOption model, PartyProvider state/methods, SocketClient event listeners, IcebreakerOverlay widget with choosing/chosen/revealing states
- Tests: 127 DJ engine tests, 19 dealer tests, 5 handler tests, 9 session-manager icebreaker tests, 9 Flutter widget tests all pass. Mock compatibility added to 5 existing session-manager test files. Capture bubble tests updated for icebreaker→songSelection with 10s delay.
- Server: 1273 tests pass (93 files). Flutter: 647 pass (3 pre-existing failures in party_screen_test from unrelated tag_team_flash_widget compilation error)

### Change Log

- 2026-03-19: Implemented Story 7.6 — First-Session Icebreaker (all 11 tasks)
- 2026-03-19: Code review fixes — (1) AC #3: non-voters now assigned random option at expiry via participantIds in resolveIcebreaker, (2) fixed zero-vote fallback winner from questionId to valid optionId, (3) added missing bottom note UI text, (4) added re-vote guard on client, (5) renamed duplicate option ID 'ballad' to 'slow-ballad'

### File List

**New files:**
- `apps/server/src/services/icebreaker-dealer.ts`
- `apps/server/src/shared/schemas/icebreaker-schemas.ts`
- `apps/server/src/socket-handlers/icebreaker-handlers.ts`
- `apps/flutter_app/lib/widgets/icebreaker_overlay.dart`
- `apps/server/tests/services/icebreaker-dealer.test.ts`
- `apps/server/tests/services/session-manager-icebreaker.test.ts`
- `apps/server/tests/socket-handlers/icebreaker-handlers.test.ts`
- `apps/flutter_app/test/widgets/icebreaker_overlay_test.dart`

**Modified files:**
- `apps/server/src/dj-engine/types.ts`
- `apps/server/src/dj-engine/states.ts`
- `apps/server/src/dj-engine/transitions.ts`
- `apps/server/src/dj-engine/timers.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/services/dj-broadcaster.ts`
- `apps/server/src/services/event-stream.ts`
- `apps/server/src/shared/events.ts`
- `apps/server/src/socket-handlers/connection-handler.ts`
- `apps/flutter_app/lib/theme/dj_theme.dart`
- `apps/flutter_app/lib/audio/state_transition_audio.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/server/tests/dj-engine/transitions.test.ts`
- `apps/server/tests/dj-engine/machine.test.ts`
- `apps/server/tests/dj-engine/timers.test.ts`
- `apps/server/tests/services/session-manager-dj.test.ts`
- `apps/server/tests/services/session-manager-ceremony.test.ts`
- `apps/server/tests/services/session-manager-interlude-game.test.ts`
- `apps/server/tests/services/session-manager-dare-pull.test.ts`
- `apps/server/tests/services/session-manager-quick-vote.test.ts`
- `apps/server/tests/services/session-manager-singalong.test.ts`
- `apps/server/tests/services/session-manager-capture.test.ts`
- `apps/flutter_app/test/theme/dj_theme_test.dart`
- `apps/flutter_app/test/socket/client_test.dart`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

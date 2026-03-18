# Story 7.4: Quick Vote Interlude

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want to vote on fun binary opinion polls between songs,
So that the group bonds over lighthearted debates and sees where everyone stands.

## Acceptance Criteria

1. **Given** the DJ engine selects an interlude activity, **When** Quick Vote is chosen (via `context.metadata.selectedActivity === 'quick_vote'`), **Then** a binary opinion poll question is presented to all participants simultaneously **And** two large option buttons are displayed (e.g., "YES" / "NO" or custom labels) **And** a 6-second hard voting window with countdown timer is enforced (server-authoritative deadline)
2. **Given** the 6-second voting window is active, **When** a participant taps one of the two options, **Then** their vote is recorded server-side (idempotent — last vote wins) **And** no real-time vote count is shown during voting (private input, public output pattern from UX spec)
3. **Given** the 6-second voting window expires, **When** votes are tallied, **Then** results are displayed as a horizontal bar chart showing the vote split and counts (e.g., "5 YES — 3 NO") **And** results are broadcast to all participants simultaneously **And** a 5-second reveal display is shown before auto-advancing
4. **Given** the interlude library selection, **When** Quick Vote is considered, **Then** it is selected via weighted random with no immediate repeats from the activity pool (FR28a) — this selection logic already exists in `activity-voter.ts`
5. **Given** the session timing, **When** the party is in its first 30 minutes, **Then** Quick Vote IS eligible for deployment — it is a universal activity (`universal: true` in ACTIVITY_POOL) front-loaded alongside Kings Cup (FR15)
6. **Given** multiple interludes occur in a session, **When** Quick Vote is selected again, **Then** the same question is never dealt twice in a row (no immediate question repeats within a session)
7. **Given** the 5-second results reveal completes, **When** the game ends, **Then** the system broadcasts a game-ended event **And** triggers `INTERLUDE_DONE` to advance the DJ cycle

## Tasks / Subtasks

- [x] Task 1: Create Quick Vote question dealer service (AC: #1, #6)
  - [x]1.1 Create `apps/server/src/services/quick-vote-dealer.ts` with `QuickVoteQuestion` interface: `{ id: string; question: string; optionA: string; optionB: string; emoji: string }`
  - [x]1.2 Define `QUICK_VOTE_QUESTIONS` array with 20+ binary opinion questions. Follow `KINGS_CUP_CARDS` / `DARE_PULL_DARES` pattern. Questions must be: genuinely divisive (not obvious answers), fun and lighthearted, culturally broad, binary (two clear sides), conversation-starters. Examples: "Is Bohemian Rhapsody overrated?" (YES/NO), "Pineapple on pizza?" (ALWAYS/NEVER), "Morning person or night owl?" (MORNING/NIGHT), "Dogs or cats?" (DOGS/CATS)
  - [x]1.3 Implement `dealQuestion(sessionId: string): QuickVoteQuestion` — random selection from pool, no immediate repeat per session. Track `lastDealtQuestion` per session via module-level `Map<string, string>` (same pattern as `lastDealtCard` in `kings-cup-dealer.ts` and `lastDealtDare` in `dare-pull-dealer.ts`)
  - [x]1.4 Implement `clearSession(sessionId: string): void` — cleanup `lastDealtQuestion` for session
  - [x]1.5 Implement `resetAll(): void` — test utility to clear module-level Map
  - [x]1.6 Export `QUICK_VOTE_QUESTIONS` for testing

- [x] Task 2: Create Quick Vote tally service (AC: #2, #3)
  - [x]2.1 In `apps/server/src/services/quick-vote-dealer.ts` (same file), add vote tallying:
    - `QuickVoteRound` interface: `{ sessionId: string; questionId: string; votes: Map<string, 'A' | 'B'>; resolved: boolean }`
    - Module-level `Map<string, QuickVoteRound>` for active rounds (keyed by sessionId)
  - [x]2.2 Implement `startQuickVoteRound(sessionId: string, questionId: string): void` — initialize round with empty votes map
  - [x]2.3 Implement `recordQuickVote(sessionId: string, userId: string, option: 'A' | 'B'): { recorded: boolean }` — idempotent (last vote wins), returns false if no active round or already resolved
  - [x]2.4 Implement `resolveQuickVote(sessionId: string): { optionACounts: number; optionBCounts: number; totalVotes: number } | null` — tally votes, mark round as resolved, return counts. Returns null if no active round
  - [x]2.5 Wire `clearSession` to also clear active Quick Vote round for session

- [x] Task 3: Extend interlude schemas and events for Quick Vote (AC: #1, #2, #3)
  - [x]3.1 Add optional Quick Vote fields to `interludeGameStartedSchema` in `apps/server/src/shared/schemas/interlude-schemas.ts`:
    - `quickVoteOptions: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).length(2).optional()` — exactly 2 options for binary poll
  - [x]3.2 Add new event constants to `apps/server/src/shared/events.ts`:
    - `QUICK_VOTE_CAST: 'interlude:quickVoteCast'` — client sends their vote
    - `QUICK_VOTE_RESULT: 'interlude:quickVoteResult'` — server broadcasts results
  - [x]3.3 Add new schemas to `interlude-schemas.ts`:
    - `quickVoteCastSchema`: `z.object({ option: z.enum(['A', 'B']) })` — client vote payload
    - `quickVoteResultSchema`: `z.object({ optionACounts: z.number(), optionBCounts: z.number(), totalVotes: z.number() })` — result broadcast payload

- [x] Task 4: Add `executeQuickVote` to session-manager (AC: #1, #2, #3, #7)
  - [x]4.1 Add constant `QUICK_VOTE_VOTING_DURATION_MS = 6_000` (6s hard voting window) and `QUICK_VOTE_REVEAL_DURATION_MS = 5_000` (5s results display)
  - [x]4.2 Add imports at top of `session-manager.ts`:
    - `import { dealQuestion, startQuickVoteRound, resolveQuickVote, clearSession as clearQuickVoteSession } from './quick-vote-dealer.js'`
  - [x]4.3 Modify `startInterludeGame` dispatcher to add quick_vote case:
    ```typescript
    function startInterludeGame(sessionId: string, selectedActivity: string, context: DJContext): void {
      if (selectedActivity === 'kings_cup') {
        executeKingsCup(sessionId);
      } else if (selectedActivity === 'dare_pull') {
        const connections = getActiveConnections(sessionId);
        const target = selectTarget(sessionId, connections);
        if (target) {
          executeDarePull(sessionId, target);
        } else {
          void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' });
        }
      } else if (selectedActivity === 'quick_vote') {
        executeQuickVote(sessionId);
      } else {
        void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' });
      }
    }
    ```
  - [x]4.4 Create `executeQuickVote(sessionId: string): void`:
    - Deal question: `const question = dealQuestion(sessionId)`
    - Start round: `startQuickVoteRound(sessionId, question.id)`
    - **CRITICAL**: `gameDurationMs` must be `QUICK_VOTE_VOTING_DURATION_MS` (6s) — NOT the total 11s. This value drives the Flutter countdown timer for the voting phase only. The results phase has its own separate countdown
    - Broadcast `interludeGameStarted` with: `{ activityId: 'quick_vote', card: { id: question.id, title: question.question, rule: question.optionA + ' vs ' + question.optionB, emoji: question.emoji }, gameDurationMs: QUICK_VOTE_VOTING_DURATION_MS, quickVoteOptions: [{ id: 'A', label: question.optionA }, { id: 'B', label: question.optionB }] }`
    - Append to event stream: `{ type: 'interlude:gameStarted', ts, data: { activityId: 'quick_vote', questionId: question.id } }`
    - Schedule 6s `setTimeout` for vote window end → call `resolveAndRevealQuickVote(sessionId)`
    - Store timer in `interludeGameTimers` Map
  - [x]4.5 Create `resolveAndRevealQuickVote(sessionId: string): void`:
    - Resolve vote: `const result = resolveQuickVote(sessionId)`
    - If no result (edge case), skip to end
    - Broadcast `QUICK_VOTE_RESULT` with `{ optionACounts, optionBCounts, totalVotes }`
    - Append to event stream: `{ type: 'interlude:quickVoteResult', ts, data: result }`
    - Clear vote timer from `interludeGameTimers`
    - Schedule 5s `setTimeout` for reveal end → call `endInterludeGame(sessionId)`
    - Store reveal timer in `interludeGameTimers` Map (reuse same key — only one timer active per session)
  - [x]4.6 Wire `clearQuickVoteSession(sessionId)` into session teardown (same location where `clearKingsCupSession` and `clearDarePullSession` are called)

- [x] Task 5: Add Quick Vote socket handler (AC: #2)
  - [x]5.1 In `apps/server/src/socket-handlers/interlude-handlers.ts`, add listener for `EVENTS.QUICK_VOTE_CAST`:
    - Validate with `quickVoteCastSchema.safeParse(rawPayload)`
    - Guard: DJ state must be `interlude`
    - Call `recordQuickVote(sessionId, userId, payload.option)`
    - If recorded, record participation: `recordParticipationAction(sessionId, userId, 'interlude:quickVote', 1)` (3 points per UX scoring)
    - Append event: `{ type: 'interlude:quickVoteCast', ts, userId, data: { option: payload.option } }`
    - **NO broadcast of individual votes** — private input, public output pattern. Results revealed only after server timeout
    - Guards protect against late votes: (1) DJ state must be `interlude`, (2) `recordQuickVote` returns `{ recorded: false }` if round is already resolved. Both guards handle HOST_SKIP during voting window (DJ state transitions away, and/or `resolveQuickVote` has already been called)

- [x] Task 6: Add broadcaster functions and update type signature (AC: #1, #3)
  - [x]6.1 **CRITICAL**: Update `broadcastInterludeGameStarted` type signature in `apps/server/src/services/dj-broadcaster.ts` to include `quickVoteOptions?`:
    ```typescript
    export function broadcastInterludeGameStarted(
      sessionId: string,
      data: {
        activityId: string;
        card: { id: string; title: string; rule: string; emoji: string };
        gameDurationMs: number;
        targetUserId?: string;
        targetDisplayName?: string;
        quickVoteOptions?: Array<{ id: string; label: string }>;  // NEW — quick_vote only
      },
    ): void {
      io.to(sessionId).emit(EVENTS.INTERLUDE_GAME_STARTED, data);
    }
    ```
  - [x]6.2 Add `broadcastQuickVoteResult` function:
    ```typescript
    export function broadcastQuickVoteResult(
      sessionId: string,
      data: { optionACounts: number; optionBCounts: number; totalVotes: number },
    ): void {
      io.to(sessionId).emit(EVENTS.QUICK_VOTE_RESULT, data);
    }
    ```
  - [x]6.3 Import `QUICK_VOTE_RESULT` from events (add to existing EVENTS import)

- [x] Task 7: Flutter Quick Vote game overlay (AC: #1, #3)
  - [x]7.1 Create `apps/flutter_app/lib/widgets/quick_vote_overlay.dart` — full-screen overlay with two phases:
    - **Phase 1 — Voting (6s):** Question text (large, bold), question emoji, two large stacked buttons (option A and option B) with tap handlers, 6s countdown timer (derived from `gameDurationMs` which is 6000). Buttons fill horizontal width, 56px+ tall (UX spec). On tap, button shows selected state (highlight border/background), disables tapping the other option (but allows changing vote — idempotent). Emit vote via `SocketClient.instance.emitQuickVoteCast(option)`
    - **Phase 2 — Results reveal (5s):** Triggered when `quickVoteResult` data appears in provider. Question text remains, buttons replaced by horizontal bar chart visualization showing vote split. Each bar shows label + count (e.g., "YES  5" and "NO  3"). Bars proportionally sized. Winning side (higher count) highlighted. **NEW 5s countdown** — reset `_remainingSeconds` to 5 when transitioning to results phase (do NOT carry over from voting countdown). Use `QUICK_VOTE_REVEAL_DURATION_S = 5` constant
    - **Two-phase countdown logic:** On mount, start Timer.periodic (1s ticks) counting down from `gameDurationMs ~/ 1000` (6s). When `quickVoteResult` arrives (detected via `didUpdateWidget` or provider watch), restart countdown at 5s for reveal phase. Timer disposal in `dispose()`
    - Entrance animation: FadeTransition similar to InterludeVoteOverlay (400ms easeOut)
  - [x]7.2 Use `DJTokens` for all spacing/colors. Use `Key('quick-vote-overlay')`, `Key('quick-vote-question')`, `Key('quick-vote-option-a')`, `Key('quick-vote-option-b')`, `Key('quick-vote-results')`
  - [x]7.3 All strings in `constants/copy.dart`: `quickVoteTitle` (e.g., "QUICK VOTE"), `quickVoteSubtitle` (e.g., "Cast your vote!")

- [x] Task 8: Flutter state and socket integration (AC: #1, #2, #3)
  - [x]8.1 Extend `PartyProvider` to handle Quick Vote-specific fields:
    - Add state fields: `_quickVoteOptions` (List of `{id: String, label: String}` — use a simple `QuickVoteOption` class), `_myQuickVote` (String? — 'A' or 'B'), `_quickVoteResult` (QuickVoteResult? — class with `optionACounts`, `optionBCounts`, `totalVotes`)
    - Add getters for all fields
    - Modify `onInterludeGameStarted` to parse optional `quickVoteOptions` field and store
    - Add `onQuickVoteResult(int optionACounts, int optionBCounts, int totalVotes)` — stores result, triggers `notifyListeners()`
    - Add `updateMyQuickVote(String option)` — stores user's selection locally
    - Add Quick Vote field clearing to `_clearInterludeState()` and `onInterludeGameEnded()`
  - [x]8.2 Modify `SocketClient` (in `socket/client.dart`):
    - Add listener for `'interlude:quickVoteCast'` — NOT needed (no broadcast of individual votes)
    - Add listener for `'interlude:quickVoteResult'`:
      - Parse `optionACounts`, `optionBCounts`, `totalVotes` from payload
      - Call `_partyProvider?.onQuickVoteResult(optionACounts, optionBCounts, totalVotes)`
    - Add `emitQuickVoteCast(String option)` method:
      - `_socket?.emit('interlude:quickVoteCast', {'option': option})`
      - `_partyProvider?.updateMyQuickVote(option)`
    - Parse optional `quickVoteOptions` from `interlude:gameStarted` payload:
      - `final rawOptions = payload['quickVoteOptions'] as List<dynamic>?`
      - Map to list of option objects and pass to `onInterludeGameStarted`
  - [x]8.3 In `party_screen.dart`, add `QuickVoteOverlay` to overlay stack:
    - Show when `partyProvider.interludeGameActivityId == 'quick_vote'` and `partyProvider.quickVoteOptions.isNotEmpty`
    - Position in overlay stack next to `KingsCupOverlay` and `DarePullOverlay` (mutually exclusive via `activityId` check)
    - Pass `card` (for question text/emoji), `quickVoteOptions`, `myQuickVote`, `quickVoteResult`, `gameDurationMs`, `timerStartedAt`, and `onVote` callback

- [x] Task 9: Tests (AC: all)
  - [x]9.1 `apps/server/tests/services/quick-vote-dealer.test.ts`:
    - Question pool has 20+ questions with required fields (id, question, optionA, optionB, emoji)
    - All questions have non-empty id, question, optionA, optionB, emoji
    - All question IDs are unique
    - `dealQuestion()` returns valid question from pool
    - No immediate question repeat: calling `dealQuestion()` twice returns different questions
    - `startQuickVoteRound()` initializes empty round
    - `recordQuickVote()` records vote successfully
    - `recordQuickVote()` is idempotent (last vote wins)
    - `recordQuickVote()` returns false for non-existent round
    - `recordQuickVote()` returns false for resolved round
    - `resolveQuickVote()` tallies votes correctly
    - `resolveQuickVote()` returns null for non-existent round
    - `resolveQuickVote()` marks round as resolved
    - `clearSession()` resets question tracking and active round
    - `resetAll()` clears all session data
  - [x]9.2 `apps/server/tests/services/session-manager-quick-vote.test.ts`:
    - `startInterludeGame` dispatches to `executeQuickVote` when selectedActivity is 'quick_vote'
    - `executeQuickVote` broadcasts `interlude:gameStarted` with question data AND `quickVoteOptions`
    - Vote timer fires after 6s and triggers `resolveAndRevealQuickVote`
    - `resolveAndRevealQuickVote` broadcasts `interlude:quickVoteResult` with vote counts
    - Reveal timer fires after 5s (total 11s) and broadcasts `interlude:gameEnded`
    - Reveal timer fires INTERLUDE_DONE after `interlude:gameEnded`
    - Session cleanup clears quick vote session tracking
    - Mock `quick-vote-dealer` to control question output and vote tallying
  - [x]9.3 `apps/flutter_app/test/widgets/quick_vote_overlay_test.dart`:
    - Renders question emoji and question text
    - Displays two option buttons with correct labels
    - Tapping option A triggers vote callback with 'A'
    - Tapping option B triggers vote callback with 'B'
    - Shows selected state after voting
    - Displays results bar chart when quickVoteResult is provided
    - Shows vote counts in results
    - Uses correct widget keys
  - [x]9.4 **CRITICAL — Mock compatibility across ALL session-manager test files.** When `quick-vote-dealer.js` is imported into `session-manager.ts`, EVERY test file that mocks session-manager's import tree will fail without a corresponding mock. Add `vi.mock('../../src/services/quick-vote-dealer.js', () => ({ dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', optionA: 'YES', optionB: 'NO', emoji: '⚡' }), startQuickVoteRound: vi.fn(), recordQuickVote: vi.fn().mockReturnValue({ recorded: true }), resolveQuickVote: vi.fn().mockReturnValue({ optionACounts: 3, optionBCounts: 2, totalVotes: 5 }), clearSession: vi.fn(), resetAll: vi.fn() }))` to ALL of these files:
    - `session-manager-ceremony.test.ts`
    - `session-manager-interlude-game.test.ts`
    - `session-manager-dare-pull.test.ts`
    - Also check and update if needed: `session-manager.test.ts`, `session-manager-capture.test.ts`, `session-manager-quickpick.test.ts`, `session-manager-spinwheel.test.ts`, `session-manager-recovery.test.ts`, `session-manager-scoring.test.ts`, `session-manager-tv.test.ts`, `session-manager-suggestion.test.ts`, `session-manager-detection.test.ts`, `session-manager-awards.test.ts`, `session-manager-dj.test.ts` — any that mock `kings-cup-dealer.js` or `dare-pull-dealer.js` also need `quick-vote-dealer.js`
  - [x]9.5 Also add `broadcastQuickVoteResult: vi.fn()` to the `dj-broadcaster.js` mock in ALL session-manager test files that mock the broadcaster

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL game state lives on server. Server selects the question, enforces the 6s hard deadline, tallies votes, and broadcasts results. Flutter renders server-broadcast data — ZERO game logic in Dart. Vote deadline is server-enforced, not client-side timer
- **Private input, public output**: Individual votes are NOT broadcast during the voting window. Each participant sees their own selection locally, but the group only sees combined results after server tallies. This matches the UX spec pattern used for Quick Pick song voting
- **Boundary rules**: `quick-vote-dealer.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Session-manager orchestrates
- **Socket handler pattern**: New `interlude:quickVoteCast` listener in `interlude-handlers.ts` — follows same validation + guard pattern as `interlude:vote`
- **DJ engine purity**: Engine only manages state transitions. Game orchestration (question dealing, vote collection, timing, result broadcast) lives in session-manager, not engine. No DJ engine changes in this story

### Key Design Decision: Two-Phase Timer

Quick Vote is unique among interlude games because it has TWO sequential phases:
1. **Voting phase** (6s): Active input from all participants
2. **Results phase** (5s): Passive display of results

This differs from Kings Cup (10s single display) and Dare Pull (15s single display). The implementation uses two sequential `setTimeout` calls:
- First timer (6s): voting window → triggers `resolveAndRevealQuickVote()`
- Second timer (5s): results display → triggers `endInterludeGame()`

Both stored in `interludeGameTimers` Map (same key, replaced sequentially). `clearInterludeTimers()` handles HOST_SKIP at any phase.

**CRITICAL: `gameDurationMs` semantics.** Unlike Kings Cup (10s) and Dare Pull (15s) which have a single display phase, Quick Vote sends `gameDurationMs: 6000` — ONLY the voting phase. This is what the Flutter countdown shows initially. When results arrive (via `interlude:quickVoteResult` event), the Flutter overlay resets its countdown to 5s for the reveal phase. The server manages the total 11s duration via two sequential `setTimeout`s. The Flutter client NEVER needs to know the total — it reacts to phase transitions.

**Total interlude duration with Quick Vote: 15s activity vote + 5s reveal + 6s game vote + 5s results = 31s max**

### Reuse Patterns from Stories 7.1, 7.2, and 7.3 (DO NOT REINVENT)

| Previous Pattern | Story 7.4 Equivalent |
|---|---|
| `kings-cup-dealer.ts` structure (module-level Map, deal, clear, reset) | `quick-vote-dealer.ts` question pool structure — identical pattern |
| `KINGS_CUP_CARDS` / `DARE_PULL_DARES` readonly array | `QUICK_VOTE_QUESTIONS` readonly array |
| `dealCard(sessionId)` / `dealDare(sessionId)` no-repeat logic | `dealQuestion(sessionId)` no-repeat logic — identical |
| `activity-voter.ts` vote recording (Map of userId → optionId, idempotent) | `recordQuickVote()` vote recording — similar but simpler (only 'A'/'B') |
| `executeKingsCup(sessionId)` / `executeDarePull(sessionId, target)` | `executeQuickVote(sessionId)` — but with two-phase timer |
| `KingsCupOverlay` / `DarePullOverlay` widget | `QuickVoteOverlay` widget — but with voting buttons + results bar chart |
| `clearKingsCupSession()` / `clearDarePullSession()` in teardown | `clearQuickVoteSession()` in teardown — same location |
| `InterludeVoteOverlay` countdown timer pattern | `QuickVoteOverlay` countdown timer — same pattern |
| `broadcastInterludeVoteResult()` in dj-broadcaster | `broadcastQuickVoteResult()` — same pattern |

### Quick Vote Question Content Guidelines

Questions should be:
- **Genuinely divisive** — no obvious answers (avoid "Is pizza good?" — everyone says yes)
- **Fun and lighthearted** — no politics, religion, or divisive social issues
- **Culturally broad** — relatable across cultures and age groups
- **Binary** — two clear sides, not a spectrum
- **Conversation-starters** — provoke friendly arguments after reveal
- **Short** — readable in 2-3 seconds on a phone screen

Example questions:
- "Is Bohemian Rhapsody overrated?" (YES / NO)
- "Pineapple on pizza?" (ALWAYS / NEVER)
- "Morning person or night owl?" (MORNING / NIGHT)
- "Dogs or cats?" (DOGS / CATS)
- "Toilet paper: over or under?" (OVER / UNDER)
- "Would you rather fight 1 horse-sized duck or 100 duck-sized horses?" (1 BIG / 100 SMALL)
- "Is cereal a soup?" (YES / NO)
- "Socks with sandals?" (FASHION / CRIME)
- "Can you put ketchup on a hot dog?" (OBVIOUSLY / NEVER)
- "Is a hot dog a sandwich?" (YES / NO)

### Session Manager Integration — Critical Flow

```
EXISTING FLOW (Story 7.2 Kings Cup):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → kings_cup: deal card → broadcast gameStarted → display (10s) → gameEnded → INTERLUDE_DONE

EXISTING FLOW (Story 7.3 Dare Pull):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → dare_pull: get connections → select target → deal dare → broadcast gameStarted (with target info) → display (15s) → gameEnded → INTERLUDE_DONE

NEW FLOW (Story 7.4 Quick Vote):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → quick_vote: deal question → start round → broadcast gameStarted (with options) → collect votes (6s) → resolve votes → broadcast quickVoteResult → display results (5s) → gameEnded → INTERLUDE_DONE
    → kings_cup: (unchanged)
    → dare_pull: (unchanged)
    → unknown: → INTERLUDE_DONE (backward compatible)
```

### Timer Architecture (extends Story 7.2/7.3 pattern)

1. **Activity vote window** (15s): DJ engine timer — already exists from Story 7.1
2. **Reveal delay** (5s): `setTimeout` in session-manager — already exists from Story 7.1
3. **Quick Vote voting window** (6s): NEW `setTimeout` — stored in `interludeGameTimers` Map
4. **Quick Vote results display** (5s): NEW `setTimeout` — replaces voting timer in same Map slot
5. HOST_SKIP during either Quick Vote phase: already handled by `clearInterludeTimers()` which clears `interludeGameTimers`

### Schema Extension Strategy

The `interludeGameStartedSchema` is extended with **optional** `quickVoteOptions` field to maintain backward compatibility with Kings Cup and Dare Pull:

```typescript
export const interludeGameStartedSchema = z.object({
  activityId: z.string().min(1),
  card: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    rule: z.string().min(1),
    emoji: z.string().min(1),
  }),
  gameDurationMs: z.number(),
  targetUserId: z.string().min(1).optional(),       // dare_pull only
  targetDisplayName: z.string().min(1).optional(),   // dare_pull only
  quickVoteOptions: z.array(z.object({               // NEW — quick_vote only
    id: z.string().min(1),
    label: z.string().min(1),
  })).length(2).optional(),
});
```

The question's `optionA`/`optionB` labels map to `quickVoteOptions[0].label` / `quickVoteOptions[1].label` with IDs 'A' and 'B'. The `card.title` carries the question text. The `card.rule` carries a descriptive string like "YES vs NO" (for display fallback). This keeps the existing `InterludeGameCard` class in Flutter reusable.

### What This Story Does NOT Include (Scope Boundaries)

- NO real-time vote count display during voting window — private input, public output pattern (individual sees their selection, group sees results only after deadline)
- NO "custom options" UI for the host to create questions — all questions come from server-side pool
- NO per-game scoring changes — UX spec lists 3 points for "Vote cast within window" but this is tracked via `recordParticipationAction` in the socket handler (same as interlude vote). Actual scoring differentiation is already handled by the participation scoring system from Story 3.1
- NO DJ engine changes — engine stays as-is, game orchestration is in session-manager
- NO changes to the activity vote flow or reveal timer — only the game dispatch adds a new case
- NO persistence of dealt questions or vote history to database — in-memory only (same as Kings Cup and Dare Pull)
- NO winner/loser semantics — Quick Vote shows the split, not a winner. Both sides are valid opinions

### Participation Scoring Note

UX spec assigns 3 points for "Vote cast within window" for Quick Vote. The socket handler calls `recordParticipationAction(sessionId, userId, 'interlude:quickVote', 1)`. Verify that `'interlude:quickVote'` exists in `ACTION_TIER_MAP` in `services/participation-scoring.ts`. If not, add it with tier mapping that yields ~3 points (likely `{ tier: 'active', weight: 1 }` — check existing `'interlude:vote'` mapping for reference). If the existing `'interlude:vote'` action type is appropriate to reuse (since Quick Vote IS a vote), use that instead of creating a new action type

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/quick-vote-dealer.ts` | NEW — Question pool + random deal, no-repeat tracking, vote round management |
| `apps/server/src/shared/schemas/interlude-schemas.ts` | MODIFY — Add optional `quickVoteOptions` to gameStarted schema, add `quickVoteCastSchema` and `quickVoteResultSchema` |
| `apps/server/src/shared/events.ts` | MODIFY — Add `QUICK_VOTE_CAST` and `QUICK_VOTE_RESULT` event constants |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add quick_vote dispatch, `executeQuickVote`, `resolveAndRevealQuickVote`, wire cleanup |
| `apps/server/src/services/dj-broadcaster.ts` | MODIFY — Add `broadcastQuickVoteResult` function |
| `apps/server/src/socket-handlers/interlude-handlers.ts` | MODIFY — Add `QUICK_VOTE_CAST` listener for poll votes |
| `apps/flutter_app/lib/widgets/quick_vote_overlay.dart` | NEW — Quick Vote two-phase overlay (voting + results bar chart) |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add Quick Vote state fields, result handler, parse quickVoteOptions |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add `quickVoteResult` listener, `emitQuickVoteCast` method, parse quickVoteOptions from gameStarted |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Show QuickVoteOverlay in stack |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add Quick Vote strings |

### Testing Strategy

- **Unit tests** for `quick-vote-dealer.ts`: Question pool validity, deal randomness, no-repeat logic, vote round lifecycle (start, record, resolve), idempotent voting, edge cases (no round, resolved round), session cleanup, resetAll
- **Integration tests** for session-manager Quick Vote dispatch: Quick Vote path, two-phase timer (6s vote + 5s reveal), result broadcast timing, fallback on resolve error, session cleanup
- **Flutter widget tests**: Overlay rendering (question, options), vote button interaction, results bar chart display, widget keys
- **Mock compatibility**: Add `quick-vote-dealer` mock to ALL existing session-manager test files (ceremony, interlude-game, dare-pull)
- **DO NOT test**: Bar chart pixel-perfect rendering, animation timings, color values, transition effects

### Previous Story Intelligence (Stories 7.1 + 7.2 + 7.3 Learnings)

- **Code review tip from 7.1**: Always add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads. Add cleanup to both `onSessionEnded()` and `onKicked()` in party_provider
- **Code review tip from 7.2**: Remove unused Copy constants. Extract hardcoded durations to named constants. Use null-safe `fromJson` factories. Don't pass unused parameters to functions. Add HOST_SKIP game timer cancellation tests. Add provider mutual-exclusivity tests
- **Code review tip from 7.3**: Ensure mock compatibility across ALL session-manager test files when adding new service imports. Story 7.3 had to add dare-pull-dealer mocks to ceremony AND interlude-game test files. Story 7.4 must add quick-vote-dealer mocks to ceremony, interlude-game, AND dare-pull test files
- **Mutual exclusivity pattern from 7.2**: `onInterludeGameStarted()` already clears vote overlay state. No additional work needed for Quick Vote — same mechanism ensures only one interlude UI is visible
- **Two-phase pattern consideration**: Quick Vote is the first interlude game with two internal phases (voting + results). Ensure `clearInterludeTimers()` handles interruption during either phase. The `interludeGameTimers` Map stores one timer per session — replacing it between phases is clean

### Project Structure Notes

- `snake_case` for DB columns (no DB changes in this story)
- `camelCase` for Socket.io event payloads (Zod schemas)
- `kebab-case` for TS filenames: `quick-vote-dealer.ts`
- `snake_case` for Dart filenames: `quick_vote_overlay.dart`
- Socket events: reuse existing `interlude:gameStarted`, `interlude:gameEnded` + add `interlude:quickVoteCast`, `interlude:quickVoteResult`
- Widget keys: `Key('quick-vote-overlay')`, `Key('quick-vote-question')`, `Key('quick-vote-option-a')`, `Key('quick-vote-option-b')`, `Key('quick-vote-results')`
- All copy in `constants/copy.dart`: `quickVoteTitle`, `quickVoteSubtitle`

### References

- [Source: project-context.md — Server Boundaries, Socket Event Catalog, Testing Rules, Anti-Patterns]
- [Source: architecture.md — FR28a weighted random 3-game library, FR28b Quick Vote binary opinion poll, FR15 front-loading universal activities in first 30 min]
- [Source: prd.md — FR28a/FR28b interlude mini-games, Quick Vote binary opinion poll]
- [Source: epics.md — Epic 7 context, Story 7.4 acceptance criteria: binary opinion poll, 6-second vote window, bar chart results]
- [Source: ux-design-specification.md — Quick Vote UX flow: question + two buttons, 6s hard voting window, bar chart results, 5s reveal, auto-advance, private input/public output pattern]
- [Source: ux-design-specification.md — Participation scoring: Quick Vote 3pts for vote cast within window]
- [Source: ux-design-specification.md — Interlude selection rules: Quick Vote is universal, eligible in first 30 min]
- [Source: 7-3-dare-pull-interlude.md — Complete implementation record for previous interlude game, reuse patterns, code review learnings]
- [Source: 7-2-kings-cup-interlude.md — Kings Cup implementation patterns reused]
- [Source: services/kings-cup-dealer.ts — Card dealer pattern to replicate for questions]
- [Source: services/dare-pull-dealer.ts — Dare dealer pattern (identical module structure)]
- [Source: services/activity-voter.ts — quick_vote already in ACTIVITY_POOL with universal:true, minParticipants:2]
- [Source: services/session-manager.ts — startInterludeGame dispatcher where quick_vote case will be added]
- [Source: shared/schemas/interlude-schemas.ts — interludeGameStartedSchema to extend with optional quickVoteOptions]
- [Source: widgets/interlude_vote_overlay.dart — Countdown timer and voting UI patterns for reference]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented Quick Vote question dealer service with 24 binary opinion questions, no-repeat dealing, and vote tally (start/record/resolve lifecycle)
- Extended interlude schemas with optional `quickVoteOptions` field and new `quickVoteCastSchema`/`quickVoteResultSchema`
- Added `QUICK_VOTE_CAST` and `QUICK_VOTE_RESULT` event constants
- Added `executeQuickVote` and `resolveAndRevealQuickVote` to session-manager with two-phase timer (6s vote + 5s reveal)
- Added `broadcastQuickVoteResult` to dj-broadcaster
- Added Quick Vote cast socket handler with DJ state guard and idempotent vote recording
- Created `QuickVoteOverlay` Flutter widget with two-phase UI (voting buttons → bar chart results) and countdown timer
- Extended `PartyProvider` with Quick Vote state (`quickVoteOptions`, `myQuickVote`, `quickVoteResult`)
- Extended `SocketClient` with `emitQuickVoteCast` and `interlude:quickVoteResult` listener
- Added Quick Vote overlay to party_screen.dart overlay stack
- Reused `'interlude:vote'` action type for participation scoring (3pts per UX spec)
- Added `quick-vote-dealer.js` mock to ceremony, interlude-game, and dare-pull session-manager test files
- Added `broadcastQuickVoteResult` to broadcaster mocks in updated test files
- Extended `SessionEvent` type with `interlude:quickVoteCast` and `interlude:quickVoteResult` variants
- Used `DJTokens.actionConfirm` instead of non-existent `actionPrimary` for highlight colors

### Change Log

- 2026-03-18: Implemented Story 7.4 Quick Vote Interlude — all 9 tasks complete
- 2026-03-18: Code review fixes — tie-game highlight bug, participation scoring on re-votes, HOST_SKIP tests, schema validation, mock updates

### File List

- `apps/server/src/services/quick-vote-dealer.ts` — NEW: Question pool, dealer, vote tally service
- `apps/server/src/shared/schemas/interlude-schemas.ts` — MODIFIED: Added quickVoteOptions, quickVoteCastSchema, quickVoteResultSchema
- `apps/server/src/shared/events.ts` — MODIFIED: Added QUICK_VOTE_CAST, QUICK_VOTE_RESULT
- `apps/server/src/services/session-manager.ts` — MODIFIED: Added quick_vote dispatch, executeQuickVote, resolveAndRevealQuickVote, clearQuickVoteSession
- `apps/server/src/services/dj-broadcaster.ts` — MODIFIED: Added broadcastQuickVoteResult, extended broadcastInterludeGameStarted type
- `apps/server/src/services/event-stream.ts` — MODIFIED: Added interlude:quickVoteCast and interlude:quickVoteResult SessionEvent variants
- `apps/server/src/socket-handlers/interlude-handlers.ts` — MODIFIED: Added QUICK_VOTE_CAST listener, firstVote guard on participation scoring
- `apps/flutter_app/lib/widgets/quick_vote_overlay.dart` — NEW: Two-phase Quick Vote overlay widget
- `apps/flutter_app/lib/state/party_provider.dart` — MODIFIED: Added QuickVoteOption, QuickVoteResult classes, Quick Vote state fields and methods
- `apps/flutter_app/lib/socket/client.dart` — MODIFIED: Added quickVoteResult listener, emitQuickVoteCast, parse quickVoteOptions
- `apps/flutter_app/lib/screens/party_screen.dart` — MODIFIED: Added QuickVoteOverlay to overlay stack
- `apps/flutter_app/lib/constants/copy.dart` — MODIFIED: Added quickVoteTitle, quickVoteSubtitle
- `apps/server/tests/services/quick-vote-dealer.test.ts` — NEW: 18 unit tests for dealer + tally service (+ firstVote assertions)
- `apps/server/tests/services/session-manager-quick-vote.test.ts` — NEW: 12 integration tests for Quick Vote dispatch, two-phase timer, HOST_SKIP, cleanup
- `apps/flutter_app/test/widgets/quick_vote_overlay_test.dart` — NEW: 9 widget tests for overlay (+ tie highlight test)
- `apps/server/tests/services/session-manager-ceremony.test.ts` — MODIFIED: Added quick-vote-dealer mock
- `apps/server/tests/services/session-manager-interlude-game.test.ts` — MODIFIED: Added quick-vote-dealer mock
- `apps/server/tests/services/session-manager-dare-pull.test.ts` — MODIFIED: Added quick-vote-dealer mock
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: Story status tracking

# Story 7.2: Kings Cup Interlude

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want a group rule card game between songs,
So that everyone participates in a shared silly challenge that keeps the energy up.

## Acceptance Criteria

1. **Given** the DJ engine selects an interlude activity, **When** Kings Cup is chosen (via `context.metadata.selectedActivity === 'kings_cup'`), **Then** a group rule card is displayed to all participants simultaneously (FR28b) **And** the card auto-advances after 10 seconds
2. **Given** the interlude library selection, **When** Kings Cup is considered, **Then** it is selected via weighted random with no immediate repeats from the activity pool (FR28a) **And** Kings Cup is a universal activity eligible for front-loading in the first 30 minutes (FR15) — this selection logic already exists in `activity-voter.ts` from Story 7.1
3. **Given** a Kings Cup card is dealt, **When** displayed to all participants, **Then** the card shows a title, rule description, and emoji simultaneously to all connected clients **And** no individual action is required (passive group display)
4. **Given** the 10-second card display timer expires, **When** the game ends, **Then** the system broadcasts a game-ended event **And** triggers `INTERLUDE_DONE` to advance the DJ cycle
5. **Given** multiple interludes occur in a session, **When** Kings Cup is selected again, **Then** the same card is never dealt twice in a row (no immediate card repeats within a session)

## Tasks / Subtasks

- [x]Task 1: Create Kings Cup card pool service (AC: #1, #3, #5)
  - [x]1.1 Create `apps/server/src/services/kings-cup-dealer.ts` with `KingsCupCard` interface: `{ id: string; title: string; rule: string; emoji: string }`
  - [x]1.2 Define `KINGS_CUP_CARDS` array with 15-20 group rule cards (party-appropriate, no props needed, group-participation focused). Follow `PARTY_CARDS` pattern in `party-card-pool.ts`
  - [x]1.3 Implement `dealCard(sessionId: string): KingsCupCard` — random selection from pool, no immediate repeat per session. Track `lastDealtCard` per session via module-level `Map<string, string>` (same pattern as `lastSelectedActivity` in `activity-voter.ts`)
  - [x]1.4 Implement `clearSession(sessionId: string): void` — cleanup `lastDealtCard` for session
  - [x]1.5 Implement `resetAll(): void` — test utility to clear module-level Map
  - [x]1.6 Export `KINGS_CUP_CARDS` for testing

- [x]Task 2: Add interlude game socket events and schemas (AC: #1, #4)
  - [x]2.1 Add to `apps/server/src/shared/events.ts`: `INTERLUDE_GAME_STARTED: 'interlude:gameStarted'`, `INTERLUDE_GAME_ENDED: 'interlude:gameEnded'`
  - [x]2.2 Add full `SessionEvent` union members in `services/event-stream.ts` (follows existing pattern at lines 47-49):
    - `| { type: 'interlude:gameStarted'; ts: number; data: { activityId: string; cardId: string } }`
    - `| { type: 'interlude:gameEnded'; ts: number; data: { activityId: string } }`
  - [x]2.3 Add to `apps/server/src/shared/schemas/interlude-schemas.ts`:
    - `interludeGameStartedSchema` — `{ activityId: z.string(), card: z.object({ id: z.string(), title: z.string(), rule: z.string(), emoji: z.string() }), gameDurationMs: z.number() }`
    - `interludeGameEndedSchema` — `{ activityId: z.string() }`

- [x]Task 3: Add interlude game broadcast functions (AC: #1, #4)
  - [x]3.1 Add `broadcastInterludeGameStarted(sessionId, data)` to `dj-broadcaster.ts` — emits `EVENTS.INTERLUDE_GAME_STARTED`
  - [x]3.2 Add `broadcastInterludeGameEnded(sessionId, data)` to `dj-broadcaster.ts` — emits `EVENTS.INTERLUDE_GAME_ENDED`

- [x]Task 4: Modify session-manager to dispatch interlude games after vote reveal (AC: #1, #4)
  - [x]4.1 Add `INTERLUDE_GAME_DURATION_MS = 10_000` constant (10s card display)
  - [x]4.2 Create `startInterludeGame(sessionId: string, selectedActivity: string, context: DJContext): void` dispatcher function:
    - If `selectedActivity === 'kings_cup'` → call `executeKingsCup(sessionId, context)`
    - Else → trigger `INTERLUDE_DONE` immediately (forward-compatible for Stories 7.3-7.5)
  - [x]4.3 Create `executeKingsCup(sessionId: string, context: DJContext): void`:
    - Call `dealCard(sessionId)` from kings-cup-dealer
    - Call `broadcastInterludeGameStarted(sessionId, { activityId: 'kings_cup', card, gameDurationMs: INTERLUDE_GAME_DURATION_MS })`
    - Append to event stream: `{ type: 'interlude:gameStarted', ts, data: { activityId: 'kings_cup', cardId: card.id } }`
    - Schedule 10s `setTimeout` for game end → call `endInterludeGame(sessionId)`
    - Store timer in `interludeGameTimers` Map (same pattern as `interludeRevealTimers`)
  - [x]4.4 Create `endInterludeGame(sessionId: string): void`:
    - Delete timer from `interludeGameTimers`
    - Re-fetch context via `getSessionDjState(sessionId)` — guard: return if null or state !== interlude (same pattern as reveal timer callback at line 449-450)
    - Read `selectedActivity` from `context.metadata` with `typeof` guard
    - Call `broadcastInterludeGameEnded(sessionId, { activityId: selectedActivity ?? 'unknown' })`
    - Append event stream: `{ type: 'interlude:gameEnded', ts, data: { activityId } }`
    - Trigger `INTERLUDE_DONE`: `void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' })`
  - [x]4.5 **CRITICAL MODIFICATION**: In `finalizeInterludeVote` (session-manager.ts lines 447-458), replace the reveal timer callback. The actual current code is:
    ```typescript
    // CURRENT CODE (session-manager.ts:447-458) — replace the callback body:
    const revealTimer = setTimeout(async () => {
      interludeRevealTimers.delete(sessionId);
      const currentContext = getSessionDjState(sessionId);
      if (!currentContext || currentContext.state !== DJState.interlude) return;
      try {
        await processDjTransition(sessionId, currentContext, { type: 'INTERLUDE_DONE' });
      } catch {
        // Already transitioned (e.g., HOST_SKIP raced) — safe to ignore
      }
    }, INTERLUDE_REVEAL_DELAY_MS);

    // REPLACE WITH:
    const revealTimer = setTimeout(() => {
      interludeRevealTimers.delete(sessionId);
      const currentContext = getSessionDjState(sessionId);
      if (!currentContext || currentContext.state !== DJState.interlude) return;
      const selectedActivity = typeof currentContext.metadata.selectedActivity === 'string'
        ? currentContext.metadata.selectedActivity
        : null;
      if (selectedActivity) {
        startInterludeGame(sessionId, selectedActivity, currentContext);
      } else {
        void processDjTransition(sessionId, currentContext, { type: 'INTERLUDE_DONE' });
      }
    }, INTERLUDE_REVEAL_DELAY_MS);
    ```
  - [x]4.6 Wire `clearKingsCupSession(sessionId)` into session teardown (same location where `clearActivityVoterSession(sessionId)` is called)
  - [x]4.7 Clear `interludeGameTimers` on session end (same pattern as `interludeRevealTimers` cleanup)

- [x]Task 5: Flutter Kings Cup game overlay (AC: #1, #3)
  - [x]5.1 Create `apps/flutter_app/lib/widgets/kings_cup_overlay.dart` — full-screen overlay displaying:
    - Card emoji (large, centered)
    - Card title (bold, DJTokens typography)
    - Card rule description
    - 10s countdown timer (same countdown pattern as `InterludeVoteOverlay`)
    - Entrance animation (card flip or scale-in)
  - [x]5.2 Use `DJTokens` for all spacing/colors. Use `Key('kings-cup-overlay')` and `Key('kings-cup-card')`
  - [x]5.3 All strings in `constants/copy.dart`

- [x]Task 6: Flutter state and socket integration (AC: #1, #3, #4)
  - [x]6.1 Add to `PartyProvider`:
    - `InterludeGameCard` class: `{ id, title, rule, emoji }` with `fromJson` factory
    - State fields: `_interludeGameActivityId` (String?), `_interludeGameCard` (InterludeGameCard?), `_interludeGameDurationMs` (int), `_interludeGameStartedAt` (int?) — use this separate field for game countdown, NOT the existing `_timerStartedAt` (which tracks the DJ engine timer for the vote overlay)
    - Getters for all fields
    - `onInterludeGameStarted(String activityId, InterludeGameCard card, int gameDurationMs)` — **first** clear vote overlay state (`_interludeOptions = []` so vote overlay disappears), **then** set game fields, notifyListeners. Vote and game overlays must be mutually exclusive
    - `onInterludeGameEnded()` — clears game fields, notifyListeners
    - Add game field clearing to existing `_clearInterludeState()` method
  - [x]6.2 Add to `SocketClient` (in `socket/client.dart`):
    - Listen for `interlude:gameStarted` → parse payload → call `_partyProvider?.onInterludeGameStarted(...)`
    - Listen for `interlude:gameEnded` → call `_partyProvider?.onInterludeGameEnded()`
  - [x]6.3 In `party_screen.dart`, add `KingsCupOverlay` to overlay stack:
    - Show when `partyProvider.interludeGameActivityId == 'kings_cup'` and `partyProvider.interludeGameCard != null`
    - Position in overlay stack after `InterludeVoteOverlay` (Kings Cup shows after vote concludes)
    - Pass `timerStartedAt` from provider for countdown sync

- [x]Task 7: Tests (AC: all)
  - [x]7.1 `apps/server/tests/services/kings-cup-dealer.test.ts`:
    - Card pool has 15+ cards with required fields
    - `dealCard()` returns valid card from pool
    - No immediate repeat: calling `dealCard()` twice returns different cards
    - `clearSession()` resets last-dealt tracking
    - `resetAll()` clears all session data
    - All cards have non-empty id, title, rule, emoji
  - [x]7.2 `apps/server/tests/services/session-manager-interlude-game.test.ts`:
    - `startInterludeGame` dispatches to `executeKingsCup` when selectedActivity is 'kings_cup'
    - `startInterludeGame` triggers INTERLUDE_DONE when selectedActivity has no handler
    - `executeKingsCup` broadcasts `interlude:gameStarted` with card data
    - Game timer fires after 10s and broadcasts `interlude:gameEnded`
    - Game timer fires INTERLUDE_DONE after `interlude:gameEnded`
    - Session cleanup clears game timers
    - Mock `kings-cup-dealer` to control card output
  - [x]7.3 `apps/flutter_app/test/widgets/kings_cup_overlay_test.dart`:
    - Renders card emoji, title, and rule
    - Shows countdown timer
    - Uses correct widget keys
  - [x]7.4 Update `apps/server/tests/services/session-manager-ceremony.test.ts` — this file already mocks `activity-voter.ts` (line 90) and tests interlude state transitions (lines 427-600). Add a `vi.mock('../../src/services/kings-cup-dealer.js', ...)` alongside the existing `activity-voter` mock to prevent import errors from the new `kings-cup-dealer` import in session-manager

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL game state lives on server. Flutter renders server-broadcast card data — zero game logic in Dart
- **Boundary rules**: `kings-cup-dealer.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Session-manager orchestrates
- **Socket handler pattern**: No new socket handler needed — Kings Cup is passive (no client input). All events are server→client broadcasts
- **DJ engine purity**: Engine only manages state transitions. Game orchestration (card dealing, timing) lives in session-manager, not engine. No DJ engine changes in this story

### Reuse Patterns from Story 7.1 (DO NOT REINVENT)

| Story 7.1 Pattern | Story 7.2 Equivalent |
|---|---|
| `activity-voter.ts` module-level Maps | `kings-cup-dealer.ts` module-level `lastDealtCard` Map |
| `lastSelectedActivity` per-session tracking | `lastDealtCard` per-session tracking |
| `clearSession()` + `resetAllRounds()` | `clearSession()` + `resetAll()` |
| `INTERLUDE_REVEAL_DELAY_MS` setTimeout | `INTERLUDE_GAME_DURATION_MS` setTimeout |
| `interludeRevealTimers` Map for timer tracking | `interludeGameTimers` Map for timer tracking |
| `broadcastInterludeVoteStarted/Result` | `broadcastInterludeGameStarted/Ended` |
| `InterludeVoteOverlay` widget | `KingsCupOverlay` widget |
| `InterludeOption` class in PartyProvider | `InterludeGameCard` class in PartyProvider |

### Also Reuse `party-card-pool.ts` Content Pattern

The `PARTY_CARDS` array in `party-card-pool.ts` is the blueprint for `KINGS_CUP_CARDS`:
- Same structure: `readonly` array of typed objects, kebab-case ids, exported for testing
- Same content style: fun, party-appropriate, no physical props
- **Simpler interface**: `KingsCupCard` has `{ id, title, rule, emoji }` only — NO `type` enum or `minParticipants` field (all Kings Cup cards are group rules requiring 3+ participants, which is already enforced by `activity-voter.ts` filtering)

### Kings Cup Card Content Guidelines

Cards should be:
- **Group rules** that apply to everyone simultaneously (not individual challenges — that's Dare Pull in Story 7.3)
- **No physical props** required (phone-only party)
- **Self-contained** (rule is clear from the card text alone)
- **Party-appropriate** (fun, silly, not offensive)
- **Varied difficulty** (some easy like "everyone toast!" and some harder like "speak in accents for the next song")

Example cards:
- "Group Toast!" — Everyone raises their phone and cheers
- "Accent Round" — Everyone must speak in a silly accent until the next song starts
- "Compliment Circle" — Each person compliments the person to their left
- "Freeze!" — Strike a pose. Last person to freeze picks the next song
- "Story Time" — Go around adding one word each to create a group story

### Session Manager Integration — Critical Flow

```
CURRENT FLOW (Story 7.1):
  interlude state → vote (15s) → resolve → reveal (5s) → INTERLUDE_DONE → songSelection

NEW FLOW (Story 7.2):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → kings_cup: deal card → broadcast gameStarted → display (10s) → broadcast gameEnded → INTERLUDE_DONE → songSelection
    → unknown activity: → INTERLUDE_DONE → songSelection (backward compatible)
```

**Total interlude duration with Kings Cup: 15s vote + 5s reveal + 10s game = 30s max**

### Timer Architecture (3 timers, same pattern as ceremony)

1. **Vote window** (15s): DJ engine timer in `timers.ts` — already exists from Story 7.1
2. **Reveal delay** (5s): `setTimeout` in session-manager — already exists from Story 7.1, callback modified
3. **Game display** (10s): NEW `setTimeout` in session-manager — same pattern as reveal delay

All timers stored in Maps and cleaned up on session end. Cancel game timer on HOST_SKIP.

### HOST_SKIP During Game

If host skips during game display, game timers must be cancelled. **Extend the existing `clearInterludeTimers` function** (session-manager.ts line 362) to also clear `interludeGameTimers`:

```typescript
// CURRENT (line 362-367):
function clearInterludeTimers(sessionId: string): void {
  const timer = interludeRevealTimers.get(sessionId);
  if (timer) { clearTimeout(timer); interludeRevealTimers.delete(sessionId); }
}

// AFTER — extend to also clear game timers:
function clearInterludeTimers(sessionId: string): void {
  const revealTimer = interludeRevealTimers.get(sessionId);
  if (revealTimer) { clearTimeout(revealTimer); interludeRevealTimers.delete(sessionId); }
  const gameTimer = interludeGameTimers.get(sessionId);
  if (gameTimer) { clearTimeout(gameTimer); interludeGameTimers.delete(sessionId); }
}
```

This is called at line 1282 (HOST_SKIP) and line 1533 (session teardown) — both paths automatically pick up the new cleanup. No separate call needed.

### What This Story Does NOT Include (Scope Boundaries)

- NO client-side interaction during card display (Kings Cup is passive — card auto-advances)
- NO scoring changes — participation scoring already tracks `interlude:vote` (Story 7.1). Card viewing is passive
- NO DJ engine changes — engine stays as-is, game orchestration is in session-manager
- NO changes to the vote flow itself — only the callback after the 5s reveal is modified
- NO persistence of dealt cards to database — in-memory only (same as activity-voter)

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/kings-cup-dealer.ts` | NEW — Card pool + random deal, no-repeat tracking |
| `apps/server/src/shared/events.ts` | MODIFY — Add INTERLUDE_GAME_STARTED, INTERLUDE_GAME_ENDED |
| `apps/server/src/services/event-stream.ts` | MODIFY — Add game SessionEvent union members |
| `apps/server/src/shared/schemas/interlude-schemas.ts` | MODIFY — Add game started/ended schemas |
| `apps/server/src/services/dj-broadcaster.ts` | MODIFY — Add broadcastInterludeGameStarted/Ended |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add game dispatch, executeKingsCup, timer management, modify finalizeInterludeVote callback |
| `apps/flutter_app/lib/widgets/kings_cup_overlay.dart` | NEW — Card display overlay |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add InterludeGameCard class, game state fields |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add game event listeners |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Show KingsCupOverlay in stack |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add Kings Cup strings |

### Testing Strategy

- **Unit tests** for `kings-cup-dealer.ts`: Card pool validity, deal randomness, no-repeat logic, session cleanup, resetAll
- **Integration tests** for session-manager game dispatch: Kings Cup path, unknown activity path, timer behavior, HOST_SKIP cancellation, session cleanup
- **Flutter widget tests**: Overlay rendering (emoji, title, rule), countdown display, widget keys
- **DO NOT test**: Visual animations, color values, transition timings, card flip effects

### Previous Story Intelligence (Story 7.1 Learnings)

- **Code review tip from 7.1**: Always add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads. Add cleanup to both `onSessionEnded()` and `onKicked()` in party_provider
- **Mock compatibility**: When modifying session-manager, update existing test mocks (`session-manager-ceremony.test.ts` line 90) to include new imports

### Project Structure Notes

- `snake_case` for DB columns (no DB changes in this story)
- `camelCase` for Socket.io event payloads (Zod schemas)
- `kebab-case` for TS filenames: `kings-cup-dealer.ts`
- `snake_case` for Dart filenames: `kings_cup_overlay.dart`
- Socket events: `interlude:gameStarted`, `interlude:gameEnded` (namespace:action format)
- Widget keys: `Key('kings-cup-overlay')`, `Key('kings-cup-card')`
- All copy in `constants/copy.dart`: `kingsCupTitle`, `kingsCupSubtitle`, etc.

### References

- [Source: project-context.md — Server Boundaries, Socket Event Catalog, Testing Rules]
- [Source: architecture.md — FR28a weighted random 3-game library, FR28b Kings Cup group rule card, FR15 front-loading, NFR12 low participant degradation]
- [Source: epics.md — Epic 7 context, Story 7.2 acceptance criteria: card displayed simultaneously, auto-advances 10s]
- [Source: services/activity-voter.ts — Module-level Map pattern, session cleanup, lastSelectedActivity tracking]
- [Source: services/party-card-pool.ts — Card content pool pattern (PARTY_CARDS array)]
- [Source: services/session-manager.ts:416-459 — finalizeInterludeVote, reveal timer pattern, metadata writing]
- [Source: 7-1-democratic-activity-voting.md — Previous story file with complete implementation record]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Created `kings-cup-dealer.ts` with 18 group rule cards, `dealCard()` with no-immediate-repeat tracking per session, `clearSession()`, `resetAll()`. Follows `activity-voter.ts` module-level Map pattern.
- Task 2: Added `INTERLUDE_GAME_STARTED` and `INTERLUDE_GAME_ENDED` events to `events.ts`. Added `SessionEvent` union members for game started/ended in `event-stream.ts`. Added `interludeGameStartedSchema` and `interludeGameEndedSchema` Zod schemas with `.min(1)` validation.
- Task 3: Added `broadcastInterludeGameStarted()` and `broadcastInterludeGameEnded()` to `dj-broadcaster.ts`.
- Task 4: Modified `session-manager.ts` — added `startInterludeGame()` dispatcher (routes to `executeKingsCup` or `INTERLUDE_DONE` for unknown activities), `executeKingsCup()` (deals card, broadcasts, schedules 10s timer), `endInterludeGame()` (broadcasts ended, triggers `INTERLUDE_DONE`). Modified `finalizeInterludeVote` reveal timer callback to dispatch to game instead of directly triggering `INTERLUDE_DONE`. Extended `clearInterludeTimers` to also clear game timers. Wired `clearKingsCupSession` into session teardown.
- Task 5: Created `kings_cup_overlay.dart` — full-screen overlay with card emoji, title, rule, countdown timer, scale-in entrance animation. Uses `DJTokens` for all styling.
- Task 6: Added `InterludeGameCard` class with `fromJson` factory to `party_provider.dart`. Added game state fields (`_interludeGameActivityId`, `_interludeGameCard`, `_interludeGameDurationMs`, `_interludeGameStartedAt`). Added `onInterludeGameStarted()` (clears vote overlay first for mutual exclusivity) and `onInterludeGameEnded()` methods. Updated `_clearInterludeState()` to also clear game fields. Added socket listeners in `client.dart`. Added overlay to `party_screen.dart` stack.
- Task 7: Created `kings-cup-dealer.test.ts` (10 tests), `session-manager-interlude-game.test.ts` (8 tests), `kings_cup_overlay_test.dart` (5 tests). Updated `session-manager-ceremony.test.ts` with kings-cup-dealer mock. All Kings Cup strings in `copy.dart`.
- All 1170 server tests pass (1 new HOST_SKIP test). All 5 Flutter widget tests pass. 2 new provider tests pass. 3 pre-existing Flutter failures (join_screen, tag_team_flash_widget actionPrimary) unrelated to this story.

### Change Log

- 2026-03-18: Implemented Story 7.2 Kings Cup Interlude — card pool service, game dispatch, Flutter overlay, socket integration, 23 new tests
- 2026-03-18: Code review fixes — removed unused Copy.kingsCupTitle, extracted hardcoded game duration to _defaultGameDurationMs constant, null-safe InterludeGameCard.fromJson, removed unused _context param from executeKingsCup, fixed unused data param in gameEnded listener, added HOST_SKIP game timer cancellation test, added provider mutual-exclusivity test

### File List

**New:**
- `apps/server/src/services/kings-cup-dealer.ts`
- `apps/server/tests/services/kings-cup-dealer.test.ts`
- `apps/server/tests/services/session-manager-interlude-game.test.ts`
- `apps/flutter_app/lib/widgets/kings_cup_overlay.dart`
- `apps/flutter_app/test/widgets/kings_cup_overlay_test.dart`

**Modified:**
- `apps/server/src/shared/events.ts`
- `apps/server/src/services/event-stream.ts`
- `apps/server/src/shared/schemas/interlude-schemas.ts`
- `apps/server/src/services/dj-broadcaster.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/tests/services/session-manager-ceremony.test.ts`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/test/state/party_provider_test.dart`

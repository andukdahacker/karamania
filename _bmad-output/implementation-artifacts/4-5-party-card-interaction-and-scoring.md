# Story 4.5: Party Card Interaction & Scoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a singer,
I want to accept, dismiss, or redraw my challenge card quickly,
so that I have agency over the challenge without slowing the party.

## Acceptance Criteria

1. **Given** a party card has been dealt to a singer **When** the singer views the card **Then** they can accept or dismiss the card with a single tap (FR59) **And** the Accept button is green, 56x56px; Dismiss button is grey, 48x48px; Redraw button is accent color, 48x48px with "1 FREE" badge (UX spec) **And** an 8-second soft auto-dismiss timer is shown as a countdown indicator **And** the singer view shows card title, emoji, description, type badge + action buttons **And** the audience view shows "CHALLENGE INCOMING..." with the singer's name (not the card details)
2. **Given** a singer doesn't like their card **When** they tap redraw **Then** they receive one free redraw per turn (FR59) **And** after the redraw, they must accept or dismiss — no further redraws (FR59) **And** the redraw button disappears after use **And** the new card plays the card-flip animation and sound effect
3. **Given** a singer accepts a party card **When** the acceptance is processed **Then** the `card:accepted` event is emitted to the server **And** the server broadcasts the accepted card title to all participants (so audience sees the active challenge) **And** the server triggers CARD_DONE transition to advance to song state **And** participation scoring records the action at the engaged tier (5pts) (FR62) **And** the event stream logs `card:accepted` with cardId and userId **And** the accepted card metadata (`cardAccepted: true`, `acceptedCardId`) persists into song state for ceremony award generation (FR62 — contributes to ceremony awards)
4. **Given** a singer dismisses a card (or the 8s timer expires) **When** the dismissal is processed **Then** the `card:dismissed` event is emitted to the server **And** the server triggers CARD_DONE transition to advance to song state **And** the event stream logs `card:dismissed` with cardId and userId **And** no participation points are awarded for dismissal
5. **Given** a singer uses their redraw **When** the redraw is processed **Then** the `card:redraw` event is emitted (already implemented in 4.4 for host — now also singer-initiated) **And** a new card is dealt excluding the current one **And** the redraw counter is set to 0 (no further redraws) **And** the new card resets the 8s auto-dismiss timer
6. **Given** party card acceptance/dismissal tracking **When** session stats are reviewed **Then** card acceptance rate is tracked per session (FR61) **And** acceptance count and total dealt count are available in session metadata

## Tasks / Subtasks

- [x] Task 0: Populate `currentPerformer` in DJ context and extend `SessionEvent` types (AC: #3, #4 prerequisite)
  - [x] 0.1 In `apps/server/src/services/session-manager.ts`, inside `orchestrateCardDeal()`:
    - `context.currentPerformer` (`dj-engine/types.ts:58`) exists but is ALWAYS `null` — no code sets it
    - Before dealing the card, set `context.currentPerformer` to the userId of the next singer
    - Singer selection: for MVP, use round-robin from the session participant list (or random if no order exists). Check if `songSelection` state already determines a performer — if so, carry that forward
    - The `currentPerformer` value MUST be set before `broadcastDjState()` so Flutter receives it in the `dj:stateChanged` payload and can derive `isCurrentSinger`
  - [x] 0.2 In `apps/server/src/services/event-stream.ts`, extend the `SessionEvent` discriminated union (lines 4-26):
    - Add `| { type: 'card:accepted'; ts: number; userId: string; data: { cardId: string; cardType: string } }`
    - Add `| { type: 'card:dismissed'; ts: number; userId: string; data: { cardId: string; cardType: string } }`
    - Without this, TypeScript will reject `appendEvent()` calls for these new event types

- [x] Task 1: Add `card:accepted` and `card:dismissed` socket handlers on server (AC: #3, #4)
  - [x] 1.1 In `apps/server/src/socket-handlers/card-handlers.ts`, add `card:accepted` handler:
    - Guard: current DJ state must be `partyCardDeal`
    - Guard: `socket.data.userId === context.currentPerformer` (singer check — NOT host check). Access `socket.data` shape: `{ userId, sessionId, role, displayName }` from `shared/socket-types.ts`
    - Extract `cardId` from payload, validate it matches `context.metadata.currentCard.id`
    - Call `recordParticipationAction(sessionId, userId, 'card:accepted', rewardMultiplier)` — already wired in participation-scoring.ts at engaged tier (5pts)
    - Update DJ context metadata: `cardAccepted: true`, `acceptedCardId: cardId` — these MUST persist into song state so ceremony award generation can reference the accepted card (FR62)
    - Broadcast acceptance to all participants: emit `EVENTS.CARD_ACCEPTED` to session room with `{ cardId, cardTitle, cardType, singerName }` so audience sees the active challenge
    - Call `appendEvent(sessionId, { type: 'card:accepted', ts: Date.now(), userId, data: { cardId, cardType } })` to event stream
    - Trigger `processDjTransition(sessionId, { type: 'CARD_DONE' })` to advance to song state
  - [x] 1.2 Add `card:dismissed` handler:
    - Same guards as accepted (state check, singer check via `context.currentPerformer`)
    - Do NOT call `recordParticipationAction` — no points for dismissal
    - Update DJ context metadata: `cardAccepted: false`, `acceptedCardId: null`
    - Call `appendEvent(sessionId, { type: 'card:dismissed', ts: Date.now(), userId, data: { cardId, cardType } })` to event stream
    - Trigger `processDjTransition(sessionId, { type: 'CARD_DONE' })` to advance to song state
  - [x] 1.3 Extend existing `card:redraw` handler to also allow the current singer (not just host):
    - Current handler validates `isHost` — add OR condition for `userId === currentSingerId`
    - Add a `redrawUsed` flag in DJ context metadata; reject if already true for this singer
    - On successful redraw: set `metadata.redrawUsed = true`, reset any server-side timer tracking
    - The existing `redealCard()` and broadcast logic remain unchanged

- [x] Task 2: Track card acceptance stats in session metadata (AC: #6)
  - [x] 2.1 In `apps/server/src/services/session-manager.ts`, add card tracking to session in-memory state:
    - Add to session context (or a parallel tracker): `cardStats: { dealt: number, accepted: number }`
    - Increment `dealt` in existing `orchestrateCardDeal()` function
    - Increment `accepted` in the card:accepted handler flow
    - Include `cardStats` in event stream batch write at session end
  - [x] 2.2 Initialize `cardStats` in session creation and reset `redrawUsed` flag on each new partyCardDeal entry

- [x] Task 3: Add Flutter card interaction UI with differentiated singer/audience views (AC: #1, #2)
  - [x] 3.1 In `apps/flutter_app/lib/widgets/party_card_deal_overlay.dart` — **Singer view** (when `context.watch<PartyProvider>().isCurrentSinger == true`):
    - Add a row of action buttons below the card:
    - **Accept** button: green accent, **56x56px**, checkmark icon, calls `SocketClient.instance.emitCardAccepted(cardId)`
    - **Dismiss** button: grey/muted, **48x48px**, X icon, calls `SocketClient.instance.emitCardDismissed(cardId)`
    - **Redraw** button: accent color, **48x48px**, refresh icon with **"1 FREE" badge overlay**, shows only if `!redrawUsed`, calls `SocketClient.instance.emitCardRedraw()`
    - After redraw used, hide the redraw button entirely
  - [x] 3.2 **Audience view** (when `isCurrentSinger == false`):
    - Show "CHALLENGE INCOMING..." text with the singer's display name (from `partyProvider.currentPerformer` display name)
    - Do NOT show the card details or action buttons — audience only sees the card reveal after singer accepts
    - When a `card:accepted` broadcast arrives, briefly show the accepted card title + type badge to all audience (use a listener on `EVENTS.CARD_ACCEPTED`)
  - [x] 3.3 Add 8-second countdown timer indicator (singer view only):
    - Circular or linear progress indicator counting down from 8s
    - On expiry, auto-call `emitCardDismissed(cardId)` (soft auto-dismiss)
    - Timer resets when a redraw delivers a new card (`didUpdateWidget` already handles card change)
    - Timer cancels on accept or dismiss tap
    - Replay card-flip sound on redraw (reuse audio cue from Story 4.4 deal animation)
  - [x] 3.4 Use `DJTokens` for all spacing, colors, and sizing — no hardcoded values
  - [x] 3.5 All button labels from `constants/copy.dart` — add entries: `cardAcceptLabel`, `cardDismissLabel`, `cardRedrawLabel`, `cardChallengeIncoming`, `cardWaitingForSinger`

- [x] Task 4: Add socket emitters and listeners in Flutter (AC: #3, #4, #5)
  - [x] 4.1 In `apps/flutter_app/lib/socket/client.dart`:
    - Add `emitCardAccepted(String cardId)` — emits `EVENTS.CARD_ACCEPTED` with `{ cardId }`
    - Add `emitCardDismissed(String cardId)` — emits `EVENTS.CARD_DISMISSED` with `{ cardId }`
    - `emitCardRedraw()` already exists (Story 4.4) — no changes needed
  - [x] 4.2 Add listener for `EVENTS.CARD_ACCEPTED` broadcast (server→client):
    - Parse `{ cardId, cardTitle, cardType, singerName }` payload
    - Call `partyProvider.onCardAcceptedBroadcast(cardTitle, cardType)` so audience view can briefly display the active challenge
    - Existing `card:dealt` listener and `dj:stateChanged` listener remain unchanged

- [x] Task 5: Update PartyProvider for interaction state (AC: #1, #2)
  - [x] 5.1 In `apps/flutter_app/lib/state/party_provider.dart`:
    - Add `_redrawUsed` (bool, default false) — tracks if singer used their redraw this turn
    - `isCurrentSinger` getter: `_currentPerformer` is already set at line 275 from `dj:stateChanged`. Compare with local userId from socket client: `_currentPerformer == socketClient.userId`
    - Add `onCardRedrawUsed()` — sets `_redrawUsed = true`, `notifyListeners()`
    - Add `_acceptedCardTitle` (String?) and `onCardAcceptedBroadcast(String title, String type)` — for audience view brief display of accepted card
    - Reset `_redrawUsed = false` and `_acceptedCardTitle = null` when entering a new partyCardDeal state (in `onDjStateChanged`)
    - Expose: `bool get redrawUsed`, `bool get isCurrentSinger`, `PartyCardData? get currentCard`, `String? get acceptedCardTitle`

- [x] Task 6: Write server tests (AC: #1-6)
  - [x] 6.1 `apps/server/tests/socket-handlers/card-handlers.test.ts`:
    - Test `card:accepted` handler: validates state guard, singer guard (`currentPerformer` match), scoring call, acceptance broadcast to session room, CARD_DONE transition, event stream logging, metadata persistence (`cardAccepted: true`)
    - Test `card:dismissed` handler: validates state guard, singer guard, no scoring, no broadcast, CARD_DONE transition, event stream logging
    - Test `card:redraw` by singer: validates singer can redraw, redraw blocked after first use (`metadata.redrawUsed`), new card excluded old card
    - Test `card:redraw` by host: existing tests still pass (regression)
    - Test guard rejections: wrong state, wrong user (non-singer), already-used redraw
    - Test non-singer cannot accept/dismiss (returns error, no state change)
    - Use existing test factories from `tests/factories/`
  - [x] 6.2 `apps/server/tests/services/card-dealer.test.ts`:
    - Existing tests should still pass (regression) — no changes to dealer logic expected
  - [x] 6.3 Test that `currentPerformer` is set in `orchestrateCardDeal()` and included in DJ state broadcast

- [x] Task 7: Write Flutter tests (AC: #1-5)
  - [x] 7.1 `apps/flutter_app/test/widgets/party_card_deal_overlay_test.dart`:
    - Test singer view: accept (56x56), dismiss (48x48), redraw (48x48 with "1 FREE" badge) buttons visible
    - Test audience view: shows "CHALLENGE INCOMING..." + singer name, no buttons, no card details
    - Test accept button tap calls `emitCardAccepted`
    - Test dismiss button tap calls `emitCardDismissed`
    - Test redraw button visibility: shown initially with badge, hidden after use
    - Test auto-dismiss timer fires after 8 seconds
    - Test audience shows accepted card title briefly after `card:accepted` broadcast received
  - [x] 7.2 `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `redrawUsed` toggles correctly
    - Test `redrawUsed` resets on new partyCardDeal state
    - Test `isCurrentSinger` derived correctly from `currentPerformer` matching local userId

## Dev Notes

### Architecture Compliance

- **Server-authoritative:** All card interaction validation happens server-side. Flutter just emits events and renders server state.
- **Socket handler pattern:** Follow `card-handlers.ts` existing pattern — validate → guard state → process → persist → broadcast → log event stream
- **DJ transition:** Use `{ type: 'CARD_DONE' }` transition (already defined in `dj-engine/transitions.ts` line 56 and `states.ts` line 24). This advances `partyCardDeal` → next cycle state via `getNextCycleState()`.
- **Participation scoring:** `'card:accepted'` is pre-configured in `participation-scoring.ts` line 25 at engaged tier (5pts). Call `recordParticipationAction()` from session-manager — same pattern as reaction scoring.
- **Event constants:** `CARD_ACCEPTED` and `CARD_DISMISSED` already defined in `shared/events.ts` lines 39-40.

### Existing Code to Reuse (DO NOT Recreate)

| What | File (under `apps/server/src/` or `apps/flutter_app/lib/`) | Key exports / line refs |
|------|------|------------|
| Card dealer + redeal | `services/card-dealer.ts` | `redealCard()` for singer redraw — same function host uses |
| Card pool + types | `services/party-card-pool.ts` | `PartyCard` type, `CardType` enum, `getEligibleCards()` |
| DJ broadcaster | `services/dj-broadcaster.ts` | `broadcastCardDealt()` for redraw broadcast |
| Participation scoring | `services/participation-scoring.ts:25` | `'card:accepted'` pre-wired at engaged tier (5pts). Call `recordParticipationAction()` |
| Event stream | `services/event-stream.ts:30-37` | `appendEvent()` — MUST extend `SessionEvent` union first (Task 0) |
| Event constants | `shared/events.ts:39-40` | `CARD_ACCEPTED`, `CARD_DISMISSED` already defined |
| DJ transitions | `dj-engine/transitions.ts:56`, `states.ts:24` | `CARD_DONE` transition allowed from `partyCardDeal` |
| DJContext type | `dj-engine/types.ts:58` | `currentPerformer: string \| null` — must be populated |
| Card redraw handler | `socket-handlers/card-handlers.ts` | Extend existing handler (add singer OR condition) |
| Host validation pattern | `socket-handlers/host-handlers.ts:17-23` | `validateHost()` queries DB — singer check uses `context.currentPerformer` instead |
| Socket.data shape | `shared/socket-types.ts` | `{ userId, sessionId, role, displayName }` |
| orchestrateCardDeal | `services/session-manager.ts:165-203` | Extend to set `currentPerformer` + increment `cardStats.dealt` |
| Card overlay widget | `widgets/party_card_deal_overlay.dart` | Add buttons + audience view to existing widget |
| Socket emitter pattern | `socket/client.dart:394-396` | Follow `emitCardRedraw()` for new emitters |
| Party provider | `state/party_provider.dart:60,108,275` | `_currentPerformer` already wired from `dj:stateChanged` |
| Flutter card data | `constants/party_cards.dart` | `PartyCardData` class, `PartyCardType` enum |
| Copy strings | `constants/copy.dart:156-161` | Existing card copy — add accept/dismiss/redraw labels |

### Current Singer Identification (CRITICAL)

`DJContext.currentPerformer` (`dj-engine/types.ts:58`) is typed `string | null` but is **ALWAYS `null`** — no code sets it. You MUST populate it in `orchestrateCardDeal()` in `session-manager.ts` BEFORE broadcasting. This is Task 0 and a prerequisite for all card handler singer guards. The value must flow through `broadcastDjState()` → Flutter `dj:stateChanged` payload → `PartyProvider._currentPerformer` (already wired at `party_provider.dart:275`) so the client can derive `isCurrentSinger`.

### Timer Architecture

- **Server-side:** The 15s TIMEOUT on `partyCardDeal` state remains as the hard ceiling (Story 4.4).
- **Client-side:** The 8s soft auto-dismiss timer is UI-only. On expiry, the client emits `card:dismissed`. If the client doesn't emit before 15s, the server TIMEOUT auto-advances anyway.
- No server-side 8s timer needed — client handles soft dismiss, server handles hard timeout.

### Rate Limiting

Card interactions are one-per-turn actions (accept once, dismiss once, redraw once). No rate limiter needed — the state machine guards prevent duplicate interactions by advancing state on first valid action.

### Project Structure Notes

- All new server code in existing files — no new files needed
- Flutter: modify existing `party_card_deal_overlay.dart` and `party_provider.dart`
- New emitters in existing `client.dart`
- New copy strings in existing `copy.dart`
- Tests extend existing test files + add new test cases

### References

- [Source: _bmad-output/project-context.md] — all architecture rules, boundaries, and anti-patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#L1075-1081] — button sizes, audience vs singer views, timer behavior
- All server/Flutter file references consolidated in "Existing Code to Reuse" table above

### Previous Story (4.4) Intelligence

- Story 4.4 created the card pool, dealer, broadcaster, and display overlay
- `redealCard()` was built for host re-deal — can be reused directly for singer redraw
- Card overlay uses two AnimationControllers (slide + flip) — add buttons below the animated card
- `didUpdateWidget()` already re-triggers flip animation when card ID changes (handles redraw card swap)
- DJ context `metadata.currentCard` stores the dealt card object — extend with interaction state
- Event stream already logs `card:dealt` and `card:redealt` — add `card:accepted` and `card:dismissed`
- Test factories in `tests/factories/` are used throughout — follow same pattern

### Git Intelligence (Recent Patterns from 4.4 Commit)

- 28 files changed in Story 4.4 — this story modifies existing files, no new files expected
- Server tests follow pattern: describe blocks per handler, mock socket/session objects from factories
- Flutter tests use `WidgetTester`, mock providers with `ChangeNotifierProvider.value`
- All commits squashed with code review fixes — expect same pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- **Task 0:** Set `currentPerformer` via round-robin from active non-host connections in `orchestrateCardDeal()`. Extended `SessionEvent` union with `card:accepted` and `card:dismissed` types. Modified `processDjTransition` to use updated context from `orchestrateCardDeal` for broadcast (ensures `currentPerformer` is included in `dj:stateChanged` payload). Also initialized `metadata.redrawUsed = false` in orchestration.
- **Task 1:** Rewrote `card-handlers.ts` with three handlers: `card:accepted` (state guard + singer guard + scoring + broadcast + event log + CARD_DONE transition), `card:dismissed` (same guards, no scoring, event log + transition), `card:redraw` (now allows both host and singer, singer gets one free redraw tracked via `metadata.redrawUsed`).
- **Task 2:** Added in-memory `cardStatsCache` with `incrementCardDealt()` and `incrementCardAccepted()`. Dealt count incremented in `orchestrateCardDeal()`, accepted count in `card:accepted` handler. Stats included in event stream at session end. Cleanup in `endSession()`.
- **Task 3:** Rebuilt `PartyCardDealOverlay` with singer/audience differentiation. Singer view: accept (56x56 green), dismiss (48x48 grey), redraw (48x48 accent with "1 FREE" badge) buttons + 8s circular countdown timer. Audience view: "CHALLENGE INCOMING..." with singer name, shows accepted card title after broadcast. Timer auto-dismisses on expiry, resets on redraw, cancels on user action.
- **Task 4:** Added `emitCardAccepted()` and `emitCardDismissed()` to `SocketClient`. Added `card:accepted` listener that calls `partyProvider.onCardAcceptedBroadcast()`.
- **Task 5:** Added `_localUserId`, `_redrawUsed`, `_acceptedCardTitle`, `_acceptedCardType` to `PartyProvider`. Added `isCurrentSinger` getter, `setLocalUserId()`, `onCardRedrawUsed()`, `onCardAcceptedBroadcast()`. State resets on entering/leaving `partyCardDeal`. `setLocalUserId` called from `SocketClient.connect()`.
- **Task 6:** Comprehensive server tests for `card:accepted` (7 tests), `card:dismissed` (5 tests), `card:redraw` (8 tests including singer/host/guard scenarios).
- **Task 7:** 14 widget tests (singer view: buttons, sizing, tap handlers, timer, redraw visibility; audience view: challenge incoming, no buttons, accepted card display). 8 provider tests (redrawUsed, isCurrentSinger, acceptedCardTitle, state resets).

### Change Log

- 2026-03-15: Implemented Story 4.5 — Party Card Interaction & Scoring. All 7 tasks completed. Server: 651 tests pass. Flutter: all tests pass (exit code 0).
- 2026-03-15: Code review fixes applied (7 issues). Fixed: missing orchestrateCardDeal tests (Task 6.3), currentPerformer displaying raw userId in party_screen, card stats summary using wrong event type, missing redraw sound effect, flip animation on audience view, fire-and-forget error handling. Server: 657 tests pass. Flutter: 101 tests pass.

### File List

- apps/server/src/services/session-manager.ts (modified — currentPerformer selection, cardStats tracking, orchestrateCardDeal returns DJContext)
- apps/server/src/services/event-stream.ts (modified — added card:accepted and card:dismissed SessionEvent types)
- apps/server/src/socket-handlers/card-handlers.ts (modified — rewrote with card:accepted, card:dismissed, singer+host card:redraw handlers)
- apps/flutter_app/lib/widgets/party_card_deal_overlay.dart (modified — singer/audience views, action buttons, countdown timer)
- apps/flutter_app/lib/state/party_provider.dart (modified — isCurrentSinger, redrawUsed, acceptedCardTitle, localUserId)
- apps/flutter_app/lib/socket/client.dart (modified — emitCardAccepted, emitCardDismissed, card:accepted listener, setLocalUserId)
- apps/flutter_app/lib/constants/copy.dart (modified — added card interaction labels)
- apps/flutter_app/lib/screens/party_screen.dart (modified — updated PartyCardDealOverlay call site with new params)
- apps/server/tests/socket-handlers/card-handlers.test.ts (modified — comprehensive tests for all 3 handlers)
- apps/flutter_app/test/widgets/party_card_deal_overlay_test.dart (modified — 14 tests for singer/audience views)
- apps/flutter_app/test/state/party_provider_test.dart (modified — 8 tests for card interaction state)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — story status updated)

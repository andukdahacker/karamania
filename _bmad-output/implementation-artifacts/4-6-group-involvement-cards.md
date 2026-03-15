# Story 4.6: Group Involvement Cards

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want group involvement cards to pull random people into the performance,
so that the whole group gets spontaneously involved beyond just watching.

## Acceptance Criteria

1. **Given** a group involvement card is dealt (Tag Team, Backup Dancers, Hype Squad, Crowd Conductor, or Name That Tune) **When** the card is accepted by the singer **Then** random participants are selected based on the card's requirements **And** the selection is announced on all phones with a card-specific announcement message (FR60) **And** selected participants' phones pulse with a 3-second accent glow effect **And** the group card activation is logged to the event stream
2. **Given** a group involvement card is accepted **When** participants are selected **Then** no consent flow is required — social dynamics handle opt-outs (FR60) **And** the singer (current performer) is always excluded from selection **And** the host is eligible for selection (they're a participant too)
3. **Given** fewer than 3 participants are in the party **When** the DJ engine deals party cards **Then** group involvement cards that require 3+ participants are disabled (NFR12) — already implemented in `getEligibleCards()` via `minParticipants: 3`
4. **Given** a Tag Team card is accepted **When** participants are selected **Then** exactly 1 random participant is chosen as the tag-team partner **And** the announcement reads: "TAG TEAM: {name} takes over at the chorus!" **And** during song state, the tagged participant's phone shows a "YOUR TURN!" flash at chorus moments
5. **Given** a Backup Dancers card is accepted **When** participants are selected **Then** exactly 2 random participants are chosen as backup dancers **And** the announcement reads: "BACKUP DANCERS: {name1} and {name2} — get behind the singer!"
6. **Given** a Hype Squad card is accepted **When** participants are selected **Then** exactly 2 random participants are chosen as the hype squad **And** the announcement reads: "HYPE SQUAD: {name1} and {name2} — hype up {singerName} the entire song!"
7. **Given** a Crowd Conductor card is accepted **When** participants are selected **Then** no random selection needed — the singer IS the conductor **And** the announcement reads: "CROWD CONDUCTOR: {singerName} controls when you clap, wave, or cheer!" **And** all audience participants see the announcement
8. **Given** a Name That Tune card is accepted **When** participants are selected **Then** no random selection needed — the entire audience participates as guessers **And** the announcement reads: "NAME THAT TUNE: {singerName} hums the intro — everyone guess the song!"
9. **Given** a group card activation occurs **When** the metadata is persisted **Then** `metadata.groupCardSelection` stores `{ selectedUserIds: string[], selectedDisplayNames: string[], cardId: string, announcement: string }` **And** this metadata persists into song state (same as `cardAccepted`/`acceptedCardId` pattern from Story 4.5)

## Tasks / Subtasks

- [x]Task 1: Define group card selection rules and add server-side selection logic (AC: #1, #2, #4-8)
  - [x]1.1 Create `apps/server/src/services/group-card-selector.ts`:
    - Define a `GroupCardSelection` interface: `{ selectedUserIds: string[], selectedDisplayNames: string[], announcement: string }`
    - Define card-specific selection rules as a lookup map keyed by card ID:
      - `tag-team`: select 1 participant (exclude singer)
      - `backup-dancers`: select 2 participants (exclude singer)
      - `hype-squad`: select 2 participants (exclude singer)
      - `crowd-conductor`: select 0 (singer is conductor, announcement only)
      - `name-that-tune`: select 0 (entire audience, announcement only)
    - Export `selectGroupParticipants(cardId: string, singerId: string, connections: TrackedConnection[]): GroupCardSelection`
    - Random selection: shuffle eligible participants (exclude singer by userId), take first N
    - Generate announcement string using display names and singer name from connections
    - If not enough eligible participants for the required count (edge case after disconnections), select as many as available and adjust announcement
  - [x]1.2 Import `TrackedConnection` type from `connection-tracker.ts` (type-only import)

- [x]Task 2: Add `card:groupActivated` event constant and event stream type (AC: #1, #9)
  - [x]2.1 In `apps/server/src/shared/events.ts`, add:
    - `CARD_GROUP_ACTIVATED: 'card:groupActivated'` (after CARD_REDRAW line 41)
  - [x]2.2 In `apps/server/src/services/event-stream.ts`, extend `SessionEvent` union:
    - Add `| { type: 'card:groupActivated'; ts: number; userId: string; data: { cardId: string; selectedUserIds: string[]; announcement: string } }`

- [x]Task 3: Integrate group card activation into the `card:accepted` handler (AC: #1, #2, #9)
  - [x]3.1 In `apps/server/src/socket-handlers/card-handlers.ts`, inside the `card:accepted` handler:
    - After line 49 (`setSessionDjState`) and before line 53 (broadcast), add a check:
    - `if (currentCard.type === 'group')`:
      - Import `getActiveConnections` from `connection-tracker.ts`
      - Import `selectGroupParticipants` from `group-card-selector.ts`
      - Call `getActiveConnections(sessionId)` to get all connected participants
      - Call `selectGroupParticipants(currentCard.id, userId, connections)` to get selection
      - Store selection in metadata: update `updatedContext.metadata.groupCardSelection = selection`
      - **CRITICAL: Re-save DJ state after adding group selection** — the first `setSessionDjState` + `persistDjState` at lines 49-50 happened BEFORE group selection was added. You MUST call both again:
        ```typescript
        setSessionDjState(sessionId, updatedContext); // re-save with groupCardSelection
        void persistDjState(sessionId, serializeDJContext(updatedContext)); // re-persist
        ```
      - Emit `EVENTS.CARD_GROUP_ACTIVATED` to session room via `io.to(sessionId).emit()` with: `{ cardId, cardType: 'group', announcement: selection.announcement, selectedUserIds: selection.selectedUserIds, selectedDisplayNames: selection.selectedDisplayNames, singerName: displayName }`
      - Append to event stream: `{ type: 'card:groupActivated', ts: Date.now(), userId, data: { cardId: currentCard.id, selectedUserIds: selection.selectedUserIds, announcement: selection.announcement } }`
    - The existing `CARD_ACCEPTED` broadcast (line 53) still fires for ALL card types (audience sees the challenge title)
    - The `CARD_GROUP_ACTIVATED` is an ADDITIONAL event for group cards only

- [x]Task 4: Add Flutter socket listener for `card:groupActivated` (AC: #1, #4-8)
  - [x]4.1 In `apps/flutter_app/lib/socket/client.dart`:
    - Add listener for `'card:groupActivated'` event in the session listener setup
    - Parse payload: `{ cardId, cardType, announcement, selectedUserIds, selectedDisplayNames, singerName }`
    - Call `partyProvider.onGroupCardActivated(announcement, selectedUserIds, selectedDisplayNames)` to update UI state

- [x]Task 5: Update PartyProvider with group card activation state (AC: #1, #4-8)
  - [x]5.1 In `apps/flutter_app/lib/state/party_provider.dart`:
    - Add fields: `String? _groupCardAnnouncement`, `List<String> _groupCardSelectedUserIds = []`, `List<String> _groupCardSelectedDisplayNames = []`, `bool _isSelectedForGroupCard = false`
    - Add `onGroupCardActivated(String announcement, List<String> selectedUserIds, List<String> selectedDisplayNames)`:
      - Set `_groupCardAnnouncement = announcement`
      - Set `_groupCardSelectedUserIds = selectedUserIds`
      - Set `_groupCardSelectedDisplayNames = selectedDisplayNames`
      - Set `_isSelectedForGroupCard = selectedUserIds.contains(_localUserId)`
      - `notifyListeners()`
    - Add `clearGroupCardAnnouncement()`: sets `_groupCardAnnouncement = null`, calls `notifyListeners()`. Called by the overlay's 3-second auto-dismiss timer callback to clear the announcement after display.
    - Add getters: `groupCardAnnouncement`, `groupCardSelectedDisplayNames`, `isSelectedForGroupCard`
    - **CRITICAL RESET TIMING — do NOT reset group card fields when LEAVING partyCardDeal.** The announcement overlay must persist across the `partyCardDeal → song` transition (it displays for 3 seconds, but the state changes in ~100ms). Instead:
      - `_groupCardAnnouncement`: cleared by overlay's 3-second auto-dismiss timer via `clearGroupCardAnnouncement()` callback
      - `_groupCardSelectedUserIds`, `_groupCardSelectedDisplayNames`, `_isSelectedForGroupCard`: reset when ENTERING the next `partyCardDeal` round (same block as `_redrawUsed` reset at lines 295-299)
      - This differs from `_acceptedCardTitle` which resets on leaving partyCardDeal — that's fine because `_acceptedCardTitle` only displays within the card deal overlay, but group announcement is a SEPARATE overlay that spans state transitions

- [x]Task 6: Add group card activation UI in Flutter (AC: #1, #4-8)
  - [x]6.1 Create `apps/flutter_app/lib/widgets/group_card_announcement_overlay.dart`:
    - A full-width overlay that displays the group card announcement text
    - Shows for 3 seconds after `card:groupActivated` is received, then auto-fades
    - Uses `DJTokens` for spacing/text styling. For gold accent color, use `PartyCardType.group.borderColor` (`0xFFFFB300`) — there is NO gold token in DJTokens
    - Announcement text centered, bold, large font
    - Below announcement: list of selected participant names in accent color
    - If `isSelectedForGroupCard == true`: pulse the entire screen with accent glow for 3 seconds (use `AnimationController` with `ColorTween` on background, similar to streak milestone effect from Story 4.2)
  - [x]6.2 Integrate into `apps/flutter_app/lib/screens/party_screen.dart`:
    - Show `GroupCardAnnouncementOverlay` as a `Stack` overlay when `partyProvider.groupCardAnnouncement != null`
    - The overlay sits on top of the existing card accepted broadcast display
    - It appears AFTER the card accepted broadcast (sequence: card accepted broadcast → group activation announcement)
  - [x]6.3 Add copy strings to `apps/flutter_app/lib/constants/copy.dart`:
    - `groupCardAnnouncementPrefix: 'GROUP CHALLENGE'`
    - `groupCardYourTurn: 'YOUR TURN!'`
    - `groupCardYouWereSelected: "You've been selected!"`

- [x]Task 7: Implement Tag Team "YOUR TURN!" flash during song state (AC: #4)
  - [x]7.1 In `apps/flutter_app/lib/state/party_provider.dart`:
    - Add `bool _isTagTeamPartner = false` — set true when Tag Team card activates and local user is selected
    - Add `bool _showTagTeamFlash = false` — toggled during song state to show "YOUR TURN!" flash
    - Expose getters: `isTagTeamPartner`, `showTagTeamFlash`
    - In `onGroupCardActivated`, check if card is tag-team AND local user is selected → set `_isTagTeamPartner = true`
    - Reset `_isTagTeamPartner` and `_showTagTeamFlash` when leaving song state
  - [x]7.2 For MVP: The "YOUR TURN!" flash is triggered by a simple timer during song state.
    - Implement as a dedicated `TagTeamFlashWidget` (stateful) rendered in `party_screen.dart` when `partyProvider.isTagTeamPartner == true && partyProvider.djState == DJState.song`
    - Widget starts timers in `initState`: fires at 30s, 60s, 90s (approximate chorus moments — no actual chorus detection in MVP)
    - Each fire: calls `partyProvider.setShowTagTeamFlash(true)`, then after 3s calls `setShowTagTeamFlash(false)`
    - Display a full-screen "YOUR TURN!" flash with pulse animation when `showTagTeamFlash == true`
    - Use `DJTokens.actionPrimary` color for the flash
    - **Timer lifecycle:** All pending timers MUST be cancelled in `dispose()`. The widget is removed from tree when DJ state leaves `song` (conditional rendering handles this). If song is shorter than 30s, no flash fires — acceptable
  - [x]7.3 Add to `copy.dart`: `tagTeamYourTurn: 'YOUR TURN!'`

- [x]Task 8: Write server tests (AC: #1-9)
  - [x]8.1 Create `apps/server/tests/services/group-card-selector.test.ts`:
    - Test `selectGroupParticipants` for each card type:
      - `tag-team`: returns 1 selected participant, singer excluded
      - `backup-dancers`: returns 2 selected participants, singer excluded
      - `hype-squad`: returns 2 selected participants, singer excluded
      - `crowd-conductor`: returns 0 selected, announcement references singer as conductor
      - `name-that-tune`: returns 0 selected, announcement references entire audience
    - Test singer exclusion: singer's userId never in selectedUserIds
    - Test edge case: not enough participants after exclusion (e.g., only 2 connected and 1 is singer — backup-dancers gets 1 instead of 2)
    - Test announcement format: verify correct display names appear in announcement string
    - Test randomness: verify different selections across multiple calls (statistical, not deterministic)
  - [x]8.2 In `apps/server/tests/socket-handlers/card-handlers.test.ts`:
    - Test `card:accepted` for a group card type:
      - Verify `CARD_GROUP_ACTIVATED` event is emitted to session room
      - Verify payload contains `selectedUserIds`, `selectedDisplayNames`, `announcement`, `singerName`
      - Verify `groupCardSelection` metadata is persisted in DJ context
      - Verify event stream has `card:groupActivated` entry
    - Test `card:accepted` for a non-group card: verify NO `CARD_GROUP_ACTIVATED` event emitted
    - Test group activation with minimal participants (exactly 3 — 1 singer + 2 eligible)
  - [x]8.3 Use existing test factories from `tests/factories/` — create mock connections with `TrackedConnection` shape

- [x]Task 9: Write Flutter tests (AC: #1, #4-8)
  - [x]9.1 Create `apps/flutter_app/test/widgets/group_card_announcement_overlay_test.dart`:
    - Test overlay displays announcement text
    - Test selected participant names displayed
    - Test overlay auto-fades after 3 seconds
    - Test accent glow pulse when local user is selected
    - Test no glow pulse when local user is NOT selected
  - [x]9.2 In `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `onGroupCardActivated` sets all fields correctly
    - Test `isSelectedForGroupCard` is true when local userId is in selectedUserIds
    - Test `isSelectedForGroupCard` is false when not in selectedUserIds
    - Test group card announcement cleared via `clearGroupCardAnnouncement()` (NOT by state transition)
    - Test group card selection fields (`selectedUserIds`, `isSelectedForGroupCard`) reset when ENTERING next partyCardDeal (NOT when leaving current one)
    - Test group card fields persist across `partyCardDeal → song` transition
    - Test `isTagTeamPartner` set correctly for tag-team card
  - [x]9.3 Tag Team flash tests:
    - Test "YOUR TURN!" flash displays when `showTagTeamFlash == true`
    - Test flash disappears after 3 seconds
    - DO NOT test: exact animation values, glow colors, timing precision

## Dev Notes

### Architecture Compliance

- **Server-authoritative:** All participant selection happens server-side. Flutter just receives the selection and renders it. No selection logic in Dart.
- **Socket handler pattern:** Group activation hooks into the existing `card:accepted` handler — NOT a separate handler. It's an additional step after acceptance for group-type cards only.
- **DJ context metadata:** Store group selection in `context.metadata.groupCardSelection` — same JSONB pattern used for `cardAccepted`, `acceptedCardId`, `currentCard`.
- **Event constants:** Add `CARD_GROUP_ACTIVATED` to `shared/events.ts`. Use `card:groupActivated` following `namespace:action` convention.
- **Boundary enforcement:** `group-card-selector.ts` goes in `services/` — it's pure logic (takes connections array, returns selection). ZERO Socket.io dependency. Connection data is passed in, not fetched inside.
- **Provider pattern:** `PartyProvider` is a read-only reactive container. `SocketClient` calls mutation methods on the provider. No provider-to-provider access.

### Existing Code to Reuse (DO NOT Recreate)

| What | File (under `apps/server/src/` or `apps/flutter_app/lib/`) | Key exports / line refs |
|------|------|------------|
| Card pool + types | `services/party-card-pool.ts` | `PartyCard`, `CardType`, `getEligibleCards()` — group cards already have `minParticipants: 3` |
| Card dealer | `services/card-dealer.ts` | `dealCard()`, `redealCard()` — already filters by participant count |
| Card accepted handler | `socket-handlers/card-handlers.ts:19-70` | Hook point: after line 49 (`setSessionDjState`), before line 53 (broadcast) |
| Connection tracker | `services/connection-tracker.ts:78-82` | `getActiveConnections(sessionId)` returns `TrackedConnection[]` with `userId`, `displayName`, `isHost` |
| Event stream | `services/event-stream.ts` | `appendEvent()` — extend `SessionEvent` union with `card:groupActivated` |
| Event constants | `shared/events.ts:38-41` | Add `CARD_GROUP_ACTIVATED` after existing card events |
| DJ state store | `services/dj-state-store.ts` | `getSessionDjState()`, `setSessionDjState()` — for metadata updates |
| DJ state persistence | `services/session-manager.ts` | `persistDjState(sessionId, serialized)`, `processDjTransition(sessionId, context, transition, userId?)` |
| Party provider | `state/party_provider.dart` | `_localUserId` (line ~108), `_currentPerformer` (line ~275), `onDjStateChanged` reset location |
| Socket client | `socket/client.dart:409-418` | `emitCardAccepted()`, `emitCardDismissed()` pattern for listener setup |
| Copy strings | `constants/copy.dart` | Existing card copy at lines 156-161 — add group card strings |
| Flutter card data | `constants/party_cards.dart` | `PartyCardType.group` with gold border color `0xFFFFB300` |
| Streak milestone effect | `widgets/reaction_streak_overlay.dart` | Pulse animation pattern — reuse for selected-participant glow |

### Group Card Selection Rules (CRITICAL)

| Card ID | # Selected | Who | Announcement Template |
|---------|-----------|-----|----------------------|
| `tag-team` | 1 | Random non-singer | "TAG TEAM: {name} takes over at the chorus!" |
| `backup-dancers` | 2 | Random non-singers | "BACKUP DANCERS: {name1} and {name2} — get behind the singer!" |
| `hype-squad` | 2 | Random non-singers | "HYPE SQUAD: {name1} and {name2} — hype up {singerName} the entire song!" |
| `crowd-conductor` | 0 | Singer is conductor | "CROWD CONDUCTOR: {singerName} controls when you clap, wave, or cheer!" |
| `name-that-tune` | 0 | Entire audience | "NAME THAT TUNE: {singerName} hums the intro — everyone guess the song!" |

### New File: `group-card-selector.ts`

This is the ONLY new server file. Pure function — takes card ID, singer ID, and connections array. Returns selection with display names and announcement string. No side effects, no imports from persistence/db/socket.

### Tag Team "YOUR TURN!" — MVP Simplification

Full chorus detection requires song metadata (timestamps for verse/chorus sections) which doesn't exist yet (Song Integration is Epic 5). For MVP, use simple timed flashes at ~30s, 60s, 90s into the song. This is a visual cue, not an enforced handoff — social dynamics handle the actual turn-taking. The timer approach can be refined in Epic 5 when song metadata becomes available.

### Timer Architecture (Unchanged from 4.5)

- Server-side: 15s TIMEOUT on `partyCardDeal` state remains as hard ceiling
- Client-side: 8s soft auto-dismiss timer remains from Story 4.5
- Group card activation happens BETWEEN card acceptance and `CARD_DONE` transition — adds ~0ms overhead (just metadata + broadcast)

### Event Sequence for Group Cards

1. Singer taps Accept → `card:accepted` emitted to server
2. Server validates, records scoring, updates metadata
3. Server detects `currentCard.type === 'group'` → runs `selectGroupParticipants()`
4. Server stores `groupCardSelection` in metadata, persists to DB
5. Server broadcasts `EVENTS.CARD_ACCEPTED` (all cards) — audience sees card title
6. Server broadcasts `EVENTS.CARD_GROUP_ACTIVATED` (group cards only) — all see participant selection
7. Server appends `card:groupActivated` to event stream
8. Server triggers `CARD_DONE` transition → advances to song state
9. Flutter receives both events → shows accepted card briefly, THEN shows group announcement overlay (3s)
10. If Tag Team: selected participant's phone starts showing "YOUR TURN!" flashes at timed intervals

### Project Structure Notes

- **1 new server file:** `apps/server/src/services/group-card-selector.ts` (pure selection logic)
- **1 new Flutter widget:** `apps/flutter_app/lib/widgets/group_card_announcement_overlay.dart` (announcement overlay)
- **1 new server test file:** `apps/server/tests/services/group-card-selector.test.ts`
- **1 new Flutter test file:** `apps/flutter_app/test/widgets/group_card_announcement_overlay_test.dart`
- All other changes are modifications to existing files — no new patterns introduced

### References

- [Source: _bmad-output/project-context.md] — all architecture rules, boundaries, and anti-patterns
- [Source: _bmad-output/planning-artifacts/prd.md#FR58-FR62] — group card requirements, scoring, acceptance tracking
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Party-Card-Deal-Flow] — group card UX flow, announcement formats, 3s glow pulse
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4-Story-4.6] — acceptance criteria and story definition

### Previous Story (4.5) Intelligence

- Story 4.5 established the card:accepted / card:dismissed handler pattern — group activation hooks directly into the accepted flow
- `currentPerformer` is now properly set in `orchestrateCardDeal()` via round-robin — can be used to identify singer for exclusion
- Metadata pattern (`cardAccepted`, `acceptedCardId`, `redrawUsed`) established — follow same pattern for `groupCardSelection`
- `isCurrentSinger` getter in PartyProvider works correctly — reuse for group card UI differentiation
- 657 server tests pass, 101 Flutter tests pass — regression baseline

### Git Intelligence (Recent Patterns from 4.5 Commit)

- 14 files changed in Story 4.5 — this story touches ~10-12 files (similar scope)
- Card handler tests follow: describe blocks per handler, mock socket/session objects from factories
- Flutter widget tests use `WidgetTester`, mock providers with `ChangeNotifierProvider.value`
- Event stream extension pattern established: add type to `SessionEvent` union, call `appendEvent()` with matching shape
- All commits squashed with code review fixes — expect same pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None

### Completion Notes List

- Implemented `group-card-selector.ts` — pure selection logic service with card-specific rules for all 5 group cards (tag-team, backup-dancers, hype-squad, crowd-conductor, name-that-tune)
- Added `CARD_GROUP_ACTIVATED` event constant and `card:groupActivated` event stream type
- Integrated group card activation into `card:accepted` handler — detects group card type, selects participants, persists metadata, broadcasts activation event, logs to event stream
- Added Flutter socket listener for `card:groupActivated` — parses payload and calls provider method
- Updated `PartyProvider` with group card state fields, tag team partner tracking, and proper reset timing (selection fields reset on entering next partyCardDeal, announcement cleared by 3s timer, tag team resets on leaving song state)
- Created `GroupCardAnnouncementOverlay` widget — displays announcement text, selected participant names, accent glow pulse for selected users, auto-dismisses after 3 seconds
- Created `TagTeamFlashWidget` — fires "YOUR TURN!" flashes at 30s/60s/90s during song state for MVP (no chorus detection)
- Added copy strings for group card and tag team UI
- Integrated both overlays into `PartyScreen` Stack
- 15 server unit tests for group-card-selector (all card types, singer exclusion, edge cases, randomness)
- 5 server integration tests for card-handlers group card flow
- 5 Flutter widget tests for GroupCardAnnouncementOverlay
- 11 Flutter provider tests for group card state management
- All 677 server tests pass. 444/445 Flutter tests pass (1 pre-existing failure in party_screen_test.dart unrelated to this story)

### Change Log

- 2026-03-15: Implemented Story 4.6 — Group Involvement Cards (all 9 tasks complete)
- 2026-03-15: Code review — 7 issues found (2 HIGH, 3 MEDIUM, 2 LOW), all fixed:
  - H1: Fixed announcement templates producing "undefined" on edge cases (backup-dancers/hype-squad/tag-team with fewer participants)
  - H2: Added missing `cardId` field to `GroupCardSelection` interface (AC #9 compliance)
  - M1: Changed Tag Team flash color from `vibe.accent` to `DJTokens.actionPrimary` per story spec
  - M2: Added edge case announcement assertions to group-card-selector tests
  - M3: Added fade-out animation to GroupCardAnnouncementOverlay (was abrupt removal)
  - L1: Removed duplicate `groupCardYourTurn` copy string (dead code)
  - L2: Removed unnecessary type cast in card-handlers.ts

### File List

**New files:**
- `apps/server/src/services/group-card-selector.ts`
- `apps/server/tests/services/group-card-selector.test.ts`
- `apps/flutter_app/lib/widgets/group_card_announcement_overlay.dart`
- `apps/flutter_app/lib/widgets/tag_team_flash_widget.dart`
- `apps/flutter_app/test/widgets/group_card_announcement_overlay_test.dart`

**Modified files:**
- `apps/server/src/shared/events.ts` — added `CARD_GROUP_ACTIVATED` constant
- `apps/server/src/services/event-stream.ts` — added `card:groupActivated` to SessionEvent union
- `apps/server/src/socket-handlers/card-handlers.ts` — integrated group card activation into card:accepted handler
- `apps/server/tests/socket-handlers/card-handlers.test.ts` — added group card integration tests
- `apps/flutter_app/lib/socket/client.dart` — added `card:groupActivated` listener
- `apps/flutter_app/lib/state/party_provider.dart` — added group card state fields, tag team tracking, reset logic
- `apps/flutter_app/lib/screens/party_screen.dart` — integrated GroupCardAnnouncementOverlay and TagTeamFlashWidget
- `apps/flutter_app/lib/constants/copy.dart` — added group card and tag team copy strings
- `apps/flutter_app/test/state/party_provider_test.dart` — added group card state tests

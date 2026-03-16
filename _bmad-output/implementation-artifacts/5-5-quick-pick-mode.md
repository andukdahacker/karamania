# Story 5.5: Quick Pick Mode

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want to vote on song suggestions together with a quick card-based selection,
So that we democratically pick songs everyone wants to hear.

## Acceptance Criteria

1. **Given** the song selection phase begins, **When** Quick Pick mode is active (default mode), **Then** 5 AI-suggested songs are displayed as cards showing song title, artist, thumbnail, and group overlap badge (e.g., "4/5 know this") (FR88)
2. **Given** all participants can see the song cards, **When** a participant votes, **Then** they can vote thumbs up or skip on each card (FR88)
3. **Given** votes are being collected, **When** a song reaches majority approval (>50% of active participants), **Then** that song is immediately selected (FR88)
4. **Given** the 15-second voting window elapses, **When** no song has reached majority, **Then** the highest-voted song wins (FR88)
5. **Given** the democratic voting mechanism is built, **When** votes are received concurrently from all participants, **Then** votes are handled without race conditions or vote loss (NFR11)
6. **Given** this voting mechanism (FR27), **When** designed, **Then** it is reusable by Epic 7 for activity selection

## Tasks / Subtasks

- [x] Task 1: Create Quick Pick vote tracker service (AC: #2, #3, #4, #5, #6)
  - [x] 1.1 Create `apps/server/src/services/quick-pick.ts`
  - [x] 1.2 Define `VoteTally` type: `{ up: number; skip: number }` -- reusable vote count structure
  - [x] 1.3 Define `QuickPickRound` type: `{ sessionId: string; songs: QuickPickSong[]; votes: Map<string, Map<string, 'up' | 'skip'>>; participantCount: number; startedAt: number; resolved: boolean; winningSongId: string | null }` where outer map key is songCatalogTrackId, inner map key is userId. Tracks all votes per song per user. `participantCount` stored for majority calculation
  - [x] 1.4 Define `QuickPickSong` type: `{ catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string; overlapCount: number }` -- subset of SuggestedSong from suggestion-engine
  - [x] 1.5 Implement module-level `Map<string, QuickPickRound>` (sessionId -> round). Same in-memory pattern as `dj-state-store.ts`, `song-pool.ts`, `connection-tracker.ts`
  - [x] 1.6 Implement `startRound(sessionId: string, songs: QuickPickSong[], participantCount: number): QuickPickRound` -- creates a new round, initializes empty vote maps for each song, stores in module map, returns the round. `participantCount` is stored for majority calculation
  - [x] 1.7 Implement `recordVote(sessionId: string, userId: string, catalogTrackId: string, vote: 'up' | 'skip'): { recorded: boolean; songVotes: VoteTally; winner: QuickPickSong | null }` -- records vote (idempotent per user per song, last vote wins if user changes mind). Returns current tally for the voted song and whether a winner was determined. **CRITICAL for NFR11**: This is a synchronous function operating on a single-threaded Map -- Node.js event loop guarantees no race conditions on concurrent calls since each `socket.on` callback runs to completion before the next
  - [x] 1.8 Implement `checkMajority(round: QuickPickRound): QuickPickSong | null` -- called after every vote. For each song, count 'up' votes. If any song has > floor(participantCount / 2) up-votes, return that song as winner. If multiple songs hit majority simultaneously, pick the one with more up-votes (tiebreaker: first in array order)
  - [x] 1.9 Implement `resolveByTimeout(sessionId: string): QuickPickSong | null` -- called when 15s timer fires. Find song with most 'up' votes. Tiebreaker: higher overlapCount, then first in array. Mark round as resolved. Return winner (or first song if zero votes)
  - [x] 1.10 Implement `getRound(sessionId: string): QuickPickRound | undefined`
  - [x] 1.11 Implement `clearRound(sessionId: string): void` -- removes session from map. Called after song is selected or session ends
  - [x] 1.12 Export `resetAllRounds()` for test cleanup
  - [x] 1.13 **Reusability for FR27/Epic 7**: Design the vote tracker with generic concepts (items to vote on, up/skip per item, majority threshold, timeout fallback). The `QuickPickSong` type is specific but the voting logic in `recordVote`/`checkMajority`/`resolveByTimeout` can be extracted to a generic voting utility in a future story if needed. For now, keep it in quick-pick.ts but structure the code so the core voting algorithm is a separable pure function

- [x] Task 2: Create Quick Pick socket handler (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Create `apps/server/src/socket-handlers/song-handlers.ts`
  - [x] 2.2 Export `registerSongHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void` following the exact pattern from `card-handlers.ts` and `reaction-handlers.ts`. The `io` parameter is required for broadcasting via `io.to(sessionId).emit()`
  - [x] 2.3 Register in `apps/server/src/socket-handlers/connection-handler.ts` inside `setupSocketHandlers()`, after existing handler registrations: `registerSongHandlers(s, io)`. **NOT in index.ts** -- all handler registration goes through `connection-handler.ts`
  - [x] 2.4 Handle `EVENTS.SONG_QUICKPICK` incoming event with payload `{ catalogTrackId: string; vote: 'up' | 'skip' }`:
    - Guard: `getSessionDjState(sessionId)` must exist and `context.state === DJState.songSelection`
    - Guard: round must exist via `getRound(sessionId)` -- if not, return silently
    - Guard: `catalogTrackId` must be one of the songs in the round
    - Call `recordVote(sessionId, userId, catalogTrackId, vote)`
    - Broadcast vote update to all participants: `io.to(sessionId).emit(EVENTS.SONG_QUICKPICK, { catalogTrackId, userId, displayName: socket.data.displayName, vote, songVotes: voteTally })`
    - If `winner` is returned from recordVote: call `onSongSelected(sessionId, winner)` (see Task 2.6)
    - Record participation: `recordParticipationAction(sessionId, userId, 'quickpick:vote', 1).catch(() => {})`
    - Append event: `appendEvent(sessionId, { type: 'quickpick:vote', ts: Date.now(), userId, data: { catalogTrackId, vote } })`
  - [x] 2.5 **Quick Pick round initialization**: When DJ state transitions TO `songSelection`, the session-manager needs to set up the Quick Pick round. Add a hook in `session-manager.ts` `processDjTransition()` -- when `newContext.state === DJState.songSelection`:
    - Call `computeSuggestions(sessionId, 5)` to get 5 ranked songs
    - Call `startRound(sessionId, songs, activeParticipantCount)`
    - Store suggestions in `newContext.metadata.quickPickSongs` for state broadcast
    - **TIMER INTEGRATION (CRITICAL)**: Do NOT schedule a separate timer. The DJ engine's `processTransition()` in `machine.ts` automatically generates a `scheduleTimer` side effect for any state with `hasTimeout: true` (songSelection has this). The side effect handler in `processDjTransition()` calls `scheduleSessionTimer()` with `handleRecoveryTimeout()` as callback. Modify `handleRecoveryTimeout()` to detect Quick Pick: when `context.state === DJState.songSelection`, check for an active round via `getRound(sessionId)` and call `resolveByTimeout()` + `onSongSelected()` instead of triggering a raw `TIMEOUT` transition. Ensure the `TimerConfig` duration for `songSelection` is set to `15000` (15s)
    - **BROADCAST (CRITICAL)**: Do NOT rely on `dj:stateChanged` metadata -- `buildDjStatePayload()` strips all metadata except `ceremonyType`. Instead, add a dedicated `broadcastQuickPickStarted(sessionId: string, songs: QuickPickSong[], participantCount: number)` function to `dj-broadcaster.ts` that emits a new event. Follow the existing pattern: `broadcastCardDealt()` for cards, `broadcastCeremonyAnticipation()` for ceremonies. Emit as a dedicated event (e.g., `quickpick:started`) with `{ songs, participantCount, timerDurationMs: 15000 }` payload. Add `QUICKPICK_STARTED: 'quickpick:started'` to `events.ts`
  - [x] 2.6 Implement `onSongSelected(sessionId: string, song: QuickPickSong): void` -- called from two paths: (a) majority vote in socket handler, (b) timeout in modified `handleRecoveryTimeout`:
    - Mark song as sung: `markSongSung(sessionId, song.songTitle, song.artist)`
    - Clear the round: `clearRound(sessionId)`
    - Cancel the DJ engine's timer if majority was reached early: `cancelSessionTimer(sessionId)` -- prevents `handleRecoveryTimeout` from firing after song is already selected
    - Store selected song in DJ context metadata: `context.metadata.selectedSong = { catalogTrackId, songTitle, artist, youtubeVideoId }`
    - Trigger DJ transition: `processDjTransition(sessionId, context, { type: 'SONG_SELECTED' })`
    - Broadcast song selected event: `io.to(sessionId).emit(EVENTS.SONG_QUEUED, { catalogTrackId, songTitle, artist, youtubeVideoId })`
    - Append event: `appendEvent(sessionId, { type: 'quickpick:selected', ts: Date.now(), data: { song } })`
  - [x] 2.7 **No separate `handleQuickPickTimeout` function needed** -- Quick Pick timeout is handled by the modified `handleRecoveryTimeout()` in session-manager.ts (Task 5.4). When the DJ engine's timer fires for songSelection state, `handleRecoveryTimeout` checks for an active Quick Pick round and resolves it via `resolveByTimeout()` → `onSongSelected()`

- [x] Task 3: Create Quick Pick Zod schemas (AC: #1)
  - [x] 3.1 Create `apps/server/src/shared/schemas/quick-pick-schemas.ts`
  - [x] 3.2 Define `quickPickSongSchema`: `z.object({ catalogTrackId: z.string(), songTitle: z.string(), artist: z.string(), youtubeVideoId: z.string(), overlapCount: z.number() })`
  - [x] 3.3 Define `quickPickVoteSchema`: `z.object({ catalogTrackId: z.string(), vote: z.enum(['up', 'skip']) })`
  - [x] 3.4 Define `quickPickVoteBroadcastSchema`: `z.object({ catalogTrackId: z.string(), userId: z.string(), displayName: z.string(), vote: z.enum(['up', 'skip']), songVotes: z.object({ up: z.number(), skip: z.number() }) })`
  - [x] 3.5 **No `z.globalRegistry.add()` needed** -- Quick Pick is entirely Socket.io-based with no REST endpoints. `globalRegistry` is for OpenAPI/Swagger generation (REST routes only). The schemas are used for internal type inference via `z.infer<>` only. **No `index.ts` import ordering needed** either

- [x] Task 4: Update DJ engine and events for song selection (AC: #1, #3, #4)
  - [x] 4.1 In `apps/server/src/shared/events.ts`, add `QUICKPICK_STARTED: 'quickpick:started'` to the EVENTS object (for the dedicated broadcast)
  - [x] 4.2 In `apps/server/src/dj-engine/types.ts`, verify `DJMetadata` type is `Record<string, unknown>` (it is -- confirmed). The `metadata` field on `DJContext` already accepts arbitrary keys. No type changes needed. Store `quickPickSongs` and `selectedSong` as metadata entries for JSONB persistence (not for broadcasting -- see broadcaster pattern notes)
  - [x] 4.3 In `apps/server/src/services/dj-broadcaster.ts`, add `broadcastQuickPickStarted(sessionId: string, songs: QuickPickSong[], participantCount: number): void` that emits `EVENTS.QUICKPICK_STARTED` with `{ songs, participantCount, timerDurationMs: 15000 }`. **Do NOT modify `buildDjStatePayload`** -- it intentionally strips metadata (only `ceremonyType` is included for ceremony state). Follow the existing dedicated broadcast pattern: `broadcastCardDealt()`, `broadcastCeremonyAnticipation()`, `broadcastCeremonyReveal()`
  - [x] 4.4 Verify serialization/deserialization in `dj-engine/serialization.ts` handles the new metadata fields (JSONB storage). The `quickPickSongs` array and `selectedSong` object must survive `JSON.stringify` / `JSON.parse` round-trips (they're plain objects, so this should work automatically)

- [x] Task 5: Update session-manager for Quick Pick lifecycle (AC: #1, #3, #4)
  - [x] 5.1 In `apps/server/src/services/session-manager.ts`, import `startRound`, `clearRound` from `../services/quick-pick.js`, `computeSuggestions` from `../services/suggestion-engine.js`, `markSongSung` from `../services/song-pool.js`
  - [x] 5.2 In `processDjTransition()`, after the DJ engine processes the transition and before broadcasting, add a check: if `newContext.state === DJState.songSelection`, call the Quick Pick initialization logic (Task 2.5 details). This is where suggestions are fetched and the round starts
  - [x] 5.3 In `endSession()`, add `clearRound(sessionId)` alongside existing cleanup calls (`clearPool`, etc.)
  - [x] 5.4 **Timer integration (CRITICAL -- read carefully)**: The DJ engine's `processTransition()` in `machine.ts` automatically generates a `scheduleTimer` side effect for ANY state with `hasTimeout: true`. Since `songSelection` has `hasTimeout: true`, the DJ engine WILL schedule a timer via `handleRecoveryTimeout()` when entering songSelection. Do NOT schedule a separate Quick Pick timer -- it would conflict. Instead:
    1. Verify/set the `TimerConfig` duration for `songSelection` to `15000` (15s). Find where `TimerConfig` values are defined in `dj-engine/` and ensure songSelection = 15000
    2. Modify `handleRecoveryTimeout()` in session-manager.ts to handle Quick Pick resolution when `context.state === DJState.songSelection`:
       ```typescript
       // BEFORE the generic TIMEOUT transition:
       if (context.state === DJState.songSelection) {
         const round = getRound(sessionId);
         if (round && !round.resolved) {
           const winner = resolveByTimeout(sessionId);
           if (winner) { await onSongSelected(sessionId, winner); return; }
         }
       }
       await processDjTransition(sessionId, context, { type: 'TIMEOUT' });
       ```
  - [x] 5.5 **Cancel timer on early majority**: When `onSongSelected()` is called due to majority vote (before timer fires), call `cancelSessionTimer(sessionId)` to prevent the now-unnecessary timeout from firing

- [x] Task 6: Create Flutter Quick Pick provider state (AC: #1, #2, #3, #4)
  - [x] 6.1 In `apps/flutter_app/lib/state/party_provider.dart`, add Quick Pick state fields:
    - `List<QuickPickSong> _quickPickSongs = []` -- the 5 suggested songs for current round
    - `Map<String, VoteTally> _quickPickVotes = {}` -- catalogTrackId -> {up: int, skip: int}
    - `String? _quickPickWinnerId` -- catalogTrackId of winner (null during voting)
    - `Map<String, String> _myQuickPickVotes = {}` -- catalogTrackId -> 'up'|'skip' (local user's votes)
  - [x] 6.2 Add public getters: `quickPickSongs`, `quickPickVotes`, `quickPickWinnerId`, `myQuickPickVotes`
  - [x] 6.3 Add mutation methods (called ONLY by SocketClient):
    - `onQuickPickStarted(List<QuickPickSong> songs)` -- sets `_quickPickSongs`, clears votes and winner, calls `notifyListeners()`
    - `onQuickPickVoteReceived(String catalogTrackId, String odinguserId, String vote, VoteTally tally)` -- updates `_quickPickVotes[catalogTrackId]` with new tally, calls `notifyListeners()`
    - `onQuickPickResolved(String winnerCatalogTrackId)` -- sets `_quickPickWinnerId`, calls `notifyListeners()`
    - `onQuickPickCleared()` -- resets all Quick Pick state, calls `notifyListeners()`
  - [x] 6.4 Define `QuickPickSong` data class and `VoteTally` data class. Check if `apps/flutter_app/lib/models/` directory exists. If it does, create `quick_pick_song.dart` and `vote_tally.dart` there. If not, define them in `party_provider.dart` (following existing pattern -- `PartyCardData` is defined inline in party_provider.dart). Both need `factory fromJson(Map<String, dynamic>)` constructors. `QuickPickSong`: `catalogTrackId`, `songTitle`, `artist`, `youtubeVideoId`, `overlapCount`. `VoteTally`: `up` (int), `skip` (int)

- [x] Task 7: Update Flutter SocketClient for Quick Pick events (AC: #1, #2, #3)
  - [x] 7.1 In `apps/flutter_app/lib/socket/client.dart`, add Quick Pick listeners in `_setupPartyListeners()`:
    - Listen for `quickpick:started` (dedicated broadcast event from `broadcastQuickPickStarted`) -- parse `{ songs, participantCount, timerDurationMs }` payload, map songs to `QuickPickSong.fromJson()`, call `partyProvider.onQuickPickStarted(songs, participantCount, timerDurationMs)`. **Do NOT rely on `dj:stateChanged` metadata** -- `buildDjStatePayload` strips metadata fields
    - Listen for `song:quickpick` -- parse vote broadcast payload, call `partyProvider.onQuickPickVoteReceived(catalogTrackId, userId, vote, tally)`
    - Listen for `song:queued` -- call `partyProvider.onQuickPickResolved(catalogTrackId)` followed by `partyProvider.onQuickPickCleared()` after a brief delay (let UI show winner state)
    - Also clear Quick Pick state when `dj:stateChanged` transitions AWAY from `songSelection` (safety net -- add to existing DJ state listener)
  - [x] 7.2 Add emit method: `emitQuickPickVote(String catalogTrackId, String vote)` -- emits `song:quickpick` event with `{ catalogTrackId, vote }` payload
  - [x] 7.3 Track local votes: when emitting, also call `partyProvider.updateMyVote(catalogTrackId, vote)` to update local `_myQuickPickVotes` map for immediate UI feedback (optimistic update)

- [x] Task 8: Create Flutter Quick Pick UI widget (AC: #1, #2, #3, #4)
  - [x] 8.1 Create `apps/flutter_app/lib/widgets/quick_pick_overlay.dart` -- StatefulWidget displayed when `partyProvider.djState == DJState.songSelection && partyProvider.quickPickSongs.isNotEmpty`
  - [x] 8.2 **Layout**: Full-screen overlay (same pattern as `PartyCardDealOverlay`). Title "Quick Pick" at top. 5 song cards arranged vertically in a scrollable list or horizontally in a PageView carousel
  - [x] 8.3 **Song card design**: Each card shows:
    - Song title (bold, `DJTokens.textLg`)
    - Artist name (subtitle, `DJTokens.textMd`)
    - YouTube thumbnail: `Image.network('https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg')` with error fallback
    - Overlap badge: `"${song.overlapCount}/${participantCount} know this"` pill badge with `DJTokens.actionPrimary` background when overlap > 0
    - Vote buttons: thumbs up (filled when voted up) and skip (filled when voted skip)
    - Vote count display: `"${votes.up} votes"` below the card
  - [x] 8.4 **Voting interaction**: Tapping thumbs up or skip calls `SocketClient.instance.emitQuickPickVote(catalogTrackId, 'up'|'skip')`. Disable the other button visually when one is selected (but allow changing vote). Use `_myQuickPickVotes` for immediate local state
  - [x] 8.5 **Winner reveal**: When `quickPickWinnerId` is set, highlight the winning card with a border glow (`DJTokens.actionPrimary`), show "Selected!" label, and auto-dismiss overlay after 2 seconds
  - [x] 8.6 **15-second countdown timer**: Display a countdown timer at the top using `TimerWidget` or a simple `TweenAnimationBuilder`. Timer starts from DJ state `songSelection` timestamp. When timer reaches 0, server handles resolution -- client just shows "Deciding..." until winner is broadcast
  - [x] 8.7 **All copy strings** in `apps/flutter_app/lib/constants/copy.dart` (per anti-patterns): add `quickPickTitle`, `quickPickVoteUp`, `quickPickSkip`, `quickPickSelected`, `quickPickDeciding`, `quickPickOverlapBadge`
  - [x] 8.8 Use `DJTokens` for all spacing, colors, and typography (per anti-patterns). No hardcoded colors or padding values

- [x] Task 9: Integrate Quick Pick overlay into PartyScreen (AC: #1)
  - [x] 9.1 In `apps/flutter_app/lib/screens/party_screen.dart`, import `QuickPickOverlay`
  - [x] 9.2 Add Quick Pick overlay display logic: when `provider.djState == 'songSelection'` and `provider.quickPickSongs.isNotEmpty`, show `QuickPickOverlay` in the Stack (same pattern as `PartyCardDealOverlay`, `LightstickMode`, etc.)
  - [x] 9.3 After winner is revealed and delay completes, the DJ state will transition to `partyCardDeal` or `song`, which automatically hides the overlay (widget reacts to provider state changes)

- [x] Task 10: Clean up Quick Pick on session end (AC: all)
  - [x] 10.1 Verify `clearRound(sessionId)` is called in `session-manager.ts` `endSession()` (Task 5.3)
  - [x] 10.2 Verify Flutter `partyProvider.onQuickPickCleared()` is called when session ends or DJ state leaves `songSelection`

- [x] Task 11: Write server tests (AC: all)
  - [x] 11.1 Create `apps/server/tests/services/quick-pick.test.ts`:
    - Test `startRound` creates valid round with empty vote maps
    - Test `recordVote` records vote correctly and returns tally
    - Test `recordVote` is idempotent (same user same song replaces vote)
    - Test `recordVote` allows changing vote from 'up' to 'skip' and vice versa
    - Test `checkMajority` returns null when no majority
    - Test `checkMajority` returns winner when >50% vote up (3 of 5 participants)
    - Test `checkMajority` returns winner when >50% vote up (2 of 3 participants)
    - Test `checkMajority` tiebreaker: most up-votes wins, then array order
    - Test `resolveByTimeout` picks highest-voted song
    - Test `resolveByTimeout` tiebreaker: higher overlapCount, then array order
    - Test `resolveByTimeout` with zero votes returns first song
    - Test `resolveByTimeout` marks round as resolved
    - Test `clearRound` removes session data
    - Test module isolation: different sessions don't interfere
    - Test `resetAllRounds` clears all data
  - [x] 11.2 Create `apps/server/tests/socket-handlers/song-handlers.test.ts`:
    - Test vote is recorded when DJ state is `songSelection`
    - Test vote is rejected (silent return) when DJ state is NOT `songSelection`
    - Test vote is rejected when round doesn't exist
    - Test vote is rejected when catalogTrackId is not in round
    - Test vote broadcast includes correct payload
    - Test majority win triggers `SONG_SELECTED` transition
    - Test participation action is recorded on vote
    - Test event is appended to event stream on vote
  - [x] 11.3 Add integration tests to `apps/server/tests/services/session-manager.test.ts` (or a new file):
    - Test Quick Pick round is initialized when DJ enters `songSelection`
    - Test suggestions are fetched with count=5
    - Test 15s timer is scheduled
    - Test timer resolution triggers song selection
    - Test `clearRound` is called in `endSession()`

- [x] Task 12: Write Flutter tests (AC: #1, #2)
  - [x] 12.1 Create `apps/flutter_app/test/models/quick_pick_song_test.dart` -- test `fromJson` factory
  - [x] 12.2 Create `apps/flutter_app/test/models/vote_tally_test.dart` -- test `fromJson` factory
  - [x] 12.3 Create `apps/flutter_app/test/widgets/quick_pick_overlay_test.dart`:
    - Test 5 song cards are rendered
    - Test song title and artist are displayed
    - Test overlap badge shows correct count
    - Test tapping thumbs up calls socket emit
    - Test tapping skip calls socket emit
    - Test winner card is highlighted
    - Test countdown timer is displayed
  - [x] 12.4 Add Quick Pick state tests in `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `onQuickPickStarted` sets songs and clears votes
    - Test `onQuickPickVoteReceived` updates vote tally
    - Test `onQuickPickResolved` sets winner
    - Test `onQuickPickCleared` resets all state

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL vote tracking, majority detection, timeout resolution, and song selection happen server-side. Flutter is a thin display layer that sends vote actions and renders server-broadcast state (per project-context.md core principle)
- **Service boundary**: `quick-pick.ts` lives in `services/` -- pure in-memory vote tracking, no Socket.io or persistence imports
- **Socket handler boundary**: `song-handlers.ts` in `socket-handlers/` -- calls services and dj-engine, NEVER calls persistence directly
- **Session-manager orchestration**: `session-manager.ts` is the ONLY service that orchestrates across layers (initializes round, schedules timer, cleans up)
- **Persistence boundary**: No new database tables. Quick Pick is entirely in-memory (same pattern as DJ state store, song pool, connection tracker, event stream)
- **Casing rules**: DB columns `snake_case`, socket event payloads `camelCase` (direct objects, NOT wrapped per project-context.md error handling rules)
- **Import rules**: Relative imports with `.js` extension. No barrel files. No tsconfig aliases
- **File naming**: `kebab-case.ts` for all new TS files, `snake_case.dart` for all new Dart files

### Race Condition Prevention (NFR11)

Node.js is single-threaded. Each `socket.on` callback runs to completion before the next event is processed. The `recordVote` function is synchronous, operating on an in-memory `Map`. This guarantees:
- No two votes for the same song are processed simultaneously
- No vote is lost due to concurrent access
- Majority detection after each vote is atomic with the vote recording
- The 15s timeout callback runs in the same event loop and checks `round.resolved` to avoid double-resolution

### Key Implementation Patterns

1. **Quick Pick lifecycle** -- tied to DJ state machine:
   ```
   DJ enters songSelection → processTransition auto-schedules 15s timer (side effect)
     → processDjTransition hook: computeSuggestions(5) → startRound()
     → broadcastQuickPickStarted(songs) (dedicated event, NOT dj:stateChanged metadata)
     → participants vote via song:quickpick events → recordVote() checks majority after each
     → PATH A: majority reached → onSongSelected() → cancelSessionTimer → SONG_SELECTED
     → PATH B: 15s timer fires → handleRecoveryTimeout → detects songSelection
       → resolveByTimeout() → onSongSelected() → SONG_SELECTED
     → DJ transitions to partyCardDeal → clearRound()
   ```

2. **Vote tracking** -- simple Map structure:
   ```typescript
   // votes: Map<catalogTrackId, Map<userId, 'up' | 'skip'>>
   // Each user can vote on each song independently
   // Last vote wins if user changes mind (idempotent)
   // Majority = floor(participantCount / 2) + 1 up-votes
   ```

3. **Timer pattern** -- reuse DJ engine's built-in timeout:
   ```typescript
   // machine.ts processTransition() auto-generates scheduleTimer side effect
   // for songSelection (hasTimeout: true). The side effect handler in
   // processDjTransition() calls scheduleSessionTimer() with handleRecoveryTimeout().
   //
   // DO NOT schedule a separate timer. Instead:
   // 1. Set TimerConfig[songSelection] = 15000 (15s)
   // 2. Modify handleRecoveryTimeout() to detect Quick Pick:
   //    if (context.state === songSelection) → resolveByTimeout() → onSongSelected()
   // 3. Cancel timer on early majority: cancelSessionTimer(sessionId)
   ```

4. **Flutter state flow**:
   ```
   quickpick:started (dedicated broadcast from broadcastQuickPickStarted)
     → partyProvider.onQuickPickStarted(songs, participantCount, timerDurationMs)
     → QuickPickOverlay renders 5 cards

   User taps vote → SocketClient.emitQuickPickVote(id, 'up')
     → optimistic local update (_myQuickPickVotes)

   song:quickpick broadcast → partyProvider.onQuickPickVoteReceived(...)
     → QuickPickOverlay updates vote counts

   song:queued broadcast → partyProvider.onQuickPickResolved(winnerId)
     → QuickPickOverlay shows winner → auto-dismiss

   dj:stateChanged (partyCardDeal) → QuickPickOverlay removed from tree
   ```

5. **Reusability (FR27)**: The voting algorithm (record votes, check majority, timeout fallback) is structured as pure functions within `quick-pick.ts`. When Epic 7 needs activity voting, the pattern can be extracted to a `services/voting.ts` utility. For now, keeping it in one file avoids premature abstraction

### Broadcaster Pattern (CRITICAL -- DO NOT use dj:stateChanged metadata)

`buildDjStatePayload()` in `dj-broadcaster.ts` intentionally strips ALL metadata except `ceremonyType` (only when state is ceremony). It returns a shaped payload with specific fields: `state`, `sessionId`, `songCount`, `participantCount`, `currentPerformer`, timer fields, pause fields. **Quick Pick songs stored in `context.metadata.quickPickSongs` will be silently dropped from the broadcast.**

The established pattern for state-specific data is dedicated broadcast functions:
- Cards: `broadcastCardDealt(sessionId, card, performer)`
- Ceremonies: `broadcastCeremonyAnticipation(sessionId, performer, revealAt)`, `broadcastCeremonyReveal(...)`

Quick Pick MUST follow this pattern: use `broadcastQuickPickStarted()` to emit a `quickpick:started` event with the songs payload. The Flutter client listens for this dedicated event, NOT for metadata in `dj:stateChanged`.

### Timer Architecture (CRITICAL -- DO NOT schedule a separate timer)

The DJ engine's `processTransition()` in `machine.ts` auto-generates `scheduleTimer` side effects for states with `hasTimeout: true`. The side effect executor in `processDjTransition()` calls `scheduleSessionTimer(sessionId, durationMs, () => handleRecoveryTimeout(sessionId))`. Since `songSelection` has `hasTimeout: true`, the DJ engine WILL schedule a timer automatically.

If you schedule a SEPARATE Quick Pick timer, `scheduleSessionTimer` will overwrite the DJ engine's timer (it cancels existing before setting new). This creates fragile ordering dependencies. If `handleRecoveryTimeout` fires instead, it triggers a `TIMEOUT` transition → `getNextCycleState(songSelection)` → `partyCardDeal`, completely bypassing Quick Pick resolution.

**Correct approach**: Let the DJ engine manage the timer. Set `TimerConfig[songSelection] = 15000`. Modify `handleRecoveryTimeout()` to detect and resolve Quick Pick before falling through to the generic TIMEOUT transition.

### Suggestion Engine Integration

The existing `GET /api/sessions/:sessionId/suggestions?count=5` REST endpoint is NOT used for Quick Pick. Instead, `computeSuggestions(sessionId, 5)` is called directly from the server during DJ state transition. This avoids:
- Extra HTTP round-trip
- Auth complexity (the server already has the session context)
- Client-initiated suggestion fetch (violates server-authoritative principle)

The REST endpoint remains available for future features (e.g., browsing suggestions outside of Quick Pick, Story 5.9 suggestion-only mode).

### Ranking Jitter Note (from Story 5.4)

`computeSuggestions()` includes `Math.random() * 10` jitter in ranking scores. This means each Quick Pick round gets a slightly different set of top-5 songs, adding variety. The songs are fetched ONCE at round start and cached in the `QuickPickRound` -- they don't change during the 15s voting window.

### What This Story Does NOT Include

- No Spin the Wheel mode UI or animation (Story 5.6)
- No mode toggle between Quick Pick and Spin the Wheel (Story 5.6 -- the toggle button is added in 5.6)
- No TV pairing or auto-queuing on YouTube TV (Story 5.7)
- No song detection from TV (Story 5.8)
- No suggestion-only mode display (Story 5.9)
- No genre momentum in ranking (deferred, see Story 5.4 notes)
- No YouTube thumbnail proxy/caching -- direct `img.youtube.com` URL usage
- No song preview audio playback

### Project Structure Notes

New files to create:
```
apps/server/
└── src/
    ├── services/
    │   └── quick-pick.ts                    # NEW - vote tracker service
    ├── socket-handlers/
    │   └── song-handlers.ts                 # NEW - song:quickpick handler
    └── shared/
        └── schemas/
            └── quick-pick-schemas.ts        # NEW - Zod schemas

apps/server/
└── tests/
    ├── services/
    │   └── quick-pick.test.ts               # NEW
    └── socket-handlers/
        └── song-handlers.test.ts            # NEW

apps/flutter_app/
└── lib/
    ├── models/                              # If dir exists; otherwise define in party_provider.dart
    │   ├── quick_pick_song.dart              # NEW (or inline)
    │   └── vote_tally.dart                  # NEW (or inline)
    └── widgets/
        └── quick_pick_overlay.dart          # NEW

apps/flutter_app/
└── test/
    ├── models/                              # Only if models/ dir used
    │   ├── quick_pick_song_test.dart         # NEW
    │   └── vote_tally_test.dart             # NEW
    └── widgets/
        └── quick_pick_overlay_test.dart     # NEW
```

Files to modify:
```
apps/server/src/shared/events.ts                          # Add QUICKPICK_STARTED event constant
apps/server/src/socket-handlers/connection-handler.ts     # Register registerSongHandlers(s, io) in setupSocketHandlers()
apps/server/src/services/session-manager.ts               # Quick Pick init in songSelection, modify handleRecoveryTimeout, cleanup in endSession
apps/server/src/services/dj-broadcaster.ts                # Add broadcastQuickPickStarted() dedicated function
apps/server/src/dj-engine/types.ts                        # Verify metadata is Record<string, unknown> (no changes expected)
apps/server/src/dj-engine/machine.ts (or TimerConfig)     # Verify/set songSelection timer to 15000ms
apps/flutter_app/lib/state/party_provider.dart            # Add Quick Pick state fields + mutation methods (+ model classes if no models/ dir)
apps/flutter_app/lib/socket/client.dart                   # Add Quick Pick listeners (quickpick:started, song:quickpick, song:queued) + emit method
apps/flutter_app/lib/screens/party_screen.dart            # Render QuickPickOverlay
apps/flutter_app/lib/constants/copy.dart                  # Add Quick Pick copy strings
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.5]
- [Source: _bmad-output/planning-artifacts/prd.md#FR27, FR88, NFR11]
- [Source: _bmad-output/planning-artifacts/architecture.md#DJState.songSelection]
- [Source: _bmad-output/project-context.md#Server Boundaries]
- [Source: _bmad-output/project-context.md#Socket.io Event Catalog]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: _bmad-output/project-context.md#Anti-Patterns]
- [Source: apps/server/src/shared/events.ts#SONG_QUICKPICK]
- [Source: apps/server/src/services/suggestion-engine.ts#computeSuggestions]
- [Source: apps/server/src/services/song-pool.ts#markSongSung]
- [Source: apps/server/src/socket-handlers/card-handlers.ts#Handler registration pattern]
- [Source: apps/server/src/socket-handlers/reaction-handlers.ts#Rate limiting and participation scoring]
- [Source: apps/server/src/dj-engine/types.ts#DJState.songSelection, DJMetadata]
- [Source: apps/server/src/dj-engine/states.ts#songSelection transitions: SONG_SELECTED]
- [Source: apps/server/src/services/session-manager.ts#processDjTransition, handleRecoveryTimeout, endSession]
- [Source: apps/server/src/services/timer-scheduler.ts#scheduleSessionTimer, cancelSessionTimer]
- [Source: apps/server/src/services/dj-broadcaster.ts#buildDjStatePayload strips metadata, broadcastCardDealt pattern]
- [Source: apps/server/src/dj-engine/machine.ts#processTransition auto-schedules timer side effects]
- [Source: apps/server/src/socket-handlers/connection-handler.ts#setupSocketHandlers handler registration]
- [Source: apps/flutter_app/lib/socket/client.dart#Event listener pattern]
- [Source: apps/flutter_app/lib/state/party_provider.dart#Provider mutation pattern]
- [Source: apps/flutter_app/lib/widgets/party_card_deal_overlay.dart#Full-screen overlay pattern]

### Previous Story Intelligence (from Story 5.4)

- **Song pool service** (`song-pool.ts`): Module-level `Map<string, SessionSongPool>` pattern -- follow exactly for `quick-pick.ts`
- **`computeSuggestions(sessionId, count)`**: Returns `SuggestedSong[]` with `catalogTrackId`, `songTitle`, `artist`, `youtubeVideoId`, `overlapCount`, `score`. Map to `QuickPickSong` (drop `score` field)
- **`markSongSung(sessionId, title, artist)`**: Call when song is selected to update pool for next round's suggestions
- **Schema registration**: `z.globalRegistry.add(schema, { id: 'Name' })` + import in index.ts BEFORE swagger init -- but this is ONLY needed for REST route schemas (OpenAPI). Quick Pick is Socket.io-only, so no globalRegistry or import ordering needed for quick-pick-schemas.ts
- **REST Auth Pattern**: No `request.user` on REST routes. But Quick Pick uses Socket.io, where `socket.data.userId` and `socket.data.sessionId` ARE available -- no manual auth extraction needed
- **Test patterns**: `vi.mock()` with factory functions, `afterEach(() => resetAll())` for module-level state, `vi.fn()` for socket emit mocking
- **Pre-existing Flutter test failure**: `party_screen_test.dart` has `DJTokens.actionPrimary` compilation error -- not from this epic
- **868 server tests pass** as of Story 5.4 completion

### Git Intelligence (from recent commits)

- Last 5 commits: Story 5.4 code review fixes, Story 5.4 implementation, Story 5.3 (Spotify), Story 5.2 (YouTube Music), Story 5.1 (Catalog)
- Pattern: stories implemented in a single commit with comprehensive tests, then separate code review fix commit
- All server files use relative imports with `.js` extension
- All Zod schemas registered with `z.globalRegistry.add()`
- Server test count: 868+ tests (58+ files)
- Flutter test count: 446+ pass

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented Quick Pick vote tracker service (`quick-pick.ts`) with in-memory Map pattern, majority detection, timeout resolution
- Created song socket handler (`song-handlers.ts`) for `song:quickpick` events with DJ state guards
- Added `QUICKPICK_STARTED` event and `broadcastQuickPickStarted()` dedicated broadcaster (not dj:stateChanged metadata)
- Updated songSelection timer from 30s to 15s for Quick Pick voting window
- Modified `handleRecoveryTimeout()` in session-manager to detect songSelection state and resolve Quick Pick before generic TIMEOUT
- Added `initializeQuickPick()` hook in `processDjTransition()` when entering songSelection
- Added `handleQuickPickSongSelected()` orchestration function in session-manager (marks song sung, clears round, cancels timer, transitions DJ, broadcasts)
- Added `clearRound()` to `endSession()` cleanup
- Created Zod schemas for Quick Pick (Socket.io-only, no globalRegistry needed)
- Added Flutter Quick Pick state to PartyProvider with QuickPickSong/VoteTally data classes (inline, no models/ directory)
- Updated SocketClient with `quickpick:started`, `song:quickpick`, `song:queued` listeners and `emitQuickPickVote()` method
- Created QuickPickOverlay widget with song cards, vote buttons, countdown timer, winner highlight
- Integrated overlay into PartyScreen Stack
- Added Quick Pick copy strings to `copy.dart`
- Server: 896 tests pass (28 new, 868 existing, 2 skipped)
- Flutter: 442 pass (17 new), 2 pre-existing failures in party_screen_test.dart (DJTokens.actionPrimary compilation error)

#### Code Review Fixes Applied (2026-03-16)

- [H1] Fixed winner reveal event ordering: emit `song:queued` BEFORE `processDjTransition(SONG_SELECTED)` so clients see winner while overlay is mounted. Added 2s delayed `onQuickPickCleared()` in Flutter `song:queued` listener. Updated overlay condition in `party_screen.dart` to persist through DJ state transition when winner is set. Updated `onDjStateUpdate` to preserve Quick Pick state on songSelection exit when winner is set
- [H2] Fixed `resumeSession` timer callback to use `handleRecoveryTimeout` instead of raw `processDjTransition(TIMEOUT)`, ensuring Quick Pick resolution on pause/resume
- [M1] Created `session-manager-quickpick.test.ts` with 8 integration tests: round init on songSelection, suggestions count=5, broadcast, 15s timer, timeout resolution, song:queued before transition ordering, timer cancellation on majority, clearRound in endSession
- [M2] Added Zod runtime validation in `song-handlers.ts` via `quickPickVoteSchema.safeParse()` — schemas no longer dead code
- [M3] Added delayed `onQuickPickCleared()` after `onQuickPickResolved()` in `song:queued` listener (2s delay for winner display)
- [L1] Removed dead code path in `resolveByTimeout` (unreachable `bestSong === null` guard)
- Server: 904 tests pass (8 new integration tests added), Flutter: all Quick Pick tests pass

### Change Log

- 2026-03-16: Implemented Story 5.5 Quick Pick Mode - full server + Flutter implementation with comprehensive tests
- 2026-03-16: Applied code review fixes — 2 HIGH, 3 MEDIUM, 1 LOW issues resolved

### File List

New files:
- apps/server/src/services/quick-pick.ts
- apps/server/src/socket-handlers/song-handlers.ts
- apps/server/src/shared/schemas/quick-pick-schemas.ts
- apps/server/tests/services/quick-pick.test.ts
- apps/server/tests/socket-handlers/song-handlers.test.ts
- apps/server/tests/services/session-manager-quickpick.test.ts
- apps/flutter_app/lib/widgets/quick_pick_overlay.dart
- apps/flutter_app/test/models/quick_pick_song_test.dart
- apps/flutter_app/test/models/vote_tally_test.dart
- apps/flutter_app/test/widgets/quick_pick_overlay_test.dart

Modified files:
- apps/server/src/shared/events.ts (added QUICKPICK_STARTED)
- apps/server/src/services/dj-broadcaster.ts (added broadcastQuickPickStarted, getIO)
- apps/server/src/dj-engine/timers.ts (songSelection: 30s -> 15s)
- apps/server/src/services/session-manager.ts (Quick Pick init, handleRecoveryTimeout, handleQuickPickSongSelected event ordering fix, resumeSession fix, endSession cleanup)
- apps/server/src/socket-handlers/connection-handler.ts (register song handlers)
- apps/server/src/socket-handlers/song-handlers.ts (added Zod runtime validation)
- apps/server/tests/dj-engine/timers.test.ts (updated songSelection timer expectations)
- apps/server/tests/dj-engine/machine.test.ts (updated songSelection timer expectations)
- apps/flutter_app/lib/state/party_provider.dart (Quick Pick state, winner-preserving state clear)
- apps/flutter_app/lib/socket/client.dart (Quick Pick listeners, delayed clear on song:queued)
- apps/flutter_app/lib/screens/party_screen.dart (Quick Pick overlay condition includes winnerId)
- apps/flutter_app/lib/constants/copy.dart (Quick Pick copy strings)
- apps/flutter_app/test/state/party_provider_test.dart (Quick Pick state tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status update)
- _bmad-output/implementation-artifacts/5-5-quick-pick-mode.md (task completion + dev record + code review fixes)

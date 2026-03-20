# Story 8.2: Finale Ceremony Sequence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want the party to end with a memorable multi-step finale,
So that the night concludes on a high note with shared memories and a sense of celebration.

## Acceptance Criteria

1. **Given** the host ends the party or the party reaches its natural conclusion, **When** the finale sequence begins, **Then** it proceeds through 4 steps in order: (1) highlight awards reveal with animation, (2) session stats summary showing songs sung, total reactions, and participation highlights, (3) setlist poster with share prompt, (4) one-tap post-session feedback (FR52) **And** the total finale duration is 60-90 seconds (FR52)
2. **Given** step 4 of the finale, **When** the feedback prompt appears, **Then** a North Star prompt is displayed: "Would you use Karamania next time?" with a 1-5 scale (FR43) **And** the feedback is completable with a single tap (NFR14)
3. **Given** the finale is in progress, **When** each step transitions, **Then** transitions are server-coordinated and synchronized across all devices within 200ms (NFR1)
4. **Given** awards are revealed in step 1, **When** the awards parade plays, **Then** each award slides in with a sound cue, 2-3 seconds each, building tempo **And** awards are ordered by category priority (performer first, then hypeLeader, socialButterfly, crowdFavorite, partyStarter, vibeKeeper, everyone last) **And** non-singer awards appear equally prestigious
5. **Given** step 2 session stats, **When** stats are displayed, **Then** songs sung count, total reactions, total participants, session duration, and participation highlights are shown
6. **Given** step 3 setlist poster, **When** the setlist is displayed, **Then** all songs performed are listed with performer names and per-song awards **And** the display reflects the current party vibe's visual styling **And** a share button is visible (full sharing functionality deferred to Story 8.3)
7. **Given** a participant submits feedback, **When** they tap a rating (1-5), **Then** feedback is sent to server via Socket.io and persisted to `session_participants.feedback_score` **And** the UI confirms submission with a single tap (no multi-step flow)
8. **Given** the finale sequence is playing, **When** a participant is on the finale screen, **Then** the finale overlay takes over the full screen with vibe-colored background and confetti **And** awards parade has maximum celebration intensity (per UX graduated celebration spec)

## Tasks / Subtasks

- [x] Task 1: Restructure endSession flow for finale sequence (AC: #1, #3)
  - [x]1.1 In `session-manager.ts`, split the current `endSession()` into two phases:
    - **Phase 1 — `initiateFinale()`**: Transition to finale state, generate awards (Story 8.1), calculate session stats, build setlist data, broadcast all finale data, flush event stream to DB, update session status. **DO NOT** emit `party:ended` or clean up in-memory caches yet
    - **Phase 2 — `finalizeSession()`**: Emit `party:ended` to all clients, clean up ALL in-memory state (DJ context, caches, timers, finale data)
  - [x]1.2 In `initiateFinale()`, after Story 8.1's award generation and broadcast, add:
    - Call `calculateSessionStats(sessionId)` → broadcast `finale:stats`
    - Call `buildFinaleSetlist(sessionId)` → broadcast `finale:setlist`
  - [x]1.3 Start a finalization timer after broadcasting: `setTimeout(finalizeSession, FINALE_DURATION_MS)` where `FINALE_DURATION_MS = 5 * 60 * 1000` (5 minutes — generous buffer for the 60-90s sequence + browsing + feedback). Store timer reference for cleanup
  - [x]1.4 Add `clearFinalizationTimer(sessionId)` to session cleanup — cancel the timer if session is cleaned up early (e.g., all participants disconnect)
  - [x]1.5 Modify `host-handlers.ts`: `HOST_END_PARTY` handler calls `initiateFinale()` instead of `endSession()`. **Remove** the `io.to().emit(EVENTS.PARTY_ENDED)` from the handler — `party:ended` is now emitted by `finalizeSession()` via the timer
  - [x]1.6 Add `HOST_DISMISS_FINALE` event handler: allows host to trigger `finalizeSession()` early (tapping "Leave Party" button during finale). Cancel the finalization timer and call `finalizeSession()` immediately
  - [x]1.7 In `finalizeSession()`, clean up connection-handler timers that are NOT currently cleaned during session end. `hostTransferTimers` and `cleanupTimers` Maps in `connection-handler.ts` (lines 31-33) can have pending timers if a participant disconnected during the finale window. Either: (a) export `clearSessionTimers(sessionId)` from connection-handler and call it in finalizeSession, or (b) add the cleanup to the existing cleanup block. Without this, timers may fire after session is deleted and cause orphan operations

- [x] Task 2: Calculate session stats and build setlist data (AC: #5, #6)
  - [x]2.1 Create `calculateSessionStats(sessionId: string)` in `session-manager.ts` (NOT a separate service — it's orchestration logic that reads event stream + caches):
    - `songCount`: from DJ context `songCount` field (already tracked)
    - `participantCount`: from DJ context `participantCount` field
    - `sessionDurationMs`: `Date.now() - sessionStartedAt` from DJ context
    - `totalReactions`: count `reaction:sent` events in event stream
    - `totalSoundboardPlays`: count `sound:play` events in event stream
    - `totalCardsDealt`: count `card:dealt` events in event stream
    - `topReactor`: participant with most `reaction:sent` events (displayName + count)
    - `longestStreak`: highest streak value from `reaction:sent` events
    - Returns `SessionStats` interface
  - [x]2.2 Create `buildFinaleSetlist(sessionId: string)` in `session-manager.ts`:
    - **Performer derivation** (CRITICAL — `song:detected` has NO `userId` field):
      1. Scan `dj:stateChanged` events where `data.to === 'song'` — these carry the DJ context's `currentPerformer` at the time of each song transition. Build a position→performer map by counting song transitions in order (1st song transition = position 1, etc.)
      2. Scan `song:detected` events → extract `{ title, artist }` for each song in order
      3. Match song positions between the two scans to associate `{ title, artist, performerName }`
    - Match each song position with `ceremony:awardGenerated` events → attach `{ awardTitle, awardTone }` per song. The `ceremony:awardGenerated` event has `data.songPosition` (1-based) and `data.award` (title string) and `data.userId` (performer)
    - Returns `SetlistEntry[]` where each entry: `{ position: number, title: string, artist: string, performerName: string | null, awardTitle: string | null, awardTone: string | null }`
    - Handle edge case: songs with no ceremony (quick ceremony uses `ceremony:revealed` event — check for matching songPosition). Songs with no award at all → `awardTitle: null`
    - Handle edge case: `song:detected` may not fire for every song (if detection fails). Use `dj:stateChanged` song transition count as authoritative song count
  - [x]2.3 Define `SessionStats` interface in `shared/schemas/finale-schemas.ts`:
    ```typescript
    { songCount: number, participantCount: number, sessionDurationMs: number, totalReactions: number, totalSoundboardPlays: number, totalCardsDealt: number, topReactor: { displayName: string, count: number } | null, longestStreak: number }
    ```
  - [x]2.4 Define `SetlistEntry` interface and Zod schema in `shared/schemas/finale-schemas.ts`

- [x] Task 3: Add Socket.io events and broadcaster functions (AC: #3, #7)
  - [x]3.1 Add event constants to `shared/events.ts`:
    - `FINALE_STATS: 'finale:stats'`
    - `FINALE_SETLIST: 'finale:setlist'`
    - `FINALE_FEEDBACK: 'finale:feedback'`
    - `HOST_DISMISS_FINALE: 'host:dismissFinale'`
  - [x]3.2 Add to `dj-broadcaster.ts`:
    - `broadcastFinaleStats(sessionId: string, stats: SessionStats)` — emit `EVENTS.FINALE_STATS`
    - `broadcastFinaleSetlist(sessionId: string, setlist: SetlistEntry[])` — emit `EVENTS.FINALE_SETLIST`
  - [x]3.3 Add Zod schemas to `shared/schemas/finale-schemas.ts`: `sessionStatsSchema`, `setlistEntrySchema`, `feedbackPayloadSchema` (userId, score 1-5)
  - [x]3.4 Add `finale:feedbackReceived` event type to `SessionEvent` union in `event-stream.ts`: `{ type: 'finale:feedbackReceived'; ts: number; userId: string; data: { score: number } }`. Note: `finale:statsCalculated` and `finale:setlistBuilt` are NOT needed as event types — stats and setlist are broadcast directly, not logged to the event stream

- [x] Task 4: Handle feedback collection (AC: #2, #7)
  - [x]4.1 Create `apps/server/src/socket-handlers/finale-handlers.ts` — NEW file:
    - `registerFinaleHandlers(socket, sessionManager)` following existing handler pattern
    - Handle `EVENTS.FINALE_FEEDBACK`: validate score (1-5 integer), call `saveFeedback(sessionId, userId, score)`
    - Rate limit: one feedback submission per user per session (ignore duplicates silently)
  - [x]4.2 In `session-manager.ts`, add `saveFeedback(sessionId: string, userId: string, score: number)`:
    - Update `session_participants.feedback_score` via `sessionRepo.updateFeedbackScore(sessionId, userId, score)` — fire-and-forget async (this is the authoritative persistence — DB column is the source of truth for feedback)
    - Append `finale:feedbackReceived` event to event stream. **NOTE**: The event stream is already flushed to DB by the time feedback arrives (flush happens in `initiateFinale`). These events exist only in the in-memory stream and will NOT be in the persisted event_stream JSON. This is acceptable — `feedback_score` column is the authoritative source. If the server restarts before `finalizeSession`, feedback is still safe in the DB column
  - [x]4.3 Add `updateFeedbackScore(sessionId, userId, score)` to `persistence/session-repository.ts`:
    ```typescript
    await db.updateTable('session_participants')
      .set({ feedback_score: score })
      .where('session_id', '=', sessionId)
      .where('user_id', '=', userId)
      .execute();
    ```
  - [x]4.4 Register finale handlers in `connection-handler.ts` alongside existing handler registrations

- [x] Task 5: Flutter finale overlay widget — Awards Parade (AC: #1, #4, #8)
  - [x]5.1 Create `apps/flutter_app/lib/widgets/finale_overlay.dart` — NEW: Main finale sequence orchestrator widget
    - StatefulWidget with TickerProviderStateMixin
    - Manages the 4-step sequence with local timers (client-side orchestration after receiving server data)
    - Steps: `awards` (20-30s based on award count) → `stats` (10-15s) → `setlist` (15-20s) → `feedback` (stays until dismissed)
    - Each step transition: cross-fade animation (300ms)
    - Full-screen overlay with vibe-colored gradient background
    - Confetti layer at maximum intensity (reduced-motion: skip confetti)
    - Watch `PartyProvider` for `finaleAwards`, `finaleStats`, `finaleSetlist` data
    - Show loading shimmer while waiting for data from server (data arrives within 2s of finale transition)
  - [x]5.2 Create `apps/flutter_app/lib/widgets/awards_parade_widget.dart` — NEW: Step 1 awards display
    - Receives `List<FinaleAward>` from provider
    - Animates awards sequentially: each award slides in from bottom with scale + fade (500ms per award)
    - 2-3 second interval between awards, building tempo (first awards: 3s gap, later awards: 2s gap)
    - Each award card shows: `displayName` — `title` with `reason` subtitle
    - Award card styling: vibe-colored accent, tone-based icon (comedic/hype/absurd/wholesome)
    - Sound cue per award reveal: use existing `SoundCue` pattern — add `SoundCue.finaleAwardReveal` to `state_transition_audio.dart`
    - After all awards revealed: brief celebration burst (1s), then auto-advance to stats step
    - Layout: ScrollView of award cards, auto-scrolling as new awards appear
  - [x]5.3 Accessibility: if reduced motion preference detected, show all awards at once in a static list (no sequential animation)

- [x] Task 6: Flutter finale overlay — Stats, Setlist, Feedback (AC: #2, #5, #6)
  - [x]6.1 Create `apps/flutter_app/lib/widgets/session_stats_widget.dart` — NEW: Step 2 stats display
    - Receives `SessionStats` from provider
    - Animated counters rolling up (songs count, reactions count, duration formatted as "Xh Ym")
    - Highlight row for top reactor: "{displayName} — {count} reactions"
    - Longest streak display if > 1
    - Stat cards in a grid layout (2 columns)
    - Duration formatting: `DurationFormatter` utility — hours/minutes only, no seconds
  - [x]6.2 Create `apps/flutter_app/lib/widgets/finale_setlist_widget.dart` — NEW: Step 3 setlist display
    - Receives `List<SetlistEntry>` from provider
    - Vertical scrollable list of songs with position number, title, artist, performer name, award title
    - Each song entry: compact card with song position as large number, title bold, artist subtitle, performer tag, award badge (if present)
    - Vibe-styled card backgrounds
    - Share button at bottom — use `SharePlus.instance.share(ShareParams(text: ...))` from `share_plus` package (already in pubspec.yaml). **CORRECT API** — do NOT use `Share.share()` which is deprecated. See `party_screen.dart` line 814 for existing usage pattern. Story 8.3 upgrades to image poster
    - Share text format: "Karamania Night — {date}\n1. {title} by {artist} ({performer}) — {award}\n..."
  - [x]6.3 Create `apps/flutter_app/lib/widgets/feedback_prompt_widget.dart` — NEW: Step 4 feedback
    - North Star prompt: "Would you use Karamania next time?"
    - Five tappable rating buttons (1-5) — large touch targets (min 48x48 per Material guidelines)
    - Visual: emoji scale (1=sad → 5=love) or star rating — keep it single-tap
    - On tap: immediately highlight selected rating, emit `finale:feedback` event via socket, show brief "Thanks!" confirmation
    - Disable after first tap (no changing rating)
    - Below rating: "Leave Party" button that navigates user back to home
  - [x]6.4 Add `SoundCue.finaleAwardReveal` to `audio/sound_cues.dart` (or wherever sound cues are defined). If no actual audio file yet, map to existing `ceremonyReveal` cue as placeholder

- [x] Task 7: Flutter state and socket integration (AC: #1, #3)
  - [x]7.1 Add to `PartyProvider`:
    - `SessionStats? _finaleStats` with getter and `setFinaleStats(SessionStats stats)` setter
    - `List<SetlistEntry>? _finaleSetlist` with getter and `setFinaleSetlist(List<SetlistEntry> setlist)` setter
    - `int? _finaleCurrentStep` — tracks which step of the sequence we're on (0=awards, 1=stats, 2=setlist, 3=feedback). Set by the finale overlay widget via `setFinaleStep(int step)` — used for analytics/logging only
    - `bool _feedbackSubmitted` with getter — prevents double submission
    - `setFeedbackSubmitted()` setter
    - **Note**: `finaleAwards` field already added by Story 8.1 — do NOT duplicate
  - [x]7.1a **CRITICAL**: Create `_clearFinaleState()` method in PartyProvider AND add call to it inside `onSessionEnded()` (after `_clearInterludeState()` at line ~1223). Must reset: `_finaleStats = null`, `_finaleSetlist = null`, `_finaleCurrentStep = null`, `_feedbackSubmitted = false`. Story 8.1's `finaleAwards` is cleared separately via `clearFinaleAwards()` — verify it's also called in `onSessionEnded()`
  - [x]7.2 Add `SessionStats` model to `apps/flutter_app/lib/models/session_stats.dart` — NEW: mirror server shape in camelCase. Fields: `songCount`, `participantCount`, `sessionDurationMs`, `totalReactions`, `totalSoundboardPlays`, `totalCardsDealt`, `topReactor` (nullable object with `displayName` + `count`), `longestStreak`
  - [x]7.3 Add `SetlistEntry` model to `apps/flutter_app/lib/models/setlist_entry.dart` — NEW: `position`, `title`, `artist`, `performerName` (nullable), `awardTitle` (nullable), `awardTone` (nullable)
  - [x]7.4 Add Socket.io listeners in `socket/client.dart`:
    - `on('finale:stats', (data) { ... })` → parse and call `partyProvider.setFinaleStats(stats)`
    - `on('finale:setlist', (data) { ... })` → parse and call `partyProvider.setFinaleSetlist(setlist)`
    - **Note**: `finale:awards` listener already added by Story 8.1
  - [x]7.5 Add `submitFeedback(int score)` method to `SocketClient`:
    - Emit `finale:feedback` event with `{ score }` payload
    - Call `partyProvider.setFeedbackSubmitted()`
  - [x]7.6 In `party_screen.dart`, add finale overlay rendering:
    - When `djState == DJState.finale` → show `FinaleOverlay` widget as full-screen overlay (above all other overlays)
    - Hide host controls during finale (already handled — existing code checks `djState != DJState.finale`)
  - [x]7.7 Add "Leave Party" navigation: when user taps "Leave Party" button in feedback step, emit `host:dismissFinale` if host, then navigate to home screen via GoRouter. Non-host participants just navigate away (disconnect handled by server)

- [x] Task 8: Tests (AC: #1-8)
  - [x]8.1 Server unit tests for `calculateSessionStats`:
    - Correct aggregation from event stream (reactions, songs, soundboard, cards)
    - Empty event stream → zero counts
    - Session duration calculation
    - Top reactor selection with ties (higher participation score wins)
  - [x]8.2 Server unit tests for `buildFinaleSetlist`:
    - Correct song ordering by position
    - Award matching per song position
    - Songs without awards (quick ceremony)
    - Empty setlist (no songs played)
  - [x]8.3 Server integration tests for `initiateFinale`:
    - Finale transition triggers award generation, stats calculation, setlist build
    - All three broadcasts sent (`finale:awards`, `finale:stats`, `finale:setlist`)
    - Event stream flushed to DB
    - Finalization timer started
    - `party:ended` NOT emitted immediately
  - [x]8.4 Server integration tests for `finalizeSession`:
    - Emits `party:ended` to all clients
    - Cleans up all in-memory state (DJ context, caches, timers, finale data)
    - Timer cancelled if called early (host dismiss)
  - [x]8.5 Server tests for feedback handling:
    - Valid score (1-5) persisted to DB
    - Invalid score rejected (0, 6, non-integer)
    - Duplicate submission ignored
    - Feedback event appended to event stream
  - [x]8.6 Flutter widget tests for `FinaleOverlay`:
    - Renders awards parade when `finaleAwards` is available
    - Transitions through 4 steps
    - Shows loading state when data not yet received
  - [x]8.7 Flutter tests for `PartyProvider` finale state:
    - `setFinaleStats` stores correctly
    - `setFinaleSetlist` stores correctly
    - `clearFinaleState` resets all finale fields
    - `feedbackSubmitted` flag works
  - [x]8.8 Flutter tests for socket listeners:
    - `finale:stats` event parsed and forwarded to provider
    - `finale:setlist` event parsed and forwarded to provider
    - `finale:feedback` emission with correct payload
  - [x]8.9 Mock compatibility: add `finale-handlers` mock to session-manager test files if finale-handlers is imported by session-manager (likely not — it's a socket handler, so no cross-import)
  - [x]8.10 **DO NOT test**: confetti animations, slide-in timings, counter roll-up animations, color values, font sizes

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL finale data (stats, setlist, awards) calculated server-side. Flutter receives structured data and renders — ZERO calculation logic in Dart
- **DJ engine purity**: The DJ engine only knows `finale` as a terminal state with no transitions. All finale orchestration (stats, setlist, sequence timing) lives in session-manager, not the engine
- **Boundary rules**: `calculateSessionStats` and `buildFinaleSetlist` are functions in session-manager (orchestration layer). They read event stream and DJ context but don't import from persistence or socket-handlers directly
- **Socket handler pattern**: `finale-handlers.ts` follows the existing one-file-per-namespace pattern in `socket-handlers/`. Registers handlers, calls session-manager methods
- **Flutter provider pattern**: SocketClient is the ONLY entity that mutates PartyProvider state. Widgets consume via `context.watch<PartyProvider>()`

### Key Design Decisions

**Why client-side step orchestration instead of server-broadcast sub-steps?**
The server sends all data upfront (awards, stats, setlist) in rapid succession. The client then orchestrates the visual 4-step sequence locally. This avoids adding server-side timers for cosmetic transitions. The "synchronized within 200ms" requirement (NFR1) applies to the INITIAL transition to finale (handled by `dj:stateChanged`), not to each visual sub-step within the finale — those are client-local animations.

**Why split endSession into initiateFinale + finalizeSession?**
The current `endSession()` emits `party:ended` and cleans up immediately, which would navigate clients away before they see the finale. By splitting, we:
1. Persist all data immediately (safe against crashes)
2. Keep in-memory caches alive for the finale window
3. Delay `party:ended` until clients have had time to experience the sequence

**Why 5-minute finalization timer?**
The 60-90s automated sequence is followed by the feedback prompt and optional browsing (scrolling through awards/setlist). 5 minutes gives generous buffer. The host can trigger early finalization via `HOST_DISMISS_FINALE`.

**Why feedback via Socket.io instead of REST?**
The user is already connected via Socket.io during the party. Adding a REST endpoint for a single-tap action introduces unnecessary complexity. Socket.io fire-and-forget matches the pattern.

**Why basic text sharing in Story 8.2 instead of image poster?**
Story 8.3 specifically handles "Setlist Poster Generation & Sharing" with visual 9:16 poster generation. Story 8.2 shows the setlist data and offers basic text sharing. Story 8.3 upgrades this to a designed, shareable image.

**Feedback persistence timing:**
The event stream is flushed to DB during `initiateFinale()` (before feedback arrives). Feedback events appended after the flush exist only in memory and won't appear in the persisted `sessions.event_stream` JSON. This is intentional — `session_participants.feedback_score` is the authoritative source for feedback data and is written immediately via fire-and-forget DB update. The in-memory feedback events serve only as real-time logging during the finale window.

**Dart model files (newer convention):**
Earlier stories defined models inline in `party_provider.dart` (QuickPickSong, IcebreakerOption, etc.). Story 8.1 introduced separate model files in `lib/models/`. Story 8.2 follows the newer convention — create `session_stats.dart` and `setlist_entry.dart` as separate files in `lib/models/`. Use the same `fromJson` factory pattern with null-safe defaults: `(json['field'] as int?) ?? 0`.

### Critical Integration Points

**Dependency on Story 8.1** (MUST be implemented first):
- `generateEndOfNightAwards()` function and `FinaleAward[]` type
- `finaleAwards` in-memory cache in session-manager
- `broadcastFinaleAwards()` in dj-broadcaster
- `FINALE_AWARDS` event constant
- `finale-schemas.ts` with `FinaleAward` and `FinaleAwardsPayload` schemas
- Flutter `FinaleAward` model, `PartyProvider.finaleAwards`, `SocketClient` finale:awards listener

**Session-manager endSession restructuring** (current code ~line 1722):
```
CURRENT FLOW:
1. Verify host → get DJ context → clear pause
2. processDjTransition(END_PARTY) → finale state → broadcast dj:stateChanged
3. Append party:ended + card:sessionStats events
4. [Story 8.1]: Generate awards → append finale:awardsGenerated → broadcast finale:awards
5. flushEventStream → DB
6. Update session status = 'ended'
7. Cleanup all in-memory state
8. [host-handler]: emit party:ended

NEW FLOW (Story 8.2):
1. Verify host → get DJ context → clear pause
2. processDjTransition(END_PARTY) → finale state → broadcast dj:stateChanged
3. Append party:ended + card:sessionStats events
4. [Story 8.1]: Generate awards → append finale:awardsGenerated → broadcast finale:awards
5. [Story 8.2]: Calculate stats → broadcast finale:stats
6. [Story 8.2]: Build setlist → broadcast finale:setlist
7. flushEventStream → DB (includes all finale events)
8. Update session status = 'ended'
9. [Story 8.2]: Start finalization timer (5 min)
10. ← STOP HERE. DO NOT cleanup in-memory state. DO NOT emit party:ended
...
11. [Timer fires OR host dismisses]: finalizeSession()
12. Emit party:ended → clients navigate away
13. Cleanup all in-memory state (DJ context, caches, timers, finaleAwards, etc.)
```

**Event stream event types to scan for stats/setlist:**
- `reaction:sent` — count per user for totalReactions and topReactor. **Fields: `userId`, `data.emoji`, `data.streak`**. Use `data.streak` to find longestStreak (max across all events)
- `sound:play` — count for totalSoundboardPlays. **Fields: `userId`, `data.soundId`**
- `card:dealt` — count for totalCardsDealt (session-level event, **NO userId field**). Count = total cards dealt in session
- `song:detected` — extract `title`, `artist` for setlist. **Fields: `data.videoId`, `data.title`, `data.artist`**. **CRITICAL: NO `userId` field** — performer must be derived from `dj:stateChanged` events (see below)
- `dj:stateChanged` — **Fields: `data.from`, `data.to`, `data.trigger`**. For setlist: count transitions where `data.to === 'song'` to get song positions. The DJ context's `currentPerformer` at each song transition provides the performer name. **To get performer**: read the `currentPerformer` from the DJContext that was active when the transition occurred — this is available via `ceremony:awardGenerated` events (which have `userId` = performer) OR by tracking the sequence of `dj:stateChanged` to `song` transitions and correlating with the DJContext
- `ceremony:awardGenerated` — match `songPosition` to setlist entry for per-song awards. **Fields: `userId` (= performer), `data.award`, `data.songPosition` (1-based), `data.ceremonyType`, `data.tone`**. This is also the most reliable source of performerName per song position

**Host-handler changes:**
```typescript
// BEFORE (current):
socket.on(EVENTS.HOST_END_PARTY, async () => {
  await endSession(sessionId, userId);
  io.to(sessionId).emit(EVENTS.PARTY_ENDED, { reason: 'host_ended' });
});

// AFTER (Story 8.2):
socket.on(EVENTS.HOST_END_PARTY, async () => {
  await initiateFinale(sessionId, userId);
  // NO party:ended emission here
});

socket.on(EVENTS.HOST_DISMISS_FINALE, async () => {
  await finalizeSession(sessionId, userId);
});
```

### Reuse Patterns from Previous Stories (DO NOT REINVENT)

| Existing Pattern | Story 8.2 Usage |
|---|---|
| `dj-broadcaster.ts` broadcast pattern | Follow for `broadcastFinaleStats`, `broadcastFinaleSetlist` |
| `shared/events.ts` constant pattern | Follow for new FINALE_* constants |
| `ceremony_display.dart` animation pattern | Adapt for awards parade (TickerProviderStateMixin, Timer-based reveals) |
| `icebreaker_overlay.dart` full-screen overlay | Pattern for `FinaleOverlay` taking over party_screen |
| `party_provider.dart` ceremony state pattern | Follow for finale state fields (nullable, clear on exit) |
| `socket/client.dart` listener pattern | Follow for finale:stats and finale:setlist listeners |
| `finale-schemas.ts` (Story 8.1) | Extend with SessionStats and SetlistEntry schemas |
| `finale_award.dart` (Story 8.1) | Model pattern for SessionStats and SetlistEntry models |
| `state_transition_audio.dart` sound cue pattern | Follow for finale award reveal sound |
| `session-manager.ts` in-memory cache cleanup pattern | Follow for finalization timer cleanup |
| `persistence/session-repository.ts` update pattern | Follow for `updateFeedbackScore` |
| `constants/copy.dart` string pattern | Follow for all finale UI strings |
| `dj_theme.dart` finale background color | Already defined: `Color(0xFF1A0A2E)` — reuse, don't redefine |

### What This Story Does NOT Include (Scope Boundaries)

- NO award generation logic — that's Story 8.1
- NO shareable image poster generation — that's Story 8.3 (text sharing only)
- NO session summary persistence to DB beyond what already happens (event stream flush, status update) — Story 8.4 handles comprehensive persistence
- NO new DJ engine states or transitions — finale state already exists and is terminal
- NO new database tables or migrations — uses existing `session_participants.feedback_score` column
- NO localization — English only (post-MVP)
- NO host customization of finale sequence (fully automatic)
- NO ability to replay or restart the finale
- NO confetti implementation details (use existing `ConfettiLayer` if available, or a simple particle widget — do NOT over-engineer confetti)

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/session-manager.ts` | MODIFY — Split endSession into initiateFinale + finalizeSession, add calculateSessionStats, buildFinaleSetlist, saveFeedback, finalization timer |
| `apps/server/src/services/dj-broadcaster.ts` | MODIFY — Add broadcastFinaleStats, broadcastFinaleSetlist |
| `apps/server/src/shared/events.ts` | MODIFY — Add FINALE_STATS, FINALE_SETLIST, FINALE_FEEDBACK, HOST_DISMISS_FINALE constants |
| `apps/server/src/shared/schemas/finale-schemas.ts` | MODIFY (created by 8.1) — Add SessionStats, SetlistEntry, FeedbackPayload schemas |
| `apps/server/src/services/event-stream.ts` | MODIFY — Add finale:feedbackReceived event type to SessionEvent union |
| `apps/server/src/socket-handlers/finale-handlers.ts` | NEW — Handle finale:feedback event from clients |
| `apps/server/src/socket-handlers/host-handlers.ts` | MODIFY — Change HOST_END_PARTY to call initiateFinale, add HOST_DISMISS_FINALE handler |
| `apps/server/src/socket-handlers/connection-handler.ts` | MODIFY — Register finale handlers |
| `apps/server/src/persistence/session-repository.ts` | MODIFY — Add updateFeedbackScore method |
| `apps/flutter_app/lib/widgets/finale_overlay.dart` | NEW — Main finale sequence orchestrator (4 steps) |
| `apps/flutter_app/lib/widgets/awards_parade_widget.dart` | NEW — Step 1: animated awards reveal |
| `apps/flutter_app/lib/widgets/session_stats_widget.dart` | NEW — Step 2: animated stats summary |
| `apps/flutter_app/lib/widgets/finale_setlist_widget.dart` | NEW — Step 3: setlist display with basic sharing |
| `apps/flutter_app/lib/widgets/feedback_prompt_widget.dart` | NEW — Step 4: North Star feedback prompt |
| `apps/flutter_app/lib/models/session_stats.dart` | NEW — SessionStats model (camelCase) |
| `apps/flutter_app/lib/models/setlist_entry.dart` | NEW — SetlistEntry model (camelCase) |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add finaleStats, finaleSetlist, finaleCurrentStep, feedbackSubmitted fields |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add finale:stats, finale:setlist listeners, submitFeedback method |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Add FinaleOverlay rendering when djState == finale |
| `apps/flutter_app/lib/audio/state_transition_audio.dart` | MODIFY — Add finaleAwardReveal sound cue mapping |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add finale UI strings (step titles, feedback prompt, stats labels, share text template) |
| `apps/server/tests/services/session-manager-finale-sequence.test.ts` | NEW — Integration tests for initiateFinale, finalizeSession, stats, setlist |
| `apps/server/tests/services/session-stats.test.ts` | NEW — Unit tests for calculateSessionStats, buildFinaleSetlist |
| `apps/server/tests/socket-handlers/finale-handlers.test.ts` | NEW — Tests for feedback handling |
| `apps/flutter_app/test/widgets/finale_overlay_test.dart` | NEW — Widget tests for finale sequence |
| `apps/flutter_app/test/state/party_provider_test.dart` | MODIFY — Add finale state tests |

### Testing Strategy

- **Session stats unit tests** — Event stream scanning: correct reaction counts, soundboard counts, song count verification, top reactor selection (ties → higher participation score), empty event stream → all zeros, missing fields handled gracefully
- **Setlist builder unit tests** — Song ordering by position, award matching per song, songs without ceremonies, empty setlist, multiple performers per song (if applicable)
- **initiateFinale integration tests** — Awards generated (mock Story 8.1), stats calculated, setlist built, all three events broadcast, event stream flushed, finalization timer started, party:ended NOT emitted
- **finalizeSession integration tests** — party:ended emitted, all in-memory state cleaned up, timer cancelled on early dismiss
- **Feedback handling tests** — Valid score persisted, invalid score (0, 6, -1, 3.5) rejected, duplicate submission ignored, event appended
- **Flutter widget tests** — FinaleOverlay renders with data present, shows loading without data, transitions between steps. Awards parade shows each award. Stats widget shows formatted numbers. Feedback widget: tap rating → highlight + emit + disable
- **Flutter state tests** — Provider stores finale stats/setlist/feedback correctly, clearFinaleState resets all
- **Flutter socket tests** — finale:stats and finale:setlist listeners parse and forward correctly
- **DO NOT test**: Animation timings, confetti particles, slide-in curves, counter roll-up speed, color values, font sizes, gradient angles

### Previous Story Intelligence (Stories 7.1–8.1 Learnings)

- **Mock compatibility (7.3, 7.5, 7.6, 8.1)**: When adding a new service import to session-manager, add the mock to ALL session-manager test files. Check for 6+ existing test files that mock services
- **Code review tip (7.1)**: Add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads
- **Code review tip (7.2)**: Extract hardcoded durations to named constants. Use null-safe `fromJson` factories in Dart models
- **Code review tip (7.4)**: Be precise with duration semantics in event payloads (`Ms` suffix for milliseconds)
- **Fire-and-forget persistence (8.1 pattern)**: `updateFeedbackScore` is async fire-and-forget — don't await in hot path
- **Error isolation (8.1 pattern)**: Finale sequence failure (stats/setlist calculation) must NOT prevent session from ending. Wrap in try/catch, log error, broadcast whatever data was successfully calculated, continue
- **Event naming**: `finale:stats` and `finale:setlist` follow `namespace:action` convention per socket event catalog
- **Dart model fromJson (7.2)**: Use null-safe factories with fallback defaults: `(json['field'] as int?) ?? 0`
- **Full-screen overlay pattern (7.6)**: Icebreaker overlay took over entire screen — same approach for finale overlay. Use `Positioned.fill` within a Stack

### Project Structure Notes

- `snake_case` for DB columns — no new columns (uses existing `feedback_score`)
- `camelCase` for Socket.io event payloads and Dart models
- `kebab-case` for TS filenames: `finale-handlers.ts`, `session-stats.test.ts`
- `snake_case` for Dart filenames: `finale_overlay.dart`, `session_stats.dart`, `setlist_entry.dart`
- Socket events: `finale:stats`, `finale:setlist`, `finale:feedback` — uses `finale` namespace
- Host events: `host:dismissFinale` — uses `host` namespace per event catalog
- All UI copy strings in `constants/copy.dart`
- Relative imports with `.js` extension in server code
- No barrel files — import directly from specific files
- Widget keys: `Key('finale-overlay')`, `Key('awards-parade')`, `Key('feedback-prompt')`

### References

- [Source: epics.md line 417 — Epic 8 overview + Story 8.2 AC: 4-step finale, FR52, FR43, NFR1, NFR14]
- [Source: prd.md — FR52 (finale sequence), FR43 (North Star feedback 1-5), NFR14 (single-tap), NFR1 (200ms sync)]
- [Source: architecture.md — DJ engine finale state (terminal), session-manager orchestration, socket handler pattern, feedback_score column]
- [Source: ux-design-specification.md lines 191, 442, 826, 2711, 2857, 2924 — Finale wireframe, graduated celebration, audio-first transitions, no hard deadline]
- [Source: services/session-manager.ts lines 1722-1810 — endSession() current flow with 25+ cleanup calls]
- [Source: services/event-stream.ts — SessionEvent union (56 types), getEventStream(), flushEventStream()]
- [Source: socket-handlers/host-handlers.ts line 128 — HOST_END_PARTY handler calls endSession then emits party:ended]
- [Source: socket-handlers/connection-handler.ts lines 31-33 — hostTransferTimers + cleanupTimers NOT cleaned in endSession]
- [Source: flutter/widgets/icebreaker_overlay.dart — Full-screen overlay + animation reference pattern]
- [Source: flutter/screens/party_screen.dart line 198, 278-295 — Host controls disabled during finale, overlay rendering pattern]
- [Source: flutter/state/party_provider.dart lines 944-950, 1215-1238 — clearCeremonyState and onSessionEnded cleanup patterns]
- [Source: 8-1-end-of-night-awards-generation.md — Story 8.1 contract: FinaleAward[], broadcastFinaleAwards, finaleAwards cache]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Split `endSession` into `initiateFinale` + `finalizeSession`. Added finalization timer (5min), `clearFinalizationTimer`, `clearSessionTimers` from connection-handler. HOST_END_PARTY now calls `initiateFinale`, HOST_DISMISS_FINALE added for early finalization.
- Task 2: Implemented `calculateSessionStats` (scans event stream for reactions, sounds, cards, derives top reactor and longest streak from DJ context) and `buildFinaleSetlist` (correlates dj:stateChanged song transitions with song:detected and ceremony:awardGenerated events). Added `SessionStats` and `SetlistEntry` types.
- Task 3: Added FINALE_STATS, FINALE_SETLIST, FINALE_FEEDBACK, HOST_DISMISS_FINALE event constants. Added `broadcastFinaleStats` and `broadcastFinaleSetlist` to dj-broadcaster. Added Zod schemas and `finale:feedbackReceived` event type.
- Task 4: Created `finale-handlers.ts` with feedback rate limiting (one per user per session), `saveFeedback` in session-manager (fire-and-forget DB write + event stream append), `updateFeedbackScore` in session-repository.
- Task 5: Created `FinaleOverlay` (4-step sequence orchestrator with AnimatedSwitcher transitions), `AwardsParadeWidget` (sequential award reveal with sound cues, auto-scroll, reduced-motion support).
- Task 6: Created `SessionStatsWidget` (stat cards in grid layout), `FinaleSetlistWidget` (scrollable song list with share_plus text sharing), `FeedbackPromptWidget` (1-5 emoji scale, single-tap, Leave Party navigation). Added `SoundCue.finaleAwardReveal` mapped to ceremony_start.opus placeholder.
- Task 7: Added `finaleStats`, `finaleSetlist`, `finaleCurrentStep`, `feedbackSubmitted` to PartyProvider with setters and `_clearFinaleState()`. Added socket listeners for `finale:stats` and `finale:setlist`. Added `submitFeedback` and `emitHostDismissFinale` emitters. Added FinaleOverlay rendering in party_screen when djState == finale.
- Task 8: Server: 8 unit tests for stats/setlist calculation via initiateFinale, 11 tests for finale-handlers feedback. Flutter: 5 widget tests for FinaleOverlay, 5 provider state tests, 4 SessionStats model tests, 3 SetlistEntry model tests, 2 sound cue tests. All pass.

### Change Log

- 2026-03-20: Implemented Story 8.2 — Finale Ceremony Sequence (all 8 tasks complete)
- 2026-03-20: Code review fixes applied (8 issues):
  - [C1] Created missing session-manager-finale-sequence.test.ts (8 tests for initiateFinale/finalizeSession)
  - [C2] Added Flutter socket listener parsing tests in party_provider_test.dart (4 tests)
  - [H1] Added auto-advance timer from setlist (step 2) to feedback (step 3) after 18s in finale_overlay.dart
  - [H2] Fixed memory leak: clearFeedbackTracking now called in finalizeSession cleanup
  - [H3] Replaced manual validation with feedbackPayloadSchema Zod validation in finale-handlers.ts
  - [M1] saveFeedback internals now covered via initiateFinale integration tests
  - [M2] Added @deprecated JSDoc to endSession legacy alias with behavioral change documentation
  - [M3] Removed dead ceremony:revealed no-op loop in buildFinaleSetlist

### File List

**Server (modified)**
- apps/server/src/services/session-manager.ts
- apps/server/src/services/dj-broadcaster.ts
- apps/server/src/services/event-stream.ts
- apps/server/src/shared/events.ts
- apps/server/src/shared/schemas/finale-schemas.ts
- apps/server/src/socket-handlers/connection-handler.ts
- apps/server/src/socket-handlers/host-handlers.ts
- apps/server/src/persistence/session-repository.ts

**Server (new)**
- apps/server/src/socket-handlers/finale-handlers.ts

**Flutter (modified)**
- apps/flutter_app/lib/state/party_provider.dart
- apps/flutter_app/lib/socket/client.dart
- apps/flutter_app/lib/screens/party_screen.dart
- apps/flutter_app/lib/audio/sound_cue.dart
- apps/flutter_app/lib/constants/copy.dart

**Flutter (new)**
- apps/flutter_app/lib/models/session_stats.dart
- apps/flutter_app/lib/models/setlist_entry.dart
- apps/flutter_app/lib/widgets/finale_overlay.dart
- apps/flutter_app/lib/widgets/awards_parade_widget.dart
- apps/flutter_app/lib/widgets/session_stats_widget.dart
- apps/flutter_app/lib/widgets/finale_setlist_widget.dart
- apps/flutter_app/lib/widgets/feedback_prompt_widget.dart

**Tests (new)**
- apps/server/tests/services/session-stats.test.ts
- apps/server/tests/services/session-manager-finale-sequence.test.ts
- apps/server/tests/socket-handlers/finale-handlers.test.ts
- apps/flutter_app/test/models/session_stats_test.dart
- apps/flutter_app/test/models/setlist_entry_test.dart
- apps/flutter_app/test/widgets/finale_overlay_test.dart

**Tests (modified)**
- apps/server/tests/services/session-manager-dj.test.ts
- apps/server/tests/services/session-manager-capture.test.ts
- apps/server/tests/services/session-manager-dare-pull.test.ts
- apps/server/tests/services/session-manager-icebreaker.test.ts
- apps/server/tests/services/session-manager-interlude-game.test.ts
- apps/server/tests/services/session-manager-quick-vote.test.ts
- apps/server/tests/services/session-manager-quickpick.test.ts
- apps/server/tests/services/session-manager-singalong.test.ts
- apps/server/tests/services/session-manager-tv.test.ts
- apps/server/tests/socket-handlers/host-handlers.test.ts
- apps/flutter_app/test/audio/sound_cue_test.dart
- apps/flutter_app/test/state/party_provider_test.dart

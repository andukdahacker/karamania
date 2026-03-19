# Story 8.1: End-of-Night Awards Generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to generate end-of-night awards that recognize all types of contributions,
So that every participant feels valued whether they sang, cheered, or played along.

## Acceptance Criteria

1. **Given** a party session is ending, **When** end-of-night awards are generated, **Then** awards recognize both singing and non-singing contributions (FR41) **And** every participant receives at least one end-of-night award — including participants who joined but never interacted (zero events)
2. **Given** the award generation runs, **When** it consumes participation data, **Then** it uses participation scores from the scoring system (FR40) across all three tiers (passive=1pt, active=3pt, engaged=5pt) to determine award categories
3. **Given** the award generation runs, **When** it analyzes party card data, **Then** it considers card challenge data from Epic 4 — scanning the event stream for `card:accepted` and `card:dismissed` events per user (NOT from `cardStatsCache` which is session-level only) — to generate card-related awards
4. **Given** the award generation runs, **When** it analyzes the event stream, **Then** it uses the event stream from Epic 2 (FR42) for session activity analysis including reaction counts, streak data, soundboard usage, vote participation, and song history
5. **Given** award generation completes, **When** the finale sequence is ready to begin, **Then** all end-of-night awards are generated server-side within 2 seconds of END_PARTY transition, BEFORE the finale sequence starts (FR52) **And** awards are broadcast to all clients as structured data including recipient display names for Story 8.2 rendering
6. **Given** any participant, **When** end-of-night awards are generated, **Then** non-performers receive awards celebrating character traits and participation style — never penalizing lack of singing (Vietnamese face-saving culture: "Enigmatic Presence" not "The Silent One") **And** non-singing awards are equally prestigious to singing awards (UX: "Hype Lord" is as cool as "Vocal Assassin")
7. **Given** edge cases occur, **When** nobody completed any cards **Then** the `socialButterfly` category is skipped and those participants receive awards from other eligible categories **When** only 1 person sang **Then** `crowdFavorite` is assigned to the performer with the most reactions received overall **When** a participant has zero event stream entries **Then** they receive a character-trait award from the `everyone` category

## Tasks / Subtasks

- [x] Task 1: Define end-of-night award types and template pool (AC: #1, #6)
  - [x] 1.1 Create `apps/server/src/services/finale-award-generator.ts` — NEW service for end-of-night awards (separate from per-song `award-generator.ts`)
  - [x] 1.2 Define `FinaleAwardCategory` enum: `performer` (sang songs), `hypeLeader` (most reactions sent), `socialButterfly` (most card completions), `crowdFavorite` (received most reactions during songs), `partyStarter` (highest participation score), `vibeKeeper` (most diverse activity types across session — measured by distinct action categories used: reactions, soundboard, voting, cards, captures), `everyone` (participation award for all). Categories are skippable when no qualifying data exists (e.g., `socialButterfly` skipped if zero cards dealt)
  - [x] 1.3 Create finale award template pool (minimum 35 templates) with explicit category distribution: 6 performer, 5 hypeLeader, 4 socialButterfly, 4 crowdFavorite, 4 partyStarter, 4 vibeKeeper, 8 everyone (character-trait). Tone distribution per category: mix of comedic/hype/absurd/wholesome — ensure `everyone` templates are equally prestigious, not "consolation prize" framing. Reuse `AwardTone` type from existing `award-generator.ts`
  - [x] 1.4 Ensure all templates for non-performers celebrate character traits, not absence of singing (face-saving principle). Examples: "Enigmatic Presence", "The Cool Observer", "Most Mysterious Energy", "Vibe Architect", "Silent Force", "The Anchor". Score-categorized: high participation score → impressive titles ("Hype Lord", "Party Engine"), low participation score → character celebrations ("Enigmatic Presence", "The Zen Master"). NEVER reference performance failure or skill level

- [x] Task 2: Build session analysis engine (AC: #2, #3, #4)
  - [x] 2.1 Create `analyzeSessionForAwards(sessionId: string)` function that aggregates data from three sources:
    - Event stream: `getEventStream(sessionId)` from `event-stream.ts` — scan for reaction counts per user, card events, song events, streaks, soundboard usage, vote participation. **Card data MUST come from event stream scanning** (`card:accepted`, `card:dismissed` events per user), NOT from `cardStatsCache` which only stores session-level totals `{ dealt, accepted }` without per-user breakdown
    - Participation scores: from score cache (`scoreCache` Map in session-manager, key pattern `${sessionId}:${userId}`) or DB fallback via `sessionRepo.getParticipants(sessionId)`
    - Per-song awards: from `sessionAwards` Map in session-manager (key: sessionId → string[] of awarded titles)
  - [x] 2.2 Define `SessionAnalysis` interface containing per-participant stats: `{ userId: string, displayName: string, participationScore: number, reactionsSent: number, reactionsReceived: number, songsPerformed: number, cardsAccepted: number, cardsCompleted: number, streakMax: number, soundboardUses: number, votesParticipated: number, distinctActionCategories: number, perSongAwards: string[] }` — `displayName` is required for Story 8.2 rendering, `distinctActionCategories` drives `vibeKeeper` assignment
  - [x] 2.3 Implement event stream scanning: iterate through `SessionEvent[]` array, build per-user stats by matching `userId` fields across event types. **Correct event names**: `reaction:sent`, `card:accepted`, `card:dismissed`, `participation:scored`, `ceremony:awardGenerated`, `sound:play` (NOT `sound:played`), `dj:stateChanged`. Note: `card:completed` event type does NOT exist in the current SessionEvent union — card completion must be inferred from `card:accepted` events (a card accepted = challenge taken on). If `card:completed` is added to event-stream.ts during this story, add the type to the SessionEvent union first

- [x] Task 3: Implement award assignment algorithm (AC: #1, #2, #3, #5, #6)
  - [x] 3.1 Create `generateFinaleAwards(analysis: SessionAnalysis[], participantCount: number)` — returns `FinaleAward[]` where each participant gets 1-3 awards
  - [x] 3.2 Award assignment rules:
    - Step 1: Assign category-specific awards to top performers in each category. "Top" = highest absolute value in that metric. Ties broken by higher participation score, then random. Skip category if no qualifying data (e.g., skip `socialButterfly` if zero cards dealt in session). Assignments: highest reactionsSent → hypeLeader, most cardsAccepted → socialButterfly, most reactionsReceived → crowdFavorite, highest participationScore → partyStarter, highest distinctActionCategories → vibeKeeper
    - Step 2: Assign performer awards to anyone who sang (using per-song awards as context — e.g., "Tonight's Headliner" for most songs, "One-Hit Wonder" for exactly 1 song)
    - Step 3: Assign character-trait awards to anyone not yet awarded — use `everyone` category templates. High participation score (>= 75th percentile) → impressive titles ("Party Engine", "Hype Lord"). Low participation score (< 25th percentile) → character celebrations ("Enigmatic Presence", "The Zen Master"). Middle → contextual based on their top activity type
    - Step 4: Guarantee EVERY participant has at least 1 award. The `everyone` category is the safety net but its templates are equally prestigious — not consolation prizes
  - [x] 3.3 Use weighted random selection. **CRITICAL**: `weightedRandomSelect` in `award-generator.ts` is NOT exported — either export it first or copy the implementation into `finale-award-generator.ts`. Dedup rules: exact title match, per-user scope (same user can't get same title twice across per-song + finale awards), session-wide for finale batch (no two participants get same finale title). If all templates in a category are exhausted, fall back to `everyone` category templates
  - [x] 3.4 Define `FinaleAward` interface: `{ userId: string, displayName: string, category: FinaleAwardCategory, title: string, tone: AwardTone, reason: string }` — `displayName` included for Story 8.2 rendering without extra lookups. `reason` is a data-driven one-liner (e.g., "Sent 47 reactions tonight", "Accepted 3 dares"). Max 60 characters for mobile display. Reasons must be specific (names, counts, song titles) per UX spec: "Specific = 'I want that'"

- [x] Task 4: Integrate with session end flow (AC: #5)
  - [x] 4.1 In `session-manager.ts`, add `generateEndOfNightAwards(sessionId: string)` orchestration function
  - [x] 4.2 Call this function in `endSession()` AFTER the `END_PARTY` transition to finale state but BEFORE flushing event stream to DB (awards need to read the in-memory event stream)
  - [x] 4.3 Store generated awards in a new in-memory cache: `const finaleAwards = new Map<string, FinaleAward[]>()` — keyed by sessionId
  - [x] 4.4 Add `clearFinaleAwards(sessionId)` to session cleanup flow
  - [x] 4.5 Append `finale:awardsGenerated` event to event stream (with full awards array) BEFORE calling `flushEventStream`. Then persist awards to DB: update each participant's `top_award` to their primary (first) finale award (overwriting the per-song top_award — per-song awards preserved in event stream JSON for Epic 9 detail views)
  - [x] 4.6 Broadcast awards to ALL clients via new `broadcastFinaleAwards(sessionId, awards)` in `dj-broadcaster.ts` — emit single `finale:awards` event containing the complete `FinaleAward[]` array (all participants' awards). Payload includes `displayName` per award so clients can render the awards parade (Story 8.2) without additional lookups

- [x] Task 5: Add Socket.io event and schemas (AC: #5)
  - [x] 5.1 Add `finale:awards` event constant to `shared/events.ts`
  - [x] 5.2 Create `shared/schemas/finale-schemas.ts` with Zod schemas for `FinaleAward` (userId, displayName, category, title, tone, reason) and `FinaleAwardsPayload` (array of awards)
  - [x] 5.3a Add `finale:awardsGenerated` event type to `SessionEvent` union in `event-stream.ts`: `{ type: 'finale:awardsGenerated'; ts: number; data: { awards: Array<{ userId: string; title: string; category: string }> } }`
  - [x] 5.4 No REST endpoint needed — this is purely Socket.io driven during live session

- [x] Task 6: Flutter state consumption (AC: #5)
  - [x] 6.1 Add `FinaleAward` model to `apps/flutter_app/lib/models/finale_award.dart` — mirror server `FinaleAward` shape in camelCase: `userId`, `displayName`, `category`, `title`, `tone`, `reason`. Use null-safe `fromJson` factory (code review tip from 7.2)
  - [x] 6.2 Add `finaleAwards` field to `PartyProvider` — `List<FinaleAward>?`, set on `finale:awards` event
  - [x] 6.3 Add `finale:awards` listener in `SocketClient` — parse payload, call `partyProvider.setFinaleAwards(awards)`
  - [x] 6.4 Add `clearFinaleAwards()` to party provider reset (when leaving party)

- [x] Task 7: Tests (AC: #1-6)
  - [x] 7.1 Unit tests for `finale-award-generator.ts`: template pool validity (min 30, all categories covered, all tones present), award generation with various session profiles (all-singers, no-singers, mixed, solo participant), dedup against per-song awards, every-participant guarantee
  - [x] 7.2 Unit tests for session analysis: event stream scanning correctness, handling empty events, handling missing participants
  - [x] 7.3 Integration tests in `session-manager-finale.test.ts`: end-session generates awards before event stream flush, awards broadcast to clients, cleanup on session end, awards persist to DB
  - [x] 7.4 Flutter widget tests: PartyProvider receives and stores finale awards, SocketClient listener parsing, clear on party leave
  - [x] 7.5 Mock compatibility: add `finale-award-generator.js` mock to ALL existing session-manager test files that mock services (ceremony, interlude-game, dare-pull, quick-vote, singalong, icebreaker — 6 files)

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL award generation happens on the server. Flutter receives structured award data and renders it — ZERO award logic in Dart
- **DJ engine purity**: The DJ engine only transitions to `finale` state. All award orchestration lives in session-manager, not the engine. The `finale` state has no transitions out — it's a terminal state
- **Boundary rules**: `finale-award-generator.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Session-manager orchestrates. This follows the same pattern as `award-generator.ts`, `icebreaker-dealer.ts`, etc.
- **Event stream consumption, not modification**: The finale award generator READS the event stream (via `getEventStream`) but does NOT modify it. Session-manager appends the `finale:awardsGenerated` event after generation completes

### Key Design Decisions

**Why a separate service from `award-generator.ts`?**
The existing `award-generator.ts` generates per-song awards using a single performer's context (song position, reactions during that song, card completion during that song). End-of-night awards analyze the ENTIRE session across ALL participants simultaneously — fundamentally different input shape, output shape, and algorithm. Sharing templates would couple two different concerns. The only reuse is `AwardTone` type and `weightedRandomSelect` utility.

**Why generate awards BEFORE flushing event stream?**
The event stream is the richest data source for award analysis. Once `flushEventStream()` is called, the in-memory array is cleared. The generation MUST happen while the event stream is still in memory. Sequence: END_PARTY transition → generate awards → append `finale:awardsGenerated` event → flush event stream → cleanup.

**Why overwrite `top_award` with finale award?**
The `session_participants.top_award` column stores a single string. During the session, it's updated per-song (fire-and-forget). At session end, the finale award is more meaningful for the Session Timeline display (Epic 9). The per-song awards are preserved in the event stream JSON for detailed views.

**Why in-memory cache for finale awards?**
The awards need to be available for the finale ceremony sequence (Story 8.2) which broadcasts them step-by-step. Storing in a Map keyed by sessionId follows the established pattern (scoreCache, sessionAwards, cardStatsCache).

### Critical Integration Points

**Event stream event types to scan** (from `event-stream.ts` SessionEvent union — 52 total event types):
- `reaction:sent` — userId, emoji, streak → count per user, max streak per user
- `card:accepted` / `card:dismissed` / `card:dealt` / `card:redealt` / `card:groupActivated` — userId, cardId, cardType → per-user acceptance count. **NOTE: `card:completed` does NOT exist in SessionEvent union** — infer completion from `card:accepted` (accepted = challenge taken on)
- `participation:scored` — userId, action, tier, points, totalScore → participation breakdown by tier
- `ceremony:awardGenerated` — userId, award, songPosition, ceremonyType → per-song award history
- `sound:play` — userId → soundboard usage count. **CORRECT NAME: `sound:play` NOT `sound:played`**
- `dj:stateChanged` — from/to states → derive song count (count transitions to `DJState.song`)
- `song:detected` — title, artist → setlist for context
- `party:ended` — songCount, duration → session summary stats

**Session-manager in-memory caches to access:**
- `scoreCache: Map<string, number>` — key pattern `${sessionId}:${userId}` → current participation score
- `sessionAwards: Map<string, string[]>` — sessionId → all awarded titles this session (for dedup)
- `cardStatsCache: Map<string, { dealt: number; accepted: number }>` — key pattern is **sessionId only** (session-level totals, NOT per-user). **Do NOT use for per-user card stats** — scan event stream instead

**Timing in endSession() flow** (current code ~line 1700+):
```
1. Verify host authorization
2. Get DJ context
3. Clear pause state if paused
4. processDjTransition(END_PARTY) → finale state
5. Append party:ended event
6. Append card:sessionStats event
7. ← INSERT: generateEndOfNightAwards(sessionId) HERE (reads in-memory event stream)
8. ← INSERT: append finale:awardsGenerated event HERE (awards data included in event)
9. ← INSERT: broadcastFinaleAwards(sessionId, awards) HERE (clients receive before flush)
10. flushEventStream → DB write (includes the awardsGenerated event)
11. Update session status = 'ended'
12. Clean up in-memory state (including clearFinaleAwards)
```

### Reuse Patterns from Previous Stories (DO NOT REINVENT)

| Existing Pattern | Story 8.1 Usage |
|---|---|
| `award-generator.ts` `AwardTone` type | Reuse for finale award tones |
| `award-generator.ts` `weightedRandomSelect()` | **NOT EXPORTED** — must export it first or copy the ~12-line implementation into finale-award-generator.ts |
| `event-stream.ts` `getEventStream(sessionId)` | Read event stream for analysis |
| `session-manager.ts` `buildAwardContext()` pattern | Similar aggregation pattern for session analysis |
| `session-manager.ts` `countRecentReactions()` pattern | Extend to count ALL reactions per user across full session |
| `session-manager.ts` `checkCardCompletion()` | Reference only — currently returns `false` always. For finale awards, infer card completion from `card:accepted` events in event stream instead |
| `dj-broadcaster.ts` broadcast pattern | Follow for `broadcastFinaleAwards` |
| `shared/events.ts` event constant pattern | Follow for `finale:awards` |
| Score cache access pattern in `recordParticipationAction` | Read scores from cache for analysis |
| In-memory Map cleanup pattern (clearSessionAwards, etc.) | Follow for `clearFinaleAwards` |

### Story 8.2 Data Contract (What This Story Must Provide)

Story 8.2 (Finale Ceremony Sequence) will consume the output of this story. The `finale:awards` broadcast payload and `finaleAwards` in-memory cache MUST provide:
- **Complete `FinaleAward[]` array** with all participants' awards in a single broadcast event
- **`displayName` per award** — Story 8.2 renders "Duc — Crowd Whisperer" without additional DB lookups
- **`reason` per award** — Story 8.2 shows why each award was given ("Sent 47 reactions")
- **Award ordering**: Array should be ordered by category priority (performer first, then hypeLeader, socialButterfly, crowdFavorite, partyStarter, vibeKeeper, everyone last). Within category, order by participation score descending. Story 8.2 will animate awards in this order ("awards parade — each award slides in with a sound cue, 2-3 seconds each, building tempo" per UX spec)
- **In-memory cache persistence**: `finaleAwards` Map must remain populated until `clearFinaleAwards()` is called during session cleanup — Story 8.2's finale sequence may need to re-read awards during the 60-90s finale window

### What This Story Does NOT Include (Scope Boundaries)

- NO new database tables or columns — uses existing `session_participants.top_award` and `sessions.event_stream`
- NO new DJ engine states or transitions — finale state already exists (added in Epic 2)
- NO Flutter UI for displaying awards — that's Story 8.2 (Finale Ceremony Sequence)
- NO REST endpoints — awards are generated and broadcast via Socket.io during live session only
- NO setlist poster generation — that's Story 8.3
- NO session summary persistence logic — that's Story 8.4
- NO changes to per-song award generation logic — `award-generator.ts` only gets `weightedRandomSelect` exported (no algorithm changes)
- NO localization — English only (post-MVP)
- NO award customization by host — fully automatic

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/finale-award-generator.ts` | NEW — Finale award templates, session analysis, award assignment algorithm |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add generateEndOfNightAwards orchestration, finaleAwards cache, integrate into endSession flow |
| `apps/server/src/services/dj-broadcaster.ts` | MODIFY — Add broadcastFinaleAwards(sessionId, awards) |
| `apps/server/src/services/award-generator.ts` | MODIFY — Export `weightedRandomSelect` function (currently private). No other changes |
| `apps/server/src/services/event-stream.ts` | MODIFY — Add `finale:awardsGenerated` event type to `SessionEvent` union |
| `apps/server/src/shared/events.ts` | MODIFY — Add FINALE_AWARDS event constant |
| `apps/server/src/shared/schemas/finale-schemas.ts` | NEW — Zod schemas for FinaleAward, FinaleAwardsPayload |
| `apps/flutter_app/lib/models/finale_award.dart` | NEW — FinaleAward model (camelCase) |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add finaleAwards field, setFinaleAwards(), clearFinaleAwards() |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add finale:awards listener |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add finale award strings if needed |
| `apps/server/tests/services/finale-award-generator.test.ts` | NEW — Unit tests for award generation |
| `apps/server/tests/services/session-manager-finale.test.ts` | NEW — Integration tests for end-session award flow |
| `apps/flutter_app/test/state/party_provider_test.dart` | MODIFY — Add finale award tests |

### Testing Strategy

- **Finale award generator unit tests** — Template pool: min 35 templates, all 7 categories covered (minimum per-category counts met), all tones present, no duplicate titles, `everyone` templates are character-trait only (no performance references). Generation: various session profiles (all-singers, no-singers, mixed, solo), dedup against per-song awards (exact title match), session-wide dedup in batch, every-participant guarantee, category assignment correctness, category skipping when no data (zero cards → no socialButterfly). Edge cases: 1 participant, 12 participants, 0 songs sung, 20+ songs, participant with zero events, all participants tied on a metric
- **Session analysis unit tests** — Event stream scanning: correct per-user aggregation, handles empty event stream, handles participants with no events, handles missing event fields gracefully
- **Session manager integration tests** — End-session: awards generated before event stream flush, finaleAwards cache populated, awards broadcast via finale:awards event, top_award updated in DB, cleanup clears finaleAwards cache. Error handling: award generation failure doesn't block session end
- **Flutter tests** — PartyProvider: setFinaleAwards stores correctly, clearFinaleAwards resets to null. SocketClient: finale:awards event parsed and forwarded to provider
- **Mock compatibility** — Add `finale-award-generator.js` mock to 6 existing session-manager test files: `session-manager-awards.test.ts`, `session-manager-interlude-game.test.ts`, `session-manager-dare-pull.test.ts`, `session-manager-quick-vote.test.ts`, `session-manager-singalong.test.ts`, `session-manager-icebreaker.test.ts` (note: filenames use hyphens, not underscores)
- **award-generator.ts export test** — Verify `weightedRandomSelect` is now exported and existing tests still pass after the export change
- **DO NOT test**: Animation timings, color values, font styling, visual effects, confetti

### Previous Story Intelligence (Stories 7.1–7.6 Learnings)

- **Mock compatibility (7.3, 7.5, 7.6)**: When adding a new service import to session-manager, add the mock to ALL session-manager test files. Story 7.6 added icebreaker-dealer mock to 5 files. This story must add finale-award-generator mock to 6 files. Test filenames use hyphens: `session-manager-interlude-game.test.ts` (not `interlude.test.ts`)
- **Code review tip (7.1)**: Add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads
- **Code review tip (7.2)**: Extract hardcoded durations to named constants. Use null-safe `fromJson` factories in Dart
- **Code review tip (7.4)**: Be precise with duration semantics in event payloads
- **Fire-and-forget persistence**: `updateTopAward` is async fire-and-forget — don't await it in the hot path. Follow existing pattern
- **Error isolation**: Award generation failure must NOT prevent session from ending. Wrap in try/catch, log error, continue with session teardown

### Project Structure Notes

- `snake_case` for DB columns (no new columns in this story)
- `camelCase` for Socket.io event payloads (Zod schemas) and Dart models
- `kebab-case` for TS filenames: `finale-award-generator.ts`, `finale-schemas.ts`
- `snake_case` for Dart filenames: `finale_award.dart`
- Socket events: `finale:awards` — uses `finale` namespace per event catalog pattern
- All copy in `constants/copy.dart` if string constants needed
- Relative imports with `.js` extension in server code
- No barrel files

### References

- [Source: epics.md line 1548 — Story 8.1 AC: end-of-night awards, singing + non-singing, participation scores, party card data, event stream]
- [Source: epics.md line 417 — Epic 8 overview: 4-step finale, event stream + participation scores consumed]
- [Source: prd.md — FR41: end-of-night awards recognizing singing and non-singing contributions]
- [Source: prd.md — FR40: weighted participation scores, three tiers (passive/active/engaged)]
- [Source: prd.md — FR42: structured event stream with schema {sessionId, userId, eventType, timestamp, metadata}]
- [Source: prd.md — FR52: 4-step finale sequence, 60-90s duration]
- [Source: architecture.md — Event stream: in-memory array during session, batch write at session end]
- [Source: architecture.md — services/award-generator.ts: existing per-song award service]
- [Source: architecture.md — services/event-stream.ts: in-memory event accumulator]
- [Source: architecture.md — session_participants.top_award: single award column per participant]
- [Source: architecture.md — sessions.event_stream: JSONB column for full event log]
- [Source: ux-design-specification.md line 191 — Finale: awards parade → setlist poster → share + feedback. 60s sequence]
- [Source: ux-design-specification.md line 826 — Awards are context-driven, not audience-voted. Pure celebration, zero performance judgment]
- [Source: ux-design-specification.md line 219 — Vietnamese face-saving: awards celebrate character traits, never penalize]
- [Source: services/award-generator.ts — AwardTone type, AwardTemplate interface, weightedRandomSelect, 24 per-song templates]
- [Source: services/event-stream.ts — SessionEvent union type (52 events), getEventStream(), flushEventStream(). NOTE: `card:completed` not in union, `sound:play` not `sound:played`]
- [Source: services/session-manager.ts — endSession flow, scoreCache, sessionAwards, buildAwardContext pattern]
- [Source: services/participation-scoring.ts — ACTION_TIER_MAP, calculateScoreIncrement, three tiers]
- [Source: services/party-card-pool.ts — PartyCard interface, card types (vocal/performance/group)]
- [Source: dj-engine/types.ts — DJState.finale: terminal state, no transitions out]
- [Source: 7-6-first-session-icebreaker.md — Mock compatibility pattern, previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Created `finale-award-generator.ts` with `FinaleAwardCategory` enum (7 categories), 35 `FinaleAwardTemplate` entries meeting all per-category minimums (6 performer, 5 hypeLeader, 4 socialButterfly, 4 crowdFavorite, 4 partyStarter, 4 vibeKeeper, 8 everyone). All tones represented. `everyone` templates use character-trait framing only — no performance references. Exported `weightedRandomSelect` from `award-generator.ts`.
- Task 2: Implemented `analyzeSessionForAwards()` — scans event stream for per-user stats (reactions sent/received, cards accepted, songs performed, soundboard uses, votes, distinct action categories). Correctly uses `card:accepted` events (not `cardStatsCache`), `ceremony:awardGenerated` for performer tracking, and `sound:play` (not `sound:played`).
- Task 3: Implemented `generateFinaleAwards()` with 4-step algorithm: (1) category-specific awards to top performers, (2) performer awards to singers, (3) character-trait awards for unawarded participants, (4) every-participant guarantee. Dedup against per-song awards and session-wide. Awards sorted by category priority then participation score descending. Reasons are data-driven with 60-char max.
- Task 4: Integrated into `session-manager.ts` — `generateEndOfNightAwards()` orchestration function reads event stream, participants, and per-song awards. Called in `endSession()` AFTER card:sessionStats but BEFORE flushEventStream. `finaleAwards` in-memory cache added. `clearFinaleAwards()` in cleanup flow. Error-isolated with try/catch. `updateTopAward` fire-and-forget for primary award per user.
- Task 5: Added `FINALE_AWARDS` event constant to `shared/events.ts`. Created `shared/schemas/finale-schemas.ts` with Zod schemas (`.min(1)` validation). Added `finale:awardsGenerated` to `SessionEvent` union in `event-stream.ts`.
- Task 6: Created `FinaleAward` Dart model with null-safe `fromJson`. Added `finaleAwards` field to `PartyProvider` with `setFinaleAwards()`, `clearFinaleAwards()`, cleared on `onSessionEnded()`. Added `finale:awards` listener in `SocketClient`.
- Task 7: 30 unit tests for finale-award-generator (template pool, session analysis, award generation). 4 integration tests for session-manager finale flow. 4 Flutter tests for PartyProvider finale awards. Mock compatibility added to 6 existing session-manager test files. All 95 server test files pass (1306 tests). Flutter tests pass with 0 new failures.

### Change Log

- 2026-03-19: Implemented Story 8.1 — End-of-Night Awards Generation (all 7 tasks)
- 2026-03-19: Code review fixes — 9 issues (1H, 5M, 3L): H1 crowdFavorite sole-singer edge case, M1 score-based prestige routing for everyone templates, M2 specific reasons for everyone awards, M3 removed unsafe type cast in selectFromPool, M4 auto-fixed by M3, M5 added SocketClient finale:awards parsing tests, L1 accepted (valid pattern), L2 fixed Step C→D comment, L3 fixed per-song dedup to per-user scope

### File List

**New files:**
- `apps/server/src/services/finale-award-generator.ts` — Finale award types, session analysis, generation algorithm
- `apps/server/src/shared/schemas/finale-schemas.ts` — Zod schemas for FinaleAward, FinaleAwardsPayload
- `apps/flutter_app/lib/models/finale_award.dart` — FinaleAward Dart model
- `apps/server/tests/services/finale-award-generator.test.ts` — Unit tests (30 tests)
- `apps/server/tests/services/session-manager-finale.test.ts` — Integration tests (4 tests)

**Modified files:**
- `apps/server/src/services/award-generator.ts` — Exported `weightedRandomSelect`
- `apps/server/src/services/event-stream.ts` — Added `finale:awardsGenerated` to SessionEvent union
- `apps/server/src/services/session-manager.ts` — Added `generateEndOfNightAwards`, `finaleAwardsCache`, integrated into `endSession`
- `apps/server/src/services/dj-broadcaster.ts` — Added `broadcastFinaleAwards`
- `apps/server/src/shared/events.ts` — Added `FINALE_AWARDS` constant
- `apps/flutter_app/lib/state/party_provider.dart` — Added `finaleAwards`, `setFinaleAwards()`, `clearFinaleAwards()`
- `apps/flutter_app/lib/socket/client.dart` — Added `finale:awards` listener
- `apps/flutter_app/test/state/party_provider_test.dart` — Added 4 finale award tests
- `apps/server/tests/services/session-manager-awards.test.ts` — Added finale-award-generator mock + broadcastFinaleAwards mock
- `apps/server/tests/services/session-manager-interlude-game.test.ts` — Added finale-award-generator mock + broadcastFinaleAwards mock
- `apps/server/tests/services/session-manager-dare-pull.test.ts` — Added finale-award-generator mock + broadcastFinaleAwards mock
- `apps/server/tests/services/session-manager-quick-vote.test.ts` — Added finale-award-generator mock + broadcastFinaleAwards mock
- `apps/server/tests/services/session-manager-singalong.test.ts` — Added finale-award-generator mock + broadcastFinaleAwards mock
- `apps/server/tests/services/session-manager-icebreaker.test.ts` — Added finale-award-generator mock + broadcastFinaleAwards mock
- `apps/flutter_app/test/socket/client_test.dart` — Added 3 finale:awards parsing tests (code review fix M5)

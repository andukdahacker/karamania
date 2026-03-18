# Story 7.1: Democratic Activity Voting

Status: done

## Story

As a party group,
I want to vote on what activity happens next between songs,
So that the group collectively shapes the party experience.

## Acceptance Criteria

1. **Given** the DJ engine reaches an interlude state, **When** the system presents options, **Then** 2-3 activity options are displayed for democratic voting (FR13) **And** votes from all present participants are counted without race conditions or vote loss (NFR11)
2. **Given** the session is in its first 30 minutes, **When** the DJ engine selects activities, **Then** universal participation activities are front-loaded — prioritized over activities that single out individuals (FR15)
3. **Given** fewer than 3 participants are in the party, **When** the DJ state machine evaluates the interlude step, **Then** the interlude is skipped entirely (NFR12) — this already exists in `dj-engine/states.ts` degradation rules
4. **Given** a vote round is active, **When** a participant casts a vote, **Then** the vote is idempotent (last vote wins) and the updated tally is broadcast to all participants in real time
5. **Given** the vote timer expires, **When** votes are tallied, **Then** the activity with the most votes wins (tiebreaker: random selection) and the result is broadcast

## Tasks / Subtasks

- [x] Task 1: Create activity selection service (AC: #1, #2, #5)
  - [x] 1.1 Create `apps/server/src/services/activity-voter.ts` with `ActivityVoteRound` interface and module-level session Map
  - [x] 1.2 Implement `selectActivityOptions(sessionId, participantCount, sessionStartedAt)` — returns 2-3 options using weighted random, no immediate repeats, front-loading rules
  - [x] 1.3 Implement `startVoteRound(sessionId, options, participantCount)` — initializes round with options map
  - [x] 1.4 Implement `recordVote(sessionId, userId, optionId)` — idempotent vote recording, returns `{ recorded, voteCounts, winner }`
  - [x] 1.5 Implement `resolveByTimeout(sessionId)` — pick highest-voted option, random tiebreaker
  - [x] 1.6 Implement `clearSession(sessionId)` — cleanup on session end (clears round AND lastSelectedActivity for session)
  - [x] 1.7 Implement `resetAllRounds()` — test utility to clear module-level Maps between tests
  - [x] 1.8 Implement activity pool with front-loading logic: `kings_cup` and `quick_vote` are universal (first 30 min eligible), `dare_pull` is reserved (after 30 min only), `group_singalong` is universal
  - [x] 1.9 Track `lastSelectedActivity` per session (`Map<string, string>` at module level) — checked in `selectActivityOptions()` to prevent immediate repeats, cleared in `clearSession()`

- [x] Task 2: Create Zod schemas (AC: #1, #4)
  - [x] 2.1 Create `apps/server/src/shared/schemas/interlude-schemas.ts`
  - [x] 2.2 `activityVoteSchema` — `{ optionId: z.string() }`
  - [x] 2.3 `activityVoteBroadcastSchema` — `{ optionId, userId, displayName, voteCounts: Record<string, number> }`
  - [x] 2.4 `activityVoteStartedSchema` — `{ options: Array<{ id, name, description, icon }>, voteDurationMs, roundId }`
  - [x] 2.5 `activityVoteResultSchema` — `{ winningOptionId, voteCounts, totalVotes }`

- [x] Task 3: Add socket event constants and event stream types (AC: #1, #4)
  - [x] 3.1 Add to `apps/server/src/shared/events.ts`: `INTERLUDE_VOTE_STARTED: 'interlude:voteStarted'`, `INTERLUDE_VOTE: 'interlude:vote'`, `INTERLUDE_VOTE_RESULT: 'interlude:voteResult'`
  - [x] 3.2 Add `SessionEvent` union members: `'interlude:voteStarted'`, `'interlude:vote'`, `'interlude:voteResult'`

- [x] Task 4: Create interlude socket handler and register participation scoring (AC: #1, #4, #5)
  - [x] 4.1 Create `apps/server/src/socket-handlers/interlude-handlers.ts` with `registerInterludeHandlers(socket, io)`
  - [x] 4.2 Handle `interlude:vote` — Zod validate, guard DJ state === `interlude`, record vote, broadcast update, check winner, log event stream, participation scoring
  - [x] 4.3 Register handler in connection-handler.ts alongside existing handlers
  - [x] 4.4 Add `'interlude:vote': ParticipationTier.active` (3pts) to `ACTION_TIER_MAP` in `services/participation-scoring.ts` — this map is the ONLY place scoring tiers are defined; without this entry, votes score 0

- [x] Task 5: Integrate with session manager and DJ broadcaster (AC: #1, #2, #5)
  - [x] 5.1 Add `broadcastInterludeVoteStarted(sessionId, data)` and `broadcastInterludeVoteResult(sessionId, data)` to `dj-broadcaster.ts`
  - [x] 5.2 In `session-manager.ts`, add `onInterludeStateEntered(sessionId)` — calls `selectActivityOptions()`, `startVoteRound()`, broadcasts options, schedules vote timeout timer
  - [x] 5.3 On vote timeout or majority winner — call `resolveByTimeout()`, broadcast result, schedule short reveal delay, then trigger `INTERLUDE_DONE` transition
  - [x] 5.4 Wire `clearSession()` into session teardown (same pattern as `peak-detector`)

- [x] Task 6: Update DJ engine interlude state (AC: #1, #3)
  - [x] 6.1 In `dj-engine/states.ts`, set `isPlaceholder: false` on the interlude state config (currently `isPlaceholder: true` with TODO comment for Epic 7). Keep `hasTimeout: true` — the 15s DJ engine timeout serves as the authoritative vote window timer
  - [x] 6.2 Keep existing degradation rule (skip interlude when `participantCount < 3`) in `getNextCycleState()` — already implemented
  - [x] 6.3 Two-timer architecture: the **15s vote window** uses the DJ engine timer in `timers.ts` (already `15_000`). The **5s result reveal** is a separate `setTimeout` in session-manager (same pattern as ceremony: 2s anticipation + 10s reveal within one DJ timer). Do NOT try to configure two timers in the DJ engine

- [x] Task 7: Flutter interlude voting UI (AC: #1, #4, #5)
  - [x] 7.1 Create `apps/flutter_app/lib/widgets/interlude_vote_overlay.dart` — displays 2-3 activity options as large tappable cards with vote counts, countdown timer, and result reveal animation
  - [x] 7.2 Add interlude event listeners in `SocketClient` — `interlude:voteStarted`, `interlude:vote`, `interlude:voteResult`. Add `emitInterludeVote(String optionId)` emit method (follows `emitQuickPickVote()` pattern)
  - [x] 7.3 Add interlude state to `PartyProvider` — `interludeVoteOptions`, `interludeVoteCounts`, `interludeResult`, `interludeCountdown`, `myInterludeVote`. Add cleanup: clear all interlude fields in `onDjStateUpdate()` when state transitions away from `interlude` (follows existing pattern at lines ~750-761 for clearing Quick Pick state)
  - [x] 7.4 In `party_screen.dart`, show `InterludeVoteOverlay` when DJ state is `interlude` and vote data is available
  - [x] 7.5 Use `DJTokens` for all spacing/colors, `constants/copy.dart` for all strings

- [x] Task 8: Tests (AC: all)
  - [x] 8.1 `tests/services/activity-voter.test.ts` — option selection (weighted random, no repeats, front-loading within 30 min, dare exclusion within 30 min, participant count filtering), vote recording (idempotent, tally accuracy, winner detection, timeout resolution, tiebreaker randomness), session cleanup
  - [x] 8.2 `tests/socket-handlers/interlude-handlers.test.ts` — vote validation, state guard, broadcast verification, participation scoring, event stream logging
  - [x] 8.3 `apps/flutter_app/test/widgets/interlude_vote_overlay_test.dart` — renders options, handles tap, shows countdown, displays result

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL vote state lives on server. Flutter only sends `interlude:vote` and renders server-broadcast state
- **Boundary rules**: `activity-voter.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Session manager orchestrates
- **Socket handler pattern**: One file per namespace — `interlude-handlers.ts` follows exact same pattern as `song-handlers.ts` (Zod validate → guard state → call service → broadcast → score → log)
- **DJ engine purity**: The engine only manages state transitions. Interlude orchestration (option selection, vote management, timers) lives in session-manager, not in the engine

### Reuse Quick Pick Voting Pattern (DO NOT REINVENT)

The `services/quick-pick.ts` is the **exact blueprint** for `activity-voter.ts`:

| Quick Pick Pattern | Activity Voter Equivalent |
|---|---|
| `QuickPickRound` interface | `ActivityVoteRound` interface |
| `votes: Map<string, Map<string, 'up'\|'skip'>>` | `votes: Map<string, string>` (userId → optionId, simpler since single choice) |
| `recordVote()` → `{ recorded, songVotes, winner }` | `recordVote()` → `{ recorded, voteCounts, winner }` |
| `checkMajority()` with floor(n/2)+1 threshold | `checkMajority()` with same threshold |
| `resolveByTimeout()` highest votes + tiebreaker | `resolveByTimeout()` highest votes + random tiebreaker |
| Module-level `Map<string, QuickPickRound>` | Module-level `Map<string, ActivityVoteRound>` |

**Key difference**: Quick Pick has per-song votes (nested Map). Activity voting is simpler — one vote per user for one of 2-3 options. Use `Map<string, string>` (userId → optionId).

### Activity Pool & Selection Algorithm

```
ACTIVITY_POOL = [
  { id: 'kings_cup', name: 'Kings Cup', universal: true, minParticipants: 3 },
  { id: 'dare_pull', name: 'Dare Pull', universal: false, minParticipants: 3 },
  { id: 'quick_vote', name: 'Quick Vote', universal: true, minParticipants: 2 },
  { id: 'group_singalong', name: 'Group Sing-Along', universal: true, minParticipants: 2 },
]

selectActivityOptions(sessionId, participantCount, sessionStartedAt, interludeCount):
  1. Filter by minParticipants
  2. If session < 30 min: filter to universal only (exclude dare_pull)
  3. Check lastSelectedActivity[sessionId] — exclude from options (no immediate repeat)
  4. Apply weighted random from remaining pool
  5. Return 2-3 options
  6. interludeCount is tracked for future Story 7.6 (icebreaker on first interlude) — store in round metadata
```

**Note**: The actual game logic for each activity type (Kings Cup cards, Dare Pull dares, Quick Vote polls, Group Sing-Along) is NOT part of this story. This story only builds the voting mechanism to SELECT which activity plays next. Stories 7.2-7.6 implement each game.

### Socket Event Flow

```
Server enters interlude state
  → session-manager calls selectActivityOptions()
  → session-manager calls startVoteRound()
  → broadcast 'interlude:voteStarted' { options, voteDurationMs, roundId }
  → schedule timer (15s)

Client taps option
  → emit 'interlude:vote' { optionId }

Server receives vote
  → interlude-handlers validates + records
  → broadcast 'interlude:vote' { optionId, userId, displayName, voteCounts }
  → if majority winner: resolve early

Timer expires (TIMEOUT from DJ engine) OR majority reached
  → resolveByTimeout() or winner already set
  → broadcast 'interlude:voteResult' { winningOptionId, voteCounts, totalVotes }
  → WRITE winningOptionId to context.metadata.selectedActivity (via updateSessionDjState or similar)
  → schedule 5s reveal delay (separate setTimeout in session-manager)
  → trigger INTERLUDE_DONE transition
  → context.metadata.selectedActivity persists through transition for Stories 7.2-7.6 to read
```

### What This Story Does NOT Include (Scope Boundaries)

- NO game logic for Kings Cup, Dare Pull, Quick Vote polls, or Group Sing-Along — those are Stories 7.2-7.6
- NO icebreaker logic — that is Story 7.6
- NO interlude content libraries (card decks, dare lists, poll questions)
- After vote resolves, session-manager writes `selectedActivity` to `context.metadata` BEFORE triggering `INTERLUDE_DONE`. The transition function preserves `context.metadata` via spread (`...context.metadata`), so Stories 7.2-7.6 can read `context.metadata.selectedActivity` in subsequent states. Do NOT try to pass metadata via the INTERLUDE_DONE event — the transition function doesn't accept event metadata for this transition type
- The Flutter overlay in this story shows voting UI only — the game-specific UI is built in subsequent stories

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/activity-voter.ts` | NEW — Pure activity selection + vote counting service |
| `apps/server/src/shared/schemas/interlude-schemas.ts` | NEW — Zod schemas for interlude events |
| `apps/server/src/shared/events.ts` | MODIFY — Add interlude event constants + SessionEvent types |
| `apps/server/src/socket-handlers/interlude-handlers.ts` | NEW — Socket handler for interlude namespace |
| `apps/server/src/socket-handlers/connection-handler.ts` | MODIFY — Register interlude handlers |
| `apps/server/src/services/dj-broadcaster.ts` | MODIFY — Add interlude broadcast functions |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add onInterludeStateEntered orchestration + cleanup |
| `apps/server/src/services/participation-scoring.ts` | MODIFY — Add `'interlude:vote'` to `ACTION_TIER_MAP` |
| `apps/server/src/dj-engine/states.ts` | MODIFY — Set `isPlaceholder: false`, keep degradation + timeout |
| `apps/flutter_app/lib/widgets/interlude_vote_overlay.dart` | NEW — Voting UI overlay |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add interlude vote state fields |
| `apps/flutter_app/lib/services/socket_client.dart` | MODIFY — Add interlude event listeners |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Show overlay when DJ state is interlude |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add interlude voting strings |

### Testing Strategy

- **Unit tests** for `activity-voter.ts`: Option selection algorithm (weighted random, front-loading, participant filtering, no repeats, lastSelectedActivity exclusion), vote recording (idempotent, tally, majority detection, timeout resolution, tiebreaker), session cleanup (clearSession clears round + lastSelectedActivity), resetAllRounds test utility
- **Integration tests** for `interlude-handlers.ts`: End-to-end vote flow with mocked io, state guards, broadcast verification
- **Flutter widget tests**: Overlay rendering, tap handling, countdown display, result animation
- **DO NOT test**: Visual animations, color values, transition timings

### Previous Story Intelligence (Epic 6.5 Learnings)

- **Pure service pattern works well**: `peak-detector.ts` followed exact same pattern as `rate-limiter.ts`. Follow this for `activity-voter.ts` — zero Socket.io/persistence imports
- **Export pattern**: When session-manager needs to call a function from another service, use named export (not default). Example: `emitCaptureBubble` was exported from session-manager for peak-detector integration
- **Test pattern**: Separate unit tests (algorithm) from integration tests (handler wiring). Mock `io.to().emit()` for broadcast verification
- **Cleanup pattern**: Always add `clearSession(sessionId)` and wire it into session teardown to prevent memory leaks
- **Code review additions**: Expect to add reset helpers, session isolation tests, and return type optimizations during code review

### Project Structure Notes

- Follows `snake_case` for all DB/Kysely types (no DB changes in this story)
- `camelCase` for all Socket.io event payloads (Zod schemas handle this)
- `kebab-case` for TS filenames: `activity-voter.ts`, `interlude-handlers.ts`, `interlude-schemas.ts`
- `snake_case` for Dart filenames: `interlude_vote_overlay.dart`
- Socket events use `namespace:action` format: `interlude:voteStarted`, `interlude:vote`, `interlude:voteResult`
- Widget keys: `Key('interlude-vote-option-$optionId')`

### References

- [Source: project-context.md — Server Boundaries, Socket Event Catalog, Testing Rules]
- [Source: architecture.md — FR13 democratic voting, FR15 front-loading, FR27 all participants vote, FR28a 3-game library, NFR11 concurrent votes, NFR12 low participant degradation]
- [Source: epics.md — Epic 7 full context, Story 7.1 acceptance criteria]
- [Source: services/quick-pick.ts — Blueprint voting pattern to reuse]
- [Source: services/peak-detector.ts — Pure service + cleanup pattern]
- [Source: dj-engine/states.ts — Interlude state placeholder with TODO for Epic 7]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Server tests: 1151 passed, 0 failed (2 skipped pre-existing)
- Flutter tests: all new tests pass, 2-3 pre-existing join_screen failures unrelated
- Activity voter: 28 unit tests
- Interlude handlers: 7 integration tests
- Flutter overlay: 8 widget tests

### Senior Developer Review (AI)

**Reviewer:** Ducdo on 2026-03-18
**Issues Found:** 3 High, 3 Medium, 2 Low — **All fixed**

**Fixes applied:**
1. **H2 — Unsafe type assertion**: Replaced `as number ?? fallback` with proper `typeof` checks in `onInterludeStateEntered` to prevent NaN propagation
2. **H3 — Duplicate code**: Extracted `finalizeInterludeVote()` helper in session-manager.ts, eliminating ~50 lines of duplication between `handleInterludeVoteWinner` and `resolveInterludeTimeout`
3. **H1 — Zero-vote behavior**: Documented intentional behavior in `resolveByTimeout` and fixed `maxVotes` init from -1 to 0 for clarity
4. **M1 — Silent error swallowing**: Added `console.warn` to participation scoring `.catch()` in interlude-handlers.ts
5. **M2 — Countdown drift**: Added `timerStartedAt` parameter to `InterludeVoteOverlay` to sync countdown with server timer, accounting for network latency
6. **M3 — Stale state on session end**: Added `_clearInterludeState()` to both `onSessionEnded()` and `onKicked()` in party_provider.dart
7. **L2 — Schema validation**: Added `.min(1)` to `optionId` in `activityVoteSchema`
8. **Lint fix**: Prefixed unused `interludeCount` param with underscore (reserved for Story 7.6)

### Completion Notes List
- Created `activity-voter.ts` following quick-pick.ts blueprint pattern — pure service, zero external imports
- Activity pool with front-loading: kings_cup, quick_vote, group_singalong are universal (first 30 min); dare_pull reserved for after 30 min
- Vote recording is idempotent (last vote wins), uses `Map<string, string>` (simpler than quick-pick's nested map)
- Majority detection uses `floor(participantCount / 2) + 1` threshold (same as quick-pick)
- Timeout resolution with random tiebreaker (unlike quick-pick which uses overlapCount)
- Two-timer architecture: 15s DJ engine timer for vote window + 5s setTimeout for result reveal
- `selectedActivity` written to `context.metadata` before `INTERLUDE_DONE` transition for Stories 7.2-7.6
- Added activity-voter mocks to session-manager-ceremony.test.ts to fix mock compatibility
- `isPlaceholder: false` on interlude state — DJ engine now fully manages interlude transitions
- InterludeVoteOverlay follows QuickPickOverlay pattern: fade animation, countdown timer, tappable cards

### File List
- `apps/server/src/services/activity-voter.ts` — NEW: Pure activity selection + vote counting service
- `apps/server/src/shared/schemas/interlude-schemas.ts` — NEW: Zod schemas for interlude events
- `apps/server/src/shared/events.ts` — MODIFIED: Added INTERLUDE_VOTE_STARTED, INTERLUDE_VOTE, INTERLUDE_VOTE_RESULT
- `apps/server/src/services/event-stream.ts` — MODIFIED: Added interlude SessionEvent union members
- `apps/server/src/socket-handlers/interlude-handlers.ts` — NEW: Socket handler for interlude namespace
- `apps/server/src/socket-handlers/connection-handler.ts` — MODIFIED: Register interlude handlers
- `apps/server/src/services/dj-broadcaster.ts` — MODIFIED: Added broadcastInterludeVoteStarted/Result
- `apps/server/src/services/session-manager.ts` — MODIFIED: Added onInterludeStateEntered, handleInterludeVoteWinner, resolveInterludeTimeout, cleanup wiring
- `apps/server/src/services/participation-scoring.ts` — MODIFIED: Added 'interlude:vote' to ACTION_TIER_MAP (active, 3pts)
- `apps/server/src/dj-engine/states.ts` — MODIFIED: Set isPlaceholder: false on interlude state
- `apps/flutter_app/lib/widgets/interlude_vote_overlay.dart` — NEW: Voting UI overlay
- `apps/flutter_app/lib/state/party_provider.dart` — MODIFIED: Added InterludeOption class, interlude state fields, getters, mutation methods, clearing
- `apps/flutter_app/lib/socket/client.dart` — MODIFIED: Added interlude event listeners and emitInterludeVote
- `apps/flutter_app/lib/screens/party_screen.dart` — MODIFIED: Show InterludeVoteOverlay when DJ state is interlude
- `apps/flutter_app/lib/constants/copy.dart` — MODIFIED: Added interlude voting strings
- `apps/server/tests/services/activity-voter.test.ts` — NEW: 28 unit tests
- `apps/server/tests/socket-handlers/interlude-handlers.test.ts` — NEW: 7 integration tests
- `apps/flutter_app/test/widgets/interlude_vote_overlay_test.dart` — NEW: 8 widget tests
- `apps/server/tests/services/session-manager-ceremony.test.ts` — MODIFIED: Added activity-voter mocks for compatibility

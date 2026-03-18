# Story 7.3: Dare Pull Interlude

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want random dares assigned to random players between songs,
So that individuals get spontaneous spotlight moments that create hilarious memories.

## Acceptance Criteria

1. **Given** the DJ engine selects an interlude activity, **When** Dare Pull is chosen (via `context.metadata.selectedActivity === 'dare_pull'`), **Then** a random dare is assigned to a randomly selected active participant **And** a slot-machine animation cycles through participant names before revealing the target **And** a 15-second countdown timer is displayed for dare completion
2. **Given** the session timing, **When** the party is in its first 30 minutes, **Then** Dare Pull is NEVER deployed — it is reserved for after the warm-up period (FR15) — this filtering is already implemented in `activity-voter.ts` via `universal: false`
3. **Given** the interlude library selection, **When** Dare Pull is considered, **Then** it is selected via weighted random with no immediate repeats from the activity pool (FR28a) — this selection logic already exists in `activity-voter.ts` from Story 7.1
4. **Given** a dare is dealt, **When** displayed to all participants, **Then** the dare card shows a dare emoji, dare title, dare description, AND the targeted player's display name — all participants see the same dare and target simultaneously
5. **Given** the 15-second dare timer expires, **When** the game ends, **Then** the system broadcasts a game-ended event **And** triggers `INTERLUDE_DONE` to advance the DJ cycle
6. **Given** multiple interludes occur in a session, **When** Dare Pull is selected again, **Then** the same dare is never dealt twice in a row (no immediate dare repeats within a session) **And** the same player is not targeted twice in a row (no immediate player repeats)

## Tasks / Subtasks

- [x] Task 1: Create Dare Pull dealer service (AC: #1, #4, #6)
  - [x]1.1 Create `apps/server/src/services/dare-pull-dealer.ts` with `DarePullDare` interface: `{ id: string; title: string; dare: string; emoji: string }`
  - [x]1.2 Define `DARE_PULL_DARES` array with 18-20 individual dare challenges. Follow `KINGS_CUP_CARDS` pattern in `kings-cup-dealer.ts`. Dares must be: individual spotlight challenges (not group rules — that's Kings Cup), no physical props required, self-contained, party-appropriate, varied difficulty
  - [x]1.3 Implement `dealDare(sessionId: string): DarePullDare` — random selection from pool, no immediate repeat per session. Track `lastDealtDare` per session via module-level `Map<string, string>` (same pattern as `lastDealtCard` in `kings-cup-dealer.ts`)
  - [x]1.4 Implement `selectTarget(sessionId: string, connections: TrackedConnection[]): TrackedConnection | null` — random selection from active connections, no immediate repeat of same target per session. Track `lastTargetUserId` per session via module-level `Map<string, string>`. Import `TrackedConnection` type from `connection-tracker.ts`
  - [x]1.5 Implement `clearSession(sessionId: string): void` — cleanup both `lastDealtDare` and `lastTargetUserId` for session
  - [x]1.6 Implement `resetAll(): void` — test utility to clear both module-level Maps
  - [x]1.7 Export `DARE_PULL_DARES` for testing

- [x] Task 2: Extend interlude game schemas for dare-specific payload (AC: #1, #4)
  - [x]2.1 Modify `interludeGameStartedSchema` in `apps/server/src/shared/schemas/interlude-schemas.ts` to add optional dare-specific fields:
    - `targetUserId: z.string().min(1).optional()` — targeted player's userId
    - `targetDisplayName: z.string().min(1).optional()` — targeted player's display name
  - [x]2.2 No changes needed to `interludeGameEndedSchema` (already generic with `activityId`)
  - [x]2.3 No new events needed — reuse existing `INTERLUDE_GAME_STARTED` and `INTERLUDE_GAME_ENDED` from `events.ts`

- [x] Task 3: Add `executeDarePull` to session-manager (AC: #1, #4, #5, #6)
  - [x]3.1 Add constant `DARE_PULL_GAME_DURATION_MS = 15_000` (15s dare timer) alongside existing `INTERLUDE_GAME_DURATION_MS = 10_000`
  - [x]3.2 Add imports at top of `session-manager.ts`:
    - `import { dealDare, selectTarget, clearSession as clearDarePullSession } from './dare-pull-dealer.js'`
    - `import { getActiveConnections } from './connection-tracker.js'` (if not already imported)
  - [x]3.3 Modify `startInterludeGame` dispatcher function to add dare_pull case. **CRITICAL**: check connections BEFORE dispatching so `executeDarePull` never needs fallback logic (mirrors `executeKingsCup` which also has no fallback). `startInterludeGame` already has `context` available for the INTERLUDE_DONE transition:
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
      } else {
        void processDjTransition(sessionId, context, { type: 'INTERLUDE_DONE' });
      }
    }
    ```
  - [x]3.4 Create `executeDarePull(sessionId: string, target: TrackedConnection): void` — receives pre-validated target (never null):
    - Deal dare: `const dare = dealDare(sessionId)`
    - Broadcast `interludeGameStarted` with extended payload: `{ activityId: 'dare_pull', card: { id: dare.id, title: dare.title, rule: dare.dare, emoji: dare.emoji }, gameDurationMs: DARE_PULL_GAME_DURATION_MS, targetUserId: target.userId, targetDisplayName: target.displayName }`
    - Append to event stream: `{ type: 'interlude:gameStarted', ts, data: { activityId: 'dare_pull', cardId: dare.id } }`
    - Schedule 15s `setTimeout` for game end → call `endInterludeGame(sessionId)` (reuses existing function)
    - Store timer in `interludeGameTimers` Map (same pattern as Kings Cup)
  - [x]3.5 Wire `clearDarePullSession(sessionId)` into session teardown (same location where `clearKingsCupSession(sessionId)` is called)

- [x] Task 4: Flutter Dare Pull game overlay (AC: #1, #4)
  - [x]4.1 Create `apps/flutter_app/lib/widgets/dare_pull_overlay.dart` — full-screen overlay displaying:
    - Phase 1 — Slot-machine animation (~2.5 seconds): cycles through participant display names with decelerating frequency. Start `Timer.periodic` at 50ms intervals, double interval every 4 ticks (50ms→100ms→200ms→400ms), total ~2.5s, landing on `targetDisplayName` from provider on final tick. Get participant names from `context.watch<PartyProvider>().participants`. Play a reveal sound cue (`sound:play` with a short "ding" or "whoosh") when the slot-machine settles on the target name — UX spec requires "dramatic pause + reveal sound" for the target reveal moment
    - Phase 2 — Dare reveal: After slot-machine settles on target name, show:
      - Target name (large, bold, highlighted)
      - Dare emoji (large)
      - Dare title (bold, DJTokens typography)
      - Dare description
      - 15s countdown timer (same countdown pattern as `KingsCupOverlay`)
    - Entrance animation: Scale-in similar to KingsCupOverlay
  - [x]4.2 Use `DJTokens` for all spacing/colors. Use `Key('dare-pull-overlay')`, `Key('dare-pull-target-name')`, `Key('dare-pull-dare-card')`
  - [x]4.3 All strings in `constants/copy.dart`: `darePullSubtitle`, `darePullTargetPrefix` (e.g., "The dare goes to...")

- [x] Task 5: Flutter state and socket integration (AC: #1, #4, #5)
  - [x]5.1 Extend `PartyProvider` to handle dare-specific fields:
    - Add state fields: `_interludeGameTargetUserId` (String?), `_interludeGameTargetDisplayName` (String?)
    - Add getters: `interludeGameTargetUserId`, `interludeGameTargetDisplayName`
    - Modify `onInterludeGameStarted` to accept optional `targetUserId` and `targetDisplayName` parameters
    - Add target field clearing to `_clearInterludeState()` method and `onInterludeGameEnded()`
  - [x]5.2 Modify `SocketClient` (in `socket/client.dart`) `interlude:gameStarted` listener:
    - Parse optional `targetUserId` and `targetDisplayName` from payload (null-safe with `as String?`)
    - Pass to `_partyProvider?.onInterludeGameStarted(...)` with new optional parameters
  - [x]5.3 In `party_screen.dart`, add `DarePullOverlay` to overlay stack:
    - Show when `partyProvider.interludeGameActivityId == 'dare_pull'` and `partyProvider.interludeGameCard != null`
    - Position in overlay stack next to `KingsCupOverlay` (same level — they're mutually exclusive via `activityId` check)
    - Pass `targetDisplayName`, `card`, `gameDurationMs`, `timerStartedAt`, and participant list from provider

- [x] Task 6: Tests (AC: all)
  - [x]6.1 `apps/server/tests/services/dare-pull-dealer.test.ts`:
    - Dare pool has 18+ dares with required fields (id, title, dare, emoji)
    - `dealDare()` returns valid dare from pool
    - No immediate dare repeat: calling `dealDare()` twice returns different dares
    - `selectTarget()` returns a connection from the provided list
    - No immediate target repeat: calling `selectTarget()` twice with same connections returns different targets
    - `selectTarget()` returns null for empty connections array
    - `selectTarget()` returns the only connection when only 1 is available (even if it was last target)
    - `clearSession()` resets both dare and target tracking
    - `resetAll()` clears all session data
    - All dares have non-empty id, title, dare, emoji
  - [x]6.2 `apps/server/tests/services/session-manager-dare-pull.test.ts`:
    - `startInterludeGame` dispatches to `executeDarePull` when selectedActivity is 'dare_pull'
    - `executeDarePull` broadcasts `interlude:gameStarted` with dare card data AND `targetUserId`/`targetDisplayName`
    - `executeDarePull` falls back to INTERLUDE_DONE when no active connections
    - Game timer fires after 15s and broadcasts `interlude:gameEnded`
    - Game timer fires INTERLUDE_DONE after `interlude:gameEnded`
    - Session cleanup clears dare pull session tracking
    - Mock `dare-pull-dealer` to control dare and target output
    - Mock `connection-tracker` `getActiveConnections` to control participant list
  - [x]6.3 `apps/flutter_app/test/widgets/dare_pull_overlay_test.dart`:
    - Renders dare emoji, title, and description
    - Displays target player name
    - Shows countdown timer
    - Uses correct widget keys
  - [x]6.4 Update `apps/server/tests/services/session-manager-ceremony.test.ts` — add `vi.mock('../../src/services/dare-pull-dealer.js', ...)` alongside the existing `kings-cup-dealer` mock to prevent import errors
  - [x]6.5 Update `apps/server/tests/services/session-manager-interlude-game.test.ts` — add `vi.mock('../../src/services/dare-pull-dealer.js', ...)` to prevent import errors from new session-manager import

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL game state lives on server. Server selects the target player AND the dare. Flutter renders server-broadcast data — ZERO game logic in Dart. Slot-machine animation is purely cosmetic (target already decided server-side)
- **Boundary rules**: `dare-pull-dealer.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Takes `TrackedConnection[]` as input (pure function pattern from `group-card-selector.ts`). Session-manager orchestrates
- **Socket handler pattern**: No new socket handler needed — Dare Pull is passive from client perspective (no client input). All events are server→client broadcasts via existing `interlude:gameStarted`/`interlude:gameEnded`
- **DJ engine purity**: Engine only manages state transitions. Game orchestration (dare dealing, target selection, timing) lives in session-manager, not engine. No DJ engine changes in this story

### Reuse Patterns from Stories 7.1 and 7.2 (DO NOT REINVENT)

| Previous Pattern | Story 7.3 Equivalent |
|---|---|
| `kings-cup-dealer.ts` structure | `dare-pull-dealer.ts` structure — same module-level Map, same API shape |
| `KingsCupCard` interface `{ id, title, rule, emoji }` | `DarePullDare` interface `{ id, title, dare, emoji }` |
| `dealCard(sessionId)` no-repeat logic | `dealDare(sessionId)` no-repeat logic — identical pattern |
| `KINGS_CUP_CARDS` readonly array | `DARE_PULL_DARES` readonly array |
| `executeKingsCup(sessionId)` in session-manager | `executeDarePull(sessionId, target)` in session-manager |
| `INTERLUDE_GAME_DURATION_MS = 10_000` | `DARE_PULL_GAME_DURATION_MS = 15_000` |
| `KingsCupOverlay` widget | `DarePullOverlay` widget |
| `group-card-selector.ts` shuffle + random pick | `selectTarget()` shuffle + random pick for participant selection |
| `clearKingsCupSession()` in teardown | `clearDarePullSession()` in teardown — same location |

### Dare Pull Content Guidelines

Dares should be:
- **Individual spotlight challenges** that single out one person (NOT group rules — that's Kings Cup)
- **No physical props** required (phone-only party)
- **Self-contained** (dare is clear from the text alone)
- **Party-appropriate** (fun, silly, not offensive or embarrassing)
- **Completable in 15 seconds** (short, immediate actions)
- **Varied difficulty** (some easy like "air guitar solo" and some harder like "do your best impression of a celebrity")

Example dares:
- "Air Guitar Solo!" — Shred an imaginary guitar for 10 seconds
- "Celebrity Impression" — Do your best impression of any celebrity
- "Dance Move" — Show off your signature dance move
- "Opera Singer" — Sing the last lyric you remember in an opera voice
- "Robot Mode" — Move like a robot for the next 15 seconds
- "Acceptance Speech" — Give a dramatic award acceptance speech
- "Whisper Song" — Whisper-sing any song and everyone guesses
- "Slow Motion" — Do everything in slow motion until the timer ends

### Session Manager Integration — Critical Flow

```
EXISTING FLOW (Story 7.2 Kings Cup):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → kings_cup: deal card → broadcast gameStarted → display (10s) → gameEnded → INTERLUDE_DONE

NEW FLOW (Story 7.3 Dare Pull):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → dare_pull: get connections → select target → deal dare → broadcast gameStarted (with target info) → display (15s) → gameEnded → INTERLUDE_DONE
    → kings_cup: (unchanged)
    → unknown: → INTERLUDE_DONE (backward compatible)
```

**Total interlude duration with Dare Pull: 15s vote + 5s reveal + 15s dare = 35s max**

### Timer Architecture (reuses Story 7.2 pattern)

1. **Vote window** (15s): DJ engine timer — already exists from Story 7.1
2. **Reveal delay** (5s): `setTimeout` in session-manager — already exists from Story 7.1
3. **Game display** (15s for Dare Pull, 10s for Kings Cup): `setTimeout` in session-manager — uses same `interludeGameTimers` Map. `endInterludeGame()` is already activity-agnostic
4. HOST_SKIP during game: already handled by `clearInterludeTimers()` which clears `interludeGameTimers`

### Participant Selection Logic

**Server-side (`selectTarget` in `dare-pull-dealer.ts`):**
1. Receive `connections: TrackedConnection[]` as parameter (pure function — no side effects beyond tracking)
2. Check `lastTargetUserId` for this session — filter out last target if >1 connections available
3. Shuffle eligible connections (Fisher-Yates from `group-card-selector.ts` pattern)
4. Pick first connection after shuffle
5. Record `lastTargetUserId` for no-repeat tracking
6. Return `TrackedConnection` (has `userId` + `displayName`)
7. **All active connections are eligible, including the host** — no host filtering (interludes have no current performer to exclude)

**Edge cases:**
- 0 connections (everyone disconnected): return null → `startInterludeGame` dispatcher falls back to INTERLUDE_DONE (connection check happens BEFORE `executeDarePull` is called)
- 1 connection: return that person (can't avoid repeat with only 1 person)
- 2+ connections: always avoids immediate target repeat

**Flutter-side (slot-machine animation):**
- Get participant list from `PartyProvider.participants` (already synced via `party:participants` events)
- Timer.periodic cycles display names with decelerating frequency: 50ms start → double every 4 ticks → 50→100→200→400ms, total ~2.5s
- Lands on `interludeGameTargetDisplayName` from provider on final tick
- Play reveal sound cue when slot-machine settles (client-side audio, same pattern as existing sound effects)
- This is purely cosmetic — server has already decided the target

### Schema Extension Strategy

The `interludeGameStartedSchema` is extended with **optional** fields to maintain backward compatibility with Kings Cup:

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
  targetUserId: z.string().min(1).optional(),       // NEW — dare_pull only
  targetDisplayName: z.string().min(1).optional(),   // NEW — dare_pull only
});
```

The dare's `dare` field maps to the schema's `card.rule` field — same structure, different semantic meaning. This keeps the Flutter `InterludeGameCard` class reusable.

### What This Story Does NOT Include (Scope Boundaries)

- NO client-side dare completion confirmation (dare auto-advances after 15s timer — passive like Kings Cup)
- NO per-game scoring changes — UX spec lists 5 points for "Dare completed (social observation)" but this is already covered by the existing vote-phase participation scoring from Story 7.1. Kings Cup (7.2) made the same decision. Per-game scoring differentiation is deferred
- NO DJ engine changes — engine stays as-is, game orchestration is in session-manager
- NO changes to the vote flow or reveal timer — only the game dispatch adds a new case
- NO persistence of dealt dares or target history to database — in-memory only (same as Kings Cup)
- NO new socket events — reuses `interlude:gameStarted` / `interlude:gameEnded`

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/dare-pull-dealer.ts` | NEW — Dare pool + random deal, no-repeat tracking, random target selection |
| `apps/server/src/shared/schemas/interlude-schemas.ts` | MODIFY — Add optional `targetUserId`, `targetDisplayName` to gameStarted schema |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add dare_pull dispatch, `executeDarePull`, `DARE_PULL_GAME_DURATION_MS`, wire cleanup |
| `apps/flutter_app/lib/widgets/dare_pull_overlay.dart` | NEW — Dare display overlay with slot-machine animation |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add target fields, extend `onInterludeGameStarted` |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Parse optional target fields from gameStarted payload |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Show DarePullOverlay in stack |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add Dare Pull strings |

### Testing Strategy

- **Unit tests** for `dare-pull-dealer.ts`: Dare pool validity, deal randomness, no-repeat logic, target selection, no-repeat target, edge cases (0/1/2+ connections), session cleanup, resetAll
- **Integration tests** for session-manager dare pull dispatch: Dare Pull path, target selection, timer behavior (15s), fallback on no connections, session cleanup
- **Flutter widget tests**: Overlay rendering (emoji, title, dare, target name), countdown display, widget keys
- **Mock compatibility**: Add `dare-pull-dealer` mock to existing session-manager test files
- **DO NOT test**: Slot-machine animation timings, visual effects, color values, transition timings

### Previous Story Intelligence (Stories 7.1 + 7.2 Learnings)

- **Code review tip from 7.1**: Always add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads. Add cleanup to both `onSessionEnded()` and `onKicked()` in party_provider
- **Code review tip from 7.2**: Remove unused Copy constants. Extract hardcoded durations to named constants. Use null-safe `fromJson` factories. Don't pass unused parameters to functions. Add HOST_SKIP game timer cancellation tests. Add provider mutual-exclusivity tests
- **Mock compatibility from 7.2**: When modifying session-manager, update ALL existing test mocks to include new imports. Story 7.2 added `kings-cup-dealer` mock to `session-manager-ceremony.test.ts` — Story 7.3 must add `dare-pull-dealer` mock there AND to `session-manager-interlude-game.test.ts`
- **Mutual exclusivity pattern from 7.2**: `onInterludeGameStarted()` already clears vote overlay state. No additional work needed for dare pull — same mechanism ensures only one interlude UI is visible

### Project Structure Notes

- `snake_case` for DB columns (no DB changes in this story)
- `camelCase` for Socket.io event payloads (Zod schemas)
- `kebab-case` for TS filenames: `dare-pull-dealer.ts`
- `snake_case` for Dart filenames: `dare_pull_overlay.dart`
- Socket events: reuse existing `interlude:gameStarted`, `interlude:gameEnded` (no new events)
- Widget keys: `Key('dare-pull-overlay')`, `Key('dare-pull-target-name')`, `Key('dare-pull-dare-card')`
- All copy in `constants/copy.dart`: `darePullSubtitle`, `darePullTargetPrefix`

### References

- [Source: project-context.md — Server Boundaries, Socket Event Catalog, Testing Rules, Anti-Patterns]
- [Source: architecture.md — FR28a weighted random 3-game library, FR28b Dare Pull random dares to random player, FR15 front-loading universal activities in first 30 min, NFR12 low participant degradation]
- [Source: epics.md — Epic 7 context, Story 7.3 acceptance criteria: random dare to random player, slot-machine animation, 15s timer, not in first 30 min]
- [Source: ux-design-specification.md:1192-1225 — Dare Pull UX flow: slot-machine animation, dramatic pause + reveal sound, 15s timer, auto-advance]
- [Source: ux-design-specification.md:1272-1278 — Interlude participation scoring: Dare Pull 5pts for dare completed (social observation, deferred)]
- [Source: 7-2-kings-cup-interlude.md — Complete implementation record for sister interlude game, reuse patterns, code review learnings]
- [Source: services/kings-cup-dealer.ts — Card dealer pattern to replicate for dares]
- [Source: services/group-card-selector.ts — Participant random selection pattern with Fisher-Yates shuffle]
- [Source: services/connection-tracker.ts — TrackedConnection type and getActiveConnections() for participant list]
- [Source: services/activity-voter.ts — dare_pull already in ACTIVITY_POOL with universal:false, minParticipants:3]
- [Source: services/session-manager.ts:507-513 — startInterludeGame dispatcher where dare_pull case will be added]
- [Source: shared/schemas/interlude-schemas.ts — interludeGameStartedSchema to extend with optional target fields]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Created `dare-pull-dealer.ts` with 20 dares, `dealDare()` with no-repeat logic, `selectTarget()` with Fisher-Yates shuffle and no-repeat target tracking, `clearSession()` and `resetAll()` utilities
- Task 2: Extended `interludeGameStartedSchema` with optional `targetUserId` and `targetDisplayName` fields
- Task 3: Added `executeDarePull()` to session-manager with 15s timer, updated `startInterludeGame` dispatcher with dare_pull case and connection check, wired `clearDarePullSession` into session teardown, updated broadcaster type signature
- Task 4: Created `DarePullOverlay` widget with slot-machine animation (50ms→100ms→200ms→400ms deceleration), dare card reveal with `uiTap` sound cue on target reveal, and countdown timer using DJTokens
- Task 5: Extended `PartyProvider` with target fields and getters, updated `SocketClient` to parse optional target fields, added `DarePullOverlay` to party screen overlay stack
- Task 6: Created 13 dare-pull-dealer tests, 7 session-manager-dare-pull tests, 5 Flutter dare_pull_overlay tests, added dare-pull-dealer mocks to ceremony and interlude-game test files. All 1190 server tests pass, all new Flutter tests pass, 3 pre-existing Flutter failures unrelated to this story

### Change Log

- 2026-03-18: Implemented Story 7.3 Dare Pull Interlude — all 6 tasks complete
- 2026-03-18: Code review fixes — added reveal sound cue (uiTap) on slot-machine settle, expanded dare pool to 20, improved clearSession/selectTarget tests, updated stale comment in session-manager, derived countdown initial value from gameDurationMs

### File List

**New files:**
- `apps/server/src/services/dare-pull-dealer.ts`
- `apps/server/tests/services/dare-pull-dealer.test.ts`
- `apps/server/tests/services/session-manager-dare-pull.test.ts`
- `apps/flutter_app/lib/widgets/dare_pull_overlay.dart`
- `apps/flutter_app/test/widgets/dare_pull_overlay_test.dart`

**Modified files:**
- `apps/server/src/shared/schemas/interlude-schemas.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/services/dj-broadcaster.ts`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/server/tests/services/session-manager-ceremony.test.ts`
- `apps/server/tests/services/session-manager-interlude-game.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

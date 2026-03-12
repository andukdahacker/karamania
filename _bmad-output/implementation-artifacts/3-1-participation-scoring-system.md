# Story 3.1: Participation Scoring System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to track weighted participation scores for each user across three engagement tiers,
so that contributions beyond singing are recognized and rewarded.

## Acceptance Criteria

1. **Given** a participant is in an active party session **When** they perform actions during the session **Then** actions are scored across three tiers: passive (1pt), active (3pts), engaged (5pts) (FR40)
2. **Given** scores are being tracked **When** the session is active **Then** the `session_participants.participation_score` column is updated via the persistence layer
3. **Given** score updates occur **When** events are processed **Then** score updates are logged to the event stream (FR42)
4. **Given** the scoring system is established **When** future epics extend it **Then** Epic 4 card challenges contribute to the engaged tier (5pts) and Epic 8 consumes scores for end-of-night awards

## Tasks / Subtasks

- [x] Task 1: Create participation scoring service — pure function (AC: #1)
  - [x] 1.1 Create `apps/server/src/services/participation-scoring.ts`
    - Define scoring tier constants:
      ```typescript
      export const ParticipationTier = {
        passive: 'passive',
        active: 'active',
        engaged: 'engaged',
      } as const;
      export type ParticipationTier = (typeof ParticipationTier)[keyof typeof ParticipationTier];

      export const TIER_POINTS: Record<ParticipationTier, number> = {
        passive: 1,
        active: 3,
        engaged: 5,
      };
      ```
    - Define action-to-tier mapping:
      ```typescript
      export const ACTION_TIER_MAP: Record<string, ParticipationTier> = {
        // Passive (1pt) — presence/viewing actions
        'party:joined': ParticipationTier.passive,
        'session:present': ParticipationTier.passive,   // periodic presence tick (future)

        // Active (3pts) — lightweight engagement
        'party:vibeChanged': ParticipationTier.active,
        'reaction:sent': ParticipationTier.active,   // Epic 4 will use this
        'sound:play': ParticipationTier.active,       // Epic 4 will use this

        // Engaged (5pts) — meaningful participation
        'card:accepted': ParticipationTier.engaged,
        'card:completed': ParticipationTier.engaged,    // Epic 4 will use this
        'song:queued': ParticipationTier.engaged,       // Epic 5 will use this
      };
      ```
    - Implement `calculateScoreIncrement(action: string, rewardMultiplier?: number): number`:
      ```typescript
      export function calculateScoreIncrement(
        action: string,
        rewardMultiplier: number = 1.0
      ): number {
        const tier = ACTION_TIER_MAP[action];
        if (!tier) return 0;
        const points = TIER_POINTS[tier];
        return Math.round(points * rewardMultiplier);
      }
      ```
    - **ZERO imports from persistence, Socket.io, or external services** — pure scoring logic only
    - Export all constants and functions for testing and future extension

- [x] Task 2: Create rate limiter service — pure function (AC: #1)
  - [x] 2.1 Create `apps/server/src/services/rate-limiter.ts`
    - Pure function, no Socket.io dependency (per project-context.md)
    - Implement `checkRateLimit(events: number[], now: number, windowMs: number, maxEvents: number, inactivityResetMs: number)`:
      ```typescript
      export function checkRateLimit(
        events: number[],
        now: number,
        windowMs: number = 5000,
        maxEvents: number = 10,
        inactivityResetMs: number = 5000
      ): { allowed: boolean; rewardMultiplier: number } {
        // 5s inactivity reset: if last event was >inactivityResetMs ago, treat as fresh
        if (events.length > 0 && now - events[events.length - 1]! > inactivityResetMs) {
          return { allowed: true, rewardMultiplier: 1.0 };
        }

        const windowEvents = events.filter(t => now - t < windowMs);
        if (windowEvents.length < maxEvents) {
          return { allowed: true, rewardMultiplier: 1.0 };
        }
        if (windowEvents.length < maxEvents * 2) {
          const overage = windowEvents.length - maxEvents;
          return { allowed: true, rewardMultiplier: Math.pow(0.5, overage) };
        }
        return { allowed: true, rewardMultiplier: 0 };
      }
      ```
    - **Key:** Never hard-blocks (always `allowed: true`) — reward degrades instead (NFR23/architecture spec)
    - Per-user event timestamp arrays are managed by the CALLER (socket handler), not this function
  - [x] 2.2 Create in-memory rate limit store (separate from pure function):
    ```typescript
    const userEventTimestamps = new Map<string, number[]>();

    export function recordUserEvent(userId: string, now: number): number[] {
      let timestamps = userEventTimestamps.get(userId);
      if (!timestamps) {
        timestamps = [];
        userEventTimestamps.set(userId, timestamps);
      }
      timestamps.push(now);
      return timestamps;
    }

    export function cleanupStaleTimestamps(windowMs: number = 30000): void {
      const now = Date.now();
      for (const [userId, timestamps] of userEventTimestamps) {
        const fresh = timestamps.filter(t => now - t < windowMs);
        if (fresh.length === 0) {
          userEventTimestamps.delete(userId);
        } else {
          userEventTimestamps.set(userId, fresh);
        }
      }
    }

    export function clearRateLimitStore(): void {
      userEventTimestamps.clear();
    }
    ```

- [x] Task 3: Add persistence method for score updates (AC: #2)
  - [x] 3.1 In `apps/server/src/persistence/session-repository.ts`, add:
    ```typescript
    export async function incrementParticipationScore(
      sessionId: string,
      userId: string,
      increment: number
    ): Promise<void> {
      await db
        .updateTable('session_participants')
        .set((eb) => ({
          participation_score: eb('participation_score', '+', increment),
        }))
        .where('session_id', '=', sessionId)
        .where('user_id', '=', userId)
        .execute();
    }

    export async function getParticipantScore(
      sessionId: string,
      userId: string
    ): Promise<number | undefined> {
      const result = await db
        .selectFrom('session_participants')
        .select('participation_score')
        .where('session_id', '=', sessionId)
        .where('user_id', '=', userId)
        .executeTakeFirst();
      return result?.participation_score;
    }
    ```
    - Uses Kysely's `eb()` expression builder for atomic SQL `SET participation_score = participation_score + ?`
    - Matches existing pattern in session-repository.ts (import `db` from `../db/connection.js`, use `snake_case` column names)
    - **Guest participants:** `user_id` can be null for guests. Guest scoring needs special handling — match on `guest_name` OR generate a stable guest ID. For MVP, guests with `user_id = null` won't accumulate scores (they get the party experience but no persistent scoring). This is acceptable because guest-to-account upgrade is Epic 9 Story 9.2

- [x] Task 4: Add event stream types for scoring (AC: #3)
  - [x] 4.1 In `apps/server/src/services/event-stream.ts`, add to `SessionEvent` union:
    ```typescript
    | { type: 'participation:scored'; ts: number; userId: string; data: { action: string; tier: string; points: number; rewardMultiplier: number; totalScore: number } }
    ```
    - Follows existing discriminated union pattern
    - `totalScore` is the participant's score AFTER this increment (useful for analytics)
    - `rewardMultiplier` tracks rate limiting impact on scoring

- [x] Task 5: Create scoring orchestration in session-manager (AC: #1, #2, #3)
  - [x] 5.1 In `apps/server/src/services/session-manager.ts`, add:
    ```typescript
    import { calculateScoreIncrement, ACTION_TIER_MAP, TIER_POINTS } from '../services/participation-scoring.js';

    // In-memory score cache — avoids DB read race condition with fire-and-forget writes
    const scoreCache = new Map<string, number>();

    function getScoreCacheKey(sessionId: string, userId: string): string {
      return `${sessionId}:${userId}`;
    }

    export function clearScoreCache(): void {
      scoreCache.clear();
    }

    export async function recordParticipationAction(
      sessionId: string,
      userId: string,
      action: string,
      rewardMultiplier: number = 1.0
    ): Promise<{ points: number; totalScore: number } | null> {
      const increment = calculateScoreIncrement(action, rewardMultiplier);
      if (increment === 0) return null;

      // Fire-and-forget DB update (same pattern as DJ state persistence)
      sessionRepo.incrementParticipationScore(sessionId, userId, increment).catch((err) => {
        console.error(`[session-manager] Failed to persist score for ${userId}:`, err);
      });

      // Track score in memory to avoid read-after-write race condition
      const cacheKey = getScoreCacheKey(sessionId, userId);
      const cachedScore = scoreCache.get(cacheKey) ?? 0;
      const totalScore = cachedScore + increment;
      scoreCache.set(cacheKey, totalScore);

      // Log to event stream
      const tier = ACTION_TIER_MAP[action];
      if (tier) {
        appendEvent(sessionId, {
          type: 'participation:scored',
          ts: Date.now(),
          userId,
          data: {
            action,
            tier,
            points: increment,
            rewardMultiplier,
            totalScore,
          },
        });
      }

      return { points: increment, totalScore };
    }
    ```
    - **Pattern note:** DB write is fire-and-forget async (same as DJ state persistence in `handleSideEffects`). In-memory `scoreCache` tracks running totals to avoid read-after-write race conditions with the DB. The cache is the hot path; DB is the durable store. Clear cache on session end (in `endSession()`)
    - Call `clearScoreCache()` (or selectively clear session entries) in `endSession()` after flushing the event stream
    - **CRITICAL:** `recordParticipationAction` is the ONLY entry point for scoring. Socket handlers call this, NEVER call persistence directly (per server boundaries)

- [x] Task 6: Wire scoring into existing socket handlers (AC: #1, #2)
  - [x] 6.1 In `apps/server/src/socket-handlers/party-handlers.ts`:
    - Import `recordParticipationAction` from session-manager
    - After `PARTY_VIBE_CHANGED` handler successfully updates vibe, call:
      ```typescript
      await recordParticipationAction(socket.data.sessionId, socket.data.userId, 'party:vibeChanged', 1.0);
      ```
      (Vibe change is an active engagement action — uses the actual event action name, NOT `'reaction:sent'`)
    - **Note:** `party:joined` scoring happens in session-manager's `handleParticipantJoin()` — add scoring call there, not in socket handler
  - [x] 6.2 In `apps/server/src/services/session-manager.ts` → `handleParticipantJoin()`:
    - After successful join, score the join as passive:
      ```typescript
      // Score the join action (passive tier, 1pt)
      if (userId) {
        recordParticipationAction(sessionId, userId, 'party:joined', 1.0).catch(() => {});
      }
      ```
    - Wrapped in catch to ensure join flow is never blocked by scoring failure
    - **Note:** The host also goes through `handleParticipantJoin` (via `addParticipantIfNotExists`). The host will earn 1pt passive for joining — this is intentional (host is a participant too)
  - [x] 6.3 **DO NOT add reaction/soundboard/card handlers yet** — those socket handlers don't exist. Epic 4 (Story 4.1: emoji reactions) will create `reaction-handlers.ts` and wire scoring there. This story only scores actions that already have handlers

- [x] Task 7: Tests (AC: #1-#4)
  - [x] 7.1 Create `apps/server/tests/services/participation-scoring.test.ts`:
    - Test `calculateScoreIncrement` returns correct points for each tier
    - Test unknown action returns 0
    - Test rewardMultiplier applies correctly (multiplier 0.5 → half points, rounded)
    - Test rewardMultiplier of 0 returns 0 points
    - Test all mapped actions resolve to correct tiers
    - Test `ParticipationTier` and `TIER_POINTS` constants are consistent
  - [x] 7.2 Create `apps/server/tests/services/rate-limiter.test.ts`:
    - Test under limit returns multiplier 1.0
    - Test at exactly maxEvents returns multiplier 0.5
    - Test at 2x maxEvents returns multiplier 0 (diminished to zero)
    - Test events outside window are excluded
    - Test `recordUserEvent` appends timestamp and returns array
    - Test `cleanupStaleTimestamps` removes old entries
    - Test `clearRateLimitStore` empties everything
    - Test 5s inactivity reset: events older than inactivityResetMs return full multiplier
    - Test inactivity reset does NOT apply when last event is within threshold
  - [x] 7.3 Extend `apps/server/tests/persistence/session-repository.test.ts`:
    - Test `incrementParticipationScore` calls Kysely `updateTable` → `set(eb)` → `where` chain correctly
    - Test `incrementParticipationScore` passes correct increment value to expression builder
    - Test `getParticipantScore` calls `selectFrom` → `select` → `where` chain correctly
    - Test `getParticipantScore` returns undefined when `executeTakeFirst` returns undefined
    - Use `vi.mock('../../src/db/connection.js')` with mock chain pattern (matches existing codebase test convention — NO real DB, NO transactions)
  - [x] 7.4 Extend `apps/server/tests/services/session-manager.test.ts` or create `session-manager-scoring.test.ts`:
    - Test `recordParticipationAction` with valid action returns correct points
    - Test `recordParticipationAction` with unknown action returns null
    - Test `recordParticipationAction` appends `participation:scored` event to event stream
    - Test event data includes correct tier, points, rewardMultiplier, totalScore
    - Test `recordParticipationAction` accumulates totalScore across multiple calls (in-memory cache)
    - Test `clearScoreCache` resets cached scores
    - Test `handleParticipantJoin` calls scoring for authenticated users
    - Test `handleParticipantJoin` does NOT call scoring for guest users (userId null)
    - Mock `sessionRepo.incrementParticipationScore` (fire-and-forget, verify called with correct args)
  - [x] 7.5 **Regression tests**: Run full existing test suite to verify no breakage
    - All 437+ existing tests still pass (from Story 2.9 baseline)
    - Session-manager tests still pass with new import
    - Event stream type changes are additive (no breaking changes)

## Dev Notes

### Architecture Decision: Scoring as a Service, Not DJ Engine

Participation scoring is **NOT** part of the DJ engine. It's a service-layer concern:
- DJ engine (`dj-engine/`) = pure game state machine (state transitions, timing, cycle logic)
- Scoring (`services/participation-scoring.ts`) = pure point calculation
- Orchestration (`services/session-manager.ts`) = wires scoring into event flow
- Persistence (`persistence/session-repository.ts`) = DB writes

This follows the established boundary: `dj-engine/` has ZERO imports from services/persistence.

[Source: _bmad-output/project-context.md#Server Boundaries — dj-engine/ ZERO imports from persistence, integrations, or socket-handlers]

### Rate Limiter Design

Per architecture: pure function, no Socket.io dependency, no hard blocks. The `checkRateLimit` function takes raw timestamp arrays and returns a multiplier. The in-memory timestamp store is a separate concern.

Rate limiter is called by socket handlers BEFORE calling `recordParticipationAction`. The handler passes the `rewardMultiplier` to the scoring function. This keeps each layer focused:
- Rate limiter: "how degraded is this user's reward?"
- Scoring service: "how many points for this action at this multiplier?"
- Session manager: "persist the score and log the event"

**5s inactivity reset:** Built into `checkRateLimit` via `inactivityResetMs` parameter (default 5000ms). If the most recent event in the array is older than this threshold, the user is treated as fresh regardless of window event count. The `cleanupStaleTimestamps` (30s window) handles memory cleanup separately.

**Visual feedback multiplier:** Per architecture (line 109, 391), the rate limiter affects "visual feedback simultaneously." Socket handlers should return `rewardMultiplier` in the socket acknowledgement callback so Flutter can dim reaction UI when rewards degrade. This is wired in Epic 4 when reaction handlers are created — this story just ensures the multiplier is available.

[Source: _bmad-output/planning-artifacts/architecture.md — Rate limiter pure function, no hard blocks, reward multiplier]

### Scoring Extensibility for Future Epics

The `ACTION_TIER_MAP` is the single registry of action→tier mappings. Future epics extend it:
- **Epic 4 (Cards):** Add `'card:accepted'` → engaged, `'card:completed'` → engaged (already pre-registered)
- **Epic 5 (Songs):** Add `'song:queued'` → engaged (already pre-registered)
- **Epic 8 (Awards):** Reads `participation_score` from DB for end-of-night award generation

Pre-registering future actions in the map is safe — they won't fire until those socket handlers exist.

### DB Column Already Exists

The `participation_score` integer column (NOT NULL, DEFAULT 0) already exists in `session_participants` from the initial migration (Story 1.2). No migration needed.

[Source: apps/server/migrations/001-initial-schema.ts — line 55-56]

### Guest Scoring Limitation

Guests have `user_id = null` in `session_participants`. The `incrementParticipationScore` query filters on `user_id`, so guests with null user_id won't match. This is acceptable for MVP — guest-to-account upgrade (Epic 9, Story 9.2) will address persistent guest scoring.

### Fire-and-Forget Persistence Pattern

Score DB writes use fire-and-forget async (`.catch()` with error log), same pattern as DJ state persistence in `handleSideEffects`. This ensures:
- Scoring never blocks the socket event response
- DB failures don't crash the party
- Event stream provides the authoritative scoring log (batch written at session end)

### What This Story Does NOT Build

- **No reaction socket handler** — Epic 4 Story 4.1 creates `reaction-handlers.ts`
- **No soundboard handler** — Epic 4 Story 4.3
- **No card challenge scoring** — Epic 4 Stories 4.4/4.5
- **No song queue scoring** — Epic 5
- **No end-of-night award consumption** — Epic 8
- **No Flutter UI for scores** — Not specified in this story's ACs
- **No score broadcasting to clients** — Not in ACs; future stories can add `participation:scoreUpdated` socket event if needed

### Existing Code to NOT Modify

- `dj-engine/*` — No changes. Scoring is not DJ engine logic
- `socket-handlers/host-handlers.ts` — No changes. Host actions don't earn participation points
- `socket-handlers/connection-handler.ts` — No changes. Connection lifecycle is infrastructure, not participation
- `dj-broadcaster.ts` — No changes. Score is not broadcast with DJ state

### Previous Story Intelligence (Story 2.9)

Story 2.9 established:
- `SessionEvent` discriminated union in `event-stream.ts` — extend with `participation:scored`
- `appendEvent()` pattern in session-manager — same pattern for scoring events
- Pure function pattern in `ceremony-selection.ts` — scoring service follows same pure-function approach
- All 437 tests pass across 34 test files — baseline for regression
- `metadata: Record<string, unknown>` pattern for flexible data storage

Key pattern from 2.9: New pure-logic modules get their own test file. Integration via session-manager.

### Git Intelligence

Recent commits follow pattern: `"Implement Story X.Y: Title with code review fixes"`
- New service files → own test file in `tests/services/`
- Session-manager modified incrementally for new orchestration hooks
- Test factories in `tests/factories/` — `createTestParticipant` already has `participation_score: 0` default
- All stories build on previous test baseline

### Project Structure Notes

New files:
- `apps/server/src/services/participation-scoring.ts` — Pure scoring logic (tiers, points, action mapping)
- `apps/server/src/services/rate-limiter.ts` — Pure rate limit function + in-memory store
- `apps/server/tests/services/participation-scoring.test.ts`
- `apps/server/tests/services/rate-limiter.test.ts`

Modified files:
- `apps/server/src/services/event-stream.ts` — Add `participation:scored` event type
- `apps/server/src/services/session-manager.ts` — Add `recordParticipationAction()`, wire into `handleParticipantJoin()`
- `apps/server/src/persistence/session-repository.ts` — Add `incrementParticipationScore()`, `getParticipantScore()`
- `apps/server/src/socket-handlers/party-handlers.ts` — Score vibe change action

Existing test files to extend:
- `apps/server/tests/services/session-manager.test.ts` or new `session-manager-scoring.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.1] — Three-tier scoring: passive 1pt, active 3pts, engaged 5pts (FR40), event stream logging (FR42)
- [Source: _bmad-output/planning-artifacts/architecture.md#Rate Limiter] — Pure function, no Socket.io dependency, no hard blocks, progressive reward degradation
- [Source: _bmad-output/planning-artifacts/architecture.md#Event Stream] — In-memory append, batch write at session end, discriminated union types
- [Source: _bmad-output/planning-artifacts/architecture.md#Session Intelligence FR40-44] — Participation scoring in handlers, event stream service
- [Source: _bmad-output/project-context.md#Server Boundaries] — socket-handlers call services, NEVER persistence directly
- [Source: _bmad-output/project-context.md#Core Principle] — Server-authoritative architecture
- [Source: _bmad-output/project-context.md#Testing Rules] — Shared factories in tests/factories/
- [Source: apps/server/tests/persistence/session-repository.test.ts] — Uses vi.mock() with mock DB chains (NOT real DB/transactions)
- [Source: apps/server/src/persistence/session-repository.ts] — Existing participant CRUD, no score update method yet
- [Source: apps/server/src/services/event-stream.ts] — SessionEvent union, appendEvent API, 16 event types currently
- [Source: apps/server/src/services/session-manager.ts] — handleParticipantJoin orchestration, fire-and-forget pattern
- [Source: apps/server/src/shared/events.ts] — REACTION_SENT, SOUND_PLAY already defined (handlers don't exist yet)
- [Source: apps/server/tests/factories/participant.ts] — createTestParticipant with participation_score: 0 default
- [Source: _bmad-output/implementation-artifacts/2-9-ceremony-type-selection-rules.md] — Previous story: 437 tests, 34 files, pure function pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Created `participation-scoring.ts` — pure scoring logic with 3 tiers (passive 1pt, active 3pts, engaged 5pts), action→tier map, and `calculateScoreIncrement()`. Zero external imports.
- Task 2: Created `rate-limiter.ts` — pure `checkRateLimit()` function with progressive reward degradation (never hard-blocks), 5s inactivity reset, in-memory timestamp store with cleanup.
- Task 3: Added `incrementParticipationScore()` and `getParticipantScore()` to session-repository. Uses Kysely `eb()` expression builder for atomic SQL increment.
- Task 4: Added `participation:scored` event type to `SessionEvent` discriminated union in event-stream.ts.
- Task 5: Added `recordParticipationAction()` orchestration in session-manager with in-memory score cache, fire-and-forget DB persistence, and event stream logging.
- Task 6: Wired scoring into `handleParticipantJoin()` (authenticated users only, passive 1pt) and `party:vibeChanged` handler (active 3pts). Added `clearScoreCache()` call in `endSession()`. Did NOT add reaction/soundboard/card handlers (Epic 4 scope).
- Task 7: 42 new tests across 4 test files (participation-scoring: 14, rate-limiter: 14, session-repository: 4 new, session-manager-scoring: 10). Full regression suite: 479 tests pass, 0 failures, 37 test files.

### Change Log

- 2026-03-12: Implemented Story 3.1 — Participation Scoring System (all 7 tasks complete)
- 2026-03-12: Code review fixes — H1: session-specific clearScoreCache, M1: bounded timestamp pruning in recordUserEvent, M2: wired rate limiter into vibe change handler, M3: added scoring test for party-handlers

### File List

New files:
- apps/server/src/services/participation-scoring.ts
- apps/server/src/services/rate-limiter.ts
- apps/server/tests/services/participation-scoring.test.ts
- apps/server/tests/services/rate-limiter.test.ts
- apps/server/tests/services/session-manager-scoring.test.ts

Modified files:
- apps/server/src/services/event-stream.ts
- apps/server/src/services/session-manager.ts
- apps/server/src/persistence/session-repository.ts
- apps/server/src/socket-handlers/party-handlers.ts
- apps/server/tests/persistence/session-repository.test.ts
- apps/server/tests/services/session-manager.test.ts
- apps/server/tests/services/session-manager-dj.test.ts
- apps/server/tests/services/session-manager-recovery.test.ts
- apps/server/tests/socket-handlers/party-handlers.test.ts

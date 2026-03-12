# Story 3.2: Award Template Engine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to auto-generate contextual, fun award titles from a diverse template pool,
so that every performer receives a unique and entertaining recognition.

## Acceptance Criteria

1. **Given** a ceremony is triggered after a song **When** the system selects an award **Then** it selects from a pool of 20+ award templates (FR18a)
2. **Given** the award template pool exists **When** templates are categorized **Then** they cover a range of tones: comedic, hype, absurd, and wholesome (FR20)
3. **Given** a ceremony is triggered **When** the system selects an award **Then** selection is driven by session context: party card accepted/completed status, reaction volume during song, song position in session, and performer's cumulative participation score (FR18a)
4. **Given** the award generation system **When** awards are generated **Then** no audience voting or performance scoring is used — awards are contextual fun, not competitive rankings (FR18a)
5. **Given** an award is generated **When** the ceremony completes **Then** the award title is persisted to `session_participants.top_award` for the performer and logged to the event stream

## Tasks / Subtasks

- [x] Task 1: Create award template pool data structure (AC: #1, #2)
  - [x] 1.1 Create `apps/server/src/services/award-generator.ts`
    - Define `AwardTone` type:
      ```typescript
      export const AwardTone = {
        comedic: 'comedic',
        hype: 'hype',
        absurd: 'absurd',
        wholesome: 'wholesome',
      } as const;
      export type AwardTone = (typeof AwardTone)[keyof typeof AwardTone];
      ```
    - Define `AwardTemplate` interface:
      ```typescript
      export interface AwardTemplate {
        title: string;
        tone: AwardTone;
        /** Optional context affinity — boosts selection weight when context matches */
        affinity?: {
          /** Prefer when card was completed during song */
          cardCompleted?: boolean;
          /** Prefer when reaction volume was high */
          highReactions?: boolean;
          /** Prefer for early songs (position <= 3) */
          earlySong?: boolean;
          /** Prefer for late session songs (position >= 6) */
          lateSong?: boolean;
          /** Prefer for high participation score performers */
          highScore?: boolean;
        };
      }
      ```
    - Define pool of 24+ award templates across all 4 tones:
      ```typescript
      export const AWARD_TEMPLATES: AwardTemplate[] = [
        // Comedic (6+)
        { title: 'Vocal Menace', tone: AwardTone.comedic },
        { title: 'The Whisperer', tone: AwardTone.comedic, affinity: { lateSong: true } },
        { title: 'Certified Unhinged', tone: AwardTone.comedic, affinity: { highReactions: true } },
        { title: 'Mic Crime Suspect', tone: AwardTone.comedic },
        { title: 'Delightfully Off-Key', tone: AwardTone.comedic, affinity: { earlySong: true } },
        { title: 'Voice of Chaos', tone: AwardTone.comedic, affinity: { cardCompleted: true } },

        // Hype (6+)
        { title: 'Vocal Assassin', tone: AwardTone.hype, affinity: { highReactions: true } },
        { title: 'Main Character Energy', tone: AwardTone.hype, affinity: { highScore: true } },
        { title: 'Stage Commander', tone: AwardTone.hype, affinity: { earlySong: true } },
        { title: 'The Headliner', tone: AwardTone.hype, affinity: { lateSong: true } },
        { title: 'Crowd Controller', tone: AwardTone.hype, affinity: { highReactions: true } },
        { title: 'Pure Fire', tone: AwardTone.hype },

        // Absurd (6+)
        { title: 'Interdimensional Vocalist', tone: AwardTone.absurd },
        { title: 'Karaoke Cryptid', tone: AwardTone.absurd, affinity: { lateSong: true } },
        { title: 'Legally Questionable Talent', tone: AwardTone.absurd, affinity: { cardCompleted: true } },
        { title: 'Vocal Sorcery Detected', tone: AwardTone.absurd, affinity: { highReactions: true } },
        { title: 'Unregistered Bard', tone: AwardTone.absurd },
        { title: 'The Enigma', tone: AwardTone.absurd, affinity: { highScore: true } },

        // Wholesome (6+)
        { title: 'Heart of the Party', tone: AwardTone.wholesome, affinity: { highScore: true } },
        { title: 'The Warm-Up Act', tone: AwardTone.wholesome, affinity: { earlySong: true } },
        { title: 'Joy Bringer', tone: AwardTone.wholesome },
        { title: 'Golden Moment', tone: AwardTone.wholesome, affinity: { highReactions: true } },
        { title: 'Everyone Felt That', tone: AwardTone.wholesome, affinity: { cardCompleted: true } },
        { title: 'Soul of the Session', tone: AwardTone.wholesome, affinity: { lateSong: true } },
      ];
      ```
    - **ZERO imports from persistence, Socket.io, dj-engine, or external services** — pure data + logic only
    - Export `AWARD_TEMPLATES`, `AwardTemplate`, `AwardTone` for testing and future extension

- [x] Task 2: Create context-driven award selection logic (AC: #3, #4)
  - [x] 2.1 In `apps/server/src/services/award-generator.ts`, define the context input:
    ```typescript
    export interface AwardContext {
      /** Song position in session (1-based) */
      songPosition: number;
      /** Whether performer completed a party card challenge during the song */
      cardCompleted: boolean;
      /** Number of reactions received during the song (approximation from event stream) */
      reactionCount: number;
      /** Performer's cumulative participation score */
      participationScore: number;
      /** Total participant count (for relative scoring) */
      participantCount: number;
      /** Previously awarded titles this session — for dedup */
      previousAwards: string[];
    }
    ```
  - [x] 2.2 Implement `generateAward(context: AwardContext): string`:
    ```typescript
    export function generateAward(context: AwardContext): string {
      // 1. Score each template based on context affinity matches
      const scored = AWARD_TEMPLATES
        .filter(t => !context.previousAwards.includes(t.title))
        .map(t => ({
          template: t,
          weight: calculateWeight(t, context),
        }));

      // 2. If all templates exhausted (>24 songs!), allow repeats
      const candidates = scored.length > 0
        ? scored
        : AWARD_TEMPLATES.map(t => ({ template: t, weight: calculateWeight(t, context) }));

      // 3. Weighted random selection
      return weightedRandomSelect(candidates).template.title;
    }
    ```
  - [x] 2.3 Implement `calculateWeight(template: AwardTemplate, context: AwardContext): number`:
    ```typescript
    const BASE_WEIGHT = 1;
    const AFFINITY_BOOST = 2;

    function calculateWeight(template: AwardTemplate, context: AwardContext): number {
      let weight = BASE_WEIGHT;
      const a = template.affinity;
      if (!a) return weight;

      if (a.cardCompleted && context.cardCompleted) weight += AFFINITY_BOOST;
      if (a.highReactions && context.reactionCount >= context.participantCount * 2) weight += AFFINITY_BOOST;
      if (a.earlySong && context.songPosition <= 3) weight += AFFINITY_BOOST;
      if (a.lateSong && context.songPosition >= 6) weight += AFFINITY_BOOST;
      if (a.highScore && context.participationScore >= 15) weight += AFFINITY_BOOST;

      return weight;
    }
    ```
  - [x] 2.4 Implement `weightedRandomSelect`:
    ```typescript
    function weightedRandomSelect(items: { template: AwardTemplate; weight: number }[]): { template: AwardTemplate; weight: number } {
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;
      for (const item of items) {
        random -= item.weight;
        if (random <= 0) return item;
      }
      return items[items.length - 1]!;
    }
    ```
    - **Deterministic testing:** Export an overridable `_randomFn` for test injection, or accept an optional `randomFn` parameter:
      ```typescript
      export function generateAward(
        context: AwardContext,
        randomFn: () => number = Math.random
      ): string { ... }
      ```
  - [x] 2.5 **NO audience voting, NO performance scoring logic** — the selection uses session context signals (card completion, reaction volume, song position, participation score) to prefer contextually appropriate tones, not to rank performers

- [x] Task 3: Add event stream type for award generation (AC: #5)
  - [x] 3.1 In `apps/server/src/services/event-stream.ts`, add to `SessionEvent` union:
    ```typescript
    | { type: 'ceremony:awardGenerated'; ts: number; userId: string; data: { award: string; songPosition: number; ceremonyType: 'full' | 'quick'; tone: AwardTone; contextFactors: { cardCompleted: boolean; reactionCount: number; participationScore: number } } }
    ```
    - Import with `import type { AwardTone } from '../services/award-generator.js'` — must be a **type-only import** to avoid creating a runtime dependency (event-stream.ts is currently a leaf node with no service imports)
    - Follows existing discriminated union pattern (matches `ceremony:typeSelected`)
    - `contextFactors` provides analytics transparency into why a specific award was selected

- [x] Task 4: Add persistence method for top_award (AC: #5)
  - [x] 4.1 In `apps/server/src/persistence/session-repository.ts`, add:
    ```typescript
    export async function updateTopAward(
      sessionId: string,
      userId: string,
      award: string
    ): Promise<void> {
      await db
        .updateTable('session_participants')
        .set({ top_award: award })
        .where('session_id', '=', sessionId)
        .where('user_id', '=', userId)
        .execute();
    }
    ```
    - `top_award` is a text column, nullable, already exists in schema from Story 1.2
    - Each ceremony overwrites the previous award — `top_award` stores the performer's LAST (most recent) award. The full award history is in the event stream
    - Follows existing pattern in session-repository.ts (`snake_case` columns, `db` from `../db/connection.js`)

- [x] Task 5: Create award orchestration in session-manager (AC: #3, #5)
  - [x] 5.1 In `apps/server/src/services/session-manager.ts`, add:
    ```typescript
    import { generateAward, AWARD_TEMPLATES, type AwardContext, type AwardTone } from '../services/award-generator.js';

    // In-memory tracking of awards given this session (for dedup)
    const sessionAwards = new Map<string, string[]>();

    export function clearSessionAwards(sessionId: string): void {
      sessionAwards.delete(sessionId);
    }

    export async function generateCeremonyAward(
      sessionId: string,
      performerUserId: string,
      ceremonyType: 'full' | 'quick'
    ): Promise<{ award: string; tone: AwardTone } | null> {
      if (!performerUserId) return null;

      // Build context from available session data (sync — all in-memory)
      const context = buildAwardContext(sessionId, performerUserId);

      // Generate award
      const award = generateAward(context);

      // Track for dedup
      const awards = sessionAwards.get(sessionId) ?? [];
      awards.push(award);
      sessionAwards.set(sessionId, awards);

      // Persist top_award (fire-and-forget)
      sessionRepo.updateTopAward(sessionId, performerUserId, award).catch((err) => {
        console.error(`[session-manager] Failed to persist top_award for ${performerUserId}:`, err);
      });

      // Find the tone for the event stream
      const template = AWARD_TEMPLATES.find(t => t.title === award);
      const tone = template?.tone ?? AwardTone.comedic;

      // Log to event stream
      appendEvent(sessionId, {
        type: 'ceremony:awardGenerated',
        ts: Date.now(),
        userId: performerUserId,
        data: {
          award,
          songPosition: context.songPosition,
          ceremonyType,
          tone,
          contextFactors: {
            cardCompleted: context.cardCompleted,
            reactionCount: context.reactionCount,
            participationScore: context.participationScore,
          },
        },
      });

      return { award, tone };
    }
    ```
  - [x] 5.2 Implement `buildAwardContext()` helper in session-manager:
    ```typescript
    function buildAwardContext(
      sessionId: string,
      performerUserId: string
    ): AwardContext {
      // Get DJ context for song position (from dj-state-store.js, already imported)
      const djContext = getSessionDjState(sessionId);
      const songPosition = djContext?.songCount ?? 1;

      // Get participant count
      const participantCount = djContext?.participantCount ?? 2;

      // Get performer's participation score from in-memory cache
      const scoreCacheKey = getScoreCacheKey(sessionId, performerUserId);
      const participationScore = scoreCache.get(scoreCacheKey) ?? 0;

      // Count reactions during the most recent song from event stream
      const eventStream = getEventStream(sessionId);
      const reactionCount = countRecentReactions(eventStream);

      // Check if performer completed a card challenge (future — always false for now)
      const cardCompleted = checkCardCompletion(eventStream, performerUserId);

      // Get previous awards this session
      const previousAwards = sessionAwards.get(sessionId) ?? [];

      return {
        songPosition,
        cardCompleted,
        reactionCount,
        participationScore,
        participantCount,
        previousAwards,
      };
    }
    ```
  - [x] 5.3 Implement event stream query helpers:
    ```typescript
    function countRecentReactions(events: SessionEvent[]): number {
      // Count reaction:sent events since the last dj:stateChanged to 'song'
      let count = 0;
      let inCurrentSong = false;
      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]!;
        if (event.type === 'dj:stateChanged' && event.data.to === 'song') {
          if (inCurrentSong) break; // Found start of current song
          inCurrentSong = true;
          continue;
        }
        if (inCurrentSong && event.type === 'participation:scored' && event.data.action === 'reaction:sent') {
          count++;
        }
      }
      return count;
    }

    function checkCardCompletion(events: SessionEvent[], performerUserId: string): boolean {
      // Epic 4 will add card:completed events — for now always returns false
      // When Epic 4 is implemented, scan for card:completed events for this performer
      // during the most recent song window
      return false;
    }
    ```
    - `countRecentReactions` scans event stream backward from end — efficient for large streams
    - `checkCardCompletion` is a stub returning `false` until Epic 4 adds card events. This is **intentional** — not a TODO that needs implementation now
  - [x] 5.4 Call `clearSessionAwards(sessionId)` in `endSession()` alongside `clearScoreCache()`
    - Clean up award dedup tracking when session ends
  - [x] 5.5 **CRITICAL:** `generateCeremonyAward` is NOT called yet by any handler. Story 3.3 (Full Ceremony) and 3.4 (Quick Ceremony) will call this function from ceremony socket handlers when they implement the ceremony flow. This story only builds the engine. Verify it works via unit tests.

- [x] Task 6: Tests (AC: #1-#5)
  - [x] 6.1 Create `apps/server/tests/services/award-generator.test.ts`:
    - Test `AWARD_TEMPLATES` has at least 20 templates
    - Test all 4 tones have at least 4 templates each
    - Test all template titles are unique strings
    - Test `generateAward` returns a string from the pool
    - Test `generateAward` with deterministic random (pass `randomFn: () => 0`) always returns first viable candidate
    - Test `generateAward` with deterministic random (pass `randomFn: () => 0.999`) returns last viable candidate
    - Test dedup: `previousAwards` containing all-but-one template forces selection of the remaining one
    - Test dedup exhaustion: when all templates in `previousAwards`, allows repeats
    - Test affinity boost: `cardCompleted: true` increases weight of card-affinity templates
    - Test affinity boost: high `reactionCount` (>= participantCount * 2) increases weight of highReactions templates
    - Test affinity boost: `songPosition <= 3` increases weight of earlySong templates
    - Test affinity boost: `songPosition >= 6` increases weight of lateSong templates
    - Test affinity boost: `participationScore >= 15` increases weight of highScore templates
    - Test `calculateWeight` returns BASE_WEIGHT (1) for templates with no affinity
    - Test `calculateWeight` returns BASE_WEIGHT + AFFINITY_BOOST for single match
    - Test `calculateWeight` accumulates multiple affinity boosts
  - [x] 6.2 Extend `apps/server/tests/persistence/session-repository.test.ts`:
    - Test `updateTopAward` calls Kysely `updateTable` → `set({ top_award })` → `where` chain correctly
    - Test `updateTopAward` passes correct award string
    - Use existing `vi.mock('../../src/db/connection.js')` mock chain pattern
  - [x] 6.3 Create `apps/server/tests/services/session-manager-awards.test.ts`:
    - Test `generateCeremonyAward` returns award string and tone
    - Test `generateCeremonyAward` with null performerUserId returns null
    - Test `generateCeremonyAward` calls `updateTopAward` (fire-and-forget, verify called with correct args)
    - Test `generateCeremonyAward` appends `ceremony:awardGenerated` event to event stream
    - Test event data includes correct songPosition, ceremonyType, tone, contextFactors
    - Test `clearSessionAwards` resets the dedup tracking
    - Test `buildAwardContext` assembles correct context from `getSessionDjState`, `scoreCache`, and event stream
    - Test `countRecentReactions` counts only `participation:scored` events with `action === 'reaction:sent'` within current song window (between last two `dj:stateChanged` to `song`)
    - Test `countRecentReactions` returns 0 when no reactions
    - Test `checkCardCompletion` returns false (stub behavior until Epic 4)
    - Mock `sessionRepo.updateTopAward` and verify fire-and-forget pattern
    - Mock `getSessionDJContext`, `getEventStream`, `scoreCache` as needed
  - [x] 6.4 **Regression tests**: Run full existing test suite to verify no breakage
    - All 479 existing tests still pass (from Story 3.1 baseline)
    - Session-manager tests still pass with new imports
    - Event stream type changes are additive (no breaking changes)

## Dev Notes

### Architecture Decision: Award Generator as Pure Service

The award generator follows the same pattern as `participation-scoring.ts` and `ceremony-selection.ts` — pure logic with zero external dependencies:
- `award-generator.ts` = pure template pool + context-driven selection logic
- `session-manager.ts` = orchestration (builds context, calls generator, persists, logs events)
- `session-repository.ts` = DB persistence (updateTopAward)

This follows the established boundary: services are pure functions, session-manager is the ONLY orchestrator.

[Source: _bmad-output/project-context.md#Server Boundaries — services are pure logic, session-manager orchestrates]

### Context-Driven Selection (NOT Performance-Based)

Per FR18a and FR20: Awards are contextual fun, NOT competitive rankings. The system does NOT:
- Score vocal performance quality
- Use audience voting
- Map higher scores to "better" awards

Instead, context signals (card completion, reaction volume, song position, participation score) influence which *tone* of award is more likely. A performer who completed a card challenge is more likely to get a comedic or absurd award that references the challenge. A performer with high reactions is more likely to get a hype award. But ALL tones can appear for ANY context — the weighting just makes contextually relevant awards more probable.

[Source: _bmad-output/planning-artifacts/epics.md#Story 3.2 — "No audience voting or performance scoring"]

### Template Pool Design

24 templates (6 per tone) provides enough variety for typical sessions (8-15 songs). The dedup system tracks previously awarded titles within a session and filters them out. If a marathon session exceeds 24 songs, repeats are allowed — this is acceptable since award distribution is random and sessions rarely exceed 20 songs.

The `affinity` property on templates is optional — templates without affinity have equal base weight regardless of context. This ensures the pool remains diverse even when context signals are weak (e.g., early in session with no card data).

### Weighted Random Selection

The selection algorithm:
1. Filter out previously awarded titles (dedup)
2. Score remaining templates based on context affinity matches
3. Weighted random selection — higher-weight templates are more likely but not guaranteed

This creates emergent variety: contextual templates are *preferred* but not deterministic. Two identical contexts can produce different awards, keeping the party experience fresh.

The `randomFn` parameter enables deterministic testing without mocking `Math.random` globally.

### top_award Column Behavior

`session_participants.top_award` stores the performer's **most recent** award (overwritten each ceremony). The complete award history is preserved in the event stream via `ceremony:awardGenerated` events. Epic 8 (end-of-night awards) will read from the event stream, not just `top_award`.

For guests with `user_id = null`: `updateTopAward` query filters on `user_id`, so guests won't match — same limitation as participation scoring (Story 3.1). Acceptable for MVP.

[Source: apps/server/migrations/001-initial-schema.ts — top_award column, nullable text]

### Event Stream Reaction Counting

`countRecentReactions` scans the event stream backward to find `participation:scored` events with `action === 'reaction:sent'` within the current song window. This works because:
- Reactions are scored via `recordParticipationAction` (Story 3.1) which logs `participation:scored` events
- The event stream tracks all song transitions via `dj:stateChanged`
- Scanning backward is efficient — we stop at the first `dj:stateChanged` to `song` state

**Note:** Reaction handlers don't exist yet (Epic 4, Story 4.1). Until then, `reactionCount` will always be 0. This is by design — the award generator gracefully handles zero-count contexts.

### Card Completion Stub

`checkCardCompletion` returns `false` until Epic 4 adds card events to the event stream. When Epic 4 is implemented:
1. Story 4.4/4.5 will add `card:completed` events to the event stream
2. This function just needs to scan for those events within the current song window
3. No changes to the award generator itself needed — the `cardCompleted` context flag flows through

### What This Story Does NOT Build

- **No ceremony socket handlers** — Story 3.3 creates `ceremony-handlers.ts` and calls `generateCeremonyAward`
- **No ceremony UI** — Story 3.3 (Full) and 3.4 (Quick) build Flutter ceremony screens
- **No moment card generation** — Story 3.5
- **No reaction handlers** — Epic 4, Story 4.1 (reactionCount will be 0 until then)
- **No card challenge detection** — Epic 4, Stories 4.4/4.5 (cardCompleted always false until then)
- **No end-of-night award consumption** — Epic 8
- **No vibe-based tone filtering** — Architecture mentions vibe affects "award copy flavor" but the vibe-keyed flavors are Flutter-side display concerns (already in `copy.dart`). Server-side award generation is vibe-agnostic — Flutter adds vibe-flavored display text

### Existing Code to NOT Modify

- `dj-engine/*` — No changes. Award generation is not DJ engine logic
- `services/ceremony-selection.ts` — No changes. Ceremony type selection (full/quick) is independent of award content
- `services/participation-scoring.ts` — No changes. Scoring is consumed as input, not modified
- `socket-handlers/*` — No changes. No handlers call the award generator yet (Story 3.3/3.4 will)
- `services/dj-broadcaster.ts` — No changes. Awards are not broadcast with DJ state
- Flutter files — No changes. This is server-only

### Previous Story Intelligence (Story 3.1)

Story 3.1 established:
- In-memory `scoreCache` (private Map) in session-manager — reuse for reading performer participation scores. NOT exported, but `buildAwardContext` lives inside session-manager so direct access is fine
- `getScoreCacheKey(sessionId, userId)` helper (private, not exported) — reuse for building award context
- DJ context accessed via `getSessionDjState(sessionId)` from `dj-state-store.js` (already imported in session-manager)
- Fire-and-forget DB persistence pattern via `.catch()` — same pattern for `updateTopAward`
- `appendEvent()` for event stream logging — same pattern for `ceremony:awardGenerated`
- Pure function pattern in `participation-scoring.ts` — award-generator follows same approach
- 479 tests pass across 37 test files — baseline for regression
- `clearScoreCache()` called in `endSession()` — add `clearSessionAwards()` alongside it

Key pattern from 3.1: New pure-logic service → own test file. Integration tests via session-manager test file.

### Git Intelligence

Recent commits follow pattern: `"Implement Story X.Y: Title with code review fixes"`
- Story 3.1 (most recent): Added `participation-scoring.ts` + `rate-limiter.ts` as pure services, orchestration in session-manager
- Session-manager is growing — `session-manager-awards.test.ts` follows the split-test pattern established by `session-manager-scoring.test.ts` and `session-manager-dj.test.ts`
- Test factories: `createTestParticipant` has `top_award: null` default — useful for award persistence tests

### Project Structure Notes

New files:
- `apps/server/src/services/award-generator.ts` — Pure award template pool + context-driven selection logic
- `apps/server/tests/services/award-generator.test.ts`
- `apps/server/tests/services/session-manager-awards.test.ts`

Modified files:
- `apps/server/src/services/event-stream.ts` — Add `ceremony:awardGenerated` event type + import AwardTone
- `apps/server/src/services/session-manager.ts` — Add `generateCeremonyAward()`, `buildAwardContext()`, helpers, cleanup in `endSession()`
- `apps/server/src/persistence/session-repository.ts` — Add `updateTopAward()`

Existing test files to extend:
- `apps/server/tests/persistence/session-repository.test.ts` — Add `updateTopAward` tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.2] — 20+ templates, 4 tones, context-driven selection, no audience voting (FR18a, FR20)
- [Source: _bmad-output/planning-artifacts/architecture.md#Ceremonies FR16-21] — Award generation within ceremony timing window, server-side
- [Source: _bmad-output/planning-artifacts/architecture.md#Event Stream] — SessionEvent discriminated union, `ceremony:reveal` event shape
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements to Structure] — `services/award-generator.ts` file location
- [Source: _bmad-output/project-context.md#Server Boundaries] — services are pure logic, session-manager orchestrates, socket-handlers NEVER call persistence
- [Source: _bmad-output/project-context.md#Database Schema] — `session_participants.top_award` column
- [Source: _bmad-output/project-context.md#Testing Rules] — Shared factories, mirrors src structure
- [Source: apps/server/src/services/event-stream.ts] — Current 17 event types, `ceremony:typeSelected` existing pattern
- [Source: apps/server/src/services/session-manager.ts] — `recordParticipationAction` pattern, `scoreCache`, `getScoreCacheKey`, `endSession()` cleanup
- [Source: apps/server/src/services/participation-scoring.ts] — Pure function pattern, `ACTION_TIER_MAP` for reference
- [Source: apps/server/src/dj-engine/ceremony-selection.ts] — `selectCeremonyType` is independent, NOT modified by this story
- [Source: apps/server/src/persistence/session-repository.ts] — Existing `incrementParticipationScore` pattern for `updateTopAward`
- [Source: apps/server/tests/factories/participant.ts] — `createTestParticipant` with `top_award: null` default
- [Source: apps/flutter_app/lib/constants/copy.dart] — `vibeAwardFlavors` map (Flutter display concern, not server-side)
- [Source: _bmad-output/implementation-artifacts/3-1-participation-scoring-system.md] — Previous story: 479 tests, 37 files, pure service + session-manager orchestration pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `countRecentReactions` algorithm: story spec used a two-pass backward scan with `inCurrentSong` flag, but this incorrectly skipped reactions occurring after the last song start. Simplified to single backward scan that counts reactions until hitting the first `dj:stateChanged` to `song` event.

### Completion Notes List

- Task 1: Created `award-generator.ts` with `AwardTone` const enum, `AwardTemplate` interface, and pool of 24 templates across 4 tones (comedic, hype, absurd, wholesome) with optional context affinity properties
- Task 2: Implemented `generateAward()` with deterministic `randomFn` parameter, `calculateWeight()` for context-driven affinity scoring, `weightedRandomSelect()` for weighted random, and dedup via `previousAwards` filtering with fallback to repeats when exhausted
- Task 3: Added `ceremony:awardGenerated` event type to `SessionEvent` union in `event-stream.ts` with type-only import of `AwardTone`
- Task 4: Added `updateTopAward()` to `session-repository.ts` — updates `session_participants.top_award` column
- Task 5: Added `generateCeremonyAward()` orchestration in `session-manager.ts` with `buildAwardContext()`, `countRecentReactions()`, `checkCardCompletion()` (stub), `clearSessionAwards()`, and cleanup in `endSession()`
- Task 6: 39 new tests across 3 files (26 award-generator, 11 session-manager-awards, 2 session-repository updateTopAward). Full regression: 511 tests pass, 12 skipped across 39 files (1 pre-existing failure in config.test.ts unrelated to this story)

### Change Log

- 2026-03-12: Implemented Story 3.2 — Award Template Engine with 24 templates, context-driven weighted selection, event stream integration, and DB persistence
- 2026-03-12: Code review fixes — extracted magic number thresholds as named constants, removed redundant test, added scoreCache integration test, improved clearSessionAwards test, fixed DJState enum usage in tests, corrected File List and test count claims

### File List

New files:
- apps/server/src/services/award-generator.ts
- apps/server/tests/services/award-generator.test.ts
- apps/server/tests/services/session-manager-awards.test.ts

Modified files:
- apps/server/src/services/event-stream.ts
- apps/server/src/services/session-manager.ts
- apps/server/src/persistence/session-repository.ts
- apps/server/tests/persistence/session-repository.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

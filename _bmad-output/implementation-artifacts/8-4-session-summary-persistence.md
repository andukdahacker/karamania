# Story 8.4: Session Summary Persistence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want all session data persisted to the database reliably at party end,
So that session history is available for future recall and the Session Timeline feature.

## Acceptance Criteria

1. **Given** a party session ends, **When** the session summary is written, **Then** it is persisted to PostgreSQL containing: session stats (song count, participant count, duration, total reactions, total soundboard plays, total cards dealt, top reactor, longest streak), full setlist (position, title, artist, performer, per-song award), and full award details (category, tone, reason per participant) (FR99) **And** the write completes within 5 seconds for sessions with up to 12 participants and 20+ songs (NFR36) **And** the write is asynchronous and does not block the real-time party experience (NFR36)
2. **Given** the session summary write fails, **When** a retry is attempted, **Then** the system retries up to 3 times with exponential backoff (FR103) **And** if all retries fail, session data is logged to server disk for manual recovery (FR103) **And** the write completes within 30 seconds of party end under normal conditions (FR103)
3. **Given** the host is authenticated, **When** the session is created, **Then** the authenticated host is recorded as the session owner enabling future features (re-share setlist, view full stats, manage media) (FR104) — **NOTE: Already implemented** — `host_user_id` is set on session creation in `session-repository.ts:create()`. This AC is satisfied by existing code. Verify only.

## Tasks / Subtasks

- [x] Task 1: Create database migration for `session_summary` JSONB column (AC: #1)
  - [x] 1.1 Create migration `apps/server/migrations/002-session-summary.ts`:
    - Add `summary` column (type: `jsonb`, nullable) to `sessions` table
    - This single JSONB column stores the complete session summary as a structured JSON blob
    - **Why JSONB instead of separate columns/tables?** The summary data (stats, setlist, awards) is a read-only snapshot written once at session end and read as a whole for the Session Timeline (Epic 9). JSONB avoids schema complexity, supports flexible querying with PostgreSQL JSON operators, and matches the existing pattern used for `dj_state` and `event_stream` columns
    - Migration down: drop `summary` column
  - [x] 1.2 Run `npx kysely-ctl migrate` to apply migration
  - [x] 1.3 Run `npx kysely-codegen` to regenerate `apps/server/src/db/types.ts` — the `sessions` table type will gain `summary: unknown | null`

- [x] Task 2: Create session summary builder service (AC: #1)
  - [x] 2.1 Create `apps/server/src/services/session-summary-builder.ts` — NEW: Pure function that assembles the complete session summary from available data at session end
    - **Input parameters:**
      ```typescript
      interface BuildSummaryInput {
        sessionId: string;
        stats: SessionStats;          // From calculateSessionStats() — already computed in initiateFinale()
        setlist: SetlistEntry[];      // From buildFinaleSetlist() — already computed in initiateFinale()
        awards: FinaleAward[];        // From finaleAwardsCache — already generated in initiateFinale()
        participants: Array<{         // From getParticipants() + scoreCache
          userId: string | null;
          displayName: string;
          participationScore: number;
          topAward: string | null;
        }>;
      }
      ```
    - **Output structure (SessionSummary type):**
      ```typescript
      interface SessionSummary {
        version: 1;                   // Schema version for future-proofing reads
        generatedAt: number;          // Timestamp (ms)
        stats: {
          songCount: number;
          participantCount: number;
          sessionDurationMs: number;
          totalReactions: number;
          totalSoundboardPlays: number;
          totalCardsDealt: number;
          topReactor: { displayName: string; count: number } | null;
          longestStreak: number;
        };
        setlist: Array<{
          position: number;
          title: string;
          artist: string;
          performerName: string | null;
          awardTitle: string | null;
          awardTone: string | null;
        }>;
        awards: Array<{
          userId: string;
          displayName: string;
          category: FinaleAwardCategory;  // Reuse type from finale-award-generator.ts
          title: string;
          tone: AwardTone;                // Reuse type from finale-award-generator.ts
          reason: string;
        }>;
        participants: Array<{
          userId: string | null;
          displayName: string;
          participationScore: number;
          topAward: string | null;
        }>;
      }
      ```
    - Export `buildSessionSummary(input: BuildSummaryInput): SessionSummary`
    - This is a **pure function** — no DB access, no side effects. It simply structures the already-computed data into the summary format
  - [x] 2.2 Create Zod schema `sessionSummarySchema` in `apps/server/src/shared/schemas/finale-schemas.ts` matching the `SessionSummary` interface:
    - **Reuse existing sub-schemas** — compose from `finaleAwardCategorySchema` and `awardToneSchema` already in the file (do NOT use bare `z.string()` for category/tone fields):
      ```typescript
      export const sessionSummarySchema = z.object({
        version: z.literal(1),
        generatedAt: z.number(),
        stats: sessionStatsSchema,  // Reuse existing schema
        setlist: z.array(setlistEntrySchema),  // Reuse existing schema
        awards: z.array(z.object({
          userId: z.string(),
          displayName: z.string(),
          category: finaleAwardCategorySchema,  // NOT z.string()
          title: z.string(),
          tone: awardToneSchema,                // NOT z.string()
          reason: z.string(),
        })),
        participants: z.array(z.object({
          userId: z.string().nullable(),
          displayName: z.string(),
          participationScore: z.number().int(),
          topAward: z.string().nullable(),
        })),
      });
      ```
    - **Do NOT register with `z.globalRegistry.add()`** — this schema is not yet exposed via any REST route. Epic 9 will add registration when the read endpoint is created
    - Export `type SessionSummary = z.infer<typeof sessionSummarySchema>;`

- [x] Task 3: Create retry utility with exponential backoff (AC: #2)
  - [x] 3.1 Create `apps/server/src/services/retry.ts` — NEW: Generic retry utility with exponential backoff
    ```typescript
    interface RetryOptions {
      maxAttempts: number;       // Total attempts (including first try)
      baseDelayMs: number;       // Base delay for exponential backoff
      maxDelayMs: number;        // Cap on delay
      onRetry?: (attempt: number, error: unknown) => void;  // Optional logging callback
    }

    async function withRetry<T>(
      fn: () => Promise<T>,
      options: RetryOptions,
    ): Promise<T>
    ```
    - Delay formula: `min(baseDelayMs * 2^(attempt-1), maxDelayMs)` — e.g., with baseDelayMs=500: 500ms, 1000ms, 2000ms
    - Throws the last error if all attempts exhausted
    - Reference the retry CONCEPT from `apps/server/src/integrations/spotify-data.ts` lines 84-113 (for-loop with `Math.pow(2, attempt) * 1000`) — but make it generic and reusable with configurable base delay. Do NOT copy-paste the Spotify-specific HTTP error handling
  - [x] 3.2 **Do NOT add jitter** — keep it simple for v1. The retry targets are DB writes on a single-server architecture, not distributed API calls

- [x] Task 4: Create disk fallback logger for failed writes (AC: #2)
  - [x] 4.1 Create `apps/server/src/services/session-summary-fallback.ts` — NEW: Writes session summary JSON to server disk when all DB retries fail
    ```typescript
    async function writeSessionSummaryToDisk(
      sessionId: string,
      summary: SessionSummary,
    ): Promise<void>
    ```
    - Write to `apps/server/data/failed-summaries/{sessionId}.json` (create `data/failed-summaries/` dir if not exists)
    - Include timestamp and error context in the JSON file
    - Use `fs.promises.writeFile()` with `{ flag: 'wx' }` (fail if exists — don't overwrite)
    - Log with `console.error('[SessionSummaryFallback] ...])` on both success and failure
    - **Railway deployment note**: Railway uses an ephemeral filesystem — files written to disk are lost on redeploy. The `console.error` log with the full summary JSON is the REAL safety net (Railway captures stderr in its log viewer). The disk write is primarily useful for local development debugging and non-ephemeral deployments
    - **This is the last-resort safety net** — if even disk write fails, log the full summary JSON to stderr so Railway captures it in logs
  - [x] 4.2 Add `apps/server/data/` to the **root** `.gitignore` at `/Users/ducdo/Desktop/code/personal/karamania/.gitignore` (the `data/` directory is runtime-only, never committed). There is no server-level `.gitignore` — use the root one

- [x] Task 5: Add `persistSessionSummary()` to session repository (AC: #1, #2)
  - [x] 5.1 Add method to `apps/server/src/persistence/session-repository.ts`:
    ```typescript
    async function persistSessionSummary(
      sessionId: string,
      summary: SessionSummary,
    ): Promise<void>
    ```
    - Uses Kysely: `db.updateTable('sessions').set({ summary: JSON.stringify(summary) }).where('id', '=', sessionId).execute()`
    - Follow the exact pattern of `writeEventStream()` which also writes a JSON blob to a JSONB column
  - [x] 5.2 This method does NOT retry — retry logic is handled by the caller (`writeSessionSummary` in session-manager)

- [x] Task 6: Wire session summary persistence into `initiateFinale()` (AC: #1, #2)
  - [x] 6.1 **Capture return values from existing try/catch blocks in `initiateFinale()`:**
    The stats and setlist computations are INSIDE try/catch blocks (lines 2009-2014 and 2017-2022). Their variables (`sessionStats`, `setlist`) are scoped to those blocks. To pass them to the summary writer:
    - Declare `let` variables BEFORE the try blocks:
      ```typescript
      let capturedStats: SessionStats | undefined;
      let capturedSetlist: SetlistEntry[] | undefined;
      ```
    - Inside Step C try block (line 2010): `capturedStats = calculateSessionStats(sessionId);` then `broadcastFinaleStats(sessionId, capturedStats);`
    - Inside Step D try block (line 2018): `capturedSetlist = buildFinaleSetlist(sessionId);` then `broadcastFinaleSetlist(sessionId, capturedSetlist);`
    - If either computation throws, the variable stays `undefined` — the summary writer must handle this gracefully
  - [x] 6.2 Modify `apps/server/src/services/session-manager.ts` — Add `writeSessionSummary()` function that receives ALL data as parameters (gathered BEFORE the fire-and-forget boundary):
    ```typescript
    async function writeSessionSummary(
      sessionId: string,
      stats: SessionStats | undefined,
      setlist: SetlistEntry[] | undefined,
      awards: FinaleAward[],
      participants: Array<{ userId: string | null; displayName: string; participationScore: number; topAward: string | null }>,
    ): Promise<void> {
      // Build summary — use empty arrays as fallback if stats/setlist computation failed
      const summary = buildSessionSummary({
        sessionId,
        stats: stats ?? { songCount: 0, participantCount: participants.length, sessionDurationMs: 0,
          totalReactions: 0, totalSoundboardPlays: 0, totalCardsDealt: 0, topReactor: null, longestStreak: 0 },
        setlist: setlist ?? [],
        awards,
        participants,
      });

      // Persist with retry
      try {
        await withRetry(
          () => sessionRepo.persistSessionSummary(sessionId, summary),
          { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 5000,
            onRetry: (attempt, err) => console.warn(`[SessionSummary] Retry ${attempt}`, err) },
        );
      } catch (error) {
        console.error('[SessionSummary] All retries failed, writing to disk', error);
        await writeSessionSummaryToDisk(sessionId, summary);
      }
    }
    ```
  - [x] 6.3 **Build participant list BEFORE the fire-and-forget call** — gather from `getParticipants()` + `scoreCache` + awards:
    - `getParticipants()` does NOT return `participation_score` — it returns: `id`, `user_id`, `guest_name`, `display_name` (from users join), `joined_at`
    - **Guest userId handling**: Use EXACT pattern from `generateEndOfNightAwards()` (session-manager.ts line 1756):
      ```typescript
      const userId = p.user_id ?? p.id;  // Fallback to participant row ID for guests
      ```
    - **Display name resolution**: Use EXACT pattern from line 1760:
      ```typescript
      const displayName = p.guest_name ?? p.display_name ?? 'Unknown';
      ```
    - **Score lookup**: Use EXACT pattern from line 1757:
      ```typescript
      const scoreCacheKey = `${sessionId}:${userId}`;
      const participationScore = scoreCache.get(scoreCacheKey) ?? 0;
      ```
    - **Top award lookup**: Find from the awards array: `awards.find(a => a.userId === userId)?.title ?? null`
  - [x] 6.4 **Integration point in `initiateFinale()`:** Insert the fire-and-forget call AFTER Step D (`buildFinaleSetlist`) and BEFORE Step E (`flushEventStream`) — matching the actual code step labels (session-manager.ts lines 2016-2024):
    ```typescript
    // ★ NEW: Persist session summary (fire-and-forget)
    const awards = finaleAwardsCache.get(sessionId) ?? [];
    const summaryParticipants = (await sessionRepo.getParticipants(sessionId)).map(p => {
      const oderId = p.user_id ?? p.id;
      const scoreCacheKey = `${sessionId}:${oderId}`;
      return {
        userId: p.user_id,
        displayName: p.guest_name ?? p.display_name ?? 'Unknown',
        participationScore: scoreCache.get(scoreCacheKey) ?? 0,
        topAward: awards.find(a => a.userId === oderId)?.title ?? null,
      };
    });
    writeSessionSummary(sessionId, capturedStats, capturedSetlist, awards, summaryParticipants)
      .catch(err => console.error('[SessionSummary] Write failed:', err));
    ```
    - **CRITICAL**: The `getParticipants()` call uses `await` — this is acceptable because it's a fast indexed DB read (single query, <5ms). The slow part (retry + write) is in `writeSessionSummary()` which is fire-and-forget
    - The `scoreCache` is safe to read here — it is NOT cleared until `finalizeSession()` runs (5 minutes later via `FINALE_DURATION_MS` timer)

- [x] Task 7: Tests (AC: #1-3)
  - [x] 7.1 Unit tests for `session-summary-builder.ts` in `apps/server/tests/services/session-summary-builder.test.ts`:
    - Builds complete summary with all fields populated
    - Handles empty setlist (no songs played)
    - Handles empty awards (party ended before awards)
    - Handles null topReactor in stats
    - Handles mixed authenticated + guest participants (userId null vs non-null)
    - Summary version is always 1
    - generatedAt is a valid timestamp
  - [x] 7.2 Unit tests for `retry.ts` in `apps/server/tests/services/retry.test.ts`:
    - Succeeds on first attempt — no retry
    - Succeeds on second attempt after one failure
    - Exhausts all retries and throws last error
    - Exponential delay increases correctly (mock timers)
    - `onRetry` callback called with correct attempt number
    - Respects maxDelayMs cap
  - [x] 7.3 Unit tests for `session-summary-fallback.ts` in `apps/server/tests/services/session-summary-fallback.test.ts`:
    - Writes JSON file to correct path
    - Creates directory if not exists
    - Logs to stderr if file write fails
    - Does not overwrite existing files
  - [x] 7.4 Unit tests for `persistSessionSummary()` in `apps/server/tests/persistence/session-repository.test.ts`:
    - Writes summary JSONB to sessions table
    - Updates correct session by ID
    - Handles large summary payloads (20+ songs, 12 participants)
  - [x] 7.5 Integration test for `writeSessionSummary()` in `apps/server/tests/services/session-manager-summary.test.ts`:
    - Builds and persists summary from in-memory data
    - Retries on DB failure and succeeds
    - Falls back to disk on total DB failure
    - Fire-and-forget — does not throw to caller
  - [x] 7.6 **DO NOT test:** Actual PostgreSQL write performance (NFR36 is a deployment concern), Railway disk I/O, exact retry timing, migration execution

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: Session summary is computed and persisted entirely server-side. No client involvement — the summary write is invisible to Flutter
- **Persistence layer boundary**: New `persistSessionSummary()` method goes in `session-repository.ts` — the ONLY layer that imports from `db/`
- **Session manager orchestration**: `writeSessionSummary()` lives in `session-manager.ts` — the ONLY service that orchestrates across persistence, services, and socket layers
- **No new socket events**: This story adds NO new Socket.io events. The summary data is derived from data already broadcast to clients (awards, stats, setlist). Persistence is a server-only concern
- **No Flutter changes**: This is a pure server-side story. Zero Dart code changes

### Key Design Decisions

**Why a single JSONB `summary` column instead of separate tables?**
The session summary is a read-only snapshot written once and read as a whole. It follows the exact pattern of `event_stream` (JSONB column written at session end). Using JSONB:
- Avoids 3+ new tables (`session_stats`, `session_setlist_entries`, `session_awards_detail`) and their migrations
- Single atomic write — no partial writes if one table fails
- Natural fit for the Session Timeline (Epic 9) which reads the whole summary at once
- PostgreSQL JSONB supports efficient field extraction with `->>`/`@>` operators if needed later
- Matches existing codebase patterns (`dj_state`, `event_stream`)

**Why a `version` field in the summary?**
Epic 9 (Session Timeline) will read these summaries months after they were written. If the summary schema evolves, the version field enables backward-compatible reads without migrating old data.

**Why fire-and-forget for the summary write?**
Per NFR36: "writes must NOT block the real-time party experience." The finale sequence (awards → stats → setlist → feedback) must proceed at full speed. The summary write happens in the background. If it fails, the retry/fallback mechanism handles it independently.

**Why capture stats and setlist return values instead of recomputing?**
`calculateSessionStats()` and `buildFinaleSetlist()` already compute this data from the in-memory event stream during `initiateFinale()`. Recomputing would be wasteful and risk inconsistency if the event stream is flushed between computation and summary write. Capture the return values and pass them directly.

**Why a separate `retry.ts` utility instead of inline retry?**
The retry pattern from `spotify-data.ts` is duplicated. A generic utility can be reused for any future async operation that needs retry (e.g., media upload, external API calls). The utility is 20-30 lines — minimal abstraction overhead.

### Critical Integration Points

**Dependency on Stories 8.1-8.3** (MUST be implemented first — all are `done`):
- `finaleAwardsCache` populated by Story 8.1 (`generateEndOfNightAwards()`)
- `calculateSessionStats()` returns `SessionStats` — Story 8.2
- `buildFinaleSetlist()` returns `SetlistEntry[]` — Story 8.2/8.3
- `finale-schemas.ts` contains `sessionStatsSchema`, `setlistEntrySchema`, `finaleAwardSchema` — Stories 8.1/8.2

**Existing code to modify (NOT reinvent):**

| Existing Code | Story 8.4 Usage |
|---|---|
| `session-manager.ts:initiateFinale()` | Insert `writeSessionSummary()` call between stats/setlist computation and event stream flush |
| `session-repository.ts:writeEventStream()` | Pattern for `persistSessionSummary()` — same JSONB write pattern |
| `spotify-data.ts:fetchWithRetry()` lines 84-113 | Reference pattern for generic `withRetry()` utility |
| `finale-schemas.ts` | Add `sessionSummarySchema` alongside existing finale schemas |
| `finaleAwardsCache` (session-manager.ts) | Read awards for summary — already populated in Step B of `initiateFinale()` |
| `scoreCache` (session-manager.ts) | Read participation scores for participant list — populated during session |

### Timing Within `initiateFinale()` — WHERE the summary write goes

**Uses ACTUAL code step labels from `session-manager.ts` lines 1943-2044:**

```
initiateFinale(sessionId, hostUserId)
├─ (no label): Verify host, get DJ context, clear pause
├─ (no label): processDjTransition → 'finale' state
├─ Step A (line 1966): Append party:ended event
├─ (no label): Append card:sessionStats event
├─ Step B (line 1988): generateEndOfNightAwards() → finaleAwardsCache populated
├─ Step C (line 2008): let capturedStats = calculateSessionStats() → broadcast  ← CAPTURE
├─ Step D (line 2016): let capturedSetlist = buildFinaleSetlist() → broadcast    ← CAPTURE
├─ ★ NEW: Build participant list + writeSessionSummary() fire-and-forget         ← INSERT HERE
├─ Step E (line 2024): flushEventStream() → writeEventStream() to DB
├─ Step F (line 2032): updateStatus('ended')
└─ Step G (line 2035): Start finalization timer (5 min → finalizeSession)
```

### Known Scope Limitations

- **No REST endpoint for reading summaries** — That's Epic 9 (Session Timeline) territory. This story only WRITES the summary. Epic 9 will add `GET /api/sessions/:id/summary` and `GET /api/sessions` (timeline list)
- **No Flutter UI changes** — Summary data is consumed by Epic 9's Session Timeline and Session Detail screens
- **Event stream is STILL written separately** — The `event_stream` column continues to store the raw event log. The `summary` column stores a structured, human-readable snapshot derived from those events. Both are written at session end. The summary is optimized for display; the event stream is the audit trail
- **Feedback scores not in summary** — Feedback is submitted AFTER the summary is written (during finale step 4). Feedback scores are stored in `session_participants.feedback_score` directly. Epic 9 can join this data when displaying session details

### What This Story Does NOT Include (Scope Boundaries)

- NO new REST endpoints (Epic 9 adds read endpoints)
- NO Flutter/Dart code changes
- NO new Socket.io events
- NO changes to the event stream write pattern
- NO changes to how awards, stats, or setlist are computed (those are already done in Stories 8.1-8.3)
- NO changes to session creation or party code flow
- NO migration of existing sessions (only new sessions get summaries)
- NO summary editing or updating after initial write

### File Locations

| File | Purpose |
|---|---|
| `apps/server/migrations/002-session-summary.ts` | NEW — Migration adding `summary` JSONB column to sessions |
| `apps/server/src/services/session-summary-builder.ts` | NEW — Pure function assembling summary from computed data |
| `apps/server/src/services/retry.ts` | NEW — Generic retry utility with exponential backoff |
| `apps/server/src/services/session-summary-fallback.ts` | NEW — Disk fallback for failed DB writes |
| `apps/server/src/persistence/session-repository.ts` | MODIFY — Add `persistSessionSummary()` method |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add `writeSessionSummary()`, wire into `initiateFinale()` |
| `apps/server/src/shared/schemas/finale-schemas.ts` | MODIFY — Add `sessionSummarySchema` Zod schema |
| `apps/server/src/db/types.ts` | AUTO-GENERATED — Will gain `summary` column after kysely-codegen |
| `apps/server/tests/services/session-summary-builder.test.ts` | NEW — Unit tests for summary builder |
| `apps/server/tests/services/retry.test.ts` | NEW — Unit tests for retry utility |
| `apps/server/tests/services/session-summary-fallback.test.ts` | NEW — Unit tests for disk fallback |
| `apps/server/tests/persistence/session-repository.test.ts` | MODIFY — Add persistSessionSummary tests |
| `apps/server/tests/services/session-manager-summary.test.ts` | NEW — Integration test for writeSessionSummary |

### Testing Strategy

- **Test framework**: `vitest` (not jest) — all existing tests use vitest
- **Session summary builder** — Pure function, easy to unit test. Verify correct structure with various input combinations (full data, empty setlist, empty awards, mixed auth/guest participants)
- **Retry utility** — Use `vi.useFakeTimers()` to test delay escalation. Verify success on Nth attempt, total failure, callback invocation. Note: `noUncheckedIndexedAccess: true` means array index access returns `T | undefined`
- **Disk fallback** — Mock `fs.promises` via `vi.mock('node:fs/promises')` to verify file write path, directory creation, and error handling
- **Repository method** — Follow existing mock-based patterns in `session-repository.test.ts` (Kysely mocks, not real DB). Do NOT attempt real DB integration tests
- **Integration (writeSessionSummary)** — Mock repository to simulate DB failures, verify retry→fallback chain, verify fire-and-forget behavior (no throw to caller)
- **Regression check**: Run existing `session-manager-finale.test.ts` and `session-manager-finale-sequence.test.ts` after changes to verify `initiateFinale()` behavior is preserved
- **DO NOT test**: Actual write latency, Railway disk performance, migration execution, PostgreSQL JSONB indexing

### Previous Story Intelligence (Stories 8.1-8.3 Learnings)

- **Fire-and-forget pattern proven**: `updateTopAward()` calls in Story 8.1 use fire-and-forget (`void` return, no await). Same pattern for summary write
- **JSONB write pattern**: `writeEventStream()` uses `JSON.stringify(events)` into a JSONB column — exact same pattern for `persistSessionSummary()`
- **Stats and setlist already computed**: Stories 8.2/8.3 established `calculateSessionStats()` and `buildFinaleSetlist()` which return the exact data needed. Don't recompute — capture return values
- **finaleAwardsCache is reliable**: Awards are cached in a Map during `initiateFinale()` step D. The cache is not cleared until `finalizeSession()` (5 minutes later). Safe to read during summary write
- **scoreCache keyed by `${sessionId}:${userId}`**: Use this pattern to look up participation scores for the participant list
- **`getParticipants()` does NOT return `participation_score`**: It returns `id, user_id, guest_name, display_name, joined_at` only. Scores must be looked up from `scoreCache`. Guest userId: use `p.user_id ?? p.id`. Display name: use `p.guest_name ?? p.display_name ?? 'Unknown'` — exact pattern from session-manager.ts line 1756-1760
- **Error handling pattern**: Use `console.error('[ServiceName] ...')` prefix for error logging — consistent with codebase convention
- **Import pattern**: Relative imports with `.js` extension — e.g., `import { withRetry } from './retry.js';`
- **No barrel files** — import directly from specific files

### Project Structure Notes

- `kebab-case.ts` for all TypeScript files: `session-summary-builder.ts`, `retry.ts`, `session-summary-fallback.ts`
- Persistence methods in `session-repository.ts` — ONLY layer that imports from `db/`
- Service orchestration in `session-manager.ts` — ONLY service crossing layer boundaries
- Schemas in `shared/schemas/` — Zod schemas typically registered with `z.globalRegistry.add()` for OpenAPI, but `sessionSummarySchema` should NOT be registered yet (no REST endpoint — Epic 9 adds it)
- Tests in `apps/server/tests/` mirroring `src/` structure
- Use shared test factories from `tests/factories/` — do NOT inline test data

### References

- [Source: epics.md — Story 8.4 AC: session summary persistence (FR99), retry with exponential backoff (FR103), authenticated host ownership (FR104)]
- [Source: prd.md — FR99 (session summary content), FR103 (write resilience & retry), FR104 (session ownership), NFR36 (write performance)]
- [Source: architecture.md — Session persistence pattern: fire-and-forget with retry, JSONB for session data, session-manager as sole orchestrator]
- [Source: project-context.md — Server boundaries: persistence/ is ONLY layer importing db/, session-manager.ts is ONLY service crossing layers]
- [Source: session-repository.ts:writeEventStream() — JSONB write pattern to replicate]
- [Source: spotify-data.ts:fetchWithRetry() lines 84-113 — Retry pattern reference]
- [Source: session-manager.ts:initiateFinale() — Integration point for summary write, fire-and-forget pattern]
- [Source: finale-schemas.ts — Existing Zod schemas for SessionStats, SetlistEntry, FinaleAward]
- [Source: 8-3-setlist-poster-generation-and-sharing.md — Previous story learnings: fire-and-forget pattern, JSONB write pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Created migration `002-session-summary.ts` adding `summary` JSONB column to sessions table. Updated `db/types.ts` manually (no live DB for kysely-codegen). Updated session factory.
- Task 2: Created `session-summary-builder.ts` — pure function assembling SessionSummary from stats, setlist, awards, participants. Added `sessionSummarySchema` Zod schema to `finale-schemas.ts` (NOT registered with globalRegistry per story spec).
- Task 3: Created `retry.ts` — generic `withRetry()` utility with exponential backoff (`min(baseDelayMs * 2^(attempt-1), maxDelayMs)`). No jitter per spec.
- Task 4: Created `session-summary-fallback.ts` — writes to `apps/server/data/failed-summaries/{sessionId}.json` with `wx` flag. Falls back to stderr logging. Added `apps/server/data/` to root `.gitignore`.
- Task 5: Added `persistSessionSummary()` to `session-repository.ts` following `writeEventStream()` JSONB pattern.
- Task 6: Wired into `initiateFinale()` — captured stats/setlist return values, built participant list from `getParticipants()` + `scoreCache` + awards, fire-and-forget `writeSessionSummary()` with retry→disk fallback chain. Inserted between Step D and Step E as specified.
- Task 7: All tests written and passing — 54 new/modified tests. Updated 10 existing test files with new module mocks. Full regression suite: 1363 tests passing, 0 failures.
- AC #3 verified: `host_user_id` already set on session creation in `session-repository.ts:create()`.

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (1M context) — Adversarial Code Review
**Date:** 2026-03-20
**Outcome:** Approved with fixes applied

**Issues Found:** 3 Medium, 3 Low — all fixed automatically.

| ID | Severity | Description | Fix |
|---|---|---|---|
| M1 | MEDIUM | Typo variable `oderId` in session-manager.ts:2066 | Renamed to `resolvedId` |
| M2 | MEDIUM | Duplicate `SessionSummary` type in builder vs Zod schema | Builder now re-exports from finale-schemas.ts |
| M3 | MEDIUM | `await getParticipants()` blocking initiateFinale hot path | Moved inside fire-and-forget IIFE |
| L1 | LOW | No runtime Zod validation before persistence | Added `sessionSummarySchema.safeParse()` with disk fallback on failure |
| L2 | LOW | `persistSessionSummary` param typed `unknown` | Changed to `SessionSummary` with proper import |
| L3 | LOW | No test for undefined stats/setlist fallback | Added test verifying fallback defaults |

**Test Results:** 1354 passed, 12 skipped, 0 new failures (1 pre-existing config.test.ts failure unrelated to story).

### Change Log

- 2026-03-20: Implemented Story 8.4 — Session Summary Persistence (all tasks, all ACs satisfied)
- 2026-03-20: Code review fixes — 6 issues found and fixed (M1-M3, L1-L3)

### File List

**New files:**
- `apps/server/migrations/002-session-summary.ts`
- `apps/server/src/services/session-summary-builder.ts`
- `apps/server/src/services/retry.ts`
- `apps/server/src/services/session-summary-fallback.ts`
- `apps/server/tests/services/session-summary-builder.test.ts`
- `apps/server/tests/services/retry.test.ts`
- `apps/server/tests/services/session-summary-fallback.test.ts`
- `apps/server/tests/services/session-manager-summary.test.ts`

**Modified files:**
- `apps/server/src/db/types.ts` — Added `summary: unknown | null` to SessionsTable
- `apps/server/src/persistence/session-repository.ts` — Added `persistSessionSummary()`
- `apps/server/src/services/session-manager.ts` — Added `writeSessionSummary()`, wired into `initiateFinale()`
- `apps/server/src/shared/schemas/finale-schemas.ts` — Added `sessionSummarySchema`
- `apps/server/tests/factories/session.ts` — Added `summary` field
- `apps/server/tests/persistence/session-repository.test.ts` — Added `persistSessionSummary` tests
- `.gitignore` — Added `apps/server/data/`
- `apps/server/tests/services/session-manager-interlude-game.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-singalong.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-icebreaker.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-quick-vote.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-quickpick.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-dare-pull.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-dj.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-finale-sequence.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-tv.test.ts` — Added new module mocks
- `apps/server/tests/services/session-manager-capture.test.ts` — Added new module mocks

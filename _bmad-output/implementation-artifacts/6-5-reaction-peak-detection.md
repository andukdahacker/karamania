# Story 6.5: Reaction Peak Detection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to automatically detect when the crowd is going wild during a performance,
So that capture prompts fire at the most exciting moments of the party.

## Acceptance Criteria

1. **Given** reactions are being sent during a song performance (Epic 4 reaction event stream), **When** a sustained reaction rate spike above the baseline threshold is detected, **Then** the system identifies it as a reaction peak (FR73) **And** a `capture:bubble` event with `triggerType: 'reaction_peak'` is emitted to all phones in the session

2. **Given** peak detection logic, **When** it processes reaction data, **Then** all peak detection runs server-side to ensure consistent triggering across all devices (FR73) **And** the peak detection threshold is based on baseline reaction rate for the current session

3. **Given** peak detection is active, **When** a capture bubble was already emitted within the last 60 seconds, **Then** no additional peak bubble is emitted (existing `shouldEmitCaptureBubble()` cooldown in `capture-trigger.ts`)

4. **Given** a session with very few participants or low activity, **When** a small number of reactions arrive, **Then** no false-positive peak is detected (minimum absolute threshold required)

5. **Given** the DJ state is NOT `song`, **When** reactions arrive, **Then** they are ignored by the peak detector (reactions are already state-guarded in `reaction-handlers.ts`)

6. **Given** a session ends or is cleaned up, **When** cleanup runs, **Then** all peak detector state for that session is cleared (no memory leaks)

## Tasks / Subtasks

- [x] Task 1: Create peak detector service (AC: #1, #2, #4)
  - [x] 1.1 Create `apps/server/src/services/peak-detector.ts` -- pure logic, zero Socket.io dependency
  - [x] 1.2 Implement in-memory tracking: `Map<sessionId, { reactionTimestamps: number[], lastPeakAt: number }>` -- stores timestamps of all reactions in a rolling window
  - [x] 1.3 Implement `recordReaction(sessionId: string, now: number): boolean` -- appends timestamp, prunes old entries, runs detection, returns `true` if peak detected:
    - Sliding window: track reactions in the last `WINDOW_MS = 10_000` (10 seconds)
    - Baseline window: track reactions over last `BASELINE_WINDOW_MS = 300_000` (5 minutes)
    - Baseline rate: `(totalReactionsInBaseline / BASELINE_WINDOW_MS) * WINDOW_MS` = expected reactions per 10s window
    - Peak condition: `currentWindowCount >= MIN_REACTIONS_FOR_PEAK && currentWindowCount >= baselineRate * SPIKE_MULTIPLIER`
    - `MIN_REACTIONS_FOR_PEAK = 8` -- absolute minimum to prevent false positives in low-activity sessions
    - `SPIKE_MULTIPLIER = 3.0` -- current rate must be 3x the baseline to qualify as peak
    - Peak suppression: if `now - lastPeakAt < PEAK_COOLDOWN_MS (60_000)`, return false (internal cooldown matching bubble cooldown)
    - On peak detected: update `lastPeakAt = now`, return true
  - [x] 1.4 Implement `clearSession(sessionId: string): void` -- removes all state for a session
  - [x] 1.5 Implement `clearAllSessions(): void` -- for test cleanup
  - [x] 1.6 Export constants (`WINDOW_MS`, `BASELINE_WINDOW_MS`, `SPIKE_MULTIPLIER`, `MIN_REACTIONS_FOR_PEAK`, `PEAK_COOLDOWN_MS`) for test access

- [x] Task 2: Export `emitCaptureBubble` from session-manager (AC: #1)
  - [x] 2.1 In `apps/server/src/services/session-manager.ts`, change `function emitCaptureBubble(...)` from private to `export function emitCaptureBubble(...)` -- no logic changes needed, just add `export` keyword
  - [x] 2.2 Verify existing internal call sites (`post_ceremony`, `session_start`, `session_end`) still work unchanged

- [x] Task 3: Integrate peak detector into reaction handler (AC: #1, #2, #5)
  - [x] 3.1 In `apps/server/src/socket-handlers/reaction-handlers.ts`, import `{ recordReaction }` from `'../services/peak-detector.js'` and add `emitCaptureBubble` to the existing `session-manager.js` import (which already imports `recordParticipationAction`). The string literal `'reaction_peak'` satisfies the `CaptureTriggerType` union -- no separate type import needed
  - [x] 3.2 After the existing `appendEvent()` call (end of `REACTION_SENT` handler), add:
    ```typescript
    // Peak detection — server-side, consistent triggering (FR73)
    const isPeak = recordReaction(sessionId, now);
    if (isPeak) {
      emitCaptureBubble(sessionId, 'reaction_peak', context.state);
    }
    ```
  - [x] 3.3 Note: the state guard (`context.state !== DJState.song`) already prevents reactions during non-song states, so the peak detector never receives non-song reactions

- [x] Task 4: Replace placeholder in capture-trigger.ts (AC: #1)
  - [x] 4.1 Remove the TODO placeholder `emitReactionPeakBubble()` function from `apps/server/src/services/capture-trigger.ts` -- it is no longer needed because peak detection is integrated directly in reaction-handlers.ts via the `recordReaction() + emitCaptureBubble()` pattern
  - [x] 4.2 Remove the associated TODO comments (lines 26-32)

- [x] Task 5: Wire cleanup into session teardown (AC: #6)
  - [x] 5.1 In `apps/server/src/services/session-manager.ts`, import `clearSession` from `peak-detector.ts`
  - [x] 5.2 Call `clearSession(sessionId)` in the `endSession()` function alongside existing cleanup calls (`clearSessionStreaks`, `clearCaptureTriggerState`, `removeSessionDjState`, etc.)

- [x] Task 6: Server tests -- peak detector unit tests (AC: #1, #2, #4)
  - [x] 6.1 Create `apps/server/tests/services/peak-detector.test.ts`
  - [x] 6.2 Test: no peak with reactions below `MIN_REACTIONS_FOR_PEAK` (e.g., 5 reactions in 10s → false)
  - [x] 6.3 Test: no peak when rate is high but below `SPIKE_MULTIPLIER` of baseline (e.g., steady 6/10s baseline, spike to 12/10s → only 2x, no peak)
  - [x] 6.4 Test: peak detected when `currentWindowCount >= MIN_REACTIONS_FOR_PEAK AND >= baselineRate * SPIKE_MULTIPLIER` (e.g., baseline 3/10s, spike to 10/10s → 3.3x → peak)
  - [x] 6.5 Test: peak suppression -- second spike within 60s returns false
  - [x] 6.6 Test: peak detection works again after 60s cooldown expires
  - [x] 6.7 Test: cold start -- first 10s of a session with 8+ reactions triggers peak (baseline is 0, any activity above MIN is a peak)
  - [x] 6.8 Test: old timestamps are pruned beyond baseline window (memory cleanup)
  - [x] 6.9 Test: `clearSession` removes all state; subsequent `recordReaction` starts fresh
  - [x] 6.10 Test: reactions spread across time build proper baseline (simulate 5 minutes of moderate activity, then sudden spike)

- [x] Task 7: Server tests -- update existing reaction handler mocks + add peak integration tests (AC: #1, #3)
  - [x] 7.1 **CRITICAL -- Prevent existing test breakage**: In `apps/server/tests/socket-handlers/reaction-handlers.test.ts`, add `vi.mock` for the new peak-detector import. This file already mocks ALL services (`rate-limiter`, `session-manager`, `streak-tracker`, `event-stream`, `activity-tracker`). Without this mock, the existing 18 tests will FAIL when `reaction-handlers.ts` imports `recordReaction`:
    ```typescript
    vi.mock('../../src/services/peak-detector.js', () => ({
      recordReaction: vi.fn().mockReturnValue(false),
      clearSession: vi.fn(),
      clearAllSessions: vi.fn(),
    }));
    ```
  - [x] 7.2 **Add `emitCaptureBubble` to the existing `session-manager.js` mock**: The file already mocks `recordParticipationAction` and `persistDjState` from session-manager. Add `emitCaptureBubble: vi.fn()` to the mock factory so the new import resolves
  - [x] 7.3 **Verify all 17 existing tests still pass** after adding the mocks above (with `recordReaction` defaulting to `false`, no peak behavior triggers)
  - [x] 7.4 Add new `describe('peak detection triggering')` block with tests:
    - Test: configure `recordReaction` mock to return `true` after N calls, fire N+1 reactions → verify `emitCaptureBubble` was called with `(sessionId, 'reaction_peak', 'song')`
    - Test: `recordReaction` returns `false` → verify `emitCaptureBubble` was NOT called
    - Test: reactions during non-`song` state → handler exits early, neither `recordReaction` nor `emitCaptureBubble` called
  - [x] 7.5 Note: these tests verify the **wiring** between reaction-handler → peak-detector → emitCaptureBubble. The peak detection algorithm itself is fully tested in Task 6 (peak-detector.test.ts)

## Dev Notes

### Architecture Compliance

- **Server boundary**: `peak-detector.ts` is a pure logic service in `services/` -- zero Socket.io imports, zero persistence imports. It only tracks in-memory timestamps and returns boolean. Matches the `rate-limiter.ts` pattern exactly (pure function, called from socket handler)
- **Socket handler boundary**: `reaction-handlers.ts` calls `peak-detector.recordReaction()` and `session-manager.emitCaptureBubble()`. Handler orchestrates between services -- never calls persistence directly
- **Session-manager boundary**: `emitCaptureBubble()` is exported (was private) so it can be called from reaction-handlers. It still uses `shouldEmitCaptureBubble()` + `markBubbleEmitted()` from `capture-trigger.ts` for cooldown/state checks, `getIO()` from `dj-broadcaster.ts` for emission, and `appendEvent()` for logging. The function's internal logic does NOT change
- **No Flutter changes**: Peak detection is 100% server-side (FR73). The Flutter client already handles `capture:bubble` events via `SocketClient` → `CaptureProvider.onCaptureBubbleTriggered()`. The `triggerType: 'reaction_peak'` is already a valid value in the capture schema and provider

### Key Technical Decisions

- **Sliding window algorithm**: Track raw timestamps instead of pre-aggregated counts. This gives flexibility for baseline calculation and allows pruning. Memory cost is bounded: at max ~30 reactions/sec for 5 minutes = ~9000 timestamps per session (trivial)
- **Baseline = rolling 5-minute average**: The baseline adapts to the session's energy level. High-energy sessions need bigger spikes to trigger peaks. Quiet sessions need less absolute activity. This prevents false positives in both scenarios
- **Cold start handling**: In the first 10 seconds of reactions (no baseline yet), the `MIN_REACTIONS_FOR_PEAK` absolute threshold is the only gate. This means the first burst of 8+ reactions in 10s triggers a peak -- which is correct behavior for the start of an exciting song
- **Dual cooldown**: Both `peak-detector.ts` (internal `PEAK_COOLDOWN_MS`) and `capture-trigger.ts` (`shouldEmitCaptureBubble` 60s cooldown) prevent spam. The peak detector's internal cooldown means it won't even bother checking `emitCaptureBubble()` if it recently detected a peak. This is belt-and-suspenders
- **Why not use event stream**: The event stream (`getEventStream()`) returns a copy of all events. Filtering for `reaction:sent` events every time a reaction arrives would be O(n) on the total stream. The dedicated in-memory timestamp array in `peak-detector.ts` is O(1) append with periodic O(n) pruning on just reaction timestamps
- **Why export `emitCaptureBubble` instead of duplicating**: The function has 5 lines of logic (cooldown check, mark, io.emit, event log). Duplicating it would violate DRY and create divergence risk. Exporting it keeps the bubble emission logic in one place

### What Already Exists (From Stories 6.1-6.4 and Epic 4)

| Component | Location | Relevance |
|---|---|---|
| `capture-trigger.ts` | `apps/server/src/services/` | Bubble cooldown + state checks. Remove placeholder `emitReactionPeakBubble()` |
| `emitCaptureBubble()` (private) | `apps/server/src/services/session-manager.ts:1066` | Emit bubble + log event. Make `export` |
| `reaction-handlers.ts` | `apps/server/src/socket-handlers/` | Integration point -- add peak detection call after event logging |
| `rate-limiter.ts` | `apps/server/src/services/` | Pattern reference for pure service design. NOT used by peak detector (different concern) |
| `streak-tracker.ts` | `apps/server/src/services/` | Pattern reference for in-memory session state tracking with cleanup |
| `event-stream.ts` | `apps/server/src/services/` | Has `reaction:sent` event type. NOT used by peak detector directly |
| `capture-handlers.ts` | `apps/server/src/socket-handlers/` | No changes needed -- handles `capture:started`/`capture:complete` from client |
| `capture_provider.dart` | `apps/flutter_app/lib/state/` | Already handles `capture:bubble` with `triggerType` routing. No changes needed |
| `capture_bubble.dart` | `apps/flutter_app/lib/widgets/` | Already shows bubble on `onCaptureBubbleTriggered()`. No changes needed |
| `client.dart` | `apps/flutter_app/lib/socket/` | Already listens for `capture:bubble` event. No changes needed |
| `capture-schemas.ts` | `apps/server/src/shared/schemas/` | Already has `'reaction_peak'` as valid `triggerType`. No changes needed |
| `events.ts` | `apps/server/src/shared/` | Already has `CAPTURE_BUBBLE` constant. No changes needed |

### What Does NOT Exist Yet (Create in 6.5)

| Component | Location | Purpose |
|---|---|---|
| `peak-detector.ts` | `apps/server/src/services/` | Reaction rate spike detection algorithm |
| `peak-detector.test.ts` | `apps/server/tests/services/` | Unit tests for peak detection logic |

### Previous Story Intelligence (6.4: Server-Side Media Storage)

- **Capture flow is complete**: REST metadata creation → Firebase Storage upload → signed URL download. Peak detection plugs into the TRIGGER side, not the storage side
- **`emitCaptureBubble` pattern**: Used in session-manager for `session_start`, `post_ceremony`, `session_end`. The function is well-tested implicitly through these paths. Making it `export` is a safe change
- **Session cleanup pattern**: `endSession()` in session-manager already calls `clearSessionStreaks(sessionId)`, `clearCaptureTriggerState(sessionId)`, `removeSessionDjState(sessionId)`, etc. Adding `clearSession(sessionId)` from peak-detector follows the exact same pattern
- **Code review fix from 6.4**: H2 required passing userId to createCapture REST call. M1 required mounted checks after async gaps. These are Flutter-side patterns -- not relevant to this server-only story

### Git Intelligence (Recent Commits)

Recent commits follow the pattern `Implement Story X.Y: Title with code review fixes`. All Epic 6 stories (6.1-6.4) were implemented sequentially. The codebase is stable with all previous stories completed.

### Algorithm Details

```
CONFIGURATION:
  WINDOW_MS         = 10,000    (10-second sliding window for current rate)
  BASELINE_WINDOW_MS = 300,000  (5-minute rolling window for baseline)
  SPIKE_MULTIPLIER  = 3.0       (current rate must be 3x baseline)
  MIN_REACTIONS_FOR_PEAK = 8    (absolute minimum in current window)
  PEAK_COOLDOWN_MS  = 60,000    (suppress peaks for 60s after detection)

ON EACH REACTION:
  1. Append timestamp to session's reactionTimestamps array
  2. Prune timestamps older than BASELINE_WINDOW_MS
  3. If now - lastPeakAt < PEAK_COOLDOWN_MS → return false
  4. Count reactions in last WINDOW_MS → currentCount
  5. If currentCount < MIN_REACTIONS_FOR_PEAK → return false
  6. Count reactions in last BASELINE_WINDOW_MS → baselineTotal
  7. baselineRate = (baselineTotal / BASELINE_WINDOW_MS) * WINDOW_MS
  8. If currentCount >= baselineRate * SPIKE_MULTIPLIER → PEAK DETECTED
     - Set lastPeakAt = now
     - Return true
  9. Else → return false
```

**Edge cases handled:**
- **Cold start (baselineRate ≈ 0)**: When `baselineRate * SPIKE_MULTIPLIER < MIN_REACTIONS_FOR_PEAK`, the absolute minimum gate takes over. 8+ reactions in 10s with no baseline = peak
- **Sustained high activity**: If the party maintains 20 reactions/10s for 5 minutes, baseline becomes ~20. A spike of 60+/10s would be needed. This is correct -- a consistently active party needs a truly exceptional moment
- **Gradual ramp-up**: If activity slowly increases from 2 to 15 reactions/10s over 5 minutes, the baseline adapts. Only a sudden jump (3x) triggers a peak
- **Baseline self-contamination**: The 5-minute baseline window includes the current 10s spike. This is intentional -- the effect is negligible (10s/300s = 3.3% of baseline window) and avoids the complexity of excluding the current window
- **Single-user rapid tapping**: One user can send 8+ reactions in 10s (rate limiter allows all, just reduces reward multiplier). This could trigger a peak in a solo session. Acceptable for MVP since the bubble is just a prompt and the 60s cooldown prevents spam. Per-user deduplication in peak counting is a future enhancement

### Scope Boundaries -- What NOT to Implement

| Not in 6.5 | Belongs to |
|---|---|
| Client-side peak detection or prediction | Never -- FR73 mandates server-side only |
| Custom peak thresholds per session/vibe | Future enhancement -- hardcoded thresholds are MVP |
| Peak detection analytics/dashboard | Future story |
| Post-session peak highlights | Story 9.3/9.4 |
| Multi-signal peak detection (reactions + hype + soundboard) | Future enhancement |
| Peak intensity scoring (how big was the spike) | Future enhancement |
| Per-user deduplication in peak counting (prevent single-user false peaks) | Future enhancement |

### Project Structure Notes

**New files:**
- `apps/server/src/services/peak-detector.ts` -- peak detection algorithm
- `apps/server/tests/services/peak-detector.test.ts` -- unit tests

**Modified files:**
- `apps/server/src/services/session-manager.ts` -- export `emitCaptureBubble`, add `clearSession` to teardown
- `apps/server/src/socket-handlers/reaction-handlers.ts` -- add peak detection call
- `apps/server/src/services/capture-trigger.ts` -- remove `emitReactionPeakBubble` placeholder
- `apps/server/tests/socket-handlers/reaction-handlers.test.ts` -- add `vi.mock` for peak-detector + emitCaptureBubble, add peak integration tests

### Testing Notes

- **Peak detector is 100% unit-testable**: Pure function taking `(sessionId, now)` → boolean. No mocking needed for the core algorithm. Use manual timestamp injection to simulate reaction patterns
- **Integration tests use mocks, not real peak detection**: The `reaction-handlers.test.ts` file mocks ALL services. Task 7 tests verify the **wiring** (handler calls `recordReaction`, and if it returns `true`, calls `emitCaptureBubble`). The peak detection **algorithm** is fully tested in Task 6's dedicated unit tests
- **CRITICAL -- existing test protection**: When adding `import { recordReaction }` to `reaction-handlers.ts`, the existing test file MUST mock `peak-detector.js` with `recordReaction` defaulting to `false`. Without this, all 17 existing tests break. Also add `emitCaptureBubble` to the existing `session-manager.js` mock
- **DO NOT test**: Exact threshold tuning (these are configurable constants). Visual bubble appearance (already tested in 6.1). Client-side capture flow (already tested in 6.2-6.4)

### Error Handling

- **No errors to handle**: `recordReaction()` is a pure in-memory operation. No async, no I/O, no failure modes. If `emitCaptureBubble()` fails (io not available), it silently returns -- existing behavior
- **Memory cleanup**: `clearSession()` ensures no leaks on session end. The baseline window pruning (5 min) bounds memory per active session

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 6 Story 6.5 -- FR73]
- [Source: _bmad-output/planning-artifacts/epics.md, FR38 -- 4 defined trigger points including reaction peaks]
- [Source: _bmad-output/planning-artifacts/epics.md, FR67 -- floating capture bubble at reaction peaks]
- [Source: _bmad-output/planning-artifacts/architecture.md, Socket event registry -- reaction:* and capture:* events]
- [Source: _bmad-output/planning-artifacts/architecture.md, Rate limiter pure function pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md, Handler rules -- one file per namespace, rate limiter for user-action events]
- [Source: _bmad-output/project-context.md, Server Boundaries -- socket-handlers call services, NEVER persistence directly]
- [Source: _bmad-output/project-context.md, Testing Rules -- 100% coverage for dj-engine, shared factories, no inline test data]
- [Source: apps/server/src/services/capture-trigger.ts -- existing cooldown/state logic, placeholder at line 26-32]
- [Source: apps/server/src/services/session-manager.ts:1066 -- private emitCaptureBubble function]
- [Source: apps/server/src/socket-handlers/reaction-handlers.ts -- reaction processing pipeline, integration point]
- [Source: apps/server/src/services/rate-limiter.ts -- pure function pattern reference]
- [Source: apps/server/src/services/streak-tracker.ts -- in-memory session state + cleanup pattern reference]
- [Source: apps/server/src/services/event-stream.ts -- SessionEvent type including reaction:sent and capture:bubble]
- [Source: apps/server/src/shared/events.ts -- CAPTURE_BUBBLE event constant]
- [Source: apps/flutter_app/lib/state/capture_provider.dart -- already handles capture:bubble with triggerType routing]
- [Source: _bmad-output/implementation-artifacts/6-4-server-side-media-storage.md -- previous story patterns and session cleanup]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Created `peak-detector.ts` — pure logic service with sliding window algorithm, baseline calculation, spike detection, cooldown suppression, and session cleanup. Zero Socket.io dependency, matches `rate-limiter.ts` pattern
- Task 2: Exported `emitCaptureBubble` from session-manager — added `export` keyword only, no logic changes. All 1111 existing tests pass
- Task 3: Integrated peak detection into `reaction-handlers.ts` — imported `recordReaction` from peak-detector and `emitCaptureBubble` from session-manager. Added 3 lines after `appendEvent()` call
- Task 4: Removed `emitReactionPeakBubble()` placeholder and TODO comments from `capture-trigger.ts`
- Task 5: Wired `clearPeakDetectorState(sessionId)` into `endSession()` cleanup chain in session-manager, following existing pattern
- Task 6: Created 9 unit tests in `peak-detector.test.ts` covering: below-minimum reactions, below-multiplier spikes, valid peak detection, peak suppression/cooldown, cold start, timestamp pruning, clearSession, and baseline building over time. All pass
- Task 7: Added `vi.mock` for peak-detector and `emitCaptureBubble` to session-manager mock in reaction-handlers.test.ts. All 18 existing tests still pass. Added 3 new integration tests for peak detection wiring (peak triggers bubble, no peak skips bubble, non-song state skips both). Total: 21 tests pass

### Change Log

- 2026-03-18: Implemented Story 6.5 — Reaction Peak Detection (all 7 tasks complete, 12 new tests, 1111 total tests passing)
- 2026-03-18: Code review fixes — H1: removed stale `emitReactionPeakBubble` mocks from 11 test files. M1: added `resetLastPeak()` to peak-detector + `emitCaptureBubble` now returns boolean so peak cooldown isn't wasted when bubble is suppressed. M2: added `peak-detector.js` mock to `session-manager-dj.test.ts`. M3+L1: added session isolation, resetLastPeak, and clearAllSessions tests. L2: fixed "17" → "18" in Task 7.1. Total: 1116 tests passing (+5 new)

### File List

**New files:**
- `apps/server/src/services/peak-detector.ts`
- `apps/server/tests/services/peak-detector.test.ts`

**Modified files:**
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/socket-handlers/reaction-handlers.ts`
- `apps/server/src/services/capture-trigger.ts`
- `apps/server/tests/socket-handlers/reaction-handlers.test.ts`
- `apps/server/tests/services/session-manager-dj.test.ts`
- `apps/server/tests/services/session-manager-capture.test.ts`
- `apps/server/tests/services/session-manager-ceremony.test.ts`
- `apps/server/tests/services/session-manager-quickpick.test.ts`
- `apps/server/tests/services/session-manager-spinwheel.test.ts`
- `apps/server/tests/services/session-manager-recovery.test.ts`
- `apps/server/tests/services/session-manager-scoring.test.ts`
- `apps/server/tests/services/session-manager-tv.test.ts`
- `apps/server/tests/services/session-manager-suggestion.test.ts`
- `apps/server/tests/services/session-manager-detection.test.ts`
- `apps/server/tests/services/session-manager-awards.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/6-5-reaction-peak-detection.md`

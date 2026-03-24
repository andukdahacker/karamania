# Test Quality Fix Plan

**Created**: 2026-03-24
**Source**: TEA test-review workflow (score: 56/100)
**Goal**: Raise suite quality score from 56 to 80+ (Grade A)
**Scope**: 179 test files across Flutter (72) and Server (107)

---

## Phase 1: Server Mock Extraction

**Priority**: P0 | **Impact**: ~1,200 lines eliminated | **Risk**: Low | **Effort**: 2-3 hours

### Problem
6+ session-manager test files each contain 200-280 lines of nearly identical `vi.mock()` calls. Total duplication: ~1,400 lines.

### Tasks

1. **Create `tests/mocks/session-manager-deps.ts`**
   - Extract all common `vi.mock()` calls shared across session-manager-*.test.ts files
   - Export mock variable references (e.g., `mockGetSession`, `mockUpdateSession`) so tests can configure per-test behavior
   - Include `vi.clearAllMocks()` utility

2. **Create `tests/mocks/config.ts`**
   - Extract the `vi.mock('../../src/config.js')` pattern used in nearly every test file
   - Export `mockConfig` for per-test overrides

3. **Refactor each session-manager test file**
   - Replace inline `vi.mock()` walls with imports from shared mock modules
   - Verify all tests still pass after each file
   - Files to update:
     - `session-manager-dj.test.ts` (1,140 → ~860 lines)
     - `session-manager-icebreaker.test.ts` (691 → ~420 lines)
     - `session-manager.test.ts` (677 → ~450 lines)
     - `session-manager-ceremony.test.ts` (660 → ~400 lines)
     - `session-manager-quick-vote.test.ts` (688 → ~420 lines)
     - `session-manager-interlude-game.test.ts` (588 → ~350 lines)
     - `session-manager-tv.test.ts` (547 → ~310 lines)
     - `session-manager-dare-pull.test.ts` (512 → ~280 lines)
     - `session-manager-singalong.test.ts` (498 → ~260 lines)

4. **Run full server test suite** to verify no regressions

### Success Criteria
- All session-manager test files under 500 lines (ideally under 300)
- Zero duplicated `vi.mock()` blocks
- All existing tests pass

---

## Phase 2: Flutter Shared Test Infrastructure

**Priority**: P1 | **Impact**: ~500 lines eliminated, enables Phase 3 | **Risk**: Low | **Effort**: 2-3 hours

### Problem
Flutter tests have zero shared helpers. HTTP mock boilerplate (~80 lines), `_wrapWithProviders()`, and test object construction are copy-pasted across files.

### Tasks

1. **Create `test/helpers/fake_http.dart`**
   - Extract from `session_detail_screen_test.dart` (lines 21-79):
     - `TestHttpOverrides`
     - `FakeHttpClient`
     - `FakeHttpClientRequest`
     - `FakeHttpClientResponse`
     - `transparentPng` constant
   - Update `session_detail_screen_test.dart` and `home_screen_test.dart` to import shared helper

2. **Create `test/helpers/widget_test_helpers.dart`**
   - Unified `wrapWithProviders()` function with optional parameters for all common providers:
     - `PartyProvider`
     - `AuthProvider`
     - `SocketClient`
     - `CaptureProvider`
     - `AccessibilityProvider`
   - Replace per-file `_wrapWithProviders` implementations (5+ files)

3. **Create `test/factories/` directory**
   - `party_factory.dart`: `createTestPartyProvider()`, `createTestFinaleAward()`, `createTestParticipantInfo()`
   - `upload_factory.dart`: `createTestUploadItem()`
   - `card_factory.dart`: `createTestPartyCardData()`
   - Follow server factory pattern: typed overrides, auto-incrementing IDs

4. **Run full Flutter test suite** to verify no regressions

### Success Criteria
- Zero duplicated HTTP mock boilerplate
- Single `wrapWithProviders()` used across all widget tests
- Factory functions replace inline object construction in 5+ files

---

## Phase 3: Split `party_provider_test.dart`

**Priority**: P0 | **Impact**: 2,175 lines → 8 files averaging ~250 lines | **Risk**: Medium | **Effort**: 3-4 hours

### Problem
Single file with 17 groups and ~130 tests covering 8+ domains. Unmaintainable, hard to debug failures.

### Prerequisites
- Phase 2 complete (shared helpers available for extracted files)

### Tasks

1. **Create directory `test/state/party_provider/`**

2. **Extract by domain group** (map existing `group()` blocks to files):

   | New File | Source Groups | Est. Lines |
   |---|---|---|
   | `party_lifecycle_test.dart` | Party state, connection, status | ~200 |
   | `dj_state_test.dart` | DJ state transitions, timer | ~250 |
   | `reactions_test.dart` | Reaction handling, emoji state | ~200 |
   | `card_interaction_test.dart` | Card state, group cards, card deals | ~300 |
   | `spin_wheel_test.dart` | Spin wheel segments, selection | ~200 |
   | `tv_pairing_test.dart` | TV pairing, remote control | ~150 |
   | `detected_song_test.dart` | Song detection, queue management | ~150 |
   | `finale_awards_test.dart` | Finale awards, scoring | ~200 |

3. **Extract shared setup** into each file's own `setUp()`
   - Each file creates its own `PartyProvider` instance
   - Use factory from Phase 2 if applicable
   - Extract `wakelockCalls` capture pattern to shared helper
   - Extract `notifyCount` listener pattern to custom matcher or helper

4. **Delete original `party_provider_test.dart`** after all tests pass in new files

5. **Run full Flutter test suite** to verify no regressions

### Success Criteria
- All 8 new files under 300 lines
- All ~130 tests pass
- Original file deleted

---

## Phase 4: Server Socket Test Utilities

**Priority**: P1 | **Impact**: Consistency + ~100 lines eliminated | **Risk**: Low | **Effort**: 1 hour

### Tasks

1. **Create `tests/factories/socket.ts`**
   - `createMockSocket(overrides?)` -- unified socket mock
   - `createMockIo(overrides?)` -- unified server mock
   - Reconcile slightly different implementations from card-handlers and host-handlers

2. **Update socket handler test files** to import from shared factory

3. **Run socket handler tests** to verify no regressions

### Success Criteria
- Single source of truth for socket mocks
- All socket handler tests pass

---

## Phase 5: Small Fixes

**Priority**: P2-P3 | **Impact**: Polish | **Risk**: Low | **Effort**: 1-2 hours

### Tasks

1. **Remove hard wait** in `upload_queue_test.dart:176`
   - Replace `Future.delayed(100ms)` with `fakeAsync` + `elapse()`

2. **Fix `DateTime.now()` usage**
   - `party_screen_test.dart:477,559` → `DateTime(2026, 1, 1).millisecondsSinceEpoch`
   - `home_screen_test.dart:177,195,246,276,329` → `DateTime(2026, 1, 1)`
   - `tests/factories/dj-state.ts` → fixed timestamp `1704067200000`

3. **Fix `client_test.dart` issues**
   - Remove tautological mock tests (lines 280-316)
   - Move PartyProvider tests (lines 162-248) to appropriate test file
   - File should shrink from 717 to ~400 lines

4. **Run full test suites** (both apps) to verify

### Success Criteria
- Zero hard waits in suite
- Zero `DateTime.now()` / `Date.now()` in test inputs
- `client_test.dart` under 500 lines

---

## Estimated Score Impact

| Phase | Score Impact | Cumulative |
|---|---|---|
| Baseline | 56/100 | 56 |
| Phase 1: Mock extraction | +10 | 66 |
| Phase 2: Flutter helpers | +5 | 71 |
| Phase 3: Split party_provider | +8 | 79 |
| Phase 4: Socket utilities | +2 | 81 |
| Phase 5: Small fixes | +4 | 85 |
| **Target** | | **85/100 (A)** |

---

## Out of Scope (Addressed by Test Design Workflow)

The following concerns are **not covered** by this fix plan and should be addressed via the `testarch-test-design` workflow:

- **E2E test strategy**: No E2E tests exist. Need to plan what user journeys to cover and at what level
- **Manual test cases**: No documented manual test procedures for QA
- **Multi-device local testing**: The app is a multiplayer game requiring 3+ devices. Need a strategy for simulating multi-player scenarios (socket stubs, headless clients, test harness)
- **Test coverage gaps**: What functionality lacks any test coverage
- **Integration test strategy**: Server repository tests mock too deeply -- need real DB integration testing approach

---

## Execution Order

```
Phase 1 (Server mocks)     ─────►  can start immediately
Phase 2 (Flutter helpers)   ─────►  can start immediately (parallel with Phase 1)
Phase 3 (Split party_provider) ──►  depends on Phase 2
Phase 4 (Socket utilities)  ─────►  can follow Phase 1
Phase 5 (Small fixes)       ─────►  can start anytime (independent)
```

Phases 1, 2, and 5 can run in parallel. Phase 3 depends on Phase 2. Phase 4 follows naturally after Phase 1.

# Story 7.5: Group Sing-Along Activities

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party group,
I want group sing-along moments where everyone sings together,
So that the whole group shares the spotlight without anyone feeling singled out.

## Acceptance Criteria

1. **Given** the DJ engine reaches an activity that supports group participation, **When** a group sing-along is triggered (via `context.metadata.selectedActivity === 'group_singalong'`), **Then** a sing-along prompt card is displayed to all participants simultaneously **And** the prompt includes a universally known song title, a key lyric snippet, and a call-to-action for everyone to sing together **And** NO individual names appear on screen (FR21)
2. **Given** the sing-along prompt is displayed, **When** the display timer expires, **Then** the game auto-advances after 15 seconds (server-authoritative) **And** the system broadcasts `interlude:gameEnded` **And** triggers `INTERLUDE_DONE` to advance the DJ cycle
3. **Given** the interlude library selection, **When** Group Sing-Along is considered, **Then** it is selected via weighted random with no immediate repeats from the activity pool (FR28a) — this selection logic already exists in `activity-voter.ts`
4. **Given** the session timing, **When** the party is in its first 30 minutes, **Then** Group Sing-Along IS eligible for deployment — it is a universal activity (`universal: true` in ACTIVITY_POOL) front-loaded alongside Kings Cup and Quick Vote (FR15)
5. **Given** multiple interludes occur in a session, **When** Group Sing-Along is selected again, **Then** the same prompt is never dealt twice in a row (no immediate prompt repeats within a session)
6. **Given** the host triggers HOST_SKIP during a sing-along display, **When** the skip is processed, **Then** the game timer is cancelled via `clearInterludeTimers()` **And** the DJ cycle advances immediately

## Tasks / Subtasks

- [x] Task 1: Create Sing-Along prompt dealer service (AC: #1, #5)
  - [x] 1.1 Create `apps/server/src/services/singalong-dealer.ts` with `SingAlongPrompt` interface: `{ id: string; title: string; lyric: string; emoji: string }`. Follows exact `KingsCupCard` interface pattern from `kings-cup-dealer.ts`
  - [x] 1.2 Define `SINGALONG_PROMPTS` readonly array with 20+ universally known songs. Each prompt has: a song title (well-known across cultures/generations), a key lyric snippet (the most singable/recognizable line), and an emoji. Songs must be: universally recognizable (global hits, not culture-specific), have a highly singable chorus, fun in a group setting. Examples:
    - `{ id: 'bohemian-rhapsody', title: 'Bohemian Rhapsody', lyric: 'Is this the real life? Is this just fantasy?', emoji: '🎸' }`
    - `{ id: 'dont-stop-believing', title: "Don't Stop Believin'", lyric: "Don't stop believin'! Hold on to that feelin'!", emoji: '🌟' }`
    - `{ id: 'we-will-rock-you', title: 'We Will Rock You', lyric: 'We will, we will rock you!', emoji: '🤘' }`
    - `{ id: 'sweet-caroline', title: 'Sweet Caroline', lyric: 'Sweet Caroline! Bah bah bah!', emoji: '🎶' }`
    - `{ id: 'somebody-that-i-used-to-know', title: 'Somebody That I Used To Know', lyric: 'But you didn't have to cut me off!', emoji: '💔' }`
    - `{ id: 'dancing-queen', title: 'Dancing Queen', lyric: 'You are the dancing queen, young and sweet, only seventeen!', emoji: '👸' }`
  - [x] 1.3 Implement `dealPrompt(sessionId: string): SingAlongPrompt` — random selection from pool, no immediate repeat per session. Track `lastDealtPrompt` per session via module-level `Map<string, string>` (identical pattern to `lastDealtCard` in `kings-cup-dealer.ts`)
  - [x] 1.4 Implement `clearSession(sessionId: string): void` — cleanup `lastDealtPrompt` for session
  - [x] 1.5 Implement `resetAll(): void` — test utility to clear module-level Map
  - [x] 1.6 Export `SINGALONG_PROMPTS` for testing

- [x] Task 2: Add `group_singalong` case to session-manager dispatcher (AC: #1, #2, #6)
  - [x] 2.1 Add import at top of `session-manager.ts`:
    - `import { dealPrompt as dealSingAlongPrompt, clearSession as clearSingAlongSession } from '../services/singalong-dealer.js'`
  - [x] 2.2 Add constant `SINGALONG_GAME_DURATION_MS = 15_000` with comment: `// 15s — longer than Kings Cup (10s) to give group time to start singing; not specified in UX spec, tunable`
  - [x] 2.3 Add `group_singalong` case to `startInterludeGame` dispatcher, BEFORE the `else` fallback:
    ```typescript
    } else if (selectedActivity === 'group_singalong') {
      executeGroupSingAlong(sessionId);
    } else {
    ```
  - [x] 2.4 Create `executeGroupSingAlong(sessionId: string): void` — follows `executeKingsCup` pattern exactly:
    - Deal prompt: `const prompt = dealSingAlongPrompt(sessionId)`
    - Broadcast `interludeGameStarted` with: `{ activityId: 'group_singalong', card: { id: prompt.id, title: prompt.title, rule: prompt.lyric, emoji: prompt.emoji }, gameDurationMs: SINGALONG_GAME_DURATION_MS }`
    - **CRITICAL**: Map `SingAlongPrompt` fields to existing `card` shape: `title` = song title, `rule` = lyric snippet. Add comment: `// prompt.lyric maps to card.rule for InterludeGameCard reuse — Flutter overlay displays rule field as lyric text`
    - Append to event stream: `{ type: 'interlude:gameStarted', ts, data: { activityId: 'group_singalong', cardId: prompt.id } }`
    - Schedule `SINGALONG_GAME_DURATION_MS` timeout → call `endInterludeGame(sessionId)`
    - Store timer in `interludeGameTimers` Map
  - [x] 2.5 Wire `clearSingAlongSession(sessionId)` into session teardown at the same location where `clearKingsCupSession`, `clearDarePullSession`, and `clearQuickVoteSession` are called (around line 1690)

- [x] Task 3: Flutter Group Sing-Along overlay (AC: #1, #2)
  - [x] 3.1 Create `apps/flutter_app/lib/widgets/group_singalong_overlay.dart` — full-screen overlay, follows `KingsCupOverlay` pattern closely:
    - Accepts: `card` (InterludeGameCard), `gameDurationMs` (int), `timerStartedAt` (int? — for sync)
    - **Layout** (top to bottom):
      - Subtitle text: Copy.singAlongSubtitle (e.g., "EVERYONE SING!")
      - Large emoji from card (64pt, same as KingsCupOverlay)
      - Song title from `card.title` (large, bold — the song name)
      - Lyric snippet from `card.rule` (medium text, italic or lighter weight — the singable line)
      - Countdown timer (15s, synced with server time if `timerStartedAt` provided)
    - **Key difference from KingsCupOverlay**: The lyric text should feel inviting — it's a call to sing, not a rule to follow. Use a slightly different visual treatment (e.g., quotation marks around the lyric, or italic style) to distinguish from Kings Cup rule text
    - Entrance animation: FadeTransition similar to KingsCupOverlay (400ms easeOut)
    - **NO individual names** — no targeting, no spotlight, just a group prompt (FR21)
    - **NO interaction** — display-only, no buttons, no voting (simplest possible overlay)
  - [x] 3.2 Use `DJTokens` for all spacing/colors. Use `Key('singalong-overlay')`, `Key('singalong-title')`, `Key('singalong-lyric')`, `Key('singalong-countdown')`
  - [x] 3.3 All strings in `constants/copy.dart`: `singAlongSubtitle` (e.g., "EVERYONE SING!")

- [x] Task 4: Wire overlay into party screen (AC: #1)
  - [x] 4.1 In `party_screen.dart`, add `GroupSingAlongOverlay` to overlay stack:
    - Show when `partyProvider.interludeGameActivityId == 'group_singalong'` and `partyProvider.interludeGameCard != null`
    - Position in overlay stack next to `KingsCupOverlay`, `DarePullOverlay`, `QuickVoteOverlay` (mutually exclusive via `activityId` check)
    - Pass `card`, `gameDurationMs`, `timerStartedAt`
  - [x] 4.2 Import `GroupSingAlongOverlay` from `'../widgets/group_singalong_overlay.dart'`

- [x] Task 5: Tests (AC: all)
  - [x] 5.1 `apps/server/tests/services/singalong-dealer.test.ts`:
    - Prompt pool has 20+ prompts with required fields (id, title, lyric, emoji)
    - All prompts have non-empty id, title, lyric, emoji
    - All prompt IDs are unique
    - `dealPrompt()` returns valid prompt from pool
    - No immediate prompt repeat: calling `dealPrompt()` twice returns different prompts
    - `clearSession()` resets prompt tracking for session
    - `resetAll()` clears all session data
  - [x] 5.2 `apps/server/tests/services/session-manager-singalong.test.ts`:
    - `startInterludeGame` dispatches to `executeGroupSingAlong` when selectedActivity is 'group_singalong'
    - `executeGroupSingAlong` broadcasts `interlude:gameStarted` with prompt data (activityId: 'group_singalong', card with title/lyric/emoji)
    - `gameDurationMs` is 15000 (15 seconds)
    - Game timer fires after 15s and triggers `endInterludeGame`
    - `endInterludeGame` broadcasts `interlude:gameEnded`
    - Session cleanup clears sing-along session tracking
    - HOST_SKIP during display cancels game timer
    - Mock `singalong-dealer` to control prompt output
    - **CRITICAL**: This NEW test file must mock ALL existing dealer services (same pattern as `session-manager-quick-vote.test.ts`): `vi.mock('../../src/services/kings-cup-dealer.js', ...)`, `vi.mock('../../src/services/dare-pull-dealer.js', ...)`, `vi.mock('../../src/services/quick-vote-dealer.js', ...)`
  - [x] 5.3 `apps/flutter_app/test/widgets/group_singalong_overlay_test.dart`:
    - Renders song title and lyric text from card
    - Renders emoji from card
    - Displays countdown timer
    - Uses correct widget keys
    - Constructor does NOT accept `targetDisplayName` or `targetUserId` parameters (compile-time guarantee of no individual spotlight)
  - [x] 5.4 **CRITICAL — Mock compatibility across ALL session-manager test files.** When `singalong-dealer.js` is imported into `session-manager.ts`, EVERY test file that mocks session-manager's import tree will fail without a corresponding mock. Add `vi.mock('../../src/services/singalong-dealer.js', () => ({ dealPrompt: vi.fn().mockReturnValue({ id: 'mock-prompt', title: 'Mock Song', lyric: 'Mock lyric line!', emoji: '🎤' }), clearSession: vi.fn(), resetAll: vi.fn() }))` to ALL of these files:
    - `session-manager-ceremony.test.ts` (confirmed: mocks all 3 existing dealers)
    - `session-manager-interlude-game.test.ts` (confirmed: mocks all 3 existing dealers)
    - `session-manager-dare-pull.test.ts` (confirmed: mocks all 3 existing dealers)
    - `session-manager-quick-vote.test.ts` (confirmed: mocks all 3 existing dealers)
    - The remaining 11 session-manager test files (`session-manager.test.ts`, `*-capture`, `*-quickpick`, `*-spinwheel`, `*-recovery`, `*-scoring`, `*-tv`, `*-suggestion`, `*-detection`, `*-awards`, `*-dj`) only mock `dj-broadcaster.js` — they do NOT mock dealer services and do NOT need `singalong-dealer.js` added

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL game state lives on server. Server selects the prompt, enforces the 15s display timer, and broadcasts game start/end. Flutter renders server-broadcast data — ZERO game logic in Dart
- **Display-only pattern**: Group Sing-Along follows the Kings Cup pattern exactly — no client-to-server interaction during the game. Just deal → display → auto-advance. The simplest interlude game type
- **Boundary rules**: `singalong-dealer.ts` is a pure service — ZERO imports from persistence, Socket.io, or DJ engine. Session-manager orchestrates
- **DJ engine purity**: Engine only manages state transitions. Game orchestration (prompt dealing, timing, broadcasts) lives in session-manager, not engine. No DJ engine changes in this story
- **No new events**: Reuses existing `interlude:gameStarted` and `interlude:gameEnded` events. No new Socket.io events needed (unlike Quick Vote which needed `quickVoteCast` and `quickVoteResult`)
- **No schema changes**: The existing `interludeGameStartedSchema` already has `activityId`, `card`, and `gameDurationMs` — all that Group Sing-Along needs. No optional extension fields needed (unlike Dare Pull's `targetUserId` or Quick Vote's `quickVoteOptions`)
- **No PartyProvider changes**: The existing interlude game state fields (`_interludeGameActivityId`, `_interludeGameCard`, `_interludeGameDurationMs`, `_interludeGameStartedAt`) are sufficient. No new state fields needed
- **No SocketClient changes**: The existing `interlude:gameStarted` and `interlude:gameEnded` listeners already parse `activityId` and `card` — Group Sing-Along data flows through unchanged

### Key Design Decision: Simplest Interlude Game

Group Sing-Along is intentionally the **simplest** interlude game because its power comes from the real-world group singing, not from app interaction:

| Game | Complexity | Client Interaction | Phases | Server State |
|---|---|---|---|---|
| Kings Cup | Simple | None (display only) | 1 (10s display) | Card tracking only |
| **Group Sing-Along** | **Simple** | **None (display only)** | **1 (15s display)** | **Prompt tracking only** |
| Dare Pull | Medium | None (display only) | 1 (15s display) | Card + target tracking |
| Quick Vote | Complex | Vote buttons | 2 (6s vote + 5s reveal) | Question + vote round |

The only difference from Kings Cup is: (1) different content pool (songs vs rules), (2) slightly longer display (15s vs 10s) to give the group time to start singing, and (3) different visual treatment (song title + lyric vs rule card).

### Front-Loading Design Rationale

The ACTIVITY_POOL has `group_singalong` as `universal: true`, making it eligible in the first 30 minutes (FR15). The UX spec's DJ Engine Clock-Based Curriculum (`ux-design-specification.md:2328`) places group sing-along at "Level 5 (45+ min)" — but this describes **Trang's personal engagement arc** (a shy user gradually warming up), NOT a hard scheduling rule. The `universal` flag means the activity is **safe** for early sessions (no individual spotlight, no pressure). Trang may not personally sing along at minute 10, but the prompt appearing early doesn't harm her — it harms no one. The DJ engine's weighted random selection naturally varies when it appears. Do NOT change `universal: true` to `false`.

### Overlap with Kings Cup `sing-it-back` Card

Kings Cup already has card `sing-it-back`: "The group must sing the chorus of the last song together from memory" (`kings-cup-dealer.ts:23`). This is NOT the same as Group Sing-Along:
- **Kings Cup `sing-it-back`**: One of 18 rule cards, no specific song provided, relies on memory of last song, 10s display
- **Group Sing-Along**: A dedicated interlude game type with a specific universally-known song title + iconic lyric snippet, designed as an invitation to sing together IRL, 15s display
The dedicated game type provides a curated, higher-quality group singing moment vs. the generic Kings Cup rule.

### Reuse Patterns from Stories 7.2, 7.3, 7.4 (DO NOT REINVENT)

| Previous Pattern | Story 7.5 Equivalent |
|---|---|
| `kings-cup-dealer.ts` structure (module-level Map, deal, clear, reset) | `singalong-dealer.ts` — identical pattern |
| `KingsCupCard` interface `{ id, title, rule, emoji }` | `SingAlongPrompt` interface `{ id, title, lyric, emoji }` |
| `KINGS_CUP_CARDS` readonly array (18 cards) | `SINGALONG_PROMPTS` readonly array (20+ prompts) |
| `dealCard(sessionId)` no-repeat logic | `dealPrompt(sessionId)` — identical logic |
| `executeKingsCup(sessionId)` in session-manager | `executeGroupSingAlong(sessionId)` — near-identical |
| `KingsCupOverlay` Flutter widget | `GroupSingAlongOverlay` — similar layout, different content styling |
| `clearKingsCupSession()` in teardown | `clearSingAlongSession()` — same location |
| `INTERLUDE_GAME_DURATION_MS = 10_000` | `SINGALONG_GAME_DURATION_MS = 15_000` |

### Sing-Along Prompt Content Guidelines

Prompts should be:
- **Universally recognizable** — global hits known across cultures, ages 20-35
- **Highly singable chorus** — the lyric snippet should be the most iconic, easy-to-sing line
- **Fun in a group setting** — songs that sound better with many voices
- **Culturally broad** — not limited to one genre, era, or region
- **Short lyric snippets** — 1-2 lines max, readable at a glance on a phone screen
- **NOT culture-specific** — avoid songs that only one nationality would know. Global pop/rock hits preferred

Example prompts:
| Song | Lyric | Emoji |
|---|---|---|
| Bohemian Rhapsody | "Is this the real life? Is this just fantasy?" | 🎸 |
| Don't Stop Believin' | "Don't stop believin'! Hold on to that feelin'!" | 🌟 |
| We Will Rock You | "We will, we will rock you!" | 🤘 |
| Sweet Caroline | "Sweet Caroline! Bah bah bah!" | 🎶 |
| Dancing Queen | "You are the dancing queen!" | 👸 |
| Mr. Brightside | "Coming out of my cage and I've been doin' just fine!" | 🔥 |
| Livin' on a Prayer | "Woah, we're half way there!" | 🙏 |
| Hey Jude | "Na na na na-na-na-na!" | 🎵 |
| We Are the Champions | "We are the champions, my friends!" | 🏆 |
| I Want It That Way | "Tell me why! Ain't nothin' but a heartache!" | 💫 |

### Session Manager Integration — Critical Flow

```
EXISTING FLOW (Kings Cup):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → kings_cup: deal card → broadcast gameStarted → display (10s) → gameEnded → INTERLUDE_DONE

NEW FLOW (Group Sing-Along):
  interlude state → vote (15s) → resolve → reveal (5s) → game dispatch
    → group_singalong: deal prompt → broadcast gameStarted → display (15s) → gameEnded → INTERLUDE_DONE
    → kings_cup: (unchanged)
    → dare_pull: (unchanged)
    → quick_vote: (unchanged)
    → unknown: → INTERLUDE_DONE (backward compatible)
```

### What This Story Does NOT Include (Scope Boundaries)

- NO new Socket.io events — reuses existing `interlude:gameStarted` and `interlude:gameEnded`
- NO new Zod schemas — existing `interludeGameStartedSchema` already supports the payload shape
- NO PartyProvider changes — existing interlude game state fields are sufficient
- NO SocketClient changes — existing listeners handle the data flow
- NO socket handler changes — no client-to-server interaction during sing-along
- NO DJ engine changes — engine stays as-is
- NO changes to the activity vote flow or reveal timer — only the game dispatch adds a new case
- NO persistence of dealt prompts to database — in-memory only (same as all other interlude games)
- NO participation scoring during the game — there's no in-app action to score. The participation score comes from the activity VOTE (already handled by Story 7.1), not from the sing-along display itself
- NO lyrics syncing, audio playback, or karaoke display — this is a PROMPT to sing together IRL, not an in-app karaoke experience
- NO broadcaster changes — uses existing `broadcastInterludeGameStarted` and `broadcastInterludeGameEnded`

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/services/singalong-dealer.ts` | NEW — Sing-along prompt pool + random deal, no-repeat tracking |
| `apps/server/src/services/session-manager.ts` | MODIFY — Add group_singalong dispatch, `executeGroupSingAlong`, wire cleanup |
| `apps/flutter_app/lib/widgets/group_singalong_overlay.dart` | NEW — Group Sing-Along display overlay |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Show GroupSingAlongOverlay in stack |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add sing-along strings |

### Testing Strategy

- **Unit tests** for `singalong-dealer.ts`: Prompt pool validity, deal randomness, no-repeat logic, session cleanup, resetAll
- **Integration tests** for session-manager sing-along dispatch: Group sing-along path, 15s timer, game end broadcast, HOST_SKIP timer cancellation, session cleanup
- **Flutter widget tests**: Overlay rendering (title, lyric, emoji, countdown), widget keys, no individual names
- **Mock compatibility**: Add `singalong-dealer` mock to the 4 session-manager test files that mock dealer services (ceremony, interlude-game, dare-pull, quick-vote). New `session-manager-singalong.test.ts` must mock all 3 existing dealers
- **DO NOT test**: Animation timings, color values, font styling, transition effects

### Previous Story Intelligence (Stories 7.1 + 7.2 + 7.3 + 7.4 Learnings)

- **Code review tip from 7.1**: Always add `.min(1)` validation to string fields in Zod schemas. Add `typeof` guards for metadata reads
- **Code review tip from 7.2**: Remove unused Copy constants. Extract hardcoded durations to named constants. Use null-safe `fromJson` factories. Add HOST_SKIP game timer cancellation tests. Add provider mutual-exclusivity tests
- **Code review tip from 7.3**: Ensure mock compatibility across ALL session-manager test files when adding new service imports. Each new dealer service requires adding mocks to ALL test files that mock session-manager's import tree
- **Code review tip from 7.4**: `gameDurationMs` semantics — send the actual display duration (15s for sing-along). Flutter countdown derives from this value. Ensure `broadcastInterludeGameStarted` type signature already supports the payload (it does — no new optional fields needed)
- **Mutual exclusivity pattern from 7.2**: `onInterludeGameStarted()` already clears vote overlay state. No additional work needed for Group Sing-Along — same mechanism ensures only one interlude UI is visible
- **Mock pattern from 7.4**: Story 7.4 had to add `quick-vote-dealer.js` mock to ceremony, interlude-game, and dare-pull test files. Story 7.5 must add `singalong-dealer.js` mock to ceremony, interlude-game, dare-pull, AND quick-vote test files

### Project Structure Notes

- `snake_case` for DB columns (no DB changes in this story)
- `camelCase` for Socket.io event payloads (Zod schemas — no changes)
- `kebab-case` for TS filenames: `singalong-dealer.ts`
- `snake_case` for Dart filenames: `group_singalong_overlay.dart`
- Socket events: reuses existing `interlude:gameStarted`, `interlude:gameEnded` — no new events
- Widget keys: `Key('singalong-overlay')`, `Key('singalong-title')`, `Key('singalong-lyric')`, `Key('singalong-countdown')`
- All copy in `constants/copy.dart`: `singAlongSubtitle`

### References

- [Source: project-context.md — Server Boundaries, Socket Event Catalog, Testing Rules, Anti-Patterns]
- [Source: epics.md — Epic 7 context, Story 7.5 acceptance criteria: group sing-along, no individual spotlight, front-loading]
- [Source: prd.md — FR21 group sing-along activities without individual spotlight, FR15 front-loading, FR28a weighted random selection]
- [Source: prd.md line 263 — "Group sing-along: a 2000s hit everyone knows. The whole room is singing. Just 'everyone join in.'"]
- [Source: ux-design-specification.md line 2328 — "45+ min | Level 5 | Group sing-along prompts for universally known songs | No individual names on screen"]
- [Source: ux-design-specification.md line 1155 — Interludes: Three core games for MVP, selected via weighted random, front-loaded in first 30 min]
- [Source: services/activity-voter.ts line 28 — `group_singalong` already in ACTIVITY_POOL with universal:true, minParticipants:2]
- [Source: services/kings-cup-dealer.ts — Card dealer pattern to replicate for prompts]
- [Source: services/session-manager.ts lines 513-529 — startInterludeGame dispatcher where group_singalong case will be added]
- [Source: services/session-manager.ts lines 531-551 — executeKingsCup pattern to replicate]
- [Source: widgets/kings_cup_overlay.dart — Display overlay pattern for reference]
- [Source: 7-4-quick-vote-interlude.md — Complete implementation record for previous interlude game, code review learnings, mock compatibility requirements]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created `singalong-dealer.ts` with 22 universally known song prompts (SingAlongPrompt interface, dealPrompt/clearSession/resetAll — identical pattern to kings-cup-dealer.ts)
- Added `group_singalong` dispatch case to session-manager's `startInterludeGame` with `executeGroupSingAlong` function (15s timer, maps prompt.lyric → card.rule for InterludeGameCard reuse)
- Wired `clearSingAlongSession` into session teardown alongside existing dealer cleanups
- Created `GroupSingAlongOverlay` Flutter widget with FadeTransition, italic lyric text in quotation marks, 15s countdown synced with server timer, correct widget keys, NO individual names
- Added `Copy.singAlongSubtitle = 'EVERYONE SING!'` to copy.dart
- Wired overlay into party_screen.dart overlay stack (activityId == 'group_singalong')
- Created comprehensive test suites: singalong-dealer (10 tests), session-manager-singalong (7 tests), group_singalong_overlay (7 tests)
- Added singalong-dealer mock compatibility to 4 existing session-manager test files (ceremony, interlude-game, dare-pull, quick-vote)
- All server tests pass: 90 files, 1237 tests, 0 failures
- All Flutter tests pass (7/7 new tests). 3 pre-existing failures in party_screen_test.dart due to `DJTokens.actionPrimary` reference in unrelated `tag_team_flash_widget.dart` — not introduced by this story

### Change Log

- 2026-03-19: Story 7.5 implementation complete — Group Sing-Along interlude game

### File List

- `apps/server/src/services/singalong-dealer.ts` (NEW)
- `apps/server/src/services/session-manager.ts` (MODIFIED)
- `apps/flutter_app/lib/widgets/group_singalong_overlay.dart` (NEW)
- `apps/flutter_app/lib/screens/party_screen.dart` (MODIFIED)
- `apps/flutter_app/lib/constants/copy.dart` (MODIFIED)
- `apps/server/tests/services/singalong-dealer.test.ts` (NEW)
- `apps/server/tests/services/session-manager-singalong.test.ts` (NEW)
- `apps/flutter_app/test/widgets/group_singalong_overlay_test.dart` (NEW)
- `apps/server/tests/services/session-manager-ceremony.test.ts` (MODIFIED — added singalong-dealer mock)
- `apps/server/tests/services/session-manager-interlude-game.test.ts` (MODIFIED — added singalong-dealer mock)
- `apps/server/tests/services/session-manager-dare-pull.test.ts` (MODIFIED — added singalong-dealer mock)
- `apps/server/tests/services/session-manager-quick-vote.test.ts` (MODIFIED — added singalong-dealer mock)

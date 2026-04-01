# Story 10.7: Color Consistency Across Party Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user moving between lobby, party, and ceremony screens,
I want consistent dark-themed backgrounds and token-based colors throughout,
so that the app feels like one cohesive experience with no jarring light flashes or inconsistent color usage.

## Acceptance Criteria

1. All DJ state backgrounds use dark colors from `djStateBackgroundColor()` — no white, cream, or light backgrounds leak through any state
2. Song state uses dark background (`#0A0A0F`) — verified via `djStateBackgroundColor`
3. Song selection state uses dark background (`#0F0A1E`) — verified via `djStateBackgroundColor`
4. Ceremony state uses vibe-specific background (`vibe.bg`) — verified via `djStateBackgroundColor`
5. Pause overlay uses semi-transparent dark overlay — not opaque gray
6. All text/icon foreground colors that currently use `Colors.white` are replaced with `DJTokens.textPrimary` for token consistency (except where white is semantically required: QR code backgrounds, Google sign-in button)
7. `Color(0xFFFFFFFF)` hex literal in lightstick mode replaced with `DJTokens.textPrimary` or `Colors.white` constant (no raw hex)
8. All text remains readable against dark backgrounds (existing WCAG contrast tests pass)
9. Transition between screens feels smooth (AnimatedContainer 300ms verified)
10. No Material Design default theme colors (blue accents, gray backgrounds) leak through any party flow screen
11. All 5 vibes (general, kpop, rock, ballad, edm) produce readable UI — no vibe-specific contrast issues

## Tasks / Subtasks

- [x] Task 1: Audit and replace `Colors.white` foreground usages with `DJTokens.textPrimary` (AC: #6)
  - [x] 1.1 `apps/flutter_app/lib/widgets/capture_bubble.dart:80` — camera icon `Colors.white` → `DJTokens.textPrimary`
  - [x] 1.2 `apps/flutter_app/lib/widgets/capture_overlay.dart:144` — icon `Colors.white` → `DJTokens.textPrimary`
  - [x] 1.3 `apps/flutter_app/lib/widgets/capture_overlay.dart:149` — text `Colors.white` → `DJTokens.textPrimary`
  - [x] 1.4 `apps/flutter_app/lib/widgets/capture_overlay.dart:191` — text `Colors.white` → `DJTokens.textPrimary`
  - [x] 1.5 `apps/flutter_app/lib/widgets/capture_overlay.dart:197` — text `Colors.white` with alpha → `DJTokens.textPrimary.withValues(alpha: ...)` (preserve alpha)
  - [x] 1.6 `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart:43` — icon `Colors.white` with alpha → `DJTokens.textPrimary.withValues(alpha: ...)` **REQUIRES NEW IMPORT:** `import 'package:karamania/theme/dj_tokens.dart';` (this is the only file missing the import)
  - [x] 1.7 `apps/flutter_app/lib/widgets/host_controls_overlay.dart:157` — FAB icon `Colors.white` → `DJTokens.textPrimary`
  - [x] 1.8 `apps/flutter_app/lib/widgets/quick_vote_overlay.dart:214` — foregroundColor when selected `Colors.white` → `DJTokens.textPrimary` (foreground on `DJTokens.actionConfirm` green button — verify selected state still looks correct after change)
  - [x] 1.9 `apps/flutter_app/lib/widgets/quick_vote_overlay.dart:228` — text color when selected `Colors.white` → `DJTokens.textPrimary`
  - [x] 1.10 `apps/flutter_app/lib/widgets/spin_the_wheel_overlay.dart:404` — text color `Colors.white` → `DJTokens.textPrimary`

- [x] Task 2: Replace raw hex white in lightstick mode (AC: #7)
  - [x] 2.1 `apps/flutter_app/lib/widgets/lightstick_mode.dart:56` — `Color(0xFFFFFFFF)` → `Colors.white` (this is a color option in a palette, not a theme token — `Colors.white` is the correct constant)

- [x] Task 3: DO NOT modify these intentional white usages (AC: #6 exceptions)
  - [x] 3.1 SKIP `apps/flutter_app/lib/screens/party_screen.dart:979` — QR code background MUST be white for scannability
  - [x] 3.2 SKIP `apps/flutter_app/lib/screens/lobby_screen.dart:166` — QR code background MUST be white for scannability
  - [x] 3.3 SKIP `apps/flutter_app/lib/screens/home_screen.dart:338` — Google sign-in button background MUST be white per Google brand guidelines
  - [x] 3.4 SKIP `apps/flutter_app/lib/widgets/hype_signal_button.dart:98` — flash overlay container uses white intentionally for flash effect
  - [x] 3.5 SKIP `apps/flutter_app/lib/widgets/spin_the_wheel_overlay.dart:377` — border paint white with alpha is a visual effect
  - [x] 3.6 SKIP `apps/flutter_app/lib/widgets/lightstick_mode.dart:137` — border `Colors.white` for active color picker selection indicator. MUST stay white — it's the universal contrast border around whichever color is selected (including vibe colors). `DJTokens.textPrimary` (#F0F0F0) would be equally invisible against the white color option

- [x] Task 4: Verify DJ state background coverage (AC: #1, #2, #3, #4, #5)
  - [x] 4.1 Read `apps/flutter_app/lib/theme/dj_theme.dart` and confirm all 8 DJ states map to dark colors in `djStateBackgroundColor()`
  - [x] 4.2 Confirm `party_screen.dart` uses `partyProvider.backgroundColor` (which calls `djStateBackgroundColor`) for the `AnimatedContainer`
  - [x] 4.3 Confirm pause overlay at `party_screen.dart:878-908` uses `Colors.black.withValues(alpha: 0.7)` — this IS semi-transparent dark, not opaque gray
  - [x] 4.4 If any state maps to a color lighter than `#252542`, flag and fix it

- [x] Task 5: Write/update color consistency tests (AC: #8, #10, #11)
  - [x] 5.1 Add test in `test/theme/dj_theme_test.dart`: verify ALL 8 DJ state backgrounds have luminance < 0.15 (dark threshold). **NOTE:** existing tests cover 7 states but `icebreaker` is MISSING from the exact-hex assertion block — add it (`#0F0A1E`, same as songSelection)
  - [x] 5.2 Add test: verify no DJ state background matches `Colors.white`, `Colors.grey`, or any color with luminance > 0.5
  - [x] 5.3 Existing ceremony vibe.bg test exists (line ~86-94) — verify it still passes, no new test needed
  - [x] 5.4 Existing contrast_test.dart already covers WCAG AA — verify it still passes after changes

- [x] Task 6: Run full test suite and verify (AC: #8, #12)
  - [x] 6.1 Run `flutter test` full suite — all existing tests must pass
  - [x] 6.2 Verify no color-related test failures from token replacements
  - [x] 6.3 Note: line numbers in tasks above are approximate — verify actual locations before editing

## Dev Notes

### Key Insight: Most AC Already Satisfied

Previous Epic 10 stories (especially 10.5 ceremony energy) already established dark backgrounds for all DJ states. The `djStateBackgroundColor()` function in `dj_theme.dart` already maps every state to a dark color. This story is primarily about **token consistency** — replacing scattered `Colors.white` foreground usages with `DJTokens.textPrimary` to ensure the design system is the single source of truth for all colors.

### Current State of djStateBackgroundColor()

| DJ State | Background | Hex |
|----------|-----------|-----|
| lobby | Fixed | `#0A0A1A` |
| icebreaker | Fixed | `#0F0A1E` |
| songSelection | Fixed | `#0F0A1E` |
| partyCardDeal | Fixed | `#1A0A1A` |
| song | Fixed | `#0A0A0F` |
| ceremony | Vibe bg | Varies |
| interlude | Fixed | `#0F1A2E` |
| finale | Fixed | `#1A0A2E` |

All backgrounds are dark. Ceremony uses `vibe.bg` which is dark for all 5 vibes (darkest: rock `#1A0A0A`, lightest: general `#1A0A2E`).

### DJTokens.textPrimary vs Colors.white

`DJTokens.textPrimary` is `#F0F0F0` (light gray), not pure white `#FFFFFF`. The visual difference is subtle but important:
- `textPrimary` reduces eye strain on dark backgrounds
- It's consistent with all other text in the app
- It's the design system's intended foreground color
- `Colors.white` should only be used where pure white is semantically required (QR codes, brand logos)

### Files to Modify

| File | Change |
|------|--------|
| `lib/widgets/capture_bubble.dart` | `Colors.white` → `DJTokens.textPrimary` (1 instance) |
| `lib/widgets/capture_overlay.dart` | `Colors.white` → `DJTokens.textPrimary` (4 instances, preserve alpha on last) |
| `lib/widgets/capture_toolbar_icon.dart` | `Colors.white` → `DJTokens.textPrimary` (1 instance, preserve alpha) + **add `dj_tokens.dart` import** |
| `lib/widgets/host_controls_overlay.dart` | `Colors.white` → `DJTokens.textPrimary` (1 instance) |
| `lib/widgets/quick_vote_overlay.dart` | `Colors.white` → `DJTokens.textPrimary` (2 instances) |
| `lib/widgets/spin_the_wheel_overlay.dart` | `Colors.white` → `DJTokens.textPrimary` (1 instance — text only) |
| `lib/widgets/lightstick_mode.dart` | `Color(0xFFFFFFFF)` → `Colors.white` (1 instance — palette color, not token) |
| `test/theme/dj_theme_test.dart` | Add luminance/darkness assertions for all DJ state backgrounds |

### Files to NOT Modify

- `party_screen.dart` — QR code backgrounds must stay `Colors.white`
- `lobby_screen.dart` — QR code backgrounds must stay `Colors.white`
- `home_screen.dart` — Google sign-in button must stay `Colors.white`
- `hype_signal_button.dart` — flash effect intentionally white
- `spin_the_wheel_overlay.dart:377` — border paint effect intentionally white
- `lightstick_mode.dart:137` — border for selected color indicator, white is intentional UI affordance
- `dj_theme.dart` — all state colors already correct, no changes needed
- `dj_tokens.dart` — all tokens already defined
- No server changes — pure Flutter UI

### Import Notes

Files that don't already import `dj_tokens.dart` will need:
```dart
import 'package:karamania/theme/dj_tokens.dart';
```
Check each file before adding — most already import it. Use `package:karamania/...` for cross-directory imports.

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — pure UI color changes
- **Providers are read-only from widgets** — `context.watch<T>()` only
- **Use `DJTokens` for ALL visual constants** — that's the whole point of this story
- **Widget keys use `Key('kebab-case-descriptor')`**
- **File naming:** `snake_case.dart`
- **DO NOT test:** specific color hex values, animations, visual effects
- **DO test:** dark background assertions (luminance < threshold), token coverage

### Previous Story Intelligence (10.6)

Key learnings from Story 10.6 (Branded Custom Dialogs):
- All existing `AlertDialog` usages replaced with `BrandedDialog` — dialogs are consistent
- `DJTokens.surfaceElevated` (#252542) is the standard dialog/elevated surface color
- Test suite: 861 passed, 1 pre-existing failure (`join_screen_test.dart` pumpAndSettle timeout — unrelated, ignore)
- Code review found issues with test coverage — write thorough but non-redundant tests
- All `DJTokens` color constants already defined and available

### Git Intelligence

Recent commits follow pattern: `Implement Story X.Y: description`. All Epic 10 stories modify Flutter widgets + tests only, no server changes. Code review fixes applied in same commit after `code-review` workflow.

### Project Structure Notes

- All changes within `apps/flutter_app/lib/widgets/` and `apps/flutter_app/test/theme/`
- No new files or directories needed
- No new providers or state management changes
- No new dependencies

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 7]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/implementation-artifacts/10-6-branded-custom-dialogs.md#Dev Notes]
- [Source: apps/flutter_app/lib/theme/dj_theme.dart — djStateBackgroundColor function]
- [Source: apps/flutter_app/lib/theme/dj_tokens.dart — DJTokens constants]
- [Source: apps/flutter_app/test/theme/contrast_test.dart — WCAG validation]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Replaced 10 `Colors.white` foreground usages with `DJTokens.textPrimary` across 6 widget files (capture_bubble, capture_overlay, capture_toolbar_icon, host_controls_overlay, quick_vote_overlay, spin_the_wheel_overlay)
- Added `dj_tokens.dart` import to `capture_toolbar_icon.dart` (only file missing it)
- Replaced `Color(0xFFFFFFFF)` hex literal with `Colors.white` constant in lightstick_mode.dart palette
- Verified all 6 intentional white usages were NOT modified (QR codes, Google sign-in, flash effect, border paint, color picker border)
- Verified all 8 DJ states map to dark backgrounds in `djStateBackgroundColor()`, party_screen uses `partyProvider.backgroundColor`, pause overlay uses semi-transparent dark
- Added icebreaker exact-hex assertion to existing test block (was missing)
- Added 2 new tests: luminance < 0.15 for all states/vibes, no white/grey/high-luminance backgrounds
- Verified ceremony vibe.bg test and WCAG contrast tests still pass
- Full test suite: 865 passed, 1 pre-existing failure (join_screen_test.dart pumpAndSettle timeout — unrelated)

### Change Log

- 2026-04-01: Implemented Story 10.7 — replaced Colors.white foreground usages with DJTokens.textPrimary, replaced raw hex white with Colors.white constant, added dark background luminance tests
- 2026-04-01: Code review fixes — removed redundant ternaries in quick_vote_overlay.dart, removed redundant luminance < 0.5 assertion in dj_theme_test.dart, added sprint-status.yaml to File List

### File List

- `apps/flutter_app/lib/widgets/capture_bubble.dart` — Colors.white → DJTokens.textPrimary (1 instance)
- `apps/flutter_app/lib/widgets/capture_overlay.dart` — Colors.white → DJTokens.textPrimary (4 instances, alpha preserved)
- `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart` — Colors.white → DJTokens.textPrimary + added dj_tokens.dart import
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` — Colors.white → DJTokens.textPrimary (FAB icon)
- `apps/flutter_app/lib/widgets/quick_vote_overlay.dart` — Colors.white → DJTokens.textPrimary (2 instances)
- `apps/flutter_app/lib/widgets/spin_the_wheel_overlay.dart` — Colors.white → DJTokens.textPrimary (wheel segment text)
- `apps/flutter_app/lib/widgets/lightstick_mode.dart` — Color(0xFFFFFFFF) → Colors.white
- `apps/flutter_app/test/theme/dj_theme_test.dart` — Added icebreaker hex assertion, luminance test, no-light-color test
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story status updated to review

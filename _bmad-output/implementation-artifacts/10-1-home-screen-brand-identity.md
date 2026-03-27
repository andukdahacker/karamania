# Story 10.1: Home Screen — Brand Identity & Button Affordances

Status: done

## Story

As a new user opening the app for the first time,
I want to see an inviting, branded home screen with clear action buttons,
so that I immediately understand what the app is and feel confident tapping the CTAs.

## Acceptance Criteria

1. Animated mascot displayed centered above the wordmark using Lottie (`mascot_animation.json` from `assets/images/`, sized ~140x140, looping). Static first frame when reduced motion is enabled.
2. "KARAMANIA" wordmark rendered in bold gold (`#FFD700`) below mascot
3. "CREATE PARTY" button is a filled gold rectangle with dark text (`#0A0A0F`), rounded corners (12px), full-width padded
4. "JOIN PARTY" button is an outlined gold rectangle with gold text, same dimensions
5. Both buttons have clear tap feedback (ink splash or scale animation)
6. "Save your session history" text + "Sign in" link remain below, with adequate spacing
7. Authenticated state: layout stays vertically centered (no jarring shift from guest view)
8. Empty session state: replace lonely "Start your first party!" with mascot + encouraging copy

## Tasks / Subtasks

- [x] Task 1: Add `lottie` package, register assets, and add `DJTokens.gold` (AC: #1, #2, #3, #4)
  - [x] 1.1 Run `flutter pub add lottie` in `apps/flutter_app/`
  - [x] 1.2 Add `- assets/images/` to the `assets:` list in `pubspec.yaml`
  - [x] 1.3 Verify `mascot_animation.json` (2.6MB Lottie, 624x624, 15fps, ~5s loop) loads without error
  - [x] 1.4 Add `static const Color gold = Color(0xFFFFD700);` to `DJTokens` in `dj_tokens.dart` — use `DJTokens.gold` everywhere in this story (and all subsequent Epic 10 stories)
- [x] Task 2: Add animated mascot to HomeScreen (AC: #1)
  - [x] 2.1 Import `package:lottie/lottie.dart` and `package:karamania/state/accessibility_provider.dart`
  - [x] 2.2 Read `reducedMotion` from `context.watch<AccessibilityProvider>()`
  - [x] 2.3 Add `Lottie.asset('assets/images/mascot_animation.json', height: 140, width: 140, repeat: true, animate: !reducedMotion, errorBuilder: (context, error, stackTrace) => const SizedBox(height: 140, width: 140))` centered above the app title
  - [x] 2.4 The `errorBuilder` is REQUIRED — without it, Lottie.asset crashes in widget tests where asset bundles are unavailable
  - [x] 2.5 Add `SizedBox(height: DJTokens.spaceMd)` between mascot and wordmark
- [x] Task 3: Style the wordmark in gold (AC: #2)
  - [x] 3.1 Apply `DJTokens.gold` to the `Copy.appTitle` Text widget via `.copyWith(color: DJTokens.gold)`
  - [x] 3.2 Keep existing `displayLarge` text style, only override color
- [x] Task 4: Restyle CREATE PARTY button as filled gold (AC: #3, #5)
  - [x] 4.1 Wrap existing `DJTapButton` child in a `Container` with `BoxDecoration(color: DJTokens.gold, borderRadius: BorderRadius.circular(12))`
  - [x] 4.2 Add `Padding(padding: EdgeInsets.symmetric(vertical: DJTokens.spaceMd))` inside container
  - [x] 4.3 Set button text color to `DJTokens.bgColor` (`#0A0A0F`) for contrast
  - [x] 4.4 Preserve existing `Key('create-party-btn')`, `TapTier.consequential`, and loading spinner behavior
- [x] Task 5: Restyle JOIN PARTY button as outlined gold (AC: #4, #5)
  - [x] 5.1 Wrap existing `DJTapButton` child in a `Container` with `BoxDecoration(border: Border.all(color: DJTokens.gold, width: 2), borderRadius: BorderRadius.circular(12))`
  - [x] 5.2 Set button text color to `DJTokens.gold`
  - [x] 5.3 Preserve existing `Key('join-party-btn')` and `TapTier.social`
- [x] Task 6: Update empty session state (AC: #8)
  - [x] 6.1 In `_buildTimeline` empty state block, replace the text-only `Copy.startFirstParty` with a Column containing mascot image + encouraging copy
  - [x] 6.2 Add `Lottie.asset('assets/images/mascot_animation.json', height: 80, width: 80, repeat: true, animate: !reducedMotion, errorBuilder: ...)` above text
  - [x] 6.3 Add new copy constant to `Copy` class (e.g., `emptySessionEncouragement` = "Time to make some memories!")
- [x] Task 7: Ensure authenticated layout stays centered (AC: #7)
  - [x] 7.1 Verify the mascot + wordmark section appears in both auth states
  - [x] 7.2 Ensure `MainAxisAlignment.start` (authenticated) still looks good with mascot at top + `SizedBox(height: DJTokens.spaceXl)` top padding
- [x] Task 8: Verify existing tests pass (AC: all)
  - [x] 8.1 Run `flutter test test/screens/home_screen_test.dart`
  - [x] 8.2 Tests use Key-based (`find.byKey`) and text-based (`find.text`) finders — Container wrapping does NOT break these, so no finder updates expected
  - [x] 8.3 The `errorBuilder` on `Lottie.asset` prevents test crashes — verify tests pass without needing asset bundle mocking
  - [x] 8.4 DO NOT test mascot image rendering, button colors, or visual styling — test only state transitions and tap behavior

## Dev Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `apps/flutter_app/pubspec.yaml` | Add `lottie` dependency + `- assets/images/` to assets list |
| `apps/flutter_app/lib/screens/home_screen.dart` | Add mascot, restyle buttons, update empty state |
| `apps/flutter_app/lib/constants/copy.dart` | Add `emptySessionEncouragement` constant |
| `apps/flutter_app/lib/theme/dj_tokens.dart` | Add `static const Color gold = Color(0xFFFFD700);` |

### Files to NOT Create

- No new widget files — all changes fit within `HomeScreen` and existing widgets
- No new theme files — add `DJTokens.gold` to existing `dj_tokens.dart`

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — this is pure UI styling, no server changes
- **Preserve all existing `Key(...)` values** — tests depend on `create-party-btn`, `join-party-btn`, `guest-name-input`, `user-avatar`, `my-media-btn`, `sign-out-btn`
- **Use `DJTokens` spacing** — never hardcode padding/margin values (use `spaceXs`/`spaceSm`/`spaceMd`/`spaceLg`/`spaceXl`)
- **All copy in `constants/copy.dart`** — no hardcoded strings in widgets
- **Import with `package:karamania/...`** for cross-directory imports

### Button Styling Approach

The `DJTapButton` widget handles tap behavior (hold-to-confirm, haptics, scale animation) but does NOT style its visual appearance — it renders whatever `child` widget you pass. The gold button styling goes in the `child` parameter as a styled `Container`:

```dart
DJTapButton(
  key: const Key('create-party-btn'),
  tier: TapTier.consequential,
  onTap: () => _onCreateParty(context),
  child: Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
    decoration: BoxDecoration(
      color: DJTokens.gold,
      borderRadius: BorderRadius.circular(12),
    ),
    child: partyProvider.createPartyLoading == LoadingState.loading
        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(...))
        : Text(Copy.createParty, textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: DJTokens.bgColor,
            )),
  ),
),
```

`DJTapButton` wraps the child in 8px padding + `AnimatedScale` + optional focus border. The gold Container will be inset 8px from screen edges — this gives visual breathing room. Do NOT add extra horizontal margin/padding on the Container.

### Lottie Animation Details

The mascot animation is at `assets/images/mascot_animation.json`:
- **Format:** Lottie JSON v5.7.4 with embedded webp image assets
- **Dimensions:** 624x624px (square)
- **Frame rate:** 15fps, 78 frames (~5.2s loop)
- **File size:** 2.6MB — large because of embedded raster images, but cached after first load
- **Usage:** `Lottie.asset('assets/images/mascot_animation.json', height: 140, width: 140, repeat: true, animate: !reducedMotion, errorBuilder: ...)`
- **Package:** `lottie` (add via `flutter pub add lottie`)
- **Reduced motion:** Pass `animate: false` when `AccessibilityProvider.reducedMotion == true` — shows static first frame. This follows the existing pattern in `DJTapButton`.
- **Test safety:** Always provide `errorBuilder: (ctx, err, st) => SizedBox(height: h, width: w)` — Lottie.asset crashes in widget tests without asset bundle setup. The errorBuilder silently degrades to an empty box in tests.

### Asset Gotcha

The `assets/images/` directory exists with `mascot_animation.json`, `mascot_icon.png`, and `mascot_banner.png` but is **NOT currently declared in `pubspec.yaml`**. The asset section currently has:
```yaml
assets:
  - assets/fonts/
  - assets/icons/
  - assets/sounds/
```
You MUST add `- assets/images/` or assets will throw a runtime `Unable to load asset` error.

### Gold Color Usage

`#FFD700` (gold) is the "General" vibe accent from the theme system (`PartyVibe.general` accent). On the Home screen, the vibe is not yet selected. Use `DJTokens.gold` (added in Task 1.4) everywhere — never inline `Color(0xFFFFD700)`. This constant will be reused across all 7 Epic 10 stories.

### Empty Session State Context

Current empty state (line 278-302 of `home_screen.dart`) shows:
- `Copy.startFirstParty` text ("Start your first party!")
- A `TextButton` with `Copy.createParty`

Replace with mascot + warmer copy per wireframe. Keep the `TextButton` for the CTA.

### Project Structure Notes

- All changes are Flutter UI only — no server, API, or DB modifications
- Aligned with `apps/flutter_app/lib/` structure: screens, constants, theme
- No new directories or modules needed

### Testing Boundaries

Per project rules:
- **DO test:** tap behavior, navigation, loading states, auth-conditional rendering
- **DO NOT test:** mascot animation rendering, gold colors, border radius, animation values
- Existing tests use `find.byKey()` and `find.text()` finders — neither breaks from Container wrapping
- The `errorBuilder` on Lottie prevents test crashes — no asset bundle mocking needed

### Definition of Done (Epic 10 Global)

- [ ] Implementation matches wireframe layout
- [ ] Screenshot test re-run captures new design (`run_screenshots.sh`)
- [ ] Existing widget tests pass (update keys/finders if changed)
- [ ] Tested with all 5 vibes (general, kpop, rock, ballad, edm) — Home screen is pre-vibe, so just verify dark theme consistency
- [ ] No text overflow/ellipsis on standard phone sizes

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 1]
- [Source: _bmad-output/brand-brief.md#Visual Direction]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-27.md#Section 4]
- [Source: _bmad-output/excalidraw-diagrams/wireframe-ux-redesign.excalidraw]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Layout restructured from Column+Expanded to SingleChildScrollView+Column to handle mascot height in both auth states without overflow
- Lottie looping animation causes `pumpAndSettle` timeout in tests — fixed navigation test to use explicit `pump(duration)` instead
- Empty state CTA text updated from `startFirstParty` to `emptySessionEncouragement` — test updated to match
- Navigation test needed scroll-down before tap since session cards are below fold with mascot added

### Completion Notes List
- Task 1: Added `lottie` 3.3.2 dependency, registered `assets/images/` in pubspec.yaml, added `DJTokens.gold` (#FFD700) constant
- Task 2: Added Lottie mascot animation (140x140, looping, reduced-motion aware, with errorBuilder fallback) centered above wordmark in both auth states
- Task 3: Applied `DJTokens.gold` to KARAMANIA wordmark, preserving `displayLarge` text style
- Task 4: Restyled CREATE PARTY as filled gold Container (12px borderRadius, DJTokens.bgColor text), preserved key/tier/loading spinner
- Task 5: Restyled JOIN PARTY as outlined gold Container (2px gold border, 12px borderRadius, gold text), preserved key/tier
- Task 6: Replaced empty session text with mascot (80x80) + `Copy.emptySessionEncouragement` ("Time to make some memories!")
- Task 7: Verified mascot + wordmark appears in both auth states. Auth view restructured to SingleChildScrollView for scrollability
- Task 8: All 15 home screen tests pass. Full suite: 812 pass, 2 pre-existing failures (join_screen, deep_link — unrelated)

### Change Log
- 2026-03-27: Implemented Story 10.1 — Home Screen Brand Identity & Button Affordances
- 2026-03-27: Code review fixes — Added auth view top padding (M1), documented mascot asset + pubspec.lock in File List (M2, L4), removed redundant AccessibilityProvider watch (L1), added textAlign center to empty state text (L2), removed dead `Copy.startFirstParty` constant (L3)

### File List
- `apps/flutter_app/pubspec.yaml` — Added `lottie` dependency + `assets/images/` asset registration
- `apps/flutter_app/pubspec.lock` — Auto-updated from lottie dependency addition
- `apps/flutter_app/assets/images/mascot_animation.json` — Lottie animation asset (624x624, 15fps, ~5s loop)
- `apps/flutter_app/lib/theme/dj_tokens.dart` — Added `static const Color gold = Color(0xFFFFD700)`
- `apps/flutter_app/lib/constants/copy.dart` — Added `emptySessionEncouragement` constant, removed unused `startFirstParty`
- `apps/flutter_app/lib/screens/home_screen.dart` — Added mascot, gold wordmark, restyled buttons, updated empty state, restructured layout to SingleChildScrollView
- `apps/flutter_app/test/screens/home_screen_test.dart` — Updated empty state assertion, fixed navigation test for Lottie animation + scroll

# Story 10.5: Ceremony Screen — Celebration Energy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a participant watching an award reveal,
I want to see a dramatic, celebratory ceremony screen with vibe-appropriate background, radial glow, and scattered confetti,
so that the award moment feels special and rewarding.

## Acceptance Criteria

1. Background uses vibe color (`PartyVibe.bg`) during ceremony state — not the default scaffold dark or transparent
2. Radial gold glow effect behind the award text using `RadialGradient` or `boxShadow` with `vibe.glow` color
3. Confetti/sparkle emoji elements scattered around the award — 4-6 `Positioned` elements using `vibeConfettiEmojis` pool, placed at varied positions using `Stack`
4. Award title in gold (`DJTokens.gold` / `#FFD700`), fontSize 36, bold — replaces current `vibe.accent` color and `displayMedium` style
5. Performer name above award in `DJTokens.textSecondary`, fontSize 22
6. Song reference below award (use `ceremonySongTitle` from provider) in `DJTokens.textSecondary` — shows song context
7. "Quick Award" label styled subtly (smaller font, reduced opacity)
8. Background color consistent with dark vibe theme across both `CeremonyDisplay` and `QuickCeremonyDisplay`
9. All existing ceremony animations (anticipation fade pulse, reveal scale+fade, quick ceremony entrance) continue to work unchanged
10. Moment card (`MomentCardOverlay`) behavior and appearance unaffected by these changes

## Tasks / Subtasks

- [x] Task 1: Add ceremony background color to `party_screen.dart` (AC: #1, #8)
  - [x] 1.1 The party screen `Scaffold` uses `backgroundColor: Colors.transparent` (line 283). The `partyProvider.backgroundColor` getter already computes the correct color via `djStateBackgroundColor(_djState, _vibe)` which returns `vibe.bg` for `DJState.ceremony`. Wrap the `Stack` children area with an `AnimatedContainer` that uses `partyProvider.backgroundColor` as its `color` property, with `duration: const Duration(milliseconds: 300)` for smooth transitions between DJ states. This gives ALL states the correct background, not just ceremony
  - [x] 1.2 Alternatively (simpler): Change `Scaffold(backgroundColor: Colors.transparent)` to `Scaffold(backgroundColor: partyProvider.backgroundColor)`. However, `AnimatedContainer` is preferred for smooth transitions (see `lobby_screen.dart` line 139 for the existing pattern)
  - [x] 1.3 Verify the vibe backgrounds render correctly for ceremony: general=#1A0A2E, kpop=#1A0A20, rock=#1A0A0A, ballad=#1A1210, edm=#0A1A1A

- [x] Task 2: Add radial glow + scattered confetti to `CeremonyDisplay` reveal phase (AC: #2, #3, #4, #5, #6)
  - [x] 2.1 In `_buildReveal()` (line 130), wrap the existing `Column` in a `Stack` with `clipBehavior: Clip.none` to support `Positioned` confetti elements that extend beyond the Column's natural bounds. The Stack sizes to its non-positioned child (the Column); without `Clip.none`, confetti positioned outside those bounds will be invisibly clipped
  - [x] 2.2 Add a radial glow behind the award text. Use a `Container` with `BoxDecoration`:
    ```dart
    Container(
      width: 200,
      height: 200,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            widget.vibe.glow.withValues(alpha: 0.3),
            widget.vibe.glow.withValues(alpha: 0.0),
          ],
        ),
      ),
    )
    ```
    Position this behind the award text using `Stack` alignment or as a background layer. The `vibe.glow` token per vibe: general=#FFD700, kpop=#FF69B4, rock=#FF6600, ballad=#FFCC88, edm=#00C8FF
  - [x] 2.3 Add 4-6 scattered confetti emoji elements as `Positioned` widgets within the `Stack`. Use `vibeConfettiEmojis[widget.vibe]` for vibe-specific emojis. Example positions:
    ```dart
    Positioned(top: 20, left: 30, child: EmojiText(confetti[0], fontSize: 24)),
    Positioned(top: 10, right: 40, child: EmojiText(confetti[1], fontSize: 20)),
    Positioned(bottom: 30, left: 50, child: EmojiText(confetti[2 % len], fontSize: 28)),
    Positioned(bottom: 20, right: 30, child: EmojiText(confetti[3 % len], fontSize: 22)),
    ```
    Use modulo indexing to handle vibes with fewer emojis (rock has 2, edm has 2). Existing confetti row (lines 143-147) can remain or be replaced — these scattered elements provide the "celebration energy" feel
  - [x] 2.4 Change award title color from `widget.vibe.accent` to `DJTokens.gold` (line 163). Change text style from `displayMedium` to explicit `TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: DJTokens.gold)` (AC: #4)
  - [x] 2.5 Update performer name style: change from `headlineMedium` to explicit `TextStyle(fontSize: 22, color: DJTokens.textSecondary)` (AC: #5, line 152)
  - [x] 2.6 Add song reference below the award text and above the flavor text. Access `widget.songTitle` (new parameter — see Task 2.8). If non-null, display:
    ```dart
    if (widget.songTitle != null) ...[
      const SizedBox(height: DJTokens.spaceSm),
      Text(
        widget.songTitle!,
        key: const Key('ceremony-song-title'),
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 16, color: DJTokens.textSecondary),
      ),
    ],
    ```
  - [x] 2.7 Wrap the scattered confetti in the same `FadeTransition` + `ScaleTransition` as the reveal content so they animate in together
  - [x] 2.8 Add `songTitle` parameter to `CeremonyDisplay`:
    ```dart
    final String? songTitle; // Add to constructor: this.songTitle
    ```

- [x] Task 3: Update `CeremonyDisplay` usage in `party_screen.dart` to pass `songTitle` (AC: #6)
  - [x] 3.1 In `party_screen.dart` (line 676), add the `songTitle` parameter:
    ```dart
    CeremonyDisplay(
      performerName: partyProvider.ceremonyPerformerName,
      revealAt: partyProvider.ceremonyRevealAt!,
      vibe: displayVibe,
      award: partyProvider.ceremonyAward,
      tone: partyProvider.ceremonyTone,
      songTitle: partyProvider.ceremonySongTitle,  // NEW
    ),
    ```

- [x] Task 4: Apply celebration energy to `QuickCeremonyDisplay` (AC: #2, #3, #7, #8)
  - [x] 4.1 Add a subtle radial glow behind the quick ceremony award text (same approach as Task 2.2 but smaller — `width: 150, height: 150`) since quick ceremony is less dramatic
  - [x] 4.2 Optionally add 2-3 scattered confetti emojis (fewer than full ceremony to match the "quick" feel). **Import required**: add `import 'package:karamania/widgets/emoji_text.dart';` to `quick_ceremony_display.dart` — it's not currently imported
  - [x] 4.3 Style "Quick Award" label more subtly: reduce from `bodyLarge` to `bodySmall` and add `opacity: 0.6` or use `DJTokens.textSecondary.withValues(alpha: 0.6)` (AC: #7, line 83)
  - [x] 4.4 Change award title color to `DJTokens.gold` for consistency with full ceremony (currently uses `widget.vibe.accent`)

- [x] Task 5: Update ceremony tests (AC: all)
  - [x] 5.1 **Update** `test/widgets/ceremony_display_test.dart`:
    - Update `buildTestWidget` helper (line 13) to accept optional `String? songTitle` parameter and pass it to `CeremonyDisplay`
    - Add test: `songTitle` is rendered when provided (find by key `'ceremony-song-title'`)
    - Add test: `songTitle` is hidden when null
    - Add test: scattered confetti emojis are rendered (verify 4+ `EmojiText` widgets in reveal phase)
    - Add test: award title text content renders correctly (existing test may cover this)
    - Update any tests that assert on specific text styles if they break due to fontSize changes
    - **Pump guidance**: Existing reveal-phase tests use `pumpAndSettle()` and this is correct — the anticipation controller is stopped during reveal so `pumpAndSettle()` completes. Only use `pump(Duration)` when testing the anticipation phase (which has a looping animation that prevents settle)
  - [x] 5.2 **Update** `test/widgets/quick_ceremony_display_test.dart`:
    - Add test: "Quick Award" label renders with expected styling
    - Verify existing tests still pass after layout changes
  - [x] 5.3 **DO NOT test**: colors, font sizes, gradient values, glow dimensions, confetti positions, opacity values, animation timings

## Dev Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `apps/flutter_app/lib/widgets/ceremony_display.dart` | Add radial glow, scattered confetti, gold award title (36px), performer (22px), song reference, `songTitle` param |
| `apps/flutter_app/lib/widgets/quick_ceremony_display.dart` | Add subtle glow, optional confetti, subtle "Quick Award" label styling |
| `apps/flutter_app/lib/screens/party_screen.dart` | Add animated background color using `partyProvider.backgroundColor`, pass `songTitle` to `CeremonyDisplay` |
| `apps/flutter_app/test/widgets/ceremony_display_test.dart` | Add songTitle and confetti tests |
| `apps/flutter_app/test/widgets/quick_ceremony_display_test.dart` | Verify label styling changes |

### Files to NOT Modify

- `dj_theme.dart` — `djStateBackgroundColor` already returns `vibe.bg` for ceremony. `PartyVibe` enum already has `.glow` and `.bg` properties. No changes needed
- `dj_tokens.dart` — All required tokens exist: `gold`, `textSecondary`, `spaceSm/Md/Lg`, `iconSizeLg`
- `party_provider.dart` — `ceremonyAward`, `ceremonyPerformerName`, `ceremonySongTitle`, `ceremonyTone`, `ceremonyType`, `backgroundColor` getters already exist. No changes needed
- `copy.dart` — `vibeConfettiEmojis`, `vibeAwardFlavors`, `ceremonyAnticipation`, `defaultAward`, `quickCeremonyLabel` all exist. No new constants needed
- `moment_card.dart` / `moment_card_overlay.dart` — Keep as-is, these render the shareable card separately
- No server changes — pure Flutter UI

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — pure UI rendering of server state
- **Providers are read-only from widgets** — `context.watch<PartyProvider>()` only
- **Use `DJTokens` for ALL visual constants** — `DJTokens.gold` for award, `DJTokens.textSecondary` for secondary text, spacing tokens for gaps
- **All copy in `constants/copy.dart`** — no hardcoded strings (existing ceremony copy is sufficient)
- **Import with `package:karamania/...`** for cross-directory imports
- **Widget keys use `Key('kebab-case-descriptor')`**

### Ceremony Data Available from PartyProvider (VERIFIED)

All fields available during `DJState.ceremony`:
- `partyProvider.ceremonyType` — `'full'` | `'quick'`
- `partyProvider.ceremonyPerformerName` — performer display name (String?)
- `partyProvider.ceremonyRevealAt` — reveal timestamp for full ceremony (int?)
- `partyProvider.ceremonyAward` — award title, e.g., "Mic Drop Master" (String?)
- `partyProvider.ceremonyTone` — `'hype'` | `'comedic'` | `'inspirational'` (String?)
- `partyProvider.ceremonySongTitle` — song that was performed (String?)
- `partyProvider.backgroundColor` — computed from `djStateBackgroundColor(state, vibe)`, returns `vibe.bg` during ceremony

### Confetti Emoji Pools (from copy.dart)

```dart
const Map<PartyVibe, List<String>> vibeConfettiEmojis = {
  PartyVibe.general: ['🎉', '✨', '🌟', '🎊'],  // 4 emojis
  PartyVibe.kpop: ['💖', '💜', '✨'],             // 3 emojis
  PartyVibe.rock: ['🔥', '⚡'],                   // 2 emojis — use modulo
  PartyVibe.ballad: ['✨', '🌟'],                  // 2 emojis — use modulo
  PartyVibe.edm: ['💎', '✨'],                     // 2 emojis — use modulo
};
```

Use `confetti[index % confetti.length]` to safely cycle through pools with fewer than 4-6 entries.

### Vibe Color Reference (from dj_theme.dart)

| Vibe | `.accent` | `.glow` (for radial) | `.bg` (ceremony bg) |
|------|-----------|---------------------|---------------------|
| general | #FFD700 (gold) | #FFD700 (gold) | #1A0A2E (dark purple) |
| kpop | #FF0080 (hot pink) | #FF69B4 (pink) | #1A0A20 (dark rose) |
| rock | #FF4444 (red) | #FF6600 (orange) | #1A0A0A (near black) |
| ballad | #FF9966 (peach) | #FFCC88 (warm) | #1A1210 (dark brown) |
| edm | #00FFC8 (cyan) | #00C8FF (blue) | #0A1A1A (dark teal) |

### Current CeremonyDisplay Layout (What Changes)

**Anticipation phase** (`_buildAnticipation`) — NO changes needed. Keep the pulsing fade animation with performer name + "And the award goes to..."

**Reveal phase** (`_buildReveal`) — Changes:
1. **Currently**: `Column` with confetti text row → performer → award → flavor text
2. **New**: `Stack` with positioned confetti emojis + radial glow layer + `Column` with performer (22px) → award (gold, 36px) → song title → flavor text

### QuickCeremonyDisplay Layout (What Changes)

**Currently**: `Column` with performer → award → "Quick Award" label, wrapped in fade+scale transitions
**New**: Same layout but add subtle radial glow behind award, optionally scatter 2-3 confetti emojis, style label more subtly

### Background Color Implementation (party_screen.dart)

**Problem**: `Scaffold(backgroundColor: Colors.transparent)` means no state-specific background color is applied. The `partyProvider.backgroundColor` getter exists but is never consumed.

**Solution**: Use `AnimatedContainer` wrapping the body content (pattern used in `lobby_screen.dart` line 139):
```dart
return Scaffold(
  backgroundColor: Colors.transparent,
  body: AnimatedContainer(
    duration: const Duration(milliseconds: 300),
    color: partyProvider.backgroundColor,
    child: SafeArea(
      child: Stack(
        children: [
          // ... existing content
        ],
      ),
    ),
  ),
);
```

This intentionally applies background color for ALL DJ states (not just ceremony). Previously all states fell through to the scaffold default. This broader scope is correct — it also partially addresses Story 10.7 (color consistency) and the `djStateBackgroundColor` function already defines appropriate colors for every state.

### Accessibility Consideration

The `AccessibilityProvider` has a `reducedMotion` property that disables "confetti/glow/pulse effects" (see `accessibility_provider.dart` line 9). Check if `reducedMotion` is used in existing ceremony code. If so, conditionally skip the new glow and scattered confetti when `reducedMotion` is true. If not currently checked, skip this — it's a pre-existing pattern gap.

### Existing Test Patterns (ceremony_display_test.dart)

```dart
// Setup for ceremony reveal:
await tester.pumpWidget(
  MaterialApp(
    home: CeremonyDisplay(
      performerName: 'Alice',
      revealAt: DateTime.now().millisecondsSinceEpoch - 1000, // already passed
      vibe: PartyVibe.general,
      award: 'Mic Drop Master',
      tone: 'hype',
    ),
  ),
);
await tester.pump(const Duration(milliseconds: 100));
// Now in reveal phase
expect(find.text('Mic Drop Master'), findsOneWidget);
```

**Pump guidance**: `pumpAndSettle()` works for reveal-phase tests (anticipation controller is stopped). Use `pump(Duration)` only when testing the anticipation phase (looping animation prevents settle). The existing tests correctly use `pumpAndSettle()` for reveal — do not change them.

### Widget Keys (New)

| Key | Widget | Notes |
|-----|--------|-------|
| `'ceremony-song-title'` | `Text` (song reference) | **NEW** — below award in full ceremony |

### Previous Story Intelligence (10.4)

Key learnings from Story 10.4 implementation:
- **`DJTokens.gold`** is the correct token for gold color (#FFD700)
- **`EmojiText` widget** exists for rendering emoji with specific fontSize — use for scattered confetti
- **Import `EmojiText`**: `package:karamania/widgets/emoji_text.dart` (already imported in `ceremony_display.dart`)
- **`pump(Duration)` not `pumpAndSettle()`** for screens/widgets with animations
- **`partyProvider.vibe.accent`** returns the vibe accent Color directly from enum property
- **`Builder` pattern** for scoping local variables inside build methods (used in 10.4 for song info)
- Code review of 10.4 fixed performer row overflow with `Flexible` + `maxLines: 1` — apply same pattern if ceremony text could overflow

### Git Intelligence

Recent commits (Epic 10 series):
- `e095f21` — Story 10.4: Party screen song & performer display (SongInfoDisplay widget, DJState.song conditional rendering)
- `733ad1e` — Story 10.3: Lobby guest waiting state & playlist management
- `95e6555` — Story 10.2: Join screen 4-box code input, gold button, layout polish
- `d14d8f6` — Story 10.1: Home Screen brand identity & button affordances

Pattern: Each story modifies Flutter widgets + tests, no server changes. Commits use "Implement Story X.Y: description" format.

### Definition of Done (Epic 10 Global)

- [ ] Implementation matches wireframe layout (radial glow behind award, scattered confetti, gold 36px title, dark vibe bg)
- [ ] Screenshot test re-run captures new design (`run_screenshots.sh`)
- [ ] Existing widget tests pass (update finders if changed)
- [ ] Tested with all 5 vibes — verify glow uses vibe.glow color, bg uses vibe.bg color
- [ ] No text overflow on standard phone sizes
- [ ] Existing overlays (moment card, reactions, soundboard, host controls) unaffected

### Project Structure Notes

- No new files — modifications to existing ceremony widgets only
- No new directories, providers, or server changes
- Aligned with `apps/flutter_app/lib/widgets/` structure

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 5]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3 Full Ceremony Experience]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4 Quick Ceremony]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/implementation-artifacts/10-4-party-screen-song-and-performer.md#Previous Story Intelligence]
- [Source: apps/flutter_app/lib/widgets/ceremony_display.dart]
- [Source: apps/flutter_app/lib/widgets/quick_ceremony_display.dart]
- [Source: apps/flutter_app/lib/theme/dj_theme.dart#PartyVibe enum]
- [Source: apps/flutter_app/lib/constants/copy.dart#vibeConfettiEmojis]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Wrapped party_screen.dart Scaffold body with AnimatedContainer using partyProvider.backgroundColor for smooth state-based background transitions (300ms). Follows lobby_screen.dart AnimatedContainer pattern.
- Task 2: Restructured CeremonyDisplay _buildReveal() — replaced single confetti row with Stack layout containing radial glow (200x200, vibe.glow color), 5 scattered confetti EmojiText widgets with modulo-safe indexing, gold award title (36px bold, DJTokens.gold), performer name (22px, DJTokens.textSecondary), and new songTitle display below award. Added songTitle parameter to CeremonyDisplay.
- Task 3: Passed partyProvider.ceremonySongTitle to CeremonyDisplay in party_screen.dart.
- Task 4: Applied celebration energy to QuickCeremonyDisplay — added subtle radial glow (150x150), 3 scattered confetti emojis, changed award color to DJTokens.gold, styled "Quick Award" label more subtly (bodySmall, 0.6 opacity). Added EmojiText import.
- Task 5: Updated ceremony_display_test.dart — added songTitle parameter to buildTestWidget, added tests for songTitle rendered/hidden, scattered confetti EmojiText count, updated existing confetti test to use byType(EmojiText). Updated quick_ceremony_display_test.dart — added Quick Award label key test. All 17 tests pass. Pre-existing join_screen_test failure unrelated.

### Senior Developer Review (AI)

**Reviewer:** Code Review Workflow | **Date:** 2026-04-01 | **Outcome:** Approved (with fixes applied)

**Issues Found:** 3 High, 3 Medium, 1 Low — **All fixed automatically**

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| H1 | HIGH | Award title no overflow protection (both widgets) | Added `maxLines: 2, overflow: TextOverflow.ellipsis` |
| H2 | HIGH | Duplicate test (confetti tested twice identically) | Removed duplicate, replaced with reveal-phase performer + rock vibe confetti tests |
| H3 | HIGH | QuickCeremonyDisplay confetti not tested | Added `EmojiText` confetti assertion test |
| M1 | MEDIUM | No reveal-phase performer name test | Added test verifying performer renders in reveal |
| M2 | MEDIUM | No test for vibes with short emoji lists | Added test with `PartyVibe.rock` (2 emojis, modulo indexing) |
| M3 | MEDIUM | QuickCeremonyDisplay award used `headlineLarge` (~32px) not explicit 36px | Changed to explicit `TextStyle(fontSize: 36)` for consistency |
| L1 | LOW | QuickCeremonyDisplay performer used theme style vs explicit | Changed to explicit `TextStyle(fontSize: 22)` matching CeremonyDisplay |

**Test count:** 17 → 19 (removed 1 duplicate, added 3 new)

### Change Log

- 2026-04-01: Implemented Story 10.5 — Ceremony celebration energy with radial glow, scattered confetti, gold award styling, song reference, animated background
- 2026-04-01: Code review — fixed 7 issues: overflow protection, duplicate test removal, added 3 new tests, consistent explicit font sizing in QuickCeremonyDisplay

### File List

- apps/flutter_app/lib/widgets/ceremony_display.dart (modified — added songTitle param, restructured reveal with Stack/glow/confetti/gold styling, added overflow protection)
- apps/flutter_app/lib/widgets/quick_ceremony_display.dart (modified — added glow, confetti, gold award, subtle label, explicit font sizes, overflow protection)
- apps/flutter_app/lib/screens/party_screen.dart (modified — AnimatedContainer background, songTitle passthrough)
- apps/flutter_app/test/widgets/ceremony_display_test.dart (modified — songTitle tests, confetti tests, reveal performer test, rock vibe test, removed duplicate)
- apps/flutter_app/test/widgets/quick_ceremony_display_test.dart (modified — label key test, confetti test)

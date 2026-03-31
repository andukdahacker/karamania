# Story 10.2: Join Screen — Balanced Layout & Input Sizing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest joining a party,
I want a clean, balanced join form with readable inputs,
so that I can easily enter the party code and my name without text overflow.

## Acceptance Criteria

1. Party code input uses 4 individual square boxes (64x64 each — fits 320px iPhone SE) with auto-advance focus — when a character is typed in box N, focus automatically moves to box N+1
2. Each box displays one character, centered, at fontSize 28 (no overflow/ellipsis)
3. Helper text "Ask your host for the 4-letter code" displayed below code boxes in secondary color (`DJTokens.textSecondary`)
4. Display name input uses fontSize 16 (not the current oversized inherited Material default) with proper placeholder
5. "JOIN PARTY" button is full-width filled gold, matching Home screen CREATE PARTY button style (gold background, dark text, 12px borderRadius)
6. Form is vertically centered in the upper 60% of the screen (no massive dead zone below)
7. Back arrow navigation in top-left corner
8. Deep link pre-fill (`?code=VIBE`) still works, populating the 4 individual boxes with one character each
9. Backspace in an empty box moves focus back to the previous box
10. Pasting a 4-character code fills all 4 boxes simultaneously

## Tasks / Subtasks

- [x] Task 1: Create 4-box party code input widget (AC: #1, #2, #3, #8, #9, #10)
  - [x]1.1 Replace the single `TextField` (key: `party-code-input`) with a `Row` of 4 individual `SizedBox` each containing a `TextField`. Use responsive sizing: `SizedBox(width: 64, height: 64)` (not 70 — four 70px boxes + gaps overflow on 320px iPhone SE screens). Gap: `DJTokens.spaceSm` (8px) between boxes via `Padding(horizontal: DJTokens.spaceXs)`
  - [x]1.2 Create 4 `TextEditingController` instances (`_code0`, `_code1`, `_code2`, `_code3`) and 4 `FocusNode` instances (`_focus0`..`_focus3`)
  - [x]1.3 Each box: `key: Key('party-code-$i')`, `maxLength: 1`, `textAlign: TextAlign.center`, `textCapitalization: TextCapitalization.characters`, `inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]'))]`, `counterText: ''`
  - [x]1.3a Add `Semantics(label: 'Party code digit ${i + 1} of 4')` wrapper on each box for screen reader accessibility
  - [x]1.4 Style each box with `fontSize: 28`, `fontWeight: FontWeight.bold`, font family inherits SpaceGrotesk from theme
  - [x]1.5 Box decoration: `BoxDecoration` with `border: Border.all(color: DJTokens.textSecondary, width: 1.5)`, `borderRadius: BorderRadius.circular(12)`, `color: DJTokens.surfaceElevated`. When focused: `border: Border.all(color: DJTokens.gold, width: 2)`
  - [x]1.6 Auto-advance: In each box's `onChanged`, if text length == 1 and box index < 3, call `_focus[index+1].requestFocus()`
  - [x]1.7 Backspace handling: Use `RawKeyboardListener` or `onChanged` — when text becomes empty and box index > 0, call `_focus[index-1].requestFocus()`
  - [x]1.8 Deep link pre-fill: In `initState`, if `widget.initialCode` is provided, distribute characters across the 4 controllers (`_code0.text = code[0]`, etc.) and set focus to the first empty box or last box if all filled
  - [x]1.9 Paste support: In `_code0`'s `onChanged`, detect if pasted text length > 1 (common when user pastes full code into first box). If so, distribute across all 4 boxes, trim to 4 chars, and focus the last box
  - [x]1.10 Add helper text `Text(Copy.partyCodeHint, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: DJTokens.textSecondary))` below the Row, with `SizedBox(height: DJTokens.spaceSm)` gap
  - [x]1.11 Keep `Key('party-code-input')` on the parent Row widget AND add individual keys `Key('party-code-0')` through `Key('party-code-3')` on each TextField. Tests need individual keys because `tester.enterText` requires a TextField target — `enterText` on a Row key will fail. Existing `find.byKey(Key('party-code-input'))` still locates the code input area for structural assertions
  - [x]1.12 Update `_canJoin` getter: `_code0.text.length == 1 && _code1.text.length == 1 && _code2.text.length == 1 && _code3.text.length == 1 && _nameController.text.trim().isNotEmpty`
  - [x]1.13 Update `_onJoin` to assemble code: `final code = '${_code0.text}${_code1.text}${_code2.text}${_code3.text}'.toUpperCase()`

- [x] Task 2: Fix display name input font size (AC: #4)
  - [x]2.1 Set explicit `style: Theme.of(context).textTheme.bodyLarge` (16px) on the name `TextField`, overriding any inherited larger style
  - [x]2.2 Keep existing key `'display-name-input'`, maxLength 30, textCapitalization.words, hint text Copy.enterYourName
  - [x]2.3 For Firebase pre-filled name (read-only Text widget), keep `bodyLarge` style — it's already 16px

- [x] Task 3: Restyle JOIN PARTY button as filled gold (AC: #5)
  - [x]3.1 Replace the bare `Opacity` > `DJTapButton` with gold-filled Container pattern from Story 10.1:
    ```dart
    Opacity(
      opacity: _canJoin && !isLoading ? 1.0 : 0.5,
      child: DJTapButton(
        key: const Key('join-party-submit-btn'),
        tier: TapTier.consequential,
        onTap: _canJoin && !isLoading ? _onJoin : () {},
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
          decoration: BoxDecoration(
            color: DJTokens.gold,
            borderRadius: BorderRadius.circular(12),
          ),
          child: isLoading
              ? Row(mainAxisAlignment: MainAxisAlignment.center, ...)
              : Text(Copy.joinParty, textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: DJTokens.bgColor,
                  )),
        ),
      ),
    )
    ```
  - [x]3.2 Update loading spinner text color to `DJTokens.bgColor` (dark) to match gold background
  - [x]3.3 Update `CircularProgressIndicator` color to `DJTokens.bgColor` as well

- [x] Task 4: Adjust layout for upper 60% centering (AC: #6)
  - [x]4.1 Replace `mainAxisAlignment: MainAxisAlignment.center` with `MainAxisAlignment.start` and add a `SizedBox` spacer at top
  - [x]4.2 Use `LayoutBuilder` or `MediaQuery.of(context).size.height` to calculate top padding as ~20% of screen height, pushing form content into the upper-center zone
  - [x]4.3 Alternative simpler approach: Use `Align(alignment: Alignment(0, -0.3))` to shift the Column upward from dead center — this avoids hardcoded pixel math and works across screen sizes
  - [x]4.4 Keep the `ConstrainedBox(maxWidth: 428)` wrapper — it prevents ultra-wide layouts on tablets

- [x] Task 5: Add back arrow navigation (AC: #7)
  - [x]5.1 Add `appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, leading: IconButton(key: Key('join-back-btn'), icon: Icon(Icons.arrow_back), onPressed: () => context.go('/')))` to the Scaffold
  - [x]5.2 Remove the existing `TextButton` "Back to home" at the bottom of the Column (redundant with AppBar back arrow)
  - [x]5.3 Remove or mark unused `Copy.backToHome` constant if no other screen references it
  - [x]5.4 **Test impact:** Test at line 229 uses `find.text('Back to home')` to verify navigation — update this test to use `find.byKey(Key('join-back-btn'))` or `find.byIcon(Icons.arrow_back)` instead

- [x] Task 6: Update copy constants (AC: #3)
  - [x]6.1 Add to `Copy` class in `constants/copy.dart`: `static const String partyCodeHint = 'Ask your host for the 4-letter code';`
  - [x]6.2 Check if `Copy.backToHome` (`'Back to home'`, line 67) is used anywhere else. If only used in join screen, remove it (dead code after Task 5)
  - [x]6.3 Verify existing constants still match: `joinParty`, `enterPartyCode`, `enterYourName`, `joiningParty`, `partyNotFound`, `partyIsFull`, `joinFailed`

- [x] Task 7: Update tests (AC: all)
  - [x]7.1 **CRITICAL: `tester.enterText` migration** — All tests that call `tester.enterText(find.byKey(Key('party-code-input')), 'VIBE')` MUST be rewritten. `enterText` requires a TextField target, not a Row. Use individual box keys instead:
    ```dart
    // OLD (will fail — Row is not a TextField):
    await tester.enterText(find.byKey(Key('party-code-input')), 'VIBE');
    // NEW (enter one char per box):
    await tester.enterText(find.byKey(Key('party-code-0')), 'V');
    await tester.enterText(find.byKey(Key('party-code-1')), 'I');
    await tester.enterText(find.byKey(Key('party-code-2')), 'B');
    await tester.enterText(find.byKey(Key('party-code-3')), 'E');
    ```
    Consider adding a test helper: `Future<void> _enterCode(WidgetTester tester, String code)` to avoid repeating this in every test
  - [x]7.2 **Update back-to-home navigation test** (line 229) — currently uses `find.text('Back to home')` which will break since the TextButton is removed. Update to `find.byKey(Key('join-back-btn'))` or `find.byIcon(Icons.arrow_back)`
  - [x]7.3 Add new test: verify auto-advance focus — enter 'V' in box 0, verify focus moves to box 1
  - [x]7.4 Add new test: verify backspace moves focus back — clear box 1, verify focus returns to box 0
  - [x]7.5 Update deep link pre-fill test: verify `JoinScreen(initialCode: 'VIBE')` populates all 4 boxes with V, I, B, E respectively. Use `(tester.widget<TextField>(find.byKey(Key('party-code-0')))).controller!.text` to assert individual box values
  - [x]7.6 Add new test: verify paste distributes across all 4 boxes
  - [x]7.7 Update `_canJoin` validation tests — code is now across 4 controllers, not one. Tests checking opacity at partial code (e.g., 'AB') need to fill only 2 of 4 boxes
  - [x]7.8 Update the `_consequentialTap` helper if button child structure changed (Container wrapping shouldn't affect it since DJTapButton handles the gesture)
  - [x]7.9 Verify loading state test still passes with new gold button layout
  - [x]7.10 DO NOT test: box border colors, font sizes, gold button color values, spacing pixels
  - [x]7.11 Run full test suite: `flutter test test/screens/join_screen_test.dart`

- [x] Task 8: Dispose controllers and focus nodes (AC: all)
  - [x]8.1 Dispose all 4 code controllers and 4 focus nodes in `dispose()` method
  - [x]8.2 Remove the old single `_codeController` disposal

## Dev Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `apps/flutter_app/lib/screens/join_screen.dart` | Major refactor: 4-box code input, gold button, layout shift, AppBar |
| `apps/flutter_app/lib/widgets/party_code_input.dart` | **NEW** (recommended) — extracted 4-box code input widget |
| `apps/flutter_app/lib/constants/copy.dart` | Add `partyCodeHint`; remove `backToHome` if unused elsewhere |
| `apps/flutter_app/test/screens/join_screen_test.dart` | Rewrite `enterText` calls to use individual box keys, update back nav test, add auto-advance/backspace/paste tests |

### Files to NOT Create (unless extracting widget)

- **Recommended:** Extract 4-box code input to `widgets/party_code_input.dart` as a `PartyCodeInput` widget with `ValueChanged<String> onCodeComplete` and `String? initialCode` props. The 4 controllers + 4 focus nodes + auto-advance + backspace + paste logic is ~80+ lines of state — keeping it inline bloats JoinScreen significantly. The widget is also independently testable.
- No new theme files — all tokens exist in `DJTokens`
- No server changes — this is pure Flutter UI

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — this is pure UI styling, no server interaction changes
- **Preserve all existing `Key(...)` values** — tests depend on `party-code-input`, `display-name-input`, `join-party-submit-btn`, `join-error-message`
- **Use `DJTokens` spacing** — never hardcode padding/margin values (`spaceXs`=4, `spaceSm`=8, `spaceMd`=16, `spaceLg`=24, `spaceXl`=32)
- **All copy in `constants/copy.dart`** — no hardcoded strings in widgets
- **Import with `package:karamania/...`** for cross-directory imports
- **Use `DJTokens.gold`** (Color(0xFFFFD700)) for all gold styling — already defined in Story 10.1
- **Widget keys use `Key('kebab-case-descriptor')`** naming convention

### Gold Button Pattern (from Story 10.1)

The gold filled button pattern established on the Home screen wraps the visual styling in a `Container` inside `DJTapButton.child`. DJTapButton handles tap behavior (hold-to-confirm, haptics, scale animation) and adds 8px internal padding + AnimatedScale. The Container provides gold background, 12px borderRadius, and full-width layout. Copy this pattern exactly for the join button:

```dart
DJTapButton(
  key: const Key('join-party-submit-btn'),
  tier: TapTier.consequential,
  onTap: _canJoin && !isLoading ? _onJoin : () {},
  child: Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
    decoration: BoxDecoration(
      color: DJTokens.gold,
      borderRadius: BorderRadius.circular(12),
    ),
    child: /* text or loading spinner */,
  ),
),
```

### 4-Box Code Input Design

Each box is a styled TextField inside a sized container. Uses 64px boxes (not 70) to fit 320px iPhone SE screens with padding.

```dart
Row(
  key: const Key('party-code-input'),
  mainAxisAlignment: MainAxisAlignment.center,
  children: List.generate(4, (i) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: DJTokens.spaceXs),
      child: Semantics(
        label: 'Party code digit ${i + 1} of 4',
        child: SizedBox(
          width: 64,
          height: 64,
          child: TextField(
            key: Key('party-code-$i'),
            controller: _codeControllers[i],
            focusNode: _codeFocusNodes[i],
            textAlign: TextAlign.center,
            maxLength: 1,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]'))],
            decoration: InputDecoration(
              counterText: '',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: DJTokens.textSecondary, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: DJTokens.gold, width: 2),
              ),
              filled: true,
              fillColor: DJTokens.surfaceElevated,
            ),
            onChanged: (value) => _handleCodeInput(i, value),
          ),
        ),
      ),
    );
  }),
)
```

### Code Input Handler (auto-advance, backspace, paste — single unified method)

```dart
void _handleCodeInput(int index, String value) {
  // Paste detection: if more than 1 char entered in a single box
  if (value.length > 1) {
    final chars = value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    for (int i = 0; i < 4 && i < chars.length; i++) {
      _codeControllers[i].text = chars[i];
    }
    final lastIndex = (chars.length - 1).clamp(0, 3);
    _codeFocusNodes[lastIndex].requestFocus();
    setState(() {});
    return;
  }
  // Auto-advance on character entry
  if (value.length == 1 && index < 3) {
    _codeFocusNodes[index + 1].requestFocus();
  }
  // Backspace: move focus to previous box
  else if (value.isEmpty && index > 0) {
    _codeFocusNodes[index - 1].requestFocus();
  }
  setState(() {}); // Trigger _canJoin re-evaluation
}
```

### Deep Link Pre-fill

Currently `_codeController = TextEditingController(text: widget.initialCode ?? '')`. Update to:

```dart
if (widget.initialCode != null && widget.initialCode!.isNotEmpty) {
  final code = widget.initialCode!.toUpperCase();
  for (int i = 0; i < 4 && i < code.length; i++) {
    _codeControllers[i].text = code[i];
  }
}
```

### Current Join Screen State (Pre-Modification)

| Aspect | Current | Target |
|--------|---------|--------|
| Code input | Single TextField, maxLength 4 | 4 separate 70x70 boxes |
| Code font | displayMedium (~24px) | 28px bold |
| Name font | Inherited Material default | Explicit 16px (bodyLarge) |
| Button | Bare DJTapButton (no styling) | Gold-filled Container |
| Layout | Column centered vertically | Upper 60% via Align offset |
| Navigation | TextButton at bottom | AppBar back arrow |
| Helper text | None | "Ask your host for the 4-letter code" |

### Widget Keys

| Key | Widget | Notes |
|-----|--------|-------|
| `'party-code-input'` | Row (parent) | Preserved for structural finders. **Cannot use with `tester.enterText`** — use individual box keys |
| `'party-code-0'` .. `'party-code-3'` | TextField (each box) | **NEW** — required for `tester.enterText` per box |
| `'display-name-input'` | TextField | Unchanged |
| `'join-party-submit-btn'` | DJTapButton | Unchanged |
| `'join-error-message'` | Text | Unchanged |
| `'join-back-btn'` | IconButton (AppBar) | **NEW** — replaces `find.text('Back to home')` in tests |

### Previous Story Intelligence (10.1)

Key learnings from Story 10.1 implementation:
- **Lottie + pumpAndSettle:** Animation caused test timeouts — use explicit `pump(duration)` instead of `pumpAndSettle` if any animations are added
- **Container wrapping DJTapButton:** Does NOT break key-based test finders since key is on DJTapButton, not the Container child
- **errorBuilder pattern:** Always add errorBuilder to Lottie widgets for test safety
- **Gold color is `DJTokens.gold`** — already defined, reuse it
- **Dark text on gold = `DJTokens.bgColor`** (`#0A0A0F`)
- **SingleChildScrollView:** Story 10.1 switched HomeScreen from Column to SingleChildScrollView — consider if JoinScreen needs same treatment for smaller devices

### DJTokens Reference

```dart
// Colors
static const Color gold = Color(0xFFFFD700);
static const Color bgColor = Color(0xFF0A0A0F);
static const Color surfaceElevated = Color(0xFF252542);
static const Color textPrimary = Color(0xFFF0F0F0);
static const Color textSecondary = Color(0xFF9494B0);

// Spacing
static const double spaceXs = 4;
static const double spaceSm = 8;
static const double spaceMd = 16;
static const double spaceLg = 24;
static const double spaceXl = 32;
```

### Definition of Done (Epic 10 Global)

- [ ] Implementation matches wireframe layout
- [ ] Screenshot test re-run captures new design (`run_screenshots.sh`)
- [ ] Existing widget tests pass (update keys/finders if changed)
- [ ] Tested with all 5 vibes (general, kpop, rock, ballad, edm) — Join screen is pre-vibe, so just verify dark theme consistency
- [ ] No text overflow/ellipsis on standard phone sizes
- [ ] Deep link pre-fill verified working end-to-end

### Project Structure Notes

- All changes are Flutter UI only — no server, API, or DB modifications
- Aligned with `apps/flutter_app/lib/` structure: screens, constants
- No new directories or modules needed
- If code input widget is extracted: `apps/flutter_app/lib/widgets/party_code_input.dart`

### Testing Boundaries

Per project rules:
- **DO test:** tap behavior, auto-advance focus, backspace focus, paste distribution, navigation, loading states, deep link pre-fill, validation logic, error display
- **DO NOT test:** box border colors, gold button color values, font sizes, spacing pixels, border radius
- **Accessibility:** Verify `Semantics` labels exist on code boxes (use `find.bySemanticsLabel`)
- `tester.enterText` requires a `TextField` target — use `Key('party-code-0')` through `Key('party-code-3')`, NOT `Key('party-code-input')` (which is on the Row)
- The consequential tap helper `_consequentialTap()` simulates 500ms hold — keep using it

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 2]
- [Source: _bmad-output/brand-brief.md#Visual Direction]
- [Source: _bmad-output/excalidraw-diagrams/wireframe-ux-redesign.excalidraw]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/implementation-artifacts/10-1-home-screen-brand-identity.md#Gold Button Pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed setState-during-build by reordering listener registration after initial text set in PartyCodeInput.initState
- Removed `maxLength: 1` from TextField to allow paste detection (multi-char onChanged)
- Updated deep_link_test.dart: replaced `tester.widget<TextField>(find.byKey(Key('party-code-input')))` with per-box assertions
- Replaced `pumpAndSettle` with explicit `pump(duration)` in tests involving HomeScreen (Lottie animation causes timeout)

### Code Review Fixes (AI)

- **H1 Fixed:** `_handleCodeInput` now distinguishes edit (2-char = replace current box) vs paste (3+ chars = distribute). Prevents adjacent box corruption when editing a filled box.
- **M1 Fixed:** Removed unused `GlobalKey<PartyCodeInputState>` from `JoinScreen` — `onCodeChanged` callback handles all state communication.
- **M2 Fixed:** Renamed `PartyCodeInputState` → `_PartyCodeInputState` (private). No external access needed.
- **M3 Fixed:** Added test `firebase-authenticated user sees read-only name instead of text field` using `_FakeFirebaseAuthProvider`.
- **L1 Fixed:** Removed dead `Copy.enterPartyCode` constant (unused after 4-box refactor).
- **L2 Fixed:** Added `counterText: ''` to PartyCodeInput InputDecoration as defensive coding.

### Completion Notes List

- Task 1: Created `PartyCodeInput` extracted widget with 4 individual `SizedBox(64x64)` TextFields, auto-advance, backspace focus, paste distribution, deep link pre-fill, Semantics labels, helper text
- Task 2: Set explicit `bodyLarge` style (16px) on display name TextField
- Task 3: Restyled JOIN PARTY button as gold-filled Container matching Home screen CREATE PARTY pattern; updated spinner/text colors to `DJTokens.bgColor`
- Task 4: Replaced `MainAxisAlignment.center` with `Align(alignment: Alignment(0, -0.3))` for upper 60% centering; kept `ConstrainedBox(maxWidth: 428)`
- Task 5: Added AppBar with back arrow (`Key('join-back-btn')`); removed TextButton "Back to home"
- Task 6: Added `Copy.partyCodeHint`; removed unused `Copy.backToHome`
- Task 7: Rewrote all tests using per-box keys (`party-code-0` through `party-code-3`); added auto-advance, backspace, paste, accessibility tests; updated deep link tests; added `_enterCode` helper
- Task 8: PartyCodeInput widget disposes all 4 controllers and 4 focus nodes; old single `_codeController` removed

### File List

- `apps/flutter_app/lib/screens/join_screen.dart` — Major refactor: uses PartyCodeInput, gold button, Align layout, AppBar back arrow
- `apps/flutter_app/lib/widgets/party_code_input.dart` — **NEW** extracted 4-box code input widget
- `apps/flutter_app/lib/constants/copy.dart` — Added `partyCodeHint`, removed `backToHome` and dead `enterPartyCode`
- `apps/flutter_app/test/screens/join_screen_test.dart` — Rewrote all code input tests, added 7 new tests (auto-advance, backspace, paste, helper text, back arrow, accessibility, firebase name)
- `apps/flutter_app/test/routing/deep_link_test.dart` — Updated to use per-box assertions for code pre-fill verification

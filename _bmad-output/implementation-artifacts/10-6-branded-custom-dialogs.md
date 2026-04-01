# Story 10.6: Branded Custom Dialogs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user interacting with confirmation dialogs,
I want dialogs that match the app's dark theme and brand with gold CTA buttons and consistent styling,
so that the experience feels cohesive and not like a generic Android app.

## Acceptance Criteria

1. All `showDialog` / `AlertDialog` calls use a branded dialog widget — no raw `AlertDialog` remains in the codebase
2. Dialog background: `DJTokens.surfaceElevated` (`#252542`)
3. Dialog shape: `RoundedRectangleBorder` with `borderRadius: 16`
4. Dialog title: `DJTokens.textPrimary` (`#F0F0F0`)
5. Dialog body text: `DJTokens.textSecondary` (`#9494B0`)
6. Confirm/primary button: gold filled (`DJTokens.gold` background, dark text) — matching CTA button style from home/join screens
7. Cancel button: text-only with `DJTokens.textSecondary` color
8. Destructive button (e.g., "End Party"): text-only with `DJTokens.actionDanger` color
9. No Material Design default blue accent colors visible in any dialog
10. Applies to all 3 existing AlertDialog usages: leave party (app.dart), name entry (home_screen.dart), end party confirmation (host_controls_overlay.dart)
11. Fullscreen image viewers (`Dialog.fullscreen` in media_gallery_screen.dart, `Dialog` in session_detail_screen.dart) are NOT modified — they are purpose-built image overlays, not branded dialogs
12. All existing dialog test assertions in `host_controls_overlay_test.dart` continue to pass — keys `end-party-dialog`, `end-party-cancel`, `end-party-confirm` are preserved (only file with dialog tests; `home_screen_test.dart` has no dialog tests, `app.dart` has no tests)
13. Bottom sheets (`showModalBottomSheet`) are NOT in scope — they already use `DJTokens.surfaceColor` and are separate UI patterns

## Tasks / Subtasks

- [x] Task 1: Create `BrandedDialog` widget and helper functions (AC: #2, #3, #4, #5, #6, #7, #8)
  - [x]1.1 Create new file `apps/flutter_app/lib/widgets/branded_dialog.dart`
  - [x]1.2 Create `BrandedDialog` widget extending `StatelessWidget` that wraps `Dialog`:
    ```dart
    class BrandedDialog extends StatelessWidget {
      const BrandedDialog({
        super.key,
        required this.title,
        this.content,
        this.actions = const [],
      });

      final String title;
      final Widget? content;
      final List<Widget> actions;

      @override
      Widget build(BuildContext context) {
        return Dialog(
          backgroundColor: DJTokens.surfaceElevated,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.all(DJTokens.spaceLg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: DJTokens.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (content != null) ...[
                  const SizedBox(height: DJTokens.spaceMd),
                  content!,
                ],
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: DJTokens.spaceLg),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: actions,
                  ),
                ],
              ],
            ),
          ),
        );
      }
    }
    ```
  - [x]1.3 Create `BrandedDialogAction` helper widget for consistent action buttons:
    ```dart
    class BrandedDialogAction extends StatelessWidget {
      const BrandedDialogAction({
        super.key,
        required this.label,
        required this.onPressed,
        this.style = BrandedDialogActionStyle.cancel,
      });

      final String label;
      final VoidCallback onPressed;
      final BrandedDialogActionStyle style;
      // ... build method uses style to pick colors
    }

    enum BrandedDialogActionStyle { cancel, confirm, danger }
    ```
    - `cancel`: `TextButton` with `DJTokens.textSecondary` text color
    - `confirm`: `ElevatedButton` with `DJTokens.gold` background + dark text (`DJTokens.bgColor`)
    - `danger`: `TextButton` with `DJTokens.actionDanger` text color
  - [x]1.4 Create `showBrandedConfirm` helper function for simple confirm/cancel dialogs. **CRITICAL:** Must accept optional `cancelKey` and `confirmKey` parameters — `host_controls_overlay_test.dart` uses `find.byKey(Key('end-party-cancel'))` and `find.byKey(Key('end-party-confirm'))` to tap buttons:
    ```dart
    Future<bool> showBrandedConfirm({
      required BuildContext context,
      required String title,
      required String message,
      String confirmLabel = 'OK',
      String cancelLabel = 'CANCEL',
      bool isDanger = false,
      Key? key,
      Key? cancelKey,
      Key? confirmKey,
    }) async {
      final result = await showDialog<bool>(
        context: context,
        builder: (context) => BrandedDialog(
          key: key,
          title: title,
          content: Text(message, style: const TextStyle(color: DJTokens.textSecondary)),
          actions: [
            BrandedDialogAction(
              key: cancelKey,
              label: cancelLabel,
              style: BrandedDialogActionStyle.cancel,
              onPressed: () => Navigator.of(context).pop(false),
            ),
            const SizedBox(width: DJTokens.spaceSm),
            BrandedDialogAction(
              key: confirmKey,
              label: confirmLabel,
              style: isDanger ? BrandedDialogActionStyle.danger : BrandedDialogActionStyle.confirm,
              onPressed: () => Navigator.of(context).pop(true),
            ),
          ],
        ),
      );
      return result ?? false;
    }
    ```

- [x] Task 2: Replace leave party dialog in `app.dart` (AC: #1, #10)
  - [x]2.1 Import `package:karamania/widgets/branded_dialog.dart`
  - [x]2.2 Replace lines 78-95 `showDialog<bool>(...AlertDialog...)` with:
    ```dart
    final shouldExit = await showBrandedConfirm(
      context: context,
      title: 'Leave Party?',
      message: 'Are you sure you want to leave the party?',
      confirmLabel: 'LEAVE',
      cancelLabel: 'STAY',
    );
    ```
    Note: This is NOT a danger action — leaving is a neutral choice, not destructive

- [x] Task 3: Replace end party confirmation dialog in `host_controls_overlay.dart` (AC: #1, #8, #10)
  - [x]3.1 Import `package:karamania/widgets/branded_dialog.dart`
  - [x]3.2 Replace `_showEndPartyConfirmation` method (lines 243-277) with:
    ```dart
    void _showEndPartyConfirmation(BuildContext context) async {
      final confirmed = await showBrandedConfirm(
        context: context,
        title: Copy.hostControlEndPartyConfirmTitle,
        message: Copy.hostControlEndPartyConfirmBody,
        confirmLabel: Copy.hostControlEndPartyConfirmYes,
        cancelLabel: Copy.hostControlEndPartyConfirmNo,
        isDanger: true,
        key: const Key('end-party-dialog'),
        cancelKey: const Key('end-party-cancel'),
        confirmKey: const Key('end-party-confirm'),
      );
      if (confirmed && context.mounted) {
        SocketClient.instance.emitHostEndParty();
      }
    }
    ```
  - [x]3.3 **CRITICAL — 3 test keys MUST be preserved:**
    - `Key('end-party-dialog')` — on `BrandedDialog` root (via `key` param)
    - `Key('end-party-cancel')` — on cancel `BrandedDialogAction` (via `cancelKey` param)
    - `Key('end-party-confirm')` — on confirm `BrandedDialogAction` (via `confirmKey` param)
    These are asserted with `find.byKey()` in `host_controls_overlay_test.dart` (lines 214, 217-218, 238, 241, 245). Tests TAP buttons by key, not by text.

- [x] Task 4: Replace name entry dialog in `home_screen.dart` (AC: #1, #6, #10)
  - [x]4.1 Import `package:karamania/widgets/branded_dialog.dart`
  - [x]4.2 Replace `_showNameDialog` method (lines 533-566). This dialog is unique — it has a `TextField` for input, not just confirm/cancel. Build it directly with `BrandedDialog`:
    ```dart
    Future<String?> _showNameDialog(BuildContext context) async {
      final controller = TextEditingController();
      return showDialog<String>(
        context: context,
        builder: (context) => BrandedDialog(
          title: Copy.enterYourName,
          content: TextField(
            key: const Key('guest-name-input'),
            controller: controller,
            maxLength: 30,
            autofocus: true,
            style: const TextStyle(color: DJTokens.textPrimary),
            decoration: const InputDecoration(
              hintText: Copy.enterYourName,
              hintStyle: TextStyle(color: DJTokens.textSecondary),
            ),
          ),
          actions: [
            BrandedDialogAction(
              label: Copy.cancel,
              style: BrandedDialogActionStyle.cancel,
              onPressed: () => Navigator.of(context).pop(),
            ),
            const SizedBox(width: DJTokens.spaceSm),
            BrandedDialogAction(
              label: Copy.ok,
              style: BrandedDialogActionStyle.confirm,
              onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            ),
          ],
        ),
      );
    }
    ```
  - [x]4.3 Key `'guest-name-input'` on the TextField is preserved for any existing test finders

- [x] Task 5: Write tests for `BrandedDialog` widget (AC: #2, #3, #4, #5, #6, #7, #8, #12)
  - [x]5.1 Create `test/widgets/branded_dialog_test.dart`
  - [x]5.2 Test: `BrandedDialog` renders title text
  - [x]5.3 Test: `BrandedDialog` renders content widget when provided
  - [x]5.4 Test: `BrandedDialog` hides content when null
  - [x]5.5 Test: `BrandedDialogAction` with `confirm` style renders as `ElevatedButton`
  - [x]5.6 Test: `BrandedDialogAction` with `cancel` style renders as `TextButton`
  - [x]5.7 Test: `BrandedDialogAction` with `danger` style renders as `TextButton`
  - [x]5.8 Test: `showBrandedConfirm` returns `true` when confirm tapped
  - [x]5.9 Test: `showBrandedConfirm` returns `false` when cancel tapped
  - [x]5.10 Test: `showBrandedConfirm` returns `false` when dismissed (barrier tap)
  - [x]5.11 **DO NOT test**: specific colors, border radius values, font sizes, padding values — these are visual details

- [x] Task 6: Verify existing dialog tests pass (AC: #12)
  - [x]6.1 Run `flutter test test/widgets/host_controls_overlay_test.dart` — verify end party dialog tests pass with new widget structure
  - [x]6.2 If key-based finders (`Key('end-party-dialog')`, `Key('end-party-cancel')`, `Key('end-party-confirm')`) break, update the `BrandedDialog`/`BrandedDialogAction` to accept and pass through keys
  - [x]6.3 Run `flutter test` full suite to catch any regressions

## Dev Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `apps/flutter_app/lib/widgets/branded_dialog.dart` | **NEW** — `BrandedDialog` widget, `BrandedDialogAction`, `BrandedDialogActionStyle` enum, `showBrandedConfirm` helper |
| `apps/flutter_app/lib/app.dart` | Replace `AlertDialog` with `showBrandedConfirm` in GoRouter `onExit` |
| `apps/flutter_app/lib/screens/home_screen.dart` | Replace `AlertDialog` with `BrandedDialog` in `_showNameDialog` |
| `apps/flutter_app/lib/widgets/host_controls_overlay.dart` | Replace `AlertDialog` with `showBrandedConfirm` (danger variant) in `_showEndPartyConfirmation` |
| `apps/flutter_app/test/widgets/branded_dialog_test.dart` | **NEW** — widget and helper tests |

### Files to NOT Modify

- `media_gallery_screen.dart` — `Dialog.fullscreen` is a purpose-built image viewer, not a branded dialog
- `session_detail_screen.dart` — `Dialog` with transparent bg is a purpose-built image viewer
- `lobby_screen.dart` — bottom sheet for TV pairing, not a dialog
- `party_screen.dart` — bottom sheet for invite, not a dialog
- `dj_tokens.dart` — all required tokens exist (`surfaceElevated`, `textPrimary`, `textSecondary`, `gold`, `bgColor`, `actionDanger`)
- `copy.dart` — all required copy constants exist (`cancel`, `ok`, `enterYourName`, `hostControlEndPartyConfirmTitle/Body/Yes/No`)
- No server changes — pure Flutter UI

### DO NOT Use ThemeData.dialogTheme

`dj_theme.dart` has no `dialogTheme` property set. Do NOT attempt to solve branding via `ThemeData.dialogTheme` — the widget-level `BrandedDialog` approach is correct because it provides explicit control and the app only has 3 dialog call sites. Theme-level config would still leave `AlertDialog` defaults leaking through.

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — pure UI widget creation
- **Providers are read-only from widgets** — `context.watch<T>()` only
- **Use `DJTokens` for ALL visual constants** — no hardcoded color values
- **All copy in `constants/copy.dart`** — hardcoded strings `'Leave Party?'` and `'Are you sure...'` in `app.dart` are existing tech debt; move to `copy.dart` if convenient but not required (they are English-only, no i18n currently)
- **Import with `package:karamania/...`** for cross-directory imports
- **Widget keys use `Key('kebab-case-descriptor')`**
- **File naming:** `branded_dialog.dart` (snake_case)

### Existing Dialog Audit (Complete)

| Location | Type | Current Pattern | Action |
|----------|------|-----------------|--------|
| `app.dart:78-95` | Leave party confirm | `AlertDialog` + `surfaceElevated` bg | Replace with `showBrandedConfirm` |
| `home_screen.dart:533-566` | Name entry input | `AlertDialog` + `surfaceElevated` bg + `TextField` | Replace with `BrandedDialog` (custom content) |
| `host_controls_overlay.dart:243-277` | End party confirm | `AlertDialog` + `surfaceColor` bg (inconsistent!) | Replace with `showBrandedConfirm(isDanger: true)` |
| `media_gallery_screen.dart:239-252` | Fullscreen image | `Dialog.fullscreen` + black bg | SKIP — image viewer |
| `session_detail_screen.dart:494-507` | Fullscreen image | `Dialog` + transparent bg | SKIP — image viewer |

Note: `host_controls_overlay.dart` currently uses `DJTokens.surfaceColor` (#1A1A2E) instead of `surfaceElevated` (#252542) — this is inconsistent with the other dialogs. The branded dialog will fix this.

### Gold Button Pattern Reference

The home screen and join screen already use gold-filled buttons for CTAs. The pattern:
```dart
ElevatedButton(
  style: ElevatedButton.styleFrom(
    backgroundColor: DJTokens.gold,
    foregroundColor: DJTokens.bgColor, // dark text on gold
  ),
  child: Text(label),
)
```
The `BrandedDialogAction` confirm style should use this same approach for visual consistency.

### Bottom Sheet Styling (NOT in scope but reference)

Bottom sheets in `host_controls_overlay.dart`, `party_screen.dart`, and `lobby_screen.dart` already use `DJTokens.surfaceColor` background and `DJTokens.textPrimary` text. They are visually consistent with the dark theme. If the user wants to brand these later, that's a separate effort — they use `showModalBottomSheet` not `showDialog`.

### Test Key Dependencies

Check `test/widgets/host_controls_overlay_test.dart` for these keys:
- `Key('end-party-dialog')` — on the AlertDialog root widget
- `Key('end-party-cancel')` — on the cancel TextButton
- `Key('end-party-confirm')` — on the confirm TextButton

These keys MUST be preserved on equivalent widgets in the `BrandedDialog` replacement. The `showBrandedConfirm` helper should support optional `key`, `cancelKey`, and `confirmKey` parameters.

### Previous Story Intelligence (10.5)

Key learnings from Story 10.5:
- **`DJTokens.gold`** (#FFD700) is the brand gold color — use for confirm buttons
- **Overflow protection**: Add `maxLines` + `TextOverflow.ellipsis` on title text in `BrandedDialog` for safety
- **Explicit font sizes** preferred over theme text styles for consistency (10.5 code review changed theme styles to explicit `TextStyle`)
- **Test with `pumpAndSettle()`** for dialog tests — dialogs don't have looping animations
- Code review of 10.5 caught duplicate tests and missing test coverage — write thorough but non-redundant tests

### Git Intelligence

Recent commits (Epic 10 pattern):
- Each story modifies Flutter widgets + tests only, no server changes
- Commits use format: `Implement Story X.Y: description`
- Code review fixes applied in same commit (after `code-review` workflow)

### Project Structure Notes

- New file `branded_dialog.dart` goes in `apps/flutter_app/lib/widgets/` — alongside existing widget files like `ceremony_display.dart`, `emoji_text.dart`, `host_controls_overlay.dart`
- New test file goes in `apps/flutter_app/test/widgets/`
- No new directories or providers needed

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 6]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/implementation-artifacts/10-5-ceremony-celebration-energy.md#Dev Notes]
- [Source: apps/flutter_app/lib/app.dart:78-95]
- [Source: apps/flutter_app/lib/screens/home_screen.dart:533-566]
- [Source: apps/flutter_app/lib/widgets/host_controls_overlay.dart:243-277]
- [Source: apps/flutter_app/lib/theme/dj_tokens.dart]
- [Source: apps/flutter_app/lib/constants/copy.dart]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None

### Completion Notes List

- Created `BrandedDialog` widget with `surfaceElevated` bg, 16px border radius, primary/secondary text colors
- Created `BrandedDialogAction` with 3 styles: cancel (text secondary), confirm (gold filled), danger (action danger)
- Created `showBrandedConfirm` helper with key passthrough for test compatibility
- Replaced `AlertDialog` in `app.dart` leave party dialog with `showBrandedConfirm`
- Replaced `AlertDialog` in `host_controls_overlay.dart` end party dialog with `showBrandedConfirm(isDanger: true)` — preserved all 3 test keys
- Replaced `AlertDialog` in `home_screen.dart` name dialog with `BrandedDialog` + `BrandedDialogAction` — preserved `guest-name-input` key
- Fixed inconsistency: host controls dialog was using `surfaceColor` (#1A1A2E), now uses `surfaceElevated` (#252542) via BrandedDialog
- Removed unused `DJTokens` import from `app.dart`
- Moved hardcoded leave party strings from `app.dart` to `Copy` constants
- 11 new widget tests: title rendering, content visibility, 3 action styles, confirm/cancel/dismiss behavior, isDanger variant, key passthrough
- All 10 existing host_controls_overlay_test.dart tests pass with new widget structure
- Full suite: 861 passed, 1 pre-existing failure (join_screen_test.dart pumpAndSettle timeout — unrelated)

### Change Log

- 2026-04-01: Implemented Story 10.6 — branded custom dialogs replacing all AlertDialog usages
- 2026-04-01: Code review fixes — moved hardcoded strings to Copy, strengthened tests (weak assertion, isDanger coverage, key passthrough), retracted L1 (dj_theme import provides DJState)

### File List

- `apps/flutter_app/lib/widgets/branded_dialog.dart` — **NEW** — BrandedDialog, BrandedDialogAction, showBrandedConfirm
- `apps/flutter_app/lib/constants/copy.dart` — **MODIFIED** — added leavePartyConfirmTitle/Body/Yes/No constants
- `apps/flutter_app/lib/app.dart` — **MODIFIED** — replaced AlertDialog with showBrandedConfirm, removed unused DJTokens import, replaced hardcoded strings with Copy constants
- `apps/flutter_app/lib/screens/home_screen.dart` — **MODIFIED** — replaced AlertDialog with BrandedDialog in _showNameDialog
- `apps/flutter_app/lib/widgets/host_controls_overlay.dart` — **MODIFIED** — replaced AlertDialog with showBrandedConfirm(isDanger: true)
- `apps/flutter_app/test/widgets/branded_dialog_test.dart` — **NEW** — 9 widget tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **MODIFIED** — story status updated

# Story 8.3: Setlist Poster Generation & Sharing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want a shareable setlist poster from tonight's party,
So that I can share the full lineup and relive the night with friends who were there.

## Acceptance Criteria

1. **Given** the finale reaches step 3 (setlist poster), **When** the poster is generated, **Then** it shows all songs performed, performer names, the date, and awards for each song (FR36) **And** the poster reflects the current party vibe's visual styling
2. **Given** a participant views the setlist poster, **When** they want to share it, **Then** they can share via the native mobile share sheet with a single tap (FR37) **And** the shared artifact is a PNG image in 9:16 Instagram Story format
3. **Given** a participant taps the share button, **When** the share sheet opens, **Then** the share intent tap is tracked as a viral signal metric (FR44) via Socket.io event
4. **Given** a poster is rendered, **When** any song has a long title, performer name, or award, **Then** text truncation, dynamic font scaling, and overflow handling ensure the poster remains share-worthy (defensive rendering per UX spec)
5. **Given** a poster is rendered, **When** the party has many songs (10+), **Then** the poster layout scales gracefully — font sizes reduce and song entries compact to fit the 9:16 format without scrolling

## Tasks / Subtasks

- [x] Task 1: Create SetlistPosterWidget — 9:16 visual poster (AC: #1, #4, #5)
  - [x] 1.1 Create `apps/flutter_app/lib/widgets/setlist_poster_widget.dart` — NEW: StatelessWidget that renders a concert-poster-style setlist at 9:16 aspect ratio
    - Uses `AspectRatio(aspectRatio: 9 / 16)` — same pattern as `MomentCard`
    - Receives: `List<SetlistEntry> setlist`, `PartyVibe vibe`, `String? venueName`, `DateTime date`
    - Layout (top to bottom):
      1. **Header**: Karamania logo/branding text (subtle, `Copy.appTitle` with letter spacing) + date formatted as "Mar 20, 2026"
      2. **Venue name** (if provided) — from `PartyProvider.venueName` (wired in Task 5, nullable — omit line if null)
      3. **Song list**: Each entry shows position number (large, vibe.accent color), song title (bold), artist (subtitle), performer name tag, award badge (if present)
      4. **Footer**: Karamania branding — "karamania.app" or similar subtle text
    - Vibe styling: gradient background `[vibe.bg, vibe.bg.withValues(alpha: 0.8), DJTokens.bgColor]` — same gradient pattern as `MomentCard`
    - Vibe accent color for position numbers and award badges
    - Defensive rendering: `maxLines: 1` + `TextOverflow.ellipsis` for all text fields. Dynamic font sizing: if `setlist.length > 8`, reduce base font size proportionally (min 10sp)
  - [x] 1.2 Song entry sub-layout per list item:
    ```
    [#1]  Song Title
          by Artist Name
          performer_tag  [award_badge]
    ```
    - Position number: large bold text in `vibe.accent` color
    - Song title: `textTheme.bodyLarge`, bold, white, maxLines 1
    - Artist: `textTheme.bodySmall`, `DJTokens.textSecondary`, maxLines 1
    - Performer name: small chip/tag with `vibe.primary` background (omit if null)
    - Award: small badge with `vibe.accent` border (omit if null), show `awardTitle` text
  - [x] 1.3 Handle edge cases:
    - Empty setlist (no songs played) — show "No songs tonight" placeholder
    - Songs without performer (null performerName) — omit performer tag
    - Songs without award (null awardTitle) — omit award badge
    - Very long setlists (15+ songs) — reduce spacing and font sizes, still fit 9:16

- [x] Task 2: Capture poster as image and share (AC: #2, #3)
  - [x] 2.1 Modify `apps/flutter_app/lib/widgets/finale_setlist_widget.dart` (created by Story 8.2):
    - **Required imports** at top of file:
      ```dart
      import 'dart:ui' as ui;
      import 'package:flutter/rendering.dart';
      import 'package:share_plus/share_plus.dart';
      import 'package:karamania/socket/client.dart';
      ```
    - Add a `RepaintBoundary` wrapper with `GlobalKey _posterKey` around the `SetlistPosterWidget`
    - Replace the existing text share button (currently uses `Copy.finaleShareButton` / `'Share Setlist'`) with the poster image share as the PRIMARY share action
    - Keep the existing text-based share (`finaleShareText()`) as a secondary option (long-press or secondary button)
  - [x] 2.2 Implement `_shareSetlistPoster()` method — follow EXACT pattern from `moment_card_overlay.dart` lines 63-98:
    ```dart
    Future<void> _shareSetlistPoster() async {
      try {
        final boundary = _posterKey.currentContext?.findRenderObject()
            as RenderRepaintBoundary?;
        if (boundary == null) return;
        final image = await boundary.toImage(pixelRatio: 3.0);
        final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
        if (byteData == null) return;
        final pngBytes = byteData.buffer.asUint8List();
        // Track share intent as viral signal
        SocketClient.instance.emitSetlistPosterShared();
        await SharePlus.instance.share(
          ShareParams(
            files: [
              XFile.fromData(pngBytes, mimeType: 'image/png', name: 'karamania-setlist.png'),
            ],
          ),
        );
      } catch (e) {
        debugPrint('[FinaleSetlistWidget] Share failed: $e');
      }
    }
    ```
  - [x] 2.3 Render the poster at display size within a `RepaintBoundary` and capture with `pixelRatio: 3.0` — same approach as `MomentCard` in `moment_card_overlay.dart`. Do NOT use off-screen rendering or fixed pixel SizedBox
  - **NOTE**: `finale_setlist_widget.dart` is ALREADY a StatefulWidget (Story 8.2 created it with an AnimationController). Do NOT convert or restructure — just add the `GlobalKey _posterKey` field and `_shareSetlistPoster()` method to the existing State class

- [x] Task 3: Add viral signal tracking — server handler + client emission (AC: #3)
  - [x] 3.1 Add `CARD_SHARED: 'card:shared'` event constant to `apps/server/src/shared/events.ts` — this constant does NOT exist yet (current card events: CARD_DEALT, CARD_ACCEPTED, CARD_DISMISSED, CARD_REDRAW, CARD_GROUP_ACTIVATED)
  - [x] 3.2 Add `card:shared` handler to `apps/server/src/socket-handlers/card-handlers.ts`:
    - Handle `EVENTS.CARD_SHARED`: validate payload has `type` (non-empty string) and `timestamp` (number)
    - Append `card:shared` event to event stream via `appendEvent()` with `{ type: string }` data
    - Accept any `type` value (not just `'moment'` or `'setlist_poster'`) for forward compatibility
    - No acknowledgment needed — fire-and-forget from client perspective
    - Follow pattern from `capture-handlers.ts` lines 68-78 for minimal share event handling — BUT NOTE: `capture:shared` uses `data: Record<string, never>` (empty data), while `card:shared` needs `data: { type: string }` to distinguish share artifact types. Do not copy the empty-data pattern
  - [x] 3.3 Add `emitSetlistPosterShared()` method to `apps/flutter_app/lib/socket/client.dart`:
    ```dart
    void emitSetlistPosterShared() {
      _socket?.emit('card:shared', {
        'type': 'setlist_poster',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    }
    ```
    Follow EXACT pattern of `emitMomentCardShared()` at line 773 — reuses the same `card:shared` event with different `type` field
  - [x] 3.4 Add `card:shared` event type to `SessionEvent` union in `apps/server/src/services/event-stream.ts`: `{ type: 'card:shared'; ts: number; userId: string; data: { type: string } }`

- [x] Task 4: Add UI copy strings (AC: #1)
  - [x] 4.1 Add to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    static const String setlistPosterNoSongs = 'No songs tonight';
    ```
    - **Existing copy to reuse (DO NOT duplicate):** Story 8.2 already added `finaleSetlistTitle = 'THE SETLIST'` (section label in finale sequence), `finaleShareButton = 'Share Setlist'` (share button text), and `finaleShareText()` (text-based share formatter). For the poster:
      - **Primary share button**: Update `finaleShareButton` value from `'Share Setlist'` to `'Share Poster'` (the poster IS the setlist share now)
      - **Secondary text share (long-press)**: Keep `finaleShareText()` for the text-based fallback share
      - **Poster header**: Use `finaleSetlistTitle` for the poster header text — do NOT add a separate `setlistPosterTitle` constant
  - [x] 4.2 Date formatting: `intl` package is NOT in pubspec.yaml — use month name array + manual formatting to avoid adding a dependency. Format as `'MMM dd, yyyy'` (e.g., "Mar 20, 2026")

- [x] Task 5: Wire venue name through to poster and access date (AC: #1)
  - [x] 5.1 **PartyProvider does NOT currently expose `venueName`** — it must be added:
    - Add `String? _venueName` field and `String? get venueName => _venueName` getter to `apps/flutter_app/lib/state/party_provider.dart`
    - Add `setVenueName(String? name)` setter method (called by SocketClient)
    - Clear `_venueName` in `onSessionEnded()` alongside other state resets
  - [x] 5.2 Wire venue name through party creation:
    - The API layer already supports it: `apiService.createSession()` accepts `venueName` parameter, `CreateSessionRequestInput` has `String? venueName` field
    - `SocketClient.createParty()` (line ~806) currently does NOT pass `venueName` — add it as optional parameter
    - When `onPartyCreated` callback fires, extract `venueName` from session data and call `partyProvider.setVenueName(name)`
    - **NOTE**: If the party creation UI does not yet collect venue name, `venueName` will be null — the poster handles this gracefully (omits venue line). Wiring the state now ensures the poster works when venue name collection is added
  - [x] 5.3 For date: use `DateTime.now()` (the poster is generated during the live finale, so current date is the session date). Format manually as `'MMM dd, yyyy'` (e.g., "Mar 20, 2026") — `intl` package is NOT in pubspec.yaml, use month name array + manual formatting to avoid adding a dependency

- [x] Task 6: Tests (AC: #1-5)
  - [x] 6.1 Flutter widget test for `SetlistPosterWidget`:
    - Renders with full setlist data (songs, performers, awards)
    - Renders with empty setlist (shows placeholder)
    - Renders with null performers and awards (omits tags/badges)
    - Renders with long text (truncated, no overflow errors)
    - Maintains 9:16 aspect ratio
    - Applies vibe-specific colors (test with at least 2 vibes)
    - Shows date and venue name when provided
  - [x] 6.2 Flutter widget test for poster share integration in `finale_setlist_widget.dart`:
    - Share button visible and tappable
    - RepaintBoundary key is attached
    - `emitSetlistPosterShared()` called on share tap (mock SocketClient)
  - [x] 6.3 Flutter unit test for `emitSetlistPosterShared()` in socket client:
    - Emits `card:shared` event with `type: 'setlist_poster'`
  - [x] 6.4 Server tests for `card:shared` handler in `apps/server/tests/socket-handlers/card-handlers.test.ts`:
    - `card:shared` with `type: 'setlist_poster'` appends event to event stream
    - `card:shared` with `type: 'moment'` also works (backward compat with moment card)
    - Invalid payload (missing type, empty type) is rejected gracefully
  - [x] 6.5 Flutter test for `PartyProvider.venueName`:
    - `setVenueName` stores correctly
    - `venueName` cleared in `onSessionEnded()`
  - [x] 6.6 **DO NOT test**: Actual image byte output, PNG quality, pixel-level rendering, gradient colors, font sizes, animation timings

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL setlist data is calculated server-side (Story 8.2). This story only renders and shares the data Flutter already has — ZERO new server calculations
- **Flutter is display-only**: `SetlistPosterWidget` is a pure rendering widget. No business logic. Receives data from provider, renders, done
- **Provider pattern**: Widget reads `context.watch<PartyProvider>().finaleSetlist` — no direct socket access from widgets
- **SocketClient is sole mutator**: Share tracking (`emitSetlistPosterShared`) goes through SocketClient — widgets don't access socket directly

### Key Design Decisions

**Why client-side image generation (not server-side)?**
The poster is rendered as a Flutter widget and captured via `RenderRepaintBoundary.toImage()`. This avoids server-side image rendering complexity, uses the device's GPU for high-quality output, and follows the proven `MomentCard` pattern. The widget IS the poster — what the user sees is exactly what gets shared.

**Why 9:16 aspect ratio?**
Instagram Story format per UX spec. "Pre-designed at 9:16 Instagram Story dimensions with the Karamania brand visible but not dominant" (UX spec line 175). This is the most shareable format for mobile — works on Instagram, WhatsApp, iMessage, etc.

**Why reuse `card:shared` event instead of a new event namespace?**
The client already emits `card:shared` for moment card sharing (`emitMomentCardShared()` at client.dart:773). Adding `type: 'setlist_poster'` to the same event distinguishes the share artifact without creating a new event namespace. This story also adds the server-side handler that was missing — the handler accepts any `type` string for forward compatibility with future shareable artifacts.

**Why upgrade finale_setlist_widget.dart instead of creating a new overlay?**
Story 8.2 creates the setlist display as step 3 of the finale sequence. Story 8.3 upgrades that same widget to render a visual poster and add image sharing. The finale sequence flow stays unchanged — only the visual quality and sharing mechanism improve.

### Critical Integration Points

**Dependency on Story 8.2** (MUST be implemented first):
- `finale_setlist_widget.dart` — widget to modify
- `SetlistEntry` model in `lib/models/setlist_entry.dart` with fields: `position`, `title`, `artist`, `performerName`, `awardTitle`, `awardTone`
- `PartyProvider.finaleSetlist` — `List<SetlistEntry>?` field with getter
- `finale:setlist` Socket.io listener in `socket/client.dart`
- All finale sequence orchestration in `finale_overlay.dart`

**Existing patterns to reuse (DO NOT REINVENT):**

| Existing Pattern | Story 8.3 Usage |
|---|---|
| `moment_card.dart` — 9:16 AspectRatio + vibe gradient | **EXACT** layout pattern for poster widget |
| `moment_card_overlay.dart` lines 63-98 — RepaintBoundary + toImage + SharePlus | **EXACT** capture + share pattern |
| `moment_card_overlay.dart` line 78 — `emitMomentCardShared()` | Pattern for `emitSetlistPosterShared()` |
| `socket/client.dart` line 773 — `card:shared` event emission | Reuse same event with `type: 'setlist_poster'` |
| `constants/copy.dart` — all UI strings centralized | Add poster-specific strings |
| `dj_theme.dart` — `PartyVibe` colors (accent, glow, bg, primary) | Apply to poster styling |
| `dj_tokens.dart` — spacing, text colors, surface colors | Fixed tokens for poster layout |
| `vibeConfettiEmojis` map in `dj_theme.dart` | Optional: decorative emojis on poster |
| `DJState.finale` bg in `dj_theme.dart` → `Color(0xFF1A0A2E)` | Poster renders on this bg — gradient must work against it |

### Known Scope Limitations

- **Poster assembly animation**: UX spec line 192 calls for the poster to "assemble on screen piece by piece (songs, names, date, venue)." This story does NOT implement that animation — Story 8.2 already owns the finale step transitions and timing. If a staggered reveal is desired, it should be added as a follow-up enhancement to the finale sequence, not as part of poster generation/sharing
- **Share destination tracking**: UX spec line 289 mentions tracking "share destination — group chat vs. public social." Native mobile share sheets do NOT reliably report which app the user selects. The `card:shared` event tracks the share intent tap only. Destination tracking is infeasible on v1 — do NOT attempt to implement it

### What This Story Does NOT Include (Scope Boundaries)

- NO server-side poster rendering or image generation
- NO new database tables or columns
- NO poster saving to device gallery (only share sheet — user can save from there)
- NO poster customization (theme/layout selection) — fully automatic based on vibe
- NO social media API integration — uses native share sheet only
- NO poster persistence on server — it's a client-generated ephemeral artifact
- NO changes to the finale sequence timing or step order (Story 8.2 owns that)
- NO new Flutter dependencies (uses built-in `RenderRepaintBoundary` + existing `share_plus`)

### File Locations

| File | Purpose |
|---|---|
| `apps/flutter_app/lib/widgets/setlist_poster_widget.dart` | NEW — 9:16 visual poster widget with vibe styling |
| `apps/flutter_app/lib/widgets/finale_setlist_widget.dart` | MODIFY (created by 8.2) — Add RepaintBoundary, poster rendering, image share button |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add `emitSetlistPosterShared()` method |
| `apps/flutter_app/lib/state/party_provider.dart` | MODIFY — Add `venueName` field, getter, setter, clear in onSessionEnded |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add poster UI strings |
| `apps/server/src/shared/events.ts` | MODIFY — Add `CARD_SHARED` constant |
| `apps/server/src/socket-handlers/card-handlers.ts` | MODIFY — Add `card:shared` handler |
| `apps/server/src/services/event-stream.ts` | MODIFY — Add `card:shared` to SessionEvent union |
| `apps/flutter_app/test/widgets/setlist_poster_widget_test.dart` | NEW — Widget tests for poster rendering |
| `apps/flutter_app/test/widgets/finale_setlist_widget_test.dart` | MODIFY (created by 8.2) — Add poster share tests |
| `apps/server/tests/socket-handlers/card-handlers.test.ts` | MODIFY — Add card:shared handler tests |
| `apps/flutter_app/test/state/party_provider_test.dart` | MODIFY — Add venueName tests |

### Testing Strategy

- **SetlistPosterWidget unit tests** — Renders with full data, empty setlist, null optional fields, long text truncation, vibe color application, 9:16 aspect ratio maintained
- **Poster share integration tests** — RepaintBoundary key attached, share button triggers capture flow, `emitSetlistPosterShared()` called (mock SocketClient)
- **Socket client tests** — `emitSetlistPosterShared` emits correct event type and payload
- **Server card:shared handler tests** — Event appended to stream for valid payload, invalid payloads rejected, both `moment` and `setlist_poster` types accepted
- **PartyProvider venueName tests** — Stored correctly, cleared on session end
- **DO NOT test**: PNG byte output, pixel-level rendering, image quality, gradient exact colors, font sizes, capture timing

### Previous Story Intelligence (Stories 8.1-8.2 Learnings)

- **MomentCard pattern is proven**: 9:16 AspectRatio + vibe gradient + RepaintBoundary capture + SharePlus sharing works reliably. Copy the pattern exactly — do not innovate on the capture/share pipeline
- **pixelRatio: 3.0**: Moment card uses this for high-res capture — follow same value
- **XFile.fromData**: Correct API for share_plus file sharing from bytes — do NOT use `XFile(path)` which requires a temp file
- **SharePlus.instance.share(ShareParams(...))**: Correct API — NOT deprecated `Share.share()`
- **Error handling**: Wrap share in try/catch, use `debugPrint` for failures (not throw) — share sheet cancelled by user is not an error
- **Defensive rendering** (UX spec): "Text truncation, dynamic font scaling, overflow handling for long display names. Test on worst device in the room, not the best"
- **Null-safe Dart model fromJson** (7.2 pattern): Use `(json['field'] as String?) ?? ''` — SetlistEntry already follows this per 8.2
- **All UI copy in copy.dart**: No hardcoded strings in widgets
- **Widget keys**: `Key('setlist-poster')`, `Key('setlist-poster-share-btn')` — kebab-case per convention

### Project Structure Notes

- `snake_case` for Dart filenames: `setlist_poster_widget.dart`, `setlist_poster_widget_test.dart`
- `camelCase` for Dart model fields (SetlistEntry already defined by 8.2)
- Widget keys: `Key('setlist-poster')`, `Key('setlist-poster-share-btn')`
- No barrel files — import directly
- `package:karamania/...` for cross-directory imports
- All copy strings in `constants/copy.dart`

### References

- [Source: epics.md — Story 8.3 AC: poster with songs/performers/date/awards (FR36), native share sheet (FR37)]
- [Source: prd.md — FR36 (setlist poster), FR37 (share via share sheet), FR44 (track share intent as viral signal)]
- [Source: ux-design-specification.md line 175 — "Pre-designed at 9:16 Instagram Story dimensions with Karamania brand visible but not dominant"]
- [Source: ux-design-specification.md line 134 — "Defensive design: text truncation, dynamic font scaling, overflow handling for long display names"]
- [Source: ux-design-specification.md line 289 — "Setlist poster designed as concert memorabilia. 9:16 Instagram Story format"]
- [Source: widgets/moment_card.dart — 9:16 AspectRatio + vibe gradient pattern to replicate]
- [Source: widgets/moment_card_overlay.dart lines 63-98 — RepaintBoundary + toImage + SharePlus capture/share pattern]
- [Source: socket/client.dart line 773 — emitMomentCardShared() pattern for viral tracking]
- [Source: 8-2-finale-ceremony-sequence.md — Story 8.2 contract: finale_setlist_widget.dart, SetlistEntry model, finaleSetlist provider field]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation.

### Completion Notes List

- Task 1: Created `SetlistPosterWidget` — 9:16 poster with vibe gradient, dynamic font scaling for large setlists (8+ songs), defensive rendering (maxLines, ellipsis, Flexible wrappers), position numbers, performer tags, award badges, date formatting, venue name support, branding footer
- Task 2: Modified `FinaleSetlistWidget` — replaced text-list display with `SetlistPosterWidget` inside `RepaintBoundary`, added `_shareSetlistPoster()` image capture method (pixelRatio 3.0), kept text share as long-press secondary option, added `venueName` parameter
- Task 3: Added `CARD_SHARED` event constant, `card:shared` server handler with payload validation (type + timestamp), `card:shared` SessionEvent union type, `emitSetlistPosterShared()` client method
- Task 4: Added `setlistPosterNoSongs` copy string, updated `finaleShareButton` from 'Share Setlist' to 'Share Poster'
- Task 5: Added `venueName` field/getter/setter to `PartyProvider`, cleared in `onSessionEnded()`, wired through `SocketClient.createParty()` → `PartyProvider.setVenueName()`, passed through `FinaleOverlay` → `FinaleSetlistWidget` → `SetlistPosterWidget`
- Task 6: 14 widget tests for SetlistPosterWidget, 5 widget tests for FinaleSetlistWidget share integration, 5 server tests for card:shared handler, 5 unit tests for PartyProvider.venueName

### Change Log

- 2026-03-20: Implemented Story 8.3 — Setlist Poster Generation & Sharing (all 6 tasks)
- 2026-03-20: Code review fixes — 8 issues found, all fixed:
  - [H1] Moved hardcoded 'Hold for text share' to Copy.setlistPosterHoldForTextShare
  - [H2] Moved hardcoded 'by ' prefix to Copy.setlistPosterByArtist
  - [H3] Captured DateTime.now() in initState() instead of build() to prevent rebuild churn
  - [M1] Added missing emitSetlistPosterShared() socket client tests
  - [M3] Strengthened vibe color tests to assert actual accent color values
  - [L1] Unified text share date format to match poster format (MMM dd, yyyy)
  - [L2] Added test for long-press text share hint visibility

### File List

**New files:**
- `apps/flutter_app/lib/widgets/setlist_poster_widget.dart`
- `apps/flutter_app/test/widgets/setlist_poster_widget_test.dart`
- `apps/flutter_app/test/widgets/finale_setlist_widget_test.dart`

**Modified files:**
- `apps/flutter_app/lib/widgets/finale_setlist_widget.dart`
- `apps/flutter_app/lib/widgets/finale_overlay.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/test/state/party_provider_test.dart`
- `apps/server/src/shared/events.ts`
- `apps/server/src/socket-handlers/card-handlers.ts`
- `apps/server/src/services/event-stream.ts`
- `apps/server/tests/socket-handlers/card-handlers.test.ts`
- `apps/flutter_app/test/socket/client_test.dart`

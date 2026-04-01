# Story 10.4: Party Screen — Song & Performer Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant during a song,
I want to see what song is playing and who's singing,
so that I know the context and can react appropriately.

## Acceptance Criteria

1. Song title displayed prominently in gold (`DJTokens.gold` / `#FFD700`), fontSize 28, centered
2. Artist name displayed below song title in secondary color (`DJTokens.textSecondary`), fontSize 16
3. Performer name displayed as "🎤 {name} is singing" below artist, fontSize 18, using vibe accent color
4. Countdown timer remains large and centered below performer info
5. Participant count badge shown in secondary text (existing behavior preserved)
6. Top half of screen is no longer empty — song info fills the vertical center
7. Song info display works in both TV-paired mode (uses `detectedSongTitle`/`detectedArtist`) and suggestion-only mode (uses `lastQueuedSongTitle`/`lastQueuedArtist`), with fallback to "Song #{songCount}" if no title available
8. All existing overlays (reactions, soundboard, lightstick, hype, host controls) continue to work unchanged

## Tasks / Subtasks

- [x] Task 1: Create `SongInfoDisplay` widget for centered song/performer info (AC: #1, #2, #3, #6)
  - [x] 1.1 Create new file `apps/flutter_app/lib/widgets/song_info_display.dart`. This is a new widget, NOT a modification of `NowPlayingBar` or `SelectedSongDisplay` (those serve different roles — `NowPlayingBar` is a compact top bar for TV-paired mode, `SelectedSongDisplay` is for suggestion-only "up next" view). `SongInfoDisplay` is the large centered display that fills the main content area during song state
  - [x] 1.2 Widget structure — a `Column(mainAxisAlignment: MainAxisAlignment.center)` containing:
    - Song title: `Text(songTitle, key: Key('song-info-title'), style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: DJTokens.gold), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis)`
    - `SizedBox(height: DJTokens.spaceSm)` (8px gap)
    - Artist: `Text(artist, key: Key('song-info-artist'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w400, color: DJTokens.textSecondary), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis)`
    - `SizedBox(height: DJTokens.spaceMd)` (16px gap)
    - Performer row: `Row(mainAxisAlignment: MainAxisAlignment.center, children: [EmojiText('🎤', fontSize: 18), SizedBox(width: DJTokens.spaceXs), Text('$performerName is singing', key: Key('song-info-performer'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: vibeAccent))])`
  - [x] 1.3 Widget accepts required params:
    ```dart
    class SongInfoDisplay extends StatelessWidget {
      const SongInfoDisplay({
        super.key,
        required this.songTitle,
        required this.artist,
        this.performerName,
        required this.vibeAccent,
      });
      final String songTitle;
      final String artist;
      final String? performerName;
      final Color vibeAccent;
    }
    ```
  - [x] 1.4 If `performerName` is null, hide the performer row entirely (don't show "null is singing")
  - [x] 1.5 Wrap the entire Column in `Padding(padding: EdgeInsets.symmetric(horizontal: DJTokens.spaceLg))` for screen edge padding
  - [x] 1.6 Key the widget: `Key('song-info-display')`

- [x] Task 2: Integrate `SongInfoDisplay` into `party_screen.dart` center content (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 2.1 In `_buildPartyContent()` (around line 690), modify the default `else` block. Currently it shows: music note icon → DJ state label → participant count → performer name → countdown timer. Replace the music note icon + DJ state label + performer name section with `SongInfoDisplay` when `djState == DJState.song`
  - [x] 2.2 Song title resolution logic (add above the widget build):
    ```dart
    String? songTitle;
    String? songArtist;
    if (partyProvider.hasDetectedSong) {
      songTitle = partyProvider.detectedSongTitle;
      songArtist = partyProvider.detectedArtist;
    } else if (partyProvider.hasLastQueuedSong) {
      songTitle = partyProvider.lastQueuedSongTitle;
      songArtist = partyProvider.lastQueuedArtist;
    }
    // Fallback
    songTitle ??= '${Copy.song} #${partyProvider.songCount}';
    songArtist ??= Copy.unknownArtist;
    ```
  - [x] 2.3 Performer name resolution (already exists at ~line 714, reuse same pattern):
    ```dart
    final performerName = partyProvider.participants
        .where((p) => p.userId == partyProvider.currentPerformer)
        .map((p) => p.displayName)
        .firstOrNull;
    ```
  - [x] 2.4 Vibe accent color — access directly from the `PartyVibe` enum property: `partyProvider.vibe.accent` (returns `Color`). The existing party_screen.dart uses a local `displayVibe` variable for this. Example: `final vibeAccent = partyProvider.vibe.accent;`. Do NOT use a DJTheme static method — the accent is a property on the enum itself (defined in `dj_theme.dart` line 44)
  - [x] 2.5 Conditional rendering: Show `SongInfoDisplay` ONLY during `DJState.song`. For other DJ states, keep the existing music note icon + DJ state label pattern (those states don't have song info)
  - [x] 2.6 Keep participant count badge below song info (existing code, ~line 706). Keep countdown timer below participant count (existing code, ~lines 724-733). The vertical order becomes: SongInfoDisplay → participant count → countdown timer
  - [x] 2.7 For non-song DJ states (lobby, songSelection, interlude, etc.), preserve the existing display exactly — music note icon + `DJStateLabel` + performer + timer. Only the `DJState.song` state gets the new `SongInfoDisplay`
  - [x] 2.8 Import `SongInfoDisplay` in party_screen.dart: `import 'package:karamania/widgets/song_info_display.dart';`

- [x] Task 3: Add copy constants (AC: #3, #7)
  - [x] 3.1 Add to `Copy` class in `constants/copy.dart`:
    ```dart
    static const String isSinging = 'is singing';
    static const String song = 'Song';
    ```
  - [x] 3.2 Verify `unknownArtist` already exists (it does: `static const String unknownArtist = 'Unknown Artist';` at line ~270). Do NOT duplicate it

- [x] Task 4: Update tests (AC: all)
  - [x] 4.1 **New test file** `test/widgets/song_info_display_test.dart`:
    - Test: renders song title with key `'song-info-title'`
    - Test: renders artist with key `'song-info-artist'`
    - Test: renders performer name with key `'song-info-performer'` when provided
    - Test: hides performer row when `performerName` is null
    - Test: song title and artist text content matches input
  - [x] 4.2 **Update existing** `test/screens/party_screen_test.dart`:
    - Add test: during `DJState.song` with detected song, shows `SongInfoDisplay` with correct title/artist (find by key `'song-info-display'`)
    - Add test: during `DJState.song` without detected song but with queued song, shows queued song info
    - Add test: during `DJState.song` with no song data, shows fallback "Song #N"
    - Add test: during `DJState.song`, performer name resolved from participants list
    - Add test: during `DJState.lobby` (non-song state), does NOT show `SongInfoDisplay` (shows DJ state label instead)
    - **Pattern**: Use `provider.onDjStateUpdate(state: DJState.song, currentPerformer: 'user-1', songCount: 3)` then `provider.setDetectedSong(songTitle: 'Bohemian Rhapsody', artist: 'Queen')` — method is `setDetectedSong` with named param `songTitle:` (not `title:`), confirmed at party_provider.dart line 949
    - Use `pump(const Duration(milliseconds: 100))` not `pumpAndSettle()` (party screen has pulse animations that prevent settle)
  - [x] 4.3 **DO NOT test**: font sizes, colors, spacing values, text alignment, overflow behavior

## Dev Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `apps/flutter_app/lib/widgets/song_info_display.dart` | **NEW** — Centered song title (gold), artist, performer display |
| `apps/flutter_app/lib/screens/party_screen.dart` | Modify `_buildPartyContent()` to show `SongInfoDisplay` during `DJState.song` |
| `apps/flutter_app/lib/constants/copy.dart` | Add `isSinging`, `song` constants |
| `apps/flutter_app/test/widgets/song_info_display_test.dart` | **NEW** — Unit tests for `SongInfoDisplay` widget |
| `apps/flutter_app/test/screens/party_screen_test.dart` | Add song info integration tests |

### Files to NOT Modify

- `now_playing_bar.dart` — Keep as-is. This is a compact top bar for TV-paired mode. `SongInfoDisplay` is a separate centered display
- `selected_song_display.dart` — Keep as-is. This shows "Up Next" for suggestion-only mode
- `reaction_bar.dart` — Reaction emoji fontSize is already 32 (larger than epic's "28" mention, which appears to be a stale requirement). Keep 32
- `soundboard_bar.dart` — Soundboard emoji fontSize is already 24. No change needed
- No server changes — pure Flutter UI
- No provider changes — all data already exists in `PartyProvider`

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — pure UI rendering of server state
- **Providers are read-only from widgets** — `context.watch<PartyProvider>()` only
- **Use `DJTokens` for ALL visual constants** — `DJTokens.gold` for song title, `DJTokens.textSecondary` for artist, spacing tokens for gaps
- **All copy in `constants/copy.dart`** — no hardcoded strings
- **Import with `package:karamania/...`** for cross-directory imports
- **Widget keys use `Key('kebab-case-descriptor')`**

### Song Data Sources (VERIFIED from PartyProvider)

Two paths for song metadata, already implemented:

**TV-paired mode** (NowPlayingBar also reads these):
- `partyProvider.detectedSongTitle` — actual detected song name
- `partyProvider.detectedArtist` — actual detected artist
- `partyProvider.hasDetectedSong` — boolean check

**Suggestion-only mode** (SelectedSongDisplay also reads these):
- `partyProvider.lastQueuedSongTitle` — last song queued by host/participant
- `partyProvider.lastQueuedArtist` — last queued artist
- `partyProvider.hasLastQueuedSong` — boolean check

**Fallback** (when neither source has data):
- `"Song #${partyProvider.songCount}"` with `Copy.unknownArtist`

### Performer Name Resolution (VERIFIED pattern from party_screen.dart ~line 714)

```dart
final performerName = partyProvider.participants
    .where((p) => p.userId == partyProvider.currentPerformer)
    .map((p) => p.displayName)
    .firstOrNull;
```

`currentPerformer` is a user ID (String?). Lookup via `participants` list (List<ParticipantInfo>). Returns `null` if no performer set (e.g., between songs).

### Vibe Accent Color Access

Access directly via `partyProvider.vibe.accent` (property on `PartyVibe` enum, defined in `dj_theme.dart` line 44). The existing party_screen.dart stores it as `final displayVibe = partyProvider.vibe;` then uses `displayVibe.accent`. Accent colors per vibe:
- general: `#FFD700` (gold)
- kpop: `#FF0080` (hot pink)
- rock: `#FF4444` (red)
- ballad: `#FF9966` (warm orange)
- edm: `#00FFC8` (cyan)

### Existing NowPlayingBar vs New SongInfoDisplay — Why Both Exist

| Widget | Purpose | Position | When Visible |
|--------|---------|----------|--------------|
| `NowPlayingBar` | Compact "Now Playing" strip with thumbnail | Top of screen | TV-paired + song detected |
| `SelectedSongDisplay` | "Up Next" with host action | Top of screen | Suggestion-only mode |
| **`SongInfoDisplay`** (NEW) | **Large centered song + performer display** | **Center of screen** | **During `DJState.song` only** |

`NowPlayingBar` and `SongInfoDisplay` can coexist — one is a compact top indicator, the other is the main content. However, when `SongInfoDisplay` shows the same info prominently in the center, `NowPlayingBar` becomes redundant. **For this story, keep `NowPlayingBar` as-is** — removing it is out of scope and can be a follow-up decision.

### Widget Keys (New)

| Key | Widget | Notes |
|-----|--------|-------|
| `'song-info-display'` | `SongInfoDisplay` wrapper | **NEW** — main centered song display |
| `'song-info-title'` | `Text` (song title) | **NEW** — gold, 28px |
| `'song-info-artist'` | `Text` (artist name) | **NEW** — secondary, 16px |
| `'song-info-performer'` | `Text` ("{name} is singing") | **NEW** — vibe accent, 18px |

### Previous Story Intelligence (10.3)

Key learnings from Story 10.3 implementation:
- **Container wrapping DJTapButton** pattern confirmed working for styled buttons
- **`DJTokens.gold`** is the correct token for gold color (`#FFD700`), distinct from `DJTokens.actionPrimary` (purple `#6C63FF`)
- **`pump(Duration)` not `pumpAndSettle()`** when testing screens with animations (party screen has pulse animations from skeleton loader)
- **`EmojiText` widget** exists for rendering emoji with specific fontSize — use it for the 🎤 microphone in performer row
- **Import `EmojiText`**: `package:karamania/widgets/emoji_text.dart`
- **Track data verified**: `songTitle` key (NOT `title`), `artist` key consistent across imported and matched tracks
- **`SingleTickerProviderStateMixin`** already added to `_PartyScreenState` (from skeleton loader animation) — no need to add again

### DJTokens Reference (Relevant to This Story)

```dart
// Colors
static const Color gold = Color(0xFFFFD700);           // Song title
static const Color textPrimary = Color(0xFFF0F0F0);    // Primary text
static const Color textSecondary = Color(0xFF9494B0);   // Artist name
static const Color bgColor = Color(0xFF0A0A0F);         // Background

// Spacing
static const double spaceXs = 4;   // Icon-to-text gaps
static const double spaceSm = 8;   // Title-to-artist gap
static const double spaceMd = 16;  // Artist-to-performer gap
static const double spaceLg = 24;  // Widget horizontal padding
```

### Existing Test Patterns (party_screen_test.dart)

**Provider setup for song state**:
```dart
final provider = _createTestProvider();
provider.onPartyCreated('session-1', 'ABCD');
provider.onParticipantsChanged([
  ParticipantInfo(userId: 'host', displayName: 'Host'),
  ParticipantInfo(userId: 'singer-1', displayName: 'Alice'),
]);
provider.onDjStateUpdate(state: DJState.song, currentPerformer: 'singer-1', songCount: 3);
```

**Song detection** (VERIFIED method name: `setDetectedSong` at party_provider.dart line 949):
```dart
provider.setDetectedSong(songTitle: 'Bohemian Rhapsody', artist: 'Queen');
```

**Rendering**:
```dart
await tester.pumpWidget(_wrapWithProviders(const PartyScreen(), partyProvider: provider));
await tester.pump(const Duration(milliseconds: 100));
expect(find.byKey(const Key('song-info-display')), findsOneWidget);
expect(find.text('Bohemian Rhapsody'), findsOneWidget);
```

### Definition of Done (Epic 10 Global)

- [ ] Implementation matches wireframe layout (song info centered, gold title, secondary artist, performer with mic emoji)
- [ ] Screenshot test re-run captures new design (`run_screenshots.sh`)
- [ ] Existing widget tests pass (update keys/finders if changed)
- [ ] Tested with all 5 vibes — verify performer name uses vibe accent color
- [ ] No text overflow/ellipsis on standard phone sizes (maxLines + overflow.ellipsis on title/artist)
- [ ] Existing overlays (reactions, soundboard, lightstick, host controls) unaffected

### Project Structure Notes

- New widget file `song_info_display.dart` follows existing widget organization in `lib/widgets/`
- No new directories, providers, or server changes
- Aligned with `apps/flutter_app/lib/` structure: screens, widgets, state, constants

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Song State Screen]
- [Source: _bmad-output/planning-artifacts/architecture.md#Flutter Boundaries]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/implementation-artifacts/10-3-lobby-guest-waiting-and-playlist.md#Previous Story Intelligence]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward following story specs.

### Completion Notes List

- Created `SongInfoDisplay` StatelessWidget with gold title (28px), secondary artist (16px), vibe-accented performer row with 🎤 emoji. Performer row hidden when `performerName` is null.
- Integrated into `party_screen.dart` `_buildPartyContent()` as a new `else if (djState == DJState.song)` branch. Used `Builder` widget to scope the song/artist resolution logic inline. Song resolution priority: detected → queued → fallback "Song #N".
- Added `Copy.isSinging` and `Copy.song` constants to `copy.dart`.
- Updated 2 existing tests in `party_screen_test.dart` that assumed old behavior during `DJState.song`: (1) `shows correct state label for each DJState` — now skips `DJState.song` since it shows `SongInfoDisplay` instead of `dj-state-label`; (2) `shows performer name when available` — updated to use `song-info-performer` key.
- Added 5 new integration tests to `party_screen_test.dart` and 6 new unit tests in `song_info_display_test.dart`. All 44 party_screen tests and 6 widget tests pass. Pre-existing failure in `join_screen_test.dart` is unrelated to this story.

**Code Review Fixes (2026-04-01, claude-opus-4-6):**
- Fixed performer row overflow: wrapped Text in `Flexible` with `maxLines: 1` + `TextOverflow.ellipsis` to prevent RenderFlex overflow on narrow screens
- Moved `Key('song-info-display')` from inner Padding to widget constructor call site (proper Flutter key placement)
- Added empty string guard for `performerName` (hides row for both null and empty)
- Extracted `Builder` to private `_buildSongInfoContent()` method for clarity
- Strengthened test assertions from `textContaining('Alice')` to `text('Alice ${Copy.isSinging}')`
- Added Xcode artifact patterns to `macos/.gitignore`

### File List

- `apps/flutter_app/lib/widgets/song_info_display.dart` (NEW)
- `apps/flutter_app/lib/screens/party_screen.dart` (modified)
- `apps/flutter_app/lib/constants/copy.dart` (modified)
- `apps/flutter_app/test/widgets/song_info_display_test.dart` (NEW)
- `apps/flutter_app/test/screens/party_screen_test.dart` (modified)
- `apps/flutter_app/macos/.gitignore` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/10-4-party-screen-song-and-performer.md` (modified)

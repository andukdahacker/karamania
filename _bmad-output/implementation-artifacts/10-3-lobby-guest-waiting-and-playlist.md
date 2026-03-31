# Story 10.3: Lobby Guest View — Waiting State & Playlist Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest waiting in the lobby,
I want to know I'm waiting for the host and see my imported songs listed,
so that I feel informed and in control of my playlist contribution.

## Acceptance Criteria

1. "Waiting for host to start..." message displayed with subtle pulse animation and hourglass icon
2. Message appears only for non-host participants (when `isHost == false`)
3. Imported playlist shows songs as a scrollable list with:
   - Song title (bold) + artist name (secondary) per row
   - X button per song to remove it from the import
   - Song count indicator (e.g., "3 songs imported") above the list
4. "+ Add song manually" link below the song list (opens manual song entry)
5. Playlist URL input uses fontSize 14 (no overflow on long URLs)
6. Import button styled with brand purple (`DJTokens.actionPrimary` / `#6C63FF`)

## Tasks / Subtasks

- [x] Task 1: Add "Waiting for host to start..." message with pulse animation (AC: #1, #2)
  - [x] 1.1 In `lobby_screen.dart`, add a guest-only waiting indicator below the participant count section. Wrap with `if (!isHost)` conditional. Place it after the `participantCount` + `waitingForGuests` text block (around line 278), replacing the static "Waiting for guests..." text for guests with the new animated version
  - [x] 1.2 Create the waiting widget as a `Row(mainAxisAlignment: MainAxisAlignment.center)` with:
    - Hourglass icon: `Icon(Icons.hourglass_bottom, color: DJTokens.textSecondary, size: 20)`
    - `SizedBox(width: DJTokens.spaceSm)`
    - `Text(Copy.waitingForHost, style: bodyMedium?.copyWith(color: DJTokens.textSecondary))`
  - [x] 1.3 Wrap the Row in an `AnimatedBuilder` widget that fades opacity between 0.4 and 1.0 over 1.5 seconds using `AnimationController` + `repeat(reverse: true)`. Since LobbyScreen is already a StatefulWidget with timer state, add animation controller to `_LobbyScreenState`
  - [x] 1.4 Key the waiting indicator: `Key('waiting-for-host-indicator')`
  - [x] 1.5 **Keep** the existing "Waiting for guests..." text for the HOST view (when `isHost == true && participantCount < 3`). The new animated waiting message is guest-only
  - [x] 1.6 Add `with SingleTickerProviderStateMixin` to `_LobbyScreenState` (required for AnimationController — use Single variant since only one controller). Dispose the controller in `dispose()`
  - [x] 1.7 **Reduced motion support:** Check `context.watch<AccessibilityProvider>().reducedMotion`. If true, show the waiting indicator statically (opacity 1.0, no animation — do NOT create or start the AnimationController). Follow the existing pattern from `lightstick_mode.dart` where reduced motion replaces animated widget with a static equivalent

- [x] Task 2: Refactor PlaylistImportCard to show song list with remove buttons (AC: #3)
  - [x] 2.1 In `playlist_import_card.dart`, replace the `_buildResults` method. Currently it shows a single summary text (`"X tracks imported, Y matched..."`). Replace with a `Column` containing:
    - Song count header: `Text('${provider.importedTracks.length} songs imported', style: titleSmall?.copyWith(color: DJTokens.textPrimary))` with key `Key('playlist-song-count')`
    - A `ListView.builder` (wrapped in `SizedBox(height: min(tracks.length * 56.0, 224.0))` to cap at ~4 visible rows) showing each track
  - [x] 2.2 Each track row is a `ListTile`-style `Row` with:
    - `Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(track['songTitle'] ?? 'Unknown', style: bodyMedium?.copyWith(fontWeight: FontWeight.bold, color: DJTokens.textPrimary)), Text(track['artist'] ?? 'Unknown Artist', style: bodySmall?.copyWith(color: DJTokens.textSecondary))]))`
    - Remove button: `IconButton(key: Key('remove-track-$index'), icon: Icon(Icons.close, size: 18, color: DJTokens.textSecondary), onPressed: () => _onRemoveTrack(index))`
  - [x] 2.3 Add `_onRemoveTrack(int index)` method that calls `context.read<PartyProvider>().removeImportedTrack(index)`
  - [x] 2.4 Keep the existing unmatched count info as secondary text below the list: `Text('${provider.matchedTracks.length} matched to catalog', style: bodySmall?.copyWith(color: DJTokens.textSecondary))`

- [x] Task 3: Add `removeImportedTrack` to PartyProvider (AC: #3)
  - [x] 3.1 In `party_provider.dart`, add method:
    ```dart
    void removeImportedTrack(int index) {
      if (index >= 0 && index < _importedTracks.length) {
        final removed = _importedTracks[index];
        _importedTracks = List.from(_importedTracks)..removeAt(index);
        // Recalculate matched: remove from _matchedTracks if songTitle+artist matches
        _matchedTracks = List.from(_matchedTracks)..removeWhere(
          (m) => m['songTitle'] == removed['songTitle'] && m['artist'] == removed['artist'],
        );
        _unmatchedCount = _importedTracks.length - _matchedTracks.length;
        if (_importedTracks.isEmpty) {
          _playlistImportState = LoadingState.idle;
        }
        notifyListeners();
      }
    }
    ```
  - [x] 3.2 **Track data shape**: `_importedTracks` maps have keys `songTitle`, `artist`, `youtubeVideoId` (from `playlistTrackSchema`). `_matchedTracks` maps have keys `id`, `songTitle`, `artist`, `youtubeVideoId`, `channel`, `isClassic`, `createdAt`, `updatedAt` (from `catalogTrackSchema`). They are separate lists with different shapes — there is NO `matched` boolean on track maps. Match by `songTitle` + `artist` pair
  - [x] 3.3 If `_importedTracks` becomes empty after removal, reset import state to `idle` so user can import again (handled in 3.1)

- [x] Task 4: Add "+ Add song manually" link (AC: #4)
  - [x] 4.1 Below the song list in `_buildResults`, add:
    ```dart
    GestureDetector(
      key: const Key('add-song-manually'),
      onTap: _onAddManualSong,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceSm),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.add, size: 18, color: DJTokens.actionPrimary),
            SizedBox(width: DJTokens.spaceXs),
            Text(Copy.addSongManually, style: bodySmall?.copyWith(color: DJTokens.actionPrimary)),
          ],
        ),
      ),
    )
    ```
  - [x] 4.2 `_onAddManualSong` shows an inline text field (not a dialog — per UX spec "inline, no modal, no navigation away"). Add a `_showManualEntry` bool state. When true, show a `TextField(key: Key('manual-song-field'))` + submit button below the list. On submit, add track to `_importedTracks` via a new `PartyProvider.addManualTrack(String title, String artist)` method
  - [x] 4.3 Add `addManualTrack` to PartyProvider. **Manual tracks are local-only** — they are NOT sent to the server's song pool. They serve as the user's personal reference for songs they want to suggest. No API call needed:
    ```dart
    void addManualTrack(String songTitle, String artist) {
      _importedTracks = List.from(_importedTracks)..add({
        'songTitle': songTitle,
        'artist': artist,
        'manual': true,
      });
      // Manual tracks don't go through catalog matching — not added to _matchedTracks
      _unmatchedCount = _importedTracks.length - _matchedTracks.length;
      if (_playlistImportState != LoadingState.success) {
        _playlistImportState = LoadingState.success;
      }
      notifyListeners();
    }
    ```
  - [x] 4.4 Manual entry should have two fields: song title (required) and artist (optional). Use a compact inline layout, not full dialog

- [x] Task 5: Fix playlist URL input fontSize (AC: #5)
  - [x] 5.1 In `playlist_import_card.dart`, the TextField style currently uses `TextStyle(color: DJTokens.textPrimary)` (line 113). Add explicit `fontSize: 14`:
    ```dart
    style: TextStyle(color: DJTokens.textPrimary, fontSize: 14),
    ```

- [x] Task 6: Restyle Import button with brand purple (AC: #6)
  - [x] 6.1 Replace the current `ElevatedButton` (line 153-158) with a styled Container inside DJTapButton:
    ```dart
    DJTapButton(
      key: const Key('playlist-import-btn'),
      tier: TapTier.social,
      onTap: _detectedPlatform != null ? _onImport : () {},
      child: Opacity(
        opacity: _detectedPlatform != null ? 1.0 : 0.5,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
          decoration: BoxDecoration(
            color: DJTokens.actionPrimary,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            Copy.playlistImportButton,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: DJTokens.textPrimary,
            ),
          ),
        ),
      ),
    )
    ```
  - [x] 6.2 Also restyle the retry button in `_buildError()` with the same purple pattern
  - [x] 6.3 Import `DJTapButton` and `TapTier` in `playlist_import_card.dart` — add:
    ```dart
    import 'package:karamania/constants/tap_tiers.dart';
    import 'package:karamania/widgets/dj_tap_button.dart';
    ```

- [x] Task 7: Add copy constants (AC: all)
  - [x] 7.1 Add to `Copy` class in `constants/copy.dart`:
    ```dart
    static const String waitingForHost = 'Waiting for host to start...';
    static const String addSongManually = 'Add song manually';
    static const String songsImported = 'songs imported';
    static const String matchedToCatalog = 'matched to catalog';
    static const String manualSongTitle = 'Song title';
    static const String manualSongArtist = 'Artist (optional)';
    static const String addSong = 'Add';
    ```
  - [x] 7.2 Verify no duplicate constants — `waitingForGuests` already exists and is different from `waitingForHost`

- [x] Task 8: Update tests (AC: all)
  - [x] 8.1 **Lobby screen tests** (`test/screens/lobby_screen_test.dart`):
    - Add test: guest sees "Waiting for host to start..." with pulse animation indicator. Use `find.byKey(Key('waiting-for-host-indicator'))`. Create guest provider via `PartyProvider()..onPartyJoined(...)` (not `onPartyCreated` which sets `isHost=true`)
    - Add test: host does NOT see the waiting-for-host indicator
    - Add test: existing "Waiting for guests..." still shows for host with < 3 participants (regression)
  - [x] 8.2 **Playlist import card tests** — file ALREADY EXISTS at `test/widgets/playlist_import_card_test.dart` with `MockApiService` and `_wrapWithProviders` helper. **Add** new tests to the existing file:
    - Test: after successful import, shows song count header (`find.byKey(Key('playlist-song-count'))`)
    - Test: after successful import, shows individual track titles (`'songTitle'` key) and artists
    - Test: tapping remove button on a track removes it from the list
    - Test: "+ Add song manually" link is visible after import success
    - Test: import button uses DJTapButton (verify key `playlist-import-btn` exists and is DJTapButton type)
    - Test: retry button works after error state
    - Use existing `MockApiService.mockResult` pattern with `PlaylistImportResult(tracks: [{'songTitle': 'Hello', 'artist': 'Adele'}], matched: [...], unmatchedCount: 0, totalFetched: 1)`
  - [x] 8.3 **PartyProvider tests** — add to existing `test/state/party_provider_playlist_test.dart` (NOT `party_provider_test.dart`!):
    - Test: `removeImportedTrack` removes track at index and notifies listeners
    - Test: `removeImportedTrack` with invalid index does nothing
    - Test: removing all tracks resets to idle state
    - Test: `addManualTrack` adds track and notifies listeners
  - [x] 8.4 **DO NOT test:** pulse animation timing, opacity values, font sizes, colors, spacing pixels
  - [x] 8.5 **Lobby screen test wrapper**: The existing `_wrapWithProviders` in `lobby_screen_test.dart` does NOT provide `ApiService` or `AuthProvider`. Since `PlaylistImportCard` is inside `LobbyScreen` and reads these via `context.read<>()`, you must add mock providers to the wrapper OR the new guest tests will crash. Add `Provider<ApiService>.value(value: MockApiService())` and `ChangeNotifierProvider<AuthProvider>.value(value: AuthProvider())` to the `MultiProvider`. You can import the existing `MockApiService` from the playlist test file or create a minimal local mock
  - [x] 8.6 Run full test suite: `flutter test test/screens/lobby_screen_test.dart && flutter test test/widgets/playlist_import_card_test.dart && flutter test test/state/party_provider_playlist_test.dart`

- [x] Task 9: Dispose animation controller (AC: #1)
  - [x] 9.1 In `_LobbyScreenState.dispose()`, dispose the animation controller before `super.dispose()` (after existing `_previewTimer?.cancel()`)

## Dev Notes

### Key Files to Modify

| File | Change |
|------|--------|
| `apps/flutter_app/lib/screens/lobby_screen.dart` | Add guest waiting indicator with pulse animation, add SingleTickerProviderStateMixin |
| `apps/flutter_app/lib/widgets/playlist_import_card.dart` | Refactor results to song list with remove buttons, add manual song entry, fix URL font size, restyle import button |
| `apps/flutter_app/lib/state/party_provider.dart` | Add `removeImportedTrack()` and `addManualTrack()` methods |
| `apps/flutter_app/lib/constants/copy.dart` | Add `waitingForHost`, `addSongManually`, and other new constants |
| `apps/flutter_app/test/screens/lobby_screen_test.dart` | Add guest waiting indicator tests, update `_wrapWithProviders` to include `ApiService` + `AuthProvider` |
| `apps/flutter_app/test/widgets/playlist_import_card_test.dart` | **EXISTS** — add song list, removal, manual entry, and restyled button tests |
| `apps/flutter_app/test/state/party_provider_playlist_test.dart` | **EXISTS** — add `removeImportedTrack` and `addManualTrack` tests |

### Files to NOT Create

- No new screen files — all changes are within existing lobby screen and playlist widget
- No server changes — this is pure Flutter UI + state
- No new providers — extend existing `PartyProvider`

### Critical Architecture Rules

- **DO NOT add game logic to Flutter** — this is pure UI + local state management
- **Providers are read-only from widgets** — only `SocketClient` calls mutation methods. BUT `removeImportedTrack` and `addManualTrack` are local-only operations (no server round-trip), so calling them from widgets via `context.read<PartyProvider>()` is acceptable (same pattern as `resetPlaylistImport()` at line 195 of playlist_import_card.dart)
- **Use `DJTokens` spacing** — never hardcode padding/margin values
- **All copy in `constants/copy.dart`** — no hardcoded strings in widgets
- **Import with `package:karamania/...`** for cross-directory imports
- **Widget keys use `Key('kebab-case-descriptor')`** naming convention
- **`async/await` everywhere** — no `.then()` chains

### Import Button Pattern — Brand Purple (NOT Gold)

The import button uses `DJTokens.actionPrimary` (#6C63FF, purple) — NOT gold. Gold is reserved for primary CTAs (Create Party, Join Party, Start Party). Import is a secondary action. Follow the same Container-inside-DJTapButton pattern from Stories 10.1/10.2, but with purple background and light text.

### Pulse Animation Pattern

Use `AnimationController` + `AnimatedBuilder` for the waiting indicator pulse. The pattern:

```dart
late final AnimationController _pulseController;

@override
void initState() {
  super.initState();
  _pulseController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..repeat(reverse: true);
}

// In build:
AnimatedBuilder(
  animation: _pulseController,
  builder: (context, child) => Opacity(
    opacity: 0.4 + (_pulseController.value * 0.6),
    child: child,
  ),
  child: Row(/* hourglass + text */),
)
```

**Requires `SingleTickerProviderStateMixin`** on the State class (single controller — use `TickerProviderStateMixin` only when multiple controllers needed). LobbyScreen is already `StatefulWidget` with timer-based state for vibe preview, so adding the mixin is straightforward.

**Reduced motion:** When `context.watch<AccessibilityProvider>().reducedMotion` is true, skip creating the AnimationController and render the Row statically at full opacity. Follow the pattern from `lightstick_mode.dart` (static container replaces animated one).

### Imported Track Data Shape (VERIFIED)

Track maps come from the server via Zod transform (snake_case → camelCase at boundary).

**`_importedTracks`** (from `playlistTrackSchema`):
```dart
{'songTitle': 'Hello', 'artist': 'Adele', 'youtubeVideoId': 'abc123'}
```

**`_matchedTracks`** (from `catalogTrackSchema` — different shape, more fields):
```dart
{'id': 'uuid', 'songTitle': 'Hello', 'artist': 'Adele', 'youtubeVideoId': 'abc123', 'channel': 'AdeleVEVO', 'isClassic': false, 'createdAt': '...', 'updatedAt': '...'}
```

**Key field for display: `songTitle`** (NOT `title`). The `artist` key is the same in both.

**Manual tracks** added locally use the same shape as imported tracks but include a `'manual': true` flag:
```dart
{'songTitle': 'My Song', 'artist': 'Some Artist', 'manual': true}
```

### Current Playlist Import Card States

| State | Current Behavior | Target Behavior |
|-------|-----------------|-----------------|
| `idle` | URL input + Import button | URL input + purple Import button (fontSize 14) |
| `loading` | Spinner + "Importing..." | No change |
| `success` | Single summary text line | Song list with titles, artists, remove buttons, count header, "+ Add manually" |
| `error` | Error text + Retry button | Error text + purple Retry button |
| `error_private` | Spotify guide | No change |

### Widget Keys

| Key | Widget | Notes |
|-----|--------|-------|
| `'waiting-for-host-indicator'` | Row (hourglass + text) | **NEW** — guest-only pulse animation |
| `'playlist-song-count'` | Text (count header) | **NEW** — "X songs imported" |
| `'remove-track-$index'` | IconButton (per track) | **NEW** — remove individual track |
| `'add-song-manually'` | GestureDetector | **NEW** — opens manual entry |
| `'manual-song-field'` | TextField | **NEW** — manual song title input |
| `'playlist-import-btn'` | DJTapButton (was ElevatedButton) | **CHANGED** — now uses DJTapButton |
| `'playlist-import-card'` | PlaylistImportCard | Unchanged |
| `'playlist-url-field'` | TextField | Unchanged (font size updated) |
| `'playlist-import-results'` | Column (was Text) | **CHANGED** — now wraps song list |
| `'playlist-import-error'` | Text | Unchanged |
| `'playlist-retry-btn'` | DJTapButton (was ElevatedButton) | **CHANGED** |

### Previous Story Intelligence (10.2)

Key learnings from Story 10.2:
- **Container wrapping DJTapButton** works fine for styled buttons — key stays on DJTapButton
- **Gold color is `DJTokens.gold`** for primary CTAs, `DJTokens.actionPrimary` for secondary actions
- **Dark text on gold = `DJTokens.bgColor`**, light text on purple = `DJTokens.textPrimary`
- **`pumpAndSettle` vs `pump(duration)`**: If animations are present (like the new pulse), use explicit `pump(duration)` in tests, NOT `pumpAndSettle` (Lottie/infinite animations cause timeout)
- **setState-during-build**: Be careful with listener registration order in `initState` — set initial values before adding listeners

### DJTokens Reference

```dart
// Colors relevant to this story
static const Color actionPrimary = Color(0xFF6C63FF); // Purple — import button
static const Color gold = Color(0xFFFFD700);           // Gold — NOT for import button
static const Color bgColor = Color(0xFF0A0A0F);
static const Color surfaceColor = Color(0xFF1A1A2E);
static const Color surfaceElevated = Color(0xFF252542);
static const Color textPrimary = Color(0xFFF0F0F0);
static const Color textSecondary = Color(0xFF9494B0);
static const Color actionConfirm = Color(0xFF4ADE80);
static const Color actionDanger = Color(0xFFEF4444);

// Spacing
static const double spaceXs = 4;
static const double spaceSm = 8;
static const double spaceMd = 16;
static const double spaceLg = 24;
static const double spaceXl = 32;
```

### Existing Test Patterns (lobby_screen_test.dart)

The test file uses `_wrapWithProviders` helper that provides `PartyProvider`, `AccessibilityProvider`, and `SocketClient`. Guest vs host is controlled by:
- **Host**: `PartyProvider()..onPartyCreated('test-session', 'ABCD')` (sets `isHost = true`)
- **Guest**: `PartyProvider()..onPartyJoined(sessionId: 'session-1', partyCode: 'ROCK', vibe: PartyVibe.rock)` (sets `isHost = false`)

**Lobby screen test wrapper must include `ApiService` and `AuthProvider`** since `PlaylistImportCard` (rendered inside `LobbyScreen`) reads them via `context.read<>()`. The existing playlist_import_card_test.dart already has a `MockApiService` class that can be reused or duplicated locally.

**Existing `MockApiService` pattern** (from `playlist_import_card_test.dart`):
```dart
class MockApiService extends ApiService {
  MockApiService() : super(baseUrl: 'http://localhost:3000');
  PlaylistImportResult? mockResult;
  ApiException? mockError;
  @override
  Future<PlaylistImportResult> importPlaylist(String url, {String? sessionId, String? token}) async {
    if (mockError != null) throw mockError!;
    return mockResult!;
  }
}
```

### Definition of Done (Epic 10 Global)

- [x] Implementation matches wireframe layout
- [x] Screenshot test re-run captures new design (`run_screenshots.sh`)
- [x] Existing widget tests pass (update keys/finders if changed)
- [x] Tested with all 5 vibes — lobby uses vibe background, verify text readability
- [x] No text overflow/ellipsis on standard phone sizes
- [x] Pulse animation respects `AccessibilityProvider.reduceMotion` — if reduce motion is on, show static indicator without pulse

### Project Structure Notes

- All changes are Flutter UI + state only — no server, API, or DB modifications
- Aligned with `apps/flutter_app/lib/` structure: screens, widgets, state, constants
- No new directories or modules needed
- PlaylistImportCard refactoring stays within the existing widget file

### Testing Boundaries

Per project rules:
- **DO test:** waiting indicator visibility (guest vs host), track list rendering, track removal, manual song add, button key existence, import state transitions
- **DO NOT test:** pulse animation opacity values, font sizes, colors, spacing, icon sizes, border radius
- **Accessibility:** Verify `Semantics(liveRegion: true)` on the waiting indicator (already exists on participant count — extend to waiting message)
- Use `pump(const Duration(milliseconds: 100))` instead of `pumpAndSettle()` when testing lobby screen with pulse animation active

### References

- [Source: _bmad-output/implementation-artifacts/epic-ux-redesign.md#Story 3]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Playlist Import Flow]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#LobbyScreen Component]
- [Source: _bmad-output/project-context.md#Flutter Boundaries]
- [Source: _bmad-output/implementation-artifacts/10-2-join-screen-layout-and-input-sizing.md#Previous Story Intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed `DJTokens.actionPrimary` missing — added as static color constant (#6C63FF)
- Fixed RenderFlex overflow in waiting indicator Row by using `mainAxisSize: MainAxisSize.min` + `Flexible` wrapper
- Added `AccessibilityProvider` to playlist_import_card_test wrapper (required by DJTapButton)
- Updated existing tests that referenced `ElevatedButton` to account for DJTapButton change

### Completion Notes List

- Task 1: Added guest-only "Waiting for host to start..." indicator with pulse animation (AnimatedBuilder + AnimationController). Reduced motion support: skips animation when AccessibilityProvider.reducedMotion is true. Host still sees "Waiting for guests..." when < 3 participants.
- Task 2: Refactored `_buildResults` in PlaylistImportCard to show scrollable song list with title (bold), artist (secondary), and remove button per track. Song count header and matched-to-catalog text included.
- Task 3: Added `removeImportedTrack(int index)` and `addManualTrack(String, String)` to PartyProvider. Remove recalculates matched/unmatched counts and resets to idle if empty. Manual tracks are local-only with `manual: true` flag.
- Task 4: Added "+ Add song manually" link with inline text fields (title required, artist optional). Uses compact inline layout, no dialog.
- Task 5: Fixed playlist URL input fontSize to 14.
- Task 6: Restyled Import and Retry buttons from ElevatedButton to DJTapButton with brand purple (DJTokens.actionPrimary) Container.
- Task 7: Added copy constants: waitingForHost, addSongManually, songsImported, matchedToCatalog, manualSongTitle, manualSongArtist, addSong.
- Task 8: Added 3 lobby screen tests (guest indicator visible, host indicator absent, host regression), 6 playlist import card tests (song count, track display, remove, add manual link, DJTapButton type, retry), 5 provider tests (remove track, invalid index, empty reset, add manual, state transition). Updated test wrappers with ApiService + AuthProvider + AccessibilityProvider.
- Task 9: Animation controller disposed in `_LobbyScreenState.dispose()`.

### File List

- apps/flutter_app/lib/screens/lobby_screen.dart (modified)
- apps/flutter_app/lib/widgets/playlist_import_card.dart (modified)
- apps/flutter_app/lib/state/party_provider.dart (modified)
- apps/flutter_app/lib/constants/copy.dart (modified)
- apps/flutter_app/lib/theme/dj_tokens.dart (modified)
- apps/flutter_app/test/screens/lobby_screen_test.dart (modified)
- apps/flutter_app/test/widgets/playlist_import_card_test.dart (modified)
- apps/flutter_app/test/state/party_provider_playlist_test.dart (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

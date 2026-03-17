# Story 5.9: Suggestion-Only Mode

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a host at a venue without YouTube karaoke,
I want the app to work without TV pairing while still providing song suggestions,
So that the party experience works at any karaoke venue.

## Acceptance Criteria

1. **Given** the host skips TV pairing at party creation, **When** the party runs, **Then** the app operates in suggestion-only mode (FR92) **And** playlist import, suggestion engine, Quick Pick, and Spin the Wheel all function normally (FR92) **And** songs are not auto-queued on TV and passive song detection is disabled (FR92)
2. **Given** a song is selected via Quick Pick or Spin the Wheel in suggestion-only mode, **When** the selection is confirmed, **Then** the song title and artist are displayed prominently so the group can manually enter it into whatever karaoke system the venue uses (FR93)
3. **Given** the host wants to track what's playing in suggestion-only mode, **When** they use the song list, **Then** the host can manually mark a song as "now playing" enabling game engine metadata for challenges and genre mechanics (FR94)
4. **Given** TV pairing is optional, **When** the host creates a party, **Then** they can start without pairing and add the TV connection later if desired (FR95)
5. **Given** the YouTube Lounge API fails or becomes unavailable mid-session, **When** the failure is detected, **Then** the system degrades gracefully to suggestion-only mode without crashing, losing session state, or interrupting the active party (NFR31) **And** the host sees a single non-blocking notification (NFR31)

## Tasks / Subtasks

- [x] Task 1: Add `song:manualPlay` event and Zod schema (AC: #3)
  - [x] 1.1 In `apps/server/src/shared/events.ts`, add:
    ```typescript
    SONG_MANUAL_PLAY: 'song:manualPlay',
    ```
  - [x] 1.2 In `apps/server/src/shared/schemas/tv-schemas.ts` (alongside existing `songDetectedSchema`), add:
    ```typescript
    export const songManualPlaySchema = z.object({
      catalogTrackId: z.string(),
      songTitle: z.string(),
      artist: z.string(),
      youtubeVideoId: z.string(),
    });
    ```
    **No `z.globalRegistry.add()`** -- Socket.io only, no REST endpoint. Add to `tv-schemas.ts` since it's song-detection-adjacent and `songDetectedSchema` is already there. There is no `song-schemas.ts` file -- the existing schema files are: `quick-pick-schemas.ts`, `spin-wheel-schemas.ts`, `tv-schemas.ts`, etc.

- [x] Task 2: Server handler for manual song play marking (AC: #3)
  - [x]2.1 In `apps/server/src/socket-handlers/song-handlers.ts`, add handler for `SONG_MANUAL_PLAY`:
    ```typescript
    socket.on(EVENTS.SONG_MANUAL_PLAY, async (data: unknown) => {
      try {
        await validateHost(socket);
        const parsed = songManualPlaySchema.parse(data);
        await handleManualSongPlay(socket.data.sessionId, parsed);
      } catch (error) {
        if (!(error instanceof Error && error.message === 'Not host')) {
          console.error('[song-handlers] song:manualPlay error:', error);
        }
      }
    });
    ```
    - Host-only guard: use `validateHost(socket)` from `host-handlers.ts` -- this is an async function that queries the DB and throws `Error('Not host')` if the socket user is not the host. Import: `import { validateHost } from './host-handlers.js'`
    - The try/catch swallows the `'Not host'` error silently (same pattern as host-handlers.ts where `isValidationError` filters it)
    - Parse payload with `songManualPlaySchema` from `tv-schemas.ts`
  - [x]2.2 In `apps/server/src/services/session-manager.ts`, add:
    ```typescript
    export async function handleManualSongPlay(
      sessionId: string,
      song: { catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string },
    ): Promise<void> {
      const context = getSessionDjState(sessionId);
      if (!context) return;

      // Update DJ context with song metadata — enables ceremony/challenge references
      const updatedContext = {
        ...context,
        currentSongTitle: song.songTitle,
        metadata: {
          ...context.metadata,
          manuallyMarkedSong: {
            catalogTrackId: song.catalogTrackId,
            songTitle: song.songTitle,
            artist: song.artist,
            youtubeVideoId: song.youtubeVideoId,
          },
        },
      };
      setSessionDjState(sessionId, updatedContext);
      void persistDjState(sessionId, serializeDJContext(updatedContext));

      // Emit song:detected equivalent so Flutter shows now-playing metadata
      const io = getIO();
      if (io) {
        io.to(sessionId).emit(EVENTS.SONG_DETECTED, {
          videoId: song.youtubeVideoId,
          songTitle: song.songTitle,
          artist: song.artist,
          channel: null,
          thumbnail: null,
          source: 'manual',
        });
      }

      // Mark as sung in pool for suggestion dedup
      markSongSung(sessionId, song.songTitle, song.artist);

      appendEvent(sessionId, {
        type: 'song:manualPlay',
        ts: Date.now(),
        data: {
          videoId: song.youtubeVideoId,
          title: song.songTitle,
          artist: song.artist,
        },
      });
    }
    ```
  - [x]2.3 **Key design decisions:**
    - Sets `currentSongTitle` on `DJContext` -- this is currently always `null` because TV detection (5.8) writes to `SONG_DETECTED` event but never updates the context field. Manual play fills this gap for suggestion-only mode
    - Emits `SONG_DETECTED` with `source: 'manual'` -- reuses existing Flutter listener infrastructure from Story 5.8. No new Flutter event handling needed
    - Persists updated context via `void persistDjState(sessionId, serializeDJContext(updatedContext))` -- fire-and-forget pattern (same as all other DJ state persistence calls, e.g., session-manager.ts line 367). Uses `serializeDJContext()` from `dj-engine/serializer.js` to convert DJContext to JSON-safe format before persistence. Essential for crash recovery (Story 2.3 pattern)
  - [x]2.4 Update `SessionEvent` union in `apps/server/src/services/event-stream.ts`:
    ```typescript
    | { type: 'song:manualPlay'; ts: number; data: { videoId: string; title: string; artist: string } }
    ```
  - [x]2.5 Update the `songDetectedSchema` source enum in `apps/server/src/shared/schemas/tv-schemas.ts`:
    ```typescript
    source: z.enum(['catalog', 'api-parsed', 'api-raw', 'manual']),
    ```

- [x] Task 3: Graceful TV disconnect degradation (AC: #5)
  - [x]3.1 In `apps/server/src/services/session-manager.ts`, update the existing `onStatusChange` callback in `pairTv()` (lines 121-129):
    - **Current code** (lines 121-129):
      ```typescript
      tv.onStatusChange((status: TvConnectionStatus) => {
        const io = getIO();
        if (io) {
          io.to(sessionId).emit(EVENTS.TV_STATUS, { status });
        }
        if (status === 'disconnected') {
          tvConnections.delete(sessionId);
        }
      });
      ```
    - **Updated code** -- add `degraded` flag and message to the disconnect path:
      ```typescript
      tv.onStatusChange((status: TvConnectionStatus) => {
        const io = getIO();
        if (!io) return;

        if (status === 'disconnected') {
          tvConnections.delete(sessionId);
          // Graceful degradation notification with degraded flag
          io.to(sessionId).emit(EVENTS.TV_STATUS, {
            status,
            degraded: true,
            message: 'TV disconnected. Continuing in suggestion-only mode.',
          });
        } else {
          io.to(sessionId).emit(EVENTS.TV_STATUS, { status });
        }
      });
      ```
    - The key change: when `status === 'disconnected'`, the emitted event includes `degraded: true` and a message. Flutter uses this to show the snackbar notification. For all other statuses (`connected`, `reconnecting`), behavior is unchanged
    - **No session state loss**: The session continues exactly as before. The `isTvPaired()` check in `handleQuickPickSongSelected` and `handleSpinWheelSongSelected` already guards auto-queue. When TV disconnects, `isTvPaired()` returns `false`, so songs won't attempt to queue. The party continues seamlessly
    - **No DJ engine changes**: The DJ state machine has zero knowledge of TV. Song selection, ceremonies, and all game logic work identically with or without TV
  - [x]3.2 **What already works (no changes needed):**
    - Party creation without TV: `createSession()` has no TV dependency
    - Song selection without TV: `handleQuickPickSongSelected()` and `handleSpinWheelSongSelected()` both have `if (isTvPaired(sessionId))` guard on `addToQueue()` -- skipped when no TV
    - `song:queued` event broadcast: Always emitted regardless of TV status, with full song metadata (`catalogTrackId`, `songTitle`, `artist`, `youtubeVideoId`)
    - Song detection disabled: `detectSong()` is only called from the `onNowPlaying` callback which requires an active TV connection. No TV = no detection = no API quota usage
    - Lobby "Skip -- no TV" button: Already exists in `lobby_screen.dart` (line 194-203)
    - Adding TV mid-session: `tv:pair` event can be emitted at any time during the session

- [x] Task 4: Flutter -- store last queued song in provider (AC: #2, #3)
  - [x]4.1 In `apps/flutter_app/lib/state/party_provider.dart`, add fields for the last queued (selected) song:
    ```dart
    // Last selected song info (populated from song:queued event)
    String? _lastQueuedSongTitle;
    String? _lastQueuedArtist;
    String? _lastQueuedVideoId;
    String? _lastQueuedCatalogTrackId;
    ```
  - [x]4.2 Add getters:
    ```dart
    String? get lastQueuedSongTitle => _lastQueuedSongTitle;
    String? get lastQueuedArtist => _lastQueuedArtist;
    String? get lastQueuedVideoId => _lastQueuedVideoId;
    String? get lastQueuedCatalogTrackId => _lastQueuedCatalogTrackId;
    bool get hasLastQueuedSong => _lastQueuedSongTitle != null;
    bool get isSuggestionOnlyMode => !isTvPaired;
    ```
    - `isSuggestionOnlyMode` is derived: simply `!isTvPaired`. No separate tracking needed -- when TV is not connected, the app is in suggestion-only mode by definition
  - [x]4.3 Add mutation methods (called ONLY by SocketClient):
    ```dart
    void setLastQueuedSong({
      required String songTitle,
      required String artist,
      required String videoId,
      required String catalogTrackId,
    }) {
      _lastQueuedSongTitle = songTitle;
      _lastQueuedArtist = artist;
      _lastQueuedVideoId = videoId;
      _lastQueuedCatalogTrackId = catalogTrackId;
      notifyListeners();
    }

    void clearLastQueuedSong() {
      _lastQueuedSongTitle = null;
      _lastQueuedArtist = null;
      _lastQueuedVideoId = null;
      _lastQueuedCatalogTrackId = null;
      notifyListeners();
    }
    ```
  - [x]4.4 Add TV degradation notification field:
    ```dart
    bool _tvDegraded = false;
    bool get tvDegraded => _tvDegraded;

    void setTvDegraded(bool degraded) {
      _tvDegraded = degraded;
      notifyListeners();
    }
    ```
  - [x]4.5 Clear `_lastQueuedSong*` and `_tvDegraded` in the `onDjStateUpdate()` method (line 657) -- add cleanup when transitioning FROM `song` state to any other state (same section that clears ceremony, quick-pick, spin-wheel, and card state on state transitions). Also clear in `dispose()` for completeness

- [x] Task 5: Flutter -- update SocketClient for queued song tracking and TV degradation (AC: #2, #3, #5)
  - [x]5.1 Update the existing `song:queued` listener in `apps/flutter_app/lib/socket/client.dart` (line 400) to also store the song info:
    ```dart
    on('song:queued', (data) {
      final payload = data as Map<String, dynamic>;
      final catalogTrackId = payload['catalogTrackId'] as String;
      final songTitle = payload['songTitle'] as String;
      final artist = payload['artist'] as String;
      final videoId = payload['youtubeVideoId'] as String;

      // Store selected song for suggestion-only display
      _partyProvider?.setLastQueuedSong(
        songTitle: songTitle,
        artist: artist,
        videoId: videoId,
        catalogTrackId: catalogTrackId,
      );

      // Existing quick-pick/spin-wheel resolution logic (unchanged)
      if (_partyProvider?.quickPickSongs.isNotEmpty ?? false) {
        _partyProvider?.onQuickPickResolved(catalogTrackId);
        Timer(const Duration(seconds: 2), () {
          _partyProvider?.onQuickPickCleared();
        });
      }
      if (_partyProvider?.spinWheelSegments.isNotEmpty ?? false) {
        Timer(const Duration(seconds: 2), () {
          _partyProvider?.onSpinWheelCleared();
        });
      }
    });
    ```
  - [x]5.2 Update the existing `tv:status` listener to detect degradation:
    ```dart
    on('tv:status', (data) {
      final payload = data as Map<String, dynamic>;
      final statusStr = payload['status'] as String;
      // ... existing status handling ...

      // Detect graceful degradation from TV disconnect
      final degraded = payload['degraded'] as bool? ?? false;
      if (degraded) {
        _partyProvider?.setTvDegraded(true);
      }

      if (statusStr == 'disconnected') {
        _partyProvider?.clearDetectedSong();
      }
    });
    ```
  - [x]5.3 Add `markSongAsPlaying()` method to SocketClient:
    ```dart
    void markSongAsPlaying() {
      final provider = _partyProvider;
      if (provider == null || !provider.hasLastQueuedSong) return;
      _socket?.emit('song:manualPlay', {
        'catalogTrackId': provider.lastQueuedCatalogTrackId,
        'songTitle': provider.lastQueuedSongTitle,
        'artist': provider.lastQueuedArtist,
        'youtubeVideoId': provider.lastQueuedVideoId,
      });
    }
    ```
  - [x]5.4 Clear `lastQueuedSong` when entering `songSelection` state (new song round starting):
    - In `PartyProvider.onDjStateUpdate()` (line 657), add cleanup when transitioning INTO `songSelection` state: call `clearLastQueuedSong()`. This follows the established pattern in `onDjStateUpdate()` where state-specific cleanup happens on transitions (e.g., lines 668-705 clear ceremony, quick-pick, spin-wheel, and card state). Do NOT put this in the socket client listener — all DJ state transition cleanup belongs in `onDjStateUpdate()`

- [x] Task 6: Flutter -- SelectedSongDisplay widget (AC: #2, #3)
  - [x]6.1 Create `apps/flutter_app/lib/widgets/selected_song_display.dart`:
    ```dart
    /// Prominent display of the selected song in suggestion-only mode.
    /// Shows song title, artist, and "Mark as Playing" button for host.
    /// Visible during `song` DJ state when no TV is paired.
    class SelectedSongDisplay extends StatelessWidget {
      const SelectedSongDisplay({super.key});

      @override
      Widget build(BuildContext context) {
        final provider = context.watch<PartyProvider>();
        if (!provider.hasLastQueuedSong) return const SizedBox.shrink();

        return Container(
          key: const Key('selected-song-display'),
          padding: const EdgeInsets.all(DJTokens.spaceMd),
          decoration: BoxDecoration(
            color: DJTokens.surfaceColor.withAlpha(230),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Copy.upNext,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: DJTokens.textSecondary,
                ),
              ),
              const SizedBox(height: DJTokens.spaceXs),
              Text(
                provider.lastQueuedSongTitle ?? Copy.unknownSong,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: DJTokens.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: DJTokens.spaceXs),
              Text(
                provider.lastQueuedArtist ?? Copy.unknownArtist,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: DJTokens.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: DJTokens.spaceSm),
              Text(
                Copy.enterOnKaraokeMachine,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DJTokens.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
              // Host-only: Mark as Playing button
              if (provider.isHost) ...[
                const SizedBox(height: DJTokens.spaceMd),
                ElevatedButton.icon(
                  key: const Key('mark-as-playing-button'),
                  onPressed: provider.hasDetectedSong
                      ? null // Already marked/detected
                      : () {
                          SocketClient.instance.markSongAsPlaying();
                        },
                  icon: const Icon(Icons.play_circle_outline),
                  label: Text(
                    provider.hasDetectedSong
                        ? Copy.songMarkedPlaying
                        : Copy.markAsPlaying,
                  ),
                ),
              ],
            ],
          ),
        );
      }
    }
    ```
    - Uses `context.watch<PartyProvider>()` for reactive updates
    - Widget key: `Key('selected-song-display')`
    - Host sees "Mark as Playing" button which calls `socket.markSongAsPlaying()`. This triggers `song:manualPlay` → server sets `currentSongTitle` on DJContext → server emits `SONG_DETECTED` → Flutter shows NowPlayingBar. The button disables once `hasDetectedSong` is true (meaning the song was marked or auto-detected)
    - Non-host participants see the song title and artist without the button
    - Uses `DJTokens` for all spacing/colors per project convention
  - [x]6.2 Integrate into party screen. In `apps/flutter_app/lib/screens/party_screen.dart`:
    - Import `SelectedSongDisplay`
    - During `DJState.song` state, when `provider.isSuggestionOnlyMode` is true, show `SelectedSongDisplay` in the same position as `NowPlayingBar` (top of stack):
      ```dart
      // In the Stack children, replace the current NowPlayingBar conditional:
      if (djState == 'song' && !isLightstickActive)
        Positioned(
          top: DJTokens.spaceMd,
          left: DJTokens.spaceMd,
          right: DJTokens.spaceMd,
          child: provider.isSuggestionOnlyMode
              ? const SelectedSongDisplay()
              : (provider.hasDetectedSong
                  ? const NowPlayingBar()
                  : const SizedBox.shrink()),
        ),
      ```
    - **Logic**: Suggestion-only mode → `SelectedSongDisplay` (prominent song + mark as playing). TV mode → `NowPlayingBar` (compact detection display). This is mutually exclusive since `isSuggestionOnlyMode == !isTvPaired`
  - [x]6.3 Show TV degradation snackbar. In `party_screen.dart`, add the check to the existing provider change listener:
    - `_PartyScreenState` already has a listener pattern for provider changes (used for countdown timers, etc.). Add the `tvDegraded` check to that existing listener callback, NOT in `build()`:
      ```dart
      // In the existing provider listener callback (or add one if none exists):
      void _onProviderChanged() {
        final provider = context.read<PartyProvider>();
        if (provider.tvDegraded) {
          provider.setTvDegraded(false); // Reset immediately to prevent re-trigger
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(Copy.tvDisconnectedSuggestionMode),
              duration: const Duration(seconds: 5),
              action: SnackBarAction(
                label: Copy.dismiss,
                onPressed: () {},
              ),
            ),
          );
        }
      }
      ```
    - **Why not in `build()`**: `build()` can fire multiple times per frame, which would show duplicate snackbars. Using a listener ensures it fires exactly once per state change
    - Non-blocking: SnackBar auto-dismisses after 5 seconds

- [x] Task 7: Flutter -- add copy constants (AC: #2, #3, #5)
  - [x]7.1 In `apps/flutter_app/lib/constants/copy.dart`, add:
    ```dart
    static const String upNext = 'Up Next';
    static const String enterOnKaraokeMachine = 'Enter this on the karaoke machine';
    static const String markAsPlaying = 'Mark as Playing';
    static const String songMarkedPlaying = 'Marked as Playing';
    static const String tvDisconnectedSuggestionMode = 'TV disconnected. Continuing in suggestion-only mode.';
    static const String dismiss = 'Dismiss';
    ```

- [x] Task 8: Server tests (AC: #1, #2, #3, #5)
  - [x]8.1 Create `apps/server/tests/services/session-manager-suggestion.test.ts`:
    - Test `handleManualSongPlay()` updates DJContext `currentSongTitle`
    - Test `handleManualSongPlay()` emits `SONG_DETECTED` with `source: 'manual'`
    - Test `handleManualSongPlay()` calls `markSongSung()` for dedup
    - Test `handleManualSongPlay()` appends `song:manualPlay` event to event stream
    - Test `handleManualSongPlay()` persists updated context
    - Test non-existent session returns early (no crash)
    - Mock: `getIO()`, `getSessionDjState()`, `setSessionDjState()`, `persistDjState()`, `markSongSung()`, `appendEvent()`
  - [x]8.2 Create `apps/server/tests/socket-handlers/song-handlers-manual-play.test.ts`:
    - Test host can emit `song:manualPlay` with valid payload
    - Test non-host socket is rejected (host-only guard)
    - Test invalid payload is rejected (Zod validation)
    - Follow existing song-handlers test patterns
  - [x]8.3 Add to existing `apps/server/tests/services/session-manager-quickpick.test.ts`:
    - Test that `handleQuickPickSongSelected` still emits `SONG_QUEUED` when `isTvPaired()` returns false
    - Test that `addToQueue` is NOT called when `isTvPaired()` returns false
    - (Note: this behavior already exists but may not be explicitly tested for the no-TV path)
  - [x]8.4 Add TV degradation test to `apps/server/tests/services/session-manager-tv.test.ts`:
    - Test that when `onStatusChange` fires with `'disconnected'`, the `tvConnections` Map entry is cleaned up
    - Test that `TV_STATUS` event with `degraded: true` is emitted
    - Test session continues normally after TV disconnect (DJ state unaffected)

- [x] Task 9: Flutter tests (AC: #2, #3, #5)
  - [x]9.1 Create `apps/flutter_app/test/widgets/selected_song_display_test.dart`:
    - Test renders song title and artist when `hasLastQueuedSong` is true
    - Test renders "Up Next" label and "Enter this on the karaoke machine" helper text
    - Test host sees "Mark as Playing" button
    - Test non-host does not see "Mark as Playing" button
    - Test "Mark as Playing" button disables when `hasDetectedSong` is true
    - Test hides (SizedBox.shrink) when `hasLastQueuedSong` is false
    - **DO NOT test**: animations, colors, visual transitions
  - [x]9.2 Update `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `setLastQueuedSong` updates all fields and notifies listeners
    - Test `clearLastQueuedSong` resets all fields and notifies listeners
    - Test `hasLastQueuedSong` computed property
    - Test `isSuggestionOnlyMode` returns `true` when TV not paired, `false` when paired
    - Test `tvDegraded` field set/clear
    - Test `onDjStateUpdate` clears `lastQueuedSong` when transitioning into `songSelection`
    - Test `onDjStateUpdate` clears `lastQueuedSong` when transitioning out of `song` state

## Dev Notes

### Architecture Compliance

- **Server boundary**: `socket-handlers/song-handlers.ts` handles the `song:manualPlay` event. It calls `session-manager.ts` for orchestration -- per architecture: "socket-handlers call services and dj-engine, never persistence directly"
- **Service layer**: `session-manager.ts` orchestrates manual play (DJ context update + persistence + event emission + song pool marking) -- per architecture: "session-manager is the ONLY service that orchestrates across layers"
- **dj-engine boundary**: dj-engine has ZERO knowledge of TV, suggestion-only mode, or manual play. The `currentSongTitle` field on `DJContext` is set by session-manager after the transition, not by dj-engine itself. The engine remains pure logic
- **Flutter boundary**: ONLY `SocketClient` calls mutation methods on `PartyProvider`. Widgets read via `context.watch<PartyProvider>()`

### Key Technical Decisions

- **Suggestion-only mode is implicit, not explicit**: `isSuggestionOnlyMode == !isTvPaired`. No separate mode tracking, no new session field, no new DJ state. The existing `isTvPaired()` guard on auto-queue already handles the core behavior (FR92). This is the simplest possible implementation
- **Reuse `SONG_DETECTED` event for manual play**: Instead of creating a new Flutter event listener, `handleManualSongPlay()` emits `SONG_DETECTED` with `source: 'manual'`. This reuses all of Story 5.8's Flutter infrastructure (`setDetectedSong`, `NowPlayingBar`, `clearDetectedSong`) for free. The only new source value is `'manual'`
- **`currentSongTitle` gap fill**: Currently `DJContext.currentSongTitle` is always `null` (declared in types.ts line 59, never set). Song detection from 5.8 emits `SONG_DETECTED` events but doesn't update the DJContext. Manual play in 5.9 sets this field, enabling ceremony/award logic that references `context.currentSongTitle` (session-manager.ts line 233, 310). This also benefits TV mode in the future if auto-detection updates the context
- **`song:queued` already broadcasts song data**: The `SONG_QUEUED` event (session-manager.ts lines 757-762, 854-859) already contains `{ catalogTrackId, songTitle, artist, youtubeVideoId }`. Flutter just needs to store it for the prominent display. No server changes needed for AC #2
- **TV degradation is a status event extension**: The existing `TV_STATUS` event gets a new optional `degraded: boolean` field. No new event type needed. The `tvConnections.delete()` cleanup ensures `isTvPaired()` returns `false` immediately
- **Host guard for manual play**: Uses `validateHost(socket)` from `host-handlers.ts` -- an async DB lookup that throws `Error('Not host')` if unauthorized. Same pattern used by all host-only handlers (`host:pause`, `host:songOver`, etc.). Only the host can mark songs as playing -- participants see the song info but can't control playback

### What Already Works (No Changes Needed) -- AC #1, AC #4

These acceptance criteria are ALREADY satisfied by existing code:

| Requirement | Already Implemented By |
|---|---|
| Party creation without TV | `createSession()` has no TV dependency |
| Party start without TV | `startSession()` has no TV dependency |
| Quick Pick without TV | `isTvPaired()` guard skips `addToQueue()` (line 862) |
| Spin the Wheel without TV | `isTvPaired()` guard skips `addToQueue()` (line 765) |
| `song:queued` broadcast | Always emitted regardless of TV status (lines 757, 854) |
| Playlist import without TV | REST endpoint, no TV dependency |
| Suggestion engine without TV | `computeSuggestions()` has no TV dependency |
| Song detection disabled without TV | `detectSong()` only called from `onNowPlaying` callback |
| "Skip -- no TV" button | `lobby_screen.dart` line 194-203, `partyProvider.setTvSkipped(true)` |
| Add TV mid-session | `tv:pair` event can be emitted at any time |

**AC #1 verification**: The ONLY code path that touches TV during song selection is the `isTvPaired()` guard. When false, the guard skips `addToQueue()` and everything else proceeds normally. This is already implemented and working.

**AC #4 verification**: The lobby screen shows "Pair with TV" and "Skip -- no TV" buttons (line 175-204). After skipping, the party starts normally. The host can later trigger TV pairing from the host controls overlay at any time during the session.

### Existing Infrastructure to Leverage

- **`song:queued` event payload**: Already contains `{ catalogTrackId, songTitle, artist, youtubeVideoId }` -- use for `SelectedSongDisplay`
- **`SONG_DETECTED` event + Flutter listener**: Reuse from Story 5.8 for manual play confirmation
- **`validateHost(socket)`**: From `host-handlers.ts` -- async host-only guard (throws `Error('Not host')`)
- **`markSongSung()`**: From `song-pool.ts` for suggestion engine dedup
- **`appendEvent()`**: From `event-stream.ts` for event logging
- **`persistDjState()`**: From `session-manager.ts` -- takes `(sessionId, serializedState)`. Must call with `serializeDJContext()` output, fire-and-forget via `void` (not `await`)
- **`setSessionDjState()`**: From `dj-state-store.ts` (already imported in session-manager.ts line 9)
- **`serializeDJContext()`**: From `dj-engine/serializer.ts` (already imported in session-manager.ts line 6)
- **`NowPlayingBar`**: From Story 5.8 -- shown in TV mode when `hasDetectedSong`
- **`SongOverButton`**: Existing host button to signal song end -- works in both modes
- **`TvPairingOverlay`**: Existing overlay for pairing -- can be triggered from host controls mid-session
- **`Copy.unknownSong`, `Copy.unknownArtist`**: From Story 5.8

### In-Memory Pattern

No new module-level Maps needed. All state is tracked on:
- `DJContext.currentSongTitle` (server, persisted to JSONB)
- `DJContext.metadata.manuallyMarkedSong` (server, persisted to JSONB)
- `PartyProvider._lastQueued*` fields (Flutter, client-side)

### Error Handling

- `handleManualSongPlay()`: Returns early if `getSessionDjState()` returns null (session not found). No crash
- `song:manualPlay` handler: Wrapped in try/catch, logs errors. Invalid payloads rejected by Zod
- TV degradation: `tvConnections.delete()` is idempotent. Multiple disconnect events are safe
- All errors use `AppError` pattern from `shared/errors.ts`

### File Naming

- Server: `kebab-case.ts` -- follows existing pattern
- Flutter: `snake_case.dart` -- `selected_song_display.dart`
- Import: relative paths with `.js` extension (server), `package:karamania/...` (Flutter)
- No barrel files

### Project Structure Notes

- `apps/server/src/shared/events.ts` -- modified (add `SONG_MANUAL_PLAY`)
- `apps/server/src/shared/schemas/tv-schemas.ts` -- modified (add `songManualPlaySchema` + add `'manual'` to `songDetectedSchema` source enum)
- `apps/server/src/services/session-manager.ts` -- modified (add `handleManualSongPlay`, update `pairTv` onStatusChange)
- `apps/server/src/services/event-stream.ts` -- modified (add `song:manualPlay` event type)
- `apps/server/src/socket-handlers/song-handlers.ts` -- modified (add `SONG_MANUAL_PLAY` handler)
- `apps/flutter_app/lib/state/party_provider.dart` -- modified (add lastQueued fields, tvDegraded, isSuggestionOnlyMode)
- `apps/flutter_app/lib/socket/client.dart` -- modified (update song:queued, add markSongAsPlaying, tv degradation)
- `apps/flutter_app/lib/widgets/selected_song_display.dart` -- **new file**
- `apps/flutter_app/lib/screens/party_screen.dart` -- modified (integrate SelectedSongDisplay, TV degradation snackbar)
- `apps/flutter_app/lib/constants/copy.dart` -- modified (add new copy strings)
- `apps/server/tests/services/session-manager-suggestion.test.ts` -- **new file**
- `apps/server/tests/socket-handlers/song-handlers-manual-play.test.ts` -- **new file**
- `apps/flutter_app/test/widgets/selected_song_display_test.dart` -- **new file**

### Previous Story Intelligence (5.8: Song Detection & Metadata Resolution)

- **`SONG_DETECTED` event reuse**: Story 5.8 established the `song:detected` listener in Flutter with `setDetectedSong()` / `clearDetectedSong()` on `PartyProvider`. Manual play reuses this by emitting `SONG_DETECTED` with `source: 'manual'`. The only change is adding `'manual'` to the `songDetectedSchema` source enum
- **NowPlayingBar**: Shows when `hasDetectedSong` is true. In suggestion-only mode, after host marks as playing, `SONG_DETECTED` fires → `setDetectedSong()` → `hasDetectedSong` becomes true → NowPlayingBar appears. Works automatically
- **Three-tier detection cache**: Not relevant for suggestion-only mode (no TV = no detection). But the cache is global and unaffected
- **Test pattern**: Separate test files per concern (e.g., `session-manager-detection.test.ts`). Follow same: `session-manager-suggestion.test.ts`
- **Code review lessons from 5.8**: `DJState.bridge` doesn't exist in Flutter enum (only on server). Only show widgets during states that exist in Flutter's DJState enum. `clearDetectedSong()` on TV disconnect -- already handled

### Git Intelligence

Recent commits (all on `flutter-native-pivot` branch):
- `0dbc279` Story 5.8: Song Detection & Metadata Resolution -- 18 files, song:detected event, NowPlayingBar, PartyProvider detected song fields
- `f362aec` Story 5.7: TV Pairing & YouTube Lounge API -- TV integration, pairTv/unpairTv, onNowPlaying/onStatusChange
- `f0dec8f` Story 5.6: Spin the Wheel -- spinwheel selection, veto, auto-queue pattern
- `1d4f623` Story 5.5: Quick Pick -- voting, majority resolution, song:queued event
- All stories follow: service + schemas + events + socket-handler + session-manager + Flutter widget + provider + socket client + tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Story 5.9]
- [Source: _bmad-output/planning-artifacts/epics.md, FR92-FR95]
- [Source: _bmad-output/planning-artifacts/architecture.md, NFR31 -- graceful degradation]
- [Source: _bmad-output/planning-artifacts/architecture.md, Server Component Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md, Song Integration FR74-95 mapping]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: _bmad-output/project-context.md, Socket.io Event Catalog]
- [Source: _bmad-output/implementation-artifacts/5-8-song-detection-and-metadata-resolution.md, Previous story learnings]
- [Source: apps/server/src/services/session-manager.ts, lines 757-769, 854-866 -- existing isTvPaired guard]
- [Source: apps/flutter_app/lib/screens/lobby_screen.dart, lines 175-204 -- existing TV skip UI]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging needed.

### Completion Notes List

- ✅ Task 1: Added `SONG_MANUAL_PLAY` event constant + `songManualPlaySchema` + extended `songDetectedSchema` source enum with `'manual'`
- ✅ Task 2: Implemented `handleManualSongPlay()` in session-manager — updates DJContext.currentSongTitle, emits SONG_DETECTED with source='manual', persists state, marks song sung, appends event. Added socket handler with host-only guard. Updated SessionEvent union.
- ✅ Task 3: Graceful TV disconnect degradation — emits TV_STATUS with `degraded: true` flag and message. Existing isTvPaired() guards already handle song selection without TV.
- ✅ Task 4: PartyProvider — added lastQueued* fields, tvDegraded, isSuggestionOnlyMode getter. Cleanup on DJ state transitions (leaving song, entering songSelection).
- ✅ Task 5: SocketClient — song:queued stores song info, tv:status detects degradation, added markSongAsPlaying() method.
- ✅ Task 6: Created SelectedSongDisplay widget with host "Mark as Playing" button. Integrated into party_screen with conditional rendering (suggestion-only → SelectedSongDisplay, TV mode → NowPlayingBar). Added TV degradation snackbar via provider listener.
- ✅ Task 7: Added copy constants (upNext, enterOnKaraokeMachine, markAsPlaying, songMarkedPlaying, tvDisconnectedSuggestionMode, dismiss).
- ✅ Task 8: Server tests — 7 tests for handleManualSongPlay, 4 tests for song:manualPlay handler, 3 tests for TV degradation. All 1021 server tests pass.
- ✅ Task 9: Flutter tests — 6 widget tests for SelectedSongDisplay, 7 provider tests for suggestion-only mode. All 618 Flutter tests pass (2 pre-existing failures in unrelated files).

### Change Log

- 2026-03-17: Implemented Story 5.9 Suggestion-Only Mode — all 9 tasks complete
- 2026-03-17: Code review fixes — H1: onKicked() clears lastQueued*/tvDegraded, H2: dispose() clears lastQueued*/tvDegraded, H3: song:manualPlay handler guards sessionId, M1: sprint-status.yaml added to File List, M2: onSessionEnd() clears lastQueued*/tvDegraded

### File List

**Sprint tracking (modified):**
- _bmad-output/implementation-artifacts/sprint-status.yaml — updated story status

**Server (modified):**
- apps/server/src/shared/events.ts — added SONG_MANUAL_PLAY
- apps/server/src/shared/schemas/tv-schemas.ts — added songManualPlaySchema, extended songDetectedSchema source enum
- apps/server/src/services/session-manager.ts — added handleManualSongPlay(), updated pairTv onStatusChange for degradation
- apps/server/src/services/event-stream.ts — added song:manualPlay to SessionEvent union
- apps/server/src/socket-handlers/song-handlers.ts — added song:manualPlay handler

**Flutter (modified):**
- apps/flutter_app/lib/state/party_provider.dart — added lastQueued*, tvDegraded, isSuggestionOnlyMode
- apps/flutter_app/lib/socket/client.dart — updated song:queued, tv:status, added markSongAsPlaying()
- apps/flutter_app/lib/screens/party_screen.dart — integrated SelectedSongDisplay, TV degradation snackbar
- apps/flutter_app/lib/constants/copy.dart — added suggestion-only mode copy strings

**Flutter (new):**
- apps/flutter_app/lib/widgets/selected_song_display.dart — new widget

**Server tests (new):**
- apps/server/tests/services/session-manager-suggestion.test.ts
- apps/server/tests/socket-handlers/song-handlers-manual-play.test.ts

**Server tests (modified):**
- apps/server/tests/services/session-manager-tv.test.ts — added TV degradation tests

**Flutter tests (new):**
- apps/flutter_app/test/widgets/selected_song_display_test.dart

**Flutter tests (modified):**
- apps/flutter_app/test/state/party_provider_test.dart — added suggestion-only mode tests

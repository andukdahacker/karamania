# Story 5.8: Song Detection & Metadata Resolution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to identify what song is playing on the TV and extract its metadata,
So that the DJ engine can use song information for challenges and ceremonies.

## Acceptance Criteria

1. **Given** a nowPlaying event is received with a video_id, **When** the system processes it, **Then** the video_id is resolved to structured song metadata `{title, artist, channel, thumbnail}` via the YouTube Data API v3 within 5 seconds of song start (FR76) **And** API calls are batched efficiently to minimize quota usage (NFR30)
2. **Given** a karaoke video title (e.g., "Song Title - Artist (Karaoke Version)"), **When** the system parses it, **Then** it extracts structured `{song, artist}` data using title parsing rules (FR77)

## Tasks / Subtasks

- [x] Task 1: Add YouTube video details fetching to `youtube-data.ts` (AC: #1)
  - [x] 1.1 In `apps/server/src/integrations/youtube-data.ts`, add a new export:
    ```typescript
    export interface VideoDetails {
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnail: string;
      duration: string; // ISO 8601 duration, e.g., "PT3M45S"
    }

    export async function fetchVideoDetails(
      videoIds: string[],
      apiKey: string
    ): Promise<Map<string, VideoDetails>>
    ```
  - [x] 1.2 Implementation uses YouTube Data API v3 `videos.list` endpoint:
    - `GET https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={comma-separated-ids}&key={apiKey}`
    - Accepts up to 50 video IDs per request (YouTube API limit)
    - Returns a Map keyed by videoId for O(1) lookup
    - Uses the same retry logic already in `youtube-data.ts` (3 retries, exponential backoff for 429/5xx, 5s timeout)
    - **Quota cost:** 1 unit per `videos.list` call regardless of how many IDs (up to 50) -- very efficient
  - [x] 1.3 Extract from response: `snippet.title`, `snippet.channelTitle`, `snippet.thumbnails.medium.url`, `contentDetails.duration`
  - [x] 1.4 If a videoId is not found in the response, omit it from the returned Map (do not throw)

- [x] Task 2: Create song detection service (AC: #1, #2)
  - [x] 2.1 Create `apps/server/src/services/song-detection.ts` with exports:
    ```typescript
    export interface DetectedSong {
      videoId: string;
      songTitle: string;
      artist: string;
      channel: string | null;
      thumbnail: string | null;
      source: 'catalog' | 'api-parsed' | 'api-raw';
    }

    export async function detectSong(videoId: string): Promise<DetectedSong | null>
    export function getCachedDetection(videoId: string): DetectedSong | undefined
    export function clearDetectionCache(): void
    export function resetDetectionCache(): void // For tests
    ```
  - [x] 2.2 Implement three-tier resolution strategy in `detectSong()`:
    - **Tier 1 -- Cache:** Check in-memory `Map<string, DetectedSong>` cache first. If found, return immediately (0ms)
    - **Tier 2 -- Catalog lookup:** Call `catalogRepository.findByYoutubeVideoId(videoId)`. If found, construct `DetectedSong` with `source: 'catalog'`, cache it, and return. This costs zero API quota
    - **Tier 3 -- YouTube API + title parsing:** Call `fetchVideoDetails([videoId], config.YOUTUBE_API_KEY)`. Parse the video title with `parseKaraokeTitle(title)` from `shared/title-parser.ts`:
      - If `parseKaraokeTitle` returns a result, use parsed `songTitle` and `artist`, set `source: 'api-parsed'`
      - If parsing fails (title doesn't match "Artist - Song" pattern), use the raw title as `songTitle`, channel as `artist`, set `source: 'api-raw'`
    - Cache the result regardless of tier, return it
  - [x] 2.3 Cache is module-level `Map<string, DetectedSong>` -- same pattern as `songPools` in `song-pool.ts`, `cardStatsCaches` in session-manager
  - [x] 2.4 The cache is global (not per-session) because videoIds are universal -- a song detected in one session is the same video in another. This saves API quota across sessions
  - [x] 2.5 Do NOT add a cache TTL for MVP -- the cache only grows during server lifetime and is cleared on restart. A video's metadata doesn't change during a party
  - [x] 2.6 **Dedup note:** If rapid song changes occur on TV (user skipping tracks), multiple `nowPlaying` events fire. The Tier 1 cache handles this efficiently -- a second `detectSong()` call for the same videoId returns instantly from cache with zero API cost

- [x] Task 3: Integrate song detection into session-manager nowPlaying callback (AC: #1)
  - [x] 3.1 In `apps/server/src/services/session-manager.ts`, update the `pairTv()` function's `onNowPlaying` callback (currently at lines ~60-75)
  - [x] 3.2 Current implementation emits `SONG_DETECTED` with just `{ videoId }`. Replace with:
    ```typescript
    tv.onNowPlaying(async (event: NowPlayingEvent) => {
      const io = getIO();
      if (!io) return;

      // Always emit raw nowPlaying immediately (for TV status display)
      io.to(sessionId).emit(EVENTS.TV_NOW_PLAYING, {
        videoId: event.videoId,
        title: event.title,
        state: event.state,
      });

      // Skip metadata resolution for non-playing states
      if (event.state !== 'playing') return;

      // Resolve metadata asynchronously (fire-and-forget style but with emit on success)
      detectSong(event.videoId)
        .then((detected) => {
          if (detected) {
            io.to(sessionId).emit(EVENTS.SONG_DETECTED, {
              videoId: detected.videoId,
              songTitle: detected.songTitle,
              artist: detected.artist,
              channel: detected.channel,
              thumbnail: detected.thumbnail,
              source: detected.source,
            });
            appendEvent(sessionId, {
              type: 'song:detected',
              ts: Date.now(),
              data: {
                videoId: detected.videoId,
                title: detected.songTitle,
                artist: detected.artist,
              },
            });

            // Mark song as sung in pool for suggestion engine deduplication
            markSongSung(sessionId, detected.songTitle, detected.artist);
          }
        })
        .catch((err) => {
          console.error('[session-manager] Song detection failed:', err);
          // Emit minimal detection so UI still updates
          io.to(sessionId).emit(EVENTS.SONG_DETECTED, {
            videoId: event.videoId,
            songTitle: event.title ?? 'Unknown',
            artist: null,
            channel: null,
            thumbnail: null,
            source: 'api-raw',
          });
        });
    });
    ```
  - [x] 3.3 Import `detectSong` from `'../services/song-detection.js'` and `markSongSung` from `'../services/song-pool.js'`
  - [x] 3.4 **Key design decision:** `TV_NOW_PLAYING` emits immediately (real-time TV status). `SONG_DETECTED` emits after metadata resolution (may have 1-2s delay for API calls). These are separate concerns
  - [x] 3.5 The `markSongSung()` call ensures the suggestion engine won't suggest the song again after it's been detected playing on TV

- [x] Task 4: Update Zod schemas and event types (AC: #1, #2)
  - [x] 4.1 In `apps/server/src/shared/schemas/tv-schemas.ts`, add:
    ```typescript
    export const songDetectedSchema = z.object({
      videoId: z.string(),
      songTitle: z.string(),
      artist: z.string().nullable(),
      channel: z.string().nullable(),
      thumbnail: z.string().nullable(),
      source: z.enum(['catalog', 'api-parsed', 'api-raw']),
    });
    ```
    **No `z.globalRegistry.add()`** -- Socket.io only, no REST endpoints
  - [x] 4.2 In `apps/server/src/services/event-stream.ts`, **UPDATE** the `SessionEvent` union member for `song:detected`. The current type (line 41) is:
    ```typescript
    | { type: 'song:detected'; ts: number; data: { videoId: string } }
    ```
    Change it to include title and artist to match the enriched data shape from Task 3.2:
    ```typescript
    | { type: 'song:detected'; ts: number; data: { videoId: string; title: string; artist: string } }
    ```
    This is a **breaking change** to the type -- the architecture spec requires `{ title, artist, videoId }` in the event stream. The old shape only had `videoId` because Story 5.7 deferred metadata resolution to this story

- [x] Task 5: Flutter state management for detected song (AC: #1, #2)
  - [x] 5.1 Update `apps/flutter_app/lib/state/party_provider.dart`:
    - **Note:** `_tvNowPlayingVideoId` (line 200) already tracks the raw videoId from `tv:nowPlaying`. Do NOT add a redundant `_detectedVideoId`. Instead, add only the resolved metadata fields that `song:detected` provides on top of the raw TV data:
      ```dart
      // Resolved metadata fields (enrichment on top of existing _tvNowPlayingVideoId)
      String? _detectedSongTitle;
      String? _detectedArtist;
      String? _detectedThumbnail;
      String? _detectedSource; // 'catalog', 'api-parsed', 'api-raw'
      ```
    - Add getters: `detectedSongTitle`, `detectedArtist`, `detectedThumbnail`, `detectedSource`, `hasDetectedSong` (computed: `_detectedSongTitle != null`)
    - Add mutation method (called ONLY by SocketClient):
      ```dart
      void setDetectedSong({
        required String songTitle,
        String? artist,
        String? thumbnail,
        String? source,
      }) {
        _detectedSongTitle = songTitle;
        _detectedArtist = artist;
        _detectedThumbnail = thumbnail;
        _detectedSource = source;
        notifyListeners();
      }

      void clearDetectedSong() {
        _detectedSongTitle = null;
        _detectedArtist = null;
        _detectedThumbnail = null;
        _detectedSource = null;
        notifyListeners();
      }
      ```
  - [x] 5.2 Update `apps/flutter_app/lib/socket/client.dart`:
    - Add listener for `song:detected` in `_setupPartyListeners`:
      ```dart
      on('song:detected', (data) {
        final payload = data as Map<String, dynamic>;
        _partyProvider?.setDetectedSong(
          songTitle: payload['songTitle'] as String,
          artist: payload['artist'] as String?,
          thumbnail: payload['thumbnail'] as String?,
          source: payload['source'] as String?,
        );
      });
      ```
    - Update the existing `tv:nowPlaying` listener to clear detected song metadata on non-playing states:
      ```dart
      on('tv:nowPlaying', (data) {
        final payload = data as Map<String, dynamic>;
        final videoId = payload['videoId'] as String;
        final title = payload['title'] as String?;
        final state = payload['state'] as String;
        _partyProvider?.setTvNowPlaying(videoId, title, state);
        // Clear resolved metadata when song stops -- new metadata will arrive via song:detected for next song
        if (state == 'idle') {
          _partyProvider?.clearDetectedSong();
        }
      });
      ```
    - Update the existing `tv:status` listener to clear detected song on TV disconnect:
      ```dart
      // Inside the existing tv:status handler, after setting TV status:
      if (statusStr == 'disconnected') {
        _partyProvider?.clearDetectedSong();
      }
      ```
  - [x] 5.3 Update `apps/flutter_app/lib/constants/copy.dart`:
    - Add: `nowPlaying = 'Now Playing'`
    - Add: `unknownSong = 'Unknown Song'`
    - Add: `unknownArtist = 'Unknown Artist'`

- [x] Task 6: Flutter now-playing display widget (AC: #1)
  - [x] 6.1 Create `apps/flutter_app/lib/widgets/now_playing_bar.dart`:
    - A compact bar widget that shows the currently detected song
    - Displays: thumbnail (if available, use `Image.network` with error fallback), song title, artist (show `Copy.unknownArtist` if null)
    - Uses `context.watch<PartyProvider>()` for reactive updates
    - Only visible when `partyProvider.hasDetectedSong` is true
    - Use `DJTokens` for all spacing/colors
    - Widget key: `Key('now-playing-bar')`
    - Keep it simple -- a `Container` with `Row` containing optional thumbnail, title column (song + artist), and a small music note icon
  - [x] 6.2 Integrate `NowPlayingBar` into the party screen:
    - In `apps/flutter_app/lib/screens/party_screen.dart`, position `NowPlayingBar` at the **top** of the `Stack` (below any app bar, above the game area). The bottom of the screen is already crowded with `SoundboardBar`, `ReactionBar`, mode toggle buttons, and `SongOverButton`
    - Use `Positioned(top: DJTokens.spaceMd, left: DJTokens.spaceMd, right: DJTokens.spaceMd, child: NowPlayingBar())`
    - Only show during `DJState.song` and `DJState.bridge` states (when a song is relevant)
    - **Hide during lightstick mode** -- consistent with SoundboardBar and ReactionBar being hidden in lightstick mode
    - Only show when `context.watch<PartyProvider>().hasDetectedSong` is true

- [x] Task 7: Server tests (AC: #1, #2)
  - [x] 7.1 Create `apps/server/tests/integrations/youtube-data-video-details.test.ts`:
    - Test `fetchVideoDetails` with mocked HTTP responses
    - Test single videoId fetch returns correct VideoDetails
    - Test batch fetch (multiple videoIds) returns Map with all entries
    - Test missing videoId in response is omitted from Map (not thrown)
    - Test retry logic on 429/5xx responses
    - Test timeout handling
    - **Mock HTTP calls** -- do NOT call real YouTube API in tests
  - [x] 7.2 Create `apps/server/tests/services/song-detection.test.ts`:
    - Test Tier 1: cached detection returns immediately without API calls
    - Test Tier 2: catalog lookup returns without API calls
    - Test Tier 3 (parsed): API + successful title parse returns `source: 'api-parsed'`
    - Test Tier 3 (raw): API + failed title parse returns `source: 'api-raw'`
    - Test null return when API call fails and no cache
    - Test cache population after each tier
    - Test `clearDetectionCache` empties the cache
    - Mock `catalogRepository.findByYoutubeVideoId` and `fetchVideoDetails`
    - Use test factories from `tests/factories/` for catalog track data
  - [x] 7.3 Create `apps/server/tests/services/session-manager-detection.test.ts`:
    - Test that `pairTv` callback emits `SONG_DETECTED` with full metadata after detection
    - Test that `markSongSung` is called with detected song data
    - Test that non-playing states (paused, buffering, idle) do NOT trigger detection
    - Test that detection failure still emits minimal `SONG_DETECTED` event
    - Test that `TV_NOW_PLAYING` is always emitted immediately regardless of detection status
    - Mock `TvIntegration` via `setTvFactory` and `song-detection` module

- [x] Task 8: Flutter tests (AC: #1)
  - [x] 8.1 Create `apps/flutter_app/test/widgets/now_playing_bar_test.dart`:
    - Test renders song title and artist when detected song is set
    - Test renders thumbnail when provided
    - Test hides when no detected song
    - Test updates when detected song changes
    - **DO NOT test**: animations, colors, visual transitions
  - [x] 8.2 Update `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `setDetectedSong` updates all metadata fields and notifies listeners
    - Test `clearDetectedSong` resets all metadata fields and notifies listeners
    - Test `hasDetectedSong` computed property (true when `_detectedSongTitle` is set, false when cleared)
    - Test that `setDetectedSong` does NOT modify `_tvNowPlayingVideoId` (separate concern)

## Dev Notes

### Architecture Compliance

- **Server boundary**: `integrations/youtube-data.ts` handles ALL YouTube Data API HTTP calls. The new `fetchVideoDetails` goes here alongside existing `fetchPlaylistTracks`
- **Service layer**: `services/song-detection.ts` orchestrates the three-tier resolution. It calls `integrations/youtube-data.ts` for API and `persistence/catalog-repository.ts` for DB lookup
- **Orchestration**: `services/session-manager.ts` calls `song-detection.ts` from the nowPlaying callback -- per architecture: "session-manager is the ONLY service that crosses layer boundaries"
- **dj-engine boundary**: dj-engine has ZERO imports from song-detection, persistence, or integrations
- **Flutter boundary**: ONLY `SocketClient` calls mutation methods on `PartyProvider`. No widget creates its own socket listener

### Key Technical Decisions

- **Three-tier resolution (cache -> catalog -> API)**: Minimizes YouTube API quota usage. Most songs in a karaoke session will be in the catalog (10K+ tracks), so Tier 2 handles the majority. API calls are the fallback
- **Global cache (not per-session)**: A videoId maps to the same video regardless of session. Cross-session caching saves quota
- **Separate events**: `TV_NOW_PLAYING` for immediate TV status display, `SONG_DETECTED` for resolved metadata. Different consumers, different timing. On Flutter side, `_tvNowPlayingVideoId` (existing from 5.7) holds the raw videoId; `_detectedSongTitle`/`_detectedArtist` (new) hold resolved metadata. No redundant videoId field
- **Fire-and-forget detection**: The nowPlaying callback doesn't await detection -- it fires the API call and emits when ready. TV status display is never blocked by metadata resolution. The `.then().catch()` pattern in Task 3.2 is intentional for non-blocking behavior -- this is the same established pattern used for TV auto-queue in Story 5.7 (`addToQueue(...).catch(...)`) and is the one exception to the project-context.md "no `.then()` chains" rule
- **Detected song clearing**: `clearDetectedSong()` is triggered by: (1) `tv:nowPlaying` with `state: 'idle'` (song ended), (2) `tv:status` with `status: 'disconnected'` (TV lost), (3) provider reset on session end. New `song:detected` events auto-replace via `setDetectedSong()`
- **`markSongSung` integration**: When a song is detected playing on TV, it's automatically marked as sung in the song pool. This prevents the suggestion engine from re-suggesting songs that have already been performed
- **Quota budget**: `videos.list` costs 1 unit per call (up to 50 IDs). With cache + catalog, expect <10 API calls per session. Well within NFR30's 500 units/session budget

### Existing Infrastructure to Leverage

- **`youtube-data.ts`**: Retry logic (3 retries, exponential backoff), timeout handling, API key from `config.YOUTUBE_API_KEY`. Add `fetchVideoDetails` alongside `fetchPlaylistTracks`
- **`title-parser.ts`** (`parseKaraokeTitle`): Already handles "Artist - Song (Karaoke Version)" format. Returns `{ songTitle, artist }` or `null`
- **`song-normalizer.ts`**: `normalizeSongTitle()` and `normalizeArtist()` for matching. Used by `markSongSung()`
- **`catalog-repository.ts`**: `findByYoutubeVideoId(videoId)` -- direct lookup, no normalization needed
- **`song-pool.ts`**: `markSongSung(sessionId, title, artist)` -- uses normalization internally for matching
- **`event-stream.ts`**: `appendEvent()` already supports `song:detected` event type

### In-Memory Pattern

Follow the established module-level `Map<string, T>` pattern:
- `detectionCache = new Map<string, DetectedSong>()` -- global, not per-session (unlike songPools)
- Export `resetDetectionCache()` for test cleanup -- same pattern as `resetAllModes()`, `resetAllTvConnections()`

### Error Handling

- Detection failure in nowPlaying callback: catch and emit minimal `SONG_DETECTED` with `source: 'api-raw'` and `event.title ?? 'Unknown'`. Never crash the callback
- YouTube API failure: `fetchVideoDetails` returns empty Map. Detection service returns `null`. Caller handles gracefully
- All errors use `async/await` -- no `.then()` chains except in the fire-and-forget callback pattern (which uses `.then().catch()` intentionally for non-blocking behavior)

### File Naming

- Server: `kebab-case.ts` -- `song-detection.ts`
- Flutter: `snake_case.dart` -- `now_playing_bar.dart`
- Import: relative paths with `.js` extension. No barrel files, no tsconfig aliases

### Project Structure Notes

- `apps/server/src/services/song-detection.ts` -- new file, alongside existing `song-pool.ts`, `suggestion-engine.ts`
- `apps/server/src/integrations/youtube-data.ts` -- modified (add `fetchVideoDetails` export)
- `apps/server/src/services/session-manager.ts` -- modified (update pairTv nowPlaying callback)
- `apps/server/src/services/event-stream.ts` -- modified (update SessionEvent `song:detected` type to include title + artist)
- `apps/server/src/shared/schemas/tv-schemas.ts` -- modified (add songDetectedSchema)
- `apps/flutter_app/lib/widgets/now_playing_bar.dart` -- new file
- `apps/flutter_app/lib/state/party_provider.dart` -- modified (add detected song fields)
- `apps/flutter_app/lib/socket/client.dart` -- modified (add song:detected listener)
- `apps/flutter_app/lib/screens/party_screen.dart` -- modified (add NowPlayingBar)
- `apps/flutter_app/lib/constants/copy.dart` -- modified (add now-playing copy)

### Previous Story Intelligence (5.7: TV Pairing & YouTube Lounge API)

- **SONG_DETECTED already emitted** from `pairTv()` onNowPlaying callback -- currently with just `{ videoId }`. This story enhances it with full metadata
- **TV integration callback pattern**: `tv.onNowPlaying((event) => { ... })` registered in `pairTv()`. The callback receives `NowPlayingEvent { videoId, title?, state }`
- **Fire-and-forget pattern**: Used for non-critical async ops (`.catch()` swallows errors). TV auto-queue uses this same pattern
- **Test pattern**: Separate test files per concern. `session-manager-tv.test.ts` tests TV-specific behavior. Follow same split: `session-manager-detection.test.ts`
- **Mock injection**: `setTvFactory()` enables test mocking without module-level mocks. Song detection should follow similar pattern if needed
- **Host guard**: Not needed for song detection -- it's triggered by server-side TV events, not client actions
- **Code review lessons from 5.7**: Disconnect existing connection before creating new one (leak prevention), wrap handlers in try/catch, use null-safe optional chaining

### Git Intelligence

Recent commits (all on `flutter-native-pivot` branch):
- `f362aec` Story 5.7: TV Pairing & YouTube Lounge API -- 18 files, established TV integration patterns
- `f0dec8f` Story 5.6: Spin the Wheel -- established song selection patterns
- `1d4f623` Story 5.5: Quick Pick -- established voting and song card patterns
- All stories follow: service + schemas + events + socket-handler + session-manager update + Flutter widget + provider update + socket client update + tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Story 5.8]
- [Source: _bmad-output/planning-artifacts/architecture.md, Event stream schema -- song:detected type]
- [Source: _bmad-output/planning-artifacts/architecture.md, Integration layer -- YouTube Data API lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture.md, NFR29-33 -- quota management]
- [Source: _bmad-output/planning-artifacts/prd.md, FR76-FR77]
- [Source: _bmad-output/planning-artifacts/prd.md, NFR30 -- API quota]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: _bmad-output/implementation-artifacts/5-7-tv-pairing-and-youtube-lounge-api.md, Previous story learnings]
- [Source: YouTube Data API v3 -- videos.list endpoint, part=snippet,contentDetails]

## Change Log

- Implemented Song Detection & Metadata Resolution (Story 5.8) - all 8 tasks complete with full test coverage (Date: 2026-03-17)
- Code review fixes applied (Date: 2026-03-17): H1 detected song state leak on session end, M1 dead clearDetectionCache removed, M2 50-ID guard added to fetchVideoDetails, M3 Copy.nowPlaying used in NowPlayingBar, L2 optional chaining for thumbnails, L3 trailing icon changed to graphic_eq

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Server tests: 71 files, 1007 passed, 0 failures
- Flutter tests: 506 passed, 2 pre-existing failures (tag_team_flash_widget.dart and playlist_import_card_test.dart — both unrelated to this story)

### Completion Notes List

- Task 1: Added `fetchVideoDetails()` to `youtube-data.ts` with VideoDetails interface, videos.list endpoint, retry logic, batch support up to 50 IDs
- Task 2: Created `song-detection.ts` with three-tier resolution (cache -> catalog -> API), global detection cache, `resetDetectionCache()` for tests
- Task 3: Updated `pairTv()` onNowPlaying callback — separate TV_NOW_PLAYING (immediate) and SONG_DETECTED (async with metadata) events, fire-and-forget detection, markSongSung integration
- Task 4: Added `songDetectedSchema` to tv-schemas.ts, updated SessionEvent `song:detected` type to include `{ videoId, title, artist }`
- Task 5: Added detected song fields to PartyProvider (`_detectedSongTitle`, `_detectedArtist`, `_detectedThumbnail`, `_detectedSource`), setDetectedSong/clearDetectedSong mutations in SocketClient, clear on TV disconnect and idle
- Task 6: Created NowPlayingBar widget (compact bar with thumbnail, song title, artist, music note icon), integrated into PartyScreen during song state (hidden in lightstick mode)
- Task 7: Created 3 server test files: youtube-data-video-details (9 tests), song-detection (9 tests), session-manager-detection (6 tests). Updated existing session-manager-tv test for new callback behavior
- Task 8: Created now_playing_bar_test (4 tests), added detected song tests to party_provider_test (5 tests)
- Note: Story spec referenced `DJState.bridge` for NowPlayingBar visibility, but this state doesn't exist in the Flutter enum. Showed during `DJState.song` only (the relevant state when songs are playing)

### File List

**New files:**
- apps/server/src/services/song-detection.ts
- apps/server/tests/integrations/youtube-data-video-details.test.ts
- apps/server/tests/services/song-detection.test.ts
- apps/server/tests/services/session-manager-detection.test.ts
- apps/flutter_app/lib/widgets/now_playing_bar.dart
- apps/flutter_app/test/widgets/now_playing_bar_test.dart

**Modified files:**
- apps/server/src/integrations/youtube-data.ts (added fetchVideoDetails, VideoDetails interface)
- apps/server/src/services/session-manager.ts (updated pairTv onNowPlaying callback, added detectSong import)
- apps/server/src/services/event-stream.ts (updated song:detected SessionEvent type)
- apps/server/src/shared/schemas/tv-schemas.ts (added songDetectedSchema)
- apps/server/tests/services/session-manager-tv.test.ts (added song-detection mock, updated nowPlaying test)
- apps/flutter_app/lib/state/party_provider.dart (added detected song fields, getters, mutations)
- apps/flutter_app/lib/socket/client.dart (added song:detected listener, clear on idle/disconnect)
- apps/flutter_app/lib/screens/party_screen.dart (added NowPlayingBar import and positioning)
- apps/flutter_app/lib/constants/copy.dart (added nowPlaying, unknownSong, unknownArtist)
- apps/flutter_app/test/state/party_provider_test.dart (added detected song test group)

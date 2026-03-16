# Story 5.3: Playlist Import - Spotify

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to paste my Spotify playlist link and have my songs imported,
So that Spotify users can contribute their music taste to the group.

## Acceptance Criteria

1. **Given** a participant pastes a URL, **When** the URL matches `open.spotify.com`, **Then** the system detects it as a Spotify playlist (FR80)
2. **Given** a Spotify playlist URL is detected, **When** the import begins, **Then** public playlist contents are read via the Spotify Web API Client Credentials flow -- no user login required (FR82)
3. **Given** a Spotify playlist URL is detected, **When** the import begins, **Then** the Spotify Client Credentials token is managed server-side with automatic refresh before expiry (NFR33)
4. **Given** a Spotify playlist URL is detected, **When** the import begins, **Then** no token exposure to the client (NFR33)
5. **Given** a Spotify playlist URL is detected, **When** import completes, **Then** it completes within 5 seconds for playlists of up to 200 tracks (NFR29)
6. **Given** a Spotify playlist is private and cannot be read, **When** the import fails, **Then** the system displays a 3-step visual guide instructing the user to make their playlist public, then retry (FR83)

## Tasks / Subtasks

- [x] Task 1: Create Spotify integration module (AC: #2, #3, #4, #5)
  - [x] 1.1 Create `apps/server/src/integrations/spotify-data.ts`
  - [x] 1.2 Implement `extractPlaylistId(url: string): string | null` -- extract playlist ID from Spotify URLs (`open.spotify.com/playlist/{id}`, with optional query params `?si=...`). Return null for non-playlist Spotify URLs (tracks, albums, artists, users)
  - [x] 1.3 Implement `getClientCredentialsToken(clientId: string, clientSecret: string): Promise<{ accessToken: string; expiresAt: number }>` -- POST to `https://accounts.spotify.com/api/token` with `grant_type=client_credentials`, Basic auth header (`base64(clientId:clientSecret)`). Cache token in module-level variable, return cached if not expired (subtract 60s buffer). This keeps token management server-side per NFR33
  - [x] 1.4 Implement `fetchPlaylistTracks(playlistId: string, clientId: string, clientSecret: string): Promise<PlaylistResult>` -- GET `https://api.spotify.com/v1/playlists/{id}/tracks?fields=items(track(name,artists(name),external_urls(spotify),is_local)),next,total&limit=100`. Use `next` URL for pagination (Spotify returns full URL). Max 100 items per page. Cap at 500 tracks (5 pages) to guarantee NFR29 5-second compliance -- if total > 500, import first 500 and note in response
  - [x] 1.5 Implement retry logic with exponential backoff on 429/5xx errors (max 3 retries) -- reuse same pattern as `integrations/youtube-data.ts`. On 429, Spotify returns `Retry-After` header (seconds) -- use that as delay instead of exponential backoff if present
  - [x] 1.6 Map Spotify track data to `PlaylistTrack` type: `{ songTitle: track.name, artist: track.artists[0].name, youtubeVideoId: '' }`. Set `youtubeVideoId` to empty string since Spotify tracks don't have YouTube IDs. **DO NOT call `parseKaraokeTitle()`** -- Spotify API returns structured artist/title fields, no parsing needed. **Filter out**: (a) items where `item.track === null` (removed/unavailable tracks), (b) items where `item.track.is_local === true` (local files from user's computer -- these won't match the karaoke catalog and have incomplete metadata)
  - [x] 1.7 Handle private/not-found playlists: Spotify returns 404 for not-found, 403 for private. On 403, throw `Error` with message containing `'private'` keyword so the route handler can detect and return `PLAYLIST_PRIVATE` error code
  - [x] 1.8 Return `PlaylistResult` type (same as youtube-data.ts): `{ tracks: PlaylistTrack[], unparseable: number, totalFetched: number }`. `unparseable` will always be 0 for Spotify (structured data), `totalFetched` = total tracks from API response
  - [x] 1.9 Export a `resetTokenCache()` function that clears the module-level cached token (for test cleanup in `afterEach`)
  - [x] 1.10 Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are listed in `apps/server/.env.example`

- [x] Task 2: Update playlist route to support Spotify URLs (AC: #1, #2, #6)
  - [x] 2.1 In `apps/server/src/routes/playlists.ts`, add import of `extractPlaylistId as extractSpotifyId, fetchPlaylistTracks as fetchSpotifyTracks` from `../integrations/spotify-data.js`
  - [x] 2.2 In the `POST /api/playlists/import` handler, detect platform from URL: try `extractPlaylistId()` (YouTube) first, then `extractSpotifyId()` (Spotify). If neither matches, return 400 `INVALID_PLAYLIST_URL`
  - [x] 2.3 For Spotify URLs, call `fetchSpotifyTracks(playlistId, config.SPOTIFY_CLIENT_ID, config.SPOTIFY_CLIENT_SECRET)`
  - [x] 2.4 Catalog matching works identically -- `catalogRepository.intersectWithSongs(titles, artists)` since Spotify provides clean title/artist data
  - [x] 2.5 Add specific error handling for Spotify: catch errors with `'private'` in message -> return 403 `{ error: { code: 'PLAYLIST_PRIVATE', message: 'This playlist is private. Make it public in your Spotify app and try again.' } }`. Other Spotify errors -> 502 `SPOTIFY_API_FAILED`. **CRITICAL**: Add `403: errorResponseSchema` to the route's `schema.response` object alongside the existing 200/400/502 definitions so Fastify serialization handles the 403 response correctly
  - [x] 2.6 Response format stays identical to YouTube import: `{ data: { tracks, matched, unmatchedCount, totalFetched } }`

- [x] Task 3: Update Flutter PlaylistImportCard for Spotify support (AC: #1, #6)
  - [x] 3.1 In `apps/flutter_app/lib/widgets/playlist_import_card.dart`, replace `_isYouTubeMusicDetected` bool (line 18) with `_detectedPlatform` as a nullable string (`String?`): set to `'youtube'` for YouTube Music URLs, `'spotify'` for Spotify URLs, `null` when no valid URL detected. Update `_onUrlChanged()` to set this: check `open.spotify.com/playlist` for Spotify, keep existing YouTube check
  - [x] 3.2 Update detection label to use `_detectedPlatform`: if `'youtube'` show `Copy.playlistImportDetected`, if `'spotify'` show `Copy.playlistImportDetectedSpotify`. Update import button enabled condition: `_detectedPlatform != null`
  - [x] 3.3 Handle `PLAYLIST_PRIVATE` error response: the existing catch block is `on ApiException { partyProvider.onPlaylistImportError(); }` (line 50) -- it does NOT capture the exception variable. Change to `on ApiException catch (e) { ... }` to access `e.code`. Then branch: if `e.code == 'PLAYLIST_PRIVATE'` -> set `_isPrivateError = true` + call `partyProvider.onPlaylistImportError()`; else -> just call `partyProvider.onPlaylistImportError()`. The `ApiException.code` field is already populated from the error response body via `_mapException()` in api_service.dart
  - [x] 3.4 Add `_isPrivateError` state bool to track when to show SpotifyGuide vs generic error
  - [x] 3.5 On retry from SpotifyGuide, reset `_isPrivateError` and re-trigger import

- [x] Task 4: Create SpotifyGuide widget (AC: #6)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/spotify_guide.dart` -- inline 3-step visual guide for private Spotify playlists (FR83). Widget key: `Key('spotify-guide')`
  - [x] 4.2 Three numbered steps with visual clarity: (1) "Open your Spotify app", (2) "Tap ••• on your playlist > Make Public", (3) "Come back and paste the link again"
  - [x] 4.3 Props: `onRetry` callback. "Try Again" button at bottom triggers `onRetry`
  - [x] 4.4 No dialog, no navigation away -- inline display replacing the error state in PlaylistImportCard
  - [x] 4.5 All copy strings in `constants/copy.dart`. All styling via `DJTokens`

- [x] Task 5: Update copy strings (AC: #1, #6)
  - [x] 5.1 In `apps/flutter_app/lib/constants/copy.dart`, update `playlistImportHint` to `'Paste YouTube Music or Spotify playlist URL'`
  - [x] 5.2 Add `playlistImportDetectedSpotify = 'Spotify playlist detected'`
  - [x] 5.3 Add `spotifyGuideTitle = 'This playlist is private'`
  - [x] 5.4 Add `spotifyGuideStep1 = 'Open your Spotify app'`
  - [x] 5.5 Add `spotifyGuideStep2 = 'Tap ••• on your playlist → Make Public'`
  - [x] 5.6 Add `spotifyGuideStep3 = 'Come back and paste the link again'`
  - [x] 5.7 Add `spotifyGuideRetry = 'Try Again'`

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1 Create `apps/server/tests/integrations/spotify-data.test.ts` -- unit test `extractPlaylistId()` with various URL formats and `fetchPlaylistTracks()` with mocked fetch
  - [x] 6.2 Test URL extraction: `open.spotify.com/playlist/abc123`, `open.spotify.com/playlist/abc123?si=xyz`, `spotify.com/playlist/abc123` (no `open.` prefix should still work), invalid URLs (track, album, artist, user profile), null returns
  - [x] 6.3 Test token management: `getClientCredentialsToken()` makes correct POST to Spotify accounts API, caches token, refreshes when expired (minus 60s buffer), handles auth errors (invalid credentials). Use `resetTokenCache()` in `afterEach` to clear cached token between tests
  - [x] 6.4 Test playlist fetching: single page response, multi-page pagination (follow `next` URL), empty playlist, private playlist (403 -> error with 'private'), not found (404), API errors (429 with Retry-After, 5xx), retry logic
  - [x] 6.5 Test structured data mapping: Spotify track `{ name, artists[0].name }` maps correctly to `PlaylistTrack`, tracks with multiple artists use first artist, null tracks in items are skipped (removed/unavailable tracks), tracks with `is_local: true` are skipped (local files)
  - [x] 6.6 Update `apps/server/tests/routes/playlists.test.ts` -- add `vi.mock('../src/integrations/spotify-data.js', ...)` alongside the existing `youtube-data` mock. For Spotify tests: mock YouTube's `extractPlaylistId` to return null and Spotify's to return the ID (and vice versa for existing YouTube tests). Add tests: valid Spotify URL import, private playlist (403 with PLAYLIST_PRIVATE code), Spotify API failure (502), Spotify URL detection alongside existing YouTube tests
  - [x] 6.7 Create `apps/flutter_app/test/widgets/spotify_guide_test.dart` -- widget test for 3-step display, retry button triggers callback
  - [x] 6.8 Update `apps/flutter_app/test/widgets/playlist_import_card_test.dart` -- add Spotify URL detection test, private playlist error shows SpotifyGuide

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All Spotify API calls are server-side. Flutter sends URL, server handles OAuth token management, playlist fetching, and catalog matching
- **REST endpoint**: Same `POST /api/playlists/import` endpoint handles both YouTube and Spotify (FR80 platform detection). Single unified endpoint per architecture
- **Integration boundary**: `integrations/spotify-data.ts` handles all Spotify Web API calls. Named `spotify-data.ts` to parallel `youtube-data.ts`. Architecture spec shows the file as `spotify.ts` but `spotify-data.ts` is more consistent with the existing pattern
- **Token management**: Server-side only (NFR33). Client never sees Spotify tokens. Module-level caching with expiry buffer
- **Persistence boundary**: Route calls `catalogRepository.intersectWithSongs()` for matching, same as YouTube flow
- **Casing rules**: DB columns `snake_case`, Zod schemas transform at REST boundary to `camelCase`
- **Import rules**: Relative imports with `.js` extension. No barrel files. No tsconfig aliases
- **File naming**: `kebab-case.ts` for TS files, `snake_case.dart` for Flutter files

### Key Implementation Patterns

1. **Spotify Web API Client Credentials Flow** (NFR33):
   ```typescript
   // integrations/spotify-data.ts
   // Token endpoint: POST https://accounts.spotify.com/api/token
   // Headers: { Authorization: 'Basic ' + base64(clientId + ':' + clientSecret), 'Content-Type': 'application/x-www-form-urlencoded' }
   // Body: 'grant_type=client_credentials'
   // Response: { access_token: string, token_type: 'bearer', expires_in: number }
   //
   // Cache token in module-level variable. Refresh when Date.now() >= expiresAt - 60000
   // CRITICAL: Use native fetch() -- same as youtube-data.ts. No axios or other HTTP library
   ```

2. **Spotify Playlist Tracks API**:
   ```typescript
   // GET https://api.spotify.com/v1/playlists/{id}/tracks
   // Headers: { Authorization: 'Bearer ' + accessToken }
   // Query: fields=items(track(name,artists(name),external_urls(spotify),is_local)),next,total&limit=100
   // The `fields` parameter reduces response size (Spotify returns a LOT of data without it)
   //
   // Response shape:
   // { items: [{ track: { name: string, artists: [{ name: string }], external_urls: { spotify: string }, is_local: boolean } | null }], next: string | null, total: number }
   //
   // CRITICAL: Filter out TWO cases:
   // 1. item.track === null → removed/unavailable tracks
   // 2. item.track.is_local === true → local files (user's computer, won't match catalog, incomplete metadata)
   // Pagination: `next` is a full URL, just GET it directly with same auth header
   ```

3. **URL extraction** -- Spotify playlist URLs:
   ```
   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123
   ```
   Extract the playlist ID segment after `/playlist/`. Guard against non-playlist Spotify URLs:
   - `open.spotify.com/track/...` -- reject
   - `open.spotify.com/album/...` -- reject
   - `open.spotify.com/artist/...` -- reject

4. **Route handler update pattern** -- extend existing `playlists.ts`:
   ```typescript
   // routes/playlists.ts -- add platform detection
   import { extractPlaylistId as extractSpotifyId, fetchPlaylistTracks as fetchSpotifyTracks } from '../integrations/spotify-data.js';

   // In handler:
   const youtubeId = extractPlaylistId(playlistUrl);
   const spotifyId = extractSpotifyId(playlistUrl);

   if (!youtubeId && !spotifyId) {
     return reply.status(400).send({ error: { code: 'INVALID_PLAYLIST_URL', message: '...' } });
   }

   try {
     const result = youtubeId
       ? await fetchPlaylistTracks(youtubeId, config.YOUTUBE_API_KEY)
       : await fetchSpotifyTracks(spotifyId!, config.SPOTIFY_CLIENT_ID, config.SPOTIFY_CLIENT_SECRET);
     // ... rest identical (intersectWithSongs, toTrackResponse, etc.)
   } catch (error) {
     const msg = (error as Error).message;
     if (msg.includes('private')) {
       return reply.status(403).send({ error: { code: 'PLAYLIST_PRIVATE', message: msg } });
     }
     const code = youtubeId ? 'YOUTUBE_API_FAILED' : 'SPOTIFY_API_FAILED';
     return reply.status(502).send({ error: { code, message: msg } });
   }
   ```

5. **Spotify vs YouTube data differences**:
   - YouTube: title parsing needed via `parseKaraokeTitle()` (video titles are "Artist - Song (Karaoke)")
   - Spotify: structured data -- `track.name` = song title, `track.artists[0].name` = artist. **NO title parsing needed**
   - YouTube: `youtubeVideoId` from snippet
   - Spotify: no YouTube video ID. Set `youtubeVideoId: ''` in `PlaylistTrack`. The frontend doesn't use this field for display (it only shows song/artist). Catalog matching via `intersectWithSongs` will find the YouTube video ID from the catalog anyway

6. **Error codes for this story**:
   - `INVALID_PLAYLIST_URL` (400) -- URL doesn't match any supported platform (already exists)
   - `PLAYLIST_PRIVATE` (403) -- Spotify playlist is private (NEW)
   - `SPOTIFY_API_FAILED` (502) -- Spotify API returned non-retryable error (NEW)

7. **SpotifyGuide widget** (FR83):
   ```dart
   // widgets/spotify_guide.dart
   // Inline 3-step guide, no dialog/modal
   // Widget key: Key('spotify-guide')
   // Props: onRetry callback
   // Steps: numbered 1-2-3 with text from copy.dart
   // "Try Again" button at bottom
   // All spacing via DJTokens
   ```

8. **Flutter PlaylistImportCard update**:
   ```dart
   // Replace _isYouTubeMusicDetected (bool) with _detectedPlatform (String?):
   // In _onUrlChanged():
   //   if url.contains('open.spotify.com/playlist') -> _detectedPlatform = 'spotify'
   //   else if url.contains('music.youtube.com') || (url.contains('youtube.com') && url.contains('list=')) -> _detectedPlatform = 'youtube'
   //   else -> _detectedPlatform = null
   // Detection label: _detectedPlatform == 'youtube' ? Copy.playlistImportDetected : Copy.playlistImportDetectedSpotify
   // Import button enabled: _detectedPlatform != null
   //
   // In error handling: change existing `on ApiException {` to `on ApiException catch (e) {`
   // Then: if (e.code == 'PLAYLIST_PRIVATE') { setState(() => _isPrivateError = true); }
   //       partyProvider.onPlaylistImportError(); // always call this
   // In build(): if (_isPrivateError) show SpotifyGuide(onRetry: ...) instead of _buildError()
   ```

### Spotify API Specifics

- **Rate limits**: Spotify enforces rate limits with 429 + `Retry-After` header (seconds). Free tier has generous limits for Client Credentials (no per-user quotas since no user auth)
- **Local files**: Spotify playlists can contain local files (user's computer). These have `is_local: true` on the track object with partial metadata. Separately, removed/unavailable tracks appear as `{ track: null }`. Filter out both cases
- **Collaborative playlists**: Work identically to regular public playlists via the API
- **Max playlist size**: Spotify allows up to 10,000 tracks. With 100 items/page, that's 100 pages max. Hard cap at 500 tracks (5 pages) to guarantee NFR29 5-second compliance
- **Track availability**: Some tracks may not have `external_urls.spotify`. Still import them (title/artist matching works regardless)

### Config (Already Set Up)

`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are already defined in `apps/server/src/config.ts` (lines 12-13). Just use `config.SPOTIFY_CLIENT_ID` and `config.SPOTIFY_CLIENT_SECRET`. No new env vars needed. Ensure `.env` and `.env.example` have these values for local dev.

### Database Schema

**No new migration needed.** Uses existing `karaoke_catalog` table for matching via `intersectWithSongs()`. Imported playlist data is transient (returned in response, not persisted).

### What This Story Does NOT Include

- No YouTube Music changes (already implemented in Story 5.2)
- No suggestion engine / ranking logic (Story 5.4)
- No Quick Pick or Spin the Wheel UI (Stories 5.5, 5.6)
- No Spotify user login / OAuth Authorization Code flow -- Client Credentials only
- No persisting imported tracks to a database table
- No socket events for import (REST-only per architecture)

### Project Structure Notes

New files to create:
```
apps/server/
└── src/
    └── integrations/
        └── spotify-data.ts              # NEW

apps/server/
└── tests/
    └── integrations/
        └── spotify-data.test.ts         # NEW

apps/flutter_app/
├── lib/
│   └── widgets/
│       └── spotify_guide.dart           # NEW
└── test/
    └── widgets/
        └── spotify_guide_test.dart      # NEW
```

Files to modify:
```
apps/server/src/routes/playlists.ts                   # Add Spotify platform detection + error handling
apps/server/tests/routes/playlists.test.ts             # Add Spotify URL tests
apps/flutter_app/lib/widgets/playlist_import_card.dart  # Add Spotify URL detection + SpotifyGuide integration
apps/flutter_app/lib/constants/copy.dart               # Add Spotify-related copy strings
apps/flutter_app/test/widgets/playlist_import_card_test.dart  # Add Spotify tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Integration Layer - Spotify Web API]
- [Source: _bmad-output/planning-artifacts/architecture.md#REST API - /api/playlists/import]
- [Source: _bmad-output/planning-artifacts/architecture.md#integrations/spotify.ts]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#SpotifyGuide widget]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Spotify Private Playlist Guidance FR83]
- [Source: _bmad-output/planning-artifacts/prd.md#FR80, FR82, FR83, NFR29, NFR33]
- [Source: _bmad-output/project-context.md#Server Boundaries]
- [Source: apps/server/src/config.ts#SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET (lines 12-13)]
- [Source: apps/server/src/integrations/youtube-data.ts#Integration pattern reference]
- [Source: apps/server/src/routes/playlists.ts#Route handler to extend]
- [Source: apps/server/src/persistence/catalog-repository.ts#intersectWithSongs]

### Previous Story Intelligence (from Story 5.2)

- **Unified endpoint**: `POST /api/playlists/import` already exists with YouTube support. Extend it, don't create a new endpoint
- **PlaylistTrack type**: `{ songTitle: string; artist: string; youtubeVideoId: string }` -- reuse this. For Spotify tracks, `youtubeVideoId` will be empty string
- **PlaylistResult type**: `{ tracks: PlaylistTrack[], unparseable: number, totalFetched: number }` -- reuse this exactly
- **Route pattern**: Don't use `fastify.withTypeProvider<ZodTypeProvider>()` -- type provider is set globally
- **Schema registration**: Use `z.globalRegistry.add()`. Import before swagger init
- **toTrackResponse()**: Already exists in `routes/playlists.ts` for snake_case->camelCase transform of catalog matches
- **ApiService.importPlaylist()**: Already exists in Flutter. No changes needed -- same endpoint, same response shape
- **PartyProvider**: Playlist import state already exists. No changes needed -- state is platform-agnostic
- **Error handling**: Route uses `reply.status(N).send({ error: { code, message } })`. Do NOT throw AppError (plain interface, not Error subclass)
- **Title parser refactor**: `parseKaraokeTitle` was extracted to `shared/title-parser.ts` in 5.2. Not needed for Spotify (structured data)
- **Pre-existing Flutter test failure**: `party_screen_test.dart` has unrelated `DJTokens.actionPrimary` compilation error in `tag_team_flash_widget.dart` -- not introduced by any playlist story
- **Test counts**: Server: 764 tests (53 files). Flutter: 446 pass, 1 pre-existing fail

### Git Intelligence (from recent commits)

- Last commit: `26e2e34 Implement Story 5.2: Playlist Import - YouTube Music`
- Story 5.2 created: `youtube-data.ts`, `playlists.ts` (route), `playlist-schemas.ts`, `title-parser.ts`, `playlist_import_card.dart`
- Pattern: comprehensive stories with all tasks completed and tested before commit
- Test approach: mock `fetch` globally for integration tests, mock persistence layer for route tests, widget tests use `MockApiService`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed `importPlaylist()` in `api_service.dart` to throw local `ApiException` (with `code` field) instead of `runtime.ApiException`, enabling `e.code == 'PLAYLIST_PRIVATE'` check in PlaylistImportCard

### Completion Notes List

- Task 1: Created `spotify-data.ts` with `extractPlaylistId`, `getClientCredentialsToken`, `fetchPlaylistTracks`, `resetTokenCache`. Reuses `PlaylistTrack`/`PlaylistResult` types from `youtube-data.ts`. Token caching with 60s buffer. Retry with Retry-After header support. Filters null and local tracks. 500 track cap (5 pages)
- Task 2: Extended `POST /api/playlists/import` with Spotify platform detection (YouTube checked first). Added 403 PLAYLIST_PRIVATE error code and SPOTIFY_API_FAILED 502. Added 403 to schema.response
- Task 3: Replaced `_isYouTubeMusicDetected` bool with `_detectedPlatform` String?. Added `_isPrivateError` state for SpotifyGuide display. Fixed `on ApiException catch (e)` to access error code
- Task 4: Created `SpotifyGuide` widget with 3 numbered steps and retry button. Inline display, no dialog
- Task 5: Added 7 new copy strings for Spotify detection and guide. Updated hint text to include Spotify
- Task 6: 25 new server tests (spotify-data.test.ts), 4 new route tests (Spotify import, private, API failure, priority), 4 new Flutter widget tests (SpotifyGuide), 3 new PlaylistImportCard tests (Spotify detection, button enable, private error guide)
- Additional: Updated `importPlaylist()` in `api_service.dart` to throw local `ApiException` with parsed error code (was throwing `runtime.ApiException` which lacked the `code` field needed by the widget)

### Change Log

- 2026-03-16: Implemented Story 5.3 - Spotify playlist import support (all 6 tasks complete)
- 2026-03-16: Code review fixes — [H1] Flutter URL detection now matches server (accepts `spotify.com/playlist`), [H2] SpotifyGuide retry now re-triggers import per Task 3.5, [M1] Added 500-track cap test, [M2] Added SpotifyGuide retry flow test, [M3] `_isPrivateError` resets on URL change

### File List

New files:
- apps/server/src/integrations/spotify-data.ts
- apps/server/tests/integrations/spotify-data.test.ts
- apps/flutter_app/lib/widgets/spotify_guide.dart
- apps/flutter_app/test/widgets/spotify_guide_test.dart

Modified files:
- apps/server/src/routes/playlists.ts
- apps/server/tests/routes/playlists.test.ts
- apps/flutter_app/lib/widgets/playlist_import_card.dart
- apps/flutter_app/lib/constants/copy.dart
- apps/flutter_app/lib/api/api_service.dart
- apps/flutter_app/test/widgets/playlist_import_card_test.dart
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/5-3-playlist-import-spotify.md

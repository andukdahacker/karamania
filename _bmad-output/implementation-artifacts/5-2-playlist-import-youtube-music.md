# Story 5.2: Playlist Import - YouTube Music

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want to paste my YouTube Music playlist link and have my songs imported,
So that my music taste contributes to the group's song suggestions.

## Acceptance Criteria

1. **Given** a participant pastes a URL, **When** the URL matches `music.youtube.com`, **Then** the system detects it as a YouTube Music playlist (FR80)
2. **Given** a YouTube Music playlist URL is detected, **When** the import begins, **Then** playlist contents are read via the YouTube Data API v3 using an API key -- no user login required (FR81)
3. **Given** a YouTube Music playlist URL is detected, **When** the import begins, **Then** paginated retrieval handles playlists with 50+ tracks (FR81)
4. **Given** a YouTube Music playlist URL, **When** import completes, **Then** it completes within 5 seconds for playlists of up to 200 tracks (NFR29)
5. **Given** API usage during a party, **When** playlist imports happen, **Then** API usage remains within the free tier quota: <500 units per session, 10,000 units per day (NFR30)

## Tasks / Subtasks

- [x] Task 1: Create YouTube Data integration module (AC: #2, #3, #4, #5)
  - [x] 1.1 Create `apps/server/src/integrations/youtube-data.ts`
  - [x] 1.2 Implement `extractPlaylistId(url: string): string | null` -- extract playlist ID from YouTube Music URLs (`music.youtube.com/playlist?list=...`). Support URL formats: full URL with query params, mobile share links, and regular `youtube.com/playlist?list=...` as well (FR80)
  - [x] 1.3 Implement `fetchPlaylistTracks(playlistId: string, apiKey: string): Promise<PlaylistTrack[]>` -- paginated retrieval using YouTube Data API v3 `playlistItems` endpoint (FR81). Reuse the same fetch + retry pattern from `scripts/scrape-catalog.ts` but as a reusable module
  - [x] 1.4 Handle pagination via `nextPageToken` with 50 items per page max
  - [x] 1.5 Implement retry logic with exponential backoff on 429/5xx errors (max 3 retries) -- same pattern as `scripts/scrape-catalog.ts`
  - [x] 1.6 Implement `parsePlaylistTitle(title: string): { songTitle: string; artist: string } | null` -- extract title parsing logic into a shared utility at `apps/server/src/shared/title-parser.ts` and export it from there. Move `parseKaraokeTitle()` from `scripts/scrape-catalog.ts` into the same file and re-export from the script to avoid breaking existing code. This prevents side-effect imports (scraper top-level loads dotenv and db connection). Both the scraper and this integration module import from the shared utility
  - [x] 1.7 Return structured result: `{ tracks: PlaylistTrack[], unparseable: number, totalFetched: number }` where `PlaylistTrack = { songTitle: string; artist: string; youtubeVideoId: string }`
  - [x] 1.8 On non-retryable API errors (invalid key, quota exceeded, playlist not found), throw a standard `Error` with a descriptive message. The route handler catches it and returns the appropriate HTTP error response using `reply.status(N).send({ error: { code, message } })`. Do NOT throw `AppError` -- it is a plain interface, not an Error subclass

- [x] Task 2: Create playlist Zod schemas and OpenAPI registration (AC: #1, #2)
  - [x] 2.1 Create `apps/server/src/shared/schemas/playlist-schemas.ts` -- use `import { z } from 'zod/v4'`
  - [x] 2.2 Define `playlistImportRequestSchema` with `playlistUrl: z.string().url()` in request body
  - [x] 2.3 Define `playlistTrackSchema` with `{ songTitle, artist, youtubeVideoId }` (camelCase)
  - [x] 2.4 Reuse `catalogTrackSchema` from `catalog-schemas.js` directly for matched tracks array (no separate alias schema needed)
  - [x] 2.5 Define `playlistImportResponseSchema` using `dataResponseSchema()` wrapper from `common-schemas.js`. The wrapper produces `{ data: { ...inner } }`. Inner schema: `{ tracks: z.array(playlistTrackSchema), matched: z.array(catalogTrackSchema), unmatchedCount: z.number(), totalFetched: z.number() }`
  - [x] 2.6 Register ALL schemas with `z.globalRegistry.add()` for OpenAPI `$ref` generation

- [x] Task 3: Create playlist REST route (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Create `apps/server/src/routes/playlists.ts` as Fastify plugin
  - [x] 3.2 `POST /api/playlists/import` -- accepts `{ playlistUrl }`, validates URL matches YouTube Music pattern, fetches playlist, matches against catalog, returns results
  - [x] 3.3 URL validation: reject URLs that don't match `music.youtube.com` or `youtube.com` with a playlist list parameter. Return `{ error: { code: 'INVALID_PLAYLIST_URL', message: '...' } }` (400)
  - [x] 3.4 Extract playlist ID using `extractPlaylistId()` from `integrations/youtube-data.js`
  - [x] 3.5 Fetch playlist tracks using `fetchPlaylistTracks()` from `integrations/youtube-data.js`
  - [x] 3.6 Match imported tracks against catalog using `catalogRepository.intersectWithSongs()` from `persistence/catalog-repository.js`. **CRITICAL**: `intersectWithSongs` uses exact ILIKE match (no `%` wildcards) -- it requires titles/artists to match exactly (case-insensitive). This works for clean YouTube Music titles matching clean catalog entries. If match rates are poor, consider adding a fuzzy variant with `%` wildcards in a follow-up, but for MVP exact match is acceptable
  - [x] 3.7 Transform catalog matches from snake_case to camelCase using `toTrackResponse()` helper (see `routes/catalog.ts` line 12-23 for exact pattern). Return response: `{ data: { tracks: [...importedTracks], matched: [...catalogMatches.map(toTrackResponse)], unmatchedCount: N, totalFetched: N } }`
  - [x] 3.8 Error handling: wrap handler body in try/catch. Catch errors from youtube-data integration and return appropriate HTTP error responses using `reply.status(N).send({ error: { code: 'YOUTUBE_API_FAILED', message: error.message } })`. Do NOT throw or catch `AppError` objects -- they are plain interfaces
  - [x] 3.9 Register routes in `index.ts`: add `await import('./shared/schemas/playlist-schemas.js');` after line 37 (before swagger init), add `import { playlistRoutes } from './routes/playlists.js';` at top, and `await fastify.register(playlistRoutes);` after line 56 (after catalogRoutes)

- [x] Task 4: Create Flutter playlist import UI (AC: #1)
  - [x] 4.1 Create `apps/flutter_app/lib/widgets/playlist_import_card.dart` -- a card widget placed in the **lobby screen** (`lobby_screen.dart`) visible to **all participants** (host and guests). This is where participants import playlists before the party starts. Widget key: `Key('playlist-import-card')`
  - [x] 4.2 Implement URL paste field with auto-detection: when text matches `music.youtube.com`, show "YouTube Music playlist detected" confirmation
  - [x] 4.3 Import button triggers REST call via `ApiService` to `POST /api/playlists/import`
  - [x] 4.4 Show `LoadingState` progress during import (`playlistImportState` on provider, not global)
  - [x] 4.5 Display results: number of tracks imported, number matched to karaoke catalog, number unmatched
  - [x] 4.6 Error state: show error message with retry button for failed imports
  - [x] 4.7 All copy strings in `constants/copy.dart`
  - [x] 4.8 Use `DJTokens` for all spacing, colors, typography -- no hardcoded values

- [x] Task 5: Add ApiService method for playlist import (AC: #2)
  - [x] 5.1 Add `importPlaylist(String playlistUrl)` method to `apps/flutter_app/lib/api/api_service.dart`
  - [x] 5.2 Call the generated OpenAPI client method (after running dart-open-fetch) OR use manual HTTP POST if generated client doesn't cover it
  - [x] 5.3 Return structured result matching the response schema
  - [x] 5.4 Handle errors via existing `_mapException()` pattern

- [x] Task 6: Update PartyProvider with playlist import state (AC: #1)
  - [x] 6.1 Add `_playlistImportState` (LoadingState), `_importedTracks` (list), `_matchedTracks` (list), `_unmatchedCount` (int) to `PartyProvider`
  - [x] 6.2 Add public getters for all new fields
  - [x] 6.3 Add `onPlaylistImportStarted()`, `onPlaylistImportSuccess(tracks, matched, unmatchedCount)`, `onPlaylistImportError()` mutation methods
  - [x] 6.4 Add `resetPlaylistImport()` to clear state for re-import

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1 Create `apps/server/tests/integrations/youtube-data.test.ts` -- unit test `extractPlaylistId()` with various URL formats and `fetchPlaylistTracks()` with mocked fetch
  - [x] 7.2 Test URL extraction: `music.youtube.com/playlist?list=PLxxx`, `youtube.com/playlist?list=PLxxx`, URLs with extra query params, invalid URLs return null
  - [x] 7.3 Test playlist fetching: single page response, multi-page pagination, empty playlist, API error handling (429, 5xx, 403), retry logic
  - [x] 7.4 Test title parsing: verify `parseKaraokeTitle` works correctly when imported from `shared/title-parser.js`. Also verify existing `scrape-catalog.test.ts` still passes after the refactor (re-export)
  - [x] 7.5 Create `apps/server/tests/routes/playlists.test.ts` -- mock `integrations/youtube-data.js` and `persistence/catalog-repository.js`, test HTTP contract
  - [x] 7.6 Test import endpoint: valid YouTube Music URL, valid YouTube URL, invalid URL (400), API failure (502), empty playlist, successful import with matches
  - [x] 7.7 Test response shape matches `{ data: { tracks, matched, unmatchedCount, totalFetched } }`
  - [x] 7.8 Test error responses match `{ error: { code, message } }` format
  - [x] 7.9 Create `apps/flutter_app/test/widgets/playlist_import_card_test.dart` -- widget test for URL input, loading state, results display, error state
  - [x] 7.10 Create `apps/flutter_app/test/state/party_provider_playlist_test.dart` -- unit test for new provider state methods

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All playlist import logic is server-side. Flutter sends URL, server fetches, parses, and matches
- **REST endpoint**: `POST /api/playlists/import` as per architecture (NOT a socket event). Routes call integrations directly for playlist import
- **Persistence boundary**: Route calls `catalogRepository.intersectWithSongs()` for matching. Only persistence layer touches DB
- **Integration boundary**: `integrations/youtube-data.ts` handles all YouTube Data API v3 calls. Called from routes, never from dj-engine
- **Casing rules**: DB columns are `snake_case`. Zod schemas transform to `camelCase` at the REST boundary. Integration module works in camelCase (its own types, not DB types)
- **Import rules**: Relative imports with `.js` extension. No barrel files. No tsconfig aliases
- **File naming**: `kebab-case.ts` for all TypeScript files, `snake_case.dart` for Flutter files

### Key Implementation Patterns

1. **YouTube Data API v3 Integration** -- reimplement the fetch + retry pattern from `scripts/scrape-catalog.ts` (the `fetchPlaylistPage` function at line 41 is NOT exported, so copy/adapt the logic, do not import it):
   ```typescript
   // integrations/youtube-data.ts
   // Endpoint: GET https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=...&key=...
   // Reimplement exponential backoff retry (max 3 retries on 429/5xx)
   // Each playlistItems.list call costs 1 API unit
   // 50 items per page, use nextPageToken for pagination
   ```
   **CRITICAL**: Do NOT import `parseKaraokeTitle` from `../../scripts/scrape-catalog.js` -- that file has top-level side effects (`import 'dotenv/config'` and `import { db } from '../src/db/connection.js'`). Instead, extract the title parsing into a shared utility (see Task 1.6).

2. **URL extraction** -- YouTube Music playlist URLs have these formats:
   ```
   https://music.youtube.com/playlist?list=PLxxxxxxxx
   https://music.youtube.com/playlist?list=PLxxxxxxxx&si=xxxxxxxx
   https://www.youtube.com/playlist?list=PLxxxxxxxx
   ```
   Extract the `list` query parameter value. Guard against non-playlist YouTube URLs (videos, channels, etc.).

3. **Route pattern** -- follow `routes/catalog.ts` (line 25). Use `fastify.post()` directly on the FastifyInstance parameter -- do NOT use `fastify.withTypeProvider<ZodTypeProvider>()` (no existing route uses this, the type provider is set globally in `index.ts`):
   ```typescript
   // routes/playlists.ts
   import type { FastifyInstance } from 'fastify';
   import * as catalogRepository from '../persistence/catalog-repository.js';
   import { extractPlaylistId, fetchPlaylistTracks } from '../integrations/youtube-data.js';
   import { config } from '../config.js';

   function toTrackResponse(track: KaraokeCatalogTable) { /* same as catalog.ts lines 12-23 */ }

   export async function playlistRoutes(fastify: FastifyInstance): Promise<void> {
     fastify.post('/api/playlists/import', {
       schema: {
         body: playlistImportRequestSchema,
         response: { 200: playlistImportResponseSchema },
       },
     }, async (request, reply) => {
       const { playlistUrl } = request.body as { playlistUrl: string };
       const playlistId = extractPlaylistId(playlistUrl);
       if (!playlistId) {
         return reply.status(400).send({ error: { code: 'INVALID_PLAYLIST_URL', message: '...' } });
       }
       try {
         const result = await fetchPlaylistTracks(playlistId, config.YOUTUBE_API_KEY);
         const matches = await catalogRepository.intersectWithSongs(
           result.tracks.map(t => t.songTitle),
           result.tracks.map(t => t.artist),
         );
         return reply.send({ data: {
           tracks: result.tracks,
           matched: matches.map(toTrackResponse),
           unmatchedCount: result.tracks.length - matches.length,
           totalFetched: result.totalFetched,
         }});
       } catch (error) {
         return reply.status(502).send({ error: { code: 'YOUTUBE_API_FAILED', message: (error as Error).message } });
       }
     });
   }
   ```

4. **Catalog matching** -- use existing `catalogRepository.intersectWithSongs()`:
   ```typescript
   // Takes parallel arrays of songTitles and artists
   // Returns KaraokeCatalogTable[] (snake_case DB rows) -- must transform to camelCase!
   const titles = result.tracks.map(t => t.songTitle);
   const artists = result.tracks.map(t => t.artist);
   const matches = await catalogRepository.intersectWithSongs(titles, artists);
   // CRITICAL: Transform snake_case to camelCase before sending response
   const matchedResponse = matches.map(toTrackResponse);
   ```
   **Match behavior**: `intersectWithSongs` uses exact case-insensitive ILIKE (no `%` wildcards). Titles must match exactly. This is fine for YouTube Music titles matching catalog entries since both are normalized (catalog via `parseKaraokeTitle`, playlist via the same parser). The `escapeIlike()` helper in the repository prevents wildcard injection.

5. **Schema registration** -- follow `shared/schemas/catalog-schemas.ts`:
   ```typescript
   import { z } from 'zod/v4';
   import { dataResponseSchema } from './common-schemas.js';

   export const playlistImportRequestSchema = z.object({
     playlistUrl: z.string().url(),
   });
   z.globalRegistry.add(playlistImportRequestSchema, { id: 'PlaylistImportRequest' });
   ```
   Import schema file in `index.ts` BEFORE swagger init.

6. **Error codes for this story**:
   - `INVALID_PLAYLIST_URL` (400) -- URL doesn't match YouTube/YouTube Music playlist format
   - `YOUTUBE_API_FAILED` (502) -- YouTube API returned non-retryable error (quota, auth, not found)
   - `PLAYLIST_NOT_FOUND` (404) -- playlist ID valid but playlist doesn't exist or is private
   - `PLAYLIST_EMPTY` (200, not an error) -- playlist exists but has no items (return empty results)

7. **Flutter widget pattern** -- `playlist_import_card.dart`:
   ```dart
   // Use LoadingState enum for per-operation state
   // All text in constants/copy.dart
   // All styling via DJTokens
   // Widget key: Key('playlist-import-card')
   ```

8. **Quota management** (NFR30):
   - Each `playlistItems.list` call costs 1 API unit
   - 200 tracks = 4 pages = 4 units per import
   - 500 units/session limit = ~125 imports per session (plenty)
   - No additional quota tracking needed at MVP -- just respect the retry/backoff on 429

### Database Schema

**No new migration needed.** This story uses the existing `karaoke_catalog` table for matching via `intersectWithSongs()`. Imported playlist data is transient (returned in response, not persisted to a separate table).

### Title Parser Refactor (shared utility)

`parseKaraokeTitle` currently lives in `scripts/scrape-catalog.ts` (line 17-39) but that file has top-level side effects (`import 'dotenv/config'`, `import { db }`). To reuse the function cleanly:

1. Create `apps/server/src/shared/title-parser.ts` with the `parseKaraokeTitle` function (move, not copy)
2. In `scripts/scrape-catalog.ts`, replace the function body with: `import { parseKaraokeTitle } from '../src/shared/title-parser.js'` and re-export it for backward compatibility
3. In `integrations/youtube-data.ts`, import from `../shared/title-parser.js`

The function strips karaoke suffixes (`(Karaoke)`, `(Instrumental)`, `(With Lyrics)`, `(Sing Along)`, `| Karaoke Version`), then splits on ` - ` to extract `{ artist, songTitle }`. Returns `null` for unparseable titles. YouTube Music playlist titles are typically clean "Artist - Song" format without karaoke suffixes, so parsing should work well.

### YOUTUBE_API_KEY Config

Already defined in `apps/server/src/config.ts` (line 11) as `YOUTUBE_API_KEY: z.string()`. Access via `config.YOUTUBE_API_KEY`. No new env vars needed.

### What This Story Does NOT Include

- No Spotify import (that's Story 5.3)
- No suggestion engine / ranking logic (that's Story 5.4)
- No Quick Pick or Spin the Wheel UI (Stories 5.5, 5.6)
- No TV pairing (Story 5.7)
- No song detection from TV (Story 5.8)
- No new database migration (uses existing `karaoke_catalog` table)
- No socket events for import (REST-only for this operation per architecture)

### Project Structure Notes

New files to create:
```
apps/server/
├── src/
│   ├── integrations/
│   │   └── youtube-data.ts              # NEW
│   ├── routes/
│   │   └── playlists.ts                 # NEW
│   └── shared/
│       ├── title-parser.ts              # NEW (extracted from scripts/scrape-catalog.ts)
│       └── schemas/
│           └── playlist-schemas.ts      # NEW
└── tests/
    ├── integrations/
    │   └── youtube-data.test.ts         # NEW
    └── routes/
        └── playlists.test.ts            # NEW

apps/flutter_app/
├── lib/
│   ├── widgets/
│   │   └── playlist_import_card.dart    # NEW
│   └── constants/
│       └── copy.dart                    # MODIFIED (add playlist import copy strings)
└── test/
    ├── widgets/
    │   └── playlist_import_card_test.dart  # NEW
    └── state/
        └── party_provider_playlist_test.dart  # NEW
```

Files to modify:
```
apps/server/src/index.ts                 # Register playlist routes + schema import (schema ~line 38, route ~line 57)
apps/server/scripts/scrape-catalog.ts    # Replace parseKaraokeTitle with import from shared/title-parser.ts
apps/flutter_app/lib/api/api_service.dart  # Add importPlaylist() method
apps/flutter_app/lib/state/party_provider.dart  # Add playlist import state
apps/flutter_app/lib/screens/lobby_screen.dart  # Add PlaylistImportCard widget
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Song Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#REST API]
- [Source: _bmad-output/planning-artifacts/architecture.md#Integration Lifecycle]
- [Source: _bmad-output/project-context.md#Database Schema]
- [Source: _bmad-output/project-context.md#Development Workflow]
- [Source: apps/server/src/config.ts#YOUTUBE_API_KEY (line 11)]
- [Source: apps/server/scripts/scrape-catalog.ts#parseKaraokeTitle (line 17)]
- [Source: apps/server/scripts/scrape-catalog.ts#fetchPlaylistPage (line 41)]
- [Source: apps/server/src/persistence/catalog-repository.ts#intersectWithSongs]
- [Source: apps/server/src/shared/schemas/catalog-schemas.ts#Schema registration pattern]
- [Source: apps/server/src/routes/catalog.ts#Route pattern]
- [Source: apps/server/src/shared/errors.ts#AppError pattern]

### Previous Story Intelligence (from Story 5.1)

- **Catalog repository**: `intersectWithSongs(songTitles[], artists[])` takes parallel arrays, uses ILIKE for case-insensitive matching. ILIKE wildcards are escaped via `escapeIlike()` helper
- **Schema registration**: Use `z.globalRegistry.add(schema, { id: 'Name' })`. Import schema file in `index.ts` BEFORE swagger init
- **Route pattern**: Export named async function, use `fastify.post()` / `fastify.get()` directly (NOT `withTypeProvider` -- type provider is set globally), wrap responses with `dataResponseSchema()`
- **Test factory**: Factory named `catalog.ts` (not `catalog-factory.ts`) following existing convention in `tests/factories/`
- **parseKaraokeTitle**: Already exported as pure function from `scripts/scrape-catalog.ts`. Handles "Artist - Song" format. Returns null for unparseable. Import directly -- don't duplicate
- **ILIKE wildcard injection**: All ILIKE queries use `escapeIlike()` helper. The `intersectWithSongs` method already applies this
- **Code review found**: search pagination offset bug, wildcard injection, stats inefficiency. Apply these learnings proactively

### Git Intelligence (from recent commits)

- Last commit: `9a40387 Implement Story 5.1: Karaoke Catalog Index with code review fixes`
- Files created in 5.1: `catalog-repository.ts`, `catalog-schemas.ts`, `catalog.ts` (routes), `scrape-catalog.ts`, `seed-classics.ts`, `classic-karaoke-songs.ts`
- Pattern: comprehensive stories with all tasks completed and tested before commit
- Test approach: mock DB with `vi.mock`, mock persistence layer for route tests, test pure functions directly

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Extracted `parseKaraokeTitle` into `shared/title-parser.ts` and re-exported from `scrape-catalog.ts` for backward compatibility. All 17 existing `scrape-catalog.test.ts` tests pass unchanged.
- Created `youtube-data.ts` integration module with `extractPlaylistId()` and `fetchPlaylistTracks()` — reimplemented fetch+retry pattern from scrape-catalog.
- Created Zod schemas in `playlist-schemas.ts` with proper `z.globalRegistry.add()` registration, reusing `catalogTrackSchema` for matched tracks.
- Created `POST /api/playlists/import` route following exact catalog.ts pattern with `toTrackResponse()` snake_case→camelCase transform.
- ApiService uses manual HTTP POST via `MiddlewareChain` since generated client doesn't cover new endpoint yet. Returns `PlaylistImportResult`.
- PartyProvider has per-operation `LoadingState` for playlist import, following project conventions.
- PlaylistImportCard widget placed in lobby screen for all participants with URL auto-detection, loading state, results display, and error+retry.
- 1 pre-existing Flutter test failure in `party_screen_test.dart` (unrelated `DJTokens.actionPrimary` compilation error in `tag_team_flash_widget.dart`) — not introduced by this story.
- Server: 764 tests pass (53 files, including 18 new youtube-data tests + 8 new playlist route tests). Flutter: 446 pass, 1 pre-existing fail.

### Change Log

- 2026-03-15: Story 5.2 implementation complete — all 7 tasks with 10 subtask groups implemented and tested.
- 2026-03-16: Code review fixes applied (H1: regex split on hyphenated artists, M1: PLAYLIST_NOT_FOUND 404 handling, M2: 5s fetch timeout, M4: File List updated, L1: direct title-parser tests, L2: .cast<>() → .map().toList()). 866 server tests pass.

### File List

New files:
- apps/server/src/shared/title-parser.ts
- apps/server/src/integrations/youtube-data.ts
- apps/server/src/shared/schemas/playlist-schemas.ts
- apps/server/src/routes/playlists.ts
- apps/server/tests/integrations/youtube-data.test.ts
- apps/server/tests/routes/playlists.test.ts
- apps/flutter_app/lib/widgets/playlist_import_card.dart
- apps/flutter_app/test/widgets/playlist_import_card_test.dart
- apps/flutter_app/test/state/party_provider_playlist_test.dart

Modified files:
- apps/server/scripts/scrape-catalog.ts (parseKaraokeTitle moved to shared/title-parser.ts, re-exported)
- apps/server/src/index.ts (registered playlist schemas + routes)
- apps/server/src/shared/schemas/catalog-schemas.ts (removed querystring schema from globalRegistry to fix OpenAPI bug)
- apps/flutter_app/lib/api/api_service.dart (added importPlaylist method + PlaylistImportResult class)
- apps/flutter_app/lib/api/generated/* (regenerated Dart types from updated OpenAPI spec)
- apps/flutter_app/lib/state/party_provider.dart (added playlist import state + mutation methods)
- apps/flutter_app/lib/constants/copy.dart (added playlist import copy strings)
- apps/flutter_app/lib/screens/lobby_screen.dart (added PlaylistImportCard widget)

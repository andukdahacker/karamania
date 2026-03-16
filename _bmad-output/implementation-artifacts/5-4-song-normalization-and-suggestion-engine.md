# Story 5.4: Song Normalization & Suggestion Engine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to merge imported songs across platforms and generate smart suggestions,
So that the group gets song recommendations everyone knows with confirmed karaoke versions.

## Acceptance Criteria

1. **Given** songs have been imported from multiple participants' playlists, **When** normalization runs, **Then** songs are matched across platforms by title + artist name (FR84)
2. **Given** songs are imported from multiple friends, **When** normalization merges them, **Then** duplicate songs are merged with an overlap count tracking how many friends share each song (FR84)
3. **Given** normalized songs are available, **When** the suggestion engine computes recommendations, **Then** suggestions are: (imported playlist songs UNION previously sung songs) INTERSECT Karaoke Catalog Index -- only songs with confirmed karaoke versions appear (FR86)
4. **Given** suggestions are generated, **When** they are ranked, **Then** ranking prioritizes: (1) group overlap count -- songs known by more friends rank higher, (2) not-yet-sung -- songs not performed in current session rank higher (FR87)
5. **Given** no playlists have been imported and no songs have been sung yet (cold start), **When** the suggestion engine runs, **Then** it falls back to the Karaoke Classics subset (top 200 universally known karaoke songs with `is_classic = true`) (FR91)

## Tasks / Subtasks

- [x] Task 1: Create song normalizer utility (AC: #1)
  - [x] 1.1 Create `apps/server/src/shared/song-normalizer.ts`
  - [x] 1.2 Implement `normalizeSongTitle(title: string): string` -- lowercase, trim whitespace, collapse multiple spaces, strip common suffixes: `(karaoke)`, `(karaoke version)`, `(instrumental)`, `(with lyrics)`, `(official video)`, `(official music video)`, `(lyric video)`, `(audio)`, `(remix)` (case-insensitive). Remove `feat.`, `ft.`, `featuring` + artist name from title (these vary across platforms). Strip trailing punctuation
  - [x] 1.3 Implement `normalizeArtist(artist: string): string` -- lowercase, trim, collapse spaces, strip `feat.`/`ft.`/`featuring` suffixes (Spotify includes featured artists in the artist name, YouTube puts them in the title), remove `& ` and `, ` delimiters to produce primary artist only (e.g., "Drake & Future" -> "drake")
  - [x] 1.4 Implement `generateSongKey(title: string, artist: string): string` -- `${normalizeSongTitle(title)}::${normalizeArtist(artist)}`. This deterministic key is used for dedup/overlap counting across imports
  - [x] 1.5 Implement `songsMatch(a: { title: string; artist: string }, b: { title: string; artist: string }): boolean` -- compare via `generateSongKey()` equality

- [x] Task 2: Create session song pool service (AC: #1, #2)
  - [x] 2.1 Create `apps/server/src/services/song-pool.ts`
  - [x] 2.2 Define `PooledSong` type: `{ catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string; channel: string | null; isClassic: boolean; overlapCount: number; importedBy: Set<string> }`. This tracks a catalog-matched song in the session pool with overlap metadata
  - [x] 2.3 Define `SessionSongPool` type: `{ songs: Map<string, PooledSong>; sungSongKeys: Set<string> }` where map key is the normalized song key from `generateSongKey()`
  - [x] 2.4 Implement module-level `Map<string, SessionSongPool>` (sessionId -> pool). Same in-memory pattern as `dj-state-store.ts`, `event-stream.ts`, `connection-tracker.ts`
  - [x] 2.5 Implement `addImportedSongs(sessionId: string, userId: string, catalogTracks: KaraokeCatalogTable[]): { newSongs: number; updatedOverlaps: number }` -- for each catalog track, generate song key, if key exists increment overlapCount and add userId to importedBy set, else create new PooledSong entry with overlapCount=1. Return counts for logging. CRITICAL: `importedBy` uses `Set<string>` to prevent double-counting when the same user imports from multiple platforms (YouTube + Spotify). Same user + same song = overlapCount stays at 1. The Set ensures idempotent overlap tracking per user
  - [x] 2.6 Implement `markSongSung(sessionId: string, title: string, artist: string): void` -- add normalized song key to sungSongKeys set. Called when song:detected or host manually marks a song
  - [x] 2.7 Implement `getPool(sessionId: string): SessionSongPool | undefined`
  - [x] 2.8 Implement `getPooledSongs(sessionId: string): PooledSong[]` -- returns array of all pooled songs (for suggestion engine)
  - [x] 2.9 Implement `getSungSongKeys(sessionId: string): Set<string>` -- returns set of sung song keys
  - [x] 2.10 Implement `clearPool(sessionId: string): void` -- removes session from map. Called during session cleanup
  - [x] 2.11 Export `resetAllPools()` for test cleanup

- [x] Task 3: Create suggestion engine service (AC: #3, #4, #5)
  - [x] 3.1 Create `apps/server/src/services/suggestion-engine.ts`
  - [x] 3.2 Define `SuggestedSong` type: `{ catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string; overlapCount: number; score: number }`. Score is the computed ranking score
  - [x] 3.3 Implement `computeSuggestions(sessionId: string, count: number): Promise<SuggestedSong[]>` -- the main entry point:
    1. Get pooled songs from song-pool service
    2. If pool is empty (cold start), fall back to classics (AC #5): call `catalogRepository.findClassics()`, map to SuggestedSong with overlapCount=0, shuffle randomly, return first `count`
    3. Get sungSongKeys from song-pool service
    4. Score each pooled song using `rankSong()`
    5. Sort by score descending, return top `count`
  - [x] 3.4 Implement `rankSong(song: PooledSong, sungSongKeys: Set<string>): number` -- pure scoring function:
    - Base score: `song.overlapCount * 100` (FR87 priority 1: overlap count is most important)
    - Not-yet-sung bonus: if song key NOT in sungSongKeys, add `50` points (FR87 priority 3)
    - Already-sung penalty: if song key IS in sungSongKeys, subtract `200` (strongly deprioritize repeats, but don't exclude -- they can be suggested again if pool is small)
    - Tiebreaker: add small random jitter `Math.random() * 10` to avoid deterministic ordering for same-score songs
  - [x] 3.5 **Genre momentum (FR87 priority 2)**: Scaffold the ranking factor but implement as no-op for now. The `karaoke_catalog` table has no `genre` column and genre data is not available from YouTube scraping or Spotify Client Credentials flow (artist genres require OAuth user token). Add a `// TODO: Genre momentum ranking -- requires genre column in karaoke_catalog (see Story 5.4 notes)` comment. The ranking still works well with overlap + not-yet-sung factors

- [x] Task 4: Update playlist import to store songs in session pool (AC: #1, #2)
  - [x] 4.1 In `shared/schemas/playlist-schemas.ts`, add optional `sessionId` field to `playlistImportRequestSchema`: `sessionId: z.string().uuid().optional()`. Register updated schema
  - [x] 4.2 In `shared/schemas/playlist-schemas.ts`, add `poolStats` to `playlistImportDataSchema`: `poolStats: z.object({ newSongs: z.number(), updatedOverlaps: z.number(), totalPoolSize: z.number() }).optional()`. This gives the client feedback on the pool state after import
  - [x] 4.3 In `routes/playlists.ts`, import `addImportedSongs, getPooledSongs` from `../services/song-pool.js` and `verifyFirebaseToken` from `../integrations/firebase-admin.js` and `verifyGuestToken` from `../services/guest-token.js`
  - [x] 4.4 Add inline auth extraction helper in the handler (same pattern as `routes/sessions.ts`). Auth parsed from `request.headers.authorization`. Added `401: errorResponseSchema` to route schema
  - [x] 4.5 After catalog matching, verify session exists and is active, call `addImportedSongs`, include `poolStats` in response
  - [x] 4.6 If `sessionId` is NOT provided, behave exactly as before (backward compatible, no auth required). `poolStats` will be undefined in response

- [x] Task 5: Create suggestions REST endpoint (AC: #3, #4, #5)
  - [x] 5.1 In `shared/schemas/suggestion-schemas.ts` (NEW), define suggestedSongSchema, suggestionsQuerySchema, suggestionsResponseSchema. All registered with `z.globalRegistry.add()`
  - [x] 5.2 Create `routes/suggestions.ts` (NEW): `GET /api/sessions/:sessionId/suggestions` with auth extraction, session validation, and suggestion computation
  - [x] 5.3 Register route in `apps/server/src/index.ts`
  - [x] 5.4 Import suggestion-schemas.ts in index.ts BEFORE swagger init

- [x] Task 6: Integrate song pool cleanup with session-manager (AC: all)
  - [x] 6.1 In `services/session-manager.ts`, import `clearPool` from `./song-pool.js`
  - [x] 6.2 In `endSession()`, add `clearPool(sessionId)` alongside the existing cleanup calls
  - [x] 6.3 **Do NOT clear pool on pause/resume** -- pool persists throughout session lifecycle

- [x] Task 7: Update Flutter to pass sessionId on import (AC: #1, #2)
  - [x] 7.1 In `apps/flutter_app/lib/api/api_service.dart`, update `importPlaylist()` to accept optional `String? sessionId` parameter. Include `sessionId` in the request body when provided
  - [x] 7.2 In `apps/flutter_app/lib/widgets/playlist_import_card.dart`, pass the current session ID from `PartyProvider` when calling `apiService.importPlaylist()`
  - [x] 7.3 In `apps/flutter_app/lib/api/generated/models.dart`, no manual changes needed — Dart JSON parsing is lenient on extra fields

- [x] Task 8: Write tests (AC: all)
  - [x] 8.1 Create `apps/server/tests/shared/song-normalizer.test.ts` — 28 tests covering normalization, key generation, cross-platform matching
  - [x] 8.2 Create `apps/server/tests/services/song-pool.test.ts` — 10 tests covering add, overlap, idempotency, sung tracking, cleanup, isolation
  - [x] 8.3 Create `apps/server/tests/services/suggestion-engine.test.ts` — 11 tests covering cold start, ranking, count, scoring
  - [x] 8.4 Update `apps/server/tests/routes/playlists.test.ts` — 6 new tests (18 total) covering sessionId+auth+pool+backward-compat
  - [x] 8.5 Create `apps/server/tests/routes/suggestions.test.ts` — 7 tests covering auth, session validation, count, cold start
  - [x] 8.6 Session-manager cleanup verified — `clearPool` added to endSession(), existing 45 tests pass

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: ALL suggestion logic runs server-side. Flutter only displays results (thin display layer per project-context.md)
- **Service boundary**: `suggestion-engine.ts` lives in `services/` -- pure business logic, no Socket.io or persistence imports. It reads from `song-pool.ts` (in-memory) and `catalog-repository.ts` (persistence)
- **Persistence boundary**: Only `catalog-repository.ts` touches the database. Song pool is in-memory (same pattern as DJ state store, event stream, connection tracker)
- **Route boundary**: `routes/suggestions.ts` calls services. `routes/playlists.ts` calls services + persistence (existing pattern)
- **Casing rules**: DB columns `snake_case`, Zod schemas at REST boundary transform to `camelCase` via explicit property names
- **Import rules**: Relative imports with `.js` extension. No barrel files. No tsconfig aliases
- **File naming**: `kebab-case.ts` for all new TS files

### Key Implementation Patterns

1. **Song normalization** -- cross-platform matching:
   ```typescript
   // shared/song-normalizer.ts
   // YouTube karaoke title: "Adele - Rolling In The Deep (Karaoke Version)"
   //   -> after parseKaraokeTitle() in youtube-data.ts: { artist: "Adele", songTitle: "Rolling In The Deep (Karaoke Version)" }
   //   -> after normalizeSongTitle(): "rolling in the deep"
   //   -> after normalizeArtist(): "adele"
   //   -> generateSongKey(): "rolling in the deep::adele"
   //
   // Spotify structured data: { name: "Rolling in the Deep", artists: [{ name: "Adele" }] }
   //   -> normalizeSongTitle(): "rolling in the deep"
   //   -> normalizeArtist(): "adele"
   //   -> generateSongKey(): "rolling in the deep::adele"
   //
   // SAME KEY = matched across platforms
   ```

2. **In-memory song pool** -- follows existing project patterns:
   ```typescript
   // services/song-pool.ts
   // Same pattern as dj-state-store.ts, event-stream.ts, connection-tracker.ts:
   // Module-level Map<sessionId, data> with get/set/clear functions
   //
   // Pool stores CATALOG TRACKS (already intersected), not raw imported songs.
   // The intersection happens in the import route (existing code).
   // song-pool only tracks which catalog tracks each user imported + overlap count.
   ```

3. **Suggestion engine** -- pure computation:
   ```typescript
   // services/suggestion-engine.ts
   // Input: pooled songs (from song-pool) + sung songs (from song-pool)
   // Output: ranked SuggestedSong[]
   //
   // FR86: suggestions = pool (already = imported ∩ catalog) ∪ sung songs
   //   Note: "previously sung songs" might not be in the pool if they were detected
   //   from TV (Story 5.7/5.8). For now, sung songs are only tracked if they came
   //   from the pool. TV-detected songs will be added in Story 5.8.
   //
   // FR87 ranking (simplified without genre):
   //   score = (overlapCount * 100) + (notYetSung ? 50 : -200) + jitter
   //
   // FR91 cold start: pool empty -> findClassics() from catalog
   ```

4. **Updated import flow**:
   ```typescript
   // routes/playlists.ts
   // BEFORE (Story 5.2/5.3): import -> intersect -> return matches
   // AFTER (Story 5.4):  import -> auth (if sessionId) -> intersect -> validate session -> store in pool -> return matches + poolStats
   //
   // The sessionId comes from request body (optional).
   // The userId comes from manual auth header parsing (see "REST Auth Pattern" note).
   // NO request.user exists -- must read Authorization header and verify token inline.
   // If no sessionId, behaves exactly as before (no auth required, backward compatible).
   ```

5. **Suggestions endpoint pattern**:
   ```typescript
   // routes/suggestions.ts
   // GET /api/sessions/:sessionId/suggestions?count=5
   // Standard Fastify route with Zod schema validation
   // Response: { data: { suggestions: SuggestedSong[] } }
   //
   // Register in index.ts: fastify.register(suggestionRoutes)
   // Import schema before swagger init: await import('./shared/schemas/suggestion-schemas.js')
   ```

### Genre Momentum (FR87 Priority 2) -- Deferred

The `karaoke_catalog` table has no `genre` column. Genre data is not available from:
- YouTube scraping (catalog source) -- video metadata doesn't include genre
- Spotify Client Credentials flow -- `GET /v1/artists/{id}` returns genres but requires artist ID lookup per track (expensive, rate-limited)

**Decision**: Implement ranking with overlap count + not-yet-sung (FR87 priorities 1 & 3). Genre momentum is scaffolded with a TODO comment. When genre data becomes available (via catalog enrichment or future Spotify integration), the ranking function can be extended.

The ranking still produces good results: songs known by more friends surface first, and songs already performed sink to the bottom.

### REST Auth Pattern (CRITICAL -- No `request.user` on REST Routes)

There is **NO global auth middleware** on REST routes. Auth exists only on Socket.io connections (`socket.data`). REST routes that need auth must parse the `Authorization` header manually -- follow the pattern in `routes/sessions.ts`:

```typescript
// routes/sessions.ts pattern:
const authHeader = request.headers.authorization;
const token = authHeader?.slice(7); // Remove "Bearer "
// Try Firebase token first, then guest token
const decoded = await verifyFirebaseToken(token);
userId = decoded.uid;
```

For this story: auth is **required** when `sessionId` is provided (need userId for overlap tracking), **not required** when `sessionId` is omitted (backward compatible). Guest users have a server-signed JWT with `sub` = userId (UUID).

### Song Pool Persistence Limitation

Song pool is **in-memory only** and NOT persisted to PostgreSQL. On server restart, all pools are empty and the suggestion engine falls back to classics (FR91) until participants re-import their playlists. This is acceptable for MVP -- the same limitation applies to connection-tracker, activity-tracker, and other in-memory stores. Pool persistence can be added later if needed.

### Normalization vs Catalog Matching Scope

The song normalizer (`song-normalizer.ts`) is used ONLY for overlap counting in the song pool -- generating deterministic keys to detect when two imports refer to the same song. It is NOT used for catalog matching. Catalog matching uses the existing `intersectWithSongs()` which does case-insensitive ILIKE matching directly against the database. `addImportedSongs()` receives catalog tracks that already passed `intersectWithSongs()` -- these are confirmed catalog entries.

### Ranking Jitter and Caching

The ranking includes `Math.random() * 10` jitter for variety, which means the same `GET /suggestions` call returns different orderings each time. Consumers (Stories 5.5 Quick Pick, 5.6 Spin the Wheel) should request suggestions **once** and cache the result for display, not re-request on every render.

### What This Story Does NOT Include

- No Quick Pick UI or voting (Story 5.5)
- No Spin the Wheel UI or animation (Story 5.6)
- No TV pairing or YouTube Lounge API (Story 5.7)
- No song detection from TV (Story 5.8)
- No suggestion-only mode UI (Story 5.9)
- No `song:*` socket events -- those come in Stories 5.5/5.6
- No genre data enrichment -- deferred until genre source is available
- No Flutter suggestions screen -- Flutter only passes sessionId on import. Suggestion display is Stories 5.5/5.6

### Project Structure Notes

New files to create:
```
apps/server/
└── src/
    ├── shared/
    │   └── song-normalizer.ts              # NEW - normalization utility
    │   └── schemas/
    │       └── suggestion-schemas.ts       # NEW - Zod schemas for suggestions
    ├── services/
    │   └── song-pool.ts                    # NEW - in-memory session song pool
    │   └── suggestion-engine.ts            # NEW - ranking/suggestion logic
    └── routes/
        └── suggestions.ts                  # NEW - GET /api/sessions/:id/suggestions

apps/server/
└── tests/
    ├── shared/
    │   └── song-normalizer.test.ts         # NEW
    ├── services/
    │   └── song-pool.test.ts              # NEW
    │   └── suggestion-engine.test.ts      # NEW
    └── routes/
        └── suggestions.test.ts            # NEW
```

Files to modify:
```
apps/server/src/routes/playlists.ts                      # Add sessionId handling + auth + pool storage
apps/server/src/shared/schemas/playlist-schemas.ts        # Add sessionId + poolStats to schemas
apps/server/src/services/session-manager.ts               # Add clearPool to endSession cleanup
apps/server/src/index.ts                                  # Register suggestion route + schema import
apps/server/tests/routes/playlists.test.ts                # Add sessionId + auth + pool tests
apps/flutter_app/lib/api/api_service.dart                 # Add sessionId param to importPlaylist
apps/flutter_app/lib/widgets/playlist_import_card.dart     # Pass sessionId from PartyProvider
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5, Story 5.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#services/suggestion-engine.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#persistence/catalog-repository.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Karaoke Catalog Index]
- [Source: _bmad-output/planning-artifacts/prd.md#FR84, FR86, FR87, FR91]
- [Source: _bmad-output/project-context.md#Server Boundaries]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: apps/server/src/persistence/catalog-repository.ts#intersectWithSongs, findClassics]
- [Source: apps/server/src/routes/playlists.ts#Existing import handler to extend]
- [Source: apps/server/src/shared/schemas/playlist-schemas.ts#Existing schemas to extend]
- [Source: apps/server/src/services/dj-state-store.ts#In-memory store pattern reference]

### Previous Story Intelligence (from Story 5.3)

- **PlaylistTrack type**: `{ songTitle: string; artist: string; youtubeVideoId: string }` in `youtube-data.ts` -- reuse for normalization input
- **PlaylistResult type**: `{ tracks: PlaylistTrack[], unparseable: number, totalFetched: number }` -- don't modify
- **Route pattern**: Don't use `fastify.withTypeProvider<ZodTypeProvider>()` -- type provider is set globally
- **Schema registration**: Use `z.globalRegistry.add()`. Import schema files in `index.ts` BEFORE swagger init
- **toTrackResponse()**: Already exists in `routes/playlists.ts` for snake_case->camelCase transform
- **Error handling**: Route uses `reply.status(N).send({ error: { code, message } })`. Do NOT throw AppError
- **Title parser**: `parseKaraokeTitle()` in `shared/title-parser.ts` extracts artist/title from YouTube karaoke video titles. The normalizer in this story handles ADDITIONAL normalization (lowercasing, stripping suffixes) on top of already-parsed data
- **Config**: `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`/`YOUTUBE_API_KEY` already in `config.ts`
- **intersectWithSongs()**: Uses ILIKE exact matching on (song_title, artist) pairs. The normalizer handles pre-matching normalization for the overlap counting in the pool, NOT for catalog queries. Catalog matching still uses the existing ILIKE approach
- **Test patterns**: Mock `fetch` globally for integration tests, mock persistence for route tests. Use `vi.mock()` with factory functions. Use `afterEach(() => resetTokenCache())` pattern for module-level state cleanup
- **Pre-existing Flutter test failure**: `party_screen_test.dart` has unrelated `DJTokens.actionPrimary` compilation error -- not introduced by playlist stories

### Git Intelligence (from recent commits)

- Last commit: `afe5dff Implement Story 5.3: Playlist Import - Spotify with code review fixes`
- Story 5.3 created: `spotify-data.ts`, `spotify_guide.dart` and modified `playlists.ts`, `playlist-schemas.ts`
- Pattern: comprehensive stories with all tasks completed and tested before commit
- All server files use relative imports with `.js` extension
- All new Zod schemas registered with `z.globalRegistry.add()`
- Test count: Server 764+ tests (53+ files), Flutter 446+ pass

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Zod v4 UUID validation requires version nibble [1-8] and variant nibble [89ab] — test UUIDs updated to `a0000000-0000-4000-a000-...` format

### Completion Notes List

- Task 1: Created `song-normalizer.ts` with 4 exported functions for cross-platform song matching. 28 unit tests.
- Task 2: Created `song-pool.ts` following in-memory Map pattern from `dj-state-store.ts`. Idempotent overlap tracking via Set. 10 unit tests.
- Task 3: Created `suggestion-engine.ts` with scoring algorithm (overlap*100 + not-sung bonus 50 - sung penalty 200 + jitter). Genre momentum scaffolded as TODO. 11 unit tests.
- Task 4: Updated `playlist-schemas.ts` (sessionId + poolStats) and `playlists.ts` route (auth extraction, session validation, pool storage). Backward compatible.
- Task 5: Created `suggestion-schemas.ts` and `suggestions.ts` route (GET /api/sessions/:id/suggestions). Registered in index.ts.
- Task 6: Added `clearPool(sessionId)` to `endSession()` cleanup in `session-manager.ts`.
- Task 7: Updated Flutter `api_service.dart` (optional sessionId param) and `playlist_import_card.dart` (passes partyProvider.sessionId).
- Task 8: All tests written. 856 total server tests pass (58 files). 56 new tests added across 5 test files.
- Used `guest.guestId` (not `guest.sub`) for guest token userId extraction — matches `GuestTokenPayload` interface.

### File List

**New files:**
- `apps/server/src/shared/song-normalizer.ts`
- `apps/server/src/services/song-pool.ts`
- `apps/server/src/services/suggestion-engine.ts`
- `apps/server/src/shared/schemas/suggestion-schemas.ts`
- `apps/server/src/routes/suggestions.ts`
- `apps/server/tests/shared/song-normalizer.test.ts`
- `apps/server/tests/services/song-pool.test.ts`
- `apps/server/tests/services/suggestion-engine.test.ts`
- `apps/server/tests/routes/suggestions.test.ts`

**Modified files:**
- `apps/server/src/shared/schemas/playlist-schemas.ts` — added sessionId + poolStats
- `apps/server/src/routes/playlists.ts` — auth extraction, session validation, pool storage
- `apps/server/src/services/session-manager.ts` — clearPool import + endSession cleanup
- `apps/server/src/index.ts` — suggestion route + schema registration
- `apps/server/src/persistence/catalog-repository.ts` — added limit param to findClassics (code review fix)
- `apps/server/tests/routes/playlists.test.ts` — 6 new tests for sessionId/auth/pool
- `apps/flutter_app/lib/api/api_service.dart` — optional sessionId param
- `apps/flutter_app/lib/widgets/playlist_import_card.dart` — passes sessionId from PartyProvider

**Also in commit (Story 5.2 code review fixes):**
- `apps/server/src/integrations/youtube-data.ts` — 404 handling + 5s fetch timeout
- `apps/server/src/shared/title-parser.ts` — fixed hyphenated artist regex
- `apps/server/tests/integrations/youtube-data.test.ts` — 404 test
- `apps/server/tests/shared/title-parser.test.ts` — NEW, direct title-parser tests

### Change Log

- 2026-03-16: Implemented Story 5.4 — Song Normalization & Suggestion Engine. Added cross-platform song matching, session song pool, suggestion ranking (overlap + not-yet-sung), REST endpoint, playlist import integration with pool storage, Flutter sessionId passing. 856 server tests pass.
- 2026-03-16: Code review fixes applied (H1: findClassics limit 200, H2: participant verification on suggestions route + 403, H3: regex safety comment, M1: File List updated with 5.2 bundled files, M2: aligned status check to lobby/active, M3: markSongSung integration test, M4: fixed misleading comment). 868 server tests pass.

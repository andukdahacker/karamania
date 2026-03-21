# Story 9.3: Session Timeline Screen

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to see all my past karaoke sessions on my home screen,
So that I can easily revisit and relive my party memories.

## Acceptance Criteria

1. **Given** an authenticated user opens the app with no active party, **When** the home screen loads, **Then** a Session Timeline is displayed as the default screen (FR100, FR108) **And** sessions are listed in reverse-chronological order (FR108) **And** each entry shows: session date, venue name (if entered), number of participants, the user's top award from that session, and a thumbnail from captured media (if available) (FR108)
2. **Given** the Session Timeline has many sessions, **When** the user scrolls, **Then** the 20 most recent sessions load initially with infinite scroll for older sessions (FR114)
3. **Given** an authenticated user has zero past sessions, **When** the Session Timeline loads, **Then** an empty state is displayed with a "Start your first party" call-to-action (FR115)
4. **Given** a guest user opens the app, **When** the home screen loads, **Then** they see a prompt to create an account to unlock session history (FR113) **And** the guest home screen shows only the "Start Party" / "Join Party" actions -- no Session Timeline (FR113)
5. **Given** the server returns session timeline data, **When** the Flutter app receives it, **Then** the data is displayed using the existing design token system (DJTokens) **And** all user-facing strings come from `constants/copy.dart`

## Tasks / Subtasks

- [x]Task 1: Add session timeline query to persistence layer (AC: #1, #2)
  - [x]1.1 Add `findUserSessions(userId, limit, offset)` to `apps/server/src/persistence/session-repository.ts`:
    ```typescript
    // Use a subquery approach to find sessions where user is host OR participant:
    //   WHERE sessions.id IN (
    //     SELECT id FROM sessions WHERE host_user_id = userId
    //     UNION
    //     SELECT session_id FROM session_participants WHERE user_id = userId
    //   )
    //   AND status = 'ended'
    //   AND summary IS NOT NULL
    //
    // Extract participant count from JSONB using Kysely:
    //   .select(sql<number>`(summary->'stats'->>'participantCount')::int`.as('participant_count'))
    //
    // Get user's top_award via LEFT JOIN session_participants ON session_id AND user_id
    //
    // Get first media thumbnail via lateral subquery or LEFT JOIN:
    //   LEFT JOIN LATERAL (
    //     SELECT id, storage_path FROM media_captures
    //     WHERE session_id = sessions.id
    //     ORDER BY created_at ASC LIMIT 1
    //   ) AS thumb ON true
    //
    // Resolve thumbnail to signed URL using generateDownloadUrl() from
    //   services/media-storage.ts (returns { url, expiresAt })
    //   Call AFTER the DB query for each row with a non-null storage_path
    //
    // Order by ended_at DESC, apply LIMIT/OFFSET
    // Return: id, venue_name, ended_at, participant_count, user_top_award, thumbnail_url (signed)
    ```
    **Reference pattern**: `apps/server/src/persistence/catalog-repository.ts` — `searchByTitleOrArtist()` shows the established limit/offset pagination pattern
  - [x]1.2 Add `countUserSessions(userId)` for total count — use same UNION subquery as 1.1 but wrap in `COUNT(*)`
  - [x]1.3 Follow the route-level parallel fetch pattern from `apps/server/src/routes/catalog.ts`:
    ```typescript
    const [sessions, total] = await Promise.all([
      findUserSessions(userId, limit, offset),
      countUserSessions(userId),
    ]);
    ```

- [x]Task 2: Add Zod schemas for session timeline responses (AC: #1, #2)
  - [x]2.1 Create `apps/server/src/shared/schemas/timeline-schemas.ts`:
    ```typescript
    // sessionTimelineItemSchema: { id, venueName, endedAt, participantCount, topAward, thumbnailUrl (signed URL or null) }
    // sessionTimelineResponseSchema: dataResponseSchema wrapping { sessions: array, total: number, offset: number, limit: number }
    // Register ALL schemas with z.globalRegistry.add() — define sessionTimelineItemSchema as a top-level
    //   schema (NOT inline) so dart-open-fetch generates a proper typed Dart class
    // Follow pattern from catalog-schemas.ts for paginated response shape
    ```
  - [x]2.2 Import schema file in `src/index.ts` BEFORE swagger init for OpenAPI registration
  - [x]2.3 After schemas registered and server running, run `dart_open_fetch generate` to create Dart types (`SessionTimelineItem`, `SessionTimelineResponse`)

- [x]Task 3: Add GET /api/sessions endpoint (AC: #1, #2)
  - [x]3.1 Add authenticated GET route to `apps/server/src/routes/sessions.ts`:
    ```typescript
    // GET /api/sessions?limit=20&offset=0
    // Use requireAuth middleware from routes/middleware/rest-auth.ts
    // Extract userId from request.requestContext.userId
    // Call findUserSessions(userId, limit, offset) and countUserSessions(userId)
    // Return { data: { sessions: [...], total, offset, limit } }
    ```
  - [x]3.2 Add query parameter validation schema (limit: 1-50 default 20, offset: >= 0 default 0)

- [x]Task 4: Implement TimelineProvider (AC: #1, #2, #3)
  - [x]4.1 Implement `apps/flutter_app/lib/state/timeline_provider.dart`:
    ```dart
    // Properties:
    //   sessions (List<SessionTimelineItem>), timelineState (LoadingState),
    //   loadMoreState (LoadingState), hasMore (bool), total (int)
    // Methods:
    //   loadSessions() — initial fetch, sets timelineState
    //   loadMore() — pagination append, sets loadMoreState, guards against concurrent calls
    //   onSessionsLoaded(sessions, total) — called by ApiService to update state
    // SessionTimelineItem: { id, venueName, endedAt, participantCount, topAward, thumbnailUrl }
    // Provider is read-only from widgets — mutations only from ApiService calls
    // Follow AuthProvider pattern: separate LoadingState per operation (timelineState vs loadMoreState)
    ```
  - [x]4.2 Add `fetchSessions(limit, offset)` method to `apps/flutter_app/lib/api/api_service.dart`

- [x]Task 5: Implement Session Timeline UI on HomeScreen (AC: #1, #2, #3, #4, #5)
  - [x]5.1 Convert `HomeScreen` from `StatelessWidget` to `StatefulWidget`:
    - Required for `ScrollController` lifecycle (init in `initState`, dispose in `dispose`)
    - Replace placeholder "Your Sessions" / "no sessions yet" text (lines 111-123) with timeline list
    - Keep existing Create/Join party buttons at top
    - Add session list below using `ListView.builder` with `context.watch<TimelineProvider>()`
    - Each session card: date, venue name, participant count, top award badge, media thumbnail
    - Use DJTokens for all spacing, colors, typography
  - [x]5.2 Create `apps/flutter_app/lib/widgets/session_timeline_card.dart`:
    - Stateless widget for individual session entry
    - Key: `Key('session-card-${session.id}')`
    - Shows: formatted date, venue name (or `Copy.karaokeNight` fallback), participant count icon, top award chip, thumbnail via `Image.network(thumbnailUrl)` or placeholder icon
    - Tap handler: navigate to `/session/${session.id}` (Story 9.4 — add route stub in `app.dart` pointing to a placeholder screen)
    - Min tap target: 48px (NFR14-20)
    - **Reuse card styling pattern** from `_StatCard` in `apps/flutter_app/lib/widgets/session_stats_widget.dart` (line 133): `DJTokens.surfaceElevated` background, rounded corners, accent border
  - [x]5.3 Implement empty state widget when `sessions.isEmpty && loadingState == LoadingState.success`:
    - Show `Copy.startFirstParty` CTA text
    - CTA button calls `_onCreateParty(context)` (reuse existing method on HomeScreen)
  - [x]5.4 Implement infinite scroll:
    - Create `ScrollController` in `initState`, dispose in `dispose`
    - Add listener to detect `position.pixels >= position.maxScrollExtent - 200`
    - Guard: only call `loadMore()` when `timelineProvider.loadMoreState != LoadingState.loading && timelineProvider.hasMore`
    - Show `CircularProgressIndicator` at list bottom while loading more
    - On error: show `Copy.loadSessionsError` with retry tap
  - [x]5.5 Add required strings to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    static const String startFirstParty = 'Start your first party!';
    static const String karaokeNight = 'Karaoke Night';
    static const String participantCount = 'participants';
    static const String loadingMore = 'Loading more sessions...';
    static const String loadSessionsError = 'Could not load sessions. Tap to retry.';
    ```

- [x]Task 6: Register TimelineProvider and trigger initial load (AC: #1)
  - [x]6.1 Ensure `TimelineProvider` is registered in `apps/flutter_app/lib/config/bootstrap.dart` (verify existing registration)
  - [x]6.2 Trigger `timelineProvider.loadSessions()` when authenticated user lands on home screen (use `WidgetsBinding.instance.addPostFrameCallback` or equivalent)

- [x]Task 7: Server tests (AC: #1, #2)
  - [x]7.1 Add tests to `apps/server/tests/persistence/session-repository.test.ts`:
    - `findUserSessions` returns sessions where user is host
    - `findUserSessions` returns sessions where user is participant (not host)
    - `findUserSessions` returns empty array when no sessions
    - `findUserSessions` respects limit/offset pagination
    - `findUserSessions` orders by ended_at DESC
    - `findUserSessions` only returns ended sessions with summary
    - `countUserSessions` returns correct total
  - [x]7.2 Add tests to `apps/server/tests/routes/sessions.test.ts`:
    - GET /api/sessions returns 401 without auth
    - GET /api/sessions returns paginated session list
    - GET /api/sessions returns empty array for new user
    - GET /api/sessions respects limit/offset query params
    - GET /api/sessions validates query params (limit bounds, offset non-negative)
  - [x]7.3 Create test factories if missing in `apps/server/tests/factories/`:
    - `createEndedSessionWithSummary(overrides?)` — extends `createTestSession()` with `status: 'ended'`, `ended_at: new Date()`, `summary: buildTestSessionSummary()`
    - `createTestMediaCapture(overrides?)` — creates a `media_captures` row with `storage_path`, `session_id`, `trigger_type`
    - Reuse existing `createTestSession()` and `createTestUser()` factories as base

- [x]Task 8: Flutter tests (AC: #1, #3, #4, #5)
  - [x]8.1 Add tests to `apps/flutter_app/test/state/timeline_provider_test.dart`:
    - loadSessions populates sessions list and sets loadingState
    - loadMore appends to existing sessions
    - hasMore is false when all sessions loaded
    - Error state handled correctly
  - [x]8.2 Add tests to `apps/flutter_app/test/screens/home_screen_test.dart`:
    - Authenticated user with sessions sees session cards
    - Authenticated user with no sessions sees empty state CTA
    - Guest user sees sign-in prompt, no timeline
    - Session card tap triggers navigation
  - [x]8.3 Add widget test for `session_timeline_card.dart`:
    - Displays date, venue, participant count, award
    - Handles missing venue name gracefully
    - Handles missing thumbnail gracefully

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All session data fetched from server via REST API. No client-side session storage or computation
- **Persistence boundary**: Only `session-repository.ts` queries the database. Route handler calls repository, never raw Kysely
- **Flutter boundary**: `TimelineProvider` is a read-only reactive state container. Only `ApiService` calls mutate provider state. No widget creates its own data fetch
- **Casing rules**: DB columns are `snake_case`, Zod schemas transform to `camelCase` at boundary, Dart types are `camelCase`
- **Error handling**: REST responses use `{ data: {...} }` or `{ error: { code, message } }` format via `dataResponseSchema` and `errorResponseSchema`

### Key Existing Code to Extend

- **Session repository**: `apps/server/src/persistence/session-repository.ts` — add `findUserSessions()` and `countUserSessions()`. Existing `findById()` pattern shows the query style
- **Session routes**: `apps/server/src/routes/sessions.ts` — add GET endpoint alongside existing POST. Use `requireAuth` middleware from `apps/server/src/routes/middleware/rest-auth.ts`
- **Session schemas**: `apps/server/src/shared/schemas/session-schemas.ts` — add timeline response schemas. Follow existing `createSessionResponseSchema` pattern with `z.globalRegistry.add()`
- **Finale schemas**: `apps/server/src/shared/schemas/finale-schemas.ts` — `SessionSummary` type contains `stats.participantCount` and participant top awards needed for timeline cards
- **Pagination pattern**: `apps/server/src/persistence/catalog-repository.ts` + `apps/server/src/routes/catalog.ts` — established limit/offset pagination with parallel `Promise.all([items, count])` fetch. Follow this exact pattern
- **Signed URL service**: `apps/server/src/services/media-storage.ts` — `generateDownloadUrl(storagePath)` returns `{ url, expiresAt }`. Use this to resolve thumbnail storage_paths to displayable signed URLs in the route handler
- **Timeline provider stub**: `apps/flutter_app/lib/state/timeline_provider.dart` — currently empty stub, implement here
- **Home screen**: `apps/flutter_app/lib/screens/home_screen.dart` — lines 111-123 have placeholder "Your Sessions" text to replace with timeline list
- **API service**: `apps/flutter_app/lib/api/api_service.dart` — add `fetchSessions()` method following existing patterns
- **Bootstrap**: `apps/flutter_app/lib/config/bootstrap.dart` — `TimelineProvider` is already registered in `MultiProvider`
- **Copy constants**: `apps/flutter_app/lib/constants/copy.dart` — already has `yourSessions` and `noSessionsYet`, add new strings
- **Card styling**: `apps/flutter_app/lib/widgets/session_stats_widget.dart` (`_StatCard` at line 133) — reuse `DJTokens.surfaceElevated` card styling pattern for timeline cards

### Session Summary Data Structure (from Story 8.4)

The `sessions.summary` JSONB column contains a `SessionSummary` object:
```typescript
{
  version: 1,
  generatedAt: number,
  stats: { songCount, participantCount, sessionDurationMs, totalReactions, ... },
  setlist: [{ position, title, artist, performerName, awardTitle, awardTone }],
  awards: [{ userId, displayName, category, title, tone, reason }],
  participants: [{ userId, displayName, participationScore, topAward }]
}
```

The timeline query should extract `stats.participantCount` from this JSONB using PostgreSQL JSON operators (e.g., `summary->'stats'->>'participantCount'`). See Task 1.1 for full query strategy including UNION subquery, signed URL resolution, and Kysely syntax.

### OpenAPI / Dart Type Generation

Follow the type generation pipeline in project-context.md. Key: define `sessionTimelineItemSchema` as a top-level registered schema (not inline) so `dart_open_fetch` generates a proper typed Dart class instead of `Map<String, dynamic>`. Run `dart_open_fetch generate` after schema registration (Task 2.3).

### Previous Story Learnings (from Story 9.1 & 9.2)

- **REST auth middleware pattern**: `requireAuth` preHandler extracts `request.requestContext.userId` — use this for the GET /api/sessions endpoint
- **Provider pattern**: `AuthProvider` shows the established ChangeNotifier pattern with `LoadingState` enum for async operations
- **Home screen structure**: Profile display (avatar, name) is already in place — session timeline slots in below profile section
- **Test patterns**: Widget tests mock providers via `ChangeNotifierProvider.value()`. Route tests use Fastify injection with auth headers
- **Copy constants**: All UI strings go in `Copy` class as static const String

### Git Intelligence (Recent Commits)

Stories 9.1-9.2 established:
- REST auth middleware in `routes/middleware/rest-auth.ts` — reuse for session timeline endpoint
- User profile display on home screen — timeline renders below this
- `ApiService` methods for authenticated REST calls — follow same pattern
- Test factories and patterns for auth-dependent routes

### Project Structure Notes

- Server files: `kebab-case.ts` naming
- Flutter files: `snake_case.dart` naming
- No barrel files — import directly from specific files
- Server imports: relative with `.js` extension
- Flutter imports: `package:karamania/...` for cross-directory

### Testing Standards

- **DO NOT test**: animations, visual effects, color values, transition timings
- **DO test**: state transitions, data flow, API response handling, pagination logic, empty/error states
- **Server**: Transaction per test, rolled back. Use shared factories from `tests/factories/`
- **Flutter**: Widget tests with mocked providers. Per-operation LoadingState assertions

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 - Session Timeline & Memories]
- [Source: _bmad-output/planning-artifacts/architecture.md#REST API Endpoints]
- [Source: _bmad-output/project-context.md#Server Boundaries, Flutter Boundaries, Database Schema]
- [Source: apps/server/src/shared/schemas/finale-schemas.ts#SessionSummary]
- [Source: apps/server/src/persistence/session-repository.ts]
- [Source: apps/server/src/routes/middleware/rest-auth.ts#requireAuth]
- [Source: apps/flutter_app/lib/screens/home_screen.dart#lines 111-123]
- [Source: apps/flutter_app/lib/state/timeline_provider.dart#stub]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented `findUserSessions()` and `countUserSessions()` in session-repository.ts using UNION subquery for host+participant lookup, JSONB extraction for participant count, lateral subqueries for top_award and thumbnail
- Created timeline-schemas.ts with Zod schemas registered in globalRegistry for OpenAPI/dart-open-fetch generation
- Added GET /api/sessions authenticated endpoint with limit/offset pagination, signed URL resolution for thumbnails
- Implemented TimelineProvider as reactive state container with per-operation LoadingState (timelineState, loadMoreState)
- Added fetchSessions() to ApiService using raw HTTP chain (consistent with other manual endpoints)
- Converted HomeScreen from StatelessWidget to StatefulWidget for ScrollController lifecycle; added infinite scroll with 200px pre-fetch threshold
- Created SessionTimelineCard widget with thumbnail, venue name, date, participant count, and award chip
- Added session detail route stub at /session/:id for Story 9.4
- Added new copy constants: startFirstParty, karaokeNight, participantCount, loadingMore, loadSessionsError
- Added TimelineProvider to join_screen_test.dart and deep_link_test.dart provider lists to fix provider-not-found errors caused by HomeScreen now requiring TimelineProvider
- Server tests: 1403 passed (3 new persistence + 7 new route tests)
- Flutter tests: 489 passed, 5 pre-existing failures (party_screen, join_screen — unrelated)

### File List

**New files:**
- apps/server/src/shared/schemas/timeline-schemas.ts
- apps/flutter_app/lib/widgets/session_timeline_card.dart
- apps/flutter_app/test/state/timeline_provider_test.dart
- apps/flutter_app/test/widgets/session_timeline_card_test.dart

**Modified files:**
- apps/server/src/persistence/session-repository.ts (added findUserSessions, countUserSessions)
- apps/server/src/routes/sessions.ts (added GET /api/sessions)
- apps/server/src/index.ts (import timeline-schemas before swagger init)
- apps/server/tests/persistence/session-repository.test.ts (added tests + flexible mock chain)
- apps/server/tests/routes/sessions.test.ts (added GET /api/sessions tests)
- apps/flutter_app/lib/state/timeline_provider.dart (implemented from stub)
- apps/flutter_app/lib/api/api_service.dart (added fetchSessions, hide comment for generated types)
- apps/flutter_app/lib/api/generated/models.dart (regenerated via dart_open_fetch — new SessionTimelineItem types)
- apps/flutter_app/lib/api/generated/clients/karamania_api_client.dart (regenerated via dart_open_fetch)
- apps/flutter_app/lib/api/generated/karamania_api.dart (regenerated via dart_open_fetch)
- apps/flutter_app/lib/screens/home_screen.dart (StatefulWidget, timeline list, infinite scroll)
- apps/flutter_app/lib/constants/copy.dart (new timeline strings)
- apps/flutter_app/lib/app.dart (added /session/:id route stub)
- apps/flutter_app/test/screens/home_screen_test.dart (added timeline tests, TimelineProvider)
- apps/flutter_app/test/screens/join_screen_test.dart (added TimelineProvider to providers)
- apps/flutter_app/test/routing/deep_link_test.dart (added TimelineProvider to providers)
- _bmad-output/implementation-artifacts/sprint-status.yaml (9-3 status: in-progress → review)

## Senior Developer Review (AI)

**Reviewer:** Code Review Workflow on 2026-03-21
**Model:** Claude Opus 4.6 (1M context)
**Outcome:** Approved with fixes applied

### Issues Found & Fixed (9 total: 2 High, 4 Medium, 3 Low)

**HIGH (fixed):**
1. Missing navigation test in `home_screen_test.dart` — added `session card tap triggers navigation to session detail` test with GoRouter
2. `findUserSessions` tests missing WHERE/ORDER verification — added assertions for `status='ended'`, `summary IS NOT NULL`, `orderBy ended_at DESC`

**MEDIUM (fixed):**
3. Reverted undocumented change to `suggestion-schemas.ts` — restored `z.globalRegistry.add` for `suggestionsQuerySchema`
4. Added generated files to story File List (models.dart, karamania_api_client.dart, karamania_api.dart)
5. Added `CaptureProvider` to `home_screen_test.dart` `_wrapWithProviders` — prevents future provider-not-found errors
6. Fixed idle-state fallthrough in `_buildTimeline` — now treats `idle` same as `loading` to prevent brief spinner glitch

**LOW (fixed):**
7. Added explanatory comment for `hide SessionTimelineItem` import in `api_service.dart`
8. Added `.toLocal()` to `_formatDate` in `session_timeline_card.dart` for correct timezone display
9. Updated test dates to use noon UTC to avoid timezone-related day-shift in assertions

## Change Log

- 2026-03-21: Code review fixes — reverted suggestion-schemas change, added navigation test, fixed timezone handling, improved test coverage
- 2026-03-21: Implemented Story 9.3 Session Timeline Screen — server persistence, REST endpoint, Flutter provider, timeline UI with infinite scroll, comprehensive tests

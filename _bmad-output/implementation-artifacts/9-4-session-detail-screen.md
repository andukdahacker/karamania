# Story 9.4: Session Detail Screen

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to tap into a past session and see everything that happened,
So that I can relive the full party experience and share specific moments.

## Acceptance Criteria

1. **Given** a user taps a session entry on the Session Timeline, **When** the Session Detail screen opens, **Then** it displays 5 sections: (1) session header with date, venue, duration, and participant count, (2) participant list with each person's top award and participation score, (3) full setlist with performer names and awards per song, (4) media gallery showing all photos, video clips, and audio captured during the session, (5) the setlist poster generated at session end (FR109)
2. **Given** the Session Detail screen layout, **When** the user views it, **Then** it is scrollable as a single continuous view -- no tabs or sub-navigation (FR110) **And** the media gallery displays as an inline grid within the session detail flow (FR110)

## Tasks / Subtasks

- [x] Task 1: Add session detail query to persistence layer (AC: #1)
  - [x] 1.1 Add `findSessionDetail(sessionId: string, userId: string)` to `apps/server/src/persistence/session-repository.ts`:
    ```typescript
    // Verify user is host OR participant (authorization check):
    //   SELECT 1 FROM sessions WHERE id = sessionId AND host_user_id = userId
    //   UNION
    //   SELECT 1 FROM session_participants WHERE session_id = sessionId AND user_id = userId
    //
    // If no match -> return null (route returns 403)
    //
    // Main query: SELECT id, venue_name, created_at, ended_at, summary, vibe
    //   FROM sessions WHERE id = sessionId AND status = 'ended' AND summary IS NOT NULL
    //
    // Return full row including summary JSONB (parse in route handler, not here)
    // Follow existing findById() pattern at line ~15 but add status/summary guards
    ```
  - [x] 1.2 Add `findSessionMediaCaptures(sessionId: string)` to `apps/server/src/persistence/media-repository.ts`:
    ```typescript
    // Extend existing findBySessionId() (line ~29) — it already returns all captures ordered by created_at ASC
    // If findBySessionId already returns all needed fields (id, storage_path, trigger_type, created_at, dj_state_at_capture), reuse it directly
    // If not, add a variant that includes user_id for attribution in the gallery
    ```

- [x] Task 2: Add Zod schemas for session detail response (AC: #1)
  - [x] 2.1 Add to `apps/server/src/shared/schemas/timeline-schemas.ts` (keep session schemas together):
    ```typescript
    // sessionDetailParticipantSchema: { userId (nullable), displayName, participationScore, topAward }
    // sessionDetailSetlistItemSchema: { position, title, artist, performerName, awardTitle, awardTone }
    // sessionDetailAwardSchema: { userId, displayName, category, title, tone, reason }
    // sessionDetailMediaSchema: { id, url (signed), triggerType, createdAt }
    // sessionDetailStatsSchema: { songCount, participantCount, sessionDurationMs, totalReactions, totalSoundboardPlays, totalCardsDealt }
    // sessionDetailSchema: {
    //   id, venueName, vibe, createdAt, endedAt,
    //   stats: sessionDetailStatsSchema,
    //   participants: sessionDetailParticipantSchema[],
    //   setlist: sessionDetailSetlistItemSchema[],
    //   awards: sessionDetailAwardSchema[],
    //   media: sessionDetailMediaSchema[]
    //   // NOTE: No posterUrl — poster is NOT stored on server (Story 8.3: client-side ephemeral artifact)
    //   // The Flutter client re-renders the poster from setlist data using existing SetlistPosterWidget
    // }
    // sessionDetailResponseSchema: dataResponseSchema wrapping sessionDetailSchema
    //
    // Register ALL top-level schemas with z.globalRegistry.add() so dart-open-fetch generates typed Dart classes
    // CRITICAL: Define participant, setlist item, award, media, and stats as SEPARATE named schemas (not inline)
    //   to avoid dart-open-fetch generating Map<String, dynamic> instead of typed classes
    // Follow pattern from sessionTimelineItemSchema registration at line ~13
    ```
  - [x] 2.2 Import any new schema files in `src/index.ts` BEFORE swagger init (if adding a new file — if extending timeline-schemas.ts, import is already there)

- [x] Task 3: Add GET /api/sessions/:id endpoint (AC: #1)
  - [x] 3.1 Add authenticated GET route to `apps/server/src/routes/sessions.ts`:
    ```typescript
    // GET /api/sessions/:id
    // Use requireAuth middleware (same as GET /api/sessions at line ~22)
    // Extract userId from request.requestContext!.userId
    // Extract sessionId from request.params.id
    //
    // 1. Call findSessionDetail(sessionId, userId) — returns null if not found or not authorized
    //    If null -> reply.status(403).send({ error: { code: 'SESSION_ACCESS_DENIED', message: '...' } })
    //
    // 2. Parse summary JSONB: const summary = JSON.parse(session.summary) as SessionSummary
    //    (SessionSummary type from finale-schemas.ts)
    //
    // 3. Fetch media captures: findSessionMediaCaptures(sessionId)
    //    For each capture with storage_path, generate signed URL via generateDownloadUrl()
    //    Use Promise.all() for parallel URL generation (pattern from GET /api/sessions at line ~34)
    //    Wrap in try-catch for StorageUnavailableError — set url to null if unavailable
    //
    // 4. NOTE: No poster URL needed — poster is a client-side ephemeral artifact (Story 8.3).
    //    Flutter re-renders it from setlist data using SetlistPosterWidget.
    //
    // 5. Compute sessionDurationMs from ended_at - created_at if not in summary.stats
    //
    // 6. Assemble response from summary fields + media URLs + session metadata
    //    Return: reply.send({ data: { ...sessionDetail } })
    //
    // SECURITY: Return 403 for BOTH "not authorized" AND "not found" cases
    //   to prevent session ID enumeration attacks. Never return 404 for sessions.
    ```
  - [x] 3.2 Add params validation schema: `{ id: z.string().uuid() }` (or appropriate ID format)

- [x] Task 4: Implement SessionDetailProvider (AC: #1)
  - [x] 4.1 Create `apps/flutter_app/lib/state/session_detail_provider.dart`:
    ```dart
    // SessionDetail model class (or use generated dart-open-fetch type):
    //   id, venueName, vibe, createdAt, endedAt,
    //   stats (SessionDetailStats), participants (List<SessionDetailParticipant>),
    //   setlist (List<SessionDetailSetlistItem>), awards (List<SessionDetailAward>),
    //   media (List<SessionDetailMedia>)
    //   // No posterUrl — poster is rendered client-side from setlist data
    //
    // SessionDetailProvider extends ChangeNotifier:
    //   _detailState (LoadingState) — per-operation, NOT global isLoading
    //   _detail (SessionDetail?)
    //   _error (String?)
    //
    //   LoadingState get detailState
    //   SessionDetail? get detail
    //   String? get error
    //
    //   void onDetailLoaded(SessionDetail detail) — sets _detail, _detailState = success
    //   void onLoadError(String message) — sets _error, _detailState = error
    //   void reset() — clears all state back to idle (call on sign-out or when leaving screen)
    //
    // Provider is READ-ONLY from widgets — only ApiService calls mutation methods
    // Follow TimelineProvider pattern (timeline_provider.dart)
    ```

- [x] Task 5: Add fetchSessionDetail to ApiService (AC: #1)
  - [x] 5.1 Add method to `apps/flutter_app/lib/api/api_service.dart`:
    ```dart
    // Follow fetchSessions() pattern (line ~302):
    //   1. Set _authMiddleware.token = token
    //   2. Build URL: '$_baseUrl/api/sessions/$sessionId'
    //   3. Create HttpRequest(method: 'GET', url: url, headers: {'Content-Type': 'application/json'})
    //   4. Send via _chain.send(request)
    //   5. Check statusCode == 200
    //   6. Parse: jsonDecode(response.body)['data']
    //   7. Map to SessionDetail model (or generated type)
    //   8. Finally: _authMiddleware.token = null
    //   9. On non-200: throw ApiException
    //
    // If dart-open-fetch generates SessionDetail type from OpenAPI, use it
    // If not (due to nested object limitation), create manual Dart model
    ```

- [x] Task 6: Implement SessionDetailScreen UI (AC: #1, #2)
  - [x] 6.1 Create `apps/flutter_app/lib/screens/session_detail_screen.dart` as StatefulWidget:
    ```dart
    // Constructor: SessionDetailScreen({required this.sessionId})
    // Extract sessionId from GoRouter path parameter in app.dart
    //
    // State management:
    //   initState: no context-dependent work
    //   didChangeDependencies: trigger load via addPostFrameCallback (guard: idle state only)
    //   dispose: clean up any controllers
    //
    // _loadDetail() method:
    //   1. Set detailProvider.detailState = LoadingState.loading (or call a startLoading method)
    //   2. Get token from authProvider
    //   3. Call apiService.fetchSessionDetail(token: token, sessionId: sessionId)
    //   4. On success: detailProvider.onDetailLoaded(detail)
    //   5. On error: detailProvider.onLoadError(message)
    //
    // Build method — single ScrollView with 5 sections:
    //   Use CustomScrollView with SliverList or SingleChildScrollView with Column
    //   NO tabs, NO sub-navigation — single continuous scroll (AC #2)
    ```
  - [x] 6.2 Section 1 — Session Header widget:
    ```dart
    // Display: venue name (or Copy.karaokeNight fallback), formatted date, duration, participant count, vibe indicator
    // Duration: compute from endedAt - createdAt, format as "Xh Ym"
    // Use DJTokens for all spacing/colors
    // Reuse card styling from SessionTimelineCard or _StatCard pattern
    ```
  - [x] 6.3 Section 2 — Participant List widget:
    ```dart
    // Display each participant: displayName, topAward (badge/chip), participationScore
    // Handle nullable userId (guest participants show guest_name)
    // Sort by participationScore descending (or keep server order)
    // Use DJTokens.surfaceElevated for card backgrounds
    // Key: Key('participant-${participant.displayName}')
    ```
  - [x] 6.4 Section 3 — Setlist widget:
    ```dart
    // Display numbered list: position, song title, artist, performerName, awardTitle + awardTone
    // Format as a visual "setlist poster" style list
    // Each row: number, title/artist, performer chip, award badge (if any)
    // Key: Key('setlist-item-$position')
    ```
  - [x] 6.5 Section 4 — Media Gallery widget:
    ```dart
    // Display as inline grid within scroll flow (AC #2 — NOT a separate scrollable area)
    // Use GridView.builder with shrinkWrap: true, physics: NeverScrollableScrollPhysics()
    //   (so it doesn't scroll independently within the parent ScrollView)
    // Grid: 3 columns, square aspect ratio thumbnails
    // Each cell: Image.network(media.url) with error/loading placeholders
    // Tap to view full-screen (use showDialog or Navigator.push with a full-screen image viewer)
    // Handle null URLs gracefully (storage unavailable — show placeholder)
    // Key: Key('media-${media.id}')
    ```
  - [x] 6.6 Section 5 — Setlist Poster (client-side render from setlist data):
    ```dart
    // IMPORTANT: Poster is NOT fetched from server — it's a client-side ephemeral artifact (Story 8.3)
    // Reuse existing SetlistPosterWidget from apps/flutter_app/lib/widgets/setlist_poster_widget.dart
    // Pass detail.setlist data (convert SessionDetailSetlistItem to SetlistEntry if types differ)
    // The widget already handles rendering the poster from setlist data
    // If setlist is empty: hide this section entirely
    // Do NOT add share/save functionality here — that's the existing SetlistPosterWidget's job
    // wrapped in a Container with section header "Setlist Poster"
    ```
  - [x] 6.7 Update `apps/flutter_app/lib/app.dart` — replace route stub (line ~53) with:
    ```dart
    GoRoute(
      path: '/session/:id',
      builder: (context, state) {
        final sessionId = state.pathParameters['id']!;
        return SessionDetailScreen(sessionId: sessionId);
      },
    ),
    ```
  - [x] 6.8 Loading/error states:
    ```dart
    // Loading: Show CircularProgressIndicator centered
    // Error: Show error message with retry button
    // Idle: Same as loading (treat idle as pre-load state)
    // Follow home_screen.dart _buildTimeline pattern for state switching
    ```
  - [x] 6.9 Story 9.5 placeholder buttons at bottom of scroll:
    ```dart
    // Add disabled/placeholder buttons at the bottom for future Story 9.5 implementation:
    //   [SHARE SESSION] — disabled, greyed out (FR111 — Story 9.5)
    //   [LET'S GO AGAIN!] — disabled, greyed out (FR112 — Story 9.5)
    // This matches the UX mockup layout and prevents layout restructuring in Story 9.5
    // Use Copy constants: Copy.shareSession, Copy.letsGoAgain (add to copy.dart)
    // Style: DJTokens.surfaceElevated background, DJTokens.textSecondary for disabled text
    ```

- [x] Task 7: Register SessionDetailProvider (AC: #1)
  - [x] 7.1 Add `ChangeNotifierProvider(create: (_) => SessionDetailProvider())` to `apps/flutter_app/lib/config/bootstrap.dart` MultiProvider list
  - [x] 7.2 Add `SessionDetailProvider` to ALL test files that build widgets requiring full provider tree (check for provider-not-found errors):
    - `test/screens/home_screen_test.dart`
    - `test/screens/join_screen_test.dart`
    - `test/routing/deep_link_test.dart`
    - Any other test files that use `_wrapWithProviders` or similar helpers

- [x] Task 8: Add copy constants (AC: #1, #2)
  - [x] 8.1 Add to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    // Session Detail Screen (Story 9.4)
    static const String sessionDetail = 'Session Detail';
    static const String participants = 'Participants';
    static const String setlist = 'Setlist';
    static const String awards = 'Awards';
    static const String mediaGallery = 'Gallery';
    static const String setlistPoster = 'Setlist Poster';
    static const String sessionDuration = 'Duration';
    static const String songs = 'songs';
    static const String reactions = 'reactions';
    static const String loadDetailError = 'Could not load session details. Tap to retry.';
    static const String sessionNotFound = 'Session not found';
    static const String shareSession = 'Share Session';  // Story 9.5 placeholder
    static const String letsGoAgain = "Let's go again!";  // Story 9.5 placeholder
    // Add more as needed during implementation — keep all strings here
    ```

- [x] Task 9: Run dart-open-fetch type generation (AC: #1)
  - [x] 9.1 After schemas registered and server running:
    ```bash
    dart_open_fetch generate \
      --source http://localhost:3000/openapi.json \
      --output apps/flutter_app/lib/api/generated \
      --client-name KaramaniaApiClient
    ```
  - [x] 9.2 Verify generated types include: `SessionDetail`, `SessionDetailParticipant`, `SessionDetailSetlistItem`, `SessionDetailAward`, `SessionDetailMedia`, `SessionDetailStats`
  - [x] 9.3 If dart-open-fetch generates nested objects as `Map<String, dynamic>` (known v0.1.0 limitation), create manual Dart model classes instead and parse JSON in ApiService

- [x] Task 10: Server tests (AC: #1)
  - [x] 10.1 Add tests to `apps/server/tests/persistence/session-repository.test.ts`:
    - `findSessionDetail` returns session when user is host
    - `findSessionDetail` returns session when user is participant (not host)
    - `findSessionDetail` returns null when user is neither host nor participant
    - `findSessionDetail` returns null for non-ended session
    - `findSessionDetail` returns null for session without summary
  - [x] 10.2 Add tests to `apps/server/tests/routes/sessions.test.ts`:
    - GET /api/sessions/:id returns 401 without auth
    - GET /api/sessions/:id returns 403 when user is not host or participant
    - GET /api/sessions/:id returns full session detail with all sections
    - GET /api/sessions/:id returns 403 for non-existent session (NOT 404 — prevents ID enumeration)
    - GET /api/sessions/:id handles media with unavailable storage gracefully (url = null)
  - [x] 10.3 Reuse existing test factories: `createEndedSessionWithSummary()`, `createTestMediaCapture()`, `createTestUser()` from `apps/server/tests/factories/`

- [x] Task 11: Flutter tests (AC: #1, #2)
  - [x] 11.1 Add tests to `apps/flutter_app/test/state/session_detail_provider_test.dart`:
    - onDetailLoaded sets detail and state to success
    - onLoadError sets error message and state to error
    - reset clears all state to idle
  - [x] 11.2 Add tests to `apps/flutter_app/test/screens/session_detail_screen_test.dart`:
    - Loading state shows progress indicator
    - Success state shows all 5 sections
    - Error state shows error message with retry
    - Participant list displays names and awards
    - Setlist displays song titles with positions
    - Media gallery renders as grid
    - Poster section renders SetlistPosterWidget from setlist data
    - Poster section hidden when setlist is empty
    - Story 9.5 placeholder buttons render as disabled
  - [x] 11.3 Add widget tests for reusable section widgets (if extracted to separate files)

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All session detail data fetched via REST API. No client-side computation of stats, awards, or setlist
- **Persistence boundary**: Only `session-repository.ts` and `media-repository.ts` query the database. Route handler calls persistence, never raw Kysely
- **Flutter boundary**: `SessionDetailProvider` is a read-only reactive state container. Only `ApiService` calls mutation methods. No widget creates its own data fetch
- **Casing rules**: DB columns are `snake_case`, Zod schemas transform to `camelCase` at boundary, Dart types are `camelCase`
- **Error handling**: REST responses use `{ data: {...} }` or `{ error: { code, message } }` format
- **Authorization**: Route must verify user is host OR participant before returning session data — this is NOT optional, it's a security requirement. Return 403 for BOTH unauthorized AND not-found cases to prevent session ID enumeration

### Key Existing Code to Extend

- **Session repository**: `apps/server/src/persistence/session-repository.ts` — add `findSessionDetail()`. Existing `findById()` (line ~15) shows query pattern. `getParticipants()` (line ~76) shows participant join pattern
- **Media repository**: `apps/server/src/persistence/media-repository.ts` — existing `findBySessionId()` (line ~29) returns captures ordered by created_at. Reuse directly or extend
- **Session routes**: `apps/server/src/routes/sessions.ts` — add GET /:id alongside existing GET / (line ~21). Follow same `requireAuth` + `generateDownloadUrl` pattern
- **Timeline schemas**: `apps/server/src/shared/schemas/timeline-schemas.ts` — add detail schemas here (co-located with timeline schemas)
- **Finale schemas**: `apps/server/src/shared/schemas/finale-schemas.ts` — `sessionSummarySchema` (line ~59) defines the exact shape of the `sessions.summary` JSONB column. Use this as reference for what data is available
- **Media storage**: `apps/server/src/services/media-storage.ts` — `generateDownloadUrl()` (line ~47) for signed URLs. Always try-catch `StorageUnavailableError`
- **Route stub**: `apps/flutter_app/lib/app.dart` (line ~53) — placeholder route at `/session/:id` to replace
- **Timeline provider**: `apps/flutter_app/lib/state/timeline_provider.dart` — follow this exact ChangeNotifier pattern for SessionDetailProvider
- **API service**: `apps/flutter_app/lib/api/api_service.dart` — `fetchSessions()` (line ~302) shows the manual HTTP call pattern to follow
- **Home screen**: `apps/flutter_app/lib/screens/home_screen.dart` — shows loading/error/success state handling pattern with `addPostFrameCallback`
- **Card styling**: `apps/flutter_app/lib/widgets/session_timeline_card.dart` — reuse `DJTokens.surfaceElevated` card styling
- **Copy constants**: `apps/flutter_app/lib/constants/copy.dart` — add new strings in a "Session Detail Screen (Story 9.4)" section

### Session Summary Data Structure (from Story 8.4)

The `sessions.summary` JSONB column contains a `SessionSummary` object with all data needed for the detail view:
```typescript
{
  version: 1,
  generatedAt: number,
  stats: { songCount, participantCount, sessionDurationMs, totalReactions, totalSoundboardPlays, totalCardsDealt, topReactor: { displayName, count } | null, longestStreak },
  setlist: [{ position, title, artist, performerName, awardTitle, awardTone }],
  awards: [{ userId, displayName, category, title, tone, reason }],
  participants: [{ userId (nullable), displayName, participationScore, topAward }]
}
```

This means the route handler can return most detail data from a SINGLE database row (`sessions.summary`), supplemented by media captures from `media_captures` table.

### Setlist Poster (from Story 8.3)

Poster is a **client-side ephemeral artifact** — NOT stored on the server. Story 8.3 scope explicitly states: "NO poster persistence on server." The poster is:
1. Rendered client-side via `SetlistPosterWidget` (`apps/flutter_app/lib/widgets/setlist_poster_widget.dart`)
2. Captured as PNG using `RenderRepaintBoundary.toImage()` with `pixelRatio: 3.0`
3. Shared via native share sheet using `SharePlus`
4. Automatically destroyed after share

For the session detail screen: **re-render the poster** from `SessionSummary.setlist` data by reusing the existing `SetlistPosterWidget`. No server-side poster URL needed.

### Existing Captures Endpoint

There is already a `GET /api/sessions/:sessionId/captures` endpoint in `apps/server/src/routes/captures.ts` with download URL generation. For the session detail screen, we consolidate media into the single `/api/sessions/:id` response to minimize round trips. The signed URL generation logic from `services/media-storage.ts` (`generateDownloadUrl`) is reused in the detail route handler.

### UX Design Reference

The UX design spec (`_bmad-output/planning-artifacts/ux-design-specification.md`, lines 1334-1380) defines the exact layout:
- Top bar with session date, venue, duration, participant count
- Participants section with names + top awards
- Setlist section with numbered songs + performers + awards
- Media section as inline grid
- Setlist poster section
- Bottom: [SHARE SESSION] and [LET'S GO AGAIN!] buttons (Story 9.5 — add disabled placeholders)

Single continuous scroll — no tabs or sub-navigation per FR110.

### Previous Story Learnings (from Story 9.3)

- **Route-level signed URL generation**: Generate download URLs in the route handler AFTER the DB query, not in the persistence layer. Use `Promise.all()` for parallel generation
- **StorageUnavailableError handling**: Wrap `generateDownloadUrl()` in try-catch, set URL to null if storage unavailable — do NOT fail the entire request
- **Provider registration in tests**: When adding a new provider, update ALL test files that build widget trees. Story 9.3 had to add `TimelineProvider` to `join_screen_test.dart` and `deep_link_test.dart`. Do the same for `SessionDetailProvider`
- **Schema registration**: All Zod schemas MUST use `z.globalRegistry.add(schema, { id: 'Name' })` and MUST be top-level (not inline) for dart-open-fetch to generate typed Dart classes
- **LoadingState idle vs loading**: Treat `idle` the same as `loading` visually (show spinner) to prevent brief UI glitch before load starts
- **Timezone handling**: Use `.toLocal()` when formatting dates for display in Flutter
- **Test dates**: Use noon UTC for test dates to avoid timezone-related day-shift in assertions

### Git Intelligence (Recent Commits)

Stories 9.1-9.3 established:
- REST auth middleware pattern (`requireAuth` + `request.requestContext!.userId`)
- ApiService manual HTTP chain pattern for authenticated calls
- TimelineProvider as reactive ChangeNotifier with per-operation LoadingState
- Provider test patterns: mock via `ChangeNotifierProvider.value()`, add all providers to `_wrapWithProviders`
- Card/widget styling with DJTokens, Copy constants for all strings

### Project Structure Notes

- Server files: `kebab-case.ts` naming
- Flutter files: `snake_case.dart` naming
- No barrel files — import directly from specific files
- Server imports: relative with `.js` extension
- Flutter imports: `package:karamania/...` for cross-directory

### Testing Standards

- **DO NOT test**: animations, visual effects, color values, transition timings
- **DO test**: state transitions, data flow, API response handling, authorization checks, empty/error states, section rendering
- **Server**: Transaction per test, rolled back. Use shared factories from `tests/factories/`
- **Flutter**: Widget tests with mocked providers. Per-operation LoadingState assertions
- **Authorization**: MUST test that non-host/non-participant users get 403

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 - Session Timeline & Memories - Story 9.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#REST API Endpoints - GET /api/sessions/:id]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema - sessions, session_participants, media_captures]
- [Source: _bmad-output/planning-artifacts/architecture.md#Flutter State Management - TimelineProvider]
- [Source: _bmad-output/project-context.md#Server Boundaries, Flutter Boundaries, Database Schema]
- [Source: apps/server/src/shared/schemas/finale-schemas.ts#SessionSummary]
- [Source: apps/server/src/persistence/session-repository.ts#findById, getParticipants, findUserSessions]
- [Source: apps/server/src/persistence/media-repository.ts#findBySessionId]
- [Source: apps/server/src/routes/sessions.ts#GET /api/sessions]
- [Source: apps/server/src/services/media-storage.ts#generateDownloadUrl]
- [Source: apps/flutter_app/lib/app.dart#line ~53 route stub]
- [Source: apps/flutter_app/lib/state/timeline_provider.dart]
- [Source: apps/flutter_app/lib/api/api_service.dart#fetchSessions line ~302]
- [Source: _bmad-output/implementation-artifacts/9-3-session-timeline-screen.md#Completion Notes]
- [Source: _bmad-output/implementation-artifacts/8-3-setlist-poster-generation-and-sharing.md#Scope: client-side ephemeral]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#lines 1334-1380 Session Detail mockup]
- [Source: apps/server/src/routes/captures.ts#existing captures endpoint]
- [Source: apps/flutter_app/lib/widgets/setlist_poster_widget.dart#reuse for poster rendering]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Added `findSessionDetail(sessionId, userId)` to session-repository.ts with authorization check (host OR participant). Reused existing `findBySessionId` from media-repository.ts directly.
- Task 2: Added 7 Zod schemas (participant, setlist item, award, media, stats, detail, response) to timeline-schemas.ts. All registered with `z.globalRegistry.add()` as separate named schemas for dart-open-fetch compatibility.
- Task 3: Added GET /api/sessions/:id route with requireAuth, summary JSONB parsing, media signed URL generation (with StorageUnavailableError handling), and 403 for both unauthorized and not-found cases.
- Task 4: Created SessionDetailProvider with per-operation LoadingState, SessionDetail model with fromJson, and all sub-models (Stats, Participant, SetlistItem, Award, Media).
- Task 5: Added `fetchSessionDetail` to ApiService following the existing `fetchSessions` manual HTTP chain pattern.
- Task 6: Implemented SessionDetailScreen as single continuous scroll (no tabs) with 5 sections: header, participants, setlist, media gallery (inline grid), setlist poster (reusing SetlistPosterWidget). Added Story 9.5 placeholder buttons. Replaced route stub in app.dart.
- Task 7: Registered SessionDetailProvider in bootstrap.dart MultiProvider and added to all test files with widget trees (home_screen_test, join_screen_test, deep_link_test).
- Task 8: Added 13 Copy constants for Session Detail Screen.
- Task 9: Created manual Dart model classes (dart-open-fetch v0.1.0 limitation for nested objects). Schemas registered for future type generation.
- Task 10: Added 5 persistence tests for findSessionDetail and 5 route tests for GET /api/sessions/:id. All pass.
- Task 11: Added 8 provider tests and 11 screen widget tests. All pass. No regressions (5 pre-existing failures in party_screen_test and join_screen_test are unrelated).

### Senior Developer Review (AI)

**Reviewer:** Code Review Workflow — 2026-03-21
**Outcome:** Changes Requested → Auto-fixed

**Issues Found & Fixed (8 total: 2 High, 4 Medium, 2 Low):**

1. **[HIGH] Stale provider state on re-navigation** — SessionDetailProvider is a global singleton; navigating to session A then session B reused stale state. **Fix:** Cache provider reference, call `reset()` in `dispose()` to clean up on exit.
2. **[HIGH] `SessionDetailAward.userId` non-nullable but guests have null userId** — Zod schema used `z.string()`, Dart used `String`. **Fix:** Changed to `z.string().nullable()` and `String?` in Dart model.
3. **[MEDIUM] `_loadDetail()` swallowed all exceptions silently** — `catch (_)` hid programmer errors. **Fix:** Added `debugPrint` of caught exception.
4. **[MEDIUM] Missing vibe indicator in header** — UX spec shows vibe indicator, but header didn't render it. **Fix:** Added vibe emoji display in header row.
5. **[MEDIUM] Unused awards section data** — Award details (categories, reasons, tones) fetched but unused in UI. Inline display via participant topAward chips and setlist awardTitle badges covers AC #1's 5-section requirement. No code change needed — noted as acceptable.
6. **[MEDIUM] Weak "idle state triggers loading" test** — Asserted `idle || loading || error` which was always true. **Fix:** Changed to `expect(provider.detailState, isNot(LoadingState.idle))`.
7. **[LOW] `_formatDuration` edge case with 0ms** — Shows "0m". Acceptable for sessions that shouldn't have 0 duration. No change.
8. **[LOW] Magic number borderRadius(12)** — Not a DJTokens constant. Minor inconsistency, no change.

### Change Log

- 2026-03-21: Implemented Story 9.4 — Session Detail Screen with server endpoint, Flutter UI, and comprehensive tests
- 2026-03-21: Code review fixes — stale provider state, nullable award userId, error logging, vibe indicator, weak test assertion

### File List

**Server (new/modified):**
- apps/server/src/persistence/session-repository.ts (modified — added findSessionDetail)
- apps/server/src/shared/schemas/timeline-schemas.ts (modified — added 7 session detail schemas)
- apps/server/src/routes/sessions.ts (modified — added GET /api/sessions/:id route)
- apps/server/tests/persistence/session-repository.test.ts (modified — added 5 findSessionDetail tests)
- apps/server/tests/routes/sessions.test.ts (modified — added 5 GET /api/sessions/:id tests)

**Flutter (new):**
- apps/flutter_app/lib/state/session_detail_provider.dart (new — provider + model classes)
- apps/flutter_app/lib/screens/session_detail_screen.dart (new — full detail screen UI)
- apps/flutter_app/test/state/session_detail_provider_test.dart (new — 8 tests)
- apps/flutter_app/test/screens/session_detail_screen_test.dart (new — 11 tests)

**Flutter (modified):**
- apps/flutter_app/lib/api/api_service.dart (modified — added fetchSessionDetail)
- apps/flutter_app/lib/app.dart (modified — replaced route stub with SessionDetailScreen)
- apps/flutter_app/lib/config/bootstrap.dart (modified — registered SessionDetailProvider)
- apps/flutter_app/lib/constants/copy.dart (modified — added 13 session detail constants)
- apps/flutter_app/test/screens/home_screen_test.dart (modified — added SessionDetailProvider)
- apps/flutter_app/test/screens/join_screen_test.dart (modified — added SessionDetailProvider)
- apps/flutter_app/test/routing/deep_link_test.dart (modified — added SessionDetailProvider)

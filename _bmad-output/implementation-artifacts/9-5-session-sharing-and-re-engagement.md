# Story 9.5: Session Sharing & Re-engagement

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to share a past session and rally friends for another party,
So that great memories drive future karaoke nights.

## Acceptance Criteria

1. **Given** a user is viewing a Session Detail screen, **When** they tap the share action, **Then** the native share sheet opens with a shareable link (FR111) **And** the link opens a read-only web view of the session detail (setlist, awards, stats, media) (FR111) **And** no app is required to view the shared link (FR111)
2. **Given** a user wants to organize another party, **When** they tap "Let's go again!", **Then** a pre-composed message is generated containing the venue name, a date suggestion, and a link to download Karamania (FR112) **And** the message is shared via the native share sheet for the user to send through their preferred messaging app (WhatsApp, Zalo, iMessage, etc.) (FR112) **And** no in-app messaging is used -- the feature leverages existing group chats (FR112)

## Tasks / Subtasks

- [x] Task 1: Add public share endpoint on server (AC: #1)
  - [x]1.1 Create `apps/server/src/shared/schemas/share-schemas.ts`:
    ```typescript
    // shareSessionParticipantSchema: { displayName: z.string(), participationScore: z.number(), topAward: z.string().nullable() }
    // shareSessionSetlistItemSchema: { position: z.number(), title: z.string(), artist: z.string(), performerName: z.string().nullable(), awardTitle: z.string().nullable(), awardTone: z.string().nullable() }
    // shareSessionStatsSchema: { songCount, participantCount, sessionDurationMs, totalReactions }
    // shareSessionSchema: { id, venueName, vibe, createdAt, endedAt, stats, participants[], setlist[], mediaUrls: string[] }
    // shareSessionResponseSchema: dataResponseSchema wrapping shareSessionSchema
    //
    // NOTE: Share response is a SUBSET of sessionDetailSchema — no awards array (too detailed for public),
    //   no media IDs/triggerTypes (just URL array for gallery display), fewer stats fields
    //   This prevents leaking internal IDs and keeps payload small for web view
    //
    // Register ALL schemas with z.globalRegistry.add(schema, { id: 'Name' })
    // Follow naming pattern from timeline-schemas.ts
    ```
  - [x]1.2 Import share-schemas.ts in `apps/server/src/index.ts` BEFORE swagger init:
    ```typescript
    // Add after line 47 (after timeline-schemas import):
    await import('./shared/schemas/share-schemas.js');
    ```
  - [x]1.3 Create `apps/server/src/routes/share.ts`:
    ```typescript
    // PUBLIC endpoint — NO requireAuth middleware
    //
    // GET /api/sessions/:id/share
    //
    // 1. Query session: findById(sessionId) from session-repository.ts
    //    - Return 404 if not found (public endpoint — no security concern about enumeration since
    //      session IDs are UUIDs and not guessable, unlike the authenticated endpoint which returns 403)
    //    - Return 404 if session.status !== 'ended' (don't expose active sessions)
    //    - Return 404 if session.summary is null (session hasn't been summarized yet)
    //
    // 2. Parse summary JSONB: const summary = JSON.parse(session.summary) as SessionSummary
    //
    // 3. Fetch media captures: findBySessionId(sessionId) from media-repository.ts
    //    For each capture with storage_path, generate signed URL via generateDownloadUrl()
    //    Use Promise.all() for parallel URL generation
    //    Wrap in try-catch for StorageUnavailableError — filter out captures with unavailable URLs
    //    Only return the URL strings (not IDs or trigger types) — public consumers don't need internal metadata
    //
    // 4. Compute sessionDurationMs from ended_at - created_at
    //
    // 5. Assemble public share response:
    //    {
    //      data: {
    //        id: session.id,
    //        venueName: session.venue_name,
    //        vibe: session.vibe,
    //        createdAt: session.created_at.toISOString(),
    //        endedAt: session.ended_at?.toISOString(),
    //        stats: { songCount, participantCount, sessionDurationMs, totalReactions },
    //        participants: summary.participants.map(p => ({ displayName: p.displayName, participationScore: p.participationScore, topAward: p.topAward })),
    //        setlist: summary.setlist,
    //        mediaUrls: validUrls  // just string[] of signed URLs
    //      }
    //    }
    //
    // SECURITY CONSIDERATIONS:
    // - No user IDs exposed in share response (stripped from participants)
    // - Media URLs are signed with 1hr TTL (temporary access)
    // - Only ended sessions with summaries are shareable
    // - Session UUIDs are not guessable — no enumeration risk
    //
    // Error format: { error: { code: 'SESSION_NOT_FOUND', message: '...' } }
    // Import findById from session-repository.ts (already exists, used by session-manager)
    ```
  - [x]1.4 Register share routes in `apps/server/src/index.ts`:
    ```typescript
    // Add import at top:
    import { shareRoutes } from './routes/share.js';
    // Add registration after sessionRoutes (line ~64):
    await fastify.register(shareRoutes);
    ```

- [x] Task 2: Add server-rendered HTML share page (AC: #1)
  - [x]2.1 Create `apps/web_landing/share.html`:
    ```html
    <!-- Read-only session detail web view -->
    <!-- Matches existing web_landing dark theme (style.css CSS variables) -->
    <!--
      OpenGraph meta tags for social media link previews (WhatsApp, iMessage, Facebook, etc.):
      <meta property="og:type" content="website">
      <meta property="og:title" content="Karamania Session">
      <meta property="og:description" content="Check out this karaoke session on Karamania!">
      <meta property="og:image" content="https://karamania.app/og-share.png">
      <meta property="og:url" content="">  (populated by share.js from window.location.href)
      <meta name="twitter:card" content="summary_large_image">
      NOTE: These are STATIC tags — social media crawlers don't execute JS, so dynamic per-session
      OG tags would require server-side rendering. Static branding is the MVP approach.
      A future enhancement could add a server endpoint that returns HTML with dynamic OG tags.
    -->
    <!-- Structure:
      - KARAMANIA header (reuse h1 styling from index.html)
      - Session header: venue name, date, duration, participant count, vibe
      - Participants section: each with displayName + topAward badge
      - Setlist section: numbered list with title, artist, performerName, award
      - Media gallery: grid of thumbnail images (if any)
      - Stats summary: songs, reactions count
      - CTA: "Download Karamania" button → app store link (same as index.html store buttons)
      - "Open in App" button for mobile users (deep link attempt)
      - Footer: "Shared from Karamania" branding
    -->
    <!-- Required DOM element IDs (referenced by share.js):
      id="share-loading" — loading state container
      id="share-error" — error state container
      id="share-content" — main content container (hidden until data loaded)
      id="share-venue" — venue name text
      id="share-date" — formatted date text
      id="share-duration" — formatted duration text
      id="share-vibe" — vibe emoji
      id="share-participant-count" — participant count
      id="share-song-count" — song count
      id="share-reaction-count" — reaction count
      id="share-participants-list" — participant list container
      id="share-setlist" — setlist container
      id="share-media-grid" — media grid container
      id="open-app-btn" — deep link button
      id="store-buttons" — app store download links
    -->
    <!-- Mobile-first responsive design (max-width: 428px like index.html) -->
    <!-- Keep page lightweight — vanilla HTML/CSS/JS, no framework -->
    <!-- Session data loaded via fetch() to /api/sessions/:id/share -->
    <!-- Session ID extracted from URL: share.html?session=SESSION_ID -->
    <!-- Error states: "Session not found" if API returns 404, "Check your internet connection" on network failure -->
    <!-- Loading state: "Loading session..." text (consistent with minimal existing approach) -->
    ```
  - [x]2.2 Create `apps/web_landing/share.js`:
    ```javascript
    // Use async/await pattern (consistent with project conventions — no .then() chains)
    //
    // (async function () {
    //   'use strict';
    //
    //   var params = new URLSearchParams(window.location.search);
    //   var sessionId = params.get('session');
    //   if (!sessionId) { showError('No session specified'); return; }
    //
    //   // Show loading state
    //   document.getElementById('share-loading').classList.remove('hidden');
    //
    //   try {
    //     var response = await fetch('/api/sessions/' + encodeURIComponent(sessionId) + '/share');
    //     if (!response.ok) { showError('Session not found'); return; }
    //     var json = await response.json();
    //     renderSession(json.data);
    //   } catch (err) {
    //     showError('Check your internet connection and try again');
    //   }
    //
    //   function showError(message) { ... hide loading, show error with message ... }
    //   function renderSession(session) { ... populate DOM elements by ID ... }
    // })();
    //
    // renderSession(session):
    //   - Format date: new Date(session.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    //   - Format duration: compute hours/minutes from sessionDurationMs
    //   - Build participant list HTML with topAward badges
    //   - Build setlist numbered list with performer names and awards
    //   - Build media grid with <img loading="lazy"> tags (3-column grid CSS)
    //   - Build stats summary
    //   - Hide loading, show share-content container
    //
    // Platform detection for store buttons (reuse logic from script.js):
    //   var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    //   var isAndroid = /Android/i.test(navigator.userAgent);
    //   - iOS → Apple App Store link
    //   - Android → Google Play link
    //   - Desktop → show both
    //
    // Deep link attempt: karamania://session/SESSION_ID
    //   - "Open in App" button for mobile users
    //   - Fallback to app store after 2s timeout (same pattern as script.js)
    ```
  - [x]2.3 Add share page styles to `apps/web_landing/style.css` (extend existing file):
    ```css
    /* Share page styles — extend existing CSS variables and patterns */
    /* .share-header: venue name + date + vibe emoji */
    /* .share-stats: horizontal stat cards (songs, participants, duration, reactions) */
    /* .share-participants: list with award badges */
    /* .share-setlist: numbered list with performer and award chips */
    /* .share-media-grid: 3-column grid, square aspect ratio, object-fit: cover */
    /* .share-cta: download button matching .btn-primary style */
    /* .share-footer: branding text in --dj-text-secondary */
    /* All using existing CSS variables (--dj-bg, --dj-surface, --dj-text-primary, etc.) */
    ```

- [x] Task 3: Update web landing routing for share pages (AC: #1)
  - [x]3.1 Update `apps/web_landing/script.js` to detect session share URLs:
    ```javascript
    // At the top, after 'code' param extraction (line ~5):
    var sessionId = params.get('session');

    // If sessionId present, redirect to share page:
    if (sessionId) {
      window.location.href = '/share.html?session=' + encodeURIComponent(sessionId);
      return;  // Stop executing party-join logic
    }
    // Rest of existing code unchanged...
    ```
  - [x]3.2 Add deep link handling for session URLs in `apps/flutter_app/lib/app.dart`:
    ```dart
    // In GoRouter redirect (after existing code=VIBE redirect at line ~30):
    // Handle deep link: /?session=SESSION_ID → /session/SESSION_ID
    if (state.matchedLocation == '/' && state.uri.queryParameters.containsKey('session')) {
      final sessionId = state.uri.queryParameters['session'];
      if (sessionId != null && sessionId.isNotEmpty) {
        return '/session/$sessionId';
      }
    }
    // Also handle direct deep link: karamania://session/SESSION_ID
    // This is already handled by the GoRoute path: '/session/:id'
    ```

- [x] Task 4: Activate share button on Session Detail screen (AC: #1)
  - [x]4.1 Replace `_PlaceholderButtons` in `apps/flutter_app/lib/screens/session_detail_screen.dart` with active share buttons:
    ```dart
    // REQUIRED IMPORTS — add these at the top of session_detail_screen.dart:
    //   import 'package:share_plus/share_plus.dart';
    //   import 'package:karamania/config/app_config.dart';
    // (Copy and DJTokens imports should already exist)
    //
    // Replace _PlaceholderButtons widget (lines 548-590) with _SessionActions widget
    //
    // class _SessionActions extends StatelessWidget {
    //   final SessionDetail detail;
    //   const _SessionActions({required this.detail});
    //
    //   @override Widget build(BuildContext context) {
    //     return Column(
    //       crossAxisAlignment: CrossAxisAlignment.stretch,
    //       children: [
    //         // Share Session button (FR111)
    //         GestureDetector(
    //           key: const Key('share-session-btn'),
    //           onTap: () => _shareSession(context),
    //           child: Container(
    //             padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
    //             decoration: BoxDecoration(
    //               color: DJTokens.actionPrimary,  // Active color (was surfaceElevated when disabled)
    //               borderRadius: BorderRadius.circular(12),
    //             ),
    //             child: Center(
    //               child: Text(
    //                 Copy.shareSession,
    //                 style: Theme.of(context).textTheme.labelLarge?.copyWith(
    //                   color: DJTokens.textPrimary,  // Active text (was textSecondary)
    //                 ),
    //               ),
    //             ),
    //           ),
    //         ),
    //         const SizedBox(height: DJTokens.spaceSm),
    //         // Let's go again! button (FR112)
    //         GestureDetector(
    //           key: const Key('lets-go-again-btn'),
    //           onTap: () => _letsGoAgain(context),
    //           child: Container(
    //             padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
    //             decoration: BoxDecoration(
    //               color: DJTokens.surfaceElevated,
    //               borderRadius: BorderRadius.circular(12),
    //             ),
    //             child: Center(
    //               child: Text(
    //                 Copy.letsGoAgain,
    //                 style: Theme.of(context).textTheme.labelLarge?.copyWith(
    //                   color: DJTokens.textPrimary,  // Active text
    //                 ),
    //               ),
    //             ),
    //           ),
    //         ),
    //       ],
    //     );
    //   }
    //
    //   void _shareSession(BuildContext context) {
    //     // Generate share URL: webLandingUrl?session=SESSION_ID
    //     final shareUrl = '${AppConfig.instance.webLandingUrl}?session=${detail.id}';
    //     final shareText = Copy.shareSessionMessage(
    //       venueName: detail.venueName,
    //       url: shareUrl,
    //     );
    //     SharePlus.instance.share(ShareParams(text: shareText));
    //   }
    //
    //   void _letsGoAgain(BuildContext context) {
    //     final message = Copy.letsGoAgainMessage(
    //       venueName: detail.venueName,
    //       downloadUrl: AppConfig.instance.webLandingUrl,
    //     );
    //     SharePlus.instance.share(ShareParams(text: message));
    //   }
    // }
    ```
  - [x]4.2 Update the parent widget that uses `_PlaceholderButtons` to pass `detail` to the new `_SessionActions`:
    ```dart
    // In the build method where _PlaceholderButtons() is used, replace with:
    // _SessionActions(detail: detail)
    // 'detail' is already available from the provider's SessionDetail object
    ```

- [x] Task 5: Add copy constants for share messages (AC: #1, #2)
  - [x]5.1 Add to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    // Session Sharing (Story 9.5)
    static String shareSessionMessage({String? venueName, required String url}) {
      final venue = venueName ?? karaokeNight;  // fallback to "Karaoke Night"
      return 'Check out our $venue session on Karamania! $url';
    }

    static String letsGoAgainMessage({String? venueName, required String downloadUrl}) {
      final venue = venueName ?? 'karaoke';
      // Date suggestion: next Saturday
      final now = DateTime.now();
      final daysUntilSaturday = (DateTime.saturday - now.weekday) % 7;
      final nextSaturday = now.add(Duration(days: daysUntilSaturday == 0 ? 7 : daysUntilSaturday));
      final dateStr = '${nextSaturday.month}/${nextSaturday.day}';
      return '$venue was amazing! Let\'s do it again on $dateStr. Get Karamania: $downloadUrl';
    }
    // NOTE: karaokeNight constant already exists (used as venue fallback in session detail header)
    ```

- [x] Task 6: Server tests for share endpoint (AC: #1)
  - [x]6.1 Create `apps/server/tests/routes/share.test.ts`:
    ```typescript
    // Test: GET /api/sessions/:id/share returns public session data for ended session
    //   - Create ended session with summary (use createEndedSessionWithSummary factory)
    //   - Verify response includes: id, venueName, vibe, createdAt, endedAt, stats, participants, setlist, mediaUrls
    //   - Verify NO userId fields in participants (stripped for privacy)
    //   - Verify NO auth header required
    //
    // Test: GET /api/sessions/:id/share returns 404 for non-existent session
    //   - Verify 404 with SESSION_NOT_FOUND code
    //
    // Test: GET /api/sessions/:id/share returns 404 for active (non-ended) session
    //   - Create session with status 'active' (no summary)
    //   - Verify 404
    //
    // Test: GET /api/sessions/:id/share returns 404 for session without summary
    //   - Create ended session WITHOUT summary
    //   - Verify 404
    //
    // Test: GET /api/sessions/:id/share handles media with unavailable storage gracefully
    //   - Create session with media captures
    //   - Mock storage to throw StorageUnavailableError
    //   - Verify mediaUrls is empty array (unavailable URLs filtered out)
    //
    // Test: GET /api/sessions/:id/share returns media URLs as string array
    //   - Create session with media captures
    //   - Verify mediaUrls is string[] (not objects with id/triggerType)
    //
    // Reuse factories: createEndedSessionWithSummary(), createTestMediaCapture(), createTestUser()
    // Follow test patterns from apps/server/tests/routes/sessions.test.ts
    ```

- [x] Task 7: Flutter tests for share actions (AC: #1, #2)
  - [x]7.1 Add tests to `apps/flutter_app/test/screens/session_detail_screen_test.dart`:
    ```dart
    // Test: Share Session button is active (not disabled) when detail loaded
    //   - Find Key('share-session-btn'), verify it's wrapped in GestureDetector (not plain Container)
    //
    // Test: Share Session button is wrapped in GestureDetector (active, not disabled placeholder)
    //   - Find Key('share-session-btn'), verify ancestor is GestureDetector
    //
    // Test: Let's Go Again button is wrapped in GestureDetector (active, not disabled placeholder)
    //   - Find Key('lets-go-again-btn'), verify ancestor is GestureDetector
    //
    // NOTE: SharePlus.instance.share() cannot be easily mocked in widget tests.
    // Test message generation logic via unit tests on Copy methods instead (see 7.2 below).
    ```
  - [x]7.2 Add unit tests to `apps/flutter_app/test/constants/copy_test.dart` (create if not exists):
    ```dart
    // Test: Copy.shareSessionMessage includes session URL with correct format
    //   expect(Copy.shareSessionMessage(venueName: 'Test Bar', url: 'https://karamania.app?session=abc'),
    //     contains('https://karamania.app?session=abc'));
    //   expect(result, contains('Test Bar'));
    //
    // Test: Copy.letsGoAgainMessage includes venue name and date suggestion
    //   final result = Copy.letsGoAgainMessage(venueName: 'Test Bar', downloadUrl: 'https://karamania.app');
    //   expect(result, contains('Test Bar'));
    //   expect(result, contains('karamania.app'));
    //   // Verify date is in the future (next Saturday)
    //   expect(result, matches(RegExp(r'\d{1,2}/\d{1,2}')));
    //
    // Test: Copy.shareSessionMessage uses fallback when venueName is null
    //   final result = Copy.shareSessionMessage(venueName: null, url: 'https://...');
    //   expect(result, contains(Copy.karaokeNight));
    //
    // Test: Copy.letsGoAgainMessage uses fallback when venueName is null
    //   final result = Copy.letsGoAgainMessage(venueName: null, downloadUrl: 'https://...');
    //   expect(result, contains('karaoke'));
    ```
  - [x]7.3 Add deep link test to `apps/flutter_app/test/routing/deep_link_test.dart`:
    ```dart
    // Test: Deep link redirect for /?session=SESSION_ID → /session/SESSION_ID
    //   - Follow existing /?code=VIBE → /join?code=VIBE test pattern
    //   - Navigate to '/?session=test-uuid-123'
    //   - Verify redirect to '/session/test-uuid-123'
    ```

- [x] Task 8: Verify deep link configuration covers session share URLs (AC: #1)
  - [x]8.1 Verify `apps/web_landing/.well-known/apple-app-site-association`:
    ```json
    // The existing AASA file uses a wildcard component pattern ("/" : "*") that already
    // matches ALL paths including /?session=SESSION_ID and /share.html?session=SESSION_ID.
    // NO changes needed — verify the wildcard is present and covers session share URLs.
    // If the file uses a "paths" array instead of "components", THEN add "/session/*" and "/?session=*".
    ```
  - [x]8.2 Verify `apps/web_landing/.well-known/assetlinks.json`:
    ```json
    // Android App Links already use "delegate_permission/common.handle_all_urls" which covers all paths.
    // NO changes needed — verify the existing config is intact.
    ```

- [x] Task 9: Run dart-open-fetch type generation (AC: #1)
  - [x]9.1 After share schemas registered and server running:
    ```bash
    dart_open_fetch generate \
      --source http://localhost:3000/openapi.json \
      --output apps/flutter_app/lib/api/generated \
      --client-name KaramaniaApiClient
    ```
  - [x]9.2 NOTE: The Flutter app does NOT need to call the share endpoint directly — the share URL is constructed client-side and opened in an external browser by the recipient. dart-open-fetch regeneration is only needed to keep the OpenAPI spec in sync with the new schemas, and to avoid breaking existing generated types.

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: Share endpoint serves all session data from server. Flutter only constructs the share URL and delegates to native share sheet
- **Persistence boundary**: Only `session-repository.ts` and `media-repository.ts` query the database. Share route calls persistence, never raw Kysely
- **Flutter boundary**: No new provider needed. Share actions are stateless — they read from existing `SessionDetailProvider` and invoke `SharePlus`. No new state to manage
- **Casing rules**: DB columns are `snake_case`, Zod schemas transform to `camelCase` at boundary
- **Error handling**: REST responses use `{ data: {...} }` or `{ error: { code, message } }` format. Share endpoint uses 404 (not 403) since it's public
- **No barrel files**: Import directly from specific files
- **Import rules**: Server relative with `.js` extension. Flutter uses `package:karamania/...`

### Key Design Decisions

1. **Public share endpoint returns JSON, not HTML**: The web view (`share.html`) fetches JSON from `/api/sessions/:id/share` and renders client-side. This keeps the server stateless and allows the same API to power future mobile web views or social media embeds. The HTML page itself is served as a static file via `@fastify/static` (existing web-landing setup).

2. **Share URL format**: `https://karamania.app?session=SESSION_ID`. Uses query parameter on the root URL (same pattern as `?code=PARTYCODE` for party join). The `script.js` detects `?session=` and redirects to `share.html?session=ID`. This avoids needing new server-side routing — the existing `@fastify/static` serves `share.html`.

3. **No share tokens/slugs**: Session UUIDs are used directly in share URLs. UUIDs are not guessable (128-bit random), so there's no enumeration risk. This avoids a separate `share_tokens` table and simplifies the implementation.

4. **Privacy in share response**: The public share endpoint strips `userId` from participants (only `displayName`, `participationScore`, `topAward`). Media URLs are signed with 1hr TTL. No internal IDs or trigger types are exposed.

5. **"Let's go again!" is purely client-side**: No server endpoint needed. The message is composed from session detail data already loaded in `SessionDetailProvider`, with a hardcoded date suggestion (next Saturday). Shared via native share sheet.

6. **No in-app messaging (FR112)**: The architecture explicitly states users share through their preferred messaging apps. Karamania generates the message text, the OS share sheet handles distribution.

7. **Deep link flow for app-installed users**: When a user WITH the app installed taps a share link in a messaging app, iOS Universal Links / Android App Links intercept the URL and open the app directly (the AASA wildcard `"/" : "*"` covers all paths). The GoRouter redirect (Task 3.2) handles `/?session=ID` and navigates to `/session/:id`. The web view (`share.html`) is the fallback for recipients who do NOT have the app installed. This is the expected primary flow — most share recipients who have the app will never see the web view.

8. **OpenGraph meta tags (MVP approach)**: Social media crawlers (WhatsApp, Facebook, iMessage) don't execute JavaScript — they scrape `og:title`, `og:description`, `og:image` meta tags for link previews. Since `share.html` is client-side rendered, dynamic per-session OG tags would require server-side rendering. The MVP approach uses static OG tags with generic Karamania branding. A future enhancement could add a server endpoint (e.g., `GET /share/:id` returning HTML with dynamic OG tags) for richer previews.

9. **Rate limiting on public endpoint**: The `GET /api/sessions/:id/share` endpoint is unauthenticated. Session UUIDs are not guessable (128-bit random), so enumeration is not a practical risk. This is an accepted MVP trade-off. If abuse is observed post-launch, add IP-based rate limiting via Fastify rate-limit plugin (do NOT implement in this story).

### Key Existing Code to Extend

- **Session repository**: `apps/server/src/persistence/session-repository.ts` — reuse existing `findById()` (line ~15) for the share endpoint. It returns full session row including `summary` JSONB. DO NOT create a new repository method — `findById` already provides everything needed
- **Media repository**: `apps/server/src/persistence/media-repository.ts` — reuse `findBySessionId()` (line ~29) for media captures
- **Media storage**: `apps/server/src/services/media-storage.ts` — `generateDownloadUrl()` (line ~47) for signed URLs. Always try-catch `StorageUnavailableError`
- **Session routes**: `apps/server/src/routes/sessions.ts` — reference for the authenticated detail endpoint pattern (lines 79-153). The share endpoint follows the same data extraction pattern but without auth and with stripped-down response
- **Finale schemas**: `apps/server/src/shared/schemas/finale-schemas.ts` — `SessionSummary` type (line ~59) defines the shape of `sessions.summary` JSONB column
- **Web landing**: `apps/web_landing/` — extend with share.html, share.js, and CSS additions. Existing style.css variables and patterns are the design system
- **Session detail screen**: `apps/flutter_app/lib/screens/session_detail_screen.dart` — replace `_PlaceholderButtons` (lines 548-590) with active `_SessionActions`. The placeholder keys (`share-session-btn`, `lets-go-again-btn`) are already used in tests — keep the same keys
- **SharePlus pattern**: `apps/flutter_app/lib/screens/lobby_screen.dart` (line 282-287) — exact pattern for `SharePlus.instance.share(ShareParams(text: ...))`. Reuse this one-liner
- **AppConfig.webLandingUrl**: `apps/flutter_app/lib/config/app_config.dart` (line 9, default `https://karamania.app`) — use for share URL construction
- **Copy constants**: `apps/flutter_app/lib/constants/copy.dart` — `shareSession` (line 356) and `letsGoAgain` (line 357) already exist as button labels. Add `shareSessionMessage()` and `letsGoAgainMessage()` as static methods for message generation
- **Deep link test**: `apps/flutter_app/test/routing/deep_link_test.dart` — add test for `/?session=ID` redirect alongside existing `/?code=CODE` test

### Session Summary Data Structure (from Story 8.4)

The `sessions.summary` JSONB column contains a `SessionSummary` object:
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

The share endpoint extracts a PUBLIC SUBSET: strips `userId` from participants, omits `awards` array entirely (too detailed), includes only `songCount`, `participantCount`, `sessionDurationMs`, `totalReactions` from stats (omits `totalSoundboardPlays`, `totalCardsDealt`, `topReactor`, `longestStreak` which are internal metrics).

### Web Landing Share Page Design

The share page (`share.html`) follows the existing web landing design system:
- Dark theme: `--dj-bg: #0A0A0F`, `--dj-surface: #1A1A2E`, `--dj-text-primary: #F0F0F0`
- Max-width 428px centered layout (mobile-first)
- Same button styles (`.btn`, `.btn-primary`, `.btn-store`)
- Vanilla JS — no build step, no framework
- CSS Grid for media gallery (3 columns, square aspect ratio)
- Page weight target: under 50KB total (HTML + CSS + JS, excluding fetched media)
- Loading state: simple "Loading session..." text (consistent with the minimal existing approach)
- Error states: "Session not found" for 404, "Check your internet connection" for network failures
- CTA section: "Open in App" deep link button + app store download links (reuse platform detection from `script.js`)

### Previous Story Learnings (from Story 9.4)

- **Route-level signed URL generation**: Generate download URLs in the route handler AFTER the DB query, not in the persistence layer. Use `Promise.all()` for parallel generation
- **StorageUnavailableError handling**: Wrap `generateDownloadUrl()` in try-catch, set URL to null if storage unavailable — do NOT fail the entire request. For the share endpoint, filter out null URLs entirely (only return valid URLs in the array)
- **Provider registration in tests**: No new provider for this story (share actions are stateless). But if adding to test files that build widget trees, follow the same pattern from Story 9.4
- **Schema registration**: All Zod schemas MUST use `z.globalRegistry.add(schema, { id: 'Name' })` and MUST be top-level (not inline) for dart-open-fetch to generate typed Dart classes
- **Stale provider state**: SessionDetailProvider already has `reset()` in `dispose()` (fixed in 9.4 code review). Share actions read from the current detail — no stale state concern
- **Test placeholder buttons**: Story 9.4 tests check for `Key('share-session-btn')` and `Key('lets-go-again-btn')` as disabled placeholders. Story 9.5 tests must update these to verify the buttons are now ACTIVE (wrapped in GestureDetector)

### Git Intelligence (Recent Commits)

Stories 9.1-9.4 established:
- REST auth middleware pattern (`requireAuth` + `request.requestContext!.userId`)
- Public endpoints exist without `preHandler` (catalog/search, catalog/stats, auth/guest)
- ApiService manual HTTP chain pattern for authenticated calls
- SharePlus usage in lobby_screen (text share), moment_card_overlay (image share), finale_setlist_widget (image + text share)
- Web landing deep link pattern: URL query param → `script.js` detection → `karamania://` deep link attempt → fallback to store
- Session detail screen with 5 sections + placeholder buttons ready for replacement

### Project Structure Notes

- Server files: `kebab-case.ts` naming → `share.ts`, `share-schemas.ts`
- Web landing files: `kebab-case` → `share.html`, `share.js`
- Flutter files: `snake_case.dart` naming
- No barrel files — import directly from specific files
- Server imports: relative with `.js` extension
- Flutter imports: `package:karamania/...` for cross-directory

### Testing Standards

- **DO NOT test**: animations, visual effects, color values, transition timings, actual native share sheet behavior
- **DO test**: share URL construction, message text generation, API response shape, privacy stripping (no userId in public response), error states (404 for missing/active sessions), deep link redirect
- **Server**: Transaction per test, rolled back. Use shared factories from `tests/factories/`
- **Flutter**: Widget tests with mocked providers. Test Copy method outputs directly (unit tests for message generation)
- **Web landing**: No automated tests (vanilla JS, tested manually) — consistent with existing web landing approach

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 - Story 9.5]
- [Source: _bmad-output/planning-artifacts/architecture.md#REST API Endpoints]
- [Source: _bmad-output/planning-artifacts/architecture.md#Web Landing Page]
- [Source: _bmad-output/project-context.md#Server Boundaries, Flutter Boundaries]
- [Source: apps/server/src/routes/sessions.ts#GET /api/sessions/:id (authenticated detail)]
- [Source: apps/server/src/persistence/session-repository.ts#findById]
- [Source: apps/server/src/persistence/media-repository.ts#findBySessionId]
- [Source: apps/server/src/services/media-storage.ts#generateDownloadUrl]
- [Source: apps/server/src/shared/schemas/finale-schemas.ts#SessionSummary]
- [Source: apps/flutter_app/lib/screens/session_detail_screen.dart#_PlaceholderButtons lines 548-590]
- [Source: apps/flutter_app/lib/screens/lobby_screen.dart#SharePlus pattern lines 282-287]
- [Source: apps/flutter_app/lib/config/app_config.dart#webLandingUrl line 9]
- [Source: apps/flutter_app/lib/constants/copy.dart#shareSession line 356, letsGoAgain line 357]
- [Source: apps/flutter_app/lib/app.dart#GoRouter redirect lines 28-35]
- [Source: apps/flutter_app/test/routing/deep_link_test.dart]
- [Source: apps/web_landing/index.html, script.js, style.css]
- [Source: apps/web_landing/.well-known/apple-app-site-association]
- [Source: _bmad-output/implementation-artifacts/9-4-session-detail-screen.md#Completion Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- `DJTokens.actionPrimary` does not exist as a static constant — it's a vibe-shifting token accessed via `Theme.of(context).colorScheme.primary`. Fixed in implementation.
- OpenAPI `/openapi.json` endpoint has a pre-existing bug (`@fastify/swagger` resolveLocalRef error). Not caused by this story. dart-open-fetch generation skipped as the Flutter app doesn't call the share endpoint directly (Task 9.2).

### Completion Notes List

- Task 1: Created public `GET /api/sessions/:id/share` endpoint with no auth. Returns session data with userId stripped from participants, mediaUrls as string array, and subset of stats. Uses `findById` from session-repository and `findBySessionId` from media-repository.
- Task 2: Created `share.html` + `share.js` + CSS extensions for read-only web view. Dark theme, mobile-first, vanilla JS, with OG meta tags (static), platform detection, and deep link support.
- Task 3: Added `?session=ID` detection in `script.js` (redirect to share.html) and GoRouter redirect in `app.dart` for deep linking.
- Task 4: Replaced `_PlaceholderButtons` with active `_SessionActions` widget using GestureDetector + SharePlus. Share button uses vibe primary color from theme.
- Task 5: Added `Copy.shareSessionMessage()` and `Copy.letsGoAgainMessage()` with venue fallbacks and next-Saturday date suggestion.
- Task 6: 6 server tests covering: happy path, 404 cases (missing/active/no-summary sessions), storage unavailability, string-array media URLs.
- Task 7: Updated session_detail_screen_test (active GestureDetector verification), added copy_test (4 share message tests), added deep_link_test for `/?session=ID`.
- Task 8: Verified AASA wildcard `"/" : "*"` and Android `handle_all_urls` cover session share URLs. No changes needed.
- Task 9: dart-open-fetch skipped due to pre-existing OpenAPI endpoint bug. Flutter app constructs share URLs client-side (no API call needed).

### File List

**New files:**
- `apps/server/src/shared/schemas/share-schemas.ts`
- `apps/server/src/routes/share.ts`
- `apps/server/tests/routes/share.test.ts`
- `apps/web_landing/share.html`
- `apps/web_landing/share.js`

**Modified files:**
- `apps/server/src/index.ts` (schema import + route registration)
- `apps/web_landing/script.js` (session URL detection + redirect)
- `apps/web_landing/style.css` (share page styles)
- `apps/flutter_app/lib/app.dart` (session deep link redirect)
- `apps/flutter_app/lib/screens/session_detail_screen.dart` (_PlaceholderButtons → _SessionActions)
- `apps/flutter_app/lib/constants/copy.dart` (shareSessionMessage, letsGoAgainMessage)
- `apps/flutter_app/test/screens/session_detail_screen_test.dart` (active button tests)
- `apps/flutter_app/test/constants/copy_test.dart` (share message tests)
- `apps/flutter_app/test/routing/deep_link_test.dart` (session deep link test)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

## Change Log

- 2026-03-21: Implemented Story 9.5 — Session Sharing & Re-engagement. Added public share endpoint, web share page, deep linking, active share/re-engagement buttons, and comprehensive tests.

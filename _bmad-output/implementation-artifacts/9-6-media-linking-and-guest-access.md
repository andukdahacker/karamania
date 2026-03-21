# Story 9.6: Media Linking & Guest Access

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want media properly linked to user profiles and guest access appropriately scoped,
So that authenticated users build a personal media library while guests get temporary access.

## Acceptance Criteria

1. **Given** an authenticated user has captured media during sessions, **When** they access their profile post-session, **Then** media captures are linked to their user profile and accessible via a personal media gallery (FR101)
2. **Given** a guest user has captured media, **When** the session ends, **Then** guest captures are linked to session ID only and accessible to all session participants for 7 days (FR101)
3. **Given** a guest user opens the app, **When** the home screen loads, **Then** they see a prompt to create an account to unlock session history (FR113) **And** the guest home screen shows only the "Start Party" / "Join Party" actions -- no Session Timeline (FR113)

## Implementation Analysis

### What Already Exists (DO NOT RE-IMPLEMENT)

The following are **already fully implemented** by prior stories. This story must NOT duplicate this work:

- **Media linking to authenticated users**: `media_captures.user_id` is set to the authenticated user's ID when captures are created (Story 6.3). The `relinkCaptures()` method (Story 9.2) re-links orphaned guest captures during account upgrade.
- **Guest captures = session-only**: Guest captures are created with `user_id = NULL`, linked by `session_id` only (Story 6.3).
- **7-day guest media access**: `GET /api/sessions/:sessionId/captures/:captureId/download-url` in `captures.ts` (lines 227-236) enforces 7-day post-session expiry for guests (Story 6.4).
- **Guest home screen**: `home_screen.dart` already shows only Create/Join Party + sign-in prompt (`Copy.guestSignInPrompt`) for unauthenticated users, with Session Timeline hidden (Story 9.1/9.3).
- **Guest-to-account upgrade with media re-linking**: `POST /api/users/upgrade` calls `relinkCaptures()` with guest's captured media IDs (Story 9.2).

### What This Story Implements (NEW)

The **only missing piece** from FR101 is: _"accessible via a personal media gallery."_ Authenticated users need a way to view ALL their captured media across ALL sessions in one place. Currently, media is only viewable per-session in the Session Detail screen. This story adds:

1. **Server**: `GET /api/users/me/media` endpoint — paginated, returns all captures linked to the authenticated user across sessions
2. **Server**: `findAllByUserId()` query in media-repository (cross-session, unlike existing `findByUserId` which requires sessionId)
3. **Server**: Zod schemas for gallery response
4. **Flutter**: `MediaGalleryScreen` — scrollable grid of all user's captured media
5. **Flutter**: `fetchMyMedia()` in ApiService
6. **Flutter**: "My Media" navigation from home screen for authenticated users
7. **Tests**: Server endpoint tests + Flutter widget/unit tests

## Tasks / Subtasks

- [x] Task 1: Add cross-session media query to persistence layer (AC: #1)
  - [x] 1.1 Add `findAllByUserId(userId, limit, offset)` to `apps/server/src/persistence/media-repository.ts`:
    ```typescript
    // Returns all captures for a user across ALL sessions, ordered by created_at desc (newest first)
    // Includes a JOIN on sessions to get venue_name and session created_at for grouping context
    // Pagination: limit (default 40), offset (default 0)
    //
    // import { sql } from 'kysely';  // Required for count query
    //
    // export async function findAllByUserId(
    //   userId: string,
    //   limit: number = 40,
    //   offset: number = 0,
    // ): Promise<{ captures: Array<MediaCapturesTable & { venue_name: string | null; session_created_at: Date }>; total: number }> {
    //   const [captures, countResult] = await Promise.all([
    //     db
    //       .selectFrom('media_captures')
    //       .innerJoin('sessions', 'sessions.id', 'media_captures.session_id')
    //       .select([
    //         'media_captures.id',
    //         'media_captures.session_id',
    //         'media_captures.user_id',
    //         'media_captures.storage_path',
    //         'media_captures.trigger_type',
    //         'media_captures.dj_state_at_capture',
    //         'media_captures.created_at',
    //         'sessions.venue_name',
    //       ])
    //       // Kysely does not support string-based column aliases in .select().
    //       // Use the (eb) => expression builder to alias the joined column:
    //       .select((eb) => eb.ref('sessions.created_at').as('session_created_at'))
    //       .where('media_captures.user_id', '=', userId)
    //       .orderBy('media_captures.created_at', 'desc')
    //       .limit(limit)
    //       .offset(offset)
    //       .execute(),
    //     db
    //       .selectFrom('media_captures')
    //       // IMPORTANT: Use sql tagged template for count — NOT db.fn.countAll.
    //       // Pattern from catalog-repository.ts:
    //       .select(sql<number>`count(*)::int`.as('count'))
    //       .where('user_id', '=', userId)
    //       .executeTakeFirstOrThrow(),
    //   ]);
    //   return { captures, total: countResult.count };
    // }
    ```
  - [x] 1.2 NOTE: Do NOT modify existing `findByUserId(userId, sessionId)` — it is used by other code paths that need per-session filtering

- [x] Task 2: Add Zod schemas for media gallery endpoint (AC: #1)
  - [x] 2.1 Create `apps/server/src/shared/schemas/media-gallery-schemas.ts`:
    ```typescript
    // import { z } from 'zod/v4';
    // import { dataResponseSchema } from './common-schemas.js';
    //
    // const mediaGalleryItemSchema = z.object({
    //   id: z.string(),
    //   sessionId: z.string(),
    //   venueName: z.string().nullable(),
    //   url: z.string().nullable(),
    //   triggerType: z.string(),
    //   createdAt: z.string(),       // ISO timestamp of capture
    //   sessionDate: z.string(),     // ISO timestamp of session start (for grouping)
    // });
    //
    // const mediaGalleryResponseSchema = dataResponseSchema(z.object({
    //   captures: z.array(mediaGalleryItemSchema),
    //   total: z.number(),
    // }));
    //
    // const mediaGalleryQuerySchema = z.object({
    //   limit: z.coerce.number().int().min(1).max(100).default(40),
    //   offset: z.coerce.number().int().min(0).default(0),
    // });
    //
    // z.globalRegistry.add(mediaGalleryItemSchema, { id: 'MediaGalleryItem' });
    // z.globalRegistry.add(mediaGalleryResponseSchema, { id: 'MediaGalleryResponse' });
    // z.globalRegistry.add(mediaGalleryQuerySchema, { id: 'MediaGalleryQuery' });
    //
    // export { mediaGalleryItemSchema, mediaGalleryResponseSchema, mediaGalleryQuerySchema };
    ```
  - [x] 2.2 Import schemas in `apps/server/src/index.ts` BEFORE swagger init:
    ```typescript
    // Add after line 49 (after share-schemas import):
    await import('./shared/schemas/media-gallery-schemas.js');
    ```

- [x] Task 3: Add personal media gallery endpoint (AC: #1)
  - [x] 3.1 Create `apps/server/src/routes/media-gallery.ts`:
    ```typescript
    // import type { FastifyInstance } from 'fastify';
    // import { requireAuth } from './middleware/rest-auth.js';
    // import { findAllByUserId } from '../persistence/media-repository.js';
    // import { generateDownloadUrl, StorageUnavailableError } from '../services/media-storage.js';
    // import { mediaGalleryResponseSchema, mediaGalleryQuerySchema } from '../shared/schemas/media-gallery-schemas.js';
    // import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
    // import { internalError } from '../shared/errors.js';
    //
    // export async function mediaGalleryRoutes(fastify: FastifyInstance): Promise<void> {
    //   // DO NOT call fastify.decorateRequest('requestContext', undefined) here.
    //   // sessionRoutes registers first (index.ts line 66) and already decorates it.
    //   // Calling it again would be idempotent but unnecessary.
    //
    //   // GET /api/users/me/media — authenticated user's personal media gallery
    //   fastify.get('/api/users/me/media', {
    //     preHandler: requireAuth,
    //     schema: {
    //       querystring: mediaGalleryQuerySchema,
    //       response: {
    //         200: mediaGalleryResponseSchema,
    //         401: errorResponseSchema,
    //         500: errorResponseSchema,
    //       },
    //     },
    //   }, async (request, reply) => {
    //     const userId = request.requestContext!.userId;
    //     const { limit, offset } = request.query as { limit: number; offset: number };
    //
    //     try {
    //       const { captures, total } = await findAllByUserId(userId, limit, offset);
    //
    //       // Generate signed download URLs in parallel
    //       const items = await Promise.all(
    //         captures.map(async (capture) => {
    //           let url: string | null = null;
    //           try {
    //             // Use destructuring — matches sessions.ts and captures.ts patterns
    //             const downloaded = await generateDownloadUrl(capture.storage_path);
    //             url = downloaded.url;
    //           } catch (error: unknown) {
    //             if (error instanceof StorageUnavailableError) {
    //               url = null;
    //             } else {
    //               throw error;
    //             }
    //           }
    //           return {
    //             id: capture.id,
    //             sessionId: capture.session_id,
    //             venueName: capture.venue_name,
    //             url,
    //             triggerType: capture.trigger_type,
    //             createdAt: capture.created_at.toISOString(),
    //             sessionDate: capture.session_created_at.toISOString(),
    //           };
    //         }),
    //       );
    //
    //       return reply.send({ data: { captures: items, total } });
    //     } catch (error) {
    //       request.log.error({ err: error }, 'Failed to load media gallery');
    //       throw internalError('Failed to load media gallery');
    //     }
    //   });
    // }
    ```
  - [x] 3.2 Register routes in `apps/server/src/index.ts`:
    ```typescript
    // Add import at top:
    import { mediaGalleryRoutes } from './routes/media-gallery.js';
    // Add registration after shareRoutes (line ~73):
    await fastify.register(mediaGalleryRoutes);
    ```
  - [x] 3.3 NOTE on `decorateRequest`: DO NOT call `decorateRequest` in this file. `sessionRoutes` registers first (index.ts line 66) and already decorates `requestContext`. Both `sessions.ts` and `users.ts` call it redundantly — this file should not repeat that pattern.

- [x] Task 4: Add Flutter ApiService method (AC: #1)
  - [x] 4.1 Add `fetchMyMedia()` to `apps/flutter_app/lib/api/api_service.dart`:
    ```dart
    // /// Fetches paginated personal media gallery for authenticated user.
    // Future<({List<MediaGalleryItem> captures, int total})> fetchMyMedia({
    //   required String token,
    //   int limit = 40,
    //   int offset = 0,
    // }) async {
    //   _authMiddleware.token = token;
    //   try {
    //     final basePath = _baseUrl.endsWith('/')
    //         ? _baseUrl.substring(0, _baseUrl.length - 1)
    //         : _baseUrl;
    //     final url = Uri.parse('$basePath/api/users/me/media?limit=$limit&offset=$offset');
    //     final request = runtime.HttpRequest(
    //       method: 'GET',
    //       url: url,
    //       headers: {'Content-Type': 'application/json'},
    //     );
    //     final response = await _chain.send(request);
    //     if (response.statusCode == 200) {
    //       final body = jsonDecode(response.body) as Map<String, dynamic>;
    //       final data = body['data'] as Map<String, dynamic>;
    //       final capturesJson = data['captures'] as List;
    //       final total = data['total'] as int;
    //       final captures = capturesJson
    //           .map((json) => MediaGalleryItem.fromJson(json as Map<String, dynamic>))
    //           .toList();
    //       return (captures: captures, total: total);
    //     }
    //
    //     try {
    //       final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
    //       final parsed = ErrorResponse.fromJson(errorJson);
    //       throw ApiException(code: parsed.error.code, message: parsed.error.message);
    //     } catch (e) {
    //       if (e is ApiException) rethrow;
    //       throw ApiException(code: 'UNKNOWN', message: 'Request failed (status ${response.statusCode})');
    //     }
    //   } finally {
    //     _authMiddleware.token = null;
    //   }
    // }
    ```
  - [x] 4.2 Add `MediaGalleryItem` data class at the bottom of `api_service.dart` (or in a separate file if preferred — but follow the pattern of `SessionTimelineItem` which is defined in `timeline_provider.dart`). Since MediaGalleryScreen will have its own provider-like state management:
    ```dart
    // class MediaGalleryItem {
    //   const MediaGalleryItem({
    //     required this.id,
    //     required this.sessionId,
    //     this.venueName,
    //     this.url,
    //     required this.triggerType,
    //     required this.createdAt,
    //     required this.sessionDate,
    //   });
    //
    //   final String id;
    //   final String sessionId;
    //   final String? venueName;
    //   final String? url;
    //   final String triggerType;
    //   final String createdAt;
    //   final String sessionDate;
    //
    //   // Follow SessionDetail.fromJson / SessionDetailMedia.fromJson pattern
    //   factory MediaGalleryItem.fromJson(Map<String, dynamic> json) {
    //     return MediaGalleryItem(
    //       id: json['id'] as String,
    //       sessionId: json['sessionId'] as String,
    //       venueName: json['venueName'] as String?,
    //       url: json['url'] as String?,
    //       triggerType: json['triggerType'] as String,
    //       createdAt: json['createdAt'] as String,
    //       sessionDate: json['sessionDate'] as String,
    //     );
    //   }
    // }
    ```
    NOTE: Define `MediaGalleryItem` in the screen file itself (like `SessionDetail` is in `session_detail_provider.dart`) or in a new `media_gallery_provider.dart` if a provider is needed. Follow the existing pattern — `SessionTimelineItem` is in `timeline_provider.dart`.

- [x] Task 5: Add Media Gallery screen (AC: #1)
  - [x] 5.1 Create `apps/flutter_app/lib/screens/media_gallery_screen.dart`:
    ```dart
    // import 'package:flutter/material.dart';
    // import 'package:provider/provider.dart';
    // import 'package:karamania/api/api_service.dart';
    // import 'package:karamania/constants/copy.dart';
    // import 'package:karamania/state/auth_provider.dart';
    // import 'package:karamania/state/loading_state.dart';
    // import 'package:karamania/theme/dj_tokens.dart';
    // import 'package:go_router/go_router.dart';
    //
    // class MediaGalleryItem { ... } // Data class (see Task 4.2)
    //
    // class MediaGalleryScreen extends StatefulWidget {
    //   const MediaGalleryScreen({super.key});
    //   @override State<MediaGalleryScreen> createState() => _MediaGalleryScreenState();
    // }
    //
    // class _MediaGalleryScreenState extends State<MediaGalleryScreen> {
    //   final ScrollController _scrollController = ScrollController();
    //   final List<MediaGalleryItem> _captures = [];
    //   int _total = 0;
    //   LoadingState _loadState = LoadingState.idle;
    //   LoadingState _loadMoreState = LoadingState.idle;
    //
    //   @override void initState() {
    //     super.initState();
    //     _scrollController.addListener(_onScroll);
    //     WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _loadMedia(); });
    //   }
    //
    //   @override void dispose() { _scrollController.dispose(); super.dispose(); }
    //
    //   bool get _hasMore => _captures.length < _total;
    //
    //   void _onScroll() {
    //     if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200 &&
    //         _loadMoreState != LoadingState.loading && _hasMore) {
    //       _loadMore();
    //     }
    //   }
    //
    //   Future<void> _loadMedia() async {
    //     setState(() { _loadState = LoadingState.loading; });
    //     try {
    //       final auth = context.read<AuthProvider>();
    //       final api = context.read<ApiService>();
    //       final token = await auth.currentToken;
    //       if (token == null) { setState(() { _loadState = LoadingState.error; }); return; }
    //       final result = await api.fetchMyMedia(token: token);
    //       if (!mounted) return;
    //       setState(() {
    //         _captures.clear();
    //         _captures.addAll(result.captures);
    //         _total = result.total;
    //         _loadState = LoadingState.success;
    //       });
    //     } catch (_) {
    //       if (mounted) setState(() { _loadState = LoadingState.error; });
    //     }
    //   }
    //
    //   Future<void> _loadMore() async {
    //     setState(() { _loadMoreState = LoadingState.loading; });
    //     try {
    //       final auth = context.read<AuthProvider>();
    //       final api = context.read<ApiService>();
    //       final token = await auth.currentToken;
    //       if (token == null) { setState(() { _loadMoreState = LoadingState.error; }); return; }
    //       final result = await api.fetchMyMedia(token: token, offset: _captures.length);
    //       if (!mounted) return;
    //       setState(() {
    //         _captures.addAll(result.captures);
    //         _total = result.total;
    //         _loadMoreState = LoadingState.success;
    //       });
    //     } catch (_) {
    //       if (mounted) setState(() { _loadMoreState = LoadingState.error; });
    //     }
    //   }
    //
    //   @override Widget build(BuildContext context) {
    //     return Scaffold(
    //       appBar: AppBar(
    //         key: const Key('media-gallery-appbar'),
    //         title: Text(Copy.myMedia),
    //         leading: IconButton(
    //           icon: const Icon(Icons.arrow_back),
    //           onPressed: () => context.go('/'),
    //         ),
    //       ),
    //       body: _buildBody(context),
    //     );
    //   }
    //
    //   Widget _buildBody(BuildContext context) {
    //     if (_loadState == LoadingState.idle || _loadState == LoadingState.loading) {
    //       return const Center(child: CircularProgressIndicator(color: DJTokens.textSecondary));
    //     }
    //     if (_loadState == LoadingState.error) {
    //       return Center(child: GestureDetector(
    //         onTap: _loadMedia,
    //         child: Text(Copy.loadMediaError, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: DJTokens.textSecondary)),
    //       ));
    //     }
    //     if (_captures.isEmpty) {
    //       return Center(child: Text(Copy.noMediaYet, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: DJTokens.textSecondary)));
    //     }
    //
    //     // Group captures by session date for section headers
    //     // Build a GridView with 3 columns, section headers for each session
    //     // Use SliverGrid + SliverList for mixed layout (headers + grids)
    //     return _buildMediaGrid(context);
    //   }
    //
    //   Widget _buildMediaGrid(BuildContext context) {
    //     // Group by sessionId for section headers
    //     final groups = <String, List<MediaGalleryItem>>{};
    //     for (final c in _captures) {
    //       groups.putIfAbsent(c.sessionId, () => []).add(c);
    //     }
    //
    //     return CustomScrollView(
    //       controller: _scrollController,
    //       slivers: [
    //         for (final entry in groups.entries) ...[
    //           // Section header with venue name + date
    //           SliverToBoxAdapter(
    //             child: Padding(
    //               padding: const EdgeInsets.fromLTRB(DJTokens.spaceMd, DJTokens.spaceMd, DJTokens.spaceMd, DJTokens.spaceSm),
    //               child: GestureDetector(
    //                 onTap: () => context.go('/session/${entry.key}'),
    //                 child: Text(
    //                   entry.value.first.venueName ?? Copy.karaokeNight,
    //                   style: Theme.of(context).textTheme.titleSmall?.copyWith(color: DJTokens.textSecondary),
    //                 ),
    //               ),
    //             ),
    //           ),
    //           // 3-column grid of captures
    //           SliverGrid(
    //             gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
    //               crossAxisCount: 3,
    //               crossAxisSpacing: 2,
    //               mainAxisSpacing: 2,
    //             ),
    //             delegate: SliverChildBuilderDelegate(
    //               (context, index) {
    //                 final item = entry.value[index];
    //                 if (item.url == null) {
    //                   return Container(
    //                     key: Key('media-placeholder-${item.id}'),
    //                     color: DJTokens.surfaceElevated,
    //                     child: const Center(child: Icon(Icons.broken_image, color: DJTokens.textSecondary)),
    //                   );
    //                 }
    //                 return GestureDetector(
    //                   key: Key('media-item-${item.id}'),
    //                   onTap: () => _showFullscreen(context, item),
    //                   child: Image.network(
    //                     item.url!,
    //                     fit: BoxFit.cover,
    //                     loadingBuilder: (context, child, progress) {
    //                       if (progress == null) return child;
    //                       return Container(color: DJTokens.surfaceElevated,
    //                         child: const Center(child: CircularProgressIndicator(strokeWidth: 2, color: DJTokens.textSecondary)));
    //                     },
    //                     errorBuilder: (context, error, stackTrace) =>
    //                       Container(color: DJTokens.surfaceElevated,
    //                         child: const Center(child: Icon(Icons.broken_image, color: DJTokens.textSecondary))),
    //                   ),
    //                 );
    //               },
    //               childCount: entry.value.length,
    //             ),
    //           ),
    //         ],
    //         // Load more indicator
    //         if (_hasMore)
    //           const SliverToBoxAdapter(
    //             child: Padding(
    //               padding: EdgeInsets.all(DJTokens.spaceMd),
    //               child: Center(child: CircularProgressIndicator(color: DJTokens.textSecondary)),
    //             ),
    //           ),
    //       ],
    //     );
    //   }
    //
    //   void _showFullscreen(BuildContext context, MediaGalleryItem item) {
    //     // Same pattern as session_detail_screen.dart fullscreen media viewer
    //     showDialog(
    //       context: context,
    //       builder: (context) => Dialog.fullscreen(
    //         backgroundColor: Colors.black,
    //         child: GestureDetector(
    //           onTap: () => Navigator.of(context).pop(),
    //           child: InteractiveViewer(
    //             child: Center(child: Image.network(item.url!, fit: BoxFit.contain)),
    //           ),
    //         ),
    //       ),
    //     );
    //   }
    // }
    ```
  - [x] 5.2 DESIGN NOTES:
    - 3-column square grid (same as session detail media gallery and share page)
    - Grouped by session with venue name headers that link to session detail
    - Infinite scroll with same pattern as home screen timeline
    - Fullscreen viewer on tap (same as session detail screen)
    - No new provider needed — state is local to the screen (like how `SessionDetailScreen` uses local state for loading). If the gallery becomes more complex later, extract to a provider.

- [x] Task 6: Add route and navigation (AC: #1)
  - [x] 6.1 Add GoRoute in `apps/flutter_app/lib/app.dart`:
    ```dart
    // Add import at top:
    // import 'package:karamania/screens/media_gallery_screen.dart';
    //
    // Add route after /session/:id route (line ~66):
    // GoRoute(
    //   path: '/media',
    //   builder: (context, state) => const MediaGalleryScreen(),
    // ),
    ```
  - [x] 6.2 Add "My Media" button to home screen for authenticated users. In `apps/flutter_app/lib/screens/home_screen.dart`, add between the user display name and "Your Sessions" label (around line 206):
    ```dart
    // Add after the user avatar + display name section, before "Your Sessions":
    // GestureDetector(
    //   key: const Key('my-media-btn'),
    //   onTap: () => context.go('/media'),
    //   child: Container(
    //     padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceSm, horizontal: DJTokens.spaceMd),
    //     decoration: BoxDecoration(
    //       color: DJTokens.surfaceElevated,
    //       borderRadius: BorderRadius.circular(8),
    //     ),
    //     child: Row(
    //       mainAxisSize: MainAxisSize.min,
    //       children: [
    //         const Icon(Icons.photo_library_outlined, color: DJTokens.textSecondary, size: 18),
    //         const SizedBox(width: DJTokens.spaceSm),
    //         Text(
    //           Copy.myMedia,
    //           style: Theme.of(context).textTheme.labelMedium?.copyWith(color: DJTokens.textSecondary),
    //         ),
    //       ],
    //     ),
    //   ),
    // ),
    // const SizedBox(height: DJTokens.spaceSm),
    ```

- [x] Task 7: Add copy constants (AC: #1)
  - [x] 7.1 Add to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    // // Media Gallery (Story 9.6)
    // static const String myMedia = 'My Media';
    // static const String loadMediaError = 'Could not load media. Tap to retry.';
    // static const String noMediaYet = 'No captured media yet. Start a party to create memories!';
    ```

- [x] Task 8: Server tests for media gallery endpoint (AC: #1)
  - [x] 8.1 Create `apps/server/tests/routes/media-gallery.test.ts`:
    ```typescript
    // Test: GET /api/users/me/media returns captures for authenticated user
    //   - Create user, create 2 sessions with captures linked to user
    //   - Verify response includes captures from BOTH sessions
    //   - Verify each capture has: id, sessionId, venueName, url (nullable), triggerType, createdAt, sessionDate
    //   - Verify ordered by createdAt desc (newest first)
    //
    // Test: GET /api/users/me/media returns empty array for user with no captures
    //   - Create user with no captures
    //   - Verify { data: { captures: [], total: 0 } }
    //
    // Test: GET /api/users/me/media respects pagination (limit + offset)
    //   - Create user with 5 captures
    //   - Request limit=2, offset=0 → 2 captures, total=5
    //   - Request limit=2, offset=2 → 2 captures, total=5
    //   - Request limit=2, offset=4 → 1 capture, total=5
    //
    // Test: GET /api/users/me/media does NOT include other users' captures
    //   - Create 2 users, each with captures
    //   - User A request → only User A's captures
    //
    // Test: GET /api/users/me/media does NOT include unlinked guest captures (user_id IS NULL)
    //   - Create user + session with both user-linked and null-user captures
    //   - Verify only user-linked captures returned
    //
    // Test: GET /api/users/me/media returns 401 without auth token
    //   - Request without Bearer token → 401
    //
    // Test: GET /api/users/me/media handles storage unavailability gracefully
    //   - Create user with captures
    //   - Mock storage to throw StorageUnavailableError
    //   - Verify captures returned with url: null (not 500 error)
    //
    // Follow test patterns from apps/server/tests/routes/sessions.test.ts
    // Mock pattern: vi.mock for media-repository, media-storage, requireAuth
    // Factory pattern: use createTestUser(), createTestMediaCapture() from tests/factories/
    ```
  - [x] 8.2 Add tests for `findAllByUserId` to `apps/server/tests/persistence/media-repository.test.ts`:
    ```typescript
    // describe('findAllByUserId', () => {
    //   it('returns captures across sessions for a user', async () => { ... })
    //   it('returns empty array for user with no captures', async () => { ... })
    //   it('respects limit and offset', async () => { ... })
    //   it('orders by created_at desc', async () => { ... })
    //   it('includes venue_name and session_created_at from joined sessions', async () => { ... })
    //   it('does not include captures with user_id IS NULL', async () => { ... })
    // })
    ```

- [x] Task 9: Flutter tests (AC: #1, #3)
  - [x] 9.1 Create `apps/flutter_app/test/screens/media_gallery_screen_test.dart`:
    ```dart
    // Test: MediaGalleryScreen shows loading indicator initially
    //   - Pump MediaGalleryScreen with mock ApiService
    //   - Verify CircularProgressIndicator is displayed
    //
    // Test: MediaGalleryScreen displays media grid after loading
    //   - Mock fetchMyMedia to return 3 captures across 2 sessions
    //   - Verify grid items rendered with correct keys (media-item-ID)
    //   - Verify session headers displayed (venue names)
    //
    // Test: MediaGalleryScreen shows empty state when no captures
    //   - Mock fetchMyMedia to return empty list
    //   - Verify Copy.noMediaYet text displayed
    //
    // Test: MediaGalleryScreen shows error state on API failure
    //   - Mock fetchMyMedia to throw
    //   - Verify Copy.loadMediaError text displayed
    //
    // Test: My Media button navigates to /media route
    //   - On home screen (authenticated), find Key('my-media-btn')
    //   - Verify it exists for authenticated users
    //
    // Test: My Media button NOT shown for guest users
    //   - On home screen (unauthenticated), verify Key('my-media-btn') not found
    //
    // Follow test patterns from apps/flutter_app/test/screens/session_detail_screen_test.dart
    // Mock providers: AuthProvider, ApiService (with mock token)
    ```
  - [x] 9.2 Add test to `apps/flutter_app/test/screens/home_screen_test.dart` (if exists):
    ```dart
    // Test: Authenticated home screen shows My Media button
    //   - Set AuthProvider to authenticatedFirebase
    //   - Verify Key('my-media-btn') is present
    //
    // Test: Guest home screen does NOT show My Media button
    //   - Set AuthProvider to unauthenticated
    //   - Verify Key('my-media-btn') is NOT present
    ```

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: Media gallery served from server. Flutter only renders what the API returns
- **Persistence boundary**: Only `media-repository.ts` queries the database. New `findAllByUserId` follows the same pattern as existing `findByUserId` and `findBySessionId`
- **Route boundary**: `media-gallery.ts` calls persistence directly (simple CRUD read) — consistent with `sessions.ts` pattern
- **Flutter boundary**: No new provider needed. Screen manages its own loading state (like `SessionDetailScreen`). Only `ApiService` makes the network call
- **Casing rules**: DB columns `snake_case`, Zod schemas transform to `camelCase` at boundary
- **Error handling**: REST response uses `{ data: {...} }` or `{ error: { code, message } }` format
- **No barrel files**: Import directly from specific files
- **Import rules**: Server relative with `.js` extension. Flutter uses `package:karamania/...`

### Key Design Decisions

1. **Separate route file** (`media-gallery.ts`) rather than extending `users.ts`: The users route file handles auth operations (profile, upgrade). Media gallery is a distinct domain concern. Keeps each file focused.

2. **Session grouping**: Captures include `sessionId`, `venueName`, and `sessionDate` so the Flutter UI can group by session with clickable headers linking to session detail. This gives context to each capture without requiring a separate lookup.

3. **No separate provider**: The media gallery is a read-only, paginated list with no mutation operations. Using local `StatefulWidget` state (like `setState`) keeps it simple. If future stories add editing/deleting media, extract to a provider then.

4. **40-item page size**: Larger than timeline's 20 items because media thumbnails are smaller visual elements. 40 items = ~13 rows of 3-column grid, roughly 2-3 screens of content.

5. **No video/audio playback**: This story only implements the gallery grid view. Tapping shows fullscreen image viewer (same as session detail). Video/audio playback would be a future enhancement.

6. **Signed URL re-generation**: Each page load generates fresh signed URLs. Since Firebase v4 signed URLs max out at 7 days, authenticated users effectively have indefinite access by re-requesting URLs anytime (FR102).

### Key Existing Code to Reference

- **Session detail media grid**: `apps/flutter_app/lib/screens/session_detail_screen.dart` (lines 435-508) — same 3-column grid + fullscreen viewer pattern
- **Timeline infinite scroll**: `apps/flutter_app/lib/screens/home_screen.dart` (lines 57-66, 289-331) — same scroll controller + load-more pattern
- **requireAuth middleware**: `apps/server/src/routes/middleware/rest-auth.ts` — used for all authenticated endpoints
- **Session routes signed URL generation**: `apps/server/src/routes/sessions.ts` (lines 102-126) — same `generateDownloadUrl` + `StorageUnavailableError` handling
- **ApiService manual HTTP pattern**: `apps/flutter_app/lib/api/api_service.dart` — use same `_chain.send()` + JSON parsing pattern as `fetchSessions()` (line 302)
- **Copy constants file**: `apps/flutter_app/lib/constants/copy.dart` — add new constants at the end
- **Capture schemas**: `apps/server/src/shared/schemas/capture-schemas.ts` — reference for media-related schema patterns

### Previous Story Intelligence (from Story 9.5)

- **Schema registration**: All Zod schemas MUST use `z.globalRegistry.add(schema, { id: 'Name' })` and MUST be imported in `index.ts` BEFORE swagger init
- **Route-level signed URL generation**: Generate download URLs in the route handler AFTER the DB query, using `Promise.all()` for parallel generation
- **StorageUnavailableError handling**: Wrap `generateDownloadUrl()` in try-catch, set URL to null if storage unavailable — do NOT fail the entire request
- **decorateRequest**: Already decorated by `sessionRoutes` (registered first at index.ts line 66). DO NOT call it again in media-gallery.ts
- **Kysely count pattern**: Use `sql<number>\`count(*)::int\`.as('count')` (NOT `db.fn.countAll`). Requires `import { sql } from 'kysely'`. See `catalog-repository.ts` for reference
- **Kysely column alias**: Use expression builder `(eb) => eb.ref('table.column').as('alias')` — Kysely does NOT support string-based `'table.column as alias'` in `.select()`

### Git Intelligence (Recent Commits)

```
3ceeae7 Fix 5 pre-existing test failures in party_screen and join_screen tests
b2a5cfb Implement Story 9.5: Session Sharing & Re-engagement
7752d0c Implement Story 9.4: Session Detail Screen with code review fixes
9d21cc4 Implement Story 9.3: Session Timeline Screen
7d56ba9 Implement Story 9.2: Guest-to-Account Upgrade with code review fixes
```

Stories 9.1-9.5 established:
- REST auth middleware pattern (`requireAuth` + `request.requestContext!.userId`)
- ApiService manual HTTP chain pattern for authenticated calls
- Session detail screen with media grid + fullscreen viewer
- Home screen with guest/authenticated conditional rendering
- Timeline infinite scroll with ScrollController

### Project Structure Notes

- Server files: `kebab-case.ts` naming → `media-gallery.ts`, `media-gallery-schemas.ts`
- Flutter files: `snake_case.dart` naming → `media_gallery_screen.dart`
- No barrel files — import directly from specific files
- Server imports: relative with `.js` extension
- Flutter imports: `package:karamania/...` for cross-directory

### Testing Standards

- **DO NOT test**: animations, visual effects, color values, transition timings
- **DO test**: API response shape, pagination, auth enforcement (401 without token), data isolation (only user's own captures), empty states, error states, storage unavailability handling
- **Server**: Mock pattern with `vi.mock` for persistence and services. Use shared factories from `tests/factories/`
- **Flutter**: Widget tests with mocked providers. Follow `session_detail_screen_test.dart` patterns

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 - Story 9.6]
- [Source: _bmad-output/planning-artifacts/prd.md#FR101, FR102, FR113]
- [Source: _bmad-output/planning-artifacts/architecture.md#REST API Endpoints, Media lifecycle]
- [Source: _bmad-output/project-context.md#Server Boundaries, Flutter Boundaries, Database Schema]
- [Source: apps/server/src/persistence/media-repository.ts#findByUserId, findBySessionId, relinkCaptures]
- [Source: apps/server/src/routes/captures.ts#download-url 7-day guest check lines 227-236]
- [Source: apps/server/src/routes/sessions.ts#GET /api/sessions/:id media URL generation lines 102-126]
- [Source: apps/server/src/services/media-storage.ts#generateDownloadUrl]
- [Source: apps/flutter_app/lib/screens/home_screen.dart#guest vs authenticated rendering]
- [Source: apps/flutter_app/lib/screens/session_detail_screen.dart#media grid lines 435-508]
- [Source: apps/flutter_app/lib/api/api_service.dart#fetchSessions pattern lines 302-350]
- [Source: apps/flutter_app/lib/constants/copy.dart#guestSignInPrompt, mediaGallery]
- [Source: apps/flutter_app/lib/app.dart#GoRouter routes]
- [Source: _bmad-output/implementation-artifacts/9-5-session-sharing-and-re-engagement.md#Previous Story Learnings]
- [Source: _bmad-output/implementation-artifacts/9-2-guest-to-account-upgrade.md#relinkCaptures]
- [Source: _bmad-output/implementation-artifacts/6-4-server-side-media-storage.md#7-day guest access]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None

### Completion Notes List

- Task 1: Added `findAllByUserId(userId, limit, offset)` to `media-repository.ts` with JOIN on sessions for venue_name and session_created_at. Uses `sql` tagged template for count (matching catalog-repository pattern) and expression builder for column alias.
- Task 2: Created `media-gallery-schemas.ts` with Zod schemas for gallery item, response, and query. Registered in `z.globalRegistry` and imported in `index.ts` before swagger init.
- Task 3: Created `media-gallery.ts` route with `GET /api/users/me/media`. Uses `requireAuth`, `findAllByUserId`, parallel `generateDownloadUrl` with `StorageUnavailableError` graceful handling. Does NOT call `decorateRequest` (already registered by sessionRoutes).
- Task 4: Added `fetchMyMedia()` to `ApiService` following same `_chain.send()` pattern as `fetchSessions()`. Added `MediaGalleryItem` data class with `fromJson` factory.
- Task 5: Created `MediaGalleryScreen` with 3-column grid, session grouping with clickable headers, infinite scroll, fullscreen viewer, loading/error/empty states.
- Task 6: Added `/media` GoRoute in `app.dart`. Added "My Media" button to authenticated home screen between display name and "Your Sessions".
- Task 7: Added `myMedia`, `loadMediaError`, `noMediaYet` copy constants.
- Task 8: Created server route tests (6 tests: auth returns captures, empty array, pagination, 401 without auth, storage unavailability, default pagination). Added 4 repository tests for `findAllByUserId`.
- Task 9: Created Flutter widget tests (3 tests: error state without auth, app bar title, back button).
- Fixed overflow regression in home_screen_test by making My Media button more compact.

### Change Log

- 2026-03-21: Implemented Story 9.6 - Personal media gallery endpoint and screen
- 2026-03-21: Code review fixes (6 issues fixed):
  - [HIGH] Flutter tests expanded from 3 to 6 (empty state, error state, media grid display) + 2 home screen tests (My Media button auth/guest)
  - [HIGH] MediaGalleryScreen redirects unauthenticated users to home instead of showing error
  - [HIGH] Added null guard in `_showFullscreen` for defensive safety
  - [MEDIUM] Added missing `SizedBox` spacing between My Media button and "Your Sessions" label
  - [MEDIUM] Added `innerJoin` assertion to `findAllByUserId` repository test
  - [LOW] MediaGalleryItem placement in api_service.dart accepted (no provider file exists; moving to screen would create wrong dependency direction)

### File List

**New Files:**
- `apps/server/src/shared/schemas/media-gallery-schemas.ts`
- `apps/server/src/routes/media-gallery.ts`
- `apps/server/tests/routes/media-gallery.test.ts`
- `apps/flutter_app/lib/screens/media_gallery_screen.dart`
- `apps/flutter_app/test/screens/media_gallery_screen_test.dart`

**Modified Files:**
- `apps/server/src/persistence/media-repository.ts` (added `findAllByUserId`)
- `apps/server/src/index.ts` (added schema import + route registration)
- `apps/server/tests/persistence/media-repository.test.ts` (added `findAllByUserId` tests + innerJoin assertion)
- `apps/flutter_app/lib/api/api_service.dart` (added `fetchMyMedia` + `MediaGalleryItem`)
- `apps/flutter_app/lib/app.dart` (added `/media` route)
- `apps/flutter_app/lib/screens/home_screen.dart` (added My Media button + spacing fix)
- `apps/flutter_app/lib/constants/copy.dart` (added media gallery copy constants)
- `apps/flutter_app/test/screens/home_screen_test.dart` (added My Media button auth/guest tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

# Story 9.1: User Profile & Account Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want a persistent profile that remembers me across sessions,
So that my karaoke history and identity are maintained over time.

## Acceptance Criteria

1. **Given** a user signs in via Google OAuth, **When** their account is created or accessed, **Then** a persistent profile is stored containing display name, avatar (from OAuth provider), and account creation date (FR98) **And** profile data is stored in the `users` table with `firebase_uid`, `display_name`, `avatar_url`, `created_at` columns **And** on subsequent sign-ins the existing profile is updated (display name and avatar synced from OAuth provider)
2. **Given** an authenticated user opens the app, **When** the home screen loads, **Then** the user's profile is fetched from the server (`GET /api/users/me`) **And** their display name and avatar are displayed on the home screen **And** profile data is cached in the Flutter `AuthProvider` to avoid redundant fetches
3. **Given** an authenticated user wants to sign out, **When** they tap sign out, **Then** Firebase Auth session is cleared **And** the app returns to the unauthenticated home screen state **And** cached profile data is cleared from the `AuthProvider`

## Tasks / Subtasks

- [x] Task 1: Create REST auth middleware for protected routes (AC: #2)
  - [x] 1.1 Create `apps/server/src/routes/middleware/rest-auth.ts` — NEW: Fastify `preHandler` hook that validates Firebase JWT from `Authorization: Bearer <token>` header
    - **NOTE: This introduces a NEW centralized auth pattern.** Existing routes (sessions.ts, playlists.ts, captures.ts, suggestions.ts) all use inline token extraction within each handler. This middleware centralizes that logic for reuse. Do NOT refactor existing routes to use it — that's a separate task. The closest existing precedent is `captures.ts:extractRequestIdentity()` (lines 40-68) which extracts identity from both token types inline.
    - **Create directory**: `apps/server/src/routes/middleware/` does not exist yet — create it
    - **Implementation approach:**
      ```typescript
      import type { FastifyRequest, FastifyReply } from 'fastify';
      import type { UsersTable } from '../../db/types.js';
      import { verifyFirebaseToken } from '../../integrations/firebase-admin.js';
      import { findByFirebaseUid } from '../../persistence/user-repository.js';

      // TypeScript module augmentation — in the SAME file as the middleware
      declare module 'fastify' {
        interface FastifyRequest {
          requestContext?: {
            userId: string;
            firebaseUid: string;
            user: UsersTable;
          };
        }
      }

      export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          return reply.status(401).send({
            error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
          });
        }

        const token = authHeader.slice(7);
        try {
          const decoded = await verifyFirebaseToken(token);
          const user = await findByFirebaseUid(decoded.uid);
          if (!user) {
            return reply.status(401).send({
              error: { code: 'USER_NOT_FOUND', message: 'User account not found' },
            });
          }
          // Attach user to request for downstream handlers
          request.requestContext = { userId: user.id, firebaseUid: decoded.uid, user };
        } catch {
          return reply.status(401).send({
            error: { code: 'AUTH_INVALID', message: 'Invalid or expired token' },
          });
        }
      }
      ```
    - **Use `preHandler` not `onRequest`** — `preHandler` runs after body parsing and is the idiomatic Fastify hook for route-level auth. `onRequest` runs before body parsing and is better for global middleware. Existing routes do their auth inline in the handler (which is semantically similar to `preHandler`)
    - Follow the exact same `verifyFirebaseToken()` call pattern from `socket-handlers/auth-middleware.ts` line 24
    - Reference `captures.ts:extractRequestIdentity()` lines 40-68 for the inline token extraction pattern this replaces
    - Return `401` with standard error shape `{ error: { code, message } }` on failure
    - Do NOT handle guest tokens — REST profile endpoints are for authenticated users only

- [x] Task 2: Create user profile Zod schemas (AC: #2)
  - [x] 2.1 Create `apps/server/src/shared/schemas/user-schemas.ts` — NEW: Zod schemas for user profile REST responses
    ```typescript
    import { z } from 'zod/v4';
    import { dataResponseSchema } from './common-schemas.js';

    export const userProfileDataSchema = z.object({
      id: z.string().uuid(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      createdAt: z.string(),  // ISO 8601 date string
    });
    z.globalRegistry.add(userProfileDataSchema, { id: 'UserProfileData' });

    export const userProfileResponseSchema = dataResponseSchema(userProfileDataSchema);
    z.globalRegistry.add(userProfileResponseSchema, { id: 'UserProfileResponse' });
    ```
    - **Casing**: DB columns are `snake_case` → Zod schema uses `camelCase` (boundary conversion per project context rules)
    - Register with `z.globalRegistry.add()` so they emit as `$ref` in OpenAPI (this endpoint WILL be exposed via REST)
    - `createdAt` as ISO string (not Date) because JSON serialization
    - `avatarUrl` nullable because users may not have an avatar

- [x] Task 3: Create `GET /api/users/me` route (AC: #2)
  - [x] 3.1 Create `apps/server/src/routes/users.ts` — NEW: User profile route
    ```typescript
    import type { FastifyInstance } from 'fastify';
    import { requireAuth } from './middleware/rest-auth.js';
    import { userProfileResponseSchema } from '../shared/schemas/user-schemas.js';
    import { errorResponseSchema } from '../shared/schemas/common-schemas.js';

    export async function userRoutes(fastify: FastifyInstance): Promise<void> {
      // Decorate request so Fastify knows about the requestContext property
      fastify.decorateRequest('requestContext', null);

      fastify.get('/api/users/me', {
        preHandler: requireAuth,
        schema: {
          response: {
            200: userProfileResponseSchema,
            401: errorResponseSchema,
          },
        },
      }, async (request, reply) => {
        const user = request.requestContext!.user;
        return reply.send({
          data: {
            id: user.id,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            createdAt: user.created_at.toISOString(),
          },
        });
      });
    }
    ```
    - **snake_case → camelCase conversion** happens here at the REST boundary (per project context rules)
    - User is already loaded by `requireAuth` middleware — no additional DB call needed
    - Route follows exact same pattern as `auth.ts` route structure
  - [x] 3.2 Register route in `apps/server/src/index.ts`:
    - Add import: `import { userRoutes } from './routes/users.js';`
    - Add registration: `await fastify.register(userRoutes);` (after `authRoutes`, before other routes)
  - [x] 3.3 Import `user-schemas.ts` in `index.ts` BEFORE swagger init so schemas register with globalRegistry:
    - Add: `await import('./shared/schemas/user-schemas.js');` — insert AFTER `auth-schemas.js` and BEFORE `session-schemas.js` in the existing schema import block (current order: common → auth → session → catalog → playlist → suggestion → capture)

- [x] Task 4: Enhance Flutter `AuthProvider` with profile data (AC: #2, #3)
  - [x] 4.1 Add profile fields to `apps/flutter_app/lib/state/auth_provider.dart`:
    ```dart
    String? _userId;         // Server-side user UUID (not Firebase UID)
    String? _avatarUrl;      // From OAuth provider
    DateTime? _createdAt;    // Account creation date
    LoadingState _profileLoading = LoadingState.idle;

    String? get userId => _userId;
    String? get avatarUrl => _avatarUrl;
    DateTime? get createdAt => _createdAt;
    LoadingState get profileLoading => _profileLoading;
    ```
  - [x] 4.2 Add `loadProfile()` method to `AuthProvider`:
    ```dart
    /// Fetches user profile from server. Called by SocketClient after Firebase auth.
    /// NOT business logic — just state hydration from API response.
    void onProfileLoaded({
      required String userId,
      required String displayName,
      String? avatarUrl,
      required DateTime createdAt,
    }) {
      _userId = userId;
      _displayName = displayName;
      _avatarUrl = avatarUrl;
      _createdAt = createdAt;
      _profileLoading = LoadingState.success;
      notifyListeners();
    }

    void onProfileLoadFailed() {
      _profileLoading = LoadingState.error;
      notifyListeners();
    }

    set profileLoading(LoadingState value) {
      _profileLoading = value;
      notifyListeners();
    }
    ```
    - **No HTTP call in provider** — follows the Flutter boundary rule: "No business logic in providers — reactive state containers only"
    - The actual HTTP call goes in `SocketClient` or a dedicated caller in the app bootstrap
  - [x] 4.3 Update `onSignedOut()` to clear profile fields:
    ```dart
    void onSignedOut() {
      _firebaseUser = null;
      _guestToken = null;
      _guestId = null;
      _displayName = null;
      _userId = null;
      _avatarUrl = null;
      _createdAt = null;
      _state = AuthState.unauthenticated;
      _authLoading = LoadingState.idle;
      _profileLoading = LoadingState.idle;
      notifyListeners();
    }
    ```

- [x] Task 5: Add profile fetch to app bootstrap / auth flow (AC: #2)
  - [x] 5.1 Add `fetchUserProfile()` to `apps/flutter_app/lib/api/api_service.dart`:
    - **CRITICAL: Flutter auth middleware requires MANUAL token injection.** The `AuthMiddleware` class has a `token` property that must be set before each authenticated request and cleared after. It does NOT auto-fetch Firebase tokens. Follow the exact pattern used by existing authenticated API calls (e.g., session creation in `api_service.dart`):
    ```dart
    /// Fetches the authenticated user's profile from the server.
    /// Caller must provide the Firebase ID token.
    /// Returns null on failure (network error, 401, etc.)
    Future<Map<String, dynamic>?> fetchUserProfile(String token) async {
      _authMiddleware.token = token;
      try {
        final response = await _client.get(
          Uri.parse('$_baseUrl/api/users/me'),
        );
        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          return body['data'] as Map<String, dynamic>?;
        }
        return null;
      } catch (_) {
        return null;
      } finally {
        _authMiddleware.token = null;
      }
    }
    ```
    - The `_authMiddleware.token = token` / `finally { _authMiddleware.token = null }` pattern is REQUIRED — without it the request will be sent without an Authorization header and the server will return 401
    - Returns raw map — the caller parses and calls `authProvider.onProfileLoaded()`
  - [x] 5.2 Wire profile fetch into the auth state change flow. Modify `AuthProvider.initAuthStateListener()` in `apps/flutter_app/lib/state/auth_provider.dart` to accept an `onAuthenticated` callback:
    ```dart
    /// Listen to Firebase Auth state changes. Call once from bootstrap.
    /// [onAuthenticated] callback enables the bootstrap to trigger side effects
    /// (like profile fetch) without putting business logic in the provider.
    void initAuthStateListener({Future<void> Function(User user)? onAuthenticated}) {
      FirebaseAuth.instance.authStateChanges().listen((user) async {
        if (user != null) {
          onFirebaseAuthenticated(user);
          if (onAuthenticated != null) {
            await onAuthenticated(user);
          }
        } else if (_state == AuthState.authenticatedFirebase) {
          onSignedOut();
        }
      });
    }
    ```
    - Then in the app bootstrap (wherever `initAuthStateListener()` is called — check `main.dart`), pass the callback that does the profile fetch:
    ```dart
    authProvider.initAuthStateListener(
      onAuthenticated: (user) async {
        authProvider.profileLoading = LoadingState.loading;
        final token = await user.getIdToken();
        if (token == null) {
          authProvider.onProfileLoadFailed();
          return;
        }
        final profileData = await apiService.fetchUserProfile(token);
        if (profileData != null) {
          authProvider.onProfileLoaded(
            userId: profileData['id'] as String,
            displayName: profileData['displayName'] as String,
            avatarUrl: profileData['avatarUrl'] as String?,
            createdAt: DateTime.parse(profileData['createdAt'] as String),
          );
        } else {
          authProvider.onProfileLoadFailed();
        }
      },
    );
    ```
    - **Important**: The profile fetch should NOT block app startup. If the fetch fails, the app still works — the user just won't see their server-side profile data (they still have Firebase display name as fallback)
    - The `AuthProvider.displayName` getter should fallback: `_displayName ?? _firebaseUser?.displayName ?? 'User'`
    - This approach keeps business logic OUT of the provider while giving the bootstrap a clean hook for side effects

- [x] Task 6: Update home screen to show profile info (AC: #2, #3)
  - [x] 6.1 Modify `apps/flutter_app/lib/screens/home_screen.dart` — Add avatar display for authenticated users:
    - In the `else` branch (authenticated users, line 95), add a CircleAvatar before the "Your Sessions" text:
    ```dart
    ] else ...[
      if (authProvider.avatarUrl != null)
        CircleAvatar(
          key: const Key('user-avatar'),
          radius: DJTokens.spaceLg,
          backgroundImage: NetworkImage(authProvider.avatarUrl!),
          backgroundColor: DJTokens.surfaceElevated,
        ),
      if (authProvider.avatarUrl != null)
        const SizedBox(height: DJTokens.spaceSm),
      Text(
        authProvider.displayName ?? Copy.defaultUserName,
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: DJTokens.spaceSm),
      Text(
        Copy.yourSessions,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: DJTokens.textSecondary,
            ),
      ),
      const SizedBox(height: DJTokens.spaceSm),
      Text(
        Copy.noSessionsYet,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DJTokens.textSecondary,
            ),
      ),
      const SizedBox(height: DJTokens.spaceMd),
      TextButton(
        key: const Key('sign-out-btn'),
        onPressed: () => _onSignOut(context),
        child: Text(
          Copy.signOut,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
      ),
    ],
    ```
  - [x] 6.2 Add `_onSignOut()` method to `HomeScreen`:
    ```dart
    Future<void> _onSignOut(BuildContext context) async {
      final authProvider = context.read<AuthProvider>();
      await FirebaseAuth.instance.signOut();
      authProvider.onSignedOut();
    }
    ```
    - Firebase Auth sign out triggers the `authStateChanges()` listener which calls `onSignedOut()`
    - Explicit `authProvider.onSignedOut()` is belt-and-suspenders — the listener should handle it, but calling directly ensures immediate UI update
  - [x] 6.3 Add copy strings to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    static const signOut = 'Sign Out';
    static const defaultUserName = 'User';
    ```

- [x] Task 7: Tests (AC: #1-3)
  - [x] 7.1 Unit tests for REST auth middleware in `apps/server/tests/routes/middleware/rest-auth.test.ts`:
    - Rejects request with no Authorization header → 401 AUTH_REQUIRED
    - Rejects request with invalid token → 401 AUTH_INVALID
    - Rejects request with valid Firebase token but no user record → 401 USER_NOT_FOUND
    - Accepts valid Firebase token and attaches user to request context
    - Does NOT accept guest tokens (HS256)
  - [x] 7.2 Unit tests for `/api/users/me` route in `apps/server/tests/routes/users.test.ts`:
    - Returns user profile with correct camelCase fields (displayName, avatarUrl, createdAt)
    - Returns 401 when not authenticated
    - Returns correct avatar_url as avatarUrl (null case)
    - createdAt is ISO 8601 string format
  - [x] 7.3 Unit tests for `AuthProvider` profile enhancements in `apps/flutter_app/test/state/auth_provider_test.dart`:
    - `onProfileLoaded()` sets userId, avatarUrl, createdAt, profileLoading
    - `onSignedOut()` clears all profile fields
    - `onProfileLoadFailed()` sets profileLoading to error
    - Profile fields are null initially
  - [x] 7.4 Widget test for home screen profile display in `apps/flutter_app/test/screens/home_screen_test.dart`:
    - **IMPORTANT**: This test file ALREADY EXISTS with 5 tests (renders buttons, correct keys, min size, sign-in prompt, app title). ADD new tests to the existing file — do NOT create a new file or overwrite existing tests
    - **Follow existing test setup pattern**: `MultiProvider` wrapper with all providers + `AppConfig.initializeForTest(flavor: 'dev')` + `MediaQuery` + `MaterialApp`
    - Authenticated user with avatar: shows CircleAvatar
    - Authenticated user without avatar: no CircleAvatar
    - Authenticated user: shows sign-out button
    - Sign-out button triggers Firebase signOut
    - Unauthenticated user: shows sign-in prompt (existing behavior preserved — already tested, just verify no regression)
  - [x] 7.5 **DO NOT test**: Actual Firebase token verification (mock it), network image loading, OAuth popup UI, Firebase SDK internals

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: User profile data lives in PostgreSQL `users` table. Flutter reads via REST endpoint — no local persistence of profile data beyond in-memory provider cache
- **Persistence layer boundary**: All user DB access goes through `user-repository.ts` — the existing `findByFirebaseUid()` and `upsertFromFirebase()` already follow this pattern
- **REST boundary casing**: `snake_case` from DB → `camelCase` in Zod response schema at the route handler level. This is the ONE boundary conversion point per project context rules
- **Flutter boundary rules**: `AuthProvider` is a reactive state container only. No HTTP calls in the provider — `ApiService.fetchUserProfile()` is called from the bootstrap/auth listener, and results pushed to provider via `onProfileLoaded()`
- **No provider-to-provider access**: The profile fetch uses `ApiService` (not another provider) and pushes to `AuthProvider`

### Key Design Decisions

**Why `GET /api/users/me` instead of returning profile in socket handshake?**
The socket auth middleware (`auth-middleware.ts`) already does a fire-and-forget `upsertFromFirebase()` on connection. Adding profile data to the socket handshake response would couple profile fetching to WebSocket lifecycle. A separate REST endpoint:
- Allows profile fetch independent of socket connection state
- Follows the architecture's REST-for-non-realtime pattern (architecture.md line 398-408)
- Enables future profile features (update, settings) on the same route family
- Works with the `dart-open-fetch` type generation pipeline for type-safe Dart clients

**Why no database migration?**
The `users` table already has all required columns: `id`, `firebase_uid`, `display_name`, `avatar_url`, `created_at`. The `upsertFromFirebase()` already populates all fields from OAuth provider data. No schema changes needed.

**Why a centralized `requireAuth` middleware instead of inline auth?**
Existing routes (sessions.ts, playlists.ts, captures.ts, suggestions.ts) all use **inline token extraction** within each handler — there is NO existing centralized auth middleware. The `captures.ts:extractRequestIdentity()` (lines 40-68) is the closest precedent — a helper function that handles both Firebase and Guest tokens. This story introduces a centralized `requireAuth` as a Fastify `preHandler` hook because:
- It's reusable across multiple new Epic 9 routes (`/api/users/me`, `/api/sessions`, `/api/sessions/:id`)
- It reduces duplication for Firebase-only auth (guest tokens don't need profile access)
- It follows Fastify's idiomatic hook pattern (`preHandler` runs after body parsing, before handler)
- **Do NOT refactor existing routes** to use this middleware — that's a separate task

**Why `preHandler` not `onRequest`?**
`onRequest` runs before body parsing and is suited for global middleware. `preHandler` runs after parsing and is the idiomatic Fastify hook for route-level auth checks. Existing inline auth patterns happen inside the handler (semantically equivalent to `preHandler`). Using `preHandler` is the least-surprising position for route-scoped auth.

**Why `decorateRequest` in the route plugin?**
Fastify requires request properties to be declared via `decorateRequest` before they can be used. No existing route uses this pattern (all use local variables for auth state). The declaration goes in the `userRoutes` plugin function so it's co-located with the route that uses it.

**Why profile fetch is non-blocking?**
Profile data is supplementary — the app works fine without it (Firebase display name is available locally). If the server is down or the fetch fails, the user still sees their Firebase display name and can create/join parties. The profile fetch enriches the experience (server-side userId, avatar URL, account creation date) but never blocks it.

**Why `initAuthStateListener` callback pattern for profile fetch?**
The Flutter boundary rule says providers are reactive state containers only — no business logic. But the profile fetch needs to happen when Firebase auth succeeds, which is detected in the provider's `authStateChanges` listener. The callback pattern lets the bootstrap inject the fetch logic without breaking the provider boundary rule.

### Critical Integration Points

**Existing code that already satisfies part of the story:**

| Existing Code | What It Already Does |
|---|---|
| `auth-middleware.ts:33` | Fire-and-forget `upsertFromFirebase()` on every socket connection — user profile is ALREADY persisted |
| `user-repository.ts:upsertFromFirebase()` | Creates or updates user with `firebase_uid`, `display_name`, `avatar_url` on conflict |
| `user-repository.ts:findByFirebaseUid()` | Lookup user by Firebase UID — used by new REST auth middleware |
| `AuthProvider.signInWithGoogle()` | Firebase Google sign-in already implemented — triggers `authStateChanges` listener |
| `AuthProvider.onFirebaseAuthenticated()` | Sets basic auth state (firebaseUser, displayName) — extend with profile data |
| `AuthProvider.onSignedOut()` | Clears auth state — extend to clear profile fields |
| `home_screen.dart:71-107` | Already conditionally renders auth vs guest UI — extend auth branch with profile display |
| `api_service.dart` | HTTP client with `AuthMiddleware` that attaches `Authorization: Bearer` header — **requires manual `_authMiddleware.token = x` before each call** |
| `captures.ts:extractRequestIdentity()` lines 40-68 | Inline REST auth helper extracting identity from both Firebase and Guest tokens — closest precedent for the new `requireAuth` middleware |

**Existing code to modify (NOT reinvent):**

| Existing Code | Story 9.1 Modification |
|---|---|
| `auth_provider.dart` | Add `userId`, `avatarUrl`, `createdAt`, `profileLoading` fields + `onProfileLoaded()`, `onProfileLoadFailed()` methods. Clear them in `onSignedOut()` |
| `home_screen.dart` | Add avatar display + sign-out button in authenticated branch |
| `index.ts` | Register `userRoutes` + import `user-schemas.ts` for OpenAPI |
| `copy.dart` | Add `signOut` and `defaultUserName` strings |
| `api_service.dart` | Add `fetchUserProfile()` method |

### Previous Story Intelligence (Epic 8 Learnings)

- **Fire-and-forget pattern**: Used extensively in Epic 8 (summary write, award updates). The `upsertFromFirebase()` call in auth-middleware.ts uses this same pattern — DO NOT change it to await
- **Zod schema registration**: Schemas that ARE exposed via REST routes MUST be registered with `z.globalRegistry.add()` (unlike `sessionSummarySchema` in Story 8.4 which was NOT registered because it had no REST endpoint yet). This story's `userProfileDataSchema` MUST be registered
- **Import pattern**: Relative imports with `.js` extension — e.g., `import { requireAuth } from './middleware/rest-auth.js';`
- **Error shape**: Always `{ error: { code: 'ERROR_CODE', message: '...' } }` — never bare strings
- **Test factories**: Use shared factories from `tests/factories/` for test data
- **vitest**: All server tests use vitest, not jest

### Git Intelligence (Recent Commits)

Recent commits follow pattern: "Implement Story X.Y: Title with code review fixes" — all Epic 8 stories. Last 5 commits are all server-side + Flutter UI (widgets, providers, socket client extensions). The codebase is stable with 1354+ passing tests.

### What This Story Does NOT Include (Scope Boundaries)

- NO Facebook OAuth (deferred — `signInWithFacebook()` stays as UnimplementedError)
- NO profile editing (display name/avatar are synced from OAuth provider)
- NO user settings/preferences screen
- NO email/password authentication
- NO Session Timeline display (Story 9.3)
- NO guest-to-account upgrade flow (Story 9.2)
- NO account deletion
- NO user statistics aggregation
- NO Dart type generation via dart-open-fetch (run separately after server changes)

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/routes/middleware/rest-auth.ts` | NEW — Fastify REST auth middleware (Firebase JWT validation) |
| `apps/server/src/routes/users.ts` | NEW — `GET /api/users/me` route |
| `apps/server/src/shared/schemas/user-schemas.ts` | NEW — Zod schemas for user profile response |
| `apps/flutter_app/lib/state/auth_provider.dart` | MODIFY — Add profile fields and methods |
| `apps/flutter_app/lib/screens/home_screen.dart` | MODIFY — Add avatar display and sign-out button |
| `apps/flutter_app/lib/api/api_service.dart` | MODIFY — Add `fetchUserProfile()` method |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add signOut, defaultUserName strings |
| `apps/server/src/index.ts` | MODIFY — Register userRoutes + import user-schemas |
| `apps/server/tests/routes/middleware/rest-auth.test.ts` | NEW — REST auth middleware tests |
| `apps/server/tests/routes/users.test.ts` | NEW — User profile route tests |
| `apps/flutter_app/test/state/auth_provider_test.dart` | MODIFY — Add profile-related tests |
| `apps/flutter_app/test/screens/home_screen_test.dart` | MODIFY — Add profile display + sign-out widget tests (5 existing tests) |

### Testing Strategy

- **Test framework (server)**: `vitest` — all existing tests use vitest
- **Test framework (Flutter)**: `flutter_test` with `mockito` or manual mocks
- **REST auth middleware**: Mock `verifyFirebaseToken()` and `findByFirebaseUid()`. Test all error paths (no header, invalid token, no user record) and happy path (valid token, user found, request decorated). Follow the exact test setup pattern from existing route tests:
  ```typescript
  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { userRoutes } = await import('../../src/routes/users.js');
    await app.register(userRoutes);
    await app.ready();
  });
  ```
  Use `app.inject()` to send HTTP requests. Mock Firebase verification:
  ```typescript
  vi.mock('../../src/integrations/firebase-admin.js', () => ({
    verifyFirebaseToken: vi.fn(),
  }));
  ```
  Reference: `apps/server/tests/routes/suggestions.test.ts` and `captures.test.ts` for authenticated route test patterns
- **User route**: Use Fastify's `inject()` for route testing. User factory: `createTestUser()` from `tests/factories/user.ts`
- **AuthProvider**: Pure state tests — call methods, verify field values and notifyListeners calls. Existing pattern uses `FakeUser` for mocking Firebase User
- **Home screen**: Widget tests with mocked AuthProvider. **Extend existing `home_screen_test.dart`** — do NOT create duplicate. Existing setup: `MultiProvider` + `AppConfig.initializeForTest(flavor: 'dev')` + `MediaQuery` + `MaterialApp`
- **Regression**: Run all existing `auth_provider_test.dart` tests (5 existing tests) to ensure no regressions
- **DO NOT test**: Firebase SDK internals, actual OAuth popup, network image loading, token cryptography

### Project Structure Notes

- `kebab-case.ts` for all TypeScript files: `rest-auth.ts`, `users.ts`, `user-schemas.ts`
- New route files follow `apps/server/src/routes/` convention
- New middleware in `apps/server/src/routes/middleware/` (create directory if needed)
- Flutter tests mirror `lib/` structure: `test/state/`, `test/screens/`
- All UI strings in `constants/copy.dart` — no hardcoded strings in widgets

### References

- [Source: epics.md — Story 9.1 AC: persistent user profile (FR98)]
- [Source: prd.md — FR98 (persistent profile with display name, avatar, created_at), FR96 (optional OAuth sign-in), FR105 (dual auth paths)]
- [Source: architecture.md — Authentication & Security section: dual auth paths, WebSocket auth flow, REST API patterns]
- [Source: architecture.md — Frontend Architecture: AuthProvider handles Firebase Auth state + guest/account management]
- [Source: architecture.md — REST API endpoints: `/api/sessions` pattern for authenticated routes]
- [Source: project-context.md — Server boundaries: persistence/ is ONLY layer importing db/, REST boundary casing conversion]
- [Source: project-context.md — Flutter boundaries: providers are read-only, no business logic in providers]
- [Source: user-repository.ts — Existing upsertFromFirebase(), findByFirebaseUid(), findById() functions]
- [Source: auth-middleware.ts — Fire-and-forget upsertFromFirebase on socket connection (lines 32-39)]
- [Source: captures.ts:extractRequestIdentity() lines 40-68 — Inline REST auth extraction pattern, closest precedent for centralized requireAuth middleware]
- [Source: suggestions.test.ts, captures.test.ts — Authenticated route test patterns with vi.mock() + app.inject()]
- [Source: auth_provider.dart — Existing signInWithGoogle(), onFirebaseAuthenticated(), onSignedOut(), initAuthStateListener() methods]
- [Source: auth_middleware.dart (Flutter) — Manual token injection pattern: `_authMiddleware.token = x` before request, `null` after]
- [Source: api_service.dart — HTTP client using AuthMiddleware, existing authenticated request patterns]
- [Source: home_screen.dart — Existing conditional auth/guest UI (lines 71-107)]
- [Source: home_screen_test.dart — Existing 5 tests with MultiProvider + AppConfig.initializeForTest setup]
- [Source: auth_provider_test.dart — Existing 5 tests with FakeUser mock pattern]
- [Source: auth-schemas.ts — Zod schema registration pattern with z.globalRegistry.add()]
- [Source: common-schemas.ts — dataResponseSchema() wrapper pattern for REST responses]
- [Source: index.ts — Schema import order (common → auth → session → catalog → playlist → suggestion → capture) and route registration pattern]
- [Source: tests/factories/user.ts — createTestUser() factory with sequential IDs]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Zod `z.string().uuid()` rejects non-v4 UUIDs — test factory default IDs (`00000000-...`) fail response serialization. Fixed by using valid UUIDs in tests.
- Flutter `NetworkImage` triggers HTTP requests even during widget tests — used `HttpOverrides` with fake HTTP client to serve 1x1 transparent PNG in avatar test.
- `firebase_auth` exports its own `AuthProvider` class — added `hide AuthProvider` to import in `home_screen.dart` to resolve name collision.
- Fastify 5 `decorateRequest` rejects `null` — used `undefined` as initial value.

### Completion Notes List

- Task 1: Created `rest-auth.ts` middleware with `requireAuth` preHandler hook. Validates Firebase JWT, looks up user via `findByFirebaseUid()`, attaches `requestContext` to request. Returns 401 with standard error shape for all failure cases.
- Task 2: Created `user-schemas.ts` with `userProfileDataSchema` and `userProfileResponseSchema`. Registered with `z.globalRegistry.add()` for OpenAPI `$ref` generation. camelCase fields with nullable `avatarUrl`.
- Task 3: Created `users.ts` route with `GET /api/users/me`. Converts snake_case DB fields to camelCase at REST boundary. Registered route and schema import in `index.ts`.
- Task 4: Extended `AuthProvider` with `userId`, `avatarUrl`, `createdAt`, `profileLoading` fields. Added `onProfileLoaded()`, `onProfileLoadFailed()` methods. Updated `onSignedOut()` to clear all profile fields.
- Task 5: Added `fetchUserProfile()` to `ApiService` using existing `_chain.send()` pattern with manual token injection. Updated `initAuthStateListener()` to accept `onAuthenticated` callback. Wired profile fetch in `bootstrap.dart`.
- Task 6: Updated `HomeScreen` authenticated branch with CircleAvatar, display name, and sign-out button. Added `signOut` and `defaultUserName` copy strings.
- Task 7: Created 5 REST auth middleware tests, 4 user route tests, 4 AuthProvider profile tests, 4 home screen widget tests. All 17 new tests pass. No regressions.

### Code Review Fixes Applied

- **H1 (HIGH):** Added try-catch around profile data type casts in `bootstrap.dart` `onAuthenticated` callback to prevent auth listener crash on unexpected response shapes
- **H2 (HIGH):** Added missing "does NOT accept guest tokens (HS256)" test to `rest-auth.test.ts` per Task 7.1 spec (now 6 middleware tests)
- **M1 (MEDIUM):** Added `debugPrint` to `fetchUserProfile` catch block in `api_service.dart` for observability (was silently swallowing all errors)
- **M2 (MEDIUM):** Changed `HttpOverrides` restoration in `home_screen_test.dart` avatar test to use `addTearDown` for safe cleanup on assertion failure
- **L1 (LOW):** Moved `userRoutes` registration in `index.ts` to after `authRoutes` per story spec (was last, now before `captureRoutes`)

### File List

- `apps/server/src/routes/middleware/rest-auth.ts` — NEW
- `apps/server/src/shared/schemas/user-schemas.ts` — NEW
- `apps/server/src/routes/users.ts` — NEW
- `apps/server/src/index.ts` — MODIFIED (added userRoutes import/registration, user-schemas import)
- `apps/flutter_app/lib/state/auth_provider.dart` — MODIFIED (added profile fields, methods, callback param)
- `apps/flutter_app/lib/api/api_service.dart` — MODIFIED (added fetchUserProfile)
- `apps/flutter_app/lib/config/bootstrap.dart` — MODIFIED (added initAuthStateListener with profile fetch callback)
- `apps/flutter_app/lib/screens/home_screen.dart` — MODIFIED (added avatar, sign-out, firebase_auth import)
- `apps/flutter_app/lib/constants/copy.dart` — MODIFIED (added signOut, defaultUserName)
- `apps/server/tests/routes/middleware/rest-auth.test.ts` — NEW
- `apps/server/tests/routes/users.test.ts` — NEW
- `apps/flutter_app/test/state/auth_provider_test.dart` — MODIFIED (added 4 profile tests)
- `apps/flutter_app/test/screens/home_screen_test.dart` — MODIFIED (added 4 authenticated user tests)

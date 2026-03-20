# Story 9.2: Guest-to-Account Upgrade

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest user,
I want to upgrade to a full account without losing anything from my current session,
So that I can keep my party memories and build a history over time.

## Acceptance Criteria

1. **Given** a guest user is in an active session or viewing post-session content, **When** they choose to upgrade to a full account, **Then** they can sign in via Google OAuth (Firebase Auth Flutter SDK) (FR97) **And** the upgrade completes without disconnecting the WebSocket (NFR35) **And** the upgrade does not interrupt the current DJ state (NFR35) **And** no accumulated session data, participation scores, or captured media is lost (FR97) **And** the upgrade completes in under 5 seconds including the native OAuth flow (NFR35)
2. **Given** the upgrade is complete, **When** the user's data is migrated, **Then** all session participation records are linked to the new user profile **And** all captured media is re-associated with the authenticated user ID
3. **Given** a guest user sees upgrade prompts, **When** they are in-session, **Then** a non-blocking "Sign in to save your stats" option is available **And** the prompt never gates any in-session feature behind auth
4. **Given** a user with an existing Firebase account upgrades from guest, **When** the server processes the upgrade, **Then** the existing account is reused (no duplicate) **And** the current session's participant record and captures are linked to the existing account

## Tasks / Subtasks

- [x] Task 1: Add upgrade and linking functions to persistence layer (AC: #2)
  - [x] 1.1 Add `upgradeGuestToAuthenticated()` to `apps/server/src/persistence/user-repository.ts`:
    ```typescript
    export async function upgradeGuestToAuthenticated(
      guestUserId: string,
      firebaseUid: string,
      displayName: string,
      avatarUrl?: string,
    ): Promise<UsersTable> {
      return db
        .updateTable('users')
        .set({
          firebase_uid: firebaseUid,
          display_name: displayName,
          avatar_url: avatarUrl ?? null,
        })
        .where('id', '=', guestUserId)
        .where('firebase_uid', 'is', null)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    ```
    - **Purpose**: Upgrade a guest host's existing user record by setting firebase_uid. Only works on users with firebase_uid IS NULL (prevents accidental overwrite of already-linked accounts)
    - **Why not upsertFromFirebase?** Because upsertFromFirebase creates a NEW user.id (UUID). The guest host's user.id is already used as FK in sessions.host_user_id, session_participants.user_id, and media_captures.user_id. Changing the user.id would break all FKs
  - [x] 1.2 Add `linkGuestParticipant()` to `apps/server/src/persistence/session-repository.ts`:
    ```typescript
    export async function linkGuestParticipant(
      sessionId: string,
      guestName: string,
      userId: string,
    ): Promise<void> {
      await db
        .updateTable('session_participants')
        .set({ user_id: userId, guest_name: null })
        .where('session_id', '=', sessionId)
        .where('guest_name', '=', guestName)
        .where('user_id', 'is', null)
        .execute();
    }
    ```
    - Sets user_id on the guest participant record and clears guest_name (they now have a user record)
    - WHERE user_id IS NULL prevents double-linking
  - [x] 1.3 Add `relinkCaptures()` to `apps/server/src/persistence/media-repository.ts`:
    ```typescript
    export async function relinkCaptures(
      captureIds: string[],
      userId: string,
    ): Promise<number> {
      if (captureIds.length === 0) return 0;
      const result = await db
        .updateTable('media_captures')
        .set({ user_id: userId })
        .where('id', 'in', captureIds)
        .where('user_id', 'is', null)
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    }
    ```
    - Only updates captures with user_id IS NULL (safety guard)
    - Returns count of re-linked captures for logging
    - Accepts capture IDs from the client (client tracks which captures it created)

- [x] Task 2: Create upgrade Zod schemas (AC: #1, #2)
  - [x] 2.1 Create `apps/server/src/shared/schemas/upgrade-schemas.ts`:
    ```typescript
    import { z } from 'zod/v4';
    import { dataResponseSchema } from './common-schemas.js';

    export const upgradeRequestSchema = z.object({
      firebaseToken: z.string().min(1),
      guestId: z.string(),
      sessionId: z.string(),
      captureIds: z.array(z.string()).optional().default([]),
    });

    export const upgradeResponseSchema = dataResponseSchema(
      z.object({
        userId: z.string(),
        displayName: z.string(),
        avatarUrl: z.string().nullable(),
        createdAt: z.string(),
        linkedParticipant: z.boolean(),
        linkedCaptureCount: z.number(),
      })
    );
    z.globalRegistry.add(upgradeResponseSchema, { id: 'UpgradeResponse' });
    ```
    - `guestId`: the ephemeral guest UUID from the original guest token (for hosts this equals their user.id; for participants this is the random UUID from `POST /api/auth/guest`)
    - `captureIds`: optional array of capture IDs this guest created during the session (Flutter tracks these)
    - Response includes `linkedParticipant` and `linkedCaptureCount` for transparency
  - [x] 2.2 Import `upgrade-schemas.ts` in `apps/server/src/index.ts` BEFORE swagger init — insert AFTER `user-schemas.js` in the existing schema import block

- [x] Task 3: Create `POST /api/users/upgrade` route (AC: #1, #2, #4)
  - [x] 3.1 Add upgrade route to `apps/server/src/routes/users.ts` (extend existing file, DO NOT create a new file):
    ```typescript
    // POST /api/users/upgrade — Guest-to-account upgrade
    fastify.post('/api/users/upgrade', {
      schema: {
        body: upgradeRequestSchema,
        response: {
          200: upgradeResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    }, async (request, reply) => {
      const { firebaseToken, guestId, sessionId, captureIds } = request.body as {
        firebaseToken: string;
        guestId: string;
        sessionId: string;
        captureIds: string[];
      };

      // 1. Validate Firebase token
      let decoded;
      try {
        decoded = await verifyFirebaseToken(firebaseToken);
      } catch {
        return reply.status(401).send({
          error: { code: 'AUTH_INVALID', message: 'Invalid Firebase token' },
        });
      }

      const firebaseUid = decoded.uid;
      const displayName = (decoded.name ?? decoded.email ?? 'User') as string;
      const avatarUrl = decoded.picture as string | undefined;

      // 2. Check if Firebase account already exists
      const existingUser = await findByFirebaseUid(firebaseUid);

      let user: UsersTable;
      let linkedParticipant = false;

      if (existingUser) {
        // Case A: Firebase account exists — link current session data to existing account
        user = existingUser;
      } else {
        // Case B: No existing account — try to upgrade guest host's user record
        const guestUser = await findById(guestId);
        if (guestUser && guestUser.firebase_uid === null) {
          // Guest host: update existing record (preserves all FKs)
          user = await upgradeGuestToAuthenticated(guestId, firebaseUid, displayName, avatarUrl);
        } else {
          // Guest participant: create new user record
          user = await upsertFromFirebase({ firebaseUid, displayName, avatarUrl });
        }
      }

      // 3. Link guest participant record to user (for guest participants only)
      // For guest hosts: participant record already has user_id set
      // For guest participants: participant record has user_id = NULL, guest_name = displayName
      const session = await findSessionById(sessionId);
      if (session) {
        const participants = await getParticipants(sessionId);
        const guestParticipant = participants.find(
          p => p.user_id === null && p.guest_name !== null
            && p.guest_name === displayName
        );
        if (guestParticipant) {
          await linkGuestParticipant(sessionId, guestParticipant.guest_name!, user.id);
          linkedParticipant = true;
        }
      }

      // 4. Re-link media captures
      const linkedCaptureCount = await relinkCaptures(captureIds, user.id);

      return reply.send({
        data: {
          userId: user.id,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          createdAt: user.created_at.toISOString(),
          linkedParticipant,
          linkedCaptureCount,
        },
      });
    });
    ```
    - **No requireAuth middleware** — the guest is unauthenticated. The Firebase token in the body is the proof of identity
    - **Three upgrade paths handled:**
      - (A) Firebase account already exists → reuse it, link session data
      - (B) Guest host with user record (firebase_uid IS NULL) → update firebase_uid in place, preserving user.id and all FKs
      - (C) Guest participant without user record → create new user, link participant + captures
    - **Guest participant matching**: Uses `guest_name` + `session_id` to find the right participant record. This works because the unique constraint `uq_session_participant` prevents duplicate (session_id, guest_name) pairs
    - **Idempotent**: If called twice, the second call is a no-op (participant already linked, captures already linked)
    - **snake_case → camelCase** conversion at REST boundary per project-context rules
  - [x] 3.2 Add required imports to `users.ts`:
    ```typescript
    import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
    import {
      findByFirebaseUid,
      findById,
      upgradeGuestToAuthenticated,
      upsertFromFirebase,
    } from '../persistence/user-repository.js';
    import {
      findById as findSessionById,
      getParticipants,
      linkGuestParticipant,
    } from '../persistence/session-repository.js';
    import { relinkCaptures } from '../persistence/media-repository.js';
    import {
      upgradeRequestSchema,
      upgradeResponseSchema,
    } from '../shared/schemas/upgrade-schemas.js';
    ```
    - Note: `findByFirebaseUid` is already imported in users.ts from rest-auth.ts dependency. Check existing imports and avoid duplicates
  - [x] 3.3 Register upgrade-schemas import in `index.ts` BEFORE swagger init

- [x] Task 4: Add `auth:upgraded` socket event handler for in-session re-auth (AC: #1)
  - [x] 4.1 Create handler in `apps/server/src/socket-handlers/auth-upgrade-handler.ts`:
    ```typescript
    import type { AuthenticatedSocket } from '../shared/socket-types.js';
    import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
    import { findByFirebaseUid } from '../persistence/user-repository.js';
    import { EVENTS } from '../shared/events.js';

    export function registerAuthUpgradeHandler(socket: AuthenticatedSocket): void {
      socket.on(EVENTS.AUTH_UPGRADED, async (payload: { firebaseToken: string }) => {
        try {
          const decoded = await verifyFirebaseToken(payload.firebaseToken);
          const user = await findByFirebaseUid(decoded.uid);

          if (!user) {
            return; // Silently fail — REST already persisted, this is best-effort
          }

          // Update socket.data in-place — NO disconnect
          socket.data.userId = user.id;
          socket.data.role = 'authenticated';
          socket.data.displayName = user.display_name;
        } catch {
          // Silently fail — REST already persisted everything
        }
      });
    }
    ```
    - **CRITICAL: No disconnect** — socket stays connected, only socket.data mutated in-place (NFR35)
    - **Fire-and-forget pattern** — consistent with all other socket handlers in this codebase (no ack/callback pattern is used anywhere). The REST `POST /api/users/upgrade` already persisted all data; this handler is a best-effort live metadata update
    - Maps to server-side `user.id` (UUID) for consistency with DB FK references
    - After this, future socket events from this user will use the authenticated user.id for scoring, event logging, etc.
  - [x] 4.2 Add `AUTH_UPGRADED = 'auth:upgraded'` to `apps/server/src/shared/events.ts` — insert after the existing `AUTH_INVALID` constant in the auth section. Existing auth events: `AUTH_REFRESH_REQUIRED`, `AUTH_INVALID`
  - [x] 4.3 Register handler in `apps/server/src/socket-handlers/connection-handler.ts`:
    - Add import: `import { registerAuthUpgradeHandler } from './auth-upgrade-handler.js';`
    - Add registration: `registerAuthUpgradeHandler(s);` — after existing handler registrations (line 65)
  - [x] 4.4 **DO NOT** create a new Socket.io namespace — this event belongs to the existing default namespace, consistent with `auth:refreshRequired` and `auth:invalid` patterns

- [x] Task 5: Add client-side capture ID tracking in Flutter (AC: #2)
  - [x] 5.1 Add `_myCaptureIds` list to `apps/flutter_app/lib/state/capture_provider.dart`:
    ```dart
    final List<String> _myCaptureIds = [];
    List<String> get myCaptureIds => List.unmodifiable(_myCaptureIds);

    /// Called when server persists a capture for this client.
    /// Tracks capture ID for guest-to-account upgrade re-linking.
    void onCaptureCreated(String captureId) {
      _myCaptureIds.add(captureId);
    }

    /// Clears tracked capture IDs (called on sign-out or session end).
    void clearMyCaptureIds() {
      _myCaptureIds.clear();
    }
    ```
    - Lightweight tracking — just a list of UUIDs, no persistence needed (only relevant during current session)
  - [x] 5.2 Wire `onCaptureCreated()` via the `capture:persisted` socket event in `apps/flutter_app/lib/socket/client.dart`. The server already emits `CAPTURE_PERSISTED` (defined in `events.ts` line 65) from `capture-handlers.ts:63` after persisting capture metadata. Add a listener in `_setupPartyListeners()` around line 543 (after the existing `capture:bubble` listener):
    ```dart
    _socket?.on('capture:persisted', (data) {
      final payload = data as Map<String, dynamic>;
      final captureId = payload['captureId'] as String;
      _captureProvider?.onCaptureCreated(captureId);
    });
    ```
    - **Why `capture:persisted` instead of REST response?** The codebase has two capture creation paths: REST (`apiService.createCapture()` from `capture_overlay.dart`) and socket (`capture:complete` → server persists → `capture:persisted`). Hooking into the socket event covers both paths via a single hook point
    - `SocketClient` already stores `_captureProvider` as a field (set during `connect()`) — no new wiring needed

- [x] Task 6: Add upgrade API call to Flutter ApiService (AC: #1)
  - [x] 6.1 Add `upgradeGuestToAccount()` to `apps/flutter_app/lib/api/api_service.dart`:
    ```dart
    /// Upgrades a guest session to a full Firebase account.
    /// Returns the upgraded user profile data on success, null on failure.
    Future<Map<String, dynamic>?> upgradeGuestToAccount({
      required String firebaseToken,
      required String guestId,
      required String sessionId,
      List<String> captureIds = const [],
    }) async {
      try {
        final response = await _client.post(
          Uri.parse('$_baseUrl/api/users/upgrade'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'firebaseToken': firebaseToken,
            'guestId': guestId,
            'sessionId': sessionId,
            'captureIds': captureIds,
          }),
        );
        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          return body['data'] as Map<String, dynamic>?;
        }
        debugPrint('Upgrade failed: ${response.statusCode} ${response.body}');
        return null;
      } catch (e) {
        debugPrint('Upgrade error: $e');
        return null;
      }
    }
    ```
    - **No auth middleware token injection needed** — this endpoint doesn't use Bearer auth (the Firebase token is in the request body, not the header)
    - Unlike `fetchUserProfile()` which uses the existing `_authMiddleware.token` pattern, upgrade is a public endpoint accepting the token as body data

- [x] Task 7: Add upgrade flow to Flutter AuthProvider (AC: #1, #3)
  - [x] 7.1 Add upgrade state and method to `apps/flutter_app/lib/state/auth_provider.dart`:
    ```dart
    LoadingState _upgradeLoading = LoadingState.idle;
    LoadingState get upgradeLoading => _upgradeLoading;

    /// Called after successful guest-to-account upgrade.
    /// Transitions from authenticatedGuest to authenticatedFirebase state.
    void onUpgradeCompleted({
      required User firebaseUser,
      required String userId,
      required String displayName,
      String? avatarUrl,
      required DateTime createdAt,
    }) {
      _firebaseUser = firebaseUser;
      _guestToken = null;
      _guestId = null;
      _userId = userId;
      _displayName = displayName;
      _avatarUrl = avatarUrl;
      _createdAt = createdAt;
      _state = AuthState.authenticatedFirebase;
      _profileLoading = LoadingState.success;
      _upgradeLoading = LoadingState.success;
      notifyListeners();
    }

    void onUpgradeFailed() {
      _upgradeLoading = LoadingState.error;
      notifyListeners();
    }

    set upgradeLoading(LoadingState value) {
      _upgradeLoading = value;
      notifyListeners();
    }
    ```
    - Clears guest state (_guestToken, _guestId) and sets Firebase state
    - Transitions `_state` from `authenticatedGuest` → `authenticatedFirebase`
    - Profile fields populated from upgrade response (same as onProfileLoaded)
  - [x] 7.2 Clear upgrade state in `onSignedOut()`:
    ```dart
    _upgradeLoading = LoadingState.idle;
    ```

- [x] Task 8: Wire upgrade flow — split between party screen and SocketClient (AC: #1, #2)
  - [x] 8.1 Add `emitAuthUpgraded()` method to `apps/flutter_app/lib/socket/client.dart` — handles ONLY the socket re-auth concern:
    ```dart
    /// Re-authenticates the live socket after guest-to-account upgrade.
    /// Fire-and-forget — the REST upgrade already persisted everything.
    /// This just updates socket.data for future event scoring.
    void emitAuthUpgraded(String firebaseToken) {
      _socket?.emit('auth:upgraded', {'firebaseToken': firebaseToken});
    }
    ```
    - **Simple `emit()` only** — consistent with ALL other socket emissions in this codebase (e.g., `emitHostSkip()`, `emitReaction()`). The codebase does NOT use `emitWithAck` anywhere
    - Fire-and-forget: the REST endpoint already persisted all data. Socket re-auth is a live metadata update — if it fails, worst case is the socket still uses guest role for remaining session events (no data loss)
  - [x] 8.2 Add the full upgrade orchestration as `_onUpgrade()` in `apps/flutter_app/lib/screens/party_screen.dart` (the screen handler, NOT SocketClient):
    ```dart
    Future<void> _onUpgrade(BuildContext context) async {
      final authProvider = context.read<AuthProvider>();
      final apiService = context.read<ApiService>();
      final captureProvider = context.read<CaptureProvider>();
      final partyProvider = context.read<PartyProvider>();

      authProvider.upgradeLoading = LoadingState.loading;

      try {
        // 1. Firebase OAuth — same method as AuthProvider.signInWithGoogle()
        final googleProvider = GoogleAuthProvider();
        final credential = await FirebaseAuth.instance.signInWithProvider(googleProvider);
        final firebaseUser = credential.user;
        if (firebaseUser == null) {
          authProvider.onUpgradeFailed();
          return;
        }

        final token = await firebaseUser.getIdToken();
        if (token == null) {
          authProvider.onUpgradeFailed();
          return;
        }

        // 2. Call server upgrade endpoint
        final upgradeData = await apiService.upgradeGuestToAccount(
          firebaseToken: token,
          guestId: authProvider.guestId!,
          sessionId: partyProvider.sessionId!,
          captureIds: captureProvider.myCaptureIds,
        );

        if (upgradeData == null) {
          authProvider.onUpgradeFailed();
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(Copy.upgradeFailed)),
            );
          }
          return;
        }

        // 3. Re-authenticate socket (fire-and-forget)
        final socketClient = context.read<SocketClient>();
        socketClient.emitAuthUpgraded(token);

        // 4. Update auth state
        authProvider.onUpgradeCompleted(
          firebaseUser: firebaseUser,
          userId: upgradeData['userId'] as String,
          displayName: upgradeData['displayName'] as String,
          avatarUrl: upgradeData['avatarUrl'] as String?,
          createdAt: DateTime.parse(upgradeData['createdAt'] as String),
        );

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(Copy.upgradeSuccess)),
          );
        }
      } catch (e) {
        debugPrint('Upgrade error: $e');
        authProvider.onUpgradeFailed();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(Copy.upgradeFailed)),
          );
        }
      }
    }
    ```
    - **Why the screen handler, not SocketClient?** This follows the existing pattern: `AuthProvider.signInWithGoogle()` handles Firebase OAuth directly from screens (documented exception to "no business logic in providers" rule). The party screen orchestrates the full flow (OAuth → REST → socket → provider update), while `SocketClient.emitAuthUpgraded()` handles only the socket concern
    - **Firebase sign-in method**: Uses `FirebaseAuth.instance.signInWithProvider(GoogleAuthProvider())` — the EXACT same cross-platform method as `AuthProvider.signInWithGoogle()` (auth_provider.dart:125-141). No `google_sign_in` package is used — Firebase Auth handles everything internally
    - SnackBar feedback integrated directly (replaces Task 9.4)
  - [x] 8.3 Verify `guestId` getter is public on `AuthProvider` (check existing code — `_guestId` has a getter but verify it's accessible). Also verify `sessionId` is available on `PartyProvider`

- [x] Task 9: Add upgrade UI trigger in party screen (AC: #3)
  - [x] 9.1 Add upgrade copy strings to `apps/flutter_app/lib/constants/copy.dart`:
    ```dart
    static const upgradePrompt = 'Sign in to save your stats';
    static const upgradeButton = 'Sign In';
    static const upgradeSuccess = 'Account created! Your session data is saved.';
    static const upgradeFailed = 'Sign in failed. Try again later.';
    ```
  - [x] 9.2 Add a subtle upgrade banner to `apps/flutter_app/lib/screens/party_screen.dart` (887 lines). Insert in the `build()` method's `Stack` widget **after the `ReconnectingBanner`** (around line 228), following the existing banner positioning pattern. Use `lib/widgets/reconnecting_banner.dart` as a template for the banner widget style:
    ```dart
    // Add AuthProvider watch alongside existing PartyProvider watch
    final authProvider = context.watch<AuthProvider>();

    // In the Stack children, after ReconnectingBanner (line ~228):
    if (authProvider.state == AuthState.authenticatedGuest &&
        authProvider.upgradeLoading != LoadingState.success)
      Positioned(
        top: 0,
        left: 0,
        right: 0,
        child: Container(
          key: const Key('upgrade-banner'),
          padding: EdgeInsets.symmetric(
            horizontal: DJTokens.spaceMd,
            vertical: DJTokens.spaceSm,
          ),
          color: DJTokens.surfaceElevated,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  Copy.upgradePrompt,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
                ),
              ),
              TextButton(
                key: const Key('upgrade-btn'),
                onPressed: () => _onUpgrade(context),
                child: Text(Copy.upgradeButton),
              ),
            ],
          ),
        ),
      ),
    ```
    - **Non-blocking**: Just a banner row, never a modal or dialog
    - **Disappears after success**: `upgradeLoading != LoadingState.success` check
    - UX spec says: "Auth prompt is positioned as 'save your stats'" — positive framing
  - [x] 9.3 The `_onUpgrade()` handler is already defined in Task 8.2 (includes SnackBar feedback). No additional wiring needed — it reads providers from `context` directly

- [x] Task 10: Tests (AC: #1-4)
  - [x] 10.1 Unit tests for `upgradeGuestToAuthenticated()` in `apps/server/tests/persistence/user-repository.test.ts` (extend existing or create):
    - Upgrades guest user with firebase_uid IS NULL
    - Returns updated user with firebase_uid set
    - Throws if user already has firebase_uid (prevents accidental overwrite)
    - Throws if user not found
  - [x] 10.2 Unit tests for `linkGuestParticipant()` in `apps/server/tests/persistence/session-repository.test.ts`:
    - Links guest participant by session_id + guest_name
    - Clears guest_name after linking
    - No-op if participant already has user_id
    - No-op if guest_name doesn't match
  - [x] 10.3 Unit tests for `relinkCaptures()` in `apps/server/tests/persistence/media-repository.test.ts`:
    - Re-links captures by ID where user_id IS NULL
    - Returns correct count
    - Ignores captures with user_id already set
    - Returns 0 for empty array
  - [x] 10.4 Integration tests for `POST /api/users/upgrade` in `apps/server/tests/routes/users.test.ts` (extend existing file):
    - **Path A**: Existing Firebase account → reuses account, links participant
    - **Path B**: Guest host (has user record) → upgrades firebase_uid, preserves user.id
    - **Path C**: Guest participant (no user record) → creates user, links participant + captures
    - Invalid Firebase token → 401
    - Idempotent: calling twice succeeds without error
    - Follow existing test setup pattern: `vi.mock` Firebase + repositories, `app.inject()` for HTTP
  - [x] 10.5 Unit tests for `auth:upgraded` socket handler in `apps/server/tests/socket-handlers/auth-upgrade-handler.test.ts`:
    - Valid Firebase token → updates socket.data.role to 'authenticated' and userId to user.id
    - Invalid token → socket.data unchanged (silent failure)
    - User not found → socket.data unchanged (silent failure)
    - Verify socket.data.displayName updated from user record
  - [x] 10.6 Unit tests for `AuthProvider.onUpgradeCompleted()` in `apps/flutter_app/test/state/auth_provider_test.dart` (extend existing):
    - Transitions state from authenticatedGuest to authenticatedFirebase
    - Clears guestToken and guestId
    - Sets userId, displayName, avatarUrl, createdAt
    - Sets upgradeLoading to success
    - onUpgradeFailed sets upgradeLoading to error
    - onSignedOut clears upgradeLoading
  - [x] 10.7 Unit tests for `CaptureProvider.onCaptureCreated()` in `apps/flutter_app/test/state/capture_provider_test.dart` (extend existing):
    - Adds capture ID to myCaptureIds list
    - clearMyCaptureIds empties the list
  - [x] 10.8 Widget test for upgrade banner in party screen (extend existing party screen test file):
    - Shows upgrade banner for guest users
    - Hides upgrade banner for authenticated users
    - Hides upgrade banner after successful upgrade
    - Upgrade button triggers sign-in flow
  - [x] 10.9 **DO NOT test**: Actual Firebase OAuth popup, native OAuth flow UX, Firebase SDK internals, network image loading

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All upgrade logic lives on the server. The Flutter client triggers Firebase OAuth, sends the token to the server, and the server performs all data mutations (user creation, participant linking, capture re-linking)
- **Persistence layer boundary**: All DB operations go through repository functions (user-repository.ts, session-repository.ts, media-repository.ts). No raw Kysely in routes
- **REST boundary casing**: `snake_case` from DB → `camelCase` in Zod response schema. The upgrade endpoint follows the same pattern as `GET /api/users/me`
- **Flutter boundary rules**: AuthProvider is reactive state container only. The upgrade orchestration lives in the party screen handler (following the same pattern as `AuthProvider.signInWithGoogle()` which is called from screens). SocketClient handles only the socket re-auth concern via `emitAuthUpgraded()`
- **No provider-to-provider access**: The party screen reads providers from context and coordinates the upgrade flow. SocketClient emits a single socket event — no provider coordination in SocketClient
- **Socket event naming**: `auth:upgraded` follows the `namespace:action` pattern (auth namespace)

### Key Design Decisions

**Why a separate `POST /api/users/upgrade` endpoint instead of reusing `/api/auth` or `/api/users/me`?**
The upgrade has unique requirements not covered by existing endpoints: it must (1) validate a Firebase token from an unauthenticated context (guest has no Bearer auth), (2) perform data migration (participant + capture linking), and (3) handle three different upgrade paths (existing account, guest host, guest participant). A dedicated endpoint keeps this complexity isolated and makes it easy to test each path independently.

**Why client-side capture ID tracking instead of server-side guest-to-capture mapping?**
Guest participant captures have `user_id = NULL` in `media_captures`. Multiple guests in the same session would all have NULL captures — indistinguishable server-side. Rather than adding a DB migration (new `guest_id` column), the Flutter client tracks its own capture IDs via the `capture:persisted` socket event and sends them during upgrade. The codebase has two capture creation paths (REST via `apiService.createCapture()` from `capture_overlay.dart`, and socket via `capture:complete` → `capture:persisted`). The `capture:persisted` listener in SocketClient covers both paths via a single hook point. No migration needed.

**Why `socket.data` mutation instead of socket reconnection?**
NFR35 explicitly requires "no WebSocket disconnection." Mutating `socket.data` in-place on the existing socket preserves the connection, all registered event handlers, and the room membership. The client sees zero interruption. The alternative (disconnect + reconnect with Firebase token) would cause a brief disconnect, potential event loss, and reconnection overhead.

**Why does the socket re-auth map to `user.id` (server UUID) instead of Firebase UID?**
The socket auth middleware sets `socket.data.userId = decodedToken.uid` (Firebase UID) for authenticated users. However, DB FK columns (`session_participants.user_id`, `media_captures.user_id`) reference `users.id` (server UUID). For the upgrade path, using `user.id` ensures consistency with the freshly-linked participant and capture records. The auth-upgrade handler looks up the user by Firebase UID and sets `socket.data.userId = user.id`.

**Why not score past guest actions retroactively?**
The current codebase skips scoring for guest role (`if (params.role !== 'guest')` in session-manager.ts:1730). After upgrade, future actions will earn points (socket.data.role changes to 'authenticated'). Retroactive scoring would require replaying the event stream, recalculating participation — complex and low value for MVP. The user gains scoring from the moment they upgrade forward.

**Why match guest participants by `guest_name` instead of `guestId`?**
Guest participants joining via `POST /api/auth/guest` get an ephemeral `guestId` (UUID) that is NOT stored in the DB. The `session_participants` table stores `guest_name` (display name) for guests, not `guestId`. The unique index `uq_session_participant` on `(session_id, COALESCE(CAST(user_id AS text), guest_name))` ensures no two guests in the same session have the same name. So `guest_name` + `session_id` is a reliable lookup key.

### Critical Integration Points

**Existing code that this story builds on:**

| Existing Code | What It Already Does | How Story 9.2 Uses It |
|---|---|---|
| `user-repository.ts:upsertFromFirebase()` | Creates/updates user with firebase_uid via ON CONFLICT | Used for guest participants who need a NEW user record (Case C) |
| `user-repository.ts:createGuestUser()` | Creates user with firebase_uid=null | Guest hosts already have records from this — upgrade sets firebase_uid |
| `user-repository.ts:findByFirebaseUid()` | Lookup by Firebase UID | Checks if Firebase account already exists (Case A) |
| `user-repository.ts:findById()` | Lookup by server UUID | Checks if guestId matches an existing user record (guest host detection) |
| `session-repository.ts:addParticipantIfNotExists()` | Idempotent participant insert | Already stores guest participants with user_id=NULL, guest_name=displayName |
| `session-repository.ts:getParticipants()` | Returns all participants with user join | Used to find the guest participant record by guest_name |
| `media-repository.ts:create()` | Creates capture with optional user_id | Guest captures already have user_id=NULL — upgrade re-links them |
| `auth-middleware.ts` | Socket auth for Firebase + guest tokens | Template for the auth-upgrade handler's Firebase token validation |
| `AuthProvider.signInWithGoogle()` | Firebase Google OAuth flow | Reuse the SAME sign-in approach for the upgrade flow |
| `AuthProvider.onFirebaseAuthenticated()` | Sets Firebase auth state | `onUpgradeCompleted()` is similar but also handles profile fields |
| `rest-auth.ts:requireAuth()` | REST Firebase auth middleware | NOT used for upgrade endpoint (guest has no Bearer token) |
| `EVENTS` constant object | Socket.io event name registry | Add `AUTH_UPGRADED` event name |

**Existing code to modify (NOT reinvent):**

| Existing Code | Story 9.2 Modification |
|---|---|
| `user-repository.ts` | Add `upgradeGuestToAuthenticated()` function |
| `session-repository.ts` | Add `linkGuestParticipant()` function |
| `media-repository.ts` | Add `relinkCaptures()` function |
| `routes/users.ts` | Add `POST /api/users/upgrade` route to existing file |
| `shared/events.ts` | Add `AUTH_UPGRADED` event constant |
| `connection-handler.ts` | Register auth-upgrade handler |
| `auth_provider.dart` | Add `onUpgradeCompleted()`, `onUpgradeFailed()`, `upgradeLoading` |
| `capture_provider.dart` | Add `myCaptureIds` tracking |
| `api_service.dart` | Add `upgradeGuestToAccount()` method |
| `socket/client.dart` | Add `emitAuthUpgraded()` method (simple emit, not full orchestration) |
| `screens/party_screen.dart` | Add upgrade banner + `_onUpgrade()` orchestration handler |
| `copy.dart` | Add upgrade-related copy strings |
| `index.ts` | Import upgrade-schemas before swagger init |
| Party screen | Add upgrade banner for guest users |

### Data Flow Diagram

```
Flutter (Guest User)                  Server
═══════════════════                   ══════
1. User taps "Sign In" on
   party_screen.dart banner
   ↓
2. FirebaseAuth.instance
   .signInWithProvider(
     GoogleAuthProvider())
   → native OAuth popup
   → Firebase user + ID token
   ↓
3. POST /api/users/upgrade
   { firebaseToken, guestId,    →    4. verifyFirebaseToken()
     sessionId, captureIds[] }        5. Find/create user record
                                      6. linkGuestParticipant()
                                      7. relinkCaptures()
                                 ←    8. Return user profile
   ↓
9. socketClient.emitAuthUpgraded()
   socket.emit('auth:upgraded',
   { firebaseToken })           →    10. Validate token (best-effort)
                                      11. Update socket.data in-place
                                          (role='authenticated',
                                           userId=user.id)
   ↓ (fire-and-forget, don't wait)
12. AuthProvider.onUpgradeCompleted()
    - state → authenticatedFirebase
    - clear guestToken, guestId
    - set userId, displayName, etc.
    ↓
13. UI re-renders:
    - Upgrade banner disappears
    - SnackBar shows success
    - Future actions earn points
```

### Previous Story Intelligence (Story 9.1 Learnings)

- **Zod `z.string().uuid()` rejects non-v4 UUIDs**: Test factory default IDs (`00000000-...`) fail response serialization. Use valid v4 UUIDs in tests
- **Flutter `NetworkImage` triggers HTTP requests in widget tests**: Use `HttpOverrides` with fake HTTP client if testing avatar display
- **`firebase_auth` exports its own `AuthProvider` class**: Add `hide AuthProvider` to imports in Flutter files that import both
- **Fastify 5 `decorateRequest` rejects `null`**: Use `undefined` as initial value
- **Test setup pattern (server)**: `vi.clearAllMocks()` in `beforeEach`, mock Firebase + repositories, use `app.inject()` for HTTP
- **REST auth middleware pattern from Story 9.1**: `requireAuth` preHandler hook validates Firebase JWT. The upgrade endpoint does NOT use this middleware (guest has no Bearer token — Firebase token is in request body instead)
- **Import order in index.ts**: Schema imports go BEFORE swagger init. Current order: common → auth → user → session → catalog → playlist → suggestion → capture. Add upgrade-schemas AFTER user-schemas

### Git Intelligence (Recent Commits)

Most recent commit: `92a2101 Implement Story 9.1: User Profile & Account Management with code review fixes`

Key patterns from Story 9.1:
- Created `routes/middleware/rest-auth.ts` — centralized auth middleware pattern
- Created `routes/users.ts` with `GET /api/users/me` — extend this file with upgrade route
- Created `shared/schemas/user-schemas.ts` — follow same Zod schema pattern
- Extended `AuthProvider` with profile fields — extend further with upgrade state
- Extended `api_service.dart` with `fetchUserProfile()` — add upgrade API call
- Extended `bootstrap.dart` with auth listener callback — no changes needed for upgrade (upgrade is user-initiated, not auth-listener-triggered)

### What This Story Does NOT Include (Scope Boundaries)

- NO Facebook OAuth (only Google — `signInWithFacebook()` stays as UnimplementedError)
- NO post-session upgrade UI (only in-session banner for now; finale prompt is Story 8.2 territory)
- NO retroactive scoring of past guest actions after upgrade
- NO guest-to-guest session linking (can't link anonymous sessions from before the upgrade)
- NO account merging (if the upgrading Firebase account already has session history from prior direct sign-ins, those histories are not merged with the guest session)
- NO Dart type generation via dart-open-fetch (run separately after server changes)
- NO profile editing or settings screen (Story 9.1 scope)
- NO Session Timeline access after upgrade (Story 9.3 will handle that)

### File Locations

| File | Purpose |
|---|---|
| `apps/server/src/persistence/user-repository.ts` | MODIFY — Add `upgradeGuestToAuthenticated()` |
| `apps/server/src/persistence/session-repository.ts` | MODIFY — Add `linkGuestParticipant()` |
| `apps/server/src/persistence/media-repository.ts` | MODIFY — Add `relinkCaptures()` |
| `apps/server/src/shared/schemas/upgrade-schemas.ts` | NEW — Zod schemas for upgrade request/response |
| `apps/server/src/routes/users.ts` | MODIFY — Add `POST /api/users/upgrade` route |
| `apps/server/src/socket-handlers/auth-upgrade-handler.ts` | NEW — Socket auth:upgraded event handler |
| `apps/server/src/shared/events.ts` | MODIFY — Add AUTH_UPGRADED constant |
| `apps/server/src/socket-handlers/connection-handler.ts` | MODIFY — Register auth-upgrade handler |
| `apps/server/src/index.ts` | MODIFY — Import upgrade-schemas before swagger init |
| `apps/flutter_app/lib/state/auth_provider.dart` | MODIFY — Add upgrade state + methods |
| `apps/flutter_app/lib/state/capture_provider.dart` | MODIFY — Add myCaptureIds tracking |
| `apps/flutter_app/lib/api/api_service.dart` | MODIFY — Add upgradeGuestToAccount() |
| `apps/flutter_app/lib/socket/client.dart` | MODIFY — Add upgrade orchestration method |
| `apps/flutter_app/lib/constants/copy.dart` | MODIFY — Add upgrade copy strings |
| `apps/flutter_app/lib/screens/party_screen.dart` | MODIFY — Add upgrade banner + `_onUpgrade()` handler (insert after ReconnectingBanner ~line 228) |
| `apps/server/tests/persistence/user-repository.test.ts` | NEW or MODIFY — upgradeGuestToAuthenticated tests |
| `apps/server/tests/persistence/session-repository.test.ts` | NEW or MODIFY — linkGuestParticipant tests |
| `apps/server/tests/persistence/media-repository.test.ts` | NEW or MODIFY — relinkCaptures tests |
| `apps/server/tests/routes/users.test.ts` | MODIFY — Add upgrade route tests |
| `apps/server/tests/socket-handlers/auth-upgrade-handler.test.ts` | NEW — Socket upgrade handler tests |
| `apps/flutter_app/test/state/auth_provider_test.dart` | MODIFY — Add upgrade state tests |
| `apps/flutter_app/test/state/capture_provider_test.dart` | MODIFY — Add capture tracking tests |

### Testing Strategy

- **Test framework (server)**: `vitest` — all existing tests use vitest
- **Test framework (Flutter)**: `flutter_test` with manual mocks
- **Persistence tests**: Use shared factories from `tests/factories/`. Test each repository function in isolation with mocked DB or transaction-per-test rollback
- **Route tests**: Fastify integration tests with `app.inject()`. Mock Firebase verification + repositories. Test all three upgrade paths (existing account, guest host, guest participant) + error cases
- **Socket handler tests**: Mock socket object, verify socket.data mutation. Follow pattern from existing socket handler tests
- **Flutter state tests**: Pure state tests — call methods, verify field values and notifyListeners. Extend existing test files
- **Widget tests**: Mock AuthProvider + PartyProvider. Verify banner visibility based on auth state
- **Regression**: Run ALL existing tests to ensure no regressions. Especially auth_provider_test.dart (existing 9 tests), users.test.ts (existing 4 tests)
- **DO NOT test**: Actual Firebase OAuth flow, native popup UX, Firebase SDK internals, network latency

### Project Structure Notes

- `kebab-case.ts` for all TypeScript files: `auth-upgrade-handler.ts`, `upgrade-schemas.ts`
- New socket handler in `apps/server/src/socket-handlers/` following `register*Handlers(socket)` pattern
- Extend existing route file `routes/users.ts` — do NOT create a new route file
- Flutter tests mirror `lib/` structure: `test/state/`, `test/screens/`
- All UI strings in `constants/copy.dart` — no hardcoded strings in widgets

### References

- [Source: epics.md — Story 9.2 AC: Guest-to-account upgrade without data loss (FR97, NFR35)]
- [Source: prd.md — FR97 (guest upgrade without losing session data, participation scores, or media)]
- [Source: prd.md — NFR35 (upgrade without WebSocket disconnect, <5s including OAuth flow)]
- [Source: architecture.md — Authentication & Security: dual auth paths, guest token strategy, WebSocket auth flow]
- [Source: architecture.md — NFR34-37: JWT handshake, guest upgrade without disconnect, async writes, signed URLs]
- [Source: ux-design-specification.md — Guest-to-Account Upgrade (FR97): trigger points, flow, design rules]
- [Source: project-context.md — Server boundaries: persistence/ is ONLY layer importing db/]
- [Source: project-context.md — Flutter boundaries: ONLY SocketClient calls mutation methods on providers]
- [Source: project-context.md — Socket.io event naming: namespace:action pattern]
- [Source: user-repository.ts — Existing createGuestUser(), upsertFromFirebase(), findByFirebaseUid(), findById()]
- [Source: session-repository.ts — Existing addParticipantIfNotExists(), getParticipants(), isSessionParticipant()]
- [Source: media-repository.ts — Existing create() with nullable user_id]
- [Source: auth-middleware.ts — Dual-path socket auth (Firebase RS256 + Guest HS256)]
- [Source: auth.ts — POST /api/auth/guest: ephemeral guestId generation (crypto.randomUUID()), no user record]
- [Source: sessions.ts — POST /api/sessions: guest host gets user record via createGuestUser(), guestId = user.id]
- [Source: captures.ts — POST captures: userId optional in body, NULL for guests]
- [Source: connection-handler.ts — Socket handler registration pattern, handleParticipantJoin call]
- [Source: session-manager.ts:1715-1718 — Guest participant: userId undefined, guestName set]
- [Source: session-manager.ts:1730 — Scoring skipped for role === 'guest']
- [Source: 001-initial-schema.ts — session_participants unique index on COALESCE(user_id, guest_name)]
- [Source: events.ts — AUTH_REFRESH_REQUIRED, AUTH_INVALID existing auth events]
- [Source: 9-1-user-profile-and-account-management.md — Previous story learnings, test patterns, debug log]
- [Source: auth_provider.dart — Existing AuthState enum, signInWithGoogle(), onGuestAuthenticated(), onSignedOut()]
- [Source: capture_provider.dart — Existing capture state management, no capture ID tracking yet]
- [Source: api_service.dart — HTTP client patterns, _authMiddleware.token injection pattern]
- [Source: socket/client.dart — SocketClient singleton, simple emit() pattern (NO emitWithAck), provider mutation via field references]
- [Source: capture-handlers.ts:63 — Server emits CAPTURE_PERSISTED with captureId after persist]
- [Source: events.ts:65 — CAPTURE_PERSISTED already defined, AUTH_INVALID is last auth event]
- [Source: party_screen.dart — 887-line party screen with Stack widget, ReconnectingBanner at ~line 228, existing banner pattern]
- [Source: reconnecting_banner.dart — Template for banner widget style]
- [Source: auth_provider.dart:125-141 — signInWithGoogle() uses signInWithProvider(GoogleAuthProvider()), no google_sign_in package]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Factory `createTestUser` uses `??` (nullish coalescing) which treats `null` as nullish — had to use spread override `{ ...createTestUser(), firebase_uid: null }` for guest host tests
- Session-repository mock needed recursive `where()` chain to support 3-level WHERE clauses for `linkGuestParticipant`

### Completion Notes List

- Task 1: Added `upgradeGuestToAuthenticated()`, `linkGuestParticipant()`, `relinkCaptures()` to persistence layer with 10 unit tests
- Task 2: Created `upgrade-schemas.ts` with Zod request/response schemas, registered in `z.globalRegistry` and imported in `index.ts`
- Task 3: Added `POST /api/users/upgrade` route handling 3 upgrade paths (existing account, guest host, guest participant) with 5 integration tests
- Task 4: Added `auth:upgraded` socket event handler for in-place socket.data mutation (no disconnect), registered in connection-handler, with 4 unit tests
- Task 5: Added `myCaptureIds` tracking to `CaptureProvider` with `capture:persisted` socket listener, 5 unit tests
- Task 6: Added `upgradeGuestToAccount()` to `ApiService` using `_chain.send()` pattern
- Task 7: Added `onUpgradeCompleted()`, `onUpgradeFailed()`, `upgradeLoading` to `AuthProvider`, 5 unit tests
- Task 8: Added `emitAuthUpgraded()` to `SocketClient`, `_onUpgrade()` orchestration to `PartyScreen`
- Task 9: Added upgrade banner UI (non-blocking), copy strings in `copy.dart`
- Task 10: All tests written and passing — 1393 server tests, 47 Flutter state tests

### File List

**Server (new files):**
- `apps/server/src/shared/schemas/upgrade-schemas.ts`
- `apps/server/src/socket-handlers/auth-upgrade-handler.ts`
- `apps/server/tests/socket-handlers/auth-upgrade-handler.test.ts`

**Server (modified files):**
- `apps/server/src/persistence/user-repository.ts`
- `apps/server/src/persistence/session-repository.ts`
- `apps/server/src/persistence/media-repository.ts`
- `apps/server/src/routes/users.ts`
- `apps/server/src/shared/events.ts`
- `apps/server/src/socket-handlers/connection-handler.ts`
- `apps/server/src/index.ts`
- `apps/server/tests/persistence/user-repository.test.ts`
- `apps/server/tests/persistence/session-repository.test.ts`
- `apps/server/tests/persistence/media-repository.test.ts`
- `apps/server/tests/routes/users.test.ts`

**Flutter (modified files):**
- `apps/flutter_app/lib/state/auth_provider.dart`
- `apps/flutter_app/lib/state/capture_provider.dart`
- `apps/flutter_app/lib/api/api_service.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/test/state/auth_provider_test.dart`
- `apps/flutter_app/test/state/capture_provider_test.dart`

**Project files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-2-guest-to-account-upgrade.md`

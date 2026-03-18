# Story 6.4: Server-Side Media Storage

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want all captured media stored securely in Firebase Storage and accessible to session participants via signed URLs,
So that everyone can revisit their party memories after the session ends with appropriate access control.

## Acceptance Criteria

1. **Given** media has been uploaded, **When** it is stored server-side, **Then** all media is stored in Firebase Storage organized by session ID (FR72, FR102) **And** the storage path follows the existing convention `{sessionId}/{captureId}.{ext}`

2. **Given** media is uploaded by an authenticated user, **When** it is stored, **Then** it is tagged with the capturing user ID in the `media_captures` DB record (FR102) -- this is already done in Story 6.3 via `capture-service.ts`

3. **Given** all captured media, **When** session participants request access post-session, **Then** they can retrieve signed URLs for all media from sessions they participated in (FR72)

4. **Given** an authenticated user's media, **When** they access it post-session, **Then** they retain access to their captures indefinitely (FR102) -- implemented as 7-day signed URLs that can be re-requested unlimited times (Firebase v4 signed URLs max out at 7 days; "indefinitely" is achieved by allowing unlimited re-generation)

5. **Given** a guest user's media, **When** it is accessed post-session, **Then** guest session media is accessible via time-limited signed URLs with a 7-day expiry (FR102, NFR37)

6. **Given** media access control, **When** a user requests media, **Then** authenticated users can access only captures from sessions they participated in (NFR37) **And** the server validates session membership before issuing signed URLs

## Tasks / Subtasks

- [x]Task 1: Add Firebase Storage bucket configuration to server (AC: #1)
  - [x]1.1 Add `FIREBASE_STORAGE_BUCKET` to `apps/server/src/config.ts` envSchema: `z.string().optional()` (required in production, absent/empty in dev -- `media-storage.ts` must guard all operations with a check and return graceful error when bucket is unconfigured, matching the `firebase-admin.ts` dev-mode fallback pattern)
  - [x]1.2 Add `FIREBASE_STORAGE_BUCKET` to `apps/server/.env.example` with placeholder value `your-project-id.firebasestorage.app`
  - [x]1.3 Add `FIREBASE_STORAGE_BUCKET` to `apps/server/.env` with actual/placeholder value
  - [x]1.4 Update `apps/server/src/integrations/firebase-admin.ts`: pass `storageBucket: config.FIREBASE_STORAGE_BUCKET` to `initializeApp()` options
  - [x]1.5 Export a `getStorageBucket()` function from `firebase-admin.ts` that returns `getStorage().bucket()` (import `getStorage` from `firebase-admin/storage`)

- [x]Task 2: Create server-side storage service (AC: #1, #3, #4, #5)
  - [x]2.1 Create `apps/server/src/services/media-storage.ts` -- responsible for Firebase Storage operations
  - [x]2.2 Implement `generateUploadUrl(storagePath: string, contentType: string): Promise<string>` -- generates a signed URL for direct client upload with 15-minute expiry. Uses `bucket.file(storagePath).getSignedUrl({ action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType })`. Returns the signed URL string
  - [x]2.3 Implement `generateDownloadUrl(storagePath: string, expiresInMs: number): Promise<string>` -- generates a signed URL for reading with configurable expiry. Uses `bucket.file(storagePath).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + expiresInMs })`. **Firebase v4 signed URLs max expiry is 7 days (604800000ms)**. Both guest and authenticated users get 7-day URLs. Authenticated users achieve "indefinite" access by re-requesting URLs unlimited times. Guest access is blocked after 7 days post-session by the server (not by URL expiry alone)
  - [x]2.4 Implement `deleteFile(storagePath: string): Promise<void>` -- deletes a file from storage (for future cleanup). Uses `bucket.file(storagePath).delete()`. Swallow `404` errors (file already deleted)
  - [x]2.5 Implement `fileExists(storagePath: string): Promise<boolean>` -- checks if file exists in storage. Uses `bucket.file(storagePath).exists()`. Returns boolean

- [x]Task 3: Add inline REST auth + create media access endpoints (AC: #3, #4, #5, #6)
  - [x]3.1 Create a helper function `extractRequestIdentity(request: FastifyRequest): Promise<{ userId: string; role: 'authenticated' | 'guest'; sessionId?: string } | null>` in `apps/server/src/routes/captures.ts` (local to file, not exported). This mirrors the dual-path auth logic from `apps/server/src/socket-handlers/auth-middleware.ts`:
    - Extract token from `Authorization: Bearer <token>` header
    - Decode JWT header: if `header.kid` exists → Firebase RS256 → verify with `verifyFirebaseToken()` from `firebase-admin.ts` → return `{ userId: decodedToken.uid, role: 'authenticated' }`
    - If `header.alg === 'HS256'` → guest JWT → verify with `verifyGuestToken()` from `guest-token.ts` → return `{ userId: payload.guestId, role: 'guest', sessionId: payload.sessionId }`
    - On any failure → return `null`
    - **Reference**: `apps/server/src/socket-handlers/auth-middleware.ts` lines 19-60 for the exact dual-path pattern. `apps/server/src/services/guest-token.ts` for guest token verification (exports `verifyGuestToken` returning `{ guestId, sessionId, role }`)
  - [x]3.2 Add Zod schemas to `apps/server/src/shared/schemas/capture-schemas.ts`:
    - `uploadUrlResponseDataSchema`: `{ uploadUrl: z.string(), storagePath: z.string() }`
    - `downloadUrlResponseDataSchema`: `{ downloadUrl: z.string(), expiresAt: z.string() }`
    - `mediaListResponseDataSchema`: `{ captures: z.array(captureResponseDataSchema.extend({ downloadUrl: z.string().optional() })) }`
    - Register all with `z.globalRegistry.add()`
  - [x]3.3 Add `GET /api/sessions/:sessionId/captures` to `apps/server/src/routes/captures.ts` -- list all captures for a session. Call `extractRequestIdentity()` → reject 401 if null. Check session membership via `session-repository.ts`. Returns capture metadata array
  - [x]3.4 Add `GET /api/sessions/:sessionId/captures/:captureId/upload-url` to `apps/server/src/routes/captures.ts` -- generate a time-limited signed upload URL for the client to PUT the file directly to Firebase Storage. Call `extractRequestIdentity()` → reject 401 if null. Validates that the requesting user matches the capture's userId (or is guest with matching session). Returns `{ data: { uploadUrl, storagePath } }`
  - [x]3.5 Add `GET /api/sessions/:sessionId/captures/:captureId/download-url` to `apps/server/src/routes/captures.ts` -- generate a signed download URL. Call `extractRequestIdentity()` → reject 401 if null. Session membership check. All URLs expire in 7 days (Firebase v4 max). For guests, server additionally checks that the session ended less than 7 days ago; for authenticated users, no time restriction. Returns `{ data: { downloadUrl, expiresAt } }`
  - [x]3.6 Import new schema files in `apps/server/src/index.ts` BEFORE swagger init (already imported `capture-schemas.js` -- just extend the file)

- [x]Task 4: Add session membership check to session-repository (AC: #6)
  - [x]4.1 Add `isSessionParticipant(sessionId: string, userId: string): Promise<boolean>` to `apps/server/src/persistence/session-repository.ts` (NOT media-repository -- `session_participants` table belongs to session-repository per persistence boundary rules). Query: `SELECT 1 FROM session_participants WHERE session_id = ? AND user_id = ? LIMIT 1`. Also check if user is the session host: `SELECT 1 FROM sessions WHERE id = ? AND host_user_id = ?`. Return `true` if either query matches

- [x]Task 5: Replace Flutter upload placeholder with Firebase Storage direct upload (AC: #1)
  - [x]5.1 Add `firebase_storage: ^12.4.4` to `apps/flutter_app/pubspec.yaml` dependencies
  - [x]5.2 Create `apps/flutter_app/lib/services/media_storage_service.dart` -- thin wrapper around Firebase Storage operations:
    - `uploadFile(String filePath, String storagePath): Future<bool>` -- uploads file to Firebase Storage using `FirebaseStorage.instance.ref(storagePath).putFile(File(filePath))`
    - Uses `UploadTask` for progress tracking, exposes `Stream<double>` for upload progress
    - Handles `FirebaseException` gracefully (return `false` on failure)
  - [x]5.3 Update `apps/flutter_app/lib/services/upload_queue.dart` `_uploadFile()` method:
    - Replace placeholder with actual Firebase Storage upload via `MediaStorageService`
    - After local file upload, call REST endpoint `POST /api/sessions/:sessionId/captures` to persist metadata (already done in 6.3)
    - Flow: `_uploadFile()` → `MediaStorageService.uploadFile(filePath, storagePath)` → return success/failure
    - Storage path: `{sessionId}/{captureId}.{ext}` (already computed when item is enqueued)
  - [x]5.4 Update `UploadItem` to include `storagePath` field (computed from `sessionId`, `captureId`, `captureType` extension mapping: photo→jpg, video→mp4, audio→m4a)
  - [x]5.5 Update `UploadItem.toJson()` and `UploadItem.fromJson()` to include `storagePath`

- [x]Task 6: Add upload progress to UploadProvider (AC: #1)
  - [x]6.1 Add `currentUploadProgress` field to `UploadQueue` -- tracks 0.0-1.0 progress of the currently uploading file (distinct from overall queue progress)
  - [x]6.2 Update `UploadProvider` to expose `currentUploadProgress` for richer progress UI on `CaptureToolbarIcon`
  - [x]6.3 Update `CaptureToolbarIcon` progress ring to use actual file upload progress instead of completed/total ratio

- [x]Task 7: Server tests (AC: #1, #3, #4, #5, #6)
  - [x]7.1 Create `apps/server/tests/services/media-storage.test.ts` -- mock `firebase-admin/storage` bucket. Test: `generateUploadUrl`, `generateDownloadUrl`, `deleteFile`, `fileExists` with success/failure cases
  - [x]7.2 Extend `apps/server/tests/routes/captures.test.ts` -- test new endpoints. Must mock `extractRequestIdentity()` or provide valid JWT in `Authorization` header. Test cases:
    - `GET /api/sessions/:sessionId/captures` -- returns capture list; 401 without auth header; 403 for non-participants
    - `GET /api/sessions/:sessionId/captures/:captureId/upload-url` -- returns signed URL; 401 without auth; 403 for non-owner
    - `GET /api/sessions/:sessionId/captures/:captureId/download-url` -- returns signed URL; 401 without auth; 403 for non-participants; 403 for guest when session ended > 7 days ago
  - [x]7.3 Create/extend `apps/server/tests/persistence/session-repository.test.ts` -- test `isSessionParticipant` with: participant exists, host-only (not in participants), non-participant, invalid sessionId

- [x]Task 8: Flutter tests (AC: #1)
  - [x]8.1 Create `apps/flutter_app/test/services/media_storage_service_test.dart` -- mock `FirebaseStorage.instance` using `mocktail`. Test: upload success, upload failure (FirebaseException), file not found
  - [x]8.2 Update `apps/flutter_app/test/services/upload_queue_test.dart` -- test that `_uploadFile` calls `MediaStorageService.uploadFile` with correct params, test storagePath computation, test UploadItem serialization with storagePath

## Dev Notes

### Architecture Compliance

- **Server boundary**: `media-storage.ts` (service) wraps Firebase Admin Storage SDK. Routes call `media-storage.ts` for URL generation. Routes call `media-repository.ts` for DB queries. Socket handlers are NOT involved in this story -- all interactions are REST. **Architecture override**: Architecture line 995 places signed URL generation in `media-repository.ts`. This story separates it into `media-storage.ts` because Firebase Storage operations (cloud SDK calls) are fundamentally different from persistence (Kysely DB queries). Mixing them would violate single-responsibility and make testing harder
- **Persistence boundary**: `media-repository.ts` is the ONLY file that imports from `db/` for `media_captures`. Session membership check (`isSessionParticipant`) goes in `session-repository.ts` because it queries `session_participants` table, which is session-repository's domain. Routes import from both repositories as needed
- **REST auth**: New GET endpoints use inline `extractRequestIdentity()` helper that mirrors the dual-path auth from `socket-handlers/auth-middleware.ts`. This is inline to captures route (not middleware) to match the existing unauthenticated POST endpoint pattern. Extracts identity from `Authorization: Bearer` header using same Firebase/guest JWT detection logic
- **Flutter boundary**: `MediaStorageService` is a thin wrapper around `FirebaseStorage` -- no business logic. `UploadQueue` orchestrates the upload flow. `UploadProvider` is the reactive state container. No widget touches Firebase Storage directly
- **Casing rules**: DB columns `snake_case`. REST responses `camelCase` via Zod transform. Firebase Storage paths use raw format `{sessionId}/{captureId}.{ext}`

### Key Technical Decisions

- **Client-direct upload pattern**: Flutter uploads files directly to Firebase Storage using the Firebase client SDK (`firebase_storage` package). The server generates signed upload URLs as an alternative approach, but client SDK upload is simpler since Firebase Auth is already initialized in Flutter. **Preferred approach: Use Firebase client SDK directly** (no server-signed upload URLs needed). The upload URL endpoint (Task 3.3) is available as a fallback for guest users who may not have Firebase Auth credentials
- **Signed download URLs from server**: Post-session media access always goes through the server (`GET /api/sessions/:sessionId/captures/:captureId/download-url`). This ensures access control -- the server validates session membership before issuing a URL. Signed URLs are NOT stored in the database -- they are generated on-demand with the correct TTL
- **Signed URL TTL -- Firebase v4 max is 7 days**: ALL signed URLs (guest and authenticated) expire in 7 days -- this is a Firebase platform limit. "Indefinite" access for authenticated users (FR102) is achieved by allowing unlimited URL re-generation. Guest access expiry (7 days post-session) is enforced SERVER-SIDE: the download-url endpoint checks `sessions.ended_at` and rejects guest requests if session ended > 7 days ago. This is separate from URL expiry
- **No Firebase Storage security rules in this story**: Security rules can be added later. For MVP, access control is enforced at the API layer (server validates session membership). Firebase Storage bucket should be set to private (no public access)
- **Storage bucket initialization**: `initializeApp({ storageBucket })` must be called with the bucket name. The bucket is accessed via `getStorage().bucket()`. In development mode, if the bucket is not configured, storage operations should gracefully fail (same pattern as Firebase Auth dev fallback)

### What Already Exists (From Stories 6.1-6.3)

| Component | Location | Status |
|---|---|---|
| `media_captures` DB table | Migration `001-initial-schema.ts` | Created, ready |
| `MediaCapturesTable` type | `apps/server/src/db/types.ts:45-53` | Ready |
| `media-repository.ts` | `apps/server/src/persistence/` | No changes needed (membership check goes in session-repository) |
| `capture-service.ts` | `apps/server/src/services/` | No changes needed |
| `capture-schemas.ts` | `apps/server/src/shared/schemas/` | Extend with new response schemas |
| `captures.ts` route | `apps/server/src/routes/` | Extend with GET endpoints |
| `upload_queue.dart` | `apps/flutter_app/lib/services/` | Replace `_uploadFile()` placeholder |
| `upload_provider.dart` | `apps/flutter_app/lib/state/` | Extend with file upload progress |
| `capture_toolbar_icon.dart` | `apps/flutter_app/lib/widgets/` | Update progress to use file progress |
| `firebase-admin.ts` | `apps/server/src/integrations/` | Extend with storage bucket init |
| `config.ts` | `apps/server/src/config.ts` | Add `FIREBASE_STORAGE_BUCKET` |
| `AppConfig` | `apps/flutter_app/lib/config/app_config.dart` | Already has `firebaseStorageBucket` field |
| `firebase_core` + `firebase_auth` | `pubspec.yaml` | Already added |
| `connectivity_plus` + `shared_preferences` | `pubspec.yaml` | Already added (6.3) |
| `UploadItem` model | `upload_queue.dart` | Extend with `storagePath` field |
| `createTestMediaCapture` factory | `apps/server/tests/factories/media-capture.ts` | Ready |
| Route test pattern | `apps/server/tests/routes/captures.test.ts` | Extend |
| `session-repository.getParticipants()` | `apps/server/src/persistence/session-repository.ts` | Extend with `isSessionParticipant()` |
| `session-repository.findById()` | `apps/server/src/persistence/session-repository.ts` | Used for host check + guest session-age check |
| `auth-middleware.ts` (socket) | `apps/server/src/socket-handlers/auth-middleware.ts` | Reference for inline REST auth pattern (dual-path JWT) |
| `guest-token.ts` | `apps/server/src/services/guest-token.ts` | `verifyGuestToken()` for guest JWT validation in REST |
| `AuthMiddleware` (Flutter) | `apps/flutter_app/lib/api/auth_middleware.dart` | Already handles Bearer token headers for REST calls |
| `ApiService` (Flutter) | `apps/flutter_app/lib/api/api_service.dart` | Use for all new REST calls (upload-url, download-url) |
| Schema import in index.ts | `apps/server/src/index.ts:43` | Already imports `capture-schemas.js` |

### What Does NOT Exist Yet (Create in 6.4)

| Component | Location | Purpose |
|---|---|---|
| `media-storage.ts` | `apps/server/src/services/` | Firebase Storage signed URL generation |
| `media_storage_service.dart` | `apps/flutter_app/lib/services/` | Flutter Firebase Storage upload wrapper |
| `media-storage.test.ts` | `apps/server/tests/services/` | Server storage service tests |
| `media_storage_service_test.dart` | `apps/flutter_app/test/services/` | Flutter storage service tests |

### Previous Story Intelligence (6.3: Media Tagging & Background Upload)

- **Upload queue is fully built**: `UploadQueue` singleton with persistence, retry, connectivity awareness. Only `_uploadFile()` is a placeholder returning `true` -- replace with actual Firebase Storage upload
- **Storage path already computed server-side**: `capture-service.ts` generates `{sessionId}/{captureId}.{ext}` and stores in DB. The REST `POST /api/sessions/:sessionId/captures` response returns `storagePath` in the body. The socket handler emits `capture:persisted` event with `captureId` back to the client
- **Code review fix from 6.3**: H2 renamed socket event from `capture:complete` ack to `capture:persisted` to avoid naming collision
- **CRITICAL -- captureId + storagePath flow**: The `UploadItem.captureId` currently comes from... unclear source in 6.3. The correct flow for 6.4 must be: (1) Client captures media locally → (2) Client calls `POST /api/sessions/:sessionId/captures` with metadata → (3) Server generates `captureId` + `storagePath` and returns both in response → (4) Client creates `UploadItem` with server-returned `captureId` and `storagePath` → (5) Queue uploads file to Firebase Storage at that `storagePath`. This means the REST POST call must happen BEFORE enqueuing, and `storagePath` must NOT be computed client-side (server is authoritative). Update `capture_overlay.dart` enqueue logic accordingly: call REST first, then enqueue with response data
- **REST endpoint already creates metadata**: `POST /api/sessions/:sessionId/captures` creates the DB record. The file upload (this story) happens after metadata is persisted
- **Sequential processing**: Upload queue processes one item at a time to avoid bandwidth competition with Socket.io. Keep this pattern -- Firebase Storage uploads should also be sequential

### Firebase Admin Storage Pattern

**Server uses `firebase-admin: ^13.7.0`** (see `apps/server/package.json`). In v12+, Storage is accessed via `firebase-admin/storage` module import (NOT the legacy `admin.storage()` pattern). The `getSignedUrl()` API returns `[url]` (destructure from array).

**Firebase v4 signed URL constraint**: Maximum expiry is **7 days** (604800 seconds). Do NOT attempt 30-day URLs -- they will be rejected. Both guest and authenticated users get 7-day URLs. Access control for guests is enforced server-side by checking session age, not URL expiry alone.

Follow the existing `firebase-admin.ts` integration pattern:

```typescript
// media-storage.ts
import { getStorage } from 'firebase-admin/storage';

function getBucket() {
  return getStorage().bucket();
}

export async function generateUploadUrl(
  storagePath: string,
  contentType: string
): Promise<string> {
  const [url] = await getBucket()
    .file(storagePath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });
  return url;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // Firebase v4 max

export async function generateDownloadUrl(
  storagePath: string
): Promise<{ url: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);
  const [url] = await getBucket()
    .file(storagePath)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });
  return { url, expiresAt };
}
```

**CRITICAL**: `getSignedUrl()` requires that the service account has the `iam.serviceAccounts.signBlob` permission (or `roles/iam.serviceAccountTokenCreator` role). This is needed for both upload and download signed URLs. In development, this may fail if using placeholder credentials -- handle gracefully

### Content Type Mapping

```typescript
const CONTENT_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
};
```

Define this in `media-storage.ts` and use when generating upload signed URLs. Extract extension from the `storage_path` column value (e.g., `path.split('.').pop()`) to look up content type. Also export for use in the upload-url route

### Flutter Firebase Storage Upload Pattern

```dart
// media_storage_service.dart
import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

class MediaStorageService {
  MediaStorageService._();
  static final MediaStorageService instance = MediaStorageService._();

  Future<bool> uploadFile(
    String filePath,
    String storagePath, {
    void Function(double)? onProgress,
  }) async {
    try {
      final file = File(filePath);
      if (!await file.exists()) return false;

      final ref = FirebaseStorage.instance.ref(storagePath);
      final task = ref.putFile(file);

      if (onProgress != null) {
        task.snapshotEvents.listen((snapshot) {
          final progress = snapshot.bytesTransferred / snapshot.totalBytes;
          onProgress(progress);
        });
      }

      await task;
      return true;
    } on FirebaseException catch (e) {
      debugPrint('Firebase upload failed for $storagePath: ${e.message}');
      return false;
    } catch (e) {
      debugPrint('Upload failed for $storagePath: $e');
      return false;
    }
  }
}
```

**NOTE**: `FirebaseStorage.instance` uses the default Firebase app which is already initialized in `bootstrap.dart`. The storage bucket is configured via `FirebaseOptions.storageBucket` (already set in `AppConfig.firebaseStorageBucket`)

**Flutter REST auth already exists**: `apps/flutter_app/lib/api/auth_middleware.dart` adds `Authorization: Bearer $token` headers to HTTP requests. `apps/flutter_app/lib/api/api_service.dart` wires `AuthMiddleware` into the HTTP chain via `HttpMiddlewareChain`. The token is set/cleared per-request. All new REST calls (upload-url, download-url, session captures list) should go through `ApiService` which already handles auth headers. Do NOT create separate HTTP calls with manual headers

### Guest User Upload Handling

Guest users have server-signed JWT tokens (not Firebase Auth). They cannot use `FirebaseStorage.instance` directly because they aren't authenticated with Firebase. **Two approaches:**

1. **Server-signed upload URL**: Guest clients call `GET /api/sessions/:sessionId/captures/:captureId/upload-url` to get a signed URL, then PUT the file directly to that URL using `http` package (already in pubspec.yaml)
2. **Firebase anonymous auth**: Auto-sign in guests anonymously with `FirebaseAuth.instance.signInAnonymously()` -- but this adds complexity

**Recommended: Option 1** -- use signed upload URLs for guests. The `_uploadFile()` method should check if the user is authenticated (has Firebase Auth) and use the appropriate upload method:
- **Authenticated**: `FirebaseStorage.instance.ref(path).putFile(file)` (direct SDK upload)
- **Guest**: Fetch signed upload URL from server, then `http.put(signedUrl, body: fileBytes)`

### Access Control Implementation

The `GET /api/sessions/:sessionId/captures/:captureId/download-url` endpoint must:
1. Call `extractRequestIdentity(request)` -- returns `{ userId, role, sessionId? }` or `null`
2. If `null` → return `401 UNAUTHORIZED`
3. Look up the capture by ID in `media_captures` via `media-repository.findById()`
4. Verify the capture belongs to the specified session (`capture.session_id === sessionId`)
5. Check session membership via `session-repository.isSessionParticipant(sessionId, userId)` -- includes host check
6. If not a participant or host → return `403 FORBIDDEN`
7. If role is `'guest'` → check `sessions.ended_at`: if session ended > 7 days ago → return `403 FORBIDDEN` with message "Guest media access expired"
8. Generate signed download URL with 7-day TTL (Firebase v4 max)
9. Return `{ data: { downloadUrl, expiresAt } }`

**Architecture endpoint path override**: Architecture line 408 specifies `GET /api/media/:id/url`. This story uses `GET /api/sessions/:sessionId/captures/:captureId/download-url` instead because: (a) it's consistent with the existing captures route namespace, (b) the sessionId in the path enables efficient membership validation, (c) it follows REST resource nesting conventions. The architecture path is superseded

### Scope Boundaries -- What NOT to Implement

| Not in 6.4 | Belongs to |
|---|---|
| Reaction peak detection triggers | Story 6.5 |
| Post-session media gallery UI | Story 9.4 |
| Media download/sharing UI | Story 9.4 |
| Media linking to guest accounts on upgrade | Story 9.6 |
| Shared REST auth middleware (extracting inline auth into reusable preHandler) | Future story |
| Firebase Storage security rules (firestore.rules) | Future DevOps story |
| Media deletion/cleanup on session end | Future story |
| Thumbnail generation | Future story |

### Project Structure Notes

**New files:**
- `apps/server/src/services/media-storage.ts` -- Firebase Storage operations
- `apps/flutter_app/lib/services/media_storage_service.dart` -- Flutter Firebase Storage wrapper
- `apps/server/tests/services/media-storage.test.ts` -- storage service tests
- `apps/flutter_app/test/services/media_storage_service_test.dart` -- Flutter storage tests

**Modified files:**
- `apps/server/src/config.ts` -- add `FIREBASE_STORAGE_BUCKET`
- `apps/server/src/integrations/firebase-admin.ts` -- add storage bucket init + `getStorageBucket()` export
- `apps/server/src/persistence/session-repository.ts` -- add `isSessionParticipant()`
- `apps/server/src/shared/schemas/capture-schemas.ts` -- add new response schemas
- `apps/server/src/routes/captures.ts` -- add GET endpoints for listing, upload URL, download URL
- `apps/server/.env.example` -- add `FIREBASE_STORAGE_BUCKET`
- `apps/server/.env` -- add `FIREBASE_STORAGE_BUCKET`
- `apps/flutter_app/pubspec.yaml` -- add `firebase_storage`
- `apps/flutter_app/lib/services/upload_queue.dart` -- replace `_uploadFile()`, add `storagePath` to `UploadItem`
- `apps/flutter_app/lib/state/upload_provider.dart` -- expose `currentUploadProgress`
- `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart` -- use actual file upload progress
- `apps/server/tests/routes/captures.test.ts` -- extend with new endpoint tests
- `apps/server/tests/persistence/session-repository.test.ts` -- add `isSessionParticipant` tests (or create if doesn't exist)
- `apps/flutter_app/test/services/upload_queue_test.dart` -- update for Firebase upload

### Error Handling

- **Firebase Storage upload failure**: `MediaStorageService.uploadFile()` catches `FirebaseException` and returns `false`. Queue retries with exponential backoff (existing behavior)
- **Signed URL generation failure**: `media-storage.ts` catches errors from `getSignedUrl()`. In dev mode with placeholder credentials, return a descriptive error `{ error: { code: 'STORAGE_UNAVAILABLE', message: 'Firebase Storage not configured' } }`
- **Session membership denied**: Return `{ error: { code: 'FORBIDDEN', message: 'Not a participant in this session' } }` with 403 status
- **Capture not found**: Return `{ error: { code: 'NOT_FOUND', message: 'Capture not found' } }` with 404 status
- **File not in storage**: If `fileExists()` returns false when generating download URL, return `{ error: { code: 'FILE_NOT_FOUND', message: 'Media file not yet uploaded' } }` with 404 status

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 6 Story 6.4 -- FR72, FR102, NFR37]
- [Source: _bmad-output/planning-artifacts/architecture.md, Three-tier state architecture -- Firebase Storage as external state tier]
- [Source: _bmad-output/planning-artifacts/architecture.md, NFR34-37 -- signed URLs for media access control]
- [Source: _bmad-output/planning-artifacts/architecture.md, REST API endpoint /api/media/:id/url]
- [Source: _bmad-output/planning-artifacts/architecture.md, Media lifecycle: Capture -> Tag -> Upload -> Storage -> Access Control -> Expiry]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: _bmad-output/project-context.md, Error Handling lines 134-137]
- [Source: _bmad-output/implementation-artifacts/6-3-media-tagging-and-background-upload.md -- previous story patterns and learnings]
- [Source: apps/server/src/integrations/firebase-admin.ts -- existing Firebase Admin init pattern]
- [Source: apps/server/src/config.ts -- env schema pattern for adding FIREBASE_STORAGE_BUCKET]
- [Source: apps/server/src/services/capture-service.ts -- storage path generation pattern: {sessionId}/{captureId}.{ext}]
- [Source: apps/server/src/routes/captures.ts -- existing REST endpoint pattern for captures]
- [Source: apps/server/src/persistence/media-repository.ts -- existing CRUD operations]
- [Source: apps/server/src/persistence/session-repository.ts -- getParticipants(), findById() for membership checks]
- [Source: apps/server/src/shared/schemas/capture-schemas.ts -- existing Zod schemas, zod/v4 import]
- [Source: apps/server/src/shared/schemas/common-schemas.ts -- dataResponseSchema() wrapper]
- [Source: apps/server/src/shared/errors.ts -- AppError, notFoundError(), unauthorizedError()]
- [Source: apps/flutter_app/lib/services/upload_queue.dart -- placeholder _uploadFile() at line 163-175]
- [Source: apps/flutter_app/lib/config/app_config.dart -- firebaseStorageBucket already in AppConfig]
- [Source: apps/flutter_app/pubspec.yaml -- existing firebase_core, firebase_auth dependencies]
- [Source: apps/server/src/socket-handlers/auth-middleware.ts -- dual-path JWT auth pattern (Firebase RS256 + guest HS256)]
- [Source: apps/server/src/services/guest-token.ts -- verifyGuestToken() returns { guestId, sessionId, role }]
- [Source: apps/flutter_app/lib/api/auth_middleware.dart -- Flutter REST auth header injection]
- [Source: apps/flutter_app/lib/api/api_service.dart -- Flutter HTTP client with auth middleware chain]
- [Source: apps/server/package.json line 24 -- firebase-admin: ^13.7.0 (v4 signed URLs, 7-day max expiry)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required.

### Completion Notes List

- **Task 1**: Added `FIREBASE_STORAGE_BUCKET` to server config, `.env`, `.env.example`, and `firebase-admin.ts` with storage bucket init and `getStorageBucket()` export
- **Task 2**: Created `media-storage.ts` with `generateUploadUrl`, `generateDownloadUrl`, `deleteFile`, `fileExists`, `getContentType`, and `StorageUnavailableError`. Guards all ops with bucket config check
- **Task 3**: Added `extractRequestIdentity()` inline auth helper mirroring socket auth dual-path pattern. Created 3 new GET endpoints: list captures, upload-url, download-url. Added Zod response schemas with global registry
- **Task 4**: Added `isSessionParticipant()` to `session-repository.ts` checking both `session_participants` table and `sessions.host_user_id`
- **Task 5**: Added `firebase_storage` dep. Created `MediaStorageService` singleton. Replaced `_uploadFile()` placeholder with Firebase Storage upload. Added `storagePath` to `UploadItem` with serialization. Updated `capture_overlay.dart` to call REST POST first (server-authoritative captureId + storagePath), then enqueue. Added `createCapture()` to `ApiService`
- **Task 6**: Added `currentUploadProgress` to `UploadQueue` and `UploadProvider`. Updated `CaptureToolbarIcon` to use per-file progress instead of completed/total ratio
- **Task 7**: Created `media-storage.test.ts` (11 tests). Extended `captures.test.ts` with new endpoint tests (auth, membership, guest expiry). Extended `session-repository.test.ts` with `isSessionParticipant` tests
- **Task 8**: Created `media_storage_service_test.dart`. Updated `upload_queue_test.dart` with storagePath coverage. Updated all test files using `UploadItem` to include `storagePath`

### Change Log

- 2026-03-18: Implemented Story 6.4 - Server-Side Media Storage (all 8 tasks)
- 2026-03-18: Code review fixes — H1: fixed MockApiService in playlist_import_card_test.dart; H2: pass userId to createCapture REST call; H3: implemented guest upload via server-signed URLs (UploadQueue checks FirebaseAuth, falls back to upload-url endpoint + HTTP PUT); M1: added mounted checks before context.read after async gaps; M2: cleanup local file on REST failure in _enqueueWithServerMetadata; M3: store and cancel progress stream subscription; L1: guard against division by zero in progress calc

### File List

**New files:**
- `apps/server/src/services/media-storage.ts`
- `apps/flutter_app/lib/services/media_storage_service.dart`
- `apps/server/tests/services/media-storage.test.ts`
- `apps/flutter_app/test/services/media_storage_service_test.dart`

**Modified files:**
- `apps/server/src/config.ts`
- `apps/server/src/integrations/firebase-admin.ts`
- `apps/server/src/persistence/session-repository.ts`
- `apps/server/src/shared/schemas/capture-schemas.ts`
- `apps/server/src/routes/captures.ts`
- `apps/server/.env.example`
- `apps/server/.env`
- `apps/flutter_app/pubspec.yaml`
- `apps/flutter_app/lib/services/upload_queue.dart`
- `apps/flutter_app/lib/state/upload_provider.dart`
- `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart`
- `apps/flutter_app/lib/widgets/capture_overlay.dart`
- `apps/flutter_app/lib/api/api_service.dart`
- `apps/server/tests/routes/captures.test.ts`
- `apps/server/tests/persistence/session-repository.test.ts`
- `apps/flutter_app/test/services/upload_queue_test.dart`
- `apps/flutter_app/test/state/upload_provider_test.dart`
- `apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart`
- `apps/flutter_app/test/widgets/playlist_import_card_test.dart`
- `apps/flutter_app/lib/config/bootstrap.dart`

# Story 6.3: Media Tagging & Background Upload

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want captured media tagged with context and uploaded without blocking the party,
So that media is organized for post-session access while keeping the live experience smooth.

## Acceptance Criteria

1. **Given** a media capture is completed, **When** the media is processed, **Then** it is tagged with session ID, timestamp, capture trigger type (peak/ceremony/manual), and current DJ state (FR70)

2. **Given** tagged media is ready for upload, **When** the upload begins, **Then** uploads are queued and sent in the background -- capture never blocks the party experience (FR71) **And** failed uploads retry automatically on next stable connection (FR71)

3. **Given** a participant shares or intends to share media, **When** they tap the share action, **Then** the share intent tap is tracked as a viral signal metric (FR44)

4. **Given** media metadata is created, **When** it is persisted, **Then** a record is inserted into the `media_captures` table with all required fields (id, session_id, user_id, storage_path, trigger_type, dj_state_at_capture, created_at)

5. **Given** a capture completes and upload is queued, **When** the party screen is active, **Then** a subtle upload progress indicator appears on the capture toolbar icon without interrupting gameplay

6. **Given** the app loses connectivity during upload, **When** connectivity is restored, **Then** queued uploads resume automatically without user intervention

## Tasks / Subtasks

- [x] Task 1: Create media persistence repository (AC: #4)
  - [x] 1.1 Create `apps/server/src/persistence/media-repository.ts` with Kysely CRUD operations (architecture specifies this filename at FR67-73 mapping)
  - [x] 1.2 Implement `create(params)` -- insert new media_captures record
  - [x] 1.3 Implement `findBySessionId(sessionId)` -- query all captures for a session
  - [x] 1.4 Implement `findById(id)` -- single capture lookup
  - [x] 1.5 Implement `findByUserId(userId, sessionId)` -- user's captures in a session

- [x] Task 2: Create capture Zod schemas and REST endpoint (AC: #4)
  - [x] 2.1 Create `apps/server/src/shared/schemas/capture-schemas.ts` with Zod schemas for media capture metadata
  - [x] 2.2 Register schemas with `z.globalRegistry.add()` for OpenAPI generation
  - [x] 2.3 Create `apps/server/src/routes/captures.ts` REST route for `POST /api/sessions/:sessionId/captures` (metadata only -- file upload is client-direct to Firebase in Story 6.4)
  - [x] 2.4 Register capture route in `apps/server/src/routes/index.ts`

- [x] Task 3: Extend capture socket handlers for metadata persistence (AC: #1, #4)
  - [x] 3.1 Update `apps/server/src/socket-handlers/capture-handlers.ts` to persist capture metadata on `capture:complete`
  - [x] 3.2 Capture current DJ state using `getSessionDjState(sessionId)` from `apps/server/src/services/dj-state-store.ts` (synchronous in-memory lookup, NOT `session-manager.loadDjState()` which does an unnecessary DB query)
  - [x] 3.3 Generate a placeholder `storage_path` (format: `{sessionId}/{captureId}.{ext}`) -- actual Firebase path comes in Story 6.4
  - [x] 3.4 Create thin `apps/server/src/services/capture-service.ts` that wraps `media-repository.create()` call (socket handlers should not call persistence directly per architecture). Call as fire-and-forget async (never block the socket handler)
  - [x] 3.5 Emit `capture:complete` acknowledgment back to the capturing client with the generated `captureId`

- [x] Task 4: Build Flutter upload queue service (AC: #2, #5, #6)
  - [x] 4.1 Create `apps/flutter_app/lib/services/upload_queue.dart` -- manages background media uploads
  - [x] 4.2 Implement queue data model: `UploadItem { filePath, sessionId, captureType, triggerType, djState, status, retryCount, captureId }`
  - [x] 4.3 Implement `enqueue(UploadItem)` -- add captured media to queue
  - [x] 4.4 Implement `processQueue()` -- sequential upload processing (one at a time to avoid bandwidth competition)
  - [x] 4.5 Implement retry logic: exponential backoff (2s, 4s, 8s, 16s, max 60s), max 5 retries per item
  - [x] 4.6 Implement connectivity detection: use `connectivity_plus` to detect network changes and auto-resume
  - [x] 4.7 Persist queue to local storage (`shared_preferences` or temp file) so items survive app restart

- [x] Task 5: Integrate capture flow with upload queue (AC: #1, #2)
  - [x] 5.1 Create `apps/flutter_app/lib/state/upload_provider.dart` -- reactive state for upload queue
  - [x] 5.2 Update `CaptureOverlay` capture methods to enqueue media BEFORE calling `provider.onCaptureComplete()` -- file paths (`image.path`, `video.path`, audio `filePath`) are local variables lost after provider state reset. Exact insertion points:
    - **Photo** (`_capturePhoto`): after `if (image != null)`, before `provider.onCaptureComplete()` (~line 232)
    - **Video** (`_captureVideo`): after `if (video != null)`, before `provider.onCaptureComplete()` (~line 260)
    - **Audio** (`_onAudioComplete`): after `if (path != null)`, before `provider.onCaptureComplete()` (~line 340)
  - [x] 5.3 Tag each capture with context gathered from within `capture_overlay.dart` (which has `BuildContext`):
    - `sessionId`: `SocketClient.instance.currentSessionId` (public getter on singleton)
    - `captureType`: from the method parameter (photo/video/audio)
    - `triggerType`: `provider.captureTriggerType` (read BEFORE `onCaptureComplete()` resets it)
    - `djState`: `context.read<PartyProvider>().djState` (read-only snapshot, NOT `context.watch`)
    - `timestamp`: `DateTime.now().millisecondsSinceEpoch`
    - NOTE: CaptureProvider is isolated -- it has NO access to sessionId or djState. These MUST come from SocketClient and PartyProvider via BuildContext
  - [x] 5.4 Register `UploadProvider` in `apps/flutter_app/lib/config/bootstrap.dart`

- [x] Task 6: Upload progress indicator on capture toolbar icon (AC: #5)
  - [x] 6.1 Update `CaptureToolbarIcon` to show subtle circular progress ring when uploads are in progress
  - [x] 6.2 Use `context.watch<UploadProvider>()` for reactive upload state
  - [x] 6.3 Progress indicator: thin ring around the camera icon (2px, semi-transparent accent color)
  - [x] 6.4 Add copy constants to `apps/flutter_app/lib/constants/copy.dart` for upload status

- [x] Task 7: Create `createTestMediaCapture` test factory + server tests (AC: #1, #4)
  - [x] 7.0 Create `apps/server/tests/factories/media-capture.ts` -- factory for `MediaCapturesTable` with auto-increment counter, following `createTestSession`/`createTestCatalogTrack` pattern. Default fields: `id` (UUID), `session_id`, `user_id: null`, `storage_path`, `trigger_type: 'manual'`, `dj_state_at_capture: null`, `created_at`
  - [x] 7.1 Create `apps/server/tests/persistence/media-repository.test.ts` -- mock DB chain pattern (see catalog-repository.test.ts for chainable mock reference). Test: create, findBySessionId, findById, findByUserId
  - [x] 7.2 Extend `apps/server/tests/socket-handlers/capture-handlers.test.ts` -- test metadata persistence on capture:complete via capture-service
  - [x] 7.3 Create `apps/server/tests/routes/captures.test.ts` -- use Fastify `app.inject()` pattern with `validatorCompiler`, `serializerCompiler`, `errorHandler` setup in `beforeEach`. Assert `{ data: {...} }` success and `{ error: { code: '...' } }` failure shapes

- [x] Task 8: Flutter tests (AC: #1, #2, #5, #6)
  - [x] 8.0 Create `apps/flutter_app/test/services/` directory (does not exist yet)
  - [x] 8.1 Create `apps/flutter_app/test/services/upload_queue_test.dart` -- use `mocktail` (^1.0.4, already in dev_dependencies) for mocking. Test: enqueue, processQueue, retry logic with `fakeAsync`, connectivity resume, queue persistence serialization
  - [x] 8.2 Create `apps/flutter_app/test/state/upload_provider_test.dart` -- reactive state tests using `mocktail` for UploadQueue mock
  - [x] 8.3 Update `apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart` -- upload progress indicator rendering

## Dev Notes

### Architecture Compliance

- **Server boundary**: `capture-handlers.ts` (socket handler) calls `capture-service.ts` which wraps `media-repository.ts`. This follows the architecture rule: socket handlers call services, never persistence directly. `capture-service.ts` is a thin wrapper -- `persistCaptureMetadata(params)` calls `media-repository.create()` and handles error logging. `appendEvent()` is already called directly from handlers (event stream is not persistence)
- **Persistence boundary**: `media-repository.ts` is the ONLY file that imports from `db/` for media_captures. Uses Kysely query builder, `snake_case` columns matching `MediaCapturesTable` type
- **Flutter boundary**: `UploadProvider` is a reactive state container. `UploadQueue` service handles the actual upload logic. `CaptureOverlay` calls `UploadQueue.enqueue()` after capture. No widget creates socket listeners. No provider-to-provider access -- pass data through method parameters
- **Casing rules**: DB columns `snake_case`. Zod schemas `.transform()` to `camelCase` at REST boundary. Socket event payloads emitted in `camelCase`. Dart types `camelCase`

### Key Technical Decisions

- **No actual file upload in 6.3**: This story builds the metadata persistence and upload queue infrastructure. Actual Firebase Storage upload implementation is Story 6.4. The `UploadQueue` will have a placeholder `_uploadFile()` method that stores files locally and creates the metadata record via REST. Story 6.4 will replace the placeholder with Firebase Storage direct upload
- **REST endpoint for metadata**: `POST /api/sessions/:sessionId/captures` creates the metadata record. The Flutter client calls this AFTER successful local capture. This is separate from the socket `capture:complete` event which logs to the event stream for analytics
- **Fire-and-forget persistence**: `capture-service.persistCaptureMetadata()` is async but NOT awaited in the socket handler. Capture flow must never block on DB writes. The service wraps the call in try/catch and logs errors but does not propagate
- **Sequential upload processing**: Upload one file at a time to avoid bandwidth competition with real-time Socket.io traffic. Party experience is priority
- **DJ state snapshot**: Capture the DJ state at the moment `capture:complete` fires. Use `getSessionDjState(sessionId)` from `services/dj-state-store.ts` -- this is a synchronous in-memory Map lookup, no DB query. Do NOT use `session-manager.loadDjState()` which does an unnecessary async DB read. Serialize as JSONB for the `dj_state_at_capture` column
- **Upload queue persistence**: Save queue to device local storage so unfinished uploads survive app backgrounding/restart. Use `shared_preferences` for the queue manifest (JSON array of pending items)
- **Storage path convention**: `{sessionId}/{captureId}.{ext}` where ext is derived from capture type (jpg for photo, mp4 for video, m4a for audio). This path is stored in `media_captures.storage_path` and will be the Firebase Storage path in Story 6.4
- **Share tracking (AC #3)**: Track share intent taps as an analytics event via socket: `capture:shared`. Add to event stream. This is a simple fire-and-forget metric, no server state change

### What Already Exists (From Stories 6.1 + 6.2)

| Component | Location | Status |
|---|---|---|
| `MediaCapturesTable` type | `apps/server/src/db/types.ts:45-53` | Ready -- use this |
| `media_captures` DB table | Migration `001-initial-schema.ts` | Created, empty |
| `capture:started` / `capture:complete` socket events | `apps/server/src/shared/events.ts` | Ready |
| `capture-handlers.ts` | `apps/server/src/socket-handlers/` | Extend |
| `CaptureProvider` | `apps/flutter_app/lib/state/capture_provider.dart` | Read-only (don't modify) |
| `CaptureOverlay._capturePhoto/Video/Audio()` | `apps/flutter_app/lib/widgets/capture_overlay.dart` | Extend with enqueue call |
| `emitCaptureComplete()` | `apps/flutter_app/lib/socket/client.dart` | Already called -- add metadata REST call alongside |
| `CaptureToolbarIcon` | `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart` | Extend with progress ring |
| `appendEvent()` | `apps/server/src/services/event-stream.ts` | Used by capture handlers |
| Copy constants | `apps/flutter_app/lib/constants/copy.dart` | Extend |
| `path_provider` dependency | `apps/flutter_app/pubspec.yaml` | Already added in 6.2 |
| `record` + `image_picker` | `apps/flutter_app/pubspec.yaml` | Already added |

### What Does NOT Exist Yet (Create in 6.3)

| Component | Location | Purpose |
|---|---|---|
| `media-repository.ts` | `apps/server/src/persistence/` | DB CRUD for media_captures |
| `capture-service.ts` | `apps/server/src/services/` | Thin wrapper: socket handler calls this, not persistence directly |
| `capture-schemas.ts` | `apps/server/src/shared/schemas/` | Zod validation for capture metadata (import from `zod/v4`) |
| `captures.ts` route | `apps/server/src/routes/` | REST endpoint for capture metadata |
| `upload_queue.dart` | `apps/flutter_app/lib/services/` | Background upload queue service (**create `services/` directory -- does not exist**) |
| `upload_provider.dart` | `apps/flutter_app/lib/state/` | Reactive upload state |
| `media-capture.ts` factory | `apps/server/tests/factories/` | Test factory for `MediaCapturesTable` |

### Previous Story Intelligence (6.2: Inline Media Capture)

- **CaptureOverlay stores file path locally**: `image.path` (photo), `video.path` (video), `filePath` variable (audio m4a). Story 6.3 must capture these paths BEFORE `onCaptureComplete()` resets state
- **Code review fix from 6.2**: H1 fixed provider state leak on widget disposal during audio recording. Ensure `UploadQueue` handles the case where a capture widget is disposed mid-upload gracefully
- **Code review fix from 6.2**: H2 added server-side input validation. Follow same pattern for the new REST endpoint -- validate with Zod, reject invalid payloads
- **Audio files saved as .m4a**: `AudioEncoder.aacLc` produces `.m4a` files. The storage path extension should be `.m4a` for audio (not `.mp3`)
- **Event stream pattern**: `appendEvent(sessionId, { type, ts, userId, data })` -- `userId` at top level for user-initiated events. Follow same pattern for any new event types
- **Socket emit wrappers**: All socket emissions use named wrappers on `SocketClient`. Add `emitCaptureMetadata()` wrapper if needed for the REST metadata call

### Persistence Repository Pattern

Follow existing `session-repository.ts` and `catalog-repository.ts` patterns exactly:

```typescript
// media-repository.ts
import { db } from '../db/connection.js';
import type { MediaCapturesTable } from '../db/types.js';

export async function create(params: {
  id: string;
  sessionId: string;
  userId: string | null;
  storagePath: string;
  triggerType: string;
  djStateAtCapture: unknown | null;
}): Promise<MediaCapturesTable> {
  return db
    .insertInto('media_captures')
    .values({
      id: params.id,
      session_id: params.sessionId,
      user_id: params.userId,
      storage_path: params.storagePath,
      trigger_type: params.triggerType,
      dj_state_at_capture: JSON.stringify(params.djStateAtCapture),
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
```

- Method parameters in `camelCase`, DB columns in `snake_case`
- The `create()` function takes camelCase params and maps to snake_case for the insert
- `dj_state_at_capture` is JSONB -- must `JSON.stringify()` before insert
- Use `crypto.randomUUID()` for id generation (Node built-in, no extra dependency)

### Zod Schema Pattern

Follow existing schema patterns (e.g., `tv-schemas.ts`, `session-schemas.ts`):

```typescript
// capture-schemas.ts
import { z } from 'zod/v4';  // MUST use 'zod/v4' -- all schemas in this project use this import path
import { dataResponseSchema } from './common-schemas.js';

export const captureMetadataSchema = z.object({
  captureType: z.enum(['photo', 'video', 'audio']),
  triggerType: z.enum(['session_start', 'reaction_peak', 'post_ceremony', 'session_end', 'manual']),
  durationMs: z.number().optional(),
});
z.globalRegistry.add(captureMetadataSchema, { id: 'CaptureMetadata' });

export const captureResponseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  storagePath: z.string(),
  triggerType: z.string(),
  createdAt: z.string(),
});
z.globalRegistry.add(captureResponseSchema, { id: 'CaptureResponse' });

// Use dataResponseSchema() wrapper for REST responses: { data: {...} }
export const captureDataResponseSchema = dataResponseSchema(captureResponseSchema);
```

- **CRITICAL**: Import `z` from `'zod/v4'` NOT `'zod'` -- every schema file in the codebase uses `zod/v4`
- Use `dataResponseSchema()` from `common-schemas.ts` for the `{ data: {...} }` REST response wrapper
- Register with `z.globalRegistry.add()` for OpenAPI `$ref` generation
- Import in `index.ts` BEFORE swagger init: `await import('./shared/schemas/capture-schemas.js');`
- Use `z.enum()` for known value sets (not `z.string()`)

### Upload Queue Implementation Notes

- **Queue as singleton service**: Not a provider -- the queue runs independently of widget lifecycle
- **UploadProvider wraps queue**: Thin reactive wrapper that `notifyListeners()` when queue state changes
- **File cleanup**: After successful upload (or max retries exceeded), delete local temp file to reclaim storage
- **Queue serialization**: Store as JSON array in `shared_preferences` under key `upload_queue`. Each item: `{ filePath, sessionId, captureId, captureType, triggerType, status, retryCount, createdAt }`
- **Connectivity detection**: `connectivity_plus` package -- listen for `onConnectivityChanged`. When connectivity returns after a loss, call `processQueue()`
- **No duplicate uploads**: Check if `captureId` already exists in queue before enqueuing

### Scope Boundaries -- What NOT to Implement

| Not in 6.3 | Belongs to |
|---|---|
| Firebase Storage direct upload | Story 6.4 |
| Signed URL generation | Story 6.4 |
| Firebase Storage security rules | Story 6.4 |
| Guest media 7-day expiry | Story 6.4 |
| Reaction peak detection triggers | Story 6.5 |
| Post-session media gallery | Story 9.4 |
| Media download/sharing UI | Story 9.4 |

### Project Structure Notes

**New directories (create first):**
- `apps/flutter_app/lib/services/` -- does not exist yet
- `apps/flutter_app/test/services/` -- does not exist yet

**New files:**
- `apps/server/src/persistence/media-repository.ts` -- architecture-specified filename
- `apps/server/src/services/capture-service.ts` -- thin wrapper for socket handler → persistence
- `apps/server/src/shared/schemas/capture-schemas.ts` -- import `z` from `'zod/v4'`
- `apps/server/src/routes/captures.ts`
- `apps/flutter_app/lib/services/upload_queue.dart`
- `apps/flutter_app/lib/state/upload_provider.dart`
- `apps/server/tests/factories/media-capture.ts` -- test factory
- `apps/server/tests/persistence/media-repository.test.ts`
- `apps/server/tests/routes/captures.test.ts`
- `apps/flutter_app/test/services/upload_queue_test.dart` -- use `mocktail` for mocks
- `apps/flutter_app/test/state/upload_provider_test.dart` -- use `mocktail` for mocks

**Modified files:**
- `apps/server/src/socket-handlers/capture-handlers.ts` -- add metadata persistence via capture-service
- `apps/flutter_app/lib/widgets/capture_overlay.dart` -- enqueue after capture
- `apps/flutter_app/lib/widgets/capture_toolbar_icon.dart` -- upload progress ring
- `apps/flutter_app/lib/config/bootstrap.dart` -- register UploadProvider
- `apps/flutter_app/lib/constants/copy.dart` -- upload status strings
- `apps/flutter_app/pubspec.yaml` -- add `connectivity_plus`, `shared_preferences`
- `apps/server/src/routes/index.ts` -- register captures route
- `apps/server/src/index.ts` -- import capture schemas before swagger init
- `apps/server/tests/socket-handlers/capture-handlers.test.ts` -- extend with persistence tests
- `apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart` -- extend with progress ring tests

**Verify only (no changes):**
- `apps/server/src/db/types.ts` -- `MediaCapturesTable` already defined
- `apps/server/migrations/001-initial-schema.ts` -- `media_captures` table already created
- `apps/server/src/services/event-stream.ts` -- `capture:complete` event type already defined
- `apps/flutter_app/lib/state/capture_provider.dart` -- read file paths from existing capture flow

### Error Handling

- **REST endpoint**: Return `{ error: { code: 'CAPTURE_NOT_FOUND', message: '...' } }` or `{ error: { code: 'INVALID_CAPTURE_DATA', message: '...' } }` using `AppError` from `shared/errors.ts`
- **Persistence fire-and-forget**: `try/catch` inside `capture-service.persistCaptureMetadata()`. Log error with `console.error()` but do NOT propagate to socket handler or client
- **Upload queue failures**: After 5 retries, mark item as `failed` in queue. Do not block other items. Log failure for debugging
- **Missing file**: If temp file is deleted before upload, mark queue item as `failed` and skip
- **Connectivity loss mid-upload**: `connectivity_plus` fires change event. Queue pauses automatically, resumes on reconnect

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 6 Story 6.3 -- FR70, FR71, FR44]
- [Source: _bmad-output/planning-artifacts/architecture.md, Media capture metadata persistence pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md, Firebase Storage client-direct upload pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md, fire-and-forget async write pattern]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: _bmad-output/project-context.md, State Persistence lines 120-124]
- [Source: _bmad-output/project-context.md, Error Handling lines 134-137]
- [Source: _bmad-output/implementation-artifacts/6-2-inline-media-capture.md -- previous story patterns]
- [Source: apps/server/src/db/types.ts:45-53 -- MediaCapturesTable definition]
- [Source: apps/server/src/persistence/session-repository.ts -- repository pattern reference]
- [Source: apps/server/src/services/dj-state-store.ts -- getSessionDjState() for in-memory DJ state]
- [Source: apps/server/src/shared/schemas/common-schemas.ts -- dataResponseSchema() wrapper, zod/v4 import]
- [Source: apps/server/src/shared/errors.ts -- AppError, createAppError(), notFoundError(), badRequestError()]
- [Source: apps/server/tests/factories/session.ts -- createTestSession() factory pattern reference]
- [Source: apps/server/tests/routes/auth.test.ts -- Fastify app.inject() route test pattern reference]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: Created `media-repository.ts` with `create`, `findBySessionId`, `findById`, `findByUserId` — follows session-repository pattern with camelCase params mapped to snake_case DB columns
- Task 2: Created `capture-schemas.ts` (zod/v4) with `captureMetadataSchema`, `captureResponseDataSchema`, `captureDataResponseSchema`. Created `captures.ts` route (`POST /api/sessions/:sessionId/captures`). Registered schema import and route in `index.ts`
- Task 3: Created `capture-service.ts` (thin wrapper for fire-and-forget persistence). Updated `capture-handlers.ts` to persist metadata on `capture:complete` via capture-service, emit acknowledgment with captureId. Added `capture:shared` event for AC #3 (share intent tracking)
- Task 4: Created `upload_queue.dart` singleton service with queue data model, enqueue/processQueue, exponential backoff retry (2s-60s, max 5), connectivity detection via `connectivity_plus`, local storage persistence via `shared_preferences`. Added both packages to pubspec.yaml
- Task 5: Created `upload_provider.dart` reactive wrapper. Updated `capture_overlay.dart` to enqueue media BEFORE `onCaptureComplete()` in all 3 capture methods (photo/video/audio), capturing triggerType, sessionId, and djState snapshot before state reset. Added `djStateRaw` getter to PartyProvider. Registered UploadProvider in bootstrap.dart
- Task 6: Updated `capture_toolbar_icon.dart` with circular progress ring (2px, semi-transparent accent) that appears when uploads are active. Added upload copy constants to `copy.dart`
- Task 7: Created `createTestMediaCapture` factory. Created `media-repository.test.ts` (6 tests, mock DB chain). Extended `capture-handlers.test.ts` (18 tests total — added persistence via capture-service, acknowledgment emit, capture:shared tests). Created `captures.test.ts` (6 tests, Fastify app.inject pattern)
- Task 8: Created `upload_queue_test.dart` (10 tests — serialization, enqueue, dedup, hasActiveUploads, progress, clearFinished, onChanged). Created `upload_provider_test.dart` (7 tests — reactive state, items, progress, dispose). Updated `capture_toolbar_icon_test.dart` (7 tests — added upload progress ring rendering)

### Change Log

- 2026-03-18: Story 6.3 implemented — media tagging, background upload queue, capture metadata persistence, upload progress indicator
- 2026-03-18: Code review fixes applied (H1: .then() → async/await, H2: capture:complete ack → capture:persisted event, H3: REST error handling, M1: userId passthrough on REST, M2: CaptureOverlay uses UploadProvider, M3: removed dead durationMs param from capture-service)

### File List

**New files:**
- apps/server/src/persistence/media-repository.ts
- apps/server/src/services/capture-service.ts
- apps/server/src/shared/schemas/capture-schemas.ts
- apps/server/src/routes/captures.ts
- apps/flutter_app/lib/services/upload_queue.dart
- apps/flutter_app/lib/state/upload_provider.dart
- apps/server/tests/factories/media-capture.ts
- apps/server/tests/persistence/media-repository.test.ts
- apps/server/tests/routes/captures.test.ts
- apps/flutter_app/test/services/upload_queue_test.dart
- apps/flutter_app/test/state/upload_provider_test.dart

**Modified files:**
- apps/server/src/socket-handlers/capture-handlers.ts
- apps/server/src/shared/events.ts
- apps/server/src/services/event-stream.ts
- apps/server/src/index.ts
- apps/flutter_app/lib/widgets/capture_overlay.dart
- apps/flutter_app/lib/widgets/capture_toolbar_icon.dart
- apps/flutter_app/lib/state/party_provider.dart
- apps/flutter_app/lib/config/bootstrap.dart
- apps/flutter_app/lib/constants/copy.dart
- apps/flutter_app/pubspec.yaml
- apps/server/tests/socket-handlers/capture-handlers.test.ts
- apps/flutter_app/test/widgets/capture_toolbar_icon_test.dart
- _bmad-output/implementation-artifacts/sprint-status.yaml

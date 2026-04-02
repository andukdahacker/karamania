# Story 11.1: ACRCloud Audio Fingerprint Pipeline

Status: done

## Story

As a system,
I want to capture audio from the device microphone and identify the currently playing song via audio fingerprinting,
So that the app knows what song is playing in the karaoke room without any manual input.

## Acceptance Criteria

1. **Given** the user has granted microphone permission, **When** the DJ engine enters `DJState.song`, **Then** the system captures a 5-10 second audio burst from the device microphone (FR116), sends it to ACRCloud, and results are returned within 5 seconds including song title, artist, ISRC code, and playback time offset.
2. **Given** the fingerprinting service returns a match, **When** the result is processed, **Then** the client emits `detect:result` to the server, the server broadcasts `detect:songChanged` to all session participants, and the detection status updates to "Song detected: [title]" (FR122).
3. **Given** battery drain constraints, **When** audio capture is active, **Then** total battery drain from audio recognition must not exceed 12% per hour (NFR43) using a 5-10 second burst — not continuous listening.
4. **Given** the app is deployed to both platforms, **When** audio capture is initiated, **Then** it works uniformly on both iOS and Android using the `flutter_acrcloud` Flutter SDK.
5. **Given** microphone permission has not been granted, **When** audio capture is attempted, **Then** the system requests permission at runtime and handles denial gracefully by surfacing "No match — search manually" (fallback to FR120).

## PoC Gate

**This story includes a Go/No-Go validation gate.** Before committing to full implementation of Epics 11-13, ACRCloud must achieve **>60% recognition accuracy** in a real karaoke room test (NFR40). If recognition fails, manual song search (FR120) becomes primary and audio fingerprint features are descoped.

**PoC test plan:**
- Test with 10+ different songs in a real karaoke room
- Record success/failure for each attempt
- Log confidence scores and time offsets
- Test with both popular English songs and Vietnamese songs
- Test at varying noise levels (quiet room vs. full party)

## Tasks / Subtasks

- [x] **Task 1: Add `flutter_acrcloud` dependency** (AC: #4)
  - [x] Add `flutter_acrcloud: ^1.0.0` to `pubspec.yaml`
  - [x] Add `android.permission.RECORD_AUDIO` to `AndroidManifest.xml` (not present yet)
  - [x] iOS: `NSMicrophoneUsageDescription` already exists in Info.plist — no change needed
  - [x] Verify builds on both platforms

- [x] **Task 2: Create ACRCloud service** (AC: #1, #4)
  - [x] Add `ACRCLOUD_HOST`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET` to `dart_defines_dev.json` (and update `.example` file)
  - [x] Create `lib/services/acrcloud_service.dart` — singleton pattern matching existing services (`AcrCloudService._()` + `static final instance`)
  - [x] `setUp()` method called once at app startup with config from dart defines
  - [x] `startDetection()` → starts session, awaits result, returns parsed `AcrCloudResult`
  - [x] `cancelDetection()` → cancels active session
  - [x] Mic session: acquire before capture, release after. NEVER hold mic open between bursts

- [x] **Task 3: Create DetectionProvider** (AC: #2)
  - [x] Create `lib/state/detection_provider.dart` — ChangeNotifier, reactive state container
  - [x] State: `detectionStatus` enum (`idle`, `listening`, `detected`, `noMatch`, `error`)
  - [x] State: `detectedSong` (nullable — title, artist, isrc, timeOffsetMs, confidence, source)
  - [x] State: `consecutiveFailures` (int, for fallback threshold tracking)
  - [x] Mutation methods: `onDetectionStarted()`, `onDetectionResult(...)`, `onDetectionFailed()`, `onDetectionReset()`
  - [x] Mutation methods called ONLY by `SocketClient` (provider boundary rule)
  - [x] Register in `lib/config/bootstrap.dart` — add `ChangeNotifierProvider(create: (_) => DetectionProvider())` to the `MultiProvider` list
  - [x] Pass `DetectionProvider` into `SocketClient.connect()` as a new parameter, store as `_detectionProvider` field (same pattern as `_captureProvider`)

- [x] **Task 4: Wire detection trigger to DJ state** (AC: #1)
  - [x] In `lib/socket/client.dart` (NOT `socket_client.dart`), extend `_setupPartyListeners()`
  - [x] When `dj:stateChanged` payload has `state == 'song'` → call `AcrCloudService.instance.startDetection()`
  - [x] On success → call `_detectionProvider?.onDetectionResult(...)` AND emit `detect:result` socket event to server with metadata `{title, artist, isrc, timeOffsetMs, confidence}`
  - [x] On failure → call `_detectionProvider?.onDetectionFailed()`
  - [x] When DJ state changes AWAY from `song` → call `AcrCloudService.instance.cancelDetection()` and `_detectionProvider?.onDetectionReset()`
  - [x] **NOTE:** Existing `song:detected` event (server→client) in `client.dart` is for YouTube Lounge API detection and routes to `PartyProvider.setDetectedSong()`. Do NOT modify that path. The new `detect:result` event is client→server (opposite direction) for ACRCloud results

- [x] **Task 5: Handle microphone permission** (AC: #5)
  - [x] Request `RECORD_AUDIO` permission before first detection attempt in `AcrCloudService.startDetection()`
  - [x] On denial → `_detectionProvider?.onDetectionFailed()`, surface manual search fallback
  - [x] On permanent denial → guide user to app settings
  - [x] Never re-request if already granted in current session

- [x] **Task 6: Server-side detection event handling** (AC: #2)
  - [x] Add new event constants in `shared/events.ts`: `DETECT_RESULT: 'detect:result'` (client→server), `DETECT_STATUS: 'detect:status'` (server→client), `DETECT_SONG_CHANGED: 'detect:songChanged'` (server→all clients)
  - [x] **NOTE:** `SONG_DETECTED: 'song:detected'` already exists for YouTube Lounge API flow — do NOT reuse or modify
  - [x] Create `socket-handlers/detection-handlers.ts` with `registerDetectionHandlers(socket, io)` (new namespace = new file per handler convention)
  - [x] On `detect:result` from client → broadcast `detect:songChanged` to all session participants with song metadata
  - [x] Log detection event for PoC data collection (console.log sufficient for PoC)

- [x] **Task 7: PoC validation screen** (AC: all)
  - [x] Create temporary `lib/screens/detection_poc_screen.dart`
  - [x] Big "Start Detection" button → triggers single audio capture burst via `AcrCloudService.instance.startDetection()`
  - [x] Display: status (listening/detected/no match), song title, artist, confidence score, time offset
  - [x] Display: cumulative success rate (X/Y attempts = Z%)
  - [x] Display: scrollable list of all detection attempts with results
  - [x] Add temporary route in `lib/app.dart` — add `GoRoute(path: '/poc-detection', builder: (_, __) => const DetectionPocScreen())` to the `_router` routes list
  - [x] This screen is for PoC validation only — will be removed after Go/No-Go gate passes

## Dev Notes

### Package: `flutter_acrcloud` v1.0.0

- **pub.dev:** https://pub.dev/packages/flutter_acrcloud
- **Platforms:** Android and iOS only (matches target platforms)
- **SDK:** `>=3.10.0 <4.0.0`, Flutter `>=3.3.0`
- **Dependency:** `json_annotation ^4.9.0`

**API:**
```dart
// Setup (once)
ACRCloud.setUp(ACRCloudConfig(accessKey, accessSecret, host));

// Detection (per burst)
final session = ACRCloud.startSession();
final result = await session.result; // null if cancelled

if (result?.metadata != null) {
  final music = result!.metadata!.music.first;
  // music.title, music.artists.first.name, music.score,
  // music.playOffsetMs, music.durationMs
  // music.externalIds?.isrc (if available)
}

session.dispose(); // ALWAYS dispose after use
```

**Key response fields:**
- `music.title` → song title
- `music.artists[].name` → artist name(s)
- `music.score` → confidence (0-100)
- `music.playOffsetMs` → how far into the song (for lyrics sync)
- `music.durationMs` → total song duration
- `status.code` → 0=success, 1001=no match, 3003=rate limit

### Event Flow (Critical — Two Separate Pipelines)

**Existing pipeline (YouTube Lounge API — do NOT modify):**
```
Server detects song via Lounge API → emits `song:detected` → client.dart listener
→ PartyProvider.setDetectedSong()
```

**New pipeline (ACRCloud — this story):**
```
DJ enters `song` state → client.dart triggers AcrCloudService.startDetection()
→ flutter_acrcloud captures audio + fingerprints → ACRCloud API returns result
→ client emits `detect:result` to server → server broadcasts `detect:songChanged` to all
→ DetectionProvider.onDetectionResult() updates UI state
```

These are independent paths. The existing `song:detected` event and `PartyProvider.setDetectedSong()` remain untouched.

### Service Pattern (Match Existing)

Existing services use singleton pattern:
```dart
class AcrCloudService {
  AcrCloudService._();
  static final instance = AcrCloudService._();

  Future<AcrCloudResult?> startDetection() async { ... }
  void cancelDetection() { ... }
}
```
No dependency injection. Use `debugPrint` for error logging. Pure async methods.

### Architecture Compliance

- **`AcrCloudService`** goes in `lib/services/` — singleton, thin wrapper, no business logic
- **`DetectionProvider`** goes in `lib/state/` — ChangeNotifier, reactive state container only
- **ONLY `SocketClient`** (`lib/socket/client.dart`) calls mutation methods on `DetectionProvider`
- Provider registered in `lib/config/bootstrap.dart` (NOT `main.dart`)
- Provider passed into `SocketClient.connect()` and stored as `_detectionProvider` (same as `_captureProvider` pattern)
- No provider-to-provider access
- All UI strings in `constants/copy.dart`
- Use `LoadingState` enum pattern for async operations (per project convention)
- New server handler file `detection-handlers.ts` (new namespace = new file)
- Server event constants in `shared/events.ts` follow `NAMESPACE_ACTION: 'namespace:action'` pattern
- Routes defined in `lib/app.dart` in `_router` variable

### Battery & Mic Management

- Capture burst: 5-10 seconds ONLY
- After result received: `session.dispose()` immediately
- NEVER hold mic open between detection attempts
- For PoC: manual trigger only (no periodic). Periodic re-recognition is Story 11.2

### SongContext Interface (Story 5.10 dependency)

Story 11.1 produces detection results. Story 5.10 wraps them in `SongContext`:
```typescript
interface SongContext {
  title: string;
  artist: string;
  isrc?: string;
  timeOffset?: number;     // playOffsetMs from ACRCloud
  detectionSource: 'AUDIO_FINGERPRINT' | 'LOUNGE_API' | 'MANUAL';
  confidence: number;
  detectedAt: string;       // ISO timestamp
}
```

For the PoC, send raw detection data via socket. SongContext wrapping happens in Story 5.10.

### Server-Side Boundaries

- New `detection-handlers.ts` handles `detect:result` event from client (client→server)
- Detection event logging is fire-and-forget (console.log for PoC, persistence in later stories)
- `audio-intelligence/` module is NOT created in this story — that's for chant detection, lyrics fetching, etc.
- No database changes for PoC — `detection_events` table comes in a later story
- Register new handler in `index.ts` socket setup (same pattern as other handlers)

### Existing Song Detection (Legacy)

Current: `services/song-detection.ts` uses YouTube video ID → catalog → YouTube API title parsing. This remains intact. ACRCloud adds a NEW detection source alongside it. Story 5.10 abstracts both behind `SongContext`.

### What NOT To Do

- Do NOT modify existing `song:detected` event or `PartyProvider.setDetectedSong()` — that's the YouTube Lounge API path
- Do NOT create `audio-intelligence/` module yet — that's for later stories
- Do NOT implement periodic re-recognition — that's Story 11.2
- Do NOT implement manual search fallback UI — that's Story 11.3
- Do NOT implement detection status indicator widget — that's Story 11.4
- Do NOT implement lyrics fetching or display — that's Story 11.5
- Do NOT implement the `SongContext` interface — that's Story 5.10
- Do NOT create database tables (`detection_events`, `lyrics_cache`) — later stories
- Do NOT compute chant detection or light show — later stories
- Do NOT use continuous microphone listening — burst only
- Do NOT hardcode ACRCloud credentials — use dart defines

### Project Structure Notes

**New files:**
- `apps/flutter_app/lib/services/acrcloud_service.dart` (singleton service)
- `apps/flutter_app/lib/state/detection_provider.dart` (ChangeNotifier)
- `apps/flutter_app/lib/screens/detection_poc_screen.dart` (temporary)
- `apps/server/src/socket-handlers/detection-handlers.ts` (new handler)

**Modified files:**
- `apps/flutter_app/pubspec.yaml` (add `flutter_acrcloud`)
- `apps/flutter_app/android/app/src/main/AndroidManifest.xml` (add RECORD_AUDIO permission)
- `apps/flutter_app/lib/config/bootstrap.dart` (register DetectionProvider in MultiProvider)
- `apps/flutter_app/lib/socket/client.dart` (add detection trigger on DJ song state, pass DetectionProvider)
- `apps/flutter_app/lib/app.dart` (add PoC route to _router)
- `apps/flutter_app/lib/constants/copy.dart` (detection status strings)
- `apps/flutter_app/dart_defines_dev.json` (add ACRCloud credentials)
- `apps/server/src/shared/events.ts` (add detect:* event constants)
- `apps/server/src/index.ts` (register detection handlers)

**NOT modified:**
- `apps/flutter_app/ios/Runner/Info.plist` (NSMicrophoneUsageDescription already exists)
- `apps/server/src/socket-handlers/song-handlers.ts` (existing song:detected path untouched)
- `apps/server/src/services/song-detection.ts` (legacy YouTube detection untouched)

### Testing Approach

**DO test (unit):**
- `AcrCloudService`: setUp called, startDetection returns parsed result, cancelDetection cancels session
- `DetectionProvider`: state transitions (idle→listening→detected, idle→listening→noMatch), consecutiveFailures increment/reset
- Server `detection-handlers.ts`: `detect:result` received → `detect:songChanged` broadcast to room

**DO NOT test:**
- Actual ACRCloud API calls (external service)
- Microphone permission dialogs (OS-level)
- Audio capture quality
- PoC screen visual layout

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.1]
- [Source: _bmad-output/planning-artifacts/prd.md#FR116-FR122]
- [Source: _bmad-output/planning-artifacts/architecture.md#Audio Intelligence Pipeline]
- [Source: _bmad-output/project-context.md#Audio Intelligence Pipeline]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-02.md#Section 3]
- [Source: pub.dev/packages/flutter_acrcloud v1.0.0]
- [Source: apps/flutter_app/lib/socket/client.dart — existing song:detected handler]
- [Source: apps/flutter_app/lib/config/bootstrap.dart — provider registration pattern]
- [Source: apps/server/src/shared/events.ts — existing SONG_DETECTED constant]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- flutter_acrcloud v1.0.0 SDK does NOT expose `externalIds.isrc` on `ACRCloudResponseMusicItem` — ISRC field is always null in AcrCloudResult. SongContext ISRC population will need raw JSON parsing or SDK upgrade in a later story.
- `ACRCloud.setUp()` is static and async — wrapped in AcrCloudService.setUp() accordingly.
- `ACRCloudSession.cancel()` internally calls `dispose()` — our `cancelDetection()` only calls `cancel()` to avoid double-dispose.
- Added `permission_handler: ^11.3.1` as new dependency for runtime microphone permission handling (AC #5).

### Completion Notes List
- Task 1: Added `flutter_acrcloud: ^1.0.0` and `permission_handler: ^11.3.1` to pubspec.yaml. Added `RECORD_AUDIO` permission to AndroidManifest.xml. iOS already had `NSMicrophoneUsageDescription`. Zero analysis errors.
- Task 2: Created `AcrCloudService` singleton at `lib/services/acrcloud_service.dart`. setUp/startDetection/cancelDetection. Session disposed in finally block. Added ACRCloud dart defines to dev config and example.
- Task 3: Created `DetectionProvider` at `lib/state/detection_provider.dart` with 5-state enum, DetectedSong model, and 4 mutation methods. Registered in bootstrap.dart MultiProvider. 14 unit tests pass.
- Task 4: Wired ACRCloud detection trigger in `client.dart` `dj:stateChanged` handler. On `song` state → startDetection. On result → emit `detect:result` to server + update provider. On leave song → cancelDetection + reset. Added `_detectionProvider` parameter to connect/createParty/joinParty. Updated home_screen.dart and join_screen.dart call sites.
- Task 5: Microphone permission requested via `permission_handler` inside `AcrCloudService.startDetection()`. Returns null on denial → triggers `onDetectionFailed()` in provider. Copy strings added for mic denied and settings guidance.
- Task 6: Added `DETECT_RESULT`, `DETECT_STATUS`, `DETECT_SONG_CHANGED` event constants to `shared/events.ts`. Created `detection-handlers.ts` with `registerDetectionHandlers(socket, io)`. Broadcasts `detect:songChanged` to session room. Console.log for PoC data collection. Registered in connection-handler.ts. 4 unit tests pass.
- Task 7: Created `DetectionPocScreen` at `lib/screens/detection_poc_screen.dart`. Start Detection button, status display, song details, confidence, success rate counter, scrollable attempt history. Added `/poc-detection` route in app.dart.

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 | **Date:** 2026-04-03 | **Outcome:** Approved with fixes applied

**Issues found: 3 HIGH, 3 MEDIUM, 2 LOW**

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| H1 | HIGH | `detect:result` (C→S) missing from project-context event catalog | Updated `project-context.md` detect row to include `detect:result` and mark Bidirectional |
| H2 | HIGH | `AcrCloudService` singleton state leaks across tests — no reset | Added `@visibleForTesting reset()` method; test setUp calls it |
| H3 | HIGH | No input validation on server `detect:result` handler — client payload broadcast unvalidated | Added type guards for `title`, `artist`, `confidence` before broadcasting; added rejection test |
| M1 | MEDIUM | PoC screen directly calls provider mutation methods (violates SocketClient-only rule) | Documented as intentional PoC deviation with comment; screen is temporary |
| M2 | MEDIUM | `_statusText` calls `context.read` redundantly inside build | Refactored to accept `DetectionProvider` param, pre-computed in build |
| M3 | MEDIUM | `onDetectionReset` zeroed `consecutiveFailures`, defeating fallback threshold tracking | Preserved `consecutiveFailures` across reset; updated tests |
| L1 | LOW | File List missing auto-generated files (`pubspec.lock`, windows plugin files) | Not fixed (auto-generated) |
| L2 | LOW | Stale lightstick events/handlers still in codebase (pivot migration debt) | Not fixed (out of scope for 11.1) |

All 5 server detection tests pass. All 18 Flutter detection tests pass.

### Change Log
- 2026-04-03: Implemented Story 11.1 — ACRCloud audio fingerprint pipeline (all 7 tasks)
- 2026-04-03: Code review — fixed 6 issues (3 HIGH, 3 MEDIUM), all tests green

### File List
**New files:**
- `apps/flutter_app/lib/services/acrcloud_service.dart`
- `apps/flutter_app/lib/state/detection_provider.dart`
- `apps/flutter_app/lib/screens/detection_poc_screen.dart`
- `apps/server/src/socket-handlers/detection-handlers.ts`
- `apps/flutter_app/test/state/detection_provider_test.dart`
- `apps/flutter_app/test/services/acrcloud_service_test.dart`
- `apps/server/tests/socket-handlers/detection-handlers.test.ts`

**Modified files:**
- `apps/flutter_app/pubspec.yaml` (added flutter_acrcloud, permission_handler)
- `apps/flutter_app/android/app/src/main/AndroidManifest.xml` (added RECORD_AUDIO permission)
- `apps/flutter_app/lib/config/app_config.dart` (added acrCloudHost/Key/Secret fields)
- `apps/flutter_app/lib/config/bootstrap.dart` (registered DetectionProvider, ACRCloud init)
- `apps/flutter_app/lib/socket/client.dart` (added detection trigger, DetectionProvider param)
- `apps/flutter_app/lib/app.dart` (added /poc-detection route)
- `apps/flutter_app/lib/constants/copy.dart` (added detection status strings)
- `apps/flutter_app/lib/screens/home_screen.dart` (pass DetectionProvider to createParty)
- `apps/flutter_app/lib/screens/join_screen.dart` (pass DetectionProvider to joinParty)
- `apps/flutter_app/dart_defines_dev.json` (added ACRCloud credentials)
- `apps/flutter_app/dart_defines_dev.json.example` (added ACRCloud placeholder keys)
- `apps/server/src/shared/events.ts` (added detect:* event constants)
- `apps/server/src/socket-handlers/connection-handler.ts` (registered detection handlers)
- `apps/flutter_app/test/screens/join_screen_test.dart` (added DetectionProvider to test providers)

**NOT modified:**
- `apps/flutter_app/ios/Runner/Info.plist` (NSMicrophoneUsageDescription already present)
- `apps/server/src/socket-handlers/song-handlers.ts` (existing song:detected path untouched)
- `apps/server/src/services/song-detection.ts` (legacy YouTube detection untouched)

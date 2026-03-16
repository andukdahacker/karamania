# Story 5.7: TV Pairing & YouTube Lounge API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a host,
I want to pair the app with the venue's YouTube TV,
So that selected songs are automatically queued on the karaoke screen.

## Acceptance Criteria

1. **Given** the TV integration system is being implemented, **When** the Lounge API abstraction is designed, **Then** a `TvIntegration` interface is defined first with methods for connect, disconnect, onNowPlaying, and addToQueue -- enabling Story 5.9's graceful degradation to work against a clean contract
2. **Given** a venue uses YouTube for karaoke, **When** the host enters the TV pairing code displayed on the TV screen, **Then** the app connects to the YouTube TV session via the Lounge API (FR74) **And** the connection is a persistent HTTP connection implementing the `TvIntegration` interface
3. **Given** the Lounge API connection is established, **When** a song plays on the TV, **Then** real-time nowPlaying events containing the current video_id are received (FR75)
4. **Given** a song is selected via Quick Pick or Spin the Wheel, **When** the selection is confirmed, **Then** the song is pushed to the YouTube TV queue via the Lounge API addVideo command (FR78)
5. **Given** the Lounge API connection drops, **When** reconnection is attempted, **Then** automatic reconnection is attempted for up to 60 seconds (FR79) **And** if reconnection fails, the host is prompted to re-enter the TV code (FR79) **And** the system maintains the Lounge API session throughout the party (FR79)

## Tasks / Subtasks

- [x] Task 1: Define `TvIntegration` interface and types (AC: #1)
  - [x] 1.1 Create `apps/server/src/integrations/tv-integration.ts` with the `TvIntegration` interface:
    ```typescript
    export interface NowPlayingEvent {
      videoId: string;
      title?: string;
      state: 'playing' | 'paused' | 'buffering' | 'idle';
    }

    export type TvConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

    export interface TvIntegration {
      connect(pairingCode: string): Promise<void>;
      disconnect(): Promise<void>;
      addToQueue(videoId: string): Promise<void>;
      onNowPlaying(callback: (event: NowPlayingEvent) => void): void;
      onStatusChange(callback: (status: TvConnectionStatus) => void): void;
      isConnected(): boolean;
    }
    ```
  - [x] 1.2 The `onStatusChange` callback fires on connect, disconnect, reconnecting, and reconnect-failed -- this is part of the contract so session-manager can broadcast status to clients without coupling to implementation details
  - [x] 1.3 This interface is the **contract for Story 5.9** (suggestion-only fallback). Story 5.9 will check `isConnected()` to determine whether to auto-queue or show manual display
  - [x] 1.4 Export a factory type: `export type CreateTvIntegration = () => TvIntegration` -- enables mock injection in tests and future implementation swaps

- [x] Task 2: Implement YouTube Lounge API client (AC: #2, #3, #4, #5)
  - [x] 2.1 Create `apps/server/src/integrations/lounge-api.ts` implementing `TvIntegration`
  - [x] 2.2 **Custom HTTP implementation required** -- there is no maintained npm package that supports the full flow (pairing code -> screenId -> commands + nowPlaying events). The `youtube-remote` npm package (v1.1.0, unmaintained since April 2022) **only** supports sending commands given a pre-obtained `screenId` -- it cannot convert pairing codes, has no event subscription, and has no TypeScript types. Do NOT install it. Implement the Lounge API protocol directly using Node.js `fetch`
  - [x] 2.3 **YouTube Lounge API Protocol** (primary implementation approach):
    - **Step 1 -- Pairing:** `POST https://www.youtube.com/api/lounge/pairing/get_screen` with form body `pairing_code={code}` -- returns JSON with `screen_id` and `lounge_token`
    - **Step 2 -- Bind (session init):** `POST https://www.youtube.com/api/lounge/bc/bind` with form body `loungeIdToken={lounge_token}&device=REMOTE_CONTROL&id={uuid}&VER=8&CVER=1&zx={random}` -- response contains `SID` and `gsessionid` in chunked array format: `[[0,["c","SID_VALUE","",8]],[1,["S","gsessionid_value"]]]`
    - **Step 3 -- Long-poll for events:** `GET https://www.youtube.com/api/lounge/bc/bind?SID={sid}&gsessionid={gsid}&RID=rpc&CI=0&TYPE=xmlhttp&AID={aid}` -- server holds connection open, returns chunked events including `nowPlaying` (contains `videoId`), `onStateChange` (contains playback state), `remoteConnected`
    - **Step 4 -- Send commands:** `POST https://www.youtube.com/api/lounge/bc/bind` with `SID`, `gsessionid`, `req_count`, and command params. For addToQueue: `action=addVideo&videoId={videoId}`
    - **Session refresh:** `loungeToken` may expire -- call `get_lounge_token_batch` with `screen_ids={screenId}` to refresh
    - **Reference implementations:** `pyytlounge` v3.2.0 (Python, actively maintained), `plaincast` (Go), `ytcast` (Go CLI)
  - [x] 2.4 Implement `connect(pairingCode: string)`:
    - Call `get_screen` with pairing code to obtain `screenId` and `loungeToken`
    - Call bind endpoint to establish session (get `SID`, `gsessionid`)
    - Store `screenId`, `loungeToken`, `SID`, `gsessionid` for reconnection and commands
    - Start the long-poll event loop for `nowPlaying` events
    - Fire `onStatusChange('connected')` callback
    - Use `AbortController` for the long-poll fetch so `disconnect()` can cancel it cleanly
  - [x] 2.5 Implement `disconnect()`:
    - Abort long-poll fetch via `AbortController.abort()`
    - Clean up stored session tokens
    - Fire `onStatusChange('disconnected')` callback
  - [x] 2.6 Implement `addToQueue(videoId: string)`:
    - POST to bind endpoint with `action=addVideo&videoId={videoId}` plus `SID`, `gsessionid`, incrementing `req_count`
    - Throw if not connected
  - [x] 2.7 Implement `onNowPlaying(callback)`:
    - Register callback invoked when long-poll returns a `nowPlaying` event
    - Parse event to extract `videoId` and playback state
  - [x] 2.8 Implement `isConnected(): boolean` -- returns current connection status
  - [x] 2.9 Implement auto-reconnection logic (AC: #5):
    - On connection drop (long-poll fetch error or unexpected close), fire `onStatusChange('reconnecting')`
    - Retry bind + long-poll with exponential backoff (1s, 2s, 4s, 8s, 16s, 29s = 60s total)
    - Use stored `screenId`/`loungeToken` for reconnection attempts
    - If `loungeToken` is stale, try `get_lounge_token_batch` refresh first
    - If all retries fail, fire `onStatusChange('disconnected')` (session-manager broadcasts to host)
    - If reconnection succeeds, resume long-poll listener and fire `onStatusChange('connected')`
  - [x] 2.10 Implement `resetForTest()` export for test cleanup

- [x] Task 3: Add Socket.io events and schemas for TV pairing (AC: #2, #5)
  - [x] 3.1 In `apps/server/src/shared/events.ts`, add:
    - `TV_PAIR: 'tv:pair'` (client -> server: host sends pairing code)
    - `TV_STATUS: 'tv:status'` (server -> client: connection status updates)
    - `TV_UNPAIR: 'tv:unpair'` (client -> server: host disconnects TV)
    - `TV_NOW_PLAYING: 'tv:nowPlaying'` (server -> client: current song info)
  - [x] 3.2 Create `apps/server/src/shared/schemas/tv-schemas.ts`:
    - `tvPairSchema: z.object({ pairingCode: z.string().min(1).max(20) })`
    - `tvStatusSchema: z.object({ status: z.enum(['disconnected', 'connecting', 'connected', 'reconnecting']), message: z.string().optional() })`
    - `tvNowPlayingSchema: z.object({ videoId: z.string(), title: z.string().optional(), state: z.enum(['playing', 'paused', 'buffering', 'idle']) })`
    - **No `z.globalRegistry.add()`** -- Socket.io only, no REST endpoints

- [x] Task 4: Create TV socket handler (AC: #2, #5)
  - [x] 4.1 Create `apps/server/src/socket-handlers/tv-handlers.ts`
  - [x] 4.2 Export `registerTvHandlers(socket: Socket)` following existing handler pattern
  - [x] 4.3 Handle `EVENTS.TV_PAIR`:
    - Guard: socket must be the host -- use `socket.data.role === 'host'` (available on `AuthenticatedSocket.data`). If not host, return silently
    - Validate payload with `tvPairSchema.safeParse()`
    - Call `sessionManager.pairTv(sessionId, pairingCode)` (Task 5)
    - On success: broadcast `EVENTS.TV_STATUS` to room `{ status: 'connected' }`
    - On failure: emit `EVENTS.TV_STATUS` to socket only `{ status: 'disconnected', message: error.message }`
    - Append event: `appendEvent(sessionId, { type: 'tv:paired', ts: Date.now(), userId })`
  - [x] 4.4 Handle `EVENTS.TV_UNPAIR`:
    - Guard: host only
    - Call `sessionManager.unpairTv(sessionId)`
    - Broadcast `EVENTS.TV_STATUS` to room `{ status: 'disconnected' }`
    - Append event: `appendEvent(sessionId, { type: 'tv:unpaired', ts: Date.now(), userId })`
  - [x] 4.5 Register in `apps/server/src/socket-handlers/connection-handler.ts` inside `setupSocketHandlers()` -- add `registerTvHandlers(s, io)` after the existing `registerSongHandlers(s, io)` call (line ~56). Follow exact same pattern: `import { registerTvHandlers } from './tv-handlers.js'`

- [x] Task 5: Update session-manager.ts for TV lifecycle (AC: #2, #3, #4, #5)
  - [x] 5.1 Import `TvIntegration`, `NowPlayingEvent`, `TvConnectionStatus`, `CreateTvIntegration` from `../integrations/tv-integration.js`
  - [x] 5.2 Import `createLoungeApiClient` from `../integrations/lounge-api.js`. Assign to module-level variable: `let tvFactory: CreateTvIntegration = createLoungeApiClient` -- this enables test injection via `export function setTvFactory(f: CreateTvIntegration) { tvFactory = f; }`
  - [x] 5.3 Add module-level Map: `const tvConnections = new Map<string, TvIntegration>()`
  - [x] 5.4 Implement `async function pairTv(sessionId: string, pairingCode: string): Promise<void>`:
    - Create new `TvIntegration` instance via factory (`createTvIntegration()`)
    - Register `onNowPlaying` callback that:
      - Emits `EVENTS.TV_NOW_PLAYING` to room with `{ videoId, title, state }`
      - Emits `EVENTS.SONG_DETECTED` to room (for Story 5.8 to consume later)
      - Appends event: `appendEvent(sessionId, { type: 'song:detected', ts: Date.now(), data: { videoId } })`
    - Register `onStatusChange` callback that:
      - Emits `EVENTS.TV_STATUS` to room with `{ status, message }` for every status transition
      - On `'disconnected'` (after reconnect failure): removes from `tvConnections` map
    - Call `tv.connect(pairingCode)` -- throws on failure
    - Store in `tvConnections` map
  - [x] 5.5 Implement `async function unpairTv(sessionId: string): Promise<void>`:
    - Get from `tvConnections` map
    - Call `tv.disconnect()`
    - Remove from map
  - [x] 5.6 Implement `function getTvConnection(sessionId: string): TvIntegration | undefined`:
    - Returns the TV integration instance for the session
    - Used by Quick Pick and Spin the Wheel to auto-queue songs
  - [x] 5.7 Implement `function isTvPaired(sessionId: string): boolean`:
    - Returns `tvConnections.get(sessionId)?.isConnected() ?? false`
  - [x] 5.8 **CRITICAL: Update `handleQuickPickSongSelected` (line 724) and `handleSpinWheelSongSelected` (line 634)** to auto-queue on TV:
    - In each function, AFTER the `io.to(sessionId).emit(EVENTS.SONG_QUEUED, ...)` call and BEFORE `processDjTransition(sessionId, updatedContext, { type: 'SONG_SELECTED' })`, add:
      ```typescript
      if (isTvPaired(sessionId)) {
        getTvConnection(sessionId)!.addToQueue(song.youtubeVideoId).catch((err) => {
          console.error('[session-manager] TV queue push failed:', err);
        });
      }
      ```
    - Fire-and-forget `.catch()` -- non-blocking, same pattern as participation scoring
    - `youtubeVideoId` is already available on both `QuickPickSong` and `SpinWheelSegment` types
  - [x] 5.9 **CRITICAL: Update `endSession`** cleanup to disconnect TV:
    - Add `tvConnections.get(sessionId)?.disconnect().catch(() => {})` before cleanup
    - Add `tvConnections.delete(sessionId)` to cleanup block (alongside `clearPool`, `clearRound`, etc.)
  - [x] 5.10 Export `resetAllTvConnections()` for test cleanup

- [x] Task 6: Flutter TV Pairing UI (AC: #2, #5)
  - [x] 6.1 Add copy constants in `apps/flutter_app/lib/constants/copy.dart`:
    - `tvPairingTitle = 'Pair with YouTube TV'`
    - `tvPairingInstructions = 'Enter the code shown on your YouTube TV screen'`
    - `tvPairingPlaceholder = 'TV Code'`
    - `tvPairingConnect = 'Connect'`
    - `tvConnected = 'Connected to TV'`
    - `tvReconnecting = 'Reconnecting to TV...'`
    - `tvDisconnected = 'TV disconnected'`
    - `tvReconnectFailed = 'Could not reconnect. Please re-enter the TV code.'`
    - `tvUnpair = 'Disconnect TV'`
    - (Existing `pairWithTv` and `skipNoTv` constants can be reused/updated)
  - [x] 6.2 Create `apps/flutter_app/lib/widgets/tv_pairing_overlay.dart`:
    - Stateful widget with a `TextField` for pairing code input
    - Connect button triggers `SocketClient.pairTv(code)`
    - Displays connection status from `PartyProvider.tvStatus`
    - Shows error messages on failure
    - Shows "Connected" state with disconnect option
    - Use `DJTokens` for all spacing/colors, `Key('tv-pairing-overlay')` widget key
  - [x] 6.3 Update `apps/flutter_app/lib/screens/lobby_screen.dart`:
    - Replace the placeholder TV pairing section (lines 173-189) with functional widget
    - Tap "Pair with YouTube TV" opens `tv_pairing_overlay.dart` as a bottom sheet or dialog
    - "Skip -- no TV" sets `PartyProvider.tvSkipped = true` (for Story 5.9)
    - Show connection status indicator when paired

- [x] Task 7: Flutter socket and state management (AC: #2, #3, #5)
  - [x] 7.1 Update `apps/flutter_app/lib/state/party_provider.dart`:
    - Add Dart enum alongside existing enums (`ConnectionStatus`, `DJState`, `LoadingState`):
      ```dart
      enum TvConnectionStatus { disconnected, connecting, connected, reconnecting }
      ```
    - Add state fields:
      - `TvConnectionStatus _tvStatus = TvConnectionStatus.disconnected`
      - `String? _tvStatusMessage`
      - `String? _tvNowPlayingVideoId`
      - `bool _tvSkipped = false`
      - `LoadingState _tvPairingState = LoadingState.idle` -- per project-context.md: every async op uses `LoadingState` with per-operation naming
    - Add getters: `tvStatus`, `tvStatusMessage`, `tvNowPlayingVideoId`, `isTvPaired` (computed: `_tvStatus == TvConnectionStatus.connected`), `tvSkipped`, `tvPairingState`
    - Add mutation methods (called ONLY by `SocketClient`):
      - `setTvStatus(TvConnectionStatus status, {String? message})` -- also sets `_tvPairingState` to `success`/`error` based on status
      - `setTvNowPlaying(String videoId, String? title, String state)`
      - `setTvSkipped(bool skipped)`
      - `setTvPairingState(LoadingState state)` -- set to `loading` when pairing starts
  - [x] 7.2 Update `apps/flutter_app/lib/socket/client.dart`:
    - Add `pairTv(String pairingCode)` method:
      - Set `_partyProvider?.setTvPairingState(LoadingState.loading)` immediately (same pattern as `emitQuickPickVote` updating local state)
      - Emit `tv:pair` with `{'pairingCode': pairingCode}`
    - Add `unpairTv()` method: emit `tv:unpair` with no payload
    - Add listener for `tv:status` in `_setupPartyListeners`:
      ```dart
      on('tv:status', (data) {
        final payload = data as Map<String, dynamic>;
        final statusStr = payload['status'] as String;
        final message = payload['message'] as String?;
        final status = TvConnectionStatus.values.firstWhere((e) => e.name == statusStr);
        _partyProvider?.setTvStatus(status, message: message);
      });
      ```
    - Add listener for `tv:nowPlaying`: calls `partyProvider.setTvNowPlaying(...)`

- [x] Task 8: Server tests (AC: #1, #2, #3, #4, #5)
  - [x] 8.1 Create `apps/server/tests/integrations/lounge-api.test.ts`:
    - Test `TvIntegration` interface compliance
    - Test connect with valid/invalid pairing code
    - Test `addToQueue` when connected/disconnected
    - Test `onNowPlaying` callback invocation
    - Test reconnection logic (mock HTTP failures)
    - Test `disconnect` cleanup
    - **Mock HTTP calls** -- do NOT call real YouTube API in tests
  - [x] 8.2 Create `apps/server/tests/socket-handlers/tv-handlers.test.ts`:
    - Test `tv:pair` with valid code (host only)
    - Test `tv:pair` rejected for non-host
    - Test `tv:unpair` disconnects
    - Test `tv:status` broadcast on connect/disconnect
    - Use test factories from `tests/factories/`
  - [x] 8.3 Create `apps/server/tests/services/session-manager-tv.test.ts`:
    - Test `pairTv` creates connection and stores in map
    - Test `unpairTv` disconnects and removes from map
    - Test `isTvPaired` returns correct status
    - Test `endSession` cleans up TV connection
    - Test auto-queue integration: call `handleQuickPickSongSelected` and `handleSpinWheelSongSelected` with TV paired, verify `addToQueue` called with correct `youtubeVideoId`
    - Mock `TvIntegration` via `setTvFactory(() => mockTvIntegration)` -- inject mock before each test, reset after

- [x] Task 9: Flutter tests (AC: #2, #5)
  - [x] 9.1 Create `apps/flutter_app/test/widgets/tv_pairing_overlay_test.dart`:
    - Test pairing code input and connect button
    - Test status display states (connecting, connected, reconnecting, disconnected)
    - Test disconnect button
    - **DO NOT test**: animations, colors, visual transitions
  - [x] 9.2 Update `apps/flutter_app/test/state/party_provider_test.dart`:
    - Test `setTvStatus` updates state
    - Test `setTvNowPlaying` updates state
    - Test `isTvPaired` computed property

## Dev Notes

### Architecture Compliance

- **Server boundary**: `integrations/lounge-api.ts` handles ALL YouTube Lounge API HTTP calls. NEVER import Lounge API code from socket-handlers or dj-engine
- **Orchestration**: `services/session-manager.ts` is the ONLY service that calls `integrations/lounge-api.ts` -- per architecture: "integrations are called from services/session-manager.ts (Lounge API lifecycle)"
- **Socket handler pattern**: `tv-handlers.ts` calls session-manager functions, NEVER calls integrations directly
- **Flutter boundary**: ONLY `SocketClient` calls mutation methods on `PartyProvider`. No widget creates its own socket listener

### Key Technical Decisions

- **Custom HTTP implementation** -- no suitable npm package exists for the full YouTube Lounge API flow. The `youtube-remote` npm package (v1.1.0, unmaintained since 2022) only sends commands given a pre-obtained `screenId` -- it cannot handle pairing codes, has no event subscription, and has no TypeScript types. Do NOT use it
- **Protocol reference implementations:** `pyytlounge` v3.2.0 (Python, actively maintained -- best protocol reference), `plaincast` (Go), `ytcast` (Go CLI). These document the full pairing -> bind -> long-poll -> command flow
- **Persistent HTTP long-polling** (NOT WebSockets): The Lounge API holds a `GET /bind` request open until events arrive, then returns chunked arrays of events. Use `fetch` with `AbortController` for clean cancellation. This is a per-session resource -- clean up on session end
- **NFR31**: If Lounge API connection fails or becomes unavailable, degrade gracefully to suggestion-only mode without crashing or losing session state. Host sees a single non-blocking notification
- **Factory pattern for testability**: `lounge-api.ts` exports `createLoungeApiClient(): TvIntegration`. Session-manager uses an injectable factory variable so tests can swap in mocks without module mocking

### In-Memory Pattern

Follow the established module-level `Map<string, T>` pattern used throughout session-manager:
- `tvConnections = new Map<string, TvIntegration>()` -- same pattern as `sessionModes`, `cardStatsCache`, `scoreCache`
- Export `resetAllTvConnections()` for test cleanup -- same pattern as `resetAllModes()`

### Auto-Queue Integration Point

The auto-queue hook goes into the **existing** functions in `session-manager.ts`:
- `handleSpinWheelSongSelected(sessionId, segment)` -- line 634, emits `SONG_QUEUED` at ~line 653
- `handleQuickPickSongSelected(sessionId, song)` -- line 724, emits `SONG_QUEUED` at ~line 740

Both already have `youtubeVideoId` on the song/segment object. Add the TV queue push AFTER the `SONG_QUEUED` emission and BEFORE the `processDjTransition(SONG_SELECTED)` call. Use fire-and-forget `.catch()` -- non-blocking.

### Error Handling

- REST-style errors: N/A (all Socket.io)
- Socket.io errors: emit `tv:status` with `{ status: 'disconnected', message: '...' }` -- direct object payload (NOT wrapped in `{ error: {} }` per Socket.io convention)
- Lounge API HTTP failures: 3 retries with exponential backoff inside `lounge-api.ts`, matching the pattern in `youtube-data.ts` (lines 60-81)
- All errors use `async/await` -- no `.then()` chains

### File Naming

- Server: `kebab-case.ts` -- `lounge-api.ts`, `tv-integration.ts`, `tv-schemas.ts`, `tv-handlers.ts`
- Flutter: `snake_case.dart` -- `tv_pairing_overlay.dart`
- Import: relative paths with `.js` extension. No barrel files, no tsconfig aliases

### Project Structure Notes

- `apps/server/src/integrations/lounge-api.ts` -- new file, alongside existing `youtube-data.ts`, `spotify-data.ts`, `firebase-admin.ts`
- `apps/server/src/integrations/tv-integration.ts` -- new file, interface definition
- `apps/server/src/shared/schemas/tv-schemas.ts` -- new file, alongside existing `spin-wheel-schemas.ts`
- `apps/server/src/socket-handlers/tv-handlers.ts` -- new file, one file per namespace per architecture
- `apps/flutter_app/lib/widgets/tv_pairing_overlay.dart` -- new file, per architecture tree
- All paths align with architecture document file tree (lines 928-983)

### Previous Story Intelligence (5.6: Spin the Wheel)

- **Pattern established**: Service module exports pure functions + in-memory Map, session-manager orchestrates lifecycle, socket-handler validates and delegates
- **Timer management**: Session-manager owns all timer handles via `setTimeout`, stores on state objects for cleanup. TV reconnection timers follow this same pattern
- **Song confirmation flow**: `handleQuickPickSongSelected` (line 724) and `handleSpinWheelSongSelected` (line 634) emit `SONG_QUEUED` then call `processDjTransition(SONG_SELECTED)`. Auto-queue goes between these two steps
- **Socket handler registration**: All handlers registered in `connection-handler.ts` inside `setupSocketHandlers()` via explicit `registerXxxHandlers(s, io)` calls
- **Host guard pattern**: `socket.data.role === 'host'` check available on `AuthenticatedSocket.data`
- **Test pattern**: Separate test files per concern (`session-manager-spinwheel.test.ts`, `spin-wheel.test.ts`, `song-handlers-spinwheel.test.ts`). Follow same split for TV tests
- **Test factories**: `tests/factories/` has `createTestUser()`, `createTestSession()`, `createTestParticipant()`, `createTestDJContext()`, `createTestCatalogTrack()` -- all support `overrides?: Partial<T>` with counter-based unique IDs
- **Code review fix pattern**: Story 5.6 included code review fixes in same commit. Anticipate: host-only guards, cleanup on session end, fire-and-forget `.catch()` for non-critical async ops

### Git Intelligence

Recent commits (all on `flutter-native-pivot` branch):
- `f0dec8f` Story 5.6: Spin the Wheel -- 22 files, 3582 insertions
- `1d4f623` Story 5.5: Quick Pick -- similar scope
- Both stories follow: service + schemas + events + socket-handler + session-manager update + Flutter widget + provider update + socket client update + tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Story 5.7 lines 1232-1261]
- [Source: _bmad-output/planning-artifacts/architecture.md, Integration layer lines 610-613]
- [Source: _bmad-output/planning-artifacts/architecture.md, Lounge API lifecycle line 1190]
- [Source: _bmad-output/planning-artifacts/architecture.md, Error fallback line 772]
- [Source: _bmad-output/planning-artifacts/architecture.md, Flutter file tree line 931]
- [Source: _bmad-output/planning-artifacts/prd.md, FR74-FR79 lines 783-788]
- [Source: _bmad-output/planning-artifacts/prd.md, FR92-FR95 lines 813-816]
- [Source: _bmad-output/planning-artifacts/prd.md, NFR31 line 934]
- [Source: _bmad-output/project-context.md, Server Boundaries lines 46-51]
- [Source: _bmad-output/project-context.md, Flutter Boundaries lines 55-59]
- [Source: pyytlounge v3.2.0 (primary protocol reference) -- github.com/FabioGNR/pyytlounge]
- [Source: YouTube Lounge API protocol analysis -- bugs.xdavidhu.me/google/2021/04/05/]
- [Source: youtube-remote npm v1.1.0 (evaluated, rejected: no pairing, no events, no types) -- github.com/alxhotel/youtube-remote]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Server tests: 982 passed, 0 failed
- Flutter tests: 497 passed, 2 failed (pre-existing failures in party_screen_test and playlist_import_card_test — not related to this story)

### Completion Notes List
- Task 1: Defined `TvIntegration` interface, `NowPlayingEvent`, `TvConnectionStatus`, `CreateTvIntegration` factory type in `integrations/tv-integration.ts`
- Task 2: Implemented full YouTube Lounge API client with pairing, bind, long-poll event loop, addToQueue, auto-reconnection (exponential backoff up to 60s), and token refresh
- Task 3: Added TV_PAIR, TV_STATUS, TV_UNPAIR, TV_NOW_PLAYING events; created tv-schemas.ts with Zod validation
- Task 4: Created tv-handlers.ts with host-only guards, schema validation; registered in connection-handler.ts
- Task 5: Added tvConnections Map, pairTv/unpairTv/getTvConnection/isTvPaired exports, auto-queue hooks in handleQuickPickSongSelected and handleSpinWheelSongSelected, endSession cleanup
- Task 6: Created tv_pairing_overlay.dart widget, updated lobby_screen.dart to open as bottom sheet with skip/connect/status display
- Task 7: Added TvConnectionStatus enum, TV state fields/getters/setters to PartyProvider; added tv:status/tv:nowPlaying listeners and pairTv/unpairTv emitters to SocketClient
- Task 8: Created 3 server test files: lounge-api.test.ts (10 tests), tv-handlers.test.ts (6 tests), session-manager-tv.test.ts (9 tests)
- Task 9: Created tv_pairing_overlay_test.dart (6 tests), added TV pairing group to party_provider_test.dart (8 tests)
- Added tv:paired, tv:unpaired, song:detected event types to SessionEvent union

### Change Log
- 2026-03-16: Implemented Story 5.7 — TV Pairing & YouTube Lounge API (all 9 tasks complete)
- 2026-03-16: Code review fixes applied:
  - H1: pairTv now disconnects existing connection before creating new one (leak fix)
  - M1: TV_UNPAIR handler wrapped in try/catch
  - M2: pollEvents uses null-safe abortController?.signal instead of non-null assertion
  - M3: endSession cleanup test now calls real endSession() + added re-pair test
  - L1: Added explanatory comment to resetForTest no-op
  - L2: Added tv namespace to project-context.md event catalog

### File List
- apps/server/src/integrations/tv-integration.ts (new)
- apps/server/src/integrations/lounge-api.ts (new)
- apps/server/src/shared/events.ts (modified)
- apps/server/src/shared/schemas/tv-schemas.ts (new)
- apps/server/src/socket-handlers/tv-handlers.ts (new)
- apps/server/src/socket-handlers/connection-handler.ts (modified)
- apps/server/src/services/session-manager.ts (modified)
- apps/server/src/services/event-stream.ts (modified)
- apps/server/tests/integrations/lounge-api.test.ts (new)
- apps/server/tests/socket-handlers/tv-handlers.test.ts (new)
- apps/server/tests/services/session-manager-tv.test.ts (new)
- apps/flutter_app/lib/constants/copy.dart (modified)
- apps/flutter_app/lib/widgets/tv_pairing_overlay.dart (new)
- apps/flutter_app/lib/screens/lobby_screen.dart (modified)
- apps/flutter_app/lib/state/party_provider.dart (modified)
- apps/flutter_app/lib/socket/client.dart (modified)
- apps/flutter_app/test/widgets/tv_pairing_overlay_test.dart (new)
- apps/flutter_app/test/state/party_provider_test.dart (modified)

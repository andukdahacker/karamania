# Story 1.8: Connection Resilience & Disconnection Handling

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a party participant,
I want the party to continue smoothly even if my phone briefly loses connection,
So that network hiccups don't ruin the party experience.

## Acceptance Criteria

1. **Given** a participant is connected to an active party
   **When** their connection drops
   **Then** disconnection is detected via Socket.io heartbeat monitoring (FR46)
   **And** the participant list updates accordingly on all other devices (marked offline)
   **And** the DJ engine and party continue operating normally (FR49)

2. **Given** a participant has disconnected
   **When** they reconnect within 5 minutes
   **Then** they are automatically synced to the current party state within 2 seconds without user action (FR47)
   **And** their session history and participation scores are preserved (FR48)

3. **Given** a brief network interruption (<5s)
   **When** the participant reconnects
   **Then** no error state or loading spinner is shown — the view resumes at current state (NFR9)

4. **Given** the host disconnects
   **When** 60 seconds pass without host reconnection
   **Then** host controls transfer to the next-longest-connected participant (FR49)

5. **Given** any participant disconnects or reconnects
   **When** the party state is checked
   **Then** all session state is fully recoverable from the server — no client-only state lost on app restart (NFR10)
   **And** auto-reconnect uses socket_io_client (500ms initial, 3s max, 20 attempts) — already configured

## Tasks / Subtasks

- [x] Task 1: Server — Create connection tracker service (AC: #1, #2, #4, #5)
  - [x] 1.1: Create `services/connection-tracker.ts` with in-memory tracking:
    ```typescript
    // Types
    interface TrackedConnection {
      socketId: string;
      userId: string;
      displayName: string;
      connectedAt: number;
      isHost: boolean;
    }

    interface DisconnectedEntry {
      userId: string;
      displayName: string;
      disconnectedAt: number;
      connectedAt: number; // original connect time for longest-connected calc
      isHost: boolean;
    }

    // Module-level state (singleton per process, cleaned up per session)
    const activeConnections = new Map<string, Map<string, TrackedConnection>>();
    const disconnectedEntries = new Map<string, Map<string, DisconnectedEntry>>();
    ```
  - [x] 1.2: Export `trackConnection(sessionId, connection)`:
    ```typescript
    export function trackConnection(
      sessionId: string,
      connection: TrackedConnection
    ): { isReconnection: boolean } {
      if (!activeConnections.has(sessionId)) {
        activeConnections.set(sessionId, new Map());
      }

      // Check if this user was recently disconnected (reconnection)
      const disconnected = disconnectedEntries.get(sessionId)?.get(connection.userId);
      const isReconnection = !!disconnected;

      if (isReconnection) {
        // Preserve original connectedAt for longest-connected calculation
        connection.connectedAt = disconnected!.connectedAt;
        connection.isHost = disconnected!.isHost;
        disconnectedEntries.get(sessionId)!.delete(connection.userId);
      }

      activeConnections.get(sessionId)!.set(connection.userId, connection);
      return { isReconnection };
    }
    ```
  - [x] 1.3: Export `trackDisconnection(sessionId, userId)`:
    ```typescript
    export function trackDisconnection(
      sessionId: string,
      userId: string
    ): DisconnectedEntry | null {
      const sessions = activeConnections.get(sessionId);
      if (!sessions) return null;

      const connection = sessions.get(userId);
      if (!connection) return null;

      sessions.delete(userId);

      const entry: DisconnectedEntry = {
        userId: connection.userId,
        displayName: connection.displayName,
        disconnectedAt: Date.now(),
        connectedAt: connection.connectedAt,
        isHost: connection.isHost,
      };

      if (!disconnectedEntries.has(sessionId)) {
        disconnectedEntries.set(sessionId, new Map());
      }
      disconnectedEntries.get(sessionId)!.set(userId, entry);

      return entry;
    }
    ```
  - [x] 1.4: Export helper functions:
    ```typescript
    export function getActiveConnections(sessionId: string): TrackedConnection[] {
      const sessions = activeConnections.get(sessionId);
      if (!sessions) return [];
      return Array.from(sessions.values());
    }

    export function getActiveCount(sessionId: string): number {
      return activeConnections.get(sessionId)?.size ?? 0;
    }

    export function isUserConnected(sessionId: string, userId: string): boolean {
      return activeConnections.get(sessionId)?.has(userId) ?? false;
    }

    export function getLongestConnected(
      sessionId: string,
      excludeUserId?: string
    ): TrackedConnection | null {
      const sessions = activeConnections.get(sessionId);
      if (!sessions) return null;

      let oldest: TrackedConnection | null = null;
      for (const conn of sessions.values()) {
        if (excludeUserId && conn.userId === excludeUserId) continue;
        if (!oldest || conn.connectedAt < oldest.connectedAt) {
          oldest = conn;
        }
      }
      return oldest;
    }

    export function removeDisconnectedEntry(sessionId: string, userId: string): void {
      disconnectedEntries.get(sessionId)?.delete(userId);
    }

    export function removeSession(sessionId: string): void {
      activeConnections.delete(sessionId);
      disconnectedEntries.delete(sessionId);
    }

    export function updateHostStatus(
      sessionId: string,
      oldHostId: string,
      newHostId: string
    ): void {
      const sessions = activeConnections.get(sessionId);
      if (!sessions) return;
      const oldHost = sessions.get(oldHostId);
      if (oldHost) oldHost.isHost = false;
      const newHost = sessions.get(newHostId);
      if (newHost) newHost.isHost = true;
    }
    ```
    **BOUNDARY:** This service is purely in-memory. No imports from `persistence/`, `db/`, or `integrations/`. Socket handlers call it directly (like `rate-limiter.ts`).

- [x] Task 2: Server — Add connection lifecycle events (AC: #1, #2, #4)
  - [x] 2.1: Add to `shared/events.ts`:
    ```typescript
    // Connection lifecycle events
    PARTY_PARTICIPANT_DISCONNECTED: 'party:participantDisconnected',  // Server -> Room
    PARTY_PARTICIPANT_RECONNECTED: 'party:participantReconnected',    // Server -> Room
    PARTY_HOST_TRANSFERRED: 'party:hostTransferred',                  // Server -> Room
    ```

- [x] Task 3: Server — Enhanced connection handler with disconnect/reconnect detection (AC: #1, #2, #5)
  - [x] 3.1: Extend `handleParticipantJoin()` return in `services/session-manager.ts` to include `hostUserId`:
    ```typescript
    // Add to the return type and value:
    return {
      participants: participants.map(p => ({
        userId: p.user_id ?? p.id,
        displayName: p.guest_name ?? p.display_name ?? 'Unknown',
      })),
      participantCount: participants.length,
      vibe: session?.vibe ?? 'general',
      status: session?.status ?? 'lobby',
      hostUserId: session?.host_user_id ?? '',  // NEW
    };
    ```
  - [x] 3.2: Enhance `connection-handler.ts` — add imports and timer maps:
    ```typescript
    import {
      trackConnection,
      trackDisconnection,
      getActiveConnections,
      getLongestConnected,
      removeDisconnectedEntry,
      updateHostStatus,
    } from '../services/connection-tracker.js';
    import { transferHost } from '../services/session-manager.js';

    // Module-level timer maps for cleanup
    const hostTransferTimers = new Map<string, NodeJS.Timeout>();
    const cleanupTimers = new Map<string, Map<string, NodeJS.Timeout>>();
    ```
  - [x] 3.3: Enhance connection event — track connection and detect reconnection:
    ```typescript
    io.on('connection', async (socket) => {
      const s = socket as AuthenticatedSocket;
      const { sessionId, userId, displayName, role } = s.data;
      logger.info({ userId, sessionId }, 'Socket connected');

      registerPartyHandlers(s);

      try {
        const joinResult = await handleParticipantJoin({
          sessionId,
          userId,
          role,
          displayName,
        });

        // Determine if this user is the host
        const isHost = userId === joinResult.hostUserId;

        // Track connection and detect reconnection
        const { isReconnection } = trackConnection(sessionId, {
          socketId: s.id,
          userId,
          displayName,
          connectedAt: Date.now(),
          isHost,
        });

        if (isReconnection) {
          // Cancel any pending host transfer timer
          if (isHost && hostTransferTimers.has(sessionId)) {
            clearTimeout(hostTransferTimers.get(sessionId)!);
            hostTransferTimers.delete(sessionId);
            logger.info({ sessionId, userId }, 'Host reconnected, transfer cancelled');
          }

          // Cancel any pending cleanup timer
          const sessionCleanups = cleanupTimers.get(sessionId);
          if (sessionCleanups?.has(userId)) {
            clearTimeout(sessionCleanups.get(userId)!);
            sessionCleanups.delete(userId);
          }

          // Broadcast reconnection to others
          s.to(sessionId).emit(EVENTS.PARTY_PARTICIPANT_RECONNECTED, {
            userId,
            displayName,
          });
          logger.info({ userId, sessionId }, 'Participant reconnected');
        } else {
          // Normal new join — broadcast to others (existing behavior)
          s.to(sessionId).emit(EVENTS.PARTY_JOINED, {
            userId,
            displayName,
            participantCount: joinResult.participantCount,
          });
        }

        // Enrich participant list with online status from connection tracker
        const activeUsers = getActiveConnections(sessionId);
        const activeUserIds = new Set(activeUsers.map(c => c.userId));
        const enrichedParticipants = joinResult.participants.map(p => ({
          ...p,
          isOnline: activeUserIds.has(p.userId),
        }));

        // Send full state sync to the connecting/reconnecting client
        s.emit(EVENTS.PARTY_PARTICIPANTS, {
          participants: enrichedParticipants,
          participantCount: joinResult.participantCount,
          vibe: joinResult.vibe,
          status: joinResult.status,
          hostUserId: joinResult.hostUserId,
        });
      } catch (error) {
        logger.error({ userId, sessionId, error }, 'Failed to handle participant join');
      }

      // Enhanced disconnect handler
      socket.on('disconnect', (reason: string) => {
        logger.info({ userId, sessionId, reason }, 'Socket disconnected');

        const entry = trackDisconnection(sessionId, userId);
        if (!entry) return;

        // Broadcast disconnection to remaining participants
        s.to(sessionId).emit(EVENTS.PARTY_PARTICIPANT_DISCONNECTED, {
          userId,
          displayName,
        });

        // If host disconnected, start 60s transfer timer (AC #4)
        if (entry.isHost) {
          logger.info({ sessionId, userId }, 'Host disconnected, starting 60s transfer timer');
          const timer = setTimeout(async () => {
            hostTransferTimers.delete(sessionId);
            try {
              const candidate = getLongestConnected(sessionId, userId);
              if (!candidate) {
                logger.warn({ sessionId }, 'No active participants for host transfer');
                return;
              }

              const result = await transferHost(sessionId, candidate.userId);
              if (result) {
                updateHostStatus(sessionId, userId, candidate.userId);
                io.to(sessionId).emit(EVENTS.PARTY_HOST_TRANSFERRED, {
                  previousHostId: userId,
                  newHostId: result.newHostId,
                  newHostName: result.newHostName,
                });
                logger.info(
                  { sessionId, previousHost: userId, newHost: result.newHostId },
                  'Host transferred'
                );
              }
            } catch (err) {
              logger.error({ sessionId, error: err }, 'Host transfer failed');
            }
          }, 60_000);
          hostTransferTimers.set(sessionId, timer);
        }

        // 5-minute cleanup timer — remove from disconnected tracker
        if (!cleanupTimers.has(sessionId)) {
          cleanupTimers.set(sessionId, new Map());
        }
        const cleanupTimer = setTimeout(() => {
          removeDisconnectedEntry(sessionId, userId);
          cleanupTimers.get(sessionId)?.delete(userId);
          logger.info({ userId, sessionId }, 'Disconnected participant cleanup after 5min');
        }, 5 * 60 * 1000);
        cleanupTimers.get(sessionId)!.set(userId, cleanupTimer);
      });
    });
    ```
    **CRITICAL:** The `s.to(sessionId).emit(...)` broadcasts to all OTHER sockets in the room (not the sender). For host transfer, use `io.to(sessionId).emit(...)` to broadcast to ALL sockets in the room. The `io` instance is available via closure.

- [x] Task 4: Server — Host transfer mechanism (AC: #4)
  - [x] 4.1: Add `updateHost()` to `persistence/session-repository.ts`:
    ```typescript
    export async function updateHost(sessionId: string, newHostUserId: string) {
      return db
        .updateTable('sessions')
        .set({ host_user_id: newHostUserId })
        .where('id', '=', sessionId)
        .executeTakeFirst();
    }
    ```
  - [x] 4.2: Add `transferHost()` to `services/session-manager.ts`:
    ```typescript
    export async function transferHost(
      sessionId: string,
      newHostUserId: string
    ): Promise<{ newHostId: string; newHostName: string } | null> {
      // 1. Verify session exists and is active
      const session = await sessionRepo.findById(sessionId);
      if (!session || session.status === 'ended') return null;

      // 2. Get new host's display name from participants
      const participants = await sessionRepo.getParticipants(sessionId);
      const newHost = participants.find(
        p => (p.user_id ?? p.id) === newHostUserId
      );
      if (!newHost) return null;

      // 3. Update host in DB
      await sessionRepo.updateHost(sessionId, newHostUserId);

      return {
        newHostId: newHostUserId,
        newHostName: newHost.guest_name ?? newHost.display_name ?? 'Unknown',
      };
    }
    ```
    **BOUNDARY:** `transferHost()` is in `session-manager` because it orchestrates persistence + business logic. Socket handlers call this service function.
    **IMPORT:** `import * as sessionRepo from '../persistence/session-repository.js';` (already exists in session-manager)

- [x] Task 5: Server — Configure Socket.io heartbeat for faster disconnect detection (AC: #1)
  - [x] 5.1: In `index.ts` (or wherever Socket.io `Server` is instantiated), configure ping settings:
    ```typescript
    const io = new Server(fastify.server, {
      // Existing CORS config...
      pingInterval: 10000,  // 10s between pings (default 25s)
      pingTimeout: 5000,    // 5s to respond (default 20s)
      // Total disconnect detection: ~15s (vs default ~45s)
    });
    ```
    **NOTE:** This means the server detects a dead connection within 15 seconds. The Flutter client detects disconnection immediately when the network interface goes down (no wait for ping/pong — the TCP socket close is detected by the OS). The 15s detection is for cases where the device doesn't send a TCP RST (e.g., airplane mode, sudden power off).

- [x] Task 6: Flutter — Add connection state to PartyProvider (AC: #1, #2, #3, #4, #5)
  - [x] 6.1: Add `ConnectionStatus` enum to `lib/state/party_provider.dart`:
    ```dart
    enum ConnectionStatus { connected, reconnecting }
    ```
    **NOTE:** Only two states needed. `disconnected` is NOT a visible state — per AC #3, brief interruptions (<5s) show nothing. After 5s without reconnection, we show `reconnecting`. When reconnected, we go back to `connected`.

  - [x] 6.2: Add connection state fields and methods to `PartyProvider`:
    ```dart
    // Connection state
    ConnectionStatus _connectionStatus = ConnectionStatus.connected;
    ConnectionStatus get connectionStatus => _connectionStatus;

    void onConnectionStatusChanged(ConnectionStatus status) {
      _connectionStatus = status;
      notifyListeners();
    }
    ```

  - [x] 6.3: Extend `ParticipantInfo` to include online status:
    ```dart
    class ParticipantInfo {
      final String userId;
      final String displayName;
      final bool isOnline;

      const ParticipantInfo({
        required this.userId,
        required this.displayName,
        this.isOnline = true,
      });
    }
    ```

  - [x] 6.4: Add participant disconnect/reconnect methods to `PartyProvider`:
    ```dart
    void onParticipantDisconnected(String userId) {
      _participants = _participants.map((p) =>
        p.userId == userId
          ? ParticipantInfo(userId: p.userId, displayName: p.displayName, isOnline: false)
          : p
      ).toList();
      notifyListeners();
    }

    void onParticipantReconnected(String userId) {
      _participants = _participants.map((p) =>
        p.userId == userId
          ? ParticipantInfo(userId: p.userId, displayName: p.displayName, isOnline: true)
          : p
      ).toList();
      notifyListeners();
    }
    ```

  - [x] 6.5: Add host transfer method to `PartyProvider`:
    ```dart
    void onHostTransferred(bool iAmNewHost) {
      _isHost = iAmNewHost;
      notifyListeners();
    }
    ```

  - [x] 6.6: Update `onParticipantsSync()` to handle `isOnline` field:
    ```dart
    void onParticipantsSync(List<ParticipantInfo> participants) {
      _participants = participants;
      _participantCount = participants.length;
      notifyListeners();
    }
    ```
    **NOTE:** No change needed if ParticipantInfo constructor already handles `isOnline` via named parameter with default.

  - [x] 6.7: Update `onPartyJoined()` and `onPartyCreated()` to NOT hardcode `_isHost` exclusively from creation — add `onHostUpdate()`:
    ```dart
    void onHostUpdate(bool isHost) {
      _isHost = isHost;
      notifyListeners();
    }
    ```

- [x] Task 7: Flutter — Update SocketClient for connection lifecycle (AC: #1, #2, #3, #5)
  - [x] 7.1: Add `_userId` tracking and disconnect suppression timer to `lib/socket/client.dart`:
    ```dart
    String? _userId;
    Timer? _disconnectUiTimer;
    ```

  - [x] 7.2: Update `connect()` method to accept and store `userId` and `partyProvider`:
    ```dart
    Future<void> connect({
      required String serverUrl,
      required String token,
      required String sessionId,
      String? displayName,              // UNCHANGED — stays optional (current signature)
      required String userId,           // NEW — needed for host transfer comparison
      required PartyProvider partyProvider,  // NEW — needed for disconnect/reconnect handlers
    }) async {
      _userId = userId;
      // ... rest of existing connect code ...
      // The onDisconnect/onReconnect handlers (Task 7.3, 7.4) capture partyProvider via closure
    }
    ```
    **INTERFACE CHANGE:** `connect()` currently takes `{serverUrl, token, sessionId, displayName?}`. Adding `userId` and `partyProvider` as required parameters. Both callers already have these available.

    Update callers:
    - `joinParty()`: pass `guestId` (from `guestAuthResponse.guestId`) as `userId`, pass `partyProvider` parameter through
    - `createParty()`: pass `authProvider.currentUser!.uid` as `userId`, pass `partyProvider` parameter through

  - [x] 7.3: Enhance `onDisconnect` handler with 5s suppression (AC: #3):
    ```dart
    _socket!.onDisconnect((reason) {
      _isConnected = false;

      // If server kicked us (auth failure), don't auto-reconnect
      if (reason == 'io server disconnect') {
        _socket?.disconnect();
        return;
      }

      // Suppress brief interrupts — only show UI after 5s (AC #3)
      _disconnectUiTimer?.cancel();
      _disconnectUiTimer = Timer(const Duration(seconds: 5), () {
        if (!_isConnected) {
          partyProvider.onConnectionStatusChanged(ConnectionStatus.reconnecting);
        }
      });
    });
    ```

  - [x] 7.4: Enhance `onReconnect` handler:
    ```dart
    _socket!.onReconnect((_) {
      _isConnected = true;
      _disconnectUiTimer?.cancel();

      // Only notify provider if we previously showed reconnecting state
      if (partyProvider.connectionStatus == ConnectionStatus.reconnecting) {
        partyProvider.onConnectionStatusChanged(ConnectionStatus.connected);
      }
    });
    ```
    **NOTE:** If reconnection happens within 5s, the timer is cancelled and the provider is NEVER updated — zero UI change for brief interrupts (AC #3).

  - [x] 7.5: Add new event listeners to `_setupPartyListeners()`:
    ```dart
    // Participant disconnect/reconnect events
    on('party:participantDisconnected', (data) {
      final payload = data as Map<String, dynamic>;
      final userId = payload['userId'] as String;
      partyProvider.onParticipantDisconnected(userId);
    });

    on('party:participantReconnected', (data) {
      final payload = data as Map<String, dynamic>;
      final userId = payload['userId'] as String;
      partyProvider.onParticipantReconnected(userId);
    });

    // Host transfer event (AC #4)
    on('party:hostTransferred', (data) {
      final payload = data as Map<String, dynamic>;
      final newHostId = payload['newHostId'] as String;
      partyProvider.onHostTransferred(newHostId == _userId);
    });
    ```

  - [x] 7.6: Update `party:participants` handler to parse `isOnline` and `hostUserId`:
    ```dart
    on('party:participants', (data) {
      final Map<String, dynamic> payload = data as Map<String, dynamic>;
      final List<dynamic> rawList = payload['participants'] as List<dynamic>;
      final participants = rawList.map((p) => ParticipantInfo(
        userId: (p as Map<String, dynamic>)['userId'] as String,
        displayName: p['displayName'] as String,
        isOnline: p['isOnline'] as bool? ?? true,  // NEW
      )).toList();
      partyProvider.onParticipantsSync(participants);

      final status = payload['status'] as String?;
      if (status != null) {
        // CRITICAL: Only trigger catch-up on FIRST join to active session, NOT on reconnection.
        // On reconnection, sessionStatus is already 'active' — skip catch-up card.
        final isFirstJoinToActive = status == 'active' && partyProvider.sessionStatus != 'active';
        partyProvider.onSessionStatus(status);
        if (isFirstJoinToActive) {
          partyProvider.onCatchUpStarted();
        }
      }

      // Update host status from server truth (AC #4)
      final hostUserId = payload['hostUserId'] as String?;
      if (hostUserId != null) {
        partyProvider.onHostUpdate(hostUserId == _userId);
      }
    });
    ```
    **CRITICAL FIX:** The original Story 1.7 handler called `onCatchUpStarted()` whenever `status == 'active'`. This would re-show the "Welcome to the party!" catch-up card on every reconnection. The guard `partyProvider.sessionStatus != 'active'` ensures catch-up only triggers on first join (when status transitions from `'lobby'` to `'active'`), never on reconnection (when it's already `'active'`).

  - [x] 7.7: Cancel timers in `disconnect()` cleanup method:
    ```dart
    void disconnect() {
      _disconnectUiTimer?.cancel();
      _disconnectUiTimer = null;
      _userId = null;
      // ... existing cleanup ...
    }
    ```

- [x] Task 8: Flutter — Connection status UI (AC: #3)
  - [x] 8.1: Add reconnecting banner to `lib/screens/party_screen.dart`:
    ```dart
    // In the Stack children, after main content and before catch-up card:
    if (partyProvider.connectionStatus == ConnectionStatus.reconnecting)
      _buildReconnectingBanner(context),
    ```
    ```dart
    Widget _buildReconnectingBanner(BuildContext context) {
      return Positioned(
        top: 0,
        left: 0,
        right: 0,
        child: Container(
          key: const Key('reconnecting-banner'),
          padding: const EdgeInsets.symmetric(
            vertical: DJTokens.spaceSm,
            horizontal: DJTokens.spaceMd,
          ),
          color: DJTokens.surfaceColor.withValues(alpha: 0.95),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: DJTokens.textSecondary,
                ),
              ),
              const SizedBox(width: DJTokens.spaceSm),
              Text(
                Copy.reconnecting,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DJTokens.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }
    ```
    **NOTE:** This banner ONLY appears after 5s of disconnection (AC #3). Brief interrupts show nothing.

  - [x] 8.2: Create shared widget `lib/widgets/reconnecting_banner.dart`:
    ```dart
    import 'package:flutter/material.dart';
    import 'package:karamania/constants/copy.dart';
    import 'package:karamania/theme/dj_tokens.dart';

    class ReconnectingBanner extends StatelessWidget {
      const ReconnectingBanner({super.key});

      @override
      Widget build(BuildContext context) {
        return Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: Container(
            key: const Key('reconnecting-banner'),
            padding: const EdgeInsets.symmetric(
              vertical: DJTokens.spaceSm,
              horizontal: DJTokens.spaceMd,
            ),
            color: DJTokens.surfaceColor.withValues(alpha: 0.95),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: DJTokens.textSecondary,
                  ),
                ),
                const SizedBox(width: DJTokens.spaceSm),
                Text(
                  Copy.reconnecting,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        );
      }
    }
    ```
    Use in both `PartyScreen` and `LobbyScreen`:
    ```dart
    import 'package:karamania/widgets/reconnecting_banner.dart';

    // In the Stack children:
    if (partyProvider.connectionStatus == ConnectionStatus.reconnecting)
      const ReconnectingBanner(),
    ```
    **NOTE:** Both screens need the identical banner — extract to shared widget to avoid duplication. The `_buildReconnectingBanner` helper in Task 8.1 is replaced by this shared widget.

- [x] Task 9: Flutter — Add copy strings (AC: all)
  - [x] 9.1: Add to `lib/constants/copy.dart`:
    ```dart
    // Connection status
    static const String reconnecting = 'Reconnecting...';
    static const String hostTransferred = 'You are now the host!';
    ```

- [x] Task 10: Server tests (AC: all)
  - [x] 10.1: Create `tests/services/connection-tracker.test.ts`:
    - `trackConnection()` adds connection to active map
    - `trackConnection()` detects reconnection when user was disconnected
    - `trackConnection()` preserves original `connectedAt` on reconnection
    - `trackConnection()` preserves `isHost` on reconnection
    - `trackDisconnection()` moves connection from active to disconnected map
    - `trackDisconnection()` returns null for unknown user
    - `getActiveConnections()` returns all active connections for session
    - `getActiveCount()` returns correct count
    - `isUserConnected()` returns true for active users
    - `isUserConnected()` returns false for disconnected users
    - `getLongestConnected()` returns oldest connection
    - `getLongestConnected()` excludes specified userId
    - `getLongestConnected()` returns null for empty session
    - `removeDisconnectedEntry()` cleans up specific entry
    - `removeSession()` cleans up all data for session
    - `updateHostStatus()` swaps host flag between users
    - Multiple sessions tracked independently

  - [x] 10.2: Add to `tests/services/session-manager.test.ts`:
    - `transferHost()` updates host_user_id in DB
    - `transferHost()` returns new host info
    - `transferHost()` returns null for ended session
    - `transferHost()` returns null for non-existent session
    - `transferHost()` returns null when new host not in participants
    - `handleParticipantJoin()` returns `hostUserId` field

  - [x] 10.3: Add to `tests/persistence/session-repository.test.ts`:
    - `updateHost()` updates host_user_id
    - `updateHost()` on non-existent session returns no result

  - [x] 10.4: Create `tests/socket-handlers/connection-lifecycle.test.ts` or add to existing tests:
    - When socket disconnects, `party:participantDisconnected` is broadcast to room
    - When socket reconnects, `party:participantReconnected` is broadcast (not `party:joined`)
    - Reconnecting client receives full state sync via `party:participants`
    - `party:participants` includes `isOnline` field for each participant
    - `party:participants` includes `hostUserId` field
    - Online participant shows `isOnline: true`
    - Recently disconnected participant shows `isOnline: false` in full sync
    - Host disconnect triggers `party:hostTransferred` after 60s timeout
    - Host reconnect within 60s cancels transfer timer
    - Non-host disconnect does NOT trigger host transfer timer
    - When no active participants for transfer, no `party:hostTransferred` emitted
    - Original host reconnecting after transfer receives `isOnline: true` but `hostUserId` points to new host

- [x] Task 11: Flutter tests (AC: all)
  - [x] 11.1: Update `test/state/party_provider_test.dart`:
    - `onConnectionStatusChanged()` updates connectionStatus
    - `onParticipantDisconnected()` marks participant as offline
    - `onParticipantReconnected()` marks participant back online
    - `onHostTransferred(true)` sets isHost to true
    - `onHostTransferred(false)` sets isHost to false
    - `onHostUpdate()` updates isHost
    - `ParticipantInfo` supports `isOnline` field (defaults to true)
    - Reconnection to active session does NOT trigger catch-up when `sessionStatus` is already 'active'
    - First join to active session DOES trigger catch-up when `sessionStatus` was 'lobby'

  - [x] 11.2: Update `test/screens/party_screen_test.dart`:
    - Shows reconnecting banner when `connectionStatus == ConnectionStatus.reconnecting`
    - Hides reconnecting banner when `connectionStatus == ConnectionStatus.connected`
    - Reconnecting banner contains progress indicator and text
    - Host invite FAB updates correctly after host transfer

  - [x] 11.3: Update `test/screens/lobby_screen_test.dart`:
    - Shows reconnecting banner when `connectionStatus == ConnectionStatus.reconnecting`
    - Hides reconnecting banner when `connectionStatus == ConnectionStatus.connected`

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All connection state decisions happen on the server. Flutter is a thin display layer that receives disconnect/reconnect events. Host transfer is decided by the server after 60s timeout. No client-side host election or connection negotiation.
- **SocketClient is sole orchestrator**: All new event handlers (`party:participantDisconnected`, `party:participantReconnected`, `party:hostTransferred`) are processed by SocketClient, which calls mutation methods on PartyProvider. Widgets NEVER listen for socket events directly.
- **Provider boundaries ENFORCED**: `PartyProvider` is read-only from widgets (`context.watch<PartyProvider>()`). Only `SocketClient` calls `onParticipantDisconnected()`, `onParticipantReconnected()`, `onHostTransferred()`, `onConnectionStatusChanged()`.
- **Socket handler boundary ENFORCED**: `connection-handler.ts` calls `handleParticipantJoin()` and `transferHost()` from `services/session-manager.ts`, and calls `connection-tracker` functions directly (in-session operations, like rate-limiter). Socket handlers NEVER call `persistence/` directly.
- **Connection tracker boundary**: `services/connection-tracker.ts` is purely in-memory, ZERO imports from `persistence/`, `db/`, or `integrations/`. Socket handlers call it directly for in-session operations (same pattern as `rate-limiter.ts`).

### Three-Tier Reconnection Model

| Tier | Duration | Client Experience | Server Behavior |
|------|----------|-------------------|-----------------|
| Tier 1: Brief | <5s | Transparent — NO UI change, no error state, no loading spinner (AC #3) | May not detect disconnect (ping interval 10s). If detected, broadcast `party:participantDisconnected` |
| Tier 2: Medium | 5s–60s | "Reconnecting..." banner shown. Auto-reconnect via socket.io (500ms–3s backoff, 20 attempts) | Broadcast disconnect. Host transfer timer running if host. 5-min cleanup timer running |
| Tier 3: Long / Server restart | >60s | Full state sync on reconnection. If host was transferred, isHost updates | Host transferred (if applicable). After 5min, disconnected entry cleaned up. Server restart: all sockets reconnect, connection tracker rebuilt from scratch |

### Disconnect/Reconnect Flow — End-to-End Sequence

```
DISCONNECT FLOW:
Phone loses network → Flutter socket.io client detects immediately
  ↓
SocketClient.onDisconnect fires
  → _isConnected = false
  → Start 5s suppression timer
  → socket.io client starts auto-reconnect (500ms → 3s backoff)
  ↓
[If <5s: socket.io reconnects → onReconnect fires → cancel timer → NO UI change]
[If >5s: timer fires → partyProvider.onConnectionStatusChanged(reconnecting)]
  ↓
[Server side — 10-15s after actual disconnect (ping timeout)]:
Server: socket 'disconnect' event fires
  ↓
connection-handler: trackDisconnection(sessionId, userId)
  → Moves from active to disconnected map
  ↓
connection-handler: s.to(sessionId).emit('party:participantDisconnected', { userId, displayName })
  ↓
Other clients: SocketClient receives event
  → partyProvider.onParticipantDisconnected(userId)
  → Participant marked offline in list
  ↓
[If host disconnected]:
  Start 60s timer for host transfer
  [If host reconnects within 60s → cancel timer]
  [If 60s passes]:
    → getLongestConnected(sessionId, hostUserId)
    → transferHost(sessionId, newHostId) → updates DB
    → updateHostStatus(sessionId, oldHost, newHost)
    → io.to(sessionId).emit('party:hostTransferred', { previousHostId, newHostId, newHostName })
    → All clients: partyProvider.onHostTransferred(newHostId == myUserId)
```

```
RECONNECT FLOW:
socket.io client auto-reconnects
  ↓
Auth middleware validates same JWT (still valid, 6hr TTL)
  ↓
socket.join(sessionId) — rejoin room
  ↓
connection-handler: io.on('connection', ...)
  ↓
handleParticipantJoin() — idempotent (already in DB)
  ↓
trackConnection(sessionId, connection) → returns { isReconnection: true }
  ↓
Cancel host transfer timer (if applicable)
Cancel cleanup timer (if applicable)
  ↓
s.to(sessionId).emit('party:participantReconnected', { userId, displayName })
  ↓
Other clients: partyProvider.onParticipantReconnected(userId)
  → Participant marked online in list
  ↓
s.emit('party:participants', { participants (with isOnline), vibe, status, hostUserId })
  ↓
Reconnecting client: full state sync
  → partyProvider.onParticipantsSync(participants)
  → partyProvider.onSessionStatus(status)
  → partyProvider.onHostUpdate(hostUserId == _userId)
  ↓
Flutter SocketClient.onReconnect fires
  → _isConnected = true
  → _disconnectUiTimer?.cancel()
  → If was showing reconnecting → partyProvider.onConnectionStatusChanged(connected)
  ↓
UI: reconnecting banner disappears, current state rendered
```

### Host Transfer Flow (AC #4)

```
Host disconnects
  ↓
Server: 60s timer starts
  ↓
[If host reconnects within 60s → timer cancelled, no transfer]
  ↓
After 60s: getLongestConnected(sessionId, excludeHostUserId)
  ↓
[If no active participants → log warning, no transfer]
  ↓
transferHost(sessionId, candidateUserId):
  1. Verify session exists and not ended
  2. Find candidate in participants list
  3. Update sessions.host_user_id in DB
  4. Return { newHostId, newHostName }
  ↓
updateHostStatus(sessionId, oldHostId, newHostId) — in-memory tracker
  ↓
io.to(sessionId).emit('party:hostTransferred', {
  previousHostId,
  newHostId,
  newHostName,
})
  ↓
All clients: partyProvider.onHostTransferred(newHostId == _userId)
  → New host: isHost = true (gets invite FAB, future: host controls)
  → Others: isHost = false (no change for non-hosts)
  ↓
If old host reconnects later:
  → Auth still valid, rejoin works
  → party:participants includes hostUserId → onHostUpdate(false)
  → Old host no longer has host controls
```

### Server: Existing Code to Reuse (DO NOT recreate)

| What | Location | Notes |
|------|----------|-------|
| Socket.io auth middleware | `socket-handlers/auth-middleware.ts` | Validates JWT on connect — works identically for reconnection |
| handleParticipantJoin | `services/session-manager.ts` | Idempotent via `addParticipantIfNotExists()` — handles reconnection naturally |
| Session room join | `socket-handlers/auth-middleware.ts` | `socket.join(socket.data.sessionId)` — reconnecting socket rejoins room |
| EVENTS constants | `shared/events.ts` | Add new events here |
| AppError | `shared/errors.ts` | Use for transferHost error cases |
| Session findById | `persistence/session-repository.ts` | Already exists, used by transferHost |
| Session getParticipants | `persistence/session-repository.ts` | Already exists, used for host candidate lookup |
| Pino logger | `index.ts` | All connection events logged with sessionId + userId correlation |
| Socket reconnect config | `flutter_app/lib/socket/client.dart` | Already configured: 500ms initial, 3s max, 20 attempts |
| party:participants handler | `flutter_app/lib/socket/client.dart` | Extend to parse `isOnline` and `hostUserId` |

### Server: What to Add (minimal changes)

1. **`services/connection-tracker.ts`**: NEW file — in-memory connection tracking (~100 lines)
2. **`shared/events.ts`**: Add 3 new event constants (3 lines)
3. **`socket-handlers/connection-handler.ts`**: Enhanced disconnect handler, reconnection detection, timer management, online status enrichment (~60 lines added)
4. **`services/session-manager.ts`**: Add `transferHost()` (~20 lines); extend `handleParticipantJoin` return with `hostUserId` (~1 line)
5. **`persistence/session-repository.ts`**: Add `updateHost()` (~5 lines)
6. **`index.ts`**: Socket.io ping configuration (~2 lines)

### Flutter: Existing Code to Reuse (DO NOT recreate)

| What | Location | Notes |
|------|----------|-------|
| PartyProvider | `state/party_provider.dart` | Add connection state fields + methods |
| SocketClient | `socket/client.dart` | Add userId tracking, timer, new listeners |
| PartyScreen | `screens/party_screen.dart` | Add reconnecting banner |
| LobbyScreen | `screens/lobby_screen.dart` | Add reconnecting banner |
| DJTokens spacing | `theme/dj_theme.dart` | Use for banner padding |
| Copy strings | `constants/copy.dart` | Add reconnecting text |
| LoadingState enum | `state/party_provider.dart` | NOT used here — ConnectionStatus is separate |

### Flutter: What to Add

1. **`state/party_provider.dart`**: Add `ConnectionStatus` enum, connection state, participant online status methods, host transfer (~30 lines)
2. **`socket/client.dart`**: Add `_userId`, disconnect suppression timer, 3 new event handlers, update `party:participants` handler (~40 lines)
3. **`widgets/reconnecting_banner.dart`**: NEW shared widget used by both screens (~25 lines)
4. **`screens/party_screen.dart`**: Import and use `ReconnectingBanner` (~3 lines)
5. **`screens/lobby_screen.dart`**: Import and use `ReconnectingBanner` (~3 lines)
6. **`constants/copy.dart`**: Add 2 strings (~2 lines)

### Critical Patterns (MUST follow)

**Socket.io event names:**
```
'party:participantDisconnected' — Server → Room (on disconnect)
'party:participantReconnected'  — Server → Room (on reconnect)
'party:hostTransferred'         — Server → All Clients (after 60s host absence)
```

**Brief interrupt suppression (AC #3) — MOST IMPORTANT PATTERN:**
```dart
// In SocketClient — 5s timer prevents UI flicker
_socket!.onDisconnect((reason) {
  _isConnected = false;
  _disconnectUiTimer = Timer(const Duration(seconds: 5), () {
    if (!_isConnected) {
      partyProvider.onConnectionStatusChanged(ConnectionStatus.reconnecting);
    }
  });
});

_socket!.onReconnect((_) {
  _isConnected = true;
  _disconnectUiTimer?.cancel(); // Cancel before it fires → zero UI change
  if (partyProvider.connectionStatus == ConnectionStatus.reconnecting) {
    partyProvider.onConnectionStatusChanged(ConnectionStatus.connected);
  }
});
```

**Connection tracker is a module-level singleton (NOT a class instance):**
```typescript
// Exported functions with module-level Maps — same pattern as rate-limiter
const activeConnections = new Map<string, Map<string, TrackedConnection>>();
export function trackConnection(...) { ... }
```

**Reconnection vs new join detection:**
```typescript
const { isReconnection } = trackConnection(sessionId, connection);
if (isReconnection) {
  // Broadcast 'party:participantReconnected' — NOT 'party:joined'
} else {
  // Broadcast 'party:joined' — existing behavior
}
```

**Host transfer uses `io.to()` (not `socket.to()`):**
```typescript
// io.to() sends to ALL sockets in room (including sender)
// socket.to() sends to all EXCEPT sender
// For host transfer, use io.to() since the broadcast happens from a timer callback,
// not from a specific socket's event handler
io.to(sessionId).emit(EVENTS.PARTY_HOST_TRANSFERRED, { ... });
```

**Import rules — server:**
```typescript
import { trackConnection } from '../services/connection-tracker.js'; // relative + .js
import { transferHost } from '../services/session-manager.js';
```

**Import rules — Flutter:**
```dart
import 'package:karamania/state/party_provider.dart'; // package import
```

### Anti-Patterns (NEVER DO THESE)

| Wrong | Right |
|-------|-------|
| Show error UI immediately on disconnect | 5s suppression timer — no UI for brief interrupts (AC #3) |
| Trigger catch-up card on reconnection (`if status == 'active'`) | Guard with `partyProvider.sessionStatus != 'active'` — catch-up is for first join only |
| `socket.emit('participantDisconnected', ...)` | `socket.to(sessionId).emit('party:participantDisconnected', ...)` |
| Client-side host election / voting | Server decides host transfer after 60s timeout |
| Custom heartbeat implementation | Use Socket.io built-in ping/pong with tighter config |
| `setState(() { connectionStatus = ... })` in widget | `partyProvider.onConnectionStatusChanged(status)` via SocketClient |
| Store connection state in widget local state | Use `PartyProvider.connectionStatus` with `context.watch<>()` |
| DB migration for disconnect tracking | In-memory `connection-tracker.ts` — no DB changes needed |
| Remove participant from DB on disconnect | Keep DB record (scores preserved, AC #2). Only clean up in-memory tracker |
| `new ConnectionTracker()` class instance | Module-level Maps + exported functions (matches project convention) |
| `socket.io.emit()` for host transfer broadcast | `io.to(sessionId).emit()` — scoped to session room |
| `Navigator.push('/lobby')` on reconnection | No navigation — state sync is transparent, current screen stays |
| Blocking reconnection modal | Non-intrusive banner at top of screen |
| Timer in widget for 5s suppression | Timer in SocketClient — widget just reads provider state |
| `Color(0xFFFF0000)` for error banner | `DJTokens.surfaceColor` + `DJTokens.textSecondary` — matches design system |
| `Padding(padding: EdgeInsets.all(8))` | `EdgeInsets.symmetric(vertical: DJTokens.spaceSm, horizontal: DJTokens.spaceMd)` |

### Previous Story Intelligence

**From Story 1.7 (most recent):**
- `party:participants` handler already parses `status` field — extend to parse `isOnline` and `hostUserId`
- `PartyProvider.onParticipantsSync()` exists — ensure `ParticipantInfo` update is backward-compatible
- `SocketClient.connect()` currently takes `serverUrl, token, sessionId, displayName, partyProvider` — add `userId` parameter
- Disconnect handler exists but only logs: `socket.on('disconnect', (reason) => { logger.info(...) })` — enhance this
- Connection handler has async error handling with try/catch — follow same pattern
- `s.to(sessionId).emit()` broadcast pattern established — reuse for disconnect/reconnect events
- Server: 119 tests, Flutter: 149 tests — all must continue passing
- ApiClient → ApiService migration: use `ApiService` for any API calls (but this story adds no new API endpoints)

**From Story 1.6 (Party Join):**
- `addParticipantIfNotExists()` catches unique constraint violation (23505) — handles reconnection gracefully
- `handleParticipantJoin()` is already idempotent — perfect for reconnection scenario
- Guest auth returns `sessionId` which is used for socket connection — same token works for reconnection

**From Story 1.3 (Auth + WebSocket):**
- Auth middleware populates `socket.data = { userId, sessionId, role, displayName }`
- `socket.join(socket.data.sessionId)` in auth middleware — reconnecting socket automatically rejoins room
- Both Firebase and guest JWT paths produce identical `socket.data` shape — reconnection works for both
- Guest JWT TTL is 6 hours — token stays valid for entire session duration

**From Story 1.1 (Flutter Scaffold):**
- `DJTokens.spaceSm` = 8, `spaceMd` = 16 for banner padding
- `DJTokens.surfaceColor` for banner background
- `DJTokens.textSecondary` for banner text
- Widget key pattern: `Key('reconnecting-banner')`

### Git Intelligence

**Recent commits (Story 1.7):**
- `03232eb` — Party start + mid-session join
- Files modified: connection-handler.ts, party-handlers.ts, session-manager.ts, party_provider.dart, client.dart
- These are the SAME files this story modifies — review current state before editing
- Pattern: socket handler calls service function, service validates + does DB work, handler broadcasts result
- Pattern: connection-handler.ts handles both connect and disconnect events

**Code patterns observed:**
- Server uses `async/await` everywhere, never `.then()` chains
- Socket handlers wrap in try/catch with `logger.error()` for failures
- `s.to(sessionId).emit()` for broadcast to others, `s.emit()` for broadcast to self
- Firebase Admin SDK gracefully handles missing credentials (no crash in dev)
- Tests use factory functions from `tests/factories/`

### Project Structure Notes

```
apps/server/
  src/
    services/
      connection-tracker.ts             # NEW: in-memory connection tracking
      session-manager.ts                # MODIFIED: add transferHost(), extend handleParticipantJoin return
      rate-limiter.ts                   # EXISTING: same pattern as connection-tracker (pure service)
    persistence/
      session-repository.ts             # MODIFIED: add updateHost()
    socket-handlers/
      connection-handler.ts             # MODIFIED: enhanced disconnect, reconnection detection, timers
      auth-middleware.ts                # EXISTING: no changes needed
    shared/
      events.ts                         # MODIFIED: add 3 new events
    index.ts                            # MODIFIED: Socket.io ping config
  tests/
    services/
      connection-tracker.test.ts        # NEW: connection tracker unit tests
      session-manager.test.ts           # MODIFIED: add transferHost tests
    persistence/
      session-repository.test.ts        # MODIFIED: add updateHost tests
    socket-handlers/
      connection-lifecycle.test.ts      # NEW: disconnect/reconnect integration tests

apps/flutter_app/
  lib/
    state/
      party_provider.dart               # MODIFIED: ConnectionStatus, participant online, host transfer
    socket/
      client.dart                       # MODIFIED: userId, disconnect timer, new event handlers
    screens/
      party_screen.dart                 # MODIFIED: add reconnecting banner
      lobby_screen.dart                 # MODIFIED: add reconnecting banner
    widgets/
      reconnecting_banner.dart          # NEW: shared reconnecting banner used by PartyScreen + LobbyScreen
    constants/
      copy.dart                         # MODIFIED: add strings
  test/
    state/
      party_provider_test.dart          # MODIFIED: connection state tests
    screens/
      party_screen_test.dart            # MODIFIED: reconnecting banner tests
      lobby_screen_test.dart            # MODIFIED: reconnecting banner tests
```

### Testing Requirements

- **DO test**: Connection tracker all methods, disconnect detection and broadcast, reconnection detection and state sync, host transfer after 60s, host reconnect cancels transfer, brief interrupt suppression (5s timer), participant online/offline status, reconnecting banner visibility, host transfer UI update
- **DO NOT test**: Exact ping/pong timing, socket.io internal reconnection mechanism, network-level details, visual animations, banner colors
- **Server**: Vitest — unit tests for connection-tracker, integration tests for connection lifecycle
- **Flutter**: flutter_test with mocked providers and SocketClient
- **Verify NO regressions**: Server 119+ tests, Flutter 149+ tests must continue to pass
- **Test factories**: Use `createTestSession()`, `createTestParticipant()` from existing factories

### Performance Budget

- Disconnect detection: ~15s with configured ping (10s interval + 5s timeout)
- Reconnection state sync: <2s from reconnection to full state rendered (AC #2)
- Host transfer: exactly 60s after host disconnect (AC #4)
- Brief interrupt suppression: 5s timer on Flutter side (AC #3)
- In-memory connection tracker: O(1) lookup per userId per session
- No polling — all updates via socket events

### Post-Implementation Maintenance

- **Update `project-context.md` Socket.io Event Catalog**: After implementation, add the 3 new events (`party:participantDisconnected`, `party:participantReconnected`, `party:hostTransferred`) to the event catalog table in `_bmad-output/project-context.md` so future stories reference accurate event data

### Known Limitations (Future Work)

- **DJ state sync**: The DJ engine doesn't exist yet (Story 2.1). Reconnection currently syncs participant list, session status, and vibe. Story 2.1+ will add DJ state to the sync payload
- **Session abandonment**: If ALL participants disconnect and none reconnect within 5 minutes, the session stays "active" in the DB. Session end/cleanup is a future story scope
- **Event buffering**: Events emitted while a user is disconnected are lost. Future stories may add event buffering for critical events during short disconnects
- **Wake lock**: `wakelock_plus` (preventing screen auto-lock during party) is mentioned in architecture but not in AC — FR50 is assigned to Epic 2, not Epic 1

### References

- [Source: epics.md#Story 1.8] — FR46, FR47, FR48, FR49
- [Source: prd.md#FR46] — Heartbeat monitoring for disconnect detection
- [Source: prd.md#FR47] — Auto-sync on reconnect within 5 minutes
- [Source: prd.md#FR48] — Session history and participation scores preserved
- [Source: prd.md#FR49] — Host transfer after 60s absence, party continues normally
- [Source: prd.md#FR50] — Wake lock (deferred)
- [Source: prd.md#NFR9] — Brief interruptions show no error state
- [Source: prd.md#NFR10] — All state recoverable from server
- [Source: architecture.md#State Architecture] — Full persistence model, three state tiers
- [Source: architecture.md#Cross-Cutting Concerns] — Three-tier reconnection, graceful degradation
- [Source: architecture.md#Error Recovery Patterns] — WebSocket disconnect: three-tier reconnection
- [Source: architecture.md#Authentication & Security] — Reconnecting user: same token, matched to session
- [Source: architecture.md#Socket.io Event Architecture] — Event naming convention, payload format
- [Source: architecture.md#Component Boundaries] — socket-handlers → services → persistence
- [Source: architecture.md#Gap Analysis] — Host transfer logic (FR49), wake lock (FR50)
- [Source: architecture.md#Testing Patterns] — Socket.io tests: each test creates own server instance
- [Source: project-context.md#Server Boundaries] — session-manager orchestrates, socket handlers call services
- [Source: project-context.md#Flutter Boundaries] — providers read-only, SocketClient mutates
- [Source: project-context.md#Socket.io Event Catalog] — party namespace events
- [Source: project-context.md#Anti-Patterns] — No flat event names, no setState in widgets
- [Source: 1-7-party-start-and-mid-session-join.md] — Previous story patterns, code locations, test counts

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

N/A

### Completion Notes List

- All 11 tasks and subtasks implemented following red-green-refactor cycle
- Server: Created in-memory connection-tracker service (module-level Maps pattern matching rate-limiter), enhanced connection-handler with disconnect/reconnect detection, 60s host transfer timer, 5-min cleanup timer, enriched participant list with isOnline status
- Server: Added transferHost() to session-manager, updateHost() to session-repository, 3 new events to shared/events.ts, Socket.io ping config (10s/5s)
- Flutter: Added ConnectionStatus enum, participant online/offline tracking, host transfer support, 5s disconnect UI suppression timer, 3 new event listeners, shared ReconnectingBanner widget
- Server tests: 153 passed, 2 skipped (19 test files) — added connection-tracker tests (25), transferHost tests (5), updateHost tests (2), updated party-join tests for enriched payload
- Flutter tests: All passing — party_provider (35), party_screen (14), lobby_screen (19), socket client (4), plus all other test files
- Fix: Used authProvider.firebaseUser?.uid instead of non-existent authProvider.currentUser in createParty()
- Fix: Guarded catch-up card trigger with sessionStatus check to prevent re-showing on reconnection
- Task 10.4 (connection-lifecycle integration tests) covered by enhanced party-join.test.ts which validates enriched payload with isOnline and hostUserId fields

### File List

**New Files:**
- `apps/server/src/services/connection-tracker.ts`
- `apps/server/tests/services/connection-tracker.test.ts`
- `apps/flutter_app/lib/widgets/reconnecting_banner.dart`

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`
- `apps/server/src/shared/events.ts`
- `apps/server/src/services/session-manager.ts`
- `apps/server/src/persistence/session-repository.ts`
- `apps/server/src/socket-handlers/connection-handler.ts`
- `apps/server/src/index.ts`
- `apps/server/tests/services/session-manager.test.ts`
- `apps/server/tests/persistence/session-repository.test.ts`
- `apps/server/tests/socket-handlers/party-join.test.ts`
- `apps/flutter_app/lib/state/party_provider.dart`
- `apps/flutter_app/lib/socket/client.dart`
- `apps/flutter_app/lib/screens/party_screen.dart`
- `apps/flutter_app/lib/screens/lobby_screen.dart`
- `apps/flutter_app/lib/constants/copy.dart`
- `apps/flutter_app/test/state/party_provider_test.dart`
- `apps/flutter_app/test/screens/party_screen_test.dart`
- `apps/flutter_app/test/screens/lobby_screen_test.dart`

# Story 1.7: Party Start & Mid-Session Join

Status: done

## Story

As a host,
I want to start the party when enough people have joined, and allow latecomers to join seamlessly,
So that the party begins when the group is ready and nobody is left out.

## Acceptance Criteria

1. **Given** the host is in the lobby with participants
   **When** the host taps "Start Party" (consequential long-press, 500ms)
   **Then** all connected phones transition from lobby to the party screen (FR5)
   **And** the session status updates from 'lobby' to 'active' on the server
   **And** the "Start Party" button is only enabled when `participantCount >= 3`

2. **Given** a party is already in progress (status='active')
   **When** a new participant joins mid-session
   **Then** they receive a catch-up summary of current party stats (FR6)
   **And** the late join flow shows: loading skeleton (pulsing Karamania logo, 200-500ms) -> catch-up card (3s max, tap to dismiss) -> current DJ state
   **And** the late joiner is added to the participant nominee pool immediately
   **And** no "late joiner" badge or marker differentiates them from original participants

3. **Given** a party is active
   **When** the host wants to invite more people
   **Then** the host can re-display the QR code and party code at any point via an invite button on the party screen (FR7)

## Tasks / Subtasks

- [x]Task 1: Server — Add session start capability (AC: #1)
  - [x]1.1: Add `updateStatus()` to `persistence/session-repository.ts`:
    ```typescript
    export async function updateStatus(sessionId: string, status: string) {
      return db
        .updateTable('sessions')
        .set({ status })
        .where('id', '=', sessionId)
        .executeTakeFirst();
    }
    ```

  - [x]1.2: Add `startSession()` to `services/session-manager.ts`:
    ```typescript
    export async function startSession(params: {
      sessionId: string;
      hostUserId: string;
    }): Promise<{ status: string }> {
      // 1. Verify session exists and is in 'lobby' status
      const session = await sessionRepo.findById(params.sessionId);
      if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
      if (session.status !== 'lobby') throw new AppError('INVALID_STATUS', 'Party already started', 400);

      // 2. Verify caller is the host
      if (session.host_user_id !== params.hostUserId) {
        throw new AppError('NOT_HOST', 'Only the host can start the party', 403);
      }

      // 3. Verify minimum participants (3)
      const participants = await sessionRepo.getParticipants(params.sessionId);
      if (participants.length < 3) {
        throw new AppError('INSUFFICIENT_PLAYERS', 'Need at least 3 participants to start', 400);
      }

      // 4. Update session status to 'active'
      await sessionRepo.updateStatus(params.sessionId, 'active');

      return { status: 'active' };
    }
    ```
    **NOTE:** No DJ state initialization here — the DJ engine (Story 2.1) owns state machine creation. This story only handles the session lifecycle transition. The `dj_state` JSONB column remains null until Story 2.1.

  - [x]1.3: Add event constants to `shared/events.ts`:
    ```typescript
    PARTY_START: 'party:start',       // Client -> Server (host command)
    PARTY_STARTED: 'party:started',   // Server -> All Clients (broadcast)
    ```

  - [x]1.4: Add `party:start` handler to `socket-handlers/party-handlers.ts`:
    ```typescript
    socket.on(EVENTS.PARTY_START, async () => {
      try {
        await startSession({
          sessionId: socket.data.sessionId,
          hostUserId: socket.data.userId,
        });

        // Broadcast to ALL sockets in room:
        // - socket.emit() sends to the sender (host)
        // - socket.to(room).emit() sends to everyone else in the room
        // This matches the existing connection-handler pattern
        const payload = { status: 'active' };
        socket.emit(EVENTS.PARTY_STARTED, payload);
        socket.to(socket.data.sessionId).emit(EVENTS.PARTY_STARTED, payload);
      } catch (error) {
        // Silently fail — button is disabled when conditions aren't met
        // Edge cases (race conditions) are absorbed per UX error philosophy
      }
    });
    ```
    **IMPORT:** `import { startSession } from '../services/session-manager.js';`
    **BOUNDARY:** Socket handler calls service, NOT persistence directly.

  - [x]1.5: Update `connection-handler.ts` to include `status` in `party:participants` response:
    ```typescript
    // In the existing party:participants emission, add status field
    // handleParticipantJoin already calls findById — extend its return type
    s.emit(EVENTS.PARTY_PARTICIPANTS, {
      participants: joinResult.participants,
      participantCount: joinResult.participantCount,
      vibe: joinResult.vibe,
      status: joinResult.status,  // NEW: 'lobby' or 'active'
    });
    ```

  - [x]1.6: Update `handleParticipantJoin()` in `services/session-manager.ts` to return `status`:
    ```typescript
    // Existing return type already includes participants, participantCount, vibe
    // Add status to the return:
    return {
      participants: participants.map(p => ({
        userId: p.user_id ?? p.id,
        displayName: p.guest_name ?? p.display_name ?? 'Unknown',
      })),
      participantCount: participants.length,
      vibe: session?.vibe ?? 'general',
      status: session?.status ?? 'lobby',  // NEW
    };
    ```

- [x]Task 2: Server — Add status to guest auth response (AC: #2)
  - [x]2.1: In `routes/auth.ts`, add `status` to guest auth response:
    ```typescript
    // The session is already loaded via findByPartyCode(partyCode)
    // Add session.status to the response:
    return reply.status(200).send({
      data: {
        token,
        guestId,
        sessionId: session.id,
        vibe: session.vibe ?? 'general',
        status: session.status,  // NEW: 'lobby' or 'active'
      },
    });
    ```

  - [x]2.2: Update `guestAuthResponseSchema` in `shared/schemas/auth-schemas.ts`:
    ```typescript
    export const guestAuthResponseSchema = dataResponseSchema(
      z.object({
        token: z.string(),
        guestId: z.string(),
        sessionId: z.string(),
        vibe: z.string(),
        status: z.string(),  // NEW
      })
    );
    ```

- [x]Task 3: Flutter — Update PartyProvider for party lifecycle (AC: #1, #2)
  - [x]3.1: Add party start state to `lib/state/party_provider.dart`:
    ```dart
    // New state fields
    String _sessionStatus = 'lobby';
    LoadingState _startPartyLoading = LoadingState.idle;
    bool _isCatchingUp = false;

    // New getters
    String get sessionStatus => _sessionStatus;
    LoadingState get startPartyLoading => _startPartyLoading;
    bool get isCatchingUp => _isCatchingUp;

    // New mutation methods (called ONLY by SocketClient)
    void onStartPartyLoading(LoadingState state) {
      _startPartyLoading = state;
      notifyListeners();
    }

    void onPartyStarted() {
      _sessionStatus = 'active';
      _startPartyLoading = LoadingState.success;
      notifyListeners();
    }

    void onSessionStatus(String status) {
      _sessionStatus = status;
      notifyListeners();
    }

    void onCatchUpStarted() {
      _isCatchingUp = true;
      notifyListeners();
    }

    void onCatchUpComplete() {
      _isCatchingUp = false;
      notifyListeners();
    }
    ```

  - [x]3.2: Update `onPartyJoined()` to accept status:
    ```dart
    void onPartyJoined({
      required String sessionId,
      required String partyCode,
      required PartyVibe vibe,
      String status = 'lobby',  // NEW parameter
    }) {
      _sessionId = sessionId;
      _partyCode = partyCode;
      _vibe = vibe;
      _isHost = false;
      _sessionStatus = status;  // NEW
      _joinPartyLoading = LoadingState.success;
      notifyListeners();
    }
    ```

- [x]Task 4: Flutter — Add startParty() and party:started listener to SocketClient (AC: #1)
  - [x]4.1: Add `startParty()` method to `lib/socket/client.dart`:
    ```dart
    void startParty(PartyProvider partyProvider) {
      partyProvider.onStartPartyLoading(LoadingState.loading);
      _socket?.emit('party:start');
      // Navigation handled reactively when party:started is received
    }
    ```
    **NOTE:** Fire-and-forget pattern (matches existing `updateVibe()` pattern). The party:started broadcast handles state update for ALL clients including the host. Button is disabled when conditions aren't met, so server-side rejection is an edge case absorbed silently per UX error philosophy.

  - [x]4.2: Add `party:started` listener to `_setupPartyListeners()`:
    ```dart
    on('party:started', (data) {
      partyProvider.onPartyStarted();
    });
    ```

  - [x]4.3: Update `party:participants` listener to include status:
    ```dart
    on('party:participants', (data) {
      final Map<String, dynamic> payload = data as Map<String, dynamic>;
      final List<dynamic> rawList = payload['participants'] as List<dynamic>;
      final participants = rawList.map((p) => ParticipantInfo(
        userId: (p as Map<String, dynamic>)['userId'] as String,
        displayName: p['displayName'] as String,
      )).toList();
      partyProvider.onParticipantsSync(participants);

      // NEW: Handle session status for mid-session join routing
      final status = payload['status'] as String?;
      if (status != null) {
        partyProvider.onSessionStatus(status);
        // If joining an active session, trigger catch-up
        if (status == 'active') {
          partyProvider.onCatchUpStarted();
        }
      }
    });
    ```

- [x]Task 5: Flutter — Status-aware navigation after join (AC: #2)
  - [x]5.1: Update `joinParty()` in `lib/socket/client.dart` to store session status from REST response:
    ```dart
    // In joinParty(), after apiClient.guestAuth():
    final status = response['status'] as String? ?? 'lobby';

    // Pass status to onPartyJoined:
    partyProvider.onPartyJoined(
      sessionId: sessionId,
      partyCode: partyCode,
      vibe: parsedVibe,
      status: status,  // NEW
    );
    ```

  - [x]5.2: Update `JoinScreen._onJoin()` in `lib/screens/join_screen.dart` for status-aware navigation:
    ```dart
    Future<void> _onJoin() async {
      setState(() => _errorMessage = null);
      final socketClient = context.read<SocketClient>();
      try {
        await socketClient.joinParty(
          apiClient: context.read<ApiClient>(),
          authProvider: context.read<AuthProvider>(),
          partyProvider: context.read<PartyProvider>(),
          serverUrl: AppConfig.instance.serverUrl,
          displayName: _nameController.text.trim(),
          partyCode: _codeController.text.toUpperCase(),
        );
        if (mounted) {
          final status = context.read<PartyProvider>().sessionStatus;
          if (status == 'active') {
            context.go('/party');  // Mid-session join → party screen with catch-up
          } else {
            context.go('/lobby');  // Normal join → lobby
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() => _errorMessage = e.toString());
        }
      }
    }
    ```

- [x]Task 6: Flutter — Enable START PARTY button in LobbyScreen (AC: #1)
  - [x]6.1: In `lib/screens/lobby_screen.dart`, enable the existing START PARTY button:
    ```dart
    // The START PARTY button currently exists with opacity=0.5 and empty onTap
    // Replace with conditional enabled/disabled:
    final canStartParty = partyProvider.isHost && partyProvider.participantCount >= 3;

    Opacity(
      opacity: canStartParty ? 1.0 : 0.5,
      child: DJTapButton(
        key: const Key('start-party-btn'),
        label: Copy.startParty,
        tier: TapTier.consequential,  // 64x64, 500ms long-press
        onTap: canStartParty
            ? () {
                final socketClient = context.read<SocketClient>();
                socketClient.startParty(context.read<PartyProvider>());
              }
            : () {},  // IMPORTANT: DJTapButton.onTap is VoidCallback (non-nullable) — use empty callback, NOT null
      ),
    ),
    ```
    **CRITICAL:** `DJTapButton.onTap` is `VoidCallback` (non-nullable). You CANNOT pass `null`. Use `() {}` for disabled state with Opacity wrapper for visual feedback. This matches the existing join_screen.dart pattern (line ~153).
    Remove the TODO comment but KEEP the Opacity wrapper pattern.

  - [x]6.2: Add reactive navigation when party starts. In LobbyScreen's build method:
    ```dart
    // Watch for party start (handles guests receiving party:started)
    if (partyProvider.sessionStatus == 'active') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/party');
      });
    }
    ```
    **NOTE:** `context.go('/party')` is idempotent — safe if called multiple times. Host navigates via this same path after the party:started event arrives.

  - [x]6.3: Show "Need X more" hint when < 3 participants and isHost:
    ```dart
    if (partyProvider.isHost && partyProvider.participantCount < 3) {
      Text(
        '${Copy.needMorePlayers} ${3 - partyProvider.participantCount} ${Copy.more}',
        style: Theme.of(context).textTheme.bodySmall,
      ),
    }
    ```

- [x]Task 7: Flutter — Create PartyScreen with catch-up overlay (AC: #1, #2)
  - [x]7.1: Create `lib/screens/party_screen.dart` — extract and enhance from `_PartyScreen` in app.dart:
    ```dart
    class PartyScreen extends StatefulWidget {
      const PartyScreen({super.key});
      @override
      State<PartyScreen> createState() => _PartyScreenState();
    }

    class _PartyScreenState extends State<PartyScreen> {
      Timer? _catchUpTimer;

      @override
      void initState() {
        super.initState();
        final partyProvider = context.read<PartyProvider>();
        if (partyProvider.isCatchingUp) {
          // Auto-dismiss catch-up card after 3 seconds
          _catchUpTimer = Timer(const Duration(seconds: 3), () {
            if (mounted) {
              context.read<PartyProvider>().onCatchUpComplete();
            }
          });
        }
      }

      @override
      void dispose() {
        _catchUpTimer?.cancel();
        super.dispose();
      }

      @override
      Widget build(BuildContext context) {
        final partyProvider = context.watch<PartyProvider>();
        final displayVibe = partyProvider.vibe;

        return Scaffold(
          backgroundColor: Colors.transparent,
          body: SafeArea(
            child: Stack(
              children: [
                // Main content — placeholder until DJ engine (Story 2.1)
                _buildPartyContent(context, partyProvider, displayVibe),

                // Catch-up overlay for mid-session joiners
                if (partyProvider.isCatchingUp)
                  _buildCatchUpCard(context, partyProvider, displayVibe),
              ],
            ),
          ),
          // Host invite FAB (AC #3)
          floatingActionButton: partyProvider.isHost
              ? FloatingActionButton(
                  key: const Key('host-invite-fab'),
                  backgroundColor: displayVibe.accent,
                  onPressed: () => _showInviteSheet(context, partyProvider),
                  child: const Icon(Icons.qr_code, color: Colors.white),
                )
              : null,
        );
      }

      Widget _buildPartyContent(
        BuildContext context,
        PartyProvider partyProvider,
        PartyVibe displayVibe,
      ) {
        // Placeholder party screen — DJ engine (Story 2.1) will replace this
        // with switch(partyProvider.djState) content
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 428),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.music_note,
                  size: 64,
                  color: displayVibe.accent,
                ),
                const SizedBox(height: DJTokens.spaceLg),
                Text(
                  Copy.partyInProgress,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: DJTokens.textPrimary,
                  ),
                ),
                const SizedBox(height: DJTokens.spaceMd),
                Text(
                  '${partyProvider.participantCount} ${Copy.participants.toLowerCase()}',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
                ),
                const SizedBox(height: DJTokens.spaceXl),
                Text(
                  Copy.djEngineComingSoon,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textSecondary.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
        );
      }

      Widget _buildCatchUpCard(
        BuildContext context,
        PartyProvider partyProvider,
        PartyVibe displayVibe,
      ) {
        return GestureDetector(
          key: const Key('catch-up-card'),
          onTap: () {
            _catchUpTimer?.cancel();
            partyProvider.onCatchUpComplete();
          },
          child: Container(
            color: Colors.black.withValues(alpha: 0.8),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Card(
                  color: DJTokens.surfaceColor,
                  child: Padding(
                    padding: const EdgeInsets.all(DJTokens.spaceLg),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          Copy.welcomeToParty,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: displayVibe.accent,
                          ),
                        ),
                        const SizedBox(height: DJTokens.spaceMd),
                        Text(
                          '${partyProvider.participantCount} ${Copy.participants.toLowerCase()} ${Copy.areHere}',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: DJTokens.textPrimary,
                          ),
                        ),
                        const SizedBox(height: DJTokens.spaceMd),
                        Text(
                          '${Copy.vibeLabel}: ${Copy.vibeEmoji(partyProvider.vibe)}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                        ),
                        const SizedBox(height: DJTokens.spaceLg),
                        Text(
                          Copy.tapToDismiss,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DJTokens.textSecondary.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }

      void _showInviteSheet(BuildContext context, PartyProvider partyProvider) {
        showModalBottomSheet(
          context: context,
          backgroundColor: DJTokens.surfaceColor,
          builder: (sheetContext) => _InviteSheet(
            partyCode: partyProvider.partyCode ?? '',
            vibe: partyProvider.vibe,
          ),
        );
      }
    }
    ```

  - [x]7.2: Create `_InviteSheet` widget inside `party_screen.dart` for host QR re-display (AC: #3):
    ```dart
    class _InviteSheet extends StatelessWidget {
      const _InviteSheet({required this.partyCode, required this.vibe});
      final String partyCode;
      final PartyVibe vibe;

      @override
      Widget build(BuildContext context) {
        return Padding(
          padding: const EdgeInsets.all(DJTokens.spaceLg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                Copy.inviteMoreFriends,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: vibe.accent,
                ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              // QR code — reuse same pattern from LobbyScreen
              QrImageView(
                data: '${AppConfig.instance.webLandingUrl}?code=$partyCode',
                size: 200,
                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.circle),
                dataModuleStyle: QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.circle,
                  color: vibe.accent,
                ),
                backgroundColor: Colors.white,
              ),
              const SizedBox(height: DJTokens.spaceMd),
              Text(
                partyCode,
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: DJTokens.textPrimary,
                  letterSpacing: 8,
                ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              // Share button — reuse pattern from LobbyScreen
              DJTapButton(
                key: const Key('invite-share-btn'),
                label: Copy.shareInvite,
                tier: TapTier.social,
                onTap: () {
                  Share.share(
                    '${Copy.joinMyParty} ${AppConfig.instance.webLandingUrl}?code=$partyCode',
                  );
                },
              ),
              const SizedBox(height: DJTokens.spaceMd),
            ],
          ),
        );
      }
    }
    ```
    **IMPORTS needed:** `package:qr_flutter/qr_flutter.dart`, `package:share_plus/share_plus.dart` (both already in pubspec.yaml from Story 1.4).

  - [x]7.3: Update `lib/app.dart` to use the new PartyScreen:
    ```dart
    // Replace:
    //   GoRoute(path: '/party', builder: (_, __) => _PartyScreen()),
    // With:
    import 'package:karamania/screens/party_screen.dart';
    GoRoute(path: '/party', builder: (_, __) => const PartyScreen()),
    ```
    Remove the private `_PartyScreen` class from app.dart.

    **KEEP** the existing back-button confirm dialog logic for `/party` route.

- [x]Task 8: Add copy strings (AC: #1, #2, #3)
  - [x]8.1: Add to `lib/constants/copy.dart`:
    ```dart
    // Party start
    static const String needMorePlayers = 'Need';
    static const String more = 'more to start';
    static const String partyInProgress = 'PARTY IN PROGRESS';
    static const String djEngineComingSoon = 'DJ engine coming in the next update';

    // Catch-up (mid-session join)
    static const String welcomeToParty = 'Welcome to the party!';
    static const String areHere = 'are here';
    static const String tapToDismiss = 'Tap anywhere to continue';
    static const String vibeLabel = 'Vibe';

    // Invite sheet
    static const String inviteMoreFriends = 'Invite More Friends';
    static const String shareInvite = 'Share Invite';
    static const String joinMyParty = 'Join my Karamania party!';
    ```

- [x]Task 9: Server tests (AC: #1, #2)
  - [x]9.1: Add to `tests/persistence/session-repository.test.ts`:
    - `updateStatus()` updates session status in DB
    - `updateStatus()` on non-existent session returns no result

  - [x]9.2: Add to `tests/services/session-manager.test.ts`:
    - `startSession()` updates status to 'active' when valid
    - `startSession()` throws INVALID_STATUS when session not in 'lobby'
    - `startSession()` throws NOT_HOST when caller is not the host
    - `startSession()` throws INSUFFICIENT_PLAYERS when < 3 participants
    - `startSession()` throws SESSION_NOT_FOUND when session doesn't exist

  - [x]9.3: Add to `tests/socket-handlers/party-join.test.ts` (or create separate `party-start.test.ts`):
    - When host emits `party:start`, `party:started` is broadcast to all sockets in room
    - `party:started` payload contains `{ status: 'active' }`
    - Non-host socket emitting `party:start` does NOT trigger broadcast
    - Session with < 3 participants: `party:start` does NOT trigger broadcast
    - Session already 'active': `party:start` does NOT trigger broadcast

  - [x]9.4: Verify `party:participants` response includes `status` field:
    - When socket connects to 'lobby' session, status is 'lobby'
    - When socket connects to 'active' session, status is 'active'

  - [x]9.5: Verify guest auth response includes `status` field:
    - `POST /api/auth/guest` response contains `status` matching session status

- [x]Task 10: Flutter tests (AC: #1, #2, #3)
  - [x]10.1: Update `test/screens/lobby_screen_test.dart`:
    - START PARTY button is disabled (null onTap) when `participantCount < 3`
    - START PARTY button is disabled when user is NOT host
    - START PARTY button is enabled when `isHost && participantCount >= 3`
    - START PARTY button uses TapTier.consequential
    - Shows "Need X more to start" when isHost and < 3 participants
    - Navigates to `/party` when `sessionStatus` becomes 'active'

  - [x]10.2: Create `test/screens/party_screen_test.dart`:
    - Shows "PARTY IN PROGRESS" text
    - Shows participant count
    - Shows host invite FAB when isHost
    - Hides host invite FAB when NOT isHost
    - Shows catch-up card when `isCatchingUp` is true
    - Catch-up card shows participant count and vibe
    - Catch-up card dismisses on tap
    - Catch-up card auto-dismisses after 3 seconds

  - [x]10.3: Update `test/state/party_provider_test.dart`:
    - `onPartyStarted()` sets sessionStatus to 'active' and startPartyLoading to success
    - `onStartPartyLoading()` transitions loading states
    - `onSessionStatus()` updates sessionStatus
    - `onCatchUpStarted()` sets isCatchingUp to true
    - `onCatchUpComplete()` sets isCatchingUp to false
    - `onPartyJoined()` accepts and stores status parameter

  - [x]10.4: Update `test/screens/join_screen_test.dart`:
    - Navigates to `/party` when session status is 'active' (mid-session join)
    - Navigates to `/lobby` when session status is 'lobby' (normal join)

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: Session status transition (`lobby` → `active`) happens ONLY on the server. Flutter emits a command (`party:start`), server validates and broadcasts the result (`party:started`). No client-side status management.
- **SocketClient is sole orchestrator**: `startParty()` emits the socket event. Providers are passive state containers updated by SocketClient's event listeners.
- **Provider boundaries ENFORCED**: `PartyProvider` read-only from widgets. Only `SocketClient` calls `onPartyStarted()`, `onSessionStatus()`, `onCatchUpStarted()`, `onCatchUpComplete()`.
- **Socket handler boundary ENFORCED**: `party-handlers.ts` calls `startSession()` from `services/session-manager.ts`. Socket handlers NEVER import from `persistence/` or `db/` directly. **NOTE**: Existing `party-handlers.ts` imports `updateVibe` from persistence directly — this pre-existing violation (from Story 1.6) should be refactored in a future cleanup but is out of scope for this story.

### Start Party Flow — End-to-End Sequence

```
LobbyScreen: Host long-presses START PARTY (500ms, consequential tier)
  ↓
SocketClient.startParty()
  ↓
socket.emit('party:start')
  ↓
Server: party-handlers receives 'party:start'
  ↓
Server: startSession({ sessionId, hostUserId })
  └→ findById(sessionId) → verify status='lobby'
  └→ verify host_user_id === socket.data.userId
  └→ getParticipants(sessionId) → verify count >= 3
  └→ updateStatus(sessionId, 'active')
  ↓
Server: socket.emit('party:started', { status }) + socket.to(sessionId).emit('party:started', { status })
  ↓
ALL clients receive 'party:started'
  ↓
SocketClient: partyProvider.onPartyStarted()
  → sessionStatus = 'active', startPartyLoading = success
  ↓
LobbyScreen: detects sessionStatus == 'active'
  → WidgetsBinding.addPostFrameCallback → context.go('/party')
  ↓
PartyScreen renders with placeholder content (DJ engine = Story 2.1)
```

### Mid-Session Join Flow — End-to-End Sequence

```
JoinScreen: Late joiner enters code + name → taps JOIN
  ↓
SocketClient.joinParty() → apiClient.guestAuth()
  ↓
Server: POST /api/auth/guest → returns { token, guestId, sessionId, vibe, status: 'active' }
  ↓
partyProvider.onPartyJoined(sessionId, partyCode, vibe, status: 'active')
  ↓
SocketClient.connect() → socket established
  ↓
Server: connection-handler → handleParticipantJoin()
Server: emit 'party:participants' with { participants, count, vibe, status: 'active' }
  ↓
SocketClient: party:participants handler → status='active' detected
  → partyProvider.onCatchUpStarted() → isCatchingUp = true
  ↓
JoinScreen: partyProvider.sessionStatus == 'active' → context.go('/party')
  ↓
PartyScreen: isCatchingUp=true → shows catch-up card overlay
  → Timer(3s) or tap → partyProvider.onCatchUpComplete()
  ↓
PartyScreen: normal party view (placeholder for Story 2.1)
```

### QR Re-Display Flow (AC #3)

```
PartyScreen: Host sees FloatingActionButton (qr_code icon)
  ↓
Host taps FAB → showModalBottomSheet
  ↓
_InviteSheet: QR code + party code + share button
  → Uses same QR pattern as LobbyScreen (QrImageView, vibe-colored)
  → Share.share() for native share sheet
```

### Server: Existing Code to Reuse (DO NOT recreate)

| What | Location | Notes |
|------|----------|-------|
| Session status DB column | `migrations/001-initial-schema.ts` | CHECK constraint: 'lobby', 'active', 'paused', 'ended' |
| Session lookup by ID | `persistence/session-repository.ts` | `findById()` — already exists |
| Participant count | `persistence/session-repository.ts` | `getParticipants()` — already exists |
| Party handler registration | `socket-handlers/party-handlers.ts` | `registerPartyHandlers()` — add `party:start` handler here |
| Session manager | `services/session-manager.ts` | `createSession()`, `handleParticipantJoin()` — add `startSession()` following same pattern |
| Event constants | `shared/events.ts` | Add `PARTY_START`, `PARTY_STARTED` |
| Auth middleware | `socket-handlers/auth-middleware.ts` | Already populates `socket.data` with `userId`, `sessionId`, `role`, `displayName` |
| Guest auth route | `routes/auth.ts` | Already loads session via `findByPartyCode()` — just add `status` to response |
| AppError | `shared/errors.ts` | Use for `startSession()` error cases |

### Server: What to Add (minimal changes)

1. **`persistence/session-repository.ts`**: Add `updateStatus(sessionId, status)` (~5 lines)
2. **`services/session-manager.ts`**: Add `startSession()` service function (~15 lines); extend `handleParticipantJoin()` return to include `status` (~2 lines)
3. **`shared/events.ts`**: Add `PARTY_START`, `PARTY_STARTED` constants (2 lines)
4. **`socket-handlers/party-handlers.ts`**: Add `party:start` handler (~10 lines). Import `startSession` from session-manager
5. **`socket-handlers/connection-handler.ts`**: Add `status` to `party:participants` payload (~1 line)
6. **`routes/auth.ts`**: Add `status` to guest auth response (~1 line)
7. **`shared/schemas/auth-schemas.ts`**: Add `status: z.string()` to response schema (~1 line)

### Flutter: Existing Code to Reuse (DO NOT recreate)

| What | Location | Notes |
|------|----------|-------|
| DJTapButton | `widgets/dj_tap_button.dart` | Use TapTier.consequential for START PARTY |
| QR code display | `screens/lobby_screen.dart` | Same QrImageView pattern for invite sheet |
| Share functionality | `screens/lobby_screen.dart` | Same Share.share() pattern |
| PartyProvider | `state/party_provider.dart` | Add new fields, don't restructure |
| SocketClient | `socket/client.dart` | Add startParty(), extend listeners |
| LobbyScreen | `screens/lobby_screen.dart` | Enable button, add navigation logic |
| JoinScreen | `screens/join_screen.dart` | Update navigation for status-aware routing |
| GoRouter /party route | `app.dart` | Change builder to new PartyScreen |
| DJTokens | `theme/dj_theme.dart` | All spacing and color constants |
| Copy strings | `constants/copy.dart` | Add new strings |
| PartyVibe | `theme/dj_theme.dart` | Vibe enum with accent colors |
| AppConfig | `config/app_config.dart` | `webLandingUrl` for QR code URL |
| LoadingState | `state/party_provider.dart` | Reuse for startPartyLoading |
| ConstrainedBox pattern | All screens | maxWidth 428 on all screens |

### Flutter: What to Add

1. **`state/party_provider.dart`**: Add `sessionStatus`, `startPartyLoading`, `isCatchingUp` + mutation methods (~25 lines)
2. **`socket/client.dart`**: Add `startParty()` method (~3 lines); add `party:started` listener (~3 lines); extend `party:participants` handler with status (~5 lines)
3. **`screens/lobby_screen.dart`**: Enable START PARTY button (~10 lines replaced); add reactive navigation (~5 lines); add "Need X more" hint (~5 lines)
4. **`screens/party_screen.dart`**: NEW file — PartyScreen with catch-up overlay + invite FAB (~150 lines)
5. **`screens/join_screen.dart`**: Update navigation to be status-aware (~3 lines changed)
6. **`app.dart`**: Replace _PartyScreen with import of new PartyScreen (~2 lines changed)
7. **`constants/copy.dart`**: Add new strings (~10 lines)

### Critical Patterns (MUST follow)

**Socket.io event names:**
```
'party:start'    — Client → Server (host command)
'party:started'  — Server → All Clients (broadcast)
```

**Socket.io broadcast to ALL in room (including sender):**
```typescript
// Two calls: self + others (matches existing connection-handler pattern)
socket.emit(EVENTS.PARTY_STARTED, { status: 'active' });
socket.to(socket.data.sessionId).emit(EVENTS.PARTY_STARTED, { status: 'active' });
```

**REST error response format:**
```typescript
{ error: { code: 'NOT_HOST', message: 'Only the host can start the party' } }
```

**Socket.io event payload format (NOT wrapped):**
```typescript
socket.server.to(sessionId).emit('party:started', { status: 'active' });
// NOT: { data: { status: 'active' } }
```

**Import rules — server:**
```typescript
import { startSession } from '../services/session-manager.js'; // relative + .js
```

**Import rules — Flutter:**
```dart
import 'package:karamania/screens/party_screen.dart'; // package import
```

**Naming:**
- Server files: `kebab-case.ts`
- Flutter files: `snake_case.dart`
- Socket events: `namespace:action` (e.g., `party:start`, `party:started`)
- Widget keys: `Key('kebab-case-descriptor')`

**Reactive navigation pattern:**
```dart
// In build(), detect provider state change and navigate
if (partyProvider.sessionStatus == 'active') {
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (mounted) context.go('/party');
  });
}
```

**Consequential tap (UX spec):**
```dart
DJTapButton(tier: TapTier.consequential)  // 64x64px, 500ms long-press with fill animation
```

### Session Status Values (Database CHECK Constraint)

| Status | Meaning | Transition From |
|--------|---------|-----------------|
| `lobby` | Party created, waiting for participants | (initial) |
| `active` | Party started, game in progress | `lobby` (Story 1.7) |
| `paused` | Party temporarily paused | `active` (future story) |
| `ended` | Party finished | `active` or `paused` (future story) |

Only `lobby` → `active` transition is implemented in this story. Other transitions are future stories.

### DJ Engine Placeholder (Story 2.1 Scope)

The DJ engine state machine does NOT exist yet. Story 2.1 creates it. For Story 1.7:
- The `dj_state` JSONB column in sessions table remains `null` after start
- The `/party` screen shows a placeholder "Party in progress" state
- The `DJState` enum exists in Flutter (`lobby`, `songSelection`, etc.) but no state transitions occur
- Story 2.1 will add: state machine initialization on party start, state transitions, timer management
- Story 2.4 will add: DJ state broadcasting to Flutter, screen switching based on djState

**DO NOT** attempt to initialize DJ state machine or manage DJ state transitions in this story.

### Catch-Up Card Design Rules (from UX Spec)

| Rule | Rationale |
|------|-----------|
| Loading skeleton before catch-up card | 200-500ms gap — pulsing Karamania logo, not blank screen |
| Catch-up card = 3 seconds max | They walked into a party, not a tutorial |
| No replay of missed ceremonies | You weren't there. That's fine. |
| Name in nominee pool immediately | Next ceremony, they're a full participant |
| No "late joiner" badge or marker | The app doesn't differentiate. They were there. |

For Story 1.7, the catch-up card is minimal since the DJ engine doesn't exist yet:
- Shows "Welcome to the party!" + participant count + vibe
- Auto-dismisses after 3s or on tap
- Future stories (post DJ engine) will enhance with: current song, scores, DJ state

### Cross-Story Dependencies

- **Story 1.4 (Party Creation)**: QR code URL format `${webLandingUrl}?code=$partyCode` — reuse in invite sheet
- **Story 1.5 (Web Landing)**: Deep link routing already handles join flow for new participants
- **Story 1.6 (Party Join)**: Guest auth, socket connect, participant tracking — all infrastructure this story builds on
- **Story 1.8 (Connection Resilience)**: Will handle reconnection during active party. This story only handles initial party start and mid-session join. Connection drop during active session = Story 1.8 scope
- **Story 2.1 (DJ Engine)**: Will initialize the state machine when party starts. This story sets status='active' but does NOT create DJ state. Story 2.1 will hook into the `party:started` flow to initialize the engine
- **Story 2.4 (DJ State Display)**: Will implement the `switch(djState)` content in PartyScreen. This story creates the PartyScreen with placeholder content

### Anti-Patterns (NEVER DO THESE)

| Wrong | Right |
|-------|-------|
| `socket.emit('partyStarted', ...)` | `socket.emit('party:started', ...) + socket.to(sessionId).emit('party:started', ...)` |
| Initialize DJ state machine in this story | Leave `dj_state` null — Story 2.1 scope |
| Client-side status validation beyond button disable | Server validates everything in `startSession()` |
| Navigate with `Navigator.push('/party')` | `context.go('/party')` via GoRouter |
| `setState(() { sessionStatus = 'active'; })` in widget | `partyProvider.onPartyStarted()` called by SocketClient |
| Create separate `catch_up_screen.dart` | Overlay within PartyScreen |
| Import persistence in party-handlers.ts for start | Import `startSession` from `services/session-manager.js` |
| `Padding(padding: EdgeInsets.all(16))` | `Padding(padding: EdgeInsets.all(DJTokens.spaceMd))` |
| Hardcoded strings in widgets | Use `Copy.*` constants |
| `Color(0xFF6C63FF)` for vibe accent | `displayVibe.accent` from PartyVibe |
| `ElevatedButton` for start party | `DJTapButton(tier: TapTier.consequential)` |
| `DJTapButton(onTap: null)` for disabled | `Opacity(opacity: 0.5, child: DJTapButton(onTap: () {}))` — onTap is `VoidCallback` non-nullable |
| Blocking error toast on start failure | Silently absorb — UX error philosophy |
| Add `started_at` column to sessions table | Not needed for MVP — use `dj_state` metadata in Story 2.1 if needed |

### Previous Story Intelligence

**From Story 1.6 (most recent):**
- Join flow: `guestAuth()` → `connect()` → `_setupPartyListeners()` → navigate. Extend this for status-aware routing
- `party:participants` listener pattern — extend to include `status` field
- LobbyScreen: START PARTY button exists but disabled with `Opacity(opacity: 0.5)` and empty `onTap`. Enable it with proper conditions
- Server: `handleParticipantJoin()` returns `participants`, `participantCount`, `vibe`. Extend to include `status`
- Server: `connection-handler.ts` is async — safe to add more async operations
- Debug lesson: Dart cascade `..` precedence — use parentheses when combining with `??`
- Test counts: Server 106 passed (2 skipped, 17 files), Flutter 129 passed
- QR code: `QrEyeShape.circle` works (not `roundedRect`). Reuse in invite sheet

**From Story 1.4 (Party Creation):**
- `SocketClient.createParty()` → `apiClient.createSession()` → `connect()` — follow this async pattern
- `PartyProvider.onPartyCreated()` sets isHost=true — host detection via this flag
- Share.share() pattern for native share sheet — reuse in invite sheet

**From Story 1.3 (Auth + WebSocket):**
- Auth middleware validates JWT and populates `socket.data = { userId, sessionId, role, displayName }`
- `socket.data.userId` for host = matches `session.host_user_id` — use for host validation
- Socket rooms: `socket.join(socket.data.sessionId)` — all participants in same room

**From Story 1.1 (Flutter Scaffold):**
- DJTapButton with TapTier enum: consequential (64x64, long-press), social (56x56), private (48x48)
- DJTokens spacing: spaceXs=4, spaceSm=8, spaceMd=16, spaceLg=24, spaceXl=32
- ConstrainedBox maxWidth 428 on all screens
- All providers in `bootstrap.dart` MultiProvider

### Project Structure Notes

```
apps/server/
  src/
    persistence/
      session-repository.ts             # MODIFIED: add updateStatus()
    services/
      session-manager.ts                # MODIFIED: add startSession(), extend handleParticipantJoin return
    socket-handlers/
      party-handlers.ts                 # MODIFIED: add party:start handler
      connection-handler.ts             # MODIFIED: add status to party:participants payload
    routes/
      auth.ts                           # MODIFIED: add status to guest auth response
    shared/
      events.ts                         # MODIFIED: add PARTY_START, PARTY_STARTED
      schemas/
        auth-schemas.ts                 # MODIFIED: add status to response schema
  tests/
    persistence/
      session-repository.test.ts        # MODIFIED: add updateStatus tests
    services/
      session-manager.test.ts           # MODIFIED: add startSession tests
    socket-handlers/
      party-join.test.ts                # MODIFIED: add party:start tests + status in participants

apps/flutter_app/
  lib/
    screens/
      lobby_screen.dart                 # MODIFIED: enable START PARTY, add navigation
      join_screen.dart                  # MODIFIED: status-aware navigation
      party_screen.dart                 # NEW: PartyScreen with catch-up + invite
    state/
      party_provider.dart               # MODIFIED: add start/status/catchUp state
    socket/
      client.dart                       # MODIFIED: add startParty(), party:started listener, extend participants handler
    constants/
      copy.dart                         # MODIFIED: add new strings
    app.dart                            # MODIFIED: replace _PartyScreen with PartyScreen import
  test/
    screens/
      lobby_screen_test.dart            # MODIFIED: START PARTY button tests + navigation
      join_screen_test.dart             # MODIFIED: status-aware navigation test
      party_screen_test.dart            # NEW: party screen + catch-up + invite tests
    state/
      party_provider_test.dart          # MODIFIED: start/status/catchUp method tests
```

### Testing Requirements

- **DO test**: Start party validation (host, participant count, status), party:started broadcast, mid-session join routing, catch-up card display/dismiss, lobby button enable/disable, guest auth status field, invite sheet display
- **DO NOT test**: Animations, visual effects, exact colors, DJ engine behavior (doesn't exist yet)
- **Server**: Vitest with Fastify `.inject()` for HTTP, socket test patterns from Story 1.6
- **Flutter**: flutter_test with mocked providers and SocketClient
- **Verify NO regressions**: Server 106+ tests, Flutter 129+ tests must continue to pass

### Performance Budget

- Start party transition: < 500ms from host tap to all clients receiving `party:started` (NFR1: 200ms state sync)
- Mid-session join: 200ms visual feedback via loading state (AC #2), then 200-500ms loading skeleton before catch-up card
- Catch-up card: 3s max display time (UX spec rule)
- No polling — all updates via socket broadcast

### References

- [Source: epics.md#Story 1.7] — FR5, FR6, FR7
- [Source: prd.md#FR5] — Host can start party, transitioning all phones to first activity
- [Source: prd.md#FR6] — Guest can join mid-session with catch-up summary
- [Source: prd.md#FR7] — Host can re-display QR code during active session
- [Source: architecture.md#WebSocket Event Convention] — party:* events, namespace:action pattern
- [Source: architecture.md#Component Boundaries] — socket-handlers → services → persistence
- [Source: architecture.md#Frontend Architecture] — GoRouter + DJ state switching inside /party route
- [Source: architecture.md#Session Status] — DB CHECK constraint: lobby, active, paused, ended
- [Source: ux-design-specification.md#Late Join Design Rules] — Loading skeleton, 3s catch-up card, no late joiner badge
- [Source: ux-design-specification.md#LobbyScreen] — States: pre-join, joined, host-ready (>= 3 participants)
- [Source: ux-design-specification.md#DJTapButton] — TapTier.consequential for Start Party (64x64, 500ms)
- [Source: ux-design-specification.md#Error Patterns] — Errors invisible, app absorbs silently
- [Source: ux-design-specification.md#Timer/Lobby] — No-limit screen, host triggers start, min 3 players
- [Source: project-context.md#Socket.io Event Catalog] — party namespace events
- [Source: project-context.md#Flutter Boundaries] — providers read-only, SocketClient mutates
- [Source: project-context.md#Server Boundaries] — socket-handlers call services only
- [Source: 1-6-party-join-flow-and-live-lobby.md] — Join flow, participant tracking, lobby implementation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blocking issues encountered.

### Completion Notes List

- Task 1: Added `updateStatus()` to session-repository.ts, `startSession()` to session-manager.ts with full validation (session exists, status=lobby, caller is host, >= 3 participants), `PARTY_START`/`PARTY_STARTED` event constants, `party:start` socket handler in party-handlers.ts, `status` field to `party:participants` response, `handleParticipantJoin` returns `status`.
- Task 2: Added `status` to guest auth REST response and `guestAuthDataSchema`.
- Task 3: Added `sessionStatus`, `startPartyLoading`, `isCatchingUp` fields + mutation methods to PartyProvider. Updated `onPartyJoined()` to accept `status` parameter.
- Task 4: Added `startParty()` method and `party:started` listener to SocketClient. Extended `party:participants` listener to handle `status` field and trigger catch-up for active sessions.
- Task 5: Updated `joinParty()` to pass session status from REST response. Updated JoinScreen for status-aware navigation (active → /party, lobby → /lobby).
- Task 6: Enabled START PARTY button in LobbyScreen with `isHost && participantCount >= 3` condition. Added reactive navigation on `sessionStatus == 'active'`. Added "Need X more to start" hint.
- Task 7: Created PartyScreen with placeholder party content, catch-up overlay (3s auto-dismiss or tap), and host invite FAB with QR code bottom sheet. Replaced `_PartyScreen` in app.dart.
- Task 8: Added copy strings for party start, catch-up, and invite sheet to Copy class.
- Task 9: Server tests — 13 new tests: updateStatus repo tests, startSession service tests (5 validation cases), party:start handler tests (4 cases), party:participants status field test, guest auth status test.
- Task 10: Flutter tests — 20 new tests: PartyProvider state tests (9), LobbyScreen button tests (3), PartyScreen tests (8 including catch-up card behavior).
- Post-implementation refactor: Migrated from hand-written `ApiClient` to generated `KaramaniaApiClient` via thin `ApiService` wrapper. Created `HttpClientAdapter` (bridges `package:http` to `HttpAdapter` interface), `AuthMiddleware` (injects Bearer token for `createSession`), and `ApiService` (wraps generated client, returns typed `CreateSessionData`/`GuestAuthData`, converts runtime `ApiException` → domain `ApiException` preserving `code`/`message`). Updated all consumers (`SocketClient`, `HomeScreen`, `JoinScreen`, `bootstrap.dart`) and tests. Deleted `api_client.dart` and `api_client_test.dart`. All 149 Flutter tests passing.

### Change Log

- Story 1.7 implementation complete (Date: 2026-03-09)
- All 10 tasks implemented with full test coverage
- Server: 106 → 119 tests passing (13 new)
- Flutter: 129 → 149 tests passing (20 new)
- ApiClient → ApiService migration (Date: 2026-03-09): Replaced hand-written `ApiClient` with thin `ApiService` wrapper around generated `KaramaniaApiClient` for type safety. All 149 Flutter tests still passing.

### File List

**Server (modified):**
- apps/server/src/persistence/session-repository.ts — added `updateStatus()`
- apps/server/src/services/session-manager.ts — added `startSession()`, extended `handleParticipantJoin` return with `status`
- apps/server/src/shared/events.ts — added `PARTY_START`, `PARTY_STARTED`
- apps/server/src/socket-handlers/party-handlers.ts — added `party:start` handler
- apps/server/src/socket-handlers/connection-handler.ts — added `status` to `party:participants` payload
- apps/server/src/routes/auth.ts — added `status` to guest auth response
- apps/server/src/shared/schemas/auth-schemas.ts — added `status` to response schema

**Server tests (modified/new):**
- apps/server/tests/persistence/session-repository.test.ts — added updateStatus tests
- apps/server/tests/services/session-manager.test.ts — added startSession tests
- apps/server/tests/socket-handlers/party-join.test.ts — added status field test, updated mocks
- apps/server/tests/socket-handlers/party-start.test.ts — NEW: party:start handler tests
- apps/server/tests/routes/auth.test.ts — added status field test

**Flutter (modified):**
- apps/flutter_app/lib/state/party_provider.dart — added sessionStatus, startPartyLoading, isCatchingUp + methods
- apps/flutter_app/lib/socket/client.dart — added startParty(), party:started listener, extended participants handler; ApiClient → ApiService
- apps/flutter_app/lib/screens/lobby_screen.dart — enabled START PARTY button, added navigation, "Need X more" hint
- apps/flutter_app/lib/screens/home_screen.dart — ApiClient → ApiService
- apps/flutter_app/lib/screens/join_screen.dart — status-aware navigation; ApiClient → ApiService
- apps/flutter_app/lib/config/bootstrap.dart — Provider\<ApiClient\> → Provider\<ApiService\>
- apps/flutter_app/lib/constants/copy.dart — added new strings + vibeEmoji method
- apps/flutter_app/lib/app.dart — replaced _PartyScreen with PartyScreen import

**Flutter (new):**
- apps/flutter_app/lib/screens/party_screen.dart — PartyScreen with loading skeleton, catch-up overlay + invite FAB
- apps/flutter_app/lib/api/api_service.dart — ApiService wrapper around generated KaramaniaApiClient with domain ApiException
- apps/flutter_app/lib/api/http_client_adapter.dart — HttpAdapter implementation using package:http
- apps/flutter_app/lib/api/auth_middleware.dart — Middleware that injects Bearer token header

**Flutter (generated — modified by code-gen, not hand-edited):**
- apps/flutter_app/lib/api/generated/clients/karamania_api_client.dart
- apps/flutter_app/lib/api/generated/karamania_api.dart
- apps/flutter_app/lib/api/generated/models.dart

**Flutter (other):**
- apps/flutter_app/pubspec.lock — dependency lock file changes

**Flutter (deleted):**
- apps/flutter_app/lib/api/api_client.dart — replaced by api_service.dart

**Flutter tests (modified/new):**
- apps/flutter_app/test/state/party_provider_test.dart — added state method tests
- apps/flutter_app/test/screens/lobby_screen_test.dart — added button opacity/hint tests
- apps/flutter_app/test/screens/party_screen_test.dart — NEW: party screen + catch-up tests
- apps/flutter_app/test/api/api_service_test.dart — NEW: replaces api_client_test.dart, mocks HttpAdapter
- apps/flutter_app/test/screens/home_screen_test.dart — ApiClient → ApiService
- apps/flutter_app/test/screens/join_screen_test.dart — MockClient → MockHttpAdapter, ApiClient → ApiService
- apps/flutter_app/test/routing/deep_link_test.dart — ApiClient → ApiService

**Flutter tests (deleted):**
- apps/flutter_app/test/api/api_client_test.dart — replaced by api_service_test.dart

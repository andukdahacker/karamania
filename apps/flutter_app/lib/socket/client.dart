import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:karamania/api/api_service.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Singleton Socket.io client.
/// Only SocketClient calls mutation methods on providers.
class SocketClient {
  SocketClient._();
  static final SocketClient instance = SocketClient._();

  io.Socket? _socket;
  bool _isConnected = false;
  String? _currentSessionId;
  String? _userId;
  Timer? _disconnectUiTimer;
  Timer? _hostTransferBannerTimer;
  PartyProvider? _partyProvider;

  bool get isConnected => _isConnected;
  String? get currentSessionId => _currentSessionId;
  String? get currentUserId => _userId;

  Future<void> connect({
    required String serverUrl,
    required String token,
    required String sessionId,
    String? displayName,
    required String userId,
    required PartyProvider partyProvider,
  }) async {
    _currentSessionId = sessionId;
    _userId = userId;
    _partyProvider = partyProvider;

    _socket = io.io(
      serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({
            'token': token,
            'sessionId': sessionId,
            'displayName': displayName,
          })
          .setReconnectionDelay(500)
          .setReconnectionDelayMax(3000)
          .setReconnectionAttempts(20)
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnected = true;
    });

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

    _socket!.onConnectError((data) {
      _isConnected = false;
    });

    _socket!.onReconnect((_) {
      _isConnected = true;
      _disconnectUiTimer?.cancel();

      // Only notify provider if we previously showed reconnecting state
      if (partyProvider.connectionStatus == ConnectionStatus.reconnecting) {
        partyProvider.onConnectionStatusChanged(ConnectionStatus.connected);
      }
    });

    _setupPartyListeners(partyProvider);
  }

  void disconnect() {
    _disconnectUiTimer?.cancel();
    _disconnectUiTimer = null;
    _hostTransferBannerTimer?.cancel();
    _hostTransferBannerTimer = null;
    _partyProvider?.onSessionEnd();
    _partyProvider = null;
    _userId = null;
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
    _currentSessionId = null;
  }

  void on(String event, void Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  void emit(String event, [dynamic data]) {
    _socket?.emit(event, data);
  }

  void _setupPartyListeners(PartyProvider partyProvider) {
    on('party:joined', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onParticipantJoined(
        userId: payload['userId'] as String,
        displayName: payload['displayName'] as String,
        participantCount: payload['participantCount'] as int,
      );
    });

    on('party:participants', (data) {
      final payload = data as Map<String, dynamic>;
      final rawList = payload['participants'] as List<dynamic>;
      final participants = rawList
          .map((p) => ParticipantInfo(
                userId: (p as Map<String, dynamic>)['userId'] as String,
                displayName: p['displayName'] as String,
                isOnline: p['isOnline'] as bool? ?? true,
              ))
          .toList();
      partyProvider.onParticipantsSync(participants);

      final status = payload['status'] as String?;
      if (status != null) {
        // CRITICAL: Only trigger catch-up on FIRST join to active session, NOT on reconnection.
        // On reconnection, sessionStatus is already 'active' — skip catch-up card.
        final isFirstJoinToActive =
            status == 'active' && partyProvider.sessionStatus != 'active';
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

    on('party:started', (data) {
      partyProvider.onPartyStarted();
    });

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

    // DJ state change event
    on('dj:stateChanged', (data) {
      final payload = data as Map<String, dynamic>;
      final stateString = payload['state'] as String;
      final DJState djState;
      try {
        djState = DJState.values.byName(stateString);
      } catch (_) {
        // Unrecognized state from server — ignore to avoid crash
        return;
      }
      partyProvider.onDjStateUpdate(
        state: djState,
        songCount: payload['songCount'] as int?,
        participantCount: payload['participantCount'] as int?,
        currentPerformer: payload['currentPerformer'] as String?,
        timerStartedAt: payload['timerStartedAt'] as int?,
        timerDurationMs: payload['timerDurationMs'] as int?,
      );
    });

    // Party ended event
    on('party:ended', (_) {
      partyProvider.onSessionEnded();
    });

    // Participant removed (kicked)
    on('party:participantRemoved', (data) {
      final payload = data as Map<String, dynamic>;
      final userId = payload['userId'] as String;
      if (userId == _userId) {
        partyProvider.onKicked();
        disconnect();
      } else {
        partyProvider.onParticipantRemoved(userId);
      }
    });

    // Host transfer event (AC #4)
    on('party:hostTransferred', (data) {
      final payload = data as Map<String, dynamic>;
      final newHostId = payload['newHostId'] as String;
      final iAmNewHost = newHostId == _userId;
      partyProvider.onHostTransferred(iAmNewHost);
      if (iAmNewHost) {
        _hostTransferBannerTimer?.cancel();
        _hostTransferBannerTimer = Timer(const Duration(seconds: 3), () {
          partyProvider.clearHostTransferPending();
          _hostTransferBannerTimer = null;
        });
      }
    });
  }

  // Host action emitters
  void emitHostSkip() {
    _socket?.emit('host:skip');
  }

  void emitHostOverride(String targetState) {
    _socket?.emit('host:override', {'targetState': targetState});
  }

  void emitHostSongOver() {
    _socket?.emit('host:songOver');
  }

  void emitHostEndParty() {
    _socket?.emit('host:endParty');
  }

  void emitHostKickPlayer(String userId) {
    _socket?.emit('host:kickPlayer', {'userId': userId});
  }

  void startParty(PartyProvider partyProvider) {
    partyProvider.onStartPartyLoading(LoadingState.loading);
    _socket?.emit('party:start');
  }

  void updateVibe({
    required PartyProvider partyProvider,
    required PartyVibe vibe,
  }) {
    partyProvider.onVibeChanged(vibe);
    emit('party:vibeChanged', {'vibe': vibe.name});
  }

  Future<void> createParty({
    required ApiService apiService,
    required AuthProvider authProvider,
    required PartyProvider partyProvider,
    required String serverUrl,
    String? displayName,
    String? vibe,
  }) async {
    partyProvider.onCreatePartyLoading(LoadingState.loading);
    try {
      final token = await authProvider.currentToken;
      final result = await apiService.createSession(
        displayName: displayName,
        vibe: vibe,
        firebaseToken: token,
      );
      final sessionId = result.sessionId;
      final partyCode = result.partyCode;
      final guestToken = result.token;
      final guestId = result.guestId;

      if (guestToken != null && guestId != null) {
        authProvider.onGuestAuthenticated(
          guestToken,
          guestId,
          displayName ?? 'Host',
        );
      }

      partyProvider.onPartyCreated(sessionId, partyCode);

      final connectToken = guestToken ?? token;
      if (connectToken == null) throw Exception('No auth token available');

      await connect(
        serverUrl: serverUrl,
        token: connectToken,
        sessionId: sessionId,
        displayName: displayName ?? authProvider.displayName,
        userId: guestId ?? authProvider.firebaseUser?.uid ?? '',
        partyProvider: partyProvider,
      );
    } catch (e) {
      partyProvider.onCreatePartyLoading(LoadingState.error);
      rethrow;
    }
  }

  Future<void> joinParty({
    required ApiService apiService,
    required AuthProvider authProvider,
    required PartyProvider partyProvider,
    required String serverUrl,
    required String displayName,
    required String partyCode,
  }) async {
    partyProvider.onJoinPartyLoading(LoadingState.loading);
    try {
      final result = await apiService.guestAuth(
        displayName: displayName,
        partyCode: partyCode,
      );
      final token = result.token;
      final guestId = result.guestId;
      final sessionId = result.sessionId;
      final vibeString = result.vibe;

      authProvider.onGuestAuthenticated(token, guestId, displayName);

      final status = result.status;
      final parsedVibe = PartyVibe.values.byName(vibeString);
      partyProvider.onPartyJoined(
        sessionId: sessionId,
        partyCode: partyCode,
        vibe: parsedVibe,
        status: status,
      );

      await connect(
        serverUrl: serverUrl,
        token: token,
        sessionId: sessionId,
        displayName: displayName,
        userId: guestId,
        partyProvider: partyProvider,
      );
    } catch (e) {
      partyProvider.onJoinPartyLoading(LoadingState.error);
      rethrow;
    }
  }
}

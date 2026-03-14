import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:karamania/api/api_service.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/audio/state_transition_audio.dart';
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
  StateTransitionAudio _stateTransitionAudio = StateTransitionAudio();

  /// Replace the [StateTransitionAudio] instance for testing.
  @visibleForTesting
  set stateTransitionAudioOverride(StateTransitionAudio audio) {
    _stateTransitionAudio = audio;
  }

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
    _stateTransitionAudio.reset();
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

    // Ceremony events
    on('ceremony:anticipation', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyAnticipation(
        performerName: payload['performerName'] as String?,
        revealAt: payload['revealAt'] as int,
      );
    });

    on('ceremony:reveal', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyReveal(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
        songTitle: payload['songTitle'] as String?,
      );
      // Trigger moment card overlay for Full ceremony
      partyProvider.showMomentCardOverlay();
    });

    on('ceremony:quick', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onCeremonyQuick(
        award: payload['award'] as String,
        performerName: payload['performerName'] as String?,
        tone: payload['tone'] as String,
      );
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
        isPaused: payload['isPaused'] as bool?,
        ceremonyType: payload['ceremonyType'] as String?,
      );
      _stateTransitionAudio.onStateChanged(
        djState,
        isPaused: payload['isPaused'] as bool? ?? false,
        isHost: partyProvider.isHost,
      );
    });

    // DJ pause event
    on('dj:pause', (data) {
      final payload = data as Map<String, dynamic>;
      partyProvider.onDjPause(
        pausedFromState: payload['pausedFromState'] as String? ?? '',
        timerRemainingMs: payload['timerRemainingMs'] as int?,
      );
      _stateTransitionAudio.onPause();
    });

    // DJ resume event — carries full state payload like dj:stateChanged
    on('dj:resume', (data) {
      final payload = data as Map<String, dynamic>;
      final stateString = payload['state'] as String;
      final DJState djState;
      try {
        djState = DJState.values.byName(stateString);
      } catch (_) {
        return;
      }
      partyProvider.onDjStateUpdate(
        state: djState,
        songCount: payload['songCount'] as int?,
        participantCount: payload['participantCount'] as int?,
        currentPerformer: payload['currentPerformer'] as String?,
        timerStartedAt: payload['timerStartedAt'] as int?,
        timerDurationMs: payload['timerDurationMs'] as int?,
        isPaused: payload['isPaused'] as bool?,
        ceremonyType: payload['ceremonyType'] as String?,
      );
      _stateTransitionAudio.onResume();
    });

    // Party ended event
    on('party:ended', (_) {
      _stateTransitionAudio.reset();
      partyProvider.onSessionEnded();
    });

    // Participant removed (kicked)
    on('party:participantRemoved', (data) {
      final payload = data as Map<String, dynamic>;
      final userId = payload['userId'] as String;
      if (userId == _userId) {
        _stateTransitionAudio.reset();
        partyProvider.onKicked();
        disconnect();
      } else {
        partyProvider.onParticipantRemoved(userId);
      }
    });

    // Reaction broadcast event
    on('reaction:broadcast', (data) {
      final payload = data as Map<String, dynamic>;
      _partyProvider?.onReactionBroadcast(
        userId: payload['userId'] as String,
        emoji: payload['emoji'] as String,
        rewardMultiplier: (payload['rewardMultiplier'] as num).toDouble(),
      );
    });

    // Streak milestone event — sent to this user only
    on('reaction:streak', (data) {
      final payload = data as Map<String, dynamic>;
      _partyProvider?.onStreakMilestone(
        streakCount: payload['streakCount'] as int,
        emoji: payload['emoji'] as String,
        displayName: payload['displayName'] as String,
      );
    });

    // Soundboard broadcast from other users — play sound locally
    on('sound:play', (data) {
      final payload = data as Map<String, dynamic>;
      final soundId = payload['soundId'] as String;
      try {
        final cue = SoundCue.values.byName(soundId);
        AudioEngine.instance.play(cue);
      } catch (_) {
        // Unknown soundId — ignore silently
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

  void emitHostPause() {
    _socket?.emit('host:pause');
  }

  void emitHostResume() {
    _socket?.emit('host:resume');
  }

  void emitHostEndParty() {
    _socket?.emit('host:endParty');
  }

  void emitHostKickPlayer(String userId) {
    _socket?.emit('host:kickPlayer', {'userId': userId});
  }

  void emitReaction(String emoji) {
    _socket?.emit('reaction:sent', {'emoji': emoji});
  }

  void emitSoundboard(String soundId) {
    _socket?.emit('sound:play', {'soundId': soundId});
  }

  void emitMomentCardShared() {
    _socket?.emit('card:shared', {
      'type': 'moment',
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
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
    bool accessibilityEqualVolume = false,
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
      AudioEngine.instance.setRole(
        isHost: true,
        accessibilityEqualVolume: accessibilityEqualVolume,
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
    bool accessibilityEqualVolume = false,
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
      AudioEngine.instance.setRole(
        isHost: false,
        accessibilityEqualVolume: accessibilityEqualVolume,
      );
    } catch (e) {
      partyProvider.onJoinPartyLoading(LoadingState.error);
      rethrow;
    }
  }
}

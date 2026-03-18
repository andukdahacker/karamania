import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:karamania/api/api_service.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/audio/state_transition_audio.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/capture_provider.dart';
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
  CaptureProvider? _captureProvider;
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
    CaptureProvider? captureProvider,
  }) async {
    _currentSessionId = sessionId;
    _userId = userId;
    _partyProvider = partyProvider;
    _captureProvider = captureProvider;
    partyProvider.setLocalUserId(userId);

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
    _captureProvider?.clearState();
    _captureProvider = null;
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

    // Card dealt — server dealt a party card for the current round
    on('card:dealt', (data) {
      final payload = data as Map<String, dynamic>;
      try {
        // Detect redraw: if we already have a card, this is a re-deal
        final isRedraw = _partyProvider?.currentCard != null;
        final card = PartyCardData.fromPayload(payload);
        _partyProvider?.onCardDealt(card);
        // Replay card-flip sound on redraw (initial deal sound handled by StateTransitionAudio)
        if (isRedraw) {
          AudioEngine.instance.play(SoundCue.partyCardDeal);
        }
      } catch (_) {
        // Malformed payload — ignore silently
      }
    });

    // Group card activation — participant selection for group cards
    on('card:groupActivated', (data) {
      final payload = data as Map<String, dynamic>;
      final announcement = payload['announcement'] as String? ?? '';
      final selectedUserIds = (payload['selectedUserIds'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [];
      final selectedDisplayNames =
          (payload['selectedDisplayNames'] as List<dynamic>?)
                  ?.map((e) => e as String)
                  .toList() ??
              [];
      final cardId = payload['cardId'] as String? ?? '';
      _partyProvider?.onGroupCardActivated(
        announcement,
        selectedUserIds,
        selectedDisplayNames,
        cardId,
      );
    });

    // Card accepted broadcast — audience sees the active challenge
    on('card:accepted', (data) {
      final payload = data as Map<String, dynamic>;
      final cardTitle = payload['cardTitle'] as String? ?? '';
      final cardType = payload['cardType'] as String? ?? '';
      _partyProvider?.onCardAcceptedBroadcast(cardTitle, cardType);
    });

    // Quick Pick events
    on('quickpick:started', (data) {
      final payload = data as Map<String, dynamic>;
      final rawSongs = payload['songs'] as List<dynamic>;
      final songs = rawSongs
          .map((s) => QuickPickSong.fromJson(s as Map<String, dynamic>))
          .toList();
      final participantCount = payload['participantCount'] as int;
      final timerDurationMs = payload['timerDurationMs'] as int;
      _partyProvider?.onQuickPickStarted(songs, participantCount, timerDurationMs);
    });

    on('song:quickpick', (data) {
      final payload = data as Map<String, dynamic>;
      final catalogTrackId = payload['catalogTrackId'] as String;
      final userId = payload['userId'] as String;
      final vote = payload['vote'] as String;
      final songVotesRaw = payload['songVotes'] as Map<String, dynamic>;
      final tally = VoteTally.fromJson(songVotesRaw);
      _partyProvider?.onQuickPickVoteReceived(catalogTrackId, userId, vote, tally);
    });

    on('song:queued', (data) {
      final payload = data as Map<String, dynamic>;
      final catalogTrackId = payload['catalogTrackId'] as String;
      final songTitle = payload['songTitle'] as String;
      final artist = payload['artist'] as String;
      final videoId = payload['youtubeVideoId'] as String;

      // Store selected song for suggestion-only display
      _partyProvider?.setLastQueuedSong(
        songTitle: songTitle,
        artist: artist,
        videoId: videoId,
        catalogTrackId: catalogTrackId,
      );

      // Existing quick-pick/spin-wheel resolution logic (unchanged)
      if (_partyProvider?.quickPickSongs.isNotEmpty ?? false) {
        _partyProvider?.onQuickPickResolved(catalogTrackId);
        Timer(const Duration(seconds: 2), () {
          _partyProvider?.onQuickPickCleared();
        });
      }
      if (_partyProvider?.spinWheelSegments.isNotEmpty ?? false) {
        // Spin wheel selection handled via spinwheel:result 'selected' phase
        // song:queued is the confirmation — trigger delayed clear
        Timer(const Duration(seconds: 2), () {
          _partyProvider?.onSpinWheelCleared();
        });
      }
    });

    // Spin the Wheel events
    on('spinwheel:started', (data) {
      final payload = data as Map<String, dynamic>;
      final rawSegments = payload['segments'] as List<dynamic>;
      final segments = rawSegments
          .map((s) => SpinWheelSegment.fromJson(s as Map<String, dynamic>))
          .toList();
      final participantCount = payload['participantCount'] as int;
      final timerDurationMs = payload['timerDurationMs'] as int;
      _partyProvider?.onSpinWheelStarted(segments, participantCount, timerDurationMs);
    });

    on('spinwheel:result', (data) {
      final payload = data as Map<String, dynamic>;
      final phase = payload['phase'] as String;
      switch (phase) {
        case 'spinning':
          _partyProvider?.onSpinWheelSpinning(
            payload['targetSegmentIndex'] as int,
            (payload['totalRotationRadians'] as num).toDouble(),
            payload['spinDurationMs'] as int,
            payload['spinnerDisplayName'] as String?,
          );
          break;
        case 'landed':
          final songData = payload['song'] as Map<String, dynamic>;
          _partyProvider?.onSpinWheelLanded(SpinWheelSegment.fromJson(songData));
          break;
        case 'vetoed':
          final vetoedSongData = payload['vetoedSong'] as Map<String, dynamic>;
          _partyProvider?.onSpinWheelVetoed(
            SpinWheelSegment.fromJson(vetoedSongData),
            payload['newTargetSegmentIndex'] as int,
            (payload['totalRotationRadians'] as num).toDouble(),
            payload['spinDurationMs'] as int,
          );
          break;
        case 'selected':
          final songData = payload['song'] as Map<String, dynamic>;
          _partyProvider?.onSpinWheelSelected(SpinWheelSegment.fromJson(songData));
          break;
      }
    });

    on('song:modeChanged', (data) {
      final payload = data as Map<String, dynamic>;
      final mode = payload['mode'] as String;
      _partyProvider?.onSongSelectionModeChanged(mode);
    });

    // TV pairing events
    on('tv:status', (data) {
      final payload = data as Map<String, dynamic>;
      final statusStr = payload['status'] as String;
      final message = payload['message'] as String?;
      final status = TvConnectionStatus.values.firstWhere((e) => e.name == statusStr);
      _partyProvider?.setTvStatus(status, message: message);

      // Detect graceful degradation from TV disconnect
      final degraded = payload['degraded'] as bool? ?? false;
      if (degraded) {
        _partyProvider?.setTvDegraded(true);
      }

      if (statusStr == 'disconnected') {
        _partyProvider?.clearDetectedSong();
      }
    });

    on('tv:nowPlaying', (data) {
      final payload = data as Map<String, dynamic>;
      final videoId = payload['videoId'] as String;
      final title = payload['title'] as String?;
      final state = payload['state'] as String;
      _partyProvider?.setTvNowPlaying(videoId, title, state);
      // Clear resolved metadata when song stops — new metadata will arrive via song:detected for next song
      if (state == 'idle') {
        _partyProvider?.clearDetectedSong();
      }
    });

    on('song:detected', (data) {
      final payload = data as Map<String, dynamic>;
      _partyProvider?.setDetectedSong(
        songTitle: payload['songTitle'] as String,
        artist: payload['artist'] as String?,
        thumbnail: payload['thumbnail'] as String?,
        source: payload['source'] as String?,
      );
    });

    // Hype cooldown enforced by server
    on('hype:cooldown', (data) {
      final payload = data as Map<String, dynamic>;
      final remainingMs = payload['remainingMs'] as int;
      _partyProvider?.onHypeCooldownEnforced(remainingMs);
    });

    // Capture bubble event
    on('capture:bubble', (data) {
      final payload = data as Map<String, dynamic>;
      final triggerType = payload['triggerType'] as String;
      _captureProvider?.onCaptureBubbleTriggered(triggerType: triggerType);
    });

    // Interlude voting events (Story 7.1)
    on('interlude:voteStarted', (data) {
      final payload = data as Map<String, dynamic>;
      final rawOptions = payload['options'] as List<dynamic>;
      final options = rawOptions
          .map((o) => InterludeOption.fromJson(o as Map<String, dynamic>))
          .toList();
      final voteDurationMs = payload['voteDurationMs'] as int;
      final roundId = payload['roundId'] as String;
      _partyProvider?.onInterludeVoteStarted(options, voteDurationMs, roundId);
    });

    on('interlude:vote', (data) {
      final payload = data as Map<String, dynamic>;
      final voteCounts = (payload['voteCounts'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(k, v as int));
      _partyProvider?.onInterludeVoteReceived(voteCounts);
    });

    on('interlude:voteResult', (data) {
      final payload = data as Map<String, dynamic>;
      final winningOptionId = payload['winningOptionId'] as String;
      final voteCounts = (payload['voteCounts'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(k, v as int));
      final totalVotes = payload['totalVotes'] as int;
      _partyProvider?.onInterludeVoteResult(winningOptionId, voteCounts, totalVotes);
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

  void emitCardAccepted(String cardId) {
    _socket?.emit('card:accepted', {'cardId': cardId});
  }

  void emitCardDismissed(String cardId) {
    _socket?.emit('card:dismissed', {'cardId': cardId});
  }

  void emitCardRedraw() {
    _socket?.emit('card:redraw');
  }

  void emitLightstickToggled(bool active) {
    _socket?.emit('lightstick:toggled', {'active': active});
  }

  void emitHypeSignal() {
    _socket?.emit('hype:fired', {});
  }

  void emitQuickPickVote(String catalogTrackId, String vote) {
    _socket?.emit('song:quickpick', {
      'catalogTrackId': catalogTrackId,
      'vote': vote,
    });
    _partyProvider?.updateMyVote(catalogTrackId, vote);
  }

  void emitInterludeVote(String optionId) {
    _socket?.emit('interlude:vote', {'optionId': optionId});
    _partyProvider?.updateMyInterludeVote(optionId);
  }

  void emitSpinWheelAction(String action) {
    _socket?.emit('song:spinwheel', {'action': action});
  }

  void emitModeChange(String mode) {
    _socket?.emit('song:modeChanged', {'mode': mode});
  }

  void pairTv(String pairingCode) {
    _partyProvider?.setTvPairingState(LoadingState.loading);
    _socket?.emit('tv:pair', {'pairingCode': pairingCode});
  }

  void unpairTv() {
    _socket?.emit('tv:unpair');
  }

  void markSongAsPlaying() {
    final provider = _partyProvider;
    if (provider == null || !provider.hasLastQueuedSong) return;
    _socket?.emit('song:manualPlay', {
      'catalogTrackId': provider.lastQueuedCatalogTrackId,
      'songTitle': provider.lastQueuedSongTitle,
      'artist': provider.lastQueuedArtist,
      'youtubeVideoId': provider.lastQueuedVideoId,
    });
  }

  void emitCaptureStarted({
    required String captureType,
    required String triggerType,
  }) {
    _socket?.emit('capture:started', {
      'captureType': captureType,
      'triggerType': triggerType,
    });
  }

  void emitCaptureComplete({
    required String captureType,
    required String triggerType,
    int? durationMs,
  }) {
    _socket?.emit('capture:complete', {
      'captureType': captureType,
      'triggerType': triggerType,
      if (durationMs != null) 'durationMs': durationMs,
    });
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
    required CaptureProvider captureProvider,
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
        captureProvider: captureProvider,
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
    required CaptureProvider captureProvider,
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
        captureProvider: captureProvider,
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

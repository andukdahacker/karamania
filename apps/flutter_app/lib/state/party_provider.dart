import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

enum ConnectionStatus { connected, reconnecting }

class ParticipantInfo {
  const ParticipantInfo({
    required this.userId,
    required this.displayName,
    this.isOnline = true,
  });
  final String userId;
  final String displayName;
  final bool isOnline;
}

/// Reactive state container only — no business logic.
class PartyProvider extends ChangeNotifier {
  PartyProvider({void Function(bool enable)? wakelockToggle})
      : _wakelockToggle = wakelockToggle ??
            ((enable) => enable ? WakelockPlus.enable() : WakelockPlus.disable());

  final void Function(bool enable) _wakelockToggle;

  DJState _djState = DJState.lobby;
  PartyVibe _vibe = PartyVibe.general;
  String? _sessionId;
  String? _partyCode;
  bool _isHost = false;
  LoadingState _createPartyLoading = LoadingState.idle;
  LoadingState _joinPartyLoading = LoadingState.idle;
  LoadingState _startPartyLoading = LoadingState.idle;
  int _participantCount = 0;
  int _songCount = 0;
  String? _currentPerformer;
  int? _timerStartedAt;
  int? _timerDurationMs;
  bool _wakelockEnabled = false;
  List<ParticipantInfo> _participants = [];
  String _sessionStatus = 'lobby';
  bool _isCatchingUp = false;
  bool _pendingCatchUp = false;
  ConnectionStatus _connectionStatus = ConnectionStatus.connected;
  bool _hostTransferPending = false;
  String? _kickedMessage;
  bool _isPaused = false;
  String? _pausedFromState;
  String? _ceremonyType;

  // Ceremony state — populated by ceremony:anticipation and ceremony:reveal events
  String? _ceremonyPerformerName;
  int? _ceremonyRevealAt;
  String? _ceremonyAward;
  String? _ceremonyTone;

  DJState get djState => _djState;
  PartyVibe get vibe => _vibe;
  String? get sessionId => _sessionId;
  String? get partyCode => _partyCode;
  bool get isHost => _isHost;
  LoadingState get createPartyLoading => _createPartyLoading;
  LoadingState get joinPartyLoading => _joinPartyLoading;
  LoadingState get startPartyLoading => _startPartyLoading;
  int get participantCount => _participantCount;
  int get songCount => _songCount;
  String? get currentPerformer => _currentPerformer;
  int? get timerStartedAt => _timerStartedAt;
  int? get timerDurationMs => _timerDurationMs;
  List<ParticipantInfo> get participants => _participants;
  String get sessionStatus => _sessionStatus;
  bool get isCatchingUp => _isCatchingUp;
  bool get pendingCatchUp => _pendingCatchUp;
  ConnectionStatus get connectionStatus => _connectionStatus;
  bool get hostTransferPending => _hostTransferPending;
  String? get kickedMessage => _kickedMessage;
  bool get isPaused => _isPaused;
  String? get pausedFromState => _pausedFromState;
  String? get ceremonyType => _ceremonyType;
  String? get ceremonyPerformerName => _ceremonyPerformerName;
  int? get ceremonyRevealAt => _ceremonyRevealAt;
  String? get ceremonyAward => _ceremonyAward;
  String? get ceremonyTone => _ceremonyTone;

  /// Background color driven by current DJ state and vibe.
  Color get backgroundColor => djStateBackgroundColor(_djState, _vibe);

  void onCeremonyAnticipation({
    required String? performerName,
    required int revealAt,
  }) {
    _ceremonyPerformerName = performerName;
    _ceremonyRevealAt = revealAt;
    _ceremonyAward = null;
    _ceremonyTone = null;
    notifyListeners();
  }

  void onCeremonyReveal({
    required String award,
    required String? performerName,
    required String tone,
  }) {
    _ceremonyAward = award;
    _ceremonyTone = tone;
    if (performerName != null) _ceremonyPerformerName = performerName;
    notifyListeners();
  }

  void _clearCeremonyState() {
    _ceremonyPerformerName = null;
    _ceremonyRevealAt = null;
    _ceremonyAward = null;
    _ceremonyTone = null;
  }

  void onDjStateUpdate({
    required DJState state,
    int? songCount,
    int? participantCount,
    String? currentPerformer,
    int? timerStartedAt,
    int? timerDurationMs,
    bool? isPaused,
    String? ceremonyType,
  }) {
    // Clear ceremony data when transitioning OUT of ceremony state
    if (_djState == DJState.ceremony && state != DJState.ceremony) {
      _clearCeremonyState();
    }
    _djState = state;
    _ceremonyType = ceremonyType;
    _songCount = songCount ?? _songCount;
    _currentPerformer = currentPerformer;
    _timerStartedAt = timerStartedAt;
    _timerDurationMs = timerDurationMs;
    if (isPaused != null) {
      _isPaused = isPaused;
      if (!isPaused) {
        _pausedFromState = null;
      }
    }

    // Update participant count from DJ state only if non-null AND session is active
    if (participantCount != null && _sessionStatus == 'active') {
      _participantCount = participantCount;
    }

    // Wakelock management — active during non-lobby/non-finale states
    final shouldEnable = state != DJState.lobby && state != DJState.finale;
    if (shouldEnable && !_wakelockEnabled) {
      _wakelockEnabled = true;
      _wakelockToggle(true);
    } else if (!shouldEnable && _wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }

    notifyListeners();
  }

  void onVibeChanged(PartyVibe value) {
    _vibe = value;
    notifyListeners();
  }

  void onDjPause({required String pausedFromState, int? timerRemainingMs}) {
    _isPaused = true;
    _pausedFromState = pausedFromState;
    _timerStartedAt = null;
    _timerDurationMs = null;
    notifyListeners();
  }

  void onDjResume() {
    _isPaused = false;
    _pausedFromState = null;
    notifyListeners();
  }

  void onPartyCreated(String sessionId, String partyCode) {
    _sessionId = sessionId;
    _partyCode = partyCode;
    _isHost = true;
    _participantCount = 1; // Host counts as first participant
    _createPartyLoading = LoadingState.success;
    notifyListeners();
  }

  void onCreatePartyLoading(LoadingState state) {
    _createPartyLoading = state;
    notifyListeners();
  }

  void onJoinPartyLoading(LoadingState state) {
    _joinPartyLoading = state;
    notifyListeners();
  }

  void onPartyJoined({
    required String sessionId,
    required String partyCode,
    required PartyVibe vibe,
    String status = 'lobby',
  }) {
    _sessionId = sessionId;
    _partyCode = partyCode;
    _vibe = vibe;
    _isHost = false;
    _sessionStatus = status;
    _pendingCatchUp = status == 'active';
    _joinPartyLoading = LoadingState.success;
    notifyListeners();
  }

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
    _pendingCatchUp = false;
    notifyListeners();
  }

  void onCatchUpComplete() {
    _isCatchingUp = false;
    notifyListeners();
  }

  void onParticipantJoined({
    required String userId,
    required String displayName,
    required int participantCount,
  }) {
    _participantCount = participantCount;
    _participants = [..._participants, ParticipantInfo(userId: userId, displayName: displayName)];
    notifyListeners();
  }

  void onParticipantsSync(List<ParticipantInfo> participants) {
    _participants = participants;
    _participantCount = participants.length;
    notifyListeners();
  }

  void onConnectionStatusChanged(ConnectionStatus status) {
    _connectionStatus = status;
    notifyListeners();
  }

  void onParticipantDisconnected(String userId) {
    _participants = _participants
        .map((p) => p.userId == userId
            ? ParticipantInfo(
                userId: p.userId,
                displayName: p.displayName,
                isOnline: false,
              )
            : p)
        .toList();
    notifyListeners();
  }

  void onParticipantReconnected(String userId) {
    _participants = _participants
        .map((p) => p.userId == userId
            ? ParticipantInfo(
                userId: p.userId,
                displayName: p.displayName,
                isOnline: true,
              )
            : p)
        .toList();
    notifyListeners();
  }

  void onHostTransferred(bool iAmNewHost) {
    _isHost = iAmNewHost;
    if (iAmNewHost) {
      _hostTransferPending = true;
    }
    notifyListeners();
  }

  void clearHostTransferPending() {
    if (_hostTransferPending) {
      _hostTransferPending = false;
      notifyListeners();
    }
  }

  void onHostUpdate(bool isHost) {
    _isHost = isHost;
    notifyListeners();
  }

  void onSessionEnded() {
    _sessionStatus = 'ended';
    _djState = DJState.lobby;
    _currentPerformer = null;
    _timerStartedAt = null;
    _timerDurationMs = null;
    _ceremonyType = null;
    _clearCeremonyState();
    if (_wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }
    notifyListeners();
  }

  void onKicked() {
    _sessionStatus = 'ended';
    _kickedMessage = 'You have been removed from the party';
    _djState = DJState.lobby;
    _currentPerformer = null;
    _timerStartedAt = null;
    _timerDurationMs = null;
    _ceremonyType = null;
    _clearCeremonyState();
    if (_wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }
    notifyListeners();
  }

  void onParticipantRemoved(String userId) {
    _participants = _participants.where((p) => p.userId != userId).toList();
    _participantCount = _participants.length;
    notifyListeners();
  }

  /// Disable wakelock when leaving the session.
  void onSessionEnd() {
    _clearCeremonyState();
    if (_wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }
  }
}

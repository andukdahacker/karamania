import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/theme/dj_theme.dart';

class ParticipantInfo {
  const ParticipantInfo({required this.userId, required this.displayName});
  final String userId;
  final String displayName;
}

/// Reactive state container only — no business logic.
class PartyProvider extends ChangeNotifier {
  DJState _djState = DJState.lobby;
  PartyVibe _vibe = PartyVibe.general;
  String? _sessionId;
  String? _partyCode;
  bool _isHost = false;
  LoadingState _createPartyLoading = LoadingState.idle;
  LoadingState _joinPartyLoading = LoadingState.idle;
  LoadingState _startPartyLoading = LoadingState.idle;
  int _participantCount = 0;
  List<ParticipantInfo> _participants = [];
  String _sessionStatus = 'lobby';
  bool _isCatchingUp = false;
  bool _pendingCatchUp = false;

  DJState get djState => _djState;
  PartyVibe get vibe => _vibe;
  String? get sessionId => _sessionId;
  String? get partyCode => _partyCode;
  bool get isHost => _isHost;
  LoadingState get createPartyLoading => _createPartyLoading;
  LoadingState get joinPartyLoading => _joinPartyLoading;
  LoadingState get startPartyLoading => _startPartyLoading;
  int get participantCount => _participantCount;
  List<ParticipantInfo> get participants => _participants;
  String get sessionStatus => _sessionStatus;
  bool get isCatchingUp => _isCatchingUp;
  bool get pendingCatchUp => _pendingCatchUp;

  /// Background color driven by current DJ state and vibe.
  Color get backgroundColor => djStateBackgroundColor(_djState, _vibe);

  void onDJStateChanged(DJState value) {
    _djState = value;
    notifyListeners();
  }

  void onVibeChanged(PartyVibe value) {
    _vibe = value;
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
}

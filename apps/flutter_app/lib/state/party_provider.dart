import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Reactive state container only — no business logic.
class PartyProvider extends ChangeNotifier {
  DJState _djState = DJState.lobby;
  PartyVibe _vibe = PartyVibe.general;
  String? _sessionId;
  String? _partyCode;
  bool _isHost = false;
  LoadingState _createPartyLoading = LoadingState.idle;
  int _participantCount = 0;

  DJState get djState => _djState;
  PartyVibe get vibe => _vibe;
  String? get sessionId => _sessionId;
  String? get partyCode => _partyCode;
  bool get isHost => _isHost;
  LoadingState get createPartyLoading => _createPartyLoading;
  int get participantCount => _participantCount;

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
}

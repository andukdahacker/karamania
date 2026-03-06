import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Stub party state provider.
/// Reactive state container only — no business logic.
class PartyProvider extends ChangeNotifier {
  DJState _djState = DJState.lobby;
  PartyVibe _vibe = PartyVibe.general;

  DJState get djState => _djState;
  PartyVibe get vibe => _vibe;

  /// Background color driven by current DJ state and vibe.
  Color get backgroundColor => djStateBackgroundColor(_djState, _vibe);

  // TODO: Implement in Story 1.3 — SocketClient will call these methods
  void onDJStateChanged(DJState value) {
    _djState = value;
    notifyListeners();
  }

  // TODO: Implement in Story 1.3
  void onVibeChanged(PartyVibe value) {
    _vibe = value;
    notifyListeners();
  }
}

import 'dart:async';
import 'package:flutter/foundation.dart';

class CaptureProvider extends ChangeNotifier {
  // Bubble visibility state
  bool _isBubbleVisible = false;
  String? _currentTriggerType;
  Timer? _autoDismissTimer;

  // Throttle: max 1 bubble per 60s (client-side mirror of server throttle)
  DateTime? _lastBubbleShownAt;
  static const _bubbleCooldown = Duration(seconds: 60);
  static const _autoDismissDuration = Duration(seconds: 15);

  // Getters
  bool get isBubbleVisible => _isBubbleVisible;
  String? get currentTriggerType => _currentTriggerType;

  // Called ONLY by SocketClient on capture:bubble event
  void onCaptureBubbleTriggered({required String triggerType}) {
    // Client-side cooldown check (defense in depth — server also throttles)
    final now = DateTime.now();
    if (_lastBubbleShownAt != null &&
        now.difference(_lastBubbleShownAt!) < _bubbleCooldown) {
      return;
    }
    if (_isBubbleVisible) return; // Already showing a bubble

    _isBubbleVisible = true;
    _currentTriggerType = triggerType;
    _lastBubbleShownAt = now;
    notifyListeners();

    // Auto-dismiss after 15 seconds
    _autoDismissTimer?.cancel();
    _autoDismissTimer = Timer(_autoDismissDuration, () {
      dismissBubble();
    });
  }

  // Called when bubble is tapped (Story 6.2 will handle capture flow)
  void onBubbleTapped() {
    _autoDismissTimer?.cancel();
    _isBubbleVisible = false;
    _currentTriggerType = null;
    // TODO Story 6.2: Initiate inline capture flow
    notifyListeners();
  }

  // Called when bubble is explicitly dismissed or auto-dismissed
  void dismissBubble() {
    _autoDismissTimer?.cancel();
    _isBubbleVisible = false;
    _currentTriggerType = null;
    notifyListeners();
  }

  // Called on session end cleanup
  void clearState() {
    _autoDismissTimer?.cancel();
    _isBubbleVisible = false;
    _currentTriggerType = null;
    _lastBubbleShownAt = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    super.dispose();
  }
}

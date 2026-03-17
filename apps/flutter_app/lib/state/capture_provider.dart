import 'dart:async';
import 'package:flutter/foundation.dart';

/// Capture types — must stay in sync with server-side type union
/// in capture-handlers.ts: 'photo' | 'video' | 'audio'
enum CaptureType { photo, video, audio }

class CaptureProvider extends ChangeNotifier {
  // Bubble visibility state
  bool _isBubbleVisible = false;
  String? _currentTriggerType;
  Timer? _autoDismissTimer;

  // Throttle: max 1 bubble per 60s (client-side mirror of server throttle)
  DateTime? _lastBubbleShownAt;
  static const _bubbleCooldown = Duration(seconds: 60);
  static const _autoDismissDuration = Duration(seconds: 15);

  // --- Capture flow state (Story 6.2) ---

  // Capture mode selector visibility (after bubble pop)
  bool _isSelectorVisible = false;
  bool get isSelectorVisible => _isSelectorVisible;

  // Active capture state
  CaptureType? _activeCaptureType;
  CaptureType? get activeCaptureType => _activeCaptureType;

  bool _isCapturing = false;
  bool get isCapturing => _isCapturing;

  // Track trigger source for analytics
  String _captureTriggerType = 'manual';
  String get captureTriggerType => _captureTriggerType;

  // Video/audio countdown seconds
  int _recordingSecondsRemaining = 0;
  int get recordingSecondsRemaining => _recordingSecondsRemaining;

  // Recording countdown tick timer
  Timer? _countdownTimer;

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

  // Called when bubble is tapped — shows capture mode selector
  void onBubbleTapped() {
    _autoDismissTimer?.cancel();
    _isBubbleVisible = false;
    _captureTriggerType = _currentTriggerType ?? 'manual';
    _currentTriggerType = null;
    _isSelectorVisible = true;
    notifyListeners();
  }

  // Called when persistent capture icon is tapped (FR39)
  void onManualCaptureTriggered() {
    if (_isCapturing || _isSelectorVisible) return;
    _captureTriggerType = 'manual';
    _isSelectorVisible = true;
    notifyListeners();
  }

  // Called when a capture type is selected from the mode selector
  void onCaptureTypeSelected(CaptureType type) {
    _isSelectorVisible = false;
    _activeCaptureType = type;
    _isCapturing = true;

    // M2 fix: only start countdown for audio — video uses native picker
    // which enforces maxDuration itself (countdown would be invisible)
    if (type == CaptureType.audio) {
      _recordingSecondsRemaining = 10;
      _startCountdown();
    }

    notifyListeners();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _recordingSecondsRemaining--;
      if (_recordingSecondsRemaining <= 0) {
        timer.cancel();
      }
      notifyListeners();
    });
  }

  void onCaptureComplete() {
    _countdownTimer?.cancel();
    _isCapturing = false;
    _activeCaptureType = null;
    _recordingSecondsRemaining = 0;
    notifyListeners();
  }

  void onCaptureCancelled() {
    _countdownTimer?.cancel();
    _isSelectorVisible = false;
    _isCapturing = false;
    _activeCaptureType = null;
    _recordingSecondsRemaining = 0;
    notifyListeners();
  }

  // Called when bubble is explicitly dismissed or auto-dismissed
  void dismissBubble() {
    _autoDismissTimer?.cancel();
    _isBubbleVisible = false;
    _currentTriggerType = null;
    _isSelectorVisible = false;
    notifyListeners();
  }

  // Called on session end cleanup
  void clearState() {
    _autoDismissTimer?.cancel();
    _countdownTimer?.cancel();
    _isBubbleVisible = false;
    _currentTriggerType = null;
    _lastBubbleShownAt = null;
    _isSelectorVisible = false;
    _isCapturing = false;
    _activeCaptureType = null;
    _recordingSecondsRemaining = 0;
    _captureTriggerType = 'manual';
    notifyListeners();
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }
}

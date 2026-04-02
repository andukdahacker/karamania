import 'package:flutter/foundation.dart';

enum DetectionStatus { idle, listening, detected, noMatch, error }

class DetectedSong {
  final String title;
  final String artist;
  final String? isrc;
  final int? timeOffsetMs;
  final int confidence;
  final String source;

  const DetectedSong({
    required this.title,
    required this.artist,
    this.isrc,
    this.timeOffsetMs,
    required this.confidence,
    required this.source,
  });
}

class DetectionProvider extends ChangeNotifier {
  DetectionStatus _detectionStatus = DetectionStatus.idle;
  DetectedSong? _detectedSong;
  int _consecutiveFailures = 0;

  DetectionStatus get detectionStatus => _detectionStatus;
  DetectedSong? get detectedSong => _detectedSong;
  int get consecutiveFailures => _consecutiveFailures;

  void onDetectionStarted() {
    _detectionStatus = DetectionStatus.listening;
    notifyListeners();
  }

  void onDetectionResult({
    required String title,
    required String artist,
    String? isrc,
    int? timeOffsetMs,
    required int confidence,
    required String source,
  }) {
    _detectionStatus = DetectionStatus.detected;
    _detectedSong = DetectedSong(
      title: title,
      artist: artist,
      isrc: isrc,
      timeOffsetMs: timeOffsetMs,
      confidence: confidence,
      source: source,
    );
    _consecutiveFailures = 0;
    notifyListeners();
  }

  void onDetectionFailed() {
    _detectionStatus = DetectionStatus.noMatch;
    _consecutiveFailures++;
    notifyListeners();
  }

  void onDetectionReset() {
    _detectionStatus = DetectionStatus.idle;
    _detectedSong = null;
    // Preserve consecutiveFailures across song transitions for fallback threshold tracking
    notifyListeners();
  }
}

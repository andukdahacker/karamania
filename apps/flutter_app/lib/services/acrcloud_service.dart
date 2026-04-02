import 'package:flutter/foundation.dart';
import 'package:flutter_acrcloud/flutter_acrcloud.dart';
import 'package:meta/meta.dart';
import 'package:permission_handler/permission_handler.dart';

class AcrCloudResult {
  final String title;
  final String artist;
  final int confidence;
  final int playOffsetMs;
  final int durationMs;
  final String? isrc;
  final int statusCode;

  const AcrCloudResult({
    required this.title,
    required this.artist,
    required this.confidence,
    required this.playOffsetMs,
    required this.durationMs,
    this.isrc,
    required this.statusCode,
  });
}

class AcrCloudService {
  AcrCloudService._();
  static final instance = AcrCloudService._();

  bool _isSetUp = false;
  ACRCloudSession? _activeSession;

  bool get isSetUp => _isSetUp;

  @visibleForTesting
  void reset() {
    _isSetUp = false;
    _activeSession = null;
  }

  Future<void> setUp({
    required String accessKey,
    required String accessSecret,
    required String host,
  }) async {
    await ACRCloud.setUp(ACRCloudConfig(accessKey, accessSecret, host));
    _isSetUp = true;
  }

  Future<AcrCloudResult?> startDetection() async {
    if (!_isSetUp) {
      debugPrint('ACRCloud not set up — call setUp() first');
      return null;
    }

    // Request microphone permission before detection
    final status = await Permission.microphone.request();
    if (!status.isGranted) {
      debugPrint('Microphone permission denied');
      return null;
    }

    _activeSession = ACRCloud.startSession();
    try {
      final result = await _activeSession!.result;
      if (result == null || result.metadata == null) {
        return null;
      }

      if (result.metadata!.music.isEmpty) {
        return null;
      }

      final music = result.metadata!.music.first;
      return AcrCloudResult(
        title: music.title,
        artist: music.artists.isNotEmpty ? music.artists.first.name : 'Unknown',
        confidence: music.score,
        playOffsetMs: music.playOffsetMs,
        durationMs: music.durationMs,
        // ISRC not available in flutter_acrcloud SDK v1.0.0
        isrc: null,
        statusCode: result.status.code,
      );
    } finally {
      _activeSession?.dispose();
      _activeSession = null;
    }
  }

  void cancelDetection() {
    _activeSession?.cancel();
    _activeSession = null;
  }
}

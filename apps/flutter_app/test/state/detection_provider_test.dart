import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/detection_provider.dart';

void main() {
  group('DetectionProvider', () {
    late DetectionProvider provider;

    setUp(() {
      provider = DetectionProvider();
    });

    tearDown(() {
      provider.dispose();
    });

    test('initial state: idle, no detected song, zero failures', () {
      expect(provider.detectionStatus, DetectionStatus.idle);
      expect(provider.detectedSong, isNull);
      expect(provider.consecutiveFailures, 0);
    });

    test('onDetectionStarted sets status to listening', () {
      provider.onDetectionStarted();
      expect(provider.detectionStatus, DetectionStatus.listening);
    });

    test('onDetectionStarted notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDetectionStarted();
      expect(notifyCount, 1);
    });

    test('onDetectionResult sets status to detected and stores song', () {
      provider.onDetectionStarted();
      provider.onDetectionResult(
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        isrc: 'GBUM71029604',
        timeOffsetMs: 45000,
        confidence: 95,
        source: 'acr',
      );

      expect(provider.detectionStatus, DetectionStatus.detected);
      expect(provider.detectedSong, isNotNull);
      expect(provider.detectedSong!.title, 'Bohemian Rhapsody');
      expect(provider.detectedSong!.artist, 'Queen');
      expect(provider.detectedSong!.isrc, 'GBUM71029604');
      expect(provider.detectedSong!.timeOffsetMs, 45000);
      expect(provider.detectedSong!.confidence, 95);
      expect(provider.detectedSong!.source, 'acr');
    });

    test('onDetectionResult resets consecutiveFailures', () {
      provider.onDetectionFailed();
      provider.onDetectionFailed();
      expect(provider.consecutiveFailures, 2);

      provider.onDetectionResult(
        title: 'Test Song',
        artist: 'Test Artist',
        confidence: 80,
        source: 'acr',
      );
      expect(provider.consecutiveFailures, 0);
    });

    test('onDetectionResult notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDetectionResult(
        title: 'Test',
        artist: 'Artist',
        confidence: 80,
        source: 'acr',
      );
      expect(notifyCount, 1);
    });

    test('onDetectionFailed sets status to noMatch and increments failures', () {
      provider.onDetectionStarted();
      provider.onDetectionFailed();

      expect(provider.detectionStatus, DetectionStatus.noMatch);
      expect(provider.consecutiveFailures, 1);
    });

    test('onDetectionFailed increments failures cumulatively', () {
      provider.onDetectionFailed();
      provider.onDetectionFailed();
      provider.onDetectionFailed();
      expect(provider.consecutiveFailures, 3);
    });

    test('onDetectionFailed notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDetectionFailed();
      expect(notifyCount, 1);
    });

    test('onDetectionReset returns to idle and clears song but preserves failures', () {
      provider.onDetectionFailed();
      provider.onDetectionFailed();
      provider.onDetectionResult(
        title: 'Song',
        artist: 'Artist',
        confidence: 90,
        source: 'acr',
      );
      expect(provider.detectedSong, isNotNull);
      expect(provider.consecutiveFailures, 0); // reset by successful detection

      provider.onDetectionFailed();
      provider.onDetectionFailed();
      expect(provider.consecutiveFailures, 2);

      provider.onDetectionReset();
      expect(provider.detectionStatus, DetectionStatus.idle);
      expect(provider.detectedSong, isNull);
      expect(provider.consecutiveFailures, 2); // preserved across reset
    });

    test('onDetectionReset notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onDetectionReset();
      expect(notifyCount, 1);
    });

    test('full lifecycle: idle → listening → detected → reset → idle', () {
      expect(provider.detectionStatus, DetectionStatus.idle);

      provider.onDetectionStarted();
      expect(provider.detectionStatus, DetectionStatus.listening);

      provider.onDetectionResult(
        title: 'Song',
        artist: 'Artist',
        confidence: 85,
        source: 'acr',
      );
      expect(provider.detectionStatus, DetectionStatus.detected);
      expect(provider.detectedSong, isNotNull);

      provider.onDetectionReset();
      expect(provider.detectionStatus, DetectionStatus.idle);
      expect(provider.detectedSong, isNull);
    });

    test('full lifecycle: idle → listening → noMatch → reset → idle', () {
      expect(provider.detectionStatus, DetectionStatus.idle);

      provider.onDetectionStarted();
      expect(provider.detectionStatus, DetectionStatus.listening);

      provider.onDetectionFailed();
      expect(provider.detectionStatus, DetectionStatus.noMatch);
      expect(provider.consecutiveFailures, 1);

      provider.onDetectionReset();
      expect(provider.detectionStatus, DetectionStatus.idle);
      expect(provider.consecutiveFailures, 1); // preserved for fallback threshold
    });

    test('onDetectionResult with optional null fields', () {
      provider.onDetectionResult(
        title: 'Unknown Track',
        artist: 'Unknown',
        confidence: 50,
        source: 'acr',
      );

      expect(provider.detectedSong!.isrc, isNull);
      expect(provider.detectedSong!.timeOffsetMs, isNull);
    });
  });
}

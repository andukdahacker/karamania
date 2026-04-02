import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/services/acrcloud_service.dart';

void main() {
  group('AcrCloudService', () {
    setUp(() {
      AcrCloudService.instance.reset();
    });

    test('instance returns singleton', () {
      final a = AcrCloudService.instance;
      final b = AcrCloudService.instance;
      expect(identical(a, b), isTrue);
    });

    test('isSetUp is false before setUp', () {
      expect(AcrCloudService.instance.isSetUp, isFalse);
    });
  });

  group('AcrCloudResult', () {
    test('constructs with all required fields', () {
      final result = AcrCloudResult(
        title: 'Song Title',
        artist: 'Artist Name',
        confidence: 85,
        playOffsetMs: 30000,
        durationMs: 240000,
        isrc: 'US1234567890',
        statusCode: 0,
      );

      expect(result.title, 'Song Title');
      expect(result.artist, 'Artist Name');
      expect(result.confidence, 85);
      expect(result.playOffsetMs, 30000);
      expect(result.durationMs, 240000);
      expect(result.isrc, 'US1234567890');
      expect(result.statusCode, 0);
    });

    test('constructs with nullable isrc as null', () {
      final result = AcrCloudResult(
        title: 'Song',
        artist: 'Artist',
        confidence: 70,
        playOffsetMs: 0,
        durationMs: 180000,
        statusCode: 0,
      );

      expect(result.isrc, isNull);
    });
  });
}

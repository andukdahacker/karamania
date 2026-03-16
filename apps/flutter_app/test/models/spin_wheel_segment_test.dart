import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/party_provider.dart';

void main() {
  group('SpinWheelSegment', () {
    test('fromJson creates instance with all fields', () {
      final json = {
        'catalogTrackId': 'cat-123',
        'songTitle': 'Bohemian Rhapsody',
        'artist': 'Queen',
        'youtubeVideoId': 'yt_abc',
        'overlapCount': 4,
        'segmentIndex': 3,
      };

      final segment = SpinWheelSegment.fromJson(json);

      expect(segment.catalogTrackId, 'cat-123');
      expect(segment.songTitle, 'Bohemian Rhapsody');
      expect(segment.artist, 'Queen');
      expect(segment.youtubeVideoId, 'yt_abc');
      expect(segment.overlapCount, 4);
      expect(segment.segmentIndex, 3);
    });

    test('fromJson handles zero overlapCount and segmentIndex', () {
      final json = {
        'catalogTrackId': 'cat-456',
        'songTitle': 'Test Song',
        'artist': 'Test Artist',
        'youtubeVideoId': 'yt_xyz',
        'overlapCount': 0,
        'segmentIndex': 0,
      };

      final segment = SpinWheelSegment.fromJson(json);
      expect(segment.overlapCount, 0);
      expect(segment.segmentIndex, 0);
    });
  });
}

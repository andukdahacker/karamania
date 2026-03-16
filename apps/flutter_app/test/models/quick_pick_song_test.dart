import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/party_provider.dart';

void main() {
  group('QuickPickSong', () {
    test('fromJson creates instance with all fields', () {
      final json = {
        'catalogTrackId': 'cat-123',
        'songTitle': 'Bohemian Rhapsody',
        'artist': 'Queen',
        'youtubeVideoId': 'yt_abc',
        'overlapCount': 4,
      };

      final song = QuickPickSong.fromJson(json);

      expect(song.catalogTrackId, 'cat-123');
      expect(song.songTitle, 'Bohemian Rhapsody');
      expect(song.artist, 'Queen');
      expect(song.youtubeVideoId, 'yt_abc');
      expect(song.overlapCount, 4);
    });

    test('fromJson handles zero overlapCount', () {
      final json = {
        'catalogTrackId': 'cat-456',
        'songTitle': 'Test Song',
        'artist': 'Test Artist',
        'youtubeVideoId': 'yt_xyz',
        'overlapCount': 0,
      };

      final song = QuickPickSong.fromJson(json);
      expect(song.overlapCount, 0);
    });
  });
}

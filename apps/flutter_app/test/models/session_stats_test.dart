import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/models/session_stats.dart';

void main() {
  group('SessionStats', () {
    test('fromJson creates correct SessionStats from full JSON', () {
      final json = {
        'songCount': 12,
        'participantCount': 6,
        'sessionDurationMs': 3600000,
        'totalReactions': 150,
        'totalSoundboardPlays': 30,
        'totalCardsDealt': 8,
        'topReactor': {
          'displayName': 'Alice',
          'count': 42,
        },
        'longestStreak': 5,
      };

      final stats = SessionStats.fromJson(json);

      expect(stats.songCount, 12);
      expect(stats.participantCount, 6);
      expect(stats.sessionDurationMs, 3600000);
      expect(stats.totalReactions, 150);
      expect(stats.totalSoundboardPlays, 30);
      expect(stats.totalCardsDealt, 8);
      expect(stats.topReactor, isNotNull);
      expect(stats.topReactor!.displayName, 'Alice');
      expect(stats.topReactor!.count, 42);
      expect(stats.longestStreak, 5);
    });

    test('fromJson handles null fields with defaults', () {
      final json = <String, dynamic>{};

      final stats = SessionStats.fromJson(json);

      expect(stats.songCount, 0);
      expect(stats.participantCount, 0);
      expect(stats.sessionDurationMs, 0);
      expect(stats.totalReactions, 0);
      expect(stats.totalSoundboardPlays, 0);
      expect(stats.totalCardsDealt, 0);
      expect(stats.topReactor, isNull);
      expect(stats.longestStreak, 0);
    });
  });

  group('TopReactor', () {
    test('fromJson works', () {
      final json = {
        'displayName': 'Bob',
        'count': 99,
      };

      final reactor = TopReactor.fromJson(json);

      expect(reactor.displayName, 'Bob');
      expect(reactor.count, 99);
    });

    test('fromJson handles null fields with defaults', () {
      final json = <String, dynamic>{};

      final reactor = TopReactor.fromJson(json);

      expect(reactor.displayName, '');
      expect(reactor.count, 0);
    });
  });
}

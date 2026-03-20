import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/models/setlist_entry.dart';

void main() {
  group('SetlistEntry', () {
    test('fromJson creates correct SetlistEntry from full JSON', () {
      final json = {
        'position': 3,
        'title': 'Bohemian Rhapsody',
        'artist': 'Queen',
        'performerName': 'Alice',
        'awardTitle': 'Showstopper',
        'awardTone': 'hype',
      };

      final entry = SetlistEntry.fromJson(json);

      expect(entry.position, 3);
      expect(entry.title, 'Bohemian Rhapsody');
      expect(entry.artist, 'Queen');
      expect(entry.performerName, 'Alice');
      expect(entry.awardTitle, 'Showstopper');
      expect(entry.awardTone, 'hype');
    });

    test('fromJson handles null optional fields', () {
      final json = {
        'position': 1,
        'title': 'Yesterday',
        'artist': 'The Beatles',
      };

      final entry = SetlistEntry.fromJson(json);

      expect(entry.position, 1);
      expect(entry.title, 'Yesterday');
      expect(entry.artist, 'The Beatles');
      expect(entry.performerName, isNull);
      expect(entry.awardTitle, isNull);
      expect(entry.awardTone, isNull);
    });

    test('fromJson handles completely empty JSON with defaults', () {
      final json = <String, dynamic>{};

      final entry = SetlistEntry.fromJson(json);

      expect(entry.position, 0);
      expect(entry.title, '');
      expect(entry.artist, '');
      expect(entry.performerName, isNull);
      expect(entry.awardTitle, isNull);
      expect(entry.awardTone, isNull);
    });
  });
}

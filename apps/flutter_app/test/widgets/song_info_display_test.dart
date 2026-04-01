import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/widgets/song_info_display.dart';

Widget _wrap(Widget child) {
  return MaterialApp(home: Scaffold(body: child));
}

void main() {
  group('SongInfoDisplay', () {
    testWidgets('renders song title with key song-info-title', (tester) async {
      await tester.pumpWidget(_wrap(
        SongInfoDisplay(
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          vibeAccent: Colors.amber,
        ),
      ));

      expect(find.byKey(const Key('song-info-title')), findsOneWidget);
    });

    testWidgets('renders artist with key song-info-artist', (tester) async {
      await tester.pumpWidget(_wrap(
        SongInfoDisplay(
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          vibeAccent: Colors.amber,
        ),
      ));

      expect(find.byKey(const Key('song-info-artist')), findsOneWidget);
    });

    testWidgets('renders performer with key song-info-performer when provided',
        (tester) async {
      await tester.pumpWidget(_wrap(
        SongInfoDisplay(
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          performerName: 'Alice',
          vibeAccent: Colors.amber,
        ),
      ));

      expect(find.byKey(const Key('song-info-performer')), findsOneWidget);
    });

    testWidgets('hides performer row when performerName is null', (tester) async {
      await tester.pumpWidget(_wrap(
        SongInfoDisplay(
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          vibeAccent: Colors.amber,
        ),
      ));

      expect(find.byKey(const Key('song-info-performer')), findsNothing);
    });

    testWidgets('song title text content matches input', (tester) async {
      await tester.pumpWidget(_wrap(
        SongInfoDisplay(
          songTitle: 'Don\'t Stop Me Now',
          artist: 'Queen',
          vibeAccent: Colors.amber,
        ),
      ));

      expect(find.text('Don\'t Stop Me Now'), findsOneWidget);
    });

    testWidgets('artist text content matches input', (tester) async {
      await tester.pumpWidget(_wrap(
        SongInfoDisplay(
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          vibeAccent: Colors.amber,
        ),
      ));

      expect(find.text('Queen'), findsOneWidget);
    });
  });
}

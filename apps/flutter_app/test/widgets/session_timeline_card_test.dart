import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/widgets/session_timeline_card.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    home: Scaffold(body: child),
  );
}

void main() {
  group('SessionTimelineCard', () {
    testWidgets('displays date, venue, participant count, and award', (tester) async {
      final session = SessionTimelineItem(
        id: 'session-1',
        venueName: 'Karaoke Bar',
        endedAt: '2026-03-10T12:00:00Z',
        participantCount: 8,
        topAward: 'Star of the Show',
        thumbnailUrl: null,
      );

      await tester.pumpWidget(_wrap(
        SessionTimelineCard(session: session, onTap: () {}),
      ));

      expect(find.text('Karaoke Bar'), findsOneWidget);
      expect(find.text('Mar 10, 2026'), findsOneWidget);
      expect(find.text('8'), findsOneWidget);
      expect(find.text('Star of the Show'), findsOneWidget);
    });

    testWidgets('handles missing venue name gracefully', (tester) async {
      final session = SessionTimelineItem(
        id: 'session-2',
        venueName: null,
        endedAt: '2026-03-10T12:00:00Z',
        participantCount: 3,
        topAward: null,
        thumbnailUrl: null,
      );

      await tester.pumpWidget(_wrap(
        SessionTimelineCard(session: session, onTap: () {}),
      ));

      // Falls back to "Karaoke Night"
      expect(find.text('Karaoke Night'), findsOneWidget);
    });

    testWidgets('handles missing thumbnail gracefully', (tester) async {
      final session = SessionTimelineItem(
        id: 'session-3',
        venueName: 'Studio',
        endedAt: '2026-03-10T12:00:00Z',
        participantCount: 4,
        topAward: null,
        thumbnailUrl: null,
      );

      await tester.pumpWidget(_wrap(
        SessionTimelineCard(session: session, onTap: () {}),
      ));

      // Should show placeholder icon instead of Image.network
      expect(find.byIcon(Icons.music_note), findsOneWidget);
    });

    testWidgets('does not show award chip when topAward is null', (tester) async {
      final session = SessionTimelineItem(
        id: 'session-4',
        venueName: 'Studio',
        endedAt: '2026-03-10T12:00:00Z',
        participantCount: 2,
        topAward: null,
        thumbnailUrl: null,
      );

      await tester.pumpWidget(_wrap(
        SessionTimelineCard(session: session, onTap: () {}),
      ));

      expect(find.text('Star of the Show'), findsNothing);
    });

    testWidgets('triggers onTap callback when tapped', (tester) async {
      bool tapped = false;
      final session = SessionTimelineItem(
        id: 'session-5',
        venueName: 'Tap Test',
        endedAt: '2026-03-10T12:00:00Z',
        participantCount: 1,
        topAward: null,
        thumbnailUrl: null,
      );

      await tester.pumpWidget(_wrap(
        SessionTimelineCard(session: session, onTap: () => tapped = true),
      ));

      await tester.tap(find.text('Tap Test'));
      expect(tapped, isTrue);
    });
  });
}

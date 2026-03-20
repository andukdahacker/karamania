import 'dart:ui' show Color;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/setlist_poster_widget.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  List<SetlistEntry> createTestSetlist({int count = 3}) {
    return List.generate(count, (i) {
      return SetlistEntry(
        position: i + 1,
        title: 'Song ${i + 1}',
        artist: 'Artist ${i + 1}',
        performerName: 'Performer ${i + 1}',
        awardTitle: i == 0 ? 'Mic Drop Master' : null,
      );
    });
  }

  Widget buildTestPoster({
    List<SetlistEntry>? setlist,
    PartyVibe vibe = PartyVibe.general,
    String? venueName,
    DateTime? date,
  }) {
    return MaterialApp(
      theme: createDJTheme(vibe: vibe),
      home: Scaffold(
        body: SingleChildScrollView(
          child: SetlistPosterWidget(
            setlist: setlist ?? createTestSetlist(),
            vibe: vibe,
            venueName: venueName,
            date: date ?? DateTime(2026, 3, 20),
          ),
        ),
      ),
    );
  }

  group('SetlistPosterWidget', () {
    testWidgets('renders with full setlist data', (tester) async {
      await tester.pumpWidget(buildTestPoster());

      expect(find.text('Song 1'), findsOneWidget);
      expect(find.text('by Artist 1'), findsOneWidget);
      expect(find.text('Performer 1'), findsOneWidget);
      expect(find.text('Mic Drop Master'), findsOneWidget);
    });

    testWidgets('renders with empty setlist showing placeholder',
        (tester) async {
      await tester.pumpWidget(buildTestPoster(setlist: []));

      expect(find.text(Copy.setlistPosterNoSongs), findsOneWidget);
    });

    testWidgets('omits performer tag when performerName is null',
        (tester) async {
      final setlist = [
        const SetlistEntry(
          position: 1,
          title: 'Solo Song',
          artist: 'Solo Artist',
        ),
      ];
      await tester.pumpWidget(buildTestPoster(setlist: setlist));

      expect(find.text('Solo Song'), findsOneWidget);
      expect(find.byKey(const Key('setlist-poster-performer-1')), findsNothing);
    });

    testWidgets('omits award badge when awardTitle is null', (tester) async {
      final setlist = [
        const SetlistEntry(
          position: 1,
          title: 'No Award Song',
          artist: 'Some Artist',
          performerName: 'Someone',
        ),
      ];
      await tester.pumpWidget(buildTestPoster(setlist: setlist));

      expect(find.text('No Award Song'), findsOneWidget);
      expect(find.byKey(const Key('setlist-poster-award-1')), findsNothing);
    });

    testWidgets('renders with long text without overflow errors',
        (tester) async {
      final setlist = [
        const SetlistEntry(
          position: 1,
          title: 'A Very Long Song Title That Should Be Truncated Gracefully',
          artist:
              'An Extremely Long Artist Name That Also Needs Truncation Here',
          performerName: 'A Super Long Performer Display Name',
          awardTitle: 'The Longest Award Title In History Of Awards',
        ),
      ];
      await tester.pumpWidget(buildTestPoster(setlist: setlist));

      // No overflow errors thrown = test passes
      expect(find.byKey(const Key('setlist-poster')), findsOneWidget);
    });

    testWidgets('maintains 9:16 aspect ratio', (tester) async {
      await tester.pumpWidget(buildTestPoster());

      final aspectRatio = tester.widget<AspectRatio>(find.byType(AspectRatio));
      expect(aspectRatio.aspectRatio, 9 / 16);
    });

    testWidgets('applies vibe-specific accent color (general)',
        (tester) async {
      await tester.pumpWidget(buildTestPoster(vibe: PartyVibe.general));

      // Verify position number uses vibe accent color
      final positionText = tester.widget<Text>(find.text('#1'));
      final color = positionText.style?.color;
      expect(color, equals(PartyVibe.general.accent));
    });

    testWidgets('applies vibe-specific accent color (kpop)', (tester) async {
      await tester.pumpWidget(buildTestPoster(vibe: PartyVibe.kpop));

      final positionText = tester.widget<Text>(find.text('#1'));
      final color = positionText.style?.color;
      expect(color, equals(PartyVibe.kpop.accent));
    });

    testWidgets('shows date formatted as MMM dd, yyyy', (tester) async {
      await tester
          .pumpWidget(buildTestPoster(date: DateTime(2026, 3, 20)));

      expect(find.text('Mar 20, 2026'), findsOneWidget);
    });

    testWidgets('shows venue name when provided', (tester) async {
      await tester
          .pumpWidget(buildTestPoster(venueName: 'The Karaoke Lounge'));

      expect(find.text('The Karaoke Lounge'), findsOneWidget);
    });

    testWidgets('omits venue name when null', (tester) async {
      await tester.pumpWidget(buildTestPoster(venueName: null));

      // Should not find any venue-related widget
      expect(
          find.byKey(const Key('setlist-poster-venue')), findsNothing);
    });

    testWidgets('renders branding text', (tester) async {
      await tester.pumpWidget(buildTestPoster());

      expect(find.byKey(const Key('setlist-poster-branding')), findsOneWidget);
    });

    testWidgets('renders position numbers for each song', (tester) async {
      await tester.pumpWidget(buildTestPoster());

      expect(find.text('#1'), findsOneWidget);
      expect(find.text('#2'), findsOneWidget);
      expect(find.text('#3'), findsOneWidget);
    });

    testWidgets('renders with large setlist (15 songs) without overflow',
        (tester) async {
      await tester
          .pumpWidget(buildTestPoster(setlist: createTestSetlist(count: 15)));

      expect(find.byKey(const Key('setlist-poster')), findsOneWidget);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/finale_setlist_widget.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  List<SetlistEntry> createTestSetlist() {
    return [
      const SetlistEntry(
        position: 1,
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        performerName: 'Alice',
        awardTitle: 'Mic Drop Master',
      ),
      const SetlistEntry(
        position: 2,
        title: 'Dancing Queen',
        artist: 'ABBA',
        performerName: 'Bob',
      ),
    ];
  }

  Widget buildTestWidget({
    List<SetlistEntry>? setlist,
    PartyVibe vibe = PartyVibe.general,
    String? venueName,
  }) {
    return MaterialApp(
      theme: createDJTheme(vibe: vibe),
      home: Scaffold(
        body: SizedBox(
          height: 600,
          child: FinaleSetlistWidget(
            setlist: setlist ?? createTestSetlist(),
            vibe: vibe,
            venueName: venueName,
          ),
        ),
      ),
    );
  }

  group('FinaleSetlistWidget', () {
    testWidgets('renders with Key finale-setlist', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('finale-setlist')), findsOneWidget);
    });

    testWidgets('share button is visible and tappable', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      final shareBtn = find.byKey(const Key('setlist-poster-share-btn'));
      expect(shareBtn, findsOneWidget);
      expect(find.text(Copy.finaleShareButton), findsOneWidget);
    });

    testWidgets('RepaintBoundary wraps poster widget', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byType(RepaintBoundary), findsWidgets);
    });

    testWidgets('renders SetlistPosterWidget inside', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('setlist-poster')), findsOneWidget);
    });

    testWidgets('passes venueName to poster', (tester) async {
      await tester
          .pumpWidget(buildTestWidget(venueName: 'The Karaoke Lounge'));
      await tester.pumpAndSettle();

      expect(find.text('The Karaoke Lounge'), findsOneWidget);
    });

    testWidgets('long-press text share hint is visible', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text(Copy.setlistPosterHoldForTextShare), findsOneWidget);
    });
  });
}

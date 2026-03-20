import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/models/finale_award.dart';
import 'package:karamania/models/session_stats.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/finale_overlay.dart';

const testAwards = [
  FinaleAward(
    userId: 'u1',
    displayName: 'Alice',
    category: 'everyone',
    title: 'The Anchor',
    tone: 'wholesome',
    reason: 'Always there',
  ),
  FinaleAward(
    userId: 'u2',
    displayName: 'Bob',
    category: 'performer',
    title: 'Showstopper',
    tone: 'hype',
    reason: 'Incredible energy',
  ),
];

const testStats = SessionStats(
  songCount: 10,
  participantCount: 5,
  sessionDurationMs: 3600000,
  totalReactions: 100,
  totalSoundboardPlays: 20,
  totalCardsDealt: 6,
  longestStreak: 3,
);

final testSetlist = [
  const SetlistEntry(
    position: 1,
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    performerName: 'Alice',
  ),
];

Widget buildTestWidget({
  List<FinaleAward>? awards,
  SessionStats? stats,
  List<SetlistEntry>? setlist,
  ValueChanged<int>? onStepChanged,
}) {
  return MaterialApp(
    home: Scaffold(
      body: FinaleOverlay(
        vibe: PartyVibe.general,
        awards: awards,
        stats: stats,
        setlist: setlist,
        onStepChanged: onStepChanged,
      ),
    ),
  );
}

void main() {
  group('FinaleOverlay', () {
    testWidgets('renders with Key(finale-overlay)', (tester) async {
      await tester.pumpWidget(buildTestWidget(awards: testAwards));
      await tester.pump();

      expect(find.byKey(const Key('finale-overlay')), findsOneWidget);
    });

    testWidgets('renders awards parade when finaleAwards is available',
        (tester) async {
      await tester.pumpWidget(buildTestWidget(awards: testAwards));
      await tester.pump();

      // AwardsParadeWidget should be rendered when awards are provided
      // The overlay should be present and not showing a loading indicator
      expect(find.byKey(const Key('finale-overlay')), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('shows loading when awards data is null', (tester) async {
      await tester.pumpWidget(buildTestWidget(awards: null));
      await tester.pump();

      expect(find.byKey(const Key('finale-overlay')), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows loading when awards list is empty', (tester) async {
      await tester.pumpWidget(buildTestWidget(awards: const []));
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('calls onStepChanged with 0 on init', (tester) async {
      int? reportedStep;
      await tester.pumpWidget(buildTestWidget(
        awards: testAwards,
        onStepChanged: (step) => reportedStep = step,
      ));
      await tester.pump();

      expect(reportedStep, 0);
    });
  });
}

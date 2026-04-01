import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/ceremony_display.dart';
import 'package:karamania/widgets/emoji_text.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  Widget buildTestWidget({
    String? performerName,
    required int revealAt,
    PartyVibe vibe = PartyVibe.general,
    String? award,
    String? tone,
    String? songTitle,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: CeremonyDisplay(
          performerName: performerName,
          revealAt: revealAt,
          vibe: vibe,
          award: award,
          tone: tone,
          songTitle: songTitle,
        ),
      ),
    );
  }

  group('CeremonyDisplay', () {
    testWidgets('renders anticipation phase when award is null', (tester) async {
      // revealAt far in the future so it stays in anticipation
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch + 60000,
      ));

      expect(find.byKey(const Key('ceremony-display')), findsOneWidget);
      expect(find.byKey(const Key('ceremony-anticipation')), findsOneWidget);
      expect(find.text(Copy.ceremonyAnticipation), findsOneWidget);
      expect(find.byKey(const Key('ceremony-reveal')), findsNothing);
    });

    testWidgets('renders reveal phase when award is provided', (tester) async {
      // revealAt in the past triggers immediate reveal
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
        award: 'Mic Drop Master',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('ceremony-reveal')), findsOneWidget);
      expect(find.byKey(const Key('ceremony-award-title')), findsOneWidget);
      expect(find.text('Mic Drop Master'), findsOneWidget);
    });

    testWidgets('shows performer name when provided in anticipation', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        performerName: 'Alice',
        revealAt: DateTime.now().millisecondsSinceEpoch + 60000,
      ));

      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('renders without performer name when null', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        performerName: null,
        revealAt: DateTime.now().millisecondsSinceEpoch + 60000,
      ));

      expect(find.byKey(const Key('ceremony-anticipation')), findsOneWidget);
      expect(find.text(Copy.ceremonyAnticipation), findsOneWidget);
    });

    testWidgets('shows default award when award is null and revealAt passes', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
      ));
      await tester.pumpAndSettle();

      expect(find.text(Copy.defaultAward), findsOneWidget);
    });

    testWidgets('widget key is ceremony-display', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch + 60000,
      ));

      expect(find.byKey(const Key('ceremony-display')), findsOneWidget);
    });

    testWidgets('shows confetti emojis in reveal phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
        award: 'Star',
      ));
      await tester.pumpAndSettle();

      // Scattered confetti — at least 4 EmojiText widgets
      expect(find.byType(EmojiText), findsAtLeast(4));
    });

    testWidgets('triggers reveal when award changes from null to non-null via didUpdateWidget', (tester) async {
      // Start in anticipation
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch + 60000,
      ));
      expect(find.byKey(const Key('ceremony-anticipation')), findsOneWidget);

      // Update with award — should trigger reveal
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch + 60000,
        award: 'Late Award',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('ceremony-reveal')), findsOneWidget);
      expect(find.text('Late Award'), findsOneWidget);
    });

    testWidgets('renders songTitle when provided in reveal phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
        award: 'Mic Drop Master',
        songTitle: 'Bohemian Rhapsody',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('ceremony-song-title')), findsOneWidget);
      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
    });

    testWidgets('hides songTitle when null in reveal phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
        award: 'Mic Drop Master',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('ceremony-song-title')), findsNothing);
    });

    testWidgets('shows performer name in reveal phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        performerName: 'Alice',
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
        award: 'Mic Drop Master',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('ceremony-reveal')), findsOneWidget);
      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('renders confetti with short emoji list vibe (rock)', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        revealAt: DateTime.now().millisecondsSinceEpoch - 1000,
        award: 'Rock Legend',
        vibe: PartyVibe.rock,
      ));
      await tester.pumpAndSettle();

      // Rock vibe has only 2 emojis — modulo indexing must not crash
      expect(find.byType(EmojiText), findsAtLeast(4));
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/group_singalong_overlay.dart';

const testCard = InterludeGameCard(
  id: 'bohemian-rhapsody',
  title: 'Bohemian Rhapsody',
  rule: 'Is this the real life? Is this just fantasy?',
  emoji: '🎸',
);

Widget buildTestWidget({
  InterludeGameCard card = testCard,
  int gameDurationMs = 15000,
  int? timerStartedAt,
}) {
  return MaterialApp(
    home: Scaffold(
      body: GroupSingAlongOverlay(
        card: card,
        gameDurationMs: gameDurationMs,
        timerStartedAt: timerStartedAt,
      ),
    ),
  );
}

void main() {
  group('GroupSingAlongOverlay', () {
    testWidgets('renders song title and lyric text from card', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
      // Lyric is wrapped in quotation marks
      expect(find.text('"Is this the real life? Is this just fantasy?"'), findsOneWidget);
    });

    testWidgets('renders emoji from card', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('🎸'), findsOneWidget);
    });

    testWidgets('displays countdown timer', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('singalong-countdown')), findsOneWidget);
      expect(find.text('15s'), findsOneWidget);
    });

    testWidgets('uses correct widget keys', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('singalong-overlay')), findsOneWidget);
      expect(find.byKey(const Key('singalong-title')), findsOneWidget);
      expect(find.byKey(const Key('singalong-lyric')), findsOneWidget);
      expect(find.byKey(const Key('singalong-countdown')), findsOneWidget);
    });

    testWidgets('shows subtitle text', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text(Copy.singAlongSubtitle), findsOneWidget);
    });

    testWidgets('does not render any individual names or targeting UI (FR21)', (tester) async {
      // FR21: NO individual names appear on screen during group sing-along
      const cardWithTarget = InterludeGameCard(
        id: 'test',
        title: 'Test Song',
        rule: 'Test lyric',
        emoji: '🎤',
      );
      await tester.pumpWidget(buildTestWidget(card: cardWithTarget));
      await tester.pumpAndSettle();

      // Verify only expected text appears — no user names, no "you" targeting
      final allText = <String>[];
      find.byType(Text).evaluate().forEach((element) {
        final widget = element.widget as Text;
        if (widget.data != null) allText.add(widget.data!);
      });

      // Should contain only: subtitle, emoji, title, lyric (quoted), countdown
      expect(allText, contains(Copy.singAlongSubtitle));
      expect(allText, contains('🎤'));
      expect(allText, contains('Test Song'));
      expect(allText, contains('"Test lyric"'));
      // No extra text beyond the expected 5 elements
      expect(allText.length, equals(5));
    });

    testWidgets('countdown decrements each second', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('15s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('14s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('13s'), findsOneWidget);
    });
  });
}

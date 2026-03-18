import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/kings_cup_overlay.dart';

const testCard = InterludeGameCard(
  id: 'group-toast',
  title: 'Group Toast!',
  rule: 'Everyone raises their phone and cheers together!',
  emoji: '🥂',
);

Widget buildTestWidget({
  InterludeGameCard card = testCard,
  int gameDurationMs = 10000,
  int? timerStartedAt,
}) {
  return MaterialApp(
    home: Scaffold(
      body: KingsCupOverlay(
        card: card,
        gameDurationMs: gameDurationMs,
        timerStartedAt: timerStartedAt,
      ),
    ),
  );
}

void main() {
  group('KingsCupOverlay', () {
    testWidgets('renders card emoji, title, and rule', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('🥂'), findsOneWidget);
      expect(find.text('Group Toast!'), findsOneWidget);
      expect(find.text('Everyone raises their phone and cheers together!'), findsOneWidget);
    });

    testWidgets('shows subtitle text', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text(Copy.kingsCupSubtitle), findsOneWidget);
    });

    testWidgets('shows countdown timer', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('kings-cup-countdown')), findsOneWidget);
      expect(find.text('10s'), findsOneWidget);
    });

    testWidgets('uses correct widget keys', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('kings-cup-overlay')), findsOneWidget);
      expect(find.byKey(const Key('kings-cup-card')), findsOneWidget);
    });

    testWidgets('countdown decrements each second', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('10s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('9s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('8s'), findsOneWidget);
    });
  });
}

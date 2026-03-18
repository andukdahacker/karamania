import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/dare_pull_overlay.dart';
import 'package:provider/provider.dart';

const testCard = InterludeGameCard(
  id: 'air-guitar',
  title: 'Air Guitar Solo!',
  rule: 'Shred an imaginary guitar for 10 seconds',
  emoji: '🎸',
);

Widget buildTestWidget({
  InterludeGameCard card = testCard,
  int gameDurationMs = 15000,
  String targetDisplayName = 'Alice',
  int? timerStartedAt,
  List<ParticipantInfo>? participants,
}) {
  final provider = PartyProvider();
  // Sync participants if provided
  if (participants != null) {
    provider.onParticipantsSync(participants);
  }

  return ChangeNotifierProvider<PartyProvider>.value(
    value: provider,
    child: MaterialApp(
      home: Scaffold(
        body: DarePullOverlay(
          card: card,
          gameDurationMs: gameDurationMs,
          targetDisplayName: targetDisplayName,
          timerStartedAt: timerStartedAt,
        ),
      ),
    ),
  );
}

void main() {
  group('DarePullOverlay', () {
    testWidgets('renders dare emoji, title, and description after slot completes', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      // Advance past slot-machine animation (~3s to be safe)
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('🎸'), findsOneWidget);
      expect(find.text('Air Guitar Solo!'), findsOneWidget);
      expect(find.text('Shred an imaginary guitar for 10 seconds'), findsOneWidget);
    });

    testWidgets('displays target player name', (tester) async {
      await tester.pumpWidget(buildTestWidget(targetDisplayName: 'Bob'));
      // Advance past slot-machine animation
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Bob'), findsOneWidget);
    });

    testWidgets('shows countdown timer', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byKey(const Key('dare-pull-countdown')), findsOneWidget);
      expect(find.text('15s'), findsOneWidget);
    });

    testWidgets('uses correct widget keys', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byKey(const Key('dare-pull-overlay')), findsOneWidget);
      expect(find.byKey(const Key('dare-pull-target-name')), findsOneWidget);

      // Dare card appears after slot-machine
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byKey(const Key('dare-pull-dare-card')), findsOneWidget);
    });

    testWidgets('shows subtitle and target prefix text', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text(Copy.darePullSubtitle), findsOneWidget);
      expect(find.text(Copy.darePullTargetPrefix), findsOneWidget);
    });
  });
}

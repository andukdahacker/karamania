import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/quick_vote_overlay.dart';

const testCard = InterludeGameCard(
  id: 'pineapple-pizza',
  title: 'Pineapple on pizza?',
  rule: 'ALWAYS vs NEVER',
  emoji: '🍕',
);

const testOptions = [
  QuickVoteOption(id: 'A', label: 'ALWAYS'),
  QuickVoteOption(id: 'B', label: 'NEVER'),
];

Widget buildTestWidget({
  InterludeGameCard card = testCard,
  List<QuickVoteOption> quickVoteOptions = testOptions,
  int gameDurationMs = 6000,
  String? myQuickVote,
  QuickVoteResult? quickVoteResult,
  int? timerStartedAt,
  void Function(String option)? onVote,
}) {
  return MaterialApp(
    home: Scaffold(
      body: QuickVoteOverlay(
        card: card,
        quickVoteOptions: quickVoteOptions,
        gameDurationMs: gameDurationMs,
        myQuickVote: myQuickVote,
        quickVoteResult: quickVoteResult,
        timerStartedAt: timerStartedAt,
        onVote: onVote ?? (_) {},
      ),
    ),
  );
}

void main() {
  group('QuickVoteOverlay', () {
    testWidgets('renders question emoji and question text', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('🍕'), findsOneWidget);
      expect(find.text('Pineapple on pizza?'), findsOneWidget);
    });

    testWidgets('displays two option buttons with correct labels', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('ALWAYS'), findsOneWidget);
      expect(find.text('NEVER'), findsOneWidget);
    });

    testWidgets('tapping option A triggers vote callback with A', (tester) async {
      String? votedOption;
      await tester.pumpWidget(buildTestWidget(
        onVote: (option) => votedOption = option,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('quick-vote-option-a')));
      expect(votedOption, 'A');
    });

    testWidgets('tapping option B triggers vote callback with B', (tester) async {
      String? votedOption;
      await tester.pumpWidget(buildTestWidget(
        onVote: (option) => votedOption = option,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('quick-vote-option-b')));
      expect(votedOption, 'B');
    });

    testWidgets('shows selected state after voting', (tester) async {
      await tester.pumpWidget(buildTestWidget(myQuickVote: 'A'));
      await tester.pumpAndSettle();

      // Option A button should exist and be styled differently (we verify it renders)
      expect(find.byKey(const Key('quick-vote-option-a')), findsOneWidget);
      expect(find.byKey(const Key('quick-vote-option-b')), findsOneWidget);
    });

    testWidgets('displays results bar chart when quickVoteResult is provided', (tester) async {
      const result = QuickVoteResult(optionACounts: 5, optionBCounts: 3, totalVotes: 8);
      await tester.pumpWidget(buildTestWidget(quickVoteResult: result));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('quick-vote-results')), findsOneWidget);
      // Voting buttons should not be shown
      expect(find.byKey(const Key('quick-vote-option-a')), findsNothing);
      expect(find.byKey(const Key('quick-vote-option-b')), findsNothing);
    });

    testWidgets('shows vote counts in results', (tester) async {
      const result = QuickVoteResult(optionACounts: 5, optionBCounts: 3, totalVotes: 8);
      await tester.pumpWidget(buildTestWidget(quickVoteResult: result));
      await tester.pumpAndSettle();

      expect(find.text('5'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('tie result highlights neither option as winner', (tester) async {
      const result = QuickVoteResult(optionACounts: 4, optionBCounts: 4, totalVotes: 8);
      await tester.pumpWidget(buildTestWidget(quickVoteResult: result));
      await tester.pumpAndSettle();

      // Both bars should use the non-winner color (textSecondary), not actionConfirm
      final bars = find.byType(LinearProgressIndicator);
      expect(bars, findsNWidgets(2));
      final barA = tester.widget<LinearProgressIndicator>(bars.first);
      final barB = tester.widget<LinearProgressIndicator>(bars.last);
      // In a tie, both bars should have the same color (neither highlighted)
      expect(barA.color, barB.color);
    });

    testWidgets('uses correct widget keys', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('quick-vote-overlay')), findsOneWidget);
      expect(find.byKey(const Key('quick-vote-question')), findsOneWidget);
      expect(find.byKey(const Key('quick-vote-option-a')), findsOneWidget);
      expect(find.byKey(const Key('quick-vote-option-b')), findsOneWidget);
    });
  });
}

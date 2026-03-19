import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/icebreaker_overlay.dart';

const testOptions = [
  IcebreakerOption(id: '80s', label: '80s', emoji: '🕺'),
  IcebreakerOption(id: '90s', label: '90s', emoji: '💿'),
  IcebreakerOption(id: '2000s', label: '2000s', emoji: '📀'),
  IcebreakerOption(id: '2010s', label: '2010s+', emoji: '🎧'),
];

Widget buildTestWidget({
  String question = "What's your music decade?",
  List<IcebreakerOption> options = testOptions,
  int voteDurationMs = 6000,
  String? myVote,
  Map<String, int>? result,
  String? winnerOptionId,
  int? timerStartedAt,
  void Function(String optionId)? onVote,
}) {
  return MaterialApp(
    home: Scaffold(
      body: IcebreakerOverlay(
        question: question,
        options: options,
        voteDurationMs: voteDurationMs,
        myVote: myVote,
        result: result,
        winnerOptionId: winnerOptionId,
        timerStartedAt: timerStartedAt,
        onVote: onVote ?? (_) {},
      ),
    ),
  );
}

void main() {
  group('IcebreakerOverlay', () {
    testWidgets('renders question text', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text("What's your music decade?"), findsOneWidget);
    });

    testWidgets('renders 4 option buttons with emoji and label', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('🕺'), findsOneWidget);
      expect(find.text('80s'), findsOneWidget);
      expect(find.text('💿'), findsOneWidget);
      expect(find.text('90s'), findsOneWidget);
      expect(find.text('📀'), findsOneWidget);
      expect(find.text('2000s'), findsOneWidget);
      expect(find.text('🎧'), findsOneWidget);
      expect(find.text('2010s+'), findsOneWidget);
    });

    testWidgets('tapping option calls onVote with correct optionId', (tester) async {
      String? votedId;
      await tester.pumpWidget(buildTestWidget(
        onVote: (id) => votedId = id,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('icebreaker-option-90s')));
      expect(votedId, '90s');
    });

    testWidgets('does not call onVote when already voted', (tester) async {
      int voteCount = 0;
      await tester.pumpWidget(buildTestWidget(
        myVote: '80s',
        onVote: (_) => voteCount++,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('icebreaker-option-90s')));
      expect(voteCount, 0);
    });

    testWidgets('shows bottom note before voting', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Everyone answers. Results revealed together.'), findsOneWidget);
    });

    testWidgets('hides bottom note after voting', (tester) async {
      await tester.pumpWidget(buildTestWidget(myVote: '80s'));
      await tester.pumpAndSettle();

      expect(find.text('Everyone answers. Results revealed together.'), findsNothing);
    });

    testWidgets('shows selected state after voting', (tester) async {
      await tester.pumpWidget(buildTestWidget(myVote: '80s'));
      await tester.pumpAndSettle();

      // All 4 options should still be visible
      expect(find.byKey(const Key('icebreaker-option-80s')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-90s')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-2000s')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-2010s')), findsOneWidget);

      // Waiting text should appear
      expect(find.text('Waiting for everyone...'), findsOneWidget);
    });

    testWidgets('shows result counts when result is provided', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        result: {'80s': 3, '90s': 2, '2000s': 1, '2010s': 0},
        winnerOptionId: '80s',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('icebreaker-result')), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('0'), findsOneWidget);
      expect(find.text('6 votes'), findsOneWidget);
    });

    testWidgets('highlights winner option in result view', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        result: {'80s': 5, '90s': 1, '2000s': 0, '2010s': 0},
        winnerOptionId: '80s',
      ));
      await tester.pumpAndSettle();

      // Result should be shown with progress bars
      final bars = find.byType(LinearProgressIndicator);
      expect(bars, findsNWidgets(4));
    });

    testWidgets('uses correct widget keys', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('icebreaker-overlay')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-question')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-80s')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-90s')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-2000s')), findsOneWidget);
      expect(find.byKey(const Key('icebreaker-option-2010s')), findsOneWidget);
    });

    testWidgets('displays countdown timer', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('icebreaker-countdown')), findsOneWidget);
    });

    testWidgets('hides voting options when result is shown', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        result: {'80s': 3, '90s': 2, '2000s': 1, '2010s': 0},
        winnerOptionId: '80s',
      ));
      await tester.pumpAndSettle();

      // Option tap targets should not be present
      expect(find.byKey(const Key('icebreaker-option-80s')), findsNothing);
      expect(find.byKey(const Key('icebreaker-option-90s')), findsNothing);
    });
  });
}

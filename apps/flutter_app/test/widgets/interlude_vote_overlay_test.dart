import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/interlude_vote_overlay.dart';

List<InterludeOption> createTestOptions() {
  return const [
    InterludeOption(
      id: 'kings_cup',
      name: 'Kings Cup',
      description: 'Draw cards, follow the rules!',
      icon: '👑',
    ),
    InterludeOption(
      id: 'quick_vote',
      name: 'Quick Vote',
      description: 'Fast group polls and hot takes!',
      icon: '⚡',
    ),
    InterludeOption(
      id: 'group_singalong',
      name: 'Group Sing-Along',
      description: 'Everyone sings together!',
      icon: '🎤',
    ),
  ];
}

Widget buildTestWidget({
  List<InterludeOption>? options,
  Map<String, int>? voteCounts,
  String? myVote,
  String? winnerOptionId,
  int timerDurationMs = 15000,
  void Function(String)? onVote,
}) {
  return MaterialApp(
    home: Scaffold(
      body: InterludeVoteOverlay(
        options: options ?? createTestOptions(),
        voteCounts: voteCounts ?? {},
        myVote: myVote,
        winnerOptionId: winnerOptionId,
        timerDurationMs: timerDurationMs,
        onVote: onVote ?? (_) {},
      ),
    ),
  );
}

void main() {
  group('InterludeVoteOverlay', () {
    testWidgets('renders all activity options', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('interlude-vote-option-kings_cup')), findsOneWidget);
      expect(find.byKey(const Key('interlude-vote-option-quick_vote')), findsOneWidget);
      expect(find.byKey(const Key('interlude-vote-option-group_singalong')), findsOneWidget);
    });

    testWidgets('displays option names and descriptions', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('Kings Cup'), findsOneWidget);
      expect(find.text('Draw cards, follow the rules!'), findsOneWidget);
      expect(find.text('Quick Vote'), findsOneWidget);
      expect(find.text('Group Sing-Along'), findsOneWidget);
    });

    testWidgets('displays title', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text(Copy.interludeVotingTitle), findsOneWidget);
    });

    testWidgets('displays countdown timer', (tester) async {
      await tester.pumpWidget(buildTestWidget(timerDurationMs: 15000));
      await tester.pump();

      expect(find.byKey(const Key('interlude-vote-countdown')), findsOneWidget);
    });

    testWidgets('tapping option triggers onVote callback', (tester) async {
      String? votedOptionId;

      await tester.pumpWidget(buildTestWidget(
        onVote: (optionId) => votedOptionId = optionId,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('interlude-vote-option-kings_cup')));
      await tester.pump();

      expect(votedOptionId, 'kings_cup');
    });

    testWidgets('shows vote counts when present', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        voteCounts: {'kings_cup': 3, 'quick_vote': 1},
      ));
      await tester.pumpAndSettle();

      expect(find.text('3 ${Copy.interludeVotesLabel}'), findsOneWidget);
      expect(find.text('1 ${Copy.interludeVotesLabel}'), findsOneWidget);
    });

    testWidgets('displays Selected text when winner is set', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        winnerOptionId: 'kings_cup',
        voteCounts: {'kings_cup': 3, 'quick_vote': 1},
      ));
      await tester.pumpAndSettle();

      // Title status shows selected, and winner card shows selected
      expect(find.text(Copy.interludeVoteSelected), findsWidgets);
    });

    testWidgets('shows check icon for my vote', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        myVote: 'kings_cup',
      ));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.check_circle), findsOneWidget);
    });
  });
}

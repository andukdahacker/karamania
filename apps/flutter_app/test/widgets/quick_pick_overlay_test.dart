import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/quick_pick_overlay.dart';

List<QuickPickSong> createTestSongs(int count) {
  return List.generate(
    count,
    (i) => QuickPickSong(
      catalogTrackId: 'song-${i + 1}',
      songTitle: 'Song ${i + 1}',
      artist: 'Artist ${i + 1}',
      youtubeVideoId: 'yt_${i + 1}',
      overlapCount: count - i,
    ),
  );
}

Widget buildTestWidget({
  List<QuickPickSong>? songs,
  Map<String, VoteTally>? votes,
  Map<String, String>? myVotes,
  String? winnerId,
  int participantCount = 5,
  int timerDurationMs = 15000,
  void Function(String, String)? onVote,
}) {
  return MaterialApp(
    home: Scaffold(
      body: QuickPickOverlay(
        songs: songs ?? createTestSongs(5),
        votes: votes ?? {},
        myVotes: myVotes ?? {},
        winnerId: winnerId,
        participantCount: participantCount,
        timerDurationMs: timerDurationMs,
        onVote: onVote ?? (_, __) {},
      ),
    ),
  );
}

void main() {
  group('QuickPickOverlay', () {
    testWidgets('renders 5 song cards', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      for (int i = 1; i <= 5; i++) {
        expect(find.byKey(Key('quick-pick-song-song-$i')), findsOneWidget);
      }
    });

    testWidgets('displays song title and artist', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        songs: [
          const QuickPickSong(
            catalogTrackId: 'test-1',
            songTitle: 'Bohemian Rhapsody',
            artist: 'Queen',
            youtubeVideoId: 'yt_1',
            overlapCount: 3,
          ),
        ],
      ));
      await tester.pumpAndSettle();

      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
      expect(find.text('Queen'), findsOneWidget);
    });

    testWidgets('shows overlap badge with correct count', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        songs: [
          const QuickPickSong(
            catalogTrackId: 'test-1',
            songTitle: 'Song 1',
            artist: 'Artist 1',
            youtubeVideoId: 'yt_1',
            overlapCount: 4,
          ),
        ],
        participantCount: 5,
      ));
      await tester.pumpAndSettle();

      expect(find.text('4/5 ${Copy.quickPickOverlapBadge}'), findsOneWidget);
    });

    testWidgets('tapping thumbs up triggers onVote callback', (tester) async {
      String? votedId;
      String? votedType;

      await tester.pumpWidget(buildTestWidget(
        songs: [
          const QuickPickSong(
            catalogTrackId: 'test-song',
            songTitle: 'Song',
            artist: 'Artist',
            youtubeVideoId: 'yt',
            overlapCount: 1,
          ),
        ],
        onVote: (id, vote) {
          votedId = id;
          votedType = vote;
        },
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('vote-up-test-song')));
      await tester.pump();

      expect(votedId, 'test-song');
      expect(votedType, 'up');
    });

    testWidgets('tapping skip triggers onVote callback', (tester) async {
      String? votedType;

      await tester.pumpWidget(buildTestWidget(
        songs: [
          const QuickPickSong(
            catalogTrackId: 'test-song',
            songTitle: 'Song',
            artist: 'Artist',
            youtubeVideoId: 'yt',
            overlapCount: 1,
          ),
        ],
        onVote: (_, vote) => votedType = vote,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('vote-skip-test-song')));
      await tester.pump();

      expect(votedType, 'skip');
    });

    testWidgets('winner card shows Selected text', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        songs: [
          const QuickPickSong(
            catalogTrackId: 'winner-song',
            songTitle: 'Winner Song',
            artist: 'Winner Artist',
            youtubeVideoId: 'yt',
            overlapCount: 1,
          ),
        ],
        winnerId: 'winner-song',
      ));
      await tester.pumpAndSettle();

      expect(find.text(Copy.quickPickSelected), findsWidgets);
    });

    testWidgets('countdown timer is displayed', (tester) async {
      await tester.pumpWidget(buildTestWidget(timerDurationMs: 15000));
      await tester.pump();

      expect(find.byKey(const Key('quick-pick-countdown')), findsOneWidget);
    });

    testWidgets('title is displayed', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text(Copy.quickPickTitle), findsOneWidget);
    });
  });
}

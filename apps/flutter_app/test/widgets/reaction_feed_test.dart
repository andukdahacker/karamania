import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/widgets/reaction_feed.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('ReactionFeed', () {
    testWidgets('renders emoji text for each reaction', (tester) async {
      final reactions = [
        const ReactionFeedItem(id: 0, emoji: '🔥', startX: 0.3, opacity: 1.0),
        const ReactionFeedItem(id: 1, emoji: '👏', startX: 0.6, opacity: 0.5),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReactionFeed(reactions: reactions),
          ),
        ),
      );

      expect(find.text('🔥'), findsOneWidget);
      expect(find.text('👏'), findsOneWidget);
    });

    testWidgets('uses IgnorePointer wrapper with reaction-feed key', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReactionFeed(reactions: const []),
          ),
        ),
      );

      // The reaction-feed key is placed on the IgnorePointer widget
      final widget = tester.widget(find.byKey(const Key('reaction-feed')));
      expect(widget, isA<IgnorePointer>());
    });

    testWidgets('has Key reaction-feed', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReactionFeed(reactions: const []),
          ),
        ),
      );

      expect(find.byKey(const Key('reaction-feed')), findsOneWidget);
    });

    testWidgets('empty reaction list renders no particles', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReactionFeed(reactions: const []),
          ),
        ),
      );

      // No emoji text should be rendered
      expect(find.textContaining(RegExp(r'.')), findsNothing);
    });

    testWidgets('onParticleComplete callback is invoked when animation completes', (tester) async {
      final completedIds = <int>[];
      final reactions = [
        const ReactionFeedItem(id: 42, emoji: '🔥', startX: 0.5, opacity: 1.0),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReactionFeed(
              reactions: reactions,
              onParticleComplete: (id) => completedIds.add(id),
            ),
          ),
        ),
      );

      // Advance past the 1500ms animation duration
      await tester.pumpAndSettle(const Duration(milliseconds: 1600));

      expect(completedIds, contains(42));
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/streak_milestone_overlay.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  Widget buildOverlay({
    int streakCount = 10,
    String emoji = '🔥',
    String displayName = 'TestUser',
    VoidCallback? onDismiss,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: StreakMilestoneOverlay(
          streakCount: streakCount,
          emoji: emoji,
          displayName: displayName,
          onDismiss: onDismiss ?? () {},
        ),
      ),
    );
  }

  testWidgets('renders personalized milestone text', (tester) async {
    await tester.pumpWidget(buildOverlay(
      streakCount: 10,
      displayName: 'TestUser',
    ));
    await tester.pump();

    expect(find.text(Copy.streakMilestone('TestUser', 10)), findsOneWidget);
    expect(find.text('TestUser IS ON FIRE!'), findsOneWidget);
  });

  testWidgets('renders emoji text', (tester) async {
    await tester.pumpWidget(buildOverlay(emoji: '🎤'));
    await tester.pump();

    expect(find.text('🎤'), findsOneWidget);
  });

  testWidgets('has streak-milestone-overlay key', (tester) async {
    await tester.pumpWidget(buildOverlay());
    await tester.pump();

    expect(find.byKey(const Key('streak-milestone-overlay')), findsOneWidget);
  });

  testWidgets('has streak-milestone-text key', (tester) async {
    await tester.pumpWidget(buildOverlay());
    await tester.pump();

    expect(find.byKey(const Key('streak-milestone-text')), findsOneWidget);
  });

  testWidgets('IgnorePointer wrapper is present', (tester) async {
    await tester.pumpWidget(buildOverlay());
    await tester.pump();

    // The IgnorePointer has the streak-milestone-overlay key
    final overlayFinder = find.byKey(const Key('streak-milestone-overlay'));
    expect(overlayFinder, findsOneWidget);
    final widget = tester.widget(overlayFinder);
    expect(widget, isA<IgnorePointer>());
  });

  testWidgets('onDismiss callback fires after auto-dismiss timer', (tester) async {
    bool dismissed = false;
    await tester.pumpWidget(buildOverlay(
      onDismiss: () => dismissed = true,
    ));
    await tester.pump();

    // Wait for 2s auto-dismiss timer
    await tester.pump(const Duration(seconds: 2));
    // Wait for reverse animation (400ms)
    await tester.pumpAndSettle();

    expect(dismissed, isTrue);
  });

  testWidgets('renders fallback text for non-standard milestone count', (tester) async {
    await tester.pumpWidget(buildOverlay(
      streakCount: 99,
      displayName: 'TestUser',
    ));
    await tester.pump();

    expect(find.text('99 Streak!'), findsOneWidget);
  });
}

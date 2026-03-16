import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/spin_the_wheel_overlay.dart';

List<SpinWheelSegment> createTestSegments(int count) {
  return List.generate(
    count,
    (i) => SpinWheelSegment(
      catalogTrackId: 'song-$i',
      songTitle: 'Song $i',
      artist: 'Artist $i',
      youtubeVideoId: 'yt_$i',
      overlapCount: count - i,
      segmentIndex: i,
    ),
  );
}

Widget buildTestWidget({
  List<SpinWheelSegment>? segments,
  String? phase,
  int? targetIndex,
  double? totalRotation,
  int spinDurationMs = 4000,
  String? spinnerName,
  bool vetoUsed = false,
  int timerDurationMs = 15000,
  VoidCallback? onSpin,
  VoidCallback? onVeto,
}) {
  return MaterialApp(
    home: Scaffold(
      body: SpinTheWheelOverlay(
        segments: segments ?? createTestSegments(8),
        phase: phase ?? 'waiting',
        targetIndex: targetIndex,
        totalRotation: totalRotation,
        spinDurationMs: spinDurationMs,
        spinnerName: spinnerName,
        vetoUsed: vetoUsed,
        timerDurationMs: timerDurationMs,
        onSpin: onSpin ?? () {},
        onVeto: onVeto ?? () {},
      ),
    ),
  );
}

void main() {
  group('SpinTheWheelOverlay', () {
    testWidgets('renders title', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pump();

      expect(find.text(Copy.spinTheWheelTitle), findsOneWidget);
    });

    testWidgets('SPIN button displayed in waiting phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(phase: 'waiting'));
      await tester.pump();

      expect(find.byKey(const Key('spin-wheel-spin-button')), findsOneWidget);
      expect(find.text(Copy.spinButtonLabel), findsOneWidget);
    });

    testWidgets('tapping SPIN calls onSpin callback', (tester) async {
      bool spinCalled = false;

      await tester.pumpWidget(buildTestWidget(
        phase: 'waiting',
        onSpin: () => spinCalled = true,
      ));
      await tester.pump();

      await tester.tap(find.byKey(const Key('spin-wheel-spin-button')));
      await tester.pump();

      expect(spinCalled, isTrue);
    });

    testWidgets('SPIN button disabled during spinning phase', (tester) async {
      bool spinCalled = false;

      await tester.pumpWidget(buildTestWidget(
        phase: 'spinning',
        targetIndex: 3,
        totalRotation: 40.0,
        onSpin: () => spinCalled = true,
      ));
      await tester.pump();

      // Button should exist but be disabled (tap should not trigger callback)
      final spinButton = find.byKey(const Key('spin-wheel-spin-button'));
      if (spinButton.evaluate().isNotEmpty) {
        await tester.tap(spinButton);
        await tester.pump();
        expect(spinCalled, isFalse);
      }
    });

    testWidgets('veto button appears when landed and veto not used', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        phase: 'landed',
        targetIndex: 3,
        totalRotation: 40.0,
        vetoUsed: false,
      ));
      await tester.pump();

      expect(find.byKey(const Key('spin-wheel-veto-button')), findsOneWidget);
    });

    testWidgets('veto button hidden when veto used', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        phase: 'landed',
        targetIndex: 3,
        totalRotation: 40.0,
        vetoUsed: true,
      ));
      await tester.pump();

      expect(find.byKey(const Key('spin-wheel-veto-button')), findsNothing);
    });

    testWidgets('tapping VETO calls onVeto callback', (tester) async {
      bool vetoCalled = false;

      await tester.pumpWidget(buildTestWidget(
        phase: 'landed',
        targetIndex: 3,
        totalRotation: 40.0,
        vetoUsed: false,
        onVeto: () => vetoCalled = true,
      ));
      await tester.pump();

      await tester.tap(find.byKey(const Key('spin-wheel-veto-button')));
      await tester.pump();

      expect(vetoCalled, isTrue);
    });

    testWidgets('winner display on selected phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        phase: 'selected',
        targetIndex: 3,
        totalRotation: 40.0,
        segments: createTestSegments(8),
      ));
      await tester.pump();

      expect(find.byKey(const Key('spin-wheel-selected-label')), findsOneWidget);
    });

    testWidgets('countdown timer displayed in waiting phase', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        phase: 'waiting',
        timerDurationMs: 15000,
      ));
      await tester.pump();

      // Should show countdown text
      expect(find.byKey(const Key('spin-wheel-status')), findsOneWidget);
    });
  });
}

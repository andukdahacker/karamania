import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/widgets/capture_overlay.dart';

Widget _wrapWithProvider(Widget child, {required CaptureProvider provider}) {
  return ChangeNotifierProvider<CaptureProvider>.value(
    value: provider,
    child: MaterialApp(
      home: Scaffold(body: Stack(children: [child])),
    ),
  );
}

void main() {
  group('CaptureOverlay', () {
    testWidgets('shows nothing when not selecting and not capturing', (tester) async {
      final provider = CaptureProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));

      expect(find.byType(SizedBox), findsOneWidget);
      expect(find.byKey(const Key('capture-selector-backdrop')), findsNothing);

      provider.dispose();
    });

    testWidgets('shows mode selector with 3 buttons when isSelectorVisible', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('capture-photo')), findsOneWidget);
      expect(find.byKey(const Key('capture-video')), findsOneWidget);
      expect(find.byKey(const Key('capture-audio')), findsOneWidget);

      provider.dispose();
    });

    testWidgets('tap on photo button calls onCaptureTypeSelected(photo)', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('capture-photo')));
      await tester.pump();

      expect(provider.activeCaptureType, CaptureType.photo);
      expect(provider.isCapturing, isTrue);

      provider.dispose();
    });

    testWidgets('tap on video button calls onCaptureTypeSelected(video)', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('capture-video')));
      await tester.pump();

      expect(provider.activeCaptureType, CaptureType.video);
      expect(provider.isCapturing, isTrue);

      provider.dispose();
    });

    testWidgets('tap on audio button calls onCaptureTypeSelected(audio)', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('capture-audio')));
      await tester.pump();

      expect(provider.activeCaptureType, CaptureType.audio);
      expect(provider.isCapturing, isTrue);

      provider.dispose();
    });

    testWidgets('tap outside selector calls onCaptureCancelled', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));
      await tester.pumpAndSettle();

      // Tap on the backdrop (top-right area away from buttons)
      await tester.tapAt(const Offset(500, 100));
      await tester.pump();

      expect(provider.isSelectorVisible, isFalse);
      expect(provider.isCapturing, isFalse);

      provider.dispose();
    });

    testWidgets('selector backdrop has correct key', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('capture-selector-backdrop')), findsOneWidget);

      provider.dispose();
    });

    testWidgets('shows audio indicator when capturing audio', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureTypeSelected(CaptureType.audio);

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));

      expect(find.byKey(const Key('capture-audio-indicator')), findsOneWidget);

      provider.dispose();
    });

    testWidgets('audio indicator shows countdown text with remaining seconds', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureTypeSelected(CaptureType.audio);

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureOverlay(),
        provider: provider,
      ));

      // Initial countdown should show 10s
      expect(find.textContaining('10s'), findsOneWidget);
      expect(find.textContaining('Recording...'), findsOneWidget);
      expect(find.textContaining('Tap to stop'), findsOneWidget);

      provider.dispose();
    });
  });
}

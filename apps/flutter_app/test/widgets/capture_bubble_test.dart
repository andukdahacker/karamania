import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/widgets/capture_bubble.dart';

Widget _wrapWithProvider(Widget child, {required CaptureProvider provider}) {
  return ChangeNotifierProvider<CaptureProvider>.value(
    value: provider,
    child: MaterialApp(
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  group('CaptureBubble', () {
    testWidgets('renders camera icon when isBubbleVisible is true', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureBubble(),
        provider: provider,
      ));

      expect(find.byIcon(Icons.camera_alt_rounded), findsOneWidget);

      provider.dispose();
    });

    testWidgets('renders SizedBox.shrink when isBubbleVisible is false', (tester) async {
      final provider = CaptureProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureBubble(),
        provider: provider,
      ));

      expect(find.byIcon(Icons.camera_alt_rounded), findsNothing);
      expect(find.byType(SizedBox), findsOneWidget);

      provider.dispose();
    });

    testWidgets('tap calls onBubbleTapped on CaptureProvider', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureBubble(),
        provider: provider,
      ));

      await tester.tap(find.byKey(const Key('capture-bubble')));
      await tester.pump();

      expect(provider.isBubbleVisible, isFalse);

      provider.dispose();
    });

    testWidgets('has correct widget key capture-bubble', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureBubble(),
        provider: provider,
      ));

      expect(find.byKey(const Key('capture-bubble')), findsOneWidget);

      provider.dispose();
    });

    testWidgets('uses 48x48 sizing', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureBubbleTriggered(triggerType: 'session_start');

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureBubble(),
        provider: provider,
      ));

      final container = tester.widget<Container>(find.byType(Container).last);
      expect(container.constraints?.maxWidth, 48.0);
      expect(container.constraints?.maxHeight, 48.0);

      provider.dispose();
    });
  });
}

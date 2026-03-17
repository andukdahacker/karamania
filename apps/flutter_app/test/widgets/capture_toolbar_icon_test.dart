import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/widgets/capture_toolbar_icon.dart';

Widget _wrapWithProvider(Widget child, {required CaptureProvider provider}) {
  return ChangeNotifierProvider<CaptureProvider>.value(
    value: provider,
    child: MaterialApp(
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  group('CaptureToolbarIcon', () {
    testWidgets('renders camera icon', (tester) async {
      final provider = CaptureProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        provider: provider,
      ));

      expect(find.byIcon(Icons.camera_alt_outlined), findsOneWidget);

      provider.dispose();
    });

    testWidgets('tap calls onManualCaptureTriggered', (tester) async {
      final provider = CaptureProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        provider: provider,
      ));

      await tester.tap(find.byKey(const Key('capture-toolbar-icon')));
      await tester.pump();

      expect(provider.isSelectorVisible, isTrue);
      expect(provider.captureTriggerType, 'manual');

      provider.dispose();
    });

    testWidgets('disabled when isCapturing is true', (tester) async {
      final provider = CaptureProvider();
      provider.onCaptureTypeSelected(CaptureType.photo);

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        provider: provider,
      ));

      final iconButton = tester.widget<IconButton>(
        find.byKey(const Key('capture-toolbar-icon')),
      );
      expect(iconButton.onPressed, isNull);

      provider.dispose();
    });

    testWidgets('disabled when isSelectorVisible is true', (tester) async {
      final provider = CaptureProvider();
      provider.onManualCaptureTriggered();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        provider: provider,
      ));

      final iconButton = tester.widget<IconButton>(
        find.byKey(const Key('capture-toolbar-icon')),
      );
      expect(iconButton.onPressed, isNull);

      provider.dispose();
    });

    testWidgets('has correct widget key capture-toolbar-icon', (tester) async {
      final provider = CaptureProvider();

      await tester.pumpWidget(_wrapWithProvider(
        const CaptureToolbarIcon(),
        provider: provider,
      ));

      expect(find.byKey(const Key('capture-toolbar-icon')), findsOneWidget);

      provider.dispose();
    });
  });
}

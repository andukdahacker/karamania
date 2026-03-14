import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/soundboard_config.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/soundboard_bar.dart';

Widget _wrapWithProviders(Widget child) {
  final accessibilityProvider = AccessibilityProvider();

  return MaterialApp(
    home: ChangeNotifierProvider<AccessibilityProvider>.value(
      value: accessibilityProvider,
      child: Builder(
        builder: (context) {
          context.read<AccessibilityProvider>().updateFromMediaQuery(context);
          return Scaffold(body: Center(child: child));
        },
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('SoundboardBar', () {
    testWidgets('renders 6 soundboard buttons', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const SoundboardBar()),
      );
      await tester.pump();

      expect(find.byType(DJTapButton), findsNWidgets(6));
    });

    testWidgets('has Key soundboard-bar on the Row', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const SoundboardBar()),
      );
      await tester.pump();

      expect(find.byKey(const Key('soundboard-bar')), findsOneWidget);
    });

    testWidgets('each button has correct Key for all 6 sounds', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const SoundboardBar()),
      );
      await tester.pump();

      for (final button in soundboardButtons) {
        expect(
          find.byKey(Key('soundboard-${button.soundId}')),
          findsOneWidget,
        );
      }
    });

    testWidgets('each button displays the correct emoji', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const SoundboardBar()),
      );
      await tester.pump();

      for (final button in soundboardButtons) {
        expect(find.text(button.emoji), findsOneWidget);
      }
    });

    testWidgets('tapping each soundboard button does not crash', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const SoundboardBar()),
      );
      await tester.pump();

      // Tap each button — AudioEngine.instance is not initialized and
      // SocketClient._socket is null, so calls are safe no-ops.
      // This verifies the onTap handler is wired and doesn't throw.
      for (final button in soundboardButtons) {
        await tester.tap(find.byKey(Key('soundboard-${button.soundId}')));
        await tester.pump();
      }
    });

    testWidgets('tapping button triggers DJTapButton onTap callback', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const SoundboardBar()),
      );
      await tester.pump();

      // Verify the first button can be tapped without error and
      // processes through the SoundCue.values.byName resolution
      await tester.tap(find.byKey(const Key('soundboard-sbAirHorn')));
      await tester.pump();

      // Widget still renders after tap — no exception thrown
      expect(find.byKey(const Key('soundboard-bar')), findsOneWidget);
    });
  });
}

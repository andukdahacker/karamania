import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/widgets/dj_tap_button.dart';

Widget _wrapWithProviders(Widget child, {bool reducedMotion = false}) {
  final accessibilityProvider = AccessibilityProvider();

  return MediaQuery(
    data: MediaQueryData(disableAnimations: reducedMotion),
    child: MaterialApp(
      home: ChangeNotifierProvider<AccessibilityProvider>.value(
        value: accessibilityProvider,
        child: Builder(
          builder: (context) {
            // Update accessibility provider from MediaQuery
            context.read<AccessibilityProvider>().updateFromMediaQuery(context);
            return Scaffold(body: Center(child: child));
          },
        ),
      ),
    ),
  );
}

void main() {
  // Track haptic feedback calls
  final List<String> hapticCalls = [];

  setUp(() {
    hapticCalls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall methodCall) async {
        if (methodCall.method == 'HapticFeedback.vibrate') {
          hapticCalls.add(methodCall.arguments as String);
        }
        return null;
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  group('DJTapButton - Consequential tier', () {
    test('requires Key parameter', () {
      // This test verifies at the API level that Key is required.
      // The constructor signature enforces `required Key key`.
      final button = DJTapButton(
        key: const Key('test-consequential'),
        tier: TapTier.consequential,
        onTap: () {},
        child: const Text('Action'),
      );
      expect(button.key, const Key('test-consequential'));
    });

    testWidgets('does NOT fire on immediate tap (early release)',
        (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-consequential'),
            tier: TapTier.consequential,
            onTap: () => tapCount++,
            child: const Text('Action'),
          ),
        ),
      );

      // Quick tap (not holding 500ms)
      await tester.tap(find.byKey(const Key('test-consequential')));
      await tester.pump();

      expect(tapCount, 0, reason: 'Consequential should not fire on quick tap');
    });

    testWidgets('fires after 500ms hold', (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-consequential-hold'),
            tier: TapTier.consequential,
            onTap: () => tapCount++,
            child: const Text('Action'),
          ),
        ),
      );

      // Long press for 500ms
      final gesture = await tester.startGesture(
        tester.getCenter(find.byKey(const Key('test-consequential-hold'))),
      );
      await tester.pump(const Duration(milliseconds: 500));
      await gesture.up();
      await tester.pump();

      expect(tapCount, 1, reason: 'Consequential should fire after 500ms hold');
    });

    testWidgets('fires heavyImpact haptic on confirm (not touch-down)',
        (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-haptic'),
            tier: TapTier.consequential,
            onTap: () {},
            child: const Text('Action'),
          ),
        ),
      );

      hapticCalls.clear();

      // Touch down — should NOT trigger haptic
      final gesture = await tester.startGesture(
        tester.getCenter(find.byKey(const Key('test-haptic'))),
      );
      await tester.pump();
      expect(hapticCalls, isEmpty,
          reason: 'No haptic on touch-down for consequential');

      // Wait for hold to complete
      await tester.pump(const Duration(milliseconds: 500));

      // Haptic should fire on confirm
      expect(hapticCalls, contains('HapticFeedbackType.heavyImpact'));

      await gesture.up();
      await tester.pump();
    });

    testWidgets('early release cancels action', (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-cancel'),
            tier: TapTier.consequential,
            onTap: () => tapCount++,
            child: const Text('Action'),
          ),
        ),
      );

      // Start press, release at 200ms (before 500ms threshold)
      final gesture = await tester.startGesture(
        tester.getCenter(find.byKey(const Key('test-cancel'))),
      );
      await tester.pump(const Duration(milliseconds: 200));
      await gesture.up();
      await tester.pump();

      // Wait past the 500ms to ensure timer was cancelled
      await tester.pump(const Duration(milliseconds: 400));

      expect(tapCount, 0, reason: 'Early release should cancel action');
    });

    testWidgets('has minimum 64x64 hit area', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-size'),
            tier: TapTier.consequential,
            onTap: () {},
            child: const SizedBox(width: 20, height: 20),
          ),
        ),
      );

      final constrainedBoxes = tester.widgetList<ConstrainedBox>(
        find.descendant(
          of: find.byKey(const Key('test-size')),
          matching: find.byType(ConstrainedBox),
        ),
      );
      final hasCorrectConstraints = constrainedBoxes.any(
        (cb) =>
            cb.constraints.minWidth == 64.0 &&
            cb.constraints.minHeight == 64.0,
      );
      expect(hasCorrectConstraints, isTrue);
    });
  });

  group('DJTapButton - Social tier', () {
    testWidgets('fires immediately on touch-down', (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-social'),
            tier: TapTier.social,
            onTap: () => tapCount++,
            child: const Text('React'),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('test-social')));
      await tester.pump();

      expect(tapCount, 1, reason: 'Social should fire immediately');
    });

    testWidgets('fires lightImpact haptic on touch-down', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-social-haptic'),
            tier: TapTier.social,
            onTap: () {},
            child: const Text('React'),
          ),
        ),
      );

      hapticCalls.clear();
      await tester.tap(find.byKey(const Key('test-social-haptic')));
      await tester.pump();

      expect(hapticCalls, contains('HapticFeedbackType.lightImpact'));
    });

    testWidgets('debounces within 200ms', (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-debounce'),
            tier: TapTier.social,
            onTap: () => tapCount++,
            child: const Text('React'),
          ),
        ),
      );

      // Rapid taps within 200ms
      await tester.tap(find.byKey(const Key('test-debounce')));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byKey(const Key('test-debounce')));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byKey(const Key('test-debounce')));
      await tester.pump();

      expect(tapCount, 1, reason: 'Should debounce within 200ms');
    });

    testWidgets('has minimum 56x56 hit area', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-social-size'),
            tier: TapTier.social,
            onTap: () {},
            child: const SizedBox(width: 20, height: 20),
          ),
        ),
      );

      final constrainedBoxes = tester.widgetList<ConstrainedBox>(
        find.descendant(
          of: find.byKey(const Key('test-social-size')),
          matching: find.byType(ConstrainedBox),
        ),
      );
      final hasCorrectConstraints = constrainedBoxes.any(
        (cb) =>
            cb.constraints.minWidth == 56.0 &&
            cb.constraints.minHeight == 56.0,
      );
      expect(hasCorrectConstraints, isTrue);
    });
  });

  group('DJTapButton - Private tier', () {
    testWidgets('fires immediately on touch-down', (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-private'),
            tier: TapTier.private,
            onTap: () => tapCount++,
            child: const Text('Dismiss'),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('test-private')));
      await tester.pump();

      expect(tapCount, 1, reason: 'Private should fire immediately');
    });

    testWidgets('does NOT fire haptic', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-private-haptic'),
            tier: TapTier.private,
            onTap: () {},
            child: const Text('Dismiss'),
          ),
        ),
      );

      hapticCalls.clear();
      await tester.tap(find.byKey(const Key('test-private-haptic')));
      await tester.pump();

      expect(hapticCalls, isEmpty, reason: 'Private should have no haptic');
    });

    testWidgets('debounces within 200ms', (tester) async {
      var tapCount = 0;
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-private-debounce'),
            tier: TapTier.private,
            onTap: () => tapCount++,
            child: const Text('Dismiss'),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('test-private-debounce')));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byKey(const Key('test-private-debounce')));
      await tester.pump();

      expect(tapCount, 1, reason: 'Should debounce within 200ms');
    });

    testWidgets('has minimum 48x48 hit area', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          DJTapButton(
            key: const Key('test-private-size'),
            tier: TapTier.private,
            onTap: () {},
            child: const SizedBox(width: 20, height: 20),
          ),
        ),
      );

      final constrainedBoxes = tester.widgetList<ConstrainedBox>(
        find.descendant(
          of: find.byKey(const Key('test-private-size')),
          matching: find.byType(ConstrainedBox),
        ),
      );
      final hasCorrectConstraints = constrainedBoxes.any(
        (cb) =>
            cb.constraints.minWidth == 48.0 &&
            cb.constraints.minHeight == 48.0,
      );
      expect(hasCorrectConstraints, isTrue);
    });
  });
}

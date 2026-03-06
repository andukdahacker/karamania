import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/accessibility_provider.dart';

void main() {
  group('AccessibilityProvider', () {
    test('defaults to reducedMotion false', () {
      final provider = AccessibilityProvider();
      expect(provider.reducedMotion, isFalse);
    });

    test('is a ChangeNotifier', () {
      final provider = AccessibilityProvider();
      expect(provider, isA<ChangeNotifier>());
    });

    testWidgets('reads disableAnimations from MediaQuery', (tester) async {
      final provider = AccessibilityProvider();

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Builder(
            builder: (context) {
              provider.updateFromMediaQuery(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(provider.reducedMotion, isTrue);
    });

    testWidgets('reads non-reduced motion from MediaQuery', (tester) async {
      final provider = AccessibilityProvider();

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: false),
          child: Builder(
            builder: (context) {
              provider.updateFromMediaQuery(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(provider.reducedMotion, isFalse);
    });

    testWidgets('notifies listeners when value changes', (tester) async {
      final provider = AccessibilityProvider();
      var notified = false;
      provider.addListener(() => notified = true);

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Builder(
            builder: (context) {
              provider.updateFromMediaQuery(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(notified, isTrue);
    });

    testWidgets('does not notify when value unchanged', (tester) async {
      final provider = AccessibilityProvider();
      var notifyCount = 0;
      provider.addListener(() => notifyCount++);

      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: false),
          child: Builder(
            builder: (context) {
              provider.updateFromMediaQuery(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      // Default is false, MediaQuery says false — no change, no notify
      expect(notifyCount, 0);
    });
  });
}

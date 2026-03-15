import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/hype_signal_button.dart';

Widget _wrapWithProvider(Widget child, {required PartyProvider provider}) {
  return ChangeNotifierProvider<PartyProvider>.value(
    value: provider,
    child: MaterialApp(
      home: Scaffold(
        body: Overlay(
          initialEntries: [
            OverlayEntry(
              builder: (context) => child,
            ),
          ],
        ),
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('HypeSignalButton', () {
    testWidgets('renders with lightning bolt icon', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProvider(
        const HypeSignalButton(),
        provider: provider,
      ));

      expect(find.byKey(const Key('hype-signal-button')), findsOneWidget);
      expect(find.byIcon(Icons.flash_on), findsOneWidget);
    });

    testWidgets('button is dimmed during cooldown', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.startHypeCooldown();

      await tester.pumpWidget(_wrapWithProvider(
        const HypeSignalButton(),
        provider: provider,
      ));

      // IconButton should be disabled (onPressed null)
      final iconButton = tester.widget<IconButton>(find.byType(IconButton));
      expect(iconButton.onPressed, isNull);
    });

    testWidgets('cooldown indicator renders during cooldown', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.startHypeCooldown();

      await tester.pumpWidget(_wrapWithProvider(
        const HypeSignalButton(),
        provider: provider,
      ));

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('no cooldown indicator when not in cooldown', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProvider(
        const HypeSignalButton(),
        provider: provider,
      ));

      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('button re-enables after cooldown expires', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.startHypeCooldown();

      await tester.pumpWidget(_wrapWithProvider(
        const HypeSignalButton(),
        provider: provider,
      ));

      // Button disabled during cooldown
      var iconButton = tester.widget<IconButton>(find.byType(IconButton));
      expect(iconButton.onPressed, isNull);

      // Clear cooldown
      provider.clearHypeCooldown();
      await tester.pump();

      // Button re-enabled
      iconButton = tester.widget<IconButton>(find.byType(IconButton));
      expect(iconButton.onPressed, isNotNull);
    });

    testWidgets('tap during cooldown does nothing', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.startHypeCooldown();

      await tester.pumpWidget(_wrapWithProvider(
        const HypeSignalButton(),
        provider: provider,
      ));

      // Tap the button area
      await tester.tap(find.byKey(const Key('hype-signal-button')));
      await tester.pump();

      // Still in cooldown
      expect(provider.isHypeCooldown, isTrue);
    });
  });
}

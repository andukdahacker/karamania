import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/lightstick_mode.dart';

Widget _wrapWithProviders(Widget child, {required PartyProvider provider}) {
  final accessibilityProvider = AccessibilityProvider();

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<PartyProvider>.value(value: provider),
      ChangeNotifierProvider<AccessibilityProvider>.value(
        value: accessibilityProvider,
      ),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp(
        home: Scaffold(
          body: Overlay(
            initialEntries: [
              OverlayEntry(
                builder: (context) => Stack(children: [child]),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('LightstickMode', () {
    testWidgets('full-screen glow renders with provider lightstick color',
        (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProviders(
        LightstickMode(onExit: () {}),
        provider: provider,
      ));

      expect(find.byKey(const Key('lightstick-mode')), findsOneWidget);
    });

    testWidgets('renders 5 color picker dots', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProviders(
        LightstickMode(onExit: () {}),
        provider: provider,
      ));

      // 5 color picker dots keyed by index
      for (var i = 0; i < 5; i++) {
        expect(find.byKey(Key('lightstick-color-$i')), findsOneWidget);
      }
    });

    testWidgets('tapping a color dot updates provider lightstick color',
        (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProviders(
        LightstickMode(onExit: () {}),
        provider: provider,
      ));

      // Tap the warm red color dot (index 4 = 0xFFFF4444)
      await tester.tap(find.byKey(const Key('lightstick-color-4')));
      await tester.pump();

      expect(provider.lightstickColor, const Color(0xFFFF4444));
    });

    testWidgets('tap anywhere triggers exit callback', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      bool exitCalled = false;

      await tester.pumpWidget(_wrapWithProviders(
        LightstickMode(onExit: () => exitCalled = true),
        provider: provider,
      ));

      // Tap on the main GestureDetector (the lightstick-mode key)
      await tester.tap(find.byKey(const Key('lightstick-mode')));
      await tester.pump();

      expect(exitCalled, isTrue);
    });

    testWidgets('hype button is rendered within lightstick mode',
        (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProviders(
        LightstickMode(onExit: () {}),
        provider: provider,
      ));

      expect(find.byKey(const Key('hype-signal-button')), findsOneWidget);
    });

    testWidgets('SongOverButton is NOT rendered inside LightstickMode (rendered by PartyScreen)', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyCreated('test-session', 'ABCD'); // Sets isHost=true

      await tester.pumpWidget(_wrapWithProviders(
        LightstickMode(onExit: () {}),
        provider: provider,
      ));

      // SongOverButton is rendered by PartyScreen, not LightstickMode
      expect(find.byKey(const Key('lightstick-mode')), findsOneWidget);
    });
  });
}

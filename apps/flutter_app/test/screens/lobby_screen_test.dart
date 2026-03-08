import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/lobby_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

Widget _wrapWithProviders(Widget child, {PartyProvider? partyProvider}) {
  final provider = partyProvider ?? PartyProvider()
    ..onPartyCreated('test-session', 'ABCD');

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<PartyProvider>.value(value: provider),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp(
        home: child,
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('LobbyScreen', () {
    testWidgets('renders QR code widget', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.byType(QrImageView), findsOneWidget);
    });

    testWidgets('renders party code text', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.textContaining('ABCD'), findsOneWidget);
    });

    testWidgets('renders 5 vibe selector buttons', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.byKey(const Key('vibe-general')), findsOneWidget);
      expect(find.byKey(const Key('vibe-kpop')), findsOneWidget);
      expect(find.byKey(const Key('vibe-rock')), findsOneWidget);
      expect(find.byKey(const Key('vibe-ballad')), findsOneWidget);
      expect(find.byKey(const Key('vibe-edm')), findsOneWidget);
    });

    testWidgets('renders START PARTY button (disabled)', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.byKey(const Key('start-party-btn')), findsOneWidget);
      expect(find.text('START PARTY'), findsOneWidget);
    });

    testWidgets('renders share button', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.byKey(const Key('share-party-btn')), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('renders participant count', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.text('1 joined'), findsOneWidget);
    });

    testWidgets('vibe tap starts preview, second tap confirms selection',
        (tester) async {
      final partyProvider = PartyProvider()
        ..onPartyCreated('test-session', 'ABCD');
      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: partyProvider));
      await tester.pump();

      // Initial vibe is general
      expect(partyProvider.vibe, PartyVibe.general);

      // First tap on rock — starts preview (does NOT confirm yet)
      await tester.tap(find.byKey(const Key('vibe-rock')));
      await tester.pump();
      expect(partyProvider.vibe, PartyVibe.general); // Still general

      // Second tap on rock within preview — confirms
      await tester.tap(find.byKey(const Key('vibe-rock')));
      await tester.pump();
      expect(partyProvider.vibe, PartyVibe.rock);
    });

    testWidgets('vibe preview reverts after 2 seconds without confirmation',
        (tester) async {
      final partyProvider = PartyProvider()
        ..onPartyCreated('test-session', 'ABCD');
      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: partyProvider));
      await tester.pump();

      // Tap kpop — starts preview
      await tester.tap(find.byKey(const Key('vibe-kpop')));
      await tester.pump();
      expect(partyProvider.vibe, PartyVibe.general); // Still general

      // Wait 2 seconds for timer to fire
      await tester.pump(const Duration(seconds: 2));

      // Vibe should still be general (preview reverted)
      expect(partyProvider.vibe, PartyVibe.general);
    });
  });
}

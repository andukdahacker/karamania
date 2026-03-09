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
  final provider = partyProvider ??
      (PartyProvider()..onPartyCreated('test-session', 'ABCD'));

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
    testWidgets('renders QR code widget for host', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.byType(QrImageView), findsOneWidget);
    });

    testWidgets('renders party code text', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.textContaining('ABCD'), findsOneWidget);
    });

    testWidgets('renders 5 vibe selector buttons for host', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.byKey(const Key('vibe-general')), findsOneWidget);
      expect(find.byKey(const Key('vibe-kpop')), findsOneWidget);
      expect(find.byKey(const Key('vibe-rock')), findsOneWidget);
      expect(find.byKey(const Key('vibe-ballad')), findsOneWidget);
      expect(find.byKey(const Key('vibe-edm')), findsOneWidget);
    });

    testWidgets('renders START PARTY button for host', (tester) async {
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

    testWidgets('shows waiting for guests when fewer than 3 participants', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.text('Waiting for guests...'), findsOneWidget);
    });

    testWidgets('hides waiting for guests when 3 or more participants', (tester) async {
      final provider = PartyProvider()
        ..onPartyCreated('test-session', 'ABCD');
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
        ParticipantInfo(userId: 'u3', displayName: 'Bob'),
      ]);

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.text('Waiting for guests...'), findsNothing);
    });

    testWidgets('guest view hides QR code and vibe selector', (tester) async {
      final guestProvider = PartyProvider()
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'ROCK',
          vibe: PartyVibe.rock,
        );

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: guestProvider));
      await tester.pump();

      // QR code should NOT be present for guest
      expect(find.byType(QrImageView), findsNothing);
      // Vibe selector buttons should NOT be present for guest
      expect(find.byKey(const Key('vibe-general')), findsNothing);
      // START PARTY button should NOT be present for guest
      expect(find.byKey(const Key('start-party-btn')), findsNothing);
      // Share button SHOULD still be present
      expect(find.byKey(const Key('share-party-btn')), findsOneWidget);
      // Party code SHOULD still be displayed
      expect(find.textContaining('ROCK'), findsOneWidget);
    });

    testWidgets('displays participant list when participants exist', (tester) async {
      final provider = PartyProvider()
        ..onPartyCreated('test-session', 'ABCD');
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
        ParticipantInfo(userId: 'u3', displayName: 'Bob'),
      ]);

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.text('Host'), findsOneWidget);
      expect(find.text('Alice'), findsOneWidget);
      expect(find.text('Bob'), findsOneWidget);
      expect(find.text('Participants'), findsOneWidget);
    });

    testWidgets('shows best with 3+ message when fewer than 3 participants', (tester) async {
      final provider = PartyProvider()
        ..onPartyCreated('test-session', 'ABCD');
      // Host is 1 participant

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.text('Works best with 3+ friends!'), findsOneWidget);
    });

    testWidgets('hides best with 3+ message when 3 or more participants', (tester) async {
      final provider = PartyProvider()
        ..onPartyCreated('test-session', 'ABCD');
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
        ParticipantInfo(userId: 'u3', displayName: 'Bob'),
      ]);

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.text('Works best with 3+ friends!'), findsNothing);
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

    // Story 1.7 tests

    testWidgets('START PARTY button has opacity 0.5 when participantCount < 3',
        (tester) async {
      // Default provider has 1 participant (host only)
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      final opacityFinder = find.ancestor(
        of: find.byKey(const Key('start-party-btn')),
        matching: find.byType(Opacity),
      );
      final opacity = tester.firstWidget<Opacity>(opacityFinder);
      expect(opacity.opacity, 0.5);
    });

    testWidgets('START PARTY button has opacity 1.0 when isHost and participantCount >= 3',
        (tester) async {
      final provider = PartyProvider()..onPartyCreated('test-session', 'ABCD');
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
        ParticipantInfo(userId: 'u3', displayName: 'Bob'),
      ]);

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      final opacityFinder = find.ancestor(
        of: find.byKey(const Key('start-party-btn')),
        matching: find.byType(Opacity),
      );
      final opacity = tester.firstWidget<Opacity>(opacityFinder);
      expect(opacity.opacity, 1.0);
    });

    testWidgets('shows "Need X more to start" text when isHost and fewer than 3 participants',
        (tester) async {
      // Default provider has 1 participant (host only), needs 2 more
      await tester.pumpWidget(_wrapWithProviders(const LobbyScreen()));
      await tester.pump();

      expect(find.textContaining('Need'), findsOneWidget);
      expect(find.textContaining('more to start'), findsOneWidget);
    });

    // Story 1.8 tests

    testWidgets('shows reconnecting banner when connectionStatus is reconnecting',
        (tester) async {
      final provider = PartyProvider()..onPartyCreated('test-session', 'ABCD');
      provider.onConnectionStatusChanged(ConnectionStatus.reconnecting);

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('reconnecting-banner')), findsOneWidget);
    });

    testWidgets('shows host transfer banner when hostTransferPending is true',
        (tester) async {
      final provider = PartyProvider()..onPartyCreated('test-session', 'ABCD');
      provider.onHostTransferred(true);

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-transfer-banner')), findsOneWidget);
      expect(find.text('You are now the host!'), findsOneWidget);
    });

    testWidgets('hides reconnecting banner when connectionStatus is connected',
        (tester) async {
      final provider = PartyProvider()..onPartyCreated('test-session', 'ABCD');
      // Status is connected by default

      await tester.pumpWidget(
          _wrapWithProviders(const LobbyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('reconnecting-banner')), findsNothing);
    });
  });
}

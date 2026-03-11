import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/screens/party_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

PartyProvider _createTestProvider() {
  return PartyProvider(wakelockToggle: (_) {})
    ..onPartyCreated('test-session', 'ABCD');
}

Widget _wrapWithProviders(Widget child, {PartyProvider? partyProvider}) {
  final provider = partyProvider ?? _createTestProvider();

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

  tearDown(() {
    SocketClient.instance.disconnect();
  });

  group('PartyScreen', () {
    testWidgets('shows DJ state label for lobby by default', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const PartyScreen()));
      await tester.pump();

      expect(find.text(Copy.djStateLobby), findsOneWidget);
    });

    testWidgets('shows participant count', (tester) async {
      final provider = _createTestProvider();
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
      ]);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.textContaining('2'), findsWidgets);
      expect(
        find.text('2 ${Copy.participants.toLowerCase()}'),
        findsOneWidget,
      );
    });

    testWidgets('shows host controls overlay for host in active state', (tester) async {
      final provider = _createTestProvider();
      provider.onSessionStatus('active');
      provider.onDjStateUpdate(state: DJState.songSelection);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-controls-fab')), findsOneWidget);
    });

    testWidgets('hides host controls overlay for non-host', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'ROCK',
          vibe: PartyVibe.rock,
          status: 'active',
        );

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-controls-fab')), findsNothing);
    });

    testWidgets('hides host controls overlay in lobby state', (tester) async {
      final provider = _createTestProvider();
      // Default state is lobby — overlay should not show

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-controls-fab')), findsNothing);
    });

    testWidgets('hides host controls overlay in finale state', (tester) async {
      final provider = _createTestProvider();
      provider.onSessionStatus('active');
      provider.onDjStateUpdate(state: DJState.finale);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-controls-fab')), findsNothing);
    });

    testWidgets('shows Song Over button for host during song state', (tester) async {
      final provider = _createTestProvider();
      provider.onSessionStatus('active');
      provider.onDjStateUpdate(state: DJState.song);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('song-over-button')), findsOneWidget);
    });

    testWidgets('hides Song Over button for non-host', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'ROCK',
          vibe: PartyVibe.rock,
          status: 'active',
        );
      provider.onDjStateUpdate(state: DJState.song);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('song-over-button')), findsNothing);
    });

    testWidgets('hides Song Over button when not in song state', (tester) async {
      final provider = _createTestProvider();
      provider.onSessionStatus('active');
      provider.onDjStateUpdate(state: DJState.ceremony);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('song-over-button')), findsNothing);
    });

    testWidgets('shows catch-up card when isCatchingUp is true', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LATE',
          vibe: PartyVibe.general,
          status: 'active',
        );
      provider.onCatchUpStarted();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('catch-up-card')), findsOneWidget);
    });

    testWidgets('catch-up card shows participant count and vibe', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LATE',
          vibe: PartyVibe.rock,
          status: 'active',
        );
      provider.onParticipantsSync([
        ParticipantInfo(userId: 'u1', displayName: 'Host'),
        ParticipantInfo(userId: 'u2', displayName: 'Alice'),
        ParticipantInfo(userId: 'u3', displayName: 'Bob'),
      ]);
      provider.onCatchUpStarted();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      // Welcome text
      expect(find.text(Copy.welcomeToParty), findsOneWidget);
      // Participant count with "are here"
      expect(
        find.text(
            '3 ${Copy.participants.toLowerCase()} ${Copy.areHere}'),
        findsOneWidget,
      );
      // Vibe label with emoji
      expect(
        find.text('${Copy.vibeLabel}: ${Copy.vibeEmoji(PartyVibe.rock)}'),
        findsOneWidget,
      );
      // Dismiss hint
      expect(find.text(Copy.tapToDismiss), findsOneWidget);
    });

    testWidgets('catch-up card dismisses on tap', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LATE',
          vibe: PartyVibe.general,
          status: 'active',
        );
      provider.onCatchUpStarted();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      // Card is visible
      expect(find.byKey(const Key('catch-up-card')), findsOneWidget);

      // Tap the catch-up card to dismiss
      await tester.tap(find.byKey(const Key('catch-up-card')));
      await tester.pump();

      // Card should be gone after tap
      expect(find.byKey(const Key('catch-up-card')), findsNothing);
      expect(provider.isCatchingUp, isFalse);
    });

    testWidgets('catch-up card auto-dismisses after 3 seconds', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LATE',
          vibe: PartyVibe.general,
          status: 'active',
        );
      provider.onCatchUpStarted();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      // Card is visible initially
      expect(find.byKey(const Key('catch-up-card')), findsOneWidget);

      // Advance time by 3 seconds for auto-dismiss timer
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();

      // Card should be gone after 3 seconds
      expect(find.byKey(const Key('catch-up-card')), findsNothing);
      expect(provider.isCatchingUp, isFalse);
    });

    testWidgets('catch-up card auto-dismisses when isCatchingUp becomes true AFTER mount',
        (tester) async {
      // Simulates mid-session join: provider has pendingCatchUp=true but
      // isCatchingUp=false at mount time. Timer must start reactively.
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LATE',
          vibe: PartyVibe.general,
          status: 'active',
        );

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      // No catch-up card yet
      expect(find.byKey(const Key('catch-up-card')), findsNothing);
      // Loading skeleton should be visible
      expect(find.byKey(const Key('loading-skeleton')), findsOneWidget);

      // Simulate socket event arriving after mount
      provider.onCatchUpStarted();
      await tester.pump();

      // Now catch-up card is visible, skeleton gone
      expect(find.byKey(const Key('catch-up-card')), findsOneWidget);
      expect(find.byKey(const Key('loading-skeleton')), findsNothing);

      // Auto-dismiss after 3 seconds
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();

      expect(find.byKey(const Key('catch-up-card')), findsNothing);
      expect(provider.isCatchingUp, isFalse);
    });

    testWidgets('shows loading skeleton for mid-session join', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {})
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LATE',
          vibe: PartyVibe.rock,
          status: 'active',
        );

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      // Loading skeleton shows pulsing KARAMANIA logo
      expect(find.byKey(const Key('loading-skeleton')), findsOneWidget);
      expect(find.text(Copy.appTitle), findsOneWidget);
    });

    testWidgets('loading skeleton not shown for lobby-to-party transition',
        (tester) async {
      // Host creates party (status defaults to lobby) → no loading skeleton
      final provider = _createTestProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('loading-skeleton')), findsNothing);
    });

    // Story 1.8 tests

    testWidgets('shows reconnecting banner when connectionStatus is reconnecting',
        (tester) async {
      final provider = _createTestProvider();
      provider.onConnectionStatusChanged(ConnectionStatus.reconnecting);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('reconnecting-banner')), findsOneWidget);
    });

    testWidgets('hides reconnecting banner when connectionStatus is connected',
        (tester) async {
      final provider = _createTestProvider();
      // Status is connected by default

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('reconnecting-banner')), findsNothing);
    });

    testWidgets('shows host transfer banner when hostTransferPending is true',
        (tester) async {
      final provider = _createTestProvider();
      provider.onHostTransferred(true);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-transfer-banner')), findsOneWidget);
      expect(find.text('You are now the host!'), findsOneWidget);
    });

    testWidgets('hides host transfer banner when hostTransferPending is false',
        (tester) async {
      final provider = _createTestProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-transfer-banner')), findsNothing);
    });

    testWidgets('reconnecting banner contains progress indicator and text',
        (tester) async {
      final provider = _createTestProvider();
      provider.onConnectionStatusChanged(ConnectionStatus.reconnecting);

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('reconnecting-banner')), findsOneWidget);
      expect(find.text(Copy.reconnecting), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    // Story 2.4 tests — DJ state display

    testWidgets('shows correct state label for each DJState', (tester) async {
      final provider = _createTestProvider();
      provider.onSessionStatus('active');

      for (final state in DJState.values) {
        provider.onDjStateUpdate(state: state);
        await tester.pumpWidget(
            _wrapWithProviders(const PartyScreen(), partyProvider: provider));
        await tester.pump();

        expect(
          find.byKey(const Key('dj-state-label')),
          findsOneWidget,
          reason: 'dj-state-label should be present for ${state.name}',
        );
        expect(
          find.text(Copy.djStateLabel(state)),
          findsOneWidget,
          reason: 'Label for ${state.name} should be displayed',
        );
      }
    });

    testWidgets('shows performer name when available', (tester) async {
      final provider = _createTestProvider();
      provider.onSessionStatus('active');
      provider.onDjStateUpdate(
        state: DJState.song,
        currentPerformer: 'Alice',
      );

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('current-performer')), findsOneWidget);
      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('hides performer name when null', (tester) async {
      final provider = _createTestProvider();
      provider.onDjStateUpdate(
        state: DJState.songSelection,
        currentPerformer: null,
      );

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('current-performer')), findsNothing);
    });

    testWidgets('shows countdown timer when timer metadata present', (tester) async {
      final now = DateTime.now().millisecondsSinceEpoch;
      final provider = _createTestProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      // Update state AFTER mount so the provider listener fires
      provider.onDjStateUpdate(
        state: DJState.song,
        timerStartedAt: now,
        timerDurationMs: 120000, // 2 minutes
      );
      await tester.pump();

      expect(find.byKey(const Key('countdown-timer')), findsOneWidget);
    });

    testWidgets('hides countdown timer when timer metadata is null', (tester) async {
      final provider = _createTestProvider();
      provider.onDjStateUpdate(
        state: DJState.songSelection,
        timerStartedAt: null,
        timerDurationMs: null,
      );

      await tester.pumpWidget(
          _wrapWithProviders(const PartyScreen(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('countdown-timer')), findsNothing);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

import 'helpers/test_app.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    initializeTestConfig();
  });

  // ---------------------------------------------------------------------------
  // Group 1: App launch — no server needed
  // ---------------------------------------------------------------------------

  group('App launch', () {
    testWidgets('app launches and displays the home screen', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      expect(find.text('CREATE PARTY'), findsOneWidget);
      expect(find.text('JOIN PARTY'), findsOneWidget);
    });

    testWidgets('home screen renders primary action buttons', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('create-party-btn')), findsOneWidget);
      expect(find.byKey(const Key('join-party-btn')), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // Group 2: Navigation — no server needed
  // ---------------------------------------------------------------------------

  group('Navigation', () {
    testWidgets('tapping JOIN PARTY navigates to join screen', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('join-party-btn')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('party-code-input')), findsOneWidget);
      expect(find.byKey(const Key('display-name-input')), findsOneWidget);
    });

    testWidgets('join screen shows submit button', (tester) async {
      final router = createTestRouter(initialLocation: '/join');
      await tester.pumpWidget(buildTestApp(router: router));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('join-party-submit-btn')), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // Group 3: Party screen UI — seeded PartyProvider state (no server)
  // ---------------------------------------------------------------------------

  group('Party screen rendering', () {
    // Use a wider surface to avoid SoundboardBar overflow on narrow simulator
    const partyScreenSize = Size(430, 932); // iPhone 15 Pro Max

    testWidgets('party screen shows DJ state label and reaction bar',
        (tester) async {
      await tester.binding.setSurfaceSize(partyScreenSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      // Seed the PartyProvider with active song state
      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();
      party.onPartyCreated('test-session', 'TEST');
      party.onPartyStarted();
      party.onDjStateUpdate(
        state: DJState.song,
        songCount: 1,
        participantCount: 4,
        currentPerformer: 'DJ Master',
        timerStartedAt: DateTime.now().millisecondsSinceEpoch,
        timerDurationMs: 180000,
      );
      await tester.pumpAndSettle();

      // DJ state label should be visible
      expect(find.byKey(const Key('dj-state-label')), findsOneWidget);

      // Reaction bar should be visible during song state
      expect(find.byKey(const Key('reaction-bar')), findsOneWidget);
    });

    testWidgets('reaction emoji buttons are tappable during song state',
        (tester) async {
      await tester.binding.setSurfaceSize(partyScreenSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();
      party.onPartyCreated('test-session', 'TEST');
      party.onPartyStarted();
      party.onDjStateUpdate(
        state: DJState.song,
        songCount: 1,
        participantCount: 4,
        currentPerformer: 'DJ Master',
        timerStartedAt: DateTime.now().millisecondsSinceEpoch,
        timerDurationMs: 180000,
      );
      await tester.pumpAndSettle();

      // Find a reaction emoji button
      final fireEmoji = find.byKey(const Key('reaction-emoji-🔥'));
      expect(fireEmoji, findsOneWidget);

      // Tap it — should not crash
      await tester.tap(fireEmoji);
      await tester.pump();
    });

    testWidgets('pause overlay appears when DJ is paused', (tester) async {
      await tester.binding.setSurfaceSize(partyScreenSize);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = createTestRouter(initialLocation: '/party');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();
      party.onPartyCreated('test-session', 'TEST');
      party.onPartyStarted();
      party.onDjStateUpdate(
        state: DJState.song,
        songCount: 1,
        participantCount: 4,
      );
      // Now pause
      party.onDjPause(
          pausedFromState: DJState.song.name, timerRemainingMs: 60000);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pause-overlay')), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // Group 4: Lobby screen — seeded state (no server)
  // ---------------------------------------------------------------------------

  group('Lobby screen rendering', () {
    testWidgets('lobby shows vibe selector and start button for host',
        (tester) async {
      final router = createTestRouter(initialLocation: '/lobby');
      await tester.pumpWidget(buildTestApp(router: router));

      final context = tester.element(find.byType(MaterialApp).first);
      final party = context.read<PartyProvider>();
      party.onPartyCreated('test-session', 'TEST');
      party.onParticipantsSync([
        const ParticipantInfo(
            userId: 'host', displayName: 'Host', isOnline: true),
        const ParticipantInfo(
            userId: 'g1', displayName: 'Guest 1', isOnline: true),
        const ParticipantInfo(
            userId: 'g2', displayName: 'Guest 2', isOnline: true),
      ]);
      await tester.pumpAndSettle();

      // Vibe selector visible for host
      expect(find.byKey(const Key('vibe-general')), findsOneWidget);

      // Start party button visible
      expect(find.byKey(const Key('start-party-btn')), findsOneWidget);
    });
  });

  // ---------------------------------------------------------------------------
  // Group 5: Join flow with real server (requires run_integration_tests.sh)
  // ---------------------------------------------------------------------------

  group('Join flow (requires server)', () {
    testWidgets(
      'entering valid code + name joins the party',
      (tester) async {
        if (partyCode.isEmpty) {
          // Skip if no party code provided (running without server)
          return;
        }

        final router = createTestRouter(initialLocation: '/join');
        await tester.pumpWidget(
            buildTestApp(router: router, overrideServerUrl: serverUrl));
        await tester.pumpAndSettle();

        // Enter party code
        await tester.enterText(
            find.byKey(const Key('party-code-input')), partyCode);

        // Enter display name
        await tester.enterText(
            find.byKey(const Key('display-name-input')), 'FlutterTestBot');

        // Tap join
        await tester.tap(find.byKey(const Key('join-party-submit-btn')));

        // Wait for navigation (network call + socket connect)
        await tester.pumpAndSettle(const Duration(seconds: 5));

        // Should navigate to lobby or party screen
        final onLobby = find.byKey(const Key('start-party-btn'));
        final onParty = find.byKey(const Key('dj-state-label'));
        expect(
            onLobby.evaluate().isNotEmpty || onParty.evaluate().isNotEmpty,
            isTrue,
            reason: 'Should navigate to lobby or party screen after join');
      },
    );
  });
}

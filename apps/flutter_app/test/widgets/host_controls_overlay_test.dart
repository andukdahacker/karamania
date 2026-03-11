import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/host_controls_overlay.dart';

PartyProvider _createHostProvider() {
  return PartyProvider(wakelockToggle: (_) {})
    ..onPartyCreated('test-session', 'ABCD');
}

PartyProvider _createGuestProvider() {
  return PartyProvider(wakelockToggle: (_) {})
    ..onPartyJoined(
      sessionId: 'session-1',
      partyCode: 'ROCK',
      vibe: PartyVibe.rock,
      status: 'active',
    );
}

bool _inviteCalled = false;

Widget _wrapWithProviders(Widget child, {PartyProvider? partyProvider}) {
  final provider = partyProvider ?? _createHostProvider();

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<PartyProvider>.value(value: provider),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              HostControlsOverlay(onInvite: () => _inviteCalled = true),
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

  setUp(() {
    _inviteCalled = false;
  });

  tearDown(() {
    SocketClient.instance.disconnect();
  });

  group('HostControlsOverlay', () {
    testWidgets('shows SizedBox.shrink for non-host', (tester) async {
      final provider = _createGuestProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-controls-fab')), findsNothing);
    });

    testWidgets('shows FAB for host', (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      expect(find.byKey(const Key('host-controls-fab')), findsOneWidget);
    });

    testWidgets('FAB tap expands control buttons, shows all 6 buttons',
        (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Buttons should not be visible before tapping FAB
      expect(find.byKey(const Key('host-control-invite')), findsNothing);

      // Tap FAB to expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();

      // All 6 control buttons should be visible
      expect(find.byKey(const Key('host-control-invite')), findsOneWidget);
      expect(find.byKey(const Key('host-control-skip')), findsOneWidget);
      expect(find.byKey(const Key('host-control-override')), findsOneWidget);
      expect(find.byKey(const Key('host-control-pause')), findsOneWidget);
      expect(find.byKey(const Key('host-control-kick')), findsOneWidget);
      expect(find.byKey(const Key('host-control-end-party')), findsOneWidget);
    });

    testWidgets('second FAB tap collapses overlay', (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();
      expect(find.byKey(const Key('host-control-invite')), findsOneWidget);

      // Collapse
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();
      expect(find.byKey(const Key('host-control-invite')), findsNothing);
    });

    testWidgets('barrier tap collapses overlay', (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();
      expect(find.byKey(const Key('host-overlay-barrier')), findsOneWidget);

      // Tap barrier to collapse
      await tester.tapAt(const Offset(10, 10));
      await tester.pump();
      expect(find.byKey(const Key('host-control-invite')), findsNothing);
      expect(find.byKey(const Key('host-overlay-barrier')), findsNothing);
    });

    testWidgets('pause button is enabled and shows Pause label when not paused', (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();

      // Find the pause button and verify it exists
      final pauseFinder = find.byKey(const Key('host-control-pause'));
      expect(pauseFinder, findsOneWidget);

      // Verify the InkWell inside pause button has non-null onTap
      final inkWell = tester.widget<InkWell>(find.descendant(
        of: pauseFinder,
        matching: find.byType(InkWell),
      ));
      expect(inkWell.onTap, isNotNull);

      // Verify label shows Pause
      expect(find.text(Copy.hostControlPause), findsOneWidget);
    });

    testWidgets('pause button shows Resume label and play icon when paused', (tester) async {
      final provider = _createHostProvider();
      provider.onDjPause(pausedFromState: 'song');

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();

      // Find the pause button
      final pauseFinder = find.byKey(const Key('host-control-pause'));
      expect(pauseFinder, findsOneWidget);

      // Verify label shows Resume
      expect(find.text(Copy.hostControlResume), findsOneWidget);
      expect(find.text(Copy.hostControlPause), findsNothing);

      // Verify play_arrow icon is shown
      expect(find.byIcon(Icons.play_arrow), findsOneWidget);
    });

    testWidgets('end party button shows confirmation dialog', (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();

      // Tap end party
      await tester.tap(find.byKey(const Key('host-control-end-party')));
      await tester.pumpAndSettle();

      // Confirmation dialog should be visible
      expect(find.byKey(const Key('end-party-dialog')), findsOneWidget);
      expect(find.text(Copy.hostControlEndPartyConfirmTitle), findsOneWidget);
      expect(find.text(Copy.hostControlEndPartyConfirmBody), findsOneWidget);
      expect(find.byKey(const Key('end-party-confirm')), findsOneWidget);
      expect(find.byKey(const Key('end-party-cancel')), findsOneWidget);
    });

    testWidgets('end party cancel dismisses dialog without action',
        (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();

      // Tap end party
      await tester.tap(find.byKey(const Key('host-control-end-party')));
      await tester.pumpAndSettle();

      // Dialog is showing
      expect(find.byKey(const Key('end-party-dialog')), findsOneWidget);

      // Tap cancel
      await tester.tap(find.byKey(const Key('end-party-cancel')));
      await tester.pumpAndSettle();

      // Dialog should be dismissed
      expect(find.byKey(const Key('end-party-dialog')), findsNothing);
    });

    testWidgets('skip button is present with correct label', (tester) async {
      final provider = _createHostProvider();

      await tester.pumpWidget(
          _wrapWithProviders(const SizedBox(), partyProvider: provider));
      await tester.pump();

      // Expand
      await tester.tap(find.byKey(const Key('host-controls-fab')));
      await tester.pump();

      expect(find.byKey(const Key('host-control-skip')), findsOneWidget);
      expect(find.text(Copy.hostControlSkip), findsOneWidget);
    });
  });
}

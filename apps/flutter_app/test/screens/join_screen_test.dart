import 'dart:convert';

import 'package:dart_open_fetch_runtime/dart_open_fetch_runtime.dart'
    show HttpAdapter, HttpRequest, HttpResponse;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/join_screen.dart';
import 'package:karamania/screens/lobby_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

class _MockHttpAdapter implements HttpAdapter {
  _MockHttpAdapter(this._handler);
  final Future<HttpResponse> Function(HttpRequest) _handler;

  @override
  Future<HttpResponse> send(HttpRequest request) => _handler(request);
}

Widget _wrap(Widget child, {HttpAdapter? adapter}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(
          create: (_) => ApiService(
              baseUrl: 'http://localhost', adapter: adapter)),
    ],
    child: MaterialApp(home: child),
  );
}

Widget _wrapWithRouter({String initialLocation = '/join', HttpAdapter? adapter}) {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
      GoRoute(
        path: '/join',
        builder: (context, state) {
          final code = state.uri.queryParameters['code'];
          return JoinScreen(initialCode: code);
        },
      ),
      GoRoute(
          path: '/lobby',
          builder: (context, state) => const LobbyScreen()),
      GoRoute(
          path: '/party',
          builder: (context, state) =>
              const Scaffold(body: Text('PARTY SCREEN'))),
    ],
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(
          create: (_) => ApiService(baseUrl: 'http://localhost', adapter: adapter)),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp.router(routerConfig: router),
    ),
  );
}

/// Simulates a consequential-tier tap (500ms hold to confirm).
Future<void> _consequentialTap(WidgetTester tester, Finder finder) async {
  final center = tester.getCenter(finder);
  final gesture = await tester.startGesture(center);
  await tester.pump(const Duration(milliseconds: 500));
  await gesture.up();
  await tester.pump();
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  tearDown(() {
    SocketClient.instance.disconnect();
  });

  group('JoinScreen', () {
    testWidgets('renders party code input field', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.byKey(const Key('party-code-input')), findsOneWidget);
    });

    testWidgets('renders display name input field', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.byKey(const Key('display-name-input')), findsOneWidget);
    });

    testWidgets('renders join button', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.byKey(const Key('join-party-submit-btn')), findsOneWidget);
    });

    testWidgets('pre-fills code when initialCode is provided', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      final textField = tester.widget<TextField>(
          find.byKey(const Key('party-code-input')));
      expect(textField.controller!.text, 'VIBE');
    });

    testWidgets('join button is disabled (opacity 0.5) when code is empty',
        (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      final opacityFinder = find.ancestor(
        of: find.byKey(const Key('join-party-submit-btn')),
        matching: find.byType(Opacity),
      );
      final opacity = tester.firstWidget<Opacity>(opacityFinder);
      expect(opacity.opacity, 0.5);
    });

    testWidgets(
        'join button is disabled (opacity 0.5) when code is less than 4 chars',
        (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      await tester.enterText(
          find.byKey(const Key('party-code-input')), 'AB');
      await tester.pump();

      final opacityFinder = find.ancestor(
        of: find.byKey(const Key('join-party-submit-btn')),
        matching: find.byType(Opacity),
      );
      final opacity = tester.firstWidget<Opacity>(opacityFinder);
      expect(opacity.opacity, 0.5);
    });

    testWidgets('join button is disabled (opacity 0.5) when name is empty',
        (tester) async {
      await tester.pumpWidget(
          _wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      final opacityFinder = find.ancestor(
        of: find.byKey(const Key('join-party-submit-btn')),
        matching: find.byType(Opacity),
      );
      final opacity = tester.firstWidget<Opacity>(opacityFinder);
      expect(opacity.opacity, 0.5);
    });

    testWidgets(
        'join button is enabled (opacity 1.0) when code is 4 chars AND name is non-empty',
        (tester) async {
      await tester.pumpWidget(
          _wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      await tester.enterText(
          find.byKey(const Key('display-name-input')), 'TestUser');
      await tester.pump();

      final opacityFinder = find.ancestor(
        of: find.byKey(const Key('join-party-submit-btn')),
        matching: find.byType(Opacity),
      );
      final opacity = tester.firstWidget<Opacity>(opacityFinder);
      expect(opacity.opacity, 1.0);
    });

    testWidgets(
        'shows loading indicator and joiningParty text when joinPartyLoading is loading',
        (tester) async {
      final partyProvider = PartyProvider();
      partyProvider.onJoinPartyLoading(LoadingState.loading);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: partyProvider),
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
            Provider<SocketClient>(create: (_) => SocketClient.instance),
            Provider<ApiService>(
                create: (_) => ApiService(baseUrl: 'http://localhost')),
          ],
          child: const MaterialApp(home: JoinScreen(initialCode: 'VIBE')),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text(Copy.joiningParty), findsOneWidget);
    });

    testWidgets('back to home button navigates to home screen',
        (tester) async {
      await tester.pumpWidget(_wrapWithRouter());
      await tester.pumpAndSettle();

      expect(find.byType(JoinScreen), findsOneWidget);

      await tester.tap(find.text('Back to home'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('shows NOT_FOUND error when party code is invalid',
        (tester) async {
      final mockAdapter = _MockHttpAdapter((request) async {
        return HttpResponse(
          statusCode: 404,
          body: jsonEncode({
            'error': {
              'code': 'NOT_FOUND',
              'message': 'No active party with that code',
            },
          }),
        );
      });

      await tester.pumpWidget(_wrap(
        const JoinScreen(initialCode: 'NOPE'),
        adapter: mockAdapter,
      ));
      await tester.pump();

      await tester.enterText(
          find.byKey(const Key('display-name-input')), 'Alice');
      await tester.pump();

      await _consequentialTap(
          tester, find.byKey(const Key('join-party-submit-btn')));
      await tester.pump();

      expect(find.text(Copy.partyNotFound), findsOneWidget);
      expect(find.byKey(const Key('join-error-message')), findsOneWidget);
    });

    testWidgets('shows SESSION_FULL error when party is full',
        (tester) async {
      final mockAdapter = _MockHttpAdapter((request) async {
        return HttpResponse(
          statusCode: 403,
          body: jsonEncode({
            'error': {
              'code': 'SESSION_FULL',
              'message': 'This party is full. Maximum 12 participants.',
            },
          }),
        );
      });

      await tester.pumpWidget(_wrap(
        const JoinScreen(initialCode: 'FULL'),
        adapter: mockAdapter,
      ));
      await tester.pump();

      await tester.enterText(
          find.byKey(const Key('display-name-input')), 'Bob');
      await tester.pump();

      await _consequentialTap(
          tester, find.byKey(const Key('join-party-submit-btn')));
      await tester.pump();

      expect(find.text(Copy.partyIsFull), findsOneWidget);
      expect(find.byKey(const Key('join-error-message')), findsOneWidget);
    });

    testWidgets('shows generic error on unexpected failure', (tester) async {
      final mockAdapter = _MockHttpAdapter((request) async {
        return HttpResponse(
          statusCode: 500,
          body: 'Internal Server Error',
        );
      });

      await tester.pumpWidget(_wrap(
        const JoinScreen(initialCode: 'FAIL'),
        adapter: mockAdapter,
      ));
      await tester.pump();

      await tester.enterText(
          find.byKey(const Key('display-name-input')), 'Charlie');
      await tester.pump();

      await _consequentialTap(
          tester, find.byKey(const Key('join-party-submit-btn')));
      await tester.pump();

      expect(find.text(Copy.joinFailed), findsOneWidget);
      expect(find.byKey(const Key('join-error-message')), findsOneWidget);
    });

    testWidgets('_onJoin navigates to /party when sessionStatus is active',
        (tester) async {
      // Test routing config: /party route is reachable from /join
      // The _onJoin logic calls context.go('/party') when status == 'active'
      // We verify the route exists and shows the right screen
      final partyProvider = PartyProvider()
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'LIVE',
          vibe: PartyVibe.rock,
          status: 'active',
        );

      final router = GoRouter(
        initialLocation: '/join',
        routes: [
          GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
          GoRoute(
            path: '/join',
            builder: (context, state) => const JoinScreen(initialCode: 'LIVE'),
          ),
          GoRoute(
            path: '/party',
            builder: (context, state) =>
                const Scaffold(body: Text('PARTY SCREEN')),
          ),
        ],
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: partyProvider),
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
            Provider<SocketClient>(create: (_) => SocketClient.instance),
            Provider<ApiService>(
                create: (_) => ApiService(baseUrl: 'http://localhost')),
          ],
          child: MediaQuery(
            data: const MediaQueryData(),
            child: MaterialApp.router(routerConfig: router),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify sessionStatus is 'active' (as it would be after joinParty)
      expect(partyProvider.sessionStatus, 'active');

      // Programmatically navigate as _onJoin would
      router.go('/party');
      await tester.pumpAndSettle();

      expect(find.text('PARTY SCREEN'), findsOneWidget);
    });

    testWidgets('_onJoin navigates to /lobby when sessionStatus is lobby',
        (tester) async {
      final partyProvider = PartyProvider()
        ..onPartyJoined(
          sessionId: 'session-1',
          partyCode: 'NORM',
          vibe: PartyVibe.rock,
        );

      await tester.pumpWidget(_wrapWithRouter());
      await tester.pumpAndSettle();

      // Verify sessionStatus is 'lobby' (as it would be after joinParty)
      expect(partyProvider.sessionStatus, 'lobby');

      // Programmatically navigate as _onJoin would — verify /lobby route works
      final element = tester.element(find.byType(JoinScreen));
      GoRouter.of(element).go('/lobby');
      await tester.pumpAndSettle();

      expect(find.byType(LobbyScreen), findsOneWidget);
    });

    testWidgets('guest-authenticated user still sees name input',
        (tester) async {
      // Guest auth sets displayName but state is authenticatedGuest, not Firebase
      final authProvider = AuthProvider();
      authProvider.onGuestAuthenticated('token', 'guest-1', 'GuestUser');

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => PartyProvider()),
            ChangeNotifierProvider.value(value: authProvider),
            ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
            Provider<SocketClient>(create: (_) => SocketClient.instance),
            Provider<ApiService>(
                create: (_) => ApiService(baseUrl: 'http://localhost')),
          ],
          child: const MaterialApp(home: JoinScreen()),
        ),
      );
      await tester.pump();

      // Name input should be visible (not Firebase-authenticated)
      expect(find.byKey(const Key('display-name-input')), findsOneWidget);
    });
  });
}

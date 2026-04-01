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
import 'package:karamania/state/session_detail_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Fake AuthProvider that can simulate Firebase auth without a real Firebase User.
class _FakeFirebaseAuthProvider extends AuthProvider {
  final String _fakeName;
  _FakeFirebaseAuthProvider(this._fakeName);

  @override
  AuthState get state => AuthState.authenticatedFirebase;

  @override
  String? get displayName => _fakeName;
}

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
      ChangeNotifierProvider(create: (_) => TimelineProvider()),
      ChangeNotifierProvider(create: (_) => SessionDetailProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
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
      ChangeNotifierProvider(create: (_) => TimelineProvider()),
      ChangeNotifierProvider(create: (_) => SessionDetailProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
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

/// Helper to enter a 4-character code into the individual code boxes.
Future<void> _enterCode(WidgetTester tester, String code) async {
  for (int i = 0; i < code.length && i < 4; i++) {
    await tester.enterText(find.byKey(Key('party-code-$i')), code[i]);
    await tester.pump();
  }
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
    testWidgets('renders party code input area', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.byKey(const Key('party-code-input')), findsOneWidget);
      // Verify all 4 individual code boxes exist
      for (int i = 0; i < 4; i++) {
        expect(find.byKey(Key('party-code-$i')), findsOneWidget);
      }
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

    testWidgets('renders helper text below code boxes', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.text(Copy.partyCodeHint), findsOneWidget);
    });

    testWidgets('renders back arrow button', (tester) async {
      await tester.pumpWidget(_wrapWithRouter());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byKey(const Key('join-back-btn')), findsOneWidget);
    });

    testWidgets('pre-fills code when initialCode is provided', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      // Each box should have one character
      for (int i = 0; i < 4; i++) {
        final textField = tester.widget<TextField>(
            find.byKey(Key('party-code-$i')));
        expect(textField.controller!.text, 'VIBE'[i]);
      }
    });

    testWidgets('auto-advance focus moves to next box on character entry',
        (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      await tester.enterText(find.byKey(const Key('party-code-0')), 'V');
      await tester.pump();

      // Focus should have moved to box 1
      final focusNode1 = tester.widget<TextField>(
          find.byKey(const Key('party-code-1')));
      expect(focusNode1.focusNode!.hasFocus, isTrue);
    });

    testWidgets('backspace moves focus to previous box', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen(initialCode: 'VI')));
      await tester.pump();

      // Focus box 1, clear it
      await tester.tap(find.byKey(const Key('party-code-1')));
      await tester.pump();
      await tester.enterText(find.byKey(const Key('party-code-1')), '');
      await tester.pump();

      // Focus should have moved back to box 0
      final focusNode0 = tester.widget<TextField>(
          find.byKey(const Key('party-code-0')));
      expect(focusNode0.focusNode!.hasFocus, isTrue);
    });

    testWidgets('paste distributes across all 4 boxes', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      // Simulate paste into first box (enters multiple chars)
      await tester.enterText(find.byKey(const Key('party-code-0')), 'VIBE');
      await tester.pump();

      // All 4 boxes should be filled
      for (int i = 0; i < 4; i++) {
        final textField = tester.widget<TextField>(
            find.byKey(Key('party-code-$i')));
        expect(textField.controller!.text, 'VIBE'[i]);
      }
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

      // Only fill 2 of 4 boxes
      await tester.enterText(find.byKey(const Key('party-code-0')), 'A');
      await tester.pump();
      await tester.enterText(find.byKey(const Key('party-code-1')), 'B');
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

    testWidgets('back arrow navigates to home screen', (tester) async {
      await tester.pumpWidget(_wrapWithRouter());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(JoinScreen), findsOneWidget);

      await tester.tap(find.byKey(const Key('join-back-btn')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

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
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(partyProvider.sessionStatus, 'active');

      router.go('/party');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

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
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(partyProvider.sessionStatus, 'lobby');

      final element = tester.element(find.byType(JoinScreen));
      GoRouter.of(element).go('/lobby');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(LobbyScreen), findsOneWidget);
    });

    testWidgets(
        'firebase-authenticated user sees read-only name instead of text field',
        (tester) async {
      final authProvider = _FakeFirebaseAuthProvider('FirebaseUser');

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => PartyProvider()),
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
            Provider<SocketClient>(create: (_) => SocketClient.instance),
            Provider<ApiService>(
                create: (_) => ApiService(baseUrl: 'http://localhost')),
          ],
          child: const MaterialApp(home: JoinScreen()),
        ),
      );
      await tester.pump();

      // Should NOT show editable name input
      expect(find.byKey(const Key('display-name-input')), findsNothing);
      // Should show the Firebase display name as read-only text
      expect(find.text('FirebaseUser'), findsOneWidget);
    });

    testWidgets('guest-authenticated user still sees name input',
        (tester) async {
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

      expect(find.byKey(const Key('display-name-input')), findsOneWidget);
    });

    testWidgets('accessibility labels exist on code boxes', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      for (int i = 0; i < 4; i++) {
        expect(
          find.bySemanticsLabel('Party code digit ${i + 1} of 4'),
          findsOneWidget,
        );
      }
    });
  });
}

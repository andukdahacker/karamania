import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_client.dart';
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

Widget _wrap(Widget child, {http.Client? httpClient}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiClient>(
          create: (_) => ApiClient(
              baseUrl: 'http://localhost', httpClient: httpClient)),
    ],
    child: MaterialApp(home: child),
  );
}

Widget _wrapWithRouter({String initialLocation = '/join'}) {
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
    ],
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiClient>(
          create: (_) => ApiClient(baseUrl: 'http://localhost')),
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
            Provider<ApiClient>(
                create: (_) => ApiClient(baseUrl: 'http://localhost')),
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
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'NOT_FOUND',
              'message': 'No active party with that code',
            },
          }),
          404,
        );
      });

      await tester.pumpWidget(_wrap(
        const JoinScreen(initialCode: 'NOPE'),
        httpClient: mockClient,
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
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': {
              'code': 'SESSION_FULL',
              'message': 'This party is full. Maximum 12 participants.',
            },
          }),
          403,
        );
      });

      await tester.pumpWidget(_wrap(
        const JoinScreen(initialCode: 'FULL'),
        httpClient: mockClient,
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
      final mockClient = MockClient((request) async {
        return http.Response('Internal Server Error', 500);
      });

      await tester.pumpWidget(_wrap(
        const JoinScreen(initialCode: 'FAIL'),
        httpClient: mockClient,
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
            Provider<ApiClient>(
                create: (_) => ApiClient(baseUrl: 'http://localhost')),
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

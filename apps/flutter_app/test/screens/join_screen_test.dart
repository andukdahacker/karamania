import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_client.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/join_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/party_provider.dart';

Widget _wrap(Widget child) {
  return MaterialApp(home: child);
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
    ],
  );
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiClient>(create: (_) => ApiClient(baseUrl: 'http://localhost')),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp.router(routerConfig: router),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('JoinScreen', () {
    testWidgets('renders party code input field', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.byKey(const Key('party-code-input')), findsOneWidget);
    });

    testWidgets('renders join button', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      expect(find.byKey(const Key('join-party-submit-btn')), findsOneWidget);
    });

    testWidgets('pre-fills code when initialCode is provided', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      final textField = tester.widget<TextField>(find.byKey(const Key('party-code-input')));
      expect(textField.controller!.text, 'VIBE');
    });

    testWidgets('join button is disabled when code is empty', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      final button = tester.widget<ElevatedButton>(find.byKey(const Key('join-party-submit-btn')));
      expect(button.onPressed, isNull);
    });

    testWidgets('join button is disabled when code is less than 4 chars', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen()));
      await tester.pump();

      await tester.enterText(find.byKey(const Key('party-code-input')), 'AB');
      await tester.pump();

      final button = tester.widget<ElevatedButton>(find.byKey(const Key('join-party-submit-btn')));
      expect(button.onPressed, isNull);
    });

    testWidgets('join button is enabled when code is 4 chars', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      final button = tester.widget<ElevatedButton>(find.byKey(const Key('join-party-submit-btn')));
      expect(button.onPressed, isNotNull);
    });

    testWidgets('join button shows snackbar when tapped', (tester) async {
      await tester.pumpWidget(_wrap(const JoinScreen(initialCode: 'VIBE')));
      await tester.pump();

      await tester.tap(find.byKey(const Key('join-party-submit-btn')));
      await tester.pump();

      expect(find.text('Join flow coming in the next update!'), findsOneWidget);
    });

    testWidgets('back to home button navigates to home screen', (tester) async {
      await tester.pumpWidget(_wrapWithRouter());
      await tester.pumpAndSettle();

      expect(find.byType(JoinScreen), findsOneWidget);

      await tester.tap(find.text('Back to home'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });
}

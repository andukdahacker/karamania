import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/join_screen.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/socket/client.dart';

GoRouter _createTestRouter({String initialLocation = '/'}) {
  return GoRouter(
    initialLocation: initialLocation,
    redirect: (context, state) {
      if (state.matchedLocation == '/' && state.uri.queryParameters.containsKey('code')) {
        final code = state.uri.queryParameters['code'];
        return '/join?code=$code';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/join',
        builder: (context, state) {
          final code = state.uri.queryParameters['code'];
          return JoinScreen(initialCode: code);
        },
      ),
    ],
  );
}

Widget _wrapWithRouter(GoRouter router) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(create: (_) => ApiService(baseUrl: 'http://localhost')),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp.router(
        routerConfig: router,
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('Deep link routing', () {
    testWidgets('/?code=VIBE redirects to /join?code=VIBE', (tester) async {
      final router = _createTestRouter(initialLocation: '/?code=VIBE');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pumpAndSettle();

      // Should show JoinScreen with code pre-filled
      expect(find.byType(JoinScreen), findsOneWidget);
      final textField = tester.widget<TextField>(find.byKey(const Key('party-code-input')));
      expect(textField.controller!.text, 'VIBE');
    });

    testWidgets('/join?code=VIBE shows JoinScreen with code pre-filled', (tester) async {
      final router = _createTestRouter(initialLocation: '/join?code=VIBE');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pumpAndSettle();

      expect(find.byType(JoinScreen), findsOneWidget);
      final textField = tester.widget<TextField>(find.byKey(const Key('party-code-input')));
      expect(textField.controller!.text, 'VIBE');
    });

    testWidgets('/join without code shows JoinScreen with empty code field', (tester) async {
      final router = _createTestRouter(initialLocation: '/join');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pumpAndSettle();

      expect(find.byType(JoinScreen), findsOneWidget);
      final textField = tester.widget<TextField>(find.byKey(const Key('party-code-input')));
      expect(textField.controller!.text, '');
    });

    testWidgets('/ without code shows HomeScreen (no redirect)', (tester) async {
      final router = _createTestRouter(initialLocation: '/');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });
}

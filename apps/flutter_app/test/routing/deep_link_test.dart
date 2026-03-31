import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/join_screen.dart';
import 'package:karamania/screens/session_detail_screen.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/session_detail_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/state/upload_provider.dart';
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
      if (state.matchedLocation == '/' && state.uri.queryParameters.containsKey('session')) {
        final sessionId = state.uri.queryParameters['session'];
        if (sessionId != null && sessionId.isNotEmpty) {
          return '/session/$sessionId';
        }
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
      GoRoute(
        path: '/session/:id',
        builder: (context, state) {
          final sessionId = state.pathParameters['id']!;
          return SessionDetailScreen(sessionId: sessionId);
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
      ChangeNotifierProvider(create: (_) => TimelineProvider()),
      ChangeNotifierProvider(create: (_) => SessionDetailProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
      ChangeNotifierProvider(create: (_) => UploadProvider()),
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

/// Helper to verify the 4 individual code boxes contain the expected code.
void _expectCodeBoxes(WidgetTester tester, String expectedCode) {
  for (int i = 0; i < expectedCode.length && i < 4; i++) {
    final textField = tester.widget<TextField>(find.byKey(Key('party-code-$i')));
    expect(textField.controller!.text, expectedCode[i]);
  }
}

/// Helper to verify all 4 code boxes are empty.
void _expectEmptyCodeBoxes(WidgetTester tester) {
  for (int i = 0; i < 4; i++) {
    final textField = tester.widget<TextField>(find.byKey(Key('party-code-$i')));
    expect(textField.controller!.text, '');
  }
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('Deep link routing', () {
    testWidgets('/?code=VIBE redirects to /join?code=VIBE', (tester) async {
      final router = _createTestRouter(initialLocation: '/?code=VIBE');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Should show JoinScreen with code pre-filled across 4 boxes
      expect(find.byType(JoinScreen), findsOneWidget);
      _expectCodeBoxes(tester, 'VIBE');
    });

    testWidgets('/join?code=VIBE shows JoinScreen with code pre-filled', (tester) async {
      final router = _createTestRouter(initialLocation: '/join?code=VIBE');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(JoinScreen), findsOneWidget);
      _expectCodeBoxes(tester, 'VIBE');
    });

    testWidgets('/join without code shows JoinScreen with empty code field', (tester) async {
      final router = _createTestRouter(initialLocation: '/join');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(JoinScreen), findsOneWidget);
      _expectEmptyCodeBoxes(tester);
    });

    testWidgets('/ without code shows HomeScreen (no redirect)', (tester) async {
      final router = _createTestRouter(initialLocation: '/');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(HomeScreen), findsOneWidget);
    });

    testWidgets('/?session=SESSION_ID redirects to /session/SESSION_ID', (tester) async {
      final router = _createTestRouter(initialLocation: '/?session=test-uuid-123');
      await tester.pumpWidget(_wrapWithRouter(router));
      await tester.pumpAndSettle();

      expect(find.byType(SessionDetailScreen), findsOneWidget);
    });
  });
}

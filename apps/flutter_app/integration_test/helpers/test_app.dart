import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/join_screen.dart';
import 'package:karamania/screens/lobby_screen.dart';
import 'package:karamania/screens/party_screen.dart';
import 'package:karamania/screens/session_detail_screen.dart';
import 'package:karamania/screens/media_gallery_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/session_detail_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/state/upload_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Server URL from --dart-define, defaults to localhost:3000.
const serverUrl = String.fromEnvironment(
  'SERVER_URL',
  defaultValue: 'http://localhost:3000',
);

/// Party code from --dart-define (set by run_integration_tests.sh).
const partyCode = String.fromEnvironment('PARTY_CODE', defaultValue: '');

/// Host token from --dart-define (set by run_integration_tests.sh).
const hostToken = String.fromEnvironment('HOST_TOKEN', defaultValue: '');

/// Initializes [AppConfig] for integration tests.
void initializeTestConfig() {
  AppConfig.initializeForTest(flavor: 'dev');
}

/// GoRouter mirroring the production route table.
GoRouter createTestRouter({String initialLocation = '/'}) {
  return GoRouter(
    initialLocation: initialLocation,
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
        path: '/lobby',
        builder: (context, state) => const LobbyScreen(),
      ),
      GoRoute(
        path: '/session/:id',
        builder: (context, state) {
          final sessionId = state.pathParameters['id']!;
          return SessionDetailScreen(sessionId: sessionId);
        },
      ),
      GoRoute(
        path: '/media',
        builder: (context, state) => const MediaGalleryScreen(),
      ),
      GoRoute(
        path: '/party',
        builder: (context, state) => const PartyScreen(),
      ),
    ],
  );
}

/// Builds the full app widget tree with all required providers.
Widget buildTestApp({GoRouter? router, String? overrideServerUrl}) {
  final testRouter = router ?? createTestRouter();
  final baseUrl = overrideServerUrl ?? serverUrl;

  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
      ChangeNotifierProvider(create: (_) => TimelineProvider()),
      ChangeNotifierProvider(create: (_) => SessionDetailProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      ChangeNotifierProvider(create: (_) => UploadProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(
        create: (_) => ApiService(baseUrl: baseUrl),
      ),
    ],
    child: Builder(
      builder: (context) {
        final vibe = context.watch<PartyProvider>().vibe;
        return MaterialApp.router(
          title: 'Karamania Integration Test',
          theme: createDJTheme(vibe: vibe),
          routerConfig: testRouter,
          debugShowCheckedModeBanner: false,
        );
      },
    ),
  );
}

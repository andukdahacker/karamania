import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;

/// Mock HTTP client that returns a transparent 1x1 PNG for any image request.
/// Prevents NetworkImageLoadException in widget tests.
class _TestHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return _FakeHttpClient();
  }
}

class _FakeHttpClient extends Fake implements HttpClient {
  @override
  bool autoUncompress = true;

  @override
  Future<HttpClientRequest> getUrl(Uri url) async {
    return _FakeHttpClientRequest();
  }
}

class _FakeHttpClientRequest extends Fake implements HttpClientRequest {
  @override
  Future<HttpClientResponse> close() async {
    return _FakeHttpClientResponse();
  }
}

// 1x1 transparent PNG
const _transparentPng = <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];

class _FakeHttpClientResponse extends Fake implements HttpClientResponse {
  @override
  int get statusCode => 200;

  @override
  int get contentLength => _transparentPng.length;

  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;

  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int> event)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) {
    return Stream<List<int>>.value(_transparentPng).listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }
}

class FakeUser extends Fake implements User {
  @override
  String? get displayName => 'Test User';

  @override
  String? get email => 'test@test.com';
}

Widget _wrapWithProviders(
  Widget child, {
  AuthProvider? authProvider,
  TimelineProvider? timelineProvider,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider<AuthProvider>.value(value: authProvider ?? AuthProvider()),
      ChangeNotifierProvider<TimelineProvider>.value(value: timelineProvider ?? TimelineProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(create: (_) => ApiService(baseUrl: 'http://localhost')),
    ],
    child: MaterialApp(
      home: child,
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('HomeScreen', () {
    testWidgets('renders CREATE PARTY and JOIN PARTY buttons', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('CREATE PARTY'), findsOneWidget);
      expect(find.text('JOIN PARTY'), findsOneWidget);
    });

    testWidgets('buttons have correct widget keys', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.byKey(const Key('create-party-btn')), findsOneWidget);
      expect(find.byKey(const Key('join-party-btn')), findsOneWidget);
    });

    testWidgets('buttons meet minimum size requirements (48x48px)', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      final createBtn = tester.getSize(find.byKey(const Key('create-party-btn')));
      expect(createBtn.width, greaterThanOrEqualTo(48.0));
      expect(createBtn.height, greaterThanOrEqualTo(48.0));

      final joinBtn = tester.getSize(find.byKey(const Key('join-party-btn')));
      expect(joinBtn.width, greaterThanOrEqualTo(48.0));
      expect(joinBtn.height, greaterThanOrEqualTo(48.0));
    });

    testWidgets('shows sign-in prompt for unauthenticated users', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('Create an account to save your session history'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);
    });

    testWidgets('renders app title', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('KARAMANIA'), findsOneWidget);
    });

    testWidgets('authenticated user with avatar shows CircleAvatar', (tester) async {
      // Override HTTP to serve a fake image (per story: DO NOT test network image loading)
      final previousOverrides = HttpOverrides.current;
      HttpOverrides.global = _TestHttpOverrides();
      addTearDown(() => HttpOverrides.global = previousOverrides);

      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());
      authProvider.onProfileLoaded(
        userId: 'user-uuid-1',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(_wrapWithProviders(
        const HomeScreen(),
        authProvider: authProvider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('user-avatar')), findsOneWidget);
      expect(find.byType(CircleAvatar), findsOneWidget);
    });

    testWidgets('authenticated user without avatar shows no CircleAvatar', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());
      authProvider.onProfileLoaded(
        userId: 'user-uuid-2',
        displayName: 'Test User',
        createdAt: DateTime.now(),
      );

      await tester.pumpWidget(_wrapWithProviders(
        const HomeScreen(),
        authProvider: authProvider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('user-avatar')), findsNothing);
      expect(find.byType(CircleAvatar), findsNothing);
    });

    testWidgets('authenticated user shows sign-out button', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());

      await tester.pumpWidget(_wrapWithProviders(
        const HomeScreen(),
        authProvider: authProvider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('sign-out-btn')), findsOneWidget);
      expect(find.text('Sign Out'), findsOneWidget);
    });

    testWidgets('authenticated user shows display name', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());

      await tester.pumpWidget(_wrapWithProviders(
        const HomeScreen(),
        authProvider: authProvider,
      ));
      await tester.pump();

      expect(find.text('Test User'), findsOneWidget);
    });

    testWidgets('authenticated user with sessions sees session cards', (tester) async {
      final previousOverrides = HttpOverrides.current;
      HttpOverrides.global = _TestHttpOverrides();
      addTearDown(() => HttpOverrides.global = previousOverrides);

      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());
      authProvider.onProfileLoaded(
        userId: 'user-1',
        displayName: 'Test User',
        createdAt: DateTime.now(),
      );

      final timelineProvider = TimelineProvider();
      timelineProvider.onSessionsLoaded([
        SessionTimelineItem(
          id: 'session-1',
          venueName: 'Studio A',
          endedAt: '2026-03-10T20:00:00Z',
          participantCount: 5,
          topAward: 'Star of the Show',
          thumbnailUrl: null,
        ),
      ], 1);

      await tester.pumpWidget(_wrapWithProviders(
        const HomeScreen(),
        authProvider: authProvider,
        timelineProvider: timelineProvider,
      ));
      await tester.pump();

      expect(find.text('Studio A'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
      expect(find.text('Star of the Show'), findsOneWidget);
    });

    testWidgets('authenticated user with no sessions sees empty state CTA', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());
      authProvider.onProfileLoaded(
        userId: 'user-1',
        displayName: 'Test User',
        createdAt: DateTime.now(),
      );

      final timelineProvider = TimelineProvider();
      timelineProvider.onSessionsLoaded([], 0);

      await tester.pumpWidget(_wrapWithProviders(
        const HomeScreen(),
        authProvider: authProvider,
        timelineProvider: timelineProvider,
      ));
      await tester.pump();

      expect(find.text('Start your first party!'), findsOneWidget);
    });

    testWidgets('guest user sees sign-in prompt, no timeline', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('Create an account to save your session history'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);
      // No "Your Sessions" heading for guests
      expect(find.text('Your Sessions'), findsNothing);
    });

    testWidgets('session card tap triggers navigation to session detail', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onFirebaseAuthenticated(FakeUser());
      authProvider.onProfileLoaded(
        userId: 'user-1',
        displayName: 'Test User',
        createdAt: DateTime.now(),
      );

      final timelineProvider = TimelineProvider();
      timelineProvider.onSessionsLoaded([
        SessionTimelineItem(
          id: 'session-abc',
          venueName: 'Studio A',
          endedAt: '2026-03-10T20:00:00Z',
          participantCount: 5,
          topAward: null,
          thumbnailUrl: null,
        ),
      ], 1);

      final router = GoRouter(
        initialLocation: '/',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/session/:id',
            builder: (context, state) => Scaffold(
              body: Text('Session Detail: ${state.pathParameters['id']}'),
            ),
          ),
        ],
      );

      await tester.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => PartyProvider()),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
          ChangeNotifierProvider<TimelineProvider>.value(value: timelineProvider),
          ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
          ChangeNotifierProvider(create: (_) => CaptureProvider()),
          Provider<SocketClient>(create: (_) => SocketClient.instance),
          Provider<ApiService>(create: (_) => ApiService(baseUrl: 'http://localhost')),
        ],
        child: MaterialApp.router(routerConfig: router),
      ));
      await tester.pump();

      await tester.tap(find.text('Studio A'));
      await tester.pumpAndSettle();

      expect(find.text('Session Detail: session-abc'), findsOneWidget);
    });
  });
}

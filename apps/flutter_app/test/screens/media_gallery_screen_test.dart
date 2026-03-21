import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/screens/media_gallery_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/state/upload_provider.dart';

/// Mock HTTP client that returns a transparent 1x1 PNG for any image request.
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

/// Mock ApiService that overrides fetchMyMedia with configurable behavior.
class _MockApiService extends ApiService {
  _MockApiService() : super(baseUrl: 'http://localhost');

  ({List<MediaGalleryItem> captures, int total})? mockResult;
  bool shouldThrow = false;

  @override
  Future<({List<MediaGalleryItem> captures, int total})> fetchMyMedia({
    required String token,
    int limit = 40,
    int offset = 0,
  }) async {
    if (shouldThrow) {
      throw ApiException(code: 'ERROR', message: 'Failed');
    }
    return mockResult ?? (captures: <MediaGalleryItem>[], total: 0);
  }
}

Widget _wrapWithProviders(
  Widget child, {
  AuthProvider? authProvider,
  ApiService? apiService,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider ?? AuthProvider()),
      ChangeNotifierProvider(create: (_) => TimelineProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
      ChangeNotifierProvider(create: (_) => UploadProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(
          create: (_) => apiService ?? ApiService(baseUrl: 'http://localhost')),
    ],
    child: MaterialApp(
      home: child,
    ),
  );
}

void main() {
  late HttpOverrides? originalOverrides;

  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
    originalOverrides = HttpOverrides.current;
    HttpOverrides.global = _TestHttpOverrides();
  });

  tearDownAll(() {
    HttpOverrides.global = originalOverrides;
  });

  group('MediaGalleryScreen', () {
    testWidgets('shows app bar with My Media title', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        const MediaGalleryScreen(),
      ));
      await tester.pump();

      expect(find.byKey(const Key('media-gallery-appbar')), findsOneWidget);
      expect(find.text(Copy.myMedia), findsOneWidget);
    });

    testWidgets('shows back button in app bar', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        const MediaGalleryScreen(),
      ));
      await tester.pump();

      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    });

    testWidgets('unauthenticated user does not show media content',
        (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        const MediaGalleryScreen(),
      ));
      // _loadMedia fires via postFrameCallback. Without a token, redirect is
      // attempted via context.go('/'); in test env without GoRouter this falls
      // through to error state. Either way, no media content is shown.
      await tester.pumpAndSettle();

      expect(find.text(Copy.noMediaYet), findsNothing);
    });

    testWidgets('shows empty state when authenticated user has no captures',
        (tester) async {
      final authProvider = AuthProvider();
      authProvider.onGuestAuthenticated('mock-token', 'guest-1', 'Test');

      final mockApi = _MockApiService();
      mockApi.mockResult = (captures: <MediaGalleryItem>[], total: 0);

      await tester.pumpWidget(_wrapWithProviders(
        const MediaGalleryScreen(),
        authProvider: authProvider,
        apiService: mockApi,
      ));
      await tester.pumpAndSettle();

      expect(find.text(Copy.noMediaYet), findsOneWidget);
    });

    testWidgets('shows error state on API failure', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onGuestAuthenticated('mock-token', 'guest-1', 'Test');

      final mockApi = _MockApiService();
      mockApi.shouldThrow = true;

      await tester.pumpWidget(_wrapWithProviders(
        const MediaGalleryScreen(),
        authProvider: authProvider,
        apiService: mockApi,
      ));
      await tester.pumpAndSettle();

      expect(find.text(Copy.loadMediaError), findsOneWidget);
    });

    testWidgets('displays media grid after loading captures', (tester) async {
      final authProvider = AuthProvider();
      authProvider.onGuestAuthenticated('mock-token', 'guest-1', 'Test');

      final mockApi = _MockApiService();
      mockApi.mockResult = (
        captures: [
          const MediaGalleryItem(
            id: 'cap-1',
            sessionId: 'sess-1',
            venueName: 'Rock Bar',
            url: 'https://example.com/img1.png',
            triggerType: 'manual',
            createdAt: '2026-01-01T20:00:00Z',
            sessionDate: '2026-01-01T19:00:00Z',
          ),
          const MediaGalleryItem(
            id: 'cap-2',
            sessionId: 'sess-1',
            venueName: 'Rock Bar',
            url: null,
            triggerType: 'manual',
            createdAt: '2026-01-01T20:05:00Z',
            sessionDate: '2026-01-01T19:00:00Z',
          ),
          const MediaGalleryItem(
            id: 'cap-3',
            sessionId: 'sess-2',
            venueName: null,
            url: 'https://example.com/img3.png',
            triggerType: 'post_ceremony',
            createdAt: '2026-01-02T21:00:00Z',
            sessionDate: '2026-01-02T20:00:00Z',
          ),
        ],
        total: 3,
      );

      await tester.pumpWidget(_wrapWithProviders(
        const MediaGalleryScreen(),
        authProvider: authProvider,
        apiService: mockApi,
      ));
      // Use pump() with duration instead of pumpAndSettle to avoid Image.network
      // animation frames causing timeout.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Session group headers
      expect(find.text('Rock Bar'), findsOneWidget);
      expect(find.text(Copy.karaokeNight), findsOneWidget); // null venueName fallback

      // Media items rendered with correct keys
      expect(find.byKey(const Key('media-item-cap-1')), findsOneWidget);
      expect(find.byKey(const Key('media-placeholder-cap-2')), findsOneWidget);
      expect(find.byKey(const Key('media-item-cap-3')), findsOneWidget);
    });
  });
}

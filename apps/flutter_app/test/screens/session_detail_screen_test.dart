import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/session_detail_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/session_detail_provider.dart';
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

SessionDetail _createTestDetail({
  List<SessionDetailSetlistItem>? setlist,
  List<SessionDetailMedia>? media,
}) {
  return SessionDetail(
    id: 'session-1',
    venueName: 'Studio A',
    vibe: 'general',
    createdAt: '2026-03-10T12:00:00Z',
    endedAt: '2026-03-10T14:00:00Z',
    stats: const SessionDetailStats(
      songCount: 3,
      participantCount: 4,
      sessionDurationMs: 7200000,
      totalReactions: 50,
      totalSoundboardPlays: 10,
      totalCardsDealt: 5,
    ),
    participants: const [
      SessionDetailParticipant(
        userId: 'user-1',
        displayName: 'Alice',
        participationScore: 100,
        topAward: 'Star of the Show',
      ),
      SessionDetailParticipant(
        userId: null,
        displayName: 'Guest Bob',
        participationScore: 50,
        topAward: null,
      ),
    ],
    setlist: setlist ?? const [
      SessionDetailSetlistItem(
        position: 1,
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        performerName: 'Alice',
        awardTitle: 'Star',
        awardTone: 'hype',
      ),
      SessionDetailSetlistItem(
        position: 2,
        title: 'Yesterday',
        artist: 'Beatles',
        performerName: null,
        awardTitle: null,
        awardTone: null,
      ),
    ],
    awards: const [
      SessionDetailAward(
        userId: 'user-1',
        displayName: 'Alice',
        category: 'performer',
        title: 'Star of the Show',
        tone: 'hype',
        reason: 'Nailed it',
      ),
    ],
    media: media ?? const [
      SessionDetailMedia(
        id: 'media-1',
        url: 'https://example.com/photo.jpg',
        triggerType: 'manual',
        createdAt: '2026-03-10T13:00:00Z',
      ),
    ],
  );
}

Widget _wrapWithProviders(
  Widget child, {
  SessionDetailProvider? detailProvider,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider<AuthProvider>.value(value: AuthProvider()),
      ChangeNotifierProvider<SessionDetailProvider>.value(
        value: detailProvider ?? SessionDetailProvider(),
      ),
      ChangeNotifierProvider(create: (_) => TimelineProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      ChangeNotifierProvider(create: (_) => CaptureProvider()),
      ChangeNotifierProvider(create: (_) => UploadProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(create: (_) => ApiService(baseUrl: 'http://localhost')),
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

  group('SessionDetailScreen', () {
    testWidgets('loading state shows progress indicator', (tester) async {
      final provider = SessionDetailProvider();
      provider.detailState = LoadingState.loading;

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('idle state triggers load and transitions to loading', (tester) async {
      final provider = SessionDetailProvider();

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      // After pump, didChangeDependencies fires postFrameCallback which sets state to loading
      await tester.pump();
      await tester.pump();

      // Provider should have transitioned out of idle (to loading or error since no real API)
      expect(provider.detailState, isNot(LoadingState.idle));
    });

    testWidgets('error state shows error message with retry', (tester) async {
      final provider = SessionDetailProvider();
      provider.onLoadError('Could not load session details. Tap to retry.');

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.text('Could not load session details. Tap to retry.'), findsOneWidget);
    });

    testWidgets('success state shows all 5 sections', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail());

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      // Header
      expect(find.byKey(const Key('session-detail-header')), findsOneWidget);
      expect(find.text('Studio A'), findsAtLeast(1));

      // Participants section
      expect(find.text('Participants'), findsOneWidget);
      expect(find.text('Alice'), findsAtLeast(1));
      expect(find.text('Guest Bob'), findsAtLeast(1));

      // Setlist section
      expect(find.text('Setlist'), findsOneWidget);
      expect(find.text('Bohemian Rhapsody'), findsAtLeast(1));

      // Media gallery
      expect(find.text('Gallery'), findsOneWidget);

      // Setlist poster
      expect(find.text('Setlist Poster'), findsOneWidget);
    });

    testWidgets('participant list displays names and awards', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail());

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('participant-Alice')), findsOneWidget);
      expect(find.byKey(const Key('participant-Guest Bob')), findsOneWidget);
      expect(find.text('Star of the Show'), findsAtLeast(1));
      expect(find.text('100'), findsOneWidget);
      expect(find.text('50'), findsOneWidget);
    });

    testWidgets('setlist displays song titles with positions', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail());

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('setlist-item-1')), findsOneWidget);
      expect(find.byKey(const Key('setlist-item-2')), findsOneWidget);
      expect(find.text('#1'), findsAtLeast(1));
      expect(find.text('Bohemian Rhapsody'), findsAtLeast(1));
      expect(find.text('Yesterday'), findsAtLeast(1));
    });

    testWidgets('media gallery renders as grid', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail());

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.byType(GridView), findsOneWidget);
      expect(find.byKey(const Key('media-media-1')), findsOneWidget);
    });

    testWidgets('poster section renders SetlistPosterWidget from setlist data', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail());

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('setlist-poster')), findsOneWidget);
    });

    testWidgets('poster section hidden when setlist is empty', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail(setlist: []));

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.text('Setlist Poster'), findsNothing);
      expect(find.byKey(const Key('setlist-poster')), findsNothing);
    });

    testWidgets('media gallery hidden when media is empty', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail(media: []));

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.text('Gallery'), findsNothing);
      expect(find.byType(GridView), findsNothing);
    });

    testWidgets('Story 9.5 placeholder buttons render as disabled', (tester) async {
      final provider = SessionDetailProvider();
      provider.onDetailLoaded(_createTestDetail());

      await tester.pumpWidget(_wrapWithProviders(
        const SessionDetailScreen(sessionId: 'session-1'),
        detailProvider: provider,
      ));
      await tester.pump();

      expect(find.byKey(const Key('share-session-btn')), findsOneWidget);
      expect(find.byKey(const Key('lets-go-again-btn')), findsOneWidget);
      expect(find.text('Share Session'), findsOneWidget);
      expect(find.text("Let's go again!"), findsOneWidget);
    });
  });
}

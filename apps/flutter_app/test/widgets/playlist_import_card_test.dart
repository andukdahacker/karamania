import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/playlist_import_card.dart';

class MockApiService extends ApiService {
  MockApiService() : super(baseUrl: 'http://localhost:3000');

  PlaylistImportResult? mockResult;
  ApiException? mockError;

  @override
  Future<PlaylistImportResult> importPlaylist(String playlistUrl, {String? sessionId}) async {
    if (mockError != null) throw mockError!;
    return mockResult!;
  }

  @override
  Future<({String captureId, String storagePath})> createCapture({
    required String sessionId,
    required String captureType,
    required String triggerType,
    String? userId,
    String? token,
  }) async {
    return (captureId: 'mock-capture-id', storagePath: '$sessionId/mock-capture-id.jpg');
  }

  @override
  Future<({String uploadUrl, String storagePath})> getUploadUrl({
    required String sessionId,
    required String captureId,
    String? token,
  }) async {
    return (uploadUrl: 'https://storage.googleapis.com/mock-upload', storagePath: '$sessionId/$captureId.jpg');
  }
}

Widget _wrapWithProviders({
  required PartyProvider partyProvider,
  required ApiService apiService,
}) {
  return MaterialApp(
    home: MultiProvider(
      providers: [
        ChangeNotifierProvider<PartyProvider>.value(value: partyProvider),
        Provider<ApiService>.value(value: apiService),
      ],
      child: const Scaffold(body: PlaylistImportCard()),
    ),
  );
}

void main() {
  late PartyProvider partyProvider;
  late MockApiService mockApiService;

  setUp(() {
    partyProvider = PartyProvider(wakelockToggle: (_) {});
    mockApiService = MockApiService();
  });

  group('PlaylistImportCard', () {
    testWidgets('renders URL input field', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      expect(find.byKey(const Key('playlist-url-field')), findsOneWidget);
    });

    testWidgets('shows detection label when YouTube Music URL entered', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://music.youtube.com/playlist?list=PLtest',
      );
      await tester.pump();

      expect(find.byKey(const Key('playlist-detected-label')), findsOneWidget);
    });

    testWidgets('import button disabled without valid URL', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      final importBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('playlist-import-btn')),
      );
      expect(importBtn.onPressed, isNull);
    });

    testWidgets('import button enabled with valid YouTube Music URL', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://music.youtube.com/playlist?list=PLtest',
      );
      await tester.pump();

      final importBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('playlist-import-btn')),
      );
      expect(importBtn.onPressed, isNotNull);
    });

    testWidgets('shows loading state during import', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      partyProvider.onPlaylistImportStarted();
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows results after successful import', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      partyProvider.onPlaylistImportSuccess(
        [{'songTitle': 'Hello', 'artist': 'Adele'}],
        [{'songTitle': 'Hello', 'artist': 'Adele'}],
        0,
      );
      await tester.pump();

      expect(find.byKey(const Key('playlist-import-results')), findsOneWidget);
    });

    testWidgets('shows error state with retry button', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      partyProvider.onPlaylistImportError();
      await tester.pump();

      expect(find.byKey(const Key('playlist-import-error')), findsOneWidget);
      expect(find.byKey(const Key('playlist-retry-btn')), findsOneWidget);
    });

    testWidgets('retry button resets state', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      partyProvider.onPlaylistImportError();
      await tester.pump();

      await tester.tap(find.byKey(const Key('playlist-retry-btn')));
      await tester.pump();

      expect(partyProvider.playlistImportState, LoadingState.idle);
    });

    testWidgets('detects Spotify URL and shows Spotify label', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://open.spotify.com/playlist/abc123',
      );
      await tester.pump();

      expect(find.byKey(const Key('playlist-detected-label')), findsOneWidget);
      expect(find.text(Copy.playlistImportDetectedSpotify), findsOneWidget);
    });

    testWidgets('import button enabled with valid Spotify URL', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://open.spotify.com/playlist/abc123',
      );
      await tester.pump();

      final importBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('playlist-import-btn')),
      );
      expect(importBtn.onPressed, isNotNull);
    });

    testWidgets('SpotifyGuide retry resets state and re-triggers import', (tester) async {
      mockApiService.mockError = const ApiException(
        code: 'PLAYLIST_PRIVATE',
        message: 'This playlist is private',
      );

      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      // Enter Spotify URL, trigger import to get SpotifyGuide
      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://open.spotify.com/playlist/private123',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('playlist-import-btn')));
      await tester.pump();

      expect(find.byKey(const Key('spotify-guide')), findsOneWidget);

      // Now make the next import succeed
      mockApiService.mockError = null;
      mockApiService.mockResult = const PlaylistImportResult(
        tracks: [],
        matched: [],
        unmatchedCount: 0,
        totalFetched: 0,
      );

      // Tap retry in SpotifyGuide
      await tester.tap(find.byKey(const Key('spotify-guide-retry-btn')));
      await tester.pump();

      // SpotifyGuide should be gone, import re-triggered (loading or success)
      expect(find.byKey(const Key('spotify-guide')), findsNothing);
    });

    testWidgets('changing URL resets private error state', (tester) async {
      mockApiService.mockError = const ApiException(
        code: 'PLAYLIST_PRIVATE',
        message: 'This playlist is private',
      );

      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      // Enter Spotify URL, trigger import to get SpotifyGuide
      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://open.spotify.com/playlist/private123',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('playlist-import-btn')));
      await tester.pump();

      expect(find.byKey(const Key('spotify-guide')), findsOneWidget);

      // Change URL — should reset _isPrivateError
      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://open.spotify.com/playlist/different456',
      );
      await tester.pump();

      // Provider state is still error, but _isPrivateError is reset
      // so we should see generic error, not SpotifyGuide
      expect(find.byKey(const Key('spotify-guide')), findsNothing);
    });

    testWidgets('shows SpotifyGuide on PLAYLIST_PRIVATE error', (tester) async {
      mockApiService.mockError = const ApiException(
        code: 'PLAYLIST_PRIVATE',
        message: 'This playlist is private',
      );

      await tester.pumpWidget(_wrapWithProviders(
        partyProvider: partyProvider,
        apiService: mockApiService,
      ));

      // Enter Spotify URL and trigger import
      await tester.enterText(
        find.byKey(const Key('playlist-url-field')),
        'https://open.spotify.com/playlist/private123',
      );
      await tester.pump();

      await tester.tap(find.byKey(const Key('playlist-import-btn')));
      await tester.pump();

      expect(find.byKey(const Key('spotify-guide')), findsOneWidget);
      expect(find.text(Copy.spotifyGuideTitle), findsOneWidget);
    });
  });
}

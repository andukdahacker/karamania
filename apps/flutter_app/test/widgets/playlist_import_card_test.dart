import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/playlist_import_card.dart';

class MockApiService extends ApiService {
  MockApiService() : super(baseUrl: 'http://localhost:3000');

  PlaylistImportResult? mockResult;
  ApiException? mockError;

  @override
  Future<PlaylistImportResult> importPlaylist(String playlistUrl) async {
    if (mockError != null) throw mockError!;
    return mockResult!;
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
  });
}

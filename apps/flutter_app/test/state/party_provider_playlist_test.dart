import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';

void main() {
  late PartyProvider provider;

  setUp(() {
    provider = PartyProvider(wakelockToggle: (_) {});
  });

  group('PartyProvider playlist import state', () {
    test('initial state is idle with empty lists', () {
      expect(provider.playlistImportState, LoadingState.idle);
      expect(provider.importedTracks, isEmpty);
      expect(provider.matchedTracks, isEmpty);
      expect(provider.unmatchedCount, 0);
    });

    test('onPlaylistImportStarted sets loading state', () {
      provider.onPlaylistImportStarted();
      expect(provider.playlistImportState, LoadingState.loading);
    });

    test('onPlaylistImportSuccess sets success state and data', () {
      final tracks = [
        {'songTitle': 'Hello', 'artist': 'Adele'},
      ];
      final matched = [
        {'songTitle': 'Hello', 'artist': 'Adele'},
      ];

      provider.onPlaylistImportSuccess(tracks, matched, 0);

      expect(provider.playlistImportState, LoadingState.success);
      expect(provider.importedTracks, tracks);
      expect(provider.matchedTracks, matched);
      expect(provider.unmatchedCount, 0);
    });

    test('onPlaylistImportError sets error state', () {
      provider.onPlaylistImportError();
      expect(provider.playlistImportState, LoadingState.error);
    });

    test('resetPlaylistImport clears all playlist state', () {
      provider.onPlaylistImportSuccess(
        [{'songTitle': 'Hello', 'artist': 'Adele'}],
        [{'songTitle': 'Hello', 'artist': 'Adele'}],
        5,
      );

      provider.resetPlaylistImport();

      expect(provider.playlistImportState, LoadingState.idle);
      expect(provider.importedTracks, isEmpty);
      expect(provider.matchedTracks, isEmpty);
      expect(provider.unmatchedCount, 0);
    });

    test('notifies listeners on state changes', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onPlaylistImportStarted();
      expect(notifyCount, 1);

      provider.onPlaylistImportSuccess([], [], 0);
      expect(notifyCount, 2);

      provider.resetPlaylistImport();
      expect(notifyCount, 3);

      provider.onPlaylistImportError();
      expect(notifyCount, 4);
    });
  });
}

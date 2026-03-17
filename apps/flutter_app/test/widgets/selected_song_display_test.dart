import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/selected_song_display.dart';

Widget _wrapWithProvider(PartyProvider provider) {
  return MaterialApp(
    home: ChangeNotifierProvider<PartyProvider>.value(
      value: provider,
      child: const Scaffold(body: SelectedSongDisplay()),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('SelectedSongDisplay', () {
    testWidgets('renders song title and artist when hasLastQueuedSong is true', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.setLastQueuedSong(
        songTitle: 'Bohemian Rhapsody',
        artist: 'Queen',
        videoId: 'yt-vid-123',
        catalogTrackId: 'cat-1',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
      expect(find.text('Queen'), findsOneWidget);
      expect(find.byKey(const Key('selected-song-display')), findsOneWidget);
    });

    testWidgets('renders "Up Next" label and helper text', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.setLastQueuedSong(
        songTitle: 'Test Song',
        artist: 'Test Artist',
        videoId: 'vid',
        catalogTrackId: 'cat',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.text('Up Next'), findsOneWidget);
      expect(find.text('Enter this on the karaoke machine'), findsOneWidget);
    });

    testWidgets('host sees "Mark as Playing" button', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.onPartyCreated('session-1', 'ABCD'); // Sets isHost = true
      provider.setLastQueuedSong(
        songTitle: 'Test Song',
        artist: 'Test Artist',
        videoId: 'vid',
        catalogTrackId: 'cat',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.byKey(const Key('mark-as-playing-button')), findsOneWidget);
      expect(find.text('Mark as Playing'), findsOneWidget);
    });

    testWidgets('non-host does not see "Mark as Playing" button', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      // Do NOT call onPartyCreated — isHost stays false
      provider.setLastQueuedSong(
        songTitle: 'Test Song',
        artist: 'Test Artist',
        videoId: 'vid',
        catalogTrackId: 'cat',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.byKey(const Key('mark-as-playing-button')), findsNothing);
    });

    testWidgets('"Mark as Playing" button disables when hasDetectedSong is true', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.onPartyCreated('session-1', 'ABCD');
      provider.setLastQueuedSong(
        songTitle: 'Test Song',
        artist: 'Test Artist',
        videoId: 'vid',
        catalogTrackId: 'cat',
      );
      provider.setDetectedSong(songTitle: 'Test Song', artist: 'Test Artist');

      await tester.pumpWidget(_wrapWithProvider(provider));

      final button = tester.widget<ElevatedButton>(
        find.byKey(const Key('mark-as-playing-button')),
      );
      expect(button.onPressed, isNull); // Disabled
      expect(find.text('Marked as Playing'), findsOneWidget);
    });

    testWidgets('hides (SizedBox.shrink) when hasLastQueuedSong is false', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.byKey(const Key('selected-song-display')), findsNothing);
    });
  });
}

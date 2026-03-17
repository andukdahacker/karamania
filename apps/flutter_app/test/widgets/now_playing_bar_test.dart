import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/now_playing_bar.dart';

Widget _wrapWithProvider(PartyProvider provider) {
  return MaterialApp(
    home: ChangeNotifierProvider<PartyProvider>.value(
      value: provider,
      child: const Scaffold(body: NowPlayingBar()),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('NowPlayingBar', () {
    testWidgets('renders song title and artist when detected song is set', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.setDetectedSong(
        songTitle: 'Bohemian Rhapsody',
        artist: 'Queen',
        source: 'catalog',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
      expect(find.text('Queen'), findsOneWidget);
      expect(find.byKey(const Key('now-playing-bar')), findsOneWidget);
    });

    testWidgets('renders thumbnail when provided', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.setDetectedSong(
        songTitle: 'Hello',
        artist: 'Adele',
        thumbnail: 'https://i.ytimg.com/vi/test/mqdefault.jpg',
        source: 'api-parsed',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('hides when no detected song', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.byKey(const Key('now-playing-bar')), findsNothing);
    });

    testWidgets('updates when detected song changes', (tester) async {
      final provider = PartyProvider(wakelockToggle: (_) {});
      provider.setDetectedSong(
        songTitle: 'Hello',
        artist: 'Adele',
        source: 'catalog',
      );

      await tester.pumpWidget(_wrapWithProvider(provider));

      expect(find.text('Hello'), findsOneWidget);
      expect(find.text('Adele'), findsOneWidget);

      provider.setDetectedSong(
        songTitle: 'Bohemian Rhapsody',
        artist: 'Queen',
        source: 'api-parsed',
      );
      await tester.pump();

      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
      expect(find.text('Queen'), findsOneWidget);
      expect(find.text('Hello'), findsNothing);
    });
  });
}

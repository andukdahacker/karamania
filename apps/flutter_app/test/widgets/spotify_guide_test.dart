import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/spotify_guide.dart';

void main() {
  group('SpotifyGuide', () {
    testWidgets('displays 3-step guide', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SpotifyGuide(onRetry: () {}),
        ),
      ));

      expect(find.text(Copy.spotifyGuideTitle), findsOneWidget);
      expect(find.text(Copy.spotifyGuideStep1), findsOneWidget);
      expect(find.text(Copy.spotifyGuideStep2), findsOneWidget);
      expect(find.text(Copy.spotifyGuideStep3), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('has widget key spotify-guide', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SpotifyGuide(onRetry: () {}),
        ),
      ));

      expect(find.byKey(const Key('spotify-guide')), findsOneWidget);
    });

    testWidgets('retry button triggers onRetry callback', (tester) async {
      var retryPressed = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SpotifyGuide(onRetry: () => retryPressed = true),
        ),
      ));

      await tester.tap(find.byKey(const Key('spotify-guide-retry-btn')));
      await tester.pump();

      expect(retryPressed, isTrue);
    });

    testWidgets('shows Try Again button text', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SpotifyGuide(onRetry: () {}),
        ),
      ));

      expect(find.text(Copy.spotifyGuideRetry), findsOneWidget);
    });
  });
}

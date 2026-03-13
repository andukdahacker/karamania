import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/moment_card.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  Widget buildTestCard({
    String award = 'Mic Drop Master',
    PartyVibe vibe = PartyVibe.general,
    String? performerName,
    String? songTitle,
  }) {
    return MaterialApp(
      theme: createDJTheme(vibe: vibe),
      home: Scaffold(
        body: MomentCard(
          award: award,
          vibe: vibe,
          performerName: performerName,
          songTitle: songTitle,
        ),
      ),
    );
  }

  group('MomentCard', () {
    testWidgets('renders award title', (tester) async {
      await tester.pumpWidget(buildTestCard(award: 'Mic Drop Master'));

      expect(find.text('Mic Drop Master'), findsOneWidget);
    });

    testWidgets('renders performer name when provided', (tester) async {
      await tester.pumpWidget(buildTestCard(performerName: 'Alice'));

      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('omits performer name when null', (tester) async {
      await tester.pumpWidget(buildTestCard(performerName: null));

      expect(find.byKey(const Key('moment-card-performer')), findsNothing);
    });

    testWidgets('renders song title when provided', (tester) async {
      await tester.pumpWidget(buildTestCard(songTitle: 'Bohemian Rhapsody'));

      expect(find.text('Bohemian Rhapsody'), findsOneWidget);
    });

    testWidgets('omits song title when null', (tester) async {
      await tester.pumpWidget(buildTestCard(songTitle: null));

      expect(find.byKey(const Key('moment-card-song')), findsNothing);
    });

    testWidgets('renders Karamania branding', (tester) async {
      await tester.pumpWidget(buildTestCard());

      expect(find.text(Copy.appTitle), findsOneWidget);
    });

    testWidgets('renders confetti emojis for vibe', (tester) async {
      await tester.pumpWidget(buildTestCard(vibe: PartyVibe.general));

      final expectedEmojis = vibeConfettiEmojis[PartyVibe.general]!.join(' ');
      expect(find.text(expectedEmojis), findsOneWidget);
    });

    testWidgets('widget key is moment-card', (tester) async {
      await tester.pumpWidget(buildTestCard());

      expect(find.byKey(const Key('moment-card')), findsOneWidget);
    });
  });
}

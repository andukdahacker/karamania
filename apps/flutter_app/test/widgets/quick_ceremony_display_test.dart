import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/quick_ceremony_display.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  Widget buildTestWidget({
    required String award,
    PartyVibe vibe = PartyVibe.general,
    String? performerName,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: QuickCeremonyDisplay(
          award: award,
          vibe: vibe,
          performerName: performerName,
        ),
      ),
    );
  }

  group('QuickCeremonyDisplay', () {
    testWidgets('renders award title', (tester) async {
      await tester.pumpWidget(buildTestWidget(award: 'Mic Drop Master'));
      await tester.pump();

      expect(find.text('Mic Drop Master'), findsOneWidget);
    });

    testWidgets('shows performer name when provided', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        award: 'Star of the Show',
        performerName: 'Alice',
      ));
      await tester.pump();

      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('shows default content when performer name is null', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        award: 'Star of the Show',
        performerName: null,
      ));
      await tester.pump();

      expect(find.text('Star of the Show'), findsOneWidget);
      // Should not find any performer name text (only award + label)
      expect(find.text('Alice'), findsNothing);
    });

    testWidgets('shows quick ceremony label text', (tester) async {
      await tester.pumpWidget(buildTestWidget(award: 'Star of the Show'));
      await tester.pump();

      expect(find.text(Copy.quickCeremonyLabel), findsOneWidget);
    });

    testWidgets('widget key is quick-ceremony-display', (tester) async {
      await tester.pumpWidget(buildTestWidget(award: 'Star of the Show'));
      await tester.pump();

      expect(find.byKey(const Key('quick-ceremony-display')), findsOneWidget);
    });
  });
}

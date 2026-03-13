import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/moment_card_overlay.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  Widget buildTestOverlay({
    String award = 'Mic Drop Master',
    PartyVibe vibe = PartyVibe.general,
    String? performerName,
    String? songTitle,
    required VoidCallback onDismiss,
  }) {
    return MaterialApp(
      theme: createDJTheme(vibe: vibe),
      home: ChangeNotifierProvider<AccessibilityProvider>(
        create: (_) => AccessibilityProvider(),
        child: Scaffold(
          body: MomentCardOverlay(
            award: award,
            vibe: vibe,
            performerName: performerName,
            songTitle: songTitle,
            onDismiss: onDismiss,
          ),
        ),
      ),
    );
  }

  group('MomentCardOverlay', () {
    testWidgets('renders MomentCard', (tester) async {
      await tester.pumpWidget(buildTestOverlay(onDismiss: () {}));
      await tester.pump();

      expect(find.byKey(const Key('moment-card')), findsOneWidget);
    });

    testWidgets('shows share button with correct text', (tester) async {
      await tester.pumpWidget(buildTestOverlay(onDismiss: () {}));
      await tester.pump();

      expect(find.text(Copy.momentCardShare), findsOneWidget);
    });

    testWidgets('shows dismiss text', (tester) async {
      await tester.pumpWidget(buildTestOverlay(onDismiss: () {}));
      await tester.pump();

      expect(find.text(Copy.momentCardDismiss), findsOneWidget);
    });

    testWidgets('tapping dismiss calls onDismiss callback', (tester) async {
      bool dismissed = false;
      await tester.pumpWidget(buildTestOverlay(onDismiss: () => dismissed = true));
      await tester.pump();

      await tester.tap(find.byKey(const Key('moment-card-dismiss-btn')));
      await tester.pump();

      expect(dismissed, isTrue);
    });

    testWidgets('overlay widget key is moment-card-overlay', (tester) async {
      await tester.pumpWidget(buildTestOverlay(onDismiss: () {}));
      await tester.pump();

      expect(find.byKey(const Key('moment-card-overlay')), findsOneWidget);
    });
  });
}

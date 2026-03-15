import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/group_card_announcement_overlay.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  Widget buildOverlay({
    String announcement = 'TAG TEAM: Bob takes over at the chorus!',
    List<String> selectedDisplayNames = const ['Bob'],
    bool isSelectedForGroupCard = false,
    VoidCallback? onDismiss,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: GroupCardAnnouncementOverlay(
          announcement: announcement,
          selectedDisplayNames: selectedDisplayNames,
          isSelectedForGroupCard: isSelectedForGroupCard,
          onDismiss: onDismiss ?? () {},
        ),
      ),
    );
  }

  group('GroupCardAnnouncementOverlay', () {
    testWidgets('displays announcement text', (tester) async {
      await tester.pumpWidget(buildOverlay());
      await tester.pump();

      expect(find.text('TAG TEAM: Bob takes over at the chorus!'), findsOneWidget);
      expect(find.text(Copy.groupCardAnnouncementPrefix), findsOneWidget);
    });

    testWidgets('displays selected participant names', (tester) async {
      await tester.pumpWidget(buildOverlay(
        selectedDisplayNames: ['Bob', 'Carol'],
      ));
      await tester.pump();

      expect(find.text('Bob, Carol'), findsOneWidget);
    });

    testWidgets('auto-fades after 3 seconds', (tester) async {
      bool dismissed = false;
      await tester.pumpWidget(buildOverlay(
        onDismiss: () => dismissed = true,
      ));
      await tester.pump();

      expect(dismissed, isFalse);

      // Fade-out starts at 2.5s, animation runs for 500ms
      await tester.pump(const Duration(milliseconds: 2500));
      expect(dismissed, isFalse); // fade-out animation in progress
      await tester.pumpAndSettle();
      expect(dismissed, isTrue);
    });

    testWidgets('shows "You\'ve been selected!" when local user is selected', (tester) async {
      await tester.pumpWidget(buildOverlay(
        isSelectedForGroupCard: true,
      ));
      await tester.pump();

      expect(find.text(Copy.groupCardYouWereSelected), findsOneWidget);
    });

    testWidgets('does not show "You\'ve been selected!" when local user is NOT selected', (tester) async {
      await tester.pumpWidget(buildOverlay(
        isSelectedForGroupCard: false,
      ));
      await tester.pump();

      expect(find.text(Copy.groupCardYouWereSelected), findsNothing);
    });
  });
}

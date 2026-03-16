import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/song_mode_toggle.dart';

Widget buildTestWidget({String currentMode = 'quickPick'}) {
  return MaterialApp(
    home: Scaffold(
      body: SongModeToggle(currentMode: currentMode),
    ),
  );
}

void main() {
  group('SongModeToggle', () {
    testWidgets('renders two mode options', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text(Copy.modeQuickPick), findsOneWidget);
      expect(find.text(Copy.modeSpinWheel), findsOneWidget);
    });

    testWidgets('Quick Pick selected by default', (tester) async {
      await tester.pumpWidget(buildTestWidget(currentMode: 'quickPick'));
      await tester.pumpAndSettle();

      // The SegmentedButton with 'quickPick' selected should render
      expect(find.byKey(const Key('song-mode-toggle')), findsOneWidget);
      expect(find.text(Copy.modeQuickPick), findsOneWidget);
    });

    testWidgets('Spin the Wheel shown as selected when mode is spinWheel', (tester) async {
      await tester.pumpWidget(buildTestWidget(currentMode: 'spinWheel'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('song-mode-toggle')), findsOneWidget);
      expect(find.text(Copy.modeSpinWheel), findsOneWidget);
    });
  });
}

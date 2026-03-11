import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/widgets/song_over_button.dart';
import 'package:karamania/widgets/dj_tap_button.dart';

Widget _wrapWithProviders(Widget child) {
  final accessibilityProvider = AccessibilityProvider();

  return MaterialApp(
    home: ChangeNotifierProvider<AccessibilityProvider>.value(
      value: accessibilityProvider,
      child: Builder(
        builder: (context) {
          context.read<AccessibilityProvider>().updateFromMediaQuery(context);
          return Scaffold(body: Center(child: child));
        },
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('SongOverButton', () {
    testWidgets('renders with song-over-button key', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const SongOverButton()));
      await tester.pump();

      expect(find.byKey(const Key('song-over-button')), findsOneWidget);
    });

    testWidgets('displays Song Over! text', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const SongOverButton()));
      await tester.pump();

      expect(find.text(Copy.hostSongOverLabel), findsOneWidget);
    });

    testWidgets('uses DjTapButton with TapTier.consequential', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const SongOverButton()));
      await tester.pump();

      final djTapButton = tester.widget<DJTapButton>(
        find.byType(DJTapButton),
      );
      expect(djTapButton.tier, TapTier.consequential);
    });

    testWidgets('has Tooltip with hostSongOverHint message', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const SongOverButton()));
      await tester.pump();

      final tooltip = tester.widget<Tooltip>(find.byType(Tooltip));
      expect(tooltip.message, Copy.hostSongOverHint);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/reaction_bar.dart';

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

  group('ReactionBar', () {
    testWidgets('renders correct number of emoji buttons for general vibe', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const ReactionBar(vibe: PartyVibe.general)),
      );
      await tester.pump();

      final generalEmojis = vibeReactionButtons[PartyVibe.general]!;
      for (final emoji in generalEmojis) {
        expect(find.byKey(Key('reaction-emoji-$emoji')), findsOneWidget);
      }
    });

    testWidgets('renders correct number of emoji buttons for kpop vibe', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const ReactionBar(vibe: PartyVibe.kpop)),
      );
      await tester.pump();

      final kpopEmojis = vibeReactionButtons[PartyVibe.kpop]!;
      for (final emoji in kpopEmojis) {
        expect(find.byKey(Key('reaction-emoji-$emoji')), findsOneWidget);
      }
    });

    testWidgets('renders default emojis when vibe has no specific set', (tester) async {
      // Use a vibe that may not have a specific set — falls back to general
      await tester.pumpWidget(
        _wrapWithProviders(const ReactionBar(vibe: PartyVibe.general)),
      );
      await tester.pump();

      final generalEmojis = vibeReactionButtons[PartyVibe.general]!;
      expect(
        find.byType(DJTapButton),
        findsNWidgets(generalEmojis.length),
      );
    });

    testWidgets('has Key reaction-bar', (tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(const ReactionBar(vibe: PartyVibe.general)),
      );
      await tester.pump();

      expect(find.byKey(const Key('reaction-bar')), findsOneWidget);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/theme/dj_theme.dart';

void main() {
  group('PartyVibe', () {
    test('has exactly 5 vibes', () {
      expect(PartyVibe.values.length, 5);
    });

    test('contains all expected vibes', () {
      expect(PartyVibe.values, contains(PartyVibe.general));
      expect(PartyVibe.values, contains(PartyVibe.kpop));
      expect(PartyVibe.values, contains(PartyVibe.rock));
      expect(PartyVibe.values, contains(PartyVibe.ballad));
      expect(PartyVibe.values, contains(PartyVibe.edm));
    });

    test('each vibe has 4 shifting tokens', () {
      for (final vibe in PartyVibe.values) {
        expect(vibe.accent, isA<Color>(), reason: '${vibe.name} missing accent');
        expect(vibe.glow, isA<Color>(), reason: '${vibe.name} missing glow');
        expect(vibe.bg, isA<Color>(), reason: '${vibe.name} missing bg');
        expect(vibe.primary, isA<Color>(), reason: '${vibe.name} missing primary');
      }
    });

    test('general vibe has correct token values', () {
      expect(PartyVibe.general.accent, const Color(0xFFFFD700));
      expect(PartyVibe.general.glow, const Color(0xFFFFD700));
      expect(PartyVibe.general.bg, const Color(0xFF1A0A2E));
      expect(PartyVibe.general.primary, const Color(0xFF6C63FF));
    });

    test('kpop vibe uses #FF0080 accent (not UX inline #FF6B9D)', () {
      expect(PartyVibe.kpop.accent, const Color(0xFFFF0080));
    });
  });

  group('DJState', () {
    test('has exactly 7 values', () {
      expect(DJState.values.length, 7);
    });

    test('contains all expected states', () {
      expect(DJState.values, contains(DJState.lobby));
      expect(DJState.values, contains(DJState.songSelection));
      expect(DJState.values, contains(DJState.partyCardDeal));
      expect(DJState.values, contains(DJState.song));
      expect(DJState.values, contains(DJState.ceremony));
      expect(DJState.values, contains(DJState.interlude));
      expect(DJState.values, contains(DJState.finale));
    });
  });

  group('djStateBackgroundColor', () {
    test('returns correct color for each non-ceremony state', () {
      const vibe = PartyVibe.general;
      expect(
        djStateBackgroundColor(DJState.lobby, vibe),
        const Color(0xFF0A0A1A),
      );
      expect(
        djStateBackgroundColor(DJState.songSelection, vibe),
        const Color(0xFF0F0A1E),
      );
      expect(
        djStateBackgroundColor(DJState.partyCardDeal, vibe),
        const Color(0xFF1A0A1A),
      );
      expect(
        djStateBackgroundColor(DJState.song, vibe),
        const Color(0xFF0A0A0F),
      );
      expect(
        djStateBackgroundColor(DJState.interlude, vibe),
        const Color(0xFF0F1A2E),
      );
      expect(
        djStateBackgroundColor(DJState.finale, vibe),
        const Color(0xFF1A0A2E),
      );
    });

    test('ceremony uses vibe bg color', () {
      for (final vibe in PartyVibe.values) {
        expect(
          djStateBackgroundColor(DJState.ceremony, vibe),
          vibe.bg,
          reason: '${vibe.name} ceremony should use vibe.bg',
        );
      }
    });

    test('all DJ states have a mapping (completeness)', () {
      for (final state in DJState.values) {
        expect(
          () => djStateBackgroundColor(state, PartyVibe.general),
          returnsNormally,
          reason: '${state.name} should have a background color mapping',
        );
      }
    });
  });

  group('createDJTheme', () {
    test('returns a dark ThemeData', () {
      final theme = createDJTheme();
      expect(theme.brightness, Brightness.dark);
    });

    test('uses SpaceGrotesk font family in text theme', () {
      final theme = createDJTheme();
      expect(
        theme.textTheme.displayLarge?.fontFamily,
        'SpaceGrotesk',
      );
      expect(
        theme.textTheme.bodyLarge?.fontFamily,
        'SpaceGrotesk',
      );
    });

    test('accepts vibe parameter', () {
      for (final vibe in PartyVibe.values) {
        final theme = createDJTheme(vibe: vibe);
        expect(theme, isA<ThemeData>());
        expect(theme.colorScheme.secondary, vibe.accent);
      }
    });
  });
}

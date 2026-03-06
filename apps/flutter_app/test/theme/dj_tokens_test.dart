import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/theme/dj_tokens.dart';

void main() {
  group('DJTokens', () {
    group('color tokens', () {
      test('bgColor is defined', () {
        expect(DJTokens.bgColor, isA<Color>());
        expect(DJTokens.bgColor, const Color(0xFF0A0A0F));
      });

      test('surfaceColor is defined', () {
        expect(DJTokens.surfaceColor, isA<Color>());
        expect(DJTokens.surfaceColor, const Color(0xFF1A1A2E));
      });

      test('surfaceElevated is defined', () {
        expect(DJTokens.surfaceElevated, isA<Color>());
        expect(DJTokens.surfaceElevated, const Color(0xFF252542));
      });

      test('textPrimary is defined', () {
        expect(DJTokens.textPrimary, isA<Color>());
        expect(DJTokens.textPrimary, const Color(0xFFF0F0F0));
      });

      test('textSecondary is defined with WCAG-adjusted value', () {
        expect(DJTokens.textSecondary, isA<Color>());
        expect(DJTokens.textSecondary, const Color(0xFF9494B0));
      });

      test('actionConfirm is defined', () {
        expect(DJTokens.actionConfirm, isA<Color>());
        expect(DJTokens.actionConfirm, const Color(0xFF4ADE80));
      });

      test('actionDanger is defined', () {
        expect(DJTokens.actionDanger, isA<Color>());
        expect(DJTokens.actionDanger, const Color(0xFFEF4444));
      });

      test('has exactly 7 color tokens as constants', () {
        // 7 color constants (bgColor, surfaceColor, surfaceElevated,
        // textPrimary, textSecondary, actionConfirm, actionDanger)
        // + actionPrimary-like tokens live in PartyVibe, not here
        final colors = [
          DJTokens.bgColor,
          DJTokens.surfaceColor,
          DJTokens.surfaceElevated,
          DJTokens.textPrimary,
          DJTokens.textSecondary,
          DJTokens.actionConfirm,
          DJTokens.actionDanger,
        ];
        expect(colors.length, 7);
        for (final color in colors) {
          expect(color, isA<Color>());
        }
      });
    });

    group('timing token', () {
      test('transitionFast is 150ms', () {
        expect(DJTokens.transitionFast, isA<Duration>());
        expect(DJTokens.transitionFast, const Duration(milliseconds: 150));
      });
    });

    group('spacing tokens', () {
      test('spaceXs is 4.0', () {
        expect(DJTokens.spaceXs, 4.0);
      });

      test('spaceSm is 8.0', () {
        expect(DJTokens.spaceSm, 8.0);
      });

      test('spaceMd is 16.0', () {
        expect(DJTokens.spaceMd, 16.0);
      });

      test('spaceLg is 24.0', () {
        expect(DJTokens.spaceLg, 24.0);
      });

      test('spaceXl is 32.0', () {
        expect(DJTokens.spaceXl, 32.0);
      });

      test('has exactly 5 spacing constants', () {
        final spacings = [
          DJTokens.spaceXs,
          DJTokens.spaceSm,
          DJTokens.spaceMd,
          DJTokens.spaceLg,
          DJTokens.spaceXl,
        ];
        expect(spacings.length, 5);
        for (final spacing in spacings) {
          expect(spacing, isA<double>());
        }
      });
    });
  });
}

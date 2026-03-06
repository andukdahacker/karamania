import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';

/// Compute relative luminance per WCAG 2.0 formula.
double _relativeLuminance(Color color) {
  double linearize(double s) {
    return s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  }

  final r = linearize(color.r);
  final g = linearize(color.g);
  final b = linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// Compute contrast ratio between two colors per WCAG 2.0.
double _contrastRatio(Color color1, Color color2) {
  final l1 = _relativeLuminance(color1);
  final l2 = _relativeLuminance(color2);
  final bright = math.max(l1, l2);
  final dark = math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

void main() {
  group('WCAG AA Contrast Ratios - Constant Tokens', () {
    test('textPrimary on bgColor passes AA (>4.5:1)', () {
      final ratio = _contrastRatio(DJTokens.textPrimary, DJTokens.bgColor);
      expect(ratio, greaterThan(4.5),
          reason: 'textPrimary on bgColor: ratio=$ratio');
    });

    test('textPrimary on surfaceColor passes AA (>4.5:1)', () {
      final ratio =
          _contrastRatio(DJTokens.textPrimary, DJTokens.surfaceColor);
      expect(ratio, greaterThan(4.5),
          reason: 'textPrimary on surfaceColor: ratio=$ratio');
    });

    test('textPrimary on surfaceElevated passes AA (>4.5:1)', () {
      final ratio =
          _contrastRatio(DJTokens.textPrimary, DJTokens.surfaceElevated);
      expect(ratio, greaterThan(4.5),
          reason: 'textPrimary on surfaceElevated: ratio=$ratio');
    });

    test('textSecondary on surfaceColor passes AA (>4.5:1)', () {
      final ratio =
          _contrastRatio(DJTokens.textSecondary, DJTokens.surfaceColor);
      expect(ratio, greaterThan(4.5),
          reason: 'textSecondary (#9494B0) on surfaceColor: ratio=$ratio');
    });

    test('actionConfirm on bgColor passes AA large text (>3:1)', () {
      final ratio = _contrastRatio(DJTokens.actionConfirm, DJTokens.bgColor);
      expect(ratio, greaterThan(3.0),
          reason: 'actionConfirm on bgColor: ratio=$ratio');
    });

    test('actionDanger on bgColor passes AA large text (>3:1)', () {
      final ratio = _contrastRatio(DJTokens.actionDanger, DJTokens.bgColor);
      expect(ratio, greaterThan(3.0),
          reason: 'actionDanger on bgColor: ratio=$ratio');
    });
  });

  group('WCAG AA Contrast Ratios - Vibe Accent on Ceremony BG', () {
    for (final vibe in PartyVibe.values) {
      test('${vibe.name} accent on ceremony bg passes AA (>4.5:1)', () {
        final ratio = _contrastRatio(vibe.accent, vibe.bg);
        expect(ratio, greaterThan(4.5),
            reason: '${vibe.name} accent on bg: ratio=$ratio');
      });
    }
  });
}

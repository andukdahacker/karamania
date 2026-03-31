import 'package:flutter/material.dart';

/// DJTokens provides constant design tokens for the Karamania app.
/// Vibe-shifting tokens (textAccent, actionPrimary, ceremonyGlow, ceremonyBg)
/// are NOT here — access them via PartyVibe enum in dj_theme.dart.
class DJTokens {
  DJTokens._();

  // Surfaces
  static const Color bgColor = Color(0xFF0A0A0F);
  static const Color surfaceColor = Color(0xFF1A1A2E);
  static const Color surfaceElevated = Color(0xFF252542);

  // Text
  static const Color textPrimary = Color(0xFFF0F0F0);
  static const Color textSecondary = Color(0xFF9494B0);

  // Brand
  static const Color gold = Color(0xFFFFD700);

  // Interactive
  static const Color actionPrimary = Color(0xFF6C63FF);
  static const Color actionConfirm = Color(0xFF4ADE80);
  static const Color actionDanger = Color(0xFFEF4444);

  // Timing
  static const Duration transitionFast = Duration(milliseconds: 150);

  // Icon / emoji sizes
  static const double iconSizeLg = 48.0;
  static const double iconSizeXl = 64.0;

  // Spacing
  static const double spaceXs = 4.0;
  static const double spaceSm = 8.0;
  static const double spaceMd = 16.0;
  static const double spaceLg = 24.0;
  static const double spaceXl = 32.0;
}

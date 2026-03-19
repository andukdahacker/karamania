import 'package:flutter/material.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// 5 party vibes with 4 shifting tokens each.
enum PartyVibe {
  general(
    accent: Color(0xFFFFD700),
    glow: Color(0xFFFFD700),
    bg: Color(0xFF1A0A2E),
    primary: Color(0xFF6C63FF),
  ),
  kpop(
    accent: Color(0xFFFF0080),
    glow: Color(0xFFFF69B4),
    bg: Color(0xFF1A0A20),
    primary: Color(0xFFCC00FF),
  ),
  rock(
    accent: Color(0xFFFF4444),
    glow: Color(0xFFFF6600),
    bg: Color(0xFF1A0A0A),
    primary: Color(0xFFCC4422),
  ),
  ballad(
    accent: Color(0xFFFF9966),
    glow: Color(0xFFFFCC88),
    bg: Color(0xFF1A1210),
    primary: Color(0xFFCC8866),
  ),
  edm(
    accent: Color(0xFF00FFC8),
    glow: Color(0xFF00C8FF),
    bg: Color(0xFF0A1A1A),
    primary: Color(0xFF00C8FF),
  );

  const PartyVibe({
    required this.accent,
    required this.glow,
    required this.bg,
    required this.primary,
  });

  final Color accent;
  final Color glow;
  final Color bg;
  final Color primary;
}

/// DJ engine states matching server-side state machine.
enum DJState {
  lobby,
  icebreaker,
  songSelection,
  partyCardDeal,
  song,
  ceremony,
  interlude,
  finale,
}

/// DJ state-to-background-color mapping.
/// Ceremony uses vibe.bg; all others are fixed.
Color djStateBackgroundColor(DJState state, PartyVibe vibe) {
  switch (state) {
    case DJState.lobby:
      return const Color(0xFF0A0A1A);
    case DJState.icebreaker:
      return const Color(0xFF0F0A1E); // Same as songSelection — pre-game vibe
    case DJState.songSelection:
      return const Color(0xFF0F0A1E);
    case DJState.partyCardDeal:
      return const Color(0xFF1A0A1A);
    case DJState.song:
      return const Color(0xFF0A0A0F);
    case DJState.ceremony:
      return vibe.bg;
    case DJState.interlude:
      return const Color(0xFF0F1A2E);
    case DJState.finale:
      return const Color(0xFF1A0A2E);
  }
}

/// Creates the app ThemeData using DJTokens + vibe palette.
ThemeData createDJTheme({PartyVibe vibe = PartyVibe.general}) {
  const textTheme = TextTheme(
    displayLarge: TextStyle(
      fontFamily: 'SpaceGrotesk',
      fontSize: 32,
      fontWeight: FontWeight.w700,
      color: DJTokens.textPrimary,
    ),
    titleLarge: TextStyle(
      fontFamily: 'SpaceGrotesk',
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: DJTokens.textPrimary,
    ),
    titleMedium: TextStyle(
      fontFamily: 'SpaceGrotesk',
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: DJTokens.textPrimary,
    ),
    bodyLarge: TextStyle(
      fontFamily: 'SpaceGrotesk',
      fontSize: 16,
      fontWeight: FontWeight.w400,
      color: DJTokens.textPrimary,
    ),
    bodySmall: TextStyle(
      fontFamily: 'SpaceGrotesk',
      fontSize: 12,
      fontWeight: FontWeight.w400,
      color: DJTokens.textSecondary,
    ),
    labelLarge: TextStyle(
      fontFamily: 'SpaceGrotesk',
      fontSize: 16,
      fontWeight: FontWeight.w700,
      color: DJTokens.textPrimary,
    ),
  );

  return ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: DJTokens.bgColor,
    colorScheme: ColorScheme.dark(
      surface: DJTokens.surfaceColor,
      primary: vibe.primary,
      secondary: vibe.accent,
      error: DJTokens.actionDanger,
    ),
    textTheme: textTheme,
    fontFamily: 'SpaceGrotesk',
  );
}

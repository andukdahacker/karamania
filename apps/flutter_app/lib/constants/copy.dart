import 'package:karamania/theme/dj_theme.dart';

/// Vibe-keyed confetti emoji pools.
const Map<PartyVibe, List<String>> vibeConfettiEmojis = {
  PartyVibe.general: ['🎉', '✨', '🌟', '🎊'],
  PartyVibe.kpop: ['💖', '💜', '✨'],
  PartyVibe.rock: ['🔥', '⚡'],
  PartyVibe.ballad: ['✨', '🌟'],
  PartyVibe.edm: ['💎', '✨'],
};

/// Vibe-keyed reaction button sets.
const Map<PartyVibe, List<String>> vibeReactionButtons = {
  PartyVibe.general: ['🔥', '👏', '😂', '💀'],
  PartyVibe.kpop: ['🔥', '👏', '😍', '💀'],
  PartyVibe.rock: ['🔥', '🤘', '😂', '💀'],
  PartyVibe.ballad: ['❤️', '😭', '👏', '🥹'],
  PartyVibe.edm: ['🔥', '👏', '🎧', '💀'],
};

/// Vibe-keyed award copy flavors.
const Map<PartyVibe, String> vibeAwardFlavors = {
  PartyVibe.general: 'Absolute showstopper',
  PartyVibe.kpop: 'Main vocal energy',
  PartyVibe.rock: 'Shredded the vocals',
  PartyVibe.ballad: 'Hit us right in the feels',
  PartyVibe.edm: 'Dropped the vocals hard',
};

/// Home screen
class Copy {
  Copy._();

  static const String appTitle = 'KARAMANIA';
  static const String createParty = 'CREATE PARTY';
  static const String joinParty = 'JOIN PARTY';
  static const String enterYourName = 'Enter your name';
  static const String guestSignInPrompt =
      'Create an account to save your session history';
  static const String signIn = 'Sign in';
  static const String yourSessions = 'Your Sessions';
  static const String noSessionsYet = 'Your past parties will appear here';

  // Lobby screen
  static const String partyLobby = 'PARTY LOBBY';
  static const String partyCodeLabel = 'CODE';
  static const String pickYourVibe = 'Pick your vibe';
  static const String pairWithTv = 'Pair with YouTube TV';
  static const String skipNoTv = 'Skip — no TV';
  static const String waitingForGuests = 'Waiting for guests...';
  static const String startParty = 'START PARTY';
  static const String joined = 'joined';
  static const String shareParty = 'Share';
  static const String sharePartyMessage = 'Join my Karamania party! Code: ';

  // Join screen
  static const String enterPartyCode = 'Enter party code';
  static const String joinFlowComingSoon = 'Join flow coming in the next update!';
  static const String backToHome = 'Back to home';

  // Dialogs
  static const String cancel = 'CANCEL';
  static const String ok = 'OK';
  static const String createPartyError = 'Failed to create party';
}

/// Vibe emoji labels.
const Map<PartyVibe, String> vibeEmojiLabels = {
  PartyVibe.general: '🎤',
  PartyVibe.kpop: '💖',
  PartyVibe.rock: '🎸',
  PartyVibe.ballad: '🎵',
  PartyVibe.edm: '🎧',
};

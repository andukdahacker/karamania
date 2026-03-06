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

/// Vibe emoji labels.
const Map<PartyVibe, String> vibeEmojiLabels = {
  PartyVibe.general: '🎤',
  PartyVibe.kpop: '💖',
  PartyVibe.rock: '🎸',
  PartyVibe.ballad: '🎵',
  PartyVibe.edm: '🎧',
};

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
  static const String backToHome = 'Back to home';

  // Join flow
  static const String joiningParty = 'Joining party...';
  static const String partyNotFound = 'No active party with that code';
  static const String partyIsFull = 'This party is full. Maximum 12 participants.';
  static const String joinFailed = 'Failed to join party. Please try again.';
  static const String bestWith3Plus = 'Works best with 3+ friends!';

  // Participant list
  static const String participants = 'Participants';

  // Party start
  static const String needMorePlayers = 'Need';
  static const String more = 'more to start';
  static const String partyInProgress = 'PARTY IN PROGRESS';

  // DJ state labels
  static const String djStateLobby = 'Lobby';
  static const String djStateSongSelection = 'Song Selection';
  static const String djStatePartyCardDeal = 'Party Card Deal';
  static const String djStateSong = 'Song';
  static const String djStateCeremony = 'Ceremony';
  static const String djStateInterlude = 'Interlude';
  static const String djStateFinale = 'Finale';

  static String djStateLabel(DJState state) {
    switch (state) {
      case DJState.lobby:
        return djStateLobby;
      case DJState.songSelection:
        return djStateSongSelection;
      case DJState.partyCardDeal:
        return djStatePartyCardDeal;
      case DJState.song:
        return djStateSong;
      case DJState.ceremony:
        return djStateCeremony;
      case DJState.interlude:
        return djStateInterlude;
      case DJState.finale:
        return djStateFinale;
    }
  }

  // Catch-up (mid-session join)
  static const String welcomeToParty = 'Welcome to the party!';
  static const String areHere = 'are here';
  static const String tapToDismiss = 'Tap anywhere to continue';
  static const String vibeLabel = 'Vibe';

  // Connection status
  static const String reconnecting = 'Reconnecting...';
  static const String hostTransferred = 'You are now the host!';

  // Invite sheet
  static const String inviteMoreFriends = 'Invite More Friends';
  static const String shareInvite = 'Share Invite';
  static const String joinMyParty = 'Join my Karamania party!';

  static String vibeEmoji(PartyVibe vibe) => vibeEmojiLabels[vibe] ?? '';

  // Host controls
  static const String hostControlInvite = 'Invite';
  static const String hostControlSkip = 'Skip';
  static const String hostControlOverride = 'Override Next';
  static const String hostControlPause = 'Pause';
  static const String hostControlEndParty = 'End Party';
  static const String hostControlKickPlayer = 'Kick Player';
  static const String hostControlEndPartyConfirmTitle = 'End Party?';
  static const String hostControlEndPartyConfirmBody =
      'This will end the party for everyone. Are you sure?';
  static const String hostControlEndPartyConfirmYes = 'END PARTY';
  static const String hostControlEndPartyConfirmNo = 'CANCEL';
  static const String hostKickedMessage = 'You have been removed from the party';
  static const String hostSongOverLabel = 'Song Over!';
  static const String hostSongOverHint = 'Hold to end song';

  // Bridge moments
  static const String bridgeGetReady = 'Get Ready!';
  static const String bridgeWhosNext = "Who's up next?";
  static const String bridgeUpNext = 'Up Next';
  static const String bridgeLetsGo = "Let's Go!";

  // Pause state
  static const String pausedLabel = 'Paused';
  static const String pausedDuring = 'Paused during';
  static const String hostControlResume = 'Resume';

  // Ceremony
  static const String ceremonyAnticipation = 'And the award goes to...';
  static const String defaultAward = 'Star of the Show';
  static const String quickCeremonyLabel = 'Quick Award';

  // Moment card
  static const String momentCardShare = 'Share Moment';
  static const String momentCardDismiss = 'Tap to dismiss';

  // Party card copy
  static const String partyCardTitle = 'Your Challenge';
  static const String partyCardTypeVocal = 'Vocal Modifier';
  static const String partyCardTypePerformance = 'Performance Modifier';
  static const String partyCardTypeGroup = 'Group Involvement';
  static const String hostControlRedealCard = 'Re-deal Card';

  // Streak milestones — personalized per UX spec (Critical Success Moment #3)
  static String streakMilestone(String displayName, int count) {
    switch (count) {
      case 5:
        return '$displayName is heating up!';
      case 10:
        return '$displayName IS ON FIRE!';
      case 20:
        return '$displayName is UNSTOPPABLE!';
      case 50:
        return '$displayName is LEGENDARY!';
      default:
        return '$count Streak!';
    }
  }

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

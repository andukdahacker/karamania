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
  static const String appTagline = 'Your karaoke party starts here';
  static const String createParty = 'CREATE PARTY';
  static const String joinParty = 'JOIN PARTY';
  static const String enterYourName = 'Enter your name';
  static const String guestSignInPrompt =
      'Create an account to save your session history';
  static const String signIn = 'Sign in with Google';
  static const String signOut = 'Sign Out';
  static const String defaultUserName = 'User';
  static const String yourSessions = 'Your Sessions';
  static const String noSessionsYet = 'Your past parties will appear here';
  static const String emptySessionEncouragement = 'Time to make some memories!';
  static const String karaokeNight = 'Karaoke Night';
  static const String participantCount = 'participants';
  static const String loadingMore = 'Loading more sessions...';
  static const String loadSessionsError = 'Could not load sessions. Tap to retry.';

  // Lobby screen
  static const String partyLobby = 'PARTY LOBBY';
  static const String partyCodeLabel = 'CODE';
  static const String pickYourVibe = 'Pick your vibe';
  static const String pairWithTv = 'Pair with YouTube TV';
  static const String skipNoTv = 'Skip - no TV';
  static const String waitingForGuests = 'Waiting for guests...';
  static const String startParty = 'START PARTY';
  static const String leaveParty = 'Leave party';
  static const String leavePartyConfirmTitle = 'Leave Party?';
  static const String leavePartyConfirmBody = 'Are you sure you want to leave the party?';
  static const String leavePartyConfirmYes = 'LEAVE';
  static const String leavePartyConfirmNo = 'STAY';
  static const String joined = 'joined';
  static const String shareParty = 'Share';
  static const String sharePartyMessage = 'Join my Karamania party! Code: ';

  // Join screen
  static const String partyCodeHint = 'Ask your host for the 4-letter code';

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
  static const String djStateIcebreaker = 'Icebreaker';
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
      case DJState.icebreaker:
        return djStateIcebreaker;
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
  static const String cardAcceptLabel = 'Accept';
  static const String cardDismissLabel = 'Dismiss';
  static const String cardRedrawLabel = 'Redraw';
  static const String cardChallengeIncoming = 'CHALLENGE INCOMING...';
  static const String cardWaitingForSinger = 'Waiting for singer...';

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

  // Group card copy
  static const String groupCardAnnouncementPrefix = 'GROUP CHALLENGE';
  static const String groupCardYouWereSelected = "You've been selected!";
  static const String tagTeamYourTurn = 'YOUR TURN!';

  // Lightstick & Hype
  static const String lightstickToggle = 'Lightstick';
  static const String lightstickExitHint = 'Tap anywhere to exit';
  static const String hypeSignalButton = 'Hype';
  static const String hypeSignalCooldown = 'Recharging...';

  // Lobby — guest waiting
  static const String waitingForHost = 'Waiting for host to start...';
  static const String addSongManually = 'Add song manually';
  static const String songsImported = 'songs imported';
  static const String matchedToCatalog = 'matched to catalog';
  static const String unknownTrackTitle = 'Unknown';
  static const String unknownTrackArtist = 'Unknown Artist';
  static const String manualSongTitle = 'Song title';
  static const String manualSongArtist = 'Artist (optional)';
  static const String addSong = 'Add';

  // Playlist import
  static const String playlistImportTitle = 'Import Playlist';
  static const String playlistImportHint = 'Paste YouTube Music or Spotify playlist URL';
  static const String playlistImportDetected = 'YouTube Music playlist detected';
  static const String playlistImportDetectedSpotify = 'Spotify playlist detected';

  // Spotify guide
  static const String spotifyGuideTitle = 'This playlist is private';
  static const String spotifyGuideStep1 = 'Open your Spotify app';
  static const String spotifyGuideStep2 = 'Tap ••• on your playlist \u2192 Make Public';
  static const String spotifyGuideStep3 = 'Come back and paste the link again';
  static const String spotifyGuideRetry = 'Try Again';
  static const String playlistImportButton = 'Import';
  static const String playlistImportLoading = 'Importing playlist...';
  static const String playlistImportRetry = 'Retry';
  static const String playlistImportFailed = 'Import failed. Please try again.';
  static String playlistImportResults(int imported, int matched, int unmatched) =>
      '$imported tracks imported, $matched matched to catalog, $unmatched unmatched';

  // Quick Pick
  static const String quickPickTitle = 'Quick Pick';
  static const String quickPickVoteUp = 'Love It';
  static const String quickPickSkip = 'Skip';
  static const String quickPickSelected = 'Selected!';
  static const String quickPickDeciding = 'Deciding...';
  static const String quickPickOverlapBadge = 'know this';

  // Spin the Wheel
  static const String spinTheWheelTitle = 'Spin the Wheel';
  static const String spinButtonLabel = 'SPIN';
  static const String spinSpinningLabel = 'Spinning...';
  static const String spinLandedLabel = 'Landed!';
  static const String spinVetoLabel = 'VETO!';
  static const String spinVetoedLabel = 'Vetoed! Re-spinning...';
  static const String spinSelectedLabel = 'Selected!';
  static const String spinAutoSpinLabel = 'Auto-spinning...';
  static const String spinWaitingLabel = 'Tap to spin!';

  // TV Pairing
  static const String tvPairingTitle = 'Pair with YouTube TV';
  static const String tvPairingInstructions =
      'Enter the code shown on your YouTube TV screen';
  static const String tvPairingPlaceholder = 'TV Code';
  static const String tvPairingConnect = 'Connect';
  static const String tvConnected = 'Connected to TV';
  static const String tvReconnecting = 'Reconnecting to TV...';
  static const String tvDisconnected = 'TV disconnected';
  static const String tvReconnectFailed =
      'Could not reconnect. Please re-enter the TV code.';
  static const String tvUnpair = 'Disconnect TV';

  // Song info display
  static const String isSinging = 'is singing';
  static const String song = 'Song';

  // Now Playing
  static const String nowPlaying = 'Now Playing';
  static const String unknownSong = 'Unknown Song';
  static const String unknownArtist = 'Unknown Artist';

  // Suggestion-only mode
  static const String upNext = 'Up Next';
  static const String enterOnKaraokeMachine = 'Enter this on the karaoke machine';
  static const String markAsPlaying = 'Mark as Playing';
  static const String songMarkedPlaying = 'Marked as Playing';
  static const String tvDisconnectedSuggestionMode =
      'TV disconnected. Continuing in suggestion-only mode.';
  static const String dismiss = 'Dismiss';

  // Mode toggle
  static const String modeQuickPick = 'Quick Pick';
  static const String modeSpinWheel = 'Spin the Wheel';

  // Capture bubble (Story 6.1)
  static const String captureMoment = 'Capture this moment!';

  // Capture mode selector (Story 6.2)
  static const String capturePhoto = 'Photo';
  static const String captureVideo = 'Video';
  static const String captureAudio = 'Audio';
  static const String captureManual = 'Capture a moment';
  static const String captureRecording = 'Recording...';
  static const String captureRecordingStop = 'Tap to stop';

  // Upload status (Story 6.3)
  static const String captureUploading = 'Uploading captures';
  static const String captureUploadComplete = 'Upload complete';
  static const String captureUploadFailed = 'Upload failed';

  // Interlude voting (Story 7.1)
  static const String interludeVotingTitle = "What's Next?";
  static const String interludeVotingSubtitle = 'Vote for the next activity!';
  static const String interludeVoteSelected = 'Selected!';
  static const String interludeVotesLabel = 'votes';

  // Kings Cup interlude (Story 7.2)
  static const String kingsCupSubtitle = 'Group Rule';

  // Dare Pull interlude (Story 7.3)
  static const String darePullSubtitle = 'Dare Challenge';
  static const String darePullTargetPrefix = 'The dare goes to...';

  // Quick Vote interlude (Story 7.4)
  static const String quickVoteTitle = 'QUICK VOTE';
  static const String quickVoteSubtitle = 'Cast your vote!';

  // Group Sing-Along interlude (Story 7.5)
  static const String singAlongSubtitle = 'EVERYONE SING!';

  // Icebreaker (Story 7.6)
  static const String icebreakerSubtitle = 'FIRST QUESTION';
  static const String icebreakerWaiting = 'Waiting for everyone...';
  static const String icebreakerNote = 'Everyone answers. Results revealed together.';

  // Finale (Story 8.2)
  static const String finaleAwardsTitle = 'AWARDS';
  static const String finaleStatsTitle = 'TONIGHT IN NUMBERS';
  static const String finaleSetlistTitle = 'THE SETLIST';
  static const String finaleFeedbackTitle = 'Would you use Karamania next time?';
  static const String finaleFeedbackThanks = 'Thanks!';
  static const String finaleLeaveParty = 'Leave Party';
  static const String finaleSongsLabel = 'Songs';
  static const String finaleReactionsLabel = 'Reactions';
  static const String finaleParticipantsLabel = 'People';
  static const String finaleDurationLabel = 'Duration';
  static const String finaleSoundboardLabel = 'Sounds';
  static const String finaleCardsLabel = 'Cards';
  static const String finaleTopReactorLabel = 'Top Reactor';
  static const String finaleLongestStreakLabel = 'Longest Streak';
  static const String finaleShareButton = 'Share Poster';
  static String finaleShareText(String date, List<String> songs) =>
      'Karamania Night - $date\n${songs.join('\n')}';

  // Setlist Poster (Story 8.3)
  static const String setlistPosterNoSongs = 'No songs tonight';
  static const String setlistPosterHoldForTextShare = 'Hold for text share';
  static const String setlistPosterByArtist = 'by';

  // Guest-to-account upgrade (Story 9.2)
  static const String upgradePrompt = 'Sign in to save your stats';
  static const String upgradeButton = 'Sign In';
  static const String upgradeSuccess = 'Account created! Your session data is saved.';
  static const String upgradeFailed = 'Sign in failed. Try again later.';

  // Session Detail Screen (Story 9.4)
  static const String sessionDetail = 'Session Detail';
  static const String setlist = 'Setlist';
  static const String awards = 'Awards';
  static const String mediaGallery = 'Gallery';
  static const String setlistPoster = 'Setlist Poster';
  static const String sessionDuration = 'Duration';
  static const String songs = 'songs';
  static const String reactions = 'reactions';
  static const String loadDetailError = 'Could not load session details. Tap to retry.';
  static const String sessionNotFound = 'Session not found';
  static const String shareSession = 'Share Session';
  static const String letsGoAgain = "Let's go again!";

  // Session Sharing (Story 9.5)
  static String shareSessionMessage({String? venueName, required String url}) {
    final venue = venueName ?? karaokeNight;
    return 'Check out our $venue session on Karamania! $url';
  }

  static String letsGoAgainMessage({String? venueName, required String downloadUrl}) {
    final venue = venueName ?? 'karaoke';
    final now = DateTime.now();
    final daysUntilSaturday = (DateTime.saturday - now.weekday) % 7;
    final nextSaturday = now.add(Duration(days: daysUntilSaturday == 0 ? 7 : daysUntilSaturday));
    final dateStr = '${nextSaturday.month}/${nextSaturday.day}';
    return '$venue was amazing! Let\'s do it again on $dateStr. Get Karamania: $downloadUrl';
  }

  // Dialogs
  static const String cancel = 'CANCEL';
  static const String ok = 'OK';
  static const String createPartyError = 'Failed to create party';

  // Media Gallery (Story 9.6)
  static const String myMedia = 'My Media';
  static const String loadMediaError = 'Could not load media. Tap to retry.';
  static const String noMediaYet = 'No captured media yet. Start a party to create memories!';
}

/// Vibe emoji labels.
const Map<PartyVibe, String> vibeEmojiLabels = {
  PartyVibe.general: '🎤',
  PartyVibe.kpop: '💖',
  PartyVibe.rock: '🎸',
  PartyVibe.ballad: '🎵',
  PartyVibe.edm: '🎧',
};

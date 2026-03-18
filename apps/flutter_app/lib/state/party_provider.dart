import 'dart:async' show Timer;
import 'dart:math' show Random;
import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

enum ConnectionStatus { connected, reconnecting }

enum TvConnectionStatus { disconnected, connecting, connected, reconnecting }

class QuickPickSong {
  const QuickPickSong({
    required this.catalogTrackId,
    required this.songTitle,
    required this.artist,
    required this.youtubeVideoId,
    required this.overlapCount,
  });

  final String catalogTrackId;
  final String songTitle;
  final String artist;
  final String youtubeVideoId;
  final int overlapCount;

  factory QuickPickSong.fromJson(Map<String, dynamic> json) {
    return QuickPickSong(
      catalogTrackId: json['catalogTrackId'] as String,
      songTitle: json['songTitle'] as String,
      artist: json['artist'] as String,
      youtubeVideoId: json['youtubeVideoId'] as String,
      overlapCount: json['overlapCount'] as int,
    );
  }
}

class VoteTally {
  const VoteTally({required this.up, required this.skip});

  final int up;
  final int skip;

  factory VoteTally.fromJson(Map<String, dynamic> json) {
    return VoteTally(
      up: json['up'] as int,
      skip: json['skip'] as int,
    );
  }
}

class SpinWheelSegment {
  const SpinWheelSegment({
    required this.catalogTrackId,
    required this.songTitle,
    required this.artist,
    required this.youtubeVideoId,
    required this.overlapCount,
    required this.segmentIndex,
  });

  final String catalogTrackId;
  final String songTitle;
  final String artist;
  final String youtubeVideoId;
  final int overlapCount;
  final int segmentIndex;

  factory SpinWheelSegment.fromJson(Map<String, dynamic> json) {
    return SpinWheelSegment(
      catalogTrackId: json['catalogTrackId'] as String,
      songTitle: json['songTitle'] as String,
      artist: json['artist'] as String,
      youtubeVideoId: json['youtubeVideoId'] as String,
      overlapCount: json['overlapCount'] as int,
      segmentIndex: json['segmentIndex'] as int,
    );
  }
}

class InterludeGameCard {
  const InterludeGameCard({
    required this.id,
    required this.title,
    required this.rule,
    required this.emoji,
  });

  final String id;
  final String title;
  final String rule;
  final String emoji;

  factory InterludeGameCard.fromJson(Map<String, dynamic> json) {
    return InterludeGameCard(
      id: (json['id'] as String?) ?? '',
      title: (json['title'] as String?) ?? '',
      rule: (json['rule'] as String?) ?? '',
      emoji: (json['emoji'] as String?) ?? '',
    );
  }
}

class InterludeOption {
  const InterludeOption({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
  });

  final String id;
  final String name;
  final String description;
  final String icon;

  factory InterludeOption.fromJson(Map<String, dynamic> json) {
    return InterludeOption(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String,
    );
  }
}

class ReactionEvent {
  const ReactionEvent({
    required this.id,
    required this.userId,
    required this.emoji,
    required this.rewardMultiplier,
    required this.timestamp,
    required this.startX,
  });

  final int id;
  final String userId;
  final String emoji;
  final double rewardMultiplier;
  final int timestamp;
  final double startX;
}

class ParticipantInfo {
  const ParticipantInfo({
    required this.userId,
    required this.displayName,
    this.isOnline = true,
  });
  final String userId;
  final String displayName;
  final bool isOnline;
}

/// Reactive state container only — no business logic.
class PartyProvider extends ChangeNotifier {
  PartyProvider({void Function(bool enable)? wakelockToggle})
      : _wakelockToggle = wakelockToggle ??
            ((enable) => enable ? WakelockPlus.enable() : WakelockPlus.disable());

  final void Function(bool enable) _wakelockToggle;

  String? _localUserId;
  DJState _djState = DJState.lobby;
  PartyVibe _vibe = PartyVibe.general;
  String? _sessionId;
  String? _partyCode;
  bool _isHost = false;
  LoadingState _createPartyLoading = LoadingState.idle;
  LoadingState _joinPartyLoading = LoadingState.idle;
  LoadingState _startPartyLoading = LoadingState.idle;
  int _participantCount = 0;
  int _songCount = 0;
  String? _currentPerformer;
  int? _timerStartedAt;
  int? _timerDurationMs;
  bool _wakelockEnabled = false;
  List<ParticipantInfo> _participants = [];
  String _sessionStatus = 'lobby';
  bool _isCatchingUp = false;
  bool _pendingCatchUp = false;
  ConnectionStatus _connectionStatus = ConnectionStatus.connected;
  bool _hostTransferPending = false;
  String? _kickedMessage;
  bool _isPaused = false;
  String? _pausedFromState;
  String? _ceremonyType;

  // Ceremony state — populated by ceremony:anticipation and ceremony:reveal events
  String? _ceremonyPerformerName;
  int? _ceremonyRevealAt;
  String? _ceremonyAward;
  String? _ceremonyTone;
  String? _ceremonySongTitle;
  bool _showMomentCard = false;
  Timer? _momentCardTimer;

  // Party card state — populated by card:dealt event
  PartyCardData? _currentCard;
  bool _redrawUsed = false;
  String? _acceptedCardTitle;
  String? _acceptedCardType;

  // Group card state — populated by card:groupActivated event
  String? _groupCardAnnouncement;
  List<String> _groupCardSelectedUserIds = [];
  List<String> _groupCardSelectedDisplayNames = [];
  bool _isSelectedForGroupCard = false;
  bool _isTagTeamPartner = false;
  bool _showTagTeamFlash = false;

  // Playlist import state
  LoadingState _playlistImportState = LoadingState.idle;
  List<Map<String, dynamic>> _importedTracks = [];
  List<Map<String, dynamic>> _matchedTracks = [];
  int _unmatchedCount = 0;

  // Quick Pick state — populated by quickpick:started event
  List<QuickPickSong> _quickPickSongs = [];
  Map<String, VoteTally> _quickPickVotes = {};
  String? _quickPickWinnerId;
  Map<String, String> _myQuickPickVotes = {};
  int _quickPickParticipantCount = 0;
  int _quickPickTimerDurationMs = 15000;

  // Spin the Wheel state
  List<SpinWheelSegment> _spinWheelSegments = [];
  String? _spinWheelPhase; // 'waiting' | 'spinning' | 'landed' | 'vetoing' | 'selected' | null
  int? _spinWheelTargetIndex;
  double? _spinWheelTotalRotation;
  int _spinWheelSpinDurationMs = 4000;
  String? _spinWheelSpinnerName;
  bool _spinWheelVetoUsed = false;
  int _spinWheelTimerDurationMs = 15000;
  int _spinWheelParticipantCount = 0;
  // Song selection mode
  String _songSelectionMode = 'quickPick'; // 'quickPick' | 'spinWheel'

  // Interlude voting state — populated by interlude:voteStarted event
  List<InterludeOption> _interludeOptions = [];
  Map<String, int> _interludeVoteCounts = {};
  String? _myInterludeVote;
  String? _interludeWinnerOptionId;
  int _interludeVoteDurationMs = 15000;

  // Interlude game state — populated by interlude:gameStarted event
  static const int _defaultGameDurationMs = 10000;
  String? _interludeGameActivityId;
  InterludeGameCard? _interludeGameCard;
  int _interludeGameDurationMs = _defaultGameDurationMs;
  int? _interludeGameStartedAt;
  String? _interludeGameTargetUserId;
  String? _interludeGameTargetDisplayName;

  // TV pairing state
  TvConnectionStatus _tvStatus = TvConnectionStatus.disconnected;
  String? _tvStatusMessage;
  String? _tvNowPlayingVideoId;
  bool _tvSkipped = false;
  LoadingState _tvPairingState = LoadingState.idle;

  // Detected song metadata (enrichment on top of existing _tvNowPlayingVideoId)
  String? _detectedSongTitle;
  String? _detectedArtist;
  String? _detectedThumbnail;
  String? _detectedSource; // 'catalog', 'api-parsed', 'api-raw', 'manual'

  // Last selected song info (populated from song:queued event)
  String? _lastQueuedSongTitle;
  String? _lastQueuedArtist;
  String? _lastQueuedVideoId;
  String? _lastQueuedCatalogTrackId;

  // TV degradation notification
  bool _tvDegraded = false;

  // Lightstick & hype state
  bool _isLightstickMode = false;
  Color _lightstickColor = const Color(0xFFFFD700); // default: vibe accent
  bool _isHypeCooldown = false;
  DateTime? _hypeCooldownEnd;

  // Reaction state
  final List<ReactionEvent> _reactionFeed = [];
  static const int _maxReactionFeedSize = 50;
  static int _reactionIdCounter = 0;
  static final Random _reactionRandom = Random();

  // Streak milestone state — displayed only to current user
  int? _streakMilestone;
  String? _streakEmoji;
  String? _streakDisplayName;

  DJState get djState => _djState;
  /// Serializable snapshot of DJ state for upload tagging.
  Map<String, dynamic>? get djStateRaw => {'state': _djState.name, 'songCount': _songCount};
  PartyVibe get vibe => _vibe;
  String? get sessionId => _sessionId;
  String? get partyCode => _partyCode;
  bool get isHost => _isHost;
  LoadingState get createPartyLoading => _createPartyLoading;
  LoadingState get joinPartyLoading => _joinPartyLoading;
  LoadingState get startPartyLoading => _startPartyLoading;
  int get participantCount => _participantCount;
  int get songCount => _songCount;
  String? get currentPerformer => _currentPerformer;
  int? get timerStartedAt => _timerStartedAt;
  int? get timerDurationMs => _timerDurationMs;
  List<ParticipantInfo> get participants => _participants;
  String get sessionStatus => _sessionStatus;
  bool get isCatchingUp => _isCatchingUp;
  bool get pendingCatchUp => _pendingCatchUp;
  ConnectionStatus get connectionStatus => _connectionStatus;
  bool get hostTransferPending => _hostTransferPending;
  String? get kickedMessage => _kickedMessage;
  bool get isPaused => _isPaused;
  String? get pausedFromState => _pausedFromState;
  String? get ceremonyType => _ceremonyType;
  String? get ceremonyPerformerName => _ceremonyPerformerName;
  int? get ceremonyRevealAt => _ceremonyRevealAt;
  String? get ceremonyAward => _ceremonyAward;
  String? get ceremonyTone => _ceremonyTone;
  String? get ceremonySongTitle => _ceremonySongTitle;
  bool get showMomentCard => _showMomentCard;
  PartyCardData? get currentCard => _currentCard;
  bool get redrawUsed => _redrawUsed;
  String? get acceptedCardTitle => _acceptedCardTitle;
  String? get acceptedCardType => _acceptedCardType;
  int? get streakMilestone => _streakMilestone;
  String? get streakEmoji => _streakEmoji;
  String? get streakDisplayName => _streakDisplayName;
  String? get groupCardAnnouncement => _groupCardAnnouncement;
  List<String> get groupCardSelectedUserIds => _groupCardSelectedUserIds;
  List<String> get groupCardSelectedDisplayNames => _groupCardSelectedDisplayNames;
  bool get isSelectedForGroupCard => _isSelectedForGroupCard;
  bool get isTagTeamPartner => _isTagTeamPartner;
  bool get showTagTeamFlash => _showTagTeamFlash;
  bool get isLightstickMode => _isLightstickMode;
  Color get lightstickColor => _lightstickColor;
  bool get isHypeCooldown => _isHypeCooldown;
  DateTime? get hypeCooldownEnd => _hypeCooldownEnd;
  LoadingState get playlistImportState => _playlistImportState;
  List<Map<String, dynamic>> get importedTracks => _importedTracks;
  List<Map<String, dynamic>> get matchedTracks => _matchedTracks;
  int get unmatchedCount => _unmatchedCount;
  List<ReactionEvent> get reactionFeed => List.unmodifiable(_reactionFeed);
  List<QuickPickSong> get quickPickSongs => _quickPickSongs;
  Map<String, VoteTally> get quickPickVotes => _quickPickVotes;
  String? get quickPickWinnerId => _quickPickWinnerId;
  Map<String, String> get myQuickPickVotes => _myQuickPickVotes;
  int get quickPickParticipantCount => _quickPickParticipantCount;
  int get quickPickTimerDurationMs => _quickPickTimerDurationMs;
  List<SpinWheelSegment> get spinWheelSegments => _spinWheelSegments;
  String? get spinWheelPhase => _spinWheelPhase;
  int? get spinWheelTargetIndex => _spinWheelTargetIndex;
  double? get spinWheelTotalRotation => _spinWheelTotalRotation;
  int get spinWheelSpinDurationMs => _spinWheelSpinDurationMs;
  String? get spinWheelSpinnerName => _spinWheelSpinnerName;
  bool get spinWheelVetoUsed => _spinWheelVetoUsed;
  int get spinWheelTimerDurationMs => _spinWheelTimerDurationMs;
  int get spinWheelParticipantCount => _spinWheelParticipantCount;
  String get songSelectionMode => _songSelectionMode;
  List<InterludeOption> get interludeOptions => _interludeOptions;
  Map<String, int> get interludeVoteCounts => _interludeVoteCounts;
  String? get myInterludeVote => _myInterludeVote;
  String? get interludeWinnerOptionId => _interludeWinnerOptionId;
  int get interludeVoteDurationMs => _interludeVoteDurationMs;
  String? get interludeGameActivityId => _interludeGameActivityId;
  InterludeGameCard? get interludeGameCard => _interludeGameCard;
  int get interludeGameDurationMs => _interludeGameDurationMs;
  int? get interludeGameStartedAt => _interludeGameStartedAt;
  String? get interludeGameTargetUserId => _interludeGameTargetUserId;
  String? get interludeGameTargetDisplayName => _interludeGameTargetDisplayName;
  TvConnectionStatus get tvStatus => _tvStatus;
  String? get tvStatusMessage => _tvStatusMessage;
  String? get tvNowPlayingVideoId => _tvNowPlayingVideoId;
  bool get isTvPaired => _tvStatus == TvConnectionStatus.connected;
  bool get tvSkipped => _tvSkipped;
  LoadingState get tvPairingState => _tvPairingState;
  String? get detectedSongTitle => _detectedSongTitle;
  String? get detectedArtist => _detectedArtist;
  String? get detectedThumbnail => _detectedThumbnail;
  String? get detectedSource => _detectedSource;
  bool get hasDetectedSong => _detectedSongTitle != null;
  String? get lastQueuedSongTitle => _lastQueuedSongTitle;
  String? get lastQueuedArtist => _lastQueuedArtist;
  String? get lastQueuedVideoId => _lastQueuedVideoId;
  String? get lastQueuedCatalogTrackId => _lastQueuedCatalogTrackId;
  bool get hasLastQueuedSong => _lastQueuedSongTitle != null;
  bool get isSuggestionOnlyMode => !isTvPaired;
  bool get tvDegraded => _tvDegraded;

  /// Whether this client is the current singer (performer).
  bool get isCurrentSinger =>
      _localUserId != null && _currentPerformer == _localUserId;

  /// Background color driven by current DJ state and vibe.
  Color get backgroundColor => djStateBackgroundColor(_djState, _vibe);

  void setLocalUserId(String userId) {
    _localUserId = userId;
  }

  void onReactionBroadcast({
    required String userId,
    required String emoji,
    required double rewardMultiplier,
  }) {
    _reactionFeed.add(ReactionEvent(
      id: _reactionIdCounter++,
      userId: userId,
      emoji: emoji,
      rewardMultiplier: rewardMultiplier,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      startX: _reactionRandom.nextDouble(),
    ));
    // Cap feed size to prevent unbounded memory growth (NFR28)
    if (_reactionFeed.length > _maxReactionFeedSize) {
      _reactionFeed.removeAt(0);
    }
    notifyListeners();
  }

  void removeReaction(int id) {
    _reactionFeed.removeWhere((e) => e.id == id);
    notifyListeners();
  }

  void onStreakMilestone({
    required int streakCount,
    required String emoji,
    required String displayName,
  }) {
    _streakMilestone = streakCount;
    _streakEmoji = emoji;
    _streakDisplayName = displayName;
    notifyListeners();
  }

  void dismissStreakMilestone() {
    _streakMilestone = null;
    _streakEmoji = null;
    _streakDisplayName = null;
    notifyListeners();
  }

  void onCeremonyAnticipation({
    required String? performerName,
    required int revealAt,
  }) {
    _ceremonyPerformerName = performerName;
    _ceremonyRevealAt = revealAt;
    _ceremonyAward = null;
    _ceremonyTone = null;
    notifyListeners();
  }

  void onCeremonyReveal({
    required String award,
    required String? performerName,
    required String tone,
    String? songTitle,
  }) {
    _ceremonyAward = award;
    _ceremonyTone = tone;
    _ceremonySongTitle = songTitle;
    if (performerName != null) _ceremonyPerformerName = performerName;
    notifyListeners();
  }

  void onCeremonyQuick({
    required String award,
    required String? performerName,
    required String tone,
  }) {
    _ceremonyPerformerName = performerName;
    _ceremonyAward = award;
    _ceremonyTone = tone;
    _ceremonyRevealAt = null; // Quick ceremony has no revealAt timing
    notifyListeners();
  }

  void showMomentCardOverlay() {
    _showMomentCard = true;
    _momentCardTimer?.cancel();
    _momentCardTimer = Timer(const Duration(seconds: 10), () {
      dismissMomentCard();
    });
    notifyListeners();
  }

  void dismissMomentCard() {
    _showMomentCard = false;
    _momentCardTimer?.cancel();
    _momentCardTimer = null;
    notifyListeners();
  }

  void onCardDealt(PartyCardData card) {
    _currentCard = card;
    notifyListeners();
  }

  void onCardRedrawUsed() {
    _redrawUsed = true;
    notifyListeners();
  }

  void onCardAcceptedBroadcast(String title, String type) {
    _acceptedCardTitle = title;
    _acceptedCardType = type;
    notifyListeners();
  }

  void onGroupCardActivated(
    String announcement,
    List<String> selectedUserIds,
    List<String> selectedDisplayNames,
    String cardId,
  ) {
    _groupCardAnnouncement = announcement;
    _groupCardSelectedUserIds = selectedUserIds;
    _groupCardSelectedDisplayNames = selectedDisplayNames;
    _isSelectedForGroupCard = selectedUserIds.contains(_localUserId);
    _isTagTeamPartner = cardId == 'tag-team' && _isSelectedForGroupCard;
    notifyListeners();
  }

  void clearGroupCardAnnouncement() {
    _groupCardAnnouncement = null;
    notifyListeners();
  }

  void setShowTagTeamFlash(bool show) {
    _showTagTeamFlash = show;
    notifyListeners();
  }

  void setLightstickMode(bool active) {
    _isLightstickMode = active;
    notifyListeners();
  }

  void setLightstickColor(Color color) {
    _lightstickColor = color;
    notifyListeners();
  }

  void startHypeCooldown() {
    _isHypeCooldown = true;
    _hypeCooldownEnd = DateTime.now().add(const Duration(seconds: 5));
    notifyListeners();
  }

  void onHypeCooldownEnforced(int remainingMs) {
    _isHypeCooldown = true;
    _hypeCooldownEnd = DateTime.now().add(Duration(milliseconds: remainingMs));
    notifyListeners();
  }

  void clearHypeCooldown() {
    _isHypeCooldown = false;
    _hypeCooldownEnd = null;
    notifyListeners();
  }

  void onPlaylistImportStarted() {
    _playlistImportState = LoadingState.loading;
    notifyListeners();
  }

  void onPlaylistImportSuccess(
    List<Map<String, dynamic>> tracks,
    List<Map<String, dynamic>> matched,
    int unmatchedCount,
  ) {
    _playlistImportState = LoadingState.success;
    _importedTracks = tracks;
    _matchedTracks = matched;
    _unmatchedCount = unmatchedCount;
    notifyListeners();
  }

  void onPlaylistImportError() {
    _playlistImportState = LoadingState.error;
    notifyListeners();
  }

  // Interlude voting methods
  void onInterludeVoteStarted(List<InterludeOption> options, int voteDurationMs, String roundId) {
    _interludeOptions = options;
    _interludeVoteCounts = {};
    _myInterludeVote = null;
    _interludeWinnerOptionId = null;
    _interludeVoteDurationMs = voteDurationMs;
    notifyListeners();
  }

  void onInterludeVoteReceived(Map<String, int> voteCounts) {
    _interludeVoteCounts = voteCounts;
    notifyListeners();
  }

  void onInterludeVoteResult(String winningOptionId, Map<String, int> voteCounts, int totalVotes) {
    _interludeWinnerOptionId = winningOptionId;
    _interludeVoteCounts = voteCounts;
    notifyListeners();
  }

  void updateMyInterludeVote(String optionId) {
    _myInterludeVote = optionId;
    notifyListeners();
  }

  void _clearInterludeState() {
    _interludeOptions = [];
    _interludeVoteCounts = {};
    _myInterludeVote = null;
    _interludeWinnerOptionId = null;
    _interludeGameActivityId = null;
    _interludeGameCard = null;
    _interludeGameDurationMs = _defaultGameDurationMs;
    _interludeGameStartedAt = null;
    _interludeGameTargetUserId = null;
    _interludeGameTargetDisplayName = null;
  }

  void onInterludeGameStarted(String activityId, InterludeGameCard card, int gameDurationMs, {String? targetUserId, String? targetDisplayName}) {
    // Clear vote overlay state so overlays are mutually exclusive
    _interludeOptions = [];
    // Set game state
    _interludeGameActivityId = activityId;
    _interludeGameCard = card;
    _interludeGameDurationMs = gameDurationMs;
    _interludeGameStartedAt = DateTime.now().millisecondsSinceEpoch;
    _interludeGameTargetUserId = targetUserId;
    _interludeGameTargetDisplayName = targetDisplayName;
    notifyListeners();
  }

  void onInterludeGameEnded() {
    _interludeGameActivityId = null;
    _interludeGameCard = null;
    _interludeGameDurationMs = _defaultGameDurationMs;
    _interludeGameStartedAt = null;
    _interludeGameTargetUserId = null;
    _interludeGameTargetDisplayName = null;
    notifyListeners();
  }

  void onQuickPickStarted(List<QuickPickSong> songs, int participantCount, int timerDurationMs) {
    _quickPickSongs = songs;
    _quickPickVotes = {};
    _quickPickWinnerId = null;
    _myQuickPickVotes = {};
    _quickPickParticipantCount = participantCount;
    _quickPickTimerDurationMs = timerDurationMs;
    notifyListeners();
  }

  void onQuickPickVoteReceived(String catalogTrackId, String votingUserId, String vote, VoteTally tally) {
    _quickPickVotes = {..._quickPickVotes, catalogTrackId: tally};
    notifyListeners();
  }

  void onQuickPickResolved(String winnerCatalogTrackId) {
    _quickPickWinnerId = winnerCatalogTrackId;
    notifyListeners();
  }

  void onQuickPickCleared() {
    _quickPickSongs = [];
    _quickPickVotes = {};
    _quickPickWinnerId = null;
    _myQuickPickVotes = {};
    notifyListeners();
  }

  void onSpinWheelStarted(List<SpinWheelSegment> segments, int participantCount, int timerDurationMs) {
    _spinWheelSegments = segments;
    _spinWheelPhase = 'waiting';
    _spinWheelTargetIndex = null;
    _spinWheelTotalRotation = null;
    _spinWheelSpinDurationMs = 4000;
    _spinWheelSpinnerName = null;
    _spinWheelVetoUsed = false;
    _spinWheelTimerDurationMs = timerDurationMs;
    _spinWheelParticipantCount = participantCount;
    notifyListeners();
  }

  void onSpinWheelSpinning(int targetIndex, double totalRotation, int durationMs, String? spinnerName) {
    _spinWheelPhase = 'spinning';
    _spinWheelTargetIndex = targetIndex;
    _spinWheelTotalRotation = totalRotation;
    _spinWheelSpinDurationMs = durationMs;
    _spinWheelSpinnerName = spinnerName;
    notifyListeners();
  }

  void onSpinWheelLanded(SpinWheelSegment song) {
    _spinWheelPhase = 'landed';
    notifyListeners();
  }

  void onSpinWheelVetoed(SpinWheelSegment vetoedSong, int newTargetIndex, double totalRotation, int durationMs) {
    _spinWheelVetoUsed = true;
    _spinWheelPhase = 'spinning';
    _spinWheelTargetIndex = newTargetIndex;
    _spinWheelTotalRotation = totalRotation;
    _spinWheelSpinDurationMs = durationMs;
    notifyListeners();
  }

  void onSpinWheelSelected(SpinWheelSegment song) {
    _spinWheelPhase = 'selected';
    notifyListeners();
  }

  void onSpinWheelCleared() {
    _spinWheelSegments = [];
    _spinWheelPhase = null;
    _spinWheelTargetIndex = null;
    _spinWheelTotalRotation = null;
    _spinWheelSpinnerName = null;
    _spinWheelVetoUsed = false;
    notifyListeners();
  }

  void onSongSelectionModeChanged(String mode) {
    _songSelectionMode = mode;
    notifyListeners();
  }

  void setTvStatus(TvConnectionStatus status, {String? message}) {
    _tvStatus = status;
    _tvStatusMessage = message;
    _tvPairingState = (status == TvConnectionStatus.connected)
        ? LoadingState.success
        : (status == TvConnectionStatus.disconnected && message != null)
            ? LoadingState.error
            : _tvPairingState;
    notifyListeners();
  }

  void setTvNowPlaying(String videoId, String? title, String state) {
    _tvNowPlayingVideoId = videoId;
    notifyListeners();
  }

  void setTvSkipped(bool skipped) {
    _tvSkipped = skipped;
    notifyListeners();
  }

  void setTvPairingState(LoadingState state) {
    _tvPairingState = state;
    notifyListeners();
  }

  void setDetectedSong({
    required String songTitle,
    String? artist,
    String? thumbnail,
    String? source,
  }) {
    _detectedSongTitle = songTitle;
    _detectedArtist = artist;
    _detectedThumbnail = thumbnail;
    _detectedSource = source;
    notifyListeners();
  }

  void clearDetectedSong() {
    _detectedSongTitle = null;
    _detectedArtist = null;
    _detectedThumbnail = null;
    _detectedSource = null;
    notifyListeners();
  }

  void setLastQueuedSong({
    required String songTitle,
    required String artist,
    required String videoId,
    required String catalogTrackId,
  }) {
    _lastQueuedSongTitle = songTitle;
    _lastQueuedArtist = artist;
    _lastQueuedVideoId = videoId;
    _lastQueuedCatalogTrackId = catalogTrackId;
    notifyListeners();
  }

  void clearLastQueuedSong() {
    _lastQueuedSongTitle = null;
    _lastQueuedArtist = null;
    _lastQueuedVideoId = null;
    _lastQueuedCatalogTrackId = null;
    notifyListeners();
  }

  void setTvDegraded(bool degraded) {
    _tvDegraded = degraded;
    notifyListeners();
  }

  void updateMyVote(String catalogTrackId, String vote) {
    _myQuickPickVotes = {..._myQuickPickVotes, catalogTrackId: vote};
    notifyListeners();
  }

  void resetPlaylistImport() {
    _playlistImportState = LoadingState.idle;
    _importedTracks = [];
    _matchedTracks = [];
    _unmatchedCount = 0;
    notifyListeners();
  }

  void _clearCeremonyState() {
    _ceremonyPerformerName = null;
    _ceremonyRevealAt = null;
    _ceremonyAward = null;
    _ceremonyTone = null;
    _ceremonySongTitle = null;
    _showMomentCard = false;
    _momentCardTimer?.cancel();
    _momentCardTimer = null;
  }

  void onDjStateUpdate({
    required DJState state,
    int? songCount,
    int? participantCount,
    String? currentPerformer,
    int? timerStartedAt,
    int? timerDurationMs,
    bool? isPaused,
    String? ceremonyType,
  }) {
    // Clear ceremony data when transitioning OUT of ceremony state
    if (_djState == DJState.ceremony && state != DJState.ceremony) {
      _clearCeremonyState();
    }
    // Clear interlude state when leaving interlude (unless winner showing)
    if (_djState == DJState.interlude && state != DJState.interlude) {
      _clearInterludeState();
    }
    // Clear Quick Pick state when leaving songSelection — but preserve if winner
    // is set so the overlay can show the winner highlight before delayed clear
    if (_djState == DJState.songSelection && state != DJState.songSelection) {
      if (_quickPickWinnerId == null) {
        _quickPickSongs = [];
        _quickPickVotes = {};
        _myQuickPickVotes = {};
      }
      // Clear Spin Wheel state unless winner selected (delayed clear handles it)
      if (_spinWheelPhase != 'selected') {
        _spinWheelSegments = [];
        _spinWheelPhase = null;
        _spinWheelTargetIndex = null;
        _spinWheelTotalRotation = null;
        _spinWheelSpinnerName = null;
        _spinWheelVetoUsed = false;
      }
    }
    // Clear card state when leaving partyCardDeal state
    if (_djState == DJState.partyCardDeal && state != DJState.partyCardDeal) {
      _currentCard = null;
      _redrawUsed = false;
      _acceptedCardTitle = null;
      _acceptedCardType = null;
    }
    // Reset card interaction state when entering a new partyCardDeal
    if (state == DJState.partyCardDeal && _djState != DJState.partyCardDeal) {
      _redrawUsed = false;
      _acceptedCardTitle = null;
      _acceptedCardType = null;
      // Reset group card selection fields (NOT announcement — it auto-dismisses via timer)
      _groupCardSelectedUserIds = [];
      _groupCardSelectedDisplayNames = [];
      _isSelectedForGroupCard = false;
    }
    // Clear reaction feed, streak state, tag team, lightstick, and hype when leaving song state (AC #4)
    if (_djState == DJState.song && state != DJState.song) {
      _reactionFeed.clear();
      _streakMilestone = null;
      _streakEmoji = null;
      _streakDisplayName = null;
      _isTagTeamPartner = false;
      _showTagTeamFlash = false;
      _isLightstickMode = false;
      _isHypeCooldown = false;
      _hypeCooldownEnd = null;
      // Clear last queued song when leaving song state
      _lastQueuedSongTitle = null;
      _lastQueuedArtist = null;
      _lastQueuedVideoId = null;
      _lastQueuedCatalogTrackId = null;
    }
    // Clear last queued song when entering songSelection (new round starting)
    if (state == DJState.songSelection && _djState != DJState.songSelection) {
      _lastQueuedSongTitle = null;
      _lastQueuedArtist = null;
      _lastQueuedVideoId = null;
      _lastQueuedCatalogTrackId = null;
    }
    _djState = state;
    _ceremonyType = ceremonyType;
    _songCount = songCount ?? _songCount;
    _currentPerformer = currentPerformer;
    _timerStartedAt = timerStartedAt;
    _timerDurationMs = timerDurationMs;
    if (isPaused != null) {
      _isPaused = isPaused;
      if (!isPaused) {
        _pausedFromState = null;
      }
    }

    // Update participant count from DJ state only if non-null AND session is active
    if (participantCount != null && _sessionStatus == 'active') {
      _participantCount = participantCount;
    }

    // Wakelock management — active during non-lobby/non-finale states
    final shouldEnable = state != DJState.lobby && state != DJState.finale;
    if (shouldEnable && !_wakelockEnabled) {
      _wakelockEnabled = true;
      _wakelockToggle(true);
    } else if (!shouldEnable && _wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }

    notifyListeners();
  }

  void onVibeChanged(PartyVibe value) {
    _vibe = value;
    notifyListeners();
  }

  void onDjPause({required String pausedFromState, int? timerRemainingMs}) {
    _isPaused = true;
    _pausedFromState = pausedFromState;
    _timerStartedAt = null;
    _timerDurationMs = null;
    notifyListeners();
  }

  void onDjResume() {
    _isPaused = false;
    _pausedFromState = null;
    notifyListeners();
  }

  void onPartyCreated(String sessionId, String partyCode) {
    _sessionId = sessionId;
    _partyCode = partyCode;
    _isHost = true;
    _participantCount = 1; // Host counts as first participant
    _createPartyLoading = LoadingState.success;
    notifyListeners();
  }

  void onCreatePartyLoading(LoadingState state) {
    _createPartyLoading = state;
    notifyListeners();
  }

  void onJoinPartyLoading(LoadingState state) {
    _joinPartyLoading = state;
    notifyListeners();
  }

  void onPartyJoined({
    required String sessionId,
    required String partyCode,
    required PartyVibe vibe,
    String status = 'lobby',
  }) {
    _sessionId = sessionId;
    _partyCode = partyCode;
    _vibe = vibe;
    _isHost = false;
    _sessionStatus = status;
    _pendingCatchUp = status == 'active';
    _joinPartyLoading = LoadingState.success;
    notifyListeners();
  }

  void onStartPartyLoading(LoadingState state) {
    _startPartyLoading = state;
    notifyListeners();
  }

  void onPartyStarted() {
    _sessionStatus = 'active';
    _startPartyLoading = LoadingState.success;
    notifyListeners();
  }

  void onSessionStatus(String status) {
    _sessionStatus = status;
    notifyListeners();
  }

  void onCatchUpStarted() {
    _isCatchingUp = true;
    _pendingCatchUp = false;
    notifyListeners();
  }

  void onCatchUpComplete() {
    _isCatchingUp = false;
    notifyListeners();
  }

  void onParticipantJoined({
    required String userId,
    required String displayName,
    required int participantCount,
  }) {
    _participantCount = participantCount;
    _participants = [..._participants, ParticipantInfo(userId: userId, displayName: displayName)];
    notifyListeners();
  }

  void onParticipantsSync(List<ParticipantInfo> participants) {
    _participants = participants;
    _participantCount = participants.length;
    notifyListeners();
  }

  void onConnectionStatusChanged(ConnectionStatus status) {
    _connectionStatus = status;
    notifyListeners();
  }

  void onParticipantDisconnected(String userId) {
    _participants = _participants
        .map((p) => p.userId == userId
            ? ParticipantInfo(
                userId: p.userId,
                displayName: p.displayName,
                isOnline: false,
              )
            : p)
        .toList();
    notifyListeners();
  }

  void onParticipantReconnected(String userId) {
    _participants = _participants
        .map((p) => p.userId == userId
            ? ParticipantInfo(
                userId: p.userId,
                displayName: p.displayName,
                isOnline: true,
              )
            : p)
        .toList();
    notifyListeners();
  }

  void onHostTransferred(bool iAmNewHost) {
    _isHost = iAmNewHost;
    if (iAmNewHost) {
      _hostTransferPending = true;
    }
    notifyListeners();
  }

  void clearHostTransferPending() {
    if (_hostTransferPending) {
      _hostTransferPending = false;
      notifyListeners();
    }
  }

  void onHostUpdate(bool isHost) {
    _isHost = isHost;
    notifyListeners();
  }

  void onSessionEnded() {
    _sessionStatus = 'ended';
    _djState = DJState.lobby;
    _currentPerformer = null;
    _timerStartedAt = null;
    _timerDurationMs = null;
    _ceremonyType = null;
    _clearCeremonyState();
    _clearInterludeState();
    _detectedSongTitle = null;
    _detectedArtist = null;
    _detectedThumbnail = null;
    _detectedSource = null;
    _lastQueuedSongTitle = null;
    _lastQueuedArtist = null;
    _lastQueuedVideoId = null;
    _lastQueuedCatalogTrackId = null;
    _tvDegraded = false;
    if (_wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }
    notifyListeners();
  }

  void onKicked() {
    _sessionStatus = 'ended';
    _kickedMessage = 'You have been removed from the party';
    _djState = DJState.lobby;
    _currentPerformer = null;
    _timerStartedAt = null;
    _timerDurationMs = null;
    _ceremonyType = null;
    _clearCeremonyState();
    _clearInterludeState();
    _detectedSongTitle = null;
    _detectedArtist = null;
    _detectedThumbnail = null;
    _detectedSource = null;
    _lastQueuedSongTitle = null;
    _lastQueuedArtist = null;
    _lastQueuedVideoId = null;
    _lastQueuedCatalogTrackId = null;
    _tvDegraded = false;
    if (_wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }
    notifyListeners();
  }

  void onParticipantRemoved(String userId) {
    _participants = _participants.where((p) => p.userId != userId).toList();
    _participantCount = _participants.length;
    notifyListeners();
  }

  @override
  void dispose() {
    _momentCardTimer?.cancel();
    _lastQueuedSongTitle = null;
    _lastQueuedArtist = null;
    _lastQueuedVideoId = null;
    _lastQueuedCatalogTrackId = null;
    _tvDegraded = false;
    super.dispose();
  }

  /// Disable wakelock when leaving the session.
  void onSessionEnd() {
    _clearCeremonyState();
    _detectedSongTitle = null;
    _detectedArtist = null;
    _detectedThumbnail = null;
    _detectedSource = null;
    _lastQueuedSongTitle = null;
    _lastQueuedArtist = null;
    _lastQueuedVideoId = null;
    _lastQueuedCatalogTrackId = null;
    _tvDegraded = false;
    if (_wakelockEnabled) {
      _wakelockEnabled = false;
      _wakelockToggle(false);
    }
  }
}

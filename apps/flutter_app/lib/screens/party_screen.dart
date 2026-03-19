import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/bridge_moment_display.dart';
import 'package:karamania/widgets/host_controls_overlay.dart';
import 'package:karamania/widgets/reconnecting_banner.dart';
import 'package:karamania/widgets/ceremony_display.dart';
import 'package:karamania/widgets/moment_card_overlay.dart';
import 'package:karamania/widgets/party_card_deal_overlay.dart';
import 'package:karamania/widgets/reaction_bar.dart';
import 'package:karamania/widgets/soundboard_bar.dart';
import 'package:karamania/widgets/reaction_feed.dart';
import 'package:karamania/widgets/streak_milestone_overlay.dart';
import 'package:karamania/widgets/quick_ceremony_display.dart';
import 'package:karamania/widgets/song_over_button.dart';
import 'package:karamania/widgets/group_card_announcement_overlay.dart';
import 'package:karamania/widgets/tag_team_flash_widget.dart';
import 'package:karamania/widgets/lightstick_mode.dart';
import 'package:karamania/widgets/interlude_vote_overlay.dart';
import 'package:karamania/widgets/dare_pull_overlay.dart';
import 'package:karamania/widgets/kings_cup_overlay.dart';
import 'package:karamania/widgets/quick_vote_overlay.dart';
import 'package:karamania/widgets/group_singalong_overlay.dart';
import 'package:karamania/widgets/quick_pick_overlay.dart';
import 'package:karamania/widgets/spin_the_wheel_overlay.dart';
import 'package:karamania/widgets/song_mode_toggle.dart';
import 'package:karamania/widgets/hype_signal_button.dart';
import 'package:karamania/widgets/now_playing_bar.dart';
import 'package:karamania/widgets/capture_bubble.dart';
import 'package:karamania/widgets/capture_overlay.dart';
import 'package:karamania/widgets/capture_toolbar_icon.dart';
import 'package:karamania/widgets/selected_song_display.dart';
import 'package:go_router/go_router.dart';

class PartyScreen extends StatefulWidget {
  const PartyScreen({super.key});

  @override
  State<PartyScreen> createState() => _PartyScreenState();
}

class _PartyScreenState extends State<PartyScreen>
    with SingleTickerProviderStateMixin {
  Timer? _catchUpTimer;
  Timer? _skeletonTimer;
  Timer? _countdownTimer;
  int? _remainingSeconds;
  int? _lastTimerStartedAt;
  int? _lastTimerDurationMs;
  bool _showLoadingSkeleton = false;
  bool _catchUpTimerStarted = false;
  late final AnimationController _pulseController;
  PartyProvider? _partyProvider;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    final provider = context.read<PartyProvider>();
    _partyProvider = provider;

    if (provider.isCatchingUp) {
      _startCatchUpTimer();
    } else if (provider.pendingCatchUp) {
      _showLoadingSkeleton = true;
      _pulseController.repeat(reverse: true);
      // Auto-dismiss skeleton after 500ms if catch-up never arrives
      _skeletonTimer = Timer(const Duration(milliseconds: 500), () {
        if (mounted && _showLoadingSkeleton) {
          setState(() => _showLoadingSkeleton = false);
          _pulseController.stop();
        }
      });
    }

    provider.addListener(_onProviderChanged);
  }

  void _onProviderChanged() {
    final provider = _partyProvider;
    if (provider == null) return;

    if (provider.isCatchingUp && !_catchUpTimerStarted) {
      // Catch-up just became true — hide skeleton, start timer
      if (_showLoadingSkeleton) {
        _skeletonTimer?.cancel();
        setState(() => _showLoadingSkeleton = false);
        _pulseController.stop();
      }
      _startCatchUpTimer();
    }

    // TV degradation notification
    if (provider.tvDegraded) {
      provider.setTvDegraded(false); // Reset immediately to prevent re-trigger
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(Copy.tvDisconnectedSuggestionMode),
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: Copy.dismiss,
            onPressed: () {},
          ),
        ),
      );
    }

    // Update countdown timer when DJ state changes
    _updateCountdown(provider);
  }

  void _updateCountdown(PartyProvider provider) {
    final timerStartedAt = provider.timerStartedAt;
    final timerDurationMs = provider.timerDurationMs;

    // Skip if timer values haven't changed
    if (timerStartedAt == _lastTimerStartedAt &&
        timerDurationMs == _lastTimerDurationMs) {
      return;
    }
    _lastTimerStartedAt = timerStartedAt;
    _lastTimerDurationMs = timerDurationMs;

    if (timerStartedAt != null && timerDurationMs != null) {
      _countdownTimer?.cancel();
      _tickCountdown(timerStartedAt, timerDurationMs);
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        _tickCountdown(timerStartedAt, timerDurationMs);
      });
    } else {
      _countdownTimer?.cancel();
      _countdownTimer = null;
      if (_remainingSeconds != null) {
        setState(() => _remainingSeconds = null);
      }
    }
  }

  void _tickCountdown(int timerStartedAt, int timerDurationMs) {
    final elapsed = DateTime.now().millisecondsSinceEpoch - timerStartedAt;
    final remaining = ((timerDurationMs - elapsed) / 1000).ceil();
    if (remaining <= 0) {
      _countdownTimer?.cancel();
      _countdownTimer = null;
      if (mounted) setState(() => _remainingSeconds = 0);
    } else {
      if (mounted) setState(() => _remainingSeconds = remaining);
    }
  }

  void _startCatchUpTimer() {
    _catchUpTimerStarted = true;
    _catchUpTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        context.read<PartyProvider>().onCatchUpComplete();
      }
    });
  }

  @override
  void dispose() {
    _partyProvider?.removeListener(_onProviderChanged);
    _catchUpTimer?.cancel();
    _skeletonTimer?.cancel();
    _countdownTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final partyProvider = context.watch<PartyProvider>();
    final displayVibe = partyProvider.vibe;

    // Navigate home when session ends or kicked
    if (partyProvider.sessionStatus == 'ended') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/');
      });
    }

    final isActiveHost = partyProvider.isHost &&
        partyProvider.djState != DJState.lobby &&
        partyProvider.djState != DJState.finale;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Stack(
          children: [
            _buildPartyContent(context, partyProvider, displayVibe),
            // Now Playing / Selected Song — top of screen during song state
            if (partyProvider.djState == DJState.song &&
                !partyProvider.isLightstickMode)
              Positioned(
                top: DJTokens.spaceMd,
                left: DJTokens.spaceMd,
                right: DJTokens.spaceMd,
                child: partyProvider.isSuggestionOnlyMode
                    ? const SelectedSongDisplay()
                    : (partyProvider.hasDetectedSong
                        ? const NowPlayingBar()
                        : const SizedBox.shrink()),
              ),
            if (_showLoadingSkeleton)
              _buildLoadingSkeleton(context, displayVibe),
            if (partyProvider.isCatchingUp)
              _buildCatchUpCard(context, partyProvider, displayVibe),
            if (partyProvider.isPaused)
              _buildPauseOverlay(context, partyProvider),
            if (partyProvider.connectionStatus == ConnectionStatus.reconnecting)
              const ReconnectingBanner(),
            if (partyProvider.hostTransferPending)
              _buildHostTransferBanner(context, displayVibe),
            // Moment card overlay — only during Full ceremony celebration window
            if (partyProvider.showMomentCard &&
                partyProvider.ceremonyType == 'full' &&
                partyProvider.ceremonyAward != null)
              Positioned.fill(
                child: MomentCardOverlay(
                  award: partyProvider.ceremonyAward!,
                  vibe: displayVibe,
                  performerName: partyProvider.ceremonyPerformerName,
                  songTitle: partyProvider.ceremonySongTitle,
                  onDismiss: () => partyProvider.dismissMomentCard(),
                ),
              ),
            // Quick Pick overlay — during songSelection OR showing winner (only when mode is quickPick)
            if (partyProvider.quickPickSongs.isNotEmpty &&
                (partyProvider.djState == DJState.songSelection ||
                    partyProvider.quickPickWinnerId != null))
              Positioned.fill(
                child: QuickPickOverlay(
                  songs: partyProvider.quickPickSongs,
                  votes: partyProvider.quickPickVotes,
                  myVotes: partyProvider.myQuickPickVotes,
                  winnerId: partyProvider.quickPickWinnerId,
                  participantCount: partyProvider.quickPickParticipantCount,
                  timerDurationMs: partyProvider.quickPickTimerDurationMs,
                  onVote: (catalogTrackId, vote) =>
                      SocketClient.instance.emitQuickPickVote(catalogTrackId, vote),
                ),
              ),
            // Spin the Wheel overlay — during songSelection OR showing selected
            if (partyProvider.spinWheelSegments.isNotEmpty &&
                (partyProvider.djState == DJState.songSelection ||
                    partyProvider.spinWheelPhase == 'selected'))
              Positioned.fill(
                child: SpinTheWheelOverlay(
                  segments: partyProvider.spinWheelSegments,
                  phase: partyProvider.spinWheelPhase,
                  targetIndex: partyProvider.spinWheelTargetIndex,
                  totalRotation: partyProvider.spinWheelTotalRotation,
                  spinDurationMs: partyProvider.spinWheelSpinDurationMs,
                  spinnerName: partyProvider.spinWheelSpinnerName,
                  vetoUsed: partyProvider.spinWheelVetoUsed,
                  timerDurationMs: partyProvider.spinWheelTimerDurationMs,
                  onSpin: () => SocketClient.instance.emitSpinWheelAction('spin'),
                  onVeto: () => SocketClient.instance.emitSpinWheelAction('veto'),
                ),
              ),
            // Interlude voting overlay — during interlude state
            if (partyProvider.interludeOptions.isNotEmpty &&
                (partyProvider.djState == DJState.interlude ||
                    partyProvider.interludeWinnerOptionId != null))
              Positioned.fill(
                child: InterludeVoteOverlay(
                  options: partyProvider.interludeOptions,
                  voteCounts: partyProvider.interludeVoteCounts,
                  myVote: partyProvider.myInterludeVote,
                  winnerOptionId: partyProvider.interludeWinnerOptionId,
                  timerDurationMs: partyProvider.interludeVoteDurationMs,
                  timerStartedAt: partyProvider.timerStartedAt,
                  onVote: (optionId) =>
                      SocketClient.instance.emitInterludeVote(optionId),
                ),
              ),
            // Kings Cup game overlay — after vote concludes
            if (partyProvider.interludeGameActivityId == 'kings_cup' &&
                partyProvider.interludeGameCard != null)
              Positioned.fill(
                child: KingsCupOverlay(
                  card: partyProvider.interludeGameCard!,
                  gameDurationMs: partyProvider.interludeGameDurationMs,
                  timerStartedAt: partyProvider.interludeGameStartedAt,
                ),
              ),
            // Dare Pull game overlay — after vote concludes
            if (partyProvider.interludeGameActivityId == 'dare_pull' &&
                partyProvider.interludeGameCard != null &&
                partyProvider.interludeGameTargetDisplayName != null)
              Positioned.fill(
                child: DarePullOverlay(
                  card: partyProvider.interludeGameCard!,
                  gameDurationMs: partyProvider.interludeGameDurationMs,
                  targetDisplayName: partyProvider.interludeGameTargetDisplayName!,
                  timerStartedAt: partyProvider.interludeGameStartedAt,
                ),
              ),
            // Quick Vote game overlay — after vote concludes
            if (partyProvider.interludeGameActivityId == 'quick_vote' &&
                partyProvider.interludeGameCard != null &&
                partyProvider.quickVoteOptions.isNotEmpty)
              Positioned.fill(
                child: QuickVoteOverlay(
                  card: partyProvider.interludeGameCard!,
                  quickVoteOptions: partyProvider.quickVoteOptions,
                  gameDurationMs: partyProvider.interludeGameDurationMs,
                  myQuickVote: partyProvider.myQuickVote,
                  quickVoteResult: partyProvider.quickVoteResult,
                  timerStartedAt: partyProvider.interludeGameStartedAt,
                  onVote: (option) =>
                      SocketClient.instance.emitQuickVoteCast(option),
                ),
              ),
            // Group Sing-Along game overlay — after vote concludes
            if (partyProvider.interludeGameActivityId == 'group_singalong' &&
                partyProvider.interludeGameCard != null)
              Positioned.fill(
                child: GroupSingAlongOverlay(
                  card: partyProvider.interludeGameCard!,
                  gameDurationMs: partyProvider.interludeGameDurationMs,
                  timerStartedAt: partyProvider.interludeGameStartedAt,
                ),
              ),
            // Party card deal overlay — during partyCardDeal state with dealt card
            if (partyProvider.djState == DJState.partyCardDeal &&
                partyProvider.currentCard != null)
              Positioned.fill(
                child: PartyCardDealOverlay(
                  card: partyProvider.currentCard!,
                  isCurrentSinger: partyProvider.isCurrentSinger,
                  redrawUsed: partyProvider.redrawUsed,
                  currentPerformerName: partyProvider.participants
                      .where((p) => p.userId == partyProvider.currentPerformer)
                      .map((p) => p.displayName)
                      .firstOrNull,
                  acceptedCardTitle: partyProvider.acceptedCardTitle,
                  onAccept: () => SocketClient.instance
                      .emitCardAccepted(partyProvider.currentCard!.id),
                  onDismiss: () => SocketClient.instance
                      .emitCardDismissed(partyProvider.currentCard!.id),
                  onRedraw: () {
                    partyProvider.onCardRedrawUsed();
                    SocketClient.instance.emitCardRedraw();
                  },
                ),
              ),
            // Group card announcement overlay — appears after card accepted broadcast
            if (partyProvider.groupCardAnnouncement != null)
              Positioned.fill(
                child: GroupCardAnnouncementOverlay(
                  announcement: partyProvider.groupCardAnnouncement!,
                  selectedDisplayNames:
                      partyProvider.groupCardSelectedDisplayNames,
                  isSelectedForGroupCard:
                      partyProvider.isSelectedForGroupCard,
                  onDismiss: () =>
                      partyProvider.clearGroupCardAnnouncement(),
                ),
              ),
            // Tag Team "YOUR TURN!" flash — during song state for tag-team partner
            if (partyProvider.isTagTeamPartner &&
                partyProvider.djState == DJState.song)
              const TagTeamFlashWidget(),
            // Lean-in mode widgets — hidden when lightstick mode is active
            if (partyProvider.djState == DJState.song &&
                !partyProvider.isLightstickMode) ...[
              // Reaction feed overlay (floating emojis)
              Positioned.fill(
                child: RepaintBoundary(
                  child: ReactionFeed(
                    reactions: partyProvider.reactionFeed
                        .map((e) => ReactionFeedItem(
                              id: e.id,
                              emoji: e.emoji,
                              startX: e.startX,
                              opacity: e.rewardMultiplier.clamp(0.1, 1.0),
                            ))
                        .toList(),
                    onParticleComplete: (id) => partyProvider.removeReaction(id),
                  ),
                ),
              ),
              // Streak milestone overlay
              if (partyProvider.streakMilestone != null)
                Positioned.fill(
                  child: StreakMilestoneOverlay(
                    key: ValueKey(partyProvider.streakMilestone),
                    streakCount: partyProvider.streakMilestone!,
                    emoji: partyProvider.streakEmoji ?? '',
                    displayName: partyProvider.streakDisplayName ?? '',
                    onDismiss: () => partyProvider.dismissStreakMilestone(),
                  ),
                ),
              // Soundboard bar
              Positioned(
                bottom: DJTokens.spaceLg + 48 + 56 + DJTokens.spaceSm,
                left: 0,
                right: 0,
                child: const SoundboardBar(),
              ),
              // Reaction bar
              Positioned(
                bottom: DJTokens.spaceLg + 48,
                left: 0,
                right: 0,
                child: ReactionBar(vibe: displayVibe),
              ),
              // Mode toggle buttons (above SongOverButton)
              Positioned(
                bottom: DJTokens.spaceLg + 48 + 56 + DJTokens.spaceSm + 48 + DJTokens.spaceSm,
                right: DJTokens.spaceMd,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ModeToggleButton(
                      key: const Key('lightstick-toggle'),
                      label: Copy.lightstickToggle,
                      icon: Icons.lightbulb_outline,
                      color: displayVibe.accent,
                      onTap: () {
                        partyProvider.setLightstickMode(true);
                        SocketClient.instance.emitLightstickToggled(true);
                      },
                    ),
                    const SizedBox(width: DJTokens.spaceSm),
                    const HypeSignalButton(),
                  ],
                ),
              ),
            ],
            // Lightstick mode — full screen glow
            if (partyProvider.djState == DJState.song &&
                partyProvider.isLightstickMode)
              Positioned.fill(
                child: LightstickMode(
                  onExit: () {
                    partyProvider.setLightstickMode(false);
                    SocketClient.instance.emitLightstickToggled(false);
                  },
                ),
              ),
            // Persistent capture icon — always visible (FR39)
            Positioned(
              bottom: DJTokens.spaceLg,
              left: DJTokens.spaceMd,
              child: const CaptureToolbarIcon(),
            ),
            // Capture bubble — bottom-left, above the SongOverButton area
            Positioned(
              bottom: DJTokens.spaceLg + 48 + DJTokens.spaceSm,
              left: DJTokens.spaceMd,
              child: const CaptureBubble(),
            ),
            // Capture overlay — mode selector and active capture UI
            const Positioned.fill(
              child: CaptureOverlay(),
            ),
            // Song Over button — visible in BOTH modes (host only)
            if (partyProvider.isHost && partyProvider.djState == DJState.song)
              Positioned(
                bottom: DJTokens.spaceLg,
                left: 0,
                right: 0,
                child: Center(child: const SongOverButton()),
              ),
            if (isActiveHost)
              HostControlsOverlay(
                onInvite: () => _showInviteSheet(context, partyProvider),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingSkeleton(BuildContext context, PartyVibe displayVibe) {
    return Container(
      key: const Key('loading-skeleton'),
      color: Colors.black.withValues(alpha: 0.9),
      child: Center(
        child: FadeTransition(
          opacity: Tween<double>(begin: 0.3, end: 1.0).animate(_pulseController),
          child: Text(
            Copy.appTitle,
            style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  color: displayVibe.accent,
                  letterSpacing: 8,
                ),
          ),
        ),
      ),
    );
  }

  Widget _buildPartyContent(
    BuildContext context,
    PartyProvider partyProvider,
    PartyVibe displayVibe,
  ) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 428),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (partyProvider.djState == DJState.ceremony &&
                partyProvider.ceremonyType == 'full' &&
                partyProvider.ceremonyRevealAt != null) ...[
              CeremonyDisplay(
                performerName: partyProvider.ceremonyPerformerName,
                revealAt: partyProvider.ceremonyRevealAt!,
                vibe: displayVibe,
                award: partyProvider.ceremonyAward,
                tone: partyProvider.ceremonyTone,
              ),
            ] else if (partyProvider.djState == DJState.ceremony &&
                       partyProvider.ceremonyType == 'quick' &&
                       partyProvider.ceremonyAward != null) ...[
              QuickCeremonyDisplay(
                award: partyProvider.ceremonyAward!,
                vibe: displayVibe,
                performerName: partyProvider.ceremonyPerformerName,
              ),
            ] else ...[
              Icon(
                Icons.music_note,
                size: DJTokens.iconSizeXl,
                color: displayVibe.accent,
              ),
              const SizedBox(height: DJTokens.spaceLg),
              Text(
                Copy.djStateLabel(partyProvider.djState),
                key: const Key('dj-state-label'),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              Text(
                '${partyProvider.participantCount} ${Copy.participants.toLowerCase()}',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
              if (partyProvider.currentPerformer != null) ...[
                const SizedBox(height: DJTokens.spaceMd),
                Text(
                  partyProvider.participants
                      .where((p) => p.userId == partyProvider.currentPerformer)
                      .map((p) => p.displayName)
                      .firstOrNull ?? '',
                  key: const Key('current-performer'),
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: displayVibe.accent,
                      ),
                ),
              ],
              if (_remainingSeconds != null) ...[
                const SizedBox(height: DJTokens.spaceMd),
                Text(
                  _formatCountdown(_remainingSeconds!),
                  key: const Key('countdown-timer'),
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              ],
              if (partyProvider.djState == DJState.songSelection) ...[
                const SizedBox(height: DJTokens.spaceMd),
                SongModeToggle(
                  currentMode: partyProvider.songSelectionMode,
                ),
                const SizedBox(height: DJTokens.spaceLg),
                BridgeMomentDisplay(
                  currentPerformer: partyProvider.currentPerformer,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  String _formatCountdown(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Widget _buildCatchUpCard(
    BuildContext context,
    PartyProvider partyProvider,
    PartyVibe displayVibe,
  ) {
    return GestureDetector(
      key: const Key('catch-up-card'),
      onTap: () {
        _catchUpTimer?.cancel();
        partyProvider.onCatchUpComplete();
      },
      child: Container(
        color: Colors.black.withValues(alpha: 0.8),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Card(
              color: DJTokens.surfaceColor,
              child: Padding(
                padding: const EdgeInsets.all(DJTokens.spaceLg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      Copy.welcomeToParty,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: displayVibe.accent,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceMd),
                    Text(
                      '${partyProvider.participantCount} ${Copy.participants.toLowerCase()} ${Copy.areHere}',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: DJTokens.textPrimary,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceMd),
                    Text(
                      '${Copy.vibeLabel}: ${Copy.vibeEmoji(partyProvider.vibe)}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceLg),
                    Text(
                      Copy.tapToDismiss,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DJTokens.textSecondary.withValues(alpha: 0.5),
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPauseOverlay(BuildContext context, PartyProvider partyProvider) {
    final pausedFrom = partyProvider.pausedFromState;
    String? stateLabel;
    if (pausedFrom != null) {
      try {
        stateLabel = Copy.djStateLabel(DJState.values.byName(pausedFrom));
      } catch (_) {
        stateLabel = pausedFrom;
      }
    }

    return Positioned.fill(
      key: const Key('pause-overlay'),
      child: Container(
        color: Colors.black.withValues(alpha: 0.7),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.pause_circle_outline, size: 48, color: DJTokens.textPrimary),
              const SizedBox(height: DJTokens.spaceMd),
              Text(
                Copy.pausedLabel,
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
              if (stateLabel != null) ...[
                const SizedBox(height: DJTokens.spaceSm),
                Text(
                  '${Copy.pausedDuring} $stateLabel',
                  key: const Key('pause-overlay-state'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHostTransferBanner(BuildContext context, PartyVibe displayVibe) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        key: const Key('host-transfer-banner'),
        padding: const EdgeInsets.symmetric(
          vertical: DJTokens.spaceSm,
          horizontal: DJTokens.spaceMd,
        ),
        color: DJTokens.surfaceColor.withValues(alpha: 0.95),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.star, size: 16, color: displayVibe.accent),
            const SizedBox(width: DJTokens.spaceSm),
            Text(
              Copy.hostTransferred,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DJTokens.textPrimary,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  void _showInviteSheet(BuildContext context, PartyProvider partyProvider) {
    showModalBottomSheet(
      context: context,
      backgroundColor: DJTokens.surfaceColor,
      builder: (sheetContext) => _InviteSheet(
        partyCode: partyProvider.partyCode ?? '',
        vibe: partyProvider.vibe,
      ),
    );
  }
}

class _InviteSheet extends StatelessWidget {
  const _InviteSheet({required this.partyCode, required this.vibe});
  final String partyCode;
  final PartyVibe vibe;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(DJTokens.spaceLg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            Copy.inviteMoreFriends,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: vibe.accent,
                ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          QrImageView(
            data: '${AppConfig.instance.webLandingUrl}?code=$partyCode',
            size: 200,
            eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.circle),
            dataModuleStyle: QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.circle,
              color: vibe.accent,
            ),
            backgroundColor: Colors.white,
          ),
          const SizedBox(height: DJTokens.spaceMd),
          Text(
            partyCode,
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: DJTokens.textPrimary,
                  letterSpacing: 8,
                ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
          DJTapButton(
            key: const Key('invite-share-btn'),
            tier: TapTier.social,
            onTap: () {
              SharePlus.instance.share(
                ShareParams(
                  text: '${Copy.joinMyParty} ${AppConfig.instance.webLandingUrl}?code=$partyCode',
                ),
              );
            },
            child: Text(
              Copy.shareInvite,
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
          const SizedBox(height: DJTokens.spaceMd),
        ],
      ),
    );
  }
}

class _ModeToggleButton extends StatelessWidget {
  const _ModeToggleButton({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: DJTokens.spaceSm,
          vertical: DJTokens.spaceXs,
        ),
        decoration: BoxDecoration(
          color: DJTokens.surfaceColor.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(DJTokens.spaceMd),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: DJTokens.spaceXs),
            Text(
              label,
              style: TextStyle(color: color, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

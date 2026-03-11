import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/host_controls_overlay.dart';
import 'package:karamania/widgets/reconnecting_banner.dart';
import 'package:karamania/widgets/song_over_button.dart';
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
            if (_showLoadingSkeleton)
              _buildLoadingSkeleton(context, displayVibe),
            if (partyProvider.isCatchingUp)
              _buildCatchUpCard(context, partyProvider, displayVibe),
            if (partyProvider.connectionStatus == ConnectionStatus.reconnecting)
              const ReconnectingBanner(),
            if (partyProvider.hostTransferPending)
              _buildHostTransferBanner(context, displayVibe),
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
            Icon(
              Icons.music_note,
              size: 64,
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
                partyProvider.currentPerformer!,
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

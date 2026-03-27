import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
import 'package:karamania/widgets/tv_pairing_overlay.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:karamania/widgets/playlist_import_card.dart';
import 'package:karamania/widgets/reconnecting_banner.dart';

const double _qrSize = 280.0;
const double _partyCodeLetterSpacing = 8.0;
const Duration _vibePreviewDuration = Duration(seconds: 2);

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  PartyVibe? _previewVibe;
  Timer? _previewTimer;
  bool _hasNavigatedToParty = false;

  @override
  void dispose() {
    _previewTimer?.cancel();
    super.dispose();
  }

  void _onVibeTap(PartyVibe tappedVibe) {
    final partyProvider = context.read<PartyProvider>();

    if (_previewVibe == tappedVibe) {
      // Same vibe tapped during preview -> confirm selection
      _previewTimer?.cancel();
      setState(() => _previewVibe = null);
      context.read<SocketClient>().updateVibe(
            partyProvider: partyProvider,
            vibe: tappedVibe,
          );
    } else {
      // New vibe tapped or first tap -> start preview
      _previewTimer?.cancel();
      setState(() => _previewVibe = tappedVibe);
      _previewTimer = Timer(_vibePreviewDuration, () {
        if (mounted) {
          setState(() => _previewVibe = null);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final partyProvider = context.watch<PartyProvider>();
    final partyCode = partyProvider.partyCode ?? '';
    final currentVibe = partyProvider.vibe;
    final displayVibe = _previewVibe ?? currentVibe;
    final isHost = partyProvider.isHost;
    final canStartParty = isHost && partyProvider.participantCount >= 3;
    final scaleFactor = MediaQuery.textScalerOf(context).scale(1.0);
    final horizontalPadding =
        DJTokens.spaceMd * scaleFactor.clamp(1.0, 1.5);

    // Reactive navigation when party starts
    if (partyProvider.sessionStatus == 'active' && !_hasNavigatedToParty) {
      _hasNavigatedToParty = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/party');
      });
    }

    return Scaffold(
      body: AnimatedContainer(
        duration: DJTokens.transitionFast,
        color: displayVibe.bg,
        child: SafeArea(
          child: Stack(
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 428),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
                    child: SingleChildScrollView(
                      child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: DJTokens.spaceMd),
                      Text(
                        Copy.partyLobby,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: DJTokens.spaceLg),
                      // QR code — host only
                      if (isHost) ...[
                        QrImageView(
                          data: '${AppConfig.instance.webLandingUrl}?code=$partyCode',
                          version: QrVersions.auto,
                          size: _qrSize,
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.all(DJTokens.spaceMd),
                          eyeStyle: QrEyeStyle(
                            eyeShape: QrEyeShape.square,
                            color: displayVibe.primary,
                          ),
                          dataModuleStyle: QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: displayVibe.primary,
                          ),
                        ),
                        const SizedBox(height: DJTokens.spaceLg),
                      ],
                      // Party code
                      Text(
                        '${Copy.partyCodeLabel}: $partyCode',
                        style: Theme.of(context).textTheme.displayLarge?.copyWith(
                              letterSpacing: _partyCodeLetterSpacing,
                            ),
                      ),
                      const SizedBox(height: DJTokens.spaceLg),
                      // Vibe selector — host only
                      if (isHost) ...[
                        Text(
                          Copy.pickYourVibe,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: DJTokens.textSecondary,
                              ),
                        ),
                        const SizedBox(height: DJTokens.spaceSm),
                        Wrap(
                          alignment: WrapAlignment.center,
                          spacing: DJTokens.spaceXs,
                          children: PartyVibe.values.map((vibe) {
                            final isSelected = currentVibe == vibe;
                            final isPreviewing = _previewVibe == vibe;
                            return Container(
                              decoration: (isSelected || isPreviewing)
                                  ? BoxDecoration(
                                      border: Border.all(
                                        color: vibe.accent,
                                        width: 2,
                                      ),
                                      borderRadius: BorderRadius.circular(
                                        DJTokens.spaceSm,
                                      ),
                                    )
                                  : null,
                              child: DJTapButton(
                                key: Key('vibe-${vibe.name}'),
                                tier: TapTier.social,
                                onTap: () => _onVibeTap(vibe),
                                child: SvgPicture.asset(
                                  vibe.iconAsset,
                                  width: 28,
                                  height: 28,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: DJTokens.spaceLg),
                        // TV pairing
                        if (!partyProvider.isTvPaired && !partyProvider.tvSkipped) ...[
                          GestureDetector(
                            onTap: () {
                              showModalBottomSheet(
                                context: context,
                                backgroundColor: DJTokens.surfaceColor,
                                builder: (_) => ChangeNotifierProvider.value(
                                  value: partyProvider,
                                  child: const TvPairingOverlay(),
                                ),
                              );
                            },
                            child: Text(
                              Copy.pairWithTv,
                              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: DJTokens.textSecondary,
                                  ),
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              partyProvider.setTvSkipped(true);
                            },
                            child: Text(
                              Copy.skipNoTv,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: DJTokens.textSecondary,
                                  ),
                            ),
                          ),
                        ] else if (partyProvider.isTvPaired) ...[
                          Text(
                            Copy.tvConnected,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: DJTokens.actionConfirm,
                                ),
                          ),
                        ],
                        const SizedBox(height: DJTokens.spaceLg),
                      ],
                      // Participant list
                      if (partyProvider.participants.isNotEmpty) ...[
                        Text(
                          Copy.participants,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: DJTokens.spaceSm),
                        ...partyProvider.participants.map((p) => Padding(
                              key: ValueKey(p.userId),
                              padding: const EdgeInsets.symmetric(
                                  vertical: DJTokens.spaceXs),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CircleAvatar(
                                    radius: 16,
                                    backgroundColor:
                                        displayVibe.accent.withValues(alpha: 0.3),
                                    child: Text(
                                      p.displayName.isNotEmpty
                                          ? p.displayName[0].toUpperCase()
                                          : '?',
                                      style: TextStyle(
                                          color: displayVibe.accent,
                                          fontSize: 14),
                                    ),
                                  ),
                                  const SizedBox(width: DJTokens.spaceSm),
                                  Text(p.displayName,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium),
                                ],
                              ),
                            )),
                        const SizedBox(height: DJTokens.spaceMd),
                      ],
                      // Participant count + waiting state
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          '${partyProvider.participantCount} ${Copy.joined}',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                      if (partyProvider.participantCount < 3) ...[
                        const SizedBox(height: DJTokens.spaceXs),
                        Text(
                          Copy.waitingForGuests,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: DJTokens.textSecondary,
                              ),
                        ),
                        const SizedBox(height: DJTokens.spaceXs),
                        Text(
                          Copy.bestWith3Plus,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: DJTokens.textSecondary,
                              ),
                        ),
                      ],
                      const SizedBox(height: DJTokens.spaceMd),
                      // Share button
                      DJTapButton(
                        key: const Key('share-party-btn'),
                        tier: TapTier.social,
                        onTap: () {
                          SharePlus.instance.share(
                            ShareParams(
                              text:
                                  '${Copy.sharePartyMessage}$partyCode\n${AppConfig.instance.webLandingUrl}?code=$partyCode',
                            ),
                          );
                        },
                        child: Text(
                          Copy.shareParty,
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                      ),
                      const SizedBox(height: DJTokens.spaceMd),
                      // Playlist import — all participants
                      const PlaylistImportCard(),
                      // "Need X more" hint
                      if (isHost && partyProvider.participantCount < 3) ...[
                        const SizedBox(height: DJTokens.spaceXs),
                        Text(
                          '${Copy.needMorePlayers} ${3 - partyProvider.participantCount} ${Copy.more}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      // Start party button — host only
                      if (isHost) ...[
                        const SizedBox(height: DJTokens.spaceMd),
                        Opacity(
                          opacity: canStartParty ? 1.0 : 0.5,
                          child: DJTapButton(
                            key: const Key('start-party-btn'),
                            tier: TapTier.consequential,
                            onTap: canStartParty
                                ? () {
                                    final socketClient = context.read<SocketClient>();
                                    socketClient.startParty(context.read<PartyProvider>());
                                  }
                                : () {},
                            child: Text(
                              Copy.startParty,
                              style: Theme.of(context).textTheme.labelLarge,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: DJTokens.spaceMd),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Exit button (on top of scroll content)
          Positioned(
            top: DJTokens.spaceSm,
            left: DJTokens.spaceSm,
            child: IconButton(
              key: const Key('leave-lobby-btn'),
              icon: const Icon(Icons.close, color: DJTokens.textSecondary),
              onPressed: () {
                context.read<SocketClient>().disconnect();
                context.go('/');
              },
              tooltip: Copy.leaveParty,
            ),
          ),
          if (partyProvider.connectionStatus == ConnectionStatus.reconnecting)
            const ReconnectingBanner(),
          if (partyProvider.hostTransferPending)
            Positioned(
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
            ),
            ],
          ),
        ),
      ),
    );
  }
}

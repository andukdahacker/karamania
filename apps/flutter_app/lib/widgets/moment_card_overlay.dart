import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/moment_card.dart';

/// Overlay that shows the moment card with share + dismiss actions.
/// Auto-dismisses after 10 seconds (managed by PartyProvider).
class MomentCardOverlay extends StatefulWidget {
  const MomentCardOverlay({
    super.key,
    required this.award,
    required this.vibe,
    required this.onDismiss,
    this.performerName,
    this.songTitle,
  });

  final String award;
  final PartyVibe vibe;
  final VoidCallback onDismiss;
  final String? performerName;
  final String? songTitle;

  @override
  State<MomentCardOverlay> createState() => _MomentCardOverlayState();
}

class _MomentCardOverlayState extends State<MomentCardOverlay>
    with SingleTickerProviderStateMixin {
  final GlobalKey _cardKey = GlobalKey();
  late final AnimationController _fadeController;
  late final CurvedAnimation _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _fadeController.forward();
  }

  @override
  void dispose() {
    _fadeAnimation.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  Future<void> _shareMomentCard() async {
    try {
      final boundary = _cardKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) return;

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );
      if (byteData == null) return;

      final pngBytes = byteData.buffer.asUint8List();

      // Track share intent as viral signal
      SocketClient.instance.emitMomentCardShared();

      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(
              pngBytes,
              mimeType: 'image/png',
              name: 'karamania-moment.png',
            ),
          ],
        ),
      );

      if (mounted) widget.onDismiss();
    } catch (e) {
      // Share sheet cancelled or failed — dismiss gracefully
      debugPrint('[MomentCardOverlay] Share failed: $e');
      if (mounted) widget.onDismiss();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Container(
        key: const Key('moment-card-overlay'),
        color: DJTokens.bgColor.withValues(alpha: 0.85),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              // Moment card with capture key
              Expanded(
                flex: 5,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: DJTokens.spaceXl,
                  ),
                  child: RepaintBoundary(
                    key: _cardKey,
                    child: MomentCard(
                      award: widget.award,
                      vibe: widget.vibe,
                      performerName: widget.performerName,
                      songTitle: widget.songTitle,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: DJTokens.spaceLg),
              // Share button — one tap, native share sheet
              DJTapButton(
                key: const Key('moment-card-share-btn'),
                tier: TapTier.social,
                onTap: _shareMomentCard,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.share,
                      color: DJTokens.textPrimary,
                      size: DJTokens.spaceLg,
                    ),
                    const SizedBox(width: DJTokens.spaceSm),
                    Text(
                      Copy.momentCardShare,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: DJTokens.spaceMd),
              // Dismiss tap target
              GestureDetector(
                key: const Key('moment-card-dismiss-btn'),
                onTap: widget.onDismiss,
                child: Padding(
                  padding: const EdgeInsets.all(DJTokens.spaceMd),
                  child: Text(
                    Copy.momentCardDismiss,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/emoji_text.dart';

class CeremonyDisplay extends StatefulWidget {
  const CeremonyDisplay({
    super.key,
    required this.performerName,
    required this.revealAt,
    required this.vibe,
    this.award,
    this.tone,
    this.songTitle,
  });

  final String? performerName;
  final int revealAt;
  final PartyVibe vibe;
  final String? award;
  final String? tone;
  final String? songTitle;

  @override
  State<CeremonyDisplay> createState() => _CeremonyDisplayState();
}

class _CeremonyDisplayState extends State<CeremonyDisplay>
    with TickerProviderStateMixin {
  bool _revealed = false;
  Timer? _revealTimer;
  late final AnimationController _anticipationController;
  late final AnimationController _revealController;
  late final CurvedAnimation _revealOpacity;
  late final CurvedAnimation _revealScale;

  @override
  void initState() {
    super.initState();
    _anticipationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    _revealController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _revealOpacity = CurvedAnimation(parent: _revealController, curve: Curves.easeOut);
    _revealScale = CurvedAnimation(parent: _revealController, curve: Curves.elasticOut);

    _scheduleReveal();
  }

  void _scheduleReveal() {
    final now = DateTime.now().millisecondsSinceEpoch;
    final delay = widget.revealAt - now;
    if (delay <= 0) {
      _doReveal();
    } else {
      _revealTimer = Timer(Duration(milliseconds: delay), _doReveal);
    }
  }

  void _doReveal() {
    if (!mounted) return;
    setState(() => _revealed = true);
    _anticipationController.stop();
    _revealController.forward();
  }

  @override
  void didUpdateWidget(CeremonyDisplay oldWidget) {
    super.didUpdateWidget(oldWidget);
    // If award arrives via ceremony:reveal event, trigger reveal immediately
    if (widget.award != null && oldWidget.award == null && !_revealed) {
      _revealTimer?.cancel();
      _doReveal();
    }
  }

  @override
  void dispose() {
    _revealTimer?.cancel();
    _revealOpacity.dispose();
    _revealScale.dispose();
    _anticipationController.dispose();
    _revealController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('ceremony-display'),
      child: Center(
        child: _revealed ? _buildReveal(context) : _buildAnticipation(context),
      ),
    );
  }

  Widget _buildAnticipation(BuildContext context) {
    return FadeTransition(
      key: const Key('ceremony-anticipation'),
      opacity: Tween<double>(begin: 0.4, end: 1.0).animate(_anticipationController),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.performerName != null) ...[
            Text(
              widget.performerName!,
              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    color: widget.vibe.accent,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceMd),
          ],
          Text(
            Copy.ceremonyAnticipation,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: DJTokens.textPrimary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildReveal(BuildContext context) {
    final award = widget.award ?? Copy.defaultAward;
    final vibeEmojis = vibeConfettiEmojis[widget.vibe] ?? vibeConfettiEmojis[PartyVibe.general]!;

    return FadeTransition(
      key: const Key('ceremony-reveal'),
      opacity: _revealOpacity,
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.5, end: 1.0).animate(_revealScale),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            // Radial glow behind award text
            Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    widget.vibe.glow.withValues(alpha: 0.3),
                    widget.vibe.glow.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
            // Scattered confetti emojis
            Positioned(top: -20, left: -30, child: EmojiText(vibeEmojis[0 % vibeEmojis.length], fontSize: 24)),
            Positioned(top: -10, right: -40, child: EmojiText(vibeEmojis[1 % vibeEmojis.length], fontSize: 20)),
            Positioned(bottom: -30, left: -50, child: EmojiText(vibeEmojis[2 % vibeEmojis.length], fontSize: 28)),
            Positioned(bottom: -20, right: -30, child: EmojiText(vibeEmojis[3 % vibeEmojis.length], fontSize: 22)),
            Positioned(top: 30, left: -60, child: EmojiText(vibeEmojis[4 % vibeEmojis.length], fontSize: 18)),
            // Main content column
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.performerName != null) ...[
                  Text(
                    widget.performerName!,
                    style: const TextStyle(
                      fontSize: 22,
                      color: DJTokens.textSecondary,
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceSm),
                ],
                // Award title — the star of the show
                Text(
                  award,
                  key: const Key('ceremony-award-title'),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.bold,
                    color: DJTokens.gold,
                  ),
                ),
                if (widget.songTitle != null) ...[
                  const SizedBox(height: DJTokens.spaceSm),
                  Text(
                    widget.songTitle!,
                    key: const Key('ceremony-song-title'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 16,
                      color: DJTokens.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: DJTokens.spaceMd),
                // Vibe award flavor text
                Text(
                  vibeAwardFlavors[widget.vibe] ?? '',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

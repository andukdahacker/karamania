import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/emoji_text.dart';

class QuickCeremonyDisplay extends StatefulWidget {
  const QuickCeremonyDisplay({
    super.key,
    required this.award,
    required this.vibe,
    this.performerName,
  });

  final String award;
  final PartyVibe vibe;
  final String? performerName;

  @override
  State<QuickCeremonyDisplay> createState() => _QuickCeremonyDisplayState();
}

class _QuickCeremonyDisplayState extends State<QuickCeremonyDisplay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final CurvedAnimation _fadeAnimation;
  late final CurvedAnimation _scaleAnimation;
  late final Animation<double> _scaleValue;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    // CurvedAnimation created in initState, NOT in build() — Story 3.3 code review fix M3
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _scaleAnimation = CurvedAnimation(parent: _controller, curve: Curves.elasticOut);
    _scaleValue = Tween<double>(begin: 0.7, end: 1.0).animate(_scaleAnimation);
    _controller.forward();
  }

  @override
  void dispose() {
    _fadeAnimation.dispose();
    _scaleAnimation.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vibeEmojis = vibeConfettiEmojis[widget.vibe] ?? vibeConfettiEmojis[PartyVibe.general]!;

    return Center(
      key: const Key('quick-ceremony-display'),
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: ScaleTransition(
          scale: _scaleValue,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Subtle radial glow behind award
              Container(
                width: 150,
                height: 150,
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
              // Scattered confetti (fewer for quick ceremony)
              Positioned(top: -15, left: -25, child: EmojiText(vibeEmojis[0 % vibeEmojis.length], fontSize: 20)),
              Positioned(top: -10, right: -30, child: EmojiText(vibeEmojis[1 % vibeEmojis.length], fontSize: 18)),
              Positioned(bottom: -20, right: -25, child: EmojiText(vibeEmojis[2 % vibeEmojis.length], fontSize: 22)),
              // Main content
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
                  Text(
                    widget.award,
                    key: const Key('quick-ceremony-award-title'),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: DJTokens.gold,
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceSm),
                  Text(
                    Copy.quickCeremonyLabel,
                    key: const Key('quick-ceremony-label'),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DJTokens.textSecondary.withValues(alpha: 0.6),
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

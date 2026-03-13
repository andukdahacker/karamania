import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';

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
    return Center(
      key: const Key('quick-ceremony-display'),
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: ScaleTransition(
          scale: _scaleValue,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.performerName != null) ...[
                Text(
                  widget.performerName!,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
                const SizedBox(height: DJTokens.spaceSm),
              ],
              Text(
                widget.award,
                key: const Key('quick-ceremony-award-title'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      color: widget.vibe.accent,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceSm),
              Text(
                Copy.quickCeremonyLabel,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

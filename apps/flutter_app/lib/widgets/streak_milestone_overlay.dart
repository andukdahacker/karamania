import 'dart:async';
import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Full-screen overlay that shows streak milestone notification.
/// Auto-dismisses after 2 seconds. Uses scale + fade animation.
class StreakMilestoneOverlay extends StatefulWidget {
  const StreakMilestoneOverlay({
    super.key,
    required this.streakCount,
    required this.emoji,
    required this.displayName,
    required this.onDismiss,
  });

  final int streakCount;
  final String emoji;
  final String displayName;
  final VoidCallback onDismiss;

  @override
  State<StreakMilestoneOverlay> createState() => _StreakMilestoneOverlayState();
}

class _StreakMilestoneOverlayState extends State<StreakMilestoneOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final CurvedAnimation _curvedAnimation;
  Timer? _autoDismissTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _curvedAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
    );
    _controller.forward();
    _autoDismissTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        _controller.reverse().then((_) {
          if (mounted) widget.onDismiss();
        });
      }
    });
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    _curvedAnimation.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      key: const Key('streak-milestone-overlay'),
      child: Center(
        child: ScaleTransition(
          scale: _curvedAnimation,
          child: FadeTransition(
            opacity: _controller,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.emoji,
                  style: const TextStyle(fontSize: 64),
                ),
                const SizedBox(height: DJTokens.spaceSm),
                Text(
                  Copy.streakMilestone(widget.displayName, widget.streakCount),
                  key: const Key('streak-milestone-text'),
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        color: DJTokens.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

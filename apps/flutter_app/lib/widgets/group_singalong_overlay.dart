import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class GroupSingAlongOverlay extends StatefulWidget {
  const GroupSingAlongOverlay({
    super.key,
    required this.card,
    required this.gameDurationMs,
    this.timerStartedAt,
  });

  final InterludeGameCard card;
  final int gameDurationMs;
  final int? timerStartedAt;

  @override
  State<GroupSingAlongOverlay> createState() => _GroupSingAlongOverlayState();
}

class _GroupSingAlongOverlayState extends State<GroupSingAlongOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final CurvedAnimation _fadeAnimation;
  Timer? _countdownTimer;
  int _remainingSeconds = 0;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _fadeController.forward();

    // Sync with server timer
    if (widget.timerStartedAt != null) {
      final elapsed =
          DateTime.now().millisecondsSinceEpoch - widget.timerStartedAt!;
      final remainingMs = widget.gameDurationMs - elapsed;
      _remainingSeconds = (remainingMs / 1000).ceil().clamp(0, 999);
    } else {
      _remainingSeconds = (widget.gameDurationMs / 1000).ceil();
    }
    _startCountdown();
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _remainingSeconds = (_remainingSeconds - 1).clamp(0, 999);
        });
        if (_remainingSeconds <= 0) {
          _countdownTimer?.cancel();
        }
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _fadeAnimation.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('singalong-overlay'),
      color: Colors.black.withValues(alpha: 0.85),
      child: SafeArea(
        child: Center(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: DJTokens.spaceLg),
              child: Container(
                padding: const EdgeInsets.all(DJTokens.spaceLg),
                decoration: BoxDecoration(
                  color: DJTokens.surfaceElevated,
                  borderRadius: BorderRadius.circular(DJTokens.spaceMd),
                  border: Border.all(
                    color: DJTokens.actionConfirm,
                    width: 2,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Subtitle
                    Text(
                      Copy.singAlongSubtitle,
                      style:
                          Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: DJTokens.textSecondary,
                              ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    // Emoji
                    Text(
                      widget.card.emoji,
                      style: const TextStyle(fontSize: 64),
                    ),
                    const SizedBox(height: DJTokens.spaceMd),
                    // Song title
                    Text(
                      widget.card.title,
                      key: const Key('singalong-title'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(
                            color: DJTokens.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    // Lyric snippet — italic to distinguish from Kings Cup rule text
                    Text(
                      '"${widget.card.rule}"',
                      key: const Key('singalong-lyric'),
                      textAlign: TextAlign.center,
                      style:
                          Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: DJTokens.textSecondary,
                                fontStyle: FontStyle.italic,
                              ),
                    ),
                    const SizedBox(height: DJTokens.spaceLg),
                    // Countdown
                    Text(
                      '${_remainingSeconds}s',
                      key: const Key('singalong-countdown'),
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(
                            color: DJTokens.textSecondary,
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
}

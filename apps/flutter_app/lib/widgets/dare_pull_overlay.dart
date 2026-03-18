import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/audio/audio_engine.dart';
import 'package:karamania/audio/sound_cue.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:provider/provider.dart';

class DarePullOverlay extends StatefulWidget {
  const DarePullOverlay({
    super.key,
    required this.card,
    required this.gameDurationMs,
    required this.targetDisplayName,
    this.timerStartedAt,
  });

  final InterludeGameCard card;
  final int gameDurationMs;
  final String targetDisplayName;
  final int? timerStartedAt;

  @override
  State<DarePullOverlay> createState() => _DarePullOverlayState();
}

class _DarePullOverlayState extends State<DarePullOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleController;
  late final CurvedAnimation _scaleAnimation;
  Timer? _countdownTimer;
  late int _remainingSeconds;

  // Slot-machine animation state
  Timer? _slotTimer;
  bool _slotComplete = false;
  String _displayedName = '';
  int _slotTicks = 0;
  int _currentIntervalMs = 50;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _scaleAnimation = CurvedAnimation(
      parent: _scaleController,
      curve: Curves.elasticOut,
    );
    _scaleController.forward();

    // Sync countdown with server timer
    final totalSeconds = (widget.gameDurationMs / 1000).ceil();
    if (widget.timerStartedAt != null) {
      final elapsed =
          DateTime.now().millisecondsSinceEpoch - widget.timerStartedAt!;
      final remainingMs = widget.gameDurationMs - elapsed;
      _remainingSeconds = (remainingMs / 1000).ceil().clamp(0, 999);
    } else {
      _remainingSeconds = totalSeconds;
    }

    _startSlotMachine();
    _startCountdown();
  }

  void _startSlotMachine() {
    final participants =
        context.read<PartyProvider>().participants;
    final names = participants.map((p) => p.displayName).toList();
    if (names.isEmpty) {
      _displayedName = widget.targetDisplayName;
      _slotComplete = true;
      return;
    }

    _displayedName = names.first;
    _slotTicks = 0;
    _currentIntervalMs = 50;
    _scheduleNextSlotTick(names);
  }

  void _scheduleNextSlotTick(List<String> names) {
    _slotTimer = Timer(Duration(milliseconds: _currentIntervalMs), () {
      if (!mounted) return;
      _slotTicks++;

      // Double interval every 4 ticks: 50→100→200→400ms
      if (_slotTicks % 4 == 0) {
        _currentIntervalMs *= 2;
      }

      // End after ~2.5s worth of ticks (intervals sum to ~2.5s)
      if (_currentIntervalMs > 400) {
        setState(() {
          _displayedName = widget.targetDisplayName;
          _slotComplete = true;
        });
        AudioEngine.instance.play(SoundCue.uiTap);
        return;
      }

      setState(() {
        _displayedName = names[_slotTicks % names.length];
      });

      _scheduleNextSlotTick(names);
    });
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
    _slotTimer?.cancel();
    _scaleAnimation.dispose();
    _scaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('dare-pull-overlay'),
      color: Colors.black.withValues(alpha: 0.85),
      child: SafeArea(
        child: Center(
          child: ScaleTransition(
            scale: _scaleAnimation,
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
                      Copy.darePullSubtitle,
                      style:
                          Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: DJTokens.textSecondary,
                              ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    // Target prefix
                    Text(
                      Copy.darePullTargetPrefix,
                      style:
                          Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: DJTokens.textSecondary,
                              ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    // Target name (slot-machine or final)
                    Text(
                      _displayedName,
                      key: const Key('dare-pull-target-name'),
                      textAlign: TextAlign.center,
                      style: Theme.of(context)
                          .textTheme
                          .headlineLarge
                          ?.copyWith(
                            color: DJTokens.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceMd),
                    // Dare card (shown after slot-machine completes)
                    if (_slotComplete) ...[
                      Container(
                        key: const Key('dare-pull-dare-card'),
                        padding: const EdgeInsets.all(DJTokens.spaceMd),
                        decoration: BoxDecoration(
                          color: DJTokens.surfaceColor,
                          borderRadius:
                              BorderRadius.circular(DJTokens.spaceSm),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Emoji
                            Text(
                              widget.card.emoji,
                              style: const TextStyle(fontSize: 64),
                            ),
                            const SizedBox(height: DJTokens.spaceSm),
                            // Title
                            Text(
                              widget.card.title,
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
                            // Dare description
                            Text(
                              widget.card.rule,
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyLarge
                                  ?.copyWith(
                                    color: DJTokens.textSecondary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: DJTokens.spaceLg),
                    ],
                    // Countdown
                    Text(
                      '${_remainingSeconds}s',
                      key: const Key('dare-pull-countdown'),
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

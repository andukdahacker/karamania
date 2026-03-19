import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class IcebreakerOverlay extends StatefulWidget {
  const IcebreakerOverlay({
    super.key,
    required this.question,
    required this.options,
    required this.voteDurationMs,
    required this.onVote,
    this.myVote,
    this.result,
    this.winnerOptionId,
    this.timerStartedAt,
  });

  final String question;
  final List<IcebreakerOption> options;
  final int voteDurationMs;
  final void Function(String optionId) onVote;
  final String? myVote;
  final Map<String, int>? result;
  final String? winnerOptionId;
  final int? timerStartedAt;

  @override
  State<IcebreakerOverlay> createState() => _IcebreakerOverlayState();
}

class _IcebreakerOverlayState extends State<IcebreakerOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final CurvedAnimation _fadeAnimation;
  Timer? _countdownTimer;
  late int _remainingSeconds;

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
      final remainingMs = widget.voteDurationMs - elapsed;
      _remainingSeconds = (remainingMs / 1000).ceil().clamp(0, 999);
    } else {
      _remainingSeconds = (widget.voteDurationMs / 1000).ceil();
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
  void didUpdateWidget(covariant IcebreakerOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Stop countdown when results arrive
    if (oldWidget.result == null && widget.result != null) {
      _countdownTimer?.cancel();
    }
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
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Container(
        key: const Key('icebreaker-overlay'),
        color: Colors.black.withValues(alpha: 0.85),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: DJTokens.spaceLg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Subtitle
                  Text(
                    Copy.icebreakerSubtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DJTokens.textSecondary,
                          letterSpacing: 2,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  // Question
                  Text(
                    widget.question,
                    key: const Key('icebreaker-question'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(
                          color: DJTokens.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceLg),
                  // Phase-specific content
                  if (widget.result != null)
                    _buildResults(context)
                  else
                    _buildOptions(context),
                  const SizedBox(height: DJTokens.spaceLg),
                  // Countdown or waiting text
                  if (widget.result == null) ...[
                    Text(
                      '${_remainingSeconds}s',
                      key: const Key('icebreaker-countdown'),
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                    ),
                    if (widget.myVote != null) ...[
                      const SizedBox(height: DJTokens.spaceSm),
                      Text(
                        Copy.icebreakerWaiting,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                    ],
                    if (widget.myVote == null) ...[
                      const SizedBox(height: DJTokens.spaceMd),
                      Text(
                        Copy.icebreakerNote,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOptions(BuildContext context) {
    return Wrap(
      spacing: DJTokens.spaceMd,
      runSpacing: DJTokens.spaceMd,
      alignment: WrapAlignment.center,
      children: widget.options.map((option) {
        final isSelected = widget.myVote == option.id;
        final isDimmed = widget.myVote != null && !isSelected;

        return SizedBox(
          width: (MediaQuery.of(context).size.width - DJTokens.spaceLg * 2 - DJTokens.spaceMd) / 2,
          child: GestureDetector(
            key: Key('icebreaker-option-${option.id}'),
            onTap: widget.myVote == null ? () => widget.onVote(option.id) : null,
            child: AnimatedOpacity(
              opacity: isDimmed ? 0.4 : 1.0,
              duration: const Duration(milliseconds: 200),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  vertical: DJTokens.spaceMd,
                  horizontal: DJTokens.spaceSm,
                ),
                decoration: BoxDecoration(
                  color: isSelected
                      ? DJTokens.actionConfirm.withValues(alpha: 0.2)
                      : DJTokens.surfaceElevated,
                  borderRadius: BorderRadius.circular(DJTokens.spaceSm),
                  border: Border.all(
                    color: isSelected
                        ? DJTokens.actionConfirm
                        : DJTokens.textSecondary.withValues(alpha: 0.3),
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      option.emoji,
                      style: const TextStyle(fontSize: 32),
                    ),
                    const SizedBox(height: DJTokens.spaceXs),
                    Text(
                      option.label,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: DJTokens.textPrimary,
                            fontWeight: isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildResults(BuildContext context) {
    final result = widget.result!;
    final totalVotes = result.values.fold(0, (sum, v) => sum + v);
    final total = totalVotes > 0 ? totalVotes : 1;

    return Container(
      key: const Key('icebreaker-result'),
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated,
        borderRadius: BorderRadius.circular(DJTokens.spaceSm),
      ),
      child: Column(
        children: [
          for (var i = 0; i < widget.options.length; i++) ...[
            if (i > 0) const SizedBox(height: DJTokens.spaceMd),
            _buildResultBar(
              context,
              widget.options[i],
              result[widget.options[i].id] ?? 0,
              (result[widget.options[i].id] ?? 0) / total,
              widget.options[i].id == widget.winnerOptionId,
              delay: i,
            ),
          ],
          const SizedBox(height: DJTokens.spaceMd),
          Text(
            '$totalVotes votes',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DJTokens.textSecondary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultBar(BuildContext context, IcebreakerOption option,
      int count, double fraction, bool isWinner, {int delay = 0}) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 400 + delay * 200),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: child,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(option.emoji, style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: DJTokens.spaceXs),
                  Text(
                    option.label,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: DJTokens.textPrimary,
                          fontWeight:
                              isWinner ? FontWeight.bold : FontWeight.normal,
                        ),
                  ),
                ],
              ),
              Text(
                '$count',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: DJTokens.textPrimary,
                      fontWeight:
                          isWinner ? FontWeight.bold : FontWeight.normal,
                    ),
              ),
            ],
          ),
          const SizedBox(height: DJTokens.spaceXs),
          ClipRRect(
            borderRadius: BorderRadius.circular(DJTokens.spaceXs),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 12,
              backgroundColor: DJTokens.surfaceColor,
              color:
                  isWinner ? DJTokens.actionConfirm : DJTokens.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

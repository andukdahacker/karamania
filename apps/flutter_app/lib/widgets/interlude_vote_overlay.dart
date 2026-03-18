import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class InterludeVoteOverlay extends StatefulWidget {
  const InterludeVoteOverlay({
    super.key,
    required this.options,
    required this.voteCounts,
    required this.myVote,
    required this.winnerOptionId,
    required this.timerDurationMs,
    this.timerStartedAt,
    required this.onVote,
  });

  final List<InterludeOption> options;
  final Map<String, int> voteCounts;
  final String? myVote;
  final String? winnerOptionId;
  final int timerDurationMs;
  final int? timerStartedAt;
  final void Function(String optionId) onVote;

  @override
  State<InterludeVoteOverlay> createState() => _InterludeVoteOverlayState();
}

class _InterludeVoteOverlayState extends State<InterludeVoteOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final CurvedAnimation _fadeAnimation;
  Timer? _countdownTimer;
  int _remainingSeconds = 15;

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

    // Sync with server timer if timerStartedAt is available
    if (widget.timerStartedAt != null) {
      final elapsed = DateTime.now().millisecondsSinceEpoch - widget.timerStartedAt!;
      final remainingMs = widget.timerDurationMs - elapsed;
      _remainingSeconds = (remainingMs / 1000).ceil().clamp(0, 999);
    } else {
      _remainingSeconds = (widget.timerDurationMs / 1000).ceil();
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
    final hasWinner = widget.winnerOptionId != null;

    return FadeTransition(
      opacity: _fadeAnimation,
      child: Container(
        key: const Key('interlude-vote-overlay'),
        color: Colors.black.withValues(alpha: 0.85),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: DJTokens.spaceLg),
              // Title
              Text(
                Copy.interludeVotingTitle,
                key: const Key('interlude-vote-title'),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: DJTokens.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceXs),
              Text(
                Copy.interludeVotingSubtitle,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceSm),
              // Status
              if (hasWinner)
                Text(
                  Copy.interludeVoteSelected,
                  key: const Key('interlude-vote-status'),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DJTokens.actionConfirm,
                      ),
                )
              else if (_remainingSeconds <= 0)
                Text(
                  Copy.interludeVotingSubtitle,
                  key: const Key('interlude-vote-status'),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                )
              else
                Text(
                  '${_remainingSeconds}s',
                  key: const Key('interlude-vote-countdown'),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              const SizedBox(height: DJTokens.spaceLg),
              // Activity option cards
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceMd),
                  itemCount: widget.options.length,
                  itemBuilder: (context, index) {
                    final option = widget.options[index];
                    final voteCount = widget.voteCounts[option.id] ?? 0;
                    final isMyVote = widget.myVote == option.id;
                    final isWinner = widget.winnerOptionId == option.id;

                    return _ActivityCard(
                      key: Key('interlude-vote-option-${option.id}'),
                      option: option,
                      voteCount: voteCount,
                      isMyVote: isMyVote,
                      isWinner: isWinner,
                      hasWinner: hasWinner,
                      onTap: hasWinner ? null : () => widget.onVote(option.id),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({
    super.key,
    required this.option,
    required this.voteCount,
    required this.isMyVote,
    required this.isWinner,
    required this.hasWinner,
    this.onTap,
  });

  final InterludeOption option;
  final int voteCount;
  final bool isMyVote;
  final bool isWinner;
  final bool hasWinner;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = isWinner
        ? DJTokens.actionConfirm
        : isMyVote
            ? DJTokens.textPrimary
            : DJTokens.surfaceElevated;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: DJTokens.spaceMd),
        padding: const EdgeInsets.all(DJTokens.spaceMd),
        decoration: BoxDecoration(
          color: isWinner
              ? DJTokens.actionConfirm.withValues(alpha: 0.15)
              : DJTokens.surfaceElevated,
          borderRadius: BorderRadius.circular(DJTokens.spaceMd),
          border: Border.all(
            color: borderColor,
            width: (isWinner || isMyVote) ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            // Activity icon
            Text(
              option.icon,
              style: const TextStyle(fontSize: 40),
            ),
            const SizedBox(width: DJTokens.spaceMd),
            // Activity info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    option.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: DJTokens.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: DJTokens.spaceXs),
                  Text(
                    option.description,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: DJTokens.textSecondary,
                        ),
                  ),
                  if (voteCount > 0) ...[
                    const SizedBox(height: DJTokens.spaceXs),
                    Text(
                      '$voteCount ${Copy.interludeVotesLabel}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isWinner
                                ? DJTokens.actionConfirm
                                : DJTokens.textSecondary,
                            fontWeight: isWinner ? FontWeight.bold : null,
                          ),
                    ),
                  ],
                  if (isWinner) ...[
                    const SizedBox(height: DJTokens.spaceXs),
                    Text(
                      Copy.interludeVoteSelected,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: DJTokens.actionConfirm,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            // Vote indicator
            if (isMyVote && !hasWinner)
              const Icon(
                Icons.check_circle,
                color: DJTokens.actionConfirm,
                size: 28,
              ),
          ],
        ),
      ),
    );
  }
}

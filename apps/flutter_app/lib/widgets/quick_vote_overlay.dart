import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Duration of the results reveal phase in seconds.
/// Must match server-side QUICK_VOTE_REVEAL_DURATION_MS (5000ms) in session-manager.ts.
const int _quickVoteRevealDurationS = 5;

class QuickVoteOverlay extends StatefulWidget {
  const QuickVoteOverlay({
    super.key,
    required this.card,
    required this.quickVoteOptions,
    required this.gameDurationMs,
    required this.onVote,
    this.myQuickVote,
    this.quickVoteResult,
    this.timerStartedAt,
  });

  final InterludeGameCard card;
  final List<QuickVoteOption> quickVoteOptions;
  final int gameDurationMs;
  final void Function(String option) onVote;
  final String? myQuickVote;
  final QuickVoteResult? quickVoteResult;
  final int? timerStartedAt;

  @override
  State<QuickVoteOverlay> createState() => _QuickVoteOverlayState();
}

class _QuickVoteOverlayState extends State<QuickVoteOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final CurvedAnimation _fadeAnimation;
  Timer? _countdownTimer;
  late int _remainingSeconds;
  bool _inResultsPhase = false;

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

    // Check if we're already in results phase on mount
    if (widget.quickVoteResult != null) {
      _inResultsPhase = true;
      _remainingSeconds = _quickVoteRevealDurationS;
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
  void didUpdateWidget(covariant QuickVoteOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Transition to results phase when result arrives
    if (oldWidget.quickVoteResult == null && widget.quickVoteResult != null) {
      _countdownTimer?.cancel();
      setState(() {
        _inResultsPhase = true;
        _remainingSeconds = _quickVoteRevealDurationS;
      });
      _startCountdown();
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
        key: const Key('quick-vote-overlay'),
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
                    _inResultsPhase
                        ? Copy.quickVoteTitle
                        : Copy.quickVoteSubtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
                  // Question
                  Text(
                    widget.card.title,
                    key: const Key('quick-vote-question'),
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
                  if (_inResultsPhase && widget.quickVoteResult != null)
                    _buildResults(context)
                  else
                    _buildVotingButtons(context),
                  const SizedBox(height: DJTokens.spaceLg),
                  // Countdown
                  Text(
                    '${_remainingSeconds}s',
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
    );
  }

  Widget _buildVotingButtons(BuildContext context) {
    if (widget.quickVoteOptions.length < 2) {
      return const SizedBox.shrink();
    }

    final optionA = widget.quickVoteOptions[0];
    final optionB = widget.quickVoteOptions[1];

    return Column(
      children: [
        _buildOptionButton(context, optionA.id, optionA.label,
            const Key('quick-vote-option-a')),
        const SizedBox(height: DJTokens.spaceMd),
        _buildOptionButton(context, optionB.id, optionB.label,
            const Key('quick-vote-option-b')),
      ],
    );
  }

  Widget _buildOptionButton(
      BuildContext context, String optionId, String label, Key key) {
    final isSelected = widget.myQuickVote == optionId;

    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        key: key,
        onPressed: () => widget.onVote(optionId),
        style: ElevatedButton.styleFrom(
          backgroundColor:
              isSelected ? DJTokens.actionConfirm : DJTokens.surfaceElevated,
          foregroundColor:
              isSelected ? Colors.white : DJTokens.textPrimary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DJTokens.spaceSm),
            side: BorderSide(
              color:
                  isSelected ? DJTokens.actionConfirm : DJTokens.textSecondary,
              width: isSelected ? 2 : 1,
            ),
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : DJTokens.textPrimary,
              ),
        ),
      ),
    );
  }

  Widget _buildResults(BuildContext context) {
    final result = widget.quickVoteResult!;
    if (widget.quickVoteOptions.length < 2) {
      return const SizedBox.shrink();
    }

    final labelA = widget.quickVoteOptions[0].label;
    final labelB = widget.quickVoteOptions[1].label;
    final total = result.totalVotes > 0 ? result.totalVotes : 1;
    final fractionA = result.optionACounts / total;
    final fractionB = result.optionBCounts / total;
    final winnerIsA = result.optionACounts > result.optionBCounts;
    final winnerIsB = result.optionBCounts > result.optionACounts;

    return Container(
      key: const Key('quick-vote-results'),
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated,
        borderRadius: BorderRadius.circular(DJTokens.spaceSm),
      ),
      child: Column(
        children: [
          _buildResultBar(
              context, labelA, result.optionACounts, fractionA, winnerIsA),
          const SizedBox(height: DJTokens.spaceMd),
          _buildResultBar(
              context, labelB, result.optionBCounts, fractionB, winnerIsB),
        ],
      ),
    );
  }

  Widget _buildResultBar(BuildContext context, String label, int count,
      double fraction, bool isWinner) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: DJTokens.textPrimary,
                    fontWeight:
                        isWinner ? FontWeight.bold : FontWeight.normal,
                  ),
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
            color: isWinner ? DJTokens.actionConfirm : DJTokens.textSecondary,
          ),
        ),
      ],
    );
  }
}

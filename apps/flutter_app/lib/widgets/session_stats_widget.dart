import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/session_stats.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/theme/dj_theme.dart';

class SessionStatsWidget extends StatefulWidget {
  const SessionStatsWidget({
    super.key,
    required this.stats,
    required this.vibe,
  });

  final SessionStats stats;
  final PartyVibe vibe;

  @override
  State<SessionStatsWidget> createState() => _SessionStatsWidgetState();
}

class _SessionStatsWidgetState extends State<SessionStatsWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

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
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  String _formatDuration(int ms) {
    final totalMinutes = ms ~/ 60000;
    final hours = totalMinutes ~/ 60;
    final minutes = totalMinutes % 60;
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }

  @override
  Widget build(BuildContext context) {
    final stats = widget.stats;
    return FadeTransition(
      opacity: _fadeAnimation,
      child: SingleChildScrollView(
        key: const Key('session-stats'),
        child: Column(
          children: [
            Text(
              Copy.finaleStatsTitle,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: widget.vibe.accent,
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceLg),
            Wrap(
              spacing: DJTokens.spaceMd,
              runSpacing: DJTokens.spaceMd,
              children: [
                _StatCard(
                  label: Copy.finaleSongsLabel,
                  value: '${stats.songCount}',
                  vibe: widget.vibe,
                ),
                _StatCard(
                  label: Copy.finaleReactionsLabel,
                  value: '${stats.totalReactions}',
                  vibe: widget.vibe,
                ),
                _StatCard(
                  label: Copy.finaleParticipantsLabel,
                  value: '${stats.participantCount}',
                  vibe: widget.vibe,
                ),
                _StatCard(
                  label: Copy.finaleDurationLabel,
                  value: _formatDuration(stats.sessionDurationMs),
                  vibe: widget.vibe,
                ),
                if (stats.totalSoundboardPlays > 0)
                  _StatCard(
                    label: Copy.finaleSoundboardLabel,
                    value: '${stats.totalSoundboardPlays}',
                    vibe: widget.vibe,
                  ),
                if (stats.totalCardsDealt > 0)
                  _StatCard(
                    label: Copy.finaleCardsLabel,
                    value: '${stats.totalCardsDealt}',
                    vibe: widget.vibe,
                  ),
              ],
            ),
            if (stats.topReactor != null) ...[
              const SizedBox(height: DJTokens.spaceLg),
              _HighlightRow(
                label: Copy.finaleTopReactorLabel,
                value:
                    '${stats.topReactor!.displayName} — ${stats.topReactor!.count} reactions',
                vibe: widget.vibe,
              ),
            ],
            if (stats.longestStreak > 1) ...[
              const SizedBox(height: DJTokens.spaceSm),
              _HighlightRow(
                label: Copy.finaleLongestStreakLabel,
                value: '${stats.longestStreak}',
                vibe: widget.vibe,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.vibe,
  });

  final String label;
  final String value;
  final PartyVibe vibe;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: vibe.accent.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  color: vibe.accent,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: DJTokens.spaceXs),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DJTokens.textSecondary,
                ),
          ),
        ],
      ),
    );
  }
}

class _HighlightRow extends StatelessWidget {
  const _HighlightRow({
    required this.label,
    required this.value,
    required this.vibe,
  });

  final String label;
  final String value;
  final PartyVibe vibe;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DJTokens.spaceMd,
        vertical: DJTokens.spaceSm,
      ),
      decoration: BoxDecoration(
        color: vibe.accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: DJTokens.textSecondary,
                ),
          ),
          const SizedBox(width: DJTokens.spaceSm),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: vibe.accent,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
    );
  }
}

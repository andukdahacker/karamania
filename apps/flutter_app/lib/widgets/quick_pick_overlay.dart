import 'dart:async';

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class QuickPickOverlay extends StatefulWidget {
  const QuickPickOverlay({
    super.key,
    required this.songs,
    required this.votes,
    required this.myVotes,
    required this.winnerId,
    required this.participantCount,
    required this.timerDurationMs,
    required this.onVote,
  });

  final List<QuickPickSong> songs;
  final Map<String, VoteTally> votes;
  final Map<String, String> myVotes;
  final String? winnerId;
  final int participantCount;
  final int timerDurationMs;
  final void Function(String catalogTrackId, String vote) onVote;

  @override
  State<QuickPickOverlay> createState() => _QuickPickOverlayState();
}

class _QuickPickOverlayState extends State<QuickPickOverlay>
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

    _remainingSeconds = (widget.timerDurationMs / 1000).ceil();
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
    final hasWinner = widget.winnerId != null;

    return FadeTransition(
      opacity: _fadeAnimation,
      child: Container(
        key: const Key('quick-pick-overlay'),
        color: Colors.black.withValues(alpha: 0.85),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: DJTokens.spaceLg),
              // Title
              Text(
                Copy.quickPickTitle,
                key: const Key('quick-pick-title'),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: DJTokens.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: DJTokens.spaceSm),
              // Countdown or deciding
              if (hasWinner)
                Text(
                  Copy.quickPickSelected,
                  key: const Key('quick-pick-status'),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DJTokens.actionConfirm,
                      ),
                )
              else if (_remainingSeconds <= 0)
                Text(
                  Copy.quickPickDeciding,
                  key: const Key('quick-pick-status'),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                )
              else
                Text(
                  '${_remainingSeconds}s',
                  key: const Key('quick-pick-countdown'),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                ),
              const SizedBox(height: DJTokens.spaceMd),
              // Song cards
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceMd),
                  itemCount: widget.songs.length,
                  itemBuilder: (context, index) {
                    final song = widget.songs[index];
                    return _SongCard(
                      key: Key('quick-pick-song-${song.catalogTrackId}'),
                      song: song,
                      votes: widget.votes[song.catalogTrackId],
                      myVote: widget.myVotes[song.catalogTrackId],
                      isWinner: widget.winnerId == song.catalogTrackId,
                      hasWinner: hasWinner,
                      participantCount: widget.participantCount,
                      onVote: (vote) => widget.onVote(song.catalogTrackId, vote),
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

class _SongCard extends StatelessWidget {
  const _SongCard({
    super.key,
    required this.song,
    this.votes,
    this.myVote,
    required this.isWinner,
    required this.hasWinner,
    required this.participantCount,
    required this.onVote,
  });

  final QuickPickSong song;
  final VoteTally? votes;
  final String? myVote;
  final bool isWinner;
  final bool hasWinner;
  final int participantCount;
  final void Function(String vote) onVote;

  @override
  Widget build(BuildContext context) {
    final borderColor = isWinner
        ? DJTokens.actionConfirm
        : DJTokens.surfaceElevated;
    final upVotes = votes?.up ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: DJTokens.spaceSm),
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated,
        borderRadius: BorderRadius.circular(DJTokens.spaceMd),
        border: Border.all(
          color: borderColor,
          width: isWinner ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          // Thumbnail
          ClipRRect(
            borderRadius: BorderRadius.circular(DJTokens.spaceSm),
            child: Image.network(
              'https://img.youtube.com/vi/${song.youtubeVideoId}/mqdefault.jpg',
              width: 80,
              height: 60,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 80,
                height: 60,
                color: DJTokens.surfaceColor,
                child: const Icon(Icons.music_note, color: DJTokens.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: DJTokens.spaceMd),
          // Song info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  song.songTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: DJTokens.textPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: DJTokens.spaceXs),
                Text(
                  song.artist,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (song.overlapCount > 0) ...[
                  const SizedBox(height: DJTokens.spaceXs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DJTokens.spaceSm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: DJTokens.actionConfirm.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(DJTokens.spaceSm),
                    ),
                    child: Text(
                      '${song.overlapCount}/$participantCount ${Copy.quickPickOverlapBadge}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: DJTokens.actionConfirm,
                          ),
                    ),
                  ),
                ],
                if (upVotes > 0) ...[
                  const SizedBox(height: DJTokens.spaceXs),
                  Text(
                    '$upVotes votes',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: DJTokens.textSecondary,
                        ),
                  ),
                ],
                if (isWinner) ...[
                  const SizedBox(height: DJTokens.spaceXs),
                  Text(
                    Copy.quickPickSelected,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: DJTokens.actionConfirm,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ],
              ],
            ),
          ),
          // Vote buttons
          if (!hasWinner) ...[
            _VoteButton(
              key: Key('vote-up-${song.catalogTrackId}'),
              icon: Icons.thumb_up,
              label: Copy.quickPickVoteUp,
              isSelected: myVote == 'up',
              color: DJTokens.actionConfirm,
              onTap: () => onVote('up'),
            ),
            const SizedBox(width: DJTokens.spaceSm),
            _VoteButton(
              key: Key('vote-skip-${song.catalogTrackId}'),
              icon: Icons.skip_next,
              label: Copy.quickPickSkip,
              isSelected: myVote == 'skip',
              color: DJTokens.textSecondary,
              onTap: () => onVote('skip'),
            ),
          ],
        ],
      ),
    );
  }
}

class _VoteButton extends StatelessWidget {
  const _VoteButton({
    super.key,
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isSelected ? color : color.withValues(alpha: 0.4),
            size: 28,
          ),
        ],
      ),
    );
  }
}

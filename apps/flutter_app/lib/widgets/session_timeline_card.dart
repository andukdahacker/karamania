import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class SessionTimelineCard extends StatelessWidget {
  const SessionTimelineCard({
    required this.session,
    required this.onTap,
    super.key,
  });

  final SessionTimelineItem session;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final venueName = session.venueName ?? Copy.karaokeNight;
    final dateText = _formatDate(session.endedAt);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        key: Key('session-card-${session.id}'),
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.all(DJTokens.spaceMd),
        decoration: BoxDecoration(
          color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: DJTokens.textSecondary.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          children: [
            _buildThumbnail(),
            const SizedBox(width: DJTokens.spaceMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    venueName,
                    style: Theme.of(context).textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: DJTokens.spaceXs),
                  Row(
                    children: [
                      Text(
                        dateText,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                      const SizedBox(width: DJTokens.spaceSm),
                      Icon(
                        Icons.people_outline,
                        size: 14,
                        color: DJTokens.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${session.participantCount}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                    ],
                  ),
                  if (session.topAward != null) ...[
                    const SizedBox(height: DJTokens.spaceXs),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: DJTokens.spaceSm,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: DJTokens.actionConfirm.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        session.topAward!,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: DJTokens.actionConfirm,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThumbnail() {
    if (session.thumbnailUrl != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          session.thumbnailUrl!,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _placeholderIcon(),
        ),
      );
    }
    return _placeholderIcon();
  }

  Widget _placeholderIcon() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(
        Icons.music_note,
        color: DJTokens.textSecondary,
        size: 24,
      ),
    );
  }

  String _formatDate(String? isoDate) {
    if (isoDate == null) return '';
    try {
      final date = DateTime.parse(isoDate).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return '${months[date.month - 1]} ${date.day}, ${date.year}';
    } catch (_) {
      return '';
    }
  }
}

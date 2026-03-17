import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

class NowPlayingBar extends StatelessWidget {
  const NowPlayingBar({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PartyProvider>();
    if (!provider.hasDetectedSong) return const SizedBox.shrink();

    return Container(
      key: const Key('now-playing-bar'),
      padding: const EdgeInsets.symmetric(
        horizontal: DJTokens.spaceMd,
        vertical: DJTokens.spaceSm,
      ),
      decoration: BoxDecoration(
        color: DJTokens.surfaceColor.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(DJTokens.spaceSm),
      ),
      child: Row(
        children: [
          if (provider.detectedThumbnail != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(DJTokens.spaceXs),
              child: Image.network(
                provider.detectedThumbnail!,
                width: 40,
                height: 40,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.music_note,
                  size: 40,
                  color: DJTokens.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: DJTokens.spaceSm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  Copy.nowPlaying,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: DJTokens.textSecondary,
                        fontSize: 10,
                      ),
                ),
                Text(
                  provider.detectedSongTitle ?? Copy.unknownSong,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: DJTokens.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  provider.detectedArtist ?? Copy.unknownArtist,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const Icon(
            Icons.graphic_eq,
            size: 16,
            color: DJTokens.textSecondary,
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/emoji_text.dart';

class SongInfoDisplay extends StatelessWidget {
  const SongInfoDisplay({
    super.key,
    required this.songTitle,
    required this.artist,
    this.performerName,
    required this.vibeAccent,
  });

  final String songTitle;
  final String artist;
  final String? performerName;
  final Color vibeAccent;

  @override
  Widget build(BuildContext context) {
    final showPerformer = performerName != null && performerName!.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: DJTokens.spaceLg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            songTitle,
            key: const Key('song-info-title'),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: DJTokens.gold,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: DJTokens.spaceSm),
          Text(
            artist,
            key: const Key('song-info-artist'),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w400,
              color: DJTokens.textSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (showPerformer) ...[
            const SizedBox(height: DJTokens.spaceMd),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const EmojiText('🎤', fontSize: 18),
                const SizedBox(width: DJTokens.spaceXs),
                Flexible(
                  child: Text(
                    '$performerName ${Copy.isSinging}',
                    key: const Key('song-info-performer'),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: vibeAccent,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:karamania/constants/copy.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Prominent display of the selected song in suggestion-only mode.
/// Shows song title, artist, and "Mark as Playing" button for host.
/// Visible during `song` DJ state when no TV is paired.
class SelectedSongDisplay extends StatelessWidget {
  const SelectedSongDisplay({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PartyProvider>();
    if (!provider.hasLastQueuedSong) return const SizedBox.shrink();

    return Container(
      key: const Key('selected-song-display'),
      padding: EdgeInsets.all(DJTokens.spaceMd),
      decoration: BoxDecoration(
        color: DJTokens.surfaceColor.withAlpha(230),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            Copy.upNext,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: DJTokens.textSecondary,
            ),
          ),
          SizedBox(height: DJTokens.spaceXs),
          Text(
            provider.lastQueuedSongTitle ?? Copy.unknownSong,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: DJTokens.textPrimary,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: DJTokens.spaceXs),
          Text(
            provider.lastQueuedArtist ?? Copy.unknownArtist,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: DJTokens.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: DJTokens.spaceSm),
          Text(
            Copy.enterOnKaraokeMachine,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: DJTokens.textSecondary,
              fontStyle: FontStyle.italic,
            ),
          ),
          // Host-only: Mark as Playing button
          if (provider.isHost) ...[
            SizedBox(height: DJTokens.spaceMd),
            ElevatedButton.icon(
              key: const Key('mark-as-playing-button'),
              onPressed: provider.hasDetectedSong
                  ? null // Already marked/detected
                  : () {
                      SocketClient.instance.markSongAsPlaying();
                    },
              icon: const Icon(Icons.play_circle_outline),
              label: Text(
                provider.hasDetectedSong
                    ? Copy.songMarkedPlaying
                    : Copy.markAsPlaying,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

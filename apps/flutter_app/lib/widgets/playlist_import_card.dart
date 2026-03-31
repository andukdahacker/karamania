import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/spotify_guide.dart';

class PlaylistImportCard extends StatefulWidget {
  const PlaylistImportCard({super.key = const Key('playlist-import-card')});

  @override
  State<PlaylistImportCard> createState() => _PlaylistImportCardState();
}

class _PlaylistImportCardState extends State<PlaylistImportCard> {
  final _urlController = TextEditingController();
  final _manualTitleController = TextEditingController();
  final _manualArtistController = TextEditingController();
  String? _detectedPlatform;
  bool _isPrivateError = false;
  bool _showManualEntry = false;

  @override
  void dispose() {
    _urlController.dispose();
    _manualTitleController.dispose();
    _manualArtistController.dispose();
    super.dispose();
  }

  void _onUrlChanged(String value) {
    String? platform;
    if (value.contains('open.spotify.com/playlist') ||
        value.contains('spotify.com/playlist')) {
      platform = 'spotify';
    } else if (value.contains('music.youtube.com') ||
        (value.contains('youtube.com') && value.contains('list='))) {
      platform = 'youtube';
    }
    if (platform != _detectedPlatform || _isPrivateError) {
      setState(() {
        _detectedPlatform = platform;
        _isPrivateError = false;
      });
    }
  }

  void _onRetryFromGuide() {
    setState(() => _isPrivateError = false);
    context.read<PartyProvider>().resetPlaylistImport();
    _onImport();
  }

  Future<void> _onImport() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    final partyProvider = context.read<PartyProvider>();
    final apiService = context.read<ApiService>();
    final authProvider = context.read<AuthProvider>();

    partyProvider.onPlaylistImportStarted();

    try {
      final token = await authProvider.currentToken;
      final result = await apiService.importPlaylist(url, sessionId: partyProvider.sessionId, token: token);
      partyProvider.onPlaylistImportSuccess(
        result.tracks,
        result.matched,
        result.unmatchedCount,
      );
    } on ApiException catch (e) {
      if (e.code == 'PLAYLIST_PRIVATE') {
        setState(() => _isPrivateError = true);
      }
      partyProvider.onPlaylistImportError();
    } catch (_) {
      partyProvider.onPlaylistImportError();
    }
  }

  @override
  Widget build(BuildContext context) {
    final partyProvider = context.watch<PartyProvider>();
    final importState = partyProvider.playlistImportState;

    return Card(
      color: DJTokens.surfaceColor,
      margin: const EdgeInsets.symmetric(
        horizontal: DJTokens.spaceMd,
        vertical: DJTokens.spaceSm,
      ),
      child: Padding(
        padding: const EdgeInsets.all(DJTokens.spaceMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              Copy.playlistImportTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: DJTokens.spaceSm),
            TextField(
              key: const Key('playlist-url-field'),
              controller: _urlController,
              onChanged: _onUrlChanged,
              decoration: InputDecoration(
                hintText: Copy.playlistImportHint,
                hintStyle: TextStyle(color: DJTokens.textSecondary),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(DJTokens.spaceSm),
                ),
              ),
              style: TextStyle(color: DJTokens.textPrimary, fontSize: 14),
            ),
            if (_detectedPlatform != null) ...[
              const SizedBox(height: DJTokens.spaceXs),
              Text(
                _detectedPlatform == 'youtube'
                    ? Copy.playlistImportDetected
                    : Copy.playlistImportDetectedSpotify,
                key: const Key('playlist-detected-label'),
                style: TextStyle(
                  color: DJTokens.actionConfirm,
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(height: DJTokens.spaceSm),
            if (importState == LoadingState.loading)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(DJTokens.spaceSm),
                  child: Column(
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: DJTokens.spaceSm),
                      Text(
                        Copy.playlistImportLoading,
                        style: TextStyle(color: DJTokens.textSecondary),
                      ),
                    ],
                  ),
                ),
              )
            else if (importState == LoadingState.success)
              _buildResults(partyProvider)
            else if (importState == LoadingState.error)
              _isPrivateError
                  ? SpotifyGuide(onRetry: _onRetryFromGuide)
                  : _buildError()
            else
              DJTapButton(
                key: const Key('playlist-import-btn'),
                tier: TapTier.social,
                onTap: _detectedPlatform != null ? _onImport : () {},
                child: Opacity(
                  opacity: _detectedPlatform != null ? 1.0 : 0.5,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
                    decoration: BoxDecoration(
                      color: DJTokens.actionPrimary,
                      borderRadius: BorderRadius.circular(DJTokens.spaceSm + DJTokens.spaceXs),
                    ),
                    child: Text(
                      Copy.playlistImportButton,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: DJTokens.textPrimary,
                          ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _onRemoveTrack(int index) {
    context.read<PartyProvider>().removeImportedTrack(index);
  }

  void _onAddManualSong() {
    setState(() => _showManualEntry = true);
  }

  void _onSubmitManualSong() {
    final title = _manualTitleController.text.trim();
    if (title.isEmpty) return;
    final artist = _manualArtistController.text.trim();
    context.read<PartyProvider>().addManualTrack(title, artist);
    _manualTitleController.clear();
    _manualArtistController.clear();
    if (mounted) setState(() => _showManualEntry = false);
  }

  Widget _buildResults(PartyProvider provider) {
    final tracks = provider.importedTracks;
    final bodyMedium = Theme.of(context).textTheme.bodyMedium;
    final bodySmall = Theme.of(context).textTheme.bodySmall;
    final titleSmall = Theme.of(context).textTheme.titleSmall;

    return Column(
      key: const Key('playlist-import-results'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${tracks.length} ${Copy.songsImported}',
          key: const Key('playlist-song-count'),
          style: titleSmall?.copyWith(color: DJTokens.textPrimary),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        SizedBox(
          height: (tracks.length * 56.0).clamp(0, 224.0),
          child: ListView.builder(
            itemCount: tracks.length,
            itemBuilder: (context, index) {
              final track = tracks[index];
              return Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          track['songTitle'] ?? Copy.unknownTrackTitle,
                          style: bodyMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: DJTokens.textPrimary,
                          ),
                        ),
                        Text(
                          track['artist'] ?? Copy.unknownTrackArtist,
                          style: bodySmall?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    key: Key('remove-track-$index'),
                    icon: Icon(Icons.close, size: 18, color: DJTokens.textSecondary),
                    onPressed: () => _onRemoveTrack(index),
                  ),
                ],
              );
            },
          ),
        ),
        Text(
          '${provider.matchedTracks.length} ${Copy.matchedToCatalog}',
          style: bodySmall?.copyWith(color: DJTokens.textSecondary),
        ),
        const SizedBox(height: DJTokens.spaceXs),
        GestureDetector(
          key: const Key('add-song-manually'),
          onTap: _onAddManualSong,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceSm),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.add, size: 18, color: DJTokens.actionPrimary),
                SizedBox(width: DJTokens.spaceXs),
                Text(
                  Copy.addSongManually,
                  style: bodySmall?.copyWith(color: DJTokens.actionPrimary),
                ),
              ],
            ),
          ),
        ),
        if (_showManualEntry) ...[
          const SizedBox(height: DJTokens.spaceSm),
          TextField(
            key: const Key('manual-song-field'),
            controller: _manualTitleController,
            decoration: InputDecoration(
              hintText: Copy.manualSongTitle,
              hintStyle: TextStyle(color: DJTokens.textSecondary),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(DJTokens.spaceSm),
              ),
              isDense: true,
            ),
            style: TextStyle(color: DJTokens.textPrimary, fontSize: 14),
          ),
          const SizedBox(height: DJTokens.spaceXs),
          TextField(
            key: const Key('manual-artist-field'),
            controller: _manualArtistController,
            decoration: InputDecoration(
              hintText: Copy.manualSongArtist,
              hintStyle: TextStyle(color: DJTokens.textSecondary),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(DJTokens.spaceSm),
              ),
              isDense: true,
            ),
            style: TextStyle(color: DJTokens.textPrimary, fontSize: 14),
          ),
          const SizedBox(height: DJTokens.spaceXs),
          GestureDetector(
            key: const Key('manual-song-submit'),
            onTap: _onSubmitManualSong,
            child: Text(
              Copy.addSong,
              style: bodySmall?.copyWith(color: DJTokens.actionPrimary),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildError() {
    return Column(
      children: [
        Text(
          Copy.playlistImportFailed,
          key: const Key('playlist-import-error'),
          style: TextStyle(color: DJTokens.actionDanger),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        DJTapButton(
          key: const Key('playlist-retry-btn'),
          tier: TapTier.social,
          onTap: () {
            context.read<PartyProvider>().resetPlaylistImport();
          },
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
            decoration: BoxDecoration(
              color: DJTokens.actionPrimary,
              borderRadius: BorderRadius.circular(DJTokens.spaceSm + DJTokens.spaceXs),
            ),
            child: Text(
              Copy.playlistImportRetry,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: DJTokens.textPrimary,
                  ),
            ),
          ),
        ),
      ],
    );
  }
}

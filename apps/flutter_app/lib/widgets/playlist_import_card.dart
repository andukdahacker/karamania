import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/spotify_guide.dart';

class PlaylistImportCard extends StatefulWidget {
  const PlaylistImportCard({super.key = const Key('playlist-import-card')});

  @override
  State<PlaylistImportCard> createState() => _PlaylistImportCardState();
}

class _PlaylistImportCardState extends State<PlaylistImportCard> {
  final _urlController = TextEditingController();
  String? _detectedPlatform;
  bool _isPrivateError = false;

  @override
  void dispose() {
    _urlController.dispose();
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

    partyProvider.onPlaylistImportStarted();

    try {
      final result = await apiService.importPlaylist(url, sessionId: partyProvider.sessionId);
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
              style: TextStyle(color: DJTokens.textPrimary),
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
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  key: const Key('playlist-import-btn'),
                  onPressed: _detectedPlatform != null ? _onImport : null,
                  child: const Text(Copy.playlistImportButton),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(PartyProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Copy.playlistImportResults(
            provider.importedTracks.length,
            provider.matchedTracks.length,
            provider.unmatchedCount,
          ),
          key: const Key('playlist-import-results'),
          style: TextStyle(color: DJTokens.textPrimary),
        ),
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
        ElevatedButton(
          key: const Key('playlist-retry-btn'),
          onPressed: () {
            context.read<PartyProvider>().resetPlaylistImport();
          },
          child: const Text(Copy.playlistImportRetry),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/models/setlist_entry.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/session_detail_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:share_plus/share_plus.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/widgets/setlist_poster_widget.dart';

PartyVibe _parseVibe(String? vibe) {
  if (vibe == null) return PartyVibe.general;
  return PartyVibe.values.firstWhere(
    (v) => v.name == vibe,
    orElse: () => PartyVibe.general,
  );
}

class SessionDetailScreen extends StatefulWidget {
  const SessionDetailScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends State<SessionDetailScreen> {
  bool _loadTriggered = false;
  SessionDetailProvider? _detailProvider;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _detailProvider = context.read<SessionDetailProvider>();
    if (!_loadTriggered && _detailProvider!.detailState == LoadingState.idle) {
      _loadTriggered = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadDetail();
      });
    }
  }

  @override
  void dispose() {
    _detailProvider?.reset();
    super.dispose();
  }

  Future<void> _loadDetail() async {
    final authProvider = context.read<AuthProvider>();
    final apiService = context.read<ApiService>();
    final detailProvider = context.read<SessionDetailProvider>();

    detailProvider.detailState = LoadingState.loading;
    try {
      final token = await authProvider.currentToken;
      if (token == null) {
        detailProvider.onLoadError(Copy.loadDetailError);
        return;
      }
      final detail = await apiService.fetchSessionDetail(
        token: token,
        sessionId: widget.sessionId,
      );
      detailProvider.onDetailLoaded(detail);
    } catch (e) {
      debugPrint('Session detail load failed: $e');
      detailProvider.onLoadError(Copy.loadDetailError);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailProvider = context.watch<SessionDetailProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(Copy.sessionDetail),
        backgroundColor: DJTokens.bgColor,
      ),
      body: _buildBody(context, detailProvider),
    );
  }

  Widget _buildBody(BuildContext context, SessionDetailProvider provider) {
    if (provider.detailState == LoadingState.idle ||
        provider.detailState == LoadingState.loading) {
      return const Center(
        child: CircularProgressIndicator(color: DJTokens.textSecondary),
      );
    }

    if (provider.detailState == LoadingState.error) {
      return Center(
        child: GestureDetector(
          onTap: () {
            _loadTriggered = false;
            context.read<SessionDetailProvider>().reset();
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) _loadDetail();
            });
          },
          child: Text(
            Copy.loadDetailError,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DJTokens.textSecondary,
                ),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final detail = provider.detail!;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SessionHeaderSection(detail: detail),
          const SizedBox(height: DJTokens.spaceLg),
          _ParticipantListSection(participants: detail.participants),
          const SizedBox(height: DJTokens.spaceLg),
          _SetlistSection(setlist: detail.setlist),
          const SizedBox(height: DJTokens.spaceLg),
          if (detail.media.isNotEmpty) ...[
            _MediaGallerySection(media: detail.media),
            const SizedBox(height: DJTokens.spaceLg),
          ],
          if (detail.setlist.isNotEmpty) ...[
            _SetlistPosterSection(detail: detail),
            const SizedBox(height: DJTokens.spaceLg),
          ],
          _SessionActions(detail: detail),
          const SizedBox(height: DJTokens.spaceLg),
        ],
      ),
    );
  }
}

class _SessionHeaderSection extends StatelessWidget {
  const _SessionHeaderSection({required this.detail});
  final SessionDetail detail;

  String _formatDuration(int durationMs) {
    final totalMinutes = durationMs ~/ 60000;
    final hours = totalMinutes ~/ 60;
    final minutes = totalMinutes % 60;
    if (hours > 0) return '${hours}h ${minutes}m';
    return '${minutes}m';
  }

  String _formatDate(String isoDate) {
    try {
      final date = DateTime.parse(isoDate).toLocal();
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return '${months[date.month - 1]} ${date.day}, ${date.year}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final venueName = detail.venueName ?? Copy.karaokeNight;
    final dateText = _formatDate(detail.createdAt);
    final durationText = _formatDuration(detail.stats.sessionDurationMs);

    return Container(
      key: const Key('session-detail-header'),
      padding: const EdgeInsets.all(DJTokens.spaceMd),
      decoration: BoxDecoration(
        color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: DJTokens.textSecondary.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  venueName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (detail.vibe != null)
                Text(
                  Copy.vibeEmoji(_parseVibe(detail.vibe)),
                  style: const TextStyle(fontSize: 24),
                  key: const Key('session-detail-vibe'),
                ),
            ],
          ),
          const SizedBox(height: DJTokens.spaceSm),
          Row(
            children: [
              Text(
                dateText,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
              const SizedBox(width: DJTokens.spaceMd),
              const Icon(Icons.timer_outlined, size: 14, color: DJTokens.textSecondary),
              const SizedBox(width: 4),
              Text(
                durationText,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
              const SizedBox(width: DJTokens.spaceMd),
              const Icon(Icons.people_outline, size: 14, color: DJTokens.textSecondary),
              const SizedBox(width: 4),
              Text(
                '${detail.stats.participantCount}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: DJTokens.textSecondary,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ParticipantListSection extends StatelessWidget {
  const _ParticipantListSection({required this.participants});
  final List<SessionDetailParticipant> participants;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Copy.participants,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        ...participants.map((p) => Padding(
              padding: const EdgeInsets.only(bottom: DJTokens.spaceXs),
              child: Container(
                key: Key('participant-${p.displayName}'),
                padding: const EdgeInsets.symmetric(
                  horizontal: DJTokens.spaceMd,
                  vertical: DJTokens.spaceSm,
                ),
                decoration: BoxDecoration(
                  color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        p.displayName,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    if (p.topAward != null) ...[
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
                          p.topAward!,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: DJTokens.actionConfirm,
                              ),
                        ),
                      ),
                      const SizedBox(width: DJTokens.spaceSm),
                    ],
                    Text(
                      '${p.participationScore}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}

class _SetlistSection extends StatelessWidget {
  const _SetlistSection({required this.setlist});
  final List<SessionDetailSetlistItem> setlist;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Copy.setlist,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        ...setlist.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: DJTokens.spaceXs),
              child: Container(
                key: Key('setlist-item-${item.position}'),
                padding: const EdgeInsets.symmetric(
                  horizontal: DJTokens.spaceMd,
                  vertical: DJTokens.spaceSm,
                ),
                decoration: BoxDecoration(
                  color: DJTokens.surfaceElevated.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 28,
                      child: Text(
                        '#${item.position}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                    ),
                    const SizedBox(width: DJTokens.spaceSm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.title,
                            style: Theme.of(context).textTheme.bodyMedium,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            item.artist,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: DJTokens.textSecondary,
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (item.performerName != null || item.awardTitle != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Row(
                                children: [
                                  if (item.performerName != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: DJTokens.spaceXs,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        color: DJTokens.textSecondary.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                      child: Text(
                                        item.performerName!,
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                              color: DJTokens.textSecondary,
                                              fontSize: 10,
                                            ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  if (item.performerName != null && item.awardTitle != null)
                                    const SizedBox(width: DJTokens.spaceXs),
                                  if (item.awardTitle != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: DJTokens.spaceXs,
                                        vertical: 1,
                                      ),
                                      decoration: BoxDecoration(
                                        border: Border.all(
                                          color: DJTokens.actionConfirm.withValues(alpha: 0.5),
                                        ),
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                      child: Text(
                                        item.awardTitle!,
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                              color: DJTokens.actionConfirm,
                                              fontSize: 10,
                                            ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}

class _MediaGallerySection extends StatelessWidget {
  const _MediaGallerySection({required this.media});
  final List<SessionDetailMedia> media;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Copy.mediaGallery,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: DJTokens.spaceXs,
            mainAxisSpacing: DJTokens.spaceXs,
          ),
          itemCount: media.length,
          itemBuilder: (context, index) {
            final item = media[index];
            return GestureDetector(
              key: Key('media-${item.id}'),
              onTap: item.url != null
                  ? () => _showFullScreen(context, item.url!)
                  : null,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: item.url != null
                    ? Image.network(
                        item.url!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _placeholder(),
                      )
                    : _placeholder(),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _placeholder() {
    return Container(
      color: DJTokens.surfaceElevated,
      child: const Center(
        child: Icon(Icons.image, color: DJTokens.textSecondary),
      ),
    );
  }

  void _showFullScreen(BuildContext context, String url) {
    showDialog(
      context: context,
      builder: (context) => GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: EdgeInsets.zero,
          child: InteractiveViewer(
            child: Image.network(url, fit: BoxFit.contain),
          ),
        ),
      ),
    );
  }
}

class _SetlistPosterSection extends StatelessWidget {
  const _SetlistPosterSection({required this.detail});
  final SessionDetail detail;

  @override
  Widget build(BuildContext context) {
    final setlistEntries = detail.setlist.map((item) => SetlistEntry(
          position: item.position,
          title: item.title,
          artist: item.artist,
          performerName: item.performerName,
          awardTitle: item.awardTitle,
          awardTone: item.awardTone,
        )).toList();

    final vibe = _parseVibe(detail.vibe);
    final date = DateTime.tryParse(detail.createdAt)?.toLocal() ?? DateTime.now();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          Copy.setlistPoster,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: DJTokens.textSecondary,
              ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        SetlistPosterWidget(
          setlist: setlistEntries,
          vibe: vibe,
          venueName: detail.venueName,
          date: date,
        ),
      ],
    );
  }

}

class _SessionActions extends StatelessWidget {
  final SessionDetail detail;
  const _SessionActions({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          key: const Key('share-session-btn'),
          onTap: () => _shareSession(),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                Copy.shareSession,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
            ),
          ),
        ),
        const SizedBox(height: DJTokens.spaceSm),
        GestureDetector(
          key: const Key('lets-go-again-btn'),
          onTap: () => _letsGoAgain(),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: DJTokens.spaceMd),
            decoration: BoxDecoration(
              color: DJTokens.surfaceElevated,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                Copy.letsGoAgain,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: DJTokens.textPrimary,
                    ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _shareSession() {
    final shareUrl = '${AppConfig.instance.webLandingUrl}?session=${Uri.encodeComponent(detail.id)}';
    final shareText = Copy.shareSessionMessage(
      venueName: detail.venueName,
      url: shareUrl,
    );
    SharePlus.instance.share(ShareParams(text: shareText));
  }

  void _letsGoAgain() {
    final message = Copy.letsGoAgainMessage(
      venueName: detail.venueName,
      downloadUrl: AppConfig.instance.webLandingUrl,
    );
    SharePlus.instance.share(ShareParams(text: message));
  }
}

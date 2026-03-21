import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:go_router/go_router.dart';

class MediaGalleryScreen extends StatefulWidget {
  const MediaGalleryScreen({super.key});
  @override
  State<MediaGalleryScreen> createState() => _MediaGalleryScreenState();
}

class _MediaGalleryScreenState extends State<MediaGalleryScreen> {
  final ScrollController _scrollController = ScrollController();
  final List<MediaGalleryItem> _captures = [];
  int _total = 0;
  LoadingState _loadState = LoadingState.idle;
  LoadingState _loadMoreState = LoadingState.idle;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadMedia();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  bool get _hasMore => _captures.length < _total;

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        _loadMoreState != LoadingState.loading &&
        _hasMore) {
      _loadMore();
    }
  }

  Future<void> _loadMedia() async {
    setState(() {
      _loadState = LoadingState.loading;
    });
    try {
      final auth = context.read<AuthProvider>();
      final api = context.read<ApiService>();
      final token = await auth.currentToken;
      if (token == null) {
        if (mounted) context.go('/');
        return;
      }
      final result = await api.fetchMyMedia(token: token);
      if (!mounted) return;
      setState(() {
        _captures.clear();
        _captures.addAll(result.captures);
        _total = result.total;
        _loadState = LoadingState.success;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadState = LoadingState.error;
        });
      }
    }
  }

  Future<void> _loadMore() async {
    setState(() {
      _loadMoreState = LoadingState.loading;
    });
    try {
      final auth = context.read<AuthProvider>();
      final api = context.read<ApiService>();
      final token = await auth.currentToken;
      if (token == null) {
        setState(() {
          _loadMoreState = LoadingState.error;
        });
        return;
      }
      final result =
          await api.fetchMyMedia(token: token, offset: _captures.length);
      if (!mounted) return;
      setState(() {
        _captures.addAll(result.captures);
        _total = result.total;
        _loadMoreState = LoadingState.success;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadMoreState = LoadingState.error;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        key: const Key('media-gallery-appbar'),
        title: Text(Copy.myMedia),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loadState == LoadingState.idle ||
        _loadState == LoadingState.loading) {
      return const Center(
          child: CircularProgressIndicator(color: DJTokens.textSecondary));
    }
    if (_loadState == LoadingState.error) {
      return Center(
          child: GestureDetector(
        onTap: _loadMedia,
        child: Text(Copy.loadMediaError,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: DJTokens.textSecondary)),
      ));
    }
    if (_captures.isEmpty) {
      return Center(
          child: Text(Copy.noMediaYet,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: DJTokens.textSecondary)));
    }

    return _buildMediaGrid(context);
  }

  Widget _buildMediaGrid(BuildContext context) {
    final groups = <String, List<MediaGalleryItem>>{};
    for (final c in _captures) {
      groups.putIfAbsent(c.sessionId, () => []).add(c);
    }

    return CustomScrollView(
      controller: _scrollController,
      slivers: [
        for (final entry in groups.entries) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(DJTokens.spaceMd,
                  DJTokens.spaceMd, DJTokens.spaceMd, DJTokens.spaceSm),
              child: GestureDetector(
                onTap: () => context.go('/session/${entry.key}'),
                child: Text(
                  entry.value.first.venueName ?? Copy.karaokeNight,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(color: DJTokens.textSecondary),
                ),
              ),
            ),
          ),
          SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 2,
              mainAxisSpacing: 2,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final item = entry.value[index];
                if (item.url == null) {
                  return Container(
                    key: Key('media-placeholder-${item.id}'),
                    color: DJTokens.surfaceElevated,
                    child: const Center(
                        child: Icon(Icons.broken_image,
                            color: DJTokens.textSecondary)),
                  );
                }
                return GestureDetector(
                  key: Key('media-item-${item.id}'),
                  onTap: () => _showFullscreen(context, item),
                  child: Image.network(
                    item.url!,
                    fit: BoxFit.cover,
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return Container(
                          color: DJTokens.surfaceElevated,
                          child: const Center(
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: DJTokens.textSecondary)));
                    },
                    errorBuilder: (context, error, stackTrace) => Container(
                        color: DJTokens.surfaceElevated,
                        child: const Center(
                            child: Icon(Icons.broken_image,
                                color: DJTokens.textSecondary))),
                  ),
                );
              },
              childCount: entry.value.length,
            ),
          ),
        ],
        if (_hasMore)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(DJTokens.spaceMd),
              child: Center(
                  child: CircularProgressIndicator(
                      color: DJTokens.textSecondary)),
            ),
          ),
      ],
    );
  }

  void _showFullscreen(BuildContext context, MediaGalleryItem item) {
    if (item.url == null) return;
    showDialog(
      context: context,
      builder: (context) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: GestureDetector(
          onTap: () => Navigator.of(context).pop(),
          child: InteractiveViewer(
            child: Center(
                child: Image.network(item.url!, fit: BoxFit.contain)),
          ),
        ),
      ),
    );
  }
}

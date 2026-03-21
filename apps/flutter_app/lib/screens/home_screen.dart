import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/tap_tiers.dart';
import 'package:karamania/socket/client.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/capture_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/state/timeline_provider.dart';
import 'package:karamania/theme/dj_tokens.dart';
import 'package:karamania/widgets/dj_tap_button.dart';
import 'package:karamania/widgets/session_timeline_card.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  bool _initialLoadTriggered = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final authProvider = context.read<AuthProvider>();
    final timelineProvider = context.read<TimelineProvider>();
    if (authProvider.state == AuthState.authenticatedFirebase &&
        !_initialLoadTriggered &&
        timelineProvider.timelineState == LoadingState.idle) {
      _initialLoadTriggered = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadSessions();
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      final timelineProvider = context.read<TimelineProvider>();
      if (timelineProvider.loadMoreState != LoadingState.loading &&
          timelineProvider.hasMore) {
        _loadMore();
      }
    }
  }

  Future<void> _loadSessions() async {
    final authProvider = context.read<AuthProvider>();
    final apiService = context.read<ApiService>();
    final timelineProvider = context.read<TimelineProvider>();

    timelineProvider.timelineState = LoadingState.loading;
    try {
      final token = await authProvider.currentToken;
      if (token == null) {
        timelineProvider.onLoadError();
        return;
      }
      final result = await apiService.fetchSessions(token: token);
      timelineProvider.onSessionsLoaded(result.sessions, result.total);
    } catch (_) {
      timelineProvider.onLoadError();
    }
  }

  Future<void> _loadMore() async {
    final authProvider = context.read<AuthProvider>();
    final apiService = context.read<ApiService>();
    final timelineProvider = context.read<TimelineProvider>();

    timelineProvider.loadMoreState = LoadingState.loading;
    try {
      final token = await authProvider.currentToken;
      if (token == null) {
        timelineProvider.onLoadMoreError();
        return;
      }
      final result = await apiService.fetchSessions(
        token: token,
        offset: timelineProvider.currentOffset,
      );
      timelineProvider.onMoreSessionsLoaded(result.sessions, result.total);
    } catch (_) {
      timelineProvider.onLoadMoreError();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final partyProvider = context.watch<PartyProvider>();
    final scaleFactor = MediaQuery.textScalerOf(context).scale(1.0);
    final horizontalPadding =
        DJTokens.spaceMd * scaleFactor.clamp(1.0, 1.5);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 428),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
              child: Column(
                mainAxisAlignment: authProvider.isAuthenticated
                    ? MainAxisAlignment.start
                    : MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!authProvider.isAuthenticated)
                    const SizedBox(height: DJTokens.spaceXl),
                  Text(
                    Copy.appTitle,
                    style: Theme.of(context).textTheme.displayLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: DJTokens.spaceXl),
                  DJTapButton(
                    key: const Key('create-party-btn'),
                    tier: TapTier.consequential,
                    onTap: () => _onCreateParty(context),
                    child: partyProvider.createPartyLoading == LoadingState.loading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: DJTokens.textPrimary,
                            ),
                          )
                        : Text(
                            Copy.createParty,
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                  ),
                  const SizedBox(height: DJTokens.spaceMd),
                  DJTapButton(
                    key: const Key('join-party-btn'),
                    tier: TapTier.social,
                    onTap: () => context.go('/join'),
                    child: Text(
                      Copy.joinParty,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                  const SizedBox(height: DJTokens.spaceXl),
                  if (!authProvider.isAuthenticated) ...[
                    Text(
                      Copy.guestSignInPrompt,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    TextButton(
                      onPressed: () async {
                        try {
                          await authProvider.signInWithGoogle();
                        } catch (_) {
                          // Error handled by AuthProvider state
                        }
                      },
                      child: Text(
                        Copy.signIn,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: Theme.of(context).colorScheme.secondary,
                            ),
                      ),
                    ),
                  ] else ...[
                    if (authProvider.avatarUrl != null)
                      CircleAvatar(
                        key: const Key('user-avatar'),
                        radius: DJTokens.spaceLg,
                        backgroundImage: NetworkImage(authProvider.avatarUrl!),
                        backgroundColor: DJTokens.surfaceElevated,
                      ),
                    if (authProvider.avatarUrl != null)
                      const SizedBox(height: DJTokens.spaceSm),
                    Text(
                      authProvider.displayName ?? Copy.defaultUserName,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    GestureDetector(
                      key: const Key('my-media-btn'),
                      onTap: () => context.go('/media'),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.photo_library_outlined, color: DJTokens.textSecondary, size: 16),
                          const SizedBox(width: DJTokens.spaceXs),
                          Text(
                            Copy.myMedia,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: DJTokens.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    Text(
                      Copy.yourSessions,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: DJTokens.textSecondary,
                          ),
                    ),
                    const SizedBox(height: DJTokens.spaceSm),
                    Expanded(child: _buildTimeline(context)),
                    const SizedBox(height: DJTokens.spaceMd),
                    TextButton(
                      key: const Key('sign-out-btn'),
                      onPressed: () => _onSignOut(context),
                      child: Text(
                        Copy.signOut,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: DJTokens.textSecondary,
                            ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTimeline(BuildContext context) {
    final timelineProvider = context.watch<TimelineProvider>();

    if (timelineProvider.timelineState == LoadingState.idle ||
        timelineProvider.timelineState == LoadingState.loading) {
      return const Center(
        child: CircularProgressIndicator(
          color: DJTokens.textSecondary,
        ),
      );
    }

    if (timelineProvider.timelineState == LoadingState.error) {
      return Center(
        child: GestureDetector(
          onTap: _loadSessions,
          child: Text(
            Copy.loadSessionsError,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: DJTokens.textSecondary,
                ),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    if (timelineProvider.sessions.isEmpty &&
        timelineProvider.timelineState == LoadingState.success) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              Copy.startFirstParty,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: DJTokens.textSecondary,
                  ),
            ),
            const SizedBox(height: DJTokens.spaceMd),
            TextButton(
              onPressed: () => _onCreateParty(context),
              child: Text(
                Copy.createParty,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.secondary,
                    ),
              ),
            ),
          ],
        ),
      );
    }

    final itemCount = timelineProvider.sessions.length +
        (timelineProvider.hasMore ? 1 : 0);

    return ListView.builder(
      controller: _scrollController,
      itemCount: itemCount,
      itemBuilder: (context, index) {
        if (index >= timelineProvider.sessions.length) {
          if (timelineProvider.loadMoreState == LoadingState.error) {
            return GestureDetector(
              onTap: _loadMore,
              child: Padding(
                padding: const EdgeInsets.all(DJTokens.spaceMd),
                child: Text(
                  Copy.loadSessionsError,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: DJTokens.textSecondary,
                      ),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return const Padding(
            padding: EdgeInsets.all(DJTokens.spaceMd),
            child: Center(
              child: CircularProgressIndicator(
                color: DJTokens.textSecondary,
              ),
            ),
          );
        }

        final session = timelineProvider.sessions[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: DJTokens.spaceSm),
          child: SessionTimelineCard(
            session: session,
            onTap: () => context.go('/session/${session.id}'),
          ),
        );
      },
    );
  }

  Future<void> _onSignOut(BuildContext context) async {
    final authProvider = context.read<AuthProvider>();
    final timelineProvider = context.read<TimelineProvider>();
    await FirebaseAuth.instance.signOut();
    authProvider.onSignedOut();
    timelineProvider.reset();
    _initialLoadTriggered = false;
  }

  Future<void> _onCreateParty(BuildContext context) async {
    final authProvider = context.read<AuthProvider>();
    final partyProvider = context.read<PartyProvider>();
    final socketClient = context.read<SocketClient>();
    final apiService = context.read<ApiService>();

    String? displayName = authProvider.displayName;

    // Guest name entry if no name set
    if (!authProvider.isAuthenticated && displayName == null) {
      if (!context.mounted) return;
      displayName = await _showNameDialog(context);
      if (displayName == null || displayName.isEmpty) return;
    }

    try {
      await socketClient.createParty(
        apiService: apiService,
        authProvider: authProvider,
        partyProvider: partyProvider,
        serverUrl: AppConfig.instance.serverUrl,
        displayName: displayName,
        captureProvider: context.read<CaptureProvider>(),
      );
      if (!context.mounted) return;
      context.go('/lobby');
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${Copy.createPartyError}: $e')),
      );
    }
  }

  Future<String?> _showNameDialog(BuildContext context) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: DJTokens.surfaceElevated,
        title: Text(
          Copy.enterYourName,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        content: TextField(
          key: const Key('guest-name-input'),
          controller: controller,
          maxLength: 30,
          autofocus: true,
          style: const TextStyle(color: DJTokens.textPrimary),
          decoration: const InputDecoration(
            hintText: Copy.enterYourName,
            hintStyle: TextStyle(color: DJTokens.textSecondary),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text(Copy.cancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text(Copy.ok),
          ),
        ],
      ),
    );
  }
}

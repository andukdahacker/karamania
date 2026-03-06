import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/theme/dj_tokens.dart';

/// Custom scroll behavior that disables Android overscroll glow (Task 1.9).
class _NoOverscrollGlowBehavior extends ScrollBehavior {
  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) {
    return child;
  }
}

/// GoRouter configuration with placeholder routes.
final GoRouter _router = GoRouter(
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const _PlaceholderScreen(title: 'Home'),
    ),
    GoRoute(
      path: '/party',
      builder: (context, state) => const _PartyScreen(),
      // Back button during party shows confirm exit dialog (Task 1.8)
      onExit: (context, state) async {
        final shouldExit = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: DJTokens.surfaceElevated,
            title: const Text('Leave Party?'),
            content: const Text('Are you sure you want to leave the party?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('STAY'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('LEAVE'),
              ),
            ],
          ),
        );
        return shouldExit ?? false;
      },
    ),
  ],
);

class KaramaniaApp extends StatelessWidget {
  const KaramaniaApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Update accessibility state from MediaQuery
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) {
        context.read<AccessibilityProvider>().updateFromMediaQuery(context);
      }
    });

    final vibe = context.watch<PartyProvider>().vibe;

    return MaterialApp.router(
      title: 'Karamania',
      theme: createDJTheme(vibe: vibe),
      routerConfig: _router,
      scrollBehavior: _NoOverscrollGlowBehavior(),
      debugShowCheckedModeBanner: false,
    );
  }
}

/// Placeholder home screen.
class _PlaceholderScreen extends StatelessWidget {
  const _PlaceholderScreen({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 428),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: DJTokens.spaceMd,
              ),
              child: Text(
                title,
                style: Theme.of(context).textTheme.displayLarge,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Party screen with animated background driven by PartyProvider.
class _PartyScreen extends StatelessWidget {
  const _PartyScreen();

  @override
  Widget build(BuildContext context) {
    final party = context.watch<PartyProvider>();

    return Scaffold(
      body: AnimatedContainer(
        duration: DJTokens.transitionFast,
        color: party.backgroundColor,
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 428),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: DJTokens.spaceMd,
                ),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    'Party',
                    style: Theme.of(context).textTheme.displayLarge,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

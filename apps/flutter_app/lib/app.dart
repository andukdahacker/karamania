import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/lobby_screen.dart';
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
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/lobby',
      builder: (context, state) => const LobbyScreen(),
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

/// Default system UI overlay style for dark backgrounds (Task 9.4).
const _darkOverlayStyle = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
);

class KaramaniaApp extends StatelessWidget {
  const KaramaniaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final vibe = context.watch<PartyProvider>().vibe;

    return MaterialApp.router(
      title: 'Karamania',
      theme: createDJTheme(vibe: vibe),
      routerConfig: _router,
      scrollBehavior: _NoOverscrollGlowBehavior(),
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        return _AccessibilityMediaQueryUpdater(
          child: AnnotatedRegion<SystemUiOverlayStyle>(
            value: _darkOverlayStyle,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}

/// Updates AccessibilityProvider from MediaQuery on dependency changes.
/// Uses didChangeDependencies to avoid accumulating callbacks on rebuild.
class _AccessibilityMediaQueryUpdater extends StatefulWidget {
  const _AccessibilityMediaQueryUpdater({required this.child});
  final Widget child;

  @override
  State<_AccessibilityMediaQueryUpdater> createState() =>
      _AccessibilityMediaQueryUpdaterState();
}

class _AccessibilityMediaQueryUpdaterState
    extends State<_AccessibilityMediaQueryUpdater> {
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    context.read<AccessibilityProvider>().updateFromMediaQuery(context);
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Party screen with animated background driven by PartyProvider.
class _PartyScreen extends StatelessWidget {
  const _PartyScreen();

  @override
  Widget build(BuildContext context) {
    final party = context.watch<PartyProvider>();
    final scaleFactor = MediaQuery.textScalerOf(context).scale(1.0);
    final horizontalPadding =
        DJTokens.spaceMd * scaleFactor.clamp(1.0, 1.5);

    return Scaffold(
      body: AnimatedContainer(
        duration: DJTokens.transitionFast,
        color: party.backgroundColor,
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 428),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
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

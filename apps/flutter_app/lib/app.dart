import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/screens/join_screen.dart';
import 'package:karamania/screens/lobby_screen.dart';
import 'package:karamania/screens/party_screen.dart';
import 'package:karamania/screens/session_detail_screen.dart';
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
  redirect: (context, state) {
    // Deep link: /?code=VIBE → /join?code=VIBE
    if (state.matchedLocation == '/' && state.uri.queryParameters.containsKey('code')) {
      final code = state.uri.queryParameters['code'];
      return '/join?code=$code';
    }
    return null;
  },
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/join',
      builder: (context, state) {
        final code = state.uri.queryParameters['code'];
        return JoinScreen(initialCode: code);
      },
    ),
    GoRoute(
      path: '/lobby',
      builder: (context, state) => const LobbyScreen(),
    ),
    GoRoute(
      path: '/session/:id',
      builder: (context, state) {
        final sessionId = state.pathParameters['id']!;
        return SessionDetailScreen(sessionId: sessionId);
      },
    ),
    GoRoute(
      path: '/party',
      builder: (context, state) => const PartyScreen(),
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


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
import 'package:karamania/screens/detection_poc_screen.dart';
import 'package:karamania/screens/media_gallery_screen.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/branded_dialog.dart';

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
    // Deep link: /?session=SESSION_ID → /session/SESSION_ID
    if (state.matchedLocation == '/' && state.uri.queryParameters.containsKey('session')) {
      final sessionId = state.uri.queryParameters['session'];
      final uuidPattern = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
      if (sessionId != null && uuidPattern.hasMatch(sessionId)) {
        return '/session/$sessionId';
      }
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
      path: '/media',
      builder: (context, state) => const MediaGalleryScreen(),
    ),
    GoRoute(
      path: '/poc-detection',
      builder: (_, __) => const DetectionPocScreen(),
    ),
    GoRoute(
      path: '/party',
      builder: (context, state) => const PartyScreen(),
      // Back button during party shows confirm exit dialog (Task 1.8)
      onExit: (context, state) async {
        final shouldExit = await showBrandedConfirm(
          context: context,
          title: Copy.leavePartyConfirmTitle,
          message: Copy.leavePartyConfirmBody,
          confirmLabel: Copy.leavePartyConfirmYes,
          cancelLabel: Copy.leavePartyConfirmNo,
        );
        return shouldExit;
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


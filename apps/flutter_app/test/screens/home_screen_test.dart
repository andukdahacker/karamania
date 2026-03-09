import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/api/api_service.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/screens/home_screen.dart';
import 'package:karamania/socket/client.dart';
import 'package:karamania/state/accessibility_provider.dart';
import 'package:karamania/state/auth_provider.dart';
import 'package:karamania/state/party_provider.dart';

Widget _wrapWithProviders(Widget child) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => PartyProvider()),
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => AccessibilityProvider()),
      Provider<SocketClient>(create: (_) => SocketClient.instance),
      Provider<ApiService>(create: (_) => ApiService(baseUrl: 'http://localhost')),
    ],
    child: MediaQuery(
      data: const MediaQueryData(),
      child: MaterialApp(
        home: child,
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('HomeScreen', () {
    testWidgets('renders CREATE PARTY and JOIN PARTY buttons', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('CREATE PARTY'), findsOneWidget);
      expect(find.text('JOIN PARTY'), findsOneWidget);
    });

    testWidgets('buttons have correct widget keys', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.byKey(const Key('create-party-btn')), findsOneWidget);
      expect(find.byKey(const Key('join-party-btn')), findsOneWidget);
    });

    testWidgets('buttons meet minimum size requirements (48x48px)', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      final createBtn = tester.getSize(find.byKey(const Key('create-party-btn')));
      expect(createBtn.width, greaterThanOrEqualTo(48.0));
      expect(createBtn.height, greaterThanOrEqualTo(48.0));

      final joinBtn = tester.getSize(find.byKey(const Key('join-party-btn')));
      expect(joinBtn.width, greaterThanOrEqualTo(48.0));
      expect(joinBtn.height, greaterThanOrEqualTo(48.0));
    });

    testWidgets('shows sign-in prompt for unauthenticated users', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('Create an account to save your session history'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);
    });

    testWidgets('renders app title', (tester) async {
      await tester.pumpWidget(_wrapWithProviders(const HomeScreen()));
      await tester.pump();

      expect(find.text('KARAMANIA'), findsOneWidget);
    });
  });
}

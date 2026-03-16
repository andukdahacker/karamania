import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/state/loading_state.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/widgets/tv_pairing_overlay.dart';

Widget buildTestWidget(PartyProvider provider) {
  return MaterialApp(
    home: Scaffold(
      body: ChangeNotifierProvider.value(
        value: provider,
        child: const TvPairingOverlay(),
      ),
    ),
  );
}

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('TvPairingOverlay', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    testWidgets('renders pairing code input and connect button in disconnected state', (tester) async {
      await tester.pumpWidget(buildTestWidget(provider));

      expect(find.text(Copy.tvPairingTitle), findsOneWidget);
      expect(find.text(Copy.tvPairingInstructions), findsOneWidget);
      expect(find.text(Copy.tvPairingConnect), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('shows connected state with disconnect button', (tester) async {
      provider.setTvStatus(TvConnectionStatus.connected);
      await tester.pumpWidget(buildTestWidget(provider));

      expect(find.text(Copy.tvConnected), findsOneWidget);
      expect(find.text(Copy.tvUnpair), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('shows reconnecting state', (tester) async {
      provider.setTvStatus(TvConnectionStatus.reconnecting);
      await tester.pumpWidget(buildTestWidget(provider));

      expect(find.text(Copy.tvReconnecting), findsOneWidget);
    });

    testWidgets('shows loading spinner when pairing in progress', (tester) async {
      provider.setTvPairingState(LoadingState.loading);
      await tester.pumpWidget(buildTestWidget(provider));

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text(Copy.tvPairingConnect), findsNothing);
    });

    testWidgets('shows error message when present', (tester) async {
      provider.setTvStatus(TvConnectionStatus.disconnected, message: 'Invalid pairing code');
      await tester.pumpWidget(buildTestWidget(provider));

      expect(find.text('Invalid pairing code'), findsOneWidget);
    });

    testWidgets('disables text field when loading', (tester) async {
      provider.setTvPairingState(LoadingState.loading);
      await tester.pumpWidget(buildTestWidget(provider));

      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.enabled, isFalse);
    });
  });
}

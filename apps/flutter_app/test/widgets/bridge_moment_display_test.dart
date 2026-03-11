import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/widgets/bridge_moment_display.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    home: Scaffold(body: Center(child: child)),
  );
}

void main() {
  group('BridgeMomentDisplay', () {
    testWidgets('shows performer hype when currentPerformer is set', (tester) async {
      await tester.pumpWidget(_wrap(
        const BridgeMomentDisplay(currentPerformer: 'Alice'),
      ));

      expect(find.byKey(const Key('bridge-performer-hype')), findsOneWidget);
      expect(find.byKey(const Key('bridge-performer-name')), findsOneWidget);
      expect(find.text('Alice'), findsOneWidget);
      expect(find.text(Copy.bridgeUpNext), findsOneWidget);
      expect(find.text(Copy.bridgeLetsGo), findsOneWidget);
      expect(find.byKey(const Key('bridge-generic')), findsNothing);
    });

    testWidgets('shows generic bridge when no performer', (tester) async {
      await tester.pumpWidget(_wrap(
        const BridgeMomentDisplay(),
      ));

      expect(find.byKey(const Key('bridge-generic')), findsOneWidget);
      expect(find.text(Copy.bridgeGetReady), findsOneWidget);
      expect(find.text(Copy.bridgeWhosNext), findsOneWidget);
      expect(find.byKey(const Key('bridge-performer-hype')), findsNothing);
    });

    testWidgets('shows generic bridge when performer is null', (tester) async {
      await tester.pumpWidget(_wrap(
        const BridgeMomentDisplay(currentPerformer: null),
      ));

      expect(find.byKey(const Key('bridge-generic')), findsOneWidget);
    });
  });
}

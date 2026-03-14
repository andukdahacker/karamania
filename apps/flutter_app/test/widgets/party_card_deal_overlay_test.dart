import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/constants/party_cards.dart';
import 'package:karamania/widgets/party_card_deal_overlay.dart';

void main() {
  const testCard = PartyCardData(
    id: 'chipmunk-mode',
    title: 'Chipmunk Mode',
    description: 'Sing in the highest pitch you can manage',
    type: PartyCardType.vocal,
    emoji: '🐿️',
  );

  Widget buildTestOverlay({
    PartyCardData card = testCard,
    bool isCurrentSinger = true,
    bool redrawUsed = false,
    String? currentPerformerName,
    String? acceptedCardTitle,
    VoidCallback? onAccept,
    VoidCallback? onDismiss,
    VoidCallback? onRedraw,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: PartyCardDealOverlay(
          card: card,
          isCurrentSinger: isCurrentSinger,
          redrawUsed: redrawUsed,
          currentPerformerName: currentPerformerName,
          acceptedCardTitle: acceptedCardTitle,
          onAccept: onAccept,
          onDismiss: onDismiss,
          onRedraw: onRedraw,
        ),
      ),
    );
  }

  group('PartyCardDealOverlay - Singer View', () {
    testWidgets('renders card with correct title', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('party-card-title')), findsOneWidget);
      expect(find.text('Chipmunk Mode'), findsOneWidget);
    });

    testWidgets('renders card with correct description', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('party-card-description')), findsOneWidget);
      expect(find.text('Sing in the highest pitch you can manage'), findsOneWidget);
    });

    testWidgets('renders accept button (56x56)', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      final acceptButton = find.byKey(const Key('card-accept-button'));
      expect(acceptButton, findsOneWidget);

      final sizedBox = tester.widget<SizedBox>(acceptButton);
      expect(sizedBox.width, 56);
      expect(sizedBox.height, 56);
    });

    testWidgets('renders dismiss button (48x48)', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      final dismissButton = find.byKey(const Key('card-dismiss-button'));
      expect(dismissButton, findsOneWidget);

      final sizedBox = tester.widget<SizedBox>(dismissButton);
      expect(sizedBox.width, 48);
      expect(sizedBox.height, 48);
    });

    testWidgets('renders redraw button (48x48) with "1 FREE" badge', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      final redrawButton = find.byKey(const Key('card-redraw-button'));
      expect(redrawButton, findsOneWidget);

      final sizedBox = tester.widget<SizedBox>(redrawButton);
      expect(sizedBox.width, 48);
      expect(sizedBox.height, 48);

      expect(find.byKey(const Key('card-redraw-badge')), findsOneWidget);
      expect(find.text('1 FREE'), findsOneWidget);
    });

    testWidgets('hides redraw button after use', (tester) async {
      await tester.pumpWidget(buildTestOverlay(redrawUsed: true));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('card-redraw-button')), findsNothing);
    });

    testWidgets('accept button tap calls onAccept', (tester) async {
      bool accepted = false;
      await tester.pumpWidget(buildTestOverlay(
        onAccept: () => accepted = true,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('card-accept-button')));
      await tester.pump();

      expect(accepted, isTrue);
    });

    testWidgets('dismiss button tap calls onDismiss', (tester) async {
      bool dismissed = false;
      await tester.pumpWidget(buildTestOverlay(
        onDismiss: () => dismissed = true,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('card-dismiss-button')));
      await tester.pump();

      expect(dismissed, isTrue);
    });

    testWidgets('auto-dismiss timer fires after 8 seconds', (tester) async {
      bool dismissed = false;
      await tester.pumpWidget(buildTestOverlay(
        onDismiss: () => dismissed = true,
      ));
      await tester.pumpAndSettle();

      // Advance 8 seconds
      for (int i = 0; i < 8; i++) {
        await tester.pump(const Duration(seconds: 1));
      }

      expect(dismissed, isTrue);
    });

    testWidgets('countdown timer is visible', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('card-countdown-timer')), findsOneWidget);
    });

    testWidgets('updates when card changes (redraw)', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.text('Chipmunk Mode'), findsOneWidget);

      const newCard = PartyCardData(
        id: 'robot-mode',
        title: 'Robot Mode',
        description: 'Sing like a robot',
        type: PartyCardType.vocal,
        emoji: '🤖',
      );

      await tester.pumpWidget(buildTestOverlay(card: newCard));
      await tester.pumpAndSettle();

      expect(find.text('Robot Mode'), findsOneWidget);
      expect(find.text('Chipmunk Mode'), findsNothing);
    });
  });

  group('PartyCardDealOverlay - Audience View', () {
    testWidgets('shows CHALLENGE INCOMING with singer name', (tester) async {
      await tester.pumpWidget(buildTestOverlay(
        isCurrentSinger: false,
        currentPerformerName: 'Alice',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('party-card-audience-view')), findsOneWidget);
      expect(find.text(Copy.cardChallengeIncoming), findsOneWidget);
      expect(find.text('Alice'), findsOneWidget);
    });

    testWidgets('does NOT show card details or buttons', (tester) async {
      await tester.pumpWidget(buildTestOverlay(
        isCurrentSinger: false,
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('card-accept-button')), findsNothing);
      expect(find.byKey(const Key('card-dismiss-button')), findsNothing);
      expect(find.byKey(const Key('card-redraw-button')), findsNothing);
      expect(find.byKey(const Key('party-card-title')), findsNothing);
      expect(find.byKey(const Key('party-card-description')), findsNothing);
    });

    testWidgets('shows accepted card title after broadcast', (tester) async {
      await tester.pumpWidget(buildTestOverlay(
        isCurrentSinger: false,
        acceptedCardTitle: 'Chipmunk Mode',
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('party-card-accepted-view')), findsOneWidget);
      expect(find.text('Chipmunk Mode'), findsOneWidget);
    });
  });
}

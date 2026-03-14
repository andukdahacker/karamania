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

  Widget buildTestOverlay({PartyCardData card = testCard}) {
    return MaterialApp(
      home: Scaffold(
        body: PartyCardDealOverlay(card: card),
      ),
    );
  }

  group('PartyCardDealOverlay', () {
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

    testWidgets('renders card container', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('party-card-deal')), findsOneWidget);
    });

    testWidgets('renders card emoji', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.text('🐿️'), findsOneWidget);
    });

    testWidgets('renders card type label', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.text('Vocal Modifier'), findsOneWidget);
    });

    testWidgets('renders challenge label', (tester) async {
      await tester.pumpWidget(buildTestOverlay());
      await tester.pumpAndSettle();

      expect(find.text(Copy.partyCardTitle), findsOneWidget);
    });

    testWidgets('updates when card changes (host re-deal)', (tester) async {
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
}

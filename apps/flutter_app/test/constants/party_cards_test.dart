import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/party_cards.dart';

void main() {
  group('PartyCardType', () {
    test('vocal borderColor is blue (0xFF4A9EFF)', () {
      expect(PartyCardType.vocal.borderColor, 0xFF4A9EFF);
    });

    test('performance borderColor is purple (0xFFAB47BC)', () {
      expect(PartyCardType.performance.borderColor, 0xFFAB47BC);
    });

    test('group borderColor is gold (0xFFFFB300)', () {
      expect(PartyCardType.group.borderColor, 0xFFFFB300);
    });
  });

  group('PartyCardData.fromPayload', () {
    test('parses valid vocal card payload', () {
      final card = PartyCardData.fromPayload({
        'cardId': 'chipmunk-mode',
        'title': 'Chipmunk Mode',
        'description': 'Sing high',
        'cardType': 'vocal',
        'emoji': '🐿️',
      });

      expect(card.id, 'chipmunk-mode');
      expect(card.title, 'Chipmunk Mode');
      expect(card.description, 'Sing high');
      expect(card.type, PartyCardType.vocal);
      expect(card.emoji, '🐿️');
    });

    test('parses performance card type', () {
      final card = PartyCardData.fromPayload({
        'cardId': 'blind-karaoke',
        'title': 'Blind Karaoke',
        'description': 'Close eyes',
        'cardType': 'performance',
        'emoji': '🙈',
      });

      expect(card.type, PartyCardType.performance);
    });

    test('parses group card type', () {
      final card = PartyCardData.fromPayload({
        'cardId': 'tag-team',
        'title': 'Tag Team',
        'description': 'Alternate verses',
        'cardType': 'group',
        'emoji': '🏷️',
      });

      expect(card.type, PartyCardType.group);
    });
  });
}

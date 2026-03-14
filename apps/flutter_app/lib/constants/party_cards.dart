import 'package:karamania/constants/copy.dart';

/// Party card type for visual differentiation.
enum PartyCardType {
  vocal,
  performance,
  group;

  /// Border color for card type visual differentiation (AC #1).
  int get borderColor => switch (this) {
    PartyCardType.vocal => 0xFF4A9EFF,       // Blue
    PartyCardType.performance => 0xFFAB47BC,  // Purple
    PartyCardType.group => 0xFFFFB300,        // Gold
  };

  String get label => switch (this) {
    PartyCardType.vocal => Copy.partyCardTypeVocal,
    PartyCardType.performance => Copy.partyCardTypePerformance,
    PartyCardType.group => Copy.partyCardTypeGroup,
  };
}

/// Party card data — matches server PartyCard interface.
class PartyCardData {
  const PartyCardData({
    required this.id,
    required this.title,
    required this.description,
    required this.type,
    required this.emoji,
  });

  final String id;
  final String title;
  final String description;
  final PartyCardType type;
  final String emoji;

  /// Parse from socket event payload.
  factory PartyCardData.fromPayload(Map<String, dynamic> payload) {
    return PartyCardData(
      id: payload['cardId'] as String,
      title: payload['title'] as String,
      description: payload['description'] as String,
      type: PartyCardType.values.byName(payload['cardType'] as String),
      emoji: payload['emoji'] as String,
    );
  }
}

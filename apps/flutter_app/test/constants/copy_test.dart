import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/constants/copy.dart';
import 'package:karamania/theme/dj_theme.dart';

void main() {
  group('Vibe-keyed content maps', () {
    test('vibeConfettiEmojis has entries for all 5 vibes', () {
      for (final vibe in PartyVibe.values) {
        expect(vibeConfettiEmojis.containsKey(vibe), isTrue,
            reason: '${vibe.name} missing from vibeConfettiEmojis');
        expect(vibeConfettiEmojis[vibe], isNotEmpty,
            reason: '${vibe.name} has empty confetti list');
      }
    });

    test('vibeReactionButtons has entries for all 5 vibes', () {
      for (final vibe in PartyVibe.values) {
        expect(vibeReactionButtons.containsKey(vibe), isTrue,
            reason: '${vibe.name} missing from vibeReactionButtons');
        expect(vibeReactionButtons[vibe], isNotEmpty,
            reason: '${vibe.name} has empty reaction list');
      }
    });

    test('vibeAwardFlavors has entries for all 5 vibes', () {
      for (final vibe in PartyVibe.values) {
        expect(vibeAwardFlavors.containsKey(vibe), isTrue,
            reason: '${vibe.name} missing from vibeAwardFlavors');
        expect(vibeAwardFlavors[vibe], isNotEmpty,
            reason: '${vibe.name} has empty award flavor');
      }
    });

    test('vibeEmojiLabels has entries for all 5 vibes', () {
      for (final vibe in PartyVibe.values) {
        expect(vibeEmojiLabels.containsKey(vibe), isTrue,
            reason: '${vibe.name} missing from vibeEmojiLabels');
        expect(vibeEmojiLabels[vibe], isNotEmpty,
            reason: '${vibe.name} has empty emoji label');
      }
    });

    test('each vibe reaction set has exactly 4 reactions', () {
      for (final vibe in PartyVibe.values) {
        expect(vibeReactionButtons[vibe]!.length, 4,
            reason: '${vibe.name} should have exactly 4 reaction buttons');
      }
    });

    test('general confetti has expected values', () {
      expect(vibeConfettiEmojis[PartyVibe.general], ['🎉', '✨', '🌟', '🎊']);
    });

    test('general award flavor has expected value', () {
      expect(vibeAwardFlavors[PartyVibe.general], 'Absolute showstopper');
    });
  });

  group('Session sharing messages (Story 9.5)', () {
    test('shareSessionMessage includes session URL with correct format', () {
      final result = Copy.shareSessionMessage(
        venueName: 'Test Bar',
        url: 'https://karamania.app?session=abc',
      );
      expect(result, contains('https://karamania.app?session=abc'));
      expect(result, contains('Test Bar'));
    });

    test('shareSessionMessage uses fallback when venueName is null', () {
      final result = Copy.shareSessionMessage(
        venueName: null,
        url: 'https://karamania.app?session=abc',
      );
      expect(result, contains(Copy.karaokeNight));
    });

    test('letsGoAgainMessage includes venue name and date suggestion', () {
      final result = Copy.letsGoAgainMessage(
        venueName: 'Test Bar',
        downloadUrl: 'https://karamania.app',
      );
      expect(result, contains('Test Bar'));
      expect(result, contains('karamania.app'));
      // Verify date is in M/D format
      expect(result, matches(RegExp(r'\d{1,2}/\d{1,2}')));
    });

    test('letsGoAgainMessage uses fallback when venueName is null', () {
      final result = Copy.letsGoAgainMessage(
        venueName: null,
        downloadUrl: 'https://karamania.app',
      );
      expect(result, contains('karaoke'));
    });
  });
}

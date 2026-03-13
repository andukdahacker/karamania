import 'package:flutter_test/flutter_test.dart';
import 'package:karamania/config/app_config.dart';
import 'package:karamania/state/party_provider.dart';
import 'package:karamania/theme/dj_theme.dart';

void main() {
  setUpAll(() {
    AppConfig.initializeForTest(flavor: 'dev');
  });

  group('PartyProvider quick ceremony state', () {
    late PartyProvider provider;

    setUp(() {
      provider = PartyProvider(wakelockToggle: (_) {});
    });

    test('onCeremonyQuick sets ceremonyAward, ceremonyPerformerName, ceremonyTone and notifies listeners', () {
      int notifyCount = 0;
      provider.addListener(() => notifyCount++);

      provider.onCeremonyQuick(
        award: 'Mic Drop Master',
        performerName: 'Alice',
        tone: 'hype',
      );

      expect(provider.ceremonyAward, 'Mic Drop Master');
      expect(provider.ceremonyPerformerName, 'Alice');
      expect(provider.ceremonyTone, 'hype');
      expect(notifyCount, 1);
    });

    test('onCeremonyQuick sets ceremonyRevealAt to null', () {
      // First set a revealAt via anticipation
      provider.onCeremonyAnticipation(
        performerName: 'Bob',
        revealAt: 1234567890,
      );
      expect(provider.ceremonyRevealAt, 1234567890);

      // Quick ceremony should clear it
      provider.onCeremonyQuick(
        award: 'Star of the Show',
        performerName: null,
        tone: 'comedic',
      );

      expect(provider.ceremonyRevealAt, isNull);
    });

    test('onCeremonyQuick with null performerName', () {
      provider.onCeremonyQuick(
        award: 'Star of the Show',
        performerName: null,
        tone: 'hype',
      );

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyAward, 'Star of the Show');
    });

    test('ceremony state cleared when DJ state changes away from ceremony', () {
      provider.onDjStateUpdate(state: DJState.ceremony, ceremonyType: 'quick');
      provider.onCeremonyQuick(
        award: 'Star of the Show',
        performerName: 'Alice',
        tone: 'hype',
      );

      // Transition away from ceremony
      provider.onDjStateUpdate(state: DJState.interlude);

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyRevealAt, isNull);
      expect(provider.ceremonyAward, isNull);
      expect(provider.ceremonyTone, isNull);
    });

    test('ceremony state cleared on session end', () {
      provider.onCeremonyQuick(
        award: 'Star of the Show',
        performerName: 'Alice',
        tone: 'hype',
      );

      provider.onSessionEnded();

      expect(provider.ceremonyPerformerName, isNull);
      expect(provider.ceremonyAward, isNull);
      expect(provider.ceremonyTone, isNull);
    });
  });
}
